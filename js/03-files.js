// AOG Feldeditor – AgOpenGPS-Dateien lesen und schreiben, Laden/Speichern, Felder-Ordner

// ---------- Dateien lesen ----------
function parseField(txt) {
  const l = txt.split(/\r?\n/).map(s => s.trim());
  const k = l.findIndex(s => /^startfix/i.test(s));
  if (k < 0 || !l[k + 1]) throw new Error(t('errNoStartFix'));
  const v = l[k + 1].split(',').map(parseFloat);
  if (!isFinite(v[0]) || !isFinite(v[1])) throw new Error(t('errBadStartFix'));
  return v;
}

function parseBoundary(txt) {
  const l = txt.split(/\r?\n/).map(s => s.trim());
  let i = 0; const out = [];
  if (l[i] && l[i].startsWith('$')) i++;
  while (i < l.length) {
    if (l[i] === '') { i++; continue; }
    const flagLines = [];
    while (i < l.length && /^(true|false)$/i.test(l[i])) flagLines.push(l[i++]);
    const n = parseInt(l[i++], 10);
    if (!isFinite(n)) throw new Error(t('errBoundary', i));
    const pts = [], orig = [];
    for (let k = 0; k < n; k++) {
      const line = l[i++]; const v = line.split(',');
      pts.push({ e: parseFloat(v[0]), n: parseFloat(v[1]) }); orig.push(line);
    }
    out.push({ flagLines, pts, orig, dirty: false });
  }
  return out;
}

function parseFlags(txt) {
  const l = txt.split(/\r?\n/), n = parseInt(l[1], 10) || 0, out = [];
  for (let i = 0; i < n; i++) {
    const w = (l[2 + i] || '').split(',');
    if (w.length < 6) continue;
    const eight = w.length >= 8;
    out.push({ lat: +w[0], lon: +w[1], heading: eight ? +w[4] : 0, color: +w[eight ? 5 : 4] || 0, id: +w[eight ? 6 : 5] || i + 1,
      notes: eight ? w.slice(7).join(' ').trim() : '' });
  }
  return out;
}

// ---------- Dateien schreiben ----------
// AOG baut die Wendelinie aus jedem Grenzpunkt + dessen Richtung und verdichtet die Grenze beim
// Laden nicht mehr. Daher hier wie AOG (CalculateFenceArea + FixFenceLine) aufbereiten.
function fenceSignedArea(pts) {
  let a = 0;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) a += (pts[j].e + pts[i].e) * (pts[j].n - pts[i].n);
  return a;
}
function fenceSpacing(pts, idx) {
  const ar = Math.abs(fenceSignedArea(pts) / 2);
  const sp = ar < 200000 ? 1.1 : ar < 400000 ? 2.2 : 3.3;
  return idx > 0 ? sp * 0.5 : sp;
}
const dist = (a, b) => Math.hypot(a.e - b.e, a.n - b.n);
function prepareFence(src, idx) {
  const pts = src.map(p => ({ e: p.e, n: p.n }));
  const s = fenceSignedArea(pts);
  if ((idx === 0 && s >= 0) || (idx > 0 && s < 0)) pts.reverse();
  const sp = fenceSpacing(pts, idx);
  for (const f of [1.5, 1.6]) {
    for (let i = 0; i < pts.length; i++) {
      const j = (i + 1) % pts.length;
      if (dist(pts[i], pts[j]) > sp * f) {
        pts.splice(j === 0 ? pts.length : j, 0, { e: (pts[i].e + pts[j].e) / 2, n: (pts[i].n + pts[j].n) / 2 });
        i--;
      }
    }
  }
  for (let i = 0; i < pts.length - 1; i++) {
    if (dist(pts[i], pts[i + 1]) < sp * 0.9) { pts.splice(i + 1, 1); i--; }
  }
  const n = pts.length;
  return pts.map((p, i) => {
    const a = pts[(i - 1 + n) % n], c = pts[(i + 1) % n];
    let h = Math.atan2(c.e - a.e, c.n - a.n); if (h < 0) h += 2 * Math.PI;
    return { e: p.e, n: p.n, h };
  });
}
// Grenze zu dünn für AOG? (z. B. ausgedünnt oder aus älterer Editor-Version gespeichert)
function fenceTooSparse(pts, idx) {
  const sp = fenceSpacing(pts, idx);
  return pts.some((p, i) => dist(p, pts[(i + 1) % pts.length]) > sp * 3);
}

function serializeBoundary() {
  const out = ['$Boundary'];
  bnds.forEach((b, idx) => {
    if (!b.dirty) { b.newLines = b.orig; out.push(...b.flagLines, String(b.orig.length), ...b.orig); return; }
    b.newLines = prepareFence(b.pts, idx).map(p => r3(p.e) + ',' + r3(p.n) + ',' + p.h.toFixed(5));
    out.push(...b.flagLines, String(b.newLines.length), ...b.newLines);
  });
  return out.join('\r\n') + '\r\n';
}

function serializeFlags() {
  const out = ['$Flags', String(flags.length)];
  for (const f of flags) {
    const p = plane.fwd(f.lat, f.lon);
    out.push([r7(f.lat), r7(f.lon), r3(p.e), r3(p.n), r7(f.heading), f.color, f.id, (f.notes || '').replace(/,/g, ' ')].join(','));
  }
  return out.join('\r\n') + '\r\n';
}

// Lokale Koordinate vom alten (Platten-)Ursprung auf den neuen umrechnen
function T(e, n) { const [a, c] = diskPlane.inv(e, n); return plane.fwd(a, c); }

const NUM = '(-?\\d+(?:\\.\\d+)?(?:[eE][-+]?\\d+)?)';
const PT_RE = new RegExp('^(\\s*)' + NUM + '(\\s*,\\s*)' + NUM + '(.*)$');
function shiftLine(line) {
  const m = line.match(PT_RE); if (!m) return line;
  const p = T(+m[2], +m[4]);
  return m[1] + r3(p.e) + m[3] + r3(p.n) + m[5];
}
// Dateien, in denen jede Zeile "easting,northing[,...]" ein Punkt ist
// skip: Zeilennummern, die nie verschoben werden dürfen (Namen wie „1,5 m“ sehen sonst wie ein Punkt aus)
function shiftGeneric(txt, skip) { return txt.split(/\r?\n/).map((l, i) => skip && skip.has(i) ? l : shiftLine(l)).join('\r\n'); }

// Sections.txt: bei ungerader Punktzahl ist der erste Eintrag eine Farbe (R,G,B), kein Punkt
function shiftSections(txt) {
  const l = txt.split(/\r?\n/); let i = 0;
  while (i < l.length) {
    const c = l[i].trim();
    if (!/^\d+$/.test(c)) { i++; continue; }
    const n = +c; i++;
    for (let k = 0; k < n && i < l.length; k++, i++) if (!(k === 0 && n % 2 === 1)) l[i] = shiftLine(l[i]);
  }
  return l.join('\r\n');
}

function replaceStartFix(txt) {
  const l = txt.split(/\r?\n/);
  const k = l.findIndex(s => /^startfix/i.test(s.trim()));
  if (k >= 0) l[k + 1] = plane.lat0 + ',' + plane.lon0;
  return { l, k };
}

// Elevation.txt: eigener StartFix-Kopf, Zeilen: Lat,Lon,Höhe,Qualität,Easting,Northing,Heading,Roll
function shiftElevation(txt) {
  const { l, k } = replaceStartFix(txt);
  for (let i = k >= 0 ? k + 2 : 0; i < l.length; i++) {
    const w = l[i].split(',');
    if (w.length >= 6 && w.slice(0, 6).every(x => x.trim() !== '' && isFinite(+x))) {
      const p = plane.fwd(+w[0], +w[1]); w[4] = r3(p.e); w[5] = r3(p.n); l[i] = w.join(',');
    }
  }
  return l.join('\r\n');
}

// BackPic.txt: $BackPic, True, maxE, minE, maxN, minN
function shiftBackPic(txt) {
  const l = txt.split(/\r?\n/);
  if (!/^true$/i.test((l[1] || '').trim())) return txt;
  const num = s => parseFloat(String(s).replace(/,/g, ''));
  const lo = T(num(l[3]), num(l[5])), hi = T(num(l[2]), num(l[4]));
  l[2] = hi.e.toFixed(3); l[3] = lo.e.toFixed(3); l[4] = hi.n.toFixed(3); l[5] = lo.n.toFixed(3);
  return l.join('\r\n');
}

function buildOutputs() {
  const out = {}, oc = originChanged();
  if (oc || bndListDirty || bnds.some(b => b.dirty)) out['Boundary.txt'] = serializeBoundary();
  if ((oc || flagsDirty) && (flags.length || files['Flags.txt'] !== undefined)) out['Flags.txt'] = serializeFlags();
  const built = {};
  if (listDirty.tracks) built['TrackLines.txt'] = buildListFile('tracks');
  if (listDirty.headlines) built['Headlines.txt'] = buildListFile('headlines');
  for (const k in built) out[k] = built[k].text;
  for (const k in clearedFiles) out[k] = clearedFiles[k];
  if (oc) {
    out['Field.txt'] = replaceStartFix(files['Field.txt']).l.join('\r\n');
    for (const f of ['Headland.txt', 'TrackLines.txt', 'Contour.txt', 'Tram.txt', 'RecPath.txt', 'Headlines.txt'])
      if (files[f] !== undefined || out[f] !== undefined) out[f] = shiftGeneric(out[f] ?? files[f], built[f] ? built[f].names : nameLines(f));
    const src = k => out[k] ?? files[k];
    if (src('Sections.txt') !== undefined) out['Sections.txt'] = shiftSections(src('Sections.txt'));
    if (src('Elevation.txt') !== undefined) out['Elevation.txt'] = shiftElevation(src('Elevation.txt'));
    if (src('BackPic.txt') !== undefined) out['BackPic.txt'] = shiftBackPic(src('BackPic.txt'));
  }
  for (const k in generated) out[k] = generated[k]();      // neu gebaut: schon im aktuellen Ursprung
  return out;
}

// ---------- Laden / Speichern ----------
function load(found, keepView) {
  if (found['Field.txt'] === undefined) throw new Error(t('errNoField'));
  closeTool();
  files = found;
  bndListDirty = false; newFieldName = null; clearedFiles = {};
  for (const k in generated) delete generated[k];
  ghostLayer.clearLayers();
  const [la, lo] = parseField(files['Field.txt']);
  plane = diskPlane = Plane(la, lo);
  bnds = files['Boundary.txt'] ? parseBoundary(files['Boundary.txt']) : [];
  flags = files['Flags.txt'] ? parseFlags(files['Flags.txt']) : [];
  active = 0; sel = -1; selFlag = -1; undo = []; unsaved = false; flagsDirty = false;
  renderBndList();
  document.getElementById('agshare').style.display = files['agshare.txt'] !== undefined ? 'block' : 'none';
  ['btnAddFlag', 'btnOriginClick', 'btnOriginReset', 'btnSave', 'btnFit'].forEach(id => document.getElementById(id).disabled = false);
  document.getElementById('btnOriginCenter').disabled = !bnds.length;
  document.getElementById('btnSimp').disabled = !bnds.length;
  if (!keepView) fitField();
  drawAll();
  const bad = initExtras();
  const list = Object.keys(files).filter(n => n !== 'agshare.txt').join(', ');
  setStatus(t('loaded', list) + (bad.length ? t('unreadable', bad.join(', ')) : ''), bad.length ? 'err' : 'ok');
  const sparse = bnds.filter((b, i) => fenceTooSparse(b.pts, i));
  if (sparse.length) {
    sparse.forEach(b => b.dirty = true); unsaved = true; updateInfo();
    setStatus(t('sparse'), 'err');
  }
}

// Ganzes Feld zeigen: Grenzen, Fahnen und Ursprung
function fitField() {
  if (!plane) return;
  const pts = bnds.flatMap(b => b.pts.map(ll)).concat(flags.map(f => L.latLng(f.lat, f.lon)), [L.latLng(plane.lat0, plane.lon0)]);
  map.fitBounds(L.latLngBounds(pts), { padding: [30, 30], maxZoom: 18 });
}

// Grenzen als Liste: Name anklicken = bearbeiten, Auge = ein-/ausblenden, Papierkorb = löschen, bei Innengrenzen „befahrbar“
function renderBndList() {
  const box = document.getElementById('bndList');
  box.innerHTML = '';
  if (!bnds.length) { box.className = 'muted'; box.textContent = plane ? t('noBoundary') : '–'; return; }
  box.className = '';
  bnds.forEach((b, i) => {
    const row = document.createElement('div'), nm = document.createElement('span');
    row.className = 'bndrow' + (i === active ? ' on' : '') + (b.hidden ? ' off' : '');
    row.title = t('editTitle');
    nm.className = 'nm';
    nm.textContent = (i === 0 ? t('outer') : t('inner', i)) + ' (' + t('ptsShort', b.pts.length) + ')';
    row.append(nm);
    row.onclick = () => { active = active === i ? -1 : i; sel = -1; drawAll(); };   // erneuter Klick: nicht mehr bearbeiten
    if (i > 0) {
      const lab = document.createElement('label'), cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = /^true$/i.test(b.flagLines[0] || '');
      lab.title = t('driveThruTitle');
      lab.onclick = ev => ev.stopPropagation();
      cb.onchange = () => { b.flagLines = [cb.checked ? 'True' : 'False']; bndListDirty = true; unsaved = true; drawAll(); };
      lab.append(cb, t('driveThru'));
      row.append(lab);
    }
    row.append(
      iconBtn(b.hidden ? 'eyeoff' : 'eye', t('visTitle'), () => { b.hidden = !b.hidden; drawAll(); }, b.hidden ? 'off' : ''),
      iconBtn('trash', t('delTitle'), () => { active = i; deleteBoundary(); }));
    box.append(row);
  });
}

async function readDir(dir) {
  const found = {}; realName = {};
  const lower = Object.fromEntries(KNOWN.map(n => [n.toLowerCase(), n]));
  setBackPic(null);
  for await (const [name, h] of dir.entries()) {
    const k = lower[name.toLowerCase()];
    if (h.kind === 'file' && k) { found[k] = await (await h.getFile()).text(); realName[k] = name; }
    if (h.kind === 'file' && name.toLowerCase() === 'backpic.png') setBackPic(await h.getFile());
  }
  return found;
}
async function writeText(dir, name, txt) {
  const fh = await dir.getFileHandle(name, { create: true });
  const w = await fh.createWritable(); await w.write(txt); await w.close();
}
const stamp = () => { const d = new Date(), p = x => String(x).padStart(2, '0'); return `${d.getFullYear()}${p(d.getMonth() + 1)}${p(d.getDate())}-${p(d.getHours())}${p(d.getMinutes())}${p(d.getSeconds())}`; };

// ---------- Felder-Ordner (wird im Browser gemerkt) ----------
const $ = id => document.getElementById(id);
let rootHandle = null, aogRoot = null, fieldNames = [], currentField = '', rootLabel = '';
function showRoot(name) { rootLabel = name; $('rootName').textContent = t('rootIs', name); }

function idb(mode, fn) {
  return new Promise((resolve, reject) => {
    const rq = indexedDB.open('aog-feldeditor', 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore('kv');
    rq.onerror = () => reject(rq.error);
    rq.onsuccess = () => {
      const tx = rq.result.transaction('kv', mode), r = fn(tx.objectStore('kv'));
      tx.oncomplete = () => resolve(r.result);
      tx.onerror = () => reject(tx.error);
    };
  });
}
const idbGet = k => idb('readonly', st => st.get(k));
const idbSet = (k, v) => idb('readwrite', st => st.put(v, k));

// Gewählt wird der Ordner AgOpenGPS (darin Fields und die Fahrzeug-/Geräteprofile) – oder wie früher direkt Fields
async function useRoot(h) {
  aogRoot = null; rootHandle = h;
  try { rootHandle = await h.getDirectoryHandle('Fields'); aogRoot = h; } catch (e) { /* direkt der Fields-Ordner */ }
  showRoot(h.name);
  $('btnRegrant').style.display = 'none';
  fieldNames = [];
  loadProfiles();
  for await (const [name, e] of rootHandle.entries()) {
    if (e.kind !== 'directory') continue;
    try { await e.getFileHandle('Field.txt'); fieldNames.push(name); } catch (err) { /* kein Feld */ }
  }
  fieldNames.sort((a, b) => a.localeCompare(b, 'de'));
  if (!fieldNames.length) setStatus(t('noFields', h.name), 'err');
  renderFieldList();
}

function renderFieldList() {
  const q = $('fieldFilter').value.trim().toLowerCase(), sel = $('fieldList');
  sel.innerHTML = '';
  fieldNames.filter(n => n.toLowerCase().includes(q)).forEach(n => { const o = new Option(n, n); o.title = n; sel.add(o); });   // Tooltip: ganzer Name
  sel.value = currentField;
  sel.style.display = $('fieldFilter').style.display = fieldNames.length ? 'block' : 'none';
}

$('btnRoot').onclick = async () => {
  if (!ui.nav) { ui.nav = true; applyUi(); }                // Feldliste bzw. Dateiauswahl sichtbar machen
  if (!window.showDirectoryPicker) { $('fallback').style.display = 'block'; return; }
  try {
    const h = await window.showDirectoryPicker({ id: 'aogFields', mode: 'readwrite', startIn: 'documents' });
    await useRoot(h);
    try { await idbSet('root', h); } catch (e) { /* Merken nicht möglich – dann eben jedes Mal wählen */ }
  } catch (e) { if (e.name !== 'AbortError') setStatus(t('error', e.message), 'err'); }
};

$('btnRegrant').onclick = async () => {
  try {
    const h = await idbGet('root');
    if (h && await h.requestPermission({ mode: 'readwrite' }) === 'granted') await useRoot(h);
  } catch (e) { setStatus(t('error', e.message), 'err'); }
};

$('fieldFilter').oninput = renderFieldList;

// Feld komplett löschen: der ganze Feldordner (mit allen Dateien und Sicherungen) – nur nach Rückfrage
$('btnDelField').onclick = () => {
  const name = currentField;
  if (!rootHandle || !dirHandle || !name) return;
  closeTool(); showTab('feld');
  askPanel('btnDelField', t('confirmDelField', name), async () => {
    try {
      await rootHandle.removeEntry(name, { recursive: true });
      try { sessionStorage.setItem('aogMsg', t('fieldDeleted', name)); } catch (e) { }
      unsaved = false; location.reload();                     // Editor leer neu starten, die Feldliste wird neu gelesen
    } catch (err) { setStatus(t('error', err.message), 'err'); }
  }, 'btnDelField');
};
try { const m = sessionStorage.getItem('aogMsg'); if (m) { sessionStorage.removeItem('aogMsg'); setTimeout(() => setStatus(m, 'ok'), 300); } } catch (e) { }

async function openField(name) {
  try {
    const d = await rootHandle.getDirectoryHandle(name);
    load(await readDir(d));
    dirHandle = d; currentField = name;
    renderFieldList(); updateInfo(); updateTitle();
    setStatus(t('fieldLoaded', name), 'ok');
  } catch (err) { setStatus(t('error', err.message), 'err'); }
}
$('fieldList').onchange = e => {
  const name = e.target.value;
  if (!name || name === currentField) return;
  if (unsaved) { e.target.value = currentField; askDiscard('hFields', 'discardOpen', name, () => openField(name)); return; }
  openField(name);
};

// Beim Start den gemerkten Felder-Ordner wieder öffnen (Chrome fragt ggf. einmal nach der Erlaubnis)
(async function restoreRoot() {
  if (!window.showDirectoryPicker || !window.indexedDB) return;
  try {
    const h = await idbGet('root');
    if (!h) return;
    if (await h.queryPermission({ mode: 'readwrite' }) === 'granted') await useRoot(h);
    else { showRoot(h.name); $('btnRegrant').style.display = 'block'; }
  } catch (e) { /* nichts gemerkt */ }
})();

document.getElementById('fileIn').onchange = async e => {
  try {
    const found = {}; realName = {};
    setBackPic(null);
    for (const f of e.target.files) {
      const k = KNOWN.find(n => n.toLowerCase() === f.name.toLowerCase());
      if (k) { found[k] = await f.text(); realName[k] = f.name; }
      if (f.name.toLowerCase() === 'backpic.png') setBackPic(f);
    }
    dirHandle = null; currentField = '';
    load(found);
  } catch (err) { setStatus(t('error', err.message), 'err'); }
};

async function saveField() {
  // neues Feld: Ursprung in die Feldmitte, damit „Drive In“ das Feld findet
  if (newFieldName && bnds[0] && !originChanged()) { const c = centroid(bnds[0].pts), [la, lo] = plane.inv(c.e, c.n); setOrigin(la, lo); }
  const outs = newFieldName ? { ...newFieldTemplates(), ...buildOutputs() } : buildOutputs(), names = Object.keys(outs);
  if (!names.length) { setStatus(t('nothingToSave'), ''); return true; }
  try {
    if (newFieldName && rootHandle) dirHandle = await rootHandle.getDirectoryHandle(newFieldName, { create: true });
    if (dirHandle) {
      const old = newFieldName ? [] : names.filter(n => files[n] !== undefined);
      const bdir = old.length ? await dirHandle.getDirectoryHandle('Backup_' + stamp(), { create: true }) : null;
      for (const n of old) await writeText(bdir, realName[n] || n, files[n]);
      for (const n of names) await writeText(dirHandle, realName[n] || n, outs[n]);
      setStatus(t('saved', names.join(', ')), 'ok');
    } else {
      for (const n of names) {
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([outs[n]], { type: 'text/plain' }));
        a.download = n; a.click();
        await new Promise(r => setTimeout(r, 300));
      }
      setStatus(t('downloaded', names.join(', ')), 'ok');
    }
    for (const n of names) files[n] = outs[n];
    diskPlane = plane;
    bnds.forEach(b => { if (b.newLines) { b.orig = b.newLines; b.dirty = false; } });
    flagsDirty = false; unsaved = false; bndListDirty = false; clearedFiles = {};
    for (const k in generated) delete generated[k];
    initExtras();
    updateInfo();
    if (newFieldName) {
      if (!fieldNames.includes(newFieldName)) { fieldNames.push(newFieldName); fieldNames.sort((a, b) => a.localeCompare(b, 'de')); }
      currentField = newFieldName;
      setStatus(t('fieldCreated', newFieldName), 'ok');
      newFieldName = null;
      renderFieldList();
    }
    return true;
  } catch (e) { setStatus(t('saveError', e.message), 'err'); return false; }
}
document.getElementById('btnSave').onclick = saveField;
