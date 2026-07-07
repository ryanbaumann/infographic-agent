# Contributing to Infographic Architect

Contributions from humans **and AI coding agents** are welcome!

## Getting Started

1. **Fork and clone** the repository
2. **Install dependencies:** `npm install`
3. **Set up environment:** `cp .env.example .env`
   - Gemini API key from https://aistudio.google.com/apikey is required only if you plan to exercise generation features

## Development Commands

- **`npm run dev`** — Start dev server; opens http://localhost:3456/app.html
- **`npm run lint`** — Run ESLint
- **`npm test`** — Run Vitest unit tests
- **`npm run test:e2e`** — Run Playwright e2e tests (auto-starts dev server on port 3456)
- **`npm run build`** — Build production single-file bundle to dist/index.html

## For AI Agents

**Before contributing code, read `AGENTS.md`** at the repo root — it contains project conventions, architecture pointers, and verification steps. This applies to all coding agents (Claude Code, Cursor, Copilot, Gemini CLI, Codex, etc.).

## Pull Requests

1. Branch from `main`
2. Keep PRs focused and well-scoped
3. **Before submitting:**
   - Run `npm run lint` and fix any issues
   - Run `npm test` to verify unit tests pass
   - Run `npm run build` to ensure production build succeeds
4. Write clear descriptions: explain *what* changed and *why*
5. Include screenshots for any UI changes
6. E2E tests run automatically in CI

## Code Style

- **TypeScript strict mode** enabled
- Follow patterns in `eslint.config.js`
- Match existing code style in the module you're modifying
- Use descriptive variable and function names

## Reporting Issues

- **Bug reports and feature requests:** Use the GitHub issue templates
- **Security issues:** See `SECURITY.md` — do NOT open public issues

## License

By contributing, you agree your work is licensed under the MIT License.
