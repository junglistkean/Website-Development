// Ballast estimator — pure functions, no React, no side effects.
//
// INDICATIVE tonnage + block count for quotation and logistics only. NOT a structural
// design. Two lanes, gated by cladding (see computeBallast):
//   skeleton → Layher type-tested open-tower table (lookup + interpolation on height)
//   clad     → overturning method with Raven engineer-derived coefficients
//
// PER-LEG-LINE (per-bay heights, Sep 2026): the structure is sliced at every leg
// line (standard column line). Each leg line takes ITS OWN height (the taller of
// its two neighbouring bays) and a tributary share of the plan — half of each
// adjacent bay's length for the wind face, half of each adjacent bay (× rows) for
// self-weight. The chosen lane runs on every slice and the per-leg results are
// SUMMED for the totals. For a uniform structure the slices are proportional and
// the sum reproduces the whole-structure figure exactly; for a stepped structure
// it is an indicative decomposition only (see STEPPED_CAVEATS[1]).
//
// Read-only: takes a snapshot of geometry + the two selectors, returns a plain result
// object for the panel to render. Writes nothing.

import {
  CLADDING_OPTIONS, EXPOSURE_STEPUP, CLAD, BLOCK, LAYHER_OPEN_TOWER,
} from '../constants/ballast.js'; // explicit .js so Node ESM (the offline tests) resolves it too
import {
  resolveBayHeights, standardHeights, maxBayHeight, isStepped, STEPPED_CAVEATS,
} from './scaffoldGeometry.js';

const laneFor = (claddingId) =>
  (CLADDING_OPTIONS.find(o => o.id === claddingId)?.lane) ?? 'clad';

// Clear float-accumulation noise from a summed kg figure before rounding/ceiling.
const cleanKg = (kg) => Math.round(kg * 1e6) / 1e6;

// kg → whole ballast blocks of the given tonnage, always rounded UP.
const kgToBlocks = (kg, blockTonnes) =>
  kg > 0 ? Math.ceil(cleanKg(kg) / (blockTonnes * 1000)) : 0;

const round0  = (n) => Math.round(cleanKg(n));
const round2  = (n) => Math.round(n * 100) / 100;

// ─── Leg-line slices ─────────────────────────────────────────────────────────
// One slice per standard column line (gridCols + 1). `share` is the leg's
// tributary fraction of the run (Σ bay lengths); `nBays` its tributary bay count.
function legSlices(bayLengths, bayHeights, gridRows) {
  const legH = standardHeights(bayHeights);
  const run  = bayLengths.reduce((s, l) => s + l, 0);
  const out  = [];
  for (let c = 0; c < legH.length; c++) {
    const left  = bayLengths[c - 1];
    const right = bayLengths[c];
    const tribLen  = (left ?? 0) / 2 + (right ?? 0) / 2;
    const tribBays = ((left !== undefined ? 1 : 0) + (right !== undefined ? 1 : 0)) / 2;
    out.push({
      index: c,
      H: legH[c],
      share: run > 0 ? tribLen / run : 0,
      nBays: gridRows * tribBays,
    });
  }
  return out;
}

// ─── Skeleton lane: Layher open-tower table, interpolated on height ───────────
// A skeleton figure is only produced for the SINGLE 2.57m-bay / no-cantilever reference
// tower the Layher table describes. Any other geometry (multi-bay, non-2.57m) OR a height
// above the table → a hard stop: amber, no figure (same treatment as > 6.25m).
function skeletonNoFigure(flagWording, assumptions, citation, legs) {
  return {
    lane: 'skeleton',
    outOfTable: true,
    ballastKg: null,
    blocks: { concrete: 0, water: 0 },
    waterAlt: null,
    confidence: 'amber',
    flagLabel: 'Off-table — bespoke',
    flagWording,
    notes: [],
    assumptions,
    citation,
    legs,
  };
}

function skeletonTableKg(H) {
  const { rows, V1_BAY_WIDTH, V1_CANTILEVER, MIN_HEIGHT } = LAYHER_OPEN_TOWER;
  const pts = rows.map(r => ({ h: r.h, kg: r.a[V1_BAY_WIDTH][V1_CANTILEVER] }));
  // Interpolate (clamp below the table floor to the 2.25 m row = 0 kg).
  if (H <= MIN_HEIGHT) return pts[0].kg;
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i], b = pts[i + 1];
    if (H <= b.h + 1e-9) return a.kg + (b.kg - a.kg) * ((H - a.h) / (b.h - a.h));
  }
  return pts[pts.length - 1].kg;
}

function skeletonLane({ slices, maxH, isReferenceTower }) {
  const { V1_BAY_WIDTH, MAX_HEIGHT, WATER_OFFER_MAX_HEIGHT, citation } = LAYHER_OPEN_TOWER;

  const assumptions =
    `Layher ${V1_BAY_WIDTH}m-bay / no-cantilever reference tower, interpolated on height; ` +
    `exposure band not applied (fixed "in the open" value)`;

  const legsNoFigure = slices.map(s => ({ index: s.index, H: s.H, share: round2(s.share), ballastKg: null }));

  // Hard stops — no figure. Height stop keys off the TALLEST leg.
  if (maxH > MAX_HEIGHT + 1e-9) {
    return skeletonNoFigure(
      `Beyond the validated Layher open-tower table (${MAX_HEIGHT} m) — bespoke, engineer's ` +
      `ballast calc required. No estimate given.`,
      assumptions, citation, legsNoFigure);
  }
  if (!isReferenceTower) {
    return skeletonNoFigure(
      `Off-table — not the single ${V1_BAY_WIDTH}m-bay reference tower (multi-bay or non-` +
      `${V1_BAY_WIDTH}m geometry). Bespoke, engineer's ballast calc required. No estimate given.`,
      assumptions, citation, legsNoFigure);
  }

  // Per leg: table figure at the leg's own height × its tributary share; summed.
  const legs = slices.map(s => {
    const kg = skeletonTableKg(s.H) * s.share;
    return { index: s.index, H: s.H, share: round2(s.share), ballastKg: round0(kg), rawKg: kg };
  });
  const kg = legs.reduce((sum, l) => sum + l.rawKg, 0);
  for (const l of legs) delete l.rawKg;

  // Default ballast type is concrete (1.1T). Water (1.0T) is offered as an alternative
  // only on the low reference case (≤ 4.25 m), where uplift is not a concern.
  const concrete   = kgToBlocks(kg, BLOCK.CONCRETE_T);
  const offerWater = maxH <= WATER_OFFER_MAX_HEIGHT + 1e-9;
  const waterAlt   = offerWater ? kgToBlocks(kg, BLOCK.WATER_T) : null;

  return {
    lane: 'skeleton',
    outOfTable: false,
    ballastKg: round0(kg),
    blocks: { concrete, water: 0 },
    waterAlt,
    confidence: 'green',
    flagLabel: 'Indicative estimate',
    flagWording: 'Indicative estimate from Layher’s type-tested open-tower ballast table.',
    notes: [],
    assumptions,
    citation,
    legs,
  };
}

// ─── Clad lane: overturning method (CampbellReith 13994-81) ───────────────────
// One slice of the structure: wind on a solid face `faceWidth` wide and `H` tall,
// overturning about a lever of half the short plan dimension, self-weight of
// `nBays` tributary bays credited.
function cladSlice({ H, faceWidth, L_short, nBays, q }) {
  const F         = q * H * faceWidth;                    // kN  (full solid clad face)
  const M_ot      = F * (H / 2);                          // kNm (centre of pressure at mid-height)
  const Fb        = M_ot / (L_short / 2);                 // kN  (restoring lever = half the short base dim)
  const W_req     = CLAD.FOS_OVERTURN * Fb;               // kN
  const W_req_kg  = W_req * CLAD.KN_TO_KG;                // kg
  const self_kg   = CLAD.SELFWEIGHT_PER_BAY * nBays;      // kg
  const ballastKg = Math.max(0, W_req_kg - self_kg);      // kg
  return { F, M_ot, Fb, W_req, W_req_kg, self_kg, ballastKg };
}

function cladLane({ slices, maxH, L_long, L_short, N_bays, exposureId }) {
  const stepup = EXPOSURE_STEPUP[exposureId] ?? 1.0;
  const q      = CLAD.Q_NET_BASELINE * stepup;            // kN/m²

  // Per leg line: the leg's own height, its tributary share of the wind face
  // (L_long × share) and of the self-weight (tributary bays). Summed.
  const legs = slices.map(s => {
    const r = cladSlice({ H: s.H, faceWidth: L_long * s.share, L_short, nBays: s.nBays, q });
    return { index: s.index, H: s.H, share: round2(s.share), ballastKg: round0(r.ballastKg), raw: r };
  });
  const sum = key => legs.reduce((t, l) => t + l.raw[key], 0);
  const F = sum('F'), M_ot = sum('M_ot'), Fb = sum('Fb'), W_req = sum('W_req');
  const W_req_kg = sum('W_req_kg'), self_kg = sum('self_kg'), ballastKg = sum('ballastKg');
  for (const l of legs) delete l.raw;

  const concrete = kgToBlocks(ballastKg, BLOCK.CONCRETE_T);

  const notes = [
    'Uplift-critical — water ballast not permitted; concrete kentledge, tied down (ratchet straps @ 4 corners) required.',
    'Sliding resistance is a secondary check confirmed in the engineer’s report, not by this estimate.',
  ];
  // Height-triggered caveat keys off the TALLEST bay.
  if (maxH > CLAD.VALIDATED_HEIGHT + 1e-9) {
    notes.unshift(
      `Above the validated engineered example (${CLAD.VALIDATED_HEIGHT} m) — treat with extra caution.`
    );
  }

  const hText = slices.every(s => Math.abs(s.H - maxH) < 1e-9)
    ? `H=${round2(maxH)}m`
    : `H=${slices.map(s => round2(s.H)).join('/')}m per leg line (tallest ${round2(maxH)}m)`;
  const assumptions =
    `${hText}, L_long=${round2(L_long)}m, L_short=${round2(L_short)}m, N_bays=${N_bays}, ` +
    `q=${round2(q)} kN/m² (baseline ${CLAD.Q_NET_BASELINE} × exposure ${stepup}), ` +
    `FOS ${CLAD.FOS_OVERTURN}, self-weight ${round0(self_kg)}kg credited (${CLAD.SELFWEIGHT_PER_BAY}kg × ${N_bays} bay)`;

  return {
    lane: 'clad',
    outOfTable: false,
    ballastKg: round0(ballastKg),
    blocks: { concrete, water: 0 },
    confidence: 'amber',
    flagLabel: 'Indicative — clad/bespoke',
    flagWording: 'Indicative — clad/bespoke, engineer sign-off required.',
    notes,
    assumptions,
    legs,
    // Intermediate engineering (summed over leg lines), for the assumptions readout.
    detail: { q: round2(q), F: round2(F), M_ot: round2(M_ot), Fb: round2(Fb),
              W_req: round2(W_req), W_req_kg: round0(W_req_kg), self_kg: round0(self_kg),
              ballastKg: round0(ballastKg) },
  };
}

const CLAD_DISCLAIMER =
  'Estimate for quotation and logistics only. Calculated by the overturning method and ' +
  'coefficients from Raven’s engineer’s report (CampbellReith 13994-81), applied to this ' +
  'layout’s geometry. Not a structural design and not a substitute for a project-specific ' +
  'chartered engineer’s ballast calculation, sign-off certificate, or site-specific wind ' +
  'assessment. Confirm with an engineer before build.';

const SKELETON_DISCLAIMER =
  'Estimate for quotation and logistics only. Read from Layher’s type-tested free-standing ' +
  'tower ballast tables (Allround Technical Brochure 04.2017, “in the open”), interpolated ' +
  'on height. Not a structural design and not a substitute for a project-specific chartered ' +
  'engineer’s ballast calculation, sign-off certificate, or site-specific wind assessment. ' +
  'Confirm with an engineer before build.';

// ─── Public entry ────────────────────────────────────────────────────────────
export function computeBallast(state, { cladding, exposure }) {
  const {
    bayLengths = [],
    bayWidth = 2.57,
    gridCols = 1,
    gridRows = 1,
  } = state;

  // Per-bay heights (accepts the legacy single structureHeight — every bay takes it).
  const bayHeights = resolveBayHeights({ gridCols, ...state });
  const maxH       = maxBayHeight(bayHeights);
  const stepped    = isStepped(bayHeights);
  const slices     = legSlices(bayLengths.slice(0, gridCols), bayHeights, gridRows);

  const dimRun   = bayLengths.reduce((s, l) => s + l, 0); // total across columns (Σ bay lengths)
  const dimDepth = gridRows * bayWidth;                    // total depth
  const L_long   = round2(Math.max(dimRun, dimDepth));
  const L_short  = round2(Math.min(dimRun, dimDepth));
  const N_bays   = gridCols * gridRows;

  // The skeleton lane only produces a figure for the single 2.57m-bay / no-cantilever
  // reference tower the Layher table describes (one bay, both plan dims = 2.57 m).
  const REF = LAYHER_OPEN_TOWER.V1_BAY_WIDTH;
  const isReferenceTower =
    gridCols === 1 && gridRows === 1 &&
    Math.abs(bayWidth - REF) < 1e-9 &&
    bayLengths.length === 1 && Math.abs(bayLengths[0] - REF) < 1e-9;

  const lane = laneFor(cladding);

  const geom = { H: maxH, bayHeights, L_long, L_short, N_bays, bayWidth };

  const result = lane === 'skeleton'
    ? skeletonLane({ slices, maxH, isReferenceTower })
    : cladLane({ slices, maxH, L_long, L_short, N_bays, exposureId: exposure });

  // Stepped-structure caveat rides with every output when heights differ.
  const notes = stepped ? [STEPPED_CAVEATS[1], ...result.notes] : result.notes;

  return {
    ...result,
    notes,
    stepped,
    cladding,
    exposure,
    geom,
    disclaimer: lane === 'skeleton' ? SKELETON_DISCLAIMER : CLAD_DISCLAIMER,
  };
}
