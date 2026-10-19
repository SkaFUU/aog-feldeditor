// AOG Feldeditor – Werkzeug-Rahmen, Grenze zeichnen, Grenze aus Fahrspur

// ---------- Werkzeuge: Grenze zeichnen, AB-Linie, Kurve, Glätten ----------
// Ein Werkzeug ist ein Objekt mit msg/draw/onClick/onDbl/onUndo/onRange/ok – unten auf der Karte erscheint dazu eine Leiste.
const toolLayer = L.layerGroup().addTo(map);
let tool = null, bndListDirty = false;

// Rückfrage in der Seitenleiste statt Browser-Fenster: Text, Bestätigen, Abbrechen
const esc = x => String(x).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
function askPanel(title, text, onYes, yesLabel) {
  startTool({ title, params: [], msgHtml: true, msg: () => esc(text).replace(/\n/g, '<br>'), okLabel: yesLabel || 'confirmYes', ok() { onYes(); } });
}
// Das offene Feld hat ungespeicherte Änderungen: sagen, welches Feld, und speichern oder verwerfen lassen, bevor es weitergeht
function askDiscard(title, textKey, target, go) {
  const cur = newFieldName || currentField || t('noField');
  startTool({
    title, params: [], msgHtml: true, okLabel: 'discardAndGo',
    msg: () => esc(t(textKey, cur, target || '')),
    actions: () => [{ label: 'saveAndGo', run: async () => { if (await saveField()) go(); } }],
    ok() { go(); }
  });
}
function startTool(def) {
  closeTool();
  if (mode) setMode(mode);                       // laufenden Modus (Fahne/Ursprung) beenden
  tool = def;
  refreshTrackHits();                             // während eines Werkzeugs sind die Spuren nicht anklickbar
  if (def.hideLayer) map.removeLayer(exLayers[def.hideLayer]);   // während der Vorschau das Alte ausblenden
  drawMarkers();
  map.getContainer().classList.toggle('pick', !!def.onClick);
  const box = $('toolbox'), slot = document.querySelector(`.pp[data-tab="${ui.tab}"] .toolSlot`);
  if (slot) {                                     // Werkzeug mit Einstellungen: oben in der Seitenleiste
    slot.append(box); box.classList.add('inpanel');
    $('props').classList.remove('hide');
    $('toolTitle').textContent = t(def.title || '');
    renderParams(typeof def.params === 'function' ? def.params() : def.params || []);
    map.invalidateSize();
  }
  box.style.display = 'flex';
  const r = $('toolRange');
  r.style.display = def.range ? '' : 'none';
  if (def.range) Object.assign(r, def.range);
  redrawTool();
}
function closeTool() {
  if (!tool) return;
  const hid = tool.hideLayer, box = $('toolbox');
  tool = null;
  refreshTrackHits();
  if (hid) showLayer(hid);
  drawMarkers();
  toolLayer.clearLayers();
  box.style.display = 'none';
  if (box.classList.contains('inpanel')) {        // zurück auf die Karte
    box.classList.remove('inpanel'); $('toolParams').innerHTML = ''; $('toolList').innerHTML = '';
    $('mapwrap').append(box); applyUi();
  }
  $('btnMeasDist').classList.remove('on'); $('btnMeasArea').classList.remove('on');
  map.getContainer().classList.toggle('pick', !!mode);
  if (hiTrack >= 0) { hiTrack = -1; drawLayer('tracks'); markTrackRows(); }
  markRef();                                      // im Register Fahrgassen bleibt die Referenzlinie markiert
}
function updateToolbox() {
  if (!tool) return;
  $('toolMsg')[tool.msgHtml ? 'innerHTML' : 'textContent'] = tool.msg();
  $('toolCancel').textContent = t(tool.cancelLabel || 'cancel');
  const ok = $('toolOk');
  ok.style.display = tool.ok && !tool.hideOk ? '' : 'none';
  ok.textContent = t(tool.okLabel || 'apply');
  ok.disabled = !!tool.okEnabled && !tool.okEnabled();
  $('toolBndWrap').style.display = tool.bndOption ? 'flex' : 'none';
  if (tool.bndOption) {
    $('toolBnd').disabled = !tool.bndPlan;
    $('toolBnd').checked = moveBndPref && !!tool.bndPlan;
    $('toolBndTxt').textContent = t(tool.bndPlan ? 'moveBndToo' : 'moveBndNo');
  }
  const box = $('toolActions');
  box.innerHTML = '';
  (tool.actions ? tool.actions() : []).forEach(a => {
    const b = document.createElement('button');
    b.className = a.keep ? (a.on ? 'on' : '') : 'primary'; b.textContent = t(a.label);
    b.onclick = a.keep ? () => a.run.call(tool) : () => { const tl = tool; closeTool(); a.run.call(tl); };   // keep: Auswahl im Werkzeug
    box.append(b);
  });
}
function redrawTool() {
  if (!tool) return;
  if (tool.draw) {
    tool.layer = tool.layer || L.layerGroup().addTo(toolLayer);
    tool.layer.clearLayers();
    tool.draw(tool.layer);
  }
  updateToolbox();
}
function finishTool() {
  if (!tool || (tool.okEnabled && !tool.okEnabled())) return;
  const tl = tool;
  closeTool();
  tl.ok();
}
$('toolOk').onclick = finishTool;
$('toolBnd').onchange = e => { moveBndPref = e.target.checked; };
$('toolCancel').onclick = closeTool;
$('toolRange').oninput = e => { if (tool && tool.onRange) tool.onRange(+e.target.value); };
map.on('dblclick', () => { if (tool && tool.onDbl) tool.onDbl(); });
map.on('moveend', () => { if (tool && tool.showPts) redrawTool(); });   // sichtbare Punkte nachzeichnen

const dot = (p, color) => L.circleMarker(p, { radius: 5, color: '#000', weight: 1, fillColor: color, fillOpacity: 1, interactive: false });
// Ein Doppelklick erzeugt vorher zwei Einzelklicks an derselben Stelle – die werden zusammengefasst
function dedupeClicks(pts) {
  const out = [];
  pts.forEach(p => {
    const q = out[out.length - 1];
    if (!q || map.latLngToContainerPoint(p).distanceTo(map.latLngToContainerPoint(q)) > 4) out.push(p);
  });
  return out;
}

// --- Grenze neu zeichnen ---
function startDrawBoundary(inner) {
  if (inner && !bnds[0]) { setStatus(t('needOuter'), 'err'); return; }
  startTool({
    title: inner ? 'btnNewInner' : 'btnNewOuter', pts: [],
    msg: () => t('drawBndMsg', dedupeClicks(tool.pts).length),
    onClick: p => { tool.pts.push(p); redrawTool(); },
    onDbl: () => { tool.pts = dedupeClicks(tool.pts); finishTool(); },
    onUndo: () => { tool.pts.pop(); redrawTool(); },
    draw: g => {
      const pts = tool.pts;
      if (pts.length > 1) L.polyline(pts.length > 2 ? pts.concat([pts[0]]) : pts, { color: '#ffd400', weight: 2, dashArray: '6 5', interactive: false }).addTo(g);
      pts.forEach(p => dot(p, '#ffd400').addTo(g));
    },
    okLabel: 'done',
    okEnabled: () => dedupeClicks(tool.pts).length >= 3,
    ok() {
      const nb = { flagLines: ['False'], pts: dedupeClicks(this.pts).map(p => plane.fwd(p.lat, p.lng)), orig: [], dirty: true };
      const done = () => { bndListDirty = true; unsaved = true; undo = []; sel = -1; renderBndList(); drawAll(); setStatus(t('bndCreated'), 'ok'); };
      if (inner) { bnds.push(nb); active = bnds.length - 1; done(); }
      else if (bnds[0]) askPanel('btnNewOuter', t('confirmReplaceOuter'), () => { bnds[0] = nb; active = 0; done(); });
      else { bnds.unshift(nb); active = 0; done(); }
    }
  });
}

// --- Grenze aus der bearbeiteten Fläche ---
// Alle Fahrten auf ein Raster zeichnen, Löcher füllen, größte Fläche nehmen, Rand nachfahren und glätten.
// Danach nur dort Punkte setzen, wo sich die Richtung um mehr als den eingestellten Winkel ändert.
function coverageOutline() {
  const rings = ex.sections.patches.map(p => p.ring.map(q => plane.fwd(q[0], q[1])));
  let e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity;
  rings.forEach(r => r.forEach(p => { e0 = Math.min(e0, p.e); e1 = Math.max(e1, p.e); n0 = Math.min(n0, p.n); n1 = Math.max(n1, p.n); }));
  e0 -= 3; n0 -= 3; e1 += 3; n1 += 3;
  const c = Math.max(0.2, Math.sqrt((e1 - e0) * (n1 - n0) / 4e6));      // Rastergröße: höchstens ~4 Mio. Zellen
  const W = Math.ceil((e1 - e0) / c), H = Math.ceil((n1 - n0) / c);
  const cvs = document.createElement('canvas'); cvs.width = W; cvs.height = H;
  const ctx = cvs.getContext('2d');
  ctx.fillStyle = '#000';
  rings.forEach(r => { ctx.beginPath(); r.forEach((p, i) => ctx[i ? 'lineTo' : 'moveTo']((p.e - e0) / c, (n1 - p.n) / c)); ctx.closePath(); ctx.fill(); });
  const px = ctx.getImageData(0, 0, W, H).data, N = W * H, m = new Uint8Array(N);   // 1 = bearbeitet
  for (let i = 0; i < N; i++) m[i] = px[i * 4 + 3] > 127 ? 1 : 0;
  // von außen fluten: was nicht erreicht wird, liegt innen (Löcher werden gefüllt)
  const fill = (start, ok, mark) => {
    const st = [start], seen = []; mark(start); seen.push(start);
    while (st.length) {
      const i = st.pop(), x = i % W, y = (i / W) | 0;
      for (const j of [x > 0 ? i - 1 : -1, x < W - 1 ? i + 1 : -1, y > 0 ? i - W : -1, y < H - 1 ? i + W : -1]) if (j >= 0 && ok(j)) { mark(j); st.push(j); seen.push(j); }
    }
    return seen;
  };
  const out = new Uint8Array(N);
  for (let x = 0; x < W; x++) for (const y of [0, H - 1]) { const i = y * W + x; if (!m[i] && !out[i]) fill(i, j => !m[j] && !out[j], j => out[j] = 1); }
  for (let y = 0; y < H; y++) for (const x of [0, W - 1]) { const i = y * W + x; if (!m[i] && !out[i]) fill(i, j => !m[j] && !out[j], j => out[j] = 1); }
  // größte zusammenhängende Fläche
  const lab = new Int32Array(N); let best = null, nl = 0;
  for (let i = 0; i < N; i++) if (!out[i] && !lab[i]) { nl++; const cells = fill(i, j => !out[j] && !lab[j], j => lab[j] = nl); if (!best || cells.length > best.n) best = { id: nl, n: cells.length }; }
  if (!best) return null;
  const inC = (x, y) => x >= 0 && y >= 0 && x < W && y < H && lab[y * W + x] === best.id;
  // Randkanten (Fläche rechts, im Uhrzeigersinn auf dem Bildschirm) und zu Schleifen verbinden
  const next = new Map(), key = (x, y) => y * (W + 1) + x, add = (a, b) => { const k = key(a[0], a[1]); (next.get(k) || next.set(k, []).get(k)).push(b); };
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inC(x, y)) {
    if (!inC(x, y - 1)) add([x, y], [x + 1, y]);
    if (!inC(x + 1, y)) add([x + 1, y], [x + 1, y + 1]);
    if (!inC(x, y + 1)) add([x + 1, y + 1], [x, y + 1]);
    if (!inC(x - 1, y)) add([x, y + 1], [x, y]);
  }
  let loop = null;
  for (const [k0] of next) {
    if (!next.get(k0).length) continue;
    const L0 = []; let k = k0;
    while (next.has(k) && next.get(k).length) { const v = next.get(k).pop(); L0.push(v); k = key(v[0], v[1]); }
    if (!loop || L0.length > loop.length) loop = L0;
  }
  if (!loop || loop.length < 8) return null;
  // Treppen entfernen: gleitender Mittelwert über ~1,5 m, dann gleichmäßig alle 0,5 m
  let P = loop.map(([x, y]) => ({ e: e0 + x * c, n: n1 - y * c }));
  const k = Math.max(1, Math.round(0.75 / c)), n = P.length;
  P = P.map((_, i) => { let e = 0, nn = 0; for (let j = -k; j <= k; j++) { const q = P[(i + j + n) % n]; e += q.e; nn += q.n; } return { e: e / (2 * k + 1), n: nn / (2 * k + 1) }; });
  const R = [P[0]]; let acc = 0;
  for (let i = 1; i <= P.length; i++) { const a = P[i - 1], b = P[i % P.length], d = dist(a, b); acc += d; if (acc >= 0.5) { R.push(b); acc = 0; } }
  if (dist(R[0], R[R.length - 1]) < 0.25) R.pop();
  return R;
}
// R: Randpunkte alle 0,5 m; thr: Winkel (°), ab dem ein Punkt gesetzt wird; sm: Glättung (m), grob = mehr
function thinByAngle(R0, thr, sm) {
  const n = R0.length, at = i => R[((i % n) + n) % n], k = Math.max(1, Math.round(sm));
  const R = R0.map((_, i) => { let e = 0, nn = 0; for (let j = -k; j <= k; j++) { const q = R0[(i + j + n) % n]; e += q.e; nn += q.n; } return { e: e / (2 * k + 1), n: nn / (2 * k + 1) }; });
  const turn = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const dir = (a, b) => Math.atan2(b.e - a.e, b.n - a.n), K = 4;          // Richtungen über ±2 m
  const H = i => dir(at(i - K), at(i + K)), cr = R.map((_, i) => Math.abs(turn(dir(at(i - K), at(i)), dir(at(i), at(i + K)))));
  // echte Ecken (über 20° bzw. über dem Winkel) genau am stärksten Punkt
  const th = thr * D, cTh = Math.max(th, 20 * D), peak = cr.map((v, i) => { if (v <= cTh) return false; for (let q = -K; q <= K; q++) if (q && cr[(i + q + n) % n] > v) return false; return true; });
  let s0 = 0; cr.forEach((v, i) => { if (v > cr[s0]) s0 = i; });
  const idx = [s0];
  let h0 = dir(R[s0], at(s0 + K));
  for (let j = 1; j < n; j++) {
    const i = (s0 + j) % n;
    if (peak[i]) { idx.push(i); h0 = dir(R[i], at(i + K)); continue; }
    let soon = false; for (let q = 1; q <= K; q++) if (peak[(i + q) % n]) soon = true;   // kurz vor einer Ecke nichts extra
    if (!soon && Math.abs(turn(h0, H(i))) >= th) { idx.push(i); h0 = H(i); }      // sanfte Kurve: Punkt alle „thr“ Grad
  }
  // ab der schärfsten Ecke durchnummeriert, damit keine Gerade über den Anfang läuft
  return { R: R.slice(s0).concat(R.slice(0, s0)), idx: idx.map(i => (i - s0 + n) % n), peak: peak.slice(s0).concat(peak.slice(0, s0)) };
}
// Gerade Kanten: Stücke ab minLen, die höchstens tol von einer Geraden abweichen, werden gerade.
// Das zackige Stück zwischen zwei Kanten (Wendebereich am Ende) wird durch den Schnittpunkt ersetzt;
// liegen die Kanten fast parallel, kommt eine Gerade durch das Endstück dazu und es gibt zwei Ecken.
function straightEdges({ R, idx, peak }, tol, minLen) {
  const n = R.length, plain = () => idx.map(i => R[i]);
  if (!(minLen > 0) || n < 10) return plain();
  const s = [0]; for (let i = 1; i < n; i++) s.push(s[i - 1] + dist(R[i - 1], R[i]));
  const perim = s[n - 1] + dist(R[n - 1], R[0]);
  const runs = [];
  for (let i = 0; i < n - 1;) {
    let ok = i;
    for (let j = i + 1; j < n; j++) {
      const a = R[i], b = R[j], L = dist(a, b);
      let good = true;
      if (L > 0.01) for (let k = i + 1; k < j; k++) if (Math.abs((R[k].e - a.e) * (b.n - a.n) - (R[k].n - a.n) * (b.e - a.e)) / L > tol) { good = false; break; }
      if (!good) break;
      ok = j;
    }
    if (s[ok] - s[i] >= minLen) { runs.push({ i0: i, i1: ok }); i = ok + 1; } else i++;
  }
  if (runs.length < 2) return plain();
  // Gerade durch Punkte (Hauptachse), Schnittpunkt zweier Geraden
  const range = (i0, i1) => { const P = []; for (let i = i0; i <= i1; i++) P.push(R[(i + n) % n]); return P; };
  const fit = (i0, i1) => fitPts(range(i0, i1));
  const off = (Ln, p) => Math.abs((p.e - Ln.c.e) * Ln.d.n - (p.n - Ln.c.n) * Ln.d.e);   // Abstand Punkt–Gerade
  const fitPts = P => {
    const c = P.reduce((m, p) => ({ e: m.e + p.e / P.length, n: m.n + p.n / P.length }), { e: 0, n: 0 });
    let xx = 0, xy = 0, yy = 0; P.forEach(p => { const x = p.e - c.e, y = p.n - c.n; xx += x * x; xy += x * y; yy += y * y; });
    const a = 0.5 * Math.atan2(2 * xy, xx - yy);
    return { c, d: { e: Math.cos(a), n: Math.sin(a) } };
  };
  const cross = (A, B) => {
    const den = A.d.e * B.d.n - A.d.n * B.d.e;
    if (Math.abs(den) < Math.sin(20 * D)) return null;              // fast parallel: keine Ecke
    const u = ((B.c.e - A.c.e) * B.d.n - (B.c.n - A.c.n) * B.d.e) / den;
    return { e: A.c.e + A.d.e * u, n: A.c.n + A.d.n * u };
  };
  runs.forEach(r => { r.line = fit(r.i0, r.i1); });
  const out = [];
  // Zwischenpunkte der Genauigkeit bleiben auf den Kanten erhalten, nur nicht in den letzten 3 m vor einer Ecke
  // und keine Zacken (scharfe Knicke) mitten in einer geraden Kante
  const inner = (j0, j1, m) => idx.map(i => i <= j0 ? i + n : i).filter(j => j > j0 && j < j1 && !peak[j % n] && (j >= n ? s[j - n] + perim : s[j]) - s[j0] > m && (j1 >= n ? s[j1 - n] + perim : s[j1]) - (j >= n ? s[j - n] + perim : s[j]) > m).sort((a, b) => a - b).map(j => R[j % n]);
  runs.forEach((A, k) => {
    if (s[A.i1] - s[A.i0] >= 2 * minLen) out.push(...inner(A.i0, A.i1, 3));   // kurze Kanten (Stirnseiten) bleiben eine reine Gerade
    const B = runs[(k + 1) % runs.length], b0 = k + 1 < runs.length ? B.i0 : B.i0 + n;
    const gapLen = (k + 1 < runs.length ? s[B.i0] : s[B.i0] + perim) - s[A.i1], near = X => X && dist(X, R[A.i1]) <= gapLen + minLen && dist(X, R[B.i0]) <= gapLen + minLen;
    // zwei Stücke derselben Kante: einfach weiter, kein Punkt
    const par = Math.abs(A.line.d.e * B.line.d.n - A.line.d.n * B.line.d.e) < Math.sin(5 * D);
    if (par && gapLen < minLen) {
      if (off(A.line, B.line.c) < 2 * tol + 0.5) { out.push(...inner(A.i1, b0, 0)); return; }   // dieselbe Kante läuft weiter
      // Stufe zwischen zwei parallelen Stücken: Ende der einen und Anfang der anderen Geraden
      const pr = (Ln, p) => { const u = (p.e - Ln.c.e) * Ln.d.e + (p.n - Ln.c.n) * Ln.d.n; return { e: Ln.c.e + Ln.d.e * u, n: Ln.c.n + Ln.d.n * u }; };
      out.push(pr(A.line, R[A.i1]), pr(B.line, R[B.i0])); return;
    }
    const X = cross(A.line, B.line);
    if (near(X)) { out.push(X); return; }
    // Endstück als eigene Gerade – nur die Punkte, die nicht auf den verlängerten Seiten liegen
    const G = range(A.i1, b0).filter(p => off(A.line, p) > 1.5 * tol && off(B.line, p) > 1.5 * tol);
    if (G.length >= 6) {
      const M = fitPts(G), X1 = cross(A.line, M), X2 = cross(M, B.line);
      if (near(X1) && near(X2)) { out.push(X1, X2); return; }
    }
    // sonst bleibt der Bogen wie er ist: Ende der Kante, Punkte dazwischen, Anfang der nächsten Kante
    out.push(R[A.i1]);
    idx.map(i => i <= A.i1 ? i + n : i).filter(j => j > A.i1 && j < b0).sort((a, b) => a - b).forEach(j => out.push(R[j % n]));
    out.push(R[B.i0]);
  });
  return out.length >= 3 ? out : plain();
}
// Linie vereinfachen (Douglas-Peucker), Endpunkte bleiben
function dpLine(P, tol) {
  if (P.length < 3) return P.slice();
  const keep = new Uint8Array(P.length); keep[0] = keep[P.length - 1] = 1;
  const st = [[0, P.length - 1]];
  while (st.length) {
    const [i0, i1] = st.pop(), a = P[i0], b = P[i1], L1 = Math.hypot(b.e - a.e, b.n - a.n) || 1e-9;
    let im = -1, dm = tol;
    for (let i = i0 + 1; i < i1; i++) { const d = Math.abs((P[i].e - a.e) * (b.n - a.n) - (P[i].n - a.n) * (b.e - a.e)) / L1; if (d > dm) { dm = d; im = i; } }
    if (im > 0) { keep[im] = 1; st.push([i0, im], [im, i1]); }
  }
  return P.filter((_, i) => keep[i]);
}
// Feldseiten wie abgefahren: Rand an den Ecken in Seiten teilen, kurze (zackige Wendebereiche) weglassen,
// jede Seite als Kurve vereinfachen, benachbarte Seiten in ihrer Richtung verlängern – der Schnitt ist die Ecke.
function sidesBoundary(R0, rough, minLen) {
  const n0 = R0.length;
  if (n0 < 40) return null;
  const k = Math.max(1, Math.round(1 + 3 * rough));            // leicht glätten (Rasterstufen)
  let R = R0.map((_, i) => { let e = 0, nn = 0; for (let j = -k; j <= k; j++) { const q = R0[(i + j + n0) % n0]; e += q.e; nn += q.n; } return { e: e / (2 * k + 1), n: nn / (2 * k + 1) }; });
  const n = R.length, at = i => R[((i % n) + n) % n], K = 10;   // Richtung über ±5 m
  const turn = (a, b) => { let d = b - a; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
  const dir = (a, b) => Math.atan2(b.e - a.e, b.n - a.n);
  const cr = R.map((_, i) => Math.abs(turn(dir(at(i - K), at(i)), dir(at(i), at(i + K)))));
  const C = [];                                                  // Ecken: deutlicher Knick, stärkster Punkt in der Umgebung
  for (let i = 0; i < n; i++) { if (cr[i] < 30 * D) continue; let mx = true; for (let q = -K; q <= K && mx; q++) if (q && (cr[(i + q + n) % n] > cr[i] || (cr[(i + q + n) % n] === cr[i] && q < 0))) mx = false; if (mx) C.push(i); }
  if (C.length < 2) return null;
  const sides = [];
  for (let j = 0; j < C.length; j++) {
    const a = C[j], b = j + 1 < C.length ? C[j + 1] : C[0] + n, len = (b - a) * 0.5;
    if (len >= minLen) sides.push({ a, b });
  }
  if (sides.length < 2) return null;
  const tol = 0.05 + 2.95 * rough, trim = 6;                    // 3 m an den Ecken nicht nachziehen (dort ist es meist zackig)
  // Ausgleichsgerade (Hauptachse) durch Punkte, Richtung vom ersten zum letzten Punkt
  const fit = Q => {
    const c = Q.reduce((m, p) => ({ e: m.e + p.e / Q.length, n: m.n + p.n / Q.length }), { e: 0, n: 0 });
    let xx = 0, xy = 0, yy = 0; Q.forEach(p => { const x = p.e - c.e, y = p.n - c.n; xx += x * x; xy += x * y; yy += y * y; });
    const an = 0.5 * Math.atan2(2 * xy, xx - yy); let u = { e: Math.cos(an), n: Math.sin(an) };
    const d = { e: Q[Q.length - 1].e - Q[0].e, n: Q[Q.length - 1].n - Q[0].n }; if (u.e * d.e + u.n * d.n < 0) u = { e: -u.e, n: -u.n };
    return { c, u };
  };
  // je Seite: Geraden über die letzten bis zu 25 m an beiden Enden (Richtung für die Ecken), dazwischen die Kurve
  sides.forEach(sd => {
    const P = []; for (let i = sd.a + trim; i <= sd.b - trim; i++) P.push(at(i));
    sd.P = P;
    if (P.length < 4) return;
    const nw = Math.max(2, Math.min(50, Math.floor(P.length / 2)));
    sd.Ls = fit(P.slice(0, nw)); sd.Le = fit(P.slice(P.length - nw));
    const mid = P.slice(nw, P.length - nw);
    sd.S = mid.length > 2 ? dpLine(mid, tol) : [];
    if (sd.S.length === 2 && P.length <= 2 * nw + 4) sd.S = [];   // kurze Seite: nur die Gerade
  });
  const X2 = (p, u, q, v) => { const den = u.e * v.n - u.n * v.e; if (Math.abs(den) < Math.sin(15 * D)) return null; const t1 = ((q.e - p.e) * v.n - (q.n - p.n) * v.e) / den; return { e: p.e + u.e * t1, n: p.n + u.n * t1 }; };
  const off = (p, Ln) => Math.abs((p.e - Ln.c.e) * Ln.u.n - (p.n - Ln.c.n) * Ln.u.e);
  const out = [];
  sides.forEach((A, j) => {
    const B = sides[(j + 1) % sides.length];
    if (!A.Le || !B.Ls) return;
    // gerade Seite: Kurvenpunkte nur, wenn sie wirklich von der Geraden abweichen
    const whole = fit(A.P);
    if (A.S.length && A.S.some(p => off(p, whole) > tol)) out.push(...A.S);
    const ea = A.P[A.P.length - 1], sb = B.P[0];
    const bEnd = B.a < A.b ? B.a + n : B.a, gap = (bEnd - A.b) * 0.5 + trim, maxD = gap + 15;
    // Seiten, die fast umkehren (Ecke spitzer als 60°), schneiden sich weit draußen: dann lieber eine Stirnseite
    const uturn = A.Le.u.e * B.Ls.u.e + A.Le.u.n * B.Ls.u.n < -0.5;
    const X = uturn ? null : X2(A.Le.c, A.Le.u, B.Ls.c, B.Ls.u);
    const ahead = X && (X.e - ea.e) * A.Le.u.e + (X.n - ea.n) * A.Le.u.n > -5 && (sb.e - X.e) * B.Ls.u.e + (sb.n - X.n) * B.Ls.u.n > -5;
    if (X && ahead && Math.hypot(X.e - ea.e, X.n - ea.n) < maxD && Math.hypot(X.e - sb.e, X.n - sb.n) < maxD) { out.push(X); return; }
    // fast parallel (schmale Stirnseite): Gerade durch das Endstück, zwei Ecken
    const G = []; for (let i = A.b - trim; i <= bEnd + trim; i++) G.push(at(i));
    const Gm = G.filter(p => off(p, A.Le) > 1.5 && off(p, B.Ls) > 1.5);
    if (Gm.length >= 6) {
      const M = fit(Gm), Y1 = X2(A.Le.c, A.Le.u, M.c, M.u), Y2 = X2(M.c, M.u, B.Ls.c, B.Ls.u);
      if (Y1 && Y2 && Math.hypot(Y1.e - ea.e, Y1.n - ea.n) < maxD && Math.hypot(Y2.e - sb.e, Y2.n - sb.n) < maxD) { out.push(Y1, Y2); return; }
    }
    out.push(...dpLine(G, tol));                                 // sonst bleibt der Rand dort, wie er ist
  });
  if (out.length < 3) return null;
  out.sides = sides.length;
  return out;
}
function startBndFromCoverage() {
  if (!ex.sections || !ex.sections.patches.length) { setStatus(t('needCoverage'), 'err'); return; }
  setStatus(t('covBusy'));
  const R = coverageOutline();
  if (!R) { setStatus(t('covFail'), 'err'); return; }
  const rough = () => Math.pow(1 - Math.min(100, Math.max(0, cfg.covPrec)) / 100, 1.5);   // 0 = genau, 1 = grob
  const thr = () => 0.5 + 30 * rough();
  if (!layerOn.sections) setLayer('sections', true);
  startTool({
    title: 'btnBndCov', params: ['covPrec', 'covEdge'], res: null, msgHtml: true,
    msg: () => (tool.res && tool.res.sides ? t('covMsgSides', tool.res.sides, fmtNum(0.05 + 2.95 * rough(), 2), tool.res.length, fmtNum(area(tool.res) / 10000, 2)) : t('covMsg', fmtNum(thr(), 1), tool.res ? tool.res.length : 0, fmtNum(tool.res ? area(tool.res) / 10000 : 0, 2))) + (bnds[0] ? '<br>' + esc(t('covReplace')) : ''),
    recalc() { this.res = (cfg.covEdge > 0 && sidesBoundary(R, rough(), cfg.covEdge)) || straightEdges(thinByAngle(R, thr(), 1 + 7 * rough()), 0.3 + 2.7 * rough(), cfg.covEdge); redrawTool(); },
    draw: g => {
      if (!tool.res) return;
      prevLine(g, tool.res, '#ffd400', true);
      if (tool.res.length < 3000) tool.res.forEach(p => L.circleMarker(ll(p), { renderer: cv, radius: 3, color: '#000', weight: 1, fillColor: '#ffd400', fillOpacity: 1, interactive: false }).addTo(g));
    },
    okEnabled: () => !!tool.res && tool.res.length >= 3,
    ok() {
      const nb = { flagLines: ['False'], pts: this.res, orig: [], dirty: true };
      if (bnds[0]) { pushUndo(); bnds[0] = Object.assign(bnds[0], { pts: nb.pts, dirty: true }); } else bnds.unshift(nb);
      active = 0; bndListDirty = true; unsaved = true; sel = -1;
      renderBndList(); drawAll(); updateInfo();
      setStatus(t('bndCreated'), 'ok');
    }
  });
  tool.recalc();
  setStatus('');
}
$('btnBndCov').onclick = startBndFromCoverage;
