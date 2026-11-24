/* GTAIndex — offline search over the bundled index. */
(function () {
  var input = document.getElementById('searchQ'), out = document.getElementById('searchOut'),
    facets = document.getElementById('searchFacets'), meta = document.getElementById('searchMeta');
  if (!input) return;
  var params = new URLSearchParams(location.search);
  input.value = params.get('q') || '';
  var kind = params.get('k') || '';
  var idx = [];

  function score(e, terms) {
    var t = e.t.toLowerCase(), d = (e.d + ' ' + e.c).toLowerCase(), s = 0;
    for (var i = 0; i < terms.length; i++) {
      var w = terms[i];
      if (t === w) s += 200;
      else if (t.indexOf(w) === 0) s += 120;
      else if (t.indexOf(w) >= 0) s += 70;
      else if (d.indexOf(w) >= 0) s += 25;
      else if (e.x.indexOf(w) >= 0) s += 8;
      else return 0;
    }
    return s;
  }

  function run() {
    var q = input.value.trim().toLowerCase();
    var terms = q.split(/\s+/).filter(Boolean);
    var hits = [];
    if (terms.length) idx.forEach(function (e) { var s = score(e, terms); if (s) hits.push({ e: e, s: s }); });
    hits.sort(function (a, b) { return b.s - a.s || a.e.t.localeCompare(b.e.t); });

    var counts = {};
    hits.forEach(function (h) { counts[h.e.k] = (counts[h.e.k] || 0) + 1; });
    var kinds = Object.keys(counts).sort();
    if (kind && !counts[kind]) kind = '';
    facets.innerHTML = kinds.length > 1 ? ['<button type="button" class="gi-btn gi-btn--sm" data-k="" aria-pressed="' + (!kind) + '">All ' + hits.length + '</button>']
      .concat(kinds.map(function (k) { return '<button type="button" class="gi-btn gi-btn--sm" data-k="' + k + '" aria-pressed="' + (kind === k) + '">' + k + 's ' + counts[k] + '</button>'; })).join('') : '';

    var shown = kind ? hits.filter(function (h) { return h.e.k === kind; }) : hits;
    meta.textContent = !terms.length ? 'Type to search ' + idx.length + ' records, guides and places.' :
      shown.length ? shown.length + ' result' + (shown.length === 1 ? '' : 's') + ' for “' + input.value.trim() + '”' : 'No matches for “' + input.value.trim() + '”. Try a shorter word.';
    out.innerHTML = shown.slice(0, 120).map(function (h) {
      var e = h.e;
      return '<a class="sr" href="' + e.u + '"><span class="sr__k">' + giEsc(e.k) + '</span><span class="sr__t">' + giEsc(e.t) + '</span><span class="sr__d">' + giEsc(e.c ? e.c + ' — ' + e.d : e.d) + '</span></a>';
    }).join('');

    var u = new URL(location.href);
    if (q) u.searchParams.set('q', input.value.trim()); else u.searchParams.delete('q');
    if (kind) u.searchParams.set('k', kind); else u.searchParams.delete('k');
    history.replaceState(null, '', u);
  }

  facets.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-k]'); if (!b) return;
    kind = b.getAttribute('data-k'); run();
  });
  var t;
  input.addEventListener('input', function () { clearTimeout(t); t = setTimeout(run, 90); });
  document.getElementById('searchForm').addEventListener('submit', function (e) { e.preventDefault(); run(); });

  fetch('/GTAIndex-Demo/assets/search-index.json').then(function (r) { return r.json(); }).then(function (d) { idx = d; run(); input.focus(); });
})();
