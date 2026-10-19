// AOG Feldeditor – Ebenen anzeigen (Spuren, Vorgewende, Fahrgassen …) und umbenennen

// ---------- Weitere Felddaten anzeigen (Ebenen) und umbenennen ----------
// Alles wird beim Laden in Längen-/Breitengrad umgerechnet, ist also vom Ursprung unabhängig.
map.createPane('backpic').style.zIndex = 300;
map.createPane('extras').style.zIndex = 350;              // unter der Grenze, die bearbeitet wird
const cv = L.canvas({ pane: 'extras', padding: 0.5 });
const EXTRA_DEFS = [
  ['sections'], ['tracks'], ['headland'], ['headlines'], ['tram'], ['tramw'], ['contour'], ['recpath'], ['backpic'], ['flags']   // Beschriftung: t('L_' + id)
];
const exLayers = Object.fromEntries(EXTRA_DEFS.map(([id]) => [id, id === 'flags' ? flagLayer : L.layerGroup()]));
let ex = { tracks: [], headlines: [] }, listDirty = { tracks: false, headlines: false }, hiTrack = -1, backPicUrl = null;
const layerOn = { sections: true, tracks: true, headland: true, headlines: true, tram: true, tramw: true, contour: false, recpath: true, backpic: false, flags: true };
try { Object.assign(layerOn, JSON.parse(localStorage.getItem('aogLayers') || '{}')); } catch (e) { }

// Spuren im Register Spuren auf der Karte anklickbar: Hand-Cursor, beim Darüberfahren hell, Klick wählt aus (nochmal = abwählen)
const trackHits = L.layerGroup().addTo(map);
let trackGeo = [];
function refreshTrackHits() {
  trackHits.clearLayers();
  if (ui.tab !== 'spuren' || tool || !layerOn.tracks) return;
  trackGeo.forEach(({ i, pts }) => {
    const pl = L.polyline(pts, { color: '#fff', opacity: 0, weight: 14, bubblingMouseEvents: false }).addTo(trackHits);
    pl.on('mouseover', () => pl.setStyle({ opacity: .35 }));
    pl.on('mouseout', () => pl.setStyle({ opacity: 0 }));
    pl.on('click', () => selectTrack(i));
  });
}
// Dasselbe in Werkzeugen (Fahrgassen, Vorgewende): die Spuren sehen aus wie im Register Spuren und sind anklickbar
function trackPickHits(g, onPick, allow) {
  trackGeo.forEach(({ i, pts }) => {
    if (allow && !allow(i)) return;
    const hit = L.polyline(pts, { color: '#fff', opacity: 0, weight: 14, bubblingMouseEvents: false }).addTo(g);
    hit.on('mouseover', () => hit.setStyle({ opacity: .35 }));
    hit.on('mouseout', () => hit.setStyle({ opacity: 0 }));
    hit.on('click', () => onPick(i));
  });
}
// Nummer (1, 2, …) als runde Marke auf der Karte
const numBadge = (g, latlng, n) => L.marker(latlng, { interactive: false, zIndexOffset: 2000,
  icon: L.divIcon({ className: '', html: `<span class="numbadge">${n}</span>`, iconSize: [0, 0] }) }).addTo(g);
// Mitte des Stücks einer Spur, das im Feld liegt (dort steht die Nummer)
function trackMidInField(i, cache) {
  if (cache && cache[i]) return cache[i];
  const tr = ex.tracks[i]; if (!tr) return null;
  let P = refLine(tr);
  if (bnds[0]) { const pcs = clipToPoly(P, polyIndex(aogFence(0))); if (pcs.length) P = pcs.reduce((a, b) => pathLen(b) > pathLen(a) ? b : a); }
  const m = ll(P[P.length >> 1]);
  if (cache) cache[i] = m;
  return m;
}
function selectTrack(i) {
  hiTrack = hiTrack === i ? -1 : i;
  drawLayer('tracks'); markTrackRows();
  const row = document.querySelector(`#nameList .bndrow[data-kind="tracks"][data-i="${i}"]`);
  if (row && hiTrack === i) row.scrollIntoView({ block: 'nearest' });
}

function setBackPic(file) {
  if (backPicUrl) URL.revokeObjectURL(backPicUrl);
  backPicUrl = file ? URL.createObjectURL(file) : null;
}

const txtLines = t => t.split(/\r?\n/);
const nums = s => String(s).split(',').map(x => parseFloat(x));
const wgs = (e, n) => diskPlane.inv(e, n);

// ab Zeile i: wiederholt "Anzahl" + so viele Punktzeilen "e,n,..."
function parseBlocks(l, i) {
  const out = [];
  while (i < l.length) {
    const c = parseInt(l[i], 10);
    if (!(c > 0) || String(l[i]).includes(',')) { i++; continue; }
    const pts = [];
    for (let k = 1; k <= c && i + k < l.length; k++) { const v = nums(l[i + k]); if (isFinite(v[0]) && isFinite(v[1])) pts.push(v); }
    out.push(pts);
    i += c + 1;
  }
  return out;
}

// Sections.txt: Dreiecksstreifen; ungerade Anzahl = erster Eintrag ist die Farbe (R,G,B)
function parseSections(txt) {
  let area = 0;
  const patches = parseBlocks(txtLines(txt), 0).map(b => {
    let color = [27, 151, 160], pts = b;
    if (b.length % 2 === 1) { color = b[0]; pts = b.slice(1); }
    for (let j = 0; j + 2 < pts.length; j++) {
      const [a, c, d] = [pts[j], pts[j + 1], pts[j + 2]];
      area += Math.abs((c[0] - a[0]) * (d[1] - a[1]) - (d[0] - a[0]) * (c[1] - a[1])) / 2;
    }
    const left = pts.filter((_, k) => k % 2 === 0), right = pts.filter((_, k) => k % 2 === 1).reverse();
    return { color, ring: left.concat(right).map(v => wgs(v[0], v[1])) };
  }).filter(p => p.ring.length > 2);
  return { patches, area };
}

// TrackLines.txt: Name, Richtung, A, B, Nudge, Art, sichtbar, Anzahl, Kurvenpunkte
function parseTrackLines(txt) {
  const l = txtLines(txt), twol = (l[0] || '').trim() === '$TwolTracks', out = [];
  let i = 1;
  while (i < l.length) {
    const line = i, name = (l[i++] || '').trim();
    if (!name) continue;
    if (i + 7 > l.length) break;
    const heading = parseFloat(l[i++]), a = nums(l[i++]), b = nums(l[i++]);
    const nudge = (l[i++] || '0').trim();
    const mode = parseInt(l[i++], 10);
    const visible = (l[i++] || 'True').trim();
    const cnt = parseInt(l[i++], 10);
    if (!(cnt >= 0) || !isFinite(heading) || !isFinite(a[0]) || !isFinite(b[0])) throw new Error('Format');
    const pts = [];
    for (let k = 0; k < cnt && i < l.length; k++) { const v = nums(l[i++]); if (isFinite(v[0]) && isFinite(v[1])) pts.push(wgs(v[0], v[1])); }
    if (twol) i += 2;
    out.push({ line, end: i, name, heading, mode, a, b, pts, nudge, visible });
  }
  return out;
}

// Headlines.txt: Name, Abstand, Art, A-Punkt, Anzahl, Punkte "e , n , h"
function parseHeadlines(txt) {
  const l = txtLines(txt), out = [];
  let i = 1;
  while (i < l.length) {
    const line = i, name = l[i++];
    if (i + 4 > l.length) break;
    i += 3;
    const cnt = parseInt(l[i++], 10);
    if (!(cnt >= 0)) throw new Error('Format');
    const pts = [];
    for (let k = 0; k < cnt && i < l.length; k++) { const v = nums(l[i++]); if (isFinite(v[0]) && isFinite(v[1])) pts.push(wgs(v[0], v[1])); }
    out.push({ line, end: i, name, pts, show: pts.length > 3 });   // AOG lädt nur Linien mit mehr als 3 Punkten
  }
  return out;
}

function parseTramFile(txt) {
  const l = txtLines(txt).map(s => s.trim());
  let i = l[0] && l[0].startsWith('$') ? 1 : 0;
  const block = () => {
    const n = parseInt(l[i++], 10) || 0, a = [];
    for (let k = 0; k < n && i < l.length; k++) { const v = nums(l[i++]); if (isFinite(v[0]) && isFinite(v[1])) a.push(wgs(v[0], v[1])); }
    return a;
  };
  const outer = block(), inner = block(), lines = [], nl = parseInt(l[i++], 10) || 0;
  for (let k = 0; k < nl && i < l.length; k++) { const a = block(); if (a.length > 1) lines.push(a); }
  return { outer, inner, lines };
}

// BackPic.txt: $BackPic, True, maxE, minE, maxN, minN (Zahlen ggf. mit Tausenderkomma)
function parseBackPic(txt) {
  const l = txtLines(txt);
  if (!/^true$/i.test((l[1] || '').trim())) return null;
  const v = l.slice(2, 6).map(s => parseFloat(String(s).replace(/,/g, '')));
  if (v.length < 4 || !v.every(isFinite)) return null;
  return [wgs(v[1], v[3]), wgs(v[0], v[2])];
}

function parseExtras() {
  const bad = [];
  const tryP = (f, fn, def) => { if (files[f] === undefined) return def; try { return fn(files[f]); } catch (e) { bad.push(f); return def; } };
  const toWgs = b => b.map(v => wgs(v[0], v[1]));
  ex = {
    sections: tryP('Sections.txt', parseSections, null),
    tracks: tryP('TrackLines.txt', parseTrackLines, []),
    headland: tryP('Headland.txt', t => parseBlocks(txtLines(t), 1).filter(b => b.length > 2).map(toWgs), []),
    headlines: tryP('Headlines.txt', parseHeadlines, []),
    tram: tryP('Tram.txt', parseTramFile, null),
    contour: tryP('Contour.txt', t => parseBlocks(txtLines(t), 1).filter(b => b.length > 1).map(toWgs), []),
    recpath: tryP('RecPath.txt', t => (parseBlocks(txtLines(t), 1)[0] || []).map(v => wgs(v[0], v[1])), []),
    backpic: tryP('BackPic.txt', parseBackPic, null)
  };
  listDirty = { tracks: false, headlines: false };
  hiTrack = -1;
  return bad;
}

function exCount(id) {
  switch (id) {
    case 'sections': return ex.sections ? ex.sections.patches.length : 0;
    case 'tracks': return ex.tracks.filter(x => !x.deleted).length;
    case 'headland': return ex.headland ? ex.headland.length : 0;      // beim Laden kurz noch nicht gelesen
    case 'headlines': return ex.headlines.filter(h => h.show && !h.deleted).length;
    case 'tram': return ex.tram ? ex.tram.lines.length + (ex.tram.outer.length > 1) + (ex.tram.inner.length > 1) : 0;
    case 'tramw': return ex.tram && (ex.tram.lines.length || ex.tram.outer.length > 1) ? 1 : 0;
    case 'contour': return ex.contour.length;
    case 'recpath': return ex.recpath.length > 1 ? 1 : 0;
    case 'backpic': return ex.backpic && backPicUrl ? 1 : 0;
    case 'flags': return flags.length;
  }
  return 0;
}

const nameLabel = (pos, text) => L.marker(pos, { interactive: false,
  icon: L.divIcon({ className: '', html: `<span class="tlabel">${text.replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c])}</span>`, iconSize: [0, 0] }) });

function drawLayer(id) {
  const g = exLayers[id];
  if (id === 'flags') return;
  g.clearLayers();
  const line = (pts, style) => L.polyline(pts, { renderer: cv, interactive: false, ...style }).addTo(g);
  if (id === 'sections' && ex.sections) {
    // jede Fahrt einzeln und halb durchsichtig: wo doppelt bearbeitet wurde, wird es dunkler
    ex.sections.patches.forEach(p => {
      const k = p.color.slice(0, 3).map(c => Math.max(0, Math.min(255, Math.round(c)))).join(',');
      L.polygon(p.ring, { renderer: cv, stroke: false, fillColor: `rgb(${k})`, fillOpacity: .4, interactive: false }).addTo(g);
    });
  }
  if (id === 'tracks') trackGeo = [];
  if (id === 'tracks') ex.tracks.forEach((t, i) => {
    if (t.deleted || t.hidden) return;
    // markiert: gelb, im Register Fahrgassen weiß (dort ist die Vorschau gelb)
    const hi = i === hiTrack || i === hiTrack2, style = { color: hi ? (ui.tab === 'fahrgassen' ? '#ffffff' : '#ffd400') : '#ff4fd8', weight: hi ? 5 : 2.5 };
    let pts = t.pts, mid;
    if (t.mode === 2) {                              // AB-Linie: über A und B hinaus verlängern
      const h = t.heading, s = Math.sin(h), c = Math.cos(h), E = 1500;
      pts = [wgs(t.a[0] - s * E, t.a[1] - c * E), wgs(t.b[0] + s * E, t.b[1] + c * E)];
      const A = wgs(t.a[0], t.a[1]), B = wgs(t.b[0], t.b[1]);
      mid = [(A[0] + B[0]) / 2, (A[1] + B[1]) / 2];
    } else if (t.mode === 64) {                      // Kreis (Pivot): Mittelpunkt
      mid = wgs(t.a[0], t.a[1]);
      L.circleMarker(mid, { renderer: cv, interactive: false, radius: 7, ...style }).addTo(g);
    } else mid = pts[pts.length >> 1];
    if (pts.length > 1) { line(pts, style); trackGeo.push({ i, pts }); }
    if (mid) nameLabel(mid, t.name).addTo(g);
  });
  if (id === 'tracks') refreshTrackHits();
  // Vorgewende: nur die Teile zeichnen, die nicht auf der Grenze liegen (z. B. nur die Stirnseiten)
  if (id === 'headland' && plane) ex.headland.forEach(p => offFence(p.map(([a, b]) => plane.fwd(a, b)), true)
    .forEach(run => L.polyline(run.map(ll), { renderer: cv, interactive: false, color: '#ff9500', weight: 2, dashArray: '8 6' }).addTo(g)));
  if (id === 'headlines') ex.headlines.filter(h => h.show && !h.deleted && !h.hidden).forEach(h => {
    line(h.pts, { color: '#ffd400', weight: 2, dashArray: '4 4' });
    nameLabel(h.pts[h.pts.length >> 1], h.name || t('noName')).addTo(g);
  });
  if (id === 'tram' && ex.tram) {
    [ex.tram.outer, ex.tram.inner].forEach(a => { if (a.length > 1) L.polygon(a, { renderer: cv, interactive: false, color: '#ff8c00', weight: 2, fill: false }).addTo(g); });
    ex.tram.lines.forEach(a => line(a, { color: '#ff8c00', weight: 3 }));
  }
  if (id === 'tramw' && ex.tram && plane) {                // Arbeitsbreite der Fahrgassen als Fläche
    const P = a => a.map(([la, lo]) => plane.fwd(la, lo));
    drawBands(g, bandPolys(ex.tram.lines.map(P), { outer: P(ex.tram.outer), inner: P(ex.tram.inner) }, cfg));
  }
  if (id === 'contour') ex.contour.forEach(a => line(a, { color: '#7fff00', weight: 1.5 }));
  if (id === 'recpath' && ex.recpath.length > 1) line(ex.recpath, { color: '#00e5ff', weight: 2 });
  if (id === 'backpic' && ex.backpic && backPicUrl) L.imageOverlay(backPicUrl, ex.backpic, { pane: 'backpic', opacity: .9 }).addTo(g);
}

function showLayer(id) { if (layerOn[id]) map.addLayer(exLayers[id]); else map.removeLayer(exLayers[id]); }

// Jede Ebene steht im Ribbon bei ihrem Register (Spuren, Vorgewende, …), der Rest unter „Ansicht“
const LAYER_TAB = { tracks: 'spuren', headland: 'vorgewende', headlines: 'vorgewende', tram: 'fahrgassen', tramw: 'fahrgassen', flags: 'fahnen' };
// Kleiner Knopf mit Symbol (Auge, Papierkorb …) für Listen und das Ribbon
function iconBtn(icon, title, fn, cls) {
  const b = document.createElement('button');
  b.className = 'mini ' + (cls || ''); b.title = title;
  b.innerHTML = `<svg class="ic"><use href="#i-${icon}"/></svg>`;
  b.onclick = ev => { ev.preventDefault(); ev.stopPropagation(); fn(); };
  return b;
}
function setLayer(id, on) {
  layerOn[id] = on;
  try { localStorage.setItem('aogLayers', JSON.stringify(layerOn)); } catch (e) { }
  showLayer(id);
  if (id === 'tracks') refreshTrackHits();
}
function renderLayerList() {
  document.querySelectorAll('.gchecks[id^="lay-"]').forEach(b => { b.innerHTML = ''; });
  if (!plane) return;
  EXTRA_DEFS.forEach(([id]) => {
    const n = exCount(id), label = t('L_' + id), box = $('lay-' + (LAYER_TAB[id] || 'ansicht'));
    const extra = id === 'sections' && n ? ` (${fmtNum(ex.sections.area / 10000, 2)} ha)` : n > 1 ? ` (${n})` : '';
    const row = document.createElement('div'), eye = document.createElement('button');
    row.className = 'lrow';
    eye.className = 'lbtn' + (layerOn[id] ? ' on' : '');
    eye.disabled = !n && id !== 'flags';
    eye.title = t('visTitle');
    eye.innerHTML = `<svg class="ic"><use href="#i-${layerOn[id] ? 'eye' : 'eyeoff'}"/></svg>`;
    eye.append(label + extra);
    eye.onclick = () => { setLayer(id, !layerOn[id]); renderLayerList(); };
    row.append(eye);
    if ((CLEAR_FILES[id] || id === 'flags' || id === 'tracks') && n) row.append(iconBtn('trash', t('clearTitle'), () => clearLayer(id, label)));
    box.append(row);
    showLayer(id);
  });
}

// Spuren und Vorgewende-Linien als Liste wie die Grenzen: Zeile anklicken = gelb markieren (nochmal = aufheben),
// Name direkt umbenennen, Auge = ein-/ausblenden (nur Anzeige), Papierkorb = löschen
const smoothable = i => { const tr = ex.tracks[i]; return !!tr && !tr.deleted && (tr.mode === 4 || tr.mode === 32) && tr.pts.length > 4; };
function markTrackRows() {
  document.querySelectorAll('#nameList .bndrow[data-kind="tracks"]').forEach(r => r.classList.toggle('on', +r.dataset.i === hiTrack));
  const b = $('btnSmooth');
  b.disabled = !smoothable(hiTrack);
  b.title = b.disabled ? t('smoothNeedSel') : '';
}
$('btnSmooth').onclick = () => { const i = hiTrack; if (smoothable(i)) startSmooth(i); };
// Eintrag eine Stelle nach oben/unten schieben (gelöschte/ausgeblendete überspringen). So wird auch gespeichert –
// AOG listet Spuren und Vorgewende-Linien in dieser Reihenfolge.
function moveEntry(kind, i, dir) {
  if (tool) { setStatus(t('moveCloseTool'), 'err'); return; }
  const list = ex[kind], ok = k => list[k] && !list[k].deleted && (kind !== 'headlines' || list[k].show);
  let j = i + dir; while (j >= 0 && j < list.length && !ok(j)) j += dir;
  if (j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  if (kind === 'tracks') {                                   // Verweise auf Spur-Nummern mitziehen
    const sw = k => k === i ? j : k === j ? i : k;
    cfg.tramTrack = sw(cfg.tramTrack); cfg.tramTrack2 = sw(cfg.tramTrack2); saveCfg();
    hiTrack = sw(hiTrack); if (typeof hiTrack2 !== 'undefined') hiTrack2 = sw(hiTrack2);
  }
  listDirty[kind] = true; unsaved = true;
  drawLayer(kind); renderNames(); updateTitle();
}
function renderNames() {
  const boxes = { tracks: $('nameList'), headlines: $('headList') };
  for (const k in boxes) { boxes[k].innerHTML = ''; boxes[k].className = ''; }
  const add = (kind, list, tagOf) => list.forEach((tr, i) => {
    if (tr.deleted || (kind === 'headlines' && !tr.show)) return;
    const row = document.createElement('div'), tag = document.createElement('span'), inp = document.createElement('input');
    row.className = 'bndrow' + (kind === 'tracks' && hiTrack === i ? ' on' : '') + (tr.hidden ? ' off' : '');
    row.dataset.kind = kind; row.dataset.i = i;
    tag.className = 'tag';
    tag.textContent = tagOf(tr);
    inp.value = tr.name;
    inp.onclick = ev => ev.stopPropagation();
    inp.oninput = () => {
      const v = inp.value.trim();
      inp.style.borderColor = v ? '' : 'var(--acc)';     // leerer Name würde AOG aus dem Tritt bringen
      if (!v) return;
      tr.name = v;
      listDirty[kind] = true; unsaved = true;
      drawLayer(kind);
    };
    if (kind === 'tracks') {
      const select = on => { hiTrack = on ? i : -1; drawLayer('tracks'); markTrackRows(); };
      inp.onfocus = () => select(true);
      row.onclick = () => select(hiTrack !== i);
    }
    row.append(tag, inp,
      iconBtn('up', t('moveUp'), () => moveEntry(kind, i, -1)), iconBtn('down', t('moveDown'), () => moveEntry(kind, i, 1)),
      iconBtn(tr.hidden ? 'eyeoff' : 'eye', t('visTitle'), () => { tr.hidden = !tr.hidden; drawLayer(kind); renderNames(); }, tr.hidden ? 'off' : ''),
      iconBtn('trash', t('delTitle'), () => askPanel('delTitle', t('confirmDelTrack', tr.name || t('noName')), () => {
        tr.deleted = true; listDirty[kind] = true; unsaved = true;
        if (hiTrack === i) hiTrack = -1;
        drawLayer(kind); renderLayerList(); renderNames();
      }, 'delTitle')));
    boxes[kind].append(row);
  });
  add('tracks', ex.tracks, tr => tr.mode === 2 ? t('tagAB') : tr.mode === 4 ? t('tagCurve') : t('tagTrack'));
  add('headlines', ex.headlines, () => t('tagHeadline'));
  const empty = { tracks: 'noNames', headlines: 'noHeadlines' };
  for (const k in boxes) if (!boxes[k].children.length) { boxes[k].className = 'muted'; boxes[k].textContent = plane ? t(empty[k]) : '–'; }
  markTrackRows();
  renderCfg();                                            // Spurauswahl für die Fahrgassen
}

function nameLines(f) {
  if (f === 'TrackLines.txt') return new Set(ex.tracks.map(t => t.line));
  if (f === 'Headlines.txt') return new Set(ex.headlines.map(h => h.line));
  return null;
}

function initExtras() {
  const bad = parseExtras();
  EXTRA_DEFS.forEach(([id]) => drawLayer(id));
  renderLayerList();
  renderNames();
  return bad;
}
