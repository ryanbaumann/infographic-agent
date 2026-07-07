# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Fixed

- **Skill output is now true lossless PNG (`infographic-agent` v3.0.1)**: `gemini-3.1-flash-lite-image` returns JPEG on the Gemini Developer API (which does not allow forcing the output format), so the CLI was saving JPEG bytes under a `.png` name — visibly degrading text. The skill now transcodes the model's output to real PNG via Pillow, threads the actual mime type through the refinement loop, and writes the correct file extension. `pip install` / `--install` now include `pillow` (google-genai remains the only hard requirement — without Pillow the script degrades gracefully to the model's native format).

### Changed

- **Bumped free trial turn limit**: Increased the default trial turn limit from 3 to 5 to give users more free generations before requiring their own Gemini API key.
- **Portable skill rewritten to match the web pipeline (`infographic-agent` v3.0.0)**: the skill now generates infographics **directly with Gemini** using the same two agents as the web demo — a research orchestrator (`gemini-3.5-flash`) grounds the topic with Google Search and engineers a text-accurate prompt, then `gemini-3.1-flash-lite-image` renders the PNG. Replaces the previous HTML/CSS + headless-Chromium screenshot approach.
- **No browser dependencies**: removed Playwright/Chromium from the skill entirely. `npx infographic-agent --install` now just runs `pip install google-genai pillow` (seconds, not a browser download).

### Added

- **npx CLI for the portable skill**: `skill/infographic-agent/` is published on npm as `infographic-agent`. Install with `npx infographic-agent --install`, then generate from any machine with `npx infographic-agent "..."`. Supports both `GEMINI_API_KEY` and Vertex AI (`GOOGLE_CLOUD_PROJECT`) credentials.
- **One-click API-key onboarding**: if no `GEMINI_API_KEY` is set, the CLI walks the user through getting a **free** key from Google AI Studio — offering to open the page, then saving the pasted key to `~/.config/infographic-agent/config.json` (`0600` perms) for next time. Also available via `infographic-agent --setup`.
- **Interactive refine loop**: after the first draft, iterate with plain-language edits (`make the header bolder`, `use teal accents`); each revision renders in seconds, saves as `-v2`/`-v3`, and auto-opens. Pass `--yes` for a one-shot non-interactive run.
- **Style controls**: `--mode` (data-story, executive-summary, technical-deep-dive, classroom, quick-slide, custom), `--aspect`, `--instructions`, and `--no-research` (skip grounding for a faster direct render).

### Security

- Gemini API keys stay user-provided and local; the skill's saved config file is written with `0600` permissions and API errors are scrubbed of anything resembling a credential before printing.

## [2.0.2] - 2026-07-07

### Added

- **3-Turn Free Trial**: Added support for up to 3 turns using a built-in trial Gemini API key, after which users are prompted to configure their own API key in the settings panel.
- **Docker/Cloud Build Build-Time Key Configuration**: Added support for VITE_GEMINI_API_KEY compile-time configuration in `Dockerfile` and `cloudbuild.yaml` via Cloud Build substitutions.

## [2.0.1] - 2026-07-06

### Changed

- **Analysis Model Restriction**: Locked the analysis/orchestrator model to `gemini-3.5-flash` and disabled selection in the admin panel to prevent tool capability mismatches.
- **Thinking Level Defaults**: Defaulted `thinkingLevel` to `LOW` in global admin configuration.
- **Model-Specific Thinking Settings**: Overrode `thinkingLevel` to `HIGH` for image models (such as `gemini-3.1-flash-lite-image`) during refinement to support live thinking output without 400 errors.

### Fixed

- **CSP Inline Script Enforcement**: Handled CORS-less Play CDN and inline script restrictions safely.
- **Tool Cap Mismatch Error**: Resolved "Search as tool is not enabled for this model" errors by conditionally excluding search tools from image model requests.
- **Imagen 3 Resolution Mappings**: Correctly mapped fallback resolutions to `1K` to resolve size validation errors.

## [2.0.0] - 2026-07-06

### Added

- **Docker and GCP Cloud Run deployment support** - Deploy as a containerized service with automated CI/CD via Cloud Build
- **Content Security Policy (CSP) headers** - Strict XSS protection with inline script prevention and frame-ancestor restrictions
- **Subresource Integrity (SRI) hashes** - Verify integrity of all CDN resources (Tailwind, Material Symbols) to prevent tampering
- **Input validation for file uploads** - Magic byte verification, MIME type whitelist, and size limits (50MB per file, 200MB total)
- **Client-side rate limiting** - Token bucket algorithm with 10 requests per minute to prevent abuse
- **Comprehensive security documentation** - `SECURITY.md` covering API key models, restricted keys, and vulnerability disclosure
- **Deployment guide** - Step-by-step instructions for Cloud Run, Docker, and Cloud Storage + CDN options
- **Error boundaries** - Graceful error handling for rendering failures and user-friendly error messages
- **Accessibility improvements** - ARIA labels, keyboard navigation support, focus management, and semantic HTML
- **Mobile responsiveness enhancements** - Touch-friendly UI, notch-aware safe areas, and optimized viewport heights
- **Dynamic filename generation** - Clean, descriptive kebab-case filenames based on infographic content (via `gemini-3.1-flash-lite`)

### Changed

- **BREAKING: Migrated default image model to `gemini-3.1-flash-lite-image`** - Faster generation (3-5 seconds) vs. `gemini-3.1-flash-image` while maintaining quality; requires `thinkingLevel: 'HIGH'` for proper thought stream handling
- **Optimized Agent 1 (Prepare) system prompts** - Improved grounding strategy with explicit XML tags for context, preferences, and task isolation
- **Improved error messages** - User-friendly language with actionable suggestions instead of technical jargon
- **Enhanced file upload UI** - Real-time feedback, processing spinner during upload, and clearer validation feedback
- **Updated tech stack** - React 19, Vite 7, latest @google/genai SDK with proper configuration patterns
- **Refined refinement chat workflow** - Dedicated system prompt emphasizing preservation of unmodified elements

### Fixed

- **Mobile touch target sizes** - Buttons and interactive elements now meet WCAG minimum 44x44px accessibility standard
- **File processing spinner visibility** - Now properly displays during upload and initial processing
- **Keyboard navigation improvements** - Tab order fixed, Enter key handling in input fields, proper focus restoration
- **Base64 rendering performance** - Converted large base64 strings to Object URLs off main thread to prevent UI blocking
- **IndexedDB persistence** - Proper fallback schema merging when default models or settings are updated

### Security

- **Content Security Policy** - Prevents inline script injection and restricts external resource loading
- **File upload validation** - Magic byte checking before full decode to prevent DoS attacks and disguised file uploads
- **Input sanitization** - No untrusted content execution; all markdown rendered safely via react-based parser
- **API key security** - Client-side model with localStorage persistence; documented restricted key approach for production
- **Dependency management** - `package-lock.json` for reproducible builds; `npm audit` recommended before releases
- **Security.txt** - Vulnerability disclosure policy with responsible reporting guidelines
- **HTTP security headers** - X-Frame-Options, X-Content-Type-Options, Referrer-Policy, and Permissions-Policy configured

### Deprecated

- **Legacy `@google/generative-ai` SDK** - Use `@google/genai` v1.43.0+ instead

## [1.0.0] - 2026-02-27

### Added

- Initial release of Infographic Agent
- 2-agent pipeline: Prepare (gemini-3.5-flash) + Generate (gemini-3.1-flash-image)
- React 19 SPA with Vite build tooling
- Support for PDF, CSV, image, and text file uploads
- Real-time streaming analysis and generation progress
- Refinement chat for iterative edits
- Before/after comparison slider
- IndexedDB persistence for infographic history
- Google Search grounding for data verification
- URL context tool for fetching remote documents
- Brand color system aligned with Google Cloud Platform
- Responsive mobile design
- End-to-end Playwright test suite
