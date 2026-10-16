// AOG Feldeditor – Messen: Strecke, Fläche, Winkel

// --- Messen: Strecke oder Fläche (geht auch ohne geöffnetes Feld) ---
// Klicks rasten ein: auf Grenzpunkten und Fahnen, auf der Grenzlinie und – vom letzten Punkt auf der Grenze aus –
// genau rechtwinklig (90°) zur Grenze, dort auch auf der gegenüberliegenden Grenze. Vor dem Klick zeigt eine
// Gummilinie mit Länge und eine Marke, wo es einrastet.
function measureSnap(latlng) {
  const R = 10, cp = map.latLngToContainerPoint(latlng), px = q => map.latLngToContainerPoint(q);
  let best = null;
  const take = (d, q, kind, h) => { if (d < R && (!best || d < best.d)) best = { d, ll: q, kind, h }; };
  // 1. rechtwinklig zur Grenze vom letzten Punkt aus (±6°) – hat Vorrang, damit es genau 90° bleibt
  let perp = null;
  const k = tool.pts.length - 1;
  if (plane && k >= 0 && tool.hs[k] != null) {
    const A = plane.fwd(tool.pts[k].lat, tool.pts[k].lng), C = plane.fwd(latlng.lat, latlng.lng), v = { e: C.e - A.e, n: C.n - A.n }, L0 = Math.hypot(v.e, v.n);
    if (L0 > 0.5) {
      const h = tool.hs[k], nr = { e: Math.cos(h), n: -Math.sin(h) }, c = (v.e * nr.e + v.n * nr.n) / L0;
      if (Math.abs(c) > Math.cos(6 * D)) {
        const s = Math.sign(c), dir = { e: nr.e * s, n: nr.n * s }, len = L0 * Math.abs(c);
        perp = { A, dir, Q: { e: A.e + dir.e * len, n: A.n + dir.n * len } };
      }
    }
  }
  // 2. Grenzlinie (mit 90°: dort, wo die Rechtwinklige die Grenze trifft), 3. Grenzpunkte und Fahnen
  const edges = () => {
    const C = perp ? perp.Q : plane.fwd(latlng.lat, latlng.lng), cq = perp ? px(ll(perp.Q)) : cp;
    bnds.forEach(b => {
      if (b.hidden) return;
      const n = b.pts.length;
      for (let i = 0; i < n; i++) {
        const a = b.pts[i], c = b.pts[(i + 1) % n], s2 = { e: c.e - a.e, n: c.n - a.n };
        let q;
        if (perp) {
          const r = perp.dir, den = r.e * s2.n - r.n * s2.e;
          if (!den) continue;
          const tt = ((a.e - perp.A.e) * s2.n - (a.n - perp.A.n) * s2.e) / den, u = ((a.e - perp.A.e) * r.n - (a.n - perp.A.n) * r.e) / den;
          if (tt <= 0.1 || u < 0 || u > 1) continue;
          q = { e: perp.A.e + r.e * tt, n: perp.A.n + r.n * tt };
        } else q = nearestOn(C, [a, c]);
        const Q = ll(q);
        take(px(Q).distanceTo(cq), Q, perp ? 'perpEdge' : 'edge', Math.atan2(s2.e, s2.n));
      }
    });
  };
  if (plane && perp) { edges(); if (best) return best; }
  if (plane) bnds.forEach(b => {
    if (b.hidden) return;
    const n = b.pts.length;
    b.pts.forEach((p, i) => { const q = ll(p), a = b.pts[(i - 1 + n) % n], c = b.pts[(i + 1) % n]; take(px(q).distanceTo(cp), q, 'pt', Math.atan2(c.e - a.e, c.n - a.n)); });
  });
  flags.forEach(f => { const q = L.latLng(f.lat, f.lon); take(px(q).distanceTo(cp), q, 'pt', null); });
  if (best) return best;
  if (plane && !perp) { edges(); if (best) return best; }
  if (perp) return { ll: ll(perp.Q), kind: 'perp', h: null };
  return { ll: latlng, kind: 'free', h: null };
}
function startMeasure(isArea) {
  // Länge in lokalen Metern wie AOG (gleich wie die Summe unten)
  const mdist = (a, b) => { const pl = Plane(a.lat, a.lng); return dist(pl.fwd(a.lat, a.lng), pl.fwd(b.lat, b.lng)); };
  // Richtung einer Strecke in Grad (0–360°, im Uhrzeigersinn von Nord wie die AB-Linien in AOG) und Winkel an einem Punkt (0–180°)
  const bearing = (a, b) => { const pl = Plane(a.lat, a.lng), A = pl.fwd(a.lat, a.lng), B = pl.fwd(b.lat, b.lng); return normH(Math.atan2(B.e - A.e, B.n - A.n)) / D; };
  const angleAt = (a, v, b) => { const d = Math.abs(bearing(v, a) - bearing(v, b)); return d > 180 ? 360 - d : d; };
  // Winkel an Punkt i (bei der Fläche auch an den Enden, die Fläche ist geschlossen)
  const angles = () => {
    const P = tool.pts, n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      if (!isArea && (i === 0 || i === n - 1)) continue;
      if (isArea && n < 3) continue;
      out.push({ i, a: angleAt(P[(i - 1 + n) % n], P[i], P[(i + 1) % n]) });
    }
    return out;
  };
  const result = () => {
    const pts = tool.pts, pl = Plane(pts[0].lat, pts[0].lng), q = pts.map(p => pl.fwd(p.lat, p.lng)), rows = [];
    let len = 0;
    const segs = isArea ? pts.length : pts.length - 1;
    for (let i = 0; i < segs; i++) {
      const j = (i + 1) % pts.length, d = dist(q[i], q[j]);
      len += d;
      rows.push(`<tr><td>${i + 1}–${j + 1}</td><td>${fmtNum(d, 2)} m</td></tr>`);
    }
    const ang = angles().map(x => `<tr><td>${t('measAngleAt', x.i + 1)}</td><td>${fmtNum(x.a, 1)}°</td></tr>`);
    const head = isArea ? t('measArea', fmtNum(Math.abs(fenceSignedArea(q) / 2) / 10000, 4), fmtNum(Math.abs(fenceSignedArea(q) / 2), 0), fmtNum(len, 1)) : t('measDist', fmtNum(len, 2));
    return head + `<table class="mtab"><tr><th>${t('measSeg')}</th><th>${t('measLen')}</th></tr>${rows.join('')}${ang.join('')}</table>`;
  };
  const label = (g, a, b, txt) => L.marker(L.latLng((a.lat + b.lat) / 2, (a.lng + b.lng) / 2), { interactive: false,
    icon: L.divIcon({ className: '', html: `<span class="mlabel">${txt}</span>`, iconSize: [0, 0] }) }).addTo(g);
  startTool({
    title: isArea ? 'btnMeasArea' : 'btnMeasDist', pts: [], hs: [],
    msg: () => tool.pts.length < (isArea ? 3 : 2) ? t(isArea ? 'measAreaMsg' : 'measDistMsg') : result(),
    msgHtml: true,
    onClick: p => { const s = measureSnap(p); tool.pts.push(s.ll); tool.hs.push(s.h); tool.hover = null; redrawTool(); },
    onUndo: () => { tool.pts.pop(); tool.hs.pop(); redrawTool(); },
    // Vorschau unter der Maus: Einrast-Marke und Gummilinie mit Länge
    onMove(p) {
      const s = this.hover = measureSnap(p);
      if (!this.hl) this.hl = L.layerGroup().addTo(toolLayer);
      this.hl.clearLayers();
      const col = s.kind === 'free' ? '#ffffff' : s.kind.startsWith('perp') ? '#00e5ff' : '#4cbb6c';
      L.circleMarker(s.ll, { radius: 7, color: col, weight: 2, fill: false, interactive: false }).addTo(this.hl);
      const last = this.pts[this.pts.length - 1];
      if (last) {
        L.polyline([last, s.ll], { color: col, weight: 2, dashArray: '6 5', interactive: false }).addTo(this.hl);
        label(this.hl, last, s.ll, fmtNum(mdist(last, s.ll), 1) + ' m' + (s.kind.startsWith('perp') ? ' ⟂' : ''));
      }
    },
    cancelLabel: 'close',
    draw: g => {
      const pts = tool.pts, style = { color: '#ffd400', weight: 2.5, interactive: false };
      if (isArea && pts.length > 2) L.polygon(pts, { ...style, fillOpacity: .15 }).addTo(g);
      else if (pts.length > 1) L.polyline(pts, style).addTo(g);
      pts.forEach(p => dot(p, '#ffd400').addTo(g));
      if (!isArea) for (let i = 1; i < pts.length; i++) label(g, pts[i - 1], pts[i], fmtNum(mdist(pts[i - 1], pts[i]), 1) + ' m');   // Teilstrecken
      pts.forEach((p, i) => numBadge(g, p, i + 1));                     // Punktnummern wie in der Liste
      angles().forEach(x => L.marker(pts[x.i], { interactive: false, icon: L.divIcon({ className: '', html: `<span class="alabel">${fmtNum(x.a, 1)}°</span>`, iconSize: [0, 0] }) }).addTo(g));
    }
  });
  $('btnMeasDist').classList.toggle('on', !isArea);
  $('btnMeasArea').classList.toggle('on', isArea);
}
map.on('mousemove', e => { if (tool && tool.onMove) tool.onMove(e.latlng); });
// Winkel zwischen zwei Linien: Spuren (AB-Linie, bei Kurven Anfang→Ende) oder automatisch erkannte Feldseiten.
// Erster Klick = Linie 1, zweiter = Linie 2 (Nummern auf der Karte). Angezeigt am Schnittpunkt der verlängerten Linien.
function startAngle() {
  const cand = [];                                     // { key, name, A, B (Ebene), show (latlng) }
  smallTracks().filter(({ tr }) => tr.mode !== 32).forEach(({ tr, i }) => {
    let A, B;
    if (tr.mode === 2) { const toP = v => { const [la, lo] = wgs(v[0], v[1]); return plane.fwd(la, lo); }; A = toP(tr.a); B = toP(tr.b); }
    else { A = plane.fwd(...tr.pts[0]); B = plane.fwd(...tr.pts[tr.pts.length - 1]); }
    cand.push({ key: 't' + i, track: i, name: tr.name, A, B });
  });
  if (bnds[0]) {
    const F = aogFence(0), n = F.length;
    detectSides(F).forEach((sd, k) => {
      const P = []; for (let i = sd.a; i !== sd.b; i = (i + 1) % n) P.push(F[i]); P.push(F[sd.b]);
      cand.push({ key: 's' + k, name: t('angSide', k + 1), A: F[sd.a], B: F[sd.b], show: P.map(ll) });
    });
  }
  const sel = [], pick = c => { if (sel.length >= 2) sel.length = 0; if (!sel.includes(c)) sel.push(c); redrawTool(); };
  const result = () => {
    if (sel.length < 2) return null;
    const [p, q] = sel, u = { e: p.B.e - p.A.e, n: p.B.n - p.A.n }, v = { e: q.B.e - q.A.e, n: q.B.n - q.A.n };
    const c = (u.e * v.e + u.n * v.n) / (Math.hypot(u.e, u.n) * Math.hypot(v.e, v.n)), a = Math.acos(Math.min(1, Math.abs(c))) / D;
    const den = u.e * v.n - u.n * v.e;
    let X = null;
    if (Math.abs(den) > 1e-9) { const s1 = ((q.A.e - p.A.e) * v.n - (q.A.n - p.A.n) * v.e) / den; X = { e: p.A.e + u.e * s1, n: p.A.n + u.n * s1 }; }
    return { a, X };
  };
  startTool({
    title: 'btnMeasAngle', params: [], msgHtml: true, cancelLabel: 'close',
    msg: () => {
      if (sel.length < 2) return esc(t(sel.length ? 'angPick2' : 'angPick1'));
      const r = result();
      return (r.a < 0.05 ? esc(t('angParallel')) : t('angMsg', fmtNum(r.a, 1), fmtNum(180 - r.a, 1))) + '<br>① ' + esc(sel[0].name) + ' · ② ' + esc(sel[1].name);
    },
    draw: g => {
      // Kandidaten anklickbar: Spuren wie im Register Spuren, Feldseiten entlang der Grenze
      if (!layerOn.tracks) setLayer('tracks', true);
      trackPickHits(g, i => { const c = cand.find(x => x.track === i); if (c) pick(c); }, i => cand.some(x => x.track === i));
      cand.filter(c => c.show).forEach(c => {
        const hit = L.polyline(c.show, { color: '#fff', opacity: 0, weight: 14, bubblingMouseEvents: false }).addTo(g);
        hit.on('mouseover', () => hit.setStyle({ opacity: .35 }));
        hit.on('mouseout', () => hit.setStyle({ opacity: 0 }));
        hit.on('click', () => pick(c));
      });
      sel.forEach((c, k) => {
        L.polyline([ll(c.A), ll(c.B)], { color: '#ffffff', weight: 5, opacity: .9, interactive: false }).addTo(g);
        numBadge(g, ll({ e: (c.A.e + c.B.e) / 2, n: (c.A.n + c.B.n) / 2 }), k + 1);
      });
      const r = result();
      if (r && r.X && Math.hypot(r.X.e - sel[0].A.e, r.X.n - sel[0].A.n) < 5000) {
        sel.forEach(c => { const m = dist(c.A, r.X) < dist(c.B, r.X) ? c.A : c.B; L.polyline([ll(m), ll(r.X)], { color: '#00e5ff', weight: 2.5, dashArray: '6 5', interactive: false }).addTo(g); });
        L.marker(ll(r.X), { interactive: false, icon: L.divIcon({ className: '', html: `<span class="alabel">${fmtNum(r.a, 1)}°</span>`, iconSize: [0, 0] }) }).addTo(g);
      }
    }
  });
}
$('btnMeasAngle').onclick = startAngle;
$('btnMeasDist').onclick = () => startMeasure(false);
$('btnMeasArea').onclick = () => startMeasure(true);
