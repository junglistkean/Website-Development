// ═══════════════════════════════════════════════════════════════════════════
// SITEPLAN.JS — State, Constants, Symbol Definitions
// ═══════════════════════════════════════════════════════════════════════════

// ── State ──────────────────────────────────────────────────────────────────
const State = {
  map: null,
  geocoder: null,
  mapLoaded: false,
  currentTool: 'select',       // select | line | polygon
  currentLineType: null,
  currentAreaDef: null,
  planTitle: 'Untitled Plan',
  activeLayer: 'base',
  fullOpacityLayers: new Set(['base']),
  elements: [],
  idCounter: 1,
  selectedId: null,
  ctxTargetId: null,

  // draw state
  drawing: false,
  drawPoints: [],
  mousePos: { x: 0, y: 0 },

  // measure state
  measurePoints: [],       // 0, 1 or 2 {lat,lng} points
  measureResult: null,     // distance in metres, or null

  // pinch point state
  pinchPoints: [],
  pinchCounter: 0,

  // rotate handle state
  rotateDragging: false,
  rotateStartAngle: 0,     // angle from centre to mouse at drag start
  rotateStartRot: 0,       // el.rotation at drag start

  // drag state (canvas symbol drag)
  dragging: false,
  dragId: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  dragResizing: false,
  resizeHandle: null,
};

// ── Layers ─────────────────────────────────────────────────────────────────
let layers = [
  { id: 'base',        name: 'Base Plan',          color: '#f59e0b', visible: true, locked: false },
  { id: 'electrical',  name: 'Electrical Safety',  color: '#3b82f6', visible: true, locked: false },
  { id: 'evacuation',  name: 'Evacuation Plan',    color: '#22c55e', visible: true, locked: false },
  { id: 'fire',        name: 'Fire Safety',        color: '#ef4444', visible: true, locked: false },
  { id: 'performance', name: 'Performance Layout', color: '#a78bfa', visible: true, locked: false },
];

// ── Snap constants ─────────────────────────────────────────────────────────
const SNAP = {
  HERAS: 3.5,
  PED_BARRIER: 2.3,
  CABLE_RAMP: 0.9,
  BONEYARD: 3.5,
};

// ── Capacity density (m² per person) ──────────────────────────────────────
const DENSITY = {
  dense:      { label: 'Dense Standing',     sqm: 0.50 },
  standing:   { label: 'Comfortable Standing', sqm: 0.75 },
  seated:     { label: 'Festival Seated',    sqm: 0.50 },
  seated_ch:  { label: 'Seated (Chairs)',    sqm: 0.75 },
};

// ── Line definitions ───────────────────────────────────────────────────────
const LINE_DEFS = {
  'ped-barrier': {
    label: 'Pedestrian Barrier', catId: 'access',
    color: '#60a5fa', width: 2.5, dash: [6, 3], arrow: false,
    snapM: SNAP.PED_BARRIER, special: null,
  },
  'heras': {
    label: 'Heras Fencing', catId: 'access',
    color: '#f97316', width: 2.5, dash: [10, 4], arrow: false,
    snapM: SNAP.HERAS, special: null,
  },
  'cable-ramp': {
    label: 'Cable Ramp', catId: 'infrastructure',
    color: '#1f2937', width: 10, dash: [], arrow: false,
    snapM: SNAP.CABLE_RAMP, special: 'cable-ramp',
  },
  'emergency-route': {
    label: 'Emergency Service Route', catId: 'routes',
    color: '#ef4444', width: 2.5, dash: [8, 4], arrow: true, snapM: null,
  },
  'evacuation-route': {
    label: 'Evacuation Route', catId: 'routes',
    color: '#22c55e', width: 2.5, dash: [8, 4], arrow: true, snapM: null,
  },
  'trader-route': {
    label: 'Trader Access/Egress', catId: 'routes',
    color: '#a78bfa', width: 2, dash: [8, 4], arrow: true, snapM: null,
  },
    'lighting-run': {
    label: 'Lighting Run', catId: 'av',
    color: '#a3e635', width: 2, dash: [8, 4], arrow: false,
    snapM: null, special: 'lighting-run',
  },
};

// ── Area definitions ───────────────────────────────────────────────────────
const AREA_DEFS = [
  { id: 'area-kids',        label: 'Kids Area',           fill: 'rgba(251,191,36,0.22)',  stroke: '#fbbf24' },
  { id: 'area-exercise',    label: 'Exercise Area',       fill: 'rgba(34,197,94,0.2)',    stroke: '#22c55e' },
  { id: 'area-performance', label: 'Performance Area',    fill: 'rgba(167,139,250,0.2)',  stroke: '#a78bfa' },
  { id: 'area-fountain',    label: 'Fountain',            fill: 'rgba(56,189,248,0.25)',  stroke: '#38bdf8' },
  { id: 'area-alcohol',     label: 'Alcohol Area',        fill: 'rgba(239,68,68,0.15)',   stroke: '#ef4444' },
  { id: 'area-food',        label: 'Food & Drink Area',   fill: 'rgba(245,158,11,0.2)',   stroke: '#f59e0b' },
  { id: 'area-parking',     label: 'Parking Area',        fill: 'rgba(148,163,184,0.2)',  stroke: '#94a3b8' },
  { id: 'area-arts',        label: 'Arts & Crafts Area',  fill: 'rgba(236,72,153,0.2)',   stroke: '#ec4899' },
  { id: 'area-custom',      label: 'Custom Area',         fill: 'rgba(255,255,255,0.1)',  stroke: '#ffffff', assignable: true },
];

// ── Symbol definitions ─────────────────────────────────────────────────────
const SYM_CATS = [
  {
    id: 'stages', name: 'Stages & Performance',
    symbols: [
      { id: 'trailer-stage',   label: 'Trailer Stage',     wM: 7.2,  dM: 4.5,  render: 'stage',       fill: '#111827', stroke: '#6b7280' },
      { id: 'stage-2x2',       label: 'Stage 2.5×2.5',     wM: 2.5,  dM: 2.5,  render: 'stage',       fill: '#111827', stroke: '#6b7280' },
      { id: 'stage-2x5',       label: 'Stage 2.5×5',       wM: 2.5,  dM: 5.0,  render: 'stage',       fill: '#111827', stroke: '#6b7280' },
      { id: 'litedeck',        label: 'Litedeck 8×4ft',    wM: 2.44, dM: 1.22, render: 'litedeck',    fill: '#1f2937', stroke: '#9ca3af' },
      { id: 'truss-arch',      label: 'Truss Archway',     wM: 4.0,  dM: 0.58, render: 'truss-arch',  fill: '#c0c0c0', stroke: '#374151', resizeWOnly: true },
      { id: 'perf-point',      label: 'Performance Point', wM: 3.0,  dM: 3.0,  render: 'perf-point',  fill: 'transparent', stroke: '#f59e0b' },
    ],
  },
  {
    id: 'structures', name: 'Structures',
    symbols: [
      { id: 'gaz-3x3',   label: 'Gazebo 3×3',     wM: 3.0, dM: 3.0, render: 'gazebo', fill: '#111827', stroke: '#4b5563', cross: '#ffffff' },
      { id: 'gaz-45x3',  label: 'Gazebo 4.5×3',   wM: 4.5, dM: 3.0, render: 'gazebo', fill: '#111827', stroke: '#4b5563', cross: '#ffffff' },
      { id: 'gaz-6x3',   label: 'Gazebo 6×3',     wM: 6.0, dM: 3.0, render: 'gazebo', fill: '#111827', stroke: '#4b5563', cross: '#ffffff' },
      { id: 'stretch-tent', label: 'Stretch Tent', wM: 8.0, dM: 6.0, render: 'stretch-tent', fill: '#d4b483', stroke: '#b89a60', resizable: true },
      { id: 'layher-sq',  label: 'Layher 2.5×2.5', wM: 2.5, dM: 2.5, render: 'layher', fill: '#4b5563', stroke: '#94a3b8', hasHeight: true },
      { id: 'layher-rect',label: 'Layher 2.5×5',   wM: 2.5, dM: 5.0, render: 'layher', fill: '#4b5563', stroke: '#94a3b8', hasHeight: true },
    ],
  },
  {
    id: 'traders', name: 'Traders & Concessions',
    symbols: [
      { id: 'hot-food',    label: 'Hot Food',        wM: 4.0, dM: 3.0, render: 'trader', fill: '#78350f', stroke: '#d97706', icon: '🍔', resizable: true },
      { id: 'cold-food',   label: 'Cold Food',       wM: 4.0, dM: 3.0, render: 'trader', fill: '#1e3a8a', stroke: '#3b82f6', icon: '🥗', resizable: true },
      { id: 'non-alc',     label: 'Non-Alc Drinks',  wM: 3.0, dM: 3.0, render: 'trader', fill: '#134e4a', stroke: '#14b8a6', icon: '🥤', resizable: true },
      { id: 'bar',         label: 'Bar',             wM: 4.0, dM: 3.0, render: 'trader', fill: '#4c1d95', stroke: '#a78bfa', icon: '🍺', resizable: true },
      { id: 'arts-crafts', label: 'Arts & Crafts',   wM: 4.0, dM: 3.0, render: 'trader', fill: '#831843', stroke: '#ec4899', icon: '🎨', resizable: true },
      { id: 'info-point',  label: 'Info Point',      wM: 3.0, dM: 2.0, render: 'trader', fill: '#064e3b', stroke: '#10b981', icon: 'ℹ',  resizable: true },
    ],
  },
  {
    id: 'welfare', name: 'Welfare',
    symbols: [
      { id: 'toilet-perm',  label: 'Public Toilets',    wM: 3.0, dM: 2.0, render: 'toilet-block', fill: '#1e3a5f', stroke: '#60a5fa' },
      { id: 'portaloo-std', label: 'Portaloo Std',      wM: 1.2, dM: 1.2, render: 'portaloo',    fill: '#1e3a5f', stroke: '#60a5fa', icon: 'P' },
      { id: 'portaloo-acc', label: 'Portaloo Access',   wM: 1.5, dM: 1.6, render: 'portaloo',    fill: '#1e3a5f', stroke: '#93c5fd', icon: '♿' },
      { id: 'urinal',       label: 'Urinal Unit',       wM: 1.2, dM: 1.2, render: 'portaloo',    fill: '#1e3a5f', stroke: '#60a5fa', icon: 'U' },
      { id: 'handwash',     label: 'Handwash Station',  wM: 1.0, dM: 0.8, render: 'pin-icon',    fill: '#0c4a6e', stroke: '#38bdf8', icon: '🖐' },
      { id: 'water-point',  label: 'Water Point',       wM: 0.8, dM: 0.8, render: 'pin-icon',    fill: '#0c4a6e', stroke: '#7dd3fc', icon: '💧' },
    ],
  },
  {
    id: 'safety', name: 'First Aid & Event Control',
    symbols: [
      { id: 'fa-3x3',  label: 'First Aid 3×3',       wM: 3.0, dM: 3.0, render: 'safety-gaz', fill: '#14532d', stroke: '#22c55e', cross: '#ffffff' },
      { id: 'fa-45x3', label: 'First Aid 4.5×3',     wM: 4.5, dM: 3.0, render: 'safety-gaz', fill: '#14532d', stroke: '#22c55e', cross: '#ffffff' },
      { id: 'ec-3x3',  label: 'Event Control 3×3',   wM: 3.0, dM: 3.0, render: 'safety-gaz', fill: '#374151', stroke: '#9ca3af', cross: '#ffffff' },
      { id: 'ec-45x3', label: 'Event Control 4.5×3', wM: 4.5, dM: 3.0, render: 'safety-gaz', fill: '#374151', stroke: '#9ca3af', cross: '#ffffff' },
    ],
  },
  {
    id: 'access', name: 'Access Control',
    symbols: [
      { id: 'sec-checkpoint', label: 'Security Checkpoint', wM: 2.0, dM: 1.0, render: 'pin-icon',  fill: '#1f2937', stroke: '#f59e0b', icon: '🔒' },
      { id: 'bollard-perm',   label: 'Bollard (Permanent)', wM: 0.5, dM: 0.5, render: 'bollard',   fill: '#374151', stroke: '#6b7280', bType: 'perm' },
      { id: 'bollard-ret',    label: 'Bollard (Retractable)', wM: 0.5, dM: 0.5, render: 'bollard', fill: '#78350f', stroke: '#f59e0b', bType: 'retract' },
    ],
  },
  {
    id: 'infrastructure', name: 'Infrastructure',
    symbols: [
      { id: 'elec-feed',    label: 'Electric Feed',     wM: 0.8, dM: 0.8, render: 'pin-icon', fill: '#1e3a8a', stroke: '#60a5fa', icon: '⚡' },
      { id: 'ignition-gas', label: 'Ignition (Gas)',    wM: 0.8, dM: 0.8, render: 'pin-icon', fill: '#7c2d12', stroke: '#f97316', icon: '🔥' },
      { id: 'ignition-elec',label: 'Ignition (Elec)',   wM: 0.8, dM: 0.8, render: 'pin-icon', fill: '#1e3a8a', stroke: '#facc15', icon: '⚡' },
      { id: 'pinch-point',  label: 'Pinch Point',       wM: 0.8, dM: 0.8, render: 'pin-icon', fill: '#7f1d1d', stroke: '#ef4444', icon: '⚠' },
    ],
  },
  {
    id: 'hs', name: 'H&S',
    symbols: [
      { id: 'extinguisher', label: 'Extinguisher',   wM: 0.6, dM: 0.6, render: 'pin-icon',  fill: '#7f1d1d', stroke: '#ef4444', icon: '🧯' },
      { id: 'emerg-exit',   label: 'Emergency Exit', wM: 1.2, dM: 0.6, render: 'exit-sign', fill: '#166534', stroke: '#22c55e' },
    ],
  },
  {
    id: 'waste', name: 'Waste',
    symbols: [
      { id: 'bin-1100-gen', label: '1100L General',   wM: 1.2, dM: 1.0, render: 'bin', fill: '#374151', stroke: '#6b7280', bType: 'general' },
      { id: 'bin-1100-rec', label: '1100L Recycling', wM: 1.2, dM: 1.0, render: 'bin', fill: '#14532d', stroke: '#22c55e', bType: 'recycling' },
      { id: 'bin-100',      label: '100L Bin',        wM: 0.5, dM: 0.5, render: 'bin', fill: '#374151', stroke: '#9ca3af', bType: 'small' },
    ],
  },
  {
    id: 'signage', name: 'Signage & Branding',
    symbols: [
      { id: 'sign',    label: 'Sign / Banner',  wM: 2.0, dM: 0.3, render: 'sign',     fill: '#111827', stroke: '#f59e0b' },
      { id: 'branding',label: 'Branding Point', wM: 0.8, dM: 0.8, render: 'pin-icon', fill: '#78350f', stroke: '#fbbf24', icon: '★' },
    ],
  },
  {
    id: 'furniture', name: 'Furniture',
    symbols: [
      { id: 'picnic-bench', label: 'Picnic Bench',   wM: 1.8, dM: 0.8,  render: 'rect-label', fill: '#292524', stroke: '#92400e', shortLabel: 'PB' },
      { id: 'bench',        label: 'Bench',          wM: 1.8, dM: 0.45, render: 'rect-label', fill: '#292524', stroke: '#78350f', shortLabel: 'B' },
      { id: 'chair',        label: 'Chair',          wM: 0.5, dM: 0.5,  render: 'rect-label', fill: '#292524', stroke: '#78350f', shortLabel: 'C' },
      { id: 'trestle',      label: 'Trestle Table',  wM: 1.8, dM: 0.75, render: 'rect-label', fill: '#292524', stroke: '#78350f', shortLabel: 'TT' },
    ],
  },
  {
    id: 'art', name: 'Art & Installations',
    symbols: [
      { id: 'art-install', label: 'Art Installation', wM: 3.0, dM: 3.0, render: 'diamond', fill: 'transparent', stroke: '#ec4899', resizable: true },
    ],
  },
  {
    id: 'boneyard', name: 'Compound',
    symbols: [
      { id: 'boneyard-compound', label: 'Boneyard', wM: 14.0, dM: 10.5, render: 'boneyard', fill: 'transparent', stroke: '#94a3b8', isBoneyard: true },
    ],
  },
  {
  id: 'av', name: 'AV',
  symbols: [
    { id: 'pa-stack', label: 'PA Stack', wM: 1.0, dM: 1.0, render: 'pa-stack', fill: '#111827', stroke: '#a3e635', resizable: true },
  ],
},
  {
    id: 'personnel', name: 'Personnel',
    symbols: [
      { id: 'security',   label: 'Security / SIA',    wM: 1.0, dM: 1.0, render: 'person', fill: '#111827', stroke: '#f59e0b', pinColor: '#f59e0b', initial: 'S' },
      { id: 'event-staff',label: 'Event Personnel',   wM: 1.0, dM: 1.0, render: 'person', fill: '#111827', stroke: '#3b82f6', pinColor: '#3b82f6', initial: 'E' },
      { id: 'first-aider',label: 'First Aider / Para',wM: 1.0, dM: 1.0, render: 'person', fill: '#111827', stroke: '#22c55e', pinColor: '#22c55e', initial: '+' },
    ],
  },
];

// ── Legend group order ─────────────────────────────────────────────────────
const LEGEND_ORDER = [
  { key: 'stages',         label: 'Stages & Performance' },
  { key: 'structures',     label: 'Structures' },
  { key: 'traders',        label: 'Traders & Concessions' },
  { key: 'welfare',        label: 'Welfare' },
  { key: 'safety',         label: 'First Aid & Event Control' },
  { key: 'access',         label: 'Fencing & Access Control' },
  { key: 'lines-fencing',  label: 'Fencing (Drawn)' },
  { key: 'infrastructure', label: 'Infrastructure' },
  { key: 'av',             label: 'AV' },
  { key: 'hs',             label: 'H&S' },
  { key: 'waste',          label: 'Waste' },
  { key: 'signage',        label: 'Signage & Branding' },
  { key: 'furniture',      label: 'Furniture' },
  { key: 'art',            label: 'Art & Installations' },
  { key: 'boneyard',       label: 'Compound' },
  { key: 'areas',          label: 'Areas' },
  { key: 'routes',         label: 'Routes' },
  { key: 'pinchpoints', label: 'Pinch Points' },
  { key: 'personnel',      label: 'Personnel' },
];

// ── Helpers ────────────────────────────────────────────────────────────────
function findSym(id) {
  for (const cat of SYM_CATS) {
    const s = cat.symbols.find(s => s.id === id);
    if (s) return { sym: s, catId: cat.id };
  }
  return null;
}

function getLayer(id) { return layers.find(l => l.id === id); }

function nextId() { return 'el-' + (State.idCounter++); }

function metersPerPixel() {
  if (!State.map) return 0.15;
  const z = State.map.getZoom();
  const lat = State.map.getCenter().lat();
  return (156543.03392 * Math.cos(lat * Math.PI / 180)) / Math.pow(2, z);
}

function mToP(m) { return m / metersPerPixel(); }   // metres → pixels
function pToM(p) { return p * metersPerPixel(); }   // pixels → metres

// Snap line length to nearest multiple of snapM
function snapLength(lengthM, snapM) {
  if (!snapM) return lengthM;
  return Math.max(snapM, Math.round(lengthM / snapM) * snapM);
}

// Polygon area (shoelace, returns m²)
function polygonAreaM2(pts) {
  if (!pts || pts.length < 3) return 0;
  const mpp = metersPerPixel();
  let area = 0;
  const n = pts.length;
  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    area += (pts[i].x * pts[j].y - pts[j].x * pts[i].y);
  }
  return Math.abs(area / 2) * mpp * mpp;
}

// Point-in-polygon test
function pointInPoly(px, py, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const xi = pts[i].x, yi = pts[i].y;
    const xj = pts[j].x, yj = pts[j].y;
    if (((yi > py) !== (yj > py)) && (px < (xj - xi) * (py - yi) / (yj - yi) + xi)) {
      inside = !inside;
    }
  }
  return inside;
}

// Obstacle area within polygon (px²)
function obstacleAreaInPolygon(polyEl) {
  if (!polyEl || !polyEl.points) return 0;
  const pts = polyEl.points.map(p => latLngToPixel(p.lat, p.lng));
  let total = 0;
  for (const el of State.elements) {
    if (el.type !== 'symbol' || el.id === polyEl.id) continue;
    if (!pointInPoly(el.x, el.y, pts)) continue;
    total += (el.wM * el.dM);
  }
  return total;
}

function calcCapacity(polyEl, densityKey) {
  const pts = polyEl.points.map(p => latLngToPixel(p.lat, p.lng));
  const grossM2 = polygonAreaM2(pts);
  const obstacleM2 = obstacleAreaInPolygon(polyEl);
  const netM2 = Math.max(0, grossM2 - obstacleM2);
  const sqmPP = (DENSITY[densityKey] || DENSITY.standing).sqm;
  const capacity = Math.floor(netM2 / sqmPP);
  return { grossM2, obstacleM2, netM2, capacity, sqmPP };
}

function latLngToPixel(lat, lng) {
  if (!State.map || !State.map.getProjection()) return { x: 0, y: 0 };
  const proj = State.map.getProjection();
  const bounds = State.map.getBounds();
  const ne = proj.fromLatLngToPoint(bounds.getNorthEast());
  const sw = proj.fromLatLngToPoint(bounds.getSouthWest());
  const scale = Math.pow(2, State.map.getZoom());
  const pt = proj.fromLatLngToPoint(new google.maps.LatLng(lat, lng));
  return { x: (pt.x - sw.x) * scale, y: (pt.y - ne.y) * scale };
}

function pixelToLatLng(x, y) {
  if (!State.map) return { lat: 0, lng: 0 };
  const proj = State.map.getProjection();
  if (!proj) return { lat: 0, lng: 0 };
  const bounds = State.map.getBounds();
  if (!bounds) return { lat: 0, lng: 0 };
  const ne = proj.fromLatLngToPoint(bounds.getNorthEast());
  const sw = proj.fromLatLngToPoint(bounds.getSouthWest());
  const scale = Math.pow(2, State.map.getZoom());
  const pt = new google.maps.Point(x / scale + sw.x, y / scale + ne.y);
  const ll = proj.fromPointToLatLng(pt);
  return { lat: ll.lat(), lng: ll.lng() };
}

// Haversine great-circle distance between two lat/lng points → metres
function haversineDistance(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(Δφ / 2) ** 2 + Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function formatDistance(m) {
  if (m >= 1000) return (m / 1000).toFixed(3) + ' km';
  if (m >= 10)   return m.toFixed(1) + ' m';
  return m.toFixed(2) + ' m';
}