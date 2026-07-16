# AGENTS.md

Instructions for AI coding agents working in this repository.

## Project Overview

Infographic Agent is a client-side React 19 + TypeScript single-page application that turns text, files, and URLs into professional infographics using the Gemini API. It runs entirely in the browser: users supply their own Gemini API key (never sent to any backend of ours), and the production build compiles to a single self-contained `dist/index.html` via `vite-plugin-singlefile`. There is no server component to maintain.

## Setup

```bash
npm install
cp .env.example .env
```

`VITE_GEMINI_API_KEY` in `.env` is only needed if you want to exercise actual generation (calling the live Gemini API) while developing; most code changes, lint, and unit tests do not require it.

## Commands

- `npm run dev` — starts the Vite dev server. **Important gotcha**: the app entry point is `/app.html`, not `/index.html`. The dev script already opens `/app.html` automatically.
- `npm run lint` — ESLint (config in `eslint.config.js`).
- `npm test` — Vitest unit tests.
- `npm run test:e2e` — Playwright end-to-end tests; this automatically starts the dev server on port 3456.
- `npm run build` — type-checks and builds the production bundle, outputting a single self-contained `dist/index.html`.

## Project Map

- `src/components/` — React UI, organized around the user flow: Hero → Create → Studio.
- `src/hooks/useInfographicFlow.ts` — the central state machine driving the whole flow.
- `src/services/geminiService.ts` — all Gemini API calls (analysis + image generation + refinement).
- `src/services/fileProcessor.ts` — upload validation, including magic-byte checks.
- `src/__tests__/` — Vitest unit tests.
- `tests/` — Playwright end-to-end tests.
- `skill/` — a portable, agent-agnostic "skill" package for generating infographics outside this app.
- `docs/architecture.md` — deep dive into the 2-agent generation pipeline.
- `docs/learnings.md` — engineering learnings and design decisions.

## Conventions

- TypeScript strict mode. Keep types accurate; avoid `any` except where the SDK's types genuinely lag behind the API.
- ESLint is the source of truth for style; run `npm run lint` before finishing.
- Styling uses Tailwind utility classes directly in JSX. Tailwind is compiled at **build time** (`tailwind.config.js` + `postcss.config.js`, entry `src/index.css`), not the runtime Play CDN — the compiled CSS is inlined into the single-file build. Add design tokens (colors, radii, shadows, animations) in `tailwind.config.js`.
- Icons are inline SVGs via `src/components/Icon.tsx` (a name → `lucide-react` map). Use `<Icon name="..." className="text-xl ..." />` — never the Material Symbols icon font. Add new icons to the map in `Icon.tsx`.
- Security constraints to preserve when touching related code:
  - The CSP `<meta>` tags in `app.html` — do not loosen them without a clear reason.
  - File upload validation limits: 20MB per file, 50MB total.
  - Never commit API keys or secrets; `.env` is gitignored, and `.env.example` should stay a placeholder.

## Verification Checklist

Before considering any change finished, run:

```bash
npm run lint && npm test && npm run build
```

All three must pass cleanly.
