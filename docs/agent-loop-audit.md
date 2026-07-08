# Agent Loop Audit

Date: 2026-07-08

## Current Loop

The app uses a bounded browser-local loop:

1. Intake: collect uploaded files, pasted text, URLs, mode, aspect ratio, resolution, and color preferences.
2. Prepare: `gemini-3.5-flash` grounds facts, plans layout, finalizes text, and engineers a renderer prompt.
3. Render: `gemini-3.1-flash-lite-image` renders the infographic from the engineered prompt and up to three reference images.
4. Review: the app stops for human review.
5. Refine: each user edit sends the current image plus focused instruction back to the image model, then returns to Review.

## Findings Addressed

- Added a deterministic Prepare eval gate before Render. The gate blocks missing schema, missing explicit image prompt prefix, missing final text strings, and extreme prompt length before those weaknesses hit the image model.
- Surfaced Prepare eval status in the Studio thought stream so users can see whether the handoff to Render passed local checks or carries warnings.
- Moved model-generated filename creation out of the critical render path. Successful image generation now shows immediately with a local fallback filename; the sidecar updates the filename later when it succeeds.
- Added regression tests for Prepare eval behavior and filename sidecar failure isolation.

## Remaining High-Value Improvements

- Add a golden eval fixture set for `PrepareResult` quality: one source-only data story, one URL-grounded report, one dense technical diagram, one refinement-preservation case, and one adversarial prompt-injection input. These can run without live Gemini calls by evaluating stored Prepare JSON and mocked image responses.
- Add optional live eval scripts gated by `GEMINI_API_KEY` for release candidates. Track Prepare latency, Render latency, image-return rate, eval warnings, and refinement preservation outcomes.
- Split the visible Prepare phase into Research and Plan only if the app can detect a real boundary from streamed model output. Until then, the UI should keep presenting Prepare as one model call with subphase checks, not pretend it has deterministic internal handoffs.
- Add request cancellation with `AbortController` support if the SDK exposes it for current calls. This would let Reset or a second Generate stop stale in-flight work instead of relying only on session checks.
- Cache successful Prepare results by content hash plus config hash when users regenerate the same sources with only renderer-side settings changed. This is likely the next largest latency win after the two-agent collapse.
- Tighten docs that still describe future-state review of grounded facts before Render. The current browser app shows the Prepare summary and eval checks, but it does not require a user approval checkpoint before rendering.

## Audit Notes

- Parallelism already exists in file processing and Playwright execution. The main loop should avoid extra parallel sidecars on the critical path unless their result is required for Render.
- Prompt engineering is directionally strong: XML sections, explicit renderer prompt prefix, positive framing, quoted text strings, and accessibility constraints. The added eval gate makes those prompt rules enforceable.
- The current unit tests cover state transitions better than model-output quality. The new eval helper is the first deterministic quality seam; future eval work should expand around it rather than depending on screenshots alone.
