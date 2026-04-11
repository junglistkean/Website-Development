// ═══════════════════════════════════════════════════════════════════════════
// RENDER.JS — Canvas drawing engine
// ═══════════════════════════════════════════════════════════════════════════

let canvas, ctx;

function initCanvas() {
  canvas = document.getElementById('draw-canvas');
  ctx = canvas.getContext('2d');
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);
}

function resizeCanvas() {
  const wrap = document.getElementById('map-wrap');
  canvas.width  = wrap.clientWidth;
  canvas.height = wrap.clientHeight;
  redraw();
}

// ── Master redraw ──────────────────────────────────────────────────────────
function redraw() {
  if (!ctx) return;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Draw polygons first (areas behind everything)
  for (const el of State.elements) {
    if (el.type !== 'polygon') continue;
    if (!layerVisible(el.layerId)) continue;
    ctx.save();
    try {
      ctx.globalAlpha = layerAlpha(el.layerId);
      drawPolygon(el);
    } finally { ctx.restore(); }
  }

  // Lines
  for (const el of State.elements) {
    if (el.type !== 'line') continue;
    if (!layerVisible(el.layerId)) continue;
    ctx.save();
    try {
      ctx.globalAlpha = layerAlpha(el.layerId);
      drawLine(el);
    } finally { ctx.restore(); }
  }

  // Symbols
  for (const el of State.elements) {
    if (el.type !== 'symbol') continue;
    if (!layerVisible(el.layerId)) continue;
    ctx.save();
    try {
      ctx.globalAlpha = layerAlpha(el.layerId);
      drawSymbol(el);
    } finally { ctx.restore(); }
  }

  // In-progress drawing preview
  if (State.drawing && State.drawPoints.length > 0) {
    drawPreview();
  }

  // Selection handles
  if (State.selectedId) {
    const el = State.elements.find(e => e.id === State.selectedId);
    if (el) drawSelection(el);
  }

  // Scale bar
  if (State.mapLoaded) drawScaleBar();

  // Measure overlay (always on top)
  drawMeasureOverlay(ctx);

  // Pinch point overlay (above measure)
  drawPinchOverlay(ctx);
}

function layerVisible(layerId) {
  const l = getLayer(layerId);
  return l ? l.visible : true;
}

function layerAlpha(layerId) {
  if (layerId === State.activeLayer) return 1.0;
  if (State.fullOpacityLayers.has(layerId)) return 1.0;
  return 0.22;
}

// ── Symbol drawing ─────────────────────────────────────────────────────────
  function drawSymbol(el) {
  if (!el.sym) return;
  const mpp = metersPerPixel();
  const pw = Math.max(el.wM / mpp, 4);
  const ph = Math.max(el.dM / mpp, 4);
  const px = latLngToPixel(el.lat, el.lng);
  console.log('[drawSymbol]', el.sym.render, 'px:', px.x.toFixed(1), px.y.toFixed(1), 'lat:', el.lat, 'lng:', el.lng, 'pw:', pw.toFixed(1), 'ph:', ph.toFixed(1));
  ctx.save();
  try {
  ctx.translate(px.x, px.y);
  ctx.rotate((el.rotation || 0) * Math.PI / 180);

  const hx = -pw / 2, hy = -ph / 2;

  switch (el.sym.render) {

    case 'stage': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(hx, hy, pw, ph);
      ctx.strokeRect(hx, hy, pw, ph);
      // front edge highlight
      ctx.strokeStyle = '#9ca3af';
      ctx.lineWidth = 0.5;
      ctx.beginPath(); ctx.moveTo(hx, hy + ph * 0.18); ctx.lineTo(hx + pw, hy + ph * 0.18); ctx.stroke();
      // label
      ctx.fillStyle = '#9ca3af';
      ctx.font = `bold ${clamp(Math.min(pw, ph) * 0.22, 8, 13)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('STAGE', 0, ph * 0.08);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'pa-stack': {
  ctx.fillStyle = el.sym.fill;
  ctx.strokeStyle = el.sym.stroke;
  ctx.lineWidth = 1.5;
  ctx.fillRect(hx, hy, pw, ph);
  ctx.strokeRect(hx, hy, pw, ph);
  const grillCount = 4;
  ctx.strokeStyle = '#374151';
  ctx.lineWidth = 0.8;
  for (let i = 1; i < grillCount; i++) {
    const gy = hy + (ph / grillCount) * i;
    ctx.beginPath(); ctx.moveTo(hx + pw * 0.1, gy); ctx.lineTo(hx + pw * 0.9, gy); ctx.stroke();
  }
  ctx.strokeStyle = el.sym.stroke;
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.arc(hx + pw / 2, hy, pw * 0.6, Math.PI, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(hx + pw / 2, hy, pw * 0.9, Math.PI, 0);
  ctx.stroke();
  if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
  break;
}

    case 'truss-arch': {
      const legW = clamp(pw * 0.05, 4, 10); // profile in px
      const beamH = legW;
      ctx.fillStyle = '#b0b8c8';
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 0.8;
      // left leg
      ctx.fillRect(hx, hy, legW, ph);
      ctx.strokeRect(hx, hy, legW, ph);
      // right leg
      ctx.fillRect(hx + pw - legW, hy, legW, ph);
      ctx.strokeRect(hx + pw - legW, hy, legW, ph);
      // top beam
      ctx.fillRect(hx, hy, pw, beamH);
      ctx.strokeRect(hx, hy, pw, beamH);
      // box truss profile squares at corners + beam ends
      const sq = legW * 0.7;
      ctx.fillStyle = '#374151';
      const corners = [
        [hx, hy], [hx + pw - sq, hy],
        [hx, hy + ph - sq], [hx + pw - sq, hy + ph - sq],
        [hx + pw * 0.5 - sq / 2, hy],
      ];
      for (const [cx, cy] of corners) {
        ctx.fillRect(cx, cy, sq, sq);
        ctx.strokeRect(cx, cy, sq, sq);
      }
      // span label
      ctx.fillStyle = '#d1d5db';
      ctx.font = `bold ${clamp(pw * 0.1, 8, 12)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${el.wM.toFixed(1)}m`, 0, ph * 0.5);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'litedeck': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.2;
      ctx.fillRect(hx, hy, pw, ph);
      ctx.strokeRect(hx, hy, pw, ph);
      ctx.globalAlpha *= 0.35;
      ctx.lineWidth = 0.5;
      for (let i = 1; i < 3; i++) {
        ctx.beginPath();
        ctx.moveTo(hx + pw * (i / 3), hy); ctx.lineTo(hx + pw * (i / 3), hy + ph);
        ctx.stroke();
      }
      ctx.globalAlpha /= 0.35;
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'gazebo': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(hx, hy, pw, ph);
      ctx.strokeRect(hx, hy, pw, ph);
      ctx.strokeStyle = el.sym.cross || '#ffffff';
      ctx.lineWidth = 1;
      ctx.globalAlpha *= 0.6;
      ctx.beginPath();
      ctx.moveTo(hx, hy); ctx.lineTo(hx + pw, hy + ph);
      ctx.moveTo(hx + pw, hy); ctx.lineTo(hx, hy + ph);
      ctx.stroke();
      ctx.globalAlpha /= 0.6;
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'safety-gaz': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 2;
      ctx.fillRect(hx, hy, pw, ph);
      ctx.strokeRect(hx, hy, pw, ph);
      // white cross (not corner-to-corner — centred plus sign)
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = clamp(Math.min(pw, ph) * 0.13, 2, 7);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, hy + ph * 0.22); ctx.lineTo(0, hy + ph * 0.78);
      ctx.moveTo(hx + pw * 0.22, 0); ctx.lineTo(hx + pw * 0.78, 0);
      ctx.stroke();
      ctx.lineCap = 'butt';
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'stretch-tent': {
      const cx = 0, cy = 0;
      const hw2 = pw / 2, hh2 = ph / 2;
      // Concave pull-in: edges bow inward by ~22% of the shorter dimension
      const sag = Math.min(pw, ph) * 0.22;

      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;

      // Outline: 4 corners connected by concave (quadratic) curves
      ctx.beginPath();
      ctx.moveTo(-hw2, -hh2);                                  // TL corner
      ctx.quadraticCurveTo(0,      -hh2 + sag,  hw2, -hh2);  // top edge (sags down)
      ctx.quadraticCurveTo(hw2 - sag, 0,         hw2,  hh2);  // right edge (sags left)
      ctx.quadraticCurveTo(0,       hh2 - sag, -hw2,  hh2);  // bottom edge (sags up)
      ctx.quadraticCurveTo(-hw2 + sag, 0,       -hw2, -hh2); // left edge (sags right)
      ctx.closePath();
      ctx.fill();
      ctx.stroke();

      // Ridge lines: centre to each corner and centre to each edge midpoint
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1;
      ctx.globalAlpha *= 0.6;
      // To corners
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-hw2, -hh2);
      ctx.moveTo(0, 0); ctx.lineTo( hw2, -hh2);
      ctx.moveTo(0, 0); ctx.lineTo( hw2,  hh2);
      ctx.moveTo(0, 0); ctx.lineTo(-hw2,  hh2);
      // To edge midpoints (approximate — midpoint of each curve at t=0.5)
      ctx.moveTo(0, 0); ctx.lineTo(0,        -hh2 + sag * 0.5);
      ctx.moveTo(0, 0); ctx.lineTo( hw2 - sag * 0.5, 0);
      ctx.moveTo(0, 0); ctx.lineTo(0,         hh2 - sag * 0.5);
      ctx.moveTo(0, 0); ctx.lineTo(-hw2 + sag * 0.5, 0);
      ctx.stroke();
      ctx.globalAlpha /= 0.6;

      // Size label
      ctx.fillStyle = el.sym.stroke;
      ctx.font = `${clamp(Math.min(pw, ph) * 0.16, 8, 11)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(`${el.wM}×${el.dM}m`, 0, 0);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'layher': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.fillRect(hx, hy, pw, ph);
      ctx.strokeRect(hx, hy, pw, ph);
      ctx.setLineDash([]);
      ctx.globalAlpha *= 0.3;
      ctx.beginPath();
      ctx.moveTo(hx, hy); ctx.lineTo(hx + pw, hy + ph);
      ctx.moveTo(hx + pw, hy); ctx.lineTo(hx, hy + ph);
      ctx.stroke();
      ctx.globalAlpha /= 0.3;
      ctx.fillStyle = el.sym.stroke;
      ctx.font = `bold ${clamp(Math.min(pw,ph)*0.22, 7, 12)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const htxt = el.heightNote ? el.heightNote + 'm' : '';
      ctx.fillText(htxt, 0, 0);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'trader': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;
      roundRect(hx, hy, pw, ph, 3);
      ctx.fill(); ctx.stroke();
      ctx.font = `${clamp(Math.min(pw,ph)*0.42, 10, 22)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.sym.icon || '?', 0, 0);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'toilet-block': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(hx, hy, pw, ph);
      ctx.strokeRect(hx, hy, pw, ph);
      // divider
      ctx.globalAlpha *= 0.4;
      ctx.beginPath(); ctx.moveTo(0, hy); ctx.lineTo(0, hy + ph); ctx.stroke();
      ctx.globalAlpha /= 0.4;
      ctx.fillStyle = el.sym.stroke;
      ctx.font = `bold ${clamp(Math.min(pw,ph)*0.3, 9, 14)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🚻', 0, 0);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'portaloo': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;
      roundRect(hx, hy, pw, ph, 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = el.sym.stroke;
      ctx.font = `bold ${clamp(Math.min(pw,ph)*0.38, 9, 16)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.sym.icon || 'WC', 0, 0);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'pin-icon': {
      const r = Math.min(pw, ph) / 2;
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.font = `${clamp(r * 0.9, 9, 18)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.sym.icon || '?', 0, 0);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, r + 5, pw);
      break;
    }

    case 'person': {
      const r = Math.min(pw, ph) / 2;
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.pinColor || el.sym.stroke;
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = el.sym.pinColor || el.sym.stroke;
      ctx.font = `bold ${clamp(r * 0.95, 9, 16)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.sym.initial || '?', 0, 1);
      if (el.customLabel) symLabel(el.customLabel, r + 5, pw * 3);
      break;
    }

    case 'bollard': {
      const r = Math.min(pw, ph) / 2;
      const isRet = el.sym.bType === 'retract';
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = isRet ? '#f59e0b' : '#6b7280';
      ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = isRet ? '#f59e0b' : '#9ca3af';
      ctx.globalAlpha *= 0.7;
      ctx.beginPath(); ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2); ctx.fill();
      ctx.globalAlpha /= 0.7;
      break;
    }

    case 'bin': {
      const bc = el.sym.bType === 'recycling' ? '#22c55e' : el.sym.bType === 'small' ? '#9ca3af' : '#6b7280';
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = bc;
      ctx.lineWidth = 1.5;
      // body
      ctx.fillRect(hx + pw * 0.1, hy + ph * 0.2, pw * 0.8, ph * 0.8);
      ctx.strokeRect(hx + pw * 0.1, hy + ph * 0.2, pw * 0.8, ph * 0.8);
      // lid
      ctx.fillStyle = bc;
      ctx.globalAlpha *= 0.6;
      ctx.fillRect(hx, hy, pw, ph * 0.22);
      ctx.globalAlpha /= 0.6;
      if (el.sym.bType === 'recycling') {
        ctx.fillStyle = '#22c55e';
        ctx.font = `${clamp(Math.min(pw,ph)*0.32, 8, 12)}px sans-serif`;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText('♻', 0, ph * 0.1);
      }
      break;
    }

    case 'exit-sign': {
      ctx.fillStyle = '#166534';
      ctx.strokeStyle = '#22c55e';
      ctx.lineWidth = 1.5;
      roundRect(hx, hy, pw, ph, 2);
      ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#22c55e';
      ctx.font = `bold ${clamp(Math.min(pw,ph)*0.42, 8, 13)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('EXIT', 0, 0);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'sign': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.5;
      ctx.fillRect(hx, hy, pw, ph);
      ctx.strokeRect(hx, hy, pw, ph);
      ctx.fillStyle = el.sym.stroke;
      ctx.font = `bold ${clamp(ph * 0.55, 7, 11)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.label || 'SIGN', 0, 0);
      break;
    }

    case 'rect-label': {
      ctx.fillStyle = el.sym.fill;
      ctx.strokeStyle = el.sym.stroke;
      ctx.lineWidth = 1.2;
      ctx.fillRect(hx, hy, pw, ph);
      ctx.strokeRect(hx, hy, pw, ph);
      ctx.fillStyle = el.sym.stroke;
      ctx.font = `bold ${clamp(Math.min(pw,ph)*0.35, 7, 11)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.sym.shortLabel || '', 0, 0);
      break;
    }

    case 'diamond': {
      ctx.strokeStyle = el.sym.stroke;
      ctx.fillStyle = el.sym.fill || 'transparent';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([3, 2]);
      ctx.beginPath();
      ctx.moveTo(0, hy); ctx.lineTo(hx + pw, 0);
      ctx.lineTo(0, hy + ph); ctx.lineTo(hx, 0);
      ctx.closePath();
      ctx.fill(); ctx.stroke();
      ctx.setLineDash([]);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, ph / 2 + 5, pw);
      break;
    }

    case 'perf-point': {
      ctx.strokeStyle = el.sym.stroke;
      ctx.fillStyle = 'transparent';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([4, 2]);
      ctx.beginPath(); ctx.arc(0, 0, Math.min(pw, ph) / 2, 0, Math.PI * 2); ctx.stroke();
      ctx.setLineDash([]);
      ctx.font = `${clamp(Math.min(pw,ph)*0.4, 10, 20)}px sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText('🎭', 0, 0);
      if (el.label && el.label !== el.sym.label) symLabel(el.label, Math.min(pw,ph)/2 + 5, pw);
      break;
    }

    case 'boneyard': {
      ctx.strokeStyle = el.sym.stroke;
      ctx.fillStyle = 'transparent';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 4]);
      ctx.strokeRect(hx, hy, pw, ph);
      ctx.setLineDash([3, 3]);
      ctx.globalAlpha *= 0.2;
      ctx.beginPath();
      ctx.moveTo(hx, hy); ctx.lineTo(hx + pw, hy + ph);
      ctx.moveTo(hx + pw, hy); ctx.lineTo(hx, hy + ph);
      ctx.stroke();
      ctx.globalAlpha /= 0.2;
      ctx.setLineDash([]);
      ctx.fillStyle = el.sym.stroke;
      ctx.font = `bold ${clamp(Math.min(pw,ph)*0.13, 8, 12)}px Barlow Condensed, sans-serif`;
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(el.label || 'BONEYARD', 0, 0);
      break;
    }
  }
  } finally {
    ctx.restore();
  }
}

function drawLine(el) {
  if (!el.points || el.points.length < 2) return;
  const def = LINE_DEFS[el.lineType];
  if (!def) return;

  const pts = el.points.map(p => latLngToPixel(p.lat, p.lng));

  ctx.save();
  ctx.strokeStyle = def.color;
  ctx.lineWidth = def.width || 2;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  if (def.special === 'cable-ramp') {
    drawCableRampEl(pts);
  } else {
    ctx.setLineDash(def.dash || []);
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
    ctx.stroke();
    ctx.setLineDash([]);

    if (def.arrow) {
      const last = pts.length - 1;
      drawArrowHead(pts[last - 1], pts[last], def.color, 11);
    }
  }

  // Snap segment length labels for fencing
  if (def.snapM && pts.length >= 2) {
    for (let i = 0; i < pts.length - 1; i++) {
      const p1 = pts[i], p2 = pts[i + 1];
      const lenPx = Math.hypot(p2.x - p1.x, p2.y - p1.y);
      const lenM = lenPx * metersPerPixel();
      const mx = (p1.x + p2.x) / 2, my = (p1.y + p2.y) / 2;
      ctx.fillStyle = def.color;
      ctx.font = '10px Barlow Condensed, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'bottom';
      ctx.fillText(`${lenM.toFixed(1)}m`, mx, my - 3);
    }
  }

  // Custom label
  if (el.label) {
    const mid = pts[Math.floor(pts.length / 2)];
    ctx.setLineDash([]);
    ctx.fillStyle = def.color;
    ctx.font = 'bold 11px Barlow Condensed, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(el.label, mid.x, mid.y - 10);
  }

  ctx.restore();
}
function drawCableRampEl(pts) {
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);
    const h = 10;

    ctx.save();
    ctx.translate(p1.x, p1.y);
    ctx.rotate(angle);
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, -h / 2, len, h);
    ctx.fillStyle = '#fbbf24';
    ctx.fillRect(0, -2, len, 4);
    ctx.strokeStyle = '#4b5563';
    ctx.lineWidth = 0.5;
    ctx.setLineDash([]);
    ctx.strokeRect(0, -h / 2, len, h);
    // segment markers at each 0.9m
    const mpp = metersPerPixel();
    const segPx = 0.9 / mpp;
    ctx.strokeStyle = '#374151';
    ctx.lineWidth = 0.5;
    for (let s = segPx; s < len; s += segPx) {
      ctx.beginPath(); ctx.moveTo(s, -h / 2); ctx.lineTo(s, h / 2); ctx.stroke();
    }
    ctx.restore();
  }
 
function drawLightingRunEl(pts, def) {
  for (let i = 0; i < pts.length - 1; i++) {
    const p1 = pts[i], p2 = pts[i + 1];
    const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x);
    const len = Math.hypot(p2.x - p1.x, p2.y - p1.y);

    ctx.save();
    ctx.translate(p1.x, p1.y);
    ctx.rotate(angle);

    // Dashed base line
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.beginPath();
    ctx.moveTo(0, 0);
    ctx.lineTo(len, 0);
    ctx.stroke();
    ctx.setLineDash([]);

    // Chevron ticks every 30px
    const tickSpacing = 30;
    const tickSize = 6;
    ctx.strokeStyle = def.color;
    ctx.lineWidth = 1.5;
    for (let s = tickSpacing; s < len; s += tickSpacing) {
      ctx.beginPath();
      ctx.moveTo(s - tickSize, -tickSize);
      ctx.lineTo(s, 0);
      ctx.lineTo(s - tickSize, tickSize);
      ctx.stroke();
    }

    ctx.restore();
  }
}
}

// ── Polygon drawing ────────────────────────────────────────────────────────
function drawPolygon(el) {
  if (!el.points || el.points.length < 2) return;

  const pts = el.points.map(p => latLngToPixel(p.lat, p.lng));

  ctx.save();
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.closePath();

  if (el.isBoneyard) {
    ctx.strokeStyle = '#94a3b8';
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(148,163,184,0.15)';
    ctx.lineWidth = 1;
    const bounds = polyBounds(pts);
    for (let x = bounds.x - bounds.h; x < bounds.x + bounds.w + bounds.h; x += 14) {
      ctx.beginPath();
      ctx.moveTo(x, bounds.y);
      ctx.lineTo(x + bounds.h, bounds.y + bounds.h);
      ctx.stroke();
    }
    ctx.restore();
  } else {
    ctx.fillStyle = el.areaDef ? el.areaDef.fill : 'rgba(255,255,255,0.08)';
    ctx.fill();
    ctx.strokeStyle = el.areaDef ? el.areaDef.stroke : '#ffffff';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 3]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const c = polyCentroid(pts);

  if (el.capacityDensity) {
    const cap = calcCapacity(el, el.capacityDensity);
    ctx.fillStyle = el.areaDef ? el.areaDef.stroke : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold ${clamp(12, 10, 15)}px Barlow Condensed, sans-serif`;
    ctx.fillText(el.label || (el.areaDef ? el.areaDef.label : 'Area'), c.x, c.y - 14);
    ctx.font = `11px Barlow, sans-serif`;
    ctx.fillText(`Cap: ${cap.capacity.toLocaleString()} · ${cap.netM2.toFixed(0)}m²`, c.x, c.y);
    const dens = DENSITY[el.capacityDensity];
    ctx.font = `10px Barlow, sans-serif`;
    ctx.globalAlpha *= 0.7;
    ctx.fillText(dens ? dens.label : '', c.x, c.y + 13);
    ctx.globalAlpha /= 0.7;
  } else if (el.label) {
    ctx.fillStyle = el.areaDef ? el.areaDef.stroke : '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.font = `bold 12px Barlow Condensed, sans-serif`;
    ctx.fillText(el.label, c.x, c.y);
  }

  ctx.restore();
}

// ── In-progress preview ────────────────────────────────────────────────────
function drawPreview() {
  const pts = State.drawPoints;
  if (pts.length === 0) return;
  const def = State.currentLineType ? LINE_DEFS[State.currentLineType] : null;
  const isArea = State.currentTool === 'polygon';
  const isBoneyard = isArea && State.currentAreaDef && State.currentAreaDef.id === 'boneyard-compound';

  ctx.save();
  ctx.strokeStyle = def ? def.color : (isArea ? '#f59e0b' : '#ffffff');
  ctx.lineWidth = def ? def.width : 1.5;
  ctx.setLineDash(def ? (def.dash || []) : isArea ? [5, 3] : [4, 3]);
  ctx.globalAlpha = 0.7;

  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.lineTo(State.mousePos.x, State.mousePos.y);
  if (isArea && pts.length > 2) ctx.closePath();
  ctx.stroke();
  ctx.setLineDash([]);

  // Snap preview length
  if (def && def.snapM && pts.length > 0) {
    const last = pts[pts.length - 1];
    const rawM = pToM(Math.hypot(State.mousePos.x - last.x, State.mousePos.y - last.y));
    const snapped = snapLength(rawM, def.snapM);
    ctx.fillStyle = def.color;
    ctx.font = 'bold 11px DM Mono, monospace';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 1;
    ctx.fillText(`${snapped.toFixed(1)}m`, State.mousePos.x, State.mousePos.y - 14);
  }

  // Boneyard snap preview
  if (isBoneyard && pts.length > 0) {
    const last = pts[pts.length - 1];
    const rawM = pToM(Math.hypot(State.mousePos.x - last.x, State.mousePos.y - last.y));
    const snapped = snapLength(rawM, SNAP.BONEYARD);
    ctx.fillStyle = '#94a3b8';
    ctx.font = 'bold 11px DM Mono, monospace';
    ctx.textAlign = 'center';
    ctx.globalAlpha = 1;
    ctx.fillText(`${snapped.toFixed(1)}m`, State.mousePos.x, State.mousePos.y - 14);
  }

  // Draw vertices
  ctx.globalAlpha = 1;
  for (const p of pts) {
    ctx.fillStyle = '#f59e0b';
    ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  ctx.restore();
}

// ── Selection handles ──────────────────────────────────────────────────────
function drawSelection(el) {
  ctx.save();
  ctx.strokeStyle = '#f59e0b';
  ctx.lineWidth = 1.5;
  ctx.setLineDash([4, 3]);

  if (el.type === 'symbol') {
    const mpp = metersPerPixel();
    const pw = Math.max(el.wM / mpp, 4);
    const ph = Math.max(el.dM / mpp, 4);
    const px = latLngToPixel(el.lat, el.lng);
    ctx.save();
    ctx.translate(px.x, px.y);
    ctx.rotate((el.rotation || 0) * Math.PI / 180);
    ctx.strokeRect(-pw / 2 - 4, -ph / 2 - 4, pw + 8, ph + 8);
    // resize handles
    ctx.setLineDash([]);
    ctx.fillStyle = '#f59e0b';
    const handles = getSymbolHandles(el, pw, ph);
    for (const h of handles) {
      ctx.fillRect(h.x - 4, h.y - 4, 8, 8);
    }
    // rotate handle — circle above the selection box
    const handleDist = ph / 2 + 22;
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([3, 2]);
    ctx.beginPath();
    ctx.moveTo(0, -ph / 2 - 4);
    ctx.lineTo(0, -handleDist + 6);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(0, -handleDist, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.stroke();
    // rotate icon — small arc with arrow
    ctx.strokeStyle = '#f59e0b';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(0, -handleDist, 3.5, -Math.PI * 0.75, Math.PI * 0.25);
    ctx.stroke();
    ctx.save();
    ctx.translate(2.2, -handleDist - 2.8);
    ctx.rotate(Math.PI * 0.25);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-2.5, -1.5); ctx.lineTo(-1.5, 1.5);
    ctx.closePath();
    ctx.fillStyle = '#f59e0b';
    ctx.fill();
    ctx.restore();
    ctx.restore();

  } else if (el.type === 'polygon' || el.type === 'line') {
    ctx.setLineDash([]);
    const pts = (el.points || []).map(p => latLngToPixel(p.lat, p.lng));
    for (const p of pts) {
      ctx.fillStyle = '#f59e0b';
      ctx.beginPath(); ctx.arc(p.x, p.y, 5, 0, Math.PI * 2); ctx.fill();
    }
    if (el.type === 'polygon' && pts.length > 2) {
      ctx.beginPath();
      ctx.moveTo(pts[0].x, pts[0].y);
      for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
      ctx.closePath();
      ctx.stroke();
    }
  }

  ctx.restore();
}

function getSymbolHandles(el, pw, ph) {
  const hx = -pw / 2, hy = -ph / 2;
  if (el.sym && el.sym.resizeWOnly) {
    return [{ x: hx + pw, y: 0, type: 'e' }];
  }
  return [
    { x: hx + pw, y: hy + ph, type: 'se' },
    { x: hx + pw, y: hy,      type: 'ne' },
    { x: hx,      y: hy + ph, type: 'sw' },
    { x: hx,      y: hy,      type: 'nw' },
    { x: hx + pw, y: 0,       type: 'e' },
    { x: 0,       y: hy + ph, type: 's' },
  ];
}

// ── Helpers ────────────────────────────────────────────────────────────────
function symLabel(text, offsetY, maxW) {
  ctx.save();
  ctx.fillStyle = 'rgba(26,28,30,0.75)';
  const tw = ctx.measureText(text).width + 6;
  ctx.fillRect(-tw / 2, offsetY - 1, tw, 14);
  ctx.fillStyle = '#e8eaed';
  ctx.font = '10px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText(text, 0, offsetY);
  ctx.restore();
}

function roundRect(x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + w - r, y);
  ctx.quadraticCurveTo(x + w, y, x + w, y + r);
  ctx.lineTo(x + w, y + h - r);
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  ctx.lineTo(x + r, y + h);
  ctx.quadraticCurveTo(x, y + h, x, y + h - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function drawArrowHead(from, to, color, size) {
  const angle = Math.atan2(to.y - from.y, to.x - from.x);
  ctx.save();
  ctx.fillStyle = color;
  ctx.setLineDash([]);
  ctx.translate(to.x, to.y);
  ctx.rotate(angle);
  ctx.beginPath();
  ctx.moveTo(0, 0);
  ctx.lineTo(-size, -size / 2.2);
  ctx.lineTo(-size, size / 2.2);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

// ── Scale bar ──────────────────────────────────────────────────────────────
function drawScaleBar() {
  const mpp = metersPerPixel();
  if (!mpp || !isFinite(mpp)) return;

  // Pick the largest clean distance that fits within ~160px
  const candidates = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];
  const maxPx = 160;
  let scaleM = candidates[0];
  for (const m of candidates) {
    if (m / mpp <= maxPx) scaleM = m;
    else break;
  }
  const barPx = scaleM / mpp;

  const margin = 16;
  const barH = 4;
  const x = canvas.width - margin - barPx;
  const y = canvas.height - margin - barH - 14;
  const label = scaleM >= 1000 ? (scaleM / 1000) + 'km' : scaleM + 'm';

  ctx.save();

  // Shadow for legibility over any map tile colour
  ctx.shadowColor = 'rgba(0,0,0,0.6)';
  ctx.shadowBlur = 4;

  // Bar — two-tone alternating blocks (standard cartographic style)
  const half = barPx / 2;
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(x, y, half, barH);
  ctx.fillStyle = '#374151';
  ctx.fillRect(x + half, y, half, barH);

  ctx.shadowBlur = 0;

  // End ticks
  ctx.strokeStyle = '#ffffff';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 3); ctx.lineTo(x, y + barH + 3);
  ctx.moveTo(x + barPx, y - 3); ctx.lineTo(x + barPx, y + barH + 3);
  ctx.stroke();

  // Label
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Barlow Condensed, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.shadowColor = 'rgba(0,0,0,0.8)';
  ctx.shadowBlur = 3;
  ctx.fillText(label, x + barPx / 2, y + barH + 4);

  ctx.restore();
}

function polyBounds(pts) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x; if (p.x > maxX) maxX = p.x;
    if (p.y < minY) minY = p.y; if (p.y > maxY) maxY = p.y;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}

function polyCentroid(pts) {
  let cx = 0, cy = 0;
  for (const p of pts) { cx += p.x; cy += p.y; }
  return { x: cx / pts.length, y: cy / pts.length };
}

// Thumbnail SVG for legend/panel
function symThumbSVG(sym, w, h) {
  const hw = w / 2, hh = h / 2;
  const sw = w * 0.82, sh = h * 0.72;
  const hx = hw - sw / 2, hy = hh - sh / 2;
  const f = sym.fill || 'transparent';
  const s = sym.stroke || '#ffffff';
  switch (sym.render) {
    case 'stage':
      return `<rect x="${hx}" y="${hy}" width="${sw}" height="${sh}" fill="${f}" stroke="${s}" stroke-width="1.5"/><line x1="${hx}" y1="${hy+sh*0.2}" x2="${hx+sw}" y2="${hy+sh*0.2}" stroke="${s}" stroke-width="0.5" opacity="0.4"/>`;
    case 'truss-arch': {
      const lw = sw * 0.08;
      return `<rect x="${hx}" y="${hy}" width="${lw}" height="${sh}" fill="#b0b8c8" stroke="${s}" stroke-width="0.5"/>
              <rect x="${hx+sw-lw}" y="${hy}" width="${lw}" height="${sh}" fill="#b0b8c8" stroke="${s}" stroke-width="0.5"/>
              <rect x="${hx}" y="${hy}" width="${sw}" height="${lw}" fill="#b0b8c8" stroke="${s}" stroke-width="0.5"/>
              <rect x="${hx}" y="${hy}" width="${lw*0.7}" height="${lw*0.7}" fill="#374151"/>
              <rect x="${hx+sw-lw*0.7}" y="${hy}" width="${lw*0.7}" height="${lw*0.7}" fill="#374151"/>`;
    }
    case 'gazebo':
    case 'safety-gaz':
      return `<rect x="${hx}" y="${hy}" width="${sw}" height="${sh}" fill="${sym.fill||'#111827'}" stroke="${s}" stroke-width="1.5"/>
              <line x1="${hx}" y1="${hy}" x2="${hx+sw}" y2="${hy+sh}" stroke="${sym.cross||'#fff'}" stroke-width="1" opacity="0.6"/>
              <line x1="${hx+sw}" y1="${hy}" x2="${hx}" y2="${hy+sh}" stroke="${sym.cross||'#fff'}" stroke-width="1" opacity="0.6"/>`;
    case 'stretch-tent': {
      const sag = Math.min(sw, sh) * 0.22;
      return `<path d="M${hx},${hy} Q${hx+sw/2},${hy+sag} ${hx+sw},${hy} Q${hx+sw-sag},${hy+sh/2} ${hx+sw},${hy+sh} Q${hx+sw/2},${hy+sh-sag} ${hx},${hy+sh} Q${hx+sag},${hy+sh/2} ${hx},${hy} Z"
               fill="${f}" stroke="${s}" stroke-width="1.5"/>
             <line x1="${hx+sw/2}" y1="${hy+sh/2}" x2="${hx}" y2="${hy}" stroke="${s}" stroke-width="0.8" opacity="0.6"/>
             <line x1="${hx+sw/2}" y1="${hy+sh/2}" x2="${hx+sw}" y2="${hy}" stroke="${s}" stroke-width="0.8" opacity="0.6"/>
             <line x1="${hx+sw/2}" y1="${hy+sh/2}" x2="${hx+sw}" y2="${hy+sh}" stroke="${s}" stroke-width="0.8" opacity="0.6"/>
             <line x1="${hx+sw/2}" y1="${hy+sh/2}" x2="${hx}" y2="${hy+sh}" stroke="${s}" stroke-width="0.8" opacity="0.6"/>`;
    }
    case 'layher':
      return `<rect x="${hx}" y="${hy}" width="${sw}" height="${sh}" fill="${f}" stroke="${s}" stroke-width="1.5" stroke-dasharray="3,2"/>`;
    case 'trader':
      return `<rect x="${hx}" y="${hy}" width="${sw}" height="${sh}" fill="${f}" stroke="${s}" stroke-width="1.5" rx="2"/><text x="${hw}" y="${hh+4}" text-anchor="middle" font-size="${Math.min(sw,sh)*0.45}">${sym.icon||'?'}</text>`;
    case 'portaloo':
    case 'toilet-block':
      return `<rect x="${hx}" y="${hy}" width="${sw}" height="${sh}" fill="${f}" stroke="${s}" stroke-width="1.5" rx="2"/><text x="${hw}" y="${hh+4}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="${Math.min(sw,sh)*0.35}" fill="${s}">${sym.icon||'WC'}</text>`;
    case 'pin-icon':
    case 'bollard':
      return `<circle cx="${hw}" cy="${hh}" r="${Math.min(sw,sh)/2}" fill="${f}" stroke="${s}" stroke-width="1.5"/><text x="${hw}" y="${hh+4}" text-anchor="middle" font-size="${Math.min(sw,sh)*0.42}">${sym.icon||''}</text>`;
    case 'person':
      return `<circle cx="${hw}" cy="${hh}" r="${Math.min(sw,sh)/2}" fill="${f}" stroke="${sym.pinColor||s}" stroke-width="1.8"/><text x="${hw}" y="${hh+4}" text-anchor="middle" font-family="Barlow Condensed,sans-serif" font-weight="700" font-size="${Math.min(sw,sh)*0.45}" fill="${sym.pinColor||s}">${sym.initial||'?'}</text>`;
    case 'diamond':
      return `<polygon points="${hw},${hy} ${hx+sw},${hh} ${hw},${hy+sh} ${hx},${hh}" fill="${f}" stroke="${s}" stroke-width="1.5"/>`;
    case 'bin': {
      const bc = sym.bType==='recycling'?'#22c55e':sym.bType==='small'?'#9ca3af':'#6b7280';
      return `<rect x="${hx+sw*0.1}" y="${hy+sh*0.2}" width="${sw*0.8}" height="${sh*0.8}" fill="${f}" stroke="${bc}" stroke-width="1.5"/>
              <rect x="${hx}" y="${hy}" width="${sw}" height="${sh*0.22}" fill="${bc}" opacity="0.5"/>`;
    }
    case 'boneyard':
      return `<rect x="${hx}" y="${hy}" width="${sw}" height="${sh}" fill="transparent" stroke="${s}" stroke-width="1.5" stroke-dasharray="4,3"/>
              <line x1="${hx}" y1="${hy}" x2="${hx+sw}" y2="${hy+sh}" stroke="${s}" stroke-width="0.5" opacity="0.3"/>`;
    default:
      return `<rect x="${hx}" y="${hy}" width="${sw}" height="${sh}" fill="${f}" stroke="${s}" stroke-width="1.5" rx="2"/>`;
  }
}

// ── Pinch Point Overlay ────────────────────────────────────────────────────
function drawPinchOverlay(ctx) {
  ctx.save();

  // Draw placed pinch point segments
  for (const el of State.elements) {
    if (el.type !== 'pinchpoint') continue;
    if (!layerVisible(el.layerId)) continue;
    const [p1, p2] = el.points.map(p => latLngToPixel(p.lat, p.lng));

    // Dashed red line
    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);

    // ⚠ at each endpoint
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('⚠', p1.x, p1.y);
    ctx.fillText('⚠', p2.x, p2.y);

    // Label at midpoint
    const mx = (p1.x + p2.x) / 2;
    const my = (p1.y + p2.y) / 2;
    ctx.font = 'bold 11px Barlow Condensed, sans-serif';
    const tw = ctx.measureText(el.label).width;
    ctx.fillStyle = 'rgba(0,0,0,0.72)';
    ctx.beginPath();
    ctx.roundRect(mx - tw / 2 - 5, my - 9, tw + 10, 18, 3);
    ctx.fill();
    ctx.fillStyle = '#ef4444';
    ctx.fillText(el.label, mx, my);

    // Selection highlight
    if (State.selectedId === el.id) {
      ctx.beginPath();
      ctx.arc(p1.x, p1.y, 8, 0, Math.PI * 2);
      ctx.arc(p2.x, p2.y, 8, 0, Math.PI * 2);
      ctx.strokeStyle = '#ef4444';
      ctx.lineWidth = 2;
      ctx.globalAlpha = 0.5;
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
  }

  // Live preview: first point placed, waiting for second click
  if (State.currentTool === 'pinchpoint' && State.pinchPoints.length === 1 && State.mousePos) {
    const p1 = latLngToPixel(State.pinchPoints[0].lat, State.pinchPoints[0].lng);
    const p2 = State.mousePos;

    ctx.beginPath();
    ctx.moveTo(p1.x, p1.y);
    ctx.lineTo(p2.x, p2.y);
    ctx.strokeStyle = '#ef4444';
    ctx.lineWidth = 2;
    ctx.globalAlpha = 0.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;

    // ⚠ at placed point A
    ctx.font = 'bold 14px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ef4444';
    ctx.fillText('⚠', p1.x, p1.y);
  }

  ctx.restore();
}
