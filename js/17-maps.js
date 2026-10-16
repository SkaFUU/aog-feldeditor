// AOG Feldeditor – weitere Kartenhintergründe, Ebenen darüber (AMA-Feldstücke …) und eigene Karten

// Weitere Hintergründe (basemap.at, CC BY 4.0)
const BMAP = (layer, style, ext) => L.tileLayer(`https://mapsneu.wien.gv.at/basemap/${layer}/${style}/google3857/{z}/{y}/{x}.${ext}`, { maxZoom: 22, maxNativeZoom: 19, attribution: 'basemap.at' });
Object.assign(bases, { atgrau: BMAP('bmapgrau', 'normal', 'png'), atgel: BMAP('bmapgelaende', 'grau', 'jpeg'), atober: BMAP('bmapoberflaeche', 'grau', 'jpeg') });
const BASE_LABEL = { esri: 'bmEsri', at: 'bmAt', atgrau: 'bmAtGrau', atgel: 'bmAtGel', atober: 'bmAtOber', osm: 'OpenStreetMap' };

// Ebenen darüber: Straßen und Orte (basemap.at), AMA-Feldstücke und -Schläge (INVEKOS, AMA, CC BY 4.0)
const AMA_WMS = 'https://inspire.lfrz.gv.at/009501/wms';
let amaYear = '2026-1';                                        // wird beim ersten Einblenden auf den neuesten Jahrgang gesetzt
const amaLayer = kind => L.tileLayer.wms(AMA_WMS, { layers: `inspire_${kind}_${amaYear}${kind === 'schlaege' ? '_polygon' : ''}`, format: 'image/png', transparent: true, version: '1.3.0', opacity: .45, maxZoom: 22, attribution: 'INVEKOS © AMA (CC BY 4.0)' });
const overlays = {
  atlabel: { label: 'ovlAtLabel', make: () => L.tileLayer('https://mapsneu.wien.gv.at/basemap/bmapoverlay/normal/google3857/{z}/{y}/{x}.png', { maxZoom: 22, maxNativeZoom: 19, attribution: 'basemap.at' }) },
  amafs: { label: 'ovlAmaFs', make: () => amaLayer('feldstuecke') },
  amasl: { label: 'ovlAmaSl', make: () => amaLayer('schlaege') }
};
const ovlOn = new Set();
try { JSON.parse(localStorage.getItem('aogOverlays') || '[]').forEach(k => ovlOn.add(k)); } catch (e) { }

// Neuester AMA-Jahrgang: die Dienstbeschreibung darf der Browser nicht lesen (kein CORS), Kartenbilder schon –
// daher von neu nach alt je ein 1×1-Bild anfragen; der erste Jahrgang, der ein Bild liefert, wird genommen.
let amaChecked = false;
function checkAmaYear() {
  if (amaChecked) return;
  amaChecked = true;
  const y = new Date().getFullYear(), cand = [];
  for (let k = y + 1; k >= y - 1; k--) cand.push(k + '-2', k + '-1');
  const probe = i => {
    if (i >= cand.length) return;
    const img = new Image();
    img.onload = () => {
      if (cand[i] === amaYear) return;
      amaYear = cand[i];
      ['amafs', 'amasl'].forEach(k => { if (overlays[k].layer) { map.removeLayer(overlays[k].layer); overlays[k].layer = null; } });
      applyOverlays();
    };
    img.onerror = () => probe(i + 1);                            // unbekannter Layer: der Dienst schickt eine Fehlermeldung statt eines Bildes
    img.src = AMA_WMS + '?SERVICE=WMS&REQUEST=GetMap&VERSION=1.3.0&LAYERS=inspire_feldstuecke_' + cand[i] + '&STYLES=&CRS=EPSG:3857&BBOX=1823000,6128000,1823010,6128010&WIDTH=1&HEIGHT=1&FORMAT=image/png&EXCEPTIONS=XML';
  };
  probe(0);
}

// Eigene Karten: { id, name, type: 'xyz' | 'wms', url, layers, over: Ebene darüber? }
let customMaps = [];
try { customMaps = JSON.parse(localStorage.getItem('aogCustomMaps') || '[]'); } catch (e) { }
const saveCustom = () => { try { localStorage.setItem('aogCustomMaps', JSON.stringify(customMaps)); } catch (e) { } };
const customLayer = m => m.type === 'wms'
  ? L.tileLayer.wms(m.url, { layers: m.layers, format: 'image/png', transparent: !!m.over, maxZoom: 22, opacity: m.over ? .6 : 1, attribution: esc(m.name) })
  : L.tileLayer(m.url, { maxZoom: 22, maxNativeZoom: 20, opacity: m.over ? .6 : 1, attribution: esc(m.name) });
function registerCustom() {
  for (const k in bases) if (k.startsWith('c_') && !customMaps.some(m => 'c_' + m.id === k)) { map.removeLayer(bases[k]); delete bases[k]; }
  for (const k in overlays) if (k.startsWith('c_') && !customMaps.some(m => 'c_' + m.id === k)) { if (overlays[k].layer) map.removeLayer(overlays[k].layer); delete overlays[k]; ovlOn.delete(k); }
  customMaps.forEach(m => {
    const k = 'c_' + m.id;
    if (m.over) { if (!overlays[k]) overlays[k] = { name: m.name, make: () => customLayer(m) }; }
    else if (!bases[k]) bases[k] = customLayer(m);
  });
}
function applyOverlays() {
  for (const k in overlays) {
    const o = overlays[k], on = ovlOn.has(k);
    if (on && (k === 'amafs' || k === 'amasl')) checkAmaYear();
    if (on && !o.layer) o.layer = o.make();
    if (o.layer) { if (on) o.layer.addTo(map); else map.removeLayer(o.layer); }
  }
  try { localStorage.setItem('aogOverlays', JSON.stringify([...ovlOn])); } catch (e) { }
}
registerCustom();
try { const b = localStorage.getItem('aogBase'); if (b && bases[b]) setBase(b); } catch (e) { }
applyOverlays();

// Werkzeug „Weitere Karten“: Hintergrund wählen, Ebenen darüber, eigene Karte hinzufügen
function startMaps() {
  let form = { name: '', type: 'xyz', url: '', layers: '', over: false };
  const cur = () => { for (const k in bases) if (map.hasLayer(bases[k])) return k; return 'esri'; };
  const row = (label, on, fn, del) => {
    const r = document.createElement('div'); r.className = 'lrow';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lbtn' + (on ? ' on' : '');
    b.innerHTML = `<svg class="ic"><use href="#i-${on ? 'chk' : 'chkoff'}"/></svg>`; b.append(label); b.onclick = fn;
    r.append(b); if (del) r.append(iconBtn('trash', t('delTitle'), del));
    return r;
  };
  const head = txt => { const h = document.createElement('div'); h.className = 'muted'; h.style.margin = '8px 0 2px'; h.textContent = txt; return h; };
  const list = () => {
    const box = $('toolList'); box.innerHTML = '';
    const c = cur(), delCustom = m => () => { customMaps = customMaps.filter(x => x !== m); saveCustom(); if (cur() === 'c_' + m.id) setBase('esri'); registerCustom(); applyOverlays(); list(); };
    box.append(head(t('mapsBase')));
    for (const k in bases) {
      const m = k.startsWith('c_') ? customMaps.find(x => 'c_' + x.id === k) : null;
      box.append(row(m ? m.name : (BASE_LABEL[k] && BASE_LABEL[k].startsWith('bm') ? t(BASE_LABEL[k]) : BASE_LABEL[k] || k), k === c, () => { setBase(k); list(); }, m && delCustom(m)));
    }
    box.append(head(t('mapsOver')));
    for (const k in overlays) {
      const m = k.startsWith('c_') ? customMaps.find(x => 'c_' + x.id === k) : null;
      box.append(row(m ? m.name : t(overlays[k].label), ovlOn.has(k), () => { ovlOn.has(k) ? ovlOn.delete(k) : ovlOn.add(k); applyOverlays(); list(); }, m && delCustom(m)));
    }
    // eigene Karte hinzufügen
    box.append(head(t('mapsAdd')));
    const valid = () => !!form.name.trim() && /^https:\/\//i.test(form.url.trim()) && (form.type === 'xyz' ? /\{z\}/.test(form.url) : !!form.layers.trim());
    let add = null;
    const inp = (ph, key) => { const i = document.createElement('input'); i.placeholder = ph; i.value = form[key]; i.oninput = () => { form[key] = i.value; if (add) add.disabled = !valid(); }; return i; };
    const seg = (opts, key) => { const w = document.createElement('div'); w.className = 'seg'; opts.forEach(([v, txt]) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = txt; b.className = form[key] === v ? 'on' : ''; b.onclick = () => { form[key] = v; list(); }; w.append(b); }); return w; };
    box.append(inp(t('mapsName'), 'name'), seg([['xyz', t('mapsXyz')], ['wms', 'WMS']], 'type'), inp(form.type === 'wms' ? t('mapsWmsUrl') : t('mapsXyzUrl'), 'url'));
    if (form.type === 'wms') box.append(inp(t('mapsWmsLayers'), 'layers'));
    box.append(seg([[false, t('mapsAsBase')], [true, t('mapsAsOver')]], 'over'));
    add = document.createElement('button'); add.type = 'button'; add.className = 'primary'; add.textContent = t('mapsAddBtn');
    add.disabled = !valid();
    add.onclick = () => {
      const m = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: form.name.trim(), type: form.type, url: form.url.trim(), layers: form.layers.trim(), over: form.over };
      customMaps.push(m); saveCustom(); registerCustom();
      if (m.over) { ovlOn.add('c_' + m.id); applyOverlays(); } else setBase('c_' + m.id);
      form = { name: '', type: 'xyz', url: '', layers: '', over: false }; list();
      setStatus(t('mapsAdded', m.name), 'ok');
    };
    box.append(add);
  };
  startTool({ title: 'btnMaps', params: [], hideOk: true, cancelLabel: 'done', msgHtml: true, msg: () => t('mapsHint') });
  list();
}
$('btnMaps').onclick = startMaps;
