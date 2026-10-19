// AOG Feldeditor – Werkzeuge Vorgewende und Fahrgassen

// --- Werkzeuge: Vorgewende rundum, Teilstück, Fahrgassen. Die Einstellungen stehen in der Seitenleiste, Änderungen zeigt die Vorschau sofort ---
const prevLine = (g, P, color, closed, dash) => { if (P.length > 1) L.polyline((closed ? P.concat([P[0]]) : P).map(ll), { renderer: cv, color, weight: 2.5, dashArray: dash, interactive: false }).addTo(g); };
function startHdAround() {
  if (!bnds[0]) return;
  const F = aogFence(0);
  startTool({
    title: 'btnHdAround', params: ['hdDist', 'hdWidths', 'radius'], hideLayer: 'headland',
    msg: () => !tool.res ? t('hdFail') : tool.rFail ? t('hdRoundTooBig') :
      t('hdAroundMsg', fmtNum(cfg.hdDist, 1), cfg.radius > 0 ? t('hdRound', fmtNum(cfg.radius, 1)) : t('hdSharp')),
    recalc() {
      const hd = aroundRing(F, cfg.hdDist, cfg.radius);
      this.rFail = cfg.radius > 0 && buildAround(F, cfg.hdDist + cfg.radius).length < 4;   // Feld zu schmal für den Radius
      this.res = hd.length > 3 ? hdExit(hd, true) : null; redrawTool();
    },
    draw: g => { if (tool.res) prevLine(g, tool.res, '#ffd400', true, '8 6'); },
    okEnabled: () => !!tool.res,
    ok() { setHeadland(this.res); setStatus(t('hdDone'), 'ok'); }
  });
  tool.recalc();
}
// Vorgewende aus Linien bauen (wie der Headland Builder in AOG): Linien sammeln – Grenzstück zwischen zwei Punkten (Kurve),
// gerade Linie oder Spur –, jede um ihren eigenen Abstand (m oder Arbeitsbreiten) ins Feld verschieben. Das Vorgewende
// entsteht aus den Schnittpunkten der verschobenen Linien; wo keine Linie ist, bleibt die Grenze.
// Ecken der Grenze erkennen (Richtungsänderung über ±8 m mehr als ~30°, nur die stärkste Stelle in 15 m) → Seiten von Ecke zu Ecke
function detectSides(F) {
  const n = F.length, cum = [0];
  for (let i = 1; i <= n; i++) cum.push(cum[i - 1] + dist(F[i - 1], F[i % n]));
  const total = cum[n], at = (i, d) => {           // Index ~d Meter vor (d < 0) oder nach (d > 0) Punkt i
    let k = i, s = 0;
    while (Math.abs(s) < Math.abs(d)) { const j = d > 0 ? (k + 1) % n : (k - 1 + n) % n; s += dist(F[k], F[j]) * Math.sign(d); k = j; if (k === i) break; }
    return k;
  };
  const turn = F.map((p, i) => { const a = F[at(i, -8)], c = F[at(i, 8)]; return Math.abs(wrapPi(Math.atan2(c.e - p.e, c.n - p.n) - Math.atan2(p.e - a.e, p.n - a.n))); });
  const corners = [];
  for (let i = 0; i < n; i++) {
    if (turn[i] < 0.5) continue;
    let max = true;
    for (let k = at(i, -15); k !== at(i, 15); k = (k + 1) % n) if (turn[k] > turn[i] || (turn[k] === turn[i] && k < i)) { max = false; break; }
    if (max) corners.push(i);
  }
  if (corners.length < 2 || total < 1) return [];
  return corners.map((c, i) => ({ a: c, b: corners[(i + 1) % corners.length] }));
}
function startHdSlice() {
  if (!bnds[0]) return;
  const F = aogFence(0), n = F.length, bb = bbox(F), ext = Math.hypot(bb[1] - bb[0], bb[3] - bb[2]) + 50;
  const nearestIdx = q => { let bi = 0, bd = Infinity; F.forEach((v, i) => { const d = dSq(v, q); if (d < bd) { bd = d; bi = i; } }); return bi; };
  const work = () => cfg.toolWidth - cfg.overlap;
  // Spuren zum Verwenden: Kurven und AB-Linien; geschlossene Spuren rund ums Feld nicht (das wäre „Rundum“)
  const XF = polyIndex(F), tracks = smallTracks().filter(({ tr }) => tr.mode !== 32).map(({ tr, i }) => {
    const R = refLine(tr), inF = clipToPoly(R, XF), P = inF.length ? inF.reduce((a, b) => pathLen(b) > pathLen(a) ? b : a) : [];
    return { i, R, show: inF, P: P.length > 3 ? openHeadings(P.map(p => ({ e: p.e, n: p.n, h: 0 }))) : null, name: tr.name };
  }).filter(x => x.P);
  // Quelllinie aus zwei Grenzpunkten (Kurve: kürzerer Weg bzw. vorwärts entlang der Grenze, Gerade: Verbindung)
  const fromPicks = (s, e, kind, forward) => {
    let P = [];
    if (kind === 'line') {
      const A = F[s], B = F[e], h = normH(Math.atan2(B.e - A.e, B.n - A.n)), L = dist(A, B);
      if (L < 2) return null;
      for (let d = 0; d <= L; d += 1) P.push({ e: A.e + Math.sin(h) * d, n: A.n + Math.cos(h) * d, h });
    } else {
      if (!forward && Math.abs(s - e) <= n / 2 && s > e) [s, e] = [e, s];
      else if (!forward && Math.abs(s - e) > n / 2 && s < e) [s, e] = [e, s];
      for (let i = s; i !== e; i = (i + 1) % n) P.push(F[i]);
      P.push(F[e]);
      P = openHeadings(trimEndCorners(P).map(p => ({ e: p.e, n: p.n, h: 0 })));
      if (P.length < 4) return null;
    }
    return { ...extendStraight(P, ext), P };
  };
  const fromTrack = x => {             // Mitte der Linie in R = der Punkt, der der Mitte des Stücks im Feld am nächsten liegt
    const m = x.P[x.P.length >> 1]; let mid = 0, md = Infinity;
    x.R.forEach((p, k) => { const d = dSq(p, m); if (d < md) { md = d; mid = k; } });
    return { R: x.R, mid, P: x.P, name: x.name, track: x.i };
  };
  const lines = [];
  const addLine = (src, kind, quiet) => {
    if (!src) { if (!quiet) setStatus(t('hdLineNo'), 'err'); return; }
    // Lage entlang der Grenze (wie a_point in AOG), damit die Linien der Reihe nach eingesetzt werden
    const m = src.P[src.P.length >> 1];
    lines.push({ ...src, kind, dist: cfg.hdDist, pos: nearestIdx(m) });
    tool.sel = lines.length - 1;
    if (!quiet) { renderLines(); tool.recalc(); }
  };
  // Linie wählen (Liste oder Karte): weiß zeigen, Zeile markieren, Abstand gleich eintippen können
  const selectLine = i => {
    tool.sel = i; renderLines(); redrawTool();
    const inp = document.querySelectorAll('#toolList .hdline input[type=number]')[i * 2];
    if (inp) { inp.focus(); inp.select(); }
  };
  const renderLines = () => {
    const box = $('toolList');
    box.innerHTML = '';
    if (!lines.length) { box.innerHTML = `<div class="muted">${t('hdNoLines')}</div>`; return; }
    lines.forEach((ln, i) => {
      const row = document.createElement('div'), nm = document.createElement('span'), m = document.createElement('input'), w = document.createElement('input');
      row.className = 'hdline' + (i === tool.sel ? ' on' : '') + (ln.fail ? ' fail' : '');
      nm.className = 'nm'; nm.textContent = (i + 1) + ' · ' + (ln.kind === 'track' ? ln.name : t(ln.kind === 'line' ? 'segLine' : ln.kind === 'side' ? 'hdSide' : 'segCurve'));
      m.type = 'number'; m.step = 0.1; m.min = 0; m.value = ln.dist; m.title = t('fDist');
      w.type = 'number'; w.step = 1; w.min = 0; w.title = t('fWidths'); w.placeholder = '×'; w.disabled = !(work() > 0);
      if (work() > 0) { const k = ln.dist / work(); if (Math.abs(k - Math.round(k)) < 1e-6) w.value = Math.round(k); }
      m.oninput = () => { const v = parseFloat(m.value); if (v >= 0) { ln.dist = v; w.value = ''; tool.recalc(); } };
      w.oninput = () => { const k = parseFloat(w.value); if (k >= 0 && work() > 0) { ln.dist = Math.round(work() * k * 10) / 10; m.value = ln.dist; tool.recalc(); } };
      row.onclick = ev => { if (ev.target.tagName === 'INPUT') return; selectLine(i); };
      m.onfocus = () => { if (tool.sel !== i) { tool.sel = i; document.querySelectorAll('#toolList .hdline').forEach((r, k) => r.classList.toggle('on', k === i)); redrawTool(); } };
      row.append(nm, m, document.createTextNode('m'), w, iconBtn('trash', t('delTitle'), () => { lines.splice(i, 1); tool.sel = -1; renderLines(); tool.recalc(); }));
      box.append(row);
    });
  };
  startTool({
    title: 'btnHdSlice', params: ['hdKind', 'hdDist', 'hdWidths'],
    picks: [], sel: -1, showPts: true, hideLayer: 'headland', list: true,
    msg: () => {
      const how = cfg.hdKind === 'track' ? t(tracks.length ? 'hdAddTrack' : 'hdNoTracks') : t(tool.picks.length ? 'abDrawMsgB' : 'hdSliceA');
      if (!lines.length) return how;
      return (tool.res ? t('hdBuildOk', lines.length) : t('hdSliceNo')) + ' ' + how;
    },
    onClick: p => {
      if (cfg.hdKind === 'track') return;                  // Spuren werden über ihre Klickflächen hinzugefügt
      tool.picks.push(nearestIdx(plane.fwd(p.lat, p.lng)));
      if (tool.picks.length === 2) { const [s, e] = tool.picks; tool.picks = []; addLine(fromPicks(s, e, cfg.hdKind), cfg.hdKind); }
      else redrawTool();
    },
    onUndo: () => { if (tool.picks.length) tool.picks.pop(); else { lines.pop(); renderLines(); } tool.recalc(); },
    // Seiten automatisch: jede Seite von Ecke zu Ecke als eigene Linie; alle gemeinsam auf den Abstand oben
    actions: () => [
      { label: 'hdAutoSides', keep: true, run() {
        const sides = detectSides(F);
        if (!sides.length) { setStatus(t('hdNoSides'), 'err'); return; }
        lines.length = 0;
        sides.forEach(sd => addLine(fromPicks(sd.a, sd.b, 'curve', true), 'side', true));
        tool.sel = -1; renderLines(); this.recalc(); setStatus(t('hdSidesFound', lines.length), 'ok');
      } },
      ...(lines.length ? [{ label: 'hdAllDist', keep: true, run() { lines.forEach(ln => { ln.dist = cfg.hdDist; }); renderLines(); this.recalc(); } }] : [])],
    recalc() {
      this.res = null;
      // der Reihe nach entlang der Grenze einsetzen; ohne Linie bleibt die Grenze
      let H = F.map(p => ({ e: p.e, n: p.n }));
      const order = lines.map((ln, i) => i).sort((a, b) => lines[a].pos - lines[b].pos);
      order.forEach(i => {
        const ln = lines[i];
        ln.fail = false; ln.seg = null;
        if (!(ln.dist > 0)) return;
        const S = offsetLine(ln.R, inwardSide(ln.P, F) * ln.dist), m = ln.R[ln.mid];
        let mi = 0, md = Infinity; S.forEach((p, k) => { const d = dSq(p, m); if (d < md) { md = d; mi = k; } });
        const sp = spliceHeadland(H, S, mi);
        if (sp && sp.ring.length > 3) { H = sp.ring; ln.seg = sp.seg; } else ln.fail = true;
      });
      if (lines.some(ln => ln.dist > 0 && !ln.fail)) {
        const ring = openHeadings(minSpacing(H.concat([H[0]]).map(p => ({ e: p.e, n: p.n, h: 0 })), 1.2));
        this.res = { hd: hdExit(ring, true, true) };
      }
      document.querySelectorAll('#toolList .hdline').forEach((r, i) => r.classList.toggle('fail', !!(lines[i] && lines[i].fail)));
      redrawTool();
    },
    draw: g => {
      if (cfg.hdKind !== 'track') {
        const vb = map.getBounds().pad(0.2), vis = F.map(ll).filter(q => vb.contains(q));
        if (vis.length <= 3000) vis.forEach(q => L.circleMarker(q, { renderer: cv, radius: 3, color: '#fff', weight: 1, fillColor: '#ff9500', fillOpacity: 1, interactive: false }).addTo(g));
        tool.picks.forEach(i => dot(ll(F[i]), '#ffd400').addTo(g));
      } else {
        // Spuren wählen wie im Register Spuren: Hand-Cursor, beim Darüberfahren hell, Klick fügt sie als Linie hinzu
        if (!layerOn.tracks) setLayer('tracks', true);
        trackPickHits(g, i => { const x = tracks.find(y => y.i === i); if (x) addLine(fromTrack(x), 'track'); },
          i => tracks.some(x => x.i === i) && !lines.some(ln => ln.track === i));
      }
      // die Linien (gewählte weiß) und ihre verschobene Lage (orange) – anklickbar: Hand-Cursor, beim Darüberfahren hell
      lines.forEach((ln, i) => {
        const on = i === tool.sel, show = [ln.P.map(ll)].concat(ln.seg ? [ln.seg.map(ll)] : []);
        L.polyline(show[0], { renderer: cv, color: on ? '#ffffff' : '#bbbbbb', weight: on ? 4 : 2, interactive: false }).addTo(g);
        if (ln.seg) prevLine(g, ln.seg, on ? '#ffffff' : '#ff9500', false, '6 5');
        show.forEach(P => {
          const hit = L.polyline(P, { color: '#fff', opacity: 0, weight: 14, bubblingMouseEvents: false }).addTo(g);
          hit.on('mouseover', () => hit.setStyle({ opacity: .35 }));
          hit.on('mouseout', () => hit.setStyle({ opacity: 0 }));
          hit.on('click', () => selectLine(i));
        });
      });
      if (tool.res) offFence(tool.res.hd, true).forEach(run => prevLine(g, run, '#ffd400', false));   // auf der Grenze nichts zeichnen
      lines.forEach((ln, i) => numBadge(g, ll(ln.P[ln.P.length >> 1]), i + 1));                        // Nummern wie in der Liste
    },
    okEnabled: () => !!tool.res,
    ok() { setHeadland(this.res.hd); setStatus(t('hdDone'), 'ok'); }
  });
  renderLines();
  tool.recalc();
}
// Teile einer geschlossenen Linie, die nicht auf der Grenze liegen (Abstand > 0,5 m) – als einzelne Linienstücke
function offFence(P, closed) {
  if (!bnds[0] || P.length < 2) return [P];
  const F = aogFence(0), Fc = F.concat([F[0]]), g = grid(minSpacing(Fc.map(p => ({ e: p.e, n: p.n, h: 0 })), 0.5), 1);
  const Q = minSpacing((closed ? P.concat([P[0]]) : P).map(p => ({ e: p.e, n: p.n, h: 0 })), 2), runs = [];
  let cur = null;
  Q.forEach(p => {
    if (!g.near(p, 0.25)) { if (!cur) runs.push(cur = []); cur.push(p); }
    else cur = null;
  });
  return runs.filter(r => r.length > 1);
}
// Fahrgassen „An Linie“: von einer Referenzlinie aus (eine oder beide Seiten, Anzahl je Seite oder bis zum Feldrand)
// oder von zwei Linien aufeinander zu. Gibt es schon Fahrgassen, heißt es vor dem Übernehmen „Ersetzen“ oder „Ergänzen“.
const drawRing = (g, ring, dash) => { if (!ring) return; prevLine(g, ring.outer, '#ffd400', true, dash); prevLine(g, ring.inner, '#ffd400', true, dash); (ring.extra || []).forEach(l => prevLine(g, l, '#ffd400', true, dash)); };
function startTramTool() {
  const kind = 'fill', list = smallTracks();
  if (!list.length) { setStatus(t('needTrack'), 'err'); return; }
  const have = ex.tram && ex.tram.lines.length > 0;
  const apply = (res, add) => { setTram({ lines: res.lines, add, ring: res.ring || undefined }); setStatus(t('tramDone'), 'ok'); };
  const ring = () => cfg.withRing ? ['withRing', 'ringCount', 'radius'] : ['withRing'];
  startTool({
    title: 'btnTram',
    params: () => cfg.fillLines === 2 && list.length > 1 ? ['fillLines', ...ring(), 'tramTrack', 'nA', 'tramTrack2', 'nB', 'trim']
      : cfg.fillLines === 3 && list.length > 1 ? ['fillLines', ...ring(), 'tramTrack', 'tramTrack2', 'nR', 'nL']
      : ['fillLines', ...ring(), 'tramTrack', 'nR', 'nL'],
    get two() { return cfg.fillLines >= 2 && list.length > 1; },
    get mid() { return cfg.fillLines === 3 && list.length > 1; },
    res: { lines: [], ring: null }, hideOk: have,
    msg: () => !tool.res.lines.length ? t(tool.res.ring ? 'tramOnlyRing' : 'tramNone') :
      t('tramMsg', tool.res.lines.length) + (tool.res.ring ? t('tramWithRing') : '') + '.' + (tool.midInfo ? ' ' + t('tramMidCount', tool.midInfo[0], tool.midInfo[1]) : '') + (have ? ' ' + t('tramAsk') : ''),
    recalc() {
      const c = cfg, trA = ex.tracks[c.tramTrack];
      let lines = [];
      this.ring = null;
      if (this.mode !== c.fillLines) { this.mode = c.fillLines; this.key = this.key1 = null; }   // Umschalten 1/2 Linien: neu vorschlagen
      if (trA && !trA.deleted) {
        const ctx = tramContext(c, c.withRing), RA = refLine(trA);
        this.midR = null; this.midInfo = null;
        if (this.mid) {
          // Mitte von 2: die erste Fahrgasse liegt genau auf der Mittellinie, weitere im Abstand nach beiden Seiten.
          // Bezug ist die um einen halben Abstand verschobene Mitte – so liegt Fahrgasse 0 rechts davon genau auf der Mitte.
          const trB = ex.tracks[c.tramTrack2];
          if (trB && !trB.deleted && c.tramTrack2 !== c.tramTrack) {
            const keyM = [c.tramTrack, c.tramTrack2].join('/');
            if (this.keyM !== keyM) { this.keyM = keyM; this.M = midLine(RA, refLine(trB)); this.key1 = null; }
            const R = offsetLine(this.M, -c.tramWidth / 2).map(p => ({ ...p }));
            const RR = openHeadings(minSpacing(R, 2));
            this.midR = this.M;
            const key1 = ['m', c.tramTrack, c.tramTrack2, c.tramWidth, c.trackWidth, c.withRing, c.ringCount, c.radius].join('/');
            if (this.key1 !== key1) {
              this.key1 = key1;
              const fit = sd => { let m = 0, empty = 0; for (let k = sd > 0 ? 1 : 0; k < 400 && empty < 3; k++) { const p = tramPair(RR, k, sd, c, ctx); if (p === null) continue; if (!p.length) { empty++; continue; } empty = 0; m++; } return m; };
              cfg.nR = fit(1); cfg.nL = fit(-1);
              saveCfg(); renderCfg();
            }
            // die Mitte ist immer dabei; Anzahl rechts/links zählt nur die zusätzlichen je Seite
            const along = (sd, start, count) => { const o = []; let kept = 0, empty = 0; for (let k = start; k < 400 && kept < count && empty < 3; k++) { const p = tramPair(RR, k, sd, c, ctx); if (p === null) continue; if (!p.length) { empty++; continue; } empty = 0; kept++; o.push(...p); } return o; };
            const m0 = tramPair(RR, 0, 1, c, ctx);
            lines = (m0 || []).concat(along(1, 1, c.nR), along(-1, 0, c.nL));
            this.midInfo = [c.nR, c.nL];
          }
        } else if (!this.two) {
          // 1 Linie: Anzahl rechts/links so vorschlagen, dass das ganze Feld abgedeckt ist (ohne die auf der Randfahrgasse)
          const key1 = [c.tramTrack, c.tramWidth, c.trackWidth, c.withRing, c.ringCount, c.radius].join('/');
          if (this.key1 !== key1) {
            this.key1 = key1;
            const fit = s => { let m = 0, empty = 0; for (let k = 0; k < 400 && empty < 3; k++) { const p = tramPair(RA, k, s, c, ctx); if (p === null) continue; if (!p.length) { empty++; continue; } empty = 0; m++; } return m; };
            cfg.nR = fit(1); cfg.nL = fit(-1);
            saveCfg(); renderCfg();
          }
          lines = tramAlong(RA, 1, c.nR, c, ctx).concat(tramAlong(RA, -1, c.nL, c, ctx));
        } else {
          const trB = ex.tracks[c.tramTrack2];
          if (trB && !trB.deleted && c.tramTrack2 !== c.tramTrack) {
            // Anzahl je Seite neu vorschlagen, wenn sich Linien, Abstand oder die Randfahrgasse ändern
            const RB = refLine(trB), key = [c.tramTrack, c.tramTrack2, c.tramWidth, c.trackWidth, c.withRing, c.ringCount, c.radius].join('/');
            if (this.key !== key) {
              this.key = key; this.geo = twoGeo(RA, RB, ctx.XF);
              const n = Math.max(0, Math.round(this.geo.D / c.tramWidth)), a0 = Math.ceil(n / 2), b0 = n - a0;
              // Fahrgassen, die auf eine Randfahrgasse fallen, werden ausgelassen und zählen nicht mit
              const onRing = (R, s, upto) => { let m = 0; for (let k = 0; k < upto; k++) if (tramPair(R, k, s, c, ctx) === null) m++; return m; };
              cfg.nA = Math.max(0, a0 - onRing(RA, this.geo.sA, a0)); cfg.nB = Math.max(0, b0 - onRing(RB, this.geo.sB, b0));
              saveCfg(); renderCfg();
            }
            if (c.trim) {                              // die Fahrgassen einer Seite enden am Schnittpunkt mit ihrer Partnerin
              const CA = tramCenters(RA, this.geo.sA, c.nA, c, ctx), CB = tramCenters(RB, this.geo.sB, c.nB, c, ctx);
              trimCenters(CA, CB, RA, RB, c.trim).forEach(({ C, cut }) => lines.push(...tracksFromCenter(C, c, ctx, cut)));
            } else lines = tramAlong(RA, this.geo.sA, c.nA, c, ctx).concat(tramAlong(RB, this.geo.sB, c.nB, c, ctx));
          }
        }
        this.ring = ctx.ring;
      }
      this.res = { lines: lines.map(L => reduceByAngle(L, 0.01, 200)).filter(L => L.length > 1), ring: this.ring || null };
      redrawTool();
    },
    draw: g => {
      const r = tool.res;
      if (layerOn.tramw) drawBands(g, bandPolys(r.lines, r.ring, cfg));
      r.lines.forEach(l => prevLine(g, l, '#ffd400', false));
      drawRing(g, r.ring, '8 6');
      if (tool.midR) { const X = bnds[0] ? polyIndex(aogFence(0)) : null; (X ? clipToPoly(tool.midR, X) : [tool.midR]).forEach(P => prevLine(g, P, '#ffffff', false, '10 6')); }   // Mittellinie
      // Referenzlinien auf der Karte wählen wie im Register Spuren; Nummer 1 (und 2) an der gewählten Linie
      trackPickHits(g, i => tool.pickTrack(i), i => list.some(x => x.i === i));
      const m1 = trackMidInField(cfg.tramTrack, tool.mids); if (m1) numBadge(g, m1, 1);
      if (tool.two) { const m2 = trackMidInField(cfg.tramTrack2, tool.mids); if (m2) numBadge(g, m2, 2); }
    },
    mids: {}, nextPick: 1,
    // 1 Linie: Klick wählt die Referenzlinie. 2 Linien: erster Klick Linie 1, zweiter Klick Linie 2, dann wieder von vorn
    pickTrack(i) {
      if (this.two && this.nextPick === 2 && i !== cfg.tramTrack) { cfg.tramTrack2 = i; this.nextPick = 1; }
      else { cfg.tramTrack = i; this.nextPick = 2; if (cfg.tramTrack2 === i) cfg.tramTrack2 = -1; }
      saveCfg(); renderCfg(); markRef(); this.recalc();
    },
    okEnabled: () => tool.res.lines.length > 0 || !!tool.res.ring,
    actions: () => have && (tool.res.lines.length || tool.res.ring) ? [
      { label: 'tramReplace', run() { apply(this.res, false); } },
      { label: 'tramAdd', run() { apply(this.res, true); } }] : [],
    ok() { apply(this.res, false); }
  });
  markRef();
  tool.recalc();
}
function startTramRing() {
  if (!bnds[0]) return;
  startTool({
    title: 'btnTramRing', params: ['ringCount', 'radius'], res: { outer: [], inner: [] },
    msg: () => !tool.res.outer.length ? t('hdFail') : tool.res.rFail ? t('hdRoundTooBig') :
      t('tramRingMsg', fmtNum(cfg.tramWidth / 2, 2), cfg.radius > 0 ? t('hdRound', fmtNum(cfg.radius, 1)) : t('hdSharp')) +
      (tool.res.count > 1 ? ' ' + t('ringMany', tool.res.count) : '') + (tool.res.count < cfg.ringCount ? ' ' + t('ringFewer') : ''),
    recalc() { this.res = buildTramRing(cfg); redrawTool(); },
    draw: g => { if (layerOn.tramw) drawBands(g, bandPolys(tool.res.extra || [], tool.res, cfg)); drawRing(g, tool.res); },
    okEnabled: () => tool.res.outer.length > 3,
    ok() { setTram({ ring: this.res }); setStatus(t('tramDone'), 'ok'); }
  });
  tool.recalc();
}
// Vorhandene Fahrgassen anklickbar machen: Hand-Cursor, beim Darüberfahren hell. key = Nummer der Fahrgasse (Paar) oder 'ring'.
function tramHits(g, TL, pairs, ring, onPick, picked) {
  const groups = {};
  const add = (P, key) => {
    if (P.length < 2) return;
    const on = picked && picked.includes(key);
    const pl = L.polyline(P.map(ll), { color: '#fff', opacity: on ? .9 : 0, weight: 14, bubblingMouseEvents: false }).addTo(g);
    (groups[key] = groups[key] || []).push(pl);
    pl.on('mouseover', () => groups[key].forEach(x => x.setStyle({ opacity: on ? .9 : .45 })));
    pl.on('mouseout', () => groups[key].forEach(x => x.setStyle({ opacity: on ? .9 : 0 })));
    pl.on('click', ev => { L.DomEvent.stopPropagation(ev); onPick(key); });
  };
  pairs.forEach((p, i) => p.tracks.forEach(k => add(TL[k], i)));
  if (ring && ring.outer.length > 3) { add(ring.outer, 'ring'); add(ring.inner, 'ring'); }
}
const tramPlane = () => {
  const T = ex.tram, P = a => a.map(([la, lo]) => plane.fwd(la, lo)), TL = T.lines.map(P);
  return { T, TL, pairs: trackPairs(TL, cfg), ring: { outer: P(T.outer), inner: P(T.inner) } };
};
// Gasse dazwischen: zwei vorhandene Fahrgassen anklicken, eine neue kommt genau in die Mitte
function startTramMid() {
  if (!ex.tram || ex.tram.lines.length < 2) { setStatus(t('needTwoTram'), 'err'); return; }
  const { T, TL, pairs, ring } = tramPlane(), F = bnds[0] ? aogFence(0) : null;
  const X = ring.inner.length > 3 ? polyIndex(ring.inner) : F ? polyIndex(F) : null;      // mit Randfahrgasse: endet an ihr
  startTool({
    title: 'btnTramMid', params: [], picks: [], res: { lines: [] },
    msg: () => tool.picks.length < 2 ? t(tool.picks.length ? 'midPick2' : 'midPick1') : tool.res.lines.length ? t('midMsg', fmtNum(tool.gap, 1), fmtNum(tool.gap / 2, 1)) : t('midFail'),
    pick(i) { if (i === 'ring') return; if (this.picks.length >= 2) this.picks = []; this.picks.push(i); this.recalc(); },
    onUndo: () => { tool.picks.pop(); tool.recalc(); },
    recalc() {
      this.res = { lines: [] };
      if (this.picks.length === 2 && this.picks[0] !== this.picks[1]) {
        const C1 = minSpacing(pairs[this.picks[0]].center.map(p => ({ ...p, h: 0 })), 2), C2 = pairs[this.picks[1]].center, M = [], D = [];
        C1.forEach(p => { const q = nearestOn(p, C2), d = Math.sqrt(dSq(p, q)); if (d < 3 * cfg.tramWidth) { M.push({ e: (p.e + q.e) / 2, n: (p.n + q.n) / 2 }); D.push(d); } });
        D.sort((a, b) => a - b);
        this.gap = D[D.length >> 1] || 0;
        if (M.length > 1 && this.gap > cfg.trackWidth * 2) this.res = { lines: tracksFromCenter(M, cfg, { X }) };
      }
      redrawTool();
    },
    draw: g => {
      tramHits(g, TL, pairs, null, i => tool.pick(i), tool.picks);
      if (layerOn.tramw) drawBands(g, bandPolys(tool.res.lines, null, cfg));
      tool.res.lines.forEach(l => prevLine(g, l, '#ffd400', false));
    },
    okEnabled: () => tool.res.lines.length > 0,
    ok() { setTram({ lines: this.res.lines, add: true }); setStatus(t('tramDone'), 'ok'); }
  });
}
// Löschen: einzelne Fahrgassen (oder die Randfahrgasse) anklicken, sie verschwinden sofort; Strg+Z holt sie zurück.
// Kreuzen sich Fahrgassen, sind sie an den Kreuzungen geteilt (rechte Spur an der rechten, linke an der linken) –
// dann verschwindet nur das angeklickte Stück, und die übrigen Stücke gehen ohne Versatz ineinander über.
function startTramDel() {
  if (!ex.tram) return;
  const stack = [];
  startTool({
    title: 'btnTramDel', params: [], hideOk: true, cancelLabel: 'done',
    msg: () => t('delPick') + (tool.splitN ? ' ' + t('delSplit', tool.splitN) : '') + (stack.length ? ' ' + t('delCount', stack.length) : ''),
    onUndo: () => { const T = stack.pop(); if (T) { setTramData(T); redrawTool(); } },
    draw: g => {
      if (!ex.tram) return;
      const { T, TL, pairs, ring } = tramPlane(), P = tramPieces(TL, pairs);
      tool.splitN = P.lines.length - TL.length;
      P.lines.forEach((S, q) => { if (P.idx[q] > 0) dot(ll(S[0]), '#fff').setRadius(3).addTo(g); });   // Teilungspunkte
      tramHits(g, P.lines, P.pieces, ring, key => {
        stack.push({ outer: T.outer, inner: T.inner, lines: T.lines.slice() });
        if (key === 'ring') setTramData({ outer: [], inner: [], lines: T.lines });
        else {
          const kept = joinPieces(TL, P, new Set(P.pieces[key].tracks));
          setTramData({ outer: T.outer, inner: T.inner, lines: kept.map(L => { const k = TL.indexOf(L); return k >= 0 ? T.lines[k] : L.map(p => plane.inv(p.e, p.n)); }) });
        }
        redrawTool();
      });
    }
  });
}
// Schneiden: Schnittlinie mit zwei Klicks (Punkte danach noch verschiebbar) – jede Fahrgasse, die sie kreuzt, wird dort geteilt.
// Stücke anklicken nimmt sie weg (nochmal = zurück), „Seite A/B weg“ schneidet alle auf einer Seite ab. Übernehmen speichert
// auch reines Teilen: die Stücke bleiben dann einzelne Fahrgassen, die man später z. B. mit „Löschen“ entfernen kann.
function startTramCut() {
  if (!ex.tram || !ex.tram.lines.length) return;
  const { T, TL, pairs } = tramPlane(), hist = [];
  let pts = [], gone = new Set(), P = null, cutPts = [];
  const sideOf = q => { const [a, b] = pts; return Math.sign((b.e - a.e) * (q.n - a.n) - (b.n - a.n) * (q.e - a.e)); };
  const calc = () => {
    cutPts = [];
    if (pts.length < 2) { P = null; return; }
    const S = [pts[0], pts[1]];
    const extra = TL.map(L => { const x = allCrosses(L, S).filter(c => c.inP); cutPts.push(...x.map(c => c.pt)); return x; });
    P = cutPts.length ? tramPieces(TL, pairs, extra) : null;
  };
  const atCut = q => P.lines[q].length > 1 && cutPts.some(c => dSq(c, P.lines[q][0]) < 1e-6 || dSq(c, P.lines[q][P.lines[q].length - 1]) < 1e-6);
  const mid = S => S[S.length >> 1];
  // Seite A/B: alle Stücke, die an der Schnittlinie enden und auf dieser Seite liegen
  const sidePieces = s => P ? P.pieces.map((p, k) => k).filter(k => P.pieces[k].tracks.some(atCut) && sideOf(mid(P.lines[P.pieces[k].tracks[0]])) === s) : [];
  const toggle = keys => { hist.push(new Set(gone)); const all = keys.every(k => gone.has(k)); keys.forEach(k => all ? gone.delete(k) : gone.add(k)); redrawTool(); };
  startTool({
    title: 'btnTramCut', params: [], okLabel: 'apply',
    msg: () => pts.length < 2 ? t(pts.length ? 'cutPick2' : 'cutPick1') : !P ? t('cutNone') : t('cutMsg', cutPts.length, gone.size),
    onClick: p => {
      if (pts.length === 2) { pts = []; gone = new Set(); }
      pts.push(plane.fwd(p.lat, p.lng)); calc(); redrawTool();
    },
    onUndo: () => { if (hist.length) gone = hist.pop(); else { pts.pop(); calc(); } redrawTool(); },
    draw: g => {
      if (P) {
        tramHits(g, P.lines, P.pieces, null, k => toggle([k]));
        P.pieces.forEach((pc, k) => { if (gone.has(k)) pc.tracks.forEach(q => L.polyline(P.lines[q].map(ll), { color: '#ff5a5a', weight: 3, dashArray: '4 5', interactive: false }).addTo(g)); });
        cutPts.forEach(c => dot(ll(c), '#fff').setRadius(3).addTo(g));
      }
      if (pts.length === 2) {
        const [a, b] = pts, line = L.polyline([ll(a), ll(b)], { color: '#ff5a5a', weight: 2, dashArray: '8 5', interactive: false }).addTo(g);
        const l = Math.sqrt(dSq(a, b)) || 1, m = { e: (a.e + b.e) / 2, n: (a.n + b.n) / 2 }, nx = -(b.n - a.n) / l * 12, ny = (b.e - a.e) / l * 12;
        if (P) { numBadge(g, ll({ e: m.e + nx, n: m.n + ny }), 'A'); numBadge(g, ll({ e: m.e - nx, n: m.n - ny }), 'B'); }
        pts.forEach((q, i) => dragPin(g, q, '#ff5a5a', '', p => plane.fwd(p.lat, p.lng), s => { pts[i] = s; line.setLatLngs(pts.map(ll)); }, () => { gone = new Set(); hist.length = 0; calc(); redrawTool(); }));
      } else pts.forEach(q => dot(ll(q), '#ff5a5a').addTo(g));
    },
    actions: () => P ? [{ label: 'cutSideA', keep: true, run: () => toggle(sidePieces(1)) }, { label: 'cutSideB', keep: true, run: () => toggle(sidePieces(-1)) }] : [],
    okEnabled: () => !!P,
    ok() {
      const del = new Set(); gone.forEach(k => P.pieces[k].tracks.forEach(q => del.add(q)));
      const isCut = p => cutPts.some(c => dSq(c, p) < 1e-6), lines = [];
      // je Spur: übrige Stücke wieder verbinden – außer an der Schnittlinie (dort bleibt sie geteilt); Unberührtes bleibt wie es war
      TL.forEach((L0, k) => {
        const mine = P.lines.map((_, q) => q).filter(q => P.src[q] === k);
        if (mine.length === 1 && !del.has(mine[0])) { lines.push(T.lines[k]); return; }
        let cur = null;
        const flush = () => { if (cur && cur.length > 1 && pathLen(cur) > 0.5) lines.push(cur.map(p => plane.inv(p.e, p.n))); cur = null; };
        mine.forEach(q => {
          if (del.has(q)) { flush(); return; }
          const S = P.lines[q];
          if (cur && !isCut(S[0])) cur = cur.concat(S.slice(1)); else { flush(); cur = S.slice(); }
        });
        flush();
      });
      setTramData({ outer: T.outer, inner: T.inner, lines });
      setStatus(t('cutDone', cutPts.length, gone.size), 'ok');
    }
  });
}
renderCfg();
$('btnHdAround').onclick = startHdAround;
$('btnTramCut').onclick = startTramCut;
$('btnHdSlice').onclick = startHdSlice;
$('btnTram').onclick = startTramTool;
$('btnTramRing').onclick = startTramRing;
$('btnTramMid').onclick = startTramMid;
$('btnTramDel').onclick = startTramDel;
