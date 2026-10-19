// AOG Feldeditor – Einstellungen, Fahrzeug- und Geräteprofile

// --- Einstellungen (Fahrzeug, Gerät, Fahrgassen), gemerkt im Browser; Profile aus dem AgOpenGPS-Ordner ---
const cfg = { vehicle: '', tool: '', sprayer: '', trackWidth: 1.5, toolWidth: 0, overlap: 0, tramWidth: 14, passes: 0, hdDist: 12, hdWidths: 0, radius: 0,
  side: 0, fillSide: 0, simpTol: 0.01, covPrec: 70, covEdge: 20, expFmt: 0, impTarget: 0, impPolyAs: 0, splitMode: 0, ovShow: 0, ovCompare: 1, autoKind: 0, smoothW: 10, smoothRound: 40, withRing: 0, ringCount: 1, trim: 0, fillLines: 1, nA: 1, nB: 1, nR: 1, nL: 1, hdKind: 'curve', tramTrack: -1, tramTrack2: -1, tramSet: false };
try { Object.assign(cfg, JSON.parse(localStorage.getItem('aogCfg') || '{}')); } catch (e) { }
let profiles = { vehicles: [], tools: [], env: null };
const saveCfg = () => { try { localStorage.setItem('aogCfg', JSON.stringify(cfg)); } catch (e) { } };
const num = (s, d) => { const v = parseFloat(String(s ?? '').trim()); return isFinite(v) ? v : d; };
async function readSettings(fh) {
  const doc = new DOMParser().parseFromString(await (await fh.getFile()).text(), 'text/xml'), o = {};
  doc.querySelectorAll('setting').forEach(s => { const v = s.querySelector('value'); o[s.getAttribute('name')] = v ? v.textContent.trim() : ''; });
  return o;
}
async function loadProfiles() {
  profiles = { vehicles: [], tools: [], env: null };
  if (aogRoot) {
    for (const [dir, key] of [['VehicleProfiles', 'vehicles'], ['ToolProfiles', 'tools']]) {
      try {
        const d = await aogRoot.getDirectoryHandle(dir);
        for await (const [name, h] of d.entries())
          if (h.kind === 'file' && /\.xml$/i.test(name)) { try { profiles[key].push({ name: name.slice(0, -4), s: await readSettings(h) }); } catch (e) { } }
      } catch (e) { /* Ordner fehlt */ }
      profiles[key].sort((a, b) => a.name.localeCompare(b.name, 'de'));
    }
    try { profiles.env = await readSettings(await (await aogRoot.getDirectoryHandle('Environment')).getFileHandle('environment.xml')); } catch (e) { }
    if (profiles.env && !cfg.tramSet) cfg.tramWidth = num(profiles.env.setTram_tramWidth, cfg.tramWidth);
    pickVehicle(cfg.vehicle, true); pickTool(cfg.tool, true); pickSprayer(cfg.sprayer, true);
  }
  renderCfg();
}
function pickVehicle(name, keep) {
  const p = profiles.vehicles.find(v => v.name === name);
  cfg.vehicle = p ? name : (keep && !profiles.vehicles.length ? cfg.vehicle : '');
  if (p) cfg.trackWidth = num(p.s.setVehicle_trackWidth, cfg.trackWidth);
}
function pickTool(name, keep) {
  const p = profiles.tools.find(v => v.name === name);
  cfg.tool = p ? name : (keep && !profiles.tools.length ? cfg.tool : '');
  if (p) { cfg.toolWidth = num(p.s.setVehicle_toolWidth, 0); cfg.overlap = num(p.s.setVehicle_toolOverlap, 0); }
  if (!cfg.tool) cfg.hdWidths = 0;
  if (cfg.hdWidths > 0 && cfg.toolWidth > 0) cfg.hdDist = Math.round((cfg.toolWidth - cfg.overlap) * cfg.hdWidths * 10) / 10;
}
// Gerät für den Fahrgassenabstand (z. B. Feldspritze): Abstand = Arbeitsbreite des Geräts
function pickSprayer(name, keep) {
  const p = profiles.tools.find(v => v.name === name);
  cfg.sprayer = p ? name : (keep && !profiles.tools.length ? cfg.sprayer : '');
  if (p) { const w = num(p.s.setVehicle_toolWidth, 0); if (w > 0) { cfg.tramWidth = w; cfg.tramSet = true; } }
}
// Referenzlinie(n) im Register Fahrgassen gelb hervorheben
let hiTrack2 = -1;
function markRef() {
  if (ui.tab !== 'fahrgassen' || !plane) { if (hiTrack2 >= 0) { hiTrack2 = -1; drawLayer('tracks'); } return; }
  const ok = i => ex.tracks[i] && !ex.tracks[i].deleted ? i : -1;
  hiTrack = ok(cfg.tramTrack); hiTrack2 = tool && tool.two ? ok(cfg.tramTrack2) : -1;
  if (hiTrack >= 0 && !layerOn.tracks) setLayer('tracks', true);
  drawLayer('tracks');
}
const smallTracks = () => ex.tracks.map((tr, i) => ({ tr, i })).filter(({ tr }) => !tr.deleted && (tr.mode === 2 ? true : (tr.mode === 4 || tr.mode === 32) && tr.pts.length > 3));
const trackOpts = () => smallTracks().map(({ tr, i }) => [i, tr.name]);
// Einstellungen der Werkzeuge: erscheinen in der Seitenleiste, sobald man die Funktion drückt
// seg: feste Möglichkeiten als Umschalt-Knöpfe statt Auswahlliste
const PARAMS = {
  hdDist: { label: 'fDist', num: [0.1, 0], range: [0, 50] },
  simpTol: { label: 'simpLabel', num: [0.01, 0], range: [0, 1] },
  ovShow: { label: 'fOvShow', seg: true, opts: () => [[0, t('ovOnlyBnd')], [1, t('ovWithLines')]] },
  ovCompare: { label: 'fOvCompare', seg: true, opts: () => [[0, t('segOff')], [1, t('segOn')]] },
  splitMode: { label: 'fSplitMode', seg: true, opts: () => [[0, t('splitKeep')], [1, t('splitBoth')], [2, t('splitBothDel')]] },
  impTarget: { label: 'fImpTarget', seg: true, opts: () => [[0, t('impNewField')], [1, t('impOpenField')]] },
  impPolyAs: { label: 'fImpPolyAs', seg: true, opts: () => [[0, t('impAsOuter')], [1, t('impAsInner')]] },
  expFmt: { label: 'fExpFmt', seg: true, opts: () => [[0, 'KML'], [1, 'GeoJSON'], [2, 'Shapefile'], [3, 'ISOXML']] },
  covPrec: { label: 'fCovPrec', num: [1, 0], range: [0, 100] },
  covEdge: { label: 'fCovEdge', num: [1, 0], range: [0, 100], hint: () => t('covEdgeHint') },
  smoothW: { label: 'fSmoothW', num: [1, 0], range: [0, 50] },
  smoothRound: { label: 'fSmoothRound', num: [1, 10], range: [10, 60] },
  hdWidths: { label: 'fWidths', num: [1, 0], hint: () => cfg.tool ? t('toolInfo', fmtNum(cfg.toolWidth - cfg.overlap, 2), fmtNum(cfg.toolWidth, 2), fmtNum(cfg.overlap, 2)) : t('needTool') },
  radius: { label: 'fRadiusS', num: [0.5, 0], range: [0, 30], hint: () => t('radius0') },
  hdKind: { label: 'fKind', seg: true, opts: () => [['curve', t('segCurve')], ['line', t('segLine')], ['track', t('segTrack')]] },
  autoKind: { label: 'fAutoKind', seg: true, opts: () => [[0, t('segCurves')], [1, t('segABs')]] },
  fillLines: { label: 'fFillLines', seg: true, opts: () => [[1, t('segOneLine')], [2, t('segTwoLines')], [3, t('segMidTwo')]] },
  tramTrack: { label: 'fRefLine', opts: trackOpts },
  tramTrack2: { label: 'fRefLine2', opts: trackOpts },
  side: { label: 'fSide', seg: true, opts: () => [[0, t('segAuto')], [1, t('segRight')], [-1, t('segLeft')]] },
  fillSide: { label: 'fSide', seg: true, opts: () => [[0, t('segBoth')], [1, t('segRight')], [-1, t('segLeft')]] },
  passes: { label: 'fPasses', num: [1, 0], hint: () => t('passes0') },
  nA: { label: 'fCountA', num: [1, 0] },
  nR: { label: 'fCountR', num: [1, 0] },
  nL: { label: 'fCountL', num: [1, 0] },
  nB: { label: 'fCountB', num: [1, 0] },
  trim: { label: 'fMerge', seg: true, opts: () => [[0, t('segOff')], [1, t('segLine1')], [2, t('segLine2')]], hint: () => t('trimHint') },
  withRing: { label: 'fWithRing', seg: true, opts: () => [[0, t('segWithout')], [1, t('segWith')]] },
  ringCount: { label: 'fRingCount', num: [1, 1] },
};
function renderParams(keys) {
  const box = $('toolParams');
  box.innerHTML = '';
  keys.forEach(k => {
    const P = PARAMS[k], lab = document.createElement('label');
    lab.textContent = t(P.label);
    if (P.seg) {
      const w = document.createElement('div');
      w.className = 'seg'; w.dataset.seg = k;
      P.opts().forEach(([v, txt]) => {
        const b = document.createElement('button');
        b.type = 'button'; b.textContent = txt; b.dataset.v = String(v);
        b.onclick = () => onCfg({ dataset: { cfg: k }, value: String(v) });
        w.append(b);
      });
      box.append(lab, w);
    } else {
      const el = document.createElement(P.opts ? 'select' : 'input');
      el.dataset.cfg = k;
      if (!P.opts) { el.type = 'number'; el.step = P.num[0]; el.min = P.num[1]; }
      if (P.range) {                                   // Schieberegler und Zahl nebeneinander, beide stellen denselben Wert
        const w = document.createElement('div'), r = document.createElement('input');
        w.className = 'rng'; r.type = 'range'; r.dataset.cfg = k; r.min = P.range[0]; r.max = P.range[1]; r.step = P.num[0];
        w.append(r, el); box.append(lab, w);
      } else box.append(lab, el);
    }
    if (P.hint) { const h = document.createElement('div'); h.className = 'hint'; h.dataset.hint = k; box.append(h); }
  });
  renderCfg();
}
function renderCfg() {
  const prof = (sel, list, val) => {
    sel.innerHTML = '';
    sel.add(new Option(t('manual'), ''));
    list.forEach(p => sel.add(new Option(p.name, p.name)));
    sel.value = val;
  };
  prof($('cfVehicle'), profiles.vehicles, cfg.vehicle);
  prof($('cfTool'), profiles.tools, cfg.tool);
  prof($('cfSprayer'), profiles.tools, cfg.sprayer);
  $('cfVehicle').disabled = !profiles.vehicles.length; $('cfTool').disabled = $('cfSprayer').disabled = !profiles.tools.length;
  const list = plane ? smallTracks() : [], has = i => list.some(x => x.i === i);
  if (!has(cfg.tramTrack)) cfg.tramTrack = has(hiTrack) ? hiTrack : list.length ? list[0].i : -1;
  if (!has(cfg.tramTrack2) || cfg.tramTrack2 === cfg.tramTrack) { const o = list.find(x => x.i !== cfg.tramTrack); cfg.tramTrack2 = o ? o.i : -1; }
  document.querySelectorAll('[data-cfg]').forEach(el => {
    const k = el.dataset.cfg, P = PARAMS[k];
    if (P && P.opts) {
      el.innerHTML = '';
      P.opts().forEach(([v, txt]) => el.add(new Option(txt, String(v))));
      el.value = String(cfg[k]);
      return;
    }
    if (k === 'hdWidths') el.disabled = !cfg.tool;
    if (k === 'vehicle' || k === 'tool' || k === 'sprayer' || document.activeElement === el) return;
    el.value = String(cfg[k]);
  });
  document.querySelectorAll('[data-seg]').forEach(w => w.querySelectorAll('button').forEach(b => b.classList.toggle('on', b.dataset.v === String(cfg[w.dataset.seg]))));
  document.querySelectorAll('[data-hint]').forEach(el => { el.textContent = PARAMS[el.dataset.hint].hint(); });
  $('cfToolInfo').textContent = cfg.tool ? t('toolInfoS', fmtNum(cfg.toolWidth - cfg.overlap, 2)) : '';
  document.querySelectorAll('.cfNoProf').forEach(el => { el.style.display = aogRoot ? 'none' : ''; });
  ['btnHdAround', 'btnHdSlice', 'btnTramRing'].forEach(id => { $(id).disabled = !bnds[0]; });
  ['btnTram'].forEach(id => { $(id).disabled = !list.length; $(id).title = plane && !list.length ? t('needTrack') : ''; });
  const T = ex.tram, nT = T ? T.lines.length + (T.outer.length > 1 ? 1 : 0) : 0;
  $('btnTramMid').disabled = !(T && T.lines.length >= 2);
  $('btnTramDel').disabled = !nT;
  $('btnTramCut').disabled = !(ex.tram && ex.tram.lines.length);
  $('tramInfo').innerHTML = !plane ? '–' : t('tramHave', T ? T.lines.length : 0, T && T.outer.length > 1 ? t('yes') : t('no'));
}
const INT_KEYS = new Set(['autoKind', 'nR', 'nL', 'smoothW', 'smoothRound', 'passes', 'side', 'fillSide', 'hdWidths', 'nA', 'nB', 'withRing', 'ringCount', 'trim', 'fillLines', 'tramTrack', 'tramTrack2']);
const RERENDER = new Set(['fillLines', 'withRing', 'hdKind', 'impTarget', 'splitMode']);        // diese Umschalter ändern, welche Einstellungen gezeigt werden
function onCfg(el) {
  const k = el.dataset.cfg, v = el.value;
  if (k === 'vehicle') pickVehicle(v);
  else if (k === 'tool') pickTool(v);
  else if (k === 'sprayer') pickSprayer(v);
  else if (k === 'hdKind') cfg.hdKind = v;
  else {
    const x = parseFloat(v), P = PARAMS[k];
    if (!isFinite(x)) return;
    if (x < (P && P.num ? P.num[1] : k === 'side' || k === 'fillSide' ? -1 : 0)) return;
    cfg[k] = INT_KEYS.has(k) ? Math.round(x) : x;
    if (k === 'trackWidth') cfg.vehicle = '';
    if (k === 'tramWidth') { cfg.tramSet = true; cfg.sprayer = ''; }
    if (k === 'hdDist') cfg.hdWidths = 0;
    if (k === 'hdWidths') pickTool(cfg.tool, true);
  }
  saveCfg();
  if (tool && typeof tool.params === 'function' && RERENDER.has(k)) renderParams(tool.params()); else renderCfg();
  if (k === 'tramTrack' || k === 'tramTrack2' || k === 'fillLines') markRef();
  if (k === 'tramWidth' || k === 'trackWidth' || k === 'sprayer' || k === 'vehicle') drawLayer('tramw');   // Arbeitsbreite neu zeichnen
  if (tool && tool.recalc) tool.recalc();
}
document.addEventListener('input', e => { const el = e.target; if (el.dataset && el.dataset.cfg && el.tagName === 'INPUT') onCfg(el); });
document.addEventListener('change', e => { const el = e.target; if (el.dataset && el.dataset.cfg && el.tagName === 'SELECT') onCfg(el); });

function setHeadland(L) {
  const W = L.map(p => plane.inv(p.e, p.n)), H = L.map(p => p.h);
  ex.headland = W.length > 2 ? [W] : [];
  generated['Headland.txt'] = () => ['$Headland', String(W.length),
    ...W.map(([a, b], i) => { const p = plane.fwd(a, b); return r3(p.e) + ',' + r3(p.n) + ',' + r5(H[i]); }),
    ...bnds.slice(1).map(() => '0')].join('\r\n') + '\r\n';
  delete clearedFiles['Headland.txt'];
  unsaved = true; setLayer('headland', true); drawLayer('headland'); renderLayerList();
}
// Fahrgassen (in Längen-/Breitengrad) setzen und Tram.txt zum Speichern vormerken
function setTramData(T) {
  ex.tram = T;
  generated['Tram.txt'] = () => {
    const P = a => a.map(([la, lo]) => { const p = plane.fwd(la, lo); return r3(p.e) + ',' + r3(p.n); });
    const out = ['$Tram', String(T.outer.length), ...P(T.outer), String(T.inner.length), ...P(T.inner)];
    if (T.lines.length) { out.push(String(T.lines.length)); T.lines.forEach(l => out.push(String(l.length), ...P(l))); }
    return out.join('\r\n') + '\r\n';
  };
  delete clearedFiles['Tram.txt'];
  unsaved = true; setLayer('tram', true); drawLayer('tram'); drawLayer('tramw'); renderLayerList(); renderCfg();
}
// Fahrgassen übernehmen: lines = neue Fahrgassen (add: zu den vorhandenen, sonst ersetzen), ring = neue Randfahrgasse
function setTram({ lines, add, ring }) {
  const W = a => a.map(p => plane.inv(p.e, p.n)), old = ex.tram || { outer: [], inner: [], lines: [] };
  // eine neue Randfahrgasse ersetzt auch die alten weiteren Ringe (geschlossene Fahrgassen)
  const loop = l => { if (l.length < 4) return false; const a = plane.fwd(...l[0]), b = plane.fwd(...l[l.length - 1]); return dSq(a, b) < 4; };
  const base = ring ? old.lines.filter(l => !loop(l)) : old.lines;
  const T = { outer: ring ? W(ring.outer) : old.outer, inner: ring ? W(ring.inner) : old.inner, lines: base };
  if (lines) T.lines = (add ? base : []).concat(lines.map(W));
  if (ring && ring.extra) T.lines = T.lines.concat(ring.extra.map(W));
  setTramData(T);
}
