import React from 'react';
import { resolveBayHeights, describeHeights, levelBays } from '../utils/scaffoldGeometry';

export default function StatusBar({ state }) {
  const {
    gridCols, gridRows, bayLengths, bayWidth,
    tool, activePlacement, activeLevelId, levels,
  } = state;

  const totalWidth = bayLengths.reduce((a, b) => a + b, 0).toFixed(2);
  const totalDepth = (gridRows * bayWidth).toFixed(2);
  const bayHeights  = resolveBayHeights(state);
  const heightLabel = describeHeights(bayHeights);
  const activeLevel = levels.find(l => l.id === activeLevelId);
  // Bays the active level is in (per-bay deck levels). The old "(Litedeck)"
  // label here keyed off a `deckMode` field that never existed in the store.
  const activeBays  = activeLevel ? levelBays(activeLevel, bayHeights) : [];
  const activeLabel = activePlacement ?? tool;

  return (
    <div className="status-bar">
      <span>{gridCols} × {gridRows} bays</span>
      <span className="status-sep">|</span>
      <span>{totalWidth}m × {totalDepth}m</span>
      <span className="status-sep">|</span>
      <span>H: {heightLabel}</span>
      <span className="status-sep">|</span>
      <span>Tool: <strong>{activeLabel}</strong></span>
      {activeLevel && (
        <>
          <span className="status-sep">|</span>
          <span className="status-level" style={{ color: activeLevel.color }}>
            ● {activeLevel.id.split('_')[0]} @ {activeLevel.height}m ({activeBays.length === 0 ? 'in no bays' : `bays ${activeBays.map(c => `C${c + 1}`).join(' ')}`})
          </span>
        </>
      )}
    </div>
  );
}
