// AOG Feldeditor – Überlagern / Vergleichen

// ---------- Überlagern / Vergleichen ----------
// Ein anderes Feld oder eine Datei als lila Umriss über die Karte legen; bleibt stehen, bis man es entfernt.
// Vergleich: offenes Feld rot, Überlagerung blau, gemeinsam lila – dazu Flächen und Abstand der Grenzen.
let overlay = null;                                          // { name, polys: [ [Ring außen, Löcher …] … ], lines: [[…]] } in Breite/Länge
var ovLayer = null;
function drawOverlay() {
  if (!ovLayer) ovLayer = L.layerGroup().addTo(map);
  ovLayer.clearLayers();
  const btn = document.getElementById('btnOverlay');
  if (btn) btn.classList.toggle('on', !!overlay);
  if (!overlay) return;
  const cmp = cfg.ovCompare === 1 && plane && bnds[0];
  if (cmp) L.polygon(bnds.filter(b => !b.hidden).map(b => b.pts.map(ll)), { stroke: false, fillColor: '#ff5a5a', fillOpacity: .28, interactive: false }).addTo(ovLayer);
  const hit = cmp ? ovMatch() : -1;
  overlay.polys.forEach((rings, i) => L.polygon(rings, { color: '#c77dff', weight: i === hit ? 3 : 2, dashArray: '8 5', fill: i === hit, fillColor: '#3d8bff', fillOpacity: .28, interactive: false }).addTo(ovLayer));
  if (cfg.ovShow === 1) overlay.lines.forEach(l => L.polyline(l, { color: '#c77dff', weight: 1.5, opacity: .8, interactive: false }).addTo(ovLayer));
  overlay.polys.forEach((rings, i) => { if (overlay.polys.length > 1 && !rings.name) return; L.marker(L.polygon(rings[0]).getBounds().getCenter(), { interactive: false, icon: L.divIcon({ className: '', html: `<span class="ovlabel">${esc(rings.name || overlay.name)}</span>`, iconSize: [0, 0] }) }).addTo(ovLayer); });
}
function ovMatch() {
  if (!overlay || !plane || !bnds[0]) return -1;
  const c = centroid(bnds[0].pts); let best = -1, bd = Infinity;
  overlay.polys.forEach((rings, i) => { const R = rings[0].map(v => plane.fwd(v[0], v[1])); const d = inPoly(c, R) ? -1 : dSq(c, centroid(R)); if (d < bd) { bd = d; best = i; } });
  return best;
}
// Flächen über ein Raster (wie bei „Aus Fahrspur“), Abstand über die Grenzpunkte
function compareOverlay() {
  if (!overlay || !plane || !bnds[0]) return null;
  const k = ovMatch(); if (k < 0) return null;
  const A = bnds.filter(b => !b.hidden).map(b => b.pts), B = overlay.polys[k].map(r => r.map(v => plane.fwd(v[0], v[1])));
  let e0 = Infinity, e1 = -Infinity, n0 = Infinity, n1 = -Infinity;
  A.concat(B).forEach(r => r.forEach(p => { e0 = Math.min(e0, p.e); e1 = Math.max(e1, p.e); n0 = Math.min(n0, p.n); n1 = Math.max(n1, p.n); }));
  const c = Math.max(0.2, Math.sqrt((e1 - e0) * (n1 - n0) / 3e6)), W = Math.ceil((e1 - e0) / c) + 2, H = Math.ceil((n1 - n0) / c) + 2;
  const mask = R => {
    const cv2 = document.createElement('canvas'); cv2.width = W; cv2.height = H;
    const x = cv2.getContext('2d'); x.beginPath();
    R.forEach(r => r.forEach((p, i) => x[i ? 'lineTo' : 'moveTo']((p.e - e0) / c + 1, (n1 - p.n) / c + 1)));
    x.fill('evenodd');                                        // Innengrenzen als Löcher
    return x.getImageData(0, 0, W, H).data;
  };
  const ma = mask(A), mb = mask(B), cell = c * c / 10000;
  let oa = 0, ob = 0, both = 0;
  for (let i = 3; i < ma.length; i += 4) { const a = ma[i] > 127, b = mb[i] > 127; if (a && b) both++; else if (a) oa++; else if (b) ob++; }
  const ds = (P, Q) => { const Qc = Q.concat([Q[0]]), st = Math.max(1, Math.floor(P.length / 1500)); const o = []; for (let i = 0; i < P.length; i += st) o.push(Math.sqrt(dSq(P[i], nearestOn(P[i], Qc)))); return o; };
  const d = ds(A[0], B[0]).concat(ds(B[0], A[0])).sort((x, y) => x - y);
  return { onlyA: oa * cell, onlyB: ob * cell, both: both * cell, med: d[d.length >> 1], max: d[d.length - 1] };
}
async function overlayFromField(name) {
  const o = await readOtherField(name);
  if (!o.rings.length) throw new Error(t('combNoBnd', name));
  const lines = o.tracks.map(tr => tr.mode === 2 ? [tr.aLL, tr.bLL] : tr.pts).concat(o.tram);
  return { name, polys: [o.rings], lines };
}
async function overlayFromFiles(list) {
  const res = await readImport([...list]), P = res.items.filter(it => it.kind === 'poly' && (!it.role || it.role === 'bnd'));
  if (!P.length) throw new Error(t('impNothing'));
  const polys = P.map(it => Object.assign(it.rings.slice(), { name: it.name }));
  return { name: P.length === 1 && P[0].name ? P[0].name : list[0].name.replace(/\.[^.]+$/, ''), polys, lines: res.items.filter(it => it.kind === 'line').map(it => it.pts) };
}
function startOverlay() {
  let cmp = null;
  const show = o => {
    overlay = o; drawOverlay(); cmp = compareOverlay();
    const k = ovMatch(), around = k >= 0 ? o.polys[k][0] : o.polys.flatMap(r => r[0]);   // auf die passende Fläche und das Feld zoomen
    map.fitBounds(L.latLngBounds(around.concat(plane && bnds[0] ? bnds[0].pts.map(llOf) : [])), { padding: [40, 40] }); list(); redrawTool();
  };
  const list = () => {
    const box = $('toolList'); box.innerHTML = '';
    const lb = document.createElement('label'); lb.className = 'muted'; lb.textContent = t('ovFrom');
    const sel2 = document.createElement('select'); sel2.add(new Option(fieldNames.length ? t('ovChooseField') : '–', ''));
    fieldNames.filter(n => n !== currentField).forEach(n => sel2.add(new Option(n, n)));
    sel2.value = overlay && fieldNames.includes(overlay.name) ? overlay.name : '';
    sel2.onchange = async () => { if (!sel2.value) return; try { show(await overlayFromField(sel2.value)); } catch (err) { setStatus(t('error', err.message), 'err'); } };
    const fb = document.createElement('button'); fb.type = 'button'; fb.textContent = t('ovFile');
    fb.onclick = async () => {
      try {
        let fl;
        if (window.showOpenFilePicker) { const hs = await window.showOpenFilePicker({ id: 'aogImport', multiple: true, excludeAcceptAllOption: true, types: IMP_TYPES() }); fl = await Promise.all(hs.map(h => h.getFile())); }
        else { fl = await new Promise(r => { const i2 = document.createElement('input'); i2.type = 'file'; i2.multiple = true; i2.onchange = () => r(i2.files); i2.click(); }); }
        if (fl && fl.length) show(await overlayFromFiles(fl));
      } catch (err) { if (err.name !== 'AbortError') setStatus(t('error', err.message), 'err'); }
    };
    box.append(lb, sel2, fb);
  };
  startTool({
    title: 'btnOverlay', msgHtml: true, hideOk: true, cancelLabel: 'done',
    params: () => plane && bnds[0] ? ['ovShow', 'ovCompare'] : ['ovShow'],
    actions: () => overlay ? [{ label: 'ovRemove', run() { overlay = null; drawOverlay(); setStatus(t('ovRemoved'), 'ok'); } }] : [],
    msg: () => {
      if (!overlay) return esc(t('ovPick'));
      const h = [t('ovShown', esc(overlay.name) + (overlay.polys.length > 1 ? ' (' + t('ovAreas', overlay.polys.length) + ')' : ''))];
      if (cmp && overlay.polys.length > 1) { const m = overlay.polys[ovMatch()]; h.push(esc(t('ovCompareWith', m.name || '?'))); }
      if (cfg.ovCompare === 1 && cmp) h.push(t('ovCmp', fmtNum(cmp.onlyA, 2), fmtNum(cmp.onlyB, 2), fmtNum(cmp.both, 2)));
      if (cfg.ovCompare === 1 && cmp && cmp.both >= 0.8 * Math.max(cmp.both + cmp.onlyA, cmp.both + cmp.onlyB)) h.push(t('ovDist', fmtNum(cmp.med, 2), fmtNum(cmp.max, 1)));   // nur bei (fast) gleichem Feld sinnvoll
      else if (cfg.ovCompare === 1 && !(plane && bnds[0])) h.push(esc(t('ovNoField')));
      h.push(esc(t('ovStays')));
      return h.join('<br>');
    },
    recalc() { drawOverlay(); cmp = compareOverlay(); redrawTool(); }
  });
  list();
  if (overlay) { cmp = compareOverlay(); redrawTool(); }
}
$('btnOverlay').onclick = startOverlay;
