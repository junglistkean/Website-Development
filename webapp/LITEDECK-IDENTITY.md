# LITEDECK-IDENTITY.md — client planner identity (pointer)

The **full** identity record for both Litedeck planners (internal + client) lives
in the `quote_builder` repo: **`quote_builder/LITEDECK-IDENTITY.md`**. This file
is a pointer that carries the **client planner's** re-proof recipe inline so this
repo is self-sufficient for its own planner.

## Client planner — proven identity (proven 2026-06-27)

- **Proven-live local file:** `webapp/litedeck-stage-planner.html`
- **SHA-256 (LF-normalized — the one to compare):**
  `bb233ae03e6f30dd3a30eccf5e58ff37a2897bf644038708673c0242d1f5009a`
- **Served by:** Cloudflare Pages (this repo, served verbatim), at the
  **extensionless** path `/webapp/litedeck-stage-planner` (`.html` 308-redirects):
  - `https://ravenstaging.co.uk/webapp/litedeck-stage-planner`
  - `https://raven-staging.pages.dev/webapp/litedeck-stage-planner` (bypasses the
    zone edge cache)

> ⚠ **Compare LF-normalized, not raw bytes.** Cloudflare serves the committed LF
> blob; the Windows working tree is CRLF (`autocrlf`). The raw working-tree hash
> will NOT match served — that is EXPECTED and harmless, not drift. Strip CR
> before comparing.

### Re-proof recipe (copy-paste)

```bash
TS=$(date +%s)
# Fetch live, cache-busted, following the .html -> clean-URL redirect
curl -sSL -H "Cache-Control: no-cache" \
  "https://raven-staging.pages.dev/webapp/litedeck-stage-planner?cb=$TS" -o /tmp/served-client.html
sha256sum /tmp/served-client.html
#   expected: bb233ae03e6f30dd3a30eccf5e58ff37a2897bf644038708673c0242d1f5009a

# Hash local LF-NORMALIZED — must match served
tr -d '\r' < webapp/litedeck-stage-planner.html | sha256sum
#   expected: bb233ae03e6f30dd3a30eccf5e58ff37a2897bf644038708673c0242d1f5009a
```

**Usage rule:** before editing the client planner, hash it (LF-normalized) and
compare to the recorded hash. If it doesn't match, STOP and re-run the recipe
before trusting any path. The recorded hash IS the marker — do not add identity
comment lines inside the planner (it changes content and breaks the hash).

The internal planner (`webapp/litedeck-stage-planner-internal.html`, a mirror of
the canonical KV-served file) is covered in the canonical doc.
