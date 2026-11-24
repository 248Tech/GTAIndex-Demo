/* GTAIndex — Crew page: profile, LAN/manual/file friends, leaderboard and compare. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };
  var COLORS = ['#FF3D8B', '#FFC83D', '#2FE3D3', '#A24BFF', '#FF7A3D', '#3A86FF', '#1FBF7A'];
  var TYPE = { poi: 'Location', location: 'Location', vehicle: 'Vehicle', weapon: 'Weapon', item: 'Item', character: 'Character', region: 'Region' };
  var STATE = { completed: 'Done', planned: 'Planned', saved: 'Saved' };
  var sets = [], crew = null, me = null, pickColor = COLORS[0], cmpId = null, cmpTab = 'collect', cmpFilter = 'all';

  function api(method, url, body) {
    return fetch(url, { method: method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || r.statusText); return j; }); });
  }
  function ago(ms) {
    if (!ms) return 'never';
    var s = Math.max(0, (Date.now() - ms) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return Math.round(s / 60) + ' min ago';
    if (s < 86400) return Math.round(s / 3600) + ' h ago';
    return Math.round(s / 86400) + ' d ago';
  }

  // ---- stats ----
  function stats(data) {
    data = data || {};
    var prog = data.gi_progress || {}, meta = data.gi_collect_meta || {};
    var o = { completed: 0, planned: 0, saved: 0, tracked: 0, cDone: 0, cTotal: 0, sets: {} };
    Object.keys(prog).forEach(function (k) { var s = prog[k].state; if (o[s] != null) o[s]++; o.tracked++; });
    sets.forEach(function (s) {
      var d = Math.min((meta[s.slug] && meta[s.slug].done) || 0, s.total);
      o.sets[s.slug] = d; o.cDone += d; o.cTotal += s.total;
    });
    o.cPct = o.cTotal ? Math.round(o.cDone / o.cTotal * 100) : 0;
    o.tPct = o.tracked ? Math.round(o.completed / o.tracked * 100) : 0;
    return o;
  }

  // ---- profile ----
  function paintProfile() {
    $('meName').value = me.name || '';
    $('meShare').checked = me.sharing !== false;
    pickColor = me.color || COLORS[0];
    $('meColors').innerHTML = COLORS.map(function (c) {
      return '<button type="button" data-c="' + c + '" aria-label="Colour ' + c + '" aria-pressed="' + (c === pickColor) + '" style="width:30px;height:30px;border-radius:50%;cursor:pointer;background:' + c + ';border:3px solid ' + (c === pickColor ? '#fff' : 'transparent') + '"></button>';
    }).join('');
    $('meAddrs').innerHTML = (me.addrs || []).length
      ? me.addrs.map(function (a) { return '<button type="button" class="gi-code" data-copy="' + a + '" title="Click to copy">' + a + '</button>'; }).join('')
      : '<span class="gi-muted">No network connection found.</span>';
  }
  $('meColors').addEventListener('click', function (e) {
    var b = e.target.closest('[data-c]'); if (!b) return;
    me.color = pickColor = b.getAttribute('data-c'); paintProfile();
  });
  $('meAddrs').addEventListener('click', function (e) {
    var b = e.target.closest('[data-copy]'); if (!b) return;
    var t = b.getAttribute('data-copy');
    (navigator.clipboard ? navigator.clipboard.writeText(t) : Promise.reject()).then(function () { giToast('Copied ' + t); }).catch(function () { prompt('Your address:', t); });
  });
  $('meSave').addEventListener('click', function () {
    var name = $('meName').value.trim();
    if (!name) { giToast('Pick a player name first'); $('meName').focus(); return; }
    api('PUT', '/GTAIndex-Demo/api/profile', { name: name, color: pickColor, sharing: $('meShare').checked })
      .then(function () { giToast('Saved, your crew will see “' + name + '”'); load(); })
      .catch(function (e) { giToast(e.message); });
  });

  // ---- add / import / remove ----
  $('addBtn').addEventListener('click', function () {
    var a = $('addAddr').value.trim(); if (!a) return;
    $('addBtn').disabled = true;
    api('POST', '/GTAIndex-Demo/api/friends', { addr: a })
      .then(function (p) { giToast('Added ' + (p.name || a)); $('addAddr').value = ''; load(); })
      .catch(function (e) { giToast('Couldn’t reach ' + a + ': ' + e.message); })
      .finally(function () { $('addBtn').disabled = false; });
  });
  $('addAddr').addEventListener('keydown', function (e) { if (e.key === 'Enter') $('addBtn').click(); });
  $('importFile').addEventListener('change', function () {
    var f = this.files[0]; if (!f) return;
    f.text().then(function (t) { return api('POST', '/GTAIndex-Demo/api/import', JSON.parse(t)); })
      .then(function (p) { giToast('Imported ' + p.name + '’s progress'); load(); })
      .catch(function (e) { giToast('Import failed: ' + e.message); });
    this.value = '';
  });

  // ---- leaderboard ----
  function people() {
    var list = [{ id: me.id, name: me.name || 'You', color: me.color, data: GIStore.all(), isMe: true, online: true }];
    return list.concat(crew.peers || []).map(function (p) { p.st = stats(p.data); return p; })
      .sort(function (a, b) { return b.st.cPct - a.st.cPct || b.st.completed - a.st.completed || (a.isMe ? -1 : 1); });
  }
  function bar(label, done, total) {
    var pct = total ? Math.round(done / total * 100) : 0;
    return '<div class="crew-stat">' + label + ' <b>' + done + '/' + total + '</b><span class="collbar collbar--sm" style="margin-top:4px"><span class="collbar__fill" style="width:' + pct + '%"></span></span></div>';
  }
  function paintCrew() {
    var list = people();
    var online = (crew.peers || []).filter(function (p) { return p.online; }).length;
    $('crewStatus').textContent = (crew.peers || []).length ? online + ' online · ' + crew.peers.length + ' in crew' : 'No one yet. Ask a friend to open GTAIndex.';
    $('crewList').innerHTML = list.map(function (p, i) {
      var badge = p.isMe ? '<span class="badge badge--me">You</span>'
        : p.source === 'file' ? '<span class="badge badge--file">From file</span>'
        : p.online ? '<span class="badge badge--on">Online</span>' : '<span class="badge badge--off">Offline</span>';
      var sub = p.isMe ? 'This PC' : (p.source === 'file' ? 'Imported ' + ago(p.updated) : (p.online ? 'Seen ' + ago(p.lastSeen) : 'Last synced ' + ago(p.updated))) + (p.addr ? ' · ' + giEsc(p.addr) : '');
      var setBars = sets.filter(function (s) { return p.st.sets[s.slug]; }).slice(0, 4)
        .map(function (s) { return bar(giEsc(s.name), p.st.sets[s.slug], s.total); }).join('');
      return '<div class="crew-card' + (p.isMe ? ' is-me' : '') + '">' +
        giAvatar(p) +
        '<div><div class="crew-card__name">#' + (i + 1) + ' ' + giEsc(p.name) + ' ' + badge + '</div><div class="crew-card__meta">' + sub + '</div></div>' +
        '<div><div class="crew-card__pct">' + p.st.cPct + '%</div><div class="crew-card__meta" style="text-align:right">collectibles</div></div>' +
        '<div class="crew-card__bars">' +
          bar('Collectibles', p.st.cDone, p.st.cTotal) +
          bar('Records done', p.st.completed, p.st.tracked) +
          '<div class="crew-stat">Planned <b>' + p.st.planned + '</b> · Saved <b>' + p.st.saved + '</b></div>' + setBars +
        '</div>' +
        (p.isMe ? '' : '<div class="crew-card__actions"><button type="button" class="gi-btn gi-btn--sm gi-btn--hot" data-cmp="' + giEsc(p.id) + '">Compare with me</button>' +
          (p.source !== 'lan' || !p.online ? '<button type="button" class="gi-btn gi-btn--sm" data-rm="' + giEsc(p.id) + '">Remove</button>' : '') + '</div>') +
      '</div>';
    }).join('');
    if (cmpId) paintCompare();
  }
  $('crewList').addEventListener('click', function (e) {
    var c = e.target.closest('[data-cmp]'), r = e.target.closest('[data-rm]');
    if (c) { cmpId = c.getAttribute('data-cmp'); paintCompare(); $('cmpPanel').scrollIntoView({ behavior: 'smooth', block: 'start' }); }
    if (r && confirm('Remove this friend from your crew list?')) {
      api('DELETE', '/GTAIndex-Demo/api/friends?id=' + encodeURIComponent(r.getAttribute('data-rm'))).then(load);
    }
  });

  // ---- compare ----
  function paintCompare() {
    var them = (crew.peers || []).filter(function (p) { return p.id === cmpId; })[0];
    if (!them) { $('cmpPanel').hidden = true; cmpId = null; return; }
    $('cmpPanel').hidden = false;
    $('cmpTitle').innerHTML = 'You vs ' + giEsc(them.name);
    var mine = GIStore.all(), a = stats(mine), b = stats(them.data);
    var tabs = [['collect', 'Collectibles'], ['records', 'Records']];
    $('cmpTabs').innerHTML = tabs.map(function (t) { return '<button type="button" class="gi-btn gi-btn--sm" data-tab="' + t[0] + '" aria-pressed="' + (cmpTab === t[0]) + '">' + t[1] + '</button>'; }).join('') +
      (cmpTab === 'records' ? '<span style="width:14px"></span>' + [['all', 'All'], ['them', 'They have, you don’t'], ['me', 'You have, they don’t']]
        .map(function (f) { return '<button type="button" class="gi-btn gi-btn--sm" data-f="' + f[0] + '" aria-pressed="' + (cmpFilter === f[0]) + '">' + f[1] + '</button>'; }).join('') : '');

    var html;
    if (cmpTab === 'collect') {
      html = '<table class="cmp"><thead><tr><th>Set</th><th class="n">You</th><th class="n">' + giEsc(them.name) + '</th></tr></thead><tbody>' +
        sets.map(function (s) {
          var x = a.sets[s.slug], y = b.sets[s.slug];
          return '<tr><td><a href="/GTAIndex-Demo/collectibles/' + s.slug + '">' + giEsc(s.name) + '</a></td><td class="n' + (x > y ? ' yes' : '') + '">' + x + '/' + s.total + '</td><td class="n' + (y > x ? ' yes' : '') + '">' + y + '/' + s.total + '</td></tr>';
        }).join('') +
        '<tr><td><b>Overall</b></td><td class="n"><b>' + a.cPct + '%</b></td><td class="n"><b>' + b.cPct + '%</b></td></tr></tbody></table>';
    } else {
      var pa = mine.gi_progress || {}, pb = (them.data && them.data.gi_progress) || {};
      var keys = Object.keys(Object.assign({}, pa, pb)).filter(function (k) {
        if (cmpFilter === 'them') return pb[k] && pb[k].state === 'completed' && !(pa[k] && pa[k].state === 'completed');
        if (cmpFilter === 'me') return pa[k] && pa[k].state === 'completed' && !(pb[k] && pb[k].state === 'completed');
        return true;
      });
      keys.sort(function (x, y) { var ex = pa[x] || pb[x], ey = pa[y] || pb[y]; return (ex.name || '').localeCompare(ey.name || ''); });
      var cell = function (e) { return e ? '<td class="n' + (e.state === 'completed' ? ' yes' : '') + '">' + STATE[e.state] + '</td>' : '<td class="n no">—</td>'; };
      html = keys.length ? '<table class="cmp"><thead><tr><th>Record</th><th>Type</th><th class="n">You</th><th class="n">' + giEsc(them.name) + '</th></tr></thead><tbody>' +
        keys.map(function (k) {
          var e = pa[k] || pb[k];
          return '<tr><td><a href="' + giEsc(e.url) + '">' + giEsc(e.name) + '</a></td><td class="gi-muted">' + (TYPE[e.type] || 'Record') + '</td>' + cell(pa[k]) + cell(pb[k]) + '</tr>';
        }).join('') + '</tbody></table>'
        : '<p class="gi-muted">Nothing to show here yet. Records get tracked with Save, Plan visit or Mark complete on any map or database page.</p>';
    }
    $('cmpBody').innerHTML = html;
  }
  $('cmpTabs').addEventListener('click', function (e) {
    var t = e.target.closest('[data-tab]'), f = e.target.closest('[data-f]');
    if (t) cmpTab = t.getAttribute('data-tab');
    if (f) cmpFilter = f.getAttribute('data-f');
    if (t || f) paintCompare();
  });
  $('cmpClose').addEventListener('click', function () { cmpId = null; $('cmpPanel').hidden = true; });

  // ---- load ----
  var firstPaint = true;
  function load() {
    return giCrew(true).then(function (c) {
      crew = c;
      if (firstPaint || document.activeElement !== $('meName')) { me = c.me; paintProfile(); }
      else { me.addrs = c.me.addrs; }
      firstPaint = false;
      paintCrew();
    });
  }
  fetch('/GTAIndex-Demo/assets/collect-sets.json').then(function (r) { return r.json(); }).then(function (s) { sets = s; return load(); })
    .then(function () { if (!me.named) { $('meName').focus(); giToast('Set your player name so your crew knows who you are'); } });
  setInterval(load, 10000);
  document.addEventListener('giprogress:change', function () { if (crew) paintCrew(); });
})();
