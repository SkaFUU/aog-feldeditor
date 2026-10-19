// AOG Feldeditor – Geometrie wie AgOpenGPS 6.8: Vorgewende, Fahrgassen, Versatz, Schnitte (ohne Bedienung)

// ---------- Vorgewende und Fahrgassen (gerechnet wie AgOpenGPS 6.8) ----------
// Erzeugte Dateien: Name → Funktion, die den Text im aktuellen Ursprung liefert (ersetzt die Datei beim Speichern)
const generated = {};
const r5 = x => String(Math.round(x * 1e5) / 1e5);
const dSq = (a, b) => (a.e - b.e) ** 2 + (a.n - b.n) ** 2;
const wrapPi = a => a > Math.PI ? a - 2 * Math.PI : a < -Math.PI ? a + 2 * Math.PI : a;

// Grenze so, wie AOG sie hat: unveränderte Grenze mit den Richtungen aus der Datei, sonst aufbereitet wie beim Speichern
function aogFence(idx) {
  const b = bnds[idx];
  if (!b.dirty && b.orig.length === b.pts.length) {
    const F = b.orig.map((line, i) => ({ e: b.pts[i].e, n: b.pts[i].n, h: parseFloat(line.split(',')[2]) }));
    if (F.every(p => isFinite(p.h))) return F;
  }
  return prepareFence(b.pts, idx);
}
// fenceLineEar: ausgedünnte Grenze für „liegt im Feld“ (Richtungsänderung > 0,005 rad)
function fenceEar(F) {
  const out = [F[0]]; let d = 0;
  for (let i = 1; i < F.length; i++) { d += F[i - 1].h - F[i].h; if (Math.abs(d) > 0.005) { out.push(F[i]); d = 0; } }
  return out;
}
function inPoly(q, P) {
  let c = false;
  for (let i = 0, j = P.length - 1; i < P.length; j = i++)
    if ((P[i].n > q.n) !== (P[j].n > q.n) && q.e < (P[j].e - P[i].e) * (q.n - P[i].n) / (P[j].n - P[i].n) + P[i].e) c = !c;
  return c;
}
// Raster für die Frage „liegt ein Punkt näher als r an einem dieser Punkte?“
function grid(P, cell) {
  cell = Math.max(cell, 1);
  const m = new Map(), key = (i, j) => i * 1000003 + j;
  P.forEach(p => { const k = key(Math.floor(p.e / cell), Math.floor(p.n / cell)); if (!m.has(k)) m.set(k, []); m.get(k).push(p); });
  return {
    near(q, r2) {
      if (!(r2 > 0)) return false;
      const r = Math.sqrt(r2);
      for (let i = Math.floor((q.e - r) / cell); i <= Math.floor((q.e + r) / cell); i++)
        for (let j = Math.floor((q.n - r) / cell); j <= Math.floor((q.n + r) / cell); j++) {
          const a = m.get(key(i, j));
          if (a) for (const p of a) if (dSq(p, q) < r2) return true;
        }
      return false;
    }
  };
}
// MakePointMinimumSpacing: zu lange Abstände so oft halbieren, bis sie ≤ sp sind
function minSpacing(L, sp) {
  if (L.length <= 3) return L;
  const out = [];
  for (let i = 0; i < L.length; i++) {
    out.push(L[i]);
    if (i + 1 === L.length) break;
    const a = L[i], b = L[i + 1], d = dist(a, b);
    let k = 1; while (d / k > sp) k *= 2;
    for (let j = 1; j < k; j++) out.push({ e: a.e + (b.e - a.e) * j / k, n: a.n + (b.n - a.n) * j / k, h: a.h });
  }
  return out;
}
// CalculateHeadings einer offenen Linie
function openHeadings(L) {
  const n = L.length;
  if (n <= 3) return L;
  const h = (a, b) => normH(Math.atan2(b.e - a.e, b.n - a.n));
  return L.map((p, i) => ({ e: p.e, n: p.n, h: i === 0 ? h(L[0], L[1]) : i === n - 1 ? h(L[n - 2], L[n - 1]) : h(L[i - 1], L[i + 1]) }));
}
const offIn = (p, h, d) => ({ e: p.e - d * Math.cos(h), n: p.n + d * Math.sin(h) });      // links der Fahrtrichtung = ins Feld
const offRight = (p, h, d) => ({ e: p.e + d * Math.cos(h), n: p.n - d * Math.sin(h) });   // rechts der Fahrtrichtung

// „Build Around“: jeden Grenzpunkt um d nach innen, zu nahe Punkte verwerfen (so fallen Ecken und Schleifen weg)
function buildAround(F, d) {
  if (!(d > 0)) return F.map(p => ({ ...p }));
  const g = grid(F, d), out = [];
  for (const p of F) {
    const q = offIn(p, p.h, d);
    if (g.near(q, d * d * 0.999)) continue;
    if (!out.length || dSq(q, out[out.length - 1]) > 1) out.push(q);
  }
  if (out.length < 4) return out;
  out.push({ ...out[0] }, { ...out[0] });              // AOG schließt mit dem ersten Punkt (zweimal)
  return openHeadings(minSpacing(out, 1.2));
}
// Wie oben, aber die Ecken mit Radius r gerundet: um d + r nach innen, dann um r nach außen mit Bögen in den Ecken
function roundedAround(F, d, r) {
  const base = buildAround(F, d + r);
  while (base.length > 3 && dSq(base[0], base[base.length - 1]) < 1e-6) base.pop();
  const n = base.length;
  if (n < 4) return buildAround(F, d);
  // Prüfpunkte alle 0,3 m entlang der inneren Linie, damit kein Bogenpunkt zwischen zwei Punkten zu nah kommt
  const g = grid(minSpacing(base.concat([base[0]]), 0.3), r), raw = [];
  for (let i = 0; i < n; i++) {
    const p = base[i], a = base[(i - 1 + n) % n], c = base[(i + 1) % n];
    const hin = Math.atan2(p.e - a.e, p.n - a.n), dh = wrapPi(Math.atan2(c.e - p.e, c.n - p.n) - hin);
    const steps = Math.max(1, Math.ceil(Math.abs(dh) * r / 0.5));
    for (let s = 0; s <= steps; s++) raw.push(offRight(p, hin + dh * s / steps, r));
  }
  const out = [], gF = grid(F, d);                       // und nie näher als d an der Grenze (einspringende Ecken)
  for (const q of raw) {
    if (g.near(q, r * r * 0.999) || gF.near(q, d * d * 0.999) || inPoly(q, base)) continue;
    if (!out.length || dSq(q, out[out.length - 1]) > 1) out.push(q);
  }
  if (out.length < 4) return out;
  out.push({ ...out[0] }, { ...out[0] });
  return openHeadings(minSpacing(out, 1.2));
}
const aroundRing = (F, d, r) => r > 0 ? roundedAround(F, d, r) : buildAround(F, d);
// Beim Schließen des Vorgewende-Dialogs: Richtung rückwärts, nach Richtungsänderung ausdünnen (genau wie AOG)
// noThin: nicht ausdünnen (Teilstück – die Teile auf der Grenze müssen der Grenze genau folgen)
function hdExit(L, keepLast, noThin) {
  const n = L.length, H = L.map(p => ({ e: p.e, n: p.n, h: p.h || 0 }));
  for (let i = 1; i < n; i++) {
    H[i - 1].h = Math.atan2(H[i - 1].e - H[i].e, H[i - 1].n - H[i].n);
    if (H[i].h < 0) H[i].h += 2 * Math.PI;
  }
  if (noThin) return H;
  const out = [H[0]]; let d = 0;
  for (let i = 1; i < n; i++) { d += H[i - 1].h - H[i].h; if (Math.abs(d) > 0.005) { out.push(H[i]); d = 0; } }
  if (keepLast && n > 1) out.push(H[n - 1]);
  return out;
}
function segCross(a, b, c, d) {
  const r = { e: b.e - a.e, n: b.n - a.n }, s = { e: d.e - c.e, n: d.n - c.n }, den = r.e * s.n - r.n * s.e;
  if (!den) return false;
  const t1 = ((c.e - a.e) * s.n - (c.n - a.n) * s.e) / den, t2 = ((c.e - a.e) * r.n - (c.n - a.n) * r.e) / den;
  return t1 >= 0 && t1 <= 1 && t2 >= 0 && t2 <= 1;
}
// Teilstück: Vorgewende an einer Seite neu setzen. Die Quelllinie (Grenzstück oder Spur) wird über das Feld hinaus
// verlängert, um den Abstand ins Feld versetzt und mit dem vorhandenen Vorgewende (ohne Vorgewende: mit der Grenze)
// geschnitten. Zwischen den beiden Schnittpunkten um die Mitte der Linie ersetzt sie das alte Stück.
function extendStraight(P, ext) {
  const a = P[0], b = P[P.length - 1], pre = [], post = [];
  for (let d = ext; d >= 2; d -= 2) pre.push({ e: a.e - Math.sin(a.h) * d, n: a.n - Math.cos(a.h) * d, h: a.h });
  for (let d = 2; d <= ext; d += 2) post.push({ e: b.e + Math.sin(b.h) * d, n: b.n + Math.cos(b.h) * d, h: b.h });
  return { R: pre.concat(P, post), mid: pre.length + (P.length >> 1) };
}
// Liegt ein angeklickter Punkt knapp hinter einer Ecke, gehört ein Stück der Nachbarseite dazu – die Verlängerung würde dann
// an der Nachbarseite entlanglaufen. Eine Ecke in den ersten/letzten 25 m wird deshalb abgeschnitten.
function trimEndCorners(P) {
  const n = P.length, turnAt = i => { const a = P[Math.max(0, i - 3)], b = P[i], c = P[Math.min(n - 1, i + 3)]; return Math.abs(wrapPi(Math.atan2(c.e - b.e, c.n - b.n) - Math.atan2(b.e - a.e, b.n - a.n))); };
  let s = 0, e = n - 1, d = 0;
  for (let i = 1; i < n - 1 && d < 25; i++) { d += dist(P[i - 1], P[i]); if (turnAt(i) > 0.6) s = i; }
  d = 0;
  for (let i = n - 2; i > 0 && d < 25; i--) { d += dist(P[i + 1], P[i]); if (turnAt(i) > 0.6) e = i; }
  return e - s >= 3 ? P.slice(s, e + 1) : P;
}
// Seite, auf der das Feld liegt (+1 rechts, −1 links der Linie)
function inwardSide(P, F) {
  const m = P[P.length >> 1], r = offRight(m, m.h, 4), l = offIn(m, m.h, 4), ri = inPoly(r, F), li = inPoly(l, F);
  if (ri !== li) return ri ? 1 : -1;
  return dSq(r, nearestOn(r, F.concat([F[0]]))) >= dSq(l, nearestOn(l, F.concat([F[0]]))) ? 1 : -1;
}
function spliceHeadland(H, S, midIdx) {
  const n = H.length, X = [];
  for (let i = 0; i + 1 < S.length; i++) {
    const a = S[i], b = S[i + 1], r = { e: b.e - a.e, n: b.n - a.n };
    for (let k = 0; k < n; k++) {
      const c = H[k], d = H[(k + 1) % n];
      if (Math.max(c.e, d.e) < Math.min(a.e, b.e) || Math.min(c.e, d.e) > Math.max(a.e, b.e) || Math.max(c.n, d.n) < Math.min(a.n, b.n) || Math.min(c.n, d.n) > Math.max(a.n, b.n)) continue;
      const s = { e: d.e - c.e, n: d.n - c.n }, den = r.e * s.n - r.n * s.e;
      if (!den) continue;
      const t1 = ((c.e - a.e) * s.n - (c.n - a.n) * s.e) / den, u = ((c.e - a.e) * r.n - (c.n - a.n) * r.e) / den;
      if (t1 >= 0 && t1 < 1 && u >= 0 && u < 1) X.push({ s: i + t1, h: k + u, pt: { e: a.e + r.e * t1, n: a.n + r.n * t1 } });
    }
  }
  const before = X.filter(x => x.s < midIdx).sort((p, q) => q.s - p.s)[0], after = X.filter(x => x.s >= midIdx).sort((p, q) => p.s - q.s)[0];
  if (!before || !after) return null;
  // Stück des Vorgewendes von h1 nach h2 (vorwärts im Ring)
  const arc = (h1, h2) => {
    const out = [], i1 = Math.floor(h1), i2 = Math.floor(h2);
    let k = (i1 + 1) % n, guard = 0;
    const end = (i2 + 1) % n;
    if (!(i1 === i2 && h2 > h1)) while (k !== end && guard++ <= n) { out.push(H[k]); k = (k + 1) % n; }
    return out;
  };
  const seg = [before.pt].concat(S.slice(Math.floor(before.s) + 1, Math.floor(after.s) + 1), [after.pt]);
  const A = [before.pt].concat(arc(before.h, after.h), [after.pt]), B = [after.pt].concat(arc(after.h, before.h), [before.pt]);
  const mid = seg[seg.length >> 1], dMid = P => dSq(P[P.length >> 1], nearestOn(P[P.length >> 1], seg));
  // ersetzt wird das Stück, das an der Linie liegt; das andere bleibt
  const ring = dMid(A) <= dMid(B) ? seg.concat(B.slice(1, -1)) : A.concat(seg.slice(1, -1).reverse());
  return { ring, seg, mid };
}
// ReducePointsByAngle(0.01, 100) auf Fahrgassen
function reduceByAngle(P, ang, spread) {
  if (P.length < 6) return P;
  const out = [], s2 = spread * spread * 0.95, n = P.length;
  let delta = 0, dsum = 0, last = P[0];
  for (let i = 0; i < n; i++) {
    if (i < 2 || i > n - 3) { out.push(P[i]); continue; }
    const h1 = Math.atan2(P[i - 2].e - P[i - 1].e, P[i - 2].n - P[i - 1].n), h2 = Math.atan2(P[i - 1].e - P[i].e, P[i - 1].n - P[i].n);
    delta += wrapPi(h1 - h2); dsum += dSq(last, P[i]); last = P[i];
    if (Math.abs(delta) > ang || dsum >= s2) { out.push(P[i]); delta = 0; dsum = 0; }
  }
  return out;
}
// Geschlossene Linie um w parallel versetzen (dir > 0 nach innen, < 0 nach außen), Schleifen fallen weg
function offsetRing(C, w, dir) {
  const R = C.slice();
  while (R.length > 3 && dSq(R[0], R[R.length - 1]) < 1e-6) R.pop();
  const n = R.length;
  if (n < 4 || !(w > 0)) return C;
  const H = R.map((p, i) => Math.atan2(R[(i + 1) % n].e - R[(i - 1 + n) % n].e, R[(i + 1) % n].n - R[(i - 1 + n) % n].n));
  const g = grid(minSpacing(R.concat([R[0]]), 0.3), w), out = [];
  R.forEach((p, i) => {
    const q = dir > 0 ? offIn(p, H[i], w) : offRight(p, H[i], w);
    if (g.near(q, w * w * 0.999)) return;
    if (!out.length || dSq(q, out[out.length - 1]) > 0.25) out.push(q);
  });
  if (out.length < 4) return out;
  out.push({ ...out[0] });
  return minSpacing(out, 1.2);
}
// Randfahrgasse: Radius 0 wie AOG (jede Spur einzeln von der Grenze), mit Radius erst die Mitte, dann beide Spuren genau parallel
// Mehrere Randfahrgassen (Anzahl): Ring k mit der Mitte bei Abstand · (k + ½) von der Grenze.
// Der erste Ring kommt in Tram.txt als Randfahrgasse, weitere als geschlossene Fahrgassen (extra).
function buildTramRing(c) {
  const none = { outer: [], inner: [], extra: [], tracks: [] };
  if (!bnds[0]) return none;
  const F = aogFence(0), tw = c.tramWidth, hw = c.trackWidth / 2, n = Math.max(1, Math.round(c.ringCount || 1)), xy = P => P.map(p => ({ e: p.e, n: p.n }));
  const rings = [];                                        // je Ring [außen, innen]
  let rFail = false;
  if (!(c.radius > 0)) {
    for (let k = 0; k < n; k++) {
      const o = xy(buildAround(F, tw * (0.5 + k) - hw)), i = xy(buildAround(F, tw * (0.5 + k) + hw));
      if (o.length < 4 || i.length < 4) break;
      rings.push([o, i]);
    }
  } else {
    const mid = roundedAround(F, 0.5 * tw, c.radius);
    if (mid.length < 4) return none;
    rFail = buildAround(F, 0.5 * tw + c.radius).length < 4;
    for (let k = 0; k < n; k++) {
      const m = k ? offsetRing(mid, tw * k, 1) : mid;        // weitere Ringe genau parallel nach innen
      const o = xy(offsetRing(m, hw, -1)), i = xy(offsetRing(m, hw, 1));
      if (o.length < 4 || i.length < 4) break;
      rings.push([o, i]);
    }
  }
  if (!rings.length) return none;
  return { outer: rings[0][0], inner: rings[0][1], extra: rings.slice(1).flat(), innermost: rings[rings.length - 1][1], count: rings.length, rFail };
}
// Referenzlinie für Fahrgassen: AB-Linie oder Kurve, an beiden Enden gerade verlängert, damit die Fahrgassen bis zur Grenze reichen
function refLine(tr) {
  let ext = 300;
  if (bnds[0]) { const es = bnds[0].pts.map(p => p.e), ns = bnds[0].pts.map(p => p.n); ext = Math.hypot(Math.max(...es) - Math.min(...es), Math.max(...ns) - Math.min(...ns)) + 50; }
  const along = (p, h, d) => ({ e: p.e + Math.sin(h) * d, n: p.n + Math.cos(h) * d, h });
  if (tr.mode === 2) {
    const toP = v => { const [la, lo] = wgs(v[0], v[1]); return plane.fwd(la, lo); };
    const A = toP(tr.a), B = toP(tr.b), out = [];
    for (let d = -ext; d <= dist(A, B) + ext; d += 2) out.push(along(A, tr.heading, d));
    return out;
  }
  const P = openHeadings(tr.pts.map(([la, lo]) => plane.fwd(la, lo))), a = P[0], b = P[P.length - 1], pre = [], post = [];
  for (let d = ext; d >= 2; d -= 2) pre.push(along(a, a.h, -d));
  for (let d = 2; d <= ext; d += 2) post.push(along(b, b.h, d));
  return pre.concat(P, post);
}
// Linie um w versetzen (w > 0 rechts, < 0 links); Schleifen in engen Bögen fallen weg wie in AOG
function offsetLine(R, w) {
  const a = Math.abs(w), g = grid(R, Math.max(a, 2)), out = [];
  for (const p of R) {
    const q = offRight(p, p.h, w);
    if (a > 0.01 && g.near(q, a * a * 0.999999)) continue;
    if (!out.length || dSq(q, out[out.length - 1]) > 1.2) out.push(q);
  }
  return out;
}
// Polygon mit Kanten-Raster: schnelle Schnittpunkte einer Linie mit der Grenze
function polyIndex(P) {
  P = P.filter((p, i) => i === 0 || dSq(p, P[i - 1]) > 1e-8);
  const cell = 20, m = new Map(), n = P.length, key = (i, j) => i * 1000003 + j, f = Math.floor;
  const cells = (a, b, fn) => { for (let i = f(Math.min(a.e, b.e) / cell); i <= f(Math.max(a.e, b.e) / cell); i++) for (let j = f(Math.min(a.n, b.n) / cell); j <= f(Math.max(a.n, b.n) / cell); j++) fn(key(i, j)); };
  for (let k = 0; k < n; k++) cells(P[k], P[(k + 1) % n], kk => { if (!m.has(kk)) m.set(kk, []); m.get(kk).push(k); });
  return {
    inside: q => inPoly(q, P),
    cross(a, b) {
      const seen = new Set(), ts = [], r = { e: b.e - a.e, n: b.n - a.n };
      cells(a, b, kk => {
        for (const k of m.get(kk) || []) {
          if (seen.has(k)) continue;
          seen.add(k);
          const c = P[k], d = P[(k + 1) % n], s = { e: d.e - c.e, n: d.n - c.n }, den = r.e * s.n - r.n * s.e;
          if (!den) continue;
          const t1 = ((c.e - a.e) * s.n - (c.n - a.n) * s.e) / den, u = ((c.e - a.e) * r.n - (c.n - a.n) * r.e) / den;
          if (t1 >= 0 && t1 < 1 && u >= 0 && u < 1) ts.push(t1);
        }
      });
      return ts.sort((x, y) => x - y);
    }
  };
}
const pathLen = L => { let s = 0; for (let i = 1; i < L.length; i++) s += dist(L[i - 1], L[i]); return s; };
// Teile einer Linie innerhalb des Polygons, genau an der Kante abgeschnitten
function clipToPoly(L, X) {
  if (L.length < 2) return [];
  const out = [];
  let ins = X.inside(L[0]), cur = ins ? [L[0]] : null;
  for (let i = 1; i < L.length; i++) {
    const a = L[i - 1], b = L[i];
    for (const t1 of X.cross(a, b)) {
      const q = { e: a.e + (b.e - a.e) * t1, n: a.n + (b.n - a.n) * t1 };
      if (ins) { cur.push(q); out.push(cur); cur = null; } else cur = [q];
      ins = !ins;
    }
    if (ins) cur.push(b);
  }
  if (cur) out.push(cur);
  return out.filter(s => s.length > 1 && pathLen(s) > 3);
}
// Rahmen für ein Fahrgassen-Werkzeug: Grenze, auf Wunsch Randfahrgasse (die Linien enden dann an ihrer inneren Spur)
function tramContext(c, withRing) {
  const F = bnds[0] ? aogFence(0) : null, ring = withRing && F ? buildTramRing(c) : null;
  const XF = F ? polyIndex(F) : null, useRing = ring && ring.inner.length > 3;
  // r2: Fahrgassen, die überwiegend so nah an der Grenze liegen, fallen auf eine Randfahrgasse und werden ausgelassen
  return { F, XF, ring: useRing ? ring : null, X: useRing ? polyIndex(ring.innermost) : XF, gF: useRing ? grid(F, c.tramWidth) : null,
    r2: useRing ? ((ring.count - 0.25) * c.tramWidth) ** 2 : 0 };
}
// Fahrgasse Nr. k (Mitte bei Abstand · (k + ½)) neben der Referenz R auf Seite side, beide Spuren abgeschnitten.
// [] = liegt außerhalb des Feldes, null = liegt auf der Randfahrgasse und wird ausgelassen
function tramPair(R, k, side, c, ctx) {
  const wc = c.tramWidth * (0.5 + k), hw = c.trackWidth / 2;
  const clip = L => ctx.X ? clipToPoly(L, ctx.X) : (L.length > 1 ? [L] : []);
  if (ctx.gF) {
    const mid = clipToPoly(offsetLine(R, side * wc), ctx.XF).flat();
    if (!mid.length) return [];
    if (mid.filter(p => ctx.gF.near(p, ctx.r2)).length > mid.length * 0.5) return null;
  }
  return clip(offsetLine(R, side * (wc - hw))).concat(clip(offsetLine(R, side * (wc + hw))));
}
// Nur die Mittellinien der Fahrgassen (für „Zusammenführen“): je das längste Stück im Feld
function tramCenters(R, side, count, c, ctx) {
  const out = [];
  let kept = 0, empty = 0;
  for (let k = 0; k < 400 && kept < count && empty < 3; k++) {
    const C = offsetLine(R, side * c.tramWidth * (0.5 + k)), inF = ctx.XF ? clipToPoly(C, ctx.XF) : [C];
    if (!inF.length) { empty++; continue; }
    if (ctx.gF) { const m = inF.flat(); if (m.filter(p => ctx.gF.near(p, ctx.r2)).length > m.length * 0.5) continue; }
    empty = 0; kept++;
    out.push(inF.reduce((a, b) => pathLen(b) > pathLen(a) ? b : a));
  }
  return out;
}
// Aus einer Mittellinie die zwei Spuren (± halbe Spurweite), an den Enden verlängert und an Grenze/Randfahrgasse abgeschnitten
// cut: die Mittellinie endet an einem Schnittpunkt (gekürzt) – dort nicht verlängern
function tracksFromCenter(C, c, ctx, cut) {
  if (C.length < 2) return [];
  const P = openHeadings(minSpacing(C.map(p => ({ e: p.e, n: p.n, h: 0 })), 2)), a = P[0], b = P[P.length - 1], pre = [], post = [];
  for (let d = 40; d >= 2; d -= 2) pre.push({ e: a.e - Math.sin(a.h) * d, n: a.n - Math.cos(a.h) * d, h: a.h });
  if (!cut) for (let d = 2; d <= 40; d += 2) post.push({ e: b.e + Math.sin(b.h) * d, n: b.n + Math.cos(b.h) * d, h: b.h });
  const R = pre.concat(P, post), hw = c.trackWidth / 2, clip = L => ctx.X ? clipToPoly(L, ctx.X) : [L];
  // Wo die Spur wegfällt (z. B. innen an der Spitze eines V), wird sie getrennt statt quer verbunden
  const split = L => { const out = [[]]; L.forEach((p, i) => { if (i && dSq(p, L[i - 1]) > 9) out.push([]); out[out.length - 1].push(p); }); return out.filter(s => s.length > 1); };
  return split(offsetLine(R, -hw)).flatMap(clip).concat(split(offsetLine(R, hw)).flatMap(clip));
}
// Erster Schnittpunkt zweier offener Linien
function firstCross(P, Q) {
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1], r = { e: b.e - a.e, n: b.n - a.n };
    for (let j = 0; j + 1 < Q.length; j++) {
      const c = Q[j], d = Q[j + 1];
      if (Math.max(c.e, d.e) < Math.min(a.e, b.e) || Math.min(c.e, d.e) > Math.max(a.e, b.e) || Math.max(c.n, d.n) < Math.min(a.n, b.n) || Math.min(c.n, d.n) > Math.max(a.n, b.n)) continue;
      const s = { e: d.e - c.e, n: d.n - c.n }, den = r.e * s.n - r.n * s.e;
      if (!den) continue;
      const t1 = ((c.e - a.e) * s.n - (c.n - a.n) * s.e) / den, u = ((c.e - a.e) * r.n - (c.n - a.n) * r.e) / den;
      if (t1 >= 0 && t1 <= 1 && u >= 0 && u <= 1) return { i, j, pt: { e: a.e + r.e * t1, n: a.n + r.n * t1 } };
    }
  }
  return null;
}
// „Kürzen“ (T-Kreuzung): von innen gezählt endet die Fahrgasse der gekürzten Seite am Schnittpunkt mit ihrer Partnerin von der
// anderen Seite, die andere läuft durch – so lange sich die Paare kreuzen. Behalten wird das Stück, das weiter von der anderen
// Linie weg liegt. which: 1 = Linie 1 kürzen, 2 = Linie 2 kürzen. Ergebnis: [{ C, cut }] (cut = endet am Schnittpunkt)
function trimCenters(CA, CB, RA, RB, which) {
  const [Tc, O, RO] = which === 1 ? [CA, CB, RB] : [CB, CA, RA];
  const s = RO.filter((_, i) => i % 2 === 0), dO = q => { let m = Infinity; for (const p of s) m = Math.min(m, dSq(p, q)); return m; };
  const res = Tc.map(C => ({ C, cut: false }));
  for (let m = 0; m < Math.min(Tc.length, O.length); m++) {
    const it = Tc.length - 1 - m, x = firstCross(Tc[it], O[O.length - 1 - m]);
    if (!x) break;                                         // weiter außen kreuzen sie sich nicht mehr
    const P = Tc[it], h1 = P.slice(0, x.i + 1).concat([x.pt]), h2 = [x.pt].concat(P.slice(x.i + 1));
    res[it] = { C: dO(h1[0]) >= dO(h2[h2.length - 1]) ? h1 : h2.reverse(), cut: true };   // endet am Schnittpunkt
  }
  return res.concat(O.map(C => ({ C, cut: false })));
}
// Nächster Punkt auf einer Linie
function nearestOn(p, P) {
  let best = P[0], bd = Infinity;
  for (let i = 0; i + 1 < P.length; i++) {
    const a = P[i], b = P[i + 1], dx = b.e - a.e, dy = b.n - a.n, l2 = dx * dx + dy * dy;
    const t1 = l2 ? Math.max(0, Math.min(1, ((p.e - a.e) * dx + (p.n - a.n) * dy) / l2)) : 0, q = { e: a.e + t1 * dx, n: a.n + t1 * dy }, d = dSq(p, q);
    if (d < bd) { bd = d; best = q; }
  }
  return best;
}
const bbox = P => { let a = Infinity, b = -Infinity, c = Infinity, d = -Infinity; P.forEach(p => { a = Math.min(a, p.e); b = Math.max(b, p.e); c = Math.min(c, p.n); d = Math.max(d, p.n); }); return [a, b, c, d]; };
// Spuren zu Fahrgassen paaren (zwei Spuren im Abstand der Spurweite) und deren Mittellinie bilden; einzelne Spuren bleiben für sich
// Bewertung: welcher Anteil der einen Spur liegt im Abstand der Spurweite (±0,3 m) neben der anderen – so passen auch
// verschieden lange oder geteilte Spuren zusammen. Die Mittellinie entsteht nur dort, wo beide nebeneinander liegen.
// Linie gleichmäßig verdichten (auch bei nur 2–3 Punkten, anders als minSpacing wie in AOG)
const densify = (L, sp) => { const o = []; L.forEach((p, i) => { if (i) { const a = L[i - 1], k = Math.ceil(dist(a, p) / sp); for (let j = 1; j < k; j++) o.push({ e: a.e + (p.e - a.e) * j / k, n: a.n + (p.n - a.n) * j / k, h: 0 }); } o.push({ e: p.e, n: p.n, h: 0 }); }); return o; };
function trackPairs(TL, c) {
  const sw = c.trackWidth, n = TL.length, B = TL.map(bbox), used = new Set(), out = [];
  const S = TL.map(P => { if (P.length < 2) return []; const D = minSpacing(P.map(p => ({ e: p.e, n: p.n, h: 0 })), 3), st = Math.max(1, Math.floor(D.length / 24)); return D.filter((_, i) => i % st === 0); });
  const near = (i, j) => B[i][0] - 1 - sw <= B[j][1] && B[j][0] - 1 - sw <= B[i][1] && B[i][2] - 1 - sw <= B[j][3] && B[j][2] - 1 - sw <= B[i][3];
  const score = (i, j) => { if (!S[i].length) return 0; let m = 0; for (const p of S[i]) if (Math.abs(Math.sqrt(dSq(p, nearestOn(p, TL[j]))) - sw) < 0.3) m++; return m / S[i].length; };
  const cand = [];
  for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
    if (TL[i].length < 2 || TL[j].length < 2 || !near(i, j)) continue;
    const sc = Math.max(score(i, j), score(j, i));
    if (sc >= 0.6) cand.push({ i, j, sc });
  }
  cand.sort((a, b) => b.sc - a.sc);
  for (const { i, j } of cand) {
    if (used.has(i) || used.has(j)) continue;
    used.add(i); used.add(j);
    const [P, Q] = pathLen(TL[i]) <= pathLen(TL[j]) ? [TL[i], TL[j]] : [TL[j], TL[i]];      // von der kürzeren aus
    const center = [];
    densify(P, 2).forEach(p => {
      const q = nearestOn(p, Q);
      if (Math.abs(Math.sqrt(dSq(p, q)) - sw) < 0.5) center.push({ e: (p.e + q.e) / 2, n: (p.n + q.n) / 2 });
    });
    out.push({ center: center.length > 1 ? center : P, tracks: [i, j] });
  }
  TL.forEach((P, i) => { if (!used.has(i) && P.length > 1) out.push({ center: P, tracks: [i] }); });
  return out;
}
// Arbeitsbreite als Fläche: je Fahrgasse ein Band der Breite „Abstand“ um die Mitte, Randfahrgasse als Ring
function bandPolys(TL, ring, c) {
  const half = c.tramWidth / 2, polys = [];
  trackPairs(TL, c).forEach(({ center, tracks }) => {
    if (center.length < 2 || tracks.length < 2) return;            // nur echte Fahrgassen (Paare), nicht jede Spur einzeln
    if (center.length > 3 && dSq(center[0], center[center.length - 1]) < 4 && pathLen(center) > 50) {   // geschlossener Ring
      const o = offsetRing(center, half, -1), i = offsetRing(center, half, 1);
      if (o.length > 3) polys.push(i.length > 3 ? [o, i] : [o]);
      return;
    }
    const R = openHeadings(minSpacing(center.map(p => ({ e: p.e, n: p.n, h: 0 })), 2)), l = offsetLine(R, -half), r = offsetLine(R, half);
    if (l.length > 1 && r.length > 1) polys.push([l.concat(r.reverse())]);
  });
  if (ring && ring.outer.length > 3) {
    const d = half - c.trackWidth / 2, o = d > 0 ? offsetRing(ring.outer, d, -1) : ring.outer, i = d > 0 ? offsetRing(ring.inner, d, 1) : ring.inner;
    if (o.length > 3) polys.push([o, i]);
  }
  return polys;
}
const drawBands = (g, polys) => polys.forEach(rs => L.polygon(rs.map(r => r.map(ll)), { renderer: cv, stroke: false, fillColor: '#29b6f6', fillOpacity: .32, interactive: false }).addTo(g));
// count Fahrgassen nebeneinander (Infinity = bis das Feld zu Ende ist)
function tramAlong(R, side, count, c, ctx) {
  const out = [];
  let kept = 0, empty = 0;
  for (let k = 0; k < 400 && kept < count && empty < 3; k++) {
    const p = tramPair(R, k, side, c, ctx);
    if (p === null) continue;
    if (!p.length) { empty++; continue; }
    empty = 0; kept++; out.push(...p);
  }
  return out;
}
// Mathematische Mitte zwischen zwei Linien (AB oder Kurve): zu jedem Punkt der einen der nächste der anderen, davon die Mitte
function midLine(RA, RB) {
  const out = [];
  RA.forEach(p => {
    let m = { e: (p.e + nearestOn(p, RB).e) / 2, n: (p.n + nearestOn(p, RB).n) / 2, h: 0 };
    // bei Kurven nachbessern: den Punkt so weit verschieben, bis er von beiden Linien gleich weit weg ist
    for (let k = 0; k < 6; k++) {
      const a = nearestOn(m, RA), b = nearestOn(m, RB), dA = Math.sqrt(dSq(m, a)), dB = Math.sqrt(dSq(m, b)), L1 = Math.sqrt(dSq(a, b)) || 1;
      if (Math.abs(dA - dB) < 0.005) break;
      const s = (dB - dA) / 2 / L1; m = { e: m.e + (b.e - a.e) * s, n: m.n + (b.n - a.n) * s, h: 0 };
    }
    if (!out.length || dSq(m, out[out.length - 1]) > 0.25) out.push(m);
  });
  return out.length > 3 ? openHeadings(minSpacing(out, 2)) : out;
}
// Zwei Referenzlinien: Seite zur anderen Linie hin und Abstand dazwischen (Median im Feld)
function twoGeo(RA, RB, XF) {
  const inA = XF ? RA.filter(p => XF.inside(p)) : RA, pts = inA.length ? inA : RA;
  const sb = RB.filter((_, i) => i % 2 === 0);
  const dB = q => { let m = Infinity; for (const p of sb) m = Math.min(m, dSq(p, q)); return Math.sqrt(m); };
  const mA = pts[pts.length >> 1], sA = dB(offRight(mA, mA.h, 1)) < dB(mA) ? 1 : -1;
  const sample = pts.filter((_, i) => i % Math.max(1, Math.floor(pts.length / 40)) === 0).map(dB).sort((x, y) => x - y);
  const D = sample[sample.length >> 1] || 0;
  const sa = RA.filter((_, i) => i % 2 === 0), dA = q => { let m = Infinity; for (const p of sa) m = Math.min(m, dSq(p, q)); return Math.sqrt(m); };
  const inB = XF ? RB.filter(p => XF.inside(p)) : RB, ptsB = inB.length ? inB : RB, mB = ptsB[ptsB.length >> 1];
  const sB = dA(offRight(mB, mB.h, 1)) < dA(mB) ? 1 : -1;
  return { sA, sB, D };
}
