/* GTAIndex — anonymous progress tracker (localStorage). */
(function () {
  var KEY = 'gi_progress';

  function read() { return GIStore.get(KEY); }
  function write(o) { GIStore.set(KEY, o); }

  var GC = window.GIProgress = {
    all: read,
    get: function (k) { return read()[k]; },
    set: function (k, meta, state) {
      var o = read();
      if (state) { o[k] = { name: meta.name, url: meta.url, type: meta.type, state: state, ts: Date.now() }; }
      else { delete o[k]; }
      write(o);
      document.dispatchEvent(new CustomEvent('giprogress:change'));
    }
  };

  function esc(s) { return (s || '').replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ---- Action button groups on entity pages ----
  function reflect(group) {
    var cur = GC.get(group.dataset.key);
    group.querySelectorAll('button[data-state]').forEach(function (btn) {
      btn.classList.toggle('is-on', !!(cur && cur.state === btn.dataset.state));
    });
  }
  function bindGroups() {
    document.querySelectorAll('.progress-actions[data-key]').forEach(function (group) {
      if (group._bound) return;
      group._bound = true;
      var key = group.dataset.key;
      var meta = { name: group.dataset.name, url: group.dataset.url, type: group.dataset.type };
      group.querySelectorAll('button[data-state]').forEach(function (btn) {
        btn.addEventListener('click', function () {
          var cur = GC.get(key);
          var st = btn.dataset.state;
          GC.set(key, meta, (cur && cur.state === st) ? null : st);
          reflect(group);
        });
      });
      reflect(group);
    });
  }

  // ---- /progress dashboard ----
  var LABELS = { completed: 'Completed', planned: 'Planned', saved: 'Saved' };
  var TYPE_LABEL = { poi: 'Location', vehicle: 'Vehicle', weapon: 'Weapon', item: 'Item', character: 'Character', region: 'Region' };

  function renderDashboard() {
    var root = document.getElementById('progressRoot');
    if (!root) return;
    var o = read();
    var keys = Object.keys(o);
    var groups = { completed: [], planned: [], saved: [] };
    keys.forEach(function (k) { var e = o[k]; if (groups[e.state]) groups[e.state].push(Object.assign({ key: k }, e)); });
    var total = keys.length, done = groups.completed.length;
    var pct = total ? Math.round(done / total * 100) : 0;

    if (total === 0) {
      root.innerHTML = '<div class="empty"><strong>Nothing tracked yet.</strong> Open the map or a database record and use <em>Save</em>, <em>Plan visit</em>, or <em>Mark complete</em> to start your list. It’s saved on this PC and shared with your crew.</div>';
      return;
    }

    var html = '';
    html += '<div class="prog-summary"><div class="prog-meter"><span style="width:' + pct + '%"></span></div>'
      + '<div class="prog-figures"><span class="prog-pct">' + pct + '%</span> · ' + done + ' completed · ' + groups.planned.length + ' planned · ' + groups.saved.length + ' saved</div></div>';

    ['completed', 'planned', 'saved'].forEach(function (state) {
      var arr = groups[state];
      if (!arr.length) return;
      arr.sort(function (a, b) { return b.ts - a.ts; });
      html += '<section class="prog-group"><h2>' + LABELS[state] + ' <span>' + arr.length + '</span></h2><ul class="prog-list">';
      arr.forEach(function (e) {
        html += '<li><a href="' + esc(e.url) + '"><span class="pg-type">' + esc(TYPE_LABEL[e.type] || 'Item') + '</span><span class="pg-name">' + esc(e.name) + '</span></a>'
          + '<button type="button" class="pg-remove" data-key="' + esc(e.key) + '" aria-label="Remove">Remove</button></li>';
      });
      html += '</ul></section>';
    });

    root.innerHTML = html;
    root.querySelectorAll('.pg-remove').forEach(function (btn) {
      btn.addEventListener('click', function () { GC.set(btn.dataset.key, {}, null); });
    });
  }

  // ---- Homepage completion snapshot ----
  function renderHomeSnapshot() {
    var pctEl = document.getElementById('homeProgressPct');
    if (!pctEl) return;
    var o = read();
    var keys = Object.keys(o);
    var total = keys.length;
    var done = keys.filter(function (k) { return o[k].state === 'completed'; }).length;
    var pct = total ? Math.round(done / total * 100) : 0;
    pctEl.textContent = pct + '%';
    var bar = document.getElementById('homeProgressBar');
    if (bar) bar.style.width = pct + '%';
    var note = document.getElementById('homeProgressNote');
    if (note && total) note.textContent = done + ' of ' + total + ' tracked item' + (total === 1 ? '' : 's') + ' complete — keep going on your progress page.';
  }

  document.addEventListener('giprogress:change', function () { renderDashboard(); renderHomeSnapshot(); });
  document.addEventListener('DOMContentLoaded', function () { bindGroups(); renderDashboard(); renderHomeSnapshot(); });
  bindGroups();
  renderDashboard();
  renderHomeSnapshot();
})();
