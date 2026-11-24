/* Pinned scroll-scrub hero controller.
   Each [data-scrub-box] is a tall "track"; its [data-scrub-pin] child is sticky and
   fills the viewport. As you scroll through the track, the clip's currentTime is eased
   toward the scroll progress (0 → end), so the hero holds and the clip plays under your
   scroll; when it reaches the end the pin releases and the page scrolls on. Scrolling up
   rewinds it. No autoplay, no loop. Desktop pointers only (matches the `scrub-on` flag);
   touch / reduced-motion keep the static poster and download nothing. */
(function () {
  'use strict';
  var mm = window.matchMedia;
  var active = document.documentElement.classList.contains('scrub-on') ||
    (mm && mm('(hover: hover) and (pointer: fine)').matches &&
     !mm('(prefers-reduced-motion: reduce)').matches);
  var videos = [].slice.call(document.querySelectorAll('video[data-scrub]'));
  if (!videos.length || !active) return;

  var clamp = function (v, a, b) { return v < a ? a : (v > b ? b : v); };
  var headerH = parseFloat(getComputedStyle(document.documentElement)
    .getPropertyValue('--header-h')) || 72;

  videos.forEach(function (video) {
    var box = video.closest('[data-scrub-box]') || video.parentElement;
    var pin = box && box.querySelector('[data-scrub-pin]');
    if (!box || !pin) return;

    var duration = 0, ready = false, seeking = false, jump = null;
    var cur = 0, raf = 0;

    function markReady() {
      duration = video.duration || 0;
      if (duration && !ready) { ready = true; if (!raf) raf = requestAnimationFrame(frame); }
    }
    video.addEventListener('loadedmetadata', markReady);
    video.addEventListener('loadeddata', markReady);
    video.addEventListener('canplay', markReady);
    video.addEventListener('seeked', function () {
      seeking = false;
      if (jump !== null) { var t = jump; jump = null; seekTo(t); }
    });

    video.preload = 'auto';
    video.muted = true;
    if (!video.paused) { try { video.pause(); } catch (e) {} }
    try { video.load(); } catch (e) {}

    function seekTo(t) {
      t = clamp(t, 0, duration ? duration - 0.001 : 0);
      if (seeking) { jump = t; return; }
      if (Math.abs(video.currentTime - t) < 0.002) return;
      seeking = true;
      try { video.currentTime = t; } catch (e) { seeking = false; }
    }

    function progress() {
      var rect = box.getBoundingClientRect();
      var range = box.offsetHeight - pin.offsetHeight; // scrub scroll distance
      if (range <= 0) return 0;
      return clamp((headerH - rect.top) / range, 0, 1);
    }

    function frame() {
      var rect = box.getBoundingClientRect();
      var vh = window.innerHeight || 1;
      if (rect.bottom < -40 || rect.top > vh + 40) { raf = requestAnimationFrame(frame); return; }

      var p = progress();
      // fade the copy over the back 45% of the scrub
      var fade = clamp(1 - (p - 0.55) / 0.45, 0, 1);
      box.style.setProperty('--scrub-fade', fade.toFixed(3));

      if (ready && duration) {
        var target = p * duration;
        cur += (target - cur) * 0.22;                 // ease toward scroll target
        if (Math.abs(target - cur) < 0.0015) cur = target;
        seekTo(cur);
      }
      raf = requestAnimationFrame(frame);
    }
  });
})();
