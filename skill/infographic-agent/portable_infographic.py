#!/usr/bin/env python3
"""
Infographic Agent — portable skill (direct Gemini image generation)

Turns any topic, note, or file of text into a polished infographic PNG using the
exact same two-agent pipeline as the web demo:

  1. Research orchestrator  (gemini-3.5-flash) — grounds the topic with Google
     Search, then engineers a precise, text-accurate image-generation prompt.
  2. Image generator        (gemini-3.1-flash-lite-image) — renders the prompt
     directly into a PNG.

There are NO browser or Playwright dependencies — the only requirement is
Google's GenAI SDK:

    pip install google-genai

Quick start:

    # First run walks you through getting a free key from Google AI Studio
    python3 portable_infographic.py "Top 5 programming languages in 2026"

    # ...or set it yourself and go
    export GEMINI_API_KEY="your-key"
    python3 portable_infographic.py "Q2 sales highlights" --output sales.png

After the first draft the CLI drops into an interactive refine loop so you can
iterate ("make the header bolder", "use teal accents") and watch each revision
update in seconds.
"""

import argparse
import json
import os
import re
import subprocess
import sys
import time
from pathlib import Path

try:
    from google import genai
    from google.genai import types
except ImportError:
    sys.stderr.write(
        "[Error] The Google GenAI SDK is not installed.\n"
        "        Install it with:  pip install google-genai\n"
    )
    sys.exit(1)

# --------------------------------------------------------------------------- #
# Constants — keep these model IDs in lockstep with the web demo (src/types.ts)
# --------------------------------------------------------------------------- #

ORCHESTRATOR_MODEL = "gemini-3.5-flash"          # research + prompt engineering
IMAGE_MODEL = "gemini-3.1-flash-lite-image"      # direct infographic rendering

AISTUDIO_KEY_URL = "https://aistudio.google.com/apikey"
CONFIG_DIR = Path(os.environ.get("XDG_CONFIG_HOME", Path.home() / ".config")) / "infographic-agent"
CONFIG_PATH = CONFIG_DIR / "config.json"

# Soft limit: larger inputs still work but burn tokens and rarely fit one poster.
MAX_TEXT_CHARS = 20000

RETRYABLE = ("408", "429", "500", "502", "503", "504")

MODES = {
    "data-story": "Data-forward layout with charts, graphs, statistical callouts, trend lines, and percentage highlights.",
    "executive-summary": "Clean and minimal. Large headline numbers, 3-5 key takeaways, strategic insights, board-ready aesthetics.",
    "technical-deep-dive": "Dense and precise. Architecture diagrams, code snippets in monospace, system-flow arrows, technical terminology.",
    "classroom": "Friendly and illustrative. Numbered steps, visual analogies, approachable language, warm colors.",
    "quick-slide": "Single-slide format with minimal text, high visual impact, presentation-ready large typography.",
    "custom": "",
}

# gemini-3.1-flash-lite-image only supports 1K output.
SUPPORTED_ASPECTS = {"1:1", "9:16", "16:9", "3:4", "4:3", "1:4"}


# --------------------------------------------------------------------------- #
# System prompts — mirrors the web demo's two agents (src/services/geminiService.ts)
# --------------------------------------------------------------------------- #

RESEARCH_SYSTEM_PROMPT = """<role>
You are an expert infographic architect and visual data designer. You transform
raw content into an optimized image-generation prompt that produces a
professional, text-accurate infographic.
</role>

<constitution>
1. NEVER fabricate data, statistics, or claims.
2. Every data point MUST come from the user's content or grounded Google Search results.
3. If information is missing, use Google Search to gather real data from credible sources.
4. Quote ALL text strings exactly as they should appear in the infographic.
</constitution>

<prompt_rules>
The "prompt" field you output is sent directly to an image-generation model. It must:
- Start with: "Generate a professional infographic image"
- Use positive framing only — describe what TO include, never negations.
- Give step-by-step spatial instructions: "At the top, place X. Below that, add Y..."
- Quote ALL text strings exactly, wrapped in quotation marks.
- Specify exact colors using #hex values and describe typography (weight, size, style).
- Include accessibility notes: minimum contrast 4.5:1 for normal text, 3:1 for large text.
- Stay under 800 words — dense and precise, not verbose.
- End with composition notes: spacing, alignment, professional polish.
</prompt_rules>

<output_format>
Respond with valid JSON only. No markdown fences. No extra text. Schema:
{
  "title": "string — compelling infographic title",
  "prompt": "string — the complete image-generation prompt following <prompt_rules>"
}
</output_format>"""

IMAGE_SYSTEM_PROMPT = """<role>
You are a professional infographic image generator. Render a high-quality
infographic from the provided prompt.
</role>
<constitution>
1. Render ALL quoted text exactly as written — spelling, capitalization, and punctuation must match perfectly.
2. Fill the entire canvas — use the full aspect ratio with no empty borders.
3. Never fabricate text that was not explicitly provided in the prompt.
</constitution>
<requirements>
- Legible, professional fonts; crisp, clearly readable text; consistent font families.
- Contrast: minimum 4.5:1 for normal text, 3:1 for large text.
- Clear visual hierarchy via size, weight, and spacing. Balanced composition with intentional whitespace.
</requirements>"""

REFINE_SYSTEM_PROMPT = """<role>
You are an infographic refinement specialist. You receive the current
infographic image and a user's edit request.
</role>
<constitution>
1. ONLY modify what the user explicitly requested — treat this as a diff-style edit.
2. Preserve all elements, text, colors, spacing, and styling not mentioned in the request.
3. Render ALL text with perfect fidelity unless the user specifically changes it.
4. Return the complete refined infographic with the same dimensions and aspect ratio.
</constitution>"""


# --------------------------------------------------------------------------- #
# Small utilities
# --------------------------------------------------------------------------- #

def info(msg: str) -> None:
    print(msg, flush=True)


def warn(msg: str) -> None:
    sys.stderr.write(f"[Warn] {msg}\n")


def error(msg: str) -> None:
    sys.stderr.write(f"[Error] {msg}\n")


def _scrub(message: str) -> str:
    """Never echo raw SDK errors verbatim: strip anything that looks like a credential."""
    return re.sub(
        r'((?:key=|x-goog-api-key[=:]\s*|Authorization[=:]\s*)"?)[^\s"&]+',
        r"\1[REDACTED]",
        str(message),
    )


def _is_transient(err: Exception) -> bool:
    return any(code in str(err) for code in RETRYABLE)


def _friendly_api_error(err: Exception) -> str:
    s = str(err)
    if "401" in s or "403" in s or "API_KEY_INVALID" in s or "PERMISSION_DENIED" in s:
        return (
            "Your Gemini API key is invalid or lacks permission.\n"
            f"        Get a fresh free key at {AISTUDIO_KEY_URL} and re-run with --setup."
        )
    if "429" in s or "RESOURCE_EXHAUSTED" in s:
        return "Rate limit / quota exceeded. Wait a moment and try again."
    return _scrub(s)


# --------------------------------------------------------------------------- #
# API key onboarding — the "one-click, free from AI Studio" flow
# --------------------------------------------------------------------------- #

def _load_saved_key() -> str:
    try:
        if CONFIG_PATH.exists():
            data = json.loads(CONFIG_PATH.read_text())
            return (data.get("gemini_api_key") or "").strip()
    except Exception:
        pass
    return ""


def _save_key(key: str) -> None:
    try:
        CONFIG_DIR.mkdir(parents=True, exist_ok=True)
        CONFIG_PATH.write_text(json.dumps({"gemini_api_key": key}, indent=2))
        # Lock the file down — it holds a secret.
        os.chmod(CONFIG_PATH, 0o600)
        info(f"✓ Saved your key to {CONFIG_PATH} (readable only by you).")
    except Exception as e:
        warn(f"Could not save key to {CONFIG_PATH}: {e}. It will work for this run only.")


def _try_open_url(url: str) -> bool:
    """Open a URL in the default browser. Returns True if a launcher was invoked."""
    try:
        if sys.platform == "darwin":
            subprocess.Popen(["open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        elif os.name == "nt":
            os.startfile(url)  # type: ignore[attr-defined]
        else:
            subprocess.Popen(["xdg-open", url], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
        return True
    except Exception:
        return False


def interactive_setup() -> str:
    """Walk the user through getting a free Gemini API key and save it."""
    info(
        "\n──────────────────────────────────────────────────────────────\n"
        " Let's get you a FREE Gemini API key (takes ~20 seconds)\n"
        "──────────────────────────────────────────────────────────────\n"
        f" 1. Open  {AISTUDIO_KEY_URL}\n"
        " 2. Sign in with any Google account (free — no billing required)\n"
        ' 3. Click "Create API key", then copy it\n'
    )

    if sys.stdin.isatty():
        try:
            answer = input(" Open that page in your browser now? [Y/n] ").strip().lower()
        except (EOFError, KeyboardInterrupt):
            answer = "n"
        if answer in ("", "y", "yes"):
            if _try_open_url(AISTUDIO_KEY_URL):
                info(" → Opened your browser.")
            else:
                info(f" → Could not auto-open a browser. Visit {AISTUDIO_KEY_URL} manually.")

    if not sys.stdin.isatty():
        error(
            "No Gemini API key found and no interactive terminal to prompt in.\n"
            f"        Set one with:  export GEMINI_API_KEY=\"your-key\"   (get it free at {AISTUDIO_KEY_URL})"
        )
        sys.exit(1)

    try:
        import getpass
        key = getpass.getpass(" Paste your API key here (hidden), then press Enter: ").strip()
    except (EOFError, KeyboardInterrupt):
        info("")
        sys.exit(1)

    if not key:
        error("No key entered. Re-run and paste your key, or set GEMINI_API_KEY.")
        sys.exit(1)

    _save_key(key)
    return key


def resolve_api_key(force_setup: bool = False) -> str:
    """Resolve the Gemini API key from env → saved config → interactive setup."""
    if force_setup:
        return interactive_setup()

    key = (os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY") or "").strip()
    if key:
        return key

    key = _load_saved_key()
    if key:
        return key

    # Vertex AI is still supported for enterprise users who prefer it.
    if os.environ.get("GOOGLE_CLOUD_PROJECT"):
        return ""  # signal: use Vertex path

    return interactive_setup()


def build_client(api_key: str) -> "genai.Client":
    if api_key:
        return genai.Client(api_key=api_key)
    # Vertex AI fallback (GOOGLE_CLOUD_PROJECT is set).
    project = os.environ["GOOGLE_CLOUD_PROJECT"]
    location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
    if location == "global":
        location = "us-central1"
    return genai.Client(vertexai=True, project=project, location=location)


# --------------------------------------------------------------------------- #
# Agent 1 — research orchestrator (gemini-3.5-flash + Google Search grounding)
# --------------------------------------------------------------------------- #

def research_prompt(client, content: str, mode: str, aspect: str, extra: str) -> str:
    """Ground the topic and engineer a precise image-generation prompt."""
    mode_hint = MODES.get(mode, "")
    user_prompt = "\n".join(
        p for p in [
            "<task>Analyze the content below and produce the JSON described in your instructions. "
            "Use Google Search to fill gaps or verify facts.</task>",
            f"<preferences>Mode: {mode}{(' — ' + mode_hint) if mode_hint else ''}",
            f"Aspect ratio: {aspect}",
            f"Additional instructions: {extra}" if extra else None,
            "</preferences>",
            "<content>",
            content,
            "</content>",
        ] if p is not None
    )

    config = types.GenerateContentConfig(
        system_instruction=RESEARCH_SYSTEM_PROMPT,
        temperature=0.7,
        tools=[types.Tool(google_search=types.GoogleSearch())],
        http_options=types.HttpOptions(timeout=180_000),
    )

    info("🔎 Researching and planning the infographic (gemini-3.5-flash)...")
    last_error = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=ORCHESTRATOR_MODEL, contents=user_prompt, config=config
            )
            plan = _parse_json(response.text or "")
            prompt = (plan.get("prompt") or "").strip()
            title = (plan.get("title") or "").strip()
            if not prompt:
                raise ValueError("research agent returned no prompt")
            if title:
                info(f'   ↳ "{title}"')
            return prompt
        except Exception as e:  # noqa: BLE001
            last_error = e
            if _is_transient(e) and attempt < 2:
                wait = 2 ** (attempt + 1)
                warn(f"Transient API error, retrying in {wait}s...")
                time.sleep(wait)
            else:
                break

    # Research is a best-effort enhancement: fall back to a direct prompt so the
    # user still gets an image instead of a hard failure.
    warn(f"Research step failed ({_friendly_api_error(last_error)}). Falling back to a direct prompt.")
    return direct_prompt(content, mode, extra)


def direct_prompt(content: str, mode: str, extra: str) -> str:
    """Build an image prompt without the research agent (used by --no-research / fallback)."""
    mode_hint = MODES.get(mode, "")
    return (
        "Generate a professional infographic image that clearly and accurately visualizes "
        "the following content. Use a clean modern layout with strong visual hierarchy, "
        "legible typography, and accessible color contrast (minimum 4.5:1). "
        "Render all key text exactly as written.\n\n"
        + (f"Style: {mode_hint}\n\n" if mode_hint else "")
        + (f"Additional instructions: {extra}\n\n" if extra else "")
        + f"Content:\n{content}"
    )


def _parse_json(text: str) -> dict:
    cleaned = text.strip()
    if cleaned.startswith("```"):
        cleaned = re.sub(r"^```(?:json)?\s*\n?", "", cleaned)
        cleaned = re.sub(r"\n?```\s*$", "", cleaned)
    return json.loads(cleaned)


# --------------------------------------------------------------------------- #
# Agent 2 — image generator (gemini-3.1-flash-lite-image)
# --------------------------------------------------------------------------- #

def _extract_image(response) -> bytes:
    parts = (response.candidates[0].content.parts if response.candidates else None) or []
    for part in parts:
        inline = getattr(part, "inline_data", None)
        if inline and inline.data:
            return inline.data
    raise RuntimeError("The model did not return an image. Try rephrasing your topic and generate again.")


def generate_image(client, prompt: str, aspect: str) -> bytes:
    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(aspect_ratio=aspect, image_size="1K"),
        http_options=types.HttpOptions(timeout=180_000),
    )
    info("🎨 Generating the infographic (gemini-3.1-flash-lite-image)...")
    return _call_image_model(
        client,
        contents=[f"{prompt}\n\n{IMAGE_SYSTEM_PROMPT}"],
        config=config,
    )


def refine_image(client, image_bytes: bytes, instruction: str, aspect: str) -> bytes:
    config = types.GenerateContentConfig(
        response_modalities=["TEXT", "IMAGE"],
        image_config=types.ImageConfig(aspect_ratio=aspect, image_size="1K"),
        http_options=types.HttpOptions(timeout=180_000),
    )
    contents = [
        types.Part.from_bytes(data=image_bytes, mime_type="image/png"),
        types.Part.from_text(
            text=(
                "<current_image>The attached image is the current infographic.</current_image>\n"
                f"<refinement>{instruction}</refinement>\n\n{REFINE_SYSTEM_PROMPT}"
            )
        ),
    ]
    return _call_image_model(client, contents=contents, config=config)


def _call_image_model(client, contents, config) -> bytes:
    last_error = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=IMAGE_MODEL, contents=contents, config=config
            )
            return _extract_image(response)
        except Exception as e:  # noqa: BLE001
            last_error = e
            if _is_transient(e) and attempt < 2:
                wait = 2 ** (attempt + 1)
                warn(f"Transient API error, retrying in {wait}s...")
                time.sleep(wait)
            else:
                break
    raise RuntimeError(_friendly_api_error(last_error))


# --------------------------------------------------------------------------- #
# Output handling
# --------------------------------------------------------------------------- #

def save_png(image_bytes: bytes, output_path: str) -> str:
    path = os.path.realpath(output_path)
    if not path.lower().endswith(".png"):
        path += ".png"
    parent = os.path.dirname(path)
    if parent and not os.path.isdir(parent):
        error(f"Output directory does not exist: {parent}")
        sys.exit(1)
    with open(path, "wb") as f:
        f.write(image_bytes)
    return path


def open_output(path: str) -> None:
    if _try_open_url(path):
        info("   ↳ Opened in your default image viewer.")


# --------------------------------------------------------------------------- #
# Interactive refine loop — fast, iterative preview
# --------------------------------------------------------------------------- #

def refine_loop(client, image_bytes: bytes, output_path: str, aspect: str, auto_open: bool) -> None:
    info(
        "\n💬 Refine it, or press Enter to finish.\n"
        '   e.g. "make the header bolder", "use teal accents", "add source citations"'
    )
    revision = 1
    while True:
        try:
            instruction = input("\nRefine › ").strip()
        except (EOFError, KeyboardInterrupt):
            info("")
            break
        if not instruction or instruction.lower() in ("q", "quit", "exit", "done"):
            break
        try:
            image_bytes = refine_image(client, image_bytes, instruction, aspect)
        except Exception as e:  # noqa: BLE001
            error(_scrub(str(e)))
            continue
        revision += 1
        base, ext = os.path.splitext(output_path)
        rev_path = save_png(image_bytes, f"{base}-v{revision}{ext or '.png'}")
        info(f"✓ Saved revision {revision}: {rev_path}")
        if auto_open:
            open_output(rev_path)


# --------------------------------------------------------------------------- #
# CLI
# --------------------------------------------------------------------------- #

def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        prog="infographic-agent",
        description="Generate a professional infographic PNG directly with Gemini "
        "(research orchestrator + image model). No browser dependencies.",
    )
    parser.add_argument("topic", nargs="?", help="Topic or content to visualize")
    parser.add_argument("--text", help="Alternative to the positional topic argument")
    parser.add_argument("--output", "-o", default="infographic.png", help="Output PNG path (default: infographic.png)")
    parser.add_argument("--mode", "-m", default="data-story", choices=sorted(MODES.keys()),
                        help="Infographic style (default: data-story)")
    parser.add_argument("--aspect", "-a", default="9:16", choices=sorted(SUPPORTED_ASPECTS),
                        help="Aspect ratio (default: 9:16)")
    parser.add_argument("--instructions", "-i", default="", help="Extra styling / content instructions")
    parser.add_argument("--no-research", action="store_true",
                        help="Skip the research agent and generate directly from your text")
    parser.add_argument("--no-open", action="store_true", help="Do not auto-open the result")
    parser.add_argument("--yes", "-y", action="store_true", help="Non-interactive: generate once and exit (no refine loop)")
    parser.add_argument("--setup", action="store_true", help="(Re)configure your Gemini API key and exit")
    return parser


def main() -> None:
    parser = build_parser()
    args = parser.parse_args()

    if args.setup:
        interactive_setup()
        info("\n✓ You're all set. Generate one with:\n"
             '    infographic-agent "Top 5 programming languages in 2026"')
        return

    content = (args.text or args.topic or "").strip()
    if not content:
        parser.print_help()
        sys.exit(1)

    if len(content) > MAX_TEXT_CHARS:
        warn(f"Input is {len(content)} chars (> {MAX_TEXT_CHARS}); large inputs rarely fit one poster and burn tokens.")

    api_key = resolve_api_key()
    try:
        client = build_client(api_key)
    except Exception as e:  # noqa: BLE001
        error(_scrub(str(e)))
        sys.exit(1)

    try:
        if args.no_research:
            prompt = direct_prompt(content, args.mode, args.instructions)
        else:
            prompt = research_prompt(client, content, args.mode, args.aspect, args.instructions)
        image_bytes = generate_image(client, prompt, args.aspect)
    except Exception as e:  # noqa: BLE001
        error(_friendly_api_error(e))
        sys.exit(1)

    path = save_png(image_bytes, args.output)
    info(f"\n✓ Saved infographic: {path}")

    auto_open = not args.no_open
    if auto_open:
        open_output(path)

    interactive = not args.yes and sys.stdin.isatty()
    if interactive:
        refine_loop(client, image_bytes, path, args.aspect, auto_open)

    info("\nDone. 🎉")


if __name__ == "__main__":
    main()
