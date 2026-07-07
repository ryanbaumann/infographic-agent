# Infographic Agent - Technical & Architectural Learnings

This document compiles the core engineering lessons, API specifications, and design patterns discovered and implemented during the development of the Infographic Agent application.

---

## 1. Gemini API & `@google/genai` SDK

### Modern SDK Usage
- Always use the modern `@google/genai` package (v1.43.0+). Avoid using the legacy `@google/generative-ai` package.
- Initialize the client with standard parameters, casting the config or client initialization to `as any` where TypeScript definitions lag behind the API capabilities:
  ```typescript
  import { GoogleGenAI } from '@google/genai';
  const ai = new GoogleGenAI({ apiKey, httpOptions: { timeout: 180000 } } as any);
  ```

### Configuration Cast Patterns (`as any`)
The SDK types do not always support newer parameters. Use the `as any` cast pattern for configs containing:
- `thinkingConfig` (for orchestrator reasoning level)
- `responseModalities` (controlling text and image outputs)
- `imageConfig` (for aspect ratio and resolution in image models)
- `tools` (e.g., `{ googleSearch: {} }` or `{ urlContext: {} }`)

### Model Capabilities & Thinking Levels
- **`gemini-3.5-flash`** (default orchestrator): Supports detailed reasoning. Configured with `thinkingConfig: { thinkingLevel: 'HIGH' }` for layout planning.
- **`gemini-3.1-flash-lite-image`** (default image generator/refiner): Optimized for faster image generation (3-5 seconds) with native image generation and refinement. This is the recommended model for most use cases due to its speed. Supports thinking config for streaming thoughts but **rejects `thinkingLevel: 'LOW'`** with a 400 error. It must be configured with `thinkingLevel: 'HIGH'` to return thought streams properly.
  - **Behavior**: Consistently generates valid PNG images at any aspect ratio
  - **Limitations**: Slightly lower fidelity on text rendering compared to Flash (but still acceptable for most infographics)
  - **Recommendation**: Use for rapid iteration and user-facing workflows
- **`gemini-3.1-flash-image`** (alternative for quality-focused workflows): Provides enhanced quality for complex infographics with more accurate text rendering and visual fidelity. Use this when fast iteration is less important than output fidelity (8-12 seconds per generation).
- **Thinking Part Filtering**: When thinking is enabled, the model returns thoughts alongside the regular text parts. Always filter out the thought parts to parse the output JSON or text correctly:
  ```typescript
  const parts = response.candidates?.[0]?.content?.parts || [];
  const texts = parts.filter((p: any) => p.text && !p.thought).map((p: any) => p.text).join('');
  const thoughts = parts.filter((p: any) => p.text && p.thought).map((p: any) => p.text).join('');
  ```

### Search Grounding & URL Context
- **Google Search Grounding**: Enabled via `tools: [{ googleSearch: {} }]`. Allows models to verify data points and search real-time statistics. *Note:* Cannot be combined with JSON response mode (`responseMimeType: "application/json"`); use text output and parse the JSON manually after stripping markdown fences.
- **URL Context**: Enabled via `tools: [{ urlContext: {} }]`. Allows the model to fetch and read public documents (HTML, PDF, JSON, etc.) up to 34MB per URL. Can be combined with `googleSearch`.

### 2-Agent vs 5-Agent Architecture
- Collapsing a complex multi-step pipeline (Extract -> Plan -> Engineer Prompt -> Generate -> Refine) into a 2-step pipeline (**Prepare** + **Generate**) reduces end-to-end latency by ~40% while preserving output quality. 
- **Agent 1 (Prepare)** handles text extraction, layout planning, and prompt engineering in a single pass.
- **Agent 2 (Generate)** consumes the engineered prompt directly for image rendering.

---

## 2. Prompt Engineering Best Practices

### The 4 Hard Rules (Pitfall Prevention)
1. **Text-First Rule**: Image models degrade in text accuracy as volume increases. Finalize all text strings in Agent 1, and quote them verbatim in the prompt passed to Agent 2.
2. **Data Accuracy Rule**: Never let the image model invent data points. Extract exact metrics from source files or Google Search grounding and pass them explicitly.
3. **Layout Complexity Rule**: Describe layouts sequentially (Top-to-Bottom, Left-to-Right). Break complex plans down into spatial instructions to avoid overlap or clutter.
4. **Explicit Modality Rule**: Prompts must start with `"Generate a professional infographic image..."` and the config must set `responseModalities: ['TEXT', 'IMAGE']` to force image output.

### System Prompt Structure (KV-Cache Optimization)
- Order system instructions so that static constraints are declared first, followed by XML-structured instructions (`<role>`, `<constitution>`, `<instructions>`), and final dynamic parameters last. This helps maximize KV-cache hits.
- Use explicit XML tags in the user prompt (e.g. `<context>`, `<preferences>`, `<task>`) to cleanly divide inputs from instructions.

### Refinement & Iteration
- Refinement is executed in chat mode using `ai.chats.create()`.
- Use a dedicated system prompt emphasizing **preservation**: *"Preserve all elements the user did not ask to change."*
- Wrap refinement inputs in `<current_image>` and `<refinement>` XML tags to isolate the previous image state from the requested modifications.

---

## 3. Frontend Performance & Base64 Handling

### The Base64 Rendering Bottleneck
- Storing and rendering raw `data:image/png;base64,...` strings in large image components blocks the browser's main thread and degrades UI performance.
- **Solution**: Convert base64 payloads to binary Blobs asynchronously and render them via Object URLs off the main thread:
  ```typescript
  // Convert to Blob and create object URL
  const response = await fetch(`data:image/png;base64,${base64}`);
  const blob = await response.blob();
  const blobUrl = URL.createObjectURL(blob);
  ```
- Use a custom React hook (`useBlobUrl`) to manage Object URL lifecycles, ensuring `URL.revokeObjectURL()` is called when the component unmounts to prevent memory leaks.

### State & Storage Optimization (IndexedDB vs LocalStorage)
- Storing multiple high-resolution base64 images in `localStorage` quickly triggers `QuotaExceededError` (5MB limit).
- **Solution**: Adopt IndexedDB via `localforage` for persistent storage of infographic history. This bypasses the 5MB storage limit and supports large image blobs.
- **Migration Safeguard**: Ensure a fallback schema merge when loading settings, preventing stale configurations from breaking the application when default models or settings are updated.

---

## 4. Design System & UX Decisions

### Brand Colors & Typography
- Follow the Google Maps Platform (GMP) / Google Cloud Platform (GCP) brand colors for a cohesive developer tool aesthetic:
  - **Primary / Buttons / Focus**: `gblue` (`#4285F4` / `#1A73E8`)
  - **Success / CTAs**: `ggreen` (`#34A853`)
  - **Warning / Accent**: `gyellow` (`#FBBC04`)
  - **Error / Alerts**: `gred` (`#EA4335`)
- Map semantic CSS styles (e.g., focus rings, status indicators) to these hex codes.
- Use native system sans-serif fonts (Inter / Roboto) and Google Material Symbols Outlined for crisp icon rendering.

### Download Optimizations & Filename Generation
- **Lossless PNG Downloads**: Downloaded files are served as lossless PNG rather than converting to JPEG via canvas. This avoids quality loss and prevents transparent alpha channels from rendering with weird artifacting.
- **Dynamic Filename Generation**: A dedicated, low-latency call to `gemini-3.1-flash-lite` (configured with `thinkingConfig: { thinkingLevel: 'MINIMAL', includeThoughts: false }`) generates a clean, linux-friendly kebab-case filename of 4-5 words based on the infographic's prompt. This replaces generic `infographic-<timestamp>.jpg` names with descriptive ones (e.g. `history-of-the-internet.png`).

### Studio & Refinement UX
- **Before/After Comparisons**: The `BeforeAfterSlider` is embedded directly into the main studio viewer, replacing the static image when a previous generation state is available.
- **Multi-select Action Chips**: Allow users to click multiple refinement suggestion chips (e.g., "Simplify layout" + "Add source attribution") to append requests rather than clearing user input.
- **Thought Stream Rendering**: Parse and render markdown (bold, italic, lists, and headers) from the model's reasoning stream dynamically using a React-based element parser, bypassing `dangerouslySetInnerHTML` for XSS prevention.

---

## 5. Mobile Responsiveness

- **Layout Flow**: Stack panels vertically on mobile (image first, then refinement chat) and side-by-side on desktop.
- **Max Heights**: Limit image heights to `45-50vh` on mobile to ensure the input field and keyboard are visible.
- **Notch Padding**: Apply `viewport-fit=cover` and use CSS custom properties (`safe-area-inset-*`) to prevent content overlap on modern mobile device notches.
- **Touch Interactions**: Set `touch-action: none` on the `BeforeAfterSlider` separator bar to override browser scroll behavior during dragging.
- **File Dropper UX**: Ensure file delete buttons are always visible on mobile, since hover states are unavailable on touch screens.

---

## 6. Security Hardening Decisions

### Content Security Policy (CSP)

A strict CSP prevents inline script injection and restricts external resource loading:

```
default-src 'self'
script-src 'self' https://cdn.tailwindcss.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com
frame-ancestors 'none'
```

Key decisions:
- `default-src 'self'`: All resources must be same-origin unless explicitly whitelisted
- `unsafe-inline` for styles only: Required for Tailwind CDN; scripts are always same-origin
- `frame-ancestors 'none'`: Prevent embedding in iframes (clickjacking protection)
- No inline script execution: All interactivity via React components

### File Upload Validation

Three-layer validation prevents disguised uploads and DoS attacks:

1. **Magic Byte Validation** (first check)
   - Read first 4-8 bytes of file (magic number)
   - Compare against known signatures for PDF, PNG, JPEG, etc.
   - Reject if declared MIME type doesn't match actual file type
   - Early validation prevents full base64 decode (DoS mitigation)

2. **MIME Type Whitelist**
   - Only allow: PDF, PNG, JPEG, WebP, HEIC, CSV, TSV, XLS, XLSX, TXT, Markdown
   - Reject: executable files, archives, scripts, etc.

3. **Size Limits**
   - Per-file: 50MB maximum
   - Total upload: 200MB maximum
   - Prevents memory exhaustion and slow uploads

### API Key Security Model

**Design**: User-provided, client-side keys with optional localStorage persistence

Rationale:
- No backend proxy needed (fully static, deployable anywhere)
- User owns their key; we never see it
- Keys can be rotated or restricted in Google Cloud Console
- Zero infrastructure cost and maintenance burden

Mitigations for localStorage:
- CSP prevents inline script injection (XSS protection)
- Input validation prevents file-based attacks
- SRI hashes verify CDN resources haven't been tampered with
- Users should use **restricted API keys** (see SECURITY.md)

For production: Implement optional backend proxy pattern to move key server-side.

### Rate Limiting

Client-side token bucket algorithm (10 requests/minute) provides UX feedback but is not a security control. For production, implement server-side rate limiting in a backend proxy.

---

## 7. Deployment Architecture

### Docker & Container Strategy

Containerization enables consistent, reproducible deployments across environments:

**Dockerfile pattern**:
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

FROM nginx:alpine
COPY --from=builder /app/dist/index.html /usr/share/nginx/html/
EXPOSE 8080
CMD ["nginx", "-g", "daemon off;"]
```

Key decisions:
- **Multi-stage build**: Separates build dependencies from runtime (smaller final image)
- **nginx**: Lightweight, battle-tested web server for static SPA
- **Alpine base**: Minimal image size and attack surface
- **Port 8080**: Google Cloud Run standard

### Cloud Run Deployment

Cloud Run is the recommended production environment for this SPA:

**Advantages**:
- Auto-scales from 0 to N instances (cost-efficient)
- Built-in HTTPS with valid certificates
- Integrated logging and monitoring
- Git push → Cloud Build → auto-deploy
- ~$2-3/month for typical low-to-medium traffic

**Configuration**:
- Memory: 512Mi (sufficient for static HTML serving)
- Min instances: 0 (scale to zero when unused)
- Max instances: 10 (adjust based on traffic)
- Unauthenticated access: Enabled for public SPA

### Security Headers in nginx

```nginx
add_header X-Frame-Options "DENY" always;
add_header X-Content-Type-Options "nosniff" always;
add_header Referrer-Policy "strict-origin-when-cross-origin" always;
add_header Permissions-Policy "camera=(), microphone=(), geolocation=()" always;
add_header Cross-Origin-Opener-Policy "same-origin" always;
add_header Content-Security-Policy "default-src 'self'; script-src 'self' https://cdn.tailwindcss.com; ..." always;
```

Each header prevents a specific attack:
- **X-Frame-Options**: Clickjacking
- **X-Content-Type-Options**: MIME sniffing
- **Referrer-Policy**: Information leakage
- **Permissions-Policy**: Browser API abuse
- **COOP**: Window access from other origins
- **CSP**: XSS and injection attacks

### Environment Variables

**Build Time**:
- `VITE_GEMINI_API_KEY` (optional): if set when `npm run build` runs, Vite inlines the key into the bundled code. If configured, it acts as a built-in trial key allowing up to 3 generation/refinement turns per user (persisted in browser localStorage). After 3 turns, users are required to supply their own key in the settings panel.
- *Security Note*: Because the application runs entirely client-side, any inlined trial key is technically inspectable via the browser's developer tools. The 3-turn limit functions as a client-side soft gate to prevent casual abuse, but you should not use a key with high billing limits.

**Runtime**:
- Users provide their own key via the in-app settings panel; it persists in browser localStorage only.

---

## 8. Architecture Patterns & Performance

### 2-Agent vs. N-Agent Pipeline

Collapsing a complex multi-step pipeline into 2 agents yields significant improvements:

**Old (5-Agent) Pipeline**:
1. Extract content
2. Plan layout
3. Engineer prompt
4. Generate image
5. Refine

End-to-end latency: ~45-60 seconds

**New (2-Agent) Pipeline**:
1. Prepare (extract + plan + engineer)
2. Generate

End-to-end latency: ~20-30 seconds

**Improvement**: ~40% faster with same quality.

**Key insight**: Network roundtrips and model switching dominate latency, not compute time. Combining steps reduces overhead.

### KV-Cache Optimization for System Prompts

When using long system prompts, ordering matters for KV-cache efficiency:

1. **Static constraints first** (e.g., "You are a professional designer")
   - These are cached and reused across users
   - Maximize cache hits with longer static prefixes

2. **Structured instructions** (XML tags, examples)
   - Help models understand the task
   - Also cached if repeated

3. **Dynamic parameters last** (user content, settings)
   - Change per request
   - Cache miss, but input is smaller

This ordering can reduce prompt processing cost by 10-20% on repeated requests.

### Image Model Performance Characteristics

**gemini-3.1-flash-lite-image** behavior and quirks:

- **Thinking levels**: Requires `thinkingLevel: 'HIGH'` (rejects 'LOW' with 400 error)
- **Thought streams**: Returns thoughts when `includeThoughts: true`, must filter in parsing
- **Image output**: Requires `responseModalities: ['TEXT', 'IMAGE']` in config
- **Aspect ratios**: Supports any aspect ratio (16:9, 1:1, 21:9, etc.) via `imageConfig`
- **Resolutions**: Supports 1K-4K; higher resolutions = longer generation (~2x slower at 4K)
- **Text fidelity**: Good but not perfect; prefer verbatim quotes from Agent 1
- **Generation time**: 3-5 seconds typical, up to 15 seconds on overload

---

## 9. Session Learnings

### 2026-07-06 — Model Capability Tuning & CSP Integrity

Context: Faced 400 API errors due to model tool and thinking constraints when trying to streamline the model topology, alongside CSP restrictions when handling Play CDN resources.
Learning:
1. **Search Tool Limitations**: Image generation/refinement models (e.g., `gemini-3.1-flash-lite-image`) do not support tool integrations (`googleSearch`, `urlContext`). Requests containing tools fail with `400 Bad Request`.
2. **Image Model Thinking Level**: Image models support `thinkingConfig` to return thought streams during generation, but reject `thinkingLevel: 'LOW'` with a `400 Bad Request`. They require `thinkingLevel: 'HIGH'`.
3. **CORS/SRI Play CDN Support**: The Tailwind Play CDN (`cdn.tailwindcss.com`) does not return CORS headers, so using `crossorigin="anonymous"` or `integrity` checks will cause browser resource loading blocks.
Evidence: `src/services/geminiService.ts#L398`, `src/hooks/useInfographicFlow.ts#L45`, `app.html#L31`
Use next time: Keep `googleSearch` and `urlContext` restricted to the text-based analysis model (`gemini-3.5-flash`). Ensure all image model calls with thinking support are locked to `thinkingLevel: 'HIGH'`. Remove `integrity` and `crossorigin` flags when using Play CDN.
