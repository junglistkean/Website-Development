const NODE_STEP = 0.5;
export const MAX_LIFT_GAP = 2.0;
const LEDGER_SPACING = 1.0;

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

// Returns effective top height for a whole face
export function getEffectiveFaceTop(face, structureHeight, roofType) {
  if ((face === 'back' || face === 'left' || face === 'right') && roofType === 'monoPitch') return structureHeight - 0.5;
  return structureHeight;
}

// Returns effective top height for a specific standard column on a side face
export function getStandardTopForColumn(face, colIndex, totalCols, structureHeight, roofType) {
  if ((face === 'left' || face === 'right') && roofType === 'monoPitch' && colIndex === totalCols - 1) {
    return structureHeight - 0.5;
  }
  return getEffectiveFaceTop(face, structureHeight, roofType);
}

export function getAutoLedgers(bayColumns, bayRows, ledgerHeights, structureHeight = Infinity, roofType = null) {
  const faces = ['front', 'back', 'left', 'right'];
  return faces.flatMap(face => {
    const count = (face === 'left' || face === 'right') ? bayRows : bayColumns;

    // Side faces on mono-pitch: guarantee ledger at rear standard top (structureHeight - 0.5)
    let heights = ledgerHeights;
    if ((face === 'left' || face === 'right') && roofType === 'monoPitch') {
      const rearTop = Math.round((structureHeight - 0.5) * 100) / 100;
      if (!heights.includes(rearTop)) {
        heights = [...heights, rearTop].sort((a, b) => a - b);
      }
    }

    const faceTop = getEffectiveFaceTop(face, structureHeight, roofType);
    return heights
      .filter(h => h <= faceTop)
      .flatMap((h, _, __) => Array.from({ length: count }, (_, i) => ({
        face, bayIndex: i, height: h, key: `${face}-${i}-${h}`,
      })));
  });
}

export function getAutoLedgersWithOverrides(bayColumns, bayRows, ledgerHeights, ledgerOverrides = {}, structureHeight = Infinity, roofType = null) {
  const { removed = [], added = [] } = ledgerOverrides;
  const removedSet = new Set(removed);
  const addedSet   = new Set(added);

  const autoLedgers = getAutoLedgers(bayColumns, bayRows, ledgerHeights, structureHeight, roofType);
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

export function getAutoBracing(bayColumns, bayRows, ledgerHeights, structureHeight = Infinity, roofType = null) {
  // Build bracing lifts at MAX_LIFT_GAP (2m) intervals, decoupled from 1m ledger spacing
  const bracingHeights = [];
  if (isFinite(structureHeight) && structureHeight > 0) {
    for (let h = MAX_LIFT_GAP; h < structureHeight - 1e-9; h = Math.round((h + MAX_LIFT_GAP) * 100) / 100) {
      bracingHeights.push(h);
    }
    bracingHeights.push(Math.round(structureHeight * 100) / 100);
  } else {
    bracingHeights.push(...ledgerHeights);
  }

  const braces = [];
  for (let liftIdx = 0; liftIdx < bracingHeights.length; liftIdx++) {
    const liftBottom = liftIdx === 0 ? 0 : bracingHeights[liftIdx - 1];
    const liftTop    = bracingHeights[liftIdx];

    // Front/Back: direction mirrors across adjacent bays on each lift
    for (let bi = 0; bi < bayColumns; bi++) {
      const dir = (bi + liftIdx) % 2 === 0 ? '/' : '\\';
      const frontTop = getEffectiveFaceTop('front', structureHeight, roofType);
      if (liftBottom < frontTop - 1e-9 && liftTop <= frontTop + 1e-9) {
        braces.push({ face: 'front', bayIndex: bi, liftBottom, liftTop, direction: dir,
          key: `front-${bi}-${liftBottom}-${liftTop}` });
      }
      const backTop = getEffectiveFaceTop('back', structureHeight, roofType);
      if (liftBottom < backTop - 1e-9 && liftTop <= backTop + 1e-9) {
        braces.push({ face: 'back', bayIndex: bi, liftBottom, liftTop, direction: dir,
          key: `back-${bi}-${liftBottom}-${liftTop}` });
      } else if (liftBottom < backTop - 1e-9 && liftTop > backTop + 1e-9) {
        const clipped = Math.round(backTop * 100) / 100;
        braces.push({ face: 'back', bayIndex: bi, liftBottom, liftTop: clipped, direction: dir,
          key: `back-${bi}-${liftBottom}-${clipped}` });
      }
    }

    // Left/Right: same per-bay direction logic applied to row bays
    const totalSideCols = bayRows + 1;
    for (let bi = 0; bi < bayRows; bi++) {
      const dir = (bi + liftIdx) % 2 === 0 ? '/' : '\\';
      const leftTopA  = getStandardTopForColumn('left',  bi,     totalSideCols, structureHeight, roofType);
      const leftTopB  = getStandardTopForColumn('left',  bi + 1, totalSideCols, structureHeight, roofType);
      const leftMin   = Math.min(leftTopA, leftTopB);
      if (liftBottom < leftMin - 1e-9 && liftTop <= leftMin + 1e-9) {
        braces.push({ face: 'left', bayIndex: bi, liftBottom, liftTop, direction: dir,
          key: `left-${bi}-${liftBottom}-${liftTop}` });
      } else if (liftBottom < leftMin - 1e-9 && liftTop > leftMin + 1e-9) {
        const clipped = Math.round(leftMin * 100) / 100;
        braces.push({ face: 'left', bayIndex: bi, liftBottom, liftTop: clipped, direction: dir,
          key: `left-${bi}-${liftBottom}-${clipped}` });
      }

      const rightTopA = getStandardTopForColumn('right', bi,     totalSideCols, structureHeight, roofType);
      const rightTopB = getStandardTopForColumn('right', bi + 1, totalSideCols, structureHeight, roofType);
      const rightMin  = Math.min(rightTopA, rightTopB);
      if (liftBottom < rightMin - 1e-9 && liftTop <= rightMin + 1e-9) {
        braces.push({ face: 'right', bayIndex: bi, liftBottom, liftTop, direction: dir,
          key: `right-${bi}-${liftBottom}-${liftTop}` });
      } else if (liftBottom < rightMin - 1e-9 && liftTop > rightMin + 1e-9) {
        const clipped = Math.round(rightMin * 100) / 100;
        braces.push({ face: 'right', bayIndex: bi, liftBottom, liftTop: clipped, direction: dir,
          key: `right-${bi}-${liftBottom}-${clipped}` });
      }
    }
  }
  return braces;
}

export function getAutoBracingWithOverrides(bayColumns, bayRows, ledgerHeights, bracingOverrides = {}, structureHeight = Infinity, roofType = null) {
  const { removed = [], added = [] } = bracingOverrides;
  const removedSet = new Set(removed);
  const addedSet   = new Set(added);

  const autoBraces = getAutoBracing(bayColumns, bayRows, ledgerHeights, structureHeight, roofType);
  const autoKeys   = new Set(autoBraces.map(b => b.key));

  const bracing = autoBraces.filter(b => !removedSet.has(b.key));

  for (const key of addedSet) {
    if (!autoKeys.has(key)) {
      const parts      = key.split('-');
      const face       = parts[0];
      const bayIndex   = Number(parts[1]);
      const liftBottom = Number(parts[2]);
      const liftTop    = Number(parts[3]);
      const direction  = liftBottom % 1 === 0 ? '/' : '\\'; // fallback
      bracing.push({ face, bayIndex, liftBottom, liftTop, direction, key });
    }
  }

  return { bracing, removedCount: removed.length };
}

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
