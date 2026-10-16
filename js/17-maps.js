// AOG Feldeditor – amtliche Luftbilder (Orthofotos) nach Land und eigene Karten

// Orthofotos: frei nutzbare Dienste der Vermessungsämter, meist 10–20 cm – schärfer als das weltweite Satellitenbild
const WMSL = (url, layers, attribution) => ({ wms: url, layers, attribution });
const ORTHO = [
  { id: 'at', c: 'cAT', name: 'basemap.at' },                                        // schon in js/02-map.js
  { id: 'ch', c: 'cCH', name: 'swisstopo', xyz: 'https://wmts.geo.admin.ch/1.0.0/ch.swisstopo.swissimage/default/current/3857/{z}/{x}/{y}.jpeg', attribution: '© swisstopo' },
  { c: 'cDE' },
  { id: 'de_by', name: 'Bayern', ...WMSL('https://geoservices.bayern.de/od/wms/dop/v1/dop20', 'by_dop20c', '© Bayerische Vermessungsverwaltung (CC BY 4.0)') },
  { id: 'de_bw', name: 'Baden-Württemberg', ...WMSL('https://owsproxy.lgl-bw.de/owsproxy/ows/WMS_LGL-BW_ATKIS_DOP_20_C', 'IMAGES_DOP_20_RGB', '© LGL BW (dl-de/by-2-0)') },
  { id: 'de_bb', name: 'Brandenburg / Berlin', ...WMSL('https://isk.geobasis-bb.de/mapproxy/dop20c/service/wms', 'bebb_dop20c', '© GeoBasis-DE/LGB (dl-de/by-2-0)') },
  { id: 'de_he', name: 'Hessen', ...WMSL('https://gds-srv.hessen.de/cgi-bin/lika-services/ogc-free-images.ows', 'he_dop_rgb', '© HVBG (dl-de/zero-2-0)') },
  { id: 'de_mv', name: 'Mecklenburg-Vorpommern', ...WMSL('https://www.geodaten-mv.de/dienste/adv_dop', 'mv_dop', '© GeoBasis-DE/M-V') },
  { id: 'de_ni', name: 'Niedersachsen', ...WMSL('https://opendata.lgln.niedersachsen.de/doorman/noauth/dop_wms', 'ni_dop20', '© LGLN (CC BY 4.0)') },
  { id: 'de_nw', name: 'Nordrhein-Westfalen', ...WMSL('https://www.wms.nrw.de/geobasis/wms_nw_dop', 'nw_dop_rgb', '© Geobasis NRW (dl-de/zero-2-0)') },
  { id: 'de_rp', name: 'Rheinland-Pfalz', ...WMSL('https://geo4.service24.rlp.de/wms/rp_dop20.fcgi', 'rp_dop20', '© GeoBasis-DE/LVermGeoRP (dl-de/by-2-0)') },
  { id: 'de_sn', name: 'Sachsen', ...WMSL('https://geodienste.sachsen.de/wms_geosn_dop-rgb/guest', 'sn_dop_020', '© GeoSN (dl-de/by-2-0)') },
  { id: 'de_st', name: 'Sachsen-Anhalt', ...WMSL('https://www.geodatenportal.sachsen-anhalt.de/wss/service/ST_LVermGeo_DOP_WMS_OpenData/guest', 'lsa_lvermgeo_dop20_2', '© GeoBasis-DE/LVermGeo ST (dl-de/by-2-0)') },
  { id: 'de_sh', name: 'Schleswig-Holstein', ...WMSL('https://dienste.gdi-sh.de/WMS_SH_DOP20col_OpenGBD', 'sh_dop20_rgb', '© GeoBasis-DE/LVermGeo SH (CC BY 4.0)') },
  { id: 'de_th', name: 'Thüringen', ...WMSL('https://www.geoproxy.geoportal-th.de/geoproxy/services/DOP', 'th_dop', '© GDI-Th (CC BY 4.0)') },
  { c: 'cMore' },
  { id: 'nl', c: 'cNL', name: 'PDOK', xyz: 'https://service.pdok.nl/hwh/luchtfotorgb/wmts/v1_0/Actueel_orthoHR/EPSG:3857/{z}/{x}/{y}.jpeg', attribution: '© Beeldmateriaal Nederland (PDOK)' },
  { id: 'fr', c: 'cFR', name: 'IGN', xyz: 'https://data.geopf.fr/wmts?SERVICE=WMTS&REQUEST=GetTile&VERSION=1.0.0&LAYER=ORTHOIMAGERY.ORTHOPHOTOS&STYLE=normal&FORMAT=image/jpeg&TILEMATRIXSET=PM&TILEMATRIX={z}&TILEROW={y}&TILECOL={x}', attribution: '© IGN' },
  { id: 'cz', c: 'cCZ', name: 'ČÚZK', ...WMSL('https://ags.cuzk.cz/arcgis1/services/ORTOFOTO/MapServer/WMSServer', '0', '© ČÚZK') },
  { id: 'pl', c: 'cPL', name: 'Geoportal', ...WMSL('https://mapy.geoportal.gov.pl/wss/service/PZGIK/ORTO/WMS/StandardResolution', 'Raster', '© GUGiK') }
];
ORTHO.forEach(o => {
  if (!o.id || bases[o.id]) return;
  bases[o.id] = o.wms ? L.tileLayer.wms(o.wms, { layers: o.layers, format: 'image/jpeg', maxZoom: 22, attribution: o.attribution })
    : L.tileLayer(o.xyz, { maxZoom: 22, maxNativeZoom: 19, attribution: o.attribution });
});
const orthoLabel = o => o.id && o.id.startsWith('de_') ? o.name : t(o.c);

// Knopf „Orthofoto“ im Ribbon: zeigt das zuletzt gewählte Land
let orthoKey = 'at';
try { const k = localStorage.getItem('aogOrtho'); if (k && bases[k]) orthoKey = k; } catch (e) { }
function updateOrthoBtn() {
  const btn = document.getElementById('btnOrtho');
  if (!btn) return;
  btn.dataset.base = orthoKey;
  const o = ORTHO.find(x => x.id === orthoKey), sp = btn.querySelector('span');
  sp.removeAttribute('data-i18n');
  sp.textContent = t('bmOrtho') + ' ' + (orthoKey === 'at' ? 'AT' : orthoKey.startsWith('de_') ? o.name : (orthoKey.toUpperCase()));
}
function chooseOrtho(k) { orthoKey = k; try { localStorage.setItem('aogOrtho', k); } catch (e) { } updateOrthoBtn(); setBase(k); }

// Eigene Karten: { id, name, type: 'xyz' | 'wms', url, layers, over: Ebene darüber? }
let customMaps = [];
try { customMaps = JSON.parse(localStorage.getItem('aogCustomMaps') || '[]'); } catch (e) { }
const saveCustom = () => { try { localStorage.setItem('aogCustomMaps', JSON.stringify(customMaps)); } catch (e) { } };
const customOver = {};                                           // eingeblendete eigene Ebenen
const customLayer = m => m.type === 'wms'
  ? L.tileLayer.wms(m.url, { layers: m.layers, format: 'image/png', transparent: !!m.over, maxZoom: 22, opacity: m.over ? .6 : 1, attribution: esc(m.name) })
  : L.tileLayer(m.url, { maxZoom: 22, maxNativeZoom: 20, opacity: m.over ? .6 : 1, attribution: esc(m.name) });
let overOn = new Set();
try { JSON.parse(localStorage.getItem('aogOverlays') || '[]').forEach(k => overOn.add(k)); } catch (e) { }
function registerCustom() {
  for (const k in bases) if (k.startsWith('c_') && !customMaps.some(m => 'c_' + m.id === k)) { map.removeLayer(bases[k]); delete bases[k]; }
  for (const k in customOver) if (!customMaps.some(m => 'c_' + m.id === k)) { map.removeLayer(customOver[k]); delete customOver[k]; overOn.delete(k); }
  customMaps.forEach(m => { const k = 'c_' + m.id; if (m.over) { if (!customOver[k]) customOver[k] = customLayer(m); } else if (!bases[k]) bases[k] = customLayer(m); });
}
function applyOverlays() {
  for (const k in customOver) { if (overOn.has(k)) customOver[k].addTo(map); else map.removeLayer(customOver[k]); }
  try { localStorage.setItem('aogOverlays', JSON.stringify([...overOn].filter(k => customOver[k]))); } catch (e) { }
}
registerCustom();
updateOrthoBtn();
try { const b = localStorage.getItem('aogBase'); if (b && bases[b]) setBase(b); } catch (e) { }
applyOverlays();

// Werkzeug „Weitere …“: Luftbild nach Land wählen, eigene Karte hinzufügen
function startMaps() {
  let form = { name: '', type: 'xyz', url: '', layers: '', over: false };
  const cur = () => { for (const k in bases) if (map.hasLayer(bases[k])) return k; return 'esri'; };
  const row = (label, on, fn, del, sub) => {
    const r = document.createElement('div'); r.className = 'lrow';
    const b = document.createElement('button'); b.type = 'button'; b.className = 'lbtn' + (on ? ' on' : '');
    if (sub) b.style.paddingLeft = '18px';
    b.innerHTML = `<svg class="ic"><use href="#i-${on ? 'chk' : 'chkoff'}"/></svg>`; b.append(label); b.onclick = fn;
    r.append(b); if (del) r.append(iconBtn('trash', t('delTitle'), del));
    return r;
  };
  const head = txt => { const h = document.createElement('div'); h.className = 'muted'; h.style.margin = '8px 0 2px'; h.textContent = txt; return h; };
  const list = () => {
    const box = $('toolList'); box.innerHTML = '';
    const c = cur(), delCustom = m => () => { customMaps = customMaps.filter(x => x !== m); saveCustom(); if (cur() === 'c_' + m.id) setBase('esri'); registerCustom(); applyOverlays(); list(); };
    box.append(head(t('mapsWorld')));
    box.append(row(t('bmEsri'), c === 'esri', () => { setBase('esri'); list(); }), row('OpenStreetMap', c === 'osm', () => { setBase('osm'); list(); }));
    box.append(head(t('mapsOrtho')));
    ORTHO.forEach(o => {
      if (!o.id) { if (o.c !== 'cMore') { const h = head(t(o.c)); h.style.margin = '4px 0 0'; box.append(h); } return; }
      box.append(row(orthoLabel(o) + (o.id.startsWith('de_') ? '' : ' (' + o.name + ')'), c === o.id, () => { chooseOrtho(o.id); list(); }, null, o.id.startsWith('de_')));
    });
    if (customMaps.length) {
      box.append(head(t('mapsCustom')));
      customMaps.forEach(m => { const k = 'c_' + m.id; box.append(m.over ? row(m.name + ' ' + t('mapsOnTop'), overOn.has(k), () => { overOn.has(k) ? overOn.delete(k) : overOn.add(k); applyOverlays(); list(); }, delCustom(m)) : row(m.name, c === k, () => { setBase(k); list(); }, delCustom(m))); });
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
      if (m.over) { overOn.add('c_' + m.id); applyOverlays(); } else setBase('c_' + m.id);
      form = { name: '', type: 'xyz', url: '', layers: '', over: false }; list();
      setStatus(t('mapsAdded', m.name), 'ok');
    };
    box.append(add);
  };
  startTool({ title: 'btnMaps', params: [], hideOk: true, cancelLabel: 'done', msgHtml: true, msg: () => t('mapsHint') });
  list();
}
$('btnMaps').onclick = startMaps;
