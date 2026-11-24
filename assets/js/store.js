/* GTAIndex store — progress lives in the local GTAIndex app (state.json), not the browser.
   The server injects window.GI_STATE into every page; writes are debounced back to /api/data. */
(function () {
  var st = window.GI_STATE || { data: {}, profile: {} };
  var data = st.data || {};
  var timer = null;

  function clone(v) { return v ? JSON.parse(JSON.stringify(v)) : {}; }
  function flush() {
    timer = null;
    try {
      fetch('/GTAIndex-Demo/api/data', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data), keepalive: true });
    } catch (e) {}
  }

  window.GIStore = {
    get: function (k) { return clone(data[k]); },
    set: function (k, v) { data[k] = v; clearTimeout(timer); timer = setTimeout(flush, 150); },
    all: function () { return clone(data); },
    profile: st.profile || {}
  };

  window.addEventListener('pagehide', function () { if (timer) { clearTimeout(timer); flush(); } });

  // Another tab (or an import) may have changed things: refresh when we come back into view.
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState !== 'visible' || timer) return;
    fetch('/GTAIndex-Demo/api/data').then(function (r) { return r.json(); }).then(function (d) {
      if (JSON.stringify(d) === JSON.stringify(data)) return;
      data = d || {};
      document.dispatchEvent(new CustomEvent('giprogress:change'));
    }).catch(function () {});
  });
})();
