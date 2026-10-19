// AOG Feldeditor – Feld teilen und Felder kombinieren

// ---------- Feld teilen / kombinieren ----------
// Ein „Feld-Bauplan“: Name, Ringe (Breite/Länge, der erste ist außen), Spuren, Fahnen, Fahrgassen.
// Daraus wird ein neues Feld angelegt und gespeichert – über denselben Weg wie „Neues Feld“ + „Speichern“.
const llOf = p => plane.inv(p.e, p.n);
const tramGeoms = T => T ? T.lines.concat([T.outer, T.inner].filter(r => r.length > 2).map(r => r.concat([r[0]]))) : [];
const clipTram = (G, X) => G.map(l => l.map(v => plane.fwd(v[0], v[1]))).flatMap(l => clipToPoly(l, X)).filter(l => l.length > 1 && pathLen(l) > 1).map(l => l.map(llOf));
function fieldSpecFrom(name, ring, inners, tracks, flg, tram) {
  const X = polyIndex(ring);
  const tl = clipTram(tram || [], X);
  return { name, rings: [ring.map(llOf)].concat(inners.map(r => r.map(llOf))), tracks, flags: flg.filter(fl => X.inside(plane.fwd(fl.lat, fl.lon))).map(fl => ({ ...fl })), tram: tl };
}
// Spuren des offenen Feldes in Breite/Länge (AB-Linien und Kurven; Grenz-Kurven passen nach dem Teilen nicht mehr)
const tracksLL = (list, inv) => list.filter(tr => !tr.deleted && (tr.mode === 2 || tr.mode === 4)).map(tr => tr.mode === 2 ? { name: tr.name, mode: 2, aLL: inv(tr.a), bLL: inv(tr.b) } : { name: tr.name, mode: 4, heading: tr.heading, pts: tr.pts });
// Spuren nur an der Schnittlinie kürzen (P: Teil aus cutRing, erster und letzter Punkt = Enden der Schnittlinie).
// Was auf der Seite des Teils liegt, bleibt; am Schnittende 99 m gerade weiter wie beim Erzeugen, das andere Ende bleibt wie es war.
function fitTracks(list, P) {
  const c1 = P[0], c2 = P[P.length - 1], d = { e: c2.e - c1.e, n: c2.n - c1.n }, Ld = Math.hypot(d.e, d.n) || 1, u = { e: d.e / Ld, n: d.n / Ld };
  const s1 = { e: c1.e - u.e * 2, n: c1.n - u.n * 2 }, s2 = { e: c2.e + u.e * 2, n: c2.n + u.n * 2 };   // Schnittstrecke, je 2 m länger
  const side = q => Math.sign((q.e - c1.e) * d.n - (q.n - c1.n) * d.e), mine = side(centroid(P));
  const hit = (a, b) => {                                       // Schnittpunkt Strecke a–b mit der Schnittstrecke
    const r = { e: b.e - a.e, n: b.n - a.n }, w = { e: s2.e - s1.e, n: s2.n - s1.n }, den = r.e * w.n - r.n * w.e;
    if (Math.abs(den) < 1e-12) return null;
    const t1 = ((s1.e - a.e) * w.n - (s1.n - a.n) * w.e) / den, t2 = ((s1.e - a.e) * r.n - (s1.n - a.n) * r.e) / den;
    return t1 >= 0 && t1 < 1 && t2 >= 0 && t2 <= 1 ? { e: a.e + r.e * t1, n: a.n + r.n * t1 } : null;
  };
  const ext = (a, b, n) => { const L1 = Math.hypot(b.e - a.e, b.n - a.n) || 1, v = { e: (b.e - a.e) / L1, n: (b.n - a.n) / L1 }, o = []; for (let i = 1; i <= n; i++) o.push({ e: b.e + v.e * i, n: b.n + v.n * i }); return o; };
  const out = [];
  list.forEach(tr => {
    if (tr.deleted) return;
    if (tr.mode === 2) {
      const a = plane.fwd(...wgs(tr.a[0], tr.a[1])), b = plane.fwd(...wgs(tr.b[0], tr.b[1])), L1 = Math.hypot(b.e - a.e, b.n - a.n) || 1, v = { e: (b.e - a.e) / L1, n: (b.n - a.n) / L1 };
      const X = hit({ e: a.e - v.e * 5000, n: a.n - v.n * 5000 }, { e: a.e + v.e * 5000, n: a.n + v.n * 5000 }), sa = side(a) === mine, sb = side(b) === mine;
      let A = a, B = b;
      if (X && !sa && sb) A = X;                                 // A liegt drüben: A an die Schnittlinie
      if (X && sa && !sb) B = X;                                 // B liegt drüben: B an die Schnittlinie
      if (X && !sa && !sb) {                                    // beide Punkte drüben: von der Schnittlinie aus in den Teil
        const inward = side({ e: X.e + v.e, n: X.n + v.n }) === mine ? 1 : -1;
        A = inward > 0 ? X : { e: X.e - v.e * L1, n: X.n - v.n * L1 }; B = inward > 0 ? { e: X.e + v.e * L1, n: X.n + v.n * L1 } : X;
      }
      if (!X && !sa && !sb) return;                              // liegt ganz im anderen Teil
      if (Math.hypot(B.e - A.e, B.n - A.n) < 2) return;
      out.push({ src: tr, name: tr.name, mode: 2, aLL: llOf(A), bLL: llOf(B), changed: A !== a || B !== b });
    } else if (tr.mode === 4 || tr.mode === 32) {
      const Q = tr.pts.map(v => plane.fwd(v[0], v[1])), closed = tr.mode === 32 && Q.length > 3, n = Q.length;
      // Kurve an jedem Schnitt mit der Schnittstrecke auftrennen
      const pcs = []; let cur = { pts: [Q[0]], cutStart: false };
      for (let i = 1; i < n + (closed ? 1 : 0); i++) {
        const a = Q[i - 1], b = Q[i % n], x = hit(a, b);
        if (x) { cur.pts.push(x); cur.cutEnd = true; pcs.push(cur); cur = { pts: [x], cutStart: true }; }
        cur.pts.push(b);
      }
      pcs.push(cur);
      if (closed && pcs.length > 1) { const f0 = pcs.shift(), l = pcs[pcs.length - 1]; l.pts = l.pts.concat(f0.pts.slice(1)); l.cutEnd = f0.cutEnd; }   // Ring: erstes und letztes Stück gehören zusammen
      if (pcs.length === 1) {                                    // kein Schnitt: ganz behalten oder ganz weglassen
        const on = Q.filter(q => side(q) === mine).length;
        if (on * 2 >= n) out.push({ src: tr, name: tr.name, mode: tr.mode, heading: tr.heading, pts: tr.pts, changed: false });
        return;
      }
      const mineP = pcs.filter(p => { const m = p.pts[p.pts.length >> 1]; return side(m) === mine; }).sort((x, y) => pathLen(y.pts) - pathLen(x.pts))[0];
      if (!mineP || pathLen(mineP.pts) < 5) return;
      let R = mineP.pts;
      if (mineP.cutStart) R = ext(R[1], R[0], 99).reverse().concat(R);
      if (mineP.cutEnd) R = R.concat(ext(R[R.length - 2], R[R.length - 1], 99));
      const H = headingsOf(R); let x = 0, y = 0; H.forEach(h => { x += Math.cos(h); y += Math.sin(h); });
      out.push({ src: tr, name: tr.name, mode: 4, heading: normH(Math.atan2(y, x)), pts: R.map(llOf), changed: true });
    }
  });
  return out;
}
async function writeFieldSpec(sp) {
  map.fitBounds(L.latLngBounds(sp.rings[0]), { animate: false });     // vorläufiger Ursprung = Feldmitte
  createField(sp.name, () => { });
  if (newFieldName !== sp.name) throw new Error(t('fieldExists', sp.name));
  bnds = sp.rings.map(r => ({ flagLines: ['False'], pts: r.map(v => plane.fwd(v[0], v[1])), orig: [], dirty: true }));
  active = 0; bndListDirty = true;
  sp.tracks.forEach(tr => {
    if (tr.mode === 2) { const a = diskPlane.fwd(...tr.aLL), b = diskPlane.fwd(...tr.bLL); addTrack({ name: tr.name, mode: 2, heading: normH(Math.atan2(b.e - a.e, b.n - a.n)), a: [a.e, a.n], b: [b.e, b.n], pts: [] }); }
    else addTrack({ name: tr.name, mode: tr.mode || 4, heading: tr.heading, pts: tr.pts });
  });
  flags = sp.flags; flagsDirty = true;
  if (sp.tram.length) setTramData({ outer: [], inner: [], lines: sp.tram });
  unsaved = true;
  if (!await saveField()) throw new Error(t('saveFailed', sp.name));
}
// Ring an einer Geraden durch p1, p2 in zwei Ringe schneiden (Ebene). Gibt [A, B] oder null.
function cutRing(P, p1, p2) {
  const n = P.length, d = { e: p2.e - p1.e, n: p2.n - p1.n }, L2 = d.e * d.e + d.n * d.n, X = [];
  if (L2 < 1) return null;
  for (let i = 0; i < n; i++) {
    const a = P[i], b = P[(i + 1) % n], r = { e: b.e - a.e, n: b.n - a.n }, den = d.e * r.n - d.n * r.e;
    if (Math.abs(den) < 1e-12) continue;
    const t1 = ((a.e - p1.e) * r.n - (a.n - p1.n) * r.e) / den, s1 = ((a.e - p1.e) * d.n - (a.n - p1.n) * d.e) / den;
    if (s1 >= -1e-9 && s1 < 1 + 1e-9) X.push({ t: t1, i, q: { e: p1.e + d.e * t1, n: p1.n + d.n * t1 } });
  }
  X.sort((x, y) => x.t - y.t);
  for (let j = X.length - 1; j > 0; j--) if (Math.abs(X[j].t - X[j - 1].t) * Math.sqrt(L2) < 1e-6) X.splice(j, 1);   // Schnitt genau auf einem Grenzpunkt nur einmal zählen
  let k = -1; for (let j = 0; j + 1 < X.length; j += 2) if (X[j].t <= 0.5 + 1e-9 && X[j + 1].t >= 0.5 - 1e-9) k = j;
  if (k < 0) return null;
  let I1 = X[k], I2 = X[k + 1];
  if (I1.i === I2.i) return null;
  const arc = (x, y) => { const o = [x.q]; for (let j = (x.i + 1) % n; ; j = (j + 1) % n) { o.push(P[j]); if (j === y.i) break; } o.push(y.q); return o.filter((p, k) => !k || dSq(p, o[k - 1]) > 1e-6); };
  const A = arc(I1, I2), B = arc(I2, I1);
  return A.length > 2 && B.length > 2 ? [A, B] : null;
}
// Punkt auf der Grenze einrasten, wenn der Klick nahe dran ist (15 Pixel) – ein Grenzpunkt in der Nähe (10 Pixel) geht vor
const snapPx = n => map.distance(map.containerPointToLatLng([0, 0]), map.containerPointToLatLng([n, 0]));
function nearVertex(q, R) {
  let best = null, bd = Infinity;
  for (const p of R) { const d = dSq(q, p); if (d < bd) { bd = d; best = p; } }
  return best && Math.sqrt(bd) <= snapPx(10) ? best : null;
}
function snapToRing(latlng, R) {
  const q = plane.fwd(latlng.lat, latlng.lng), v = nearVertex(q, R);
  if (v) return v;
  const s2 = nearestOn(q, R.concat([R[0]]));
  return Math.sqrt(dSq(q, s2)) <= snapPx(15) ? s2 : q;
}
// Grenzpunkte sichtbar machen, damit man sie anklicken kann (Canvas, damit auch viele Punkte flüssig bleiben)
let vertexCanvas = null;
function vertexDots(g, R, color) {
  vertexCanvas = vertexCanvas || L.canvas({ padding: 0.3 });
  for (const p of R) L.circleMarker(ll(p), { renderer: vertexCanvas, radius: 3, weight: 1, color: '#000', fillColor: color, fillOpacity: 1, interactive: false }).addTo(g);
}
function startSplit() {
  if (!(rootHandle && dirHandle && currentField && bnds[0])) { setStatus(t('needSavedField'), 'err'); return; }
  const R = bnds[0].pts, orig = currentField, C = ['#ffd400', '#00e5ff'];
  let pts = [], parts = null, keep = 0, names = [orig + ' 2', orig + ' 1'], busy = false;
  const ha = P => fmtNum(area(P) / 10000, 2);
  const nameOk = (nm, other) => !!nm.trim() && !/[\\/:*?"<>|]/.test(nm) && !fieldNames.some(x => x.toLowerCase() === nm.trim().toLowerCase()) && nm.trim().toLowerCase() !== (other || '').trim().toLowerCase();
  const list = () => {
    const box = $('toolList'); box.innerHTML = '';
    if (!parts) return;
    const add = (label, i) => { const lb = document.createElement('label'); lb.className = 'muted'; lb.textContent = label; const inp = document.createElement('input'); inp.value = names[i]; inp.oninput = () => { names[i] = inp.value; updateToolbox(); }; box.append(lb, inp); };
    if (cfg.splitMode === 0) add(t('splitNameNew', keep === 0 ? 2 : 1), 0);
    else { add(t('splitNamePart', 1), 1); add(t('splitNamePart', 2), 0); }
  };
  startTool({
    title: 'btnSplit', params: ['splitMode'], msgHtml: true, okLabel: 'splitDo',
    msg: () => {
      if (busy) return esc(t('splitBusy'));
      if (pts.length < 2) return esc(t(pts.length ? 'splitPick2' : 'splitPick1'));
      if (!parts) return '<span class="warn">' + esc(t('splitNoCut')) + '</span>';
      const h = [t('splitParts', ha(parts[0]), ha(parts[1]))];
      if (cfg.splitMode === 0) h.push(esc(t('splitKeepInfo', keep + 1, orig)));
      else h.push(esc(t(cfg.splitMode === 2 ? 'splitDelInfo' : 'splitOrigInfo', orig)));
      h.push(esc(t('splitData')));
      if (cfg.splitMode === 0 && unsaved) h.push(esc(t('splitUnsaved')));
      if (parts && !(cfg.splitMode === 0 ? nameOk(names[0]) : nameOk(names[1], names[0]) && nameOk(names[0], names[1]))) h.push('<span class="warn">' + esc(t('splitBadName')) + '</span>');
      return h.join('<br>');
    },
    onClick: p => {
      if (busy) return;
      if (pts.length === 2 && parts) {                        // Klick in einen Teil: der bleibt im Feld
        const q = plane.fwd(p.lat, p.lng), k = inPoly(q, parts[0]) ? 0 : inPoly(q, parts[1]) ? 1 : -1;
        if (k >= 0) { keep = k; list(); redrawTool(); return; }
      }
      if (pts.length === 2) pts = [];
      pts.push(snapToRing(p, R));
      parts = pts.length === 2 ? cutRing(R, pts[0], pts[1]) : null;
      if (parts && area(parts[1]) > area(parts[0])) parts.reverse();   // Teil 1 = der größere
      keep = 0; list(); redrawTool();
    },
    draw: g => {
      if (parts) parts.forEach((P, i) => {
        const kept = cfg.splitMode === 0 && i === keep, pick = cfg.splitMode === 0 && !busy, fo = kept ? .35 : .15;
        const pg = L.polygon(P.map(ll), { color: C[i], weight: 2, fillColor: C[i], fillOpacity: fo, dashArray: kept ? null : '6 4', interactive: pick, bubblingMouseEvents: false }).addTo(g);
        if (pick) {                                             // Teil anklicken = dieser bleibt im Feld
          pg.on('mouseover', () => pg.setStyle({ fillOpacity: fo + .15 })).on('mouseout', () => pg.setStyle({ fillOpacity: fo }));
          pg.on('click', () => { keep = i; list(); redrawTool(); });
        }
        numBadge(g, ll(centroid(P)), i + 1);
      });
      vertexDots(g, R, '#fff');
      if (pts.length === 2) L.polyline(pts.map(ll), { color: '#ff5a5a', weight: 3, interactive: false }).addTo(g);
      pts.forEach((q, i) => dot(ll(q), '#ff5a5a').addTo(g));
    },
    recalc() { list(); redrawTool(); },
    okEnabled: () => !busy && !!parts && (cfg.splitMode === 0 ? nameOk(names[0]) : nameOk(names[1], names[0]) && nameOk(names[0], names[1])),
    ok() {
      const mode = cfg.splitMode, [A, B] = parts, inside = (P, r) => inPoly(r[0], P);
      const inn = bnds.slice(1).map(b => b.pts), tram = tramGeoms(ex.tram);
      const spec = (nm, P) => fieldSpecFrom(nm.trim(), P, inn.filter(r => inside(P, r)), fitTracks(ex.tracks, P), flags, tram);
      (async () => {
        try {
          setStatus(t('splitBusy'));
          if (mode === 0) {
            const K = keep === 0 ? A : B, N = keep === 0 ? B : A, sp = spec(names[0], N);
            // das offene Feld wird zum Teil, der bleibt
            bnds = [Object.assign(bnds[0], { pts: K, dirty: true })].concat(bnds.slice(1).filter(b => inside(K, b.pts)));
            bndListDirty = true; active = 0; sel = -1;
            const X = polyIndex(K);
            flags = flags.filter(fl => X.inside(plane.fwd(fl.lat, fl.lon))); flagsDirty = true;
            if (ex.tram) setTramData({ outer: [], inner: [], lines: clipTram(tramGeoms(ex.tram), X) });
            const keepTr = fitTracks(ex.tracks, K);
            ex.tracks.forEach(tr => {
              if (tr.deleted || ![2, 4, 32].includes(tr.mode)) return;
              const k2 = keepTr.find(x => x.src === tr);
              if (!k2) { tr.deleted = true; return; }
              if (k2.mode === 2) { const a = diskPlane.fwd(...k2.aLL), b = diskPlane.fwd(...k2.bLL); Object.assign(tr, { a: [a.e, a.n], b: [b.e, b.n], heading: normH(Math.atan2(b.e - a.e, b.n - a.n)) }); }
              else Object.assign(tr, { mode: k2.mode, pts: k2.pts, heading: k2.heading });
              if (k2.changed) tr.modified = true;
            });
            listDirty.tracks = true;
            if (ex.headland && ex.headland.length) { clearedFiles['Headland.txt'] = CLEAR_FILES.headland[1]; delete generated['Headland.txt']; ex.headland = []; }
            unsaved = true;
            if (!await saveField()) throw new Error(t('saveFailed', orig));
            await writeFieldSpec(sp);
            await openField(orig);
            setStatus(t('splitDone', orig, sp.name), 'ok');
          } else {
            const s1 = spec(names[1], A), s2 = spec(names[0], B);
            await writeFieldSpec(s1); await writeFieldSpec(s2);
            if (mode === 2) { await rootHandle.removeEntry(orig, { recursive: true }); fieldNames = fieldNames.filter(x => x !== orig); }
            await openField(s1.name);
            setStatus(t(mode === 2 ? 'splitDoneDel' : 'splitDone2', s1.name, s2.name, orig), 'ok');
          }
        } catch (err) { setStatus(t('error', err.message), 'err'); }
      })();
    }
  });
}
// Kombinieren: zweites Feld wählen, Verbindungspunkt 1 und 2 anklicken – dort springt die neue Grenze hinüber
async function readOtherField(name) {
  const d = await rootHandle.getDirectoryHandle(name), fl = {}, want = ['Field.txt', 'Boundary.txt', 'TrackLines.txt', 'Flags.txt', 'Tram.txt'];
  for await (const [n, h] of d.entries()) { const k = want.find(w => w.toLowerCase() === n.toLowerCase()); if (h.kind === 'file' && k) fl[k] = await (await h.getFile()).text(); }   // nur lesen, das offene Feld bleibt unberührt
  const [la, lo] = parseField(fl['Field.txt']), pl = Plane(la, lo), keep = diskPlane;
  try {
    diskPlane = pl;                                           // die Leser rechnen mit dem Ursprung des jeweiligen Feldes
    const B = fl['Boundary.txt'] ? parseBoundary(fl['Boundary.txt']) : [];
    return {
      name, rings: B.map(b => b.pts.map(p => pl.inv(p.e, p.n))),
      tracks: fl['TrackLines.txt'] ? tracksLL(parseTrackLines(fl['TrackLines.txt']), v => pl.inv(v[0], v[1])) : [],
      flags: fl['Flags.txt'] ? parseFlags(fl['Flags.txt']) : [],
      tram: fl['Tram.txt'] ? tramGeoms(parseTramFile(fl['Tram.txt'])) : []
    };
  } finally { diskPlane = keep; }
}
function mergeRings(A, B, pa1, pb1, pa2, pb2) {
  const near = (R, c) => { let best = null; for (let i = 0; i < R.length; i++) { const a = R[i], b = R[(i + 1) % R.length], q = nearestOn(c, [a, b]), d = dSq(c, q); if (!best || d < best.d) best = { d, i, q, s: dSq(a, q) }; } return best; };
  const arc = (R, x, y) => { const n = R.length, o = [x.q]; if (x.i === y.i && x.s <= y.s) return o.concat([y.q]); for (let j = (x.i + 1) % n; ; j = (j + 1) % n) { o.push(R[j]); if (j === y.i) break; } o.push(y.q); return o; };
  const away = (P, O) => { const Oc = O.concat([O[0]]); let s1 = 0; P.forEach(p => { s1 += Math.sqrt(dSq(p, nearestOn(p, Oc))); }); return s1 / P.length; };
  const a1 = near(A, pa1), a2 = near(A, pa2), b1 = near(B, pb1), b2 = near(B, pb2);
  const pa = [arc(A, a1, a2), arc(A, a2, a1).reverse()], pb = [arc(B, b2, b1), arc(B, b1, b2).reverse()];
  const PA = away(pa[0], B) > away(pa[1], B) ? pa[0] : pa[1], PB = away(pb[0], A) > away(pb[1], A) ? pb[0] : pb[1];
  return PA.concat(PB);
}
function startCombine() {
  if (!(rootHandle && dirHandle && currentField && bnds[0])) { setStatus(t('needSavedField'), 'err'); return; }
  const orig = currentField, A = bnds[0].pts;
  let other = null, O = null, pts = [], merged = null, name = '', touched = false, busy = false;
  const nameOk = () => !!name.trim() && !/[\\/:*?"<>|]/.test(name) && !fieldNames.some(x => x.toLowerCase() === name.trim().toLowerCase());
  const list = () => {
    const box = $('toolList'); box.innerHTML = '';
    const lb = document.createElement('label'); lb.className = 'muted'; lb.textContent = t('combOther');
    const sel2 = document.createElement('select'); sel2.add(new Option('–', ''));
    fieldNames.filter(n => n !== orig).forEach(n => sel2.add(new Option(n, n)));
    sel2.value = other ? other.name : '';
    sel2.onchange = async () => {
      if (!sel2.value) { other = O = null; merged = null; pts = []; redrawTool(); return; }
      try {
        other = await readOtherField(sel2.value); O = other.rings[0] ? other.rings[0].map(v => plane.fwd(v[0], v[1])) : null;
        pts = []; merged = null;
        if (!touched) name = orig + ' + ' + other.name;
        if (O) map.fitBounds(L.latLngBounds(A.concat(O).map(ll)), { padding: [40, 40] });
        list(); redrawTool();
      } catch (err) { setStatus(t('error', err.message), 'err'); }
    };
    box.append(lb, sel2);
    if (other) { const l2 = document.createElement('label'); l2.className = 'muted'; l2.textContent = t('newFieldName'); const inp = document.createElement('input'); inp.value = name; inp.oninput = () => { name = inp.value; touched = true; updateToolbox(); }; box.append(l2, inp); }
  };
  startTool({
    title: 'btnCombine', params: [], msgHtml: true, okLabel: 'combDo',
    msg: () => {
      if (busy) return esc(t('combBusy'));
      if (!other) return esc(t('combPickField'));
      if (!O) return '<span class="warn">' + esc(t('combNoBnd', other.name)) + '</span>';
      if (pts.length < 4) return esc(t(['combPick1', 'combPick2', 'combPick3', 'combPick4'][pts.length]));
      const h = [t('combResult', fmtNum(area(merged) / 10000, 2), fmtNum(area(A) / 10000, 2), fmtNum((area(O)) / 10000, 2)), esc(t('combInfo', orig, other.name))];
      if (!nameOk()) h.push('<span class="warn">' + esc(t('splitBadName')) + '</span>');
      return h.join('<br>');
    },
    onClick: p => {
      if (busy || !O) return;
      if (pts.length === 4) pts = [];
      const q = plane.fwd(p.lat, p.lng), on = R => nearVertex(q, R) || nearestOn(q, R.concat([R[0]]));
      // erster Punkt einer Verbindung: am näheren Feld; zweiter: immer am anderen Feld
      let f2 = pts.length % 2 ? (pts[pts.length - 1].f === 'A' ? 'O' : 'A') : (dSq(q, on(A)) <= dSq(q, on(O)) ? 'A' : 'O');
      pts.push({ q: on(f2 === 'A' ? A : O), f: f2 });
      const g2 = (k, fl) => (pts[k].f === fl ? pts[k] : pts[k + 1]).q;
      merged = pts.length === 4 ? mergeRings(A, O, g2(0, 'A'), g2(0, 'O'), g2(2, 'A'), g2(2, 'O')) : null;
      redrawTool();
    },
    draw: g => {
      L.polygon(A.map(ll), { color: '#ff5a5a', weight: 2, fillOpacity: .08, interactive: false }).addTo(g);
      if (O) L.polygon(O.map(ll), { color: '#00e5ff', weight: 2, fillOpacity: .08, interactive: false }).addTo(g);
      vertexDots(g, A, '#ff5a5a'); if (O) vertexDots(g, O, '#00e5ff');
      if (merged) L.polygon(merged.map(ll), { color: '#ffd400', weight: 3, fillColor: '#ffd400', fillOpacity: .2, interactive: false }).addTo(g);
      for (let k = 0; k + 1 < pts.length; k += 2) L.polyline([ll(pts[k].q), ll(pts[k + 1].q)], { color: '#fff', weight: 3, dashArray: '6 5', interactive: false }).addTo(g);
      pts.forEach((x, i) => numBadge(g, ll(x.q), (i >> 1) + 1));
    },
    okEnabled: () => !busy && !!merged && nameOk(),
    ok() {
      const inn = bnds.slice(1).map(b => b.pts).concat(other.rings.slice(1).map(r => r.map(v => plane.fwd(v[0], v[1]))));
      const sp = fieldSpecFrom(name.trim(), merged, inn, tracksLL(ex.tracks, v => wgs(v[0], v[1])).concat(other.tracks), flags.concat(other.flags), tramGeoms(ex.tram).concat(other.tram));
      (async () => {
        try { setStatus(t('combBusy')); await writeFieldSpec(sp); await openField(sp.name); setStatus(t('combDone', sp.name, orig, other.name), 'ok'); }
        catch (err) { setStatus(t('error', err.message), 'err'); }
      })();
    }
  });
  list();
}
$('btnSplit').onclick = startSplit;
$('btnCombine').onclick = startCombine;
