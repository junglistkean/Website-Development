import React, { useState } from 'react';
import { BAY_LENGTHS, BAY_WIDTHS, WINDOW_HEIGHTS } from '../constants/layher';
import {
  clampBayHeight, maxBayHeight, MIN_BAY_HEIGHT, MAX_BAY_HEIGHT, facePattern,
  resolveBayHeights, levelBays, eligibleBays,
} from '../utils/scaffoldGeometry';

const levelName = id => id.split('_')[0];

const FACE_NAME = { N: 'front', S: 'back', W: 'left', E: 'right' };
const FACE_LABEL = { front: 'FRONT', back: 'BACK', left: 'SIDE L', right: 'SIDE R' };

const COL_MAX = 8;
const ROW_MAX = 8;

// Heights are entered and displayed in METRES (0.5 m increments — the store's
// node resolution). Lifts are an internal counting concept only and never
// appear in an input. Invalid entries snap to the nearest 0.5 m node.
const H_STEP = 0.5;

function parseMetres(raw) {
  const n = Number(raw);
  if (!isFinite(n) || n <= 0) return null;
  return clampBayHeight(n);
}

// Metres input that commits on blur / Enter (not per keystroke, so typing "12"
// doesn't apply "1" first).
function HeightInput({ metres, onCommit, title }) {
  const [draft, setDraft] = useState(null); // null = not editing
  const commit = () => {
    if (draft === null) return;
    const v = parseMetres(draft);
    setDraft(null);
    if (v !== null && v !== metres) onCommit(v);
  };
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }} title={title}>
      <input
        type="number"
        className="level-h-input"
        step={H_STEP}
        min={MIN_BAY_HEIGHT}
        max={MAX_BAY_HEIGHT}
        value={draft ?? metres}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === 'Enter') e.currentTarget.blur(); }}
        onClick={e => e.stopPropagation()}
      />
      <span className="level-unit">m</span>
    </span>
  );
}

function SidebarSection({ title, children }) {
  return (
    <section className="sb-section">
      <div className="sb-heading">{title}</div>
      {children}
    </section>
  );
}

export default function Sidebar({ state, dispatch }) {
  const {
    gridCols, gridRows, bayLengths, bayWidth,
    bayHeights = [],
    levels, activeLevelId,
    activePlacement, activePlacementMode, tool,
    windowHeight = 1.0,
    activeFace = 'N', bracingPattern = {},
  } = state;

  const patternFace = FACE_NAME[activeFace] ?? 'front';
  const pattern = facePattern(bracingPattern, patternFace);

  const maxHeight = maxBayHeight(bayHeights);

  // Per-bay deck-level membership (15 Sep 2026): each level lists the bays it
  // exists in; a bay can only be ticked when its height reaches the level.
  const resolvedHeights = resolveBayHeights(state);
  const memberOf   = Object.fromEntries(levels.map(l => [l.id, new Set(levelBays(l, resolvedHeights))]));
  const eligibleOf = Object.fromEntries(levels.map(l => [l.id, new Set(eligibleBays(l.height, resolvedHeights))]));

  // "Set all" shortcut — seeded from the first bay, applied on button / Enter.
  const [setAllDraft, setSetAllDraft] = useState(null);
  const setAllMetres = setAllDraft ?? (bayHeights[0] ?? 4);
  function applySetAll() {
    const v = parseMetres(setAllMetres);
    setSetAllDraft(null);
    if (v !== null) dispatch({ type: 'SET_ALL_BAY_HEIGHTS', value: v });
  }

  function togglePlacement(mode) {
    const activating = activePlacement !== mode;
    dispatch({ type: 'SET_ACTIVE_PLACEMENT', value: activating ? mode : null });
    if (activating) dispatch({ type: 'SET_TOOL', value: 'place' });
  }

  function snapToNode(value) {
    return Math.round(value * 2) / 2;
  }

  return (
    <aside className="sidebar">

      {/* ── PRESETS ──────────────────────────────────────────────────────── */}
      <SidebarSection title="Presets">
        <button
          className="sb-btn sb-btn--full"
          onClick={() => {
            if (window.confirm('Load 5m × 2.5m Layher Stage preset? This will replace the current structure.')) {
              dispatch({ type: 'LOAD_PRESET', presetId: '5m-stage' });
            }
          }}
        >
          5m × 2.5m Layher Stage
        </button>
      </SidebarSection>

      {/* ── STRUCTURE CONFIG ─────────────────────────────────────────────── */}
      <SidebarSection title="Structure Config">

        <div className="sb-row">
          <span className="sb-label">Bay Width</span>
          <div className="toggle-group">
            {BAY_WIDTHS.map(w => (
              <button
                key={w}
                className={`tog-btn${bayWidth === w ? ' active' : ''}`}
                onClick={() => dispatch({ type: 'SET_BAY_WIDTH', value: w })}
              >
                {w}m
              </button>
            ))}
          </div>
        </div>

        <div className="sb-row" title="Height in metres (0.5 m steps), applied to every bay. Per-bay heights are edited in the Bays list below.">
          <span className="sb-label">Height — all bays</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              className="level-h-input"
              step={H_STEP}
              min={MIN_BAY_HEIGHT}
              max={MAX_BAY_HEIGHT}
              value={setAllMetres}
              onChange={e => setSetAllDraft(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') applySetAll(); }}
            />
            <span className="level-unit">m</span>
            <button className="sb-btn" style={{ height: 22, padding: '0 8px' }} onClick={applySetAll}>
              SET ALL
            </button>
          </div>
        </div>

        <div className="sb-row">
          <span className="sb-label">Cols</span>
          <div className="stepper">
            <button
              onClick={() => dispatch({ type: 'SET_GRID_COLS', value: gridCols - 1 })}
              disabled={gridCols <= 1}
            >−</button>
            <span className="stepper-val">{gridCols}</span>
            <button
              onClick={() => dispatch({ type: 'SET_GRID_COLS', value: gridCols + 1 })}
              disabled={gridCols >= COL_MAX}
            >+</button>
          </div>
        </div>

        <div className="sb-row">
          <span className="sb-label">Rows</span>
          <div className="stepper">
            <button
              onClick={() => dispatch({ type: 'SET_GRID_ROWS', value: gridRows - 1 })}
              disabled={gridRows <= 1}
            >−</button>
            <span className="stepper-val">{gridRows}</span>
            <button
              onClick={() => dispatch({ type: 'SET_GRID_ROWS', value: gridRows + 1 })}
              disabled={gridRows >= ROW_MAX}
            >+</button>
          </div>
        </div>

        <div className="sb-row sb-row--col">
          <span className="sb-label">Bays — length · height (m){levels.length > 0 ? ' · deck levels' : ''}</span>
          <div className="bay-lengths-grid">
            {levels.length > 0 && (
              <div className="bay-len-row bay-len-row--head" aria-hidden="true">
                <span className="bay-len-col" />
                <span className="bay-len-spacer" />
                <span className="bay-levels">
                  {levels.map(l => (
                    <span key={l.id} className="bay-level-head" style={{ color: l.color }} title={`${levelName(l.id)} @ ${l.height} m`}>
                      {levelName(l.id)}
                    </span>
                  ))}
                </span>
              </div>
            )}
            {bayLengths.map((len, i) => (
              <div key={i} className="bay-len-row">
                <span className="bay-len-col">C{i + 1}</span>
                <select
                  className="sb-select"
                  value={len}
                  onChange={e => dispatch({
                    type: 'SET_BAY_LENGTH',
                    col: i,
                    value: Number(e.target.value),
                  })}
                >
                  {BAY_LENGTHS.map(l => (
                    <option key={l} value={l}>{l}m</option>
                  ))}
                </select>
                <HeightInput
                  metres={bayHeights[i] ?? maxHeight}
                  title={`Bay C${i + 1} height in metres (0.5 m steps)`}
                  onCommit={m => dispatch({ type: 'SET_BAY_HEIGHT', col: i, value: m })}
                />
                {levels.length > 0 && (
                  <span className="bay-levels">
                    {levels.map(l => {
                      const eligible = eligibleOf[l.id].has(i);
                      const member   = memberOf[l.id].has(i);
                      const title = !eligible
                        ? `${levelName(l.id)} @ ${l.height} m — unavailable: bay C${i + 1} is only ${resolvedHeights[i]} m`
                        : member
                          ? `${levelName(l.id)} @ ${l.height} m is in bay C${i + 1} — untick to remove`
                          : `Add ${levelName(l.id)} @ ${l.height} m to bay C${i + 1}`;
                      return (
                        <label key={l.id} className={`bay-level-tick${eligible ? '' : ' is-unavailable'}`} title={title}>
                          <input
                            type="checkbox"
                            checked={member}
                            disabled={!eligible}
                            onChange={() => dispatch({ type: 'TOGGLE_LEVEL_BAY', id: l.id, col: i })}
                            style={{ accentColor: l.color }}
                          />
                        </label>
                      );
                    })}
                  </span>
                )}
              </div>
            ))}
          </div>
          {bayHeights.some(h => h !== bayHeights[0]) && (
            <div className="bom-note bom-note--warn" style={{ marginTop: 2 }}>
              ⚠ Stepped structure — see caveats in the schedule
            </div>
          )}
        </div>


      </SidebarSection>

      {/* ── DECK LEVELS ──────────────────────────────────────────────────── */}
      <SidebarSection title="Deck Levels">

        <div className="levels-list">
          {levels.map(level => {
            return (
              <div
                key={level.id}
                className={`level-row${level.id === activeLevelId ? ' active' : ''}`}
                onClick={() => dispatch({ type: 'SET_ACTIVE_LEVEL', id: level.id })}
              >
                <span className="level-swatch" style={{ background: level.color }} />
                <span className="level-name">{levelName(level.id)}</span>
                <input
                  className="level-h-input"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={maxHeight}
                  value={level.height}
                  onClick={e => e.stopPropagation()}
                  onChange={e => {
                    const raw     = Number(e.target.value);
                    const snapped = snapToNode(raw);
                    dispatch({
                      type: 'UPDATE_LEVEL',
                      id: level.id,
                      changes: { height: Math.max(0.5, snapped) },
                    });
                  }}
                />
                <span className="level-unit">m</span>
                <span
                  className={`level-bays${memberOf[level.id].size === 0 ? ' level-bays--none' : ''}`}
                  title="Bays this level is in — tick bays in the Bays list above"
                >
                  {memberOf[level.id].size === 0
                    ? 'no bays'
                    : [...memberOf[level.id]].sort((a, b) => a - b).map(c => `C${c + 1}`).join(' ')}
                </span>
                <button
                  className="level-all"
                  onClick={e => {
                    e.stopPropagation();
                    dispatch({ type: 'SET_LEVEL_BAYS', id: level.id, bays: [...eligibleOf[level.id]] });
                  }}
                  disabled={eligibleOf[level.id].size === 0 || eligibleOf[level.id].size === memberOf[level.id].size}
                  title="Put this level in every bay tall enough for it"
                >ALL</button>
                <button
                  className="level-del"
                  onClick={e => {
                    e.stopPropagation();
                    dispatch({ type: 'REMOVE_LEVEL', id: level.id });
                  }}
                  title="Remove level"
                >✕</button>
              </div>
            );
          })}
        </div>

        <button
          className="sb-btn sb-btn--full"
          onClick={() => dispatch({ type: 'ADD_LEVEL' })}
        >
          + ADD LEVEL
        </button>

      </SidebarSection>

      {/* ── CLADDING ─────────────────────────────────────────────────────── */}
      <SidebarSection title="Cladding">

        <div
          className={`level-row${activePlacement === 'tarp' ? ' active' : ''}`}
          onClick={() => togglePlacement('tarp')}
        >
          <span className="level-swatch" style={{ background: '#c9a84c' }} />
          <span className="level-name">2m Tarp</span>
        </div>

        <div
          className={`level-row${activePlacement === 'window' ? ' active' : ''}`}
          onClick={() => togglePlacement('window')}
        >
          <span className="level-swatch" style={{ background: 'rgba(255,255,255,0.6)' }} />
          <span className="level-name">Window</span>
          <select
            className="sb-select"
            value={windowHeight}
            onClick={e => e.stopPropagation()}
            onChange={e => dispatch({ type: 'SET_WINDOW_HEIGHT', value: Number(e.target.value) })}
            style={{ marginLeft: 'auto', width: 64 }}
          >
            {WINDOW_HEIGHTS.map(h => (
              <option key={h} value={h}>{h}m</option>
            ))}
          </select>
        </div>

      </SidebarSection>

      {/* ── ROOF ─────────────────────────────────────────────────────────── */}
      <SidebarSection title="Roof">

        <div
          className={`level-row${activePlacement === 'roof' ? ' active' : ''}`}
          onClick={() => togglePlacement('roof')}
        >
          <span className="level-swatch" style={{ background: '#c9a84c' }} />
          <span className="level-name">Mono-pitch Roof Kit</span>
        </div>

      </SidebarSection>

      {/* ── STRUCTURE ────────────────────────────────────────────────────── */}
      <SidebarSection title="Structure">
        <div className="placement-grid">
          <button
            className={`place-btn${activePlacementMode === 'ledger' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_PLACEMENT_MODE', value: 'ledger' })}
          >
            LEDGERS
          </button>
          <button
            className={`place-btn${activePlacementMode === 'brace' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_PLACEMENT_MODE', value: 'brace' })}
            title="Off-the-shelf 2 m diagonal — base on any 0.5 m node"
          >
            BRACING
          </button>
          <button
            className={`place-btn${activePlacementMode === 'bespoke' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_PLACEMENT_MODE', value: 'bespoke' })}
            title="Bespoke free-tube diagonal — click a start node, then an end node on the other standard"
          >
            BESPOKE DIAG
          </button>
        </div>

        {/* Auto-bracing pattern for the face currently shown in elevation */}
        <div className="sb-row" style={{ marginTop: 8 }}
          title="Drawing preference only — brace counts and the BOM are identical either way">
          <span className="sb-label">Auto pattern · {FACE_LABEL[patternFace]}</span>
          <div className="toggle-group">
            <button
              className={`tog-btn${pattern.mode === 'alternating' ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_BRACING_PATTERN', face: patternFace, mode: 'alternating' })}
            >ALT</button>
            <button
              className={`tog-btn${pattern.mode === 'same' ? ' active' : ''}`}
              onClick={() => dispatch({ type: 'SET_BRACING_PATTERN', face: patternFace, mode: 'same' })}
            >SAME</button>
          </div>
        </div>
        {pattern.mode === 'same' && (
          <div className="sb-row">
            <span className="sb-label">Lean</span>
            <div className="toggle-group">
              <button
                className={`tog-btn${pattern.lean === 'L' ? ' active' : ''}`}
                onClick={() => dispatch({ type: 'SET_BRACING_PATTERN', face: patternFace, lean: 'L' })}
                title="Base on the left standard (/)"
              >L /</button>
              <button
                className={`tog-btn${pattern.lean === 'R' ? ' active' : ''}`}
                onClick={() => dispatch({ type: 'SET_BRACING_PATTERN', face: patternFace, lean: 'R' })}
                title="Base on the right standard (\)"
              >R \</button>
            </div>
          </div>
        )}

        <button
          className="sb-btn sb-btn--full"
          style={{ marginTop: 8 }}
          onClick={() => dispatch({ type: 'REAPPLY_AUTO_BRACING' })}
          title="Regenerate the auto-brace pattern from the current geometry (clears removed-brace suppressions; openings made by removing ledgers get no braces; manual braces and bespoke diagonals are kept)"
        >
          RE-APPLY AUTO BRACING
        </button>
      </SidebarSection>

      {/* ── TOOL ─────────────────────────────────────────────────────────── */}
      <SidebarSection title="Tool">
        <div className="toggle-group">
          <button
            className={`tog-btn${tool === 'place' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TOOL', value: 'place' })}
          >
            + PLACE
          </button>
          <button
            className={`tog-btn tog-btn--danger${tool === 'delete' ? ' active' : ''}`}
            onClick={() => dispatch({ type: 'SET_TOOL', value: 'delete' })}
          >
            ✕ DELETE
          </button>
        </div>
      </SidebarSection>

      {/* ── FLAGS ────────────────────────────────────────────────────────── */}
      <SidebarSection title="Flags">
        <div className="flag-row">
          <span className="flag-icon">⚠</span>
          <div className="flag-text">
            <strong>ACCESS</strong><br />
            Contact Raven to discuss internal and external access options.
          </div>
        </div>
        <div className="flag-row">
          <span className="flag-icon">⚠</span>
          <div className="flag-text">
            <strong>BALLAST &amp; ENGINEERING</strong><br />
            Ballast requirements depend on height, size, and site. Engineer's report recommended — Raven can source on request.
          </div>
        </div>
      </SidebarSection>

    </aside>
  );
}
