/* GTAIndex — Directions (GPS route) for the public map.
   Click two points (or pick two places) and get a magenta route with walk/drive steps.
   Road network is derived from the gtadb.org YANIS v16 map (CC BY 4.0); routing runs in route-worker.js. */
(function () {
  'use strict';
  var map = window.GI_MAP_INSTANCE, cfg = window.GI_MAP || {};
  if (!map || !window.L) return;
  var D = cfg.directions || {};
  var B0 = cfg.bounds[0], B1 = cfg.bounds[1];
  function ptLatLng(p) { return L.latLng(B0[0] + p.y * (B1[0] - B0[0]), B0[1] + p.x * (B1[1] - B0[1])); }

  // ---------- DOM ----------
  var btn = document.createElement('button');
  btn.type = 'button'; btn.className = 'mapdir-btn'; btn.id = 'mapDirBtn';
  btn.setAttribute('aria-expanded', 'false'); btn.setAttribute('aria-controls', 'mapDirPanel');
  btn.innerHTML = '<svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="6" cy="18" r="2.4"/><circle cx="18" cy="6" r="2.4"/><path d="M8.2 16.6C14 14 9 9.5 15.8 7.4"/></svg>Directions';
  var panel = document.createElement('section');
  panel.className = 'mapdir'; panel.id = 'mapDirPanel'; panel.hidden = true;
  panel.setAttribute('aria-label', 'Directions');
  panel.innerHTML =
    '<div class="mapdir__head"><h2>Directions</h2><button type="button" class="mapdir__x" aria-label="Close directions">&times;</button></div>' +
    '<p class="mapdir__hint" id="mapDirHint">Click the map to set your <b>start</b>, then your <b>destination</b> — or search a place.</p>' +
    '<div class="mapdir__fields">' +
      '<label class="mapdir__f"><span class="mapdir__dot mapdir__dot--a">A</span><input type="text" id="mapDirFrom" list="mapDirPlaces" placeholder="Start — click map or type a place" autocomplete="off"></label>' +
      '<label class="mapdir__f"><span class="mapdir__dot mapdir__dot--b">B</span><input type="text" id="mapDirTo" list="mapDirPlaces" placeholder="Destination" autocomplete="off"></label>' +
      '<button type="button" class="mapdir__swap" id="mapDirSwap" aria-label="Swap start and destination" title="Swap">&#8645;</button>' +
    '</div>' +
    '<datalist id="mapDirPlaces"></datalist>' +
    '<div class="mapdir__out" id="mapDirOut" aria-live="polite"></div>' +
    '<div class="mapdir__actions"><button type="button" class="mapdir__clear" id="mapDirClear">Clear route</button><button type="button" class="mapdir__share" id="mapDirShare" hidden>Copy link</button></div>' +
    '<p class="mapdir__note">Routes follow roads traced from the community YANIS v16 map (gtadb.org, CC BY 4.0). Distances &amp; times are estimates — one-way streets aren’t known yet. <a href="/GTAIndex-Demo/guides/how-to-use-the-gta-6-interactive-map">How directions work →</a></p>';
  // mount as a Leaflet control (top-left, under the zoom buttons) so it sits on the map at every width
  var Ctl = L.Control.extend({ onAdd: function () {
    var wrap = L.DomUtil.create('div', 'mapdir-wrap');
    wrap.appendChild(btn); wrap.appendChild(panel);
    L.DomEvent.disableClickPropagation(wrap); L.DomEvent.disableScrollPropagation(wrap);
    return wrap;
  } });
  new Ctl({ position: 'topleft' }).addTo(map);
  var $ = function (id) { return document.getElementById(id); };
  var inFrom = $('mapDirFrom'), inTo = $('mapDirTo'), out = $('mapDirOut'), hint = $('mapDirHint');

  // place list for the inputs
  var places = {};
  (cfg.points || []).forEach(function (p) {
    if (!p || !p.name) return;
    var label = p.name + (p.summary ? ' — ' + String(p.summary).replace(/^[^·]*·\s*/, '') : '');
    if (places[label]) return;
    places[label] = ptLatLng(p);
  });
  var dl = $('mapDirPlaces');
  Object.keys(places).sort().forEach(function (k) { var o = document.createElement('option'); o.value = k; dl.appendChild(o); });

  // ---------- state + layers ----------
  var A = null, Bp = null, worker = null, ready = false, pending = null, reqId = 0;
  var layer = L.layerGroup().addTo(map);
  function pin(letter) {
    return L.divIcon({ className: 'mapdir-pin', html: '<span class="mapdir-pin__b mapdir-pin__b--' + letter.toLowerCase() + '">' + letter + '</span>', iconSize: [28, 28], iconAnchor: [14, 14] });
  }
  var mkA = L.marker([0, 0], { icon: pin('A'), draggable: true, keyboard: false, zIndexOffset: 2000 });
  var mkB = L.marker([0, 0], { icon: pin('B'), draggable: true, keyboard: false, zIndexOffset: 2000 });
  mkA.on('dragend', function () { A = mkA.getLatLng(); inFrom.value = coordLabel(A); go(); });
  mkB.on('dragend', function () { Bp = mkB.getLatLng(); inTo.value = coordLabel(Bp); go(); });

  function coordLabel(ll) { return 'Map point ' + ll.lat.toFixed(1) + ', ' + ll.lng.toFixed(1); }
  function placeFor(v) {
    v = (v || '').trim(); if (!v) return null;
    if (places[v]) return places[v];
    var m = v.match(/(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)/); if (m) return L.latLng(+m[1], +m[2]);
    var low = v.toLowerCase(), hit = Object.keys(places).filter(function (k) { return k.toLowerCase().indexOf(low) === 0; })[0]
      || Object.keys(places).filter(function (k) { return k.toLowerCase().indexOf(low) !== -1; })[0];
    return hit ? places[hit] : null;
  }

  // ---------- worker ----------
  function ensureWorker() {
    if (worker || !D.graph) return;
    out.innerHTML = '<p class="mapdir__status">Loading road network…</p>';
    worker = new Worker(D.worker);
    worker.onmessage = function (ev) {
      var m = ev.data;
      if (m.type === 'ready') { ready = true; if (pending) { var p = pending; pending = null; send(p); } else render(); }
      else if (m.type === 'error') { out.innerHTML = '<p class="mapdir__err">' + esc(m.error) + '</p>'; }
      else if (m.type === 'route' && m.id === reqId) draw(m.result);
    };
    worker.postMessage({ type: 'load', graph: D.graph, districts: D.districts });
  }
  function send(p) { reqId++; worker.postMessage({ type: 'route', id: reqId, from: [p.a.lat, p.a.lng], to: [p.b.lat, p.b.lng] }); out.innerHTML = '<p class="mapdir__status">Finding route…</p>'; }

  function go() {
    layer.clearLayers(); syncPins();
    if (!A || !Bp) { render(); return; }
    var p = { a: A, b: Bp };
    if (!ready) { pending = p; ensureWorker(); return; }
    send(p);
  }
  function syncPins() {
    if (A) { mkA.setLatLng(A).addTo(map); } else map.removeLayer(mkA);
    if (Bp) { mkB.setLatLng(Bp).addTo(map); } else map.removeLayer(mkB);
    hint.hidden = !!(A && Bp);
  }
  function render() {
    if (!A || !Bp) out.innerHTML = A ? '<p class="mapdir__status">Now click your destination.</p>' : '';
    $('mapDirShare').hidden = !(A && Bp);
  }

  function draw(res) {
    layer.clearLayers();
    if (!res || res.error) { out.innerHTML = '<p class="mapdir__err">' + esc(res ? res.error : 'No route.') + '</p>'; return; }
    var line = [];
    res.path.forEach(function (s) { s.pts.forEach(function (p) { line.push(p); }); });
    L.polyline(line, { color: '#ffffff', weight: 9, opacity: 0.9, lineJoin: 'round', interactive: false }).addTo(layer);
    L.polyline(line, { color: '#ff1ee0', weight: 5.5, opacity: 1, lineJoin: 'round', interactive: false }).addTo(layer);
    [res.walkA, res.walkB].forEach(function (w) {
      L.polyline(w, { color: '#ff1ee0', weight: 3.5, dashArray: '2 7', lineCap: 'round', interactive: false }).addTo(layer);
    });
    var st = res.steps;
    var html = '<ol class="mapdir__steps">';
    html += '<li class="mapdir__from"><b>' + esc(inFrom.value || 'Start') + '</b></li>';
    st.list.forEach(function (s) { html += '<li class="mapdir__s mapdir__s--' + s.kind + '">' + esc(s.label) + '</li>'; });
    html += '<li class="mapdir__to"><b>' + esc(inTo.value || 'Destination') + '</b></li></ol>';
    html += '<p class="mapdir__total">Total: ' + esc(st.totalLabel) + '</p>';
    if (res.note) html += '<p class="mapdir__warn">' + esc(res.note) + '</p>';
    out.innerHTML = html;
    $('mapDirShare').hidden = false;
    var b = L.latLngBounds(line.concat([[A.lat, A.lng], [Bp.lat, Bp.lng]]));
    var narrow = window.innerWidth <= 640, pr = panel.getBoundingClientRect();
    if (narrow && !panel.hidden) {               // phone: the panel is a bottom sheet -> frame the route above it
      map.fitBounds(b, { paddingTopLeft: [30, 110], paddingBottomRight: [30, Math.round(window.innerHeight - pr.top) + 20], maxZoom: 5 });
    } else {                                     // desktop: keep the route clear of the side panel
      var padL = panel.hidden ? 60 : Math.min(380, (pr.right || 0) + 30);
      map.fitBounds(b, { paddingTopLeft: [padL, 70], paddingBottomRight: [60, 90], maxZoom: 5 });
    }
    try { history.replaceState(null, '', location.pathname + location.search.replace(/([?&])dir=[^&]*&?/, '$1').replace(/[?&]$/, '') + '#dir=' + A.lat.toFixed(2) + ',' + A.lng.toFixed(2) + ';' + Bp.lat.toFixed(2) + ',' + Bp.lng.toFixed(2)); } catch (e) {}
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---------- open / close ----------
  function open(on) {
    panel.hidden = !on; btn.setAttribute('aria-expanded', on ? 'true' : 'false'); btn.classList.toggle('is-on', on);
    document.body.classList.toggle('mapdir-open', on);
    if (on) { ensureWorker(); if (!A) setTimeout(function () { inFrom.focus(); }, 30); }
  }
  btn.addEventListener('click', function () { open(panel.hidden); });
  panel.querySelector('.mapdir__x').addEventListener('click', function () { open(false); });
  $('mapDirClear').addEventListener('click', function () { A = Bp = null; inFrom.value = inTo.value = ''; layer.clearLayers(); syncPins(); render(); try { history.replaceState(null, '', location.pathname + location.search); } catch (e) {} });
  $('mapDirSwap').addEventListener('click', function () { var t = A; A = Bp; Bp = t; var v = inFrom.value; inFrom.value = inTo.value; inTo.value = v; go(); });
  $('mapDirShare').addEventListener('click', function () {
    var u = location.href;
    (navigator.clipboard ? navigator.clipboard.writeText(u) : Promise.reject()).then(function () { $('mapDirShare').textContent = 'Link copied ✓'; setTimeout(function () { $('mapDirShare').textContent = 'Copy link'; }, 1800); }).catch(function () { prompt('Copy this link:', u); });
  });
  inFrom.addEventListener('change', function () { var ll = placeFor(inFrom.value); if (ll) { A = ll; go(); } });
  inTo.addEventListener('change', function () { var ll = placeFor(inTo.value); if (ll) { Bp = ll; go(); } });

  // map clicks set A then B while the panel is open
  map.on('click', function (e) {
    if (panel.hidden) return;
    if (!A) { A = e.latlng; inFrom.value = coordLabel(A); }
    else { Bp = e.latlng; inTo.value = coordLabel(Bp); }
    go();
  });

  // "Directions from / to here" in POI popups
  // the map fills popup content in its own handlers, so add our buttons right after they run
  map.on('popupopen', function (e) { setTimeout(function () { addPopupButtons(e); }, 0); });
  function addPopupButtons(e) {
    var el = e.popup.getElement && e.popup.getElement(); if (!el || !e.popup.isOpen() || el.querySelector('.mapdir-pop')) return;
    var ll = e.popup.getLatLng(); var name = (el.querySelector('strong, b, h3, .popup__title') || {}).textContent || coordLabel(ll);
    var box = document.createElement('div'); box.className = 'mapdir-pop';
    box.innerHTML = '<button type="button" data-w="a">From here</button><button type="button" data-w="b">To here</button>';
    box.addEventListener('click', function (ev) {
      var w = ev.target.getAttribute('data-w'); if (!w) return;
      if (w === 'a') { A = ll; inFrom.value = name.trim(); } else { Bp = ll; inTo.value = name.trim(); }
      map.closePopup(); open(true); go();
    });
    var content = el.querySelector('.leaflet-popup-content');
    if (content) {
      content.appendChild(box);
      content.style.width = '';                                    // let the popup grow to fit the buttons
      if (e.popup._updateLayout) { e.popup._updateLayout(); e.popup._updatePosition(); }   // re-measure without re-rendering content
    }
  }

  // shared link: #dir=lat,lng;lat,lng
  var m = (location.hash || '').match(/dir=(-?[\d.]+),(-?[\d.]+);(-?[\d.]+),(-?[\d.]+)/);
  if (m) {
    A = L.latLng(+m[1], +m[2]); Bp = L.latLng(+m[3], +m[4]);
    inFrom.value = coordLabel(A); inTo.value = coordLabel(Bp);
    open(true); go();
  }
})();
