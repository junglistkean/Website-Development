# Service Landing Pages — Scoping Plan

**Status:** Plan only — nothing built yet. Written June 2026.
**Goal:** Win searches like "trailer stage hire West Yorkshire" with one dedicated page per service. Competitors rank with these; Raven currently has only the single-page homepage.

---

## General approach (applies to all five pages)

### URLs
Folder-style URLs, each a plain HTML file served by Cloudflare Pages:

```
/stage-hire/index.html         → ravenstaging.co.uk/stage-hire/
/event-crew/index.html         → ravenstaging.co.uk/event-crew/
/fabrication/index.html        → ravenstaging.co.uk/fabrication/
/projection-towers/index.html  → ravenstaging.co.uk/projection-towers/
/equipment-hire/index.html     → ravenstaging.co.uk/equipment-hire/
```

### Shared page template
Reuse the existing design language — same fonts (self-hosted Barlow/Bebas Neue), dark/gold palette, `css/main.css` + `css/project-page.css` as the starting point (the project pages are already the closest layout to what these need). Each page:

1. **Hero** — full-width WebP image with page h1 overlaid (same treatment as project pages).
2. **Plain-English service description** — 2–3 short paragraphs, written for a venue manager or event producer, not keyword-stuffed.
3. **Specs / capacities block** — table or definition list (this is where competitors win trust; needs Eddie's input, see per-page notes).
4. **Photo strip / mini gallery** — 4–6 images from existing `images/` folders (already WebP-optimised).
5. **Relevant project case studies** — 2–3 cards linking to existing `/projects/*.html` pages (internal links help both UX and SEO).
6. **Testimonial slot** — one quote per page. *No testimonials currently exist in the repo — needs Eddie.*
7. **Contact CTA** — prominent gold button linking to `/#contact` (the existing EmailJS form). Repeated mid-page and at the bottom.
8. **Footer** — same footer as the rest of the site.

### SEO per page
- Unique `<title>` (≤60 chars) and meta description.
- `<link rel="canonical">`.
- One h1; h2s for sections.
- JSON-LD `Service` schema per page, referencing the LocalBusiness on the homepage.
- Add each page to `sitemap.xml` on launch.

### Navigation integration (recommendation)
The homepage is a deliberate single-page flow — don't break it.

- **Desktop nav:** keep "Services" pointing at the homepage `#services` section. Add a small dropdown (or a secondary row) under "Services" listing the five pages. Lowest-effort alternative: no nav change at all, and instead…
- **Service cards:** each existing homepage service card gains a "Learn more →" link to its landing page. This is the most natural entry point and requires no nav redesign.
- **Footer:** add a services link column (five links) to the footer site-wide. *Note: the footer is duplicated per file (11 copies today, 16 after launch) — flagged as tech debt below.*
- **Cross-links:** each landing page links to the others ("Also from Raven…") and to relevant project pages.

### Tech debt flag
The footer and nav are copy-pasted into every HTML file. Adding five pages makes 16 copies. Worth considering a tiny build-time include or a shared JS injection later — out of scope for this work, but the cost grows with every page.

---

## Page 1 — `/stage-hire/` (trailer stage + Litedeck)

**Primary phrase:** `mobile stage hire West Yorkshire`
**Variants:** `trailer stage hire Leeds` · `stage deck hire Bradford` · `Litedeck hire Yorkshire` · `outdoor stage hire Yorkshire`

**Hero:** `images/ServiceImages/Staging/MobileTrailerStage.webp`

**Structure notes (beyond shared template):**
- Two clear sub-sections: **Trailer stage** (fast deploy, one-day events) and **Litedeck builds** (custom footprints, tiered seating, multi-level).
- Link to the **Stage Builder** tool (`webapp/litedeck-stage-planner.html`) as a differentiator — "plan your own deck layout" is something competitors don't offer.
- Specs table: trailer stage dimensions open/closed, setup time, power needs; Litedeck panel sizes (8×4, 8×2, 4×4, 4×2 ft), max heights, handrail/steps options, tiered seating capability.

**Photos available:** `ServiceImages/Staging/` (5 images: trailer stage, Litedeck variants, tiered seating), `SlungLowTieredSeatingPlatform/` (7 files), hero pool in `WebsiteHeroImages/`.

**Case-study links:** Brighter Still (closing ceremony stage), Doha Debates (circular stage build), Summer Garden.

**Needs Eddie:**
- Trailer stage exact specs (deck size, height range, setup crew/time, wind rating).
- Litedeck stock quantity (how big a stage can be quoted).
- **Pricing decision:** competitors publish day-rate prices. Show indicative prices, "from £X", or none? *Decision, not assumption.*

---

## Page 2 — `/event-crew/` (crew provision)

**Primary phrase:** `event crew hire West Yorkshire`
**Variants:** `stage crew Leeds` · `event crew Bradford` · `production crew hire Yorkshire`

**Hero:** `images/ServiceImages/CrewProvision/Crew_Team_TasteBD.webp`

**Structure notes:**
- Lead with the existing homepage copy ("skilled, ticketed and local crew") — it's good.
- Specs block becomes a **capabilities list**: tickets/qualifications held (IPAF, PASMA, forklift, etc. — confirm), crew sizes available, call-out area, insurance.
- Emphasise local + reliable: "based in Bradford, working across Yorkshire and the UK."

**Photos available:** `ServiceImages/CrewProvision/` (5 images: builds, access towers, water work).

**Case-study links:** Ride (large-scale outdoor build), Sirens (waterside install), Brighter Still.

**Needs Eddie:**
- Actual tickets/qualifications held by crew (don't invent certifications).
- Typical crew sizes and minimum booking.
- Insurance cover level (competitors state £X million public liability).
- **Pricing decision** as above (crew day rates are commonly published).

---

## Page 3 — `/fabrication/` (set builds, bespoke fabrication)

**Primary phrase:** `set fabrication Yorkshire`
**Variants:** `bespoke event fabrication Leeds` · `scenic construction Bradford` · `custom set build UK`

**Hero:** `images/ServiceImages/Fabrication/AGoodYarn_SteelSphere.webp`

**Structure notes:**
- This page sells capability breadth: carpentry, metalwork, mechanics, electrics (existing copy).
- Strongest portfolio backing of all five pages — lean on photos and case studies more than specs.
- Specs block becomes **workshop capabilities**: materials worked, max build sizes, CNC capability (Brighter Still page references CNC work — confirm what's in-house vs subcontracted), finishing.

**Photos available:** `ServiceImages/Fabrication/` (5), plus deep project folders: `SignoftheTimesBerndTrasberger/` (94 files), `BD25BCBRadioBox/` (60), `BD25AGoodYarn/` (43), `BD25WeWillSing/` (27).

**Case-study links:** RadioBox (container conversion), Sign of the Times (sculptural), We Will Sing (kinetic installation), Lighthouse Commission.

**Needs Eddie:**
- Workshop location/size, in-house vs subcontracted capabilities (CNC, powder coating, etc.).
- Lead times for typical builds.
- Pricing approach (fabrication is usually quote-only — probably no price here, but confirm).

---

## Page 4 — `/projection-towers/` (FOH + projection infrastructure)

**Primary phrase:** `projection tower hire UK`
**Variants:** `FOH tower hire Yorkshire` · `Layher tower hire Leeds` · `projection mapping infrastructure`

**Hero:** `images/ServiceImages/Projections/QueensHotel_7.5mx2.5mx8mLayherProjectionTower.webp`

**Structure notes:**
- Most specialised page; the searches are lower-volume but high-intent and Raven has genuinely distinctive work (submersible screens, clad towers).
- Image filenames already carry real specs — `5m×2.5m×6m`, `7.5m×2.5m×8m` Layher towers — use these in the specs table.
- Mention weatherproofing/cladding options and overnight install capability (the Queens Hotel job was delivered overnight alongside the Christmas markets — already in that page's meta description).

**Photos available:** `ServiceImages/Projections/` (5), `QueensHotelChristmasProjectionTowers/` (44), `BDisLit/` (22), `Sirens/` (20, submersible screen).

**Case-study links:** Queens Hotel (flagship), Sirens (submersible screen), Brighter Still.

**Needs Eddie:**
- Tower size range actually offerable (min/max footprint and height), structural sign-off process (who does the engineering calcs).
- Whether projection *equipment* (projectors) is offered or infrastructure only — the page must be honest about this.
- Pricing decision.

---

## Page 5 — `/equipment-hire/` (truss, ballast, festoon, fencing, etc.)

**Primary phrase:** `event equipment hire Bradford`
**Variants:** `truss hire West Yorkshire` · `festoon lighting hire Leeds` · `pedestrian barrier hire Yorkshire`

**Hero:** `images/ServiceImages/Equipment/GlobalTruss.webp`

**Structure notes:**
- Catalogue-style page: a grid of equipment categories rather than a narrative. Categories visible in current images: global truss, IBC ballast, festoon lighting, pedestrian barriers, cable ramps, gazebos (3×3 slate grey).
- Each category: photo, one-line description, key spec (lengths/quantities).
- This page most needs **stock quantities** to be useful ("200 m festoon", "40 ped barriers") — vague equipment pages don't convert.

**Photos available:** `ServiceImages/Equipment/` (6 categories, one image each — thinnest photo set of the five; more per-category photos would help).

**Case-study links:** Summer Garden, Taste BD imagery exists (`TasteBD/`, no project page).

**Needs Eddie:**
- Full hire inventory list with quantities (the six photographed categories are presumably not exhaustive).
- Delivery/collection radius and whether dry hire is offered (unsupervised hire is an insurance question — confirm).
- **Pricing decision** — equipment hire is the page where competitors most consistently show prices.

---

## Open decisions for Eddie (consolidated)

1. **Pricing on pages: yes/no/"from" prices?** One policy across all five pages. Competitors show prices; it filters enquiries but anchors negotiations.
2. **Testimonials** — none exist in the repo. Even one quote per page (name + event) lifts conversion. Who can be asked?
3. **Nav treatment** — "Learn more" links on service cards (recommended, zero nav change) vs. a Services dropdown.
4. **Specs/capacities** per page as listed above — these can't be invented.
5. **Build order suggestion:** start with `/stage-hire/` (highest search volume, strongest differentiator via the Stage Builder tool), validate the template, then roll out the other four.
