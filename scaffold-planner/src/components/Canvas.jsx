import React, { useState, useRef, useEffect } from 'react';
import { TARP_SIDE_HEIGHT, TARP_BAY_WIDTH } from '../constants/layher';
import { derivedPans } from '../state/scaffoldStore';
import {
  getFaceLedgerHeights,
  levelBays,
  eligibleBays,
  levelHeightsByCol,
  getAutoLedgersWithOverrides,
  getAutoBracingWithOverrides,
  getEffectiveFaceTop,
  resolveBayHeights,
  standardHeights,
  maxBayHeight,
  faceBayHeight,
  manualBraceBase,
  manualBraceKey,
  bespokeBraceKey,
  bespokeNode,
  braceFaceTop,
  BRACE_SPAN,
} from '../utils/scaffoldGeometry';

// ─── SVG coordinate constants ─────────────────────────────────────────────────
const SCALE     = 100;   // SVG units per metre
const PAD_T     = 36;    // top   — dimension labels
const PAD_L     = 44;    // left  — dimension labels
const PAD_R     = 14;
const PAD_B     = 14;

// ─── Visual constants ─────────────────────────────────────────────────────────
const STD_R        = 6.5;
const DIM_FONT     = 12;
const DIM_COLOR    = 'rgba(255,255,255,0.38)';
const GRID_STROKE  = 'rgba(255,255,255,0.15)';
const STD_COLOR    = 'rgba(255,255,255,0.72)';
const EMPTY_FILL   = '#1a1a1a';
const DELETE_COLOR = '#ef4444';
const ROOF_COLOR   = '#c9a84c';
const TARP_COLOR   = '#8B6914';
const WIN_COLOR    = '#00BCD4';
const ELEV_PAD_R   = 52;
const NODE_STEP    = 0.5;
const BRACE_COLOR        = '#8B6914';
const LEDGER_COLOR       = 'rgba(255,255,255,0.6)';
const LEDGER_GHOST_COLOR = 'rgba(255,255,255,0.3)';
const BRACE_GHOST_COLOR  = 'rgba(139,105,20,0.4)';
const LADDER_BEAM_COLOR  = '#e2e8f0';  // near-white — distinct from gold braces/ledgers
const LADDER_BEAM_DEPTH  = 14;        // SVG units ≈ 0.14m beam depth

// Tarp unit dimensions — sourced from layher.js constants
const TARP_H = TARP_SIDE_HEIGHT;
const TARP_W = TARP_BAY_WIDTH;

// ─── Helpers ──────────────────────────────────────────────────────────────────
function buildXPos(gridCols, bayLengths) {
  const pos = [0];
  for (let c = 0; c < gridCols; c++) {
    pos.push(pos[c] + (bayLengths[c] ?? 2.07));
  }
  return pos;
}


function faceEdge(face, x, y, w, h) {
  if (face === 'N') return { x1: x,     y1: y,     x2: x + w, y2: y     };
  if (face === 'S') return { x1: x,     y1: y + h, x2: x + w, y2: y + h };
  if (face === 'E') return { x1: x + w, y1: y,     x2: x + w, y2: y + h };
  /* W */           return { x1: x,     y1: y,     x2: x,     y2: y + h };
}

// ─── Plan view ────────────────────────────────────────────────────────────────
function PlanView({ state, dispatch }) {
  const {
    gridCols, gridRows, bayLengths, bayWidth,
    levels, activeLevelId, tool,
    activePlacement, activePlacementMode, activeFace, tarps, windows, roofBays, renderMode,
  } = state;

  const svgRef = useRef(null);
  const [hover, setHover] = useState(null); // { col, row, slotIndex } | null

  const bayHeights = resolveBayHeights(state);
  // Decking is derived from per-bay deck-level membership (minus carved slots).
  const placedPans = derivedPans(state);
  const activeLevelBays = (() => {
    const l = levels.find(x => x.id === activeLevelId);
    return l ? levelBays(l, bayHeights) : [];
  })();
  const activeLevelEligible = (() => {
    const l = levels.find(x => x.id === activeLevelId);
    return l ? eligibleBays(l.height, bayHeights) : [];
  })();

  const xPos   = buildXPos(gridCols, bayLengths);
  const totalW = xPos[gridCols];
  const totalH = gridRows * bayWidth;
  const vbW    = PAD_L + totalW * SCALE + PAD_R;
  const vbH    = PAD_T + totalH * SCALE + PAD_B;

  const activeLevel = levels.find(l => l.id === activeLevelId);
  const isCladMode  = activePlacement === 'tarp';
  const roofSet     = new Set(roofBays.map(([c, r]) => `${c},${r}`));
  const slotsPerBay = bayWidth === 2.57 ? 8 : 6;
  const slotH       = bayWidth * SCALE / slotsPerBay;

  function computeHover(e) {
    const svgEl = svgRef.current;
    if (!svgEl) return null;
    const { sx, sy } = clientToSvgCoords(e, svgEl, vbW, vbH);

    const relX = sx - PAD_L;
    const relY = sy - PAD_T;
    if (relX < 0 || relY < 0 || relX > totalW * SCALE || relY > totalH * SCALE) return null;

    let col = -1;
    for (let c = 0; c < gridCols; c++) {
      if (relX >= xPos[c] * SCALE && relX < xPos[c + 1] * SCALE) { col = c; break; }
    }
    const row = Math.floor(relY / (bayWidth * SCALE));
    if (col < 0 || row < 0 || row >= gridRows) return null;

    const bayRelY   = relY - row * bayWidth * SCALE;
    const slotIndex = Math.min(slotsPerBay - 1, Math.floor(bayRelY / slotH));

    return { col, row, slotIndex };
  }

  function onMouseMove(e) { setHover(computeHover(e)); }
  function onMouseLeave()  { setHover(null); }

  const isDeckMode = activePlacementMode === 'deck';

  function getSvgCursor() {
    if (!hover) return 'default';
    if (activePlacement === 'roof') return 'crosshair';
    if (isCladMode) return 'default';
    if (!isDeckMode || !activeLevel) return 'default';
    const { col, row, slotIndex } = hover;
    // A bay shorter than the active level can never host it.
    if (!activeLevelEligible.includes(col)) return 'not-allowed';
    const occupied = placedPans.some(
      p => p.col === col && p.row === row && p.slotIndex === slotIndex && p.levelId === activeLevelId
    );
    if (tool === 'delete') return occupied ? 'crosshair' : 'default';
    return 'crosshair';
  }

  function onSvgClick() {
    if (!hover) return;
    const { col, row, slotIndex } = hover;
    if (activePlacement === 'roof' && !isDeckMode) {
      dispatch({ type: 'TOGGLE_ROOF', col, row });
      return;
    }
    if (isCladMode) return;
    if (!isDeckMode) return;

    if (tool === 'place') {
      if (!activeLevelId) return;
      dispatch({ type: 'PLACE_PAN', col, row, slotIndex, levelId: activeLevelId });
    } else if (tool === 'delete') {
      if (!activeLevelId) return;
      dispatch({ type: 'REMOVE_PAN', col, row, slotIndex, levelId: activeLevelId });
    }
  }

  function getBayStyle(col, row) {
    const k      = `${col},${row}`;
    const isHov  = hover?.col === col && hover?.row === row;
    const hasRoof = roofSet.has(k);

    const base = { fill: EMPTY_FILL, fillOpacity: 1, stroke: GRID_STROKE, strokeWidth: 1 };

    if (activePlacement === 'roof') {
      if (isHov) return {
        fill: hasRoof ? DELETE_COLOR : ROOF_COLOR, fillOpacity: 0.2,
        stroke: hasRoof ? DELETE_COLOR : ROOF_COLOR, strokeWidth: 2.5,
      };
      if (hasRoof) return { ...base, stroke: ROOF_COLOR, strokeWidth: 1.5 };
      return base;
    }

    if (isCladMode) return base;
    if (!isDeckMode || !isHov || !activeLevel) return base;
    if (tool === 'delete') return base;
    if (!activeLevelEligible.includes(col)) return base;           // too short for the level
    if (!activeLevelBays.includes(col)) {                          // click adds the level to this bay
      return { fill: activeLevel.color, fillOpacity: 0.12, stroke: activeLevel.color, strokeWidth: 1.5 };
    }
    return { fill: activeLevel.color, fillOpacity: 0.06, stroke: GRID_STROKE, strokeWidth: 1 };
  }

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', cursor: getSvgCursor() }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onSvgClick}
    >
      {/* Bay background rects */}
      {Array.from({ length: gridRows }, (_, row) =>
        Array.from({ length: gridCols }, (_, col) => {
          const x = PAD_L + xPos[col] * SCALE;
          const y = PAD_T + row * bayWidth * SCALE;
          const w = (bayLengths[col] ?? 2.07) * SCALE;
          const h = bayWidth * SCALE;
          const { fill, fillOpacity, stroke, strokeWidth } = getBayStyle(col, row);
          return (
            <rect
              key={`b-${col}-${row}`}
              x={x} y={y} width={w} height={h}
              fill={fill} fillOpacity={fillOpacity}
              stroke={stroke} strokeWidth={strokeWidth}
              pointerEvents="none"
            />
          );
        })
      )}

      {/* Placed pans */}
      {placedPans.map((pan) => {
        const level = levels.find(l => l.id === pan.levelId);
        if (!level) return null;
        const x = PAD_L + xPos[pan.col] * SCALE;
        const y = PAD_T + pan.row * bayWidth * SCALE + pan.slotIndex * slotH;
        const w = (bayLengths[pan.col] ?? 2.07) * SCALE;
        const isActive = pan.levelId === activeLevelId;
        return (
          <rect
            key={pan.id}
            x={x} y={y} width={w} height={slotH}
            fill={level.color} fillOpacity={isActive ? 0.55 : 0.3}
            stroke={level.color} strokeWidth={0.5}
            pointerEvents="none"
          />
        );
      })}

      {/* Per-bay height labels (metres) — per-bay heights, Sep 2026 */}
      {Array.from({ length: gridCols }, (_, col) => {
        const h = bayHeights[col] ?? 0;
        const stepped = bayHeights.some(v => v !== bayHeights[0]);
        return (
          <text key={`hl-${col}`}
            x={PAD_L + (xPos[col] + (bayLengths[col] ?? 2.07) / 2) * SCALE}
            y={PAD_T + 14}
            textAnchor="middle"
            fill={stepped ? ROOF_COLOR : DIM_COLOR} fontSize={11}
            fontFamily="Barlow Condensed, sans-serif" letterSpacing="0.03em"
            pointerEvents="none"
          >
            H {h.toFixed(1)}m{isDeckMode && activeLevel && !activeLevelEligible.includes(col) ? ' · below deck' : ''}
          </text>
        );
      })}

      {/* Slot ghost preview */}
      {hover && !isCladMode && activePlacement !== 'roof' && activeLevel && activeLevelEligible.includes(hover.col) && (() => {
        const { col, row, slotIndex } = hover;
        const x = PAD_L + xPos[col] * SCALE;
        const y = PAD_T + row * bayWidth * SCALE + slotIndex * slotH;
        const w = (bayLengths[col] ?? 2.07) * SCALE;
        if (!activeLevelBays.includes(col)) {
          // The level is not in this bay yet: placing adds the whole bay (every row).
          if (tool === 'delete') return null;
          return (
            <rect
              x={x} y={PAD_T} width={w} height={totalH * SCALE}
              fill={activeLevel.color} fillOpacity={0.1}
              stroke={activeLevel.color} strokeWidth={1.5} strokeDasharray="6 3"
              pointerEvents="none"
            />
          );
        }
        const occupied = placedPans.some(
          p => p.col === col && p.row === row && p.slotIndex === slotIndex && p.levelId === activeLevelId
        );
        if (tool === 'delete' && !occupied) return null;
        const color  = (tool === 'delete' || occupied) ? DELETE_COLOR : activeLevel.color;
        const dashed = tool !== 'delete' && !occupied;
        return (
          <rect
            x={x} y={y} width={w} height={slotH}
            fill={color} fillOpacity={tool === 'delete' ? 0.35 : 0.22}
            stroke={color} strokeWidth={1.5}
            strokeDasharray={dashed ? '4 2' : 'none'}
            pointerEvents="none"
          />
        );
      })()}

      {/* Roof hatch (clad mode) */}
      {renderMode === 'clad' && roofBays.map(([col, row]) => {
        const x = PAD_L + xPos[col] * SCALE;
        const y = PAD_T + row * bayWidth * SCALE;
        const w = (bayLengths[col] ?? 2.07) * SCALE;
        const h = bayWidth * SCALE;
        return (
          <g key={`rh-${col}-${row}`} pointerEvents="none">
            <line x1={x} y1={y} x2={x + w} y2={y + h} stroke={ROOF_COLOR} strokeWidth={1} opacity={0.6} />
            <line x1={x + w} y1={y} x2={x} y2={y + h} stroke={ROOF_COLOR} strokeWidth={1} opacity={0.6} />
          </g>
        );
      })}

      {/* Tarp face edges (clad mode) */}
      {renderMode === 'clad' && tarps.map((t, i) => {
        let col, row, planFace;
        if (t.face === 'front')     { col = t.bayIndex; row = 0;            planFace = 'N'; }
        else if (t.face === 'back') { col = t.bayIndex; row = gridRows - 1; planFace = 'S'; }
        else if (t.face === 'left') { col = 0;          row = t.bayIndex;   planFace = 'W'; }
        else                        { col = gridCols - 1; row = t.bayIndex; planFace = 'E'; }
        const x = PAD_L + xPos[col] * SCALE;
        const y = PAD_T + row * bayWidth * SCALE;
        const w = (bayLengths[col] ?? 2.07) * SCALE;
        const h = bayWidth * SCALE;
        return (
          <line key={`to-${i}`}
            {...faceEdge(planFace, x, y, w, h)}
            stroke={TARP_COLOR} strokeWidth={4} strokeLinecap="round"
            pointerEvents="none"
          />
        );
      })}

      {/* Window face edges (clad mode) */}
      {renderMode === 'clad' && windows.map((wn, i) => {
        const x = PAD_L + xPos[wn.col] * SCALE;
        const y = PAD_T + wn.row * bayWidth * SCALE;
        const w = (bayLengths[wn.col] ?? 2.07) * SCALE;
        const h = bayWidth * SCALE;
        return (
          <line key={`wo-${i}`}
            {...faceEdge(wn.face, x, y, w, h)}
            stroke={WIN_COLOR} strokeWidth={4} strokeLinecap="round"
            pointerEvents="none"
          />
        );
      })}

      {/* Active face indicator in clad mode */}
      {isCladMode && hover && (() => {
        const { col, row } = hover;
        const x = PAD_L + xPos[col] * SCALE;
        const y = PAD_T + row * bayWidth * SCALE;
        const w = (bayLengths[col] ?? 2.07) * SCALE;
        const h = bayWidth * SCALE;
        const edge = faceEdge(activeFace, x, y, w, h);
        return (
          <line {...edge}
            stroke={ROOF_COLOR} strokeWidth={4} strokeLinecap="round"
            pointerEvents="none"
          />
        );
      })()}

      {/* Column dimension labels + ticks (top) */}
      {Array.from({ length: gridCols }, (_, col) => (
        <text key={`cl-${col}`}
          x={PAD_L + (xPos[col] + (bayLengths[col] ?? 2.07) / 2) * SCALE}
          y={PAD_T - 14}
          textAnchor="middle"
          fill={DIM_COLOR} fontSize={DIM_FONT}
          fontFamily="Barlow Condensed, sans-serif" letterSpacing="0.03em"
        >
          {(bayLengths[col] ?? 2.07).toFixed(2)}m
        </text>
      ))}
      {Array.from({ length: gridCols + 1 }, (_, col) => (
        <line key={`ct-${col}`}
          x1={PAD_L + xPos[col] * SCALE} y1={PAD_T - 7}
          x2={PAD_L + xPos[col] * SCALE} y2={PAD_T}
          stroke={DIM_COLOR} strokeWidth={1}
        />
      ))}

      {/* Row dimension labels + ticks (left) */}
      {Array.from({ length: gridRows }, (_, row) => (
        <text key={`rl-${row}`}
          x={PAD_L - 8}
          y={PAD_T + (row + 0.5) * bayWidth * SCALE + 4}
          textAnchor="end"
          fill={DIM_COLOR} fontSize={DIM_FONT}
          fontFamily="Barlow Condensed, sans-serif" letterSpacing="0.03em"
        >
          {bayWidth.toFixed(2)}m
        </text>
      ))}
      {Array.from({ length: gridRows + 1 }, (_, row) => (
        <line key={`rt-${row}`}
          x1={PAD_L - 7} y1={PAD_T + row * bayWidth * SCALE}
          x2={PAD_L}     y2={PAD_T + row * bayWidth * SCALE}
          stroke={DIM_COLOR} strokeWidth={1}
        />
      ))}

      {/* Standard post circles */}
      {Array.from({ length: gridRows + 1 }, (_, row) =>
        Array.from({ length: gridCols + 1 }, (_, col) => (
          <circle key={`s-${col}-${row}`}
            cx={PAD_L + xPos[col] * SCALE}
            cy={PAD_T + row * bayWidth * SCALE}
            r={STD_R} fill={STD_COLOR} pointerEvents="none"
          />
        ))
      )}
    </svg>
  );
}

// ─── SVG coordinate helper for elevation (handles xMidYMid meet letterboxing) ─
function clientToSvgCoords(e, svgEl, vbW, vbH) {
  const rect = svgEl.getBoundingClientRect();
  const scale = Math.min(rect.width / vbW, rect.height / vbH);
  const offsetX = (rect.width  - scale * vbW) / 2;
  const offsetY = (rect.height - scale * vbH) / 2;
  return {
    sx: (e.clientX - rect.left - offsetX) / scale,
    sy: (e.clientY - rect.top  - offsetY) / scale,
  };
}

// ─── Elevation view ───────────────────────────────────────────────────────────
function ElevationView({ state, dispatch, face }) {
  const {
    gridCols, gridRows, bayLengths, bayWidth,
    levels,
    tarps, windows, roofBays, ladderBeams = [],
    activePlacement, activePlacementMode, activeFace, tool,
    windowHeight = 1.0,
    ledgerOverrides = { removed: [], added: [] },
    bracingOverrides = { removed: [], added: [] },
    suppressedStdPositions = [],
  } = state;

  const suppressedPosSet = new Set(suppressedStdPositions);

  const slotsPerBay = bayWidth === 2.57 ? 8 : 6;

  const svgRef = useRef(null);
  const [hover, setHover] = useState(null);
  useEffect(() => { setHover(null); }, [activeFace]);
  // Bespoke diagonal tool: first click fixes the start node, second click the
  // end node on the OTHER standard of the same bay. The start is scoped to the
  // mode/tool it was set in (a face change remounts this view via its key), so
  // switching tool or mode discards it without an effect.
  const [bespokeStartRaw, setBespokeStartRaw] = useState(null); // { mode, tool, bayIdx, side: 'L'|'R', h }
  const bespokeStart = bespokeStartRaw && bespokeStartRaw.mode === activePlacementMode && bespokeStartRaw.tool === tool
    ? bespokeStartRaw : null;
  const setBespokeStart = v => setBespokeStartRaw(v ? { ...v, mode: activePlacementMode, tool } : null);
  // hover: null | { segIdx, heightFromGround, bottomNode, snappedBottom }

  // X segments: N/S = column lengths; E/W = row widths
  // S and E faces are mirror views — segments run right-to-left relative to their N/W counterparts
  const isNS       = activeFace === 'N' || activeFace === 'S';
  const isReversed = activeFace === 'S' || activeFace === 'E';
  const segCount   = isNS ? gridCols : gridRows;

  const xSegs = isNS
    ? (isReversed ? bayLengths.slice(0, gridCols).reverse() : bayLengths.slice(0, gridCols))
    : Array.from({ length: gridRows }, () => bayWidth);

  const xPos = [0];
  for (const s of xSegs) xPos.push(xPos[xPos.length - 1] + s);
  const totalX  = xPos[xPos.length - 1];

  // ── Per-bay heights ────────────────────────────────────────────────────────
  // The canvas extent is the TALLEST bay; every standard, ledger and brace is
  // drawn to its own bay / leg-line height (leg line = taller neighbour).
  const bayHeights      = resolveBayHeights(state);
  const legHeights      = standardHeights(bayHeights);
  const structureHeight = maxBayHeight(bayHeights);

  // ── Mirror helpers: segment index ↔ bay/row index ──────────────────────────
  const segToBay = seg => isReversed ? segCount - 1 - seg : seg;
  const bayToSeg = bay => isReversed ? segCount - 1 - bay : bay;

  // ── Ledger / brace geometry ────────────────────────────────────────────────
  const faceName = activeFace === 'N' ? 'front'
    : activeFace === 'S' ? 'back'
    : activeFace === 'W' ? 'left'
    : 'right';

  // Height of the bay behind elevation segment `seg` on this face (side faces
  // are a single end column, so every row bay shares that column's height).
  const segBayH = seg => {
    if (seg == null || seg < 0 || seg >= segCount) return structureHeight;
    return faceBayHeight(faceName, segToBay(seg), bayHeights, gridCols);
  };
  const faceColH = isNS ? structureHeight : faceBayHeight(faceName, 0, bayHeights, gridCols);
  // Leg-line height at elevation x-position i (line i sits between segments i-1 and i)
  const lineTopH = i => {
    if (!isNS) return faceColH;
    const colIdx = isReversed ? segCount - i : i;
    return legHeights[colIdx] ?? structureHeight;
  };

  const lifts   = Math.round(structureHeight / NODE_STEP);
  const yOf     = h => PAD_T + (structureHeight - h) * SCALE;
  const yGround = yOf(0);

  const vbW = PAD_L + totalX * SCALE + ELEV_PAD_R;
  const vbH = PAD_T + structureHeight * SCALE + PAD_B + 8;

  const beamsOnFace = ladderBeams.filter(b => b.face === faceName && b.height != null);

  const roofType = roofBays && roofBays.length > 0 ? 'monoPitch' : null;
  // Deck levels seed ledgers only in their member bays (per-bay deck levels).
  const levelHeights = levelHeightsByCol(levels, bayHeights);
  const faceLedgerHeights = getFaceLedgerHeights(gridCols, gridRows, bayHeights, levelHeights);
  const placedPans = derivedPans(state);
  const ledgerHeightsFor = seg => faceLedgerHeights[`${faceName}-${segToBay(Math.max(0, seg))}`] ?? [];
  // Union across the face — ladder beams span the whole face
  const ledgerHeights = Array.from(new Set(
    Array.from({ length: segCount }, (_, s) => ledgerHeightsFor(s)).flat()
  )).sort((a, b) => a - b);

  const removedLedgerSet = new Set(ledgerOverrides.removed);
  const removedBraceSet  = new Set(bracingOverrides.removed);

  const { ledgers: allLedgers } = getAutoLedgersWithOverrides(
    gridCols, gridRows, bayHeights, levelHeights, ledgerOverrides, roofType
  );
  const { bracing: allBracing, removedCount: removedBraceCount } = getAutoBracingWithOverrides(
    gridCols, gridRows, bayHeights, bracingOverrides, roofType,
    { pattern: state.bracingPattern, removedLedgers: ledgerOverrides.removed }
  );

  // Filter to this face; also build removed lists for ghost rendering
  const faceLedgers = allLedgers.filter(l => l.face === faceName);
  const faceBracing = allBracing.filter(b => b.face === faceName);

  // ── Rear-only roof row positions for side elevation standard truncation ─────
  const rearRoofRows = new Set();
  if (!isNS && roofBays?.length) {
    const frontRoofRows = new Set();
    for (const [, bayRow] of roofBays) {
      frontRoofRows.add(bayRow);
      rearRoofRows.add(bayRow + 1);
    }
    for (const r of frontRoofRows) rearRoofRows.delete(r);
  }

  // ── Back elevation (S face): column intersections adjacent to roof bays ─────
  // On the S face every visible standard is rear-facing for its roof bay column.
  // actual intersection for display position i on S face = segCount - i
  const rearColIntersections = new Set();
  if (activeFace === 'S' && roofBays?.length) {
    for (const [bayCol] of roofBays) {
      rearColIntersections.add(bayCol);
      rearColIntersections.add(bayCol + 1);
    }
  }

  // ── Face-aware helpers ──────────────────────────────────────────────────────
  const idxOf = item => bayToSeg(isNS ? item.col : item.row);

  function getPlacementCoords(segIdx) {
    const bayIdx = segToBay(segIdx);
    if (activeFace === 'N') return { col: bayIdx,        row: 0,            face: 'N' };
    if (activeFace === 'S') return { col: bayIdx,        row: gridRows - 1, face: 'S' };
    if (activeFace === 'W') return { col: 0,             row: bayIdx,       face: 'W' };
    /* E */                  return { col: gridCols - 1, row: bayIdx,       face: 'E' };
  }

  // Per spec: N/S blocked if bayWidth !== 2.57; E/W blocked if bayLengths[col] !== 2.57
  function isFaceValid() {
    if (activeFace === 'N' || activeFace === 'S') return bayWidth === TARP_W;
    const col = activeFace === 'W' ? 0 : gridCols - 1;
    return (bayLengths[col] ?? 2.07) === TARP_W;
  }

  // ── Filter cladding to current face ────────────────────────────────────────
  const activeTarps = tarps.filter(t => t.face === faceName);

  const elevWindows = windows.filter(w => {
    if (w.face !== activeFace) return false;
    if (activeFace === 'N') return w.row === 0;
    if (activeFace === 'S') return w.row === gridRows - 1;
    if (activeFace === 'W') return w.col === 0;
    /* E */                  return w.col === gridCols - 1;
  });

  // ── Roof geometry for current view direction ────────────────────────────────
  const roofIdxList = roofBays
    .map(([c, r]) => bayToSeg(isNS ? c : r))
    .filter(i => i >= 0 && i < xSegs.length);
  const roofMin = roofIdxList.length > 0 ? Math.min(...roofIdxList) : null;
  const roofMax = roofIdxList.length > 0 ? Math.max(...roofIdxList) : null;

  const RUNOFF = 50; // 0.5m × SCALE
  // Roof height: tallest roofed bay on N/S faces; the end column on side faces.
  const roofH = isNS && roofIdxList.length > 0
    ? Math.max(...roofIdxList.map(seg => segBayH(seg)))
    : faceColH;
  // Back elevation roof line sits at roofH - 0.5m (rear keder geometry).
  const effectiveRoofH = activeFace === 'S'
    ? Math.max(0, roofH - 0.5)
    : roofH;
  const roofLineY = yOf(effectiveRoofH);
  // N/S faces: single horizontal line at roofLineY.
  const roofLine = roofMin !== null ? {
    x1: PAD_L + xPos[roofMin]     * SCALE - RUNOFF,
    y1: roofLineY,
    x2: PAD_L + xPos[roofMax + 1] * SCALE + RUNOFF,
    y2: roofLineY,
  } : null;

  // Side faces: piecewise — horizontal overhang to front standard, then sloped to rear.
  // Front standard (N side) is always at structureHeight; rear (S) at structureHeight-0.5.
  const sideRoofGeom = (!isNS && roofMin !== null) ? (() => {
    const frontStdX = isReversed
      ? PAD_L + xPos[roofMax + 1] * SCALE
      : PAD_L + xPos[roofMin]     * SCALE;
    const rearStdX = isReversed
      ? PAD_L + xPos[roofMin]     * SCALE
      : PAD_L + xPos[roofMax + 1] * SCALE;
    const overhangX  = isReversed ? frontStdX + RUNOFF : frontStdX - RUNOFF;
    const roofFrontY = yOf(roofH);
    const roofRearY  = yOf(roofH - 0.5);
    return { frontStdX, rearStdX, overhangX, roofFrontY, roofRearY };
  })() : null;

  const roofYatX = sideRoofGeom
    ? x => {
        const { frontStdX, rearStdX, roofFrontY, roofRearY } = sideRoofGeom;
        const pastFront = isReversed ? x <= frontStdX : x >= frontStdX;
        if (!pastFront) return roofFrontY;
        const t = Math.max(0, Math.min(1, (x - frontStdX) / (rearStdX - frontStdX)));
        return roofFrontY + t * (roofRearY - roofFrontY);
      }
    : roofLine
      ? x => roofLine.y1 + ((x - roofLine.x1) / (roofLine.x2 - roofLine.x1)) * (roofLine.y2 - roofLine.y1)
      : () => PAD_T;

  // ── Mouse tracking & hover data ─────────────────────────────────────────────
  function computeHover(e) {
    const svgEl = svgRef.current;
    if (!svgEl) return null;
    const { sx, sy } = clientToSvgCoords(e, svgEl, vbW, vbH);

    const relX = sx - PAD_L;
    let segIdx = -1;
    for (let i = 0; i < xSegs.length; i++) {
      if (relX >= xPos[i] * SCALE && relX < xPos[i + 1] * SCALE) { segIdx = i; break; }
    }
    if (sy < PAD_T || sy > yGround) return null;

    const heightFromGround = structureHeight - (sy - PAD_T) / SCALE;
    const hoverBayH = segBayH(segIdx); // the hovered bay's own height

    // Tarp: snap top edge to nearest 0.5m node; bottom = top - 2m, clipped to ground
    const faceTarpTop = getEffectiveFaceTop(faceName, hoverBayH, roofType);
    const snappedTarpTop = Math.min(
      Math.round(heightFromGround / NODE_STEP) * NODE_STEP,
      faceTarpTop
    );
    const bottomNode = Math.round(Math.max(0, snappedTarpTop - TARP_H) / NODE_STEP);

    // Window: snap bottom to nearest node
    const maxWinBottom = Math.max(0, hoverBayH - windowHeight);
    const snappedBottom = Math.max(0, Math.min(maxWinBottom,
      Math.round(heightFromGround / NODE_STEP) * NODE_STEP
    ));

    // Ledger: snap to nearest 0.5m node, clamped to [0.5, effectiveFaceTop]
    const faceLedgerTop = (faceName !== 'front' && roofType === 'monoPitch')
      ? hoverBayH - 0.5
      : hoverBayH;
    const snappedLedgerH = Math.max(0.5, Math.min(
      Math.round(heightFromGround / NODE_STEP) * NODE_STEP,
      faceLedgerTop
    ));

    // Ladder beam: snap to nearest ledger height on the face (union across bays)
    const snappedLadderH = ledgerHeights.length > 0
      ? ledgerHeights.reduce((best, h) =>
          Math.abs(h - heightFromGround) < Math.abs(best - heightFromGround) ? h : best
        )
      : snappedLedgerH;

    // Off-the-shelf brace: fixed 2 m span, BASE at any 0.5 m node from 0 up to
    // (face top − 2 m). The 2 m lifts are NOT placement bands. Direction follows
    // the cursor's half of the bay: left half → base on the left standard ('/'),
    // right half → base on the right ('\').
    const isBraceTool = activePlacementMode === 'brace' || activePlacementMode === 'bespoke';
    let braceSegIdx = segIdx;
    // Allow brace hover even between bays (snap to nearest)
    if (braceSegIdx < 0 && isBraceTool) {
      braceSegIdx = Math.max(0, Math.min(xSegs.length - 1,
        Math.floor(relX / ((totalX / xSegs.length) * SCALE))
      ));
    }
    let snapLiftBottom = null;
    let snapLiftTop    = null;
    let snapDir        = '/';
    let bespokeSide    = 'L';
    let bespokeH       = null;
    if (braceSegIdx >= 0 && isBraceTool) {
      const faceTop = braceFaceTop(faceName, segToBay(braceSegIdx), bayHeights, gridCols, gridRows, roofType);
      const segMidX = (xPos[braceSegIdx] + xPos[braceSegIdx + 1]) / 2 * SCALE;
      const rightHalf = relX > segMidX;
      if (activePlacementMode === 'brace') {
        const base = manualBraceBase(heightFromGround, faceTop);
        if (base !== null) {
          snapLiftBottom = base;
          snapLiftTop    = Math.round((base + BRACE_SPAN) * 100) / 100;
        }
        snapDir = rightHalf ? '\\' : '/'; // base on the standard nearest the cursor
      } else {
        // Bespoke: free node on the nearest standard (or, once a start is fixed
        // in this bay, on the OTHER standard); any 0.5 m node up to the face top.
        bespokeH = bespokeNode(heightFromGround, faceTop);
        const startHere = bespokeStart && bespokeStart.bayIdx === segToBay(braceSegIdx);
        bespokeSide = startHere ? (bespokeStart.side === 'L' ? 'R' : 'L') : (rightHalf ? 'R' : 'L');
      }
    }

    if (segIdx < 0 && activePlacementMode !== 'ledger' && !isBraceTool
        && activePlacement !== 'ladder') return null;

    return { segIdx: segIdx < 0 ? 0 : segIdx, heightFromGround, bottomNode, snappedTarpTop, snappedBottom,
      snappedLedgerH, snappedLadderH, braceSegIdx, snapLiftBottom, snapLiftTop, snapDir, bespokeSide, bespokeH };
  }

  function onMouseMove(e) { setHover(computeHover(e)); }
  function onMouseLeave() { setHover(null); }

  function onSvgClick(e) {
    if (!hover) return;
    const { segIdx, bottomNode, snappedBottom, heightFromGround, snappedLedgerH, braceSegIdx, snapLiftBottom, snapDir, bespokeSide, bespokeH } = hover;

    // Bespoke diagonal mode: two clicks, node to node across the bay
    if (activePlacementMode === 'bespoke' && braceSegIdx >= 0) {
      const bayIdx = segToBay(braceSegIdx);
      if (tool === 'delete') {
        const hit = braceUnderCursor(bayIdx, heightFromGround);
        if (hit) dispatch({ type: 'REMOVE_BRACE', key: hit.key });
        return;
      }
      if (bespokeH === null) return;
      if (!bespokeStart || bespokeStart.bayIdx !== bayIdx) {
        setBespokeStart({ bayIdx, side: bespokeSide, h: bespokeH });
        return;
      }
      if (Math.abs(bespokeH - bespokeStart.h) < 1e-9) return; // a diagonal needs two different heights
      const key = bespokeBraceKey(faceName, bayIdx, bespokeStart.h, bespokeStart.side, bespokeH);
      if (!faceBracing.some(b => b.key === key)) dispatch({ type: 'ADD_BRACE', key });
      setBespokeStart(null);
      return;
    }

    // Ledger mode
    if (activePlacementMode === 'ledger' && snappedLedgerH !== null && segIdx >= 0) {
      const bayIdx = segToBay(segIdx);
      const key = `${faceName}-${bayIdx}-${snappedLedgerH}`;
      if (tool === 'delete') {
        if (faceLedgers.some(l => l.key === key)) dispatch({ type: 'REMOVE_LEDGER', key });
      } else {
        if (removedLedgerSet.has(key)) dispatch({ type: 'ADD_LEDGER', key });
        else if (!faceLedgers.some(l => l.key === key)) dispatch({ type: 'ADD_LEDGER', key });
      }
      return;
    }

    // Brace mode
    if (activePlacementMode === 'brace' && braceSegIdx >= 0) {
      const bayIdx = segToBay(braceSegIdx);
      if (tool === 'delete') {
        const hit = braceUnderCursor(bayIdx, heightFromGround);
        if (hit) dispatch({ type: 'REMOVE_BRACE', key: hit.key });
        return;
      }
      if (snapLiftBottom === null) return; // bay too short for a 2 m component — not offered
      // Direction is stored as drawn (the renderer does not mirror directions
      // on the S/E faces either), so the placed brace matches its ghost.
      const key = manualBraceKey(faceName, bayIdx, snapLiftBottom, snapDir);
      const autoKey = `${faceName}-${bayIdx}-${snapLiftBottom}-${Math.round((snapLiftBottom + BRACE_SPAN) * 100) / 100}`;
      if (removedBraceSet.has(autoKey)) dispatch({ type: 'ADD_BRACE', key: autoKey }); // restore a removed auto brace
      else if (!faceBracing.some(b => b.key === key || b.key === autoKey)) dispatch({ type: 'ADD_BRACE', key });
      return;
    }

    if (activePlacement === 'ladder') {
      const snappedH = hover.snappedLadderH;
      if (tool === 'delete') {
        const hit = beamsOnFace.find(b => b.height === snappedH);
        if (hit) dispatch({ type: 'REMOVE_LADDER_BEAM', id: hit.id });
      } else {
        if (!beamsOnFace.some(b => b.height === snappedH)) {
          dispatch({ type: 'ADD_LADDER_BEAM', beam: { id: `lb-${Date.now()}`, face: faceName, height: snappedH } });
        }
      }
      return;
    }

    if (activePlacement !== 'tarp' && activePlacement !== 'window') return;
    const coords = getPlacementCoords(segIdx);

    if (activePlacement === 'tarp') {
      if (!isFaceValid()) return;
      if (tool === 'delete') {
        const hitTarp = activeTarps.find(t =>
          bayToSeg(t.bayIndex) === segIdx &&
          heightFromGround >= t.bottomHeight &&
          heightFromGround <= t.topHeight
        );
        if (hitTarp) dispatch({ type: 'REMOVE_TARP', id: hitTarp.id });
      } else {
        const faceTop = getEffectiveFaceTop(faceName, segBayH(segIdx), roofType);
        const snappedTarpTop = Math.min(
          Math.round(heightFromGround / NODE_STEP) * NODE_STEP,
          faceTop
        );
        const pBottom = Math.max(0, snappedTarpTop - TARP_H);
        const pTop    = pBottom > 0 ? pBottom + TARP_H : snappedTarpTop;
        const winConflict  = elevWindows.some(w =>
          idxOf(w) === segIdx && w.bottomHeight < pTop && w.topHeight > pBottom);
        const tarpConflict = activeTarps.some(t =>
          bayToSeg(t.bayIndex) === segIdx &&
          t.bottomHeight < pTop &&
          t.topHeight    > pBottom);
        if (!winConflict && !tarpConflict) {
          dispatch({ type: 'ADD_TARP', id: Date.now(), face: faceName, bayIndex: segToBay(segIdx), bottomHeight: pBottom, topHeight: pTop });
        }
      }

    } else if (activePlacement === 'window') {
      const topHeight = snappedBottom + windowHeight;
      if (topHeight > segBayH(segIdx) + 1e-9) return;

      if (tool === 'delete') {
        const existing = elevWindows.find(wn =>
          idxOf(wn) === segIdx &&
          heightFromGround >= wn.bottomHeight &&
          heightFromGround <= wn.topHeight
        );
        if (existing) dispatch({ type: 'REMOVE_WINDOW', ...coords, bottomHeight: existing.bottomHeight });
      } else {
        const winOnWinConflict = elevWindows.some(wn =>
          idxOf(wn) === segIdx &&
          wn.bottomHeight < topHeight &&
          wn.topHeight    > snappedBottom);
        if (!winOnWinConflict) {
          const segW = xSegs[segIdx];
          dispatch({ type: 'ADD_WINDOW', ...coords, bottomHeight: snappedBottom, topHeight, width: segW });
        }
      }
    }
  }

  // Brace under the cursor in a bay — where braces overlap (e.g. an auto 0–2 m
  // and a manual 1–3 m), the one whose mid-height is nearest the cursor wins.
  function braceUnderCursor(bayIdx, h) {
    let best = null, bestDist = Infinity;
    for (const b of faceBracing) {
      if (b.bayIndex !== bayIdx || h < b.liftBottom - 1e-9 || h > b.liftTop + 1e-9) continue;
      const d = Math.abs((b.liftBottom + b.liftTop) / 2 - h);
      if (d < bestDist) { bestDist = d; best = b; }
    }
    return best;
  }

  // ── Computed hover overlays ─────────────────────────────────────────────────
  const isInteractive = activePlacement === 'tarp' || activePlacement === 'window'
    || activePlacement === 'ladder'
    || activePlacementMode === 'ledger' || activePlacementMode === 'brace' || activePlacementMode === 'bespoke';
  const faceValid     = isFaceValid();

  // Tarp conflict helpers
  const tarpProposedBottom = hover ? hover.bottomNode * NODE_STEP : 0;
  const tarpProposedTop    = tarpProposedBottom > 0 ? tarpProposedBottom + TARP_H : (hover?.snappedTarpTop ?? TARP_H);
  const hoveredTarp = hover && activePlacement === 'tarp'
    ? activeTarps.find(t =>
        bayToSeg(t.bayIndex) === hover.segIdx &&
        hover.heightFromGround >= t.bottomHeight &&
        hover.heightFromGround <= t.topHeight
      )
    : null;
  const isTarpOccupied = hoveredTarp != null;
  const hasTarpWindowConflict = hover != null && activePlacement === 'tarp'
    && elevWindows.some(w =>
        idxOf(w) === hover.segIdx &&
        w.bottomHeight < tarpProposedTop &&
        w.topHeight    > tarpProposedBottom
      );
  const hasTarpTarpConflict = hover != null && activePlacement === 'tarp'
    && activeTarps.some(t =>
        bayToSeg(t.bayIndex) === hover.segIdx &&
        t.bottomHeight < tarpProposedTop &&
        t.topHeight    > tarpProposedBottom
      );

  const hoveredWindow = (hover && activePlacement === 'window')
    ? elevWindows.find(wn =>
        idxOf(wn) === hover.segIdx &&
        hover.heightFromGround >= wn.bottomHeight &&
        hover.heightFromGround <= wn.topHeight
      )
    : null;

  function getElevCursor() {
    if (!hover || !isInteractive) return 'default';
    if (activePlacementMode === 'ledger' || activePlacementMode === 'brace' || activePlacementMode === 'bespoke') {
      if (tool === 'delete') {
        if (activePlacementMode === 'ledger' && hover.segIdx >= 0) {
          const bayIdx = segToBay(hover.segIdx);
          const key = `${faceName}-${bayIdx}-${hover.snappedLedgerH}`;
          return faceLedgers.some(l => l.key === key) ? 'pointer' : 'default';
        }
        if (activePlacementMode !== 'ledger' && hover.braceSegIdx >= 0) {
          return braceUnderCursor(segToBay(hover.braceSegIdx), hover.heightFromGround) ? 'pointer' : 'default';
        }
        return 'default';
      }
      // Only the off-the-shelf tool has a "bay too short" state; bespoke is free node-to-node.
      if (activePlacementMode === 'brace' && hover.snapLiftBottom == null) return 'not-allowed';
      return 'crosshair';
    }
    if (activePlacement === 'tarp')   return faceValid ? 'crosshair' : 'not-allowed';
    if (activePlacement === 'window') return (tool === 'delete' && hoveredWindow) ? 'pointer' : 'crosshair';
    if (activePlacement === 'ladder') return 'crosshair';
    return 'default';
  }

  return (
    <svg
      ref={svgRef}
      width="100%"
      height="100%"
      viewBox={`0 0 ${vbW} ${vbH}`}
      preserveAspectRatio="xMidYMid meet"
      style={{ display: 'block', cursor: getElevCursor() }}
      onMouseMove={onMouseMove}
      onMouseLeave={onMouseLeave}
      onClick={onSvgClick}
    >
      {/* Horizontal node grid lines */}
      {Array.from({ length: lifts + 1 }, (_, i) => (
        <line key={`hg-${i}`}
          x1={PAD_L} y1={yOf(i * NODE_STEP)}
          x2={PAD_L + totalX * SCALE} y2={yOf(i * NODE_STEP)}
          stroke={GRID_STROKE} strokeWidth={1}
        />
      ))}

      {/* Vertical grid lines */}
      {xPos.map((x, i) => (
        <line key={`vg-${i}`}
          x1={PAD_L + x * SCALE} y1={PAD_T}
          x2={PAD_L + x * SCALE} y2={yGround}
          stroke={GRID_STROKE} strokeWidth={1}
        />
      ))}

      {/* Per-pan elevation indicators (derived: only member bay-levels have pans) */}
      {placedPans.map((pan) => {
        const level = levels.find(l => l.id === pan.levelId);
        if (!level) return null;
        const y = yOf(level.height) - 3;
        const opacity = 0.65;
        if (isNS) {
          const segIdx = bayToSeg(pan.col);
          if (segIdx < 0 || segIdx >= xSegs.length) return null;
          return (
            <rect key={`ep-${pan.id}`}
              x={PAD_L + xPos[segIdx] * SCALE} y={y}
              width={xSegs[segIdx] * SCALE} height={6}
              fill={level.color} opacity={opacity}
              pointerEvents="none"
            />
          );
        }
        const segIdx = bayToSeg(pan.row);
        if (segIdx < 0 || segIdx >= xSegs.length) return null;
        const slotW = xSegs[segIdx] * SCALE / slotsPerBay;
        return (
          <rect key={`ep-${pan.id}`}
            x={PAD_L + xPos[segIdx] * SCALE + pan.slotIndex * slotW} y={y}
            width={slotW} height={6}
            fill={level.color} opacity={opacity}
            pointerEvents="none"
          />
        );
      })}

      {/* Side elevation: the rest of the stepped profile BEHIND the end face,
          dimmed (existing dimmed convention). From the side every interior leg
          line projects onto the same x positions, so the profile reads as the
          taller bays' silhouette rising above the solid end face: dimmed upright
          extensions to the run's tallest leg, dimmed nodes, and a dimmed top
          line at each distinct taller leg height. */}
      {!isNS && (() => {
        const behind = Array.from(new Set(legHeights)).filter(h => h > faceColH + 1e-9).sort((a, b) => a - b);
        if (behind.length === 0) return null;
        const topH = behind[behind.length - 1];
        const xL = PAD_L, xR = PAD_L + totalX * SCALE;
        const nodes = [];
        for (let h = Math.round((faceColH + NODE_STEP) * 100) / 100; h <= topH + 1e-9; h = Math.round((h + NODE_STEP) * 100) / 100) nodes.push(h);
        return (
          <g pointerEvents="none" opacity={0.22}>
            {xPos.map((x, i) => (
              <line key={`bstd-${i}`}
                x1={PAD_L + x * SCALE} y1={yOf(topH)} x2={PAD_L + x * SCALE} y2={yOf(faceColH)}
                stroke={STD_COLOR} strokeWidth={2} strokeDasharray="4 3" />
            ))}
            {xPos.flatMap((x, i) => nodes.map(h => (
              <circle key={`bnc-${i}-${h}`} cx={PAD_L + x * SCALE} cy={yOf(h)} r={3.5} fill={STD_COLOR} />
            )))}
            {behind.map(h => (
              <line key={`btop-${h}`} x1={xL} y1={yOf(h)} x2={xR} y2={yOf(h)}
                stroke={LEDGER_COLOR} strokeWidth={2} strokeDasharray="4 3" />
            ))}
            <text x={xR - 4} y={yOf(topH) - 6} textAnchor="end" fill={DIM_COLOR} fontSize={10}
              fontFamily="Barlow Condensed, sans-serif" letterSpacing="0.03em">
              profile behind (to {topH}m)
            </text>
          </g>
        );
      })()}

      {/* Standard uprights — each leg line to its own height (taller neighbour) */}
      {xPos.map((x, i) => {
        const rowPos = isReversed ? segCount - i : i;
        const isRear = rearRoofRows.has(rowPos)
          || rearColIntersections.has(segCount - i);
        const lineH  = lineTopH(i);
        const topY   = isRear ? yOf(Math.max(0, lineH - 0.5)) : yOf(lineH);

        // Suppressed positions (e.g. central base-only collar) — render a stub
        const colIdx = isNS ? (isReversed ? segCount - i : i) : null;
        const rowIdx = isNS ? (activeFace === 'S' ? gridRows : 0) : null;
        const isSuppressed = colIdx !== null && suppressedPosSet.has(`${colIdx},${rowIdx}`);

        return (
          <line key={`std-${i}`}
            x1={PAD_L + x * SCALE} y1={isSuppressed ? yOf(0.15) : topY}
            x2={PAD_L + x * SCALE} y2={yGround}
            stroke={STD_COLOR} strokeWidth={isSuppressed ? 1 : 2}
            strokeDasharray={isSuppressed ? '4 3' : undefined}
          />
        );
      })}

      {/* Node circles */}
      {xPos.flatMap((x, i) => {
        const rowPos   = isReversed ? segCount - i : i;
        const isRear   = rearRoofRows.has(rowPos)
          || rearColIntersections.has(segCount - i);
        const lineH    = lineTopH(i);
        const topH     = isRear ? Math.max(0, lineH - 0.5) : lineH;
        const topLifts = Math.round(topH / NODE_STEP);

        const colIdx2 = isNS ? (isReversed ? segCount - i : i) : null;
        const rowIdx2 = isNS ? (activeFace === 'S' ? gridRows : 0) : null;
        const isSuppressed2 = colIdx2 !== null && suppressedPosSet.has(`${colIdx2},${rowIdx2}`);

        return Array.from({ length: topLifts + 1 }, (_, j) => {
          if (isSuppressed2 && j > 0) return null;
          const cy = yOf(j * NODE_STEP);
          if (!isFinite(cy)) return null;
          return (
            <circle key={`nc-${i}-${j}`}
              cx={PAD_L + x * SCALE} cy={cy}
              r={3.5} fill={STD_COLOR} pointerEvents="none"
            />
          );
        });
      })}

      {/* ── Ledgers ────────────────────────────────────────────────────────── */}
      {faceLedgers.map(l => {
        const seg = bayToSeg(l.bayIndex);
        if (seg < 0 || seg >= xSegs.length) return null;
        const y = yOf(l.height);
        return (
          <line key={`led-${l.key}`}
            x1={PAD_L + xPos[seg] * SCALE} y1={y}
            x2={PAD_L + xPos[seg + 1] * SCALE} y2={y}
            stroke={LEDGER_COLOR} strokeWidth={2}
            pointerEvents="none"
          />
        );
      })}


      {/* ── Diagonal bracing ────────────────────────────────────────────────── */}
      {faceBracing.map(b => {
        const seg = bayToSeg(b.bayIndex);
        if (seg < 0 || seg >= xSegs.length) return null;
        const x1 = PAD_L + xPos[seg] * SCALE;
        const x2 = PAD_L + xPos[seg + 1] * SCALE;
        const yB = yOf(b.liftBottom);
        const yT = yOf(b.liftTop);
        const [bx1, bx2] = b.direction === '/' ? [x1, x2] : [x2, x1];
        // Bespoke (free tube: sub-2m remainder lifts and node-to-node manual
        // diagonals) draws dashed grey; off-the-shelf 2 m components solid gold.
        const isBespoke = b.bespoke ?? ((b.liftTop - b.liftBottom) < 2.0 - 1e-9);
        return (
          <line key={`brc-${b.key}`}
            x1={bx1} y1={yB} x2={bx2} y2={yT}
            stroke={isBespoke ? '#8a8a8a' : BRACE_COLOR}
            strokeWidth={1.5}
            strokeDasharray={isBespoke ? '6 4' : undefined}
            pointerEvents="none"
          />
        );
      })}


      {/* ── Delete mode: ledger hover highlight ─────────────────────────────── */}
      {activePlacementMode === 'ledger' && tool === 'delete' && hover?.snappedLedgerH != null && hover.segIdx >= 0 && (() => {
        const seg = hover.segIdx;
        const bayIdx = segToBay(seg);
        const key = `${faceName}-${bayIdx}-${hover.snappedLedgerH}`;
        if (!faceLedgers.some(l => l.key === key)) return null;
        const y = yOf(hover.snappedLedgerH);
        return (
          <line
            x1={PAD_L + xPos[seg] * SCALE} y1={y}
            x2={PAD_L + xPos[seg + 1] * SCALE} y2={y}
            stroke={DELETE_COLOR} strokeWidth={3}
            pointerEvents="none"
          />
        );
      })()}

      {/* ── Ledger ghost (hover in ledger mode) ─────────────────────────────── */}
      {activePlacementMode === 'ledger' && tool !== 'delete' && hover?.snappedLedgerH != null && hover.segIdx >= 0 && (() => {
        const seg = hover.segIdx;
        const y = yOf(hover.snappedLedgerH);
        return (
          <line
            x1={PAD_L + xPos[seg] * SCALE} y1={y}
            x2={PAD_L + xPos[seg + 1] * SCALE} y2={y}
            stroke={LEDGER_GHOST_COLOR} strokeWidth={2} strokeDasharray="6 3"
            pointerEvents="none"
          />
        );
      })()}

      {/* ── Delete mode: brace hover highlight ──────────────────────────────── */}
      {(activePlacementMode === 'brace' || activePlacementMode === 'bespoke') && tool === 'delete' && hover?.braceSegIdx >= 0 && (() => {
        const seg = hover.braceSegIdx;
        if (seg >= xSegs.length) return null;
        const bayIdx = segToBay(seg);
        const matchedBrace = braceUnderCursor(bayIdx, hover.heightFromGround);
        if (!matchedBrace) return null;
        const dir = matchedBrace.direction;
        const x1 = PAD_L + xPos[seg] * SCALE;
        const x2 = PAD_L + xPos[seg + 1] * SCALE;
        const yB = yOf(matchedBrace.liftBottom);
        const yT = yOf(matchedBrace.liftTop);
        const [bx1, bx2] = dir === '/' ? [x1, x2] : [x2, x1];
        return (
          <line
            x1={bx1} y1={yB} x2={bx2} y2={yT}
            stroke={DELETE_COLOR} strokeWidth={2.5}
            pointerEvents="none"
          />
        );
      })()}

      {/* ── Bespoke diagonal ghost: start marker, then start → hovered node ── */}
      {activePlacementMode === 'bespoke' && tool !== 'delete' && hover?.bespokeH != null && hover.braceSegIdx >= 0 && (() => {
        const seg = hover.braceSegIdx;
        if (seg >= xSegs.length) return null;
        const bayIdx = segToBay(seg);
        const xL = PAD_L + xPos[seg] * SCALE;
        const xR = PAD_L + xPos[seg + 1] * SCALE;
        const xOf = side => side === 'L' ? xL : xR;
        const hoverX = xOf(hover.bespokeSide), hoverY = yOf(hover.bespokeH);
        const startHere = bespokeStart && bespokeStart.bayIdx === bayIdx;
        return (
          <g pointerEvents="none">
            {startHere && (
              <>
                <circle cx={xOf(bespokeStart.side)} cy={yOf(bespokeStart.h)} r={5} fill="#8a8a8a" />
                <line x1={xOf(bespokeStart.side)} y1={yOf(bespokeStart.h)} x2={hoverX} y2={hoverY}
                  stroke="#8a8a8a" strokeWidth={2} strokeDasharray="6 4" />
              </>
            )}
            <circle cx={hoverX} cy={hoverY} r={5} fill="none" stroke="#8a8a8a" strokeWidth={1.5} strokeDasharray="3 2" />
          </g>
        );
      })()}

      {/* ── Brace ghost (hover in brace mode) ───────────────────────────────── */}
      {activePlacementMode === 'brace' && tool !== 'delete' && hover?.snapLiftBottom != null && (() => {
        const seg = hover.braceSegIdx >= 0 ? hover.braceSegIdx : 0;
        if (seg >= xSegs.length) return null;
        // Ghost: fixed 2 m span, base on the standard nearest the cursor
        // (screen-space direction; stored direction is flipped on mirrored faces)
        const dir = hover.snapDir;
        const x1 = PAD_L + xPos[seg] * SCALE;
        const x2 = PAD_L + xPos[seg + 1] * SCALE;
        const yB = yOf(hover.snapLiftBottom);
        const yT = yOf(hover.snapLiftTop);
        const [bx1, bx2] = dir === '/' ? [x1, x2] : [x2, x1];
        return (
          <line
            x1={bx1} y1={yB} x2={bx2} y2={yT}
            stroke={BRACE_GHOST_COLOR} strokeWidth={2} strokeDasharray="6 3"
            pointerEvents="none"
          />
        );
      })()}

      {/* ── Ladder beams (truss: top + bottom chord, zigzag web) ─────────── */}
      {beamsOnFace.map(b => {
        const yTop  = yOf(b.height);
        const yBot  = yTop + (b.depth != null ? b.depth * SCALE : LADDER_BEAM_DEPTH);
        const xL    = PAD_L;
        const xR    = PAD_L + totalX * SCALE;
        const step  = 0.5 * SCALE;
        const web   = [];
        for (let i = 0; xL + i * step < xR - 0.5; i++) {
          const x0 = xL + i * step;
          const x1 = Math.min(x0 + step, xR);
          const [wy1, wy2] = i % 2 === 0 ? [yBot, yTop] : [yTop, yBot];
          web.push(
            <line key={i} x1={x0} y1={wy1} x2={x1} y2={wy2}
              stroke={LADDER_BEAM_COLOR} strokeWidth={1} pointerEvents="none" />
          );
        }
        return (
          <g key={`lb-${b.id ?? b.height}`} pointerEvents="none">
            <line x1={xL} y1={yTop} x2={xR} y2={yTop} stroke={LADDER_BEAM_COLOR} strokeWidth={2} />
            <line x1={xL} y1={yBot} x2={xR} y2={yBot} stroke={LADDER_BEAM_COLOR} strokeWidth={2} />
            {web}
          </g>
        );
      })}

      {/* ── Ladder beam hover (place/delete preview) ─────────────────────── */}
      {hover && activePlacement === 'ladder' && hover.snappedLadderH != null && (() => {
        const y = yOf(hover.snappedLadderH);
        const hitBeam = beamsOnFace.find(b => b.height === hover.snappedLadderH);
        if (tool === 'delete') {
          if (!hitBeam) return null;
          return (
            <line
              x1={PAD_L} y1={y} x2={PAD_L + totalX * SCALE} y2={y}
              stroke={DELETE_COLOR} strokeWidth={3}
              pointerEvents="none"
            />
          );
        }
        if (hitBeam) return null;
        return (
          <line
            x1={PAD_L} y1={y} x2={PAD_L + totalX * SCALE} y2={y}
            stroke={LADDER_BEAM_COLOR} strokeWidth={2} strokeDasharray="6 3"
            pointerEvents="none"
          />
        );
      })()}

      {/* ── Placed tarp units ──────────────────────────────────────────────── */}
      {activeTarps.map((t, i) => {
        const idx  = bayToSeg(t.bayIndex);
        const yTop = Math.max(yOf(t.topHeight), roofLineY);
        const yBot = yOf(t.bottomHeight);
        return (
          <rect key={`et-${i}`}
            x={PAD_L + xPos[idx] * SCALE} y={yTop}
            width={xSegs[idx] * SCALE} height={yBot - yTop}
            fill={TARP_COLOR} fillOpacity={0.6}
            pointerEvents="none"
          />
        );
      })}

      {/* ── Tarp hover preview ─────────────────────────────────────────────── */}
      {hover && activePlacement === 'tarp' && (() => {
        const idx = hover.segIdx;
        if (tool === 'delete') {
          if (!hoveredTarp) return null;
          const yTop = Math.max(yOf(hoveredTarp.topHeight), roofLineY);
          const yBot = yOf(hoveredTarp.bottomHeight);
          return (
            <rect
              x={PAD_L + xPos[idx] * SCALE} y={yTop}
              width={xSegs[idx] * SCALE} height={yBot - yTop}
              fill={DELETE_COLOR} fillOpacity={0.25}
              stroke={DELETE_COLOR} strokeWidth={1.5}
              pointerEvents="none"
            />
          );
        }
        // Place mode: suppress ghost on any conflict, invalid face, or out-of-bounds
        const ghostFaceTop = getEffectiveFaceTop(faceName, segBayH(idx), roofType);
        if (!faceValid || tarpProposedTop > ghostFaceTop || hasTarpWindowConflict || hasTarpTarpConflict) return null;
        const ghostPBottom = hover.bottomNode * NODE_STEP;
        const ghostPTop    = ghostPBottom > 0 ? ghostPBottom + TARP_H : hover.snappedTarpTop;
        const yTop = yOf(ghostPTop);
        const yBot = yOf(ghostPBottom);
        return (
          <rect
            x={PAD_L + xPos[idx] * SCALE} y={yTop}
            width={xSegs[idx] * SCALE} height={yBot - yTop}
            fill={ROOF_COLOR} fillOpacity={0.25}
            stroke={ROOF_COLOR} strokeWidth={1.5}
            pointerEvents="none"
          />
        );
      })()}

      {/* ── Apex tarps (gable fill — side elevation only) */}
      {!isNS && roofLine && roofIdxList.map(idx => {
        const xL      = PAD_L + xPos[idx]     * SCALE;
        const xR      = PAD_L + xPos[idx + 1] * SCALE;
        const yHigh   = yOf(roofH - 0.5);
        const apexTopL = roofYatX(xL);
        const apexTopR = roofYatX(xR);
        const points  = `${xL},${apexTopL} ${xR},${apexTopR} ${xR},${yHigh} ${xL},${yHigh}`;
        return (
          <polygon key={`apex-${idx}`}
            points={points}
            fill={TARP_COLOR} opacity={0.85}
            pointerEvents="none"
          />
        );
      })}

      {/* ── Placed windows ─────────────────────────────────────────────────── */}
      {elevWindows.map((wn, i) => {
        const idx      = idxOf(wn);
        const xSeg     = PAD_L + xPos[idx] * SCALE;
        const segW     = xSegs[idx] * SCALE;
        const yTop     = yOf(wn.topHeight);
        const yBot     = yOf(wn.bottomHeight);
        const isDelHov = hoveredWindow === wn && tool === 'delete';
        return (
          <rect key={`ew-${i}`}
            x={xSeg} y={yTop} width={segW} height={yBot - yTop}
            fill={isDelHov ? 'rgba(239,68,68,0.15)' : 'rgba(255,255,255,0.08)'}
            stroke={isDelHov ? DELETE_COLOR : '#1a1a1a'}
            strokeWidth={3}
            pointerEvents="none"
          />
        );
      })}

      {/* ── Window ghost (hover preview while placing) ─────────────────────── */}
      {hover && activePlacement === 'window' && tool !== 'delete' && !hoveredWindow && (() => {
        const idx    = hover.segIdx;
        const bottom = hover.snappedBottom;
        const top    = bottom + windowHeight;
        if (top > segBayH(idx) + 1e-9) return null;
        const xSeg = PAD_L + xPos[idx] * SCALE;
        const segW = xSegs[idx] * SCALE;
        const yTop = yOf(top);
        const yBot = yOf(bottom);
        return (
          <rect
            x={xSeg} y={yTop} width={segW} height={yBot - yTop}
            fill="transparent"
            stroke={WIN_COLOR} strokeWidth={2} strokeDasharray="4 2"
            pointerEvents="none"
          />
        );
      })()}

      {/* Roof line — N/S: single horizontal; side: horizontal overhang + sloped segment */}
      {isNS && roofLine && (
        <line
          x1={roofLine.x1} y1={roofLine.y1}
          x2={roofLine.x2} y2={roofLine.y2}
          stroke={ROOF_COLOR} strokeWidth={2}
          pointerEvents="none"
        />
      )}
      {!isNS && sideRoofGeom && (() => {
        const { frontStdX, rearStdX, overhangX, roofFrontY, roofRearY } = sideRoofGeom;
        return (
          <>
            <line x1={overhangX} y1={roofFrontY} x2={frontStdX} y2={roofFrontY}
              stroke={ROOF_COLOR} strokeWidth={2} pointerEvents="none" />
            <line x1={frontStdX} y1={roofFrontY} x2={rearStdX} y2={roofRearY}
              stroke={ROOF_COLOR} strokeWidth={2} pointerEvents="none" />
          </>
        );
      })()}

      {/* Ground line */}
      <line
        x1={PAD_L - 4} y1={yGround}
        x2={PAD_L + totalX * SCALE + 4} y2={yGround}
        stroke="rgba(255,255,255,0.75)" strokeWidth={2}
      />

      {/* X segment dimension labels (top) */}
      {xSegs.map((len, i) => (
        <text key={`xl-${i}`}
          x={PAD_L + (xPos[i] + len / 2) * SCALE}
          y={PAD_T - 14}
          textAnchor="middle"
          fill={DIM_COLOR} fontSize={DIM_FONT}
          fontFamily="Barlow Condensed, sans-serif" letterSpacing="0.03em"
        >
          {len.toFixed(2)}m
        </text>
      ))}
      {xPos.map((x, i) => (
        <line key={`xt-${i}`}
          x1={PAD_L + x * SCALE} y1={PAD_T - 7}
          x2={PAD_L + x * SCALE} y2={PAD_T}
          stroke={DIM_COLOR} strokeWidth={1}
        />
      ))}

      {/* Right-side lift markers */}
      {Array.from({ length: lifts + 1 }, (_, i) => {
        const h = i * NODE_STEP;
        const y = yOf(h);
        return (
          <g key={`lm-${i}`}>
            <line
              x1={PAD_L + totalX * SCALE} y1={y}
              x2={PAD_L + totalX * SCALE + 7} y2={y}
              stroke={DIM_COLOR} strokeWidth={1}
            />
            <text
              x={PAD_L + totalX * SCALE + 10} y={y + 4}
              textAnchor="start"
              fill={DIM_COLOR} fontSize={10}
              fontFamily="Barlow Condensed, sans-serif" letterSpacing="0.03em"
            >
              {h.toFixed(1)}m
            </text>
          </g>
        );
      })}
    </svg>
  );
}

// ─── Root export ──────────────────────────────────────────────────────────────
export default function Canvas({ state, dispatch }) {
  const { activeView } = state;

  return (
    <div className="canvas-area">
      {activeView === 'plan' ? (
        <PlanView state={state} dispatch={dispatch} />
      ) : (
        <ElevationView key={state.activeFace} state={state} dispatch={dispatch} face={activeView} />
      )}
    </div>
  );
}
