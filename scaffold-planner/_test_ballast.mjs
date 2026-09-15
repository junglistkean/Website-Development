// Offline regression for the ballast estimator — BOTH lanes (2026-07-06).
//   Skeleton lane: Layher open-tower table lookup + linear interpolation on height.
//   Clad lane:     overturning method, CampbellReith 13994-81 coefficients.
//
// Imports the REAL modules directly (package is "type":"module", the ballast code
// is pure ESM with no React/DOM) — not a source-extraction copy, so what's tested
// is exactly what ships. A missing/renamed export fails the import itself (loud).
//
// BALLAST IS SAFETY-RELEVANT: every expected number below is hand-checked and
// carries its derivation. Comparisons are EXACT — no tolerance bands. The only
// rounding is the module's own documented rules (round0 = Math.round on kg,
// round2 on detail figures, Math.ceil on whole blocks), applied identically in
// the hand-derivations.
//
//   node _test_ballast.mjs
import { computeBallast } from './src/utils/ballast.js';
import {
  CLAD, BLOCK, EXPOSURE_STEPUP, LAYHER_OPEN_TOWER, CLADDING_OPTIONS,
} from './src/constants/ballast.js';

let pass = 0, fail = 0;
function ok(cond, msg) { if (cond) pass++; else { fail++; console.error('FAIL:', msg); } }
function done() {
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
}

// ── Marker guard: prove the imported constants are the real engineering inputs ──
// These constants ARE the safety surface — any drift here silently reprices every
// estimate, so the guard hard-fails before any behaviour is checked.
if (typeof computeBallast !== 'function' ||
    !LAYHER_OPEN_TOWER.citation.includes('Layher Allround Technical Brochure 04.2017')) {
  console.error('FAIL: imported code is not the real ballast estimator (marker absent). Nothing was tested.');
  process.exit(1);
}
// CampbellReith 13994-81 coefficients (constants/ballast.js CLAD) — exact values.
ok(CLAD.Q_NET_BASELINE === 0.40, 'CLAD.Q_NET_BASELINE 0.40 kN/m2 (CampbellReith 13994-81)');
ok(CLAD.FOS_OVERTURN === 1.4, 'CLAD.FOS_OVERTURN 1.4');
ok(CLAD.SELFWEIGHT_PER_BAY === 740, 'CLAD.SELFWEIGHT_PER_BAY 740 kg (826 kg x 0.9 haircut)');
ok(CLAD.KN_TO_KG === 100, 'CLAD.KN_TO_KG 100 (engineer convention — deliberately NOT 9.81-derived)');
ok(CLAD.VALIDATED_HEIGHT === 7.5, 'CLAD.VALIDATED_HEIGHT 7.5 m (report worked example)');
ok(BLOCK.CONCRETE_T === 1.1 && BLOCK.WATER_T === 1.0, 'block sizes 1.1 T concrete / 1.0 T water');
ok(EXPOSURE_STEPUP.sheltered_inland === 1.0 && EXPOSURE_STEPUP.open_summer === 1.25 &&
   EXPOSURE_STEPUP.exposed_coastal_upland === 1.5, 'exposure step-ups 1.0 / 1.25 / 1.5');
// Layher table, 2.57 m width / no-cantilever column (the v1 lookup): 0 / 275 / 1150 kg
// at platform heights 2.25 / 4.25 / 6.25 m (brochure Tab.44-46, "in the open", steel K).
{
  const r = LAYHER_OPEN_TOWER.rows;
  ok(r.length === 3 && r[0].h === 2.25 && r[1].h === 4.25 && r[2].h === 6.25,
     'Layher table rows at h = 2.25 / 4.25 / 6.25');
  ok(r[0].a[2.57][0] === 0 && r[1].a[2.57][0] === 275 && r[2].a[2.57][0] === 1150,
     'Layher 2.57 m / k=0 column reads 0 / 275 / 1150 kg');
  ok(LAYHER_OPEN_TOWER.V1_BAY_WIDTH === 2.57 && LAYHER_OPEN_TOWER.V1_CANTILEVER === 0 &&
     LAYHER_OPEN_TOWER.MAX_HEIGHT === 6.25 && LAYHER_OPEN_TOWER.WATER_OFFER_MAX_HEIGHT === 4.25,
     'v1 lookup fixed to 2.57 m / k=0, ceiling 6.25 m, water offer <= 4.25 m');
}

// The single reference tower the skeleton lane accepts: 1x1 grid, 2.57 x 2.57 m plan.
// Heights are PER BAY (bayHeights) since Sep 2026; the legacy single
// structureHeight is still accepted (checked in the per-leg block below).
const refTower = (H) => ({
  gridCols: 1, gridRows: 1, bayWidth: 2.57, bayLengths: [2.57], bayHeights: [H],
});
const sk = (H) => computeBallast(refTower(H), { cladding: 'skeleton', exposure: 'sheltered_inland' });

// ── Skeleton lane — table rows, interpolation, floor, ceiling, off-table stops ──
{
  // H = 4.25 m: exact table row -> 275 kg. ceil(275/1100) = 1 concrete block;
  // water offered at <= 4.25 m: ceil(275/1000) = 1.
  const r = sk(4.25);
  ok(r.lane === 'skeleton' && r.outOfTable === false, 'H=4.25: skeleton lane, in-table');
  ok(r.ballastKg === 275, `H=4.25: 275 kg exact table row (got ${r.ballastKg})`);
  ok(r.blocks.concrete === 1, 'H=4.25: 1x 1.1T concrete block');
  ok(r.waterAlt === 1, 'H=4.25: water alternative offered, 1x 1.0T');
  ok(r.confidence === 'green', 'H=4.25: green (figure produced)');
  ok(r.disclaimer.includes('Layher'), 'H=4.25: skeleton disclaimer cites Layher');

  // H = 3.25 m: midpoint of rows 2.25 (0 kg) and 4.25 (275 kg) ->
  // 0 + 275 x ((3.25-2.25)/(4.25-2.25)) = 137.5 kg -> round0 138 (Math.round half-up).
  // Blocks use the raw kg: ceil(137.5/1100) = 1 concrete; water ceil(137.5/1000) = 1.
  const r2 = sk(3.25);
  ok(r2.ballastKg === 138, `H=3.25: interpolated 137.5 -> 138 kg (got ${r2.ballastKg})`);
  ok(r2.blocks.concrete === 1 && r2.waterAlt === 1, 'H=3.25: 1 concrete, water alt 1');

  // H = 5.25 m: midpoint of rows 4.25 (275) and 6.25 (1150) ->
  // 275 + 875 x 0.5 = 712.5 -> round0 713. ceil(712.5/1100) = 1 concrete.
  // Above 4.25 m -> NO water alternative (uplift concern).
  const r3 = sk(5.25);
  ok(r3.ballastKg === 713, `H=5.25: interpolated 712.5 -> 713 kg (got ${r3.ballastKg})`);
  ok(r3.blocks.concrete === 1, 'H=5.25: 1 concrete block');
  ok(r3.waterAlt === null, 'H=5.25: water NOT offered above 4.25 m');

  // H = 2.0 m: below the 2.25 m table floor -> clamps to the floor row = 0 kg, 0 blocks
  // (water offer active at this height but 0 kg -> 0 blocks).
  const r4 = sk(2.0);
  ok(r4.ballastKg === 0 && r4.blocks.concrete === 0 && r4.waterAlt === 0,
     'H=2.0: below table floor -> 0 kg, 0 blocks');

  // H = 6.25 m: table ceiling row -> 1150 kg. ceil(1150/1100) = 2 concrete.
  const r5 = sk(6.25);
  ok(r5.ballastKg === 1150 && r5.blocks.concrete === 2 && r5.waterAlt === null,
     `H=6.25: ceiling row 1150 kg, 2 blocks, no water (got ${r5.ballastKg} kg, ${r5.blocks.concrete})`);

  // H = 6.5 m: beyond the table -> hard stop, amber, NO figure (no proportional scaling).
  const r6 = sk(6.5);
  ok(r6.outOfTable === true && r6.ballastKg === null && r6.confidence === 'amber',
     'H=6.5: beyond table -> amber, no figure');
  ok(r6.flagLabel === 'Off-table — bespoke', 'H=6.5: off-table flag label');

  // Non-reference geometry -> hard stop even in-height: multi-bay...
  const multi = computeBallast(
    { gridCols: 2, gridRows: 1, bayWidth: 2.57, bayLengths: [2.57, 2.57], bayHeights: [4, 4] },
    { cladding: 'skeleton', exposure: 'sheltered_inland' });
  ok(multi.outOfTable === true && multi.ballastKg === null, 'multi-bay skeleton -> off-table, no figure');
  // ...and a non-2.57 m bay width.
  const narrow = computeBallast(
    { gridCols: 1, gridRows: 1, bayWidth: 2.07, bayLengths: [2.07], bayHeights: [4] },
    { cladding: 'skeleton', exposure: 'sheltered_inland' });
  ok(narrow.outOfTable === true && narrow.ballastKg === null, '2.07 m skeleton -> off-table, no figure');
}

// ── Clad lane — overturning method, hand-worked figures ──────────────────────
{
  // Reference-size tower fully clad at the validated height, sheltered (step-up 1.0).
  // Hand derivation (CampbellReith method, constants above):
  //   q  = 0.40 x 1.0                = 0.40 kN/m2
  //   F  = 0.40 x 7.5 x 2.57         = 7.71 kN
  //   M  = 7.71 x 7.5/2              = 28.9125 kNm     (round2 -> 28.91)
  //   Fb = 28.9125 / (2.57/2)        = 22.5 kN
  //   W  = 1.4 x 22.5                = 31.5 kN -> x100 = 3150 kg
  //   ballast = 3150 - 740x1         = 2410 kg -> ceil(2410/1100) = 3 blocks
  const c = computeBallast(refTower(7.5), { cladding: 'fully_clad', exposure: 'sheltered_inland' });
  ok(c.lane === 'clad' && c.confidence === 'amber', 'clad 7.5m: clad lane, always amber');
  ok(c.ballastKg === 2410, `clad 7.5m sheltered: 2410 kg (got ${c.ballastKg})`);
  ok(c.blocks.concrete === 3, `clad 7.5m: 3x 1.1T concrete (got ${c.blocks.concrete})`);
  ok(c.detail.q === 0.4 && c.detail.F === 7.71 && c.detail.M_ot === 28.91 &&
     c.detail.Fb === 22.5 && c.detail.W_req === 31.5 && c.detail.W_req_kg === 3150,
     'clad 7.5m: intermediate figures match the hand derivation');
  ok(c.disclaimer.includes('CampbellReith 13994-81'), 'clad disclaimer cites CampbellReith 13994-81');
  ok(c.notes.some(n => n.includes('water ballast not permitted')), 'clad: uplift/no-water note present');
  ok(!c.notes.some(n => n.includes('Above the validated')), 'clad 7.5m: NO extra-caution note at exactly 7.5 m');

  // Same tower at H=8 m -> above the validated example -> extra-caution note FIRST.
  //   F = 0.40 x 8 x 2.57 = 8.224; M = 32.896; Fb = 25.6; W = 35.84 kN -> 3584 kg
  //   ballast = 3584 - 740 = 2844 kg -> ceil(2844/1100) = 3 blocks
  const c8 = computeBallast(refTower(8), { cladding: 'fully_clad', exposure: 'sheltered_inland' });
  ok(c8.ballastKg === 2844 && c8.blocks.concrete === 3,
     `clad 8m: 2844 kg, 3 blocks (got ${c8.ballastKg} kg, ${c8.blocks.concrete})`);
  ok(c8.notes[0].includes('Above the validated'), 'clad 8m: extra-caution note unshifted to front');

  // Exposure step-up x1.5 (exposed coastal), H=7.5 reference tower:
  //   q = 0.60; F = 11.565; M = 43.36875; Fb = 33.75; W = 47.25 kN -> 4725 kg
  //   ballast = 4725 - 740 = 3985 kg -> ceil(3985/1100) = 4 blocks
  const cx = computeBallast(refTower(7.5), { cladding: 'fully_clad', exposure: 'exposed_coastal_upland' });
  ok(cx.detail.q === 0.6, 'clad exposed: q stepped up to 0.60');
  ok(cx.ballastKg === 3985 && cx.blocks.concrete === 4,
     `clad exposed 7.5m: 3985 kg, 4 blocks (got ${cx.ballastKg} kg, ${cx.blocks.concrete})`);

  // Multi-bay geometry mapping: 2x1 grid of 2.57 m bays, H=6, sheltered.
  //   L_long = 5.14 (run), L_short = 2.57 (depth), N_bays = 2
  //   F = 0.40 x 6 x 5.14 = 12.336; M = 37.008; Fb = 28.8; W = 40.32 kN -> 4032 kg
  //   ballast = 4032 - 740x2 = 2552 kg -> ceil(2552/1100) = 3 blocks
  const cm = computeBallast(
    { gridCols: 2, gridRows: 1, bayWidth: 2.57, bayLengths: [2.57, 2.57], bayHeights: [6, 6] },
    { cladding: 'fully_clad', exposure: 'sheltered_inland' });
  ok(cm.geom.L_long === 5.14 && cm.geom.L_short === 2.57 && cm.geom.N_bays === 2,
     'clad 2x1: geometry mapped L_long 5.14 / L_short 2.57 / 2 bays');
  ok(cm.ballastKg === 2552 && cm.blocks.concrete === 3,
     `clad 2x1 6m: 2552 kg, 3 blocks — 2-bay self-weight credited (got ${cm.ballastKg} kg, ${cm.blocks.concrete})`);

  // Lane routing: every clad variant (part-clad/scrim, fully-clad/banner) uses the
  // clad lane; skeleton uses the table lane.
  const lanes = Object.fromEntries(CLADDING_OPTIONS.map(o =>
    [o.id, computeBallast(refTower(4), { cladding: o.id, exposure: 'sheltered_inland' }).lane]));
  ok(lanes.skeleton === 'skeleton' && lanes.part_clad === 'clad' && lanes.fully_clad === 'clad',
     'cladding gate routes skeleton -> table lane; part/fully clad -> overturning lane');
}

// ── PER-LEG-LINE ballast (per-bay heights, Sep 2026) ─────────────────────────
// Each leg line (standard column line) is estimated at ITS OWN height — the
// taller of its two neighbouring bays — with a tributary share of the plan:
// wind face = L_long × (half of each adjacent bay length / run); self-weight =
// 740 kg × tributary bays (half of each adjacent bay × rows). Results are SUMMED.
{
  const seven = (heights) => ({
    gridCols: 7, gridRows: 1, bayWidth: 2.57, bayLengths: Array(7).fill(2.57), bayHeights: heights,
  });
  const clad = (st) => computeBallast(st, { cladding: 'fully_clad', exposure: 'sheltered_inland' });

  // (a) UNIFORM 7 x 2.57 m run at 6 m: the per-leg sum must reproduce the
  // whole-structure figure exactly (slices are proportional).
  //   L_long = 17.99, L_short = 2.57, N_bays = 7
  //   F = 0.40 x 6 x 17.99 = 43.176; M = 129.528; Fb = 129.528/1.285 = 100.8
  //   W = 141.12 kN -> 14112 kg; ballast = 14112 - 740x7 = 8932 kg -> ceil(8932/1100) = 9
  const u = clad(seven(Array(7).fill(6)));
  ok(u.legs.length === 8, `uniform: 8 leg lines (got ${u.legs.length})`);
  ok(u.ballastKg === 8932 && u.blocks.concrete === 9,
     `uniform 7-bay 6 m: 8932 kg, 9 blocks (got ${u.ballastKg} kg, ${u.blocks.concrete})`);
  ok(u.detail.F === 43.18 && u.detail.W_req_kg === 14112 && u.detail.self_kg === 5180,
     'uniform: summed intermediates equal the whole-structure derivation');
  ok(u.stepped === false && !u.notes.some(n => n.includes('stepped builds')),
     'uniform: not stepped, no stepped caveat');
  // Legacy single structureHeight -> identical result (every bay takes it).
  const legacyState = { ...seven(undefined), structureHeight: 6 };
  delete legacyState.bayHeights;
  const l = clad(legacyState);
  ok(l.ballastKg === u.ballastKg && l.blocks.concrete === u.blocks.concrete && l.assumptions === u.assumptions,
     'legacy structureHeight state gives the identical per-leg sum');

  // (b) STEPPED acceptance case: 2/4/6/8/6/4/2 lifts -> 4/8/12/16/12/8/4 m.
  // Leg heights [4,8,12,16,16,12,8,4]. Interior legs: share = 2.57/17.99 = 1/7 ->
  // face width 2.57 = L_short, so W_kg = 1.4 x 0.4 x H^2 x 100 = 56·H^2; self 740.
  // End legs: share 1/14 -> 28·H^2, self 370.
  //   H=4 end:  28x16  = 448  - 370 = 78
  //   H=8:      56x64  = 3584 - 740 = 2844
  //   H=12:     56x144 = 8064 - 740 = 7324
  //   H=16:     56x256 = 14336 - 740 = 13596
  //   total = 2 x (78 + 2844 + 7324 + 13596) = 47684 kg -> ceil(47684/1100) = 44 blocks
  const s = clad(seven([4, 8, 12, 16, 12, 8, 4]));
  ok(s.stepped === true, 'stepped: flag set');
  ok(s.legs.map(x => x.H).join(',') === '4,8,12,16,16,12,8,4',
     `stepped: per-leg heights follow the taller-neighbour rule (got ${s.legs.map(x => x.H).join(',')})`);
  ok(s.legs.map(x => x.ballastKg).join(',') === '78,2844,7324,13596,13596,7324,2844,78',
     `stepped: per-leg kg 78/2844/7324/13596 mirrored (got ${s.legs.map(x => x.ballastKg).join(',')})`);
  ok(s.ballastKg === 47684 && s.blocks.concrete === 44,
     `stepped: summed 47684 kg, 44 blocks (got ${s.ballastKg} kg, ${s.blocks.concrete})`);
  ok(s.notes[0] === 'Clad ballast figures assume a uniform structure; stepped builds need engineer confirmation.',
     'stepped: ballast caveat is the FIRST note');
  ok(s.notes.some(n => n.includes('Above the validated')),
     'stepped: height-triggered caveat keys off the TALLEST bay (16 m > 7.5 m)');
  ok(s.assumptions.includes('per leg line') && s.assumptions.includes('tallest 16m'),
     'stepped: assumptions readout lists per-leg heights and the tallest bay');
  ok(s.geom.H === 16 && s.geom.bayHeights.length === 7, 'stepped: geom carries tallest H + bay heights');

  // (c) Skeleton lane per leg on the reference tower: two legs, same H, half
  // the table figure each (H=3.25 -> 137.5 kg total -> 68.75 per leg -> round0 69).
  const sk2 = computeBallast(refTower(3.25), { cladding: 'skeleton', exposure: 'sheltered_inland' });
  ok(sk2.legs.length === 2 && sk2.legs.every(x => x.H === 3.25 && x.ballastKg === 69) && sk2.ballastKg === 138,
     `skeleton per-leg: 2 x 69 kg -> 138 kg (got ${JSON.stringify(sk2.legs)}, ${sk2.ballastKg})`);
  // A stepped skeleton run is multi-bay -> off-table (no figure) but still flagged stepped + caveated.
  const sks = computeBallast(seven([4, 8, 12, 16, 12, 8, 4]), { cladding: 'skeleton', exposure: 'sheltered_inland' });
  ok(sks.outOfTable === true && sks.ballastKg === null && sks.stepped === true &&
     sks.notes[0].includes('stepped builds'),
     'skeleton stepped: off-table (multi-bay), stepped caveat still shown');
}

done();
