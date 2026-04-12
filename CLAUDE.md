# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Static website for **Raven Staging** (Raven Trades Ltd) — a specialist event staging, fabrication, and crew company based in Bradford, West Yorkshire. The site is a portfolio/marketing site plus two standalone browser-based planning tools. No framework, no build step beyond image optimisation. Deployed on Netlify from git.

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
├── litedeck-stage-planner.html    # Standalone Litedeck stage planner tool (~4600 lines)
├── webapp/
│   ├── litedeck-stage-planner.html          # Client-facing stage planner (served separately)
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

### Litedeck Stage Planner (litedeck-stage-planner.html)
Self-contained single-file tool (~4600 lines). All state and logic are inline. Key globals:
- `panels[]` — array of placed panel objects (the core state)
- Undo/redo stack
- Three canvas views: plan (top-down), side elevation, bracing diagram

Panel types: 8×4, 8×2, 4×4, 4×2 ft. Grid: 56×44 cells at 24px/cell. Supports multi-tier stages with independent finished heights, steps, handrails, infill panels, and auto-handrail population. Saves/loads via `localStorage`. Generates a bill of materials and a print-ready PDF view. The client-facing copy lives at `webapp/litedeck-stage-planner.html`; an internal/staff version is at `webapp/litedeck-stage-planner-internal.html`. Both are kept in sync with the canonical version manually.

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
