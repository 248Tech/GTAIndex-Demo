/* GTAIndex — route worker. Loads the road graph (derived from the gtadb.org YANIS v16 map, CC BY 4.0)
   and answers {from,to} route requests off the main thread.
   Coordinates are map units [lat, lng]; lat grows SOUTH, lng grows EAST; 1 unit = 32 m. */
'use strict';

var UNIT_M = 32;
var SPEED = [20, 33];         // m/s: street (~72 km/h), highway (~120 km/h)
var WALK = 1.7;               // m/s
var CELL = 2;                 // spatial-index cell, map units (~64 m)

var N = null, E = null, ADJ = null, GRID = null, DISTRICTS = [];

function key(cx, cy) { return cx + ',' + cy; }

function load(graphUrl, districtsUrl) {
  return Promise.all([
    fetch(graphUrl).then(function (r) { return r.json(); }),
    districtsUrl ? fetch(districtsUrl).then(function (r) { return r.ok ? r.json() : []; }).catch(function () { return []; }) : Promise.resolve([])
  ]).then(function (res) {
    var g = res[0], q = g.q || 100;
    DISTRICTS = res[1] || [];
    var n = g.nodes.length / 2;
    N = new Float64Array(g.nodes.length);
    for (var i = 0; i < g.nodes.length; i++) N[i] = g.nodes[i] / q;
    E = new Array(g.edges.length);
    ADJ = new Array(n);
    for (i = 0; i < n; i++) ADJ[i] = [];
    GRID = new Map();
    for (var e = 0; e < g.edges.length; e++) {
      var ed = g.edges[e], a = ed[0], b = ed[1];
      var pts = [[N[a * 2], N[a * 2 + 1]]];
      for (var k = 0; k < ed[4].length; k += 2) pts.push([ed[4][k] / q, ed[4][k + 1] / q]);
      pts.push([N[b * 2], N[b * 2 + 1]]);
      // cumulative length (metres) along the polyline, scaled so the end matches the measured length
      var cum = [0];
      for (k = 1; k < pts.length; k++) cum.push(cum[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]) * UNIT_M);
      var geomLen = cum[cum.length - 1] || 1, len = ed[2] || geomLen;
      for (k = 0; k < cum.length; k++) cum[k] *= len / geomLen;
      E[e] = { a: a, b: b, len: len, type: ed[3], pts: pts, cum: cum,
               name: (g.names && ed[5] !== undefined && ed[5] >= 0) ? g.names[ed[5]] : null,
               hA: headOut(pts, false, 30), hB: headOut(pts.slice().reverse(), false, 30) };   // headings leaving a / leaving b
      ADJ[a].push(e); ADJ[b].push(e);
      for (k = 1; k < pts.length; k++) {   // index every segment in the cells it touches
        var y0 = Math.min(pts[k - 1][0], pts[k][0]), y1 = Math.max(pts[k - 1][0], pts[k][0]);
        var x0 = Math.min(pts[k - 1][1], pts[k][1]), x1 = Math.max(pts[k - 1][1], pts[k][1]);
        for (var cy = Math.floor(y0 / CELL); cy <= Math.floor(y1 / CELL); cy++)
          for (var cx = Math.floor(x0 / CELL); cx <= Math.floor(x1 / CELL); cx++) {
            var kk = key(cx, cy), arr = GRID.get(kk);
            if (!arr) GRID.set(kk, arr = []);
            arr.push(e * 4096 + k);
          }
      }
    }
    // connected networks: route only within one; MAIN = the biggest (islands without a traced bridge are separate)
    var par = new Int32Array(n); for (i = 0; i < n; i++) par[i] = i;
    var find = function (x) { while (par[x] !== x) { par[x] = par[par[x]]; x = par[x]; } return x; };
    E.forEach(function (ed) { par[find(ed.a)] = find(ed.b); });
    var clen = new Map();
    E.forEach(function (ed) { var c = find(ed.a); ed.comp = c; clen.set(c, (clen.get(c) || 0) + ed.len); });
    MAIN = -1; var bestL = -1; clen.forEach(function (L, c) { if (L > bestL) { bestL = L; MAIN = c; } });
    // "significant" degree: ignore short dead-end stubs left by line thinning
    SIGDEG = new Int32Array(n);
    for (i = 0; i < n; i++) {
      var sdeg = 0;
      for (var j = 0; j < ADJ[i].length; j++) {
        var ee = E[ADJ[i][j]], other = ee.a === i ? ee.b : ee.a;
        if (ee.len >= 40 || ADJ[other].length >= 2) sdeg++;
      }
      SIGDEG[i] = sdeg;
    }
    return { nodes: n, edges: E.length };
  });
}
var MAIN = -1, SIGDEG = null;

// nearest point on any road segment to p=[lat,lng] (optionally only roads of network `comp`)
function snap(p, comp) {
  var best = null, cx0 = Math.floor(p[1] / CELL), cy0 = Math.floor(p[0] / CELL);
  var maxR = comp !== undefined ? 80 : 25;             // ~1.6 km normally; up to ~5 km when hunting for the main network
  for (var r = 0; r <= maxR; r++) {
    for (var cy = cy0 - r; cy <= cy0 + r; cy++)
      for (var cx = cx0 - r; cx <= cx0 + r; cx++) {
        if (Math.max(Math.abs(cy - cy0), Math.abs(cx - cx0)) !== r) continue;
        var arr = GRID.get(key(cx, cy)); if (!arr) continue;
        for (var i = 0; i < arr.length; i++) {
          var e = Math.floor(arr[i] / 4096), k = arr[i] % 4096, ed = E[e];
          if (comp !== undefined && ed.comp !== comp) continue;
          var A = ed.pts[k - 1], B = ed.pts[k];
          var dy = B[0] - A[0], dx = B[1] - A[1], L2 = dy * dy + dx * dx;
          var t = L2 ? ((p[0] - A[0]) * dy + (p[1] - A[1]) * dx) / L2 : 0;
          t = Math.max(0, Math.min(1, t));
          var q = [A[0] + t * dy, A[1] + t * dx], d = Math.hypot(p[0] - q[0], p[1] - q[1]);
          if (!best || d < best.d) best = { e: e, k: k, t: t, q: q, d: d };
        }
      }
    if (best && best.d < (r - 1) * CELL) break;         // nothing closer can exist in outer rings
  }
  if (!best) return null;
  var ed2 = E[best.e];
  best.along = ed2.cum[best.k - 1] + best.t * (ed2.cum[best.k] - ed2.cum[best.k - 1]);   // metres from node a
  return best;
}

// tiny binary heap
function Heap() { this.a = []; }
Heap.prototype.push = function (v, p) { var a = this.a; a.push([p, v]); var i = a.length - 1; while (i > 0) { var j = (i - 1) >> 1; if (a[j][0] <= a[i][0]) break; var t = a[i]; a[i] = a[j]; a[j] = t; i = j; } };
Heap.prototype.pop = function () { var a = this.a, top = a[0], last = a.pop(); if (a.length) { a[0] = last; var i = 0; for (;;) { var l = 2 * i + 1, r = l + 1, m = i; if (l < a.length && a[l][0] < a[m][0]) m = l; if (r < a.length && a[r][0] < a[m][0]) m = r; if (m === i) break; var t = a[i]; a[i] = a[m]; a[m] = t; i = m; } } return top; };
Heap.prototype.size = function () { return this.a.length; };

function cost(e) { return E[e].len / SPEED[E[e].type]; }
// seconds lost turning at node u (only at real junctions): straight 0, right ~4 s, left ~7 s (crossing traffic), U-turn ~25 s
function turnCost(u, arriveDir, outHead) {
  if (!SIGDEG || SIGDEG[u] < 3) return 0;
  var d = ((outHead - arriveDir + 540) % 360) - 180, a = Math.abs(d);
  if (a < 30) return 0;
  if (a > 150) return 25;
  return d > 0 ? 4 : 7;
}

// partial-edge polyline from `along` metres toward node a (dir=-1) or node b (dir=+1)
function partial(ed, along, toB) {
  var out = [], pts = ed.pts, cum = ed.cum, k;
  var at = pointAt(ed, along);
  out.push(at);
  if (toB) { for (k = 0; k < pts.length; k++) if (cum[k] > along) out.push(pts[k]); }
  else { for (k = pts.length - 1; k >= 0; k--) if (cum[k] < along) out.push(pts[k]); }
  return out;
}
function pointAt(ed, along) {
  var cum = ed.cum, pts = ed.pts;
  for (var k = 1; k < cum.length; k++) if (cum[k] >= along) {
    var t = (along - cum[k - 1]) / ((cum[k] - cum[k - 1]) || 1);
    return [pts[k - 1][0] + t * (pts[k][0] - pts[k - 1][0]), pts[k - 1][1] + t * (pts[k][1] - pts[k - 1][1])];
  }
  return pts[pts.length - 1];
}

function route(from, to) {
  var sa = snap(from), sb = snap(to), note = null;
  if (!sa || !sb) return { error: 'Too far from any road.' };
  if (E[sa.e].comp !== E[sb.e].comp) {
    // different road networks (e.g. an island whose bridge we couldn't trace, or a ferry-only island):
    // fall back to the nearest roads of the main network
    var fa = E[sa.e].comp === MAIN ? sa : snap(from, MAIN), fb = E[sb.e].comp === MAIN ? sb : snap(to, MAIN);
    if (!fa || !fb) return { error: 'No road connection found between these points.' };
    note = 'One point isn’t linked to the main road network by any road we could trace (an island or ferry-only area), so the route uses the nearest connected road.';
    sa = fa; sb = fb;
  }
  var A = E[sa.e], B = E[sb.e];
  var segs = [];                                   // [{pts, type, len}]
  if (sa.e === sb.e) {                             // both on the same road
    var fwd = sb.along >= sa.along;
    var pts = [pointAt(A, sa.along)];
    for (var k = 0; k < A.pts.length; k++) {
      var c = A.cum[k];
      if (fwd ? (c > sa.along && c < sb.along) : (c < sa.along && c > sb.along)) pts.push(A.pts[k]);
    }
    if (!fwd) pts = [pts[0]].concat(pts.slice(1).reverse());
    pts.push(pointAt(A, sb.along));
    segs.push({ pts: pts, type: A.type, len: Math.abs(sb.along - sa.along), name: A.name });
  } else {
    // Turn-aware A* (fastest route): a state = "arrived at a node via edge e" (s = e*2 + side; side 1 = arrived at e.b),
    // so every junction can charge a realistic turn cost on top of driving time.
    var vmax = SPEED[1];
    var goalY = sb.q[0], goalX = sb.q[1];
    var nodeOf = function (s) { var ee = E[s >> 1]; return (s & 1) ? ee.b : ee.a; };
    var arriveDir = function (s) { var ee = E[s >> 1]; return (((s & 1) ? ee.hB : ee.hA) + 180) % 360; };
    var h = function (s) { var n = nodeOf(s); return Math.hypot(N[n * 2] - goalY, N[n * 2 + 1] - goalX) * UNIT_M / vmax; };
    var g = new Map(), prev = new Map(), heap = new Heap();
    var s0 = sa.e * 2, s1 = sa.e * 2 + 1;
    g.set(s0, sa.along / SPEED[A.type]); prev.set(s0, -1); heap.push(s0, g.get(s0) + h(s0));
    g.set(s1, (A.len - sa.along) / SPEED[A.type]); prev.set(s1, -1); heap.push(s1, g.get(s1) + h(s1));
    var endCost = {}; endCost[B.a] = sb.along / SPEED[B.type]; endCost[B.b] = (B.len - sb.along) / SPEED[B.type];
    var best = Infinity, bestState = -1, done = new Set();
    while (heap.size()) {
      var top = heap.pop(), s = top[1];
      if (done.has(s)) continue; done.add(s);
      if (top[0] >= best) break;
      var u = nodeOf(s), ad = arriveDir(s), gs = g.get(s);
      if (endCost[u] !== undefined) {
        var tot = gs + endCost[u] + turnCost(u, ad, u === B.a ? B.hA : B.hB);
        if (tot < best) { best = tot; bestState = s; }
      }
      var adj = ADJ[u];
      for (var i = 0; i < adj.length; i++) {
        var eo = adj[i]; if (eo === sa.e || eo === sb.e) continue;
        if (eo === (s >> 1) && adj.length > 1) continue;                  // no U-turn back unless it's a dead end
        var leavingA = E[eo].a === u, ns = eo * 2 + (leavingA ? 1 : 0);
        var ng = gs + cost(eo) + turnCost(u, ad, leavingA ? E[eo].hA : E[eo].hB);
        if (!g.has(ns) || ng < g.get(ns)) { g.set(ns, ng); prev.set(ns, s); heap.push(ns, ng + h(ns)); }
      }
    }
    if (bestState < 0) return { error: 'No road connection found between these points (different islands?).' };
    var chain = [], st = bestState;
    while (st !== -1) { chain.push(st); st = prev.get(st); }
    chain.reverse();
    // first partial: from the snap point to the node we left the start edge by
    var firstToB = (chain[0] & 1) === 1;
    segs.push({ pts: partial(A, sa.along, firstToB), type: A.type, len: firstToB ? A.len - sa.along : sa.along, name: A.name });
    for (i = 1; i < chain.length; i++) {
      var ed = E[chain[i] >> 1], fromNode = nodeOf(chain[i - 1]);
      var p2 = ed.a === fromNode ? ed.pts.slice() : ed.pts.slice().reverse();
      segs.push({ pts: p2, type: ed.type, len: ed.len, node: fromNode, name: ed.name });
    }
    // last partial: along the goal edge to the snap point
    var lastNode = nodeOf(bestState);
    var lastPts = partial(B, sb.along, lastNode === B.b).reverse();
    segs.push({ pts: lastPts, type: B.type, len: lastNode === B.b ? B.len - sb.along : sb.along, node: lastNode, name: B.name });
  }
  return { path: segs, walkA: [from, sa.q], walkB: [sb.q, to], walkAm: sa.d * UNIT_M, walkBm: sb.d * UNIT_M, note: note, steps: steps(segs, from, sa, sb, to) };
}

// ---------- turn-by-turn ----------
function bearing(p, q) {                    // 0 = north, 90 = east  (lat grows south)
  var b = Math.atan2(q[1] - p[1], -(q[0] - p[0])) * 180 / Math.PI; return (b + 360) % 360;
}
function compass(b) { return ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'][Math.round(b / 45) % 8]; }
function district(p) {
  var best = null, bd = Infinity;
  for (var i = 0; i < DISTRICTS.length; i++) { var d = Math.hypot(DISTRICTS[i][1] - p[0], DISTRICTS[i][2] - p[1]); if (d < bd) { bd = d; best = DISTRICTS[i][0]; } }
  return bd < 30 ? best : null;
}
function headOut(pts, fromEnd, win) {       // bearing over ~win m (default 60) at the start (or end) of a polyline
  win = win || 60;
  if (!fromEnd) { var a = pts[0], acc = 0; for (var i = 1; i < pts.length; i++) { acc += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]) * UNIT_M; if (acc > win || i === pts.length - 1) return bearing(a, pts[i]); } }
  var z = pts[pts.length - 1], acc2 = 0; for (var j = pts.length - 2; j >= 0; j--) { acc2 += Math.hypot(pts[j + 1][0] - pts[j][0], pts[j + 1][1] - pts[j][1]) * UNIT_M; if (acc2 > win || j === 0) return bearing(pts[j], z); }
  return 0;
}
function fmtM(m) { return m >= 1000 ? (m / 1000).toFixed(m >= 10000 ? 0 : 1) + ' km' : Math.round(m / 5) * 5 + ' m'; }
function fmtS(s) { s = Math.round(s); return s < 60 ? s + ' sec' : Math.floor(s / 60) + ' min' + (s % 60 ? ' ' + (s % 60) + ' sec' : ''); }

function steps(segs, from, sa, sb, to) {
  var out = [], walkA = sa.d * UNIT_M, walkB = sb.d * UNIT_M, totM = 0, totS = 0;
  if (walkA > 6) { out.push({ kind: 'walk', text: 'Walk ' + compass(bearing(from, sa.q)) + ' to the road', m: walkA, s: walkA / WALK }); totM += walkA; totS += walkA / WALK; }
  // 1) road pieces -> raw manoeuvres. A new instruction may only start at a real junction (3+ real roads),
  //    on a turn of >= 45 deg (measured over 60 m) or a street/highway change. Bends on one road never split.
  var MIN_STEP = 60, MIN_HWY = 400, TURN = 45;
  var raw = [], cur = null;
  var angle = function (a, b) { return ((b - a + 540) % 360) - 180; };        // + = right
  for (var i = 0; i < segs.length; i++) {
    var sg = segs[i]; if (sg.len < 0.5 || sg.pts.length < 2) continue;
    var inB = headOut(sg.pts, false), outB = headOut(sg.pts, true);
    var junction = sg.node !== undefined && SIGDEG[sg.node] >= 3;
    var renamed = sg.name && cur && cur.lastName && sg.name !== cur.lastName;     // street name changes here
    if (!cur || (junction && (sg.type !== cur.type || renamed || Math.abs(angle(cur.endB, inB)) >= TURN))) {
      cur = { type: sg.type, m: 0, s: 0, startB: inB, endB: outB, sP: sg.pts[0], eP: sg.pts[sg.pts.length - 1], mid: sg.pts[Math.floor(sg.pts.length / 2)], names: {}, lastName: null };
      raw.push(cur);
    }
    cur.m += sg.len; cur.s += sg.len / SPEED[sg.type]; cur.endB = outB; cur.eP = sg.pts[sg.pts.length - 1];
    if (sg.name) { cur.names[sg.name] = (cur.names[sg.name] || 0) + sg.len; cur.lastName = sg.name; }
    if (cur.m < 300) cur.mid = sg.pts[Math.floor(sg.pts.length / 2)];
  }
  // dominant street name of a step (must cover >= 40% of it)
  var dom = function (st) { var best = null, bl = 0; for (var k in st.names) if (st.names[k] > bl) { bl = st.names[k]; best = k; } return bl >= 0.4 * st.m ? best : null; };
  var compatible = function (p, r) { var a = dom(p), b = dom(r); return !a || !b || a === b; };
  // 2) short highway stretches (slip roads, crossings) don't count as "taking the highway"
  raw.forEach(function (r) { if (r.type === 1 && r.m < MIN_HWY) r.type = 0; });
  // 3) fold tiny pieces into the previous step
  var merged = [];
  var absorb = function (p, r) { p.m += r.m; p.s += r.s; p.endB = r.endB; p.eP = r.eP; if (p.m < 300) p.mid = r.mid; for (var k in r.names) p.names[k] = (p.names[k] || 0) + r.names[k]; };
  raw.forEach(function (r) {
    var p = merged[merged.length - 1];
    if (p && (r.m < MIN_STEP || (r.type === p.type && compatible(p, r) && Math.abs(angle(p.endB, r.startB)) < 30))) absorb(p, r);
    else merged.push({ type: r.type, m: r.m, s: r.s, startB: r.startB, endB: r.endB, sP: r.sP, eP: r.eP, mid: r.mid, names: Object.assign({}, r.names) });
  });
  if (merged.length > 1 && merged[0].m < MIN_STEP) {               // tiny first piece -> fold into the next
    var f = merged.shift(); merged[0].m += f.m; merged[0].s += f.s; merged[0].sP = f.sP;
  }
  // 4) coalesce steps that keep going the same overall way (start->end chord within 30 deg) on the same street
  var chord = function (st) { return bearing(st.sP, st.eP); };
  var co = [];
  merged.forEach(function (st) {
    var p = co[co.length - 1];
    var sameRoad = p && dom(p) && dom(p) === dom(st);                       // e.g. ramp + main line of "Route 10"
    if (p && (sameRoad || (p.type === st.type && compatible(p, st) && Math.abs(angle(chord(p), chord(st))) < 30))) {
      if (sameRoad && st.m > p.m) p.type = st.type;                        // keep the dominant road class
      absorb(p, st);
    } else co.push(st);
  });
  merged = co;
  // 5) words — "Drive east on Rialto Cswy", "Turn left onto NE 9th St", "Take I-97 south"
  merged.forEach(function (st, i) {
    var verb, dir = compass(st.m > 120 ? chord(st) : st.startB), nm = dom(st);
    if (i === 0) verb = st.type ? 'Take ' + (nm || 'the highway') + ' ' + dir : 'Drive ' + dir + (nm ? ' on ' + nm : '');
    else {
      var prev = merged[i - 1], d = angle(prev.endB, st.startB), pn = dom(prev);
      if (st.type !== prev.type) verb = st.type ? 'Take ' + (nm || 'the highway') + ' ' + dir : 'Exit ' + (nm ? 'onto ' + nm : 'the highway') + ', head ' + dir;
      else if (Math.abs(d) > 135) verb = 'Make a U-turn' + (nm ? ' onto ' + nm : ', head ' + dir);
      else if (Math.abs(d) >= 30) verb = 'Turn ' + (d > 0 ? 'right' : 'left') + (nm ? ' onto ' + nm : ', head ' + dir);
      else if (nm && nm !== pn) verb = 'Continue onto ' + nm;
      else verb = (d > 0 ? 'Keep right' : 'Keep left') + (nm ? ' on ' + nm : ', head ' + dir);
    }
    var dn = nm ? null : district(st.mid);
    out.push({ kind: 'drive', text: verb + (dn ? ' through ' + dn : ''), m: st.m, s: st.s });
    totM += st.m; totS += st.s;
  });
  if (walkB > 6) { out.push({ kind: 'walk', text: 'Walk ' + compass(bearing(sb.q, to)) + ' to your destination', m: walkB, s: walkB / WALK }); totM += walkB; totS += walkB / WALK; }
  out.forEach(function (st) { st.label = st.text + ' for ' + fmtM(st.m) + ' (' + fmtS(st.s) + ')'; });
  return { list: out, totalM: totM, totalS: totS, totalLabel: fmtM(totM) + ' · ' + fmtS(totS) };
}

self.onmessage = function (ev) {
  var m = ev.data || {};
  if (m.type === 'load') {
    load(m.graph, m.districts).then(function (info) { self.postMessage({ type: 'ready', info: info }); })
      .catch(function (err) { self.postMessage({ type: 'error', error: 'Could not load the road network: ' + err }); });
  } else if (m.type === 'route') {
    try { self.postMessage({ type: 'route', id: m.id, result: route(m.from, m.to) }); }
    catch (err) { self.postMessage({ type: 'route', id: m.id, result: { error: String(err) } }); }
  }
};
