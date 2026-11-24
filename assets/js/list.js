/* Database list pages — client-side filter (search + kind chips), sort, live count, reveals. */
(function () {
  'use strict';
  var grid = document.getElementById('listGrid');
  if (!grid) return;

  var cards = [].slice.call(grid.querySelectorAll('[data-name]'));
  var order = cards.slice(); // original ("featured") order
  var search = document.getElementById('listSearch');
  var sort = document.getElementById('listSort');
  var countEl = document.getElementById('listCount');
  var emptyMsg = document.getElementById('listEmptyMsg');
  var chips = [].slice.call(document.querySelectorAll('.list-chip'));
  var activeKind = '';

  function apply() {
    var q = (search && search.value || '').trim().toLowerCase();
    var shown = 0;
    cards.forEach(function (c) {
      var okKind = !activeKind || c.getAttribute('data-kind') === activeKind;
      var okText = !q || (c.getAttribute('data-name') || '').indexOf(q) !== -1;
      var show = okKind && okText;
      c.hidden = !show;
      if (show) shown++;
    });
    if (countEl) countEl.textContent = shown;
    if (emptyMsg) emptyMsg.hidden = shown !== 0;
  }

  function applySort() {
    var v = sort ? sort.value : 'featured';
    var arr = order.slice();
    if (v === 'az' || v === 'za') {
      arr.sort(function (a, b) {
        var an = a.getAttribute('data-name'), bn = b.getAttribute('data-name');
        return an < bn ? -1 : an > bn ? 1 : 0;
      });
      if (v === 'za') arr.reverse();
    }
    arr.forEach(function (c) { grid.appendChild(c); });
  }

  if (search) search.addEventListener('input', apply);
  if (sort) sort.addEventListener('change', applySort);
  chips.forEach(function (chip) {
    chip.addEventListener('click', function () {
      activeKind = chip.getAttribute('data-kind') || '';
      chips.forEach(function (c) { c.classList.toggle('is-on', c === chip); });
      apply();
    });
  });

  // Reveal cards as they enter the viewport (natural stagger while scrolling).
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduce || !('IntersectionObserver' in window)) {
    cards.forEach(function (c) { c.classList.add('is-in'); });
  } else {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add('is-in'); io.unobserve(en.target); }
      });
    }, { threshold: 0.1 });
    cards.forEach(function (c) { io.observe(c); });
  }
})();
