<div align="center">

![Infographic Agent](docs/assets/hero.svg)

### Turn any content into beautiful infographics

Upload a PDF, paste a URL, or just describe a topic — a two-agent Gemini pipeline researches, designs, and renders a polished infographic in real time, right in your browser.

[![CI](https://github.com/ryanbaumann/infographic-agent/actions/workflows/ci.yml/badge.svg)](https://github.com/ryanbaumann/infographic-agent/actions/workflows/ci.yml)
[![Playwright Tests](https://github.com/ryanbaumann/infographic-agent/actions/workflows/playwright.yml/badge.svg)](https://github.com/ryanbaumann/infographic-agent/actions/workflows/playwright.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

</div>

## Features

- **Multi-format input** — PDF, CSV/spreadsheets, images (PNG/JPEG/WebP/HEIC), plain text, or just a topic description
- **6 infographic modes** — Data Story, Executive Summary, Classroom Explainer, Technical Deep-Dive, Quick Slide, and fully Custom
- **Configurable output** — 6 aspect ratios (square, portrait, landscape, and more) and resolution from 0.5K up to 4K
- **Live "thought" stream** — watch the agent's reasoning render as streaming cards while it researches and designs
- **Multi-turn refinement chat** — keep talking to the agent to tweak colors, layout, or content after the first draft
- **Before/after slider** — compare each revision against the original at a glance
- **Local history** — past generations are cached in IndexedDB so you can pick up where you left off
- **Dark / light theme**, and one-click **PNG download** of the final result

## Quick Start

**Prerequisites:** Node.js 18+ and a free [Gemini API key](https://aistudio.google.com/apikey)

```bash
git clone https://github.com/ryanbaumann/infographic-agent.git
cd infographic-agent
npm install
cp .env.example .env
# add your Gemini API key to .env, or paste it into the app's settings panel at runtime
npm run dev
```

This opens `/app.html` on `http://localhost:3456`.

| Script | What it does |
|---|---|
| `npm run dev` | Start the Vite dev server |
| `npm run build` | Type-check and build a single self-contained `dist/index.html` |
| `npm run lint` | Run ESLint |
| `npm test` | Run Vitest unit tests once |
| `npm run test:coverage` | Unit tests with coverage report |
| `npm run test:e2e` | Run the Playwright end-to-end suite (auto-starts the dev server) |

## How It Works

![Configure screen](docs/assets/create-step.svg)

Generation runs as a small two-agent pipeline, both powered by Gemini:

1. **Analysis agent** (`gemini-3.5-flash`) reads your files/URLs/prompt, optionally searches the web, and produces a structured content plan — layout, sections, key data points.
2. **Image agent** (`gemini-3.1-flash-lite-image`) turns that plan into a rendered infographic, streaming its design "thoughts" back to the UI as it works.

After the first draft, the **refinement chat** lets you send follow-up instructions ("make the header bolder", "use our brand colors") — each turn re-invokes the image agent with the conversation history, and the before/after slider shows what changed.

See [`docs/architecture.md`](docs/architecture.md) for the full technical deep-dive (prompt design, streaming protocol, state management).

## The Portable Skill

Prefer working from a coding agent instead of the browser? [`skill/infographic-agent/`](skill/infographic-agent/) packages the **same two-agent pipeline** as a standalone, agent-agnostic **skill** — a `SKILL.md` plus a `portable_infographic.py` script that any AI coding agent with skill/tool support can invoke to generate an infographic PNG directly from the command line, no web app required. It uses `gemini-3.5-flash` to research and engineer the prompt, then `gemini-3.1-flash-lite-image` to render it.

**The only dependency is Google's GenAI SDK** — no browser, Playwright, or Chromium download. Install is a single `pip install google-genai`.

The skill is also published on npm and works with the [Vercel agent skills ecosystem](https://github.com/vercel-labs/skills), so you can run it anywhere with a single command:

**Install into your AI coding agent** (Claude Code, Cursor, Copilot, etc.):
```bash
npx skills add ryanbaumann/infographic-agent
```

**Or run directly without installing:**
```bash
# First-time setup (just: pip install google-genai)
npx infographic-agent --install

# Generate an infographic — no key set? The CLI walks you through getting a
# FREE one from Google AI Studio (~20 seconds) and saves it locally.
npx infographic-agent "Top 5 programming languages in 2026"
```

Already have a key? Set it and skip onboarding:

```bash
export GEMINI_API_KEY="your-key"   # free key: https://aistudio.google.com/apikey
npx infographic-agent "Q2 sales highlights" -o sales.png -m executive-summary
```

After the first draft the CLI drops into an interactive **refine loop** — type edits like `make the header bolder` or `use teal accents` and each revision renders in seconds and auto-opens. Pass `--yes` for a one-shot, non-interactive run (ideal for CI or autonomous agents).

Or use a Vertex AI project instead of an API key:

```bash
export GOOGLE_CLOUD_PROJECT="my-project"
npx infographic-agent "Q2 sales summary" -o sales.png
```

Here is an example infographic generated using this skill for the prompt *"Top 5 programming languages in 2026"*:

<div align="center">
  <img src="docs/assets/infographic-example.png" width="400" alt="Generated Infographic Example" />
</div>

## Deployment

**Docker:**

```bash
docker build -t infographic-agent .
docker run -p 8080:8080 infographic-agent
```

**Docker Compose:**

```bash
docker-compose up --build
```

Both serve the built app via nginx on `http://localhost:8080`.

**Google Cloud Run:** [`cloudbuild.yaml`](cloudbuild.yaml) builds the image, pushes it to Container Registry, and deploys it to Cloud Run — wire it up with `gcloud builds submit` or a Cloud Build trigger.

Because the build output is a single `dist/index.html` with all JS inlined (via `vite-plugin-singlefile`), you can also drop it onto any static host (Cloud Storage, S3, GitHub Pages, nginx, etc.) with no server-side runtime at all. Two caveats:

- **Never build a public artifact with a real key in `.env`** — Vite inlines `VITE_GEMINI_API_KEY` into `dist/index.html` in plaintext. Public deployments should ship key-less; visitors add their own key in the settings panel.
- The page loads Tailwind's Play CDN and Google Fonts at runtime, so browsers need outbound access to `cdn.tailwindcss.com`, `fonts.googleapis.com`, and `fonts.gstatic.com` (it is not fully offline/air-gap friendly).

## Testing

- **Unit tests** (Vitest + Testing Library): `npm test`
- **End-to-end tests** (Playwright): `npm run test:e2e` — covers smoke, generation, refinement, mobile, and error-handling flows in `tests/`
- Both suites run in CI on every push/PR to `main` (see badges above)

## Security

API keys are **user-provided and client-side by design** — there's no backend to leak them from, and the app ships as a static SPA. Uploads are validated against a MIME whitelist and magic-byte signatures before processing, and a strict Content-Security-Policy locks down script/style/connect sources. Full details and the responsible-disclosure process are in [`SECURITY.md`](SECURITY.md).

## Contributing

Contributions are welcome, from humans and AI agents alike. Start with [`CONTRIBUTING.md`](CONTRIBUTING.md) for setup and workflow, and if you're an AI coding agent working in this repo, read [`AGENTS.md`](AGENTS.md) first — it has the project map, conventions, and a verification checklist this repo expects agents to follow.

## License

[MIT](LICENSE) © Ryan Baumann

## Project Structure

```
infographic-agent/
├── app.html                  # Vite entry point (not index.html)
├── src/
│   ├── App.tsx                # Top-level step router (hero → create → studio)
│   ├── main.tsx
│   ├── types.ts                # Shared types, config defaults, limits
│   ├── components/             # StepHero, StepCreate, StepStudio, ChatPanel,
│   │                           # ThoughtStream, BeforeAfterSlider, ThemeToggle, AdminPanel
│   ├── hooks/                  # useInfographicFlow (core state machine), useBlobUrl
│   ├── services/                # geminiService, fileProcessor, downloadService
│   └── __tests__/               # Vitest unit tests + fixtures
├── tests/                     # Playwright e2e specs
├── skill/infographic-agent/  # Portable, agent-agnostic CLI skill
├── docs/
│   ├── architecture.md         # 2-agent pipeline deep-dive
│   ├── learnings.md             # Engineering notes from development
│   └── assets/                  # README images
├── Dockerfile, docker-compose.yml, cloudbuild.yaml, nginx.conf
├── AGENTS.md, CONTRIBUTING.md, SECURITY.md, LICENSE, CHANGELOG.md
└── .github/workflows/          # ci.yml, playwright.yml
```

## Troubleshooting

- **App keeps asking for an API key** — get a free one at [aistudio.google.com/apikey](https://aistudio.google.com/apikey) and either put it in `.env` as `VITE_GEMINI_API_KEY` (dev) or paste it into the settings panel (it's stored in your browser only).
- **"File exceeds maximum size" / files silently skipped** — individual files are capped at 20MB, 50MB total per generation, up to 14 files; split large PDFs or compress images.
- **Generation feels slow** — the analysis agent may search the web or read large files before the image agent starts rendering; watch the thought stream, it's usually still working, not stuck. Higher resolutions (3K/4K) also take longer.
- **`npm run dev` prints `spawn xdg-open ENOENT`** — harmless in headless environments (SSH, containers, CI): the server is running fine, there's just no browser to auto-open. Visit `http://localhost:3456` yourself.

