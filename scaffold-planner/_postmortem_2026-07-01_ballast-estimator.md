# Post-mortem — Ballast estimator (two-lane) — 2026-07-01

Branch: `feat/ballast-estimator` (off `main`).

## What was built

A read-only **Ballast estimate** section in the BOM panel (`BomPanel.jsx`), giving an
INDICATIVE tonnage + ballast-block count for free-standing scaffold at quote stage. Two
lanes, gated by a new local **cladding** selector:

- **Skeleton lane** — looks up Layher's type-tested open-tower ballast table (Allround
  Technical Brochure 04.2017, Tab.44–46, "in the open", steel/K, 2.57 m bay / no-cantilever)
  and interpolates linearly on platform height. Green "indicative estimate". Water blocks.
- **Clad lane** (part-clad / scrim / fully-clad / banner) — overturning method using Raven's
  own engineer's coefficients (CampbellReith 13994-81): q → F → M_ot → Fb → W_req → credit
  self-weight → concrete blocks, tied down. Always amber "clad/bespoke, engineer sign-off".

New files:
- `src/constants/ballast.js` — all constants + the Layher table, labelled tunable, cited.
- `src/utils/ballast.js` — pure `computeBallast(state, {cladding, exposure})`; no writes.
- `src/components/BallastEstimate.jsx` — the panel; selectors held in component-local state.
Edited: `src/components/BomPanel.jsx` — imports + renders `<BallastEstimate>` in place of the
old static BALLAST flag (its prose folded into the estimate's disclaimer).

## Verification

- `npm run build` clean (28 modules). `npm run lint` adds no new *real* errors — the two
  flagged in my files (`React` unused in BallastEstimate; pre-existing `React`/`history` in
  BomPanel) are the repo-wide baseline convention (every component imports React and ESLint
  flags it; baseline was already 24 such errors).
- **Numeric check via Node/esbuild** (all passed):
  - Clad worked example H=7.5 m, 2.5×2.5 m, 1 bay, sheltered → reproduces the report chain
    q=0.40 → F=7.5 kN → M_ot=28.13 → Fb=22.5 → W_req=31.5 kN → 3150 kg → 2410 kg after
    self-weight → **3 × 1.1 T concrete**.
  - Skeleton interpolation: 2.25→0, 4.25→275, 5.0→603, 6.25→1150 kg; >6.25 → out-of-table
    amber (no figure).
  - Multi-bay clad self-weight (740 × N_bays) and exposure step-up (×1.5) both apply.

## What broke / didn't happen

- **Automated browser eyeball blocked (extension, not the app).** Every injection-based
  Claude-in-Chrome tool (screenshot / find / read_page) timed out after 45 s on
  `document_idle` against the `localhost` preview, while navigate + wait (non-injecting)
  worked. Initially misdiagnosed as the Canvas render loop — but the source has **no**
  `requestAnimationFrame`/`setInterval`/`setTimeout`, so it's the extension being unable to
  inject into the `localhost` tab (site-permission gap), not the app. **Resolved by Eddie:**
  he eyeballed the live internal preview at `localhost:4174` and confirmed the section renders
  and the lanes switch, plus internal-only (absent on `/client.html`).
- No Cloudflare deploy performed — scaffold deploys manually via wrangler from `dist/`. Branch
  pushed; **awaiting Eddie's go for the wrangler push.**

## Assumptions made mid-session (CONFIRM before relying on the numbers)

1. **Skeleton out-of-table rule** (Eddie's spec sentence was truncated): H > 6.25 m → amber,
   **no number**, "engineer's ballast calc required". H < 2.25 m → 0 kg.
2. **Skeleton = fixed single 2.57 m / k=0 reference tower**, height-driven only; does NOT
   scale by bay count or read the drawn bay width (it's the only no-cantilever row Layher
   publishes). A caveat note fires when the layout is multi-bay or non-2.57 m.
3. **Skeleton uses 1.0 T water blocks** (not uplift-critical); clad uses 1.1 T concrete only.
4. **Exposure band applies to the clad lane only** (skeleton table is a fixed "in the open"
   value); the exposure selector is disabled in skeleton mode.
5. **All clad variants collapse to one calc in v1** (full solid face). Part-clad area
   reduction and high-mounted banner (raised CoP) are v-next.
6. **Ballast estimate shown in both builds** (internal + client), matching the old always-on
   ballast flag — not gated behind `isInternal`. Flip if it should be internal-only.
7. Cladding selector **seeds its initial value from `state.renderMode`** (read only) but is
   otherwise independent.

## Handover warnings

- The Layher table + all coefficients are transcribed/estimation baselines. They are printed
  on every output on purpose — if a figure looks wrong, check the printed assumptions first.
- `KN_TO_KG = 100` is the engineer's convention (1 kN ≈ 100 kg), deliberately not 9.81, to
  reproduce his figures. Don't "correct" it without re-checking against the report.
- Skeleton `V1_BAY_WIDTH`/`V1_CANTILEVER` fix the lookup column; the fuller table is
  transcribed for future cantilever/narrow-tower support.
- **Exposure step-ups (1.25 / 1.5) are Claude's conservative brackets — NOT engineer-signed.**
  Only `Q_NET_BASELINE` (0.40) is from CampbellReith. Exposed-coastal / peak-summer clad jobs →
  engineer early, don't lean on the estimate. (Now annotated in `constants/ballast.js`.)
- **v1 treats all cladding as full solid face** — over-reads part-mesh builds (safe/over-quotes,
  but above the engineer's eventual sign-off).

## Backlog (Eddie-confirmed 2026-07-01) — also in CLAUDE.md

- v-next: part-clad / permeable-mesh area reduction (stop over-reading mesh as solid face).
- v-next: high-mounted banner — raise centre of pressure above mid-height.
- v-next: explicit sliding check as `max()` alongside overturning.
- Parked by design: wider skeleton geometry (1.57 / 2.07 m widths, cantilever rows) routes to an
  engineer; only the single 2.57 m reference tower is estimated.

## Addendum — post-build adjustments (same session)

Three changes after first review, all verified numerically (build clean):

1. **Skeleton multi-bay → no figure** (was a caveat note). A skeleton figure is now produced
   ONLY for the single 2.57 m-bay / no-cantilever reference tower. `gridCols>1`, `gridRows>1`,
   `bayWidth≠2.57` or `bayLengths≠2.57` all route to amber "off-table — bespoke, engineer's
   ballast calc required. No estimate given." — same hard stop as > 6.25 m. The old
   proportional-scaling caveat path was removed. (`isReferenceTower` computed in `computeBallast`.)
2. **Internal-only visibility.** `<BallastEstimate>` is gated on `BomPanel`'s existing
   `isInternal` prop (verified it exists — from `data-internal` via `main.jsx`; no new flag,
   no persistence). It no longer renders on the client build.
3. **Skeleton default → concrete.** Skeleton headline is now 1.1 T concrete blocks; 1.0 T water
   is offered as an *alternative* line only on the ≤ 4.25 m reference case
   (`WATER_OFFER_MAX_HEIGHT`). Clad unchanged (concrete only, tied down).

Confirmed-as-built (no change): skeleton > 6.25 m → amber/no figure; exposure inert in skeleton
lane; all clad types = full solid face in v1.

## Final status

Feature complete. Verified in Node **and** eyeballed live by Eddie at `localhost:4174`
(internal build): section renders, cladding selector switches lanes (skeleton→green Layher
figure / clad→amber overturning), and it is internal-only (absent on `/client.html`).
**NOT deployed** — awaiting Eddie's go for the wrangler push from `dist/`. The Layher source
PDF is gitignored (`*.pdf`) — keep it out of the verbatim-published repo.
