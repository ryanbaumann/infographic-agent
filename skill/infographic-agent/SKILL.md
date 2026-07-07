---
name: infographic-agent
description: >
  Generate professional infographics, visual summaries, charts, and data visualizations. 
  This skill uses an executable Python script that generates a stunning HTML/CSS design and screenshots it using headless Playwright to output a clean, static PNG with 100% spelling accuracy and blazing fast speed.
  It is fully portable to any agent CLI environment.
compatibility: "Requires Python 3.8+, google-genai SDK, and Playwright (with the Chromium browser installed)"
metadata:
  version: "2.0.1"
  author: "Infographic Agent contributors"
---

# Infographic Agent Skill (Portable)

<role>
You are an expert AI Infographic Designer and Coordinator. You engineer and generate high-quality static infographic PNGs, ensuring perfect text rendering and structural accuracy.
</role>

<context>
This skill relies on a hybrid generation pipeline implemented in Python:
1. **Data & Layout (LLM):** Parses the user's content and constraints into a beautifully designed HTML/CSS page layout.
2. **Visual Assembly (Headless Playwright):** Renders the page in a headless browser and screenshots it, outputting a static PNG. This completely avoids the text hallucination and spelling errors inherent to diffusion image models while maintaining premium styling (glassmorphism, gradients, modern typography).
3. **Speed:** Because it runs in a single fast LLM pass without heavy diffusion image generation or multi-agent evaluation, it produces a static PNG in seconds.

The entire workflow is encapsulated in `portable_infographic.py`.

**Security posture:** the model-generated HTML is untrusted, so the script renders it with JavaScript disabled and all network requests blocked — the page must be fully self-contained, and it cannot phone home or pull remote content into the screenshot. If this skill is invoked autonomously, treat the `--output` path as trusted input: it is resolved to a real path but will write wherever the invoker points it.
</context>

<workflow>
1. **Identify Request:** Confirm the user wants to generate an infographic.
2. **Setup Environment:** Install the dependencies and browser binary, then set credentials:
   ```bash
   pip install google-genai playwright
   playwright install chromium

   # Either a Gemini API key (get one at https://aistudio.google.com/apikey):
   export GEMINI_API_KEY="your-key"
   # ...or Vertex AI credentials:
   export GOOGLE_CLOUD_PROJECT="your-project"   # optional: GOOGLE_CLOUD_LOCATION (defaults to us-central1)
   ```
3. **Execute:** Run the portable script to generate the static PNG. A non-zero exit code means generation or rendering failed — check the printed error.
4. **Deliver Output:** Output the path to the resulting `.png` file.
</workflow>

<instructions>
When the user asks you to create an infographic:

1. **Run Generation via Script:**
   Use the `portable_infographic.py` script provided in this skill directory to generate the static PNG infographic.

**Example Usage:**
```bash
python3 skill/infographic-agent/portable_infographic.py --text "Top 5 programming languages in 2026" --output infographic.png
```

### Alternative: Orchestrate directly with subagents
If you prefer to orchestrate the generation yourself without the script:
1. Write a prompt to an LLM subagent asking for a complete, self-contained HTML/CSS page containing a stunning, modern infographic based on the provided content.
2. Load that HTML file and use a screenshot tool or standard screenshot script to capture the page as a static PNG.
3. Save the returned PNG file and provide the link to the user.

Note: only the scripted path carries the hardening described above (temp-file cleanup, JS disabled, network blocked). If you orchestrate manually, apply the same precautions yourself before rendering untrusted HTML.
</instructions>

<principles>
### The 3 Hard Rules of Infographics

1. **Text Accuracy First:** Never use an image model to draw text. Always use structured text rendered over visuals (like HTML/CSS screenshotting) to guarantee 100% spelling accuracy.
2. **Data Accuracy Rule:** Never hallucinate data points. Give the exact numbers requested.
3. **Layout Complexity Rule:** Use clean, standard, modern UI paradigms (cards, dashboards, vertical timelines) rather than messy unstructured layouts.
</principles>
