# Security Policy

## Overview

Infographic Architect is a client-side React SPA that leverages Gemini API for infographic generation. This document outlines the security architecture, best practices, and vulnerability disclosure process.

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
  - Content Security Policy (CSP) prevents inline script injection
  - Input validation prevents file-based attacks
  - No untrusted content is executed in the browser
  - Users should use **restricted API keys** (see below)

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
  const response = await geminiClient.generateContent({
    model: 'imagen-3.0-fast-generate-002',
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

A strict CSP is configured in `app.html` to prevent injection attacks:

```
default-src 'self'
script-src 'self' https://cdn.tailwindcss.com
style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.tailwindcss.com
frame-ancestors 'none'
```

This prevents:
- **Inline script injection** - untrusted scripts cannot run
- **Framing attacks** - page cannot be embedded in iframes
- **Form hijacking** - forms can only submit to same origin

### Input Validation

File uploads are validated by:

1. **Magic byte validation** - file content must match declared MIME type (prevents disguised uploads)
2. **MIME type whitelist** - only safe formats accepted (PDF, images, text, spreadsheets)
3. **Size limits** - individual files capped at 50MB, total at 200MB
4. **Early validation** - magic bytes checked before full base64 decode (prevents DoS)

Supported formats:
- **Documents**: PDF
- **Spreadsheets**: CSV, TSV, XLS, XLSX
- **Images**: PNG, JPEG, WebP, HEIC, HEIF
- **Text**: Plain text, Markdown

### Subresource Integrity (SRI) and CDNs

Note: The Tailwind Play CDN (`cdn.tailwindcss.com`) does not support CORS headers (it does not return `Access-Control-Allow-Origin`). Therefore, standard Subresource Integrity (SRI) hashes and strict Cross-Origin-Embedder-Policy (COEP) are incompatible with the Play CDN and have been omitted to ensure the script loads correctly in all browsers. If a production-level SRI is required, the project should be compiled using Tailwind's build-time CLI or self-hosted.

### Security Headers

The following headers are configured in `public/_headers` (for static hosts) and `app.html`:

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
