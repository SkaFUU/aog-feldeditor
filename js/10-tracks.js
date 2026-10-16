// AOG Feldeditor – Grenze löschen, Spuren (AB-Linie, Kurve, Glätten), Spurdateien

function deleteBoundary() {
  if (!bnds[active]) return;
  if (active === 0 && bnds.length > 1) { setStatus(t('outerHasInner'), 'err'); return; }
  const i = active;
  askPanel('delTitle', t(i === 0 ? 'confirmDelOuter' : 'confirmDelBnd'), () => {
    bnds.splice(i, 1);
    active = 0; sel = -1; undo = [];
    bndListDirty = true; unsaved = true;
    renderBndList(); drawAll();
    setStatus(t('bndDeleted'), 'ok');
  }, 'delTitle');
}

// --- Spuren: neue AB-Linie, neue Kurve, Kurve glätten ---
const normH = h => ((h % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
// Namen wie AOG: "AB 355.8°", "Cu 201.7°" (359.96° wird zu 0.0°, nicht zu 360.0°)
const degName = h => { const d = Math.round(normH(h) / D * 10) / 10; return (d >= 360 ? d - 360 : d).toFixed(1) + '°'; };

function tracksEditable() {
  if (/^\$TwolTracks/.test(files['TrackLines.txt'] || '')) { setStatus(t('twolNo'), 'err'); return false; }
  return true;
}

function addTrack(tr) {
  ex.tracks.push({ ...tr, isNew: true, nudge: '0', visible: 'True' });
  listDirty.tracks = true; unsaved = true;
  layerOn.tracks = true;
  drawLayer('tracks'); renderLayerList(); renderNames();
  setStatus(t('trackCreated', tr.name), 'ok');
}

// Linie in gleichmäßige Abstände (m) zerlegen; Anfang und Ende bleiben erhalten
function resample(P, step) {
  if (P.length < 2) return P.slice();
  const out = [P[0]];
  let need = step, prev = P[0];
  for (let i = 1; i < P.length; i++) {
    let a = prev, seg = dist(a, P[i]);
    while (seg >= need) {
      const f = need / seg;
      a = { e: a.e + (P[i].e - a.e) * f, n: a.n + (P[i].n - a.n) * f };
      out.push(a);
      seg -= need; need = step;
    }
    need -= seg; prev = P[i];
  }
  const end = P[P.length - 1];
  if (dist(out[out.length - 1], end) > step * 0.3) out.push(end); else out[out.length - 1] = end;
  return out;
}

// Glättung über w Meter (Punkte im 1-m-Abstand): an jeder Stelle eine gewichtete Parabel durch die Nachbarpunkte.
// Anders als ein einfacher Mittelwert schneidet das Bögen nicht innen ab – nur das Wackeln verschwindet.
// Die Enden werden gerade verlängert, damit die Kurve dort nicht wegläuft.
function smoothLine(P, w, closed = false) {
  const s = w / 2, n = P.length;
  if (s < 0.5 || n < 5) return P.slice();
  const K = Math.ceil(3 * s), g = [];
  let S0 = 0, S2 = 0, S4 = 0;
  for (let k = -K; k <= K; k++) { const v = Math.exp(-k * k / (2 * s * s)); g.push(v); S0 += v; S2 += v * k * k; S4 += v * k ** 4; }
  // Filter, der genau den Wert der Parabel in der Mitte liefert (Summe = 1)
  const wts = g.map((v, j) => { const k = j - K; return v * (S4 - S2 * k * k) / (S0 * S4 - S2 * S2); });
  const m = Math.min(5, n - 1);
  const d0 = { e: (P[m].e - P[0].e) / m, n: (P[m].n - P[0].n) / m }, d1 = { e: (P[n - 1].e - P[n - 1 - m].e) / m, n: (P[n - 1].n - P[n - 1 - m].n) / m };
  const at = i => closed ? P[((i % n) + n) % n] : i < 0 ? { e: P[0].e + d0.e * i, n: P[0].n + d0.n * i }
    : i >= n ? { e: P[n - 1].e + d1.e * (i - n + 1), n: P[n - 1].n + d1.n * (i - n + 1) } : P[i];
  return P.map((_, i) => {
    let se = 0, sn = 0, sw = 0;
    for (let k = -K; k <= K; k++) { const q = at(i + k), wk = wts[k + K]; se += q.e * wk; sn += q.n * wk; sw += wk; }
    return { e: se / sw, n: sn / sw };
  });
}

function bez(c, u) {
  const v = 1 - u, k0 = v * v * v, k1 = 3 * v * v * u, k2 = 3 * v * u * u, k3 = u * u * u;
  return { e: k0 * c[0].e + k1 * c[1].e + k2 * c[2].e + k3 * c[3].e, n: k0 * c[0].n + k1 * c[1].n + k2 * c[2].n + k3 * c[3].n };
}
// Zusätzliche Punkte, wo die Linie stark dreht (Catmull-Rom durch die vorhandenen Punkte), bis höchstens maxDeg
// Richtungsänderung zwischen zwei Punkten liegen – enge Bögen bleiben so auch stark gezoomt rund.
function densifySmooth(P, maxDeg = 2, closed = false) {
  const n = P.length;
  if (n < 3) return P.slice();
  const at = i => closed ? P[((i % n) + n) % n] : P[Math.max(0, Math.min(n - 1, i))];
  const hd = (a, b) => Math.atan2(b.e - a.e, b.n - a.n);
  const turn = i => {
    if (!closed && (i <= 0 || i >= n - 1)) return 0;
    const d = hd(at(i), at(i + 1)) - hd(at(i - 1), at(i));
    return Math.abs(Math.atan2(Math.sin(d), Math.cos(d)));
  };
  const cr = (a, b, c, d, u) => 0.5 * (2 * b + (c - a) * u + (2 * a - 5 * b + 4 * c - d) * u * u + (3 * b - a - 3 * c + d) * u * u * u);
  const out = [P[0]], segs = closed ? n : n - 1;
  for (let i = 0; i < segs; i++) {
    const k = Math.min(30, Math.ceil(Math.max(turn(i), turn(i + 1)) * 180 / Math.PI / maxDeg));
    const p0 = at(i - 1), p1 = at(i), p2 = at(i + 1), p3 = at(i + 2);
    for (let j = 1; j < k; j++) out.push({ e: cr(p0.e, p1.e, p2.e, p3.e, j / k), n: cr(p0.n, p1.n, p2.n, p3.n, j / k) });
    if (!(closed && i === n - 1)) out.push(p2);        // geschlossen: der erste Punkt steht schon am Anfang
  }
  return out;
}

// Punkte aus einer sehr fein abgetasteten Form auswählen: höchstens 1 m Abstand und höchstens 2° Richtungsänderung
// zwischen zwei Punkten. Anfang und Ende bleiben exakt, damit die Übergänge zur restlichen Kurve stimmen.
function adaptiveSample(fine, maxStep = 1, maxDeg = 2) {
  const out = [fine[0]], lim = maxDeg * D, end = fine[fine.length - 1];
  let dirPrev = Math.atan2(fine[1].e - fine[0].e, fine[1].n - fine[0].n);   // Richtung am Anfang des Bogens
  for (let i = 1; i < fine.length - 1; i++) {
    const last = out[out.length - 1], p = fine[i], d = dist(last, p);
    if (d < 1e-6) continue;
    const dir = Math.atan2(p.e - last.e, p.n - last.n);
    const turned = Math.abs(Math.atan2(Math.sin(dir - dirPrev), Math.cos(dir - dirPrev)));
    if (d >= maxStep || (turned >= lim && d >= 0.05)) { out.push(p); dirPrev = dir; }   // mind. 5 cm Abstand
  }
  if (out.length > 1 && dist(out[out.length - 1], end) < maxStep * 0.25) out.pop();   // kein winziges Reststück vor dem Ende
  out.push(end);
  return out;
}

function startSmooth(idx) {
  if (!tracksEditable()) return;
  const tr = ex.tracks[idx], orig = tr.pts.map(([la, lo]) => plane.fwd(la, lo)), closed = tr.mode === 32;
  // Grenz-Spur = geschlossener Ring: auch das Stück vom letzten zum ersten Punkt gehört dazu
  let base = closed ? resample(orig.concat([orig[0]]), 1).slice(0, -1) : resample(orig, 1);
  const n = base.length;
  // Liegt die Kurve auf einer Grenze, rasten die Klicks nur auf den Grenzpunkten ein, die auf der Kurve liegen.
  // Es zählt nur die Grenze, auf der die Kurve wirklich liegt (die mit den meisten Punkten auf der Kurve).
  let onCurve = [];
  bnds.forEach(b => {
    const on = b.pts.filter(v => { for (let i = 0; i + 1 < orig.length; i++) if (segDist(v, orig[i], orig[i + 1]) < 0.5) return true; return false; });
    if (on.length > onCurve.length) onCurve = on;
  });
  const snapPts = onCurve.length >= 2 ? onCurve : orig;
  const nearest = (P, q) => { let bi = 0, bd = Infinity; P.forEach((v, i) => { const d = (v.e - q.e) ** 2 + (v.n - q.n) ** 2; if (d < bd) { bd = d; bi = i; } }); return bi; };
  // Richtung der Kurve an Punkt i, über ~5 m gemessen (vor dem Abschnitt hinein, nach dem Abschnitt hinaus)
  const dirAt = (i, before) => {
    let a = before ? base[Math.max(0, i - 5)] : base[i], b = before ? base[i] : base[Math.min(n - 1, i + 5)];
    if (dist(a, b) < 0.5) { a = base[Math.max(0, i - 5)]; b = base[Math.min(n - 1, i + 5)]; }
    const L = dist(a, b) || 1;
    return { e: (b.e - a.e) / L, n: (b.n - a.n) / L };
  };
  // Ganze Kurve: Glättung über w Meter. Abschnitt: wird durch einen glatten Bogen ersetzt, der an beiden Enden
  // genau in Richtung der Kurve übergeht und nie über die beiden Punkte hinaus ausholt.
  // In beiden Fällen kommen in engen Bögen zusätzliche Punkte dazu.
  const recompute = () => {
    if (!tool.sec) {
      tool.result = densifySmooth(smoothLine(base, cfg.smoothW, closed), 2, closed);
      tool.bndPlan = planBoundaryBend(closed ? base.concat([base[0]]) : base, tool.result);
      tool.bndNew = tool.result;
    } else {
      const [a, b] = tool.sec, A = base[a], B = base[b], k = cfg.smoothRound / 100 * dist(A, B);
      const dA = dirAt(a, true), dB = dirAt(b, false);
      const c = [A, { e: A.e + dA.e * k, n: A.n + dA.n * k }, { e: B.e - dB.e * k, n: B.n - dB.n * k }, B], fine = [];
      for (let j = 0; j <= 4000; j++) fine.push(bez(c, j / 4000));
      const arc = adaptiveSample(fine);
      tool.result = base.slice(0, a).concat(arc, base.slice(b + 1));
      tool.bndPlan = planBoundaryBend(base.slice(a, b + 1), arc);
      tool.bndNew = arc;
    }
    redrawTool();
  };
  startTool({
    title: 'btnSmooth', params: () => tool && tool.sec ? ['smoothRound'] : ['smoothW'],
    result: null, picks: [], sec: null, showPts: true, bndOption: true, bndPlan: null,
    msg: () => tool.picks.length === 1 ? t('smoothPick2') : tool.sec ? t('smoothSectionMsg', cfg.smoothRound) : t('smoothPickMsg', cfg.smoothW),
    recalc: () => recompute(),
    onClick: p => {
      // Klick rastet auf dem nächsten Punkt der Kurve ein
      const v = snapPts[nearest(snapPts, plane.fwd(p.lat, p.lng))], bi = nearest(base, v);
      base[bi] = { e: v.e, n: v.n };               // genau auf den Punkt setzen (liegt auf der Kurve, ändert ihre Form nicht)
      tool.picks = tool.picks.length === 1 ? [tool.picks[0], bi] : [bi];          // dritter Klick setzt neu an
      // Ring: den kürzeren Weg nehmen – liegt er über dem Anfangspunkt, wird der Ring so gedreht, dass er am Stück liegt
      if (closed && tool.picks.length === 2 && Math.abs(tool.picks[0] - tool.picks[1]) > n / 2) {
        const k = Math.floor((tool.picks[0] + tool.picks[1]) / 2);
        base = base.slice(k).concat(base.slice(0, k));
        tool.picks = tool.picks.map(i => (i - k + n) % n);
      }
      const was = !!tool.sec;
      tool.sec = tool.picks.length === 2 && Math.abs(tool.picks[0] - tool.picks[1]) > 1 ? [Math.min(...tool.picks), Math.max(...tool.picks)] : null;
      if (was !== !!tool.sec) renderParams(tool.params());        // Glättung (m) ↔ Rundung (%)
      recompute();
    },
    draw: g => {
      if (tool.sec) L.polyline(base.slice(tool.sec[0], tool.sec[1] + 1).map(ll), { color: '#ff8c00', weight: 9, opacity: .45, interactive: false }).addTo(g);
      if (tool.result) L.polyline(tool.result.map(ll), { color: '#ffd400', weight: 3, interactive: false }).addTo(g);
      // Punkte der Kurve (im sichtbaren Ausschnitt), damit man sie gezielt anklicken kann
      const vb = map.getBounds().pad(0.2), vis = snapPts.map(ll).filter(q => vb.contains(q));
      if (vis.length <= 3000) vis.forEach(q => L.circleMarker(q, { renderer: cv, radius: 3, color: '#fff', weight: 1, fillColor: '#ff4fd8', fillOpacity: 1, interactive: false }).addTo(g));
      tool.picks.forEach(i => L.circleMarker(ll(base[i]), { radius: 8, color: '#fff', weight: 3, fillColor: '#ff8c00', fillOpacity: 1, interactive: false }).addTo(g));
    },
    okEnabled: () => tool.picks.length !== 1 && (!!tool.sec || cfg.smoothW > 0),
    ok() {
      tr.pts = this.result.map(p => plane.inv(p.e, p.n));
      tr.modified = true; listDirty.tracks = true; unsaved = true;
      drawLayer('tracks');
      if (moveBndPref && this.bndPlan) setStatus(t('bndMoved', tr.name, applyBoundaryBend(this.bndPlan, this.bndNew)), 'ok');
      else setStatus(t('trackChanged', tr.name), 'ok');
    }
  });
  recompute();
  hiTrack = idx; drawLayer('tracks'); markTrackRows();
}

// --- Spurdateien schreiben: unveränderte Spuren bleiben Zeichen für Zeichen gleich ---
function trackBlock(e) {
  const fmtH = h => String(Math.round(normH(h) * 1e5) / 1e5);
  if (e.mode === 2) return [e.name, String(e.heading), r3(e.a[0]) + ',' + r3(e.a[1]), r3(e.b[0]) + ',' + r3(e.b[1]), e.nudge || '0', '2', e.visible || 'True', '0'];
  const P = e.pts.map(([la, lo]) => diskPlane.fwd(la, lo)), n = P.length;
  const H = P.map((p, i) => { const a = P[Math.max(0, i - 1)], c = P[Math.min(n - 1, i + 1)]; return normH(Math.atan2(c.e - a.e, c.n - a.n)); });
  return [e.name, String(isFinite(e.heading) ? e.heading : H[0]), r3(P[0].e) + ',' + r3(P[0].n), r3(P[n - 1].e) + ',' + r3(P[n - 1].n), e.nudge || '0', String(e.mode), e.visible || 'True', String(n),
    ...P.map((p, i) => r3(p.e) + ',' + r3(p.n) + ',' + fmtH(H[i]))];
}
function headlineBlock(e) {
  const P = e.pts.map(([la, lo]) => diskPlane.fwd(la, lo)), n = P.length;
  const H = P.map((p, i) => { const a = P[Math.max(0, i - 1)], c = P[Math.min(n - 1, i + 1)]; return normH(Math.atan2(c.e - a.e, c.n - a.n)); });
  return [e.name, '0', n === 2 ? '2' : '4', '0', String(n), ...P.map((p, i) => r3(p.e) + ' , ' + r3(p.n) + ' , ' + String(Math.round(H[i] * 1e5) / 1e5))];
}
// Liefert den Dateitext und die Zeilennummern der Namen (die dürfen beim Ursprung-Verschieben nicht umgerechnet werden)
function buildListFile(kind) {
  const f = kind === 'tracks' ? 'TrackLines.txt' : 'Headlines.txt', head = kind === 'tracks' ? '$TrackLines' : '$HeadLines';
  const l = txtLines(files[f] || head), out = [l[0] && l[0].trim().startsWith('$') ? l[0] : head], names = new Set();
  ex[kind].forEach(e => {
    if (e.deleted) return;
    const block = e.isNew || e.modified ? (kind === 'headlines' ? headlineBlock(e) : trackBlock(e)) : l.slice(e.line, e.end);
    if (e.name.trim()) block[0] = e.name.trim();
    names.add(out.length);
    out.push(...block);
  });
  return { text: out.join('\r\n') + '\r\n', names };
}

$('btnNewOuter').onclick = () => startDrawBoundary(false);
$('btnNewInner').onclick = () => startDrawBoundary(true);
$('btnNewAB').onclick = () => startDrawAB();             // steht in 11-new-field.js
