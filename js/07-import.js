// AOG Feldeditor – Import: KML/KMZ, GeoJSON, Shapefile, ISOXML, Koordinatensysteme

// ---------- Import ----------
// Alles wird zu Einträgen { kind: 'poly'|'line'|'point', name, rings|pts|pt, ab? } in WGS84 [Breite, Länge].
const impDec = (b, enc) => new TextDecoder(enc || 'utf-8').decode(b);
async function unzipAll(buf) {
  const u8 = new Uint8Array(buf), dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength), out = {};
  let e = u8.length - 22; while (e >= 0 && dv.getUint32(e, true) !== 0x06054b50) e--;
  if (e < 0) throw new Error(t('impBadZip'));
  let o = dv.getUint32(e + 16, true);
  for (let i = 0, n = dv.getUint16(e + 10, true); i < n; i++) {
    const method = dv.getUint16(o + 10, true), size = dv.getUint32(o + 20, true), nl = dv.getUint16(o + 28, true), xl = dv.getUint16(o + 30, true), cl = dv.getUint16(o + 32, true), lh = dv.getUint32(o + 42, true);
    const name = impDec(u8.subarray(o + 46, o + 46 + nl)); o += 46 + nl + xl + cl;
    if (name.endsWith('/')) continue;
    const st = lh + 30 + dv.getUint16(lh + 26, true) + dv.getUint16(lh + 28, true), data = u8.slice(st, st + size);
    out[name] = method === 0 ? data : method === 8 ? new Uint8Array(await new Response(new Blob([data]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer()) : null;
  }
  return out;
}
// --- Koordinatensysteme: GPS, UTM, Gauß-Krüger (MGI, DHDN), Lambert (MGI Austria = AMA/INVEKOS) ---
const ELL = { bessel: [6377397.155, 299.1528128], grs80: [6378137, 298.257222101], wgs84: [6378137, 298.257223563] };
const SHIFT = { mgi: [577.326, 90.129, 463.919, 5.137, 1.474, 5.297, 2.4232], dhdn: [598.1, 73.7, 418.2, 0.202, 0.045, -2.455, 6.7] };
const EPSG = {
  4326: { kind: 'geo' }, 4258: { kind: 'geo' },
  31287: { name: 'MGI / Austria Lambert', kind: 'lcc', ell: 'bessel', lat0: 47.5, lon0: 13 + 1 / 3, lat1: 49, lat2: 46, fe: 400000, fn: 400000, shift: SHIFT.mgi },
  3416: { name: 'ETRS89 / Austria Lambert', kind: 'lcc', ell: 'grs80', lat0: 47.5, lon0: 13 + 1 / 3, lat1: 49, lat2: 46, fe: 400000, fn: 400000 },
  31254: { name: 'MGI / Austria GK West', kind: 'tm', ell: 'bessel', lon0: 10 + 1 / 3, k0: 1, fe: 0, fn: -5000000, shift: SHIFT.mgi },
  31255: { name: 'MGI / Austria GK Central', kind: 'tm', ell: 'bessel', lon0: 13 + 1 / 3, k0: 1, fe: 0, fn: -5000000, shift: SHIFT.mgi },
  31256: { name: 'MGI / Austria GK East', kind: 'tm', ell: 'bessel', lon0: 16 + 1 / 3, k0: 1, fe: 0, fn: -5000000, shift: SHIFT.mgi },
  31467: { name: 'DHDN / GK 3', kind: 'tm', ell: 'bessel', lon0: 9, k0: 1, fe: 3500000, fn: 0, shift: SHIFT.dhdn },
  31468: { name: 'DHDN / GK 4', kind: 'tm', ell: 'bessel', lon0: 12, k0: 1, fe: 4500000, fn: 0, shift: SHIFT.dhdn }
};
[[25832, 9], [25833, 15], [32632, 9], [32633, 15], [32634, 21]].forEach(([c, l]) => { EPSG[c] = { name: (c < 30000 ? 'ETRS89' : 'WGS 84') + ' / UTM ' + (c % 100) + 'N', kind: 'tm', ell: c < 30000 ? 'grs80' : 'wgs84', lon0: l, k0: 0.9996, fe: 500000, fn: 0 }; });
// .prj (WKT) lesen: Projektion, Parameter, Ellipsoid, Datum
function crsFromWKT(w) {
  const num = re => { const m = w.match(re); return m ? parseFloat(m[1]) : undefined; }, P = {};
  [...w.matchAll(/PARAMETER\["([^"]+)",\s*([-+\d.eE]+)/gi)].forEach(m => { P[m[1].toLowerCase()] = parseFloat(m[2]); });
  const sph = w.match(/SPHEROID\["([^"]*)",\s*([\d.]+),\s*([\d.]+)/i), datum = (w.match(/DATUM\["([^"]*)"/i) || [])[1] || '';
  const name = (w.match(/^\s*\w+\["([^"]*)"/) || [])[1] || '', proj = (w.match(/PROJECTION\["([^"]*)"/i) || [])[1] || '';
  const c = { name, a: sph ? +sph[2] : 6378137, rf: sph ? +sph[3] : 298.257223563 };
  const tw = w.match(/TOWGS84\[([^\]]*)\]/i);
  if (tw) { const v = tw[1].split(',').map(Number); c.shift = v.length >= 7 ? v.slice(0, 7) : [v[0], v[1], v[2], 0, 0, 0, 0]; }
  else if (/MGI|Militar|Hermannskogel/i.test(datum)) c.shift = SHIFT.mgi;
  else if (/DHDN|Hauptdreiecksnetz|Potsdam/i.test(datum)) c.shift = SHIFT.dhdn;
  else if (!/WGS|ETRS|ETRF|European_Terrestrial|ITRF|GRS_?1980/i.test(datum + ' ' + (sph ? sph[1] : ''))) c.unknownDatum = datum || '?';
  if (!/^\s*PROJ/i.test(w)) return Object.assign(c, { kind: 'geo' });
  const units = [...w.matchAll(/UNIT\["[^"]*",\s*([\d.eE+-]+)/gi)], unit = units.length ? parseFloat(units[units.length - 1][1]) : 1;
  const g = k => P[k] !== undefined ? P[k] : 0;
  Object.assign(c, { unit, lat0: g('latitude_of_origin') || g('latitude_of_center'), lon0: g('central_meridian') || g('longitude_of_center'), k0: P.scale_factor !== undefined ? P.scale_factor : 1, fe: g('false_easting'), fn: g('false_northing') });
  if (/transverse_mercator|gauss/i.test(proj)) c.kind = 'tm';
  else if (/lambert_conformal_conic/i.test(proj)) { c.kind = 'lcc'; c.lat1 = P.standard_parallel_1; c.lat2 = P.standard_parallel_2; }
  else throw new Error(t('impBadCrs', proj || name));
  return c;
}
// liefert Funktion [x, y] → [Breite, Länge] in WGS84
function crsFn(c) {
  if (c.ell) { c.a = ELL[c.ell][0]; c.rf = ELL[c.ell][1]; }
  const a = c.a || 6378137, fl = c.rf ? 1 / c.rf : 0, e2 = fl * (2 - fl), e = Math.sqrt(e2), R = Math.PI / 180, u = c.unit || 1;
  let inv;                                                    // [x, y] → [φ, λ] (rad) auf dem eigenen Ellipsoid
  if (c.kind === 'geo') inv = ([x, y]) => [y * R, x * R];
  else if (c.kind === 'tm') {
    const e4 = e2 * e2, e6 = e4 * e2, ep2 = e2 / (1 - e2), k0 = c.k0 || 1, l0 = (c.lon0 || 0) * R;
    const M = p => a * ((1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256) * p - (3 * e2 / 8 + 3 * e4 / 32 + 45 * e6 / 1024) * Math.sin(2 * p) + (15 * e4 / 256 + 45 * e6 / 1024) * Math.sin(4 * p) - (35 * e6 / 3072) * Math.sin(6 * p));
    const M0 = M((c.lat0 || 0) * R), e1 = (1 - Math.sqrt(1 - e2)) / (1 + Math.sqrt(1 - e2));
    inv = ([x, y]) => {
      const mu = (M0 + (y * u - c.fn) / k0) / (a * (1 - e2 / 4 - 3 * e4 / 64 - 5 * e6 / 256));
      const p1 = mu + (3 * e1 / 2 - 27 * e1 ** 3 / 32) * Math.sin(2 * mu) + (21 * e1 ** 2 / 16 - 55 * e1 ** 4 / 32) * Math.sin(4 * mu) + (151 * e1 ** 3 / 96) * Math.sin(6 * mu) + (1097 * e1 ** 4 / 512) * Math.sin(8 * mu);
      const s1 = Math.sin(p1), c1 = Math.cos(p1), T = Math.tan(p1) ** 2, C = ep2 * c1 * c1, N = a / Math.sqrt(1 - e2 * s1 * s1), Rr = a * (1 - e2) / Math.pow(1 - e2 * s1 * s1, 1.5), Dd = (x * u - c.fe) / (N * k0);
      const p = p1 - (N * Math.tan(p1) / Rr) * (Dd ** 2 / 2 - (5 + 3 * T + 10 * C - 4 * C * C - 9 * ep2) * Dd ** 4 / 24 + (61 + 90 * T + 298 * C + 45 * T * T - 252 * ep2 - 3 * C * C) * Dd ** 6 / 720);
      const l = l0 + (Dd - (1 + 2 * T + C) * Dd ** 3 / 6 + (5 - 2 * C + 28 * T - 3 * C * C + 8 * ep2 + 24 * T * T) * Dd ** 5 / 120) / c1;
      return [p, l];
    };
  } else {                                                    // Lambert konform (1SP oder 2SP)
    const m = p => Math.cos(p) / Math.sqrt(1 - e2 * Math.sin(p) ** 2), tt = p => Math.tan(Math.PI / 4 - p / 2) / Math.pow((1 - e * Math.sin(p)) / (1 + e * Math.sin(p)), e / 2);
    const p0 = (c.lat0 || 0) * R, l0 = (c.lon0 || 0) * R, two = c.lat1 !== undefined && c.lat2 !== undefined;
    const p1 = two ? c.lat1 * R : p0, p2 = two ? c.lat2 * R : p0;
    const n = Math.abs(p1 - p2) > 1e-10 ? (Math.log(m(p1)) - Math.log(m(p2))) / (Math.log(tt(p1)) - Math.log(tt(p2))) : Math.sin(p1);
    const F = m(p1) / (n * Math.pow(tt(p1), n)), k = two ? 1 : (c.k0 || 1), r0 = a * F * Math.pow(tt(p0), n) * k;
    inv = ([x, y]) => {
      const dx = x * u - c.fe, dy = r0 - (y * u - c.fn), sg = Math.sign(n), r = sg * Math.hypot(dx, dy), th = Math.atan2(sg * dx, sg * dy), tv = Math.pow(r / (a * F * k), 1 / n);
      let p = Math.PI / 2 - 2 * Math.atan(tv);
      for (let i = 0; i < 8; i++) p = Math.PI / 2 - 2 * Math.atan(tv * Math.pow((1 - e * Math.sin(p)) / (1 + e * Math.sin(p)), e / 2));
      return [p, th / n + l0];
    };
  }
  if (!c.shift) return xy => { const [p, l] = inv(xy); return [p / R, l / R]; };
  // Datum: über kartesische Koordinaten mit 7 Parametern (Position Vector, wie proj „towgs84“) nach WGS84
  const [tx, ty, tz, rx, ry, rz, ds] = c.shift, sr = Math.PI / 180 / 3600, S = 1 + ds * 1e-6, X = rx * sr, Y = ry * sr, Z = rz * sr;
  const A = ELL.wgs84[0], f2 = 1 / ELL.wgs84[1], E2 = f2 * (2 - f2);
  return xy => {
    const [p, l] = inv(xy), N = a / Math.sqrt(1 - e2 * Math.sin(p) ** 2);
    const x0 = N * Math.cos(p) * Math.cos(l), y0 = N * Math.cos(p) * Math.sin(l), z0 = N * (1 - e2) * Math.sin(p);
    const x1 = tx + S * (x0 - Z * y0 + Y * z0), y1 = ty + S * (Z * x0 + y0 - X * z0), z1 = tz + S * (-Y * x0 + X * y0 + z0);
    const pr = Math.hypot(x1, y1); let q = Math.atan2(z1, pr * (1 - E2));
    for (let i = 0; i < 6; i++) { const Nn = A / Math.sqrt(1 - E2 * Math.sin(q) ** 2); q = Math.atan2(z1 + E2 * Nn * Math.sin(q), pr); }
    return [q / R, Math.atan2(y1, x1) / R];
  };
}
// --- Formate ---
// Ebene aus einem Namen (Ordner, Datei, „layer“): deutsch und englisch, die Reihenfolge zählt
function roleFromName(nm) {
  const x = String(nm || '').toLowerCase().replace(/[_\-]+/g, ' ').trim();
  if (!x) return '';
  if (EXP_LAYERS.includes(x)) return x;
  if (/vorgewende ?linie|headland ?line|headline/.test(x)) return 'headlines';
  if (/vorgewende|headland/.test(x)) return 'headland';
  if (/fahrgass|tram/.test(x)) return 'tram';
  if (/bearbeitet|coverage|section/.test(x)) return 'sections';
  if (/fahne|flag|markier|marker/.test(x)) return 'flags';
  if (/spur|track|ab ?linie|ab ?line|kurve|curve|guidance|leitlinie/.test(x)) return 'tracks';
  if (/grenze|boundary|feldgrenze|schlag|field/.test(x)) return 'bnd';
  return '';
}
// Geometrie passend zur Ebene: Fahrgassen sind Linien (Fläche = Randfahrgasse), Grenze/Vorgewende sind Flächen
function fitRole(it) {
  if (!it.role) return it;
  const closedLine = it.kind === 'line' && it.pts.length > 3 && Math.hypot(it.pts[0][0] - it.pts[it.pts.length - 1][0], it.pts[0][1] - it.pts[it.pts.length - 1][1]) < 2e-5;
  if (it.role === 'tram' && it.kind === 'poly') return it.rings.map(r => ({ kind: 'line', name: it.name, role: 'tram', pts: r.concat([r[0]]) }));
  if ((it.role === 'bnd' || it.role === 'headland') && it.kind === 'line') return closedLine ? { kind: 'poly', name: it.name, role: it.role, rings: [it.pts] } : Object.assign(it, { role: '' });
  if (it.role === 'flags' && it.kind !== 'point') it.role = '';
  if ((it.role === 'tracks' || it.role === 'headlines') && it.kind !== 'line') it.role = '';
  return it;
}
function impKML(txt) {
  const doc = new DOMParser().parseFromString(txt, 'application/xml'), out = [];
  if (doc.querySelector('parsererror')) throw new Error(t('impBadFile', 'KML'));
  const co = el => el ? el.textContent.trim().split(/\s+/).map(s => s.split(',').map(Number)).filter(v => isFinite(v[0]) && isFinite(v[1])).map(v => [v[1], v[0]]) : [];
  const kids = (el, tag) => [...el.getElementsByTagNameNS('*', tag)];
  kids(doc, 'Placemark').forEach(pm => {
    const nm = (pm.getElementsByTagNameNS('*', 'name')[0] || {}).textContent || '';
    const su = ((pm.getElementsByTagNameNS('*', 'styleUrl')[0] || {}).textContent || '').replace(/^.*#/, '');
    // Ebene: Stil aus unserem Export, sonst der Name des nächsten Ordners (z. B. in Google Earth angelegt)
    let role = EXP_LAYERS.includes(su) ? su : '';
    for (let p = pm.parentNode; !role && p && p.nodeType === 1; p = p.parentNode)
      if (p.localName === 'Folder') { const fn = [...p.children].find(c => c.localName === 'name'); role = roleFromName(fn && fn.textContent); }
    kids(pm, 'Polygon').forEach(pg => {
      const ob = kids(pg, 'outerBoundaryIs')[0], rings = [co(ob && kids(ob, 'coordinates')[0])];
      kids(pg, 'innerBoundaryIs').forEach(ib => rings.push(co(kids(ib, 'coordinates')[0])));
      out.push({ kind: 'poly', name: nm, rings, role });
    });
    kids(pm, 'LineString').forEach(ls => out.push({ kind: 'line', name: nm, pts: co(kids(ls, 'coordinates')[0]), role }));
    kids(pm, 'Point').forEach(pt => { const c = co(kids(pt, 'coordinates')[0])[0]; if (c) out.push({ kind: 'point', name: nm, pt: c, role }); });
  });
  return { items: out };
}
function impGeoJSON(txt) {
  const g = JSON.parse(txt), out = [];
  const code = g.crs && g.crs.properties && String(g.crs.properties.name || '').match(/(\d{4,5})$/);
  const c = code && +code[1] !== 4326 ? EPSG[+code[1]] : null;
  if (code && +code[1] !== 4326 && !c) throw new Error(t('impBadCrs', 'EPSG:' + code[1]));
  const T = c ? crsFn(Object.assign({}, c)) : v => [v[1], v[0]], conv = r => r.map(v => T(v));
  const nameOf = p => { if (!p) return ''; for (const k of Object.keys(p)) if (/^(name|bez|title|label)/i.test(k) && p[k] != null) return String(p[k]); return ''; };
  let role = '';
  const geom = (gm, nm) => {
    if (!gm) return;
    const C = gm.coordinates, n0 = out.length;
    if (gm.type === 'Polygon') out.push({ kind: 'poly', name: nm, rings: C.map(conv) });
    else if (gm.type === 'MultiPolygon') C.forEach(p => out.push({ kind: 'poly', name: nm, rings: p.map(conv) }));
    else if (gm.type === 'LineString') out.push({ kind: 'line', name: nm, pts: conv(C) });
    else if (gm.type === 'MultiLineString') C.forEach(l => out.push({ kind: 'line', name: nm, pts: conv(l) }));
    else if (gm.type === 'Point') out.push({ kind: 'point', name: nm, pt: T(C) });
    else if (gm.type === 'MultiPoint') C.forEach(p => out.push({ kind: 'point', name: nm, pt: T(p) }));
    else if (gm.type === 'GeometryCollection') gm.geometries.forEach(x => geom(x, nm));
    out.slice(n0).forEach(it => { if (!it.role) it.role = role; });
  };
  (g.type === 'FeatureCollection' ? g.features : g.type === 'Feature' ? [g] : [{ geometry: g }]).forEach(ft => {
    const ly = ft.properties && (ft.properties.layer || ft.properties.folder); role = roleFromName(ly);
    geom(ft.geometry, nameOf(ft.properties));
  });
  return { items: out, crs: c ? c.name : '' };
}
function impShp(shp, dbf, prj, cpg) {
  const dv = new DataView(shp.buffer, shp.byteOffset, shp.byteLength), recs = [];
  let c = null, T;
  if (prj) { c = crsFromWKT(prj); T = crsFn(c); }
  else {                                                      // ohne .prj: nur wenn es nach GPS-Koordinaten aussieht
    const x = dv.getFloat64(36, true), y = dv.getFloat64(44, true), X = dv.getFloat64(52, true), Y = dv.getFloat64(60, true);
    if (Math.max(Math.abs(x), Math.abs(X)) > 180 || Math.max(Math.abs(y), Math.abs(Y)) > 90) throw new Error(t('impNoPrj'));
    T = v => [v[1], v[0]];
  }
  for (let o = 100; o + 12 <= shp.length;) {
    const len = dv.getInt32(o + 4) * 2, st = dv.getInt32(o + 8, true), b = o + 8, pt = i => [dv.getFloat64(i, true), dv.getFloat64(i + 8, true)];
    let r = null;
    if ([1, 11, 21].includes(st)) r = { kind: 'point', pts: [pt(b + 4)] };
    else if ([8, 18, 28].includes(st)) { const n = dv.getInt32(b + 36, true); r = { kind: 'mpoint', pts: Array.from({ length: n }, (_, i) => pt(b + 40 + 16 * i)) }; }
    else if ([3, 13, 23, 5, 15, 25].includes(st)) {
      const np = dv.getInt32(b + 36, true), n = dv.getInt32(b + 40, true), p0 = b + 44 + 4 * np, parts = [];
      for (let k = 0; k < np; k++) { const s0 = dv.getInt32(b + 44 + 4 * k, true), s1 = k + 1 < np ? dv.getInt32(b + 48 + 4 * k, true) : n; parts.push(Array.from({ length: s1 - s0 }, (_, i) => pt(p0 + 16 * (s0 + i)))); }
      r = { kind: st % 10 === 5 ? 'poly' : 'line', parts };
    }
    recs.push(r); o += 8 + len;
  }
  // Namen aus der .dbf: erste Textspalte, bevorzugt eine mit „Name/Bezeichnung“
  let names = [];
  if (dbf) {
    const dd = new DataView(dbf.buffer, dbf.byteOffset, dbf.byteLength), n = dd.getUint32(4, true), hl = dd.getUint16(8, true), rl = dd.getUint16(10, true), F = [];
    for (let o = 32, off = 1; o < hl - 1 && dbf[o] !== 0x0d; o += 32) { const nm = impDec(dbf.subarray(o, o + 11)).replace(/\0.*$/, ''); F.push({ nm, type: String.fromCharCode(dbf[o + 11]), len: dbf[o + 16], off }); off += dbf[o + 16]; }
    const fld = F.find(x => x.type === 'C' && /name|bez|title|label/i.test(x.nm)) || F.find(x => x.type === 'C') || F[0];
    // Zeichensatz: laut .cpg; ohne .cpg UTF-8 versuchen, sonst Windows (z. B. eAMA-Export)
    let enc = cpg && /utf-?8/i.test(cpg) ? 'utf-8' : cpg && /1252|8859|latin/i.test(cpg) ? 'windows-1252' : '';
    if (!enc) try { new TextDecoder('utf-8', { fatal: true }).decode(dbf.subarray(hl)); enc = 'utf-8'; } catch (e) { enc = 'windows-1252'; }
    if (fld) for (let i = 0; i < n; i++) { const o = hl + rl * i + fld.off; names.push(impDec(dbf.subarray(o, o + fld.len), enc).replace(/\s+/g, ' ').trim()); }
  }
  const out = [], area2 = r => { let s = 0; for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1]; return s; };
  const inside = (q, r) => { let c2 = false; for (let i = 0, j = r.length - 1; i < r.length; j = i++) if ((r[i][1] > q[1]) !== (r[j][1] > q[1]) && q[0] < (r[j][0] - r[i][0]) * (q[1] - r[i][1]) / (r[j][1] - r[i][1]) + r[i][0]) c2 = !c2; return c2; };
  recs.forEach((r, i) => {
    if (!r) return;
    const nm = names[i] || String(i + 1);
    if (r.kind === 'point' || r.kind === 'mpoint') r.pts.forEach(p => out.push({ kind: 'point', name: nm, pt: T(p) }));
    else if (r.kind === 'line') r.parts.forEach(p => out.push({ kind: 'line', name: nm, pts: p.map(T) }));
    else {                                                    // Shapefile: außen im Uhrzeigersinn, Löcher dagegen
      const outer = r.parts.filter(p => area2(p) <= 0), holes = r.parts.filter(p => area2(p) > 0), polys = outer.map(p => [p]);
      holes.forEach(h => { const o2 = polys.find(pp => inside(h[0], pp[0])); if (o2) o2.push(h); else polys.push([h]); });
      polys.forEach(pp => out.push({ kind: 'poly', name: nm, rings: pp.map(p => p.map(T)) }));
    }
  });
  return { items: out, crs: c && (c.kind !== 'geo' || c.shift) ? c.name : '', warn: c && c.unknownDatum ? t('impDatum', c.unknownDatum) : '' };
}
function impISO(txt, more) {
  const P = s => new DOMParser().parseFromString(s, 'application/xml'), root = P(txt), docs = [root], out = [];
  [...root.getElementsByTagName('XFR')].forEach(x => { const f2 = more(x.getAttribute('A')); if (f2) docs.push(P(f2)); });
  const pts = el => [...el.getElementsByTagName('PNT')].map(p => [+p.getAttribute('C'), +p.getAttribute('D'), +p.getAttribute('A')]).filter(v => isFinite(v[0]) && isFinite(v[1]));
  docs.forEach(d => [...d.getElementsByTagName('PFD')].forEach(pf => {
    const fn2 = pf.getAttribute('C') || '';
    [...pf.getElementsByTagName('PLN')].forEach(pl => {
      const ty = +pl.getAttribute('A'), L2 = [...pl.getElementsByTagName('LSG')], o = L2.filter(l => l.getAttribute('A') === '1'), h = L2.filter(l => l.getAttribute('A') === '2');
      o.forEach(l => out.push({ kind: 'poly', name: pl.getAttribute('B') || fn2, rings: [pts(l)].concat(h.map(pts)).map(r => r.map(v => [v[0], v[1]])), off: ty !== 1, role: ty === 1 ? 'bnd' : ty === 10 ? 'headland' : '' }));
    });
    [...pf.getElementsByTagName('GPN')].forEach(gp => {
      const ty = +gp.getAttribute('C'), nm = gp.getAttribute('B') || '', L2 = [...gp.getElementsByTagName('LSG')][0], Q = L2 ? pts(L2) : [];
      if (ty === 1 && Q.length >= 2) out.push({ kind: 'line', ab: true, name: nm, pts: [Q[0], Q[Q.length - 1]].map(v => [v[0], v[1]]) });
      else if (ty === 2 && Q.length >= 1 && isFinite(+gp.getAttribute('G'))) {     // A+: Punkt und Richtung
        const h = +gp.getAttribute('G') * Math.PI / 180, la = Q[0][0], lo = Q[0][1], d = 100 / 111320;
        out.push({ kind: 'line', ab: true, name: nm, pts: [[la, lo], [la + d * Math.cos(h), lo + d * Math.sin(h) / Math.cos(la * Math.PI / 180)]] });
      } else if (ty === 3 && Q.length >= 2) out.push({ kind: 'line', name: nm, pts: Q.map(v => [v[0], v[1]]) });
    });
    [...pf.children].filter(c2 => c2.tagName === 'PNT' && c2.getAttribute('A') === '1').forEach(p => out.push({ kind: 'point', name: p.getAttribute('B') || '', pt: [+p.getAttribute('C'), +p.getAttribute('D')] }));
  }));
  return { items: out, crs: 'ISOXML' };
}
// Dateien (auch mehrere, auch ZIP) → Einträge
async function readImport(fileList) {
  const F = {};
  for (const f2 of fileList) {
    const b = new Uint8Array(await f2.arrayBuffer());
    if (/\.(zip|kmz)$/i.test(f2.name)) Object.assign(F, await unzipAll(b)); else F[f2.name] = b;
  }
  const keys = Object.keys(F).filter(k => F[k]), find = re => keys.filter(k => re.test(k)), base = k => k.replace(/\.[^.\/]+$/, '');
  const res = { items: [], crs: [], warn: [] }, add = r => { res.items.push(...r.items); if (r.crs) res.crs.push(r.crs); if (r.warn) res.warn.push(r.warn); };
  find(/\.kml$/i).forEach(k => add(impKML(impDec(F[k]))));
  find(/\.(geo)?json$/i).forEach(k => add(impGeoJSON(impDec(F[k]))));
  find(/\.shp$/i).forEach(k => {
    const bs = base(k), get = ext => { const m = keys.find(x => x.toLowerCase() === (bs + ext).toLowerCase()); return m ? F[m] : null; };
    const prj = get('.prj'), cpg = get('.cpg');
    const r = impShp(F[k], get('.dbf'), prj ? impDec(prj) : '', cpg ? impDec(cpg) : undefined), m = bs.match(/_(\w+)$/);
    const ro = m && EXP_LAYERS.includes(m[1]) ? m[1] : roleFromName(bs.replace(/^.*\//, ''));   // „…_tram.shp“ oder „Fahrgassen.shp“
    if (ro) r.items.forEach(it => { it.role = ro; });
    add(r);
  });
  find(/(^|\/)TASKDATA\.XML$/i).forEach(k => {
    const dir = k.replace(/[^\/]*$/, '');
    add(impISO(impDec(F[k]), nm => { const m = keys.find(x => x.toLowerCase() === (dir + nm + '.xml').toLowerCase()); return m ? impDec(F[m]) : null; }));
  });
  res.items = res.items.flatMap(it => fitRole(it));
  // die bearbeitete Fläche wird nicht importiert (die schreibt AOG beim Fahren)
  const nSec = res.items.filter(it => it.role === 'sections').length;
  if (nSec) { res.items = res.items.filter(it => it.role !== 'sections'); res.warn.push(t('impNoSections', nSec)); }
  // Ringe säubern: geschlossen-doppelten Endpunkt weg, mindestens 3 Punkte
  res.items = res.items.map(it => {
    if (it.kind !== 'poly') return it;
    const rings = it.rings.map(r => { r = r.filter(v => isFinite(v[0]) && isFinite(v[1])); if (r.length > 1 && r[0][0] === r[r.length - 1][0] && r[0][1] === r[r.length - 1][1]) r = r.slice(0, -1); return r; }).filter(r => r.length >= 3);
    return rings.length ? Object.assign(it, { rings }) : null;
  }).filter(it => it && (it.kind !== 'line' || it.pts.length >= 2));
  if (!res.items.length) throw new Error(keys.length ? t('impNothing') : t('impNoFiles'));
  return res;
}
// Werkzeug: Vorschau, Auswahl, Ziel (neues Feld / offenes Feld)
function startImport(res, fname) {
  const its = res.items, pl0 = (() => { const p = its[0].kind === 'poly' ? its[0].rings[0][0] : its[0].kind === 'line' ? its[0].pts[0] : its[0].pt; return Plane(p[0], p[1]); })();
  const haOf = it => { const r = it.rings[0].map(v => pl0.fwd(v[0], v[1])); return area(r) / 10000; };
  its.forEach(it => { it.on = its.length <= 20 && !it.off; if (it.kind === 'poly') it.ha = haOf(it); });
  if (!plane) cfg.impTarget = 0;
  let nameTouched = false, fieldName = (fname || '').replace(/\.[^.]+$/, '').replace(/[\\/:*?"<>|]/g, '').trim();
  const KL = { poly: 'impPoly', line: 'impLine', point: 'impPoint' };
  const chosen = k => its.filter(it => it.on && (!k || (k === 'bnd' ? isBndItem(it) : it.kind === k)));
  const list = () => {
    const box = $('toolList'); box.innerHTML = '';
    if (cfg.impTarget === 0) {
      // Name: solange nichts eingetippt wurde, der Name der größten gewählten Fläche (z. B. aus eAMA)
      const big = chosen('bnd').sort((x, y) => y.ha - x.ha)[0];
      if (!nameTouched && big && big.name && !/^\d+$/.test(big.name) && !roleFromName(big.name)) fieldName = big.name.replace(/[\\/:*?"<>|]/g, '').trim();
      const inp = document.createElement('input'); inp.placeholder = t('newFieldName'); inp.value = fieldName;
      inp.oninput = () => { fieldName = inp.value; nameTouched = true; updateToolbox(); };
      box.append(inp);
    }
    const sc = document.createElement('div'); sc.className = 'scrollList'; box.append(sc);   // lange Listen scrollen, Hinweis und Knöpfe bleiben sichtbar
    its.slice(0, 400).forEach(it => {
      const b = document.createElement('button');
      b.className = 'lbtn' + (it.on ? ' on' : ''); b.type = 'button';
      b.innerHTML = `<svg class="ic"><use href="#i-${it.on ? 'chk' : 'chkoff'}"/></svg>`;
      const tx = document.createElement('span'); tx.className = 'ell';
      tx.textContent = (it.role ? expLabel(it.role) : t(it.ab ? 'impAB' : KL[it.kind])) + (it.name && it.name !== expLabel(it.role) ? ' · ' + it.name : '') + (it.kind === 'poly' ? ` (${fmtNum(it.ha, 2)} ha)` : '');
      b.append(tx); b.title = tx.textContent;
      b.onclick = () => { const y = sc.scrollTop; it.on = !it.on; redrawTool(); const s2 = document.querySelector('#toolList .scrollList'); if (s2) s2.scrollTop = y; };
      sc.append(b);
    });
  };
  const bb = L.latLngBounds(its.flatMap(it => it.kind === 'poly' ? it.rings[0] : it.kind === 'line' ? it.pts : [it.pt]));
  map.fitBounds(bb, { padding: [40, 40], animate: false });
  startTool({
    title: 'btnImport', msgHtml: true, okLabel: 'apply',
    params: () => plane ? (cfg.impTarget === 1 ? ['impTarget', 'impPolyAs'] : ['impTarget']) : [],
    actions: () => [{ label: 'impAll', keep: true, run() { its.forEach(it => { it.on = true; }); redrawTool(); } }, { label: 'impNone', keep: true, run() { its.forEach(it => { it.on = false; }); redrawTool(); } }],
    msg: () => {
      const np = chosen('poly').length, h = [t('impCount', np, chosen('line').length, chosen('point').length)];
      if (res.crs.length) h.push(esc(t('impCrs', [...new Set(res.crs)].join(', '))));
      res.warn.forEach(w => h.push('<span class="warn">' + esc(w) + '</span>'));
      if (cfg.impTarget === 0) h.push(esc(t('impNewHint')));
      else if (cfg.impPolyAs === 0 && chosen('bnd').length) h.push(esc(t(bnds[0] ? 'impReplaceOuter' : 'impSetOuter')));
      if (cfg.impTarget === 1 && chosen().some(it => it.role === 'tram' || it.role === 'headland')) h.push(esc(t('impReplaceLayers')));
      if (its.length > 400) h.push(esc(t('impMany', its.length)));
      return h.join('<br>');
    },
    draw: g => {
      list();
      its.forEach(it => {
        const st = { color: it.on ? '#ffd400' : '#9aa0a6', weight: it.on ? 3 : 1.5, dashArray: it.on ? null : '5 5', fillOpacity: it.on ? .15 : .03, bubblingMouseEvents: false };
        const lyr = it.kind === 'poly' ? L.polygon(it.rings, st) : it.kind === 'line' ? L.polyline(it.pts, st) : L.circleMarker(it.pt, Object.assign(st, { radius: 6, fillOpacity: .9 }));
        lyr.on('click', () => { it.on = !it.on; redrawTool(); }).addTo(g);
      });
    },
    recalc() { redrawTool(); },
    okEnabled: () => chosen().length > 0 && (cfg.impTarget === 1 || (chosen('bnd').length > 0 && !!fieldName.trim())),
    ok() { cfg.impTarget === 0 ? importNewField(chosen(), fieldName) : importInto(chosen()); }
  });
}
// Größte Fläche = Außengrenze, ihre Löcher und Flächen darin = Innengrenzen
const isBndItem = it => it.kind === 'poly' && (!it.role || it.role === 'bnd');
function importBoundaries(items, asInner) {
  const P = items.filter(isBndItem).sort((x, y) => y.ha - x.ha), toB = r => ({ flagLines: ['False'], pts: r.map(v => plane.fwd(v[0], v[1])), orig: [], dirty: true });
  let skipped = 0;
  if (!P.length) return 0;
  if (asInner) { P.forEach(it => it.rings.forEach(r => bnds.push(toB(r)))); }
  else {
    const o = P[0], ob = toB(o.rings[0]);
    if (bnds[0]) bnds[0] = Object.assign(bnds[0], { pts: ob.pts, dirty: true }); else bnds.unshift(ob);
    o.rings.slice(1).forEach(r => bnds.push(toB(r)));
    P.slice(1).forEach(it => { if (inPoly(plane.fwd(it.rings[0][0][0], it.rings[0][0][1]), ob.pts)) bnds.push(toB(it.rings[0])); else skipped++; });
  }
  active = 0; sel = -1; bndListDirty = true; unsaved = true;
  return skipped;
}
function importRest(sel) {
  const lines = sel.filter(it => it.kind === 'line' && (!it.role || it.role === 'tracks')), pts = sel.filter(it => it.kind === 'point');
  // Vorgewende: größte Fläche, gleiche Umlaufrichtung wie die Grenze, Richtung je Punkt aus den Nachbarn
  const hd = sel.filter(it => it.kind === 'poly' && it.role === 'headland').sort((x, y) => y.ha - x.ha)[0];
  if (hd && bnds[0]) {
    let Q = hd.rings[0].map(v => plane.fwd(v[0], v[1]));
    if (Math.sign(fenceSignedArea(Q)) !== Math.sign(fenceSignedArea(bnds[0].pts))) Q = Q.reverse();
    const n = Q.length;
    setHeadland(Q.map((p, i) => { const a = Q[(i - 1 + n) % n], c = Q[(i + 1) % n]; return { e: p.e, n: p.n, h: normH(Math.atan2(c.e - a.e, c.n - a.n)) }; }));
  }
  // Vorgewende-Linien
  sel.filter(it => it.kind === 'line' && it.role === 'headlines').forEach(it => { ex.headlines.push({ name: it.name || t('L_headlines'), pts: it.pts.map(v => [v[0], v[1]]), show: it.pts.length > 3, isNew: true }); listDirty.headlines = true; unsaved = true; });
  // Fahrgassen: geschlossene Linien = Randfahrgasse (größte außen, nächste innen), offene = Fahrgassen
  const tl = sel.filter(it => it.kind === 'line' && it.role === 'tram');
  if (tl.length) {
    const closed = [], open = [];
    tl.forEach(it => { const a = plane.fwd(...it.pts[0]), b = plane.fwd(...it.pts[it.pts.length - 1]); (it.pts.length > 3 && dSq(a, b) < 4 ? closed : open).push(it.pts.map(v => [v[0], v[1]])); });
    const ar = r => area(r.map(v => plane.fwd(v[0], v[1])));
    closed.sort((x, y) => ar(y) - ar(x));
    const ring = r => r ? r.slice(0, -1) : [];
    setTramData({ outer: ring(closed[0]), inner: ring(closed[1]), lines: open.concat(closed.slice(2)) });
  }
  if (lines.length && tracksEditable()) lines.forEach(it => {
    const Q = it.pts.map(v => plane.fwd(v[0], v[1]));
    if (it.ab || Q.length === 2) {
      const a = toDisk(Q[0]), b = toDisk(Q[Q.length - 1]), heading = normH(Math.atan2(b.e - a.e, b.n - a.n));
      if (Math.hypot(b.e - a.e, b.n - a.n) >= 2) addTrack({ name: it.name || 'AB ' + degName(heading), mode: 2, heading, a: [a.e, a.n], b: [b.e, b.n], pts: [] });
    } else if (Q.length >= 3) addTrack(curveTrack(Q, it.name));
  });
  pts.forEach(it => { const id = flags.reduce((m, f2) => Math.max(m, f2.id || 0), 0) + 1; flags.push({ lat: it.pt[0], lon: it.pt[1], heading: 0, color: 0, id, notes: it.name || '' }); flagsDirty = unsaved = true; });
}
function importDone(skipped) {
  renderBndList(); drawAll(); drawFlags(); updateInfo(); renderLayerList(); renderNames();
  setStatus(t('impDone') + (skipped ? ' ' + t('impSkipped', skipped) : ''), 'ok');
}
function importInto(sel) {
  const sk = importBoundaries(sel, cfg.impPolyAs === 1);
  importRest(sel); importDone(sk);
}
function importNewField(sel, name) {
  if (window.showDirectoryPicker && !rootHandle) { setStatus(t('needRoot'), 'err'); return; }
  const go = () => {
    const o = sel.filter(isBndItem).sort((x, y) => y.ha - x.ha)[0];
    map.fitBounds(L.latLngBounds(o.rings[0]), { animate: false });   // vorläufiger Ursprung = Feldmitte
    createField(name, () => { const sk = importBoundaries(sel, false); importRest(sel); importDone(sk); fitField(); });
  };
  if (unsaved) askPanel('btnImport', t('discard'), go, 'discardYes'); else go();
}
async function importFiles(list) {
  if (!list || !list.length) return;
  try { setStatus(t('impBusy')); const res = await readImport([...list]); startImport(res, list[0].name); setStatus(''); }
  catch (err) { setStatus(t('impError', err.message), 'err'); }
}
const IMP_TYPES = () => [
  { description: t('impTypeAll'), accept: { 'application/x-aog-import': ['.kml', '.kmz', '.geojson', '.json', '.zip', '.shp', '.shx', '.dbf', '.prj', '.cpg', '.xml'] } },
  { description: 'KML / KMZ (Google Earth)', accept: { 'application/vnd.google-earth.kml+xml': ['.kml'], 'application/vnd.google-earth.kmz': ['.kmz'] } },
  { description: 'GeoJSON', accept: { 'application/geo+json': ['.geojson', '.json'] } },
  { description: t('impTypeShp'), accept: { 'application/x-shapefile': ['.shp', '.shx', '.dbf', '.prj', '.cpg', '.zip'] } },
  { description: t('impTypeIso'), accept: { 'application/xml': ['.xml', '.zip'] } }
];
$('btnImport').onclick = async () => {
  if (window.showOpenFilePicker) {
    try { const hs = await window.showOpenFilePicker({ id: 'aogImport', multiple: true, excludeAcceptAllOption: true, types: IMP_TYPES() }); importFiles(await Promise.all(hs.map(h => h.getFile()))); }
    catch (e) { if (e.name !== 'AbortError') setStatus(t('impError', e.message), 'err'); }
    return;
  }
  $('impFile').value = ''; $('impFile').click();                // ältere Browser: einfache Dateiauswahl
};
$('impFile').onchange = e => importFiles(e.target.files);
// Dateien einfach auf die Karte ziehen
$('mapwrap').addEventListener('dragover', e => { if (e.dataTransfer && [...e.dataTransfer.types].includes('Files')) e.preventDefault(); });
$('mapwrap').addEventListener('drop', e => { if (!e.dataTransfer || !e.dataTransfer.files.length) return; e.preventDefault(); importFiles(e.dataTransfer.files); });
