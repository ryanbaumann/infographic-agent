#!/usr/bin/env python3
"""
Infographic Agent — portable skill (Decoupled HTML/CSS -> Static PNG Approach)
Usage:
  export GEMINI_API_KEY="your-key"
  # or if using Vertex AI (used automatically by google-genai if no api key but project is set)
  python3 portable_infographic.py --text "Top 5 programming languages in 2026" --output final.png

This script uses the google-genai SDK to generate a stunning HTML/CSS layout,
then uses Playwright to capture a headless screenshot, saving the final result as a static PNG.
This guarantees 100% spelling accuracy, modern aesthetics (glassmorphism, gradients),
and lightning fast execution in a single pass.
"""

import os
import re
import sys
import argparse
import asyncio
import tempfile
import time

try:
    from google import genai
    from google.genai import types
except ImportError:
    print("[Error] google-genai is not installed. Please install it with 'pip install google-genai'.")
    sys.exit(1)

# Soft limit: larger inputs still work but burn tokens and rarely fit one poster.
MAX_TEXT_CHARS = 20000

SYSTEM_PROMPT = """<role>
You are an expert Frontend Developer and Infographic Designer.
</role>
<instructions>
You must generate a complete, standalone, self-contained HTML file containing a stunning, modern infographic based on the provided content.

### Aesthetic Requirements:
1. **Premium Modern UI**: Use advanced CSS styling like glassmorphism (backdrop-filter: blur), soft shadows, glowing accents, and smooth gradients.
2. **Responsive Layout**: Use CSS Flexbox or CSS Grid. The layout should look like a vertical infographic (similar to a 9:16 aspect ratio poster) or a clean dashboard.
3. **Typography**: Use modern system font stacks (e.g., system-ui, -apple-system, 'Segoe UI', sans-serif). Do not load external fonts — the page is rendered offline.
4. **Icons**: Use inline SVG icons or emoji to represent key data points.
5. **No External Assets**: The file must be fully self-contained (all CSS inside <style>, no external stylesheets, fonts, scripts, or image links unless they are data URIs). The page is rendered with JavaScript disabled and all network access blocked, so anything external will simply not appear.
6. **Background**: Give the body a beautiful, rich background (e.g., a dark mode mesh gradient, deep space navy with glowing teal, or a clean light mode with soft emerald/slate accents).

### Rules:
- Return ONLY the raw HTML code. Do NOT wrap it in ```html markdown blocks.
- Ensure all text from the user's prompt is accurately spelled and included in the layout.
</instructions>
"""

# Never echo raw SDK errors: strip anything that looks like a credential.
def _scrub(message: str) -> str:
    return re.sub(r'((?:key=|x-goog-api-key[=:]\s*|Authorization[=:]\s*)"?)[^\s"&]+', r'\1[REDACTED]', message)


def generate_html_infographic(client, content: str, model_id: str) -> str:
    print("Generating HTML/CSS layout...")
    last_error = None
    for attempt in range(3):
        try:
            response = client.models.generate_content(
                model=model_id,
                contents=content,
                config=types.GenerateContentConfig(
                    system_instruction=SYSTEM_PROMPT,
                    temperature=0.7,
                    http_options=types.HttpOptions(timeout=180_000),
                ),
            )

            raw_text = response.text.strip()
            # Clean up markdown if the model hallucinates it despite instructions
            if raw_text.startswith("```html"):
                raw_text = raw_text[7:]
            if raw_text.startswith("```"):
                raw_text = raw_text[3:]
            if raw_text.endswith("```"):
                raw_text = raw_text[:-3]

            return raw_text.strip()
        except Exception as e:
            last_error = e
            transient = any(code in str(e) for code in ("429", "500", "502", "503"))
            if transient and attempt < 2:
                wait = 2 ** (attempt + 1)
                print(f"[Warn] Transient API error ({type(e).__name__}), retrying in {wait}s...")
                time.sleep(wait)
            else:
                break

    print(f"[Error] Failed to generate HTML ({type(last_error).__name__}): {_scrub(str(last_error))}")
    return None


async def render_html_to_png(html_content: str, output_path: str) -> bool:
    print("Rendering HTML layout to static PNG using headless browser...")
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[Error] Playwright is not installed. Please install it with 'pip install playwright' followed by 'playwright install chromium'.")
        return False

    # Write to a temporary HTML file
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False) as temp_file:
        temp_file.write(html_content)
        temp_file_path = temp_file.name

    # The HTML is model-generated and therefore untrusted: render it with
    # JavaScript disabled and every non-file:// request blocked so it cannot
    # phone home or pull remote content into the screenshot.
    async def _block_remote(route):
        if route.request.url.startswith("file://"):
            await route.continue_()
        else:
            await route.abort()

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page(java_script_enabled=False)
            await page.route("**/*", _block_remote)
            # Set a standard vertical poster viewport (800 width, 1200 height)
            await page.set_viewport_size({"width": 800, "height": 1200})

            await page.goto(f"file://{temp_file_path}", wait_until="load")

            # Give the layout a moment to stabilize
            await asyncio.sleep(1)

            await page.screenshot(path=output_path, full_page=True)
            await browser.close()
            print(f"[Success] Saved static PNG infographic to {output_path}")
            return True
    except Exception as e:
        print(f"[Error] Failed to render HTML to PNG ({type(e).__name__}): {_scrub(str(e))}")
        return False
    finally:
        # Clean up the temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)


def main():
    parser = argparse.ArgumentParser(
        description="Generate a static PNG infographic from text via Gemini (HTML/CSS layout) + headless Chromium screenshot."
    )
    parser.add_argument("--text", required=True, help="Content to visualize")
    parser.add_argument("--output", default="infographic.png", help="Output PNG file path")
    args = parser.parse_args()

    if len(args.text) > MAX_TEXT_CHARS:
        print(f"[Warn] --text is {len(args.text)} chars (> {MAX_TEXT_CHARS}); very large inputs rarely fit a single infographic and burn extra tokens.")

    # Resolve the output path up front so failures are loud, not silent.
    output_path = os.path.realpath(args.output)
    if not output_path.endswith(".png"):
        output_path += ".png"
    if not os.path.isdir(os.path.dirname(output_path)):
        print(f"[Error] Output directory does not exist: {os.path.dirname(output_path)}")
        sys.exit(1)

    api_key = os.environ.get("GEMINI_API_KEY")
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")

    if api_key:
        client = genai.Client(api_key=api_key)
        model_id = 'gemini-3.5-flash'
    elif project:
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        if location == "global": location = "us-central1"
        client = genai.Client(vertexai=True, project=project, location=location)
        # Same model as the API-key path; kept as a separate line in case
        # Vertex model availability ever lags the Gemini API.
        model_id = 'gemini-3.5-flash'
    else:
        print("Error: Either GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT environment variable must be set.")
        sys.exit(1)

    html_content = generate_html_infographic(client, args.text, model_id)

    if not html_content:
        print("\n[Error] Failed to generate infographic.")
        sys.exit(1)

    if not asyncio.run(render_html_to_png(html_content, output_path)):
        print("\n[Error] Failed to render infographic.")
        sys.exit(1)


if __name__ == "__main__":
    main()
