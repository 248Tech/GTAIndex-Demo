/* GTAIndex shell — menu, search shortcut, reveals, app heartbeat, crew indicator + crew overlay on records. */
(function () {
  'use strict';
  var $ = function (id) { return document.getElementById(id); };

  // ---- mobile menu ----
  var menu = $('mobileMenu'), openBtn = $('menuOpen');
  function setMenu(on) {
    if (!menu) return;
    menu.classList.toggle('is-open', on);
    openBtn && openBtn.setAttribute('aria-expanded', on ? 'true' : 'false');
    document.body.style.overflow = on ? 'hidden' : '';
  }
  openBtn && openBtn.addEventListener('click', function () { setMenu(!menu.classList.contains('is-open')); });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape') setMenu(false);
    if (e.key === '/' && !/^(input|textarea|select)$/i.test(e.target.tagName) && !e.target.isContentEditable) {
      var s = $('hdrSearch');
      if (s && s.offsetParent) { e.preventDefault(); s.focus(); } else { e.preventDefault(); location.href = '/GTAIndex-Demo/search'; }
    }
  });

  // ---- shared reveal ----
  // .db-rev / .rec-rev start hidden on any page that uses them (home, database, records)
  var els = document.querySelectorAll('.reveal, .db-rev, .rec-rev');
  if (els.length) {
    if (!('IntersectionObserver' in window) || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      els.forEach(function (el) { el.classList.add('is-in'); });
    } else {
      var io = new IntersectionObserver(function (en) {
        en.forEach(function (x) { if (x.isIntersecting) { x.target.classList.add('is-in'); io.unobserve(x.target); } });
      }, { threshold: 0.12 });
      els.forEach(function (el) { io.observe(el); });
    }
  }

  // ---- toast ----
  window.giToast = function (msg) {
    var t = $('giToast'); if (!t) return;
    t.textContent = msg; t.classList.add('is-on');
    clearTimeout(t._h); t._h = setTimeout(function () { t.classList.remove('is-on'); }, 2400);
  };

  // ---- app heartbeat (the app closes itself a while after the last window goes away) ----
  function ping() { fetch('/GTAIndex-Demo/api/ping', { method: 'POST' }).catch(function () {}); }
  ping(); setInterval(ping, 30000);

  var quit = $('giQuit');
  quit && quit.addEventListener('click', function () {
    if (!confirm('Quit GTAIndex? Your crew will see you as offline.')) return;
    fetch('/GTAIndex-Demo/api/quit', { method: 'POST' }).finally(function () {
      document.body.innerHTML = '<div style="min-height:100vh;display:grid;place-items:center;text-align:center;padding:24px"><div><h1 class="display" style="font-size:64px">See you in Leonida</h1><p class="gi-muted">GTAIndex has stopped. You can close this window.</p></div></div>';
    });
  });

  // ---- crew data (shared by header + record overlay + crew page) ----
  var COLORS = ['#FF3D8B', '#FFC83D', '#2FE3D3', '#A24BFF', '#FF7A3D', '#3A86FF', '#1FBF7A'];
  window.giAvatar = function (p) {
    var n = (p && p.name || '?').trim();
    var ini = n.split(/\s+/).map(function (w) { return w[0]; }).join('').slice(0, 2).toUpperCase() || '?';
    var c = (p && p.color) || COLORS[0];
    return '<span class="gi-av" style="background:' + c + '">' + ini.replace(/[<>&"]/g, '') + '</span>';
  };
  window.giEsc = function (s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); };

  var crewPromise = null;
  window.giCrew = function (fresh) {
    if (!crewPromise || fresh) crewPromise = fetch('/GTAIndex-Demo/api/crew').then(function (r) { return r.json(); }).catch(function () { return { peers: [] }; });
    return crewPromise;
  };

  function header(c) {
    var online = (c.peers || []).filter(function (p) { return p.online; }).length;
    var dot = $('crewDot'), cnt = $('crewCount');
    if (dot) dot.classList.toggle('is-on', online > 0);
    if (cnt) cnt.textContent = online ? online + ' online' : 'Crew';
  }

  // Who in the crew has this record saved / planned / completed?
  var STATE = { completed: 'done', planned: 'planned', saved: 'saved' };
  function overlay(c) {
    var groups = document.querySelectorAll('.progress-actions[data-key]');
    if (!groups.length) return;
    groups.forEach(function (g) {
      var key = g.dataset.key, tags = [];
      (c.peers || []).forEach(function (p) {
        var e = p.data && p.data.gi_progress && p.data.gi_progress[key];
        if (e && STATE[e.state]) tags.push('<span class="gi-tag">' + giAvatar(p) + giEsc(p.name) + ' <small>' + STATE[e.state] + '</small></span>');
      });
      var line = g.parentNode.querySelector('.gi-crewline');
      if (!line) { line = document.createElement('div'); line.className = 'gi-crewline'; g.insertAdjacentElement('afterend', line); }
      line.innerHTML = tags.length ? '<span>Crew:</span>' + tags.join('') : '';
    });
  }

  function refresh() { giCrew(true).then(function (c) { header(c); overlay(c); }); }
  refresh();
  setInterval(refresh, 20000);
})();
