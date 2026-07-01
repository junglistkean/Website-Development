import React, { createContext, useContext, useReducer } from 'react';
import {
  DEFAULT_BAY_LENGTH, DEFAULT_BAY_WIDTH,
  DEFAULT_STACK, NODE_INTERVAL, LEVEL_COLORS,
  PANS_PER_BAY_257, PANS_PER_BAY_207,
} from '../constants/layher';
import {
  getLedgerHeights,
  getAutoLedgersWithOverrides,
  getAutoBracingWithOverrides,
  getBracingCladConflicts,
  MAX_LIFT_GAP,
} from '../utils/scaffoldGeometry';

// ─── Initial state ────────────────────────────────────────────────────────────

const INITIAL_COLS = 1;
const INITIAL_ROWS = 1;

// Transoms are DISABLED across all layouts — they generate height-driven (2 per
// lift per row gap) but are not stocked, and a level/platform is built on ledgers
// only. They return as the Litedeck deck-support piece when decking is stocked;
// flip this to true to reinstate (also re-add the Transoms BOM section in
// BomPanel.jsx and a QB PRICE_LIST key — none exists yet).
const TRANSOMS_ENABLED = false;

function makeBayLengths(cols, existing = []) {
  return Array.from({ length: cols }, (_, i) => existing[i] ?? DEFAULT_BAY_LENGTH);
}

const initialState = {
  gridCols: INITIAL_COLS,
  gridRows: INITIAL_ROWS,
  bayLengths: [2.57],
  bayWidth: DEFAULT_BAY_WIDTH,
  structureHeight: 4.0,

  levels: [
    {
      id: 'L1',
      height: 2.0,
      color: LEVEL_COLORS[0],
    },
  ],
  activeLevelId: 'L1',

  placedPans: [],
  tarps: [],
  windows: [],
  roofBays: [],
  ladderBeams: [],

  ledgerOverrides: { removed: [], added: [] },
  bracingOverrides: { removed: [], added: [] },
  activePlacementMode: null,

  suppressedStdPositions: [],
  bomExtras: [],

  renderMode: 'skeleton',
  activeView: 'plan',
  activeFace: 'N',
  tool: 'place',
  activePlacement: null,
  windowHeight: 1.0,

  // Stage-lineage key for the QB "pending layout" push (Path B). null on a fresh
  // layout; set from the push response's runningId and persisted by handleSave
  // (it serialises state, so this rides along) / rehydrated by LOAD_STATE. Lets a
  // re-send of the same layout REPLACE the prior pending row instead of piling up
  // duplicates. Mirrors litedeck's currentRunningId (carried in exportLayoutJson).
  runningId: null,

  history: [],
};

// ─── Tarp migration (legacy bottomNode → bottomHeight/topHeight) ─────────────

function migrateTarps(state) {
  if (!state.tarps?.length) return state;
  const faceMap = { N: 'front', S: 'back', W: 'left', E: 'right' };
  return {
    ...state,
    tarps: state.tarps.map(t => {
      if (t.bottomNode !== undefined && t.bottomHeight === undefined) {
        const face     = faceMap[t.face] ?? t.face;
        const bayIndex = (t.face === 'N' || t.face === 'S') ? t.col : t.row;
        return { id: `m-${Date.now()}-${Math.random()}`, face, bayIndex,
          bottomHeight: t.bottomNode * 0.5, topHeight: t.bottomNode * 0.5 + 2.0 };
      }
      return t;
    }),
  };
}

// ─── Undo helpers ─────────────────────────────────────────────────────────────

function snapshot(state) {
  const { history, ...rest } = state;
  return rest;
}

function record(newState, prevState) {
  return {
    ...newState,
    history: [...prevState.history.slice(-50), snapshot(prevState)],
  };
}

// ─── Presets ──────────────────────────────────────────────────────────────────

function preset5mStage() {
  // Level at 0.5m → getLedgerHeights(3.0, [0.5]) = [0.5, 1.5, 2, 3]
  // brace keys:  bracingHeights at 2m intervals = [2, 3] (independent of level)
  return {
    ...initialState,
    gridCols: 2,
    gridRows: 1,
    bayLengths: [2.57, 2.57],
    bayWidth: 2.57,
    structureHeight: 3.0,
    levels: [{ id: 'L1', height: 0.5, color: LEVEL_COLORS[0] }],
    activeLevelId: 'L1',
    placedPans: [],
    roofBays: [[0, 0], [1, 0]],
    ladderBeams: [
      { id: 'preset-lb-front',   face: 'front', height: 3.0 },
      { id: 'preset-deck-frame', face: 'front', height: 0.5, depth: 0.175 },
    ],
    tarps: [
      { id: 'pt-back-0',  face: 'back',  bayIndex: 0, bottomHeight: 0.5, topHeight: 2.5 },
      { id: 'pt-back-1',  face: 'back',  bayIndex: 1, bottomHeight: 0.5, topHeight: 2.5 },
      { id: 'pt-left-0',  face: 'left',  bayIndex: 0, bottomHeight: 0.5, topHeight: 2.5 },
      { id: 'pt-right-0', face: 'right', bayIndex: 0, bottomHeight: 0.5, topHeight: 2.5 },
    ],
    windows: [],
    ledgerOverrides: {
      // Keys match getLedgerHeights(3.0, [0.5]) = [0.5, 1.5, 2, 3] on front face
      removed: [
        'front-0-0.5', 'front-0-1.5', 'front-0-2', 'front-0-3',
        'front-1-0.5', 'front-1-1.5', 'front-1-2', 'front-1-3',
      ],
      added: [],
    },
    bracingOverrides: {
      removed: [
        'front-0-0-2', 'front-1-0-2',
        'front-0-2-3', 'front-1-2-3',
      ],
      added: [],
    },
    suppressedStdPositions: ['1,0'],
    bomExtras: [
      { description: "8' × 4' Litedeck panel", qty: 4 },
      { description: "1'6\" tube", qty: 16 },
    ],
    activeView: 'front',
    activeFace: 'N',
    tool: 'place',
    history: [],
  };
}

// ─── Reducer ──────────────────────────────────────────────────────────────────

function reducer(state, action) {
  switch (action.type) {

    case 'SET_BAY_WIDTH':
      return record({ ...state, bayWidth: action.value }, state);

    case 'SET_STRUCTURE_HEIGHT': {
      const h = Math.min(30, Math.max(0.5, Math.round(action.payload * 2) / 2));
      return record({
        ...state,
        structureHeight: h,
        levels: state.levels.map(l => l.height > h ? { ...l, height: h } : l),
      }, state);
    }

    case 'SET_GRID_COLS': {
      const cols = Math.max(1, Math.min(16, action.value));
      const newLengths = makeBayLengths(cols, state.bayLengths);
      return record({
        ...state,
        gridCols: cols,
        bayLengths: newLengths,
        placedPans: state.placedPans.filter(p => p.col < cols),
        tarps: state.tarps.filter(t => (t.face === 'left' || t.face === 'right') || t.bayIndex < cols),
        windows: state.windows.filter(w => w.col < cols),
        roofBays: state.roofBays.filter(([c]) => c < cols),
      }, state);
    }

    case 'SET_GRID_ROWS': {
      const rows = Math.max(1, Math.min(16, action.value));
      return record({
        ...state,
        gridRows: rows,
        placedPans: state.placedPans.filter(p => p.row < rows),
        tarps: state.tarps.filter(t => (t.face === 'front' || t.face === 'back') || t.bayIndex < rows),
        windows: state.windows.filter(w => w.row < rows),
        roofBays: state.roofBays.filter(([, r]) => r < rows),
      }, state);
    }

    case 'SET_BAY_LENGTH': {
      const newLengths = [...state.bayLengths];
      newLengths[action.col] = action.value;
      return record({ ...state, bayLengths: newLengths }, state);
    }

    case 'ADD_LEVEL': {
      const idx = state.levels.length;
      const maxExisting = idx > 0 ? Math.max(...state.levels.map(l => l.height)) : 0;
      const nextH = Math.round((maxExisting + 0.5) * 2) / 2;
      const newLevel = {
        id: `L${idx + 1}_${Date.now()}`,
        height: Math.min(state.structureHeight, Math.max(0.5, nextH)),
        color: LEVEL_COLORS[idx % LEVEL_COLORS.length],
      };
      return record({
        ...state,
        levels: [...state.levels, newLevel],
        activeLevelId: newLevel.id,
      }, state);
    }

    case 'REMOVE_LEVEL': {
      const remaining = state.levels.filter(l => l.id !== action.id);
      const nextActiveId = state.activeLevelId === action.id
        ? (remaining.length > 0 ? remaining[remaining.length - 1].id : null)
        : state.activeLevelId;
      return record({
        ...state,
        levels: remaining,
        activeLevelId: nextActiveId,
        placedPans: state.placedPans.filter(p => p.levelId !== action.id),
      }, state);
    }

    case 'UPDATE_LEVEL': {
      const changes = action.changes.height !== undefined
        ? { ...action.changes, height: Math.min(state.structureHeight, action.changes.height) }
        : action.changes;
      return record({
        ...state,
        levels: state.levels.map(l =>
          l.id === action.id ? { ...l, ...changes } : l
        ),
      }, state);
    }

    case 'SET_ACTIVE_LEVEL':
      return { ...state, activeLevelId: action.id, activePlacementMode: 'deck', activePlacement: null, activeView: 'plan' };

    case 'PLACE_PAN': {
      const { col, row, slotIndex, levelId } = action;
      const occupied = state.placedPans.some(
        p => p.col === col && p.row === row && p.slotIndex === slotIndex && p.levelId === levelId
      );
      if (occupied) return state;
      const id = `pan-${col}-${row}-${slotIndex}-${levelId}`;
      return record({
        ...state,
        placedPans: [...state.placedPans, { id, col, row, slotIndex, levelId }],
      }, state);
    }

    case 'REMOVE_PAN': {
      const { col, row, slotIndex, levelId } = action;
      return record({
        ...state,
        placedPans: state.placedPans.filter(
          p => !(p.col === col && p.row === row && p.slotIndex === slotIndex && p.levelId === levelId)
        ),
      }, state);
    }

    case 'SET_TOOL':
      return { ...state, tool: action.value };

    case 'SET_ACTIVE_FACE':
      return { ...state, activeFace: action.value };

    case 'SET_ACTIVE_PLACEMENT': {
      const v = action.value;
      let nextView = state.activeView;
      let nextFace = state.activeFace;
      if (v === 'tarp' || v === 'window' || v === 'ladder') {
        if (state.activeView === 'plan') { nextView = 'front'; nextFace = 'N'; }
      } else if (v === 'roof' || v === null) {
        nextView = 'plan';
      }
      return { ...state, activePlacement: v, activePlacementMode: null, activeLevelId: null, activeView: nextView, activeFace: nextFace };
    }

    case 'SET_WINDOW_HEIGHT':
      return { ...state, windowHeight: action.value };

    case 'SET_RENDER_MODE':
      return { ...state, renderMode: action.value };

    case 'SET_ACTIVE_VIEW':
      return { ...state, activeView: action.value };

    case 'ADD_TARP':
      return record({
        ...state,
        tarps: [...state.tarps, {
          id: action.id,
          face: action.face,
          bayIndex: action.bayIndex,
          bottomHeight: action.bottomHeight,
          topHeight: action.topHeight,
        }],
      }, state);

    case 'REMOVE_TARP':
      return record({
        ...state,
        tarps: state.tarps.filter(t => t.id !== action.id),
      }, state);

    case 'TOGGLE_TARP': {
      const { col, row, face, bottomNode } = action;
      const exists = state.tarps.some(t =>
        t.col === col && t.row === row && t.face === face && t.bottomNode === bottomNode
      );
      return record({
        ...state,
        tarps: exists
          ? state.tarps.filter(t =>
              !(t.col === col && t.row === row && t.face === face && t.bottomNode === bottomNode)
            )
          : [...state.tarps, { col, row, face, bottomNode }],
      }, state);
    }

    case 'ADD_WINDOW':
      return record({
        ...state,
        windows: [...state.windows, {
          col: action.col, row: action.row, face: action.face,
          bottomHeight: action.bottomHeight, topHeight: action.topHeight,
          width: action.width,
        }],
      }, state);

    case 'REMOVE_WINDOW': {
      const { col, row, face, bottomHeight } = action;
      return record({
        ...state,
        windows: state.windows.filter(w =>
          !(w.col === col && w.row === row && w.face === face && w.bottomHeight === bottomHeight)
        ),
      }, state);
    }

    case 'TOGGLE_ROOF_BAY':
    case 'TOGGLE_ROOF': {
      const { col, row } = action;
      const exists = state.roofBays.some(([c, r]) => c === col && r === row);
      return record({
        ...state,
        roofBays: exists
          ? state.roofBays.filter(([c, r]) => !(c === col && r === row))
          : [...state.roofBays, [col, row]],
        ...(exists ? {} : { activeLevelId: null, activePlacementMode: null }),
      }, state);
    }

    case 'ADD_LADDER_BEAM':
      return record({ ...state, ladderBeams: [...state.ladderBeams, action.beam] }, state);

    case 'REMOVE_LADDER_BEAM':
      return record({
        ...state,
        ladderBeams: state.ladderBeams.filter(b => b.id !== action.id),
      }, state);

    case 'REMOVE_LEDGER':
      return record({
        ...state,
        ledgerOverrides: {
          ...state.ledgerOverrides,
          removed: [...state.ledgerOverrides.removed, action.key],
        },
      }, state);

    case 'ADD_LEDGER': {
      const key = action.key;
      return record({
        ...state,
        ledgerOverrides: {
          removed: state.ledgerOverrides.removed.filter(k => k !== key),
          added: state.ledgerOverrides.added.includes(key)
            ? state.ledgerOverrides.added
            : [...state.ledgerOverrides.added, key],
        },
      }, state);
    }

    case 'REMOVE_BRACE':
      return record({
        ...state,
        bracingOverrides: {
          ...state.bracingOverrides,
          removed: [...state.bracingOverrides.removed, action.key],
        },
      }, state);

    case 'ADD_BRACE': {
      const key = action.key;
      return record({
        ...state,
        bracingOverrides: {
          removed: state.bracingOverrides.removed.filter(k => k !== key),
          added: state.bracingOverrides.added.includes(key)
            ? state.bracingOverrides.added
            : [...state.bracingOverrides.added, key],
        },
      }, state);
    }

    case 'SET_PLACEMENT_MODE': {
      const mode = action.value;
      const toggling = state.activePlacementMode === mode;
      const nextMode = toggling ? null : mode;
      let nextView = state.activeView;
      if (nextMode === 'ledger' || nextMode === 'brace') {
        if (state.activeView === 'plan') nextView = 'front';
      } else if (nextMode === 'deck') {
        nextView = 'plan';
      }
      return {
        ...state,
        activePlacementMode: nextMode,
        activePlacement: nextMode ? null : state.activePlacement,
        activeLevelId: nextMode ? null : state.activeLevelId,
        activeView: nextView,
      };
    }

    case 'LOAD_PRESET': {
      const presets = { '5m-stage': preset5mStage };
      const factory = presets[action.presetId];
      if (!factory) return state;
      return factory();
    }

    case 'UNDO': {
      if (state.history.length === 0) return state;
      const prev = state.history[state.history.length - 1];
      return { ...prev, history: state.history.slice(0, -1) };
    }

    case 'CLEAR':
      return { ...initialState, history: [] };

    case 'LOAD':
      return { ...migrateTarps(action.state), history: [] };

    case 'LOAD_STATE':
      return migrateTarps({ ...initialState, ...action.payload, history: [] });

    // Stamp the QB stage-lineage id after a successful "pending layout" push.
    // Not an undoable edit (no record()) — it's push metadata, not a canvas change.
    case 'SET_RUNNING_ID':
      return { ...state, runningId: action.value };

    default:
      return state;
  }
}

// ─── BOM calculation (pure functions) ────────────────────────────────────────

function calcStandardStack(height, stackPref) {
  const counts = {};
  let rem = Math.round(height * 100) / 100;
  for (const len of stackPref) {
    if (rem < 0.01) break;
    const n = Math.floor((rem + 1e-9) / len);
    if (n > 0) {
      counts[len] = n;
      rem = Math.round((rem - n * len) * 100) / 100;
    }
  }
  return counts;
}

export function calculateBom(state) {
  const {
    gridCols, gridRows, bayLengths, bayWidth,
    structureHeight, levels, placedPans = [], tarps, windows, roofBays, ladderBeams,
    ledgerOverrides = { removed: [], added: [] },
    bracingOverrides = { removed: [], added: [] },
    suppressedStdPositions = [],
    bomExtras = [],
  } = state;

  const suppressedPosSet = new Set(suppressedStdPositions);

  const lifts = Math.round(structureHeight / NODE_INTERVAL);

  // Rear-only roof standard positions stack to structureHeight - 0.5m (mono-pitch keder geometry)
  const rearRoofPositions  = new Set();
  const frontRoofPositions = new Set();
  for (const [bayCol, bayRow] of roofBays) {
    for (let c = bayCol; c <= bayCol + 1; c++) {
      frontRoofPositions.add(`${c},${bayRow}`);
      rearRoofPositions.add(`${c},${bayRow + 1}`);
    }
  }
  for (const k of frontRoofPositions) rearRoofPositions.delete(k);

  const stackFull = calcStandardStack(structureHeight, DEFAULT_STACK);
  const stackRear = structureHeight > 0.5
    ? calcStandardStack(structureHeight - 0.5, DEFAULT_STACK)
    : stackFull;

  // Ladder beams suppress the tube above beam height for intermediate standard positions
  const suppressedH = {}; // `${c},${r}` → min beam height across all beams on that position
  for (const beam of ladderBeams) {
    if (!beam.face || beam.height == null) continue;
    if (beam.face === 'front') {
      for (let c = 1; c < gridCols; c++)
        suppressedH[`${c},0`] = Math.min(suppressedH[`${c},0`] ?? Infinity, beam.height);
    } else if (beam.face === 'back') {
      for (let c = 1; c < gridCols; c++)
        suppressedH[`${c},${gridRows}`] = Math.min(suppressedH[`${c},${gridRows}`] ?? Infinity, beam.height);
    } else if (beam.face === 'left') {
      for (let r = 1; r < gridRows; r++)
        suppressedH[`0,${r}`] = Math.min(suppressedH[`0,${r}`] ?? Infinity, beam.height);
    } else if (beam.face === 'right') {
      for (let r = 1; r < gridRows; r++)
        suppressedH[`${gridCols},${r}`] = Math.min(suppressedH[`${gridCols},${r}`] ?? Infinity, beam.height);
    }
  }

  const standards = {};
  for (let r = 0; r <= gridRows; r++) {
    for (let c = 0; c <= gridCols; c++) {
      const key = `${c},${r}`;
      if (suppressedPosSet.has(key)) continue;
      const suppH = suppressedH[key];
      let s;
      if (suppH !== undefined) {
        s = calcStandardStack(suppH, DEFAULT_STACK);
      } else if (rearRoofPositions.has(key)) {
        s = stackRear;
      } else {
        s = stackFull;
      }
      for (const [len, n] of Object.entries(s)) {
        standards[Number(len)] = (standards[Number(len)] ?? 0) + n;
      }
    }
  }

  // Ledgers — derive from geometry with overrides
  const roofType = roofBays && roofBays.length > 0 ? 'monoPitch' : null;
  const levelHeights = levels.map(l => l.height);
  const ledgerHeights = getLedgerHeights(structureHeight, levelHeights);

  const { ledgers: ledgerList, removedCount: removedLedgerCount } =
    getAutoLedgersWithOverrides(gridCols, gridRows, ledgerHeights, ledgerOverrides, structureHeight, roofType);

  // Ledgers at the same face+height as a ladder beam are replaced by the beam — suppress them
  const beamFaceHeights = new Set(
    ladderBeams.filter(b => b.face && b.height != null).map(b => `${b.face}-${b.height}`)
  );
  const filteredLedgerList = ledgerList.filter(l => !beamFaceHeights.has(`${l.face}-${l.height}`));

  // Group ledgers by length: front/back use bay column length; left/right use bayWidth
  const ledgers = {};
  for (const l of filteredLedgerList) {
    let len;
    if (l.face === 'front' || l.face === 'back') {
      len = bayLengths[l.bayIndex] ?? DEFAULT_BAY_LENGTH;
    } else {
      len = bayWidth;
    }
    ledgers[len] = (ledgers[len] ?? 0) + 1;
  }

  // Transoms — standard bayWidth transom per lift per row gap. DISABLED via
  // TRANSOMS_ENABLED (not stocked); empty when off so bom.transoms stays a stable
  // shape and reinstating is a one-line flag flip. See TRANSOMS_ENABLED above.
  const transomCountPerLift = (gridCols + 1) * gridRows;
  const transoms = TRANSOMS_ENABLED ? { [bayWidth]: transomCountPerLift * lifts } : {};

  // Diagonal braces — derive from geometry with overrides
  const { bracing: braceList, removedCount: removedBraceCount } =
    getAutoBracingWithOverrides(gridCols, gridRows, ledgerHeights, bracingOverrides, structureHeight, roofType);

  const DIAG_BRACE_KEYS = {
    2.57: '3.18m diagonal brace (2.57m bay)',
    2.07: '2.81m diagonal brace (2.07m bay)',
  };
  const PLAN_BRACE_KEYS = {
    '2.57_2.57': '3.64m plan brace (2.57 x 2.57m bay)',
    '2.57_2.07': '3.30m plan brace (2.57 x 2.07m bay)',
    '2.07_2.57': '3.30m plan brace (2.57 x 2.07m bay)',
    '2.07_2.07': '2.93m plan brace (2.07 x 2.07m bay)',
  };

  // Facade diagonal braces — standard lifts use named keys; sub-2m remainder lifts recorded as unbraced
  const braces = {};
  const unbracedTopLifts = [];
  for (const brace of braceList) {
    const span = brace.face === 'front' || brace.face === 'back'
      ? Math.round((bayLengths[brace.bayIndex] ?? DEFAULT_BAY_LENGTH) * 100) / 100
      : Math.round(bayWidth * 100) / 100;
    const liftHeight = Math.round((brace.liftTop - brace.liftBottom) * 100) / 100;
    if (liftHeight < MAX_LIFT_GAP - 1e-9) {
      const diagLen = Math.round(Math.sqrt(span * span + liftHeight * liftHeight) * 100) / 100;
      const swivels = ledgerHeights.filter(
        h => h >= brace.liftBottom - 1e-9 && h <= brace.liftTop + 1e-9
      ).length;
      unbracedTopLifts.push({ face: brace.face, bayIndex: brace.bayIndex, liftHeight, span, diagLen, swivels });
    } else {
      const key = DIAG_BRACE_KEYS[span] ?? `${span}m diagonal brace`;
      braces[key] = (braces[key] ?? 0) + 1;
    }
  }

  // Plan braces — one per bay cell, keyed by bay dimensions
  const planBraces = {};
  for (let c = 0; c < gridCols; c++) {
    for (let r = 0; r < gridRows; r++) {
      const bLen = Math.round((bayLengths[c] ?? DEFAULT_BAY_LENGTH) * 100) / 100;
      const bWid = Math.round(bayWidth * 100) / 100;
      const sortedKey = [bLen, bWid].sort((a, b) => b - a).join('_');
      const key = PLAN_BRACE_KEYS[sortedKey] ?? `${bLen}×${bWid}m plan brace`;
      planBraces[key] = (planBraces[key] ?? 0) + 1;
    }
  }

  // Conflict detection
  const bracingConflicts = getBracingCladConflicts(braceList, []);

  // Base plates — one per standard position, excluding suppressed (central base-only) positions
  const numStdPositions = (gridCols + 1) * (gridRows + 1);
  let basePlates = numStdPositions - suppressedPosSet.size;
  // Suppressed positions (e.g. central base point in 5m-stage) still have base hardware
  // and adjacent ledgers — compensate here rather than using bomExtras for clean BOM totals
  if (suppressedPosSet.size > 0) {
    basePlates += suppressedPosSet.size;
    ledgers[2.57] = (ledgers[2.57] ?? 0) + 3;
  }

  // Decking — one entry per placed pan; pan length = bay length
  const deckPans = {};
  for (const pan of placedPans) {
    const panLength = Math.round((bayLengths[pan.col] ?? DEFAULT_BAY_LENGTH) * 100) / 100;
    deckPans[panLength] = (deckPans[panLength] ?? 0) + 1;
  }

  // Gap fillers — one per unique bay (col,row) that has any pans, only in 2.07m wide bays
  const gapFillerBays = new Set(
    bayWidth === 2.07 ? placedPans.map(p => `${p.col},${p.row}`) : []
  );
  const gapFillers = gapFillerBays.size;

  // Roof kits
  const roofKitCount = roofBays.length;

  // Tarps — each entry is one 2.57m unit
  const tarpCount = tarps.length;

  // Apex tarps — two per structure (front + back ridge) when any roof bays are present
  const apexTarpCount = roofBays.length > 0 ? 2 : 0;

  // Roof tarps — one keder tarp per roof bay
  const roofTarpCount = roofBays.length;
  // Keder beams run front-to-back at each standard column; adjacent bays share the central beam
  const kederBeamCols = new Set();
  for (const [col] of roofBays) { kederBeamCols.add(col); kederBeamCols.add(col + 1); }
  const kederRoofBeamCount = kederBeamCols.size;
  const tarpTubeCount      = roofBays.length * 2;
  const keyclampTubeEndCount = roofBays.length * 6;
  const roofBraceCount     = roofBays.length * 2;

  // Ladder beams — compute total span per beam; exclude deck-frame beams (have depth set)
  const ladderBeamSpans = ladderBeams
    .filter(b => b.face && b.height != null && b.depth == null)
    .map(b => {
      const span = (b.face === 'front' || b.face === 'back')
        ? Math.round(bayLengths.reduce((s, l) => s + l, 0) * 100) / 100
        : Math.round(bayWidth * gridRows * 100) / 100;
      return { face: b.face, height: b.height, span };
    });

  // Windows
  const windowCount = windows.length;

  // Roof bays with no placed pans beneath
  const undeckedRoofBays = roofBays.filter(([c, r]) =>
    !placedPans.some(p => p.col === c && p.row === r)
  ).length;

  return {
    standards,
    ledgers,
    transoms,
    braces,
    planBraces,
    unbracedTopLifts,
    basePlates,
    deckPans,
    gapFillers,
    roofKitCount,
    tarpCount,
    apexTarpCount,
    roofTarpCount,
    kederRoofBeamCount,
    tarpTubeCount,
    keyclampTubeEndCount,
    roofBraceCount,
    ladderBeamSpans,
    windowCount,
    undeckedRoofBays,
    removedLedgerCount,
    removedBraceCount,
    bracingConflicts,
    bomExtras,
  };
}

// ─── Context ──────────────────────────────────────────────────────────────────

const ScaffoldContext = createContext(null);

export function ScaffoldProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return React.createElement(
    ScaffoldContext.Provider,
    { value: { state, dispatch } },
    children
  );
}

export function useScaffold() {
  const ctx = useContext(ScaffoldContext);
  if (!ctx) throw new Error('useScaffold must be used within ScaffoldProvider');
  return ctx;
}
