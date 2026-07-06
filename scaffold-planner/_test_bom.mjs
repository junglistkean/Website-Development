// Offline regression for the BOM calculation (calculateBom) + the deck auto-fill
// (deckPansForBays) — 2026-07-06.
//
// Imports the REAL store module directly (pure ESM, no JSX — React resolves from
// node_modules and is only used for context plumbing this test never touches).
// A missing/renamed export fails the import itself (loud).
//
// Every expected number is hand-derived from the geometry rules and recorded with
// its derivation. Comparisons are EXACT — no tolerance bands.
//
//   node _test_bom.mjs
import { calculateBom, deckPansForBays } from './src/state/scaffoldStore.js';
import { PANS_PER_BAY_257, PANS_PER_BAY_207, DEFAULT_STACK } from './src/constants/layher.js';

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }
const eq = (a, b) => JSON.stringify(a) === JSON.stringify(b);

// ── Marker guard: prove the imported code is the real BOM path ────────────────
if (typeof calculateBom !== 'function' || typeof deckPansForBays !== 'function' ||
    PANS_PER_BAY_257 !== 8 || PANS_PER_BAY_207 !== 6 || DEFAULT_STACK[0] !== 3.0) {
  console.error('FAIL: imported code is not the real BOM calculator (marker absent). Nothing was tested.');
  process.exit(1);
}

// Minimal complete state for calculateBom (fields it destructures).
function makeState(over = {}) {
  return {
    gridCols: 1, gridRows: 1, bayLengths: [2.57], bayWidth: 2.57,
    structureHeight: 4, levels: [], placedPans: [],
    tarps: [], windows: [], roofBays: [], ladderBeams: [],
    ledgerOverrides: { removed: [], added: [] },
    bracingOverrides: { removed: [], added: [] },
    suppressedStdPositions: [], bomExtras: [],
    ...over,
  };
}

// ── deckPansForBays — the 6 Jul "levels start fully panned" auto-fill ─────────
{
  const pans257 = deckPansForBays([[0, 0]], 2.57, [{ id: 'L1' }]);
  ok(pans257.length === 8, `2.57 m bay auto-fills 8 pans (got ${pans257.length})`);
  ok(pans257.every((p, i) => p.col === 0 && p.row === 0 && p.slotIndex === i && p.levelId === 'L1'),
     '2.57 m fill: slots 0..7 on the bay/level');

  const pans207 = deckPansForBays([[0, 0]], 2.07, [{ id: 'L1' }]);
  ok(pans207.length === 6, `2.07 m bay auto-fills 6 pans — the 0.19 m gap filler is counted in the BOM, not here (got ${pans207.length})`);

  const multi = deckPansForBays([[0, 0], [1, 0]], 2.57, [{ id: 'L1' }, { id: 'L2' }]);
  ok(multi.length === 32, `2 bays x 2 levels x 8 = 32 pans (got ${multi.length})`);
}

// ── Fixture A — the 6 Jul acceptance case ─────────────────────────────────────
// 1x1 grid, 2.57 x 2.57 m bay, 6 m structure, one deck level L1 at 4 m, auto-filled.
// ACCEPTANCE (recorded 6 Jul 2026, deck-levels-start-fully-panned build): the BOM
// Decking line must read 8x 2.57 m pans.
// Hand-derived expectations (sources in brackets):
//   standards: stack for 6 m = 2x 3 m tubes (greedy DEFAULT_STACK), x4 positions -> {3: 8}
//   ledger heights: seeds {0,4,6}; 0->4 filled at 1,2,3; 4->6 filled at 5; ground
//     stripped -> [1,2,3,4,5,6] (getLedgerHeights: 1 m spacing, 0.5 m snap)
//   ledgers: 6 heights x 4 faces x 1 bay, all spans 2.57 -> {2.57: 24}
//   braces: lifts [0-2],[2-4],[4-6] (2 m intervals) x 4 faces -> 12x named 2.57-bay
//     diagonal, no unbraced lifts (6 m is a multiple of 2 m)
//   plan braces: 1 bay cell -> 1x '3.64m plan brace (2.57 x 2.57m bay)'
//   base plates: (1+1)x(1+1) = 4;  gap fillers: 0 (2.57 m bay has none)
//   transoms: {} — DISABLED by design (TRANSOMS_ENABLED=false; do not "fix")
{
  const state = makeState({
    structureHeight: 6,
    levels: [{ id: 'L1', height: 4, color: '#C9A84C' }],
    placedPans: deckPansForBays([[0, 0]], 2.57, [{ id: 'L1' }]),
  });
  const bom = calculateBom(state);

  ok(eq(bom.deckPans, { 2.57: 8 }), `ACCEPTANCE 6 Jul: Decking 8x 2.57 m pans (got ${JSON.stringify(bom.deckPans)})`);
  ok(eq(bom.standards, { 3: 8 }), `standards 8x 3 m (got ${JSON.stringify(bom.standards)})`);
  ok(eq(bom.ledgers, { 2.57: 24 }), `ledgers 24x 2.57 m (got ${JSON.stringify(bom.ledgers)})`);
  ok(eq(bom.braces, { '3.18m diagonal brace (2.57m bay)': 12 }),
     `12x 3.18 m diagonal (got ${JSON.stringify(bom.braces)})`);
  ok(bom.unbracedTopLifts.length === 0, '6 m (multiple of 2 m): no unbraced top lift');
  ok(eq(bom.planBraces, { '3.64m plan brace (2.57 x 2.57m bay)': 1 }),
     `1x 3.64 m plan brace (got ${JSON.stringify(bom.planBraces)})`);
  ok(bom.basePlates === 4, `4 base plates (got ${bom.basePlates})`);
  ok(bom.gapFillers === 0, '2.57 m bay: no gap fillers');
  ok(eq(bom.transoms, {}), 'transoms stay DISABLED (recorded intent — not stocked)');
  ok(bom.roofKitCount === 0 && bom.tarpCount === 0 && bom.windowCount === 0,
     'no roof/tarps/windows on the bare fixture');
}

// ── Fixture B — 2.07 m-wide decked bay (gap-filler lane) ─────────────────────
// 1x1 grid, 2.07 x 2.07 m bay, 4 m structure, L1 at 2 m, auto-filled (6 pans).
// Hand-derived:
//   standards: stack for 4 m = 3 + 1 per position, x4 -> {3: 4, 1: 4}
//   ledger heights: seeds {0,2,4}, both 2 m gaps filled at their 1 m midpoints
//     -> [1,2,3,4]; ledgers 4 heights x 4 faces -> {2.07: 16}
//   braces: lifts [0-2],[2-4] x 4 faces -> 8x named 2.07-bay diagonal
//   plan braces: 1x '2.93m plan brace (2.07 x 2.07m bay)'
//   decking: 6x 2.07 m pans + 1 gap filler (one decked bay-level in a 2.07 m bay)
{
  const state = makeState({
    gridCols: 1, gridRows: 1, bayLengths: [2.07], bayWidth: 2.07,
    structureHeight: 4,
    levels: [{ id: 'L1', height: 2, color: '#C9A84C' }],
    placedPans: deckPansForBays([[0, 0]], 2.07, [{ id: 'L1' }]),
  });
  const bom = calculateBom(state);

  ok(eq(bom.deckPans, { 2.07: 6 }), `2.07 bay: 6x 2.07 m pans (got ${JSON.stringify(bom.deckPans)})`);
  ok(bom.gapFillers === 1, `2.07 bay: 1 gap filler per decked bay-level (got ${bom.gapFillers})`);
  ok(eq(bom.standards, { 3: 4, 1: 4 }), `standards 4x 3 m + 4x 1 m (got ${JSON.stringify(bom.standards)})`);
  ok(eq(bom.ledgers, { 2.07: 16 }), `ledgers 16x 2.07 m (got ${JSON.stringify(bom.ledgers)})`);
  ok(eq(bom.braces, { '2.81m diagonal brace (2.07m bay)': 8 }),
     `8x 2.81 m diagonal (got ${JSON.stringify(bom.braces)})`);
  ok(eq(bom.planBraces, { '2.93m plan brace (2.07 x 2.07m bay)': 1 }),
     `1x 2.93 m plan brace (got ${JSON.stringify(bom.planBraces)})`);
  ok(bom.basePlates === 4, '4 base plates');

  // Two levels on the same bay = two full pan sets = two gap fillers.
  const two = calculateBom(makeState({
    gridCols: 1, gridRows: 1, bayLengths: [2.07], bayWidth: 2.07,
    structureHeight: 4,
    levels: [{ id: 'L1', height: 2 }, { id: 'L2', height: 4 }],
    placedPans: deckPansForBays([[0, 0]], 2.07, [{ id: 'L1' }, { id: 'L2' }]),
  }));
  ok(eq(two.deckPans, { 2.07: 12 }) && two.gapFillers === 2,
     `two decked levels: 12 pans + 2 gap fillers (got ${JSON.stringify(two.deckPans)}, ${two.gapFillers})`);
}

// ── Fixture C — sub-2 m remainder lift (unbraced top lift) ────────────────────
// 1x1 grid, 2.57 x 2.57 m bay, 5 m structure, no decks.
// Hand-derived:
//   bracing heights [2,4,5]: lifts [0-2],[2-4] full -> 8x named diagonal (4 faces);
//   [4-5] is a 1 m remainder -> NO standard Layher diagonal: 4x unbraced entries,
//   span 2.57, diagLen = sqrt(2.57^2 + 1^2) = sqrt(7.6049) = 2.7577 -> round2 2.76,
//   swivels = ledger heights in [4,5] = {4,5} -> 2
//   (ledger heights for 5 m, no decks: seeds {0,5}, filled 1,2,3,4 -> [1,2,3,4,5])
//   standards: stack for 5 m = 3 + 2 per position, x4 -> {3: 4, 2: 4}
{
  const bom = calculateBom(makeState({ structureHeight: 5 }));

  ok(eq(bom.braces, { '3.18m diagonal brace (2.57m bay)': 8 }),
     `5 m: 8 full-lift diagonals (got ${JSON.stringify(bom.braces)})`);
  ok(bom.unbracedTopLifts.length === 4, `5 m: 4 unbraced 1 m top lifts, one per face (got ${bom.unbracedTopLifts.length})`);
  ok(bom.unbracedTopLifts.every(u => u.liftHeight === 1 && u.span === 2.57 && u.diagLen === 2.76 && u.swivels === 2),
     `unbraced lift: span 2.57, diag 2.76 m advisory, 2 swivels (got ${JSON.stringify(bom.unbracedTopLifts[0])})`);
  ok(eq(bom.standards, { 3: 4, 2: 4 }), `standards 4x 3 m + 4x 2 m (got ${JSON.stringify(bom.standards)})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
