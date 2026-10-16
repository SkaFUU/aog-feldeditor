// AOG Feldeditor – Register, Seitenleisten, Anzeige, Bedienelemente, Sprache

// --- Ribbon: Register umschalten, Feldliste und Seitenleiste ein-/ausblenden (wird gemerkt) ---
function applyUi() {
  if (!document.querySelector(`.rpanel[data-tab="${ui.tab}"]`)) ui.tab = 'feld';
  document.querySelectorAll('#tabs [data-tab]').forEach(b => b.classList.toggle('on', b.dataset.tab === ui.tab));
  document.querySelectorAll('.rpanel').forEach(p => p.classList.toggle('on', p.dataset.tab === ui.tab));
  document.querySelectorAll('.pp').forEach(p => p.classList.toggle('on', p.dataset.tab === ui.tab));
  const hasProps = !!document.querySelector(`.pp[data-tab="${ui.tab}"]`);
  $('nav').classList.toggle('hide', !ui.nav);
  $('navGrip').classList.toggle('hide', !ui.nav);
  if (ui.navW) $('nav').style.width = ui.navW + 'px';
  $('props').classList.toggle('hide', !ui.props || !hasProps);
  $('propsGrip').classList.toggle('hide', !ui.props || !hasProps);
  if (ui.propsW) $('props').style.width = ui.propsW + 'px';
  $('togNav').textContent = ui.nav ? '‹' : '›';             // Pfeile an den Kartenrändern
  $('togProps').textContent = ui.props ? '›' : '‹';
  $('togProps').style.display = hasProps ? '' : 'none';
  try { localStorage.setItem('aogUi', JSON.stringify(ui)); } catch (e) { }
  map.invalidateSize();
}
// Register anwählen blendet seine Ebenen ein (Fahnen, Spuren, Vorgewende, Fahrgassen)
function showTab(tab) {
  if (ui.tab !== tab) {
    closeTool(); if (mode) setMode(mode);                 // Werkzeuge gehören zum Register
    sel = -1; selFlag = -1;
    ui.tab = tab; applyUi();
    if (hiTrack >= 0) { hiTrack = -1; drawLayer('tracks'); markTrackRows(); }
    refreshTrackHits();
    if (plane) {
      drawMarkers(); drawFlags(); updateInfo(); markRef();
      if (hitLayer) { if (tab === 'grenze') hitLayer.addTo(map); else map.removeLayer(hitLayer); }
    }
  }
  if (!plane) return;
  let ch = false;
  // (die Arbeitsbreite bleibt, wie man sie eingestellt hat)
  for (const id in LAYER_TAB) if (LAYER_TAB[id] === tab && id !== 'tramw' && !layerOn[id] && (exCount(id) || id === 'flags')) { setLayer(id, true); ch = true; }
  if (ch) renderLayerList();
}
document.querySelectorAll('#tabs [data-tab]').forEach(b => { b.onclick = () => showTab(b.dataset.tab); });
$('togNav').onclick = () => { ui.nav = !ui.nav; applyUi(); };
// Leisten breiter/schmaler ziehen: rechts 280–700 px, links (Feldliste) 180–600 px
function gripDrag(gripId, paneId, key, min, max, fromRight) {
  $(gripId).addEventListener('pointerdown', e => {
    const grip = $(gripId), box = $('main').getBoundingClientRect();
    grip.setPointerCapture(e.pointerId); grip.classList.add('drag');
    const move = ev => { ui[key] = Math.round(Math.max(min, Math.min(max, fromRight ? box.right - ev.clientX : ev.clientX - box.left))); $(paneId).style.width = ui[key] + 'px'; map.invalidateSize(); };
    const up = () => { grip.classList.remove('drag'); grip.removeEventListener('pointermove', move); grip.removeEventListener('pointerup', up); applyUi(); };
    grip.addEventListener('pointermove', move); grip.addEventListener('pointerup', up);
  });
}
gripDrag('propsGrip', 'props', 'propsW', 280, 700, true);
gripDrag('navGrip', 'nav', 'navW', 180, 600, false);
$('togProps').onclick = () => { ui.props = !ui.props; applyUi(); };
applyUi();

// Titel oben: Feldname, Punkt = ungespeicherte Änderungen
function updateTitle() {
  const name = newFieldName || currentField, el = $('docTitle');
  el.innerHTML = '';
  el.append(t('title'));
  const f = document.createElement('span');
  f.className = 'fld';
  f.textContent = ' — ' + (name || (plane ? '' : t('noField')));
  if (name || !plane) el.append(f);
  if (unsaved) { const d = document.createElement('span'); d.className = 'dot'; d.textContent = ' ●'; el.append(d); }
}
setInterval(updateTitle, 400);

$('btnNewField').onclick = newField;
$('btnBndCurve').onclick = makeBoundaryTracks;

// ---------- Anzeige ----------
function updateInfo() {
  const b = bnds[active], el = document.getElementById('info');
  if (!b) el.textContent = !plane ? '–' : bnds.length ? t('noActive') : t('noBoundary');
  else {
    let h = t('infoPts', b.pts.length, fmtNum(area(b.pts) / 10000, 3));
    if (sel >= 0 && b.pts[sel]) { const [la, lo] = plane.inv(b.pts[sel].e, b.pts[sel].n); h += '<br>' + t('infoPoint', sel, la.toFixed(7) + ', ' + lo.toFixed(7)); }
    el.innerHTML = h;
  }
  document.getElementById('btnDel').disabled = sel < 0;
  document.getElementById('btnUndo').disabled = !undo.length;
  ['btnNewOuter', 'btnNewAB'].forEach(id => { document.getElementById(id).disabled = !plane; });
  document.getElementById('btnBndCurve').disabled = !bnds[0];
  document.getElementById('btnNewInner').disabled = !bnds[0];
  document.getElementById('btnExport').disabled = !plane;
  document.getElementById('btnDelField').disabled = !(rootHandle && dirHandle && currentField);
  ['btnSplit', 'btnCombine'].forEach(id => { document.getElementById(id).disabled = !(rootHandle && dirHandle && currentField && bnds[0]); });
  document.getElementById('btnBndCov').disabled = !(plane && ex.sections && ex.sections.patches.length);
  document.getElementById('btnBndCov').title = plane && !(ex.sections && ex.sections.patches.length) ? t('needCoverage') : '';
  document.getElementById('btnSimp').disabled = !bnds[active];
  document.getElementById('btnOriginCenter').disabled = !bnds[0];
  ['btnHdAround', 'btnHdSlice'].forEach(id => { document.getElementById(id).disabled = !bnds[0]; });

  renderFlagList();

  const oi = document.getElementById('originInfo');
  if (!plane) { oi.textContent = '–'; return; }
  let h = `${plane.lat0.toFixed(7)}, ${plane.lon0.toFixed(7)}`;
  if (bnds[0]) {
    let far = 0;
    bnds[0].pts.forEach(p => { const [a, c] = plane.inv(p.e, p.n); far = Math.max(far, distM(plane.lat0, plane.lon0, a, c)); });
    const cen = centroid(bnds[0].pts), [ca, co] = plane.inv(cen.e, cen.n);
    h += '<br>' + t('distCenter', distM(plane.lat0, plane.lon0, ca, co).toFixed(0));
    h += '<br>' + t('farthest', far.toFixed(0));
    if (far > 500) h += '<br><span class="warn">' + t('outside500') + '</span>';
  }
  if (originChanged()) h += '<br><span class="warn">' + t('movedBy', distM(diskPlane.lat0, diskPlane.lon0, plane.lat0, plane.lon0).toFixed(0)) + '</span>';
  oi.innerHTML = h;
}

function setStatus(msg, cls) { const s = document.getElementById('status'); s.textContent = msg; s.className = cls || ''; }

// ---------- Bedienelemente ----------
document.getElementById('btnDel').onclick = () => deletePoint(sel);
document.getElementById('btnUndo').onclick = doUndo;
document.getElementById('btnSimp').onclick = () => {
  const b = bnds[active];
  if (!b) return;
  startTool({
    title: 'btnSimp', params: ['simpTol'], res: null,
    msg: () => !tool.res ? t('tolTooBig') : t('simpMsg', b.pts.length, tool.res.length),
    recalc() { const r = cfg.simpTol > 0 ? simplifyRing(b.pts, cfg.simpTol) : b.pts; this.res = r.length >= 3 ? r : null; redrawTool(); },
    draw: g => { if (tool.res) { prevLine(g, tool.res, '#ffd400', true); tool.res.forEach(p => L.circleMarker(ll(p), { renderer: cv, radius: 3, color: '#000', weight: 1, fillColor: '#ffd400', fillOpacity: 1, interactive: false }).addTo(g)); } },
    okEnabled: () => !!tool.res,
    ok() { pushUndo(); const before = b.pts.length; b.pts = this.res; sel = -1; changed(b); drawAll(); setStatus(t('reduced', before, this.res.length), 'ok'); }
  });
  tool.recalc();
};
document.getElementById('btnAddFlag').onclick = () => startTool({
  title: 'btnAddFlag', params: [], hideOk: true, cancelLabel: 'done', msg: () => t('flagPickMsg'),
  onClick: p => {
    const id = flags.reduce((m, f) => Math.max(m, f.id || 0), 0) + 1;
    flags.push({ lat: p.lat, lon: p.lng, heading: 0, color: 0, id, notes: '' });
    selFlag = flags.length - 1; sel = -1; flagsDirty = unsaved = true;
    if (!layerOn.flags) setLayer('flags', true);
    drawFlags(); updateInfo(); renderLayerList();
  }
});
document.getElementById('btnFit').onclick = fitField;          // wie beim Öffnen des Feldes
document.getElementById('btnOriginClick').onclick = startOriginPick;
document.getElementById('btnOriginCenter').onclick = () => {
  const c = centroid(bnds[0].pts), [la, lo] = plane.inv(c.e, c.n);
  askOrigin(la, lo);
};
document.getElementById('btnOriginReset').onclick = () => {
  if (originChanged()) { setOrigin(diskPlane.lat0, diskPlane.lon0); setStatus(t('originReset'), 'ok'); }
};
// --- Fahnen als Liste: alle Fahnen, die gewählte aufgeklappt mit Farbe, Notiz, Löschen ---
function deleteFlag(i) {
  if (!flags[i]) return;
  flags.splice(i, 1); selFlag = -1; flagsDirty = unsaved = true;
  drawFlags(); updateInfo(); renderLayerList();
}
function selectFlag(i) {
  selFlag = selFlag === i ? -1 : i; sel = -1;
  const f = flags[selFlag];
  if (f && !map.getBounds().pad(-0.1).contains([f.lat, f.lon])) map.panTo([f.lat, f.lon]);
  drawFlags(); drawMarkers(); updateInfo();
}
function renderFlagList(force) {
  const box = $('flagList'), act = document.activeElement;
  if (!force && act && box.contains(act) && act.tagName === 'INPUT') return;      // beim Tippen der Notiz nicht neu aufbauen
  box.innerHTML = '';
  if (!flags.length) { box.className = 'muted'; box.textContent = plane ? t('noFlags') : '–'; return; }
  box.className = '';
  flags.forEach((f, i) => {
    const wrap = document.createElement('div'), row = document.createElement('div'), ic = document.createElement('span'), nm = document.createElement('span');
    wrap.className = 'flagrow' + (i === selFlag ? ' on' : '');
    row.className = 'bndrow';
    row.onclick = () => selectFlag(i);
    ic.className = 'fic'; ic.style.background = FLAG_COLORS[f.color] || FLAG_COLORS[0];
    nm.className = 'nm';
    nm.append(t('flagTip', i + 1));
    if (f.notes) { const n = document.createElement('i'); n.textContent = ' · ' + f.notes; nm.append(n); }
    row.append(ic, nm,
      iconBtn('target', t('flagZoom'), () => { map.setView([f.lat, f.lon], Math.max(map.getZoom(), 18)); if (selFlag !== i) selectFlag(i); }),
      iconBtn('trash', t('delTitle'), () => deleteFlag(i)));
    wrap.append(row);
    if (i === selFlag) {
      const det = document.createElement('div'), co = document.createElement('div'), sw = document.createElement('div'), note = document.createElement('input');
      det.className = 'fdet';
      co.className = 'coord'; co.textContent = f.lat.toFixed(7) + ', ' + f.lon.toFixed(7);
      sw.className = 'swatches';
      ['red', 'green', 'purple'].forEach((c, k) => {
        const b = document.createElement('button'), s = document.createElement('span');
        b.className = f.color === k ? 'on' : '';
        s.style.background = FLAG_COLORS[k];
        b.append(s, t(c));
        b.onclick = () => { f.color = k; flagsDirty = unsaved = true; drawFlags(); renderFlagList(); };
        sw.append(b);
      });
      note.placeholder = t('phNote'); note.value = f.notes || '';
      note.oninput = () => { f.notes = note.value.replace(/,/g, ' '); flagsDirty = unsaved = true; drawFlags(); };
      note.onchange = () => renderFlagList(true);
      det.append(co, sw, note);
      wrap.append(det);
    }
    box.append(wrap);
  });
}

document.addEventListener('keydown', e => {
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
  if (e.key === 'Delete' || e.key === 'Backspace') {
    e.preventDefault();
    if (selFlag >= 0) deleteFlag(selFlag);
    else if (sel >= 0) deletePoint(sel);
  }
  else if (e.key.toLowerCase() === 'z' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); if (tool && tool.onUndo) tool.onUndo(); else doUndo(); }
  else if (e.key === 'Escape') { closeTool(); setMode(''); sel = -1; selFlag = -1; drawMarkers(); drawFlags(); updateInfo(); }
});
window.addEventListener('beforeunload', e => { if (unsaved) { e.preventDefault(); e.returnValue = ''; } });

// ---------- Sprache anwenden (automatisch nach Browser, umschaltbar mit DE | EN) ----------
function applyLang(l) {
  if (l) { lang = l; try { localStorage.setItem('aogLang', l); } catch (e) { } }
  document.documentElement.lang = lang;
  document.title = t('title');
  document.querySelectorAll('[data-i18n]').forEach(el => { el.textContent = t(el.dataset.i18n); });
  document.querySelectorAll('[data-i18n-html]').forEach(el => { el.innerHTML = t(el.dataset.i18nHtml); });
  document.querySelectorAll('[data-i18n-ph]').forEach(el => { el.placeholder = t(el.dataset.i18nPh); });
  document.querySelectorAll('[data-i18n-title]').forEach(el => { el.title = t(el.dataset.i18nTitle); });
  updateTitle(); markTrackRows(); renderCfg(); if (tool) updateToolbox();
  document.querySelectorAll('[data-lang]').forEach(b => b.classList.toggle('on', b.dataset.lang === lang));
  if (rootLabel) showRoot(rootLabel);
  if (plane) { renderBndList(); updateInfo(); drawFlags(); drawMarkers(); renderLayerList(); renderNames(); drawLayer('headlines'); }
  if (typeof updateOrthoBtn === 'function') updateOrthoBtn();     // Knopf „Orthofoto …“ (js/17-maps.js)
}
document.querySelectorAll('[data-lang]').forEach(b => { b.onclick = () => applyLang(b.dataset.lang); });
applyLang();
