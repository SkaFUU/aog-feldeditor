// AOG Feldeditor – Projektion, Zustand, Karte, Grenzpunkte bearbeiten, Ursprung

// ---------- Projektion (wie AgOpenGPS LocalPlane) ----------
const D = Math.PI / 180;
const mLat = la => 111132.92 - 559.82 * Math.cos(2 * la * D) + 1.175 * Math.cos(4 * la * D) - 0.0023 * Math.cos(6 * la * D);
const mLon = la => 111412.84 * Math.cos(la * D) - 93.5 * Math.cos(3 * la * D) + 0.118 * Math.cos(5 * la * D);
function Plane(lat0, lon0) {
  const ml = mLat(lat0);
  return {
    lat0, lon0,
    fwd: (la, lo) => ({ e: (lo - lon0) * mLon(la), n: (la - lat0) * ml }),
    inv: (e, n) => { const la = lat0 + n / ml; return [la, lon0 + e / mLon(la)]; }
  };
}
function distM(a1, o1, a2, o2) {
  const s1 = Math.sin((a2 - a1) * D / 2), s2 = Math.sin((o2 - o1) * D / 2);
  return 2 * 6371000 * Math.asin(Math.sqrt(s1 * s1 + Math.cos(a1 * D) * Math.cos(a2 * D) * s2 * s2));
}
const r3 = x => String(Math.round(x * 1000) / 1000);
const r7 = x => String(Math.round(x * 1e7) / 1e7);

// ---------- Zustand ----------
const KNOWN = ['Field.txt', 'Boundary.txt', 'Flags.txt', 'Headland.txt', 'TrackLines.txt', 'Sections.txt', 'Contour.txt',
  'Tram.txt', 'RecPath.txt', 'Headlines.txt', 'Elevation.txt', 'BackPic.txt', 'agshare.txt'];
let files = {}, realName = {};       // Originaltexte der Dateien auf der Platte
let plane = null, diskPlane = null;  // aktueller Ursprung / Ursprung der Dateien auf der Platte
let bnds = [], flags = [], flagsDirty = false;
let active = 0, sel = -1, selFlag = -1, undo = [], unsaved = false, mode = '';
let dirHandle = null;
// Oberfläche: gewähltes Register, Feldliste/Seitenleiste ein (gemerkt). Bearbeitbar ist nur, was zum Register gehört.
const ui = { tab: 'feld', nav: true, props: true };
try { Object.assign(ui, JSON.parse(localStorage.getItem('aogUi') || '{}')); } catch (e) { }

const ll = p => { const [a, b] = plane.inv(p.e, p.n); return L.latLng(a, b); };
const originChanged = () => plane && (plane.lat0 !== diskPlane.lat0 || plane.lon0 !== diskPlane.lon0);

// ---------- Karte ----------
const map = L.map('map', { maxZoom: 22, doubleClickZoom: false }).setView([47.6, 14], 7);
const bases = {
  esri: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    { maxZoom: 22, maxNativeZoom: 19, attribution: 'Esri, Maxar, Earthstar Geographics' }),
  at: L.tileLayer('https://mapsneu.wien.gv.at/basemap/bmaporthofoto30cm/normal/google3857/{z}/{y}/{x}.jpeg',
    { maxZoom: 22, maxNativeZoom: 19, attribution: 'basemap.at' }),
  osm: L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png',
    { maxZoom: 22, maxNativeZoom: 19, attribution: '© OpenStreetMap' })
};
// Kartenhintergrund (Register „Ansicht“), wird gemerkt
// (weitere Hintergründe und eigene Karten kommen aus js/17-maps.js dazu)
function setBase(k) {
  const known = !!bases[k];
  if (!known) k = 'esri';
  for (const b in bases) if (b !== k) map.removeLayer(bases[b]);
  bases[k].addTo(map);
  document.querySelectorAll('[data-base]').forEach(el => el.classList.toggle('sel', el.dataset.base === k));
  const more = document.getElementById('btnMaps');
  if (more) more.classList.toggle('sel', k.startsWith('c_'));         // eigene Karte gewählt
  if (known) try { localStorage.setItem('aogBase', k); } catch (e) { }   // eine eigene Karte bleibt gemerkt, auch wenn sie noch nicht geladen ist
}
let savedBase = 'esri';
try { savedBase = localStorage.getItem('aogBase') || 'esri'; } catch (e) { }
setBase(savedBase);
document.querySelectorAll('[data-base]').forEach(el => { el.onclick = () => setBase(el.dataset.base); });
map.on('mousemove', e => { $('sbCoord').textContent = e.latlng.lat.toFixed(7) + ', ' + e.latlng.lng.toFixed(7); });

const otherLayer = L.layerGroup().addTo(map);
const markerLayer = L.layerGroup().addTo(map);
const flagLayer = L.layerGroup().addTo(map);
const originLayer = L.layerGroup().addTo(map);
let lineLayer = null, hitLayer = null;
const icon = L.divIcon({ className: 'pt', iconSize: [14, 14] });
const iconSel = L.divIcon({ className: 'pt sel', iconSize: [18, 18] });
const FLAG_COLORS = ['#ff3b30', '#34c759', '#af52de'];
const MAX_MARKERS = 800;

function drawAll() {
  otherLayer.clearLayers();
  drawOverlay();
  bnds.forEach((b, i) => {
    if (i === active || b.hidden) return;
    const drive = i > 0 && /^true$/i.test(b.flagLines[0] || '');      // befahrbare Innengrenze blau
    L.polygon(b.pts.map(ll), { color: drive ? '#00c8ff' : '#ffd400', weight: 2, fill: false, dashArray: '6 4', interactive: false }).addTo(otherLayer);
  });
  renderBndList();
  drawActive(); drawMarkers(); drawFlags(); drawOrigin(); updateInfo();
}

function drawActive() {
  const b = bnds[active];
  const r = b && !b.hidden ? b.pts.map(ll) : [];
  if (r.length) r.push(r[0]);
  if (!lineLayer) {
    lineLayer = L.polyline(r, { color: '#ff3b30', weight: 3, interactive: false }).addTo(map);
    hitLayer = L.polyline(r, { color: '#000', opacity: 0, weight: 18 });
    if (ui.tab === 'grenze') hitLayer.addTo(map);             // Punkt einfügen nur im Register Grenze
    hitLayer.on('click', onLineClick);
  } else { lineLayer.setLatLngs(r); hitLayer.setLatLngs(r); }
}

function drawMarkers() {
  markerLayer.clearLayers();
  const b = bnds[active], hint = document.getElementById('hint');
  hint.style.display = 'none';
  if (!b || tool || b.hidden || ui.tab !== 'grenze') return;          // nur im Register Grenze, nicht während eines Werkzeugs
  const vb = map.getBounds().pad(0.1), vis = [];
  b.pts.forEach((p, i) => { const q = ll(p); if (vb.contains(q)) vis.push([i, q]); });
  if (vis.length > MAX_MARKERS) { hint.textContent = t('zoomIn'); hint.style.display = 'block'; return; }
  for (const [i, q] of vis) {
    const m = L.marker(q, { icon: i === sel ? iconSel : icon, draggable: true, autoPan: true });
    m.on('dragstart', () => { pushUndo(); sel = i; const old = b.pts.map(ll); old.push(old[0]); showGhost(q, old); });
    m.on('drag', e => { b.pts[i] = plane.fwd(e.latlng.lat, e.latlng.lng); drawActive(); });
    m.on('dragend', () => { changed(b); drawMarkers(); });
    m.on('click', () => { clearGhost(); sel = i; selFlag = -1; drawMarkers(); drawFlags(); updateInfo(); });
    m.on('contextmenu', e => { L.DomEvent.preventDefault(e.originalEvent); deletePoint(i); });
    m.addTo(markerLayer);
  }
}
map.on('moveend', drawMarkers);

function drawFlags() {
  flagLayer.clearLayers();
  flags.forEach((f, i) => {
    const ic = L.divIcon({ className: '', html: `<div class="flag${i === selFlag ? ' sel' : ''}" style="--c:${FLAG_COLORS[f.color] || FLAG_COLORS[0]}"></div>`, iconSize: [18, 24], iconAnchor: [2, 24] });
    const edit = ui.tab === 'fahnen';                      // nur im Register Fahnen verschiebbar und anklickbar
    const m = L.marker([f.lat, f.lon], { icon: ic, draggable: edit, interactive: edit, zIndexOffset: 1000 });
    m.bindTooltip(t('flagTip', i + 1) + (f.notes ? ': ' + f.notes : ''), { direction: 'top', offset: [6, -24] });
    m.on('dragstart', () => showGhost(L.latLng(f.lat, f.lon)));
    m.on('dragend', e => { const p = e.target.getLatLng(); f.lat = p.lat; f.lon = p.lng; flagsDirty = unsaved = true; selFlag = i; drawFlags(); updateInfo(); });
    m.on('click', () => { clearGhost(); selFlag = i; sel = -1; drawFlags(); drawMarkers(); updateInfo(); });
    m.addTo(flagLayer);
  });
}

function drawOrigin() {
  originLayer.clearLayers();
  if (!plane) return;
  const c = [plane.lat0, plane.lon0];
  L.circle(c, { radius: 500, color: '#00c8ff', weight: 2, dashArray: '8 6', fill: false, interactive: false }).addTo(originLayer);
  L.marker(c, { icon: L.divIcon({ className: '', html: '<div class="origin"></div>', iconSize: [22, 22], iconAnchor: [11, 11] }), interactive: false }).addTo(originLayer);
}

function changed(b) { b.dirty = true; unsaved = true; updateInfo(); }

// ---------- Modi (Fahne setzen / Ursprung per Klick) ----------
function setMode(m) {
  if (m) closeTool();
  mode = mode === m ? '' : m;
  document.getElementById('btnAddFlag').classList.toggle('on', mode === 'flag');
  document.getElementById('btnOriginClick').classList.toggle('on', mode === 'origin');
  document.getElementById('map').classList.toggle('pick', !!mode);
}
function mapClick(latlng) {
  if (tool) { if (tool.onClick) tool.onClick(latlng); return; }
  if (mode === 'flag') {
    const id = flags.reduce((m, f) => Math.max(m, f.id || 0), 0) + 1;
    flags.push({ lat: latlng.lat, lon: latlng.lng, heading: 0, color: 0, id, notes: '' });
    selFlag = flags.length - 1; sel = -1; flagsDirty = unsaved = true;
    if (!layerOn.flags) { layerOn.flags = true; try { localStorage.setItem('aogLayers', JSON.stringify(layerOn)); } catch (e) { } }
    setMode(''); drawFlags(); drawMarkers(); updateInfo(); renderLayerList();
  } else if (mode === 'origin') {
    setMode(''); askOrigin(latlng.lat, latlng.lng);
  } else {
    sel = -1; selFlag = -1; ghostLayer.clearLayers(); drawMarkers(); drawFlags(); updateInfo();
  }
}
map.on('click', e => mapClick(e.latlng));

// ---------- Grenze bearbeiten ----------
function onLineClick(e) {
  L.DomEvent.stopPropagation(e);
  clearGhost();
  if (mode || tool) { mapClick(e.latlng); return; }
  const b = bnds[active], q = plane.fwd(e.latlng.lat, e.latlng.lng), n = b.pts.length;
  let best = 0, bd = Infinity, bp = null;
  for (let i = 0; i < n; i++) {
    const a = b.pts[i], c = b.pts[(i + 1) % n];
    const dx = c.e - a.e, dy = c.n - a.n, l2 = dx * dx + dy * dy;
    let t = l2 ? ((q.e - a.e) * dx + (q.n - a.n) * dy) / l2 : 0;
    t = Math.max(0, Math.min(1, t));
    const pe = a.e + t * dx, pn = a.n + t * dy, d = (q.e - pe) ** 2 + (q.n - pn) ** 2;
    if (d < bd) { bd = d; best = i; bp = { e: pe, n: pn }; }
  }
  pushUndo();
  b.pts.splice(best + 1, 0, bp);
  sel = best + 1; selFlag = -1;
  changed(b); drawActive(); drawMarkers(); drawFlags();
}

function deletePoint(i) {
  clearGhost();
  const b = bnds[active];
  if (!b || i < 0) return;
  if (b.pts.length <= 3) { setStatus(t('min3'), 'err'); return; }
  pushUndo();
  b.pts.splice(i, 1);
  sel = -1;
  changed(b); drawActive(); drawMarkers();
}

function pushUndo() {
  undo.push({ a: active, pts: bnds[active].pts.map(p => ({ ...p })), dirty: bnds[active].dirty });
  if (undo.length > 300) undo.shift();
}
function doUndo() {
  const u = undo.pop(); if (!u) return;
  bnds[u.a].pts = u.pts; bnds[u.a].dirty = u.dirty;
  active = u.a; sel = -1; unsaved = true;
  drawAll();
}

function segDist(p, a, b) {
  const dx = b.e - a.e, dy = b.n - a.n, l2 = dx * dx + dy * dy;
  let t = l2 ? ((p.e - a.e) * dx + (p.n - a.n) * dy) / l2 : 0;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(p.e - (a.e + t * dx), p.n - (a.n + t * dy));
}
function dp(pts, tol) {
  if (pts.length < 3) return pts.slice();
  const keep = new Uint8Array(pts.length); keep[0] = keep[pts.length - 1] = 1;
  const st = [[0, pts.length - 1]];
  while (st.length) {
    const [s, e] = st.pop(); let md = 0, mi = -1;
    for (let i = s + 1; i < e; i++) { const d = segDist(pts[i], pts[s], pts[e]); if (d > md) { md = d; mi = i; } }
    if (md > tol) { keep[mi] = 1; st.push([s, mi], [mi, e]); }
  }
  return pts.filter((_, i) => keep[i]);
}
function simplifyRing(pts, tol) {
  let f = 0, fd = 0;
  pts.forEach((p, i) => { const d = (p.e - pts[0].e) ** 2 + (p.n - pts[0].n) ** 2; if (d > fd) { fd = d; f = i; } });
  const a = dp(pts.slice(0, f + 1), tol), b = dp(pts.slice(f).concat([pts[0]]), tol);
  return a.concat(b.slice(1, -1));
}

function area(pts) {
  let s = 0;
  for (let i = 0; i < pts.length; i++) { const a = pts[i], b = pts[(i + 1) % pts.length]; s += a.e * b.n - b.e * a.n; }
  return Math.abs(s) / 2;
}
function centroid(pts) {
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i], q = pts[(i + 1) % pts.length], k = p.e * q.n - q.e * p.n;
    a += k; cx += (p.e + q.e) * k; cy += (p.n + q.n) * k;
  }
  return a ? { e: cx / (3 * a), n: cy / (3 * a) } : pts[0];
}

// ---------- Ursprung ----------
function setOrigin(la, lo) {
  const np = Plane(la, lo);
  bnds.forEach(b => { b.pts = b.pts.map(p => { const [a, c] = plane.inv(p.e, p.n); return np.fwd(a, c); }); b.dirty = true; });
  plane = np; undo = []; sel = -1; unsaved = true;
  drawAll();
}
function askOrigin(la, lo) {
  const d = distM(plane.lat0, plane.lon0, la, lo);
  startTool({
    title: 'hOrigin', params: [], msgHtml: true, okLabel: 'apply',
    msg: () => esc(t('confirmOrigin', d.toFixed(0))).replace(/\n/g, '<br>'),
    draw: g => {
      L.circle([la, lo], { radius: 500, color: '#ffd400', weight: 2, dashArray: '8 6', fill: false, interactive: false }).addTo(g);
      dot(L.latLng(la, lo), '#ffd400').addTo(g);
    },
    ok() { setOrigin(la, lo); setStatus(t('originMoved'), 'ok'); }
  });
}
function startOriginPick() {
  startTool({ title: 'btnOriginClick', params: [], msg: () => t('originPickMsg'), onClick: p => askOrigin(p.lat, p.lng) });
}
