# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for **Raven Staging** (Raven Trades Ltd) — a specialist event staging, fabrication, and crew company based in Bradford, West Yorkshire. The site is a portfolio/marketing site plus two standalone browser-based planning tools. No framework, no build step beyond image optimisation. Deployed on Cloudflare Pages from git — the repo is published verbatim, so never commit secrets or internal docs (see `.gitignore`).

## Commands

```bash
# Optimise images to WebP (one-off / after adding new images)
npm install
node compress.js

# Serve locally
npx http-server .
# or
python -m http.server 8000
```

There are no tests, no linting config, and no JS bundler.

## Repository Structure

```
Website Development/
├── index.html                     # Main marketing/portfolio site
├── webapp/
│   ├── litedeck-stage-planner.html          # Client-facing stage planner (canonical)
│   └── litedeck-stage-planner-internal.html # Internal/staff version of the stage planner
├── projects/                      # 10 individual project/case-study pages
├── siteplan/                      # Site planner tool (split across 3 JS files)
│   ├── index.html
│   ├── siteplan.js                # State, constants, symbol definitions
│   ├── render.js                  # Canvas drawing engine
│   ├── ui.js                      # Panel interactions, save/load
│   └── plans/                     # Saved site plans (JSON)
├── css/                           # Shared stylesheets (main, portfolio, services, project-page)
├── fonts/                         # Self-hosted WOFF2 (Barlow, Barlow Condensed, Bebas Neue)
├── images/                        # Organised by project/category
├── compress.js                    # Sharp-based image → WebP optimisation script
├── _headers                       # Netlify: CORS for /siteplan/plans/*, cache headers
└── _redirects                     # Netlify: routing rules
```

## Architecture

### Main site (index.html)
Vanilla JS inline scripts. Key interactions: hero image/video carousel, service-card carousels, mobile hamburger menu, EmailJS contact form (`service_l3t6n75` / `template_os4z2yp`). Project pages (`projects/*.html`) use `sessionStorage` to preserve the back-button scroll position in the portfolio grid.

### Litedeck Stage Planner (webapp/)
Self-contained single-file tools — all state and logic inline. Key globals:
- `panels[]` — array of placed panel objects (the core state)
- Undo/redo stack
- Canvas views: plan (top-down) and bracing (plan ties + four per-face elevations)

Panel types: 8×4, 8×2, 4×4, 4×2 ft. Grid: 56×44 cells at 24px/cell (client); the internal version uses a finer 168×132 grid. Supports multi-tier stages with independent finished heights, steps, handrails, infill panels, auto-handrail population, and an auto-generate layout function. Generates a bill of materials and a print view. The client-facing planner is `webapp/litedeck-stage-planner.html`; the internal/staff version (file save/load, floor rake, quote-builder integration) is `webapp/litedeck-stage-planner-internal.html`. The two are separate canonical files — shared logic edited in one must be mirrored into the other manually.

### Site Planner (siteplan/)
Split across three files:
- **siteplan.js** — centralised `State` object, layer definitions, symbol library
- **render.js** — HTML5 Canvas 2D drawing engine, layer-aware (polygons → lines → symbols → overlays)
- **ui.js** — tool switching, panel interactions, save/load (localStorage + JSON export), readonly mode (`?readonly` URL param)

Five default layers: access, electrical, evacuation, fire, performance. Uses Google Maps API for the base layer. Saved plans are checked in as JSON under `siteplan/plans/`.

### Styling conventions
CSS custom properties throughout. Dark tech theme (`--dark: #0a0a0a`, `--gold: #c9a84c`) used in both planner tools; gold/white/dark palette on the main site. Self-hosted fonts avoid Google Fonts waterfall. Images are WebP with `fetchpriority` hints and lazy loading.

## Deployment

Cloudflare Pages auto-deploys from the `junglistkean/Website-Development` GitHub repo. No build command is configured — the repo is served as-is.

**Note:** `_headers` and `_redirects` are Netlify conventions and may not function on Cloudflare Pages. Cloudflare Pages uses `_headers` for custom response headers but does **not** support `_redirects` — redirects must be configured via a `_redirects` file in Cloudflare's own format or via the Pages dashboard. Verify that the CORS headers on `/siteplan/plans/*` and the siteplan routing rules are actually taking effect.

## Cache purging

Cloudflare Pages deploys do **not** clear the zone edge cache on the custom domain — deployed planner files have gone stale on ravenstaging.co.uk more than once. No cache rules are involved; this is default edge behaviour.

**Rule: run `purge-cache.cmd` (repo root) after every deploy that changes HTML/JS.** It calls the Cloudflare API's purge-everything endpoint — deliberate: the site is small, the brief cache-refill cost is negligible, and it never misses a URL form (with/without `.html`, www vs apex).

Truth-test when a page looks stale: the project's `*.pages.dev` URL always bypasses the zone edge cache. If pages.dev shows the new deploy and the custom domain doesn't, it's a purge job, not a git problem.

Credentials live in `.cloudflare-purge.txt` at the repo root (two lines: `TOKEN=...` and `ZONE_ID=...`). The file is git-ignored and must **never** be committed — this repo is published verbatim.
