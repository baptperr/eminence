// The Observatory page: attach the background video, and fill in the "Last reading" line.
(function () {
    // The <video> ships without a src, so a visitor who asks for reduced motion never
    // downloads it and sees only the still. Switching the preference later pauses it.
    // Portrait screens get the portrait cut; turning the device swaps it.
    var video = document.querySelector('.ob-video');
    var reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
    var portrait = window.matchMedia('(orientation: portrait)');
    function start() {
        if (reduce.matches || !video) return;
        var want = portrait.matches ? video.dataset.srcPortrait : video.dataset.src;
        if (video.getAttribute('src') !== want) video.src = want;
        var p = video.play();
        if (p && p.catch) p.catch(function () {});
    }
    if (reduce.addEventListener) {
        reduce.addEventListener('change', function () { reduce.matches ? video && video.pause() : start(); });
        portrait.addEventListener('change', start);
    }
    start();

    // "Last reading" is cosmetic: not read from the Observatory, but a schedule every browser
    // computes identically from the clock. Time is cut into 10-minute slots; slot k has one
    // reading at a fixed pseudo-random point in its first 5 minutes (a hash of k, so the same
    // for every visitor). Consecutive readings are therefore 5 to 15 minutes apart, and the
    // line shows the latest one already past: a reload shows the same time, and it only ever
    // moves forward, for everyone at once. The line stays hidden without JS.
    // "How the data works": an inline reveal. The hero (title to Index link and this toggle) shifts
    // up and shrinks; the text fades in at the foot, between the status line and the press
    // credit, which never move. The panel's edges and the hero's offset are measured here, so
    // the text always sits in the real gap, whatever the size. Phones have no gap: the text
    // spans the width, just above the status line. Esc or a second click reverses it.
    (function () {
        var ob = document.querySelector('.ob');
        var hero = document.getElementById('obHero');
        var panel = document.getElementById('obMethod');
        var toggle = document.querySelector('.ob-method-toggle');
        var status = document.getElementById('obStatus');
        var credit = document.querySelector('.ob-credit');
        if (!ob || !hero || !panel || !toggle || !credit) return;
        var SCALE = 0.85, GAP = 12, open = false;
        function px(v) { return parseFloat(v) || 0; }
        function layout() {
            var o = ob.getBoundingClientRect(), c = credit.getBoundingClientRect();
            var wide = window.matchMedia('(min-width: 900px) and (min-height: 560px)').matches;
            var navB = px(getComputedStyle(ob).paddingTop) + o.top;
            var left, right, bottom;
            if (wide) {
                var sr = status && !status.hidden ? status.getBoundingClientRect() : { right: o.left + px(getComputedStyle(ob).paddingLeft), bottom: c.bottom };
                var sp = status && !status.hidden ? px(getComputedStyle(status).paddingRight) : 0;
                left = sr.right - sp - o.left + 1.5 * GAP;
                right = o.right - c.left + 1.5 * GAP;
                bottom = o.bottom - c.bottom;
            } else {
                var top = (status && !status.hidden) ? status.getBoundingClientRect().top + px(getComputedStyle(status).paddingTop) : c.top;
                left = px(getComputedStyle(ob).paddingLeft);
                right = px(getComputedStyle(ob).paddingRight);
                bottom = o.bottom - Math.min(top, c.top) + GAP;
            }
            ob.style.setProperty('--ob-l', left + 'px');
            ob.style.setProperty('--ob-r', right + 'px');
            ob.style.setProperty('--ob-b', bottom + 'px');
            ob.style.setProperty('--ob-h', 'none');
            ob.style.setProperty('--ob-scale', SCALE);
            // Natural hero box (transform off), then the shift that lifts its scaled bottom clear of the panel.
            var was = hero.style.transition; hero.style.transition = 'none';
            var had = hero.classList.contains('is-shifted'); hero.classList.remove('is-shifted');
            var h = hero.getBoundingClientRect();
            if (had) hero.classList.add('is-shifted');
            hero.style.transition = was;
            var panelTop = o.bottom - bottom - panel.offsetHeight;
            // the toggle hangs below the hero; include it in the block that must clear the panel
            var t = toggle.getBoundingClientRect(), bottomEdge = Math.max(h.bottom, t.bottom - (had ? 0 : 0));
            var natBottom = h.bottom + (toggle.offsetHeight + px(getComputedStyle(toggle.parentNode).marginTop));
            var scaledBottom = h.top + (natBottom - h.top) * SCALE;
            var shift = Math.min(0, panelTop - GAP - scaledBottom);
            var minTop = navB - h.top;   // do not climb under the nav
            var over = Math.max(0, minTop - shift);
            if (over > 0) shift = minTop;
            ob.style.setProperty('--ob-shift', shift + 'px');
            panel.dataset.overflow = over > 0 ? Math.round(over) : '0';
            if (over > 0) {   // never clip silently: let the panel scroll, and flag it
                var avail = o.bottom - bottom - (h.top + shift + (natBottom - h.top) * SCALE) - GAP;
                ob.style.setProperty('--ob-h', Math.max(avail, 80) + 'px');
            }
        }
        function set(state) {
            open = state;
            if (open) layout();
            hero.classList.toggle('is-shifted', open);
            panel.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) { panel.scrollTop = 0; document.addEventListener('keydown', onKey, true); }
            else { document.removeEventListener('keydown', onKey, true); }
        }
        function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); set(false); toggle.focus(); } }
        toggle.addEventListener('click', function () { set(!open); });
        window.addEventListener('resize', function () { if (open) layout(); });
        window.addEventListener('orientationchange', function () { if (open) layout(); });
    })();

    var line = document.getElementById('obStatus');
    var out = document.getElementById('obStatusTime');
    if (!line || !out) return;
    var SLOT = 10 * 60 * 1000, JITTER = 5 * 60 * 1000;
    function hash(k) {   // integer -> [0, 1), fixed for a given k
        var h = Math.imul(k ^ 0x5bd1e995, 0x2c1b3c6d);
        h = Math.imul(h ^ (h >>> 15), 0x297a2d39);
        h ^= h >>> 15;
        return (h >>> 0) / 4294967296;
    }
    function reading(k) { return k * SLOT + Math.floor(hash(k) * JITTER / 1000) * 1000; }
    function latest(now) {
        var k = Math.floor(now / SLOT);
        return reading(k) <= now ? reading(k) : reading(k - 1);
    }
    var two = function (n) { return (n < 10 ? '0' : '') + n; };
    function show() {
        var d = new Date(latest(Date.now()));
        out.textContent = two(d.getUTCDate()) + '.' + two(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() +
            ' \u00b7 ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ' UTC';
        out.setAttribute('datetime', d.toISOString());
        line.hidden = false;
    }
    show();
    setInterval(show, 20000);
})();
