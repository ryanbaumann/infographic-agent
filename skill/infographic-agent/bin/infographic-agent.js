#!/usr/bin/env node
/**
 * infographic-agent CLI
 *
 * Thin Node.js shim that delegates to `portable_infographic.py`, which is
 * bundled in this npm package.  Node is only used here because npm/npx needs
 * a JS entry-point; all the heavy lifting (Gemini API + headless Chromium
 * screenshot) lives in the Python script.
 *
 * Usage (via npx):
 *   npx infographic-agent --text "Top 5 programming languages in 2026" --output infographic.png
 *
 * Prerequisites (auto-checked and reported below):
 *   pip install google-genai playwright
 *   playwright install chromium
 *   export GEMINI_API_KEY="your-key"
 */

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const scriptPath = resolve(__dirname, "../portable_infographic.py");
const pkg = JSON.parse(readFileSync(resolve(__dirname, "../package.json"), "utf8"));

// ─── Helpers ────────────────────────────────────────────────────────────────

function print(msg) {
  process.stdout.write(msg + "\n");
}

function err(msg) {
  process.stderr.write("[infographic-agent] " + msg + "\n");
}

function run(cmd, args) {
  return spawnSync(cmd, args, { stdio: "inherit" });
}

// ─── Resolve Python interpreter ─────────────────────────────────────────────

function findPython() {
  for (const candidate of ["python3", "python"]) {
    const result = spawnSync(candidate, ["--version"], { encoding: "utf8" });
    if (result.status === 0) {
      const match = (result.stdout + result.stderr).match(/Python (\d+)\.(\d+)/);
      if (match) {
        const major = parseInt(match[1], 10);
        const minor = parseInt(match[2], 10);
        if (major >= 3 && minor >= 8) return candidate;
      }
    }
  }
  return null;
}

// ─── Pre-flight checks ───────────────────────────────────────────────────────

if (!existsSync(scriptPath)) {
  err(
    `Could not find portable_infographic.py at: ${scriptPath}\n` +
    "  This is a packaging bug — please open an issue at\n" +
    "  https://github.com/ryanbaumann/infographic-agent/issues"
  );
  process.exit(1);
}

const python = findPython();

// ─── CLI args ────────────────────────────────────────────────────────────────

const args = process.argv.slice(2);
const showHelp = args.length === 0 || args.includes("--help") || args.includes("-h");
const doInstall = args.includes("--install");

// ─── --help ──────────────────────────────────────────────────────────────────

if (showHelp) {
  print(`
infographic-agent v${pkg.version}

Generate a professional infographic PNG from text using Gemini + headless Chromium.

Usage:
  npx infographic-agent [options]

Options:
  --text <string>      Content to visualize (required)
  --output <path>      Output PNG path (default: infographic.png)
  --install            Install Python dependencies and Chromium browser
  --help, -h           Show this help message

Environment:
  GEMINI_API_KEY          Gemini API key  (get one at https://aistudio.google.com/apikey)
  GOOGLE_CLOUD_PROJECT    Vertex AI project ID (alternative to GEMINI_API_KEY)
  GOOGLE_CLOUD_LOCATION   Vertex AI region (default: us-central1)

First-time setup:
  npx infographic-agent --install

Examples:
  npx infographic-agent --text "Top 5 programming languages in 2026" --output infographic.png
  npx infographic-agent --text "$(cat report.txt)" --output summary.png
`.trim());
  process.exit(0);
}

// ─── Require Python from here on ─────────────────────────────────────────────

if (!python) {
  err(
    "Python 3.8+ is required but was not found on your PATH.\n\n" +
    "  Install Python from https://www.python.org/downloads/ and make sure\n" +
    "  it is on your PATH, then re-run:\n\n" +
    "    npx infographic-agent ..."
  );
  process.exit(1);
}

// ─── --install: first-time dependency setup ───────────────────────────────────

if (doInstall) {
  print("Installing Python dependencies (google-genai, playwright)...");
  let result = run(python, ["-m", "pip", "install", "google-genai", "playwright"]);
  if (result.status !== 0) process.exit(result.status);

  print("Installing Playwright Chromium browser...");
  // Try `playwright install chromium` on PATH first, fall back to python -m playwright
  result = spawnSync("playwright", ["install", "chromium"], { stdio: "inherit" });
  if (result.status !== 0 || result.error) {
    result = run(python, ["-m", "playwright", "install", "chromium"]);
  }
  if (result.status !== 0) process.exit(result.status);

  print(`
✓ Setup complete!

  Export your Gemini API key and generate your first infographic:

    export GEMINI_API_KEY=your-key
    npx infographic-agent --text "Top 5 programming languages in 2026" --output infographic.png
`.trim());
  process.exit(0);
}

// ─── Delegate to Python script ───────────────────────────────────────────────

const result = run(python, [scriptPath, ...args]);
process.exit(typeof result.status === "number" ? result.status : 1);
