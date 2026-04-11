// ═══════════════════════════════════════════════════════════════════════════
// UI.JS — Interaction, panels, save/load, legend
// ═══════════════════════════════════════════════════════════════════════════

// ── Readonly mode (append ?readonly to URL) ────────────────────────────────
const READONLY = new URLSearchParams(window.location.search).has('readonly');

// ── Panel switching ────────────────────────────────────────────────────────
function switchPanel(name, btn) {
  document.querySelectorAll('.panel-tab').forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.panel-content').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-' + name).classList.remove('hidden');
}

// ── Tool switching ─────────────────────────────────────────────────────────
function setTool(t) {
  State.currentTool = t;
  State.drawing = false;
  State.drawPoints = [];
  State.currentLineType = null;

  // Clear measure state when switching away from measure
  if (t !== 'measure') {
    State.measurePoints = [];
    State.measureResult = null;
    updateMeasureHUD();
  }

  // Clear pinch state when switching away from pinchpoint
  if (t !== 'pinchpoint') {
    State.pinchPoints = [];
  }

  document.querySelectorAll('#tool-group .tb-btn').forEach(b => b.classList.remove('active'));
  document.getElementById('tool-' + t)?.classList.add('active');
  // Overlay handles all pointer events; canvas stays non-interactive.
  canvas.style.pointerEvents = 'none';
  const overlay = State.clickOverlay;
  if (overlay) overlay.style.cursor = (t === 'measure' || t === 'pinchpoint') ? 'crosshair'
                                      : (t !== 'select') ? 'crosshair' : 'default';
  document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));

  // Disable Google Maps interaction during drawing so canvas gets all events
  if (State.map) {
    const drawing = (t !== 'select');
    State.map.setOptions({
      draggable: !drawing,
      scrollwheel: !drawing,
      disableDoubleClickZoom: drawing,
      clickableIcons: !drawing,
    });
  }

  redraw();
  setStatus(t === 'select'     ? 'Select mode · Click elements to select · Right-click to edit'
           : t === 'measure'   ? 'Measure: click point A, then point B · Esc to reset'
           : t === 'pinchpoint'? 'Pinch Point: click point A, then point B to place · Esc to cancel'
           : t === 'line'      ? 'Click to add points · Double-click to finish · Esc to cancel'
           :                    'Click to add corners · Double-click or click first point to close · Esc to cancel');
}

function startLineDraw(lineType) {
  setTool('line'); // this nulls currentLineType — set it after
  State.currentLineType = lineType;
  document.querySelectorAll('.tool-item').forEach(i => i.classList.remove('active'));
  document.getElementById('line-' + lineType)?.classList.add('active');
  const def = LINE_DEFS[lineType];
  setStatus(`Drawing: ${def.label}${def.snapM ? ` · Snaps to ${def.snapM}m` : ''} · Double-click to finish`);
  switchPanelById('lines');
}

function startAreaDraw(areaDef) {
  State.currentAreaDef = areaDef;
  const isBoneyard = areaDef.id === 'boneyard-compound';
  setTool('polygon');
  setStatus(`Drawing: ${areaDef.label}${isBoneyard ? ' · Edges snap to 3.5m (Heras)' : ''} · Double-click or click first point to close`);
}

function switchPanelById(name) {
  const tabs = document.querySelectorAll('.panel-tab');
  const panels = ['symbols','lines','layers'];
  panels.forEach((p, i) => {
    document.getElementById('panel-' + p).classList.toggle('hidden', p !== name);
    tabs[i]?.classList.toggle('active', p === name);
  });
}

// ── Build symbol panel ─────────────────────────────────────────────────────
function buildSymbolPanel() {
  const panel = document.getElementById('panel-symbols');
  panel.innerHTML = '';

  for (const cat of SYM_CATS) {
    const catDiv = document.createElement('div');
    catDiv.className = 'sym-category';

    const header = document.createElement('div');
    header.className = 'sym-cat-header';
    header.innerHTML = `${cat.name}<svg class="sym-cat-arrow" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3l3 4 3-4z"/></svg>`;
    header.addEventListener('click', () => {
      header.classList.toggle('collapsed');
      grid.classList.toggle('hidden');
    });

    const grid = document.createElement('div');
    grid.className = 'sym-grid';

    for (const sym of cat.symbols) {
      const item = document.createElement('div');
      item.className = 'sym-item';
      item.draggable = !READONLY;
      item.title = sym.label;

      item.innerHTML = `<svg width="40" height="30" viewBox="0 0 40 30">${symThumbSVG(sym, 40, 30)}</svg>
                        <span class="sym-label">${sym.label}</span>`;

      if (!READONLY) item.addEventListener('dragstart', e => {
        e.dataTransfer.setData('symId', sym.id);
        e.dataTransfer.setData('catId', cat.id);
      });

      grid.appendChild(item);
    }

    catDiv.appendChild(header);
    catDiv.appendChild(grid);
    panel.appendChild(catDiv);
  }

  // Areas section
  const areaDiv = document.createElement('div');
  areaDiv.className = 'sym-category';
  const areaHeader = document.createElement('div');
  areaHeader.className = 'sym-cat-header';
  areaHeader.innerHTML = `Areas (Draw Polygon)<svg class="sym-cat-arrow" width="10" height="10" viewBox="0 0 10 10" fill="currentColor"><path d="M2 3l3 4 3-4z"/></svg>`;
  const areaGrid = document.createElement('div');
  areaGrid.className = 'sym-grid';

  for (const area of AREA_DEFS) {
    const item = document.createElement('div');
    item.className = 'sym-item';
    item.innerHTML = `<svg width="40" height="30" viewBox="0 0 40 30">
      <polygon points="20,4 36,26 4,26" fill="${area.fill}" stroke="${area.stroke}" stroke-width="1.5"/>
    </svg><span class="sym-label">${area.label}</span>`;
    item.addEventListener('click', () => startAreaDraw(area));
    areaGrid.appendChild(item);
  }

  // Boneyard area button
  const boneItem = document.createElement('div');
  boneItem.className = 'sym-item';
  boneItem.innerHTML = `<svg width="40" height="30" viewBox="0 0 40 30">
    <rect x="4" y="4" width="32" height="22" fill="transparent" stroke="#94a3b8" stroke-width="1.5" stroke-dasharray="5,3"/>
    <line x1="4" y1="4" x2="36" y2="26" stroke="#94a3b8" stroke-width="0.5" opacity="0.3"/>
  </svg><span class="sym-label">Boneyard</span>`;
  boneItem.addEventListener('click', () => startAreaDraw({ id: 'boneyard-compound', label: 'Boneyard', isBoneyard: true }));
  areaGrid.appendChild(boneItem);

  areaHeader.addEventListener('click', () => {
    areaHeader.classList.toggle('collapsed');
    areaGrid.classList.toggle('hidden');
  });
  areaDiv.appendChild(areaHeader);
  areaDiv.appendChild(areaGrid);
  panel.appendChild(areaDiv);
}

// ── Make element objects ───────────────────────────────────────────────────
function makeSymbolEl(sym, catId, x, y) {
  const ll = pixelToLatLng(x, y);
  return {
    id: nextId(), type: 'symbol',
    sym, symId: sym.id, catId,
    label: sym.label,
    lat: ll.lat, lng: ll.lng,
    wM: sym.wM, dM: sym.dM,
    rotation: 0,
    layerId: State.activeLayer,
    heightNote: sym.hasHeight ? '' : undefined,
    customLabel: '',
  };
}

function makeLineEl(lineType, points) {
  return {
    id: nextId(), type: 'line',
    lineType,
    points: points.map(p => pixelToLatLng(p.x, p.y)),
    label: '',
    layerId: State.activeLayer,
  };
}

function makePolyEl(points, areaDef, isBoneyard) {
  return {
    id: nextId(), type: 'polygon',
    points: points.map(p => pixelToLatLng(p.x, p.y)),  // ← change this line
    areaDef: isBoneyard ? null : areaDef,
    isBoneyard: !!isBoneyard,
    label: areaDef ? areaDef.label : 'Boneyard',
    layerId: State.activeLayer,
    capacityDensity: null,
  };
}

// ── Canvas events ──────────────────────────────────────────────────────────
function initCanvasEvents() {
  const wrap = document.getElementById('map-wrap');

  // Dim overlay — z-index 12, above canvas (10) but below click overlay (15)
  const dimOverlay = document.createElement('div');
  dimOverlay.id = 'map-dim-overlay';
  dimOverlay.style.cssText = [
    'position:absolute',
    'inset:0',
    'z-index:5',
    'pointer-events:none',
    'background:rgba(0,0,0,0)',
    'transition:background 0.2s',
  ].join(';');
  wrap.appendChild(dimOverlay);

  // Transparent overlay div sits above the canvas (z-index 15 vs canvas z-index 10).
  // All pointer events land here first, before Google Maps can intercept them.
  const overlay = document.createElement('div');
  overlay.id = 'map-click-overlay';
  overlay.style.cssText = [
    'position:absolute',
    'inset:0',
    'z-index:15',
    'pointer-events:all',
    'background:transparent',
    'cursor:default',
  ].join(';');
  wrap.appendChild(overlay);

  // Store a reference so setTool() can update the cursor.
  State.clickOverlay = overlay;

  overlay.addEventListener('mousedown', onMouseDown);
document.addEventListener('mousemove', onMouseMove);
document.addEventListener('mouseup', onMouseUp);
  overlay.addEventListener('click', onCanvasClick);
  overlay.addEventListener('dblclick', onDblClick);
  overlay.addEventListener('contextmenu', onRightClick);

  // Zoom via scroll wheel — throttled to tame trackpad sensitivity
  let _lastWheelTime = 0;
  let _wheelAccum = 0;
  overlay.addEventListener('wheel', e => {
    if (!State.map) return;
    e.preventDefault();
    const now = Date.now();
    _wheelAccum += e.deltaY;
    if (now - _lastWheelTime < 200) return; // throttle
    _lastWheelTime = now;
    const delta = _wheelAccum > 0 ? -1 : 1;
    _wheelAccum = 0;
    State.map.setZoom(State.map.getZoom() + delta);
  }, { passive: false });

  // Overlay intercepts drag events too — must handle dragover/drop here.
  overlay.addEventListener('dragover', e => e.preventDefault());
  overlay.addEventListener('drop', onMapDrop);

  // ── Touch: pan (single finger) + pinch-zoom (two finger) ──────────────────
  // Attach to wrap (not overlay) so it works regardless of what's on top
  const touchTarget = wrap;
  touchTarget.style.touchAction = 'none';

  let _touchLastPos = null;
  let _touchPinchDist = null;

  function getTouchPos(touch) {
    const r = wrap.getBoundingClientRect();
    return { x: touch.clientX - r.left, y: touch.clientY - r.top };
  }

  function getPinchDist(touches) {
    return Math.hypot(
      touches[0].clientX - touches[1].clientX,
      touches[0].clientY - touches[1].clientY
    );
  }

  touchTarget.addEventListener('touchstart', e => {
    if (e.target.closest('#legend, #addr-search, #prop-panel, #ctx-menu, #zoom-btns, #compass')) return;
    e.preventDefault();
    if (e.touches.length === 1) {
      _touchLastPos = getTouchPos(e.touches[0]);
      _touchPinchDist = null;
    } else if (e.touches.length === 2) {
      _touchPinchDist = getPinchDist(e.touches);
      _touchLastPos = null;
    }
  }, { passive: false });

  touchTarget.addEventListener('touchmove', e => {
    e.preventDefault();
    if (!State.map) return;
    if (e.touches.length === 1 && _touchLastPos) {
      const curr = getTouchPos(e.touches[0]);
      const prevLL = pixelToLatLng(_touchLastPos.x, _touchLastPos.y);
      const currLL = pixelToLatLng(curr.x, curr.y);
      const centre = State.map.getCenter();
      State.map.setCenter({
        lat: centre.lat() + (prevLL.lat - currLL.lat),
        lng: centre.lng() + (prevLL.lng - currLL.lng),
      });
      _touchLastPos = curr;
    } else if (e.touches.length === 2 && _touchPinchDist !== null) {
      const newDist = getPinchDist(e.touches);
      const ratio = newDist / _touchPinchDist;
      if (ratio > 1.15) {
        State.map.setZoom(State.map.getZoom() + 1);
        _touchPinchDist = newDist;
      } else if (ratio < 0.87) {
        State.map.setZoom(State.map.getZoom() - 1);
        _touchPinchDist = newDist;
      }
    }
  }, { passive: false });

  touchTarget.addEventListener('touchend', e => {
    if (e.touches.length === 0) {
      _touchLastPos = null;
      _touchPinchDist = null;
    } else if (e.touches.length === 1) {
      _touchLastPos = getTouchPos(e.touches[0]);
      _touchPinchDist = null;
    }
  }, { passive: false });

  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') {
      if (State.currentTool === 'measure') {
        State.measurePoints = [];
        State.measureResult = null;
        updateMeasureHUD(null);
        setStatus('Measure: click point A, then point B · Esc to reset');
        redraw();
        return;
      }
      if (State.currentTool === 'pinchpoint') {
        State.pinchPoints = [];
        setTool('select');
        redraw();
        return;
      }
      cancelDraw();
    }
    if ((e.key === 'Delete' || e.key === 'Backspace') && State.selectedId) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      deleteSelected();
    }
    if (e.key === 'r' && State.selectedId) rotateSelected(15);
    if (e.key === 'R' && State.selectedId) rotateSelected(-15);
    if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA')) return;
      e.preventDefault();
      undo();
    }
  });
}

function onMouseMove(e) {
  const r = document.getElementById('map-wrap').getBoundingClientRect();
  State.mousePos = { x: e.clientX - r.left, y: e.clientY - r.top };

  if (State.rotateDragging && State.selectedId) {
    const sel = State.elements.find(el => el.id === State.selectedId);
    if (sel && sel.type === 'symbol') {
      const px = latLngToPixel(sel.lat, sel.lng);
      const currentAngle = Math.atan2(State.mousePos.y - px.y, State.mousePos.x - px.x);
      const delta = (currentAngle - State.rotateStartAngle) * 180 / Math.PI;
      sel.rotation = ((State.rotateStartRot + delta) % 360 + 360) % 360;
      updatePropPanel(sel);
      redraw();
    }
    return;
  }

  if (State.mapPanning && State.lastPanPos && State.map) {
    const prevLL = pixelToLatLng(State.lastPanPos.x, State.lastPanPos.y);
    const currLL = pixelToLatLng(State.mousePos.x, State.mousePos.y);
    const centre = State.map.getCenter();
    State.map.setCenter({
      lat: centre.lat() + (prevLL.lat - currLL.lat),
      lng: centre.lng() + (prevLL.lng - currLL.lng),
    });
    State.lastPanPos = { x: State.mousePos.x, y: State.mousePos.y };
    return;
  }

  if (State.pendingDrag) {
    State.dragging = true;
    State.pendingDrag = false;
  }

  if (State.vertexDragging && State.selectedId) {
    const sel = State.elements.find(el => el.id === State.selectedId);
    if (sel) {
      sel.points[State.vertexIndex] = pixelToLatLng(State.mousePos.x, State.mousePos.y);
      redraw();
    }
    return;
  }

   if (State.dragging && State.dragId) {
    const el = State.elements.find(el => el.id === State.dragId);
    if (el && el.type === 'symbol') {
      const newPx = State.mousePos.x - State.dragOffsetX;
      const newPy = State.mousePos.y - State.dragOffsetY;
      const ll = pixelToLatLng(newPx, newPy);
      el.lat = ll.lat;
      el.lng = ll.lng;
      redraw();
      updatePropPanel(el);
    } else if (el && (el.type === 'line' || el.type === 'polygon')) {
      // Drag the whole element: compute delta from last frame in lat/lng space
      if (State.lastDragPos) {
        const prev = pixelToLatLng(State.lastDragPos.x, State.lastDragPos.y);
        const curr = pixelToLatLng(State.mousePos.x, State.mousePos.y);
        const dlat = curr.lat - prev.lat;
        const dlng = curr.lng - prev.lng;
        el.points = el.points.map(p => ({ lat: p.lat + dlat, lng: p.lng + dlng }));
      }
      State.lastDragPos = { ...State.mousePos };
      redraw();
    }
  } else if (State.drawing) {
    redraw();
  }

  // Pinch point: live-line preview while waiting for second click
  if (State.currentTool === 'pinchpoint' && State.pinchPoints.length === 1) {
    redraw();
  }

  // Pinch point: tooltip on hover over placed endpoints
  const tooltip = document.getElementById('pinch-tooltip');
  if (tooltip) {
    const r2 = document.getElementById('map-wrap').getBoundingClientRect();
    const mx = e.clientX - r2.left;
    const my = e.clientY - r2.top;
    let hovered = null;
    for (const el of State.elements) {
      if (el.type !== 'pinchpoint') continue;
      for (const pt of el.points) {
        const px = latLngToPixel(pt.lat, pt.lng);
        if (Math.hypot(mx - px.x, my - px.y) < 10) {
          hovered = el;
          break;
        }
      }
      if (hovered) break;
    }
    if (hovered) {
      tooltip.textContent = hovered.label;
      tooltip.style.display = 'block';
      tooltip.style.left = (e.clientX - r2.left + 12) + 'px';
      tooltip.style.top  = (e.clientY - r2.top  - 8) + 'px';
    } else {
      tooltip.style.display = 'none';
    }
  }

  // Symbol note tooltip
const noteTooltip = document.getElementById('sym-note-tooltip');
if (noteTooltip) {
  const r3 = document.getElementById('map-wrap').getBoundingClientRect();
  const mx = e.clientX - r3.left;
  const my = e.clientY - r3.top;
  let hoveredEl = null;
  for (const el of State.elements) {
    if (el.type !== 'symbol' || !el.note) continue;
    const mpp = metersPerPixel();
    const pw = el.wM / mpp;
    const ph = el.dM / mpp;
    const px = latLngToPixel(el.lat, el.lng);
    if (Math.abs(mx - px.x) < pw / 2 + 6 && Math.abs(my - px.y) < ph / 2 + 6) {
      hoveredEl = el;
      break;
    }
  }
  if (hoveredEl) {
    noteTooltip.textContent = hoveredEl.note;
    noteTooltip.style.display = 'block';
    noteTooltip.style.left = (e.clientX - r3.left + 12) + 'px';
    noteTooltip.style.top  = (e.clientY - r3.top  - 8) + 'px';
  } else {
    noteTooltip.style.display = 'none';
  }
}
}

function onMouseDown(e) {
    if (e.target.closest('#prop-panel')) return;
  if (State.currentTool !== 'select') return;
  const r = document.getElementById('map-wrap').getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;

  // In readonly mode, only allow map panning — skip all edit interactions
  if (READONLY) {
    State.mapPanning = true;
    State.lastPanPos = { x, y };
    return;
  }

  // Check rotate handle first (only for symbols)
  if (State.selectedId) {
    const sel = State.elements.find(el => el.id === State.selectedId);
    if (sel && sel.type === 'symbol') {
      const mpp = metersPerPixel();
      const ph = Math.max(sel.dM / mpp, 18);
      const px = latLngToPixel(sel.lat, sel.lng);
      const rot = (sel.rotation || 0) * Math.PI / 180;
      const handleDist = ph / 2 + 22;
      const hx = px.x + handleDist * Math.sin(rot);
      const hy = px.y - handleDist * Math.cos(rot);
      const dist = Math.hypot(x - hx, y - hy);
      if (dist < 14) {
        e.stopPropagation();
        e.preventDefault();
        State.rotateDragging = true;
        State.rotateStartAngle = Math.atan2(y - px.y, x - px.x);
        State.rotateStartRot = sel.rotation || 0;
        if (State.clickOverlay) State.clickOverlay.style.cursor = 'grabbing';
        return;
      }
    }
  }
  if (State.selectedId) {
    const sel = State.elements.find(el => el.id === State.selectedId);
    if (sel && (sel.type === 'line' || sel.type === 'polygon' || sel.type === 'pinchpoint')) {
      const pts = sel.points.map(p => latLngToPixel(p.lat, p.lng));
      const vi = pts.findIndex(p => Math.hypot(x - p.x, y - p.y) < 8);
      if (vi !== -1) {
        e.stopPropagation();
        e.preventDefault();
        State.vertexDragging = true;
        State.vertexIndex = vi;
        return;
      }
    }
  }

  const hit = hitTest(x, y);
  if (hit) {
    e.stopPropagation();
    State.pendingDrag = true;
    State.dragId = hit.id;
    State.dragOffsetX = x - (hit._px !== undefined ? hit._px : x);
    State.dragOffsetY = y - (hit._py !== undefined ? hit._py : y);
    selectElement(hit.id);
    if (State.clickOverlay) State.clickOverlay.style.cursor = 'grabbing';
  } else {
    // No hit — pan the map manually using panBy on each mousemove
    State.mapPanning = true;
    State.lastPanPos = { x, y };
  }
}

function onMouseUp(e) {
  State.pendingDrag = false;
  if (State.rotateDragging) {
    State.rotateDragging = false;
    if (State.clickOverlay) State.clickOverlay.style.cursor = 'default';
    saveAutoSnapshot();
    return;
  }
  if (State.mapPanning) {
    State.mapPanning = false;
    State.lastPanPos = null;
    return;
  }
  if (State.vertexDragging) {
    State.vertexDragging = false;
    State.vertexIndex = null;
    saveAutoSnapshot();
    return;
  }
  if (State.dragging) {
    State.dragging = false;
    State.dragId = null;
    State.lastDragPos = null;
    if (State.clickOverlay) State.clickOverlay.style.cursor = 'default';
    saveAutoSnapshot();
  }
}
function onCanvasClick(e) {
  if (e.target.closest('#prop-panel')) return;
  if (READONLY) return;
  const r = document.getElementById('map-wrap').getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;

  if (State.currentTool === 'measure') {
    e.stopPropagation();
    const ll = pixelToLatLng(x, y);
    if (State.measurePoints.length === 0) {
      State.measurePoints = [ll];
      State.measureResult = null;
      setStatus('Measure: click point B');
    } else if (State.measurePoints.length === 1) {
      State.measurePoints.push(ll);
      const d = haversineDistance(
        State.measurePoints[0].lat, State.measurePoints[0].lng,
        ll.lat, ll.lng
      );
      State.measureResult = d;
      updateMeasureHUD(d);
      setStatus(`Distance: ${formatDistance(d)} · Click to start new measurement`);
    } else {
      // Third click — start a fresh measurement
      State.measurePoints = [ll];
      State.measureResult = null;
      updateMeasureHUD(null);
      setStatus('Measure: click point B');
    }
    redraw();
    return;
  }

  if (State.currentTool === 'pinchpoint') {
    e.stopPropagation();
    const ll = pixelToLatLng(x, y);
    if (State.pinchPoints.length === 0) {
      State.pinchPoints = [ll];
      setStatus('Pinch Point: click point B · Esc to cancel');
    } else {
      // Second click — commit the segment
      State.pinchCounter++;
      const el = {
        id: 'pp-' + (State.idCounter++),
        type: 'pinchpoint',
        points: [State.pinchPoints[0], ll],
        label: 'Pinch Point ' + State.pinchCounter,
        layerId: State.activeLayer,
      };
      State.elements.push(el);
      State.pinchPoints = [];
      updateLegend();
      saveAutoSnapshot();
      setStatus('Pinch Point placed · Click to start another · Esc to exit');
    }
    redraw();
    return;
  }

  if (State.currentTool === 'line') {
    e.stopPropagation();
    State.drawing = true;
    const snappedPt = getSnappedPoint(x, y);
    State.drawPoints.push(snappedPt);
    redraw();
    return;
  }

  if (State.currentTool === 'polygon') {
    e.stopPropagation();
    if (State.drawPoints.length >= 3) {
      const fp = State.drawPoints[0];
      if (Math.hypot(x - fp.x, y - fp.y) < 14) {
        finishPolygon();
        return;
      }
    }
    State.drawing = true;
    const snapped = getBoneyardSnapped(x, y);
    State.drawPoints.push(snapped);
    redraw();
    return;
  }

  if (State.currentTool === 'select') {
    const hit = hitTest(x, y);
    if (hit) selectElement(hit.id);
    else clearSelection();
  }
}

function onDblClick(e) {
  if (READONLY) return;
  e.stopPropagation();
  if (State.currentTool === 'line' && State.drawPoints.length >= 2) {
    finishLine();
  } else if (State.currentTool === 'polygon' && State.drawPoints.length >= 3) {
    finishPolygon();
  }
}

function onRightClick(e) {
  if (READONLY) return;
  e.preventDefault();
  e.stopPropagation();
  const r = document.getElementById('map-wrap').getBoundingClientRect();
  const x = e.clientX - r.left;
  const y = e.clientY - r.top;
  const hit = hitTest(x, y);
  if (hit) {
    State.ctxTargetId = hit.id;
    selectElement(hit.id);
    showContextMenu(e.clientX, e.clientY);
  }
}

function onMapDrop(e) {
  if (READONLY) return;
  e.preventDefault();
  const symId = e.dataTransfer.getData('symId');
  if (!symId) return;
  const found = findSym(symId);
  if (!found) return;
  const wrap = document.getElementById('map-wrap');
  const r = wrap.getBoundingClientRect();
  const el = makeSymbolEl(found.sym, found.catId, e.clientX - r.left, e.clientY - r.top);
  State.elements.push(el);
  selectElement(el.id);
  updateLegend();
  redraw();
  saveAutoSnapshot();
  const activeLayer = getLayer(State.activeLayer);
  if (activeLayer && !activeLayer.visible) {
    setStatus(`⚠️ "${activeLayer.name}" layer is hidden — symbol placed but not visible · Toggle visibility in Layers panel`);
  }
}

// ── Snapping helpers ───────────────────────────────────────────────────────
function getSnappedPoint(x, y) {
  const def = State.currentLineType ? LINE_DEFS[State.currentLineType] : null;
  if (!def || !def.snapM || State.drawPoints.length === 0) return { x, y };

  const last = State.drawPoints[State.drawPoints.length - 1];
  const rawM = pToM(Math.hypot(x - last.x, y - last.y));
  const snappedM = snapLength(rawM, def.snapM);
  const snappedPx = mToP(snappedM);
  const angle = Math.atan2(y - last.y, x - last.x);
  return {
    x: last.x + Math.cos(angle) * snappedPx,
    y: last.y + Math.sin(angle) * snappedPx,
  };
}

function getBoneyardSnapped(x, y) {
  const isBoneyard = State.currentAreaDef && State.currentAreaDef.id === 'boneyard-compound';
  if (!isBoneyard || State.drawPoints.length === 0) return { x, y };

  const last = State.drawPoints[State.drawPoints.length - 1];
  const rawM = pToM(Math.hypot(x - last.x, y - last.y));
  const snappedM = snapLength(rawM, SNAP.BONEYARD);
  const snappedPx = mToP(snappedM);
  const angle = Math.atan2(y - last.y, x - last.x);
  return {
    x: last.x + Math.cos(angle) * snappedPx,
    y: last.y + Math.sin(angle) * snappedPx,
  };
}

// ── Finish drawing ─────────────────────────────────────────────────────────
function finishLine() {
  // Double-click fires 2 single clicks first — remove the last duplicate point
  if (State.drawPoints.length > 2) State.drawPoints.pop();
  if (State.drawPoints.length < 2) { cancelDraw(); return; }

  const lineType = State.currentLineType; // capture before setTool clears it
  const points = [...State.drawPoints];
  const el = makeLineEl(lineType, points);
  State.elements.push(el);
  updateLegend();
  setTool('select');
  selectElement(el.id);
  saveAutoSnapshot();
  const _ll = getLayer(State.activeLayer);
  if (_ll && !_ll.visible) {
    setStatus(`⚠️ "${_ll.name}" layer is hidden — line placed but not visible · Toggle visibility in Layers panel`);
  } else {
    setStatus('Line placed · Select another line type or press Esc');
  }
}

function finishPolygon() {
  // Double-click fires 2 single clicks first — remove last duplicate point
  if (State.drawPoints.length > 3) State.drawPoints.pop();
  if (State.drawPoints.length < 3) { cancelDraw(); return; }

  const isBoneyard = State.currentAreaDef && State.currentAreaDef.id === 'boneyard-compound';
  const el = makePolyEl([...State.drawPoints], State.currentAreaDef, isBoneyard);
  State.elements.push(el);
  updateLegend();
  setTool('select');
  selectElement(el.id);
  saveAutoSnapshot();
  const _pl = getLayer(State.activeLayer);
  if (_pl && !_pl.visible) {
    setStatus(`⚠️ "${_pl.name}" layer is hidden — area placed but not visible · Toggle visibility in Layers panel`);
  } else {
    setStatus('Area placed · Right-click to add capacity annotation');
  }
  if (!isBoneyard) openCapacityModal(el.id);
}

function cancelDraw() {
  State.drawing = false;
  State.drawPoints = [];
  State.currentLineType = null;
  State.currentAreaDef = null;
  setTool('select'); // this re-enables map dragging via setTool
  redraw();
}

// ── Hit testing ────────────────────────────────────────────────────────────
function hitTest(x, y) {
  const mpp = metersPerPixel();
  let bestSymbol = null;
  let bestDist = Infinity;

  for (let i = State.elements.length - 1; i >= 0; i--) {
    const el = State.elements[i];
    if (!layerVisible(el.layerId)) continue;

    if (el.type === 'symbol') {
      const px = latLngToPixel(el.lat, el.lng);
      const pw = Math.max(el.wM / mpp, 18);
      const ph = Math.max(el.dM / mpp, 18);
      const rot = (el.rotation || 0) * Math.PI / 180;
      const dx = x - px.x, dy = y - px.y;
      const rx = dx * Math.cos(-rot) - dy * Math.sin(-rot);
      const ry = dx * Math.sin(-rot) + dy * Math.cos(-rot);
      if (Math.abs(rx) <= pw / 2 + 4 && Math.abs(ry) <= ph / 2 + 4) {
        const dist = Math.hypot(dx, dy);
        if (dist < bestDist) {
          bestDist = dist;
          bestSymbol = { ...el, _px: px.x, _py: px.y };
        }
      }
    }

    if (el.type === 'line' && el.points) {
      const pts = el.points.map(p => latLngToPixel(p.lat, p.lng));
      for (let j = 0; j < pts.length - 1; j++) {
        if (distToSegment(x, y, pts[j], pts[j + 1]) < 8) return el;
      }
    }

    if (el.type === 'polygon' && el.points) {
      const pts = el.points.map(p => latLngToPixel(p.lat, p.lng));
      if (pointInPoly(x, y, pts)) return el;
    }

    if (el.type === 'pinchpoint' && el.points) {
      const pts = el.points.map(p => latLngToPixel(p.lat, p.lng));
      // Hit on either endpoint
      if (pts.some(p => Math.hypot(x - p.x, y - p.y) < 10)) return el;
      // Hit on the line segment itself
      if (pts.length === 2 && distToSegment(x, y, pts[0], pts[1]) < 6) return el;
    }
  }

  return bestSymbol;
}
function distToSegment(px, py, a, b) {
  const dx = b.x - a.x, dy = b.y - a.y;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - a.x, py - a.y);
  let t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (a.x + t * dx), py - (a.y + t * dy));
}

// ── Selection ──────────────────────────────────────────────────────────────
function selectElement(id) {
  State.selectedId = id;
  const el = State.elements.find(e => e.id === id);
  if (el) openPropPanel(el);
  redraw();
}

function clearSelection() {
  State.selectedId = null;
  closePropPanel();
  redraw();
}

function deleteSelected() {
  if (!State.selectedId) return;
  deleteElement(State.selectedId);
}

function deleteElement(id) {
  State.elements = State.elements.filter(e => e.id !== id);
  if (State.selectedId === id) clearSelection();
  updateLegend();
  redraw();
  saveAutoSnapshot();
}

function rotateSelected(deg) {
  const el = State.elements.find(e => e.id === State.selectedId);
  if (el && el.type === 'symbol') {
    el.rotation = ((el.rotation || 0) + deg + 360) % 360;
    updatePropPanel(el);
    redraw();
  }
}

// ── Property panel ─────────────────────────────────────────────────────────
function openPropPanel(el) {
  const panel = document.getElementById('prop-panel');
  panel.classList.add('open');

  document.getElementById('prop-label-input').value = el.label || '';
  document.getElementById('prop-rot').value = el.rotation || 0;

  if (el.type === 'symbol') {
    document.getElementById('prop-w').value = el.wM;
    document.getElementById('prop-d').value = el.dM;
    document.getElementById('prop-w').disabled = false;
    document.getElementById('prop-d').disabled = el.sym && el.sym.resizeWOnly;
    if (el.sym && el.sym.hasHeight) {
      document.getElementById('prop-h-wrap').style.display = 'flex';
      document.getElementById('prop-height').value = el.heightNote || '';
    } else {
      document.getElementById('prop-h-wrap').style.display = 'none';
    }
  } else {
    document.getElementById('prop-w').disabled = true;
    document.getElementById('prop-d').disabled = true;
    document.getElementById('prop-h-wrap').style.display = 'none';
  }

 // Populate layer dropdown
  const sel = document.getElementById('prop-layer');
  sel.innerHTML = layers.map(l => `<option value="${l.id}" ${l.id === el.layerId ? 'selected' : ''}>${l.name}</option>`).join('');

  // Notes field — symbols only
  if (el.type === 'symbol') {
    document.getElementById('prop-notes').value = el.note || '';
    document.getElementById('prop-notes').closest('label').style.display = '';
  } else {
    document.getElementById('prop-notes').closest('label').style.display = 'none';
  }
}

function updatePropPanel(el) {
  if (!el) return;
  document.getElementById('prop-w').value = (el.wM || 0).toFixed(2);
  document.getElementById('prop-d').value = (el.dM || 0).toFixed(2);
  document.getElementById('prop-rot').value = el.rotation || 0;
}

function closePropPanel() {
  document.getElementById('prop-panel').classList.remove('open');
}

function updateSelectedLabel(val) {
  const el = State.elements.find(e => e.id === State.selectedId);
  if (el) { el.label = val; redraw(); }
}

function updateSelectedSize() {
  const el = State.elements.find(e => e.id === State.selectedId);
  if (!el || el.type !== 'symbol') return;
  const w = parseFloat(document.getElementById('prop-w').value);
  const d = parseFloat(document.getElementById('prop-d').value);
  if (!isNaN(w) && w > 0) el.wM = w;
  if (!isNaN(d) && d > 0 && !(el.sym && el.sym.resizeWOnly)) el.dM = d;
  if (el.sym && el.sym.resizeWOnly) el.dM = el.sym.dM; // lock depth for truss
  redraw();
}

function updateSelectedRotation() {
  const el = State.elements.find(e => e.id === State.selectedId);
  if (!el) return;
  el.rotation = parseFloat(document.getElementById('prop-rot').value) || 0;
  redraw();
}

function updateSelectedHeight() {
  const el = State.elements.find(e => e.id === State.selectedId);
  if (!el) return;
  el.heightNote = document.getElementById('prop-height').value;
  redraw();
}

function moveSelectedToLayer(layerId) {
  const el = State.elements.find(e => e.id === State.selectedId);
  if (el) { el.layerId = layerId; redraw(); }
}

function updateSelectedNote(val) {
  const el = State.elements.find(e => e.id === State.selectedId);
  if (el && el.type === 'symbol') {
    el.note = val;
    saveAutoSnapshot();
  }
}


// ── Context menu ───────────────────────────────────────────────────────────
function showContextMenu(cx, cy) {
  const menu = document.getElementById('ctx-menu');
  const el = State.elements.find(e => e.id === State.ctxTargetId);
  // Show capacity option only for area polygons
  document.getElementById('ctx-capacity').style.display =
    (el && el.type === 'polygon' && !el.isBoneyard) ? 'flex' : 'none';
  menu.style.left = cx + 'px';
  menu.style.top = cy + 'px';
  menu.style.display = 'block';
  setTimeout(() => document.addEventListener('click', hideContextMenu, { once: true }), 10);
}

function hideContextMenu() {
  document.getElementById('ctx-menu').style.display = 'none';
}

function ctxEdit() {
  const el = State.elements.find(e => e.id === State.ctxTargetId);
  if (el) openPropPanel(el);
  hideContextMenu();
}

function ctxDuplicate() {
  const el = State.elements.find(e => e.id === State.ctxTargetId);
  if (!el) return;
  const copy = JSON.parse(JSON.stringify(el));
  copy.id = nextId();
  if (copy.type === 'symbol') {
    // Offset by ~20px worth of distance in lat/lng space
    const mpp = metersPerPixel();
    const offsetDeg = (20 * mpp) / 111320;
    copy.lat += offsetDeg;
    copy.lng += offsetDeg;
  }
  copy.sym = el.sym; // restore sym reference
  State.elements.push(copy);
  selectElement(copy.id);
  updateLegend();
  redraw();
  hideContextMenu();
}

function ctxCapacity() {
  const el = State.elements.find(e => e.id === State.ctxTargetId);
  if (el) openCapacityModal(el.id);
  hideContextMenu();
}

function ctxDelete() {
  deleteElement(State.ctxTargetId);
  hideContextMenu();
}

function ctxMoveLayer() {
  const sel = document.getElementById('move-layer-select');
  sel.innerHTML = layers.map(l => `<option value="${l.id}">${l.name}</option>`).join('');
  openModal('modal-move-layer');
  hideContextMenu();
}

function confirmMoveLayer() {
  const layerId = document.getElementById('move-layer-select').value;
  const el = State.elements.find(e => e.id === State.ctxTargetId);
  if (el) { el.layerId = layerId; redraw(); }
  closeModal('modal-move-layer');
}

// ── Capacity modal ─────────────────────────────────────────────────────────
let capacityTargetId = null;

function openCapacityModal(elId) {
  capacityTargetId = elId;
  const el = State.elements.find(e => e.id === elId);
  if (!el) return;
  document.getElementById('cap-density').value = el.capacityDensity || 'standing';
  document.getElementById('cap-label').value = el.label || '';
  updateCapacityPreview();
  openModal('modal-capacity');
}

function updateCapacityPreview() {
  if (!capacityTargetId) return;
  const el = State.elements.find(e => e.id === capacityTargetId);
  if (!el) return;
  const density = document.getElementById('cap-density').value;
  const cap = calcCapacity(el, density);
  document.getElementById('cap-preview').innerHTML =
    `<strong>${cap.capacity.toLocaleString()}</strong> people
    <br><small>Gross: ${cap.grossM2.toFixed(1)}m² · Obstacles: ${cap.obstacleM2.toFixed(1)}m² · Net: ${cap.netM2.toFixed(1)}m²</small>
    <br><small>${(DENSITY[density] || DENSITY.standing).label} @ ${(DENSITY[density] || DENSITY.standing).sqm}m²/person</small>`;
}

function confirmCapacity() {
  const el = State.elements.find(e => e.id === capacityTargetId);
  if (!el) return;
  el.capacityDensity = document.getElementById('cap-density').value;
  el.label = document.getElementById('cap-label').value;
  redraw();
  closeModal('modal-capacity');
  saveAutoSnapshot();
}

function removeCapacity() {
  const el = State.elements.find(e => e.id === capacityTargetId);
  if (el) { el.capacityDensity = null; redraw(); }
  closeModal('modal-capacity');
}

// ── Layers panel ───────────────────────────────────────────────────────────
function renderLayerList() {
  const list = document.getElementById('layer-list');
  list.innerHTML = '';

  for (const layer of layers) {
    const item = document.createElement('div');
    item.className = 'layer-item' + (layer.id === State.activeLayer ? ' active-layer' : '');
    item.innerHTML = `
      <svg class="layer-vis" viewBox="0 0 18 18" fill="none" onclick="toggleLayerVis('${layer.id}',event)" title="Toggle visibility">
        ${layer.visible
          ? `<circle cx="9" cy="9" r="4" fill="${layer.color}"/><circle cx="9" cy="9" r="7" stroke="${layer.color}" stroke-width="1.3" fill="none"/>`
          : `<circle cx="9" cy="9" r="7" stroke="#4a5060" stroke-width="1.3" fill="none"/><line x1="3" y1="3" x2="15" y2="15" stroke="#4a5060" stroke-width="1.3"/>`}
      </svg>
      <span class="layer-color" style="background:${layer.color}"></span>
      <span class="layer-name ${!layer.visible ? 'dimmed' : ''}">${layer.name}</span>
      ${layer.id !== 'base' ? `<button class="layer-lock" onclick="deleteLayerConfirm('${layer.id}',event)" title="Delete layer">✕</button>` : ''}
    `;
    item.addEventListener('click', () => setActiveLayer(layer.id));
    list.appendChild(item);
  }

  // Full opacity ticklist
  const foItems = document.getElementById('fo-items');
  foItems.innerHTML = '';
  for (const layer of layers) {
    if (layer.id === State.activeLayer) continue;
    const div = document.createElement('div');
    div.className = 'fo-item';
    div.innerHTML = `<input type="checkbox" id="fo-${layer.id}" ${State.fullOpacityLayers.has(layer.id) ? 'checked' : ''}
      onchange="toggleFullOpacity('${layer.id}',this.checked)"/>
      <label for="fo-${layer.id}" style="cursor:pointer">${layer.name}</label>`;
    foItems.appendChild(div);
  }
}

function setActiveLayer(id) {
  State.activeLayer = id;
  renderLayerList();
  redraw();
  // Update prop panel layer dropdown
  const sel = document.getElementById('prop-layer');
  if (sel) sel.value = id;
}

function toggleLayerVis(id, e) {
  e.stopPropagation();
  const l = getLayer(id);
  if (l) { l.visible = !l.visible; renderLayerList(); redraw(); }
}

function toggleFullOpacity(id, checked) {
  if (checked) State.fullOpacityLayers.add(id);
  else State.fullOpacityLayers.delete(id);
  redraw();
}

function addLayer() {
  openModal('modal-add-layer');
}

function confirmAddLayer() {
  const name = document.getElementById('new-layer-name').value.trim();
  const color = document.getElementById('new-layer-color').value;
  if (!name) return;
  const id = 'layer-' + Date.now();
  layers.push({ id, name, color, visible: true, locked: false });
  closeModal('modal-add-layer');
  document.getElementById('new-layer-name').value = '';
  renderLayerList();
}

function deleteLayerConfirm(id, e) {
  e.stopPropagation();
  if (!confirm('Delete this layer? Elements on it will move to Base Plan.')) return;
  State.elements.forEach(el => { if (el.layerId === id) el.layerId = 'base'; });
  layers = layers.filter(l => l.id !== id);
  if (State.activeLayer === id) State.activeLayer = 'base';
  State.fullOpacityLayers.delete(id);
  renderLayerList();
  redraw();
}

// ── Legend ────────────────────────────────────────────────────────────────
let legendVisible = true;
let legendExpanded = false;

function toggleLegend() {
  legendVisible = !legendVisible;
  document.getElementById('legend').classList.toggle('hidden', !legendVisible);
}

function toggleLegendExpand() {
  legendExpanded = !legendExpanded;
  const legend = document.getElementById('legend');
  const icon = document.getElementById('legend-expand-icon');
  legend.classList.toggle('legend--expanded', legendExpanded);
  // Swap icon: chevrons point inward when expanded, outward when collapsed
  if (legendExpanded) {
    icon.innerHTML = '<polyline points="3,6 8,1 13,6"/><polyline points="3,10 8,15 13,10"/>';
  } else {
    icon.innerHTML = '<polyline points="3,10 8,15 13,10"/><polyline points="3,6 8,1 13,6"/>';
  }
}

function updateLegend() {
  const body = document.getElementById('legend-body');
  body.innerHTML = '';

  // Collect what's on the canvas
  const usedSymCats = new Set();
  const usedLineTypes = new Set();
  const usedAreaDefs = new Set();
  for (const el of State.elements) {
    if (el.type === 'symbol') usedSymCats.add(el.catId);
    if (el.type === 'line') usedLineTypes.add(el.lineType);
    if (el.type === 'polygon' && el.areaDef) usedAreaDefs.add(el.areaDef.id);
    if (el.type === 'polygon' && el.isBoneyard) usedAreaDefs.add('boneyard');
  }

  for (const group of LEGEND_ORDER) {
    let items = [];

    if (group.key === 'lines-fencing' || group.key === 'routes') {
      const relevantTypes = Object.entries(LINE_DEFS)
        .filter(([k, v]) => {
          if (group.key === 'lines-fencing') return v.catId === 'access' || v.catId === 'infrastructure';
          return v.catId === 'routes';
        })
        .filter(([k]) => usedLineTypes.has(k));
      items = relevantTypes.map(([k, def]) => ({
        swatch: `<svg width="24" height="14" viewBox="0 0 24 14">
          <line x1="0" y1="7" x2="24" y2="7" stroke="${def.color}" stroke-width="${def.width}" stroke-dasharray="${(def.dash||[]).join(',')}"/>
          ${def.arrow ? `<polygon points="20,4 24,7 20,10" fill="${def.color}"/>` : ''}
        </svg>`,
        label: def.label,
      }));
    } else if (group.key === 'areas') {
      items = AREA_DEFS.filter(a => usedAreaDefs.has(a.id)).map(a => ({
        swatch: `<div style="width:20px;height:14px;background:${a.fill};border:1.5px solid ${a.stroke};border-radius:2px"></div>`,
        label: a.label,
      }));
      if (usedAreaDefs.has('boneyard')) {
        items.push({ swatch: `<div style="width:20px;height:14px;border:2px dashed #94a3b8;border-radius:2px"></div>`, label: 'Boneyard' });
      }
    } else if (group.key === 'pinchpoints') {
      const pinchEls = State.elements.filter(e => e.type === 'pinchpoint');
      if (!pinchEls.length) continue;
      items = pinchEls.map(el => {
        const dist = haversineDistance(
          el.points[0].lat, el.points[0].lng,
          el.points[1].lat, el.points[1].lng
        );
        return {
          swatch: `<svg width="24" height="14" viewBox="0 0 24 14">
            <line x1="0" y1="7" x2="24" y2="7" stroke="#ef4444" stroke-width="2" stroke-dasharray="4,3"/>
            <circle cx="0" cy="7" r="2.5" fill="#ef4444"/>
            <circle cx="24" cy="7" r="2.5" fill="#ef4444"/>
          </svg>`,
          label: `${el.label} — ${formatDistance(dist)}`,
        };
      });
    } else {
      const cat = SYM_CATS.find(c => c.id === group.key);
      if (!cat || !usedSymCats.has(group.key)) continue;
      // Deduplicate by symId
      const usedSymIds = new Set(State.elements.filter(e => e.catId === group.key).map(e => e.symId));
      items = cat.symbols.filter(s => usedSymIds.has(s.id)).map(s => ({
        swatch: `<svg width="24" height="16" viewBox="0 0 24 16">${symThumbSVG(s, 24, 16)}</svg>`,
        label: s.label,
      }));
    }

    if (items.length === 0) continue;

    const gh = document.createElement('div');
    gh.className = 'legend-group-header';
    gh.textContent = group.label;
    body.appendChild(gh);

    for (const item of items) {
      const row = document.createElement('div');
      row.className = 'legend-item';
      row.innerHTML = `<span class="legend-swatch">${item.swatch}</span>
                       <span class="legend-item-label">${item.label}</span>`;
      body.appendChild(row);
    }
  }
}

// Draggable legend
function initLegendDrag() {
  const legend = document.getElementById('legend');
  const header = document.getElementById('legend-header');
  let dragging = false, ox = 0, oy = 0;

  header.addEventListener('mousedown', e => {
    dragging = true;
    ox = e.clientX - legend.offsetLeft;
    oy = e.clientY - legend.offsetTop;
    e.preventDefault();
  });
  document.addEventListener('mousemove', e => {
    if (!dragging) return;
    legend.style.left = (e.clientX - ox) + 'px';
    legend.style.top = (e.clientY - oy) + 'px';
    legend.style.right = 'auto';
  });
  document.addEventListener('mouseup', () => { dragging = false; });
}


// ── Export (PNG / PDF) ─────────────────────────────────────────────────────
const _exportOpts = { fmt: 'pdf', dpi: 150 };
const SCREEN_DPI = 96; // standard browser DPI

function openExportModal() {
  document.getElementById('export-progress').style.display = 'none';
  setExportOpt('fmt', 'pdf', document.getElementById('expfmt-pdf'));
  setExportOpt('dpi', 150, document.getElementById('expdpi-150'));
  openModal('modal-export');
}

function setExportOpt(group, value, btn) {
  _exportOpts[group] = value;
  btn.parentElement.querySelectorAll('.export-opt').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
}

async function runExport() {
  const fmt = _exportOpts.fmt;
  const scale = _exportOpts.dpi / SCREEN_DPI;
  const title = (State.planTitle || 'siteplan').replace(/[^a-z0-9_-]/gi, '_');

  const prog = document.getElementById('export-progress');
  closeModal('modal-export');
  openModal('modal-export');
  prog.style.display = 'block';
  prog.textContent = 'Capturing screen…';

  try {
    const shot = await html2canvas(document.getElementById('map-wrap'), {
      useCORS: true,
      allowTaint: true,
      scale,
      logging: false,
    });

    if (fmt === 'pdf') {
      prog.textContent = 'Generating PDF…';
      const { jsPDF } = window.jspdf;
      const W = shot.width;
      const H = shot.height;
      const pdf = new jsPDF({
        orientation: W > H ? 'landscape' : 'portrait',
        unit: 'px',
        format: [W, H],
        hotfixes: ['px_scaling'],
      });
      pdf.addImage(shot.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, W, H);
      pdf.save(title + '.pdf');
    } else {
      const a = document.createElement('a');
      a.href = shot.toDataURL('image/png');
      a.download = title + '.png';
      a.click();
    }
    closeModal('modal-export');
  } catch (err) {
    prog.textContent = 'Export failed: ' + err.message;
    console.error(err);
  }
}

// ── Save / Load ────────────────────────────────────────────────────────────
function openSaveModal() {
  document.getElementById('save-name-input').value = State.planTitle;
  document.getElementById('save-layer-note').value = '';
  openModal('modal-save');
}

function confirmSave() {
  const name = document.getElementById('save-name-input').value.trim() || 'Untitled Plan';
  const note = document.getElementById('save-layer-note').value.trim();
  State.planTitle = name;
  document.getElementById('plan-title-text').textContent = name + (note ? ` — ${note}` : '');

  const key = 'siteplan:' + name + (note ? ':' + note : '');
  const data = {
    planTitle: State.planTitle,
    layerNote: note,
    savedAt: new Date().toISOString(),
    activeLayer: State.activeLayer,
    layers: layers.map(l => ({ ...l })),
    elements: serializeElements(),
  };
  localStorage.setItem(key, JSON.stringify(data));
  closeModal('modal-save');
  setStatus(`Saved: "${name}"${note ? ` (${note})` : ''}`);
}

function openLoadModal() {
  const list = document.getElementById('plan-list-items');
  list.innerHTML = '';
  const keys = Object.keys(localStorage).filter(k => k.startsWith('siteplan:'));

  if (keys.length === 0) {
    list.innerHTML = '<p style="padding:12px;color:var(--text3);font-size:13px">No saved plans yet.</p>';
  } else {
    keys.sort().forEach(k => {
      try {
        const data = JSON.parse(localStorage.getItem(k));
        const item = document.createElement('div');
        item.className = 'plan-item';
        item.innerHTML = `
          <span class="plan-item-name">${data.planTitle}${data.layerNote ? ` — ${data.layerNote}` : ''}</span>
          <span class="plan-item-date">${new Date(data.savedAt).toLocaleDateString('en-GB')}</span>
          <button class="plan-item-del" title="Delete" onclick="deletePlan('${k}',event)">✕</button>
        `;
        item.addEventListener('click', () => loadPlan(k));
        list.appendChild(item);
      } catch (e) {}
    });
  }
  openModal('modal-load');
}

function loadPlan(key) {
  try {
    const data = JSON.parse(localStorage.getItem(key));
    State.planTitle = data.planTitle;
    document.getElementById('plan-title-text').textContent = data.planTitle + (data.layerNote ? ` — ${data.layerNote}` : '');
    layers = data.layers || layers;
    State.activeLayer = data.activeLayer || 'base';
    State.elements = deserializeElements(data.elements || []);
    renderLayerList();
    updateLegend();
    redraw();
    closeModal('modal-load');
    setStatus(`Loaded: "${data.planTitle}"`);
  } catch (e) {
    alert('Failed to load plan.');
  }
}

function deletePlan(key, e) {
  e.stopPropagation();
  if (!confirm('Delete this saved plan?')) return;
  localStorage.removeItem(key);
  openLoadModal();
}

function exportPlan() {
  const data = {
    planTitle: State.planTitle,
    exportedAt: new Date().toISOString(),
    layers,
    elements: serializeElements(),
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = (State.planTitle || 'siteplan').toLowerCase().replace(/\s+/g, '-') + '.json';
  a.click();
}

function importPlanFromFile() {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.json,application/json';
  input.addEventListener('change', async () => {
    const file = input.files[0];
    if (!file) return;
    try {
      const text = await file.text();
      const data = JSON.parse(text);
      applyPlanData(data);
      setStatus(`Imported: "${data.planTitle || file.name}"`);
    } catch (e) {
      alert('Failed to import plan — invalid JSON file.');
    }
  });
  input.click();
}

async function loadPlanFromUrl() {
  const planParam = new URLSearchParams(window.location.search).get('plan');
  if (!planParam) return;
  try {
    const res = await fetch(planParam);
    if (!res.ok) throw new Error('fetch failed: ' + res.status);
    const data = await res.json();
    await new Promise(resolve => {
      const check = setInterval(() => {
        if (State.map && State.map.getProjection() && State.map.getBounds()) {
          clearInterval(check);
          resolve();
        }
      }, 100);
    });
    applyPlanData(data);
    setStatus(`Loaded: "${data.planTitle || 'Plan'}"`);
  } catch (e) {
    setStatus('Could not load plan from URL.');
  }
}

function applyPlanData(data) {
  State.planTitle = data.planTitle || 'Untitled Plan';
  document.getElementById('plan-title-text').textContent =
    State.planTitle + (data.layerNote ? ` — ${data.layerNote}` : '');
  if (data.layers) layers = data.layers;
  State.activeLayer = data.activeLayer || 'base';
  State.elements = deserializeElements(data.elements || []);
  renderLayerList();
  updateLegend();
  redraw();
  // Fallback redraw in case canvas wasn't ready on first call
  setTimeout(() => { redraw(); }, 500);
}

function serializeElements() {
  return State.elements.map(el => {
    const s = { ...el };
    if (s.sym) s.symId = s.sym.id;
    delete s.sym; // don't serialise the full sym object
    return s;
  });
}

function deserializeElements(raw) {
  return raw.map(s => {
    if (s.type === 'symbol' && s.symId) {
      const found = findSym(s.symId);
      if (found) s.sym = found.sym;
    }
    return s;
  });
}

// ── Undo stack ────────────────────────────────────────────────────────────
const undoStack = [];

function saveAutoSnapshot() {
  const data = {
    planTitle: State.planTitle,
    activeLayer: State.activeLayer,
    layers: layers.map(l => ({ ...l })),
    elements: serializeElements(),
  };
  undoStack.push(JSON.stringify(data));
  updateUndoBtn();
  // Also persist to localStorage for page-reload recovery
  localStorage.setItem('siteplan:__autosave__', JSON.stringify({ ...data, savedAt: new Date().toISOString() }));
}

function undo() {
  if (undoStack.length <= 1) {
    setStatus('Nothing more to undo');
    return;
  }
  // Pop current state, restore previous
  undoStack.pop();
  const data = JSON.parse(undoStack[undoStack.length - 1]);
  State.planTitle = data.planTitle;
  document.getElementById('plan-title-text').textContent = data.planTitle;
  layers = data.layers || layers;
  State.activeLayer = data.activeLayer || 'base';
  State.elements = deserializeElements(data.elements || []);
  clearSelection();
  renderLayerList();
  updateLegend();
  redraw();
  updateUndoBtn();
  setStatus('Undo · ' + (undoStack.length - 1) + ' more step' + (undoStack.length - 1 === 1 ? '' : 's') + ' available');
}

function updateUndoBtn() {
  const btn = document.getElementById('btn-undo');
  if (!btn) return;
  btn.disabled = undoStack.length <= 1;
  btn.title = undoStack.length <= 1 ? 'Nothing to undo' : `Undo (${undoStack.length - 1} step${undoStack.length - 1 === 1 ? '' : 's'})`;
}

// ── Rename plan ────────────────────────────────────────────────────────────
function renamePlan() {
  document.getElementById('rename-input').value = State.planTitle;
  openModal('modal-rename');
}

function confirmRename() {
  const v = document.getElementById('rename-input').value.trim();
  if (v) {
    State.planTitle = v;
    document.getElementById('plan-title-text').textContent = v;
  }
  closeModal('modal-rename');
}

// ── Address search ─────────────────────────────────────────────────────────
function geocodeAddress() {
  if (!State.geocoder) { setStatus('Map not loaded — enter API key first'); return; }
  const addr = document.getElementById('addr-input').value.trim();
  if (!addr) return;
  State.geocoder.geocode({ address: addr }, (results, status) => {
    if (status === 'OK' && results[0]) {
      State.map.setCenter(results[0].geometry.location);
      State.map.setZoom(17);
      setStatus('Location found · Place symbols to start planning');
    } else {
      setStatus('Address not found — try a more specific query');
    }
  });
}

// ── Measure overlay (call from redraw() in render.js) ─────────────────────
function drawMeasureOverlay(ctx) {
  const pts = State.measurePoints;
  if (pts.length === 0) return;

  const p1 = latLngToPixel(pts[0].lat, pts[0].lng);

  // If mid-measurement, draw live line to current mouse pos
  const p2 = pts.length >= 2
    ? latLngToPixel(pts[1].lat, pts[1].lng)
    : (State.currentTool === 'measure' ? State.mousePos : null);

  ctx.save();

  // Point A marker
  ctx.beginPath();
  ctx.arc(p1.x, p1.y, 5, 0, Math.PI * 2);
  ctx.fillStyle = '#facc15';
  ctx.fill();
  ctx.strokeStyle = '#000';
  ctx.lineWidth = 1.5;
  ctx.stroke();

  if (p2) {
    // Line
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = '#facc15';
    ctx.lineWidth = 2;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // Point B marker
    ctx.beginPath();
    ctx.arc(p2.x, p2.y, 5, 0, Math.PI * 2);
    ctx.fillStyle = pts.length >= 2 ? '#facc15' : 'rgba(250,204,21,0.5)';
    ctx.fill();
    ctx.strokeStyle = '#000';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Midpoint distance label (only when both points placed)
    if (pts.length >= 2 && State.measureResult != null) {
      const mx = (p1.x + p2.x) / 2;
      const my = (p1.y + p2.y) / 2;
      const label = formatDistance(State.measureResult);
      ctx.font = 'bold 13px sans-serif';
      const tw = ctx.measureText(label).width;
      ctx.fillStyle = 'rgba(0,0,0,0.75)';
      ctx.beginPath();
      ctx.roundRect(mx - tw / 2 - 6, my - 11, tw + 12, 20, 4);
      ctx.fill();
      ctx.fillStyle = '#facc15';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, mx, my);
    }
  }

  ctx.restore();
}

// ── Measure HUD ────────────────────────────────────────────────────────────
function updateMeasureHUD(distM) {
  let hud = document.getElementById('measure-hud');
  if (!hud) {
    hud = document.createElement('div');
    hud.id = 'measure-hud';
    hud.style.cssText = [
      'position:absolute',
      'bottom:40px',
      'left:50%',
      'transform:translateX(-50%)',
      'background:rgba(0,0,0,0.82)',
      'color:#fff',
      'padding:7px 18px',
      'border-radius:6px',
      'font-size:15px',
      'font-weight:600',
      'letter-spacing:0.03em',
      'z-index:50',
      'pointer-events:none',
      'display:none',
      'border:1px solid rgba(255,255,255,0.15)',
    ].join(';');
    document.getElementById('map-wrap').appendChild(hud);
  }
  if (distM == null) {
    hud.style.display = 'none';
  } else {
    hud.textContent = '📏 ' + formatDistance(distM);
    hud.style.display = 'block';
  }
}

// ── Map dim ────────────────────────────────────────────────────────────────
function setMapDim(level) {
  const overlay = document.getElementById('map-dim-overlay');
  if (overlay) overlay.style.background = `rgba(0,0,0,${level})`;
  document.querySelectorAll('.tb-btn-dim').forEach(b => b.classList.remove('active'));
  const active = document.getElementById('dim-' + Math.round(level * 100));
  if (active) active.classList.add('active');
}

// ── Zoom controls ─────────────────────────────────────────────────────────
function mapZoom(delta) {
  if (!State.map) return;
  State.map.setZoom(State.map.getZoom() + delta);
}

// ── Status bar ─────────────────────────────────────────────────────────────
function setStatus(msg) {
  document.getElementById('statusbar').textContent = msg;
}

// ── Modal helpers ──────────────────────────────────────────────────────────
function openModal(id) { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }

// ── Map init ───────────────────────────────────────────────────────────────
function initMap() {
  const key = document.getElementById('api-key-input').value.trim();
  if (!key) { alert('Enter your API key.'); return; }
  if (document.querySelector('script[src*="maps.googleapis.com"]')) { onMapReady(); return; }
  localStorage.setItem('sp_api_key', key);
  const script = document.createElement('script');
  script.src = `https://maps.googleapis.com/maps/api/js?key=${key}&libraries=places,geometry&callback=onMapReady`;
  script.async = true;
  script.onerror = () => alert('Failed to load Google Maps — check your key and that Maps JavaScript API is enabled.');
  document.head.appendChild(script);
}

window.onMapReady = function () {
  document.getElementById('api-prompt').style.display = 'none';
  State.mapLoaded = true;
  State.map = new google.maps.Map(document.getElementById('map'), {
    center: { lat: 53.795, lng: -1.759 },
    zoom: 17,
    mapTypeId: 'hybrid',
    disableDefaultUI: true,
    zoomControl: true,
    rotateControl: false,
    tilt: 0,
    styles: [{ featureType: 'all', elementType: 'labels.text', stylers: [{ color: '#cccccc' }] }],
  });
  State.geocoder = new google.maps.Geocoder();
  State.map.addListener('zoom_changed', () => {
    document.getElementById('zoom-display').textContent = `z:${State.map.getZoom()}`;
    redraw();
  });
  State.map.addListener('center_changed', () => redraw());
  State.map.addListener('tilesloaded', () => State.map.setTilt(0));
  setStatus('Map loaded · Drag symbols onto the map to place them');

  // Wait for projection to be ready before initialising canvas
  const waitForProjection = setInterval(() => {
    if (!State.map.getProjection()) return;
    clearInterval(waitForProjection);
    initCanvas();
    initCanvasEvents();
    if (undoStack.length === 0) saveAutoSnapshot(); // seed if no autosave was restored
    loadPlanFromUrl(); // load ?plan= JSON if present
  }, 100);
};

function loadWithoutMap() {
  document.getElementById('api-prompt').style.display = 'none';
  const mapEl = document.getElementById('map');
  mapEl.style.background = 'repeating-linear-gradient(0deg,transparent,transparent 49px,#252830 49px,#252830 50px),repeating-linear-gradient(90deg,transparent,transparent 49px,#252830 49px,#252830 50px)';
  mapEl.style.backgroundSize = '50px 50px';
  setStatus('Grid mode · Drag symbols to place · No map scale available');
}
