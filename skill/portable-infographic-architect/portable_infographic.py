#!/usr/bin/env python3
"""
Portable Infographic Architect (Decoupled HTML/CSS -> Static PNG Approach)
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
import sys
import argparse
import asyncio
import tempfile
from google import genai
from google.genai import types

SYSTEM_PROMPT = """<role>
You are an expert Frontend Developer and Infographic Architect.
</role>
<instructions>
You must generate a complete, standalone, self-contained HTML file containing a stunning, modern infographic based on the provided content.

### Aesthetic Requirements:
1. **Premium Modern UI**: Use advanced CSS styling like glassmorphism (backdrop-filter: blur), soft shadows, glowing accents, and smooth gradients.
2. **Responsive Layout**: Use CSS Flexbox or CSS Grid. The layout should look like a vertical infographic (similar to a 9:16 aspect ratio poster) or a clean dashboard.
3. **Typography**: Use standard modern web fonts (e.g., system-ui, or import a Google Font like 'Inter' or 'Outfit').
4. **Icons**: Use inline SVG icons or emoji to represent key data points.
5. **No External Assets**: The file must be fully self-contained (all CSS inside <style>, no external image links unless they are data URIs).
6. **Background**: Give the body a beautiful, rich background (e.g., a dark mode mesh gradient, deep space navy with glowing teal, or a clean light mode with soft emerald/slate accents).

### Rules:
- Return ONLY the raw HTML code. Do NOT wrap it in ```html markdown blocks.
- Ensure all text from the user's prompt is accurately spelled and included in the layout.
</instructions>
"""

def generate_html_infographic(client, content: str, model_id: str) -> str:
    print(f"Generating HTML/CSS layout...")
    try:
        response = client.models.generate_content(
            model=model_id,
            contents=content,
            config=types.GenerateContentConfig(
                system_instruction=SYSTEM_PROMPT,
                temperature=0.7
            )
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
        print(f"[Error] Failed to generate HTML: {e}")
        return None

async def render_html_to_png(html_content: str, output_path: str):
    print("Rendering HTML layout to static PNG using headless browser...")
    try:
        from playwright.async_api import async_playwright
    except ImportError:
        print("[Error] Playwright is not installed. Please install it with 'pip install playwright'.")
        sys.exit(1)
        
    # Write to a temporary HTML file
    with tempfile.NamedTemporaryFile(suffix=".html", mode="w", delete=False) as temp_file:
        temp_file.write(html_content)
        temp_file_path = temp_file.name

    try:
        async with async_playwright() as p:
            browser = await p.chromium.launch()
            page = await browser.new_page()
            # Set a standard vertical poster viewport (800 width, 1200 height)
            await page.set_viewport_size({"width": 800, "height": 1200})
            
            await page.goto(f"file://{temp_file_path}")
            
            # Wait for layout/fonts to stabilize
            await asyncio.sleep(2)
            
            await page.screenshot(path=output_path, full_page=True)
            await browser.close()
            print(f"[Success] Saved static PNG infographic to {output_path}")
    except Exception as e:
        print(f"[Error] Failed to render HTML to PNG: {e}")
    finally:
        # Clean up the temp file
        if os.path.exists(temp_file_path):
            os.remove(temp_file_path)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--text", required=True, help="Content to visualize")
    parser.add_argument("--output", default="infographic.png", help="Output PNG file path")
    args = parser.parse_args()

    api_key = os.environ.get("GEMINI_API_KEY")
    project = os.environ.get("GOOGLE_CLOUD_PROJECT")
    
    if api_key:
        client = genai.Client(api_key=api_key)
        model_id = 'gemini-3.5-flash'
    elif project:
        location = os.environ.get("GOOGLE_CLOUD_LOCATION", "us-central1")
        if location == "global": location = "us-central1"
        client = genai.Client(vertexai=True, project=project, location=location)
        model_id = 'gemini-2.5-flash'
    else:
        print("Error: Either GEMINI_API_KEY or GOOGLE_CLOUD_PROJECT environment variable must be set.")
        sys.exit(1)
        
    html_content = generate_html_infographic(client, args.text, model_id)
    
    if html_content:
        # Run async rendering
        asyncio.run(render_html_to_png(html_content, args.output))
    else:
        print("\n[Error] Failed to generate infographic.")
        sys.exit(1)

if __name__ == "__main__":
    main()
