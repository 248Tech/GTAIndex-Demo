/* GTAIndex — collectibles checklist + map (localStorage, no account). */
(function () {
  var KEY = 'gi_collect';        // { collectibleId: 1 }
  var META = 'gi_collect_meta';  // { slug: {done,total,name,url} }

  function read(k) { return GIStore.get(k); }
  function write(k, o) { GIStore.set(k, o); }

  function isDone(id) { return !!read(KEY)[id]; }
  function setDone(id, on) {
    var o = read(KEY);
    if (on) { o[id] = 1; } else { delete o[id]; }
    write(KEY, o);
  }
  function setMeta(slug, meta) { var m = read(META); m[slug] = meta; write(META, m); }

  // ---------- Set (show) page ----------
  function initSet() {
    var cfg = window.GI_COLLECT;
    if (!cfg) return;
    var points = cfg.points || [];
    var total = points.length;
    if (!total) return;

    var fill = document.getElementById('cFill');
    var pctEl = document.getElementById('cPct');
    var doneEl = document.getElementById('cDone');
    var mapMarkers = {};

    function doneCount() { var o = read(KEY), n = 0; points.forEach(function (p) { if (o[p.id]) n++; }); return n; }
    function refresh() {
      var n = doneCount();
      var pct = total ? Math.round(n / total * 100) : 0;
      if (fill) fill.style.width = pct + '%';
      if (pctEl) pctEl.textContent = pct + '%';
      if (doneEl) doneEl.textContent = n;
      setMeta(cfg.slug, { done: n, total: total, name: cfg.name, url: cfg.url });
    }
    function reflectItem(id) {
      var on = isDone(id);
      var box = document.querySelector('.checkitem__box[data-cid="' + id + '"]');
      if (box) box.checked = on;
      var li = document.querySelector('.checkitem[data-cid="' + id + '"]');
      if (li) li.classList.toggle('is-done', on);
      var mk = mapMarkers[id];
      if (mk) mk._icon && mk._icon.classList.toggle('is-done', on);
    }
    function toggle(id, on) { setDone(id, on); reflectItem(id); refresh(); }

    // checklist bindings
    document.querySelectorAll('.checkitem__box').forEach(function (box) {
      var id = box.dataset.cid;
      box.addEventListener('change', function () { toggle(id, box.checked); });
    });

    // map
    var mapEl = document.getElementById('cmap');
    var mapPts = points.filter(function (p) { return p.x !== null && p.y !== null; });
    if (mapEl && typeof L !== 'undefined' && mapPts.length) {
      var W = cfg.w, H = cfg.h, bounds = [[0, 0], [H, W]];
      var map = L.map('cmap', { crs: L.CRS.Simple, minZoom: -2, maxZoom: 3, zoomSnap: 0.25, attributionControl: false });
      L.imageOverlay(cfg.img, bounds).addTo(map);
      map.fitBounds(bounds);
      map.setMaxBounds(bounds);
      mapPts.forEach(function (p) {
        var lat = H - (p.y * H), lng = p.x * W;
        var icon = L.divIcon({ className: 'gi-cpin' + (isDone(p.id) ? ' is-done' : ''), html: '<span style="background:var(--' + cfg.color + ')"></span>', iconSize: [18, 18], iconAnchor: [9, 9] });
        var mk = L.marker([lat, lng], { icon: icon, title: p.name });
        mk.bindPopup('<strong>' + (p.name || '') + '</strong>' + (p.notes ? '<br>' + p.notes : '') + '<br><button type="button" class="gi-pop-toggle" data-cid="' + p.id + '">Toggle collected</button>');
        mk.on('popupopen', function () {
          var b = document.querySelector('.gi-pop-toggle[data-cid="' + p.id + '"]');
          if (b) b.addEventListener('click', function () { toggle(p.id, !isDone(p.id)); map.closePopup(); });
        });
        mk.addTo(map);
        mapMarkers[p.id] = mk;
      });
      // "show on map" buttons
      document.querySelectorAll('.checkitem__map').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var mk = mapMarkers[btn.dataset.cid];
          if (mk) { map.setView(mk.getLatLng(), 2); mk.openPopup(); }
        });
      });
    }

    // reset
    var reset = document.getElementById('cReset');
    if (reset) reset.addEventListener('click', function () {
      if (!confirm('Reset your progress for this set?')) return;
      points.forEach(function (p) { setDone(p.id, false); reflectItem(p.id); });
      refresh();
    });

    // initial paint
    points.forEach(function (p) { reflectItem(p.id); });
    refresh();
  }

  // ---------- Hub (index) page ----------
  function initHub() {
    var sets = window.GI_COLLECT_SETS;
    if (!sets) return;
    var meta = read(META);
    var overallDone = 0, overallTotal = 0;

    sets.forEach(function (s) {
      var m = meta[s.slug] || { done: 0 };
      var total = s.total || 0;
      overallTotal += total;
      overallDone += Math.min(m.done || 0, total);
      var card = document.querySelector('.collectcard[data-set="' + s.slug + '"]');
      if (card && total > 0) {
        var pct = Math.round((m.done || 0) / total * 100);
        var fill = card.querySelector('[data-role="fill"]');
        if (fill) fill.style.width = pct + '%';
        var count = card.querySelector('[data-role="count"]');
        if (count && (m.done || 0) > 0) count.textContent = (m.done || 0) + ' / ' + total + ' collected';
      }
    });

    var box = document.getElementById('collectOverall');
    if (box && overallTotal > 0) {
      box.hidden = false;
      var pct = Math.round(overallDone / overallTotal * 100);
      document.getElementById('collectOverallFill').style.width = pct + '%';
      document.getElementById('collectOverallPct').textContent = pct + '%';
      document.getElementById('collectOverallSub').textContent = overallDone + ' of ' + overallTotal + ' collectibles across all sets.';
    }
  }

  // ---------- /progress summary ----------
  function initProgressSummary() {
    var box = document.getElementById('collectSummary');
    if (!box) return;
    var meta = read(META);

    // Prefer the full server-provided set list (whole 100% roadmap); otherwise fall
    // back to whatever sets the visitor has interacted with locally.
    var list;
    var sets = window.GI_COLLECT_SETS;
    if (sets && sets.length) {
      list = sets.map(function (s) {
        var m = meta[s.slug] || {};
        return { slug: s.slug, name: s.name, url: '/GTAIndex-Demo/collectibles/' + s.slug,
                 total: (m.total || s.total || 0), done: m.done || 0 };
      });
    } else {
      list = Object.keys(meta).map(function (s) {
        var m = meta[s];
        return { slug: s, name: m.name, url: m.url || '/GTAIndex-Demo/collectibles/' + s,
                 total: m.total || 0, done: m.done || 0 };
      });
    }
    list = list.filter(function (x) { return (x.total || 0) > 0; });
    if (!list.length) return;

    var done = 0, total = 0, rows = document.getElementById('csRows');
    rows.innerHTML = '';
    list.forEach(function (x) {
      done += Math.min(x.done || 0, x.total);
      total += x.total;
      var pct = x.total ? Math.round((x.done || 0) / x.total * 100) : 0;
      var a = document.createElement('a');
      a.className = 'collectcard';
      a.href = x.url;
      a.innerHTML = '<span class="collectcard__name">' + esc(x.name || x.slug) + '</span>' +
        '<span class="collectcard__count">' + (x.done || 0) + ' / ' + x.total + ' collected</span>' +
        '<span class="collbar collbar--sm"><span class="collbar__fill" style="width:' + pct + '%"></span></span>';
      rows.appendChild(a);
    });
    box.hidden = false;
    var overall = total ? Math.round(done / total * 100) : 0;
    document.getElementById('csOverallPct').textContent = overall + '%';
    document.getElementById('csOverallFill').style.width = overall + '%';
  }

  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { initSet(); initHub(); initProgressSummary(); });
  } else { initSet(); initHub(); initProgressSummary(); }
})();
