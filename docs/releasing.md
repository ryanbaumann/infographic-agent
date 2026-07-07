# Releasing the portable skill to npm

The portable skill in [`skill/infographic-agent/`](../skill/infographic-agent/) is
published to npm as [`infographic-agent`](https://www.npmjs.com/package/infographic-agent)
so anyone can run it with `npx infographic-agent "..."`.

Releases are **automated** by
[`.github/workflows/publish-skill.yml`](../.github/workflows/publish-skill.yml).

## Cutting a release (the automagic path)

1. Make your changes under `skill/infographic-agent/`.
2. Bump `version` in `skill/infographic-agent/package.json` following
   [SemVer](https://semver.org/) (patch for fixes, minor for features, major for
   breaking changes).
3. Add a matching entry to [`CHANGELOG.md`](../CHANGELOG.md).
4. Open a PR and merge it to `main`.

On merge, the workflow:

- sanity-checks the package (`node --check`, `py_compile`, `npm pack --dry-run`),
- checks whether that version is already on npm,
- if it's new, runs `npm publish --provenance --access public`, and
- pushes a `skill-v<version>` git tag.

If the version is unchanged, the workflow still runs but publishes nothing — so
doc-only or script-only edits are safe no-ops. To publish the very first version
after this workflow lands, trigger it once manually from the **Actions** tab
(**Publish skill to npm → Run workflow**).

## One-time setup: the `NPM_TOKEN` secret

The workflow authenticates to npm with a repository secret named `NPM_TOKEN`.

1. On [npmjs.com](https://www.npmjs.com/), go to **Access Tokens → Generate New
   Token → Granular Access Token** (or a classic **Automation** token). Grant it
   **read + write** for the `infographic-agent` package. Automation/granular
   tokens bypass 2FA, which CI requires.
2. In GitHub: **Settings → Secrets and variables → Actions → New repository
   secret**, name it `NPM_TOKEN`, and paste the token.

Publishes include [npm provenance](https://docs.npmjs.com/generating-provenance-statements)
via GitHub OIDC (`id-token: write`), which cryptographically links each published
version back to the exact commit and workflow that built it.

## Manual publish (fallback)

If you ever need to publish by hand:

```bash
cd skill/infographic-agent
npm publish --dry-run   # verify contents first
npm publish --access public
```
