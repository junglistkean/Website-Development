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

- **Browser eyeball NOT done — blocked, owed.** The Chrome extension needs `document_idle`;
  the planner's Canvas render loop never idles, so screenshot/find/read_page all time out
  (4 attempts). Same limitation noted for the litedeck/autofill work. **Owed:** a human should
  open the BOM panel and confirm the ballast section renders and the selectors switch lanes.
- No Cloudflare deploy performed (not requested; scaffold deploys manually via wrangler from
  `dist/`). Branch pushed for review only.

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
