// AOG Feldeditor – Neues Feld, Ebenen löschen, AB/Kurve wie in AgOpenGPS

// ---------- Stufe 1: neues Feld, AB/Kurve wie AgOpenGPS, Ebenen löschen, Schattenpunkt, Fahne an Koordinate ----------
const ghostLayer = L.layerGroup().addTo(map);
let newFieldName = null, clearedFiles = {};

// Schatten: zeigt beim Verschieben, wo der Punkt (und die Grenze) vorher war – bis zur nächsten Aktion.
// Karte verschieben oder zoomen zählt nicht, damit man sich die Änderung in Ruhe ansehen kann.
const clearGhost = () => ghostLayer.clearLayers();
map.on('click', clearGhost);
document.addEventListener('keydown', clearGhost, true);
document.addEventListener('click', e => { if (e.target.closest('header, #nav, #props, #toolbox')) clearGhost(); }, true);
function showGhost(p, ring) {
  ghostLayer.clearLayers(); moveLayer = null;
  if (ring) L.polyline(ring, { color: '#fff', weight: 1.5, opacity: .85, dashArray: '6 6', interactive: false }).addTo(ghostLayer);
  L.circleMarker(p, { radius: 7, color: '#fff', weight: 2, dashArray: '3 3', fill: false, interactive: false }).addTo(ghostLayer);
}
// Versatz beim Ziehen: direkte Strecke, dazu Ost/West (waagrecht) und Nord/Süd (senkrecht) – bleibt wie der Schatten stehen
let moveLayer = null;
function showMove(a, b) {
  if (moveLayer) ghostLayer.removeLayer(moveLayer);
  moveLayer = L.layerGroup().addTo(ghostLayer);
  const pl = plane || Plane(a.lat, a.lng), A = pl.fwd(a.lat, a.lng), B = pl.fwd(b.lat, b.lng), C = { e: B.e, n: A.n };
  const de = B.e - A.e, dn = B.n - A.n, d = Math.hypot(de, dn), LL = p => L.latLng(...pl.inv(p.e, p.n)), mid = (p, q) => LL({ e: (p.e + q.e) / 2, n: (p.n + q.n) / 2 });
  if (d < 0.005) return;
  const st = { color: '#ffd400', weight: 2, interactive: false };
  L.polyline([LL(A), LL(B)], st).addTo(moveLayer);
  L.polyline([LL(A), LL(C), LL(B)], { ...st, weight: 1.5, dashArray: '4 4' }).addTo(moveLayer);
  const lab = (p, txt, cls) => L.marker(p, { interactive: false, icon: L.divIcon({ className: '', html: `<span class="mvlabel${cls || ''}">${txt}</span>`, iconSize: [0, 0] }) }).addTo(moveLayer);
  const ew = Math.abs(de) >= 0.005 ? t(de > 0 ? 'dirE' : 'dirW') + ' ' + fmtNum(Math.abs(de), 2) + ' m' : '';
  const ns = Math.abs(dn) >= 0.005 ? t(dn > 0 ? 'dirN' : 'dirS') + ' ' + fmtNum(Math.abs(dn), 2) + ' m' : '';
  const px = map.latLngToContainerPoint(LL(A)).distanceTo(map.latLngToContainerPoint(LL(B)));
  if (px >= 120) {                                              // groß genug: an den Seiten beschriften
    lab(mid(A, B), '<b>' + fmtNum(d, 2) + ' m</b>');
    if (ew) lab(mid(A, C), ew);
    if (ns) lab(mid(C, B), ns);
  } else lab(LL(B), '<b>' + fmtNum(d, 2) + ' m</b><br>' + [ew, ns].filter(Boolean).join(' · '), ' box');   // klein: ein Kästchen neben dem Punkt
}

// --- Neues Feld (wie „Neues Feld“ in AgOpenGPS: Ordner mit Field.txt und leeren Dateien) ---
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function aogStamp(d = new Date()) {          // wie AOG: "yyyy-MMMM-dd hh:mm:ss tt"
  const p = x => String(x).padStart(2, '0'), h = d.getHours() % 12 || 12;
  return `${d.getFullYear()}-${MONTHS[d.getMonth()]}-${p(d.getDate())} ${p(h)}:${p(d.getMinutes())}:${p(d.getSeconds())} ${d.getHours() < 12 ? 'AM' : 'PM'}`;
}
const aogHeader = dirLine => [aogStamp(), '$FieldDir', dirLine, '$Offsets', '0,0', 'Convergence', '0', 'StartFix', plane.lat0 + ',' + plane.lon0].join('\r\n') + '\r\n';
function newFieldTemplates() {
  return {
    'Field.txt': aogHeader('FieldNew'), 'Boundary.txt': serializeBoundary(), 'Flags.txt': serializeFlags(),
    'Sections.txt': '', 'Contour.txt': '$Contour\r\n', 'RecPath.txt': '$RecPath\r\n0\r\n',
    'Elevation.txt': aogHeader('Elevation') + 'Latitude,Longitude,Elevation,Quality,Easting,Northing,Heading,Roll\r\n'
  };
}
function newField() {
  if (window.showDirectoryPicker && !rootHandle) { setStatus(t('needRoot'), 'err'); return; }
  if (unsaved) { askDiscard('btnNewField', 'discardNew', '', askFieldName); return; }
  askFieldName();
}
// Name des neuen Feldes in der Seitenleiste eingeben (Enter = Übernehmen)
function askFieldName() {
  startTool({
    title: 'btnNewField', params: [], okLabel: 'apply', msg: () => t('newFieldName'),
    okEnabled: () => !!(tool.nameVal || '').replace(/[\\/:*?"<>|]/g, '').trim(),
    ok() { createField(this.nameVal); }
  });
  const inp = document.createElement('input');
  inp.placeholder = t('newFieldName');
  inp.oninput = () => { tool.nameVal = inp.value; updateToolbox(); };
  inp.onkeydown = e => { if (e.key === 'Enter') finishTool(); };
  $('toolList').append(inp);
  inp.focus();
}
function createField(name, then) {
  name = String(name || '').replace(/[\\/:*?"<>|]/g, '').trim();          // unzulässige Zeichen wie in AOG entfernen
  if (!name) return;
  if (fieldNames.some(n => n.toLowerCase() === name.toLowerCase())) { setStatus(t('fieldExists', name), 'err'); return; }
  const c = map.getCenter();                                 // vorläufiger Ursprung, beim Speichern in die Feldmitte
  load({ 'Field.txt': [aogStamp(), '$FieldDir', 'FieldNew', '$Offsets', '0,0', 'Convergence', '0', 'StartFix', c.lat + ',' + c.lng].join('\r\n') }, true);
  dirHandle = null; currentField = ''; newFieldName = name; unsaved = true;
  renderFieldList();
  setStatus(t('newFieldStarted', name), 'ok');
  showTab('grenze');
  if (then) then(); else startDrawBoundary(false);
}

// --- Ebenen komplett löschen (z. B. „Bearbeitete Fläche löschen“ wie in AOG) ---
const CLEAR_FILES = {
  sections: ['Sections.txt', ''], contour: ['Contour.txt', '$Contour\r\n'], recpath: ['RecPath.txt', '$RecPath\r\n0\r\n'],
  tram: ['Tram.txt', '$Tram\r\n0\r\n0\r\n'], headland: ['Headland.txt', '$Headland\r\n'], headlines: ['Headlines.txt', '$HeadLines\r\n'],
  backpic: ['BackPic.txt', '$BackPic\r\nFalse\r\n']
};
function clearLayer(id, label) {
  askPanel('delTitle', t('confirmClear', label), () => doClearLayer(id, label), 'delTitle');
}
function doClearLayer(id, label) {
  if (id === 'flags') { flags = []; selFlag = -1; flagsDirty = true; drawFlags(); updateInfo(); }
  else {
    const [f, empty] = CLEAR_FILES[id];
    clearedFiles[f] = empty;
    delete generated[f];
    ex[id] = ['sections', 'tram', 'backpic'].includes(id) ? null : [];
    if (id === 'headlines') listDirty.headlines = false;
    drawLayer(id);
    if (id === 'tram') drawLayer('tramw');
  }
  unsaved = true;
  renderLayerList(); renderNames();
  setStatus(t('cleared', label), 'ok');
}

// --- AB-Linie / Kurve wie „AB zeichnen“ in AgOpenGPS (FormABDraw) ---
// Zwei Punkte, die auf der Grenze einrasten; daraus eine AB-Linie oder eine Kurve entlang der Grenze.
// Ohne Grenze zählen die Klickpunkte direkt (dann nur AB-Linie).
const toDisk = p => { const [la, lo] = plane.inv(p.e, p.n); return diskPlane.fwd(la, lo); };
function headingsOf(P) {             // wie CABCurve.CalculateHeadings
  const n = P.length;
  return P.map((p, i) => { const a = P[i === 0 ? 0 : i - 1], c = P[i === n - 1 ? n - 1 : i + 1]; return normH(Math.atan2(c.e - a.e, c.n - a.n)); });
}
// Grenzpunkte zwischen den beiden gewählten Punkten auf dem kürzeren Weg – beide Endpunkte gehören dazu
// (bei einer ausgedünnten Grenze mit Punkten nur an den Ecken fehlte sonst die ganze letzte Strecke)
function alongBoundary(tl) {
  const fence = bnds[tl.bi].pts, n = fence.length, out = [];
  let [s, e] = tl.idx;
  if (Math.abs(s - e) > n * 0.5) {
    if (s < e) [s, e] = [e, s];
    for (let i = s; i < n; i++) out.push(fence[i]);
    for (let i = 0; i <= e; i++) out.push(fence[i]);
  } else {
    if (s > e) [s, e] = [e, s];
    for (let i = s; i <= e; i++) out.push(fence[i]);
  }
  return out;
}
function makeABFromTool(tl) {
  let A = tl.pts[0], B = tl.pts[1];
  if (tl.idx.length === 2) {          // Richtung genau wie AOG wählen
    const n = bnds[tl.bi].pts.length;
    let [s, e] = tl.idx;
    if (Math.abs(s - e) <= n * 0.5) { if (s < e) [s, e] = [e, s]; } else if (s > e) [s, e] = [e, s];
    A = bnds[tl.bi].pts[s]; B = bnds[tl.bi].pts[e];
  }
  const a = toDisk(A), b = toDisk(B);
  if (Math.hypot(b.e - a.e, b.n - a.n) < 2) { setStatus(t('abTooShort'), 'err'); return; }
  const heading = normH(Math.atan2(b.e - a.e, b.n - a.n));
  addTrack({ name: 'AB ' + degName(heading), mode: 2, heading, a: [a.e, a.n], b: [b.e, b.n], pts: [] });
}
function makeCurveFromTool(tl) {
  const P = alongBoundary(tl);
  if (P.length < 2 || pathLen(P) < 2) { setStatus(t('abTooShort'), 'err'); return; }   // Länge zählt, nicht die Punktzahl (ausgedünnte Grenze)
  addTrack(curveTrack(P));
}
function curveTrack(P, name) {
  const Q = [P[0]];                   // wie MakePointMinimumSpacing(1.6): kein Abstand über 1,6 m
  for (let i = 1; i < P.length; i++) {
    const a = Q[Q.length - 1], b = P[i], k = Math.ceil(dist(a, b) / 1.6);
    for (let j = 1; j <= k; j++) Q.push({ e: a.e + (b.e - a.e) * j / k, n: a.n + (b.n - a.n) * j / k });
  }
  const H = headingsOf(Q);
  let x = 0, y = 0;
  H.forEach(h => { x += Math.cos(h); y += Math.sin(h); });
  const heading = normH(Math.atan2(y, x)), n = Q.length, pts = [];
  // wie AddFirstLastPoints: 99 m gerade über beide Enden hinaus
  for (let i = 99; i >= 1; i--) pts.push({ e: Q[0].e - Math.sin(H[0]) * i, n: Q[0].n - Math.cos(H[0]) * i });
  pts.push(...Q);
  for (let i = 1; i < 100; i++) pts.push({ e: Q[n - 1].e + Math.sin(H[n - 1]) * i, n: Q[n - 1].n + Math.cos(H[n - 1]) * i });
  return { name: name || 'Cu ' + degName(heading), mode: 4, heading, pts: pts.map(p => plane.inv(p.e, p.n)) };
}
function startDrawAB() {
  if (!tracksEditable()) return;
  const snap = bnds.some(b => b.pts.length > 2);
  startTool({
    title: 'btnNewAB', params: [], pts: [], bi: -1, idx: [], showPts: true,
    msg: () => tool.pts.length < 2 ? t(tool.pts.length ? 'abDrawMsgB' : 'abDrawMsgA') : t(snap ? 'abDrawChoose' : 'abDrawChooseFree'),
    onClick: p => {
      if (tool.pts.length >= 2) return;
      if (snap) {
        const q = plane.fwd(p.lat, p.lng);
        let best = null;
        bnds.forEach((b, bi) => {
          if (tool.pts.length && bi !== tool.bi) return;     // zweiter Punkt auf derselben Grenze
          b.pts.forEach((v, i) => { const d = (v.e - q.e) ** 2 + (v.n - q.n) ** 2; if (!best || d < best.d) best = { d, bi, i }; });
        });
        if (!best || (tool.idx.length && best.i === tool.idx[0])) return;
        tool.bi = best.bi; tool.idx.push(best.i); tool.pts.push(bnds[best.bi].pts[best.i]);
      } else tool.pts.push(plane.fwd(p.lat, p.lng));
      if (tool.pts.length === 2) map.getContainer().classList.remove('pick');
      redrawTool();
    },
    draw: g => {
      // Grenzpunkte, auf denen ein Klick einrastet (nach dem ersten Klick nur noch die derselben Grenze)
      if (snap && tool.pts.length < 2) {
        const vb = map.getBounds().pad(0.2), vis = [];
        bnds.forEach((b, bi) => { if (!tool.pts.length || bi === tool.bi) b.pts.forEach(v => { const q = ll(v); if (vb.contains(q)) vis.push(q); }); });
        if (vis.length <= 3000) vis.forEach(q => L.circleMarker(q, { renderer: cv, radius: 3, color: '#fff', weight: 1, fillColor: '#ff4fd8', fillOpacity: 1, interactive: false }).addTo(g));
      }
      tool.pts.forEach(p => L.circleMarker(ll(p), { radius: 8, color: '#fff', weight: 3, fillColor: '#ff4fd8', fillOpacity: 1, interactive: false }).addTo(g));
      if (tool.pts.length < 2) return;
      L.polyline(tool.pts.map(ll), { color: '#ff4fd8', weight: 2, dashArray: '6 5', interactive: false }).addTo(g);
      if (snap) L.polyline(alongBoundary(tool).map(ll), { color: '#ffd400', weight: 4, opacity: .8, interactive: false }).addTo(g);
    },
    actions: () => tool.pts.length < 2 ? [] :
      [{ label: 'mkAB', run() { makeABFromTool(this); } }].concat(snap ? [{ label: 'mkCurve', run() { makeCurveFromTool(this); } }] : [])
  });
}
// „Grenze mitziehen“: Grenzpunkte, die genau auf dem alten Kurvenstück liegen (≤ 30 cm), werden durch das
// geglättete Stück ersetzt (Toleranz 50 cm). Das trifft bei „Kurve entlang Grenze“ und „Grenze als Spur“ zu; der Rest bleibt.
let moveBndPref = false;
function planBoundaryBend(Sorig, Snew) {
  const tol = 0.5, near = v => { for (let i = 0; i + 1 < Sorig.length; i++) if (segDist(v, Sorig[i], Sorig[i + 1]) < tol) return true; return false; };
  let best = null;
  bnds.forEach((b, bi) => {
    const F = b.pts, n = F.length;
    if (n < 3) return;                                   // auch ausgeblendete Grenzen
    const on = F.map(near);
    if (on.every(Boolean)) { if (!best || n > best.len) best = { bi, i0: 0, len: n }; return; }
    // längster zusammenhängender Lauf auf dem Ring
    const start = on.findIndex(x => !x);
    let run = 0, i0 = -1;
    for (let k = 1; k <= n; k++) {
      const i = (start + k) % n;
      if (on[i]) { if (!run) i0 = i; run++; if (!best || run > best.len) best = { bi, i0, len: run }; } else run = 0;
    }
  });
  if (!best || best.len < 2) return null;
  // nur anbieten, wenn die Kurve ein nennenswertes Stück auf der Grenze liegt (nicht bloß zufällig berührt)
  const F = bnds[best.bi].pts;
  let runLen = 0, curveLen = 0;
  for (let q = 0; q + 1 < best.len; q++) runLen += dist(F[(best.i0 + q) % F.length], F[(best.i0 + q + 1) % F.length]);
  for (let q = 1; q < Sorig.length; q++) curveLen += dist(Sorig[q - 1], Sorig[q]);
  return runLen >= Math.min(5, 0.5 * curveLen) ? best : null;
}
function applyBoundaryBend(plan, Snew) {
  const F = bnds[plan.bi].pts, n = F.length;
  let pts;
  if (plan.len === n) pts = Snew.map(p => ({ e: p.e, n: p.n }));                 // ganze Grenze (Grenz-Spur ganz geglättet)
  else {
    const P0 = F[plan.i0], P1 = F[(plan.i0 + plan.len - 1) % n];
    const near = q => { let bi = 0, bd = Infinity; Snew.forEach((v, i) => { const d = (v.e - q.e) ** 2 + (v.n - q.n) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
    const j0 = near(P0), j1 = near(P1);
    const seg = j0 <= j1 ? Snew.slice(j0, j1 + 1) : Snew.slice(j1, j0 + 1).reverse();
    const rest = [];
    for (let k = 1; k <= n - plan.len; k++) rest.push(F[(plan.i0 + plan.len - 1 + k) % n]);
    pts = seg.map(p => ({ e: p.e, n: p.n })).concat(rest);
  }
  active = plan.bi;
  pushUndo();                                                    // Strg+Z holt die alte Grenze zurück
  bnds[plan.bi].pts = pts;
  bnds[plan.bi].dirty = true; bndListDirty = true; unsaved = true; sel = -1;
  drawAll();
  return plan.bi === 0 ? t('outer') : t('inner', plan.bi);
}

// „Grenze als Spur“ (wie „Boundary Curve“ in AOG): die gewählte Grenze wird zu einer Spur entlang der Grenze
function boundaryTrack(q) {
  const F = prepareFence(bnds[q].pts, q);       // dicht und richtig herum, wie AOG die Grenze speichert
  if (F.length < 4) { setStatus(t('abTooShort'), 'err'); return; }
  addTrack({ name: q ? 'Inner Boundary Curve ' + q : 'Boundary Curve', mode: 32, heading: 0, pts: F.map(p => plane.inv(p.e, p.n)) });
}
// Spuren an allen Feldseiten: Ecken der Außengrenze erkennen, je Seite eine Kurve (wie „Kurve entlang Grenze“) oder AB-Linie.
// Seiten auf der Karte an-/abwählen (Hand-Cursor), dann übernehmen.
function startAutoSides() {
  if (!tracksEditable() || !bnds[0]) return;
  const F = aogFence(0), n = F.length, sides = detectSides(F).map(sd => {
    const P = []; for (let i = sd.a; ; i = (i + 1) % n) { P.push(F[i]); if (i === sd.b || P.length > n) break; }
    return { ...sd, P, on: pathLen(P) >= 10 };
  });
  if (!sides.length) { setStatus(t('autoSidesNone'), 'err'); return; }
  startTool({
    title: 'btnAutoSides', params: ['autoKind'], okLabel: 'apply', msgHtml: true,
    msg: () => t('autoSidesMsg', sides.filter(x => x.on).length, sides.length),
    recalc() { redrawTool(); },
    draw: g => sides.forEach((sd, k) => {
      const pl = L.polyline(sd.P.map(ll), { color: sd.on ? '#ffd400' : '#9aa0a6', weight: sd.on ? 5 : 3, dashArray: sd.on ? null : '6 6', bubblingMouseEvents: false }).addTo(g);
      pl.on('mouseover', () => pl.setStyle({ weight: 8 })).on('mouseout', () => pl.setStyle({ weight: sd.on ? 5 : 3 }));
      pl.on('click', () => { sd.on = !sd.on; redrawTool(); });
      numBadge(g, ll(sd.P[sd.P.length >> 1]), k + 1);
      if (cfg.autoKind === 1 && sd.on) L.polyline([ll(sd.P[0]), ll(sd.P[sd.P.length - 1])], { color: '#ff4fd8', weight: 2, dashArray: '4 4', interactive: false }).addTo(g);
    }),
    okEnabled: () => sides.some(x => x.on),
    ok() {
      let made = 0;
      sides.filter(x => x.on).forEach(sd => {
        if (cfg.autoKind === 1) {
          const a = toDisk(sd.P[0]), b = toDisk(sd.P[sd.P.length - 1]);
          if (Math.hypot(b.e - a.e, b.n - a.n) < 2) return;
          const heading = normH(Math.atan2(b.e - a.e, b.n - a.n));
          addTrack({ name: 'AB ' + degName(heading), mode: 2, heading, a: [a.e, a.n], b: [b.e, b.n], pts: [] });
        } else addTrack(curveTrack(sd.P));
        made++;
      });
      setStatus(t('autoSidesDone', made), 'ok');
    }
  });
}
$('btnAutoSides').onclick = startAutoSides;
// Nur eine Grenze: sofort anlegen. Mehrere: die gewünschte Grenze auf der Karte anklicken.
function makeBoundaryTracks() {
  if (!tracksEditable() || !bnds.length) return;
  if (bnds.length === 1) { boundaryTrack(0); return; }
  const usable = (b, i) => !b.hidden && b.pts.length > 2;
  startTool({
    title: 'btnBndCurve', params: [], showPts: true,
    msg: () => t('pickBndMsg'),
    onClick: p => {
      const q = plane.fwd(p.lat, p.lng);
      let best = null;
      bnds.forEach((b, bi) => { if (usable(b, bi)) b.pts.forEach(v => { const d = (v.e - q.e) ** 2 + (v.n - q.n) ** 2; if (!best || d < best.d) best = { d, bi }; }); });
      if (!best) return;
      closeTool();
      boundaryTrack(best.bi);
    },
    draw: g => {
      const vb = map.getBounds().pad(0.2), vis = [];
      bnds.forEach((b, bi) => { if (usable(b, bi)) b.pts.forEach(v => { const q = ll(v); if (vb.contains(q)) vis.push(q); }); });
      if (vis.length <= 3000) vis.forEach(q => L.circleMarker(q, { renderer: cv, radius: 3, color: '#fff', weight: 1, fillColor: '#ff4fd8', fillOpacity: 1, interactive: false }).addTo(g));
    }
  });
}
