// Ballast estimator — pure functions, no React, no side effects.
//
// INDICATIVE tonnage + block count for quotation and logistics only. NOT a structural
// design. Two lanes, gated by cladding (see computeBallast):
//   skeleton → Layher type-tested open-tower table (lookup + interpolation on height)
//   clad     → overturning method with Raven engineer-derived coefficients
//
// Read-only: takes a snapshot of geometry + the two selectors, returns a plain result
// object for the panel to render. Writes nothing.

import {
  CLADDING_OPTIONS, EXPOSURE_STEPUP, CLAD, BLOCK, LAYHER_OPEN_TOWER,
} from '../constants/ballast';

const laneFor = (claddingId) =>
  (CLADDING_OPTIONS.find(o => o.id === claddingId)?.lane) ?? 'clad';

// kg → whole ballast blocks of the given tonnage, always rounded UP.
const kgToBlocks = (kg, blockTonnes) =>
  kg > 0 ? Math.ceil(kg / (blockTonnes * 1000)) : 0;

const round0  = (n) => Math.round(n);
const round2  = (n) => Math.round(n * 100) / 100;

// ─── Skeleton lane: Layher open-tower table, interpolated on height ───────────
function skeletonLane({ H, N_bays, bayWidth }) {
  const { rows, V1_BAY_WIDTH, V1_CANTILEVER, MIN_HEIGHT, MAX_HEIGHT, citation } = LAYHER_OPEN_TOWER;

  // The three reference points for the a=2.57m / k=0 open tower.
  const pts = rows.map(r => ({ h: r.h, kg: r.a[V1_BAY_WIDTH][V1_CANTILEVER] }));

  const assumptions =
    `Layher ${V1_BAY_WIDTH}m-bay / no-cantilever open-tower table, interpolated on height; ` +
    `exposure band not applied (fixed "in the open" value)`;

  if (H > MAX_HEIGHT + 1e-9) {
    return {
      lane: 'skeleton',
      outOfTable: true,
      ballastKg: null,
      blocks: { concrete: 0, water: 0 },
      confidence: 'amber',
      flagLabel: 'Out of table',
      flagWording:
        `Beyond the validated Layher open-tower table (${MAX_HEIGHT} m) — an engineer's ballast ` +
        `calculation is required. No indicative figure produced.`,
      notes: [],
      assumptions,
      citation,
    };
  }

  // Interpolate (clamp below the table floor to the 2.25 m row = 0 kg).
  let kg;
  if (H <= MIN_HEIGHT) {
    kg = pts[0].kg;
  } else {
    for (let i = 0; i < pts.length - 1; i++) {
      const a = pts[i], b = pts[i + 1];
      if (H <= b.h + 1e-9) {
        kg = a.kg + (b.kg - a.kg) * ((H - a.h) / (b.h - a.h));
        break;
      }
    }
  }

  const water = kgToBlocks(kg, BLOCK.WATER_T);
  const notes = [
    `Water ballast (${BLOCK.WATER_T}T blocks) — open tower, not uplift-critical.`,
  ];
  // The table figure is Layher's single 2.57m-bay reference tower; larger skeleton rigs
  // are not proportionally scaled in v1 — flag it honestly.
  if (N_bays > 1 || Math.abs(bayWidth - V1_BAY_WIDTH) > 1e-9) {
    notes.push(
      `Figure is Layher's single ${V1_BAY_WIDTH}m-bay reference tower (height-driven). This ` +
      `layout is ${N_bays} bay(s) at ${bayWidth}m width — a larger or non-${V1_BAY_WIDTH}m skeleton ` +
      `structure may need proportionally more; confirm with an engineer.`
    );
  }

  return {
    lane: 'skeleton',
    outOfTable: false,
    ballastKg: round0(kg),
    blocks: { concrete: 0, water },
    confidence: 'green',
    flagLabel: 'Indicative estimate',
    flagWording: 'Indicative estimate from Layher’s type-tested open-tower ballast table.',
    notes,
    assumptions,
    citation,
  };
}

// ─── Clad lane: overturning method (CampbellReith 13994-81) ───────────────────
function cladLane({ H, L_long, L_short, N_bays, exposureId }) {
  const stepup = EXPOSURE_STEPUP[exposureId] ?? 1.0;

  const q         = CLAD.Q_NET_BASELINE * stepup;        // kN/m²
  const F         = q * H * L_long;                       // kN  (full solid clad face)
  const M_ot      = F * (H / 2);                          // kNm (centre of pressure at mid-height)
  const Fb        = M_ot / (L_short / 2);                 // kN  (restoring lever = half the short base dim)
  const W_req     = CLAD.FOS_OVERTURN * Fb;               // kN
  const W_req_kg  = W_req * CLAD.KN_TO_KG;                // kg
  const self_kg   = CLAD.SELFWEIGHT_PER_BAY * N_bays;     // kg
  const ballastKg = Math.max(0, W_req_kg - self_kg);      // kg

  const concrete = kgToBlocks(ballastKg, BLOCK.CONCRETE_T);

  const notes = [
    'Uplift-critical — water ballast not permitted; concrete kentledge, tied down (ratchet straps @ 4 corners) required.',
    'Sliding resistance is a secondary check confirmed in the engineer’s report, not by this estimate.',
  ];
  if (H > CLAD.VALIDATED_HEIGHT + 1e-9) {
    notes.unshift(
      `Above the validated engineered example (${CLAD.VALIDATED_HEIGHT} m) — treat with extra caution.`
    );
  }

  const assumptions =
    `H=${round2(H)}m, L_long=${round2(L_long)}m, L_short=${round2(L_short)}m, N_bays=${N_bays}, ` +
    `q=${round2(q)} kN/m² (baseline ${CLAD.Q_NET_BASELINE} × exposure ${stepup}), ` +
    `FOS ${CLAD.FOS_OVERTURN}, self-weight ${self_kg}kg credited (${CLAD.SELFWEIGHT_PER_BAY}kg × ${N_bays} bay)`;

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
    // Intermediate engineering, for the assumptions readout.
    detail: { q: round2(q), F: round2(F), M_ot: round2(M_ot), Fb: round2(Fb),
              W_req: round2(W_req), W_req_kg: round0(W_req_kg), self_kg, ballastKg: round0(ballastKg) },
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
    structureHeight: H = 0,
    bayLengths = [],
    bayWidth = 2.57,
    gridCols = 1,
    gridRows = 1,
  } = state;

  const dimRun   = bayLengths.reduce((s, l) => s + l, 0); // total across columns (Σ bay lengths)
  const dimDepth = gridRows * bayWidth;                    // total depth
  const L_long   = round2(Math.max(dimRun, dimDepth));
  const L_short  = round2(Math.min(dimRun, dimDepth));
  const N_bays   = gridCols * gridRows;

  const lane = laneFor(cladding);

  const geom = { H, L_long, L_short, N_bays, bayWidth };

  const result = lane === 'skeleton'
    ? skeletonLane({ H, N_bays, bayWidth })
    : cladLane({ H, L_long, L_short, N_bays, exposureId: exposure });

  return {
    ...result,
    cladding,
    exposure,
    geom,
    disclaimer: lane === 'skeleton' ? SKELETON_DISCLAIMER : CLAD_DISCLAIMER,
  };
}
