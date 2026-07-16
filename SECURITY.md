# Security Policy

## Overview

Infographic Agent is a client-side React SPA that leverages Gemini API for infographic generation. This document outlines the security architecture, best practices, and vulnerability disclosure process.

## API Key Security Model

### Client-Side Keys (Current Design)

By design, API keys are **user-provided and client-side**. This model means:

- **No backend proxy required** for the web application (fully self-contained static HTML)
- **User owns their API key** - keys are never transmitted to our servers
- **Keys persist locally** in browser localStorage for convenience across sessions
- **Users control key scope** - they can use restricted API keys in GCP

### Why Client-Side?

1. **Simplicity**: Deployable as a single `index.html` to any static host
2. **Privacy**: Your keys never leave your browser unless you explicitly share them
3. **Cost control**: You control which API key is used and can rotate/restrict at any time
4. **No backend burden**: No need to maintain, scale, or secure a backend service

### Security Implications

- **Risk**: API keys in localStorage are accessible to XSS attacks
- **Mitigation**: 
  - A Content Security Policy restricts where scripts, styles, and connections can come from (see its limits below)
  - Model output is rendered as plain text/images through React — no `dangerouslySetInnerHTML`, `eval`, or iframes anywhere in the app
  - Input validation prevents file-based attacks
  - Users should use **restricted API keys** (see below)
- **Risk**: `VITE_GEMINI_API_KEY` set at build time is inlined into the bundled `dist/index.html` — anyone who can load the page can read it
- **Mitigation**: only bake a key into private/internal deployments; for public hosting, ship without a key and let each visitor supply their own via the settings panel

## Using Restricted API Keys (Recommended)

For production use, create a restricted Gemini API key in Google Cloud:

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new API key
3. Restrict the key to:
   - **API**: Only "Generative Language API"
   - **Application Restrictions**: HTTP referrer (your domain)
   - **Rate limiting**: Set appropriate limits for your use case
4. Use this restricted key in the app

This prevents a compromised key from being used to call other Google APIs or services outside your domain.

## Production Deployment: Backend Proxy Pattern

For production applications with sensitive requirements, implement a backend proxy:

```
Browser → Your Backend (with restricted API key) → Gemini API
```

Example Node.js proxy:

```typescript
// backend/routes/gemini.ts
app.post('/api/generate-infographic', authenticateUser, async (req, res) => {
  const { prompt, images } = req.body;
  // Validate inputs, apply rate limiting, log usage
  const response = await geminiClient.models.generateContent({
    model: 'gemini-3.1-flash-lite-image',
    contents: [...images, { text: prompt }],
  });
  res.json(response);
});
```

Benefits:
- API key never exposed to browser
- Server-side rate limiting and authentication
- Audit logging and usage tracking
- Fine-grained access control

## Security Features

### Content Security Policy (CSP)

A CSP is delivered three ways — a `<meta>` tag in `app.html`, `public/_headers` (static hosts like Netlify/Cloudflare Pages), and `nginx.conf` (Docker). The policy:

```
default-src 'self'
script-src 'self' 'unsafe-inline'
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com
font-src 'self' https://fonts.gstatic.com https://fonts.googleapis.com
connect-src 'self' https://generativelanguage.googleapis.com
img-src 'self' data: blob:
frame-ancestors 'none'   (header-delivered only; ignored in <meta> per spec)
base-uri 'self'
form-action 'self'
```

There are **no external script origins** — Tailwind is compiled at build time and icons are inline SVGs, so the app carries no runtime CDN dependency. The only remaining third-party origin is Google Fonts (`fonts.googleapis.com` / `fonts.gstatic.com`) for the Inter/Roboto webfonts, which degrade gracefully to the system sans-serif if blocked.

**Known limitation:** `script-src` includes `'unsafe-inline'`. This is required by the single-file production build, which inlines the app bundle into `dist/index.html` (`vite-plugin-singlefile`). It means the CSP does **not** block inline script injection; the real XSS defense is that the app never renders untrusted HTML (React text rendering only, no `dangerouslySetInnerHTML`). Moving to a nonce/hash-based inline script would allow dropping `'unsafe-inline'` — contributions welcome.

What the CSP does enforce:
- **Script/style origins** - scripts are same-origin only; styles are same-origin plus Google Fonts
- **Network egress** - the page can only talk to the Gemini API endpoint (`generativelanguage.googleapis.com`)
- **Framing attacks** - page cannot be embedded in iframes (header-based `frame-ancestors` plus `X-Frame-Options: DENY`)
- **Form hijacking** - forms can only submit to same origin

### Input Validation

File uploads are validated by:

1. **Magic byte validation** - for PDF, PNG, JPEG, and WebP, file content must match the declared MIME type (prevents disguised uploads); other whitelisted formats are validated by MIME type and size only
2. **MIME type whitelist** - only safe formats accepted (PDF, images, text, spreadsheets)
3. **Size limits** - individual files capped at 20MB, 50MB total per generation, up to 14 files
4. **Early validation** - magic bytes checked before full base64 decode (prevents DoS)

Uploaded files are never executed or rendered locally — they are only base64-encoded and sent to the Gemini API.

Supported formats:
- **Documents**: PDF
- **Spreadsheets**: CSV, TSV, XLS, XLSX
- **Images**: PNG, JPEG, WebP, HEIC, HEIF
- **Text**: Plain text, Markdown

### Subresource Integrity (SRI) and CDNs

The app no longer loads any third-party JavaScript or CSS at runtime — Tailwind is compiled at build time and inlined, and icons are inline `lucide-react` SVGs. Since scripts and styles are same-origin (inlined into `dist/index.html`), there is no cross-origin resource to attach an SRI hash to; the integrity guarantee comes from the file being served from your own origin. The only third-party fetch is the Google Fonts stylesheet, which is non-critical (text falls back to the system font if it fails to load).

### Security Headers

The following headers are configured in `public/_headers` (for static hosts) and `nginx.conf` (Docker); `app.html` additionally carries the CSP as a `<meta>` tag so it applies even without server headers:

| Header | Value | Purpose |
|--------|-------|---------|
| `X-Frame-Options` | `DENY` | Prevent clickjacking |
| `X-Content-Type-Options` | `nosniff` | Prevent MIME sniffing |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Control referrer information |
| `Permissions-Policy` | Restrict camera, microphone, geolocation | Limit browser API access |
| `Cross-Origin-Opener-Policy` | `same-origin` | Prevent cross-origin window access |

### Rate Limiting

Client-side rate limiting is implemented in `src/services/geminiService.ts`:

- Token bucket algorithm with 10 requests per minute
- User-friendly messaging when limit exceeded
- Configurable per deployment

**Note**: For production, implement server-side rate limiting to prevent abuse.

## No Known Vulnerabilities

At the time of release, no security vulnerabilities are known in this application. However, security is an ongoing process. Please report any issues responsibly.

## Vulnerability Disclosure

If you discover a security vulnerability, please report it privately via [GitHub Security Advisories](https://github.com/ryanbaumann/infographic-agent/security/advisories/new), including:

1. **Description** - clear explanation of the vulnerability
2. **Affected components** - which files/services are involved
3. **Proof of concept** - steps to reproduce (if applicable)
4. **Impact** - severity and potential harm
5. **Suggested fix** - if you have one (optional)

**Please do not** open public issues for security vulnerabilities. We will:

- Acknowledge receipt within 48 hours
- Investigate the issue
- Develop a fix
- Release a patch and credit you (if desired)
- Provide an estimated timeline for public disclosure

## Dependency Security

Dependencies are managed via `package-lock.json` for reproducible builds:

```bash
# Check for known vulnerabilities
npm audit

# Update dependencies safely
npm update
```

Key dependencies:
- `@google/genai` - Official Google SDK
- `react` - Vetted by Meta security team
- `vite` - Widely-used build tool

## Browser Requirements

- Modern browser with ES2020+ support
- JavaScript enabled
- Local storage access (for API key persistence)
- HTTPS recommended for production

## Development Best Practices

1. **API Keys**
   - Never commit keys to git (use `.env` and `.gitignore`)
   - Use environment variables for CI/CD
   - Rotate keys regularly

2. **Dependencies**
   - Run `npm audit` before releases
   - Keep dependencies up-to-date
   - Use exact versions in production

3. **Code Review**
   - Review for injection vulnerabilities
   - Validate all user input
   - Test CSP compliance

4. **Deployment**
   - Use HTTPS in production
   - Set security headers on your host
   - Enable HSTS if possible
   - Monitor for unusual API usage

## Testing Security

```bash
# Check for known vulnerabilities
npm audit

# Build and check CSP compliance
npm run build

# Test in browser
# 1. Open DevTools Console
# 2. Check for CSP violations
# 3. Verify scripts/fonts load correctly
```

## References

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [MDN Web Security](https://developer.mozilla.org/en-US/docs/Web/Security)
- [Content Security Policy](https://developer.mozilla.org/en-US/docs/Web/HTTP/CSP)
- [SRI (Subresource Integrity)](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)
- [Google Cloud API Key Security](https://cloud.google.com/docs/authentication/api-keys)

## Questions?

For security-related questions (not vulnerabilities), please open an issue on GitHub with the `security` label.
