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
import { calculateBom, deckPansForBays, STEPPED_CAVEATS, reducer } from './src/state/scaffoldStore.js';
import { PANS_PER_BAY_257, PANS_PER_BAY_207, DEFAULT_STACK } from './src/constants/layher.js';
import {
  getAutoLedgers, standardHeights, resolveBayHeights,
  getAutoBracingWithOverrides, manualBraceBase, braceBaseLimit, braceFaceTop, manualBraceKey, parseBraceKey,
  bespokeBraceKey, bespokeNode, getAutoBracing, OPENING_CAVEAT,
} from './src/utils/scaffoldGeometry.js';

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
// Heights are PER BAY (bayHeights, metres, one per column) since Sep 2026; the
// legacy single structureHeight is accepted as a fallback (Fixture E).
function makeState(over = {}) {
  return {
    gridCols: 1, gridRows: 1, bayLengths: [2.57], bayWidth: 2.57,
    bayHeights: [4], levels: [], placedPans: [],
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
    bayHeights: [6],
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
    bayHeights: [4],
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
    bayHeights: [4],
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
  const bom = calculateBom(makeState({ bayHeights: [5] }));

  ok(eq(bom.braces, { '3.18m diagonal brace (2.57m bay)': 8 }),
     `5 m: 8 full-lift diagonals (got ${JSON.stringify(bom.braces)})`);
  ok(bom.unbracedTopLifts.length === 4, `5 m: 4 unbraced 1 m top lifts, one per face (got ${bom.unbracedTopLifts.length})`);
  ok(bom.unbracedTopLifts.every(u => u.liftHeight === 1 && u.span === 2.57 && u.diagLen === 2.76 && u.swivels === 2),
     `unbraced lift: span 2.57, diag 2.76 m advisory, 2 swivels (got ${JSON.stringify(bom.unbracedTopLifts[0])})`);
  ok(eq(bom.standards, { 3: 4, 2: 4 }), `standards 4x 3 m + 4x 2 m (got ${JSON.stringify(bom.standards)})`);
}

// ── Fixture D — PER-BAY HEIGHTS: the 7-bay stepped "tree" acceptance case ─────
// 7 × 2.57 m bays, 1 row, entered as 4/8/12/16/12/8/4 METRES (heights are
// entered in metres in the UI; the 2 m lift is internal counting only), no decks.
// Recorded acceptance (per-bay heights handover, originally phrased in lifts):
//   8 leg lines with heights 4/8/12/16/16/12/8/4 m (taller-neighbour rule);
//   ledger/board counts that DECREASE with height; both stepped caveats shown.
// Hand-derived:
//   leg heights (m): [4,8,12,16,16,12,8,4]
//   standards (greedy 3 m stack, 2 rows of positions × 8 leg lines):
//     4 m → 3+1; 8 m → 3+3+2; 12 m → 4×3; 16 m → 5×3+1
//     per row: 3 m = 1+2+4+5+5+4+2+1 = 24; 2 m = 2 (the 8 m legs); 1 m = 4 (4 m + 16 m legs)
//     × 2 rows → {3: 48, 2: 4, 1: 8}
//   ledgers: no decks → every bay's own height at 1 m spacing: 4/8/12/16/12/8/4
//     front = back = 64; left/right = end-bay height 4 m → 4 each → {2.57: 136}
//     per lift on the front face: bays reaching h: h≤4 → 7, h≤8 → 5, h≤12 → 3, h≤16 → 1
//   braces (2 m lifts per bay): front = back = 2+4+6+8+6+4+2 = 32; left/right 2 each → 68
//   plan braces: 7 bay cells; base plates: (7+1)×(1+1) = 16
{
  const state = makeState({
    gridCols: 7, gridRows: 1,
    bayLengths: Array(7).fill(2.57),
    bayHeights: [4, 8, 12, 16, 12, 8, 4],
  });
  const bom = calculateBom(state);

  ok(eq(bom.legHeights, [4, 8, 12, 16, 16, 12, 8, 4]),
     `ACCEPTANCE: 8 leg lines 4/8/12/16/16/12/8/4 m (got ${JSON.stringify(bom.legHeights)})`);
  ok(eq(standardHeights([4, 8, 12, 16, 12, 8, 4]), bom.legHeights), 'standardHeights() = taller-neighbour rule');
  ok(bom.stepped === true, 'stepped flag set');
  ok(bom.maxHeight === 16, 'maxHeight = tallest bay (16 m)');
  ok(eq(bom.standards, { 3: 48, 2: 4, 1: 8 }), `stepped standards 48x3m + 4x2m + 8x1m (got ${JSON.stringify(bom.standards)})`);
  ok(eq(bom.ledgers, { 2.57: 136 }), `stepped ledgers 136x 2.57 m (got ${JSON.stringify(bom.ledgers)})`);
  ok(eq(bom.braces, { '3.18m diagonal brace (2.57m bay)': 68 }), `stepped braces 68x (got ${JSON.stringify(bom.braces)})`);
  ok(bom.unbracedTopLifts.length === 0, 'whole-lift heights: no unbraced top lift');
  ok(eq(bom.planBraces, { '3.64m plan brace (2.57 x 2.57m bay)': 7 }), '7 plan braces');
  ok(bom.basePlates === 16, `16 base plates (got ${bom.basePlates})`);

  // Per-lift ledger counts decrease with height (front face)
  const ledgers = getAutoLedgers(7, 1, state.bayHeights, []);
  const frontAt = h => ledgers.filter(l => l.face === 'front' && l.height === h).length;
  ok(frontAt(1) === 7 && frontAt(4) === 7 && frontAt(5) === 5 && frontAt(8) === 5 &&
     frontAt(9) === 3 && frontAt(12) === 3 && frontAt(13) === 1 && frontAt(16) === 1 && frontAt(17) === 0,
     `front ledgers per lift decrease 7/5/3/1 with height (got ${[1, 5, 9, 13].map(frontAt).join('/')})`);
  ok(ledgers.filter(l => l.face === 'left').length === 4 && ledgers.filter(l => l.face === 'right').length === 4,
     'side faces take the END bay height (4 m -> 4 ledgers each)');

  // Both stepped caveats, verbatim
  ok(bom.steppedCaveats.length === 2 &&
     bom.steppedCaveats[0] === "Stepped structure: exposed faces at height changes require additional bracing/ties — engineer's check required." &&
     bom.steppedCaveats[1] === 'Clad ballast figures assume a uniform structure; stepped builds need engineer confirmation.',
     'both stepped caveats present with the handover wording');
  ok(eq(bom.steppedCaveats, STEPPED_CAVEATS), 'caveats come from the shared STEPPED_CAVEATS constant');

  // Decking per lift only where the bay exists at that lift: a 12 m level fully
  // panned across all 7 bays (56 pans) is built only in the three bays >= 12 m.
  const decked = calculateBom(makeState({
    ...state,
    levels: [{ id: 'L1', height: 12 }],
    placedPans: deckPansForBays(Array.from({ length: 7 }, (_, c) => [c, 0]), 2.57, [{ id: 'L1' }]),
  }));
  ok(eq(decked.deckPans, { 2.57: 24 }) && decked.pansAboveBay === 32,
     `12 m level: 24 pans built (bays 12/16/12 m), 32 above their bay (got ${JSON.stringify(decked.deckPans)}, ${decked.pansAboveBay})`);
  // The level sits on a 1 m node so it adds no extra ledger heights — total unchanged.
  ok(eq(decked.ledgers, { 2.57: 136 }), 'ledgers unchanged by a level sitting on a 1 m node');
}

// ── Fixture E — UNIFORM via "set all" == legacy single-height BOM ────────────
// A uniform run entered per-bay must produce exactly the BOM the pre-per-bay
// planner produced for the same structure (the legacy `structureHeight` field
// is the old code path's input shape and still resolves to every bay).
{
  const base = { gridCols: 7, gridRows: 2, bayLengths: Array(7).fill(2.57), bayWidth: 2.57,
                 levels: [{ id: 'L1', height: 4 }] };
  const pans = deckPansForBays(
    Array.from({ length: 7 }, (_, c) => [[c, 0], [c, 1]]).flat(), 2.57, [{ id: 'L1' }]);
  const perBay  = calculateBom(makeState({ ...base, bayHeights: Array(7).fill(6), placedPans: pans }));
  const legacyS = makeState({ ...base, placedPans: pans, structureHeight: 6 });
  delete legacyS.bayHeights;
  const legacy  = calculateBom(legacyS);
  ok(eq(resolveBayHeights(legacyS), Array(7).fill(6)), 'legacy structureHeight resolves to every bay');
  ok(eq(perBay, legacy), 'ACCEPTANCE: uniform per-bay BOM deep-equals the legacy single-height BOM');
  ok(perBay.stepped === false && perBay.steppedCaveats.length === 0, 'uniform: no stepped caveats');
  // Sanity on the shared figures: 8 leg lines x 3 rows of positions, 6 m = 2x 3 m each
  ok(eq(perBay.standards, { 3: 48 }), `uniform 7x2 @ 6 m: 48x 3 m standards (got ${JSON.stringify(perBay.standards)})`);
}

// ── Fixture F — ODD HALF-METRE bay height (5.5 m: not a whole 2 m lift) ───────
// Heights are metres on 0.5 m nodes; 5.5 m must be accepted and count correctly.
// 3 × 2.57 m bays, heights 4 / 5.5 / 4 m, no decks. Hand-derived:
//   leg lines: [4, 5.5, 5.5, 4]
//   standards: 4 m → 3+1; 5.5 m → 3+2.5; per row {3: 4, 2.5: 2, 1: 2} × 2 rows
//     → {3: 8, 2.5: 4, 1: 4}
//   bracing on the 5.5 m bay: lifts [0-2],[2-4] named + [4-5.5] a 1.5 m remainder
//     → front + back each carry one UNBRACED 1.5 m top lift (2 entries); the
//     4 m bays and both side faces are fully braced: named = (2+2+2) × 2 faces
//     + 2 (left) + 2 (right) = 16
//   ledgers: 4 m → [1,2,3,4] (4); 5.5 m → seeds {0,5.5}, gap 5.5 → n=6 → snapped
//     [1,2,3,3.5,4.5,5.5] (6); front = back = 4+6+4 = 14; sides 4 each → 36
{
  const bom = calculateBom(makeState({
    gridCols: 3, gridRows: 1, bayLengths: [2.57, 2.57, 2.57], bayHeights: [4, 5.5, 4],
  }));
  ok(eq(bom.legHeights, [4, 5.5, 5.5, 4]), `5.5 m bay: leg lines [4,5.5,5.5,4] (got ${JSON.stringify(bom.legHeights)})`);
  ok(eq(bom.standards, { 3: 8, 2.5: 4, 1: 4 }), `5.5 m bay: standards 8x3m + 4x2.5m + 4x1m (got ${JSON.stringify(bom.standards)})`);
  ok(bom.unbracedTopLifts.length === 2 && bom.unbracedTopLifts.every(u => u.liftHeight === 1.5 && u.bayIndex === 1),
     `5.5 m bay: 2 unbraced 1.5 m top lifts on bay 1 only (got ${JSON.stringify(bom.unbracedTopLifts)})`);
  ok(eq(bom.braces, { '3.18m diagonal brace (2.57m bay)': 16 }), `5.5 m bay: 16 named diagonals (got ${JSON.stringify(bom.braces)})`);
  ok(eq(bom.ledgers, { 2.57: 36 }), `5.5 m bay: 36 ledgers (got ${JSON.stringify(bom.ledgers)})`);
  ok(bom.stepped === true && bom.maxHeight === 5.5, '5.5 m bay: stepped, tallest 5.5 m');
}

// ── Fixture G — OFF-THE-SHELF brace placed ACROSS the 2 m level ──────────────
// An off-the-shelf diagonal is a fixed 2 m-span component; its BASE may sit on
// any 0.5 m node (lifts are not placement bands). 1×1 2.57 m bay, 5.5 m high:
//   auto bracing: [0-2],[2-4] named on 4 faces = 8; [4-5.5] = 4 unbraced (bespoke)
//   + manual `front-0-1-3-L` (base 1 m, spans 1–3 m, straddles 2 m, base on the
//     left standard) → 9 named 3.18 m diagonals — the SAME component as the
//     0–2 m brace in that bay — and the unbraced count is unchanged (4)
//   rejection: `front-0-4-6-L` would top out at 6 m > 5.5 m → not built, dropped
{
  const base = makeState({ bayHeights: [5.5] });
  const plain = calculateBom(base);
  ok(eq(plain.braces, { '3.18m diagonal brace (2.57m bay)': 8 }) && plain.unbracedTopLifts.length === 4,
     `5.5 m bay auto: 8 named + 4 unbraced (got ${JSON.stringify(plain.braces)}, ${plain.unbracedTopLifts.length})`);

  const cross = calculateBom(makeState({ bayHeights: [5.5],
    bracingOverrides: { removed: [], added: ['front-0-1-3-L'] } }));
  ok(eq(cross.braces, { '3.18m diagonal brace (2.57m bay)': 9 }) && cross.unbracedTopLifts.length === 4,
     `cross-2m brace 1–3 m: +1 named 3.18 m diagonal, same component, no new unbraced (got ${JSON.stringify(cross.braces)}, ${cross.unbracedTopLifts.length})`);
  const { bracing } = getAutoBracingWithOverrides(1, 1, [5.5], { removed: [], added: ['front-0-1-3-L'] });
  const manual = bracing.find(b => b.key === 'front-0-1-3-L');
  ok(manual && manual.liftBottom === 1 && manual.liftTop === 3 && manual.direction === '/' && manual.face === 'front',
     `cross-2m brace parsed: 1–3 m, direction '/' (L = base on left standard) (got ${JSON.stringify(manual)})`);
  ok(eq(getAutoBracingWithOverrides(1, 1, [5.5], { removed: [], added: ['front-0-1-3-R'] }).bracing.find(b => b.liftBottom === 1).direction, '\\'),
     'R suffix = base on the right standard (direction \\)');

  // Rejection at the top of the bay: top 6 m > 5.5 m face top → dropped.
  const rej = calculateBom(makeState({ bayHeights: [5.5],
    bracingOverrides: { removed: [], added: ['front-0-4-6-L'] } }));
  ok(eq(rej.braces, plain.braces) && rej.unbracedTopLifts.length === 4,
     `brace topping out above the bay (4–6 m in 5.5 m) is NOT built (got ${JSON.stringify(rej.braces)})`);
  // The highest legal base in a 5.5 m bay is 3.5 m (3.5–5.5 m) — accepted.
  const top = calculateBom(makeState({ bayHeights: [5.5],
    bracingOverrides: { removed: [], added: ['front-0-3.5-5.5-L'] } }));
  ok(eq(top.braces, { '3.18m diagonal brace (2.57m bay)': 9 }), 'brace ending exactly at the bay top (3.5–5.5 m) is accepted');

  // Snap helpers the ghost uses: base = nearest node to (cursor − 1 m), clamped
  // to [0, faceTop − 2]; a bay under 2 m offers nothing.
  ok(braceBaseLimit(5.5) === 3.5 && braceBaseLimit(2) === 0 && braceBaseLimit(1.5) === null,
     'braceBaseLimit: 5.5 m → 3.5, 2 m → 0, 1.5 m → none');
  ok(manualBraceBase(2.0, 5.5) === 1 && manualBraceBase(2.2, 5.5) === 1 && manualBraceBase(2.3, 5.5) === 1.5,
     'manualBraceBase: cursor at 2.0/2.2 m → base 1 m (spans 1–3 across the 2 m level); 2.3 m → 1.5 m');
  ok(manualBraceBase(5.4, 5.5) === 3.5 && manualBraceBase(0.2, 5.5) === 0 && manualBraceBase(3, 1.5) === null,
     'manualBraceBase: clamps to the top limit and to ground; too-short bay → null');
  ok(manualBraceKey('front', 0, 1, '/') === 'front-0-1-3-L' && manualBraceKey('back', 2, 3.5, '\\') === 'back-2-3.5-5.5-R',
     'manualBraceKey encodes base, base+2 and the standard the base sits on');
  // Mono-pitch: the back face top is 0.5 m lower, so the highest base drops with it.
  ok(braceFaceTop('front', 0, [5.5], 1, 1, 'monoPitch') === 5.5 && braceFaceTop('back', 0, [5.5], 1, 1, 'monoPitch') === 5,
     'braceFaceTop: mono-pitch back face 0.5 m lower than front');

  // Legacy 4-part keys (auto keys and pre-Sep-2026 saved manual braces) still parse
  // with the old direction fallback — saved states load unchanged.
  const legacy = parseBraceKey('front-0-1-3');
  ok(legacy.liftBottom === 1 && legacy.liftTop === 3 && legacy.direction === '/', 'legacy key front-0-1-3 parses with fallback direction');
  const legacyBom = calculateBom(makeState({ bayHeights: [5.5], bracingOverrides: { removed: [], added: ['front-0-1-3'] } }));
  ok(eq(legacyBom.braces, cross.braces), 'legacy-keyed cross-2m brace counts identically');
  // Bespoke (sub-2 m) manual diagonals are untouched by this change.
  const bespoke = getAutoBracingWithOverrides(1, 1, [5.5], { removed: [], added: ['front-0-4-5.5'] }).bracing;
  ok(bespoke.some(b => b.key === 'front-0-4-5.5' && b.liftTop - b.liftBottom === 1.5), 'bespoke 1.5 m manual diagonal still accepted');
}

// ── Fixture H — BESPOKE diagonal tool (regression guard) ─────────────────────
// Bespoke = free tube between ANY two 0.5 m nodes on opposite standards of a bay
// (key suffix LB/RB — letter = standard the LOWER end sits on). Always dashed,
// always advisory (unbracedTopLifts), never a priced component — including
// cross-2m and non-2m spans. 1×1 2.57 m bay, 5.5 m high (auto: 8 named + 4 bespoke
// remainder lifts).
{
  // 1 m on the left standard → 4 m on the right: span 3 m, crosses the 2 m level.
  const key = bespokeBraceKey('front', 0, 1, 'L', 4);
  ok(key === 'front-0-1-4-LB', `bespoke key encodes bottom/top + lower-end standard (got ${key})`);
  ok(bespokeBraceKey('front', 0, 4, 'L', 1) === 'front-0-1-4-RB',
     'start high on the left, end low on the right → lower end is on the RIGHT (RB)');
  const p = parseBraceKey(key);
  ok(p.bespoke === true && p.direction === '/' && p.liftBottom === 1 && p.liftTop === 4, 'bespoke key parses: bespoke, / (base left), 1–4 m');

  const bom = calculateBom(makeState({ bayHeights: [5.5], bracingOverrides: { removed: [], added: [key] } }));
  ok(eq(bom.braces, { '3.18m diagonal brace (2.57m bay)': 8 }), 'bespoke 1–4 m adds NO priced component');
  const adv = bom.unbracedTopLifts.find(u => u.liftHeight === 3);
  // diagLen = sqrt(2.57² + 3²) = sqrt(15.6049) = 3.9503 → 3.95; swivels = ledgers in [1,4]
  // of the 5.5 m bay's [1,2,3,3.5,4.5,5.5] → {1,2,3,3.5} = 4
  ok(bom.unbracedTopLifts.length === 5 && adv && adv.span === 2.57 && adv.diagLen === 3.95 && adv.swivels === 4,
     `bespoke 1–4 m counts as an advisory free-tube diagonal: 3.95 m cut tube, 4 swivels (got ${JSON.stringify(adv)})`);

  // A bespoke diagonal that happens to span exactly 2 m stays bespoke (explicit tool choice).
  const two = calculateBom(makeState({ bayHeights: [5.5], bracingOverrides: { removed: [], added: ['front-0-1-3-LB'] } }));
  ok(eq(two.braces, { '3.18m diagonal brace (2.57m bay)': 8 }) && two.unbracedTopLifts.length === 5,
     'bespoke key with a 2 m span is still bespoke (dashed, advisory), not the priced component');
  // Non-2m sub-span (0.5–1.5 m) and the top constraint (3–6 m in a 5.5 m bay → dropped).
  const small = getAutoBracingWithOverrides(1, 1, [5.5], { removed: [], added: ['front-0-0.5-1.5-RB'] }).bracing;
  ok(small.some(b => b.key === 'front-0-0.5-1.5-RB' && b.bespoke && b.direction === '\\'), 'bespoke 0.5–1.5 m (RB) accepted, base right');
  const over = getAutoBracingWithOverrides(1, 1, [5.5], { removed: [], added: ['front-0-3-6-LB'] }).bracing;
  ok(!over.some(b => b.key === 'front-0-3-6-LB'), 'bespoke diagonal topping out above the bay is dropped');
  // Node snapping the tool uses: any 0.5 m node, clamped to [0, faceTop].
  ok(bespokeNode(1.2, 5.5) === 1 && bespokeNode(1.3, 5.5) === 1.5 && bespokeNode(9, 5.5) === 5.5 && bespokeNode(-1, 5.5) === 0,
     'bespokeNode snaps to 0.5 m nodes within [0, faceTop]');
  // Fixture G's off-the-shelf keys are unaffected by the bespoke flag.
  ok(parseBraceKey('front-0-1-3-L').bespoke === false, 'off-the-shelf L key is not bespoke');
}

// ── Fixture I — AUTO-BRACE DIRECTION CONTROL (per face) ──────────────────────
// Drawing preference only: keys, counts and the BOM are identical whichever
// pattern is chosen. 3 × 2.57 m bays, 6 m: front has 3 bays × 3 lifts = 9 braces.
{
  const st = makeState({ gridCols: 3, gridRows: 1, bayLengths: [2.57, 2.57, 2.57], bayHeights: [6, 6, 6] });
  const alt = getAutoBracing(3, 1, [6, 6, 6], null, {});
  const altFront = alt.filter(b => b.face === 'front');
  ok(altFront.length === 9 && altFront.some(b => b.direction === '/') && altFront.some(b => b.direction === '\\'),
     'default = alternating: front mixes / and \\');
  ok(altFront.find(b => b.bayIndex === 0 && b.liftBottom === 0).direction === '/' &&
     altFront.find(b => b.bayIndex === 1 && b.liftBottom === 0).direction === '\\' &&
     altFront.find(b => b.bayIndex === 0 && b.liftBottom === 2).direction === '\\',
     'alternating mirrors across adjacent bays and lifts (unchanged behaviour)');

  const sameR = getAutoBracing(3, 1, [6, 6, 6], null, { pattern: { front: { mode: 'same', lean: 'R' } } });
  ok(sameR.filter(b => b.face === 'front').every(b => b.direction === '\\'), 'front SAME / lean R: every front auto brace leans \\');
  ok(sameR.filter(b => b.face === 'back').some(b => b.direction === '/') && sameR.filter(b => b.face === 'back').some(b => b.direction === '\\'),
     'other faces keep their own (alternating) pattern');
  ok(eq(sameR.map(b => b.key), alt.map(b => b.key)), 'keys are identical whichever pattern → removed/added overrides still apply');

  const bomAlt  = calculateBom(st);
  const bomSame = calculateBom({ ...st, bracingPattern: { front: { mode: 'same', lean: 'R' }, back: { mode: 'same', lean: 'L' } } });
  ok(eq(bomAlt, bomSame), 'ACCEPTANCE: BOM identical for alternating vs same-direction patterns');

  // Reducer: SET_BRACING_PATTERN merges per face; unknown face ignored; lean kept when only mode changes.
  const base = { ...st, bracingPattern: {}, history: [] };
  const s1 = reducer(base, { type: 'SET_BRACING_PATTERN', face: 'front', mode: 'same' });
  const s2 = reducer(s1,   { type: 'SET_BRACING_PATTERN', face: 'front', lean: 'R' });
  ok(eq(s2.bracingPattern.front, { mode: 'same', lean: 'R' }) && s2.bracingPattern.back === undefined,
     `SET_BRACING_PATTERN merges mode then lean for one face (got ${JSON.stringify(s2.bracingPattern)})`);
  ok(reducer(base, { type: 'SET_BRACING_PATTERN', face: 'roof', mode: 'same' }) === base, 'unknown face is ignored');
}

// ── Fixture J — RE-APPLY AUTO BRACING + openings ─────────────────────────────
// Stepped run 3 × 2.57 m bays at 4 / 6 / 4 m with a LOWER-CENTRAL OPENING: the
// front ledger at 1 m in bay 1 is removed (doorway 0–2 m, 2 m header kept).
// Rule: an auto brace is skipped when a removed ledger's height lies within its
// lift (inclusive) — no braces in or across the opening; nothing compensates.
//   front auto lifts: bay0 [0-2],[2-4]; bay1 [0-2],[2-4],[4-6]; bay2 [0-2],[2-4]
//   → bay1 [0-2] skipped (contains 1 m) → 6 front braces + 1 opening
//   back 7, left 2, right 2 → 17 named diagonals (18 without the opening)
{
  const opening = { removed: ['front-1-1'], added: [] };
  const geom = [3, 1, [4, 6, 4]];
  const st = makeState({
    gridCols: 3, gridRows: 1, bayLengths: [2.57, 2.57, 2.57], bayHeights: [4, 6, 4],
    ledgerOverrides: opening,
    // The user had also hand-removed two braces before adapting the structure:
    bracingOverrides: { removed: ['front-0-0-2', 'back-2-2-4'], added: ['front-2-1-3-L', 'front-0-0.5-3-LB'] },
    history: [],
  });

  // Generator: opening skipped, reported, caveat wording.
  const { bracing, openings } = getAutoBracingWithOverrides(...geom, { removed: [], added: [] }, null, { removedLedgers: opening.removed });
  ok(openings.length === 1 && openings[0].face === 'front' && openings[0].bayIndex === 1 && openings[0].liftBottom === 0 && openings[0].liftTop === 2,
     `opening: front bay 1 [0-2] skipped (got ${JSON.stringify(openings)})`);
  ok(!bracing.some(b => b.face === 'front' && b.bayIndex === 1 && b.liftBottom === 0), 'no brace in/across the opening');
  ok(bracing.some(b => b.face === 'front' && b.bayIndex === 1 && b.liftBottom === 2) &&
     bracing.some(b => b.face === 'front' && b.bayIndex === 1 && b.liftBottom === 4), 'lifts above the opening in the same bay are still braced');
  ok(bracing.filter(b => b.face === 'front').length === 6, `front: 6 auto braces around the opening (got ${bracing.filter(b => b.face === 'front').length})`);
  const noOpening = getAutoBracingWithOverrides(...geom, { removed: [], added: [] }, null, { removedLedgers: [] });
  ok(noOpening.openings.length === 0 && noOpening.bracing.length === 18, 'without the removed ledger: 18 braces, no openings');
  // A ledger removed exactly at a lift boundary (the 2 m header) blocks both lifts sharing that node.
  const header = getAutoBracingWithOverrides(...geom, { removed: [], added: [] }, null, { removedLedgers: ['front-1-2'] });
  ok(header.openings.length === 2 && header.openings.every(o => o.bayIndex === 1) &&
     header.openings.some(o => o.liftTop === 2) && header.openings.some(o => o.liftBottom === 2),
     'removed anchoring ledger at 2 m blocks both [0-2] and [2-4] in that bay');

  // BOM before re-apply: opening + the two hand-removed braces + manual braces.
  const before = calculateBom(st);
  ok(before.openingCaveats.length === 1 && before.openingCaveats[0] === OPENING_CAVEAT && before.bracingOpenings.length === 1,
     'opening caveat shown with the handover wording');
  ok(before.steppedCaveats.length === 2, 'stepped caveats shown alongside (4/6/4 m run)');
  // named: 17 auto − 2 removed + 1 manual off-the-shelf = 16; bespoke: 1 manual
  ok(eq(before.braces, { '3.18m diagonal brace (2.57m bay)': 16 }) && before.unbracedTopLifts.length === 1 && before.removedBraceCount === 2,
     `before re-apply: 16 named, 1 bespoke, 2 suppressed (got ${JSON.stringify(before.braces)}, ${before.unbracedTopLifts.length}, ${before.removedBraceCount})`);

  // RE-APPLY: clears the suppression list only; manual + bespoke untouched.
  const after = reducer(st, { type: 'REAPPLY_AUTO_BRACING' });
  ok(eq(after.bracingOverrides, { removed: [], added: st.bracingOverrides.added }),
     `re-apply clears removed, keeps added (got ${JSON.stringify(after.bracingOverrides)})`);
  const bomAfter = calculateBom(after);
  // named: 17 auto (full pattern everywhere except the opening) + 1 manual = 18; bespoke still 1
  ok(eq(bomAfter.braces, { '3.18m diagonal brace (2.57m bay)': 18 }) && bomAfter.unbracedTopLifts.length === 1 && bomAfter.removedBraceCount === 0,
     `ACCEPTANCE: after re-apply 18 named (no brace at the opening), bespoke kept (got ${JSON.stringify(bomAfter.braces)}, ${bomAfter.unbracedTopLifts.length})`);
  ok(bomAfter.openingCaveats.length === 1 && bomAfter.bracingOpenings.length === 1, 'opening caveat still shown after re-apply');
  ok(after.history.length === st.history.length + 1, 're-apply is undoable (recorded)');

  // Re-apply honours the face pattern: SAME/R on front → every front auto brace leans \.
  const patterned = reducer(reducer(after, { type: 'SET_BRACING_PATTERN', face: 'front', mode: 'same', lean: 'R' }), { type: 'REAPPLY_AUTO_BRACING' });
  const pb = getAutoBracingWithOverrides(...geom, patterned.bracingOverrides, null, { pattern: patterned.bracingPattern, removedLedgers: opening.removed }).bracing;
  ok(pb.filter(b => b.face === 'front' && !b.key.endsWith('L') && !b.key.endsWith('B')).every(b => b.direction === '\\'),
     're-apply with SAME/R: all front AUTO braces lean \\ (manual keep their own)');
  ok(pb.find(b => b.key === 'front-2-1-3-L').direction === '/', 'manual off-the-shelf brace keeps its own direction');

  // REMOVE_BRACE on a manually added key drops it from `added` (was undeletable).
  const del = reducer(after, { type: 'REMOVE_BRACE', key: 'front-0-0.5-3-LB' });
  ok(eq(del.bracingOverrides, { removed: [], added: ['front-2-1-3-L'] }), 'deleting a manual bespoke diagonal removes it from added');
  const delAuto = reducer(after, { type: 'REMOVE_BRACE', key: 'front-0-0-2' });
  ok(eq(delAuto.bracingOverrides.removed, ['front-0-0-2']) && delAuto.bracingOverrides.added.length === 2, 'deleting an auto brace still suppresses it');
}

// ── Fixture K — LEGACY SAVE with lift-snapped bespoke diagonals ──────────────
// Before the bespoke tool, bespoke diagonals were placed by the old ledger-lift
// snapping and saved as 4-part keys with NO suffix (e.g. `front-0-1-2`, a 1 m
// lift between 1 m-spaced ledgers). They must load as DASHED bespoke (advisory),
// never silently become a solid priced component. Rule: a 4-part key is bespoke
// iff its span ≠ 2 m — legacy lift-snapped spans were always ≤ 2 m (ledger gaps
// never exceed 2 m), and a legacy exactly-2 m key was, and stays, off-the-shelf.
// The save also carries the pre-per-bay single `structureHeight`.
{
  const legacySave = {
    gridCols: 1, gridRows: 1, bayLengths: [2.57], bayWidth: 2.57, structureHeight: 4,
    levels: [], placedPans: [], tarps: [], windows: [], roofBays: [], ladderBeams: [],
    ledgerOverrides: { removed: [], added: [] },
    bracingOverrides: { removed: ['front-0-0-2'], added: ['front-0-1-2', 'front-0-0-1.5'] },
    suppressedStdPositions: [], bomExtras: [],
  };
  const loaded = reducer({ history: [] }, { type: 'LOAD_STATE', payload: legacySave });
  ok(eq(loaded.bayHeights, [4]) && loaded.structureHeight === undefined, 'legacy structureHeight migrates to bayHeights');
  ok(eq(loaded.bracingOverrides, legacySave.bracingOverrides), 'legacy brace keys load unchanged (no rewrite)');

  const { bracing } = getAutoBracingWithOverrides(1, 1, loaded.bayHeights, loaded.bracingOverrides, null,
    { pattern: loaded.bracingPattern, removedLedgers: [] });
  const b12  = bracing.find(b => b.key === 'front-0-1-2');
  const b015 = bracing.find(b => b.key === 'front-0-0-1.5');
  ok(b12 && b12.bespoke === true && b015 && b015.bespoke === true,
     'legacy lift-snapped 1 m and 1.5 m diagonals come back BESPOKE (dashed, advisory)');
  ok(!bracing.some(b => b.key === 'front-0-0-2'), 'legacy removed auto brace stays suppressed');

  const bom = calculateBom(loaded);
  // auto for 4 m: [0-2],[2-4] × 4 faces = 8, minus the suppressed front [0-2] = 7 named;
  // the two legacy bespoke diagonals are advisory only (1 m and 1.5 m)
  ok(eq(bom.braces, { '3.18m diagonal brace (2.57m bay)': 7 }),
     `legacy bespoke diagonals add NO priced component (got ${JSON.stringify(bom.braces)})`);
  ok(bom.unbracedTopLifts.length === 2 && bom.unbracedTopLifts.some(u => u.liftHeight === 1) && bom.unbracedTopLifts.some(u => u.liftHeight === 1.5),
     `legacy bespoke diagonals counted as advisory 1 m + 1.5 m (got ${JSON.stringify(bom.unbracedTopLifts.map(u => u.liftHeight))})`);

  // A legacy exactly-2 m manual key (placed lift-to-lift) was solid before and stays solid.
  const solid = getAutoBracingWithOverrides(1, 1, [5], { removed: [], added: ['front-0-1-3'] }).bracing.find(b => b.key === 'front-0-1-3');
  ok(solid && solid.bespoke === false, 'legacy exactly-2 m key stays an off-the-shelf (solid) brace');
}

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
