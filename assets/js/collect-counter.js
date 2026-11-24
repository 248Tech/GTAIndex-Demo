/* GTAIndex — manual "found" counter for collectible sets that don't have map locations yet.
   Writes the same gi_collect_meta record the hub, progress page and crew page read. */
(function () {
  var cfg = window.GI_COLLECT, sets = window.GI_COLLECT_SETS_ALL || [];
  if (!cfg || (cfg.points && cfg.points.length)) return;
  var set = sets.filter(function (s) { return s.slug === cfg.slug; })[0];
  var total = set ? set.total : 0;
  var box = document.getElementById('giCounter');
  if (!box || !total) return;

  var META = 'gi_collect_meta';
  function get() { var m = GIStore.get(META)[cfg.slug]; return m ? Math.min(m.done || 0, total) : 0; }
  function put(n) {
    var m = GIStore.get(META);
    m[cfg.slug] = { done: n, total: total, name: cfg.name, url: cfg.url };
    GIStore.set(META, m);
  }
  box.hidden = false;
  box.innerHTML =
    '<div class="collect-overall__row"><strong>Found so far</strong><span class="collect-overall__pct" id="ccPct">0%</span></div>' +
    '<div class="collbar"><span class="collbar__fill" id="ccFill" style="width:0%"></span></div>' +
    '<div class="gi-row" style="margin-top:12px">' +
      '<button type="button" class="gi-btn gi-btn--sm" data-d="-1" aria-label="One fewer">&minus;</button>' +
      '<input class="gi-input" id="ccNum" type="number" min="0" max="' + total + '" style="width:96px;height:36px;text-align:center"> ' +
      '<span class="gi-muted">of ' + total + '</span>' +
      '<button type="button" class="gi-btn gi-btn--sm gi-btn--hot" data-d="1" aria-label="One more">+1 found</button>' +
    '</div>' +
    '<p class="gi-muted" style="margin:10px 0 0">No locations are plotted yet, so count them here. Your crew sees this total.</p>';
  var num = document.getElementById('ccNum');
  function paint() {
    var n = get(), pct = Math.round(n / total * 100);
    num.value = n;
    document.getElementById('ccPct').textContent = pct + '%';
    document.getElementById('ccFill').style.width = pct + '%';
  }
  function setN(n) { n = Math.max(0, Math.min(total, n | 0)); put(n); paint(); }
  box.addEventListener('click', function (e) {
    var d = e.target.getAttribute && e.target.getAttribute('data-d');
    if (d) setN(get() + (+d));
  });
  num.addEventListener('change', function () { setN(+num.value); });
  paint();
})();
