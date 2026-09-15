const NODE_STEP = 0.5;
export const MAX_LIFT_GAP = 2.0;
const LEDGER_SPACING = 1.0;

// Bay heights are STORED, ENTERED and DISPLAYED in metres at 0.5 m node
// resolution. The 2 m Layher lift is an internal counting concept only (bracing
// lifts, per-lift ledger counts) — it never appears in an input or label.
export const MIN_BAY_HEIGHT = 0.5;
export const MAX_BAY_HEIGHT = 30;

// Snap a height in metres to a 0.5 m node inside [MIN, MAX].
export function clampBayHeight(m) {
  const snapped = Math.round(m * 2) / 2;
  return Math.min(MAX_BAY_HEIGHT, Math.max(MIN_BAY_HEIGHT, snapped));
}

// ─── Per-bay heights ──────────────────────────────────────────────────────────
// Heights are per COLUMN (one entry per bay along the run, like bayLengths) and
// apply to every row in that column. A standard (leg) line sits between two
// adjacent columns: its height is the TALLER of the two; end legs take their
// single bay's height.

// Always returns an array of exactly gridCols heights. Accepts the legacy
// single `structureHeight` (pre-per-bay saves, old test fixtures) as a fallback
// so every bay takes that height.
export function resolveBayHeights(state) {
  const cols = Math.max(1, state.gridCols ?? 1);
  const src  = Array.isArray(state.bayHeights) ? state.bayHeights : [];
  const legacy = typeof state.structureHeight === 'number' && isFinite(state.structureHeight)
    ? state.structureHeight : null;
  const out = [];
  for (let c = 0; c < cols; c++) {
    const v = src[c];
    if (typeof v === 'number' && isFinite(v) && v > 0) out.push(v);
    else if (out.length > 0)                            out.push(out[out.length - 1]);
    else                                                out.push(legacy ?? 4.0);
  }
  return out;
}

export function maxBayHeight(bayHeights) {
  return bayHeights.length ? Math.max(...bayHeights) : 0;
}

export function isStepped(bayHeights) {
  return bayHeights.some(h => Math.abs(h - bayHeights[0]) > 1e-9);
}

// Displayed with the BOM, the ballast estimate and the quote notes whenever bay
// heights are not all equal. Wording is fixed by the per-bay-heights handover.
// [0] = bracing/ties caveat (BOM), [1] = ballast caveat (BOM + ballast panel).
export const STEPPED_CAVEATS = [
  'Stepped structure: exposed faces at height changes require additional bracing/ties — engineer\'s check required.',
  'Clad ballast figures assume a uniform structure; stepped builds need engineer confirmation.',
];

// Human label for the status bar / quote naming: "4m" or "4–16m stepped".
export function describeHeights(bayHeights) {
  if (!bayHeights.length) return '?';
  const lo = Math.min(...bayHeights), hi = Math.max(...bayHeights);
  if (!isStepped(bayHeights)) return `${hi}m`;
  return `${lo}–${hi}m stepped`;
}

// Leg-line heights: gridCols + 1 entries, taller-neighbour rule.
export function standardHeights(bayHeights) {
  const out = [];
  for (let c = 0; c <= bayHeights.length; c++) {
    const left  = bayHeights[c - 1];
    const right = bayHeights[c];
    out.push(Math.max(left ?? 0, right ?? 0));
  }
  return out;
}

// Height of the bay a face-ledger/brace belongs to. Front/back bays index by
// column; the left/right faces are the end columns, so every row bay on them
// takes that column's height.
export function faceBayHeight(face, bayIndex, bayHeights, gridCols = bayHeights.length) {
  if (face === 'front' || face === 'back') {
    return bayHeights[bayIndex] ?? bayHeights[bayHeights.length - 1] ?? 0;
  }
  if (face === 'left') return bayHeights[0] ?? 0;
  return bayHeights[gridCols - 1] ?? bayHeights[bayHeights.length - 1] ?? 0; // right
}

export function getLedgerHeights(structureHeight, deckLevels = []) {
  // Seed all fixed positions: ground (0), top, and each deck level
  const fixed = new Set([0, Math.round(structureHeight * 100) / 100]);
  for (const h of deckLevels) {
    const snapped = Math.round(h * 100) / 100;
    if (snapped > 0 && snapped <= structureHeight) fixed.add(snapped);
  }

  const seeds = Array.from(fixed).sort((a, b) => a - b);

  // Walk adjacent pairs; fill any gap >1m with equal sections, snap to 0.5m nodes
  const filled = [...seeds];
  for (let i = 0; i < seeds.length - 1; i++) {
    const gap = seeds[i + 1] - seeds[i];
    if (gap > LEDGER_SPACING + 1e-9) {
      const n = Math.ceil(gap / LEDGER_SPACING);
      for (let j = 1; j < n; j++) {
        const raw     = seeds[i] + (gap * j) / n;
        const snapped = Math.round(raw / NODE_STEP) * NODE_STEP;
        filled.push(Math.round(snapped * 100) / 100);
      }
    }
  }

  // Deduplicate and sort after snapping
  const deduped = Array.from(new Set(filled)).sort((a, b) => a - b);

  // Safety pass: if snapping created any gap >2m, insert the midpoint node
  const safe = [deduped[0]];
  for (let i = 1; i < deduped.length; i++) {
    const gap = deduped[i] - safe[safe.length - 1];
    if (gap > MAX_LIFT_GAP + 1e-9) {
      const mid = Math.round((safe[safe.length - 1] + deduped[i]) / 2 / NODE_STEP) * NODE_STEP;
      safe.push(Math.round(mid * 100) / 100);
    }
    safe.push(deduped[i]);
  }

  // Strip ground — ledgers don't exist at 0
  return safe.filter(h => h > 1e-9);
}

// Ledger heights for every face-bay, keyed `${face}-${bayIndex}`. Each bay's
// list is derived from ITS OWN height, so a ledger at a given lift exists only
// in bays whose height reaches that lift.
export function getFaceLedgerHeights(bayColumns, bayRows, bayHeights, deckLevels = []) {
  const out = {};
  const cache = {};
  for (const face of ['front', 'back', 'left', 'right']) {
    const count = (face === 'left' || face === 'right') ? bayRows : bayColumns;
    for (let bi = 0; bi < count; bi++) {
      const h = faceBayHeight(face, bi, bayHeights, bayColumns);
      cache[h] ??= getLedgerHeights(h, deckLevels);
      out[`${face}-${bi}`] = cache[h];
    }
  }
  return out;
}

// Returns effective top height for a whole face (of one bay of height bayH)
export function getEffectiveFaceTop(face, bayH, roofType) {
  if ((face === 'back' || face === 'left' || face === 'right') && roofType === 'monoPitch') return bayH - 0.5;
  return bayH;
}

// Returns effective top height for a specific standard column on a side face
export function getStandardTopForColumn(face, colIndex, totalCols, bayH, roofType) {
  if ((face === 'left' || face === 'right') && roofType === 'monoPitch' && colIndex === totalCols - 1) {
    return bayH - 0.5;
  }
  return getEffectiveFaceTop(face, bayH, roofType);
}

export function getAutoLedgers(bayColumns, bayRows, bayHeights, deckLevels = [], roofType = null) {
  const faces = ['front', 'back', 'left', 'right'];
  const perBay = getFaceLedgerHeights(bayColumns, bayRows, bayHeights, deckLevels);
  return faces.flatMap(face => {
    const count = (face === 'left' || face === 'right') ? bayRows : bayColumns;
    const out = [];
    for (let i = 0; i < count; i++) {
      const bayH = faceBayHeight(face, i, bayHeights, bayColumns);
      let heights = perBay[`${face}-${i}`];

      // Side faces on mono-pitch: guarantee ledger at rear standard top (bayH - 0.5)
      if ((face === 'left' || face === 'right') && roofType === 'monoPitch') {
        const rearTop = Math.round((bayH - 0.5) * 100) / 100;
        if (!heights.includes(rearTop)) {
          heights = [...heights, rearTop].sort((a, b) => a - b);
        }
      }

      const faceTop = getEffectiveFaceTop(face, bayH, roofType);
      for (const h of heights) {
        if (h <= faceTop) out.push({ face, bayIndex: i, height: h, key: `${face}-${i}-${h}` });
      }
    }
    return out;
  });
}

export function getAutoLedgersWithOverrides(bayColumns, bayRows, bayHeights, deckLevels = [], ledgerOverrides = {}, roofType = null) {
  const { removed = [], added = [] } = ledgerOverrides;
  const removedSet = new Set(removed);
  const addedSet   = new Set(added);

  const autoLedgers = getAutoLedgers(bayColumns, bayRows, bayHeights, deckLevels, roofType);
  const autoKeys    = new Set(autoLedgers.map(l => l.key));

  const ledgers = autoLedgers.filter(l => !removedSet.has(l.key));

  // Manual additions not in auto set
  for (const key of addedSet) {
    if (!autoKeys.has(key)) {
      const parts    = key.split('-');
      const face     = parts[0];
      const bayIndex = Number(parts[1]);
      const height   = Number(parts.slice(2).join('-'));
      ledgers.push({ face, bayIndex, height, key });
    }
  }

  return { ledgers, removedCount: removed.length };
}

// Bracing lifts at MAX_LIFT_GAP (2m) intervals up a bay of height bayH,
// decoupled from 1m ledger spacing. The last entry is the bay top (a sub-2m
// remainder when bayH is not a multiple of 2m).
function bracingHeightsFor(bayH) {
  const out = [];
  if (isFinite(bayH) && bayH > 0) {
    for (let h = MAX_LIFT_GAP; h < bayH - 1e-9; h = Math.round((h + MAX_LIFT_GAP) * 100) / 100) {
      out.push(h);
    }
    out.push(Math.round(bayH * 100) / 100);
  }
  return out;
}

// ─── Auto-bracing pattern (per face) ─────────────────────────────────────────
// { mode: 'alternating' | 'same', lean: 'L' | 'R' } per face. Alternating is the
// default (direction mirrors across adjacent bays and lifts); 'same' makes every
// auto brace on that face lean one way. Drawing preference only — keys, counts
// and the BOM are identical whichever pattern is chosen.
export const FACES = ['front', 'back', 'left', 'right'];
export const DEFAULT_FACE_PATTERN = { mode: 'alternating', lean: 'L' };
export function facePattern(pattern, face) {
  const p = pattern?.[face];
  return { mode: p?.mode === 'same' ? 'same' : 'alternating', lean: p?.lean === 'R' ? 'R' : 'L' };
}
function autoDirection(pattern, face, bi, liftIdx) {
  const p = facePattern(pattern, face);
  if (p.mode === 'same') return p.lean === 'R' ? '\\' : '/';
  return (bi + liftIdx) % 2 === 0 ? '/' : '\\';
}

// Openings: a removed ledger key `face-bay-h` marks an opening in that face-bay
// at height h. A brace whose lift [bottom, top] contains such a height (inclusive
// — its anchoring ledger/node is absent) is NOT generated: no bracing in or across
// an opening. No compensating bracing is added — that is engineer's work; the
// skipped positions are reported so a caveat can be shown.
function openingHeightsByBay(removedLedgerKeys = []) {
  const out = {};
  for (const key of removedLedgerKeys) {
    const parts = key.split('-');
    const h = Number(parts.slice(2).join('-'));
    if (!isFinite(h)) continue;
    (out[`${parts[0]}-${parts[1]}`] ??= []).push(h);
  }
  return out;
}

const BRACE_SPAN_M = MAX_LIFT_GAP; // 2.0 m (BRACE_SPAN below aliases it for callers)
const isBespokeSpan = (bottom, top) => Math.abs((top - bottom) - BRACE_SPAN_M) > 1e-9;

// opts: { pattern, removedLedgers } — see above. Returns { braces, openings }.
export function getAutoBracingDetail(bayColumns, bayRows, bayHeights, roofType = null, opts = {}) {
  const { pattern = null, removedLedgers = [] } = opts;
  const openingsByBay = openingHeightsByBay(removedLedgers);
  const braces = [];
  const openings = [];
  const pushLift = (face, bi, liftIdx, liftBottom, liftTop, faceTop) => {
    const dir = autoDirection(pattern, face, bi, liftIdx);
    let top = null;
    if (liftBottom < faceTop - 1e-9 && liftTop <= faceTop + 1e-9) top = liftTop;
    else if (liftBottom < faceTop - 1e-9 && liftTop > faceTop + 1e-9) top = Math.round(faceTop * 100) / 100;
    if (top === null) return;
    const brace = { face, bayIndex: bi, liftBottom, liftTop: top, direction: dir,
      bespoke: isBespokeSpan(liftBottom, top), key: `${face}-${bi}-${liftBottom}-${top}` };
    const holes = openingsByBay[`${face}-${bi}`];
    if (holes && holes.some(h => h >= liftBottom - 1e-9 && h <= top + 1e-9)) { openings.push(brace); return; }
    braces.push(brace);
  };

  // Front/Back: per column bay, lifts from that bay's own height; direction
  // mirrors across adjacent bays on each lift.
  for (let bi = 0; bi < bayColumns; bi++) {
    const bayH = faceBayHeight('front', bi, bayHeights, bayColumns);
    const heights = bracingHeightsFor(bayH);
    for (let liftIdx = 0; liftIdx < heights.length; liftIdx++) {
      const liftBottom = liftIdx === 0 ? 0 : heights[liftIdx - 1];
      const liftTop    = heights[liftIdx];
      // Front face never clips (front top = bayH); back clips under a mono-pitch roof.
      pushLift('front', bi, liftIdx, liftBottom, liftTop, getEffectiveFaceTop('front', bayH, roofType));
      pushLift('back',  bi, liftIdx, liftBottom, liftTop, getEffectiveFaceTop('back',  bayH, roofType));
    }
  }

  // Left/Right: row bays on the end columns; same per-bay direction logic.
  const totalSideCols = bayRows + 1;
  for (const face of ['left', 'right']) {
    const bayH = faceBayHeight(face, 0, bayHeights, bayColumns);
    const heights = bracingHeightsFor(bayH);
    for (let liftIdx = 0; liftIdx < heights.length; liftIdx++) {
      const liftBottom = liftIdx === 0 ? 0 : heights[liftIdx - 1];
      const liftTop    = heights[liftIdx];
      for (let bi = 0; bi < bayRows; bi++) {
        const topA = getStandardTopForColumn(face, bi,     totalSideCols, bayH, roofType);
        const topB = getStandardTopForColumn(face, bi + 1, totalSideCols, bayH, roofType);
        pushLift(face, bi, liftIdx, liftBottom, liftTop, Math.min(topA, topB));
      }
    }
  }
  return { braces, openings };
}

export function getAutoBracing(bayColumns, bayRows, bayHeights, roofType = null, opts = {}) {
  return getAutoBracingDetail(bayColumns, bayRows, bayHeights, roofType, opts).braces;
}

// ─── Manual (off-the-shelf) brace placement ──────────────────────────────────
// An off-the-shelf Layher diagonal is a fixed component (part chosen by bay
// length) spanning EXACTLY 2 m of height. Its BASE may sit at ANY 0.5 m node on
// the standard — the 2 m lifts are a counting concept, not placement bands, so
// a brace may straddle a 2 m level (e.g. 1–3 m). Top constraint: base + 2 m
// must not exceed the bay's face top.
export const BRACE_SPAN = MAX_LIFT_GAP; // 2.0 m

// Highest node the brace base may sit on for a face-bay (null = bay too short).
export function braceBaseLimit(faceTop) {
  const lim = Math.floor((faceTop - BRACE_SPAN) / NODE_STEP + 1e-9) * NODE_STEP;
  return lim < -1e-9 ? null : Math.round(lim * 100) / 100;
}

// Snap a cursor height to the brace base (brace centred on the cursor: base =
// nearest node to cursor − 1 m), clamped to [0, braceBaseLimit(faceTop)].
export function manualBraceBase(heightFromGround, faceTop) {
  const lim = braceBaseLimit(faceTop);
  if (lim === null) return null;
  const raw  = Math.round((heightFromGround - BRACE_SPAN / 2) / NODE_STEP) * NODE_STEP;
  const base = Math.min(lim, Math.max(0, raw));
  return Math.round(base * 100) / 100;
}

// Face top the brace endpoints must land under (both endpoints sit on that
// bay's standards; under a mono-pitch roof the rear/side tops are 0.5 m lower).
export function braceFaceTop(face, bayIndex, bayHeights, bayColumns, bayRows, roofType = null) {
  const bayH = faceBayHeight(face, bayIndex, bayHeights, bayColumns);
  if (face === 'left' || face === 'right') {
    const total = bayRows + 1;
    return Math.min(
      getStandardTopForColumn(face, bayIndex,     total, bayH, roofType),
      getStandardTopForColumn(face, bayIndex + 1, total, bayH, roofType),
    );
  }
  return getEffectiveFaceTop(face, bayH, roofType);
}

// Manual brace key: `face-bay-bottom-top-<suffix>`:
//   L / R   off-the-shelf 2 m component; L = base on the LEFT standard
//           (direction '/'), R = base on the RIGHT ('\').
//   LB / RB BESPOKE diagonal (free tube, any two 0.5 m nodes, dashed); the
//           letter is the standard the LOWER end sits on. Always bespoke,
//           even if the span happens to be 2 m (explicit tool choice).
// The 4-part legacy key `face-bay-bottom-top` (auto keys, pre-Sep-2026 saves)
// still parses: bespoke iff the span is not 2 m, direction by the old fallback.
export function manualBraceKey(face, bayIndex, base, direction) {
  const top = Math.round((base + BRACE_SPAN) * 100) / 100;
  return `${face}-${bayIndex}-${base}-${top}-${direction === '\\' ? 'R' : 'L'}`;
}

export function bespokeBraceKey(face, bayIndex, hA, sideA, hB) {
  // (hA on standard sideA) → (hB on the other standard); lower end decides the letter
  const bottom = Math.min(hA, hB), top = Math.max(hA, hB);
  const lowerSide = hA <= hB ? sideA : (sideA === 'L' ? 'R' : 'L');
  return `${face}-${bayIndex}-${bottom}-${top}-${lowerSide}B`;
}

export function parseBraceKey(key) {
  const parts      = key.split('-');
  const face       = parts[0];
  const bayIndex   = Number(parts[1]);
  const liftBottom = Number(parts[2]);
  const liftTop    = Number(parts[3]);
  const suffix     = parts[4] ?? '';
  const direction  = suffix.startsWith('R') ? '\\'
    : suffix.startsWith('L') ? '/'
    : (liftBottom % 1 === 0 ? '/' : '\\'); // legacy fallback
  const bespoke    = suffix.endsWith('B') || isBespokeSpan(liftBottom, liftTop);
  return { face, bayIndex, liftBottom, liftTop, direction, bespoke, key };
}

// opts: { pattern, removedLedgers } passed through to the generator.
// Returns { bracing, removedCount, openings } — `openings` are the auto
// positions skipped because a removed ledger sits in/at their lift.
export function getAutoBracingWithOverrides(bayColumns, bayRows, bayHeights, bracingOverrides = {}, roofType = null, opts = {}) {
  const { removed = [], added = [] } = bracingOverrides;
  const removedSet = new Set(removed);
  const addedSet   = new Set(added);

  const { braces: autoBraces, openings } = getAutoBracingDetail(bayColumns, bayRows, bayHeights, roofType, opts);
  const autoKeys   = new Set(autoBraces.map(b => b.key));

  const bracing = autoBraces.filter(b => !removedSet.has(b.key));

  for (const key of addedSet) {
    if (autoKeys.has(key)) continue;
    const b = parseBraceKey(key);
    if (!isFinite(b.liftBottom) || !isFinite(b.liftTop) || b.liftTop <= b.liftBottom) continue;
    // A manual brace whose top would exceed the bay's face top cannot be built
    // (hand-edited save, or the bay was lowered after placement) — drop it.
    const faceTop = braceFaceTop(b.face, b.bayIndex, bayHeights, bayColumns, bayRows, roofType);
    if (b.liftTop > faceTop + 1e-9) continue;
    bracing.push(b);
  }

  return { bracing, removedCount: removed.length, openings };
}

// Snap a cursor height to a 0.5 m node on a standard for the bespoke tool,
// clamped to [0, faceTop].
export function bespokeNode(heightFromGround, faceTop) {
  const h = Math.round(heightFromGround / NODE_STEP) * NODE_STEP;
  return Math.round(Math.min(faceTop, Math.max(0, h)) * 100) / 100;
}

// Caveat shown whenever an opening (removed ledgers) interrupts bracing
// continuity on a face. Sits alongside STEPPED_CAVEATS in the BOM warnings.
export const OPENING_CAVEAT =
  'Opening interrupts bracing continuity — engineer\'s check required.';

export function getBracingCladConflicts(bracing, claddingPanels = []) {
  const conflicts = [];
  for (const brace of bracing) {
    for (const panel of claddingPanels) {
      if (
        panel.face === brace.face &&
        panel.bayIndex === brace.bayIndex &&
        panel.liftBottom === brace.liftBottom
      ) {
        conflicts.push({ braceKey: brace.key, panelType: panel.type });
      }
    }
  }
  return conflicts;
}
