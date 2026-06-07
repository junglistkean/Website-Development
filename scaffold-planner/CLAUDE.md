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
│   │   └── layher.js              # Layher Allround dimensions and slot counts
│   ├── utils/
│   │   └── scaffoldGeometry.js    # Pure geometry: ledger heights, auto-ledgers/bracing
│   └── components/
│       ├── Canvas.jsx             # SVG rendering — plan + elevation views
│       ├── BomPanel.jsx           # BOM display + quote builder modal
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

The quote modal (`QUOTE_BUILDER_URL = 'https://quote-builder.e-kean.workers.dev'`) serialises BOM items to JSON and opens the quote builder via `window.open(...?data=<encoded-JSON>)`. It is gated behind the `isInternal` prop.

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
