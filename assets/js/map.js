/* GTAIndex — interactive Leonida map (Leaflet over gtadb tiles, CRS.Simple, clustered).
   Tiles are the community YANIS set (CC BY 4.0), placed by gtadb game coordinates. */
(function () {
  var cfg = window.GI_MAP;
  if (!cfg || typeof L === 'undefined') return;

  // gtadb game coord -> Leaflet CRS.Simple latLng. lat = (zeroY - gy)/unit, lng = (gx + zeroX)/unit.
  var ZX = cfg.zeroX, ZY = cfg.zeroY, UNIT = cfg.unit;
  function gameToLatLng(gx, gy) { return L.latLng((ZY - gy) / UNIT, (gx + ZX) / UNIT); }

  var bounds = L.latLngBounds(cfg.bounds[0], cfg.bounds[1]);

  // Like CRS.Simple but WITHOUT the Y flip, so lat increases downward to match
  // the tile grid (tile y grows south, same as gtadb's game-Y-down pixel space).
  var GI_CRS = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(1, 0, 1, 0) });

  var map = L.map('map', {
    crs: GI_CRS,
    minZoom: cfg.minZoom, maxZoom: cfg.maxZoom, zoomSnap: 0.25,
    attributionControl: false
  });
  var tiles = L.tileLayer('', {
    minZoom: cfg.minZoom, maxNativeZoom: cfg.maxNativeZoom, maxZoom: cfg.maxZoom,
    tileSize: 256, bounds: bounds, noWrap: true, errorTileUrl: cfg.errorTile
  });
  var TILE_Q = cfg.tileVer ? '?v=' + cfg.tileVer : '';
  tiles.getTileUrl = function (coords) {
    return cfg.tileBase + '/' + coords.z + '/' + coords.y + '/' + coords.x + '.jpg';
  };
  tiles.addTo(map);
  map.fitBounds(bounds);
  map.setMaxBounds(bounds.pad(0.15));

  // Match the Leaflet background to the active base map's ocean colour so the
  // water never seams against the tiles (yanis vs atlas have different blues).
  // Use !important priority to beat the .page-map .mapcanvas CSS default.
  if (cfg.water) map.getContainer().style.setProperty('background', cfg.water, 'important');

  // A quiet checkerboard watermark on the blue ocean only: one logo, one open
  // cell, rather than a dense repeat that competes with map content.
  var watermark = document.createElement('div');
  watermark.className = 'map-watermarks';
  watermark.setAttribute('aria-hidden', 'true');
  for (var watermarkCell = 0; watermarkCell < 12; watermarkCell++) {
    watermark.appendChild(document.createElement('span'));
  }
  map.getContainer().appendChild(watermark);

  // Region records represent areas. Draw their existing record anchors as a
  // separate label layer, rather than inventing geographic boundary polygons.
  var regionLayer = L.layerGroup().addTo(map);
  function fracToLatLng(x, y) {
    return L.latLng(cfg.bounds[0][0] + y * (cfg.bounds[1][0] - cfg.bounds[0][0]), cfg.bounds[0][1] + x * (cfg.bounds[1][1] - cfg.bounds[0][1]));
  }

  var cluster = L.markerClusterGroup({
    showCoverageOnHover: false,
    // Keep overview clustering, but return to individual editable-looking pins
    // as soon as the visitor has zoomed into a neighbourhood.
    disableClusteringAtZoom: 2,
    maxClusterRadius: 38,
    spiderfyOnMaxZoom: true,
    chunkedLoading: true,
    iconCreateFunction: function (c) {
      var n = c.getChildCount();
      var size = n < 10 ? 34 : n < 50 ? 40 : 46;
      return L.divIcon({ className: 'gi-cluster', html: '<span>' + n + '</span>', iconSize: [size, size] });
    }
  });
  map.addLayer(cluster);

  function esc(s) {
    return (s || '').replace(/[&<>"]/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c];
    });
  }
  function selected(sel) {
    return Array.prototype.slice.call(document.querySelectorAll(sel + ':checked')).map(function (i) { return i.value; });
  }

  // White category glyphs (shared with the admin editor via gi-glyphs.js).
  var GLYPHS = window.GI_GLYPHS || { location: '<circle cx="12" cy="12" r="5.5"/>' };

  function regionIcon(region) {
    return L.divIcon({
      className: 'gi-region-label',
      html: '<span class="gi-region-label__name">' + esc(region.name) + '</span>',
      iconSize: [190, 42], iconAnchor: [95, 21]
    });
  }

  function rebuildRegions(regs) {
    regionLayer.clearLayers();
    (cfg.regionMarkers || []).forEach(function (region) {
      if (regs.indexOf(region.slug) < 0) return;
      var marker = L.marker(fracToLatLng(region.x, region.y), {
        icon: regionIcon(region), title: region.name, alt: region.name, keyboard: true, zIndexOffset: 600
      });
      if (region.url) marker.on('click', function () { window.location.assign(region.url); });
      marker.addTo(regionLayer);
    });
  }

  // Turn each filter legend swatch into a mini icon-pin. Regions have a distinct
  // folded-map glyph rather than reusing the general location dot.
  Array.prototype.slice.call(document.querySelectorAll('.f-cat,.f-region')).forEach(function (input) {
    var sw = input.parentNode.querySelector('.sw');
    if (!sw) return;
    var g = input.classList.contains('f-region') ? GLYPHS.region : GLYPHS[input.value];
    if (g) { sw.classList.add('sw--icon'); sw.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true">' + g + '</svg>'; }
  });

  var markers = (cfg.points || []).map(function (p) {
    var ll = gameToLatLng(p.gx, p.gy);
    var color = (cfg.colors && cfg.colors[p.category]) || 'lagoon';
    var glyph = GLYPHS[p.category] || GLYPHS.location;
    var icon = L.divIcon({ className: 'gi-pin', html: '<span class="gi-pin__badge" style="background:var(--' + color + ')"><svg viewBox="0 0 24 24" aria-hidden="true">' + glyph + '</svg></span>', iconSize: [22, 22], iconAnchor: [11, 11] });
    var mk = L.marker(ll, { icon: icon, title: p.name, alt: p.name, keyboard: true });
    var html = '<strong>' + esc(p.name) + '</strong>' + (p.summary ? '<br>' + esc(p.summary) : '');
    if (p.url) html += '<br><a class="gi-pop-link" href="' + esc(p.url) + '">Open page &rarr;</a>';
    mk.bindPopup(html);
    mk._gc = p;
    return mk;
  });

  var list = document.getElementById('reslist');
  var searchEl = document.getElementById('mapSearch');
  var LIST_CAP = 150;
  var lastVisible = [];

  function focus(mk) {
    cluster.zoomToShowLayer(mk, function () { mk.openPopup(); });
  }

  function rebuild() {
    var regs = selected('.f-region'), cats = selected('.f-cat');
    var q = (searchEl && searchEl.value || '').trim().toLowerCase();
    rebuildRegions(regs);
    cluster.clearLayers();
    if (list) list.innerHTML = '';
    var visible = [];
    markers.forEach(function (mk) {
      var p = mk._gc;
      var passFilters = (!p.region || regs.indexOf(p.region) >= 0) && cats.indexOf(p.category) >= 0;
      var searchable = (p.search || p.name || p.summary || '').toLowerCase();
      var passSearch = !q || searchable.indexOf(q) >= 0;
      if (passFilters && passSearch) {
        visible.push(mk);
      }
    });
    cluster.addLayers(visible);
    lastVisible = visible;

    if (list) {
      if (visible.length === 0) {
        var li0 = document.createElement('li');
        li0.style.cssText = 'color:var(--text-quiet-dark);font-size:13px;padding:10px 2px';
        li0.textContent = 'No map points match the current filters.';
        list.appendChild(li0);
        return;
      }
      visible.slice(0, LIST_CAP).forEach(function (mk) {
        var p = mk._gc;
        var li = document.createElement('li');
        var b = document.createElement('button');
        b.type = 'button';
        b.innerHTML = '<span class="rn">' + esc(p.name) + '</span><span class="rm">' + esc(p.summary || '') + '</span>';
        b.addEventListener('click', function () { focus(mk); });
        li.appendChild(b);
        list.appendChild(li);
      });
      if (visible.length > LIST_CAP) {
        var more = document.createElement('li');
        more.style.cssText = 'color:var(--text-quiet-dark);font-size:12px;padding:10px 2px';
        more.textContent = '+ ' + (visible.length - LIST_CAP) + ' more — zoom or filter to narrow.';
        list.appendChild(more);
      }
    }
  }

  Array.prototype.slice.call(document.querySelectorAll('.f-region,.f-cat'))
    .forEach(function (i) { i.addEventListener('change', rebuild); });

  // Live search: filter pins + results as you type.
  var searchClear = document.getElementById('mapSearchClear');
  if (searchEl) {
    searchEl.addEventListener('input', function () {
      if (searchClear) searchClear.hidden = !searchEl.value;
      rebuild();
    });
    searchEl.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' && lastVisible.length) { e.preventDefault(); focus(lastVisible[0]); }
    });
  }
  if (searchClear) searchClear.addEventListener('click', function () {
    searchEl.value = ''; searchClear.hidden = true; rebuild(); searchEl.focus();
  });

  // Per-group All / None toggles.
  Array.prototype.slice.call(document.querySelectorAll('.mbulk')).forEach(function (btn) {
    btn.addEventListener('click', function () {
      var group = btn.closest('.mapgroup');
      if (!group) return;
      var on = btn.getAttribute('data-set') === '1';
      Array.prototype.slice.call(group.querySelectorAll('input[type=checkbox]'))
        .forEach(function (cb) { cb.checked = on; });
      rebuild();
    });
  });

  // Defaults are DOM-defined: no previous visitor state is restored.
  // Locations remain available but stay off until explicitly selected.
  var resetBtn = document.getElementById('mapResetFilters');
  if (resetBtn) resetBtn.addEventListener('click', function () {
    Array.prototype.slice.call(document.querySelectorAll('.f-region')).forEach(function (cb) { cb.checked = true; });
    Array.prototype.slice.call(document.querySelectorAll('.f-cat')).forEach(function (cb) { cb.checked = cb.dataset.default !== '0'; });
    if (searchEl) { searchEl.value = ''; if (searchClear) searchClear.hidden = true; }
    rebuild();
  });

  if (cfg.region) {
    Array.prototype.slice.call(document.querySelectorAll('.f-region'))
      .forEach(function (i) { i.checked = (i.value === cfg.region); });
  }

  rebuild();

  if (cfg.poi || cfg.location) {
    var targetSlug = cfg.poi || cfg.location;
    var targetType = cfg.location ? 'location' : 'poi';
    var poiMarker = markers.find(function (mk) { return mk._gc.slug === targetSlug && mk._gc.recordType === targetType; });
    if (poiMarker) {
      var categoryInput = document.querySelector('.f-cat[value="' + poiMarker._gc.category + '"]');
      if (categoryInput && !categoryInput.checked) {
        categoryInput.checked = true;
        rebuild();
      }
      focus(poiMarker);
    }
  } else if (cfg.region) {
    var m = markers.filter(function (mk) { return mk._gc.region === cfg.region; })[0];
    if (m) focus(m);
  }

  // Recalculate size when the drawer opens / layout changes.
  window.GI_MAP_INSTANCE = map;
})();
