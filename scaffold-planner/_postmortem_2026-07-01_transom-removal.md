# Post-mortem — Scaffold: remove phantom transoms — 2026-07-01

## What was built

Transoms are banned from all scaffold layouts (not stocked; a level/platform is ledgers-only).
Removed via a clean labelled disable so reinstating is a one-line flag flip.

- **`src/state/scaffoldStore.js`** — added module-level `TRANSOMS_ENABLED = false` (commented:
  return as the Litedeck deck-support piece when decking is stocked). Generation now reads
  `const transoms = TRANSOMS_ENABLED ? { [bayWidth]: transomCountPerLift * lifts } : {}` — empty
  object when off, so `bom.transoms` keeps a stable shape and reinstating is trivial. The count
  formula is left intact behind the flag.
- **`src/components/BomPanel.jsx`** — removed the `<BomSection title="Transoms">` render block so
  nothing empty renders.
- **`buildQuoteItems` — untouched.** It never had a transom branch (transoms were never quoted on
  Path A or Path B), so there was nothing to remove there.
- **`CLAUDE.md`** — transom lines now read as settled fact; dropped the "still in code at this
  commit" honesty caveat and recorded the `TRANSOMS_ENABLED` reinstate mechanism.

## Audit findings (Step 1)

- Generation was **lift/height-driven, not deck-driven**: `lifts = round(structureHeight / 0.5)`,
  `transomCountPerLift = (gridCols + 1) * gridRows`. A 6m / 1×1 / no-deck layout → `2 × 12 = 24`
  × 2.57m, exactly the reported phantom count. Decks/levels had zero influence.
- Consumers were exactly three: generation (scaffoldStore 583), return (698), and the BomPanel
  render section. `buildQuoteItems` was **not** a consumer. Nothing left dangling.

## Verified

Ran the real `calculateBom` (esbuild-bundled, temp files removed):
- Case 1 — 1×1, 2.57m, 6m, no decks → `transoms {}` total **0** (ledgers still 24, structure builds).
- Case 2 — same + one deck level → `transoms {}` total **0** (level on ledgers).

## Wrong assumptions / notes

- None. The audit's earlier "transom omission" finding already established transoms never reached
  the quote, so the removal was BOM-render + generation only — no pricing path to untangle.

## Handover warnings for the next session

- **Reinstating is a one-liner + two small adds:** flip `TRANSOMS_ENABLED` to `true`, re-add the
  Transoms `BomSection` in `BomPanel.jsx`, and add a `transom` key to QB's `PRICE_LIST` (none
  exists — without it, reinstated transoms would silently resolve to £0 on injection).
- **This change shipped in the single build-and-deploy that also took the committed Path B work
  live** — one `wrangler pages deploy`, one deploy-commit covering both.
