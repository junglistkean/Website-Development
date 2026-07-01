// Ballast estimator constants — Raven Staging scaffold planner.
//
// TWO LANES, gated by the cladding selector (see the lane router in utils/ballast.js):
//   Skeleton                     → SKELETON LANE: Layher's type-tested open-tower
//                                  ballast table (lookup + linear interpolation on height).
//   Part-clad / scrim / fully-clad → CLAD LANE: overturning method with Raven's own
//                                  engineer-derived coefficients.
//
// EVERYTHING BELOW IS AN ESTIMATION BASELINE — tunable, NOT engineer-sanctioned for a
// specific build. These values are printed on every ballast output so the source is auditable.

// ─── Cladding gate (lane router) ─────────────────────────────────────────────
// Each clad variant collapses to the SAME clad-lane calc in v1 (full solid face — no
// permeable/part-clad area reduction yet; that is v-next). The distinction is carried
// for the UI and for future refinement. "Banner" is folded into fully-clad for now;
// high-mounted banner (raised centre of pressure) is also v-next.
export const CLADDING_OPTIONS = [
  { id: 'skeleton',   label: 'Skeleton (open)',     lane: 'skeleton' },
  { id: 'part_clad',  label: 'Part-clad / scrim',   lane: 'clad' },
  { id: 'fully_clad', label: 'Fully clad / banner', lane: 'clad' },
];

// ─── Exposure band (CLAD LANE ONLY) ──────────────────────────────────────────
// The skeleton lane reads a fixed Layher "in the open" table value, so exposure does
// not apply there. In the clad lane this multiplies the baseline net pressure q.
//
// PROVENANCE / SAFETY: `Q_NET_BASELINE` (0.40, below) is engineer-sourced (CampbellReith).
// These step-up multipliers are NOT — they are conservative brackets, NOT engineer-signed.
// Exposed-coastal / peak-summer clad jobs should get an engineer involved EARLY rather than
// lean on this estimate.
export const EXPOSURE_OPTIONS = [
  { id: 'sheltered_inland',       label: 'Sheltered / inland' },
  { id: 'open_summer',            label: 'Open country' },
  { id: 'exposed_coastal_upland', label: 'Exposed coastal / upland' },
];
export const EXPOSURE_STEPUP = {
  sheltered_inland: 1.0,   // engineer's validated case
  open_summer: 1.25,       // conservative bracket — not engineer-signed
  exposed_coastal_upland: 1.5, // conservative bracket — not engineer-signed
};

// ─── Clad-lane coefficients ──────────────────────────────────────────────────
// Source: CampbellReith report "Projection Scaffold Tower Wind & Ballast Design
// Calculations" (ref 13994-81, 07.12.2023) — Raven's own commissioned report.
// Engineer-sourced baseline, tunable. Reproduces the report's worked example (H=7.5m,
// L=2.5m) when applied to that geometry.
export const CLAD = {
  // Net face pressure = 1.2 (shape) × 0.34 (gross) kN/m²; inland Bradford, cool-season
  // de-rig wind @ 18 m/s (40 mph).
  Q_NET_BASELINE: 0.40,   // kN/m²
  FOS_OVERTURN: 1.4,
  // Engineer's itemised clad 2.5 m bay = 826 kg, taken × 0.9 haircut. INCLUDES cladding,
  // boards and roof ply. Credited per bay (gridCols × gridRows).
  SELFWEIGHT_PER_BAY: 740, // kg
  // Engineer's convention: 1 kN ≈ 100 kg. Reproduces his figures; the ~2% vs 9.81 is
  // absorbed by the whole-block round-up.
  KN_TO_KG: 100,
  // Above the validated engineered example — flag extra caution beyond this height.
  VALIDATED_HEIGHT: 7.5,   // m
};

// ─── Ballast block sizes ─────────────────────────────────────────────────────
export const BLOCK = {
  CONCRETE_T: 1.1,  // concrete kentledge — used tied-down in the clad (uplift-critical) lane
  WATER_T: 1.0,     // water ballast — used in the skeleton (non-uplift) lane only
};

// ─── Layher open-tower ballast table (SKELETON LANE) ─────────────────────────
// Transcribed from: Layher Allround Technical Brochure 04.2017, Tab.44–46, "IN THE OPEN"
// column, STEEL (K) rows only (Raven stocks steel; aluminium (A) rows and the "in closed
// areas" indoor column are omitted from v1). Bay length L = 2.57 m throughout.
// Structure: platform height → system width a (m) → cantilever k (m) → ballast (kg).
//
// v1 SKELETON LANE fixes the lookup to a = 2.57 m, k = 0 (the only published NO-cantilever
// row) and interpolates linearly on platform height. The wider table is transcribed in full
// for provenance and future extension (cantilevered / narrower towers).
export const LAYHER_OPEN_TOWER = {
  citation:
    'Layher Allround Technical Brochure 04.2017, Tab.44–46 (IN THE OPEN, steel K rows), bay length 2.57 m',
  rows: [
    { h: 2.25, a: { 1.57: { 0.39: 370,  0.73: 490  }, 2.07: { 0.39: 100,  0.73: 190  }, 2.57: { 0: 0,    0.39: 0,    0.73: 0    } } },
    { h: 4.25, a: { 1.57: { 0.39: 1400, 0.73: 1515 }, 2.07: { 0.39: 745,  0.73: 835  }, 2.57: { 0: 275,  0.39: 330,  0.73: 405  } } },
    { h: 6.25, a: { 1.57: { 0.39: 2980, 0.73: 3095 }, 2.07: { 0.39: 1880, 0.73: 1970 }, 2.57: { 0: 1150, 0.39: 1200, 0.73: 1270 } } },
  ],
  V1_BAY_WIDTH: 2.57,        // a — the reference open tower width used in v1
  V1_CANTILEVER: 0,          // k — no cantilever
  MIN_HEIGHT: 2.25,          // table floor (below → 0 kg)
  MAX_HEIGHT: 6.25,          // table ceiling (above → out-of-table, engineer required)
  WATER_OFFER_MAX_HEIGHT: 4.25, // ≤ this height, 1.0T water is offered as an alternative to concrete
};
