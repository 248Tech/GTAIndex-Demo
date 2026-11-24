/* GTAIndex — shared map category glyphs (white fill inside a colored pin).
   Keyed by poi_category `key`. Used by public map.js and admin-map-editor.js. */
window.GI_GLYPHS = {
  // Region filters use a folded map, deliberately distinct from the location dot.
  region:      '<path d="M3 5.2 8.8 3l6.4 2.2L21 3v15.8L15.2 21l-6.4-2.2L3 21z" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/><path d="M8.8 3v15.8m6.4-13.6V21" fill="none" stroke="#fff" stroke-width="2" stroke-linejoin="round"/>',
  // Base categories
  location:    '<circle cx="12" cy="12" r="5.5"/>',
  collectible: '<path d="M12 3l2.6 5.7 6.2.5-4.7 4.1 1.4 6.1L12 16.2 6.5 19.5l1.4-6.1L3.2 9.2l6.2-.5z"/>',
  mission:     '<path d="M8 5v14l11-7z"/>',
  activity:    '<path d="M7 2v11h3v9l7-12h-4l3-8z"/>',
  vehicle:     '<path fill-rule="evenodd" d="M3 15l2-5.2c.3-.8 1-1.3 1.9-1.3h10.2c.9 0 1.6.5 1.9 1.3L21 15v3.2h-2.2a2.4 2.4 0 0 1-4.8 0H10a2.4 2.4 0 0 1-4.8 0H3zm4-4.6L6 13.8h12l-1-3.4a.9.9 0 0 0-.9-.6H7.9a.9.9 0 0 0-.9.6zM7.1 15.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm9.8 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/>',
  'public-transport': '<rect x="4" y="4" width="16" height="15" rx="2.5"/><path d="M4 10.5h16M8 7.2h3.2m1.6 0H16" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/><circle cx="8" cy="16" r="1.45" fill="#fff"/><circle cx="16" cy="16" r="1.45" fill="#fff"/><path d="M7 20.5v-1.4m10 1.4v-1.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  property:    '<path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>', // Safehouses (internal key retained)
  character:   '<path d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm-7 9a7 7 0 0 1 14 0z"/>',
  // Places & services
  clothing:    '<path d="M7.5 3 4 5.5 5.6 8.6 7 7.8V20h10V7.8l1.4.8L20 5.5 16.5 3 15 4.2a3 3 0 0 1-6 0z"/>',
  tattoo:      '<path d="M14 3l4 4-2.1 2.1-.9-.9-1.6 1.6.9.9-2.1 2.1-4-4 2.1-2.1.9.9 1.6-1.6-.9-.9z"/><path d="M10.4 11.6 5 17l-1.2 3.2L7 19l5.4-5.4z"/>',
  'car-dealer':'<path fill-rule="evenodd" d="M7.5 7a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9zm0 2.8a1.7 1.7 0 1 1 0 3.4 1.7 1.7 0 0 1 0-3.4z"/><path d="M11.5 10.6H21v3h-1.8v-1.6h-1.4v1.6H16v-1.6h-1.4v1.6h-3.1z"/>',
  'car-mod':   '<path d="M21 6.5a4.2 4.2 0 0 1-5.4 4.9L7 20l-3-3 8.6-8.6A4.2 4.2 0 0 1 17.5 3l-2.3 2.3 1.5 3 3 1.5z"/>',
  gas:         '<path fill-rule="evenodd" d="M4 4a1.5 1.5 0 0 1 1.5-1.5h4A1.5 1.5 0 0 1 11 4v17H4zM6 5.5h3v3.2H6z"/><path d="M11 7.5h1.6l2.4 2.4V16a1.6 1.6 0 0 0 3.2 0V8.3l-2.1-2.1-1.1 1.1 1.5 1.5v.9h-1.9V9z"/>',
  shop:        '<path d="M6 8h12l-1 12H7zM9 8V6.6a3 3 0 0 1 6 0V8h-1.7V6.6a1.3 1.3 0 0 0-2.6 0V8z"/>',
  'hair-salon':'<path d="M9.64 7.64c.23-.5.36-1.05.36-1.64 0-2.21-1.79-4-4-4S2 3.79 2 6s1.79 4 4 4c.59 0 1.14-.13 1.64-.36L10 12l-2.36 2.36C7.14 14.13 6.59 14 6 14c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4c0-.59-.13-1.14-.36-1.64L12 14l7 7h3v-1L9.64 7.64zM6 8c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm0 12c-1.1 0-2-.89-2-2s.9-2 2-2 2 .89 2 2-.9 2-2 2zm6-7.5c-.28 0-.5-.22-.5-.5s.22-.5.5-.5.5.22.5.5-.22.5-.5.5zM19 3l-6 6 2 2 7-7V3z"/>',
  bar:         '<path d="M4 4h16l-7 8v5h3v2H8v-2h3v-5z"/>',
  factory:     '<path d="M3 21V11l5 3V11l5 3V7h6l1 14z"/>',
  club:        '<ellipse cx="7.6" cy="17.6" rx="2.7" ry="2.3"/><ellipse cx="17.4" cy="14.9" rx="2.7" ry="2.3"/><path d="M9.4 6.2 20 4v3.2L9.4 9.4z"/><rect x="9" y="7" width="1.6" height="10.8"/><rect x="18.4" y="4.6" width="1.6" height="10.4"/>',
  hospital:    '<path d="M9.5 3h5v6h6v5h-6v6h-5v-6h-6V9h6z"/>',
  police:      '<path d="M12 2l2.5 4.5L19.5 8 16 11.6 17 17 12 14.3 7 17l1-5.4L4.5 8l5-1.5z"/>',
  bank:        '<path d="M12 3 2.5 8.2V10h19V8.2z"/><rect x="4" y="18.4" width="16" height="2.2"/><rect x="4.6" y="10.6" width="1.9" height="7.2"/><rect x="8.1" y="10.6" width="1.9" height="7.2"/><rect x="11.05" y="10.6" width="1.9" height="7.2"/><rect x="14" y="10.6" width="1.9" height="7.2"/><rect x="17.5" y="10.6" width="1.9" height="7.2"/>',
  atm:         '<path fill-rule="evenodd" d="M3 6h18v12H3zM5.5 9h5v3.2h-5zM14 15h4v1.4h-4z"/>',
  restaurant:  '<path d="M7 3v7.5M4.5 3v4.2a2.5 2.5 0 0 0 5 0V3M7 10.5V21M16.7 3v18M16.7 3c2.2 1.7 3.2 4.2 2.8 7.5h-2.8" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>',
  'car-wash':  '<path d="M3 15l2-5.2c.3-.8 1-1.3 1.9-1.3h10.2c.9 0 1.6.5 1.9 1.3L21 15v3.2h-2.2a2.4 2.4 0 0 1-4.8 0H10a2.4 2.4 0 0 1-4.8 0H3zm4-4.6L6 13.8h12l-1-3.4a.9.9 0 0 0-.9-.6H7.9a.9.9 0 0 0-.9.6zM7.1 15.2a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8zm9.8 0a1.4 1.4 0 1 0 0 2.8 1.4 1.4 0 0 0 0-2.8z"/><path d="M7 4.2c.8.9.8 1.5 0 2.4m5-3.2c.8.9.8 1.5 0 2.4m5-1.6c.8.9.8 1.5 0 2.4" fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"/>',
  'gun-shop':  '<circle cx="12" cy="12" r="8" fill="none" stroke="#fff" stroke-width="2"/><circle cx="12" cy="12" r="2"/><path d="M12 2v4m0 12v4M2 12h4m12 0h4" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round"/>',
  // Hotel / motel (bed) — possible places to stay
  hotel:       '<path d="M3 18.5V5.5m0 8h18v5M21 13.5V12a3.5 3.5 0 0 0-3.5-3.5H11v5" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/><circle cx="7" cy="10.6" r="2.1"/>'
};
