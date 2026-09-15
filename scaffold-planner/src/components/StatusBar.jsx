import React from 'react';
import { resolveBayHeights, describeHeights } from '../utils/scaffoldGeometry';

export default function StatusBar({ state }) {
  const {
    gridCols, gridRows, bayLengths, bayWidth,
    tool, activePlacement, activeLevelId, levels,
  } = state;

  const totalWidth = bayLengths.reduce((a, b) => a + b, 0).toFixed(2);
  const totalDepth = (gridRows * bayWidth).toFixed(2);
  const heightLabel = describeHeights(resolveBayHeights(state));
  const activeLevel = levels.find(l => l.id === activeLevelId);
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
            ● {activeLevel.id.split('_')[0]} @ {activeLevel.height}m ({activeLevel.deckMode === 'alipan' ? 'Ali Pan' : 'Litedeck'})
          </span>
        </>
      )}
    </div>
  );
}
