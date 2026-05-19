import React from 'react';
import { BAY_LENGTHS, BAY_WIDTHS, WINDOW_HEIGHTS } from '../constants/layher';

const COL_MAX = 8;
const ROW_MAX = 8;

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
    structureHeight,
    levels, activeLevelId, placedPans,
    activePlacement, activePlacementMode, tool,
    windowHeight = 1.0,
  } = state;

  const activeLevel = levels.find(l => l.id === activeLevelId);

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

        <div className="sb-row">
          <span className="sb-label">Structure Height</span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <input
              type="number"
              className="level-h-input"
              step="0.5"
              min="0.5"
              max="30"
              value={structureHeight}
              onChange={e => {
                const raw = Number(e.target.value);
                if (!isNaN(raw) && raw > 0) {
                  dispatch({ type: 'SET_STRUCTURE_HEIGHT', payload: raw });
                }
              }}
            />
            <span className="level-unit">m</span>
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
          <span className="sb-label">Bay Lengths</span>
          <div className="bay-lengths-grid">
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
              </div>
            ))}
          </div>
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
                <span className="level-name">{level.id.split('_')[0]}</span>
                <input
                  className="level-h-input"
                  type="number"
                  step="0.5"
                  min="0.5"
                  max={structureHeight}
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
          >
            BRACING
          </button>
        </div>
      </SidebarSection>

      {/* ── LADDER BEAM ──────────────────────────────────────────────────── */}
      <SidebarSection title="Ladder Beam">
        <button
          className={`place-btn place-btn--full${activePlacement === 'ladder' ? ' active' : ''}`}
          onClick={() => togglePlacement('ladder')}
        >
          ADD LADDER BEAM
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
