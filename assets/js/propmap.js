/* GTAIndex — single read-only Safehouse pin using the interactive map tiles. */
(function () {
  var cfg = window.GI_PROP;
  var el = document.getElementById('propmap');
  if (!cfg || !el || typeof L === 'undefined') return;

  var bounds = L.latLngBounds([208, 176], [780, 636]);
  var crs = L.extend({}, L.CRS.Simple, { transformation: new L.Transformation(1, 0, 1, 0) });
  var map = L.map('propmap', { crs: crs, minZoom: 0, maxZoom: 6, zoomSnap: 0.25, attributionControl: false, scrollWheelZoom: false });
  map.getContainer().style.setProperty('background', cfg.water || '#4ea7c5', 'important');
  var tiles = L.tileLayer('', { minZoom: 0, maxNativeZoom: 5, maxZoom: 6, tileSize: 256, bounds: bounds, noWrap: true, errorTileUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAACXBIWXMAAA7EAAAOxAGVKw4bAAAADElEQVQImWPwW34UAAMBAbs4T7k+AAAAAElFTkSuQmCC' });
  var TILE_Q = cfg.tileVer ? '?v=' + cfg.tileVer : '';
  tiles.getTileUrl = function (coords) { return cfg.tileBase + '/' + coords.z + '/' + coords.y + '/' + coords.x + '.jpg'; };
  tiles.addTo(map);
  map.fitBounds(bounds);
  map.setMaxBounds(bounds.pad(.15));

  var lat = 208 + (cfg.y * 572), lng = 176 + (cfg.x * 460);
  var icon = L.divIcon({ className: 'gi-pin', html: '<span class="gi-pin__dot" style="background:var(--plum-muted)"></span>', iconSize: [16, 16], iconAnchor: [8, 8] });
  L.marker([lat, lng], { icon: icon, title: cfg.name }).addTo(map).bindPopup('<strong>' + (cfg.name || '') + '</strong>');
  map.setView([lat, lng], typeof cfg.zoom === 'number' ? cfg.zoom : .5);
})();
