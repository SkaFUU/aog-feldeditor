// AOG Feldeditor – Export: KML, GeoJSON, Shapefile, ISOXML

// ---------- Export ----------
// Alles in WGS84 (Breite, Länge). Was gerade im Editor ist, wird exportiert – auch noch nicht Gespeichertes.
const EXP_LAYERS = ['bnd', 'tracks', 'headland', 'headlines', 'tram', 'flags', 'sections'];
const EXP_ISO = new Set(['bnd', 'tracks']);               // ISOXML: vorerst nur Grenze und Spuren
function exportItems() {
  const ring = b => b.pts.map(p => plane.inv(p.e, p.n)), out = {};
  out.bnd = bnds[0] ? [{ name: currentField || 'Feld', kind: 'boundary', rings: [ring(bnds[0])].concat(bnds.slice(1).map(ring)) }] : [];
  out.tracks = ex.tracks.filter(tr => !tr.deleted && (tr.mode === 2 || ((tr.mode === 4 || tr.mode === 32) && tr.pts.length > 1))).map(tr =>
    tr.mode === 2 ? { name: tr.name, kind: 'AB', pts: [wgs(tr.a[0], tr.a[1]), wgs(tr.b[0], tr.b[1])], heading: tr.heading } : { name: tr.name, kind: 'Curve', pts: tr.pts });
  out.headland = (ex.headland || []).map((r, i) => ({ name: t('L_headland') + (ex.headland.length > 1 ? ' ' + (i + 1) : ''), kind: 'headland', rings: [r] }));
  out.headlines = (ex.headlines || []).filter(h => !h.deleted && h.pts.length > 1).map(h => ({ name: h.name, kind: 'headline', pts: h.pts }));
  const T = ex.tram;
  out.tram = T ? [...(T.outer.length > 1 ? [{ name: t('expTramOuter'), kind: 'boundaryTram', pts: T.outer.concat([T.outer[0]]) }] : []),
    ...(T.inner.length > 1 ? [{ name: t('expTramInner'), kind: 'boundaryTram', pts: T.inner.concat([T.inner[0]]) }] : []),
    ...T.lines.map((l, i) => ({ name: t('L_tram') + ' ' + (i + 1), kind: 'tram', pts: l }))] : [];
  out.flags = flags.map(fl => ({ name: fl.notes || t('expFlag', fl.id), kind: 'flag', pt: [fl.lat, fl.lon], color: fl.color }));
  out.sections = ex.sections ? ex.sections.patches.map((p, i) => ({ name: String(i + 1), kind: 'coverage', rings: [p.ring] })) : [];
  return out;
}
const expLabel = id => id === 'bnd' ? t('expBnd') : t('L_' + id);
const xmlEsc = x => String(x).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]);
const closeRing = r => r.length && (r[0][0] !== r[r.length - 1][0] || r[0][1] !== r[r.length - 1][1]) ? r.concat([r[0]]) : r;
const llArea = r => { let a = 0; for (let i = 0; i < r.length - 1; i++) a += r[i][1] * r[i + 1][0] - r[i + 1][1] * r[i][0]; return a / 2; };   // > 0 = gegen den Uhrzeiger (x = Länge)
const orient = (r, ccw) => { r = closeRing(r); return (llArea(r) > 0) === ccw ? r : r.slice().reverse(); };

function toGeoJSON(items, sel) {
  const F = [], c = p => [+p[1].toFixed(9), +p[0].toFixed(9)];
  sel.forEach(id => items[id].forEach(it => {
    const props = { layer: id, name: it.name, type: it.kind };
    let g;
    if (it.rings) g = { type: 'Polygon', coordinates: it.rings.map((r, k) => orient(r, k === 0).map(c)) };
    else if (it.pt) g = { type: 'Point', coordinates: c(it.pt) };
    else g = { type: 'LineString', coordinates: it.pts.map(c) };
    F.push({ type: 'Feature', properties: props, geometry: g });
  }));
  return JSON.stringify({ type: 'FeatureCollection', name: currentField || 'Feld', features: F }, null, 1);
}
function toKML(items, sel) {
  const col = { bnd: 'ff3a3aff', tracks: 'ffd84fff', headland: 'ff00a5ff', headlines: 'ff00d4ff', tram: 'ffffff00', flags: 'ff0000ff', sections: '80a0971b' };
  const c = r => r.map(p => p[1].toFixed(9) + ',' + p[0].toFixed(9) + ',0').join(' ');
  let k = '<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>' + xmlEsc(currentField || 'Feld') + '</name>\n';
  sel.forEach(id => { k += `<Style id="${id}"><LineStyle><color>${col[id]}</color><width>${id === 'bnd' ? 3 : 2}</width></LineStyle><PolyStyle><color>${id === 'sections' ? col[id] : '00ffffff'}</color></PolyStyle></Style>\n`; });
  sel.forEach(id => {
    k += '<Folder><name>' + xmlEsc(expLabel(id)) + '</name>\n';
    items[id].forEach(it => {
      k += '<Placemark><name>' + xmlEsc(it.name) + '</name><styleUrl>#' + id + '</styleUrl>';
      if (it.rings) k += '<Polygon>' + it.rings.map((r, i) => (i ? '<innerBoundaryIs>' : '<outerBoundaryIs>') + '<LinearRing><coordinates>' + c(orient(r, i === 0)) + '</coordinates></LinearRing>' + (i ? '</innerBoundaryIs>' : '</outerBoundaryIs>')).join('') + '</Polygon>';
      else if (it.pt) k += '<Point><coordinates>' + c([it.pt]) + '</coordinates></Point>';
      else k += '<LineString><tessellate>1</tessellate><coordinates>' + c(it.pts) + '</coordinates></LineString>';
      k += '</Placemark>\n';
    });
    k += '</Folder>\n';
  });
  return k + '</Document></kml>\n';
}
// Shapefile: je Ebene .shp/.shx/.dbf/.prj/.cpg, alles in ein ZIP
const utf8 = x => new TextEncoder().encode(x);
function shpFiles(base, items, type) {     // type 1 = Punkt, 3 = Linie, 5 = Fläche
  const recs = items.map(it => {
    if (type === 1) return { parts: [], pts: [[it.pt[1], it.pt[0]]] };
    const parts = type === 5 ? it.rings.map((r, i) => orient(r, i !== 0)) : [it.pts];   // Shapefile: außen im Uhrzeigersinn
    return { parts, pts: parts.flat().map(p => [p[1], p[0]]) };
  });
  const bbox = P => P.reduce((b, p) => [Math.min(b[0], p[0]), Math.min(b[1], p[1]), Math.max(b[2], p[0]), Math.max(b[3], p[1])], [Infinity, Infinity, -Infinity, -Infinity]);
  const box = bbox(recs.map(r => bbox(r.pts)).flatMap(b => [[b[0], b[1]], [b[2], b[3]]]));
  const lens = recs.map(r => type === 1 ? 20 : 44 + 4 * r.parts.length + 16 * r.pts.length);
  const shpLen = 100 + lens.reduce((a, l) => a + 8 + l, 0), shp = new DataView(new ArrayBuffer(shpLen)), shx = new DataView(new ArrayBuffer(100 + 8 * recs.length));
  const head = (v, len) => { v.setInt32(0, 9994); v.setInt32(24, len / 2); v.setInt32(28, 1000, true); v.setInt32(32, type, true); box.forEach((x, i) => v.setFloat64(36 + 8 * i, x, true)); };
  head(shp, shpLen); head(shx, 100 + 8 * recs.length);
  let o = 100;
  recs.forEach((r, i) => {
    shx.setInt32(100 + 8 * i, o / 2); shx.setInt32(104 + 8 * i, lens[i] / 2);
    shp.setInt32(o, i + 1); shp.setInt32(o + 4, lens[i] / 2); o += 8;
    shp.setInt32(o, type, true); o += 4;
    if (type === 1) { shp.setFloat64(o, r.pts[0][0], true); shp.setFloat64(o + 8, r.pts[0][1], true); o += 16; return; }
    bbox(r.pts).forEach(x => { shp.setFloat64(o, x, true); o += 8; });
    shp.setInt32(o, r.parts.length, true); shp.setInt32(o + 4, r.pts.length, true); o += 8;
    let st = 0; r.parts.forEach(p => { shp.setInt32(o, st, true); o += 4; st += p.length; });
    r.pts.forEach(p => { shp.setFloat64(o, p[0], true); shp.setFloat64(o + 8, p[1], true); o += 16; });
  });
  // dBase: NAME (80) und TYPE (20), Texte UTF-8 (siehe .cpg)
  const fld = [['NAME', 80], ['TYPE', 20]], recLen = 1 + fld.reduce((a, x) => a + x[1], 0), hl = 32 + 32 * fld.length + 1;
  const dbf = new Uint8Array(hl + recLen * recs.length + 1), dv = new DataView(dbf.buffer), now = new Date();
  dbf[0] = 3; dbf[1] = now.getFullYear() - 1900; dbf[2] = now.getMonth() + 1; dbf[3] = now.getDate();
  dv.setUint32(4, recs.length, true); dv.setUint16(8, hl, true); dv.setUint16(10, recLen, true);
  fld.forEach(([nm, len], i) => { dbf.set(utf8(nm), 32 + 32 * i); dbf[32 + 32 * i + 11] = 67; dbf[32 + 32 * i + 16] = len; });
  dbf[hl - 1] = 0x0d;
  const fit = (txt, len) => { let b = utf8(''), x = ''; for (const ch of String(txt)) { const nb = utf8(x + ch); if (nb.length > len) break; x += ch; b = nb; } return b; };
  items.forEach((it, i) => {
    let o2 = hl + recLen * i; dbf[o2++] = 0x20;
    [it.name, it.kind].forEach((v, j) => { const b = fit(v, fld[j][1]); dbf.fill(0x20, o2, o2 + fld[j][1]); dbf.set(b, o2); o2 += fld[j][1]; });
  });
  dbf[dbf.length - 1] = 0x1a;
  const prj = 'GEOGCS["GCS_WGS_1984",DATUM["D_WGS_1984",SPHEROID["WGS_1984",6378137.0,298.257223563]],PRIMEM["Greenwich",0.0],UNIT["Degree",0.0174532925199433]]';
  return [[base + '.shp', new Uint8Array(shp.buffer)], [base + '.shx', new Uint8Array(shx.buffer)], [base + '.dbf', dbf], [base + '.prj', utf8(prj)], [base + '.cpg', utf8('UTF-8')]];
}
// ZIP ohne Kompression (Store)
const CRC = (() => { const T = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; T[n] = c >>> 0; } return b => { let c = 0xffffffff; for (let i = 0; i < b.length; i++) c = T[(c ^ b[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }; })();
function zip(files) {
  const parts = [], cen = []; let off = 0;
  const d = new Date(), dt = ((d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1)), dd = (((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate());
  files.forEach(([name, data]) => {
    const nm = utf8(name), crc = CRC(data), h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(6, 0x0800, true); h.setUint16(10, dt, true); h.setUint16(12, dd, true);
    h.setUint32(14, crc, true); h.setUint32(18, data.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
    parts.push(new Uint8Array(h.buffer), nm, data);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true); c.setUint16(12, dt, true); c.setUint16(14, dd, true);
    c.setUint32(16, crc, true); c.setUint32(20, data.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, off, true);
    cen.push(new Uint8Array(c.buffer), nm);
    off += 30 + nm.length + data.length;
  });
  const cl = cen.reduce((a, b) => a + b.length, 0), e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cl, true); e.setUint32(16, off, true);
  return new Blob([...parts, ...cen, new Uint8Array(e.buffer)], { type: 'application/zip' });
}
// ISOXML (ISO 11783-10, TASKDATA.XML Version 4): Schlag mit Grenze (PLN/LSG) und Spuren (GGP/GPN)
function toISOXML(items, sel) {
  const pnt = (p, type) => `<PNT A="${type}" C="${p[0].toFixed(9)}" D="${p[1].toFixed(9)}"/>`, name = xmlEsc(currentField || 'Feld');
  let x = '<?xml version="1.0" encoding="UTF-8"?>\n<ISO11783_TaskData VersionMajor="4" VersionMinor="2" ManagementSoftwareManufacturer="AOG Feldeditor" ManagementSoftwareVersion="2.0" DataTransferOrigin="1">\n';
  x += `<PFD A="PFD1" C="${name}" D="${bnds[0] ? Math.round(area(bnds[0].pts)) : 0}">\n`;
  if (sel.includes('bnd')) items.bnd.forEach(it => {
    x += `<PLN A="1" B="${name}">\n`;
    it.rings.forEach((r, i) => { x += `<LSG A="${i ? 2 : 1}">` + orient(r, true).map(p => pnt(p, 2)).join('') + '</LSG>\n'; });
    x += '</PLN>\n';
  });
  if (sel.includes('tracks')) items.tracks.forEach((tr, i) => {
    const P = tr.pts, ab = tr.kind === 'AB';
    x += `<GGP A="GGP${i + 1}" B="${xmlEsc(tr.name)}"><GPN A="GPN${i + 1}" B="${xmlEsc(tr.name)}" C="${ab ? 1 : 3}"><LSG A="5">`;
    x += P.map((p, k) => pnt(p, k === 0 ? 6 : k === P.length - 1 ? 7 : 9)).join('') + '</LSG></GPN></GGP>\n';
  });
  x += '</PFD>\n';
  x += `<TSK A="TSK1" B="${name}" E="PFD1" G="1"/>\n`;
  return x + '</ISO11783_TaskData>\n';
}
function download(blob, fname) {
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fname;
  document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}
function buildExport(fmt, sel) {
  const items = exportItems(), base = (currentField || 'Feld').replace(/[\\/:*?"<>|]/g, '_');
  sel = sel.filter(id => items[id].length && (fmt !== 3 || EXP_ISO.has(id)));
  if (fmt === 0) return [new Blob([toKML(items, sel)], { type: 'application/vnd.google-earth.kml+xml' }), base + '.kml'];
  if (fmt === 1) return [new Blob([toGeoJSON(items, sel)], { type: 'application/geo+json' }), base + '.geojson'];
  if (fmt === 2) {
    const SH = { bnd: 5, headland: 5, sections: 5, flags: 1 };
    return [zip(sel.flatMap(id => shpFiles(base + '_' + id, items[id], SH[id] || 3))), base + '_shp.zip'];
  }
  return [zip([['TASKDATA/TASKDATA.XML', utf8(toISOXML(items, sel))]]), base + '_ISOXML.zip'];
}
function startExport() {
  if (!plane) return;
  const items = exportItems(), on = new Set(EXP_LAYERS.filter(id => id !== 'sections' && items[id].length));
  const usable = id => items[id].length && (cfg.expFmt !== 3 || EXP_ISO.has(id));
  const chosen = () => EXP_LAYERS.filter(id => on.has(id) && usable(id));
  const list = () => {
    const box = $('toolList'); box.innerHTML = '';
    EXP_LAYERS.forEach(id => {
      const n = items[id].length, b = document.createElement('button'), ok = usable(id), chk = ok && on.has(id);
      b.className = 'lbtn' + (chk ? ' on' : ''); b.disabled = !ok; b.type = 'button';
      b.innerHTML = `<svg class="ic"><use href="#i-${chk ? 'chk' : 'chkoff'}"/></svg>`;
      b.append(expLabel(id) + (n ? ` (${n})` : ''));
      if (n && !ok) b.title = t('expIsoOnly');
      b.onclick = () => { on.has(id) ? on.delete(id) : on.add(id); list(); updateToolbox(); };
      box.append(b);
    });
  };
  startTool({
    title: 'btnExport', params: ['expFmt'], okLabel: 'expDownload', msgHtml: true,
    msg: () => t(['expKml', 'expGeo', 'expShp', 'expIso'][cfg.expFmt] || 'expKml') + (unsaved ? '<br>' + esc(t('expUnsaved')) : ''),
    recalc() { list(); updateToolbox(); },
    okEnabled: () => chosen().length > 0,
    ok() { const [blob, fname] = buildExport(cfg.expFmt, chosen()); download(blob, fname); setStatus(t('expDone', fname), 'ok'); }
  });
  tool.recalc();
}
$('btnExport').onclick = startExport;
