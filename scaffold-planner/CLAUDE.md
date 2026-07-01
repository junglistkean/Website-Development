# CLAUDE.md — Scaffold Planner

Browser-based Layher Allround scaffold planning tool for Raven Staging. Built with React 19 + Vite. No TypeScript. Outputs a live BOM and sends quote items to the Cloudflare Worker quote builder.

## Commands

```bash
npm run dev       # Vite dev server (http://localhost:5173)
npm run build     # Production build → dist/
npm run preview   # Serve dist/ locally
npm run lint      # ESLint
```

## Repository Structure

```
scaffold-planner/
├── index.html                    # Internal entry — sets data-internal="true" on #root
├── client.html                   # Client-facing entry — data-internal="false"
├── src/
│   ├── App.jsx                    # App shell — composes all panels
│   ├── main.jsx                   # React entry point
│   ├── App.css / index.css        # Global styles (dark theme, gold accent)
│   ├── state/
│   │   └── scaffoldStore.js       # Context + useReducer + BOM calculation
│   ├── constants/
│   │   ├── layher.js              # Layher Allround dimensions and slot counts
│   │   └── ballast.js             # Ballast estimator constants + Layher open-tower table (cited, tunable)
│   ├── utils/
│   │   ├── scaffoldGeometry.js    # Pure geometry: ledger heights, auto-ledgers/bracing
│   │   └── ballast.js             # Pure ballast calc: skeleton table lookup + clad overturning method
│   └── components/
│       ├── Canvas.jsx             # SVG rendering — plan + elevation views
│       ├── BomPanel.jsx           # BOM display + Path A quote modal + Path B pending-layout push modal + Ballast estimate
│       ├── BallastEstimate.jsx    # Read-only ballast panel (local selectors) — rendered inside BomPanel
│       ├── Sidebar.jsx            # Left panel — grid/bay config, levels, placement modes
│       ├── Toolbar.jsx            # Top bar — view switcher, save/load, BOM toggle
│       └── StatusBar.jsx          # Contextual hints below toolbar
└── public/
    ├── fonts/                     # Self-hosted Barlow/Bebas woff2
    └── icons.svg                  # SVG sprite
```

## Architecture

### State (`scaffoldStore.js`)

Single `useReducer` store exposed via React context. All state lives here; components dispatch actions and read from `state`. The `history` array holds up to 50 snapshots for undo (`Ctrl+Z`).

Core state shape:
```js
{
  gridCols, gridRows,          // grid dimensions (1–16 each)
  bayLengths[],                // per-column bay length in metres
  bayWidth,                    // global bay width (2.07 or 2.57)
  structureHeight,             // total tube height in metres (0.5m steps)

  levels[],                    // deck levels — [{ id, height, color }]
  activeLevelId,

  placedPans[],                // { col, row, slotIndex, levelId }
  tarps[],                     // { id, face, bayIndex, bottomHeight, topHeight }
  windows[],                   // { col, row, face, bottomHeight, topHeight, width }
  roofBays[],                  // [[col, row], …]
  ladderBeams[],               // { id, face, height, depth? }

  ledgerOverrides,             // { removed: [key…], added: [key…] }
  bracingOverrides,            // { removed: [key…], added: [key…] }
  suppressedStdPositions[],    // standard grid positions to omit from BOM
  bomExtras[],                 // manual BOM line items

  renderMode,                  // 'skeleton' | 'clad'
  activeView,                  // 'plan' | 'front' | 'side' (elevation; activeFace picks which face)
  activeFace,                  // 'N' | 'S' | 'E' | 'W' — N=front, S=back, W=left, E=right
  activePlacementMode,         // 'deck' | 'ledger' | 'brace' | null
  activePlacement,             // 'tarp' | 'window' | 'roof' | 'ladder' | null
  tool,                        // 'place' | 'delete'
  windowHeight,
  runningId,                   // QB stage-lineage key for Path B pending push — null until first push; see BOM & Quote
}
```

Save/load serialises the state to JSON (minus `history`). The required fields on load are `gridCols, gridRows, bayLengths, bayWidth, levels`. A `migrateTarps()` function handles upgrading old `bottomNode` format to `bottomHeight/topHeight`.

### Geometry (`scaffoldGeometry.js`)

Pure functions — no side effects, no imports from React.

- `getLedgerHeights(structureHeight, deckLevels)` — computes ledger heights at ground, deck levels, and every 1m in between. Guarantees no gap >2m (MAX_LIFT_GAP = 2.0).
- `getAutoLedgers / getAutoLedgersWithOverrides` — returns ledger descriptors per face/bayIndex/height.
- `getAutoBracing / getAutoBracingWithOverrides` — returns brace descriptors at 2m lift intervals, alternating directions per bay.
- `getEffectiveFaceTop / getStandardTopForColumn` — handles mono-pitch geometry where rear standards are 0.5m shorter.

Ledger/brace keys are strings like `"front-0-2"` (face-bayIndex-height) and `"front-0-0-2"` (face-bayIndex-liftBottom-liftTop). Override sets contain keys to suppress or add.

### Canvas (`Canvas.jsx`)

SVG-based. Scale: 100 SVG units = 1 metre. The top-level `Canvas` renders `PlanView` when `activeView === 'plan'`, otherwise `ElevationView` (which reads `activeFace` to pick the face). Renders:
- **Plan view**: top-down grid with bay columns/rows, deck pan slots, tarp/roof overlay, face-selection controls.
- **Elevation views** — one per face, selected by `activeFace` (N=front, S=back, W=left, E=right): standards, ledgers, diagonal braces, plan braces, tarps, windows, ladder beams. Click on ledger or brace to add/remove override.

`buildXPos()` converts bay lengths to cumulative x-coordinates. All click targets are SVG elements with `onClick` dispatching the appropriate action.

Full-2m diagonal braces render as solid gold lines (`BRACE_COLOR`). Sub-2m remainder lifts (where `structureHeight` is not a multiple of 2m) render as **dashed grey** (`#8a8a8a`, `strokeDasharray="6 4"`) to flag that no standard Layher diagonal fits — loose-tube bracing is at the rigger's discretion.

### BOM & Quote (`BomPanel.jsx` / `calculateBom` in `scaffoldStore.js`)

`calculateBom(state)` returns a breakdown of:
- Standards per length (stacked greedily: 3m → 0.5m)
- Ledgers and transoms per length
- Diagonal + plan braces (named Layher references only — see pricing model below)
- `unbracedTopLifts[]` — sub-2m remainder lifts, each carrying `{ face, bayIndex, liftHeight, span, diagLen, swivels }`
- Base plates, screw jacks, starting collars
- Deck pans, gap fillers
- Roof kits, tarps, apex/roof tarps, keder beams
- Ladder beams (by span)
- Windows, bomExtras

There are **two ways to push a layout to the quote builder**, both gated behind `isInternal` and both built from the same `buildQuoteItems(bom)` in `BomPanel.jsx`:

**Path A — "Send to Quote Builder" (open QB pre-loaded).** `QuoteModal.submit()` opens
`window.open(QUOTE_BUILDER_URL + '/?data=<encoded-JSON>')` (`QUOTE_BUILDER_URL =
'https://quote-builder.e-kean.workers.dev'`). No auth, no server write — QB's client-side
`loadPrepopulate` consumes the URL param and the quote is only persisted when the user saves
in QB. The payload carries `{ eventName, eventDates, dateStart, dateEnd, eventVenue,
companyName, clientName, clientEmail, notes, group, items }`. **The `group: { id, name, qty }`
field is load-bearing and QB-specific**: `loadPrepopulate` detects `data.group && !data.groups`
and wraps all equipment items into a single QB *structure-group* (a "set × N structures" block
with its own qty multiplier and hire period). Litedeck's Path A does **not** send `group`;
scaffold does. Do not drop it — QB relies on it to group the scaffold BOM as one priced set.

**Path B — "Send as Pending Layout" (batch/pending injection).** `PushModal` in `BomPanel.jsx`
POSTs to `POST {QB}/api/planner-layouts`; QB's `handleCreatePlannerLayout` writes one **pending**
row to the `planner_layouts` table in D1 `raven-finance`. The layout then sits pending against a
job and can be assembled with other layouts into a single quote inside QB. This mirrors
litedeck's `submitQbPush`. Contract:

- **Auth:** scaffold is always cross-origin to QB (Pages/localhost), so the `qb_auth` cookie
  never applies — the low-privilege **`x-planner-key`** header is required on every call
  (`qbFetch` in `BomPanel.jsx`; key prompted once, stored in `localStorage['qb_planner_key']`,
  re-prompted on a 401). Never embed the key — the built site is published verbatim.
- **Job capture:** a `<select>` populated on modal open via `qbFetch('/api/planner-jobs')`
  (options `id → "name — client (dateStart)"`, plus `— Unassigned —` → `jobId: null`). Same
  mechanism as litedeck — not free text.
- **Body:** `{ name, jobId|null, components, layoutState, intent, runningId }`.
  `components` = `buildQuoteItems(bom)` **unchanged** (full objects — deliberately *not*
  stripped to `{category,description,qty}` like litedeck, because scaffold emits items whose
  `description` is not a PRICE_LIST key, e.g. the ladder beam relies on its `priceName`; stripping
  would make it re-resolve to £0 on injection). `layoutState` = scaffold's serialisable `state`
  minus `history` (same shape `handleSave` writes).
- **`intent` / `runningId` — stage lineage (Replace scope = session + saved-file only).**
  `state.runningId` (added to the store; `null` on a fresh layout) is the stage-lineage key.
  On first push it is `null` → `intent:'duplicate'` → QB mints a `running_id` → the response's
  `d.runningId` is stored back via `SET_RUNNING_ID`. Because `handleSave` serialises the whole
  state, `runningId` is **persisted in the saved `.json` and rehydrated by `LOAD_STATE`** — the
  equivalent of litedeck's `exportLayoutJson`. A re-send then defaults to `intent:'replace'`
  (radios shown only when `runningId != null`), sending the same `runningId` so QB supersedes the
  prior pending row instead of piling up duplicates. **Known-and-intended limitation:** scaffold
  has no "reload a sent layout back from QB" list (litedeck's `openQbLayoutsModal`), so replace
  works **only within the same browser session or via save-file → reopen → resend**. A fresh
  session with no local save file has no `runningId` and will **duplicate** (mint a new stage) —
  this is accepted scope, **not a bug**; do not "fix" it by inventing an identity.

### Pricing model

The planner is **price-blind** — it carries no prices internally. All pricing lives in the quote builder Worker's `PRICE_LIST`. The payload each item carries:

| Item | `description` | `priceName` | `unitPrice` |
|------|--------------|-------------|-------------|
| Standards, ledgers, braces, tarps, etc. | QB PRICE_LIST key | absent | absent |
| Ladder beam | `"Ladder beam — X.XXm span"` | `'Ladder beam'` | absent |
| bomExtras pass-through | from extra | from extra if set | from extra if set |

There is no "bespoke cut-to-length diagonal brace" item — this was a fiction (Allround diagonals are fixed-length). Sub-2m remainder lifts appear only as a plain-language **warning** in the quote notes:
```
Top lift bracing (rigger's discretion): N× Xm lift on X.XXm bays — no standard diagonal.
Cut tube ≈X.XXm ×N + N swivel clamps if required.
```
The geometric length (√(span² + liftHeight²)) is advisory only; riggers size the actual tube themselves.

### Known & intended pricing gaps (both push paths — do NOT "fix" without sign-off)

These are deliberate. A future session finding a £0 or a missing line here should treat it as
recorded intent, not a defect:

- **Transoms are intentionally disabled in scaffold** — not generated, not in the BOM, not
  quoted. Gated by `TRANSOMS_ENABLED = false` in `scaffoldStore.js` (generation returns `{}`
  when off); the Transoms `BomSection` in `BomPanel.jsx` has been removed. The old generation was
  height-driven — `(gridCols + 1) * gridRows` per lift × `lifts` — which produced phantom
  transoms on every layout (e.g. a 6m structure with zero decks → 24× 2.57m); a level/platform is
  built on ledgers only. When Litedeck decking is stocked they return as the deck-support piece:
  flip `TRANSOMS_ENABLED` to `true`, re-add the Transoms `BomSection`, and add a `transom` key to
  QB's `PRICE_LIST` (**none exists currently**).
- **Narrow bays (0.73 / 1.09 / 1.57m) would resolve to £0** for ledgers/pans/braces (the
  `STANDARDS_MAP`/`LEDGERS_MAP`/`PANS_MAP`/`DIAG_BRACE_KEYS` fallbacks emit names absent from
  `PRICE_LIST`). **Not stocked — no real layout uses them**, so this is ignored by design.
- **Base plate is £0 on purpose.** `Base plate (spec per engineering)` is a real PRICE_LIST key
  priced at £0.00 ("spec per engineering") — every scaffold quote carries a £0 base-plate line
  intentionally. Leave as-is.

### Ballast estimator (`utils/ballast.js` / `constants/ballast.js` / `BallastEstimate.jsx`)

Read-only, quote-stage **indicative** ballast estimate — a tonnage + ballast-block count for
free-standing scaffold. **Never a design figure.** Rendered as a section inside `BomPanel`
(it replaced the old static BALLAST caveat flag, whose prose was folded into the estimate's
disclaimer). **Internal-only** — gated on `BomPanel`'s `isInternal` prop, so it does not render
on the client build. Writes nothing — the two selectors (cladding gate, exposure band) live in
`BallastEstimate`'s component-local React state, seeded once from `state.renderMode`.

`computeBallast(state, { cladding, exposure })` is pure and picks one of two lanes by cladding:

- **Skeleton lane** — looks up Layher's type-tested open-tower ballast table (`LAYHER_OPEN_TOWER`
  in `constants/ballast.js`; transcribed from the Allround Technical Brochure 04.2017, Tab.44–46,
  "in the open", steel/K rows) and **interpolates linearly on platform height**. A figure is only
  produced for the **single 2.57 m-bay / no-cantilever reference tower** the table describes
  (`gridCols===1 && gridRows===1 && bayWidth===2.57 && bayLengths[0]===2.57`). **Any other
  geometry** (multi-bay, non-2.57 m) **OR H > 6.25 m → amber, no figure** ("off-table — bespoke,
  engineer required") — same hard stop, no proportional scaling. Defaults to 1.1 T **concrete**
  blocks; 1.0 T **water** is offered as an alternative only on the low reference case
  (≤ `WATER_OFFER_MAX_HEIGHT` = 4.25 m, where uplift is not a concern). Green flag when a figure
  is produced.
- **Clad lane** (part-clad / scrim / fully-clad / banner) — **overturning method** with Raven's
  own engineer coefficients (`CLAD` in `constants/ballast.js`, from CampbellReith report 13994-81):
  `q = Q_NET_BASELINE × exposure` → `F = q·H·L_long` → `M_ot = F·H/2` → `Fb = M_ot/(L_short/2)` →
  `W_req = FOS·Fb` → ×`KN_TO_KG` (100, engineer's convention) → subtract `SELFWEIGHT_PER_BAY × N_bays`
  → 1.1 T **concrete** blocks, tied down (water not permitted — uplift-critical). Always amber
  ("clad/bespoke, engineer sign-off"); extra caution note above the validated 7.5 m example.
  All clad variants use the same full-solid-face calc in v1 (part-clad area reduction + high-mounted
  banner CoP are v-next). Exposure step-up applies to this lane only.

Geometry mapping: `L_long`/`L_short` = max/min of (Σ `bayLengths`, `gridRows × bayWidth`);
`N_bays` = `gridCols × gridRows`; `H` = `structureHeight`. **All constants are estimation
baselines — tunable, not engineer-sanctioned — and are printed on every output** (see the
"Assumptions" line) so a wrong figure can be traced to its inputs. **Do not "correct"
`KN_TO_KG` to 9.81** — 100 is deliberate, to reproduce the engineer's figures.

**Safety caveats (carry forward):**
- **Exposure step-ups are NOT engineer-signed.** Only `Q_NET_BASELINE` (0.40) comes from
  CampbellReith; the `EXPOSURE_STEPUP` 1.25 / 1.5 multipliers are Claude's conservative brackets.
  Exposed-coastal / peak-summer clad jobs → engineer early, don't lean on the estimate.
- **v1 treats all cladding as full solid face** — over-reads part-mesh builds (e.g. a projection
  tower's permeable lower section). Safe (over-quotes) but sits above the engineer's eventual
  sign-off.
- Source docs (Layher brochure PDF, CampbellReith report) are **git-ignored / kept private** —
  copyrighted; the repo is published verbatim. `*.pdf` is in `scaffold-planner/.gitignore`.

**v-next / parked (confirmed backlog, not built):**
- Part-clad / permeable-mesh **area reduction** — stop treating part-clad as full solid face.
- **High-mounted banner** — raise the centre of pressure above mid-height for banner/signage towers.
- Explicit **sliding check** as a `max()` alongside overturning (currently overturning governs;
  sliding is only noted as confirmed in the engineer's report).
- **Parked by design:** wider skeleton geometry (1.57 / 2.07 m widths, cantilever rows) routes to
  an engineer rather than being estimated — only the single 2.57 m reference tower is covered.

### Layher constants (`layher.js`)

Key values:
- Bay lengths: `[0.73, 1.09, 1.57, 2.07, 2.57]` m
- Bay widths: `[2.07, 2.57]` m
- Node interval: `0.5` m
- Pan width: `0.32` m (8 pans = 2.56m in 2.57m bay; 6 pans + gap filler in 2.07m bay)
- Tarp: physical 2.5m height, 2.0m display height (0.5m overlap flap)

There is no `PRICE_LIST` in this file — prices were removed (Phase 2, Stage 1) because they were dead code (never imported by any other file; the quote builder is the sole pricing authority).

## Key Behaviours

- Undo is limited to the **last 50 actions**. History is stripped on save/load/clear.
- Bracing is auto-placed at 2m intervals regardless of ledger spacing. Ledger spacing is 1m max.
- When `structureHeight` is not a multiple of 2m, the top lift is sub-2m. No standard Layher diagonal fits; this lift is flagged as unbraced (`unbracedTopLifts`) and shown dashed grey on the elevation.
- Ladder beams with a `depth` property are treated as deck-frame beams and excluded from the BOM ladder beam list.
- `suppressedStdPositions` removes standard positions from the tube stack BOM (but not from base plate counts — compensated in `calculateBom` to keep collar/screw-jack totals correct).
- The **5m-stage preset** (`LOAD_PRESET: '5m-stage'`) wires up a two-bay front-open canopy configuration with pre-removed ledgers/braces and bomExtras for Litedeck deck panels and 1'6" tube.
- `isInternal` gates the quote builder. `main.jsx` reads it from the `data-internal` attribute on the `#root` element; there are two HTML entry points: `index.html` (`data-internal="true"`, internal/staff) and `client.html` (`data-internal="false"`, client-facing). To embed the internal version, set `data-internal="true"` on the root div.

## Deployment

Deployed to **Cloudflare Pages** as the `scaffold-planner` project (account `e.kean@ravenstaging.co.uk`). The built `dist/` directory is served as a static site — no server-side logic, all computation is client-side. The only external dependency at runtime is the quote builder Cloudflare Worker.

**Live URL (internal/staff):** https://scaffold-planner.pages.dev/ — serves `index.html` (`data-internal="true"`).

> The build also emits `dist/client.html` (`data-internal="false"`), so the client-gated build is technically reachable at `…/client.html`, but the client-facing version is not finished and is not advertised. Internal is the only supported entry for now. Currently unlisted (no Cloudflare Access gating) — price-blind tool, nothing sensitive; revisit if it needs locking down.

To build and deploy:

```bash
npm run build
npx wrangler pages deploy dist --project-name scaffold-planner --branch production --commit-dirty=true
```

The Pages project is separate from the `Website-Development` repo's auto-deploy; this planner is deployed manually via wrangler from its built `dist/`.
