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
    // "How the data works": an inline reveal that never scrolls. Opening shrinks the hero to
    // the top (zoom), tucks the status line and the press credit smaller towards the bottom
    // corners, and fades the text in across the band between them. Everything is measured
    // here with transitions off, so whatever the screen the text sits in the real gap at
    // 13px or more; the hero shrinks only as far as it must. Esc or a second click reverses it.
    (function () {
        var ob = document.querySelector('.ob');
        var hero = document.getElementById('obHero');
        var panel = document.getElementById('obMethod');
        var toggle = document.querySelector('.ob-method-toggle');
        var status = document.getElementById('obStatus');
        var credit = document.querySelector('.ob-credit');
        var text = hero && hero.querySelector('.ob-text');
        var wideMq = window.matchMedia('(min-width: 900px) and (min-height: 560px)');
        if (!ob || !hero || !panel || !toggle || !credit || !text) return;
        var EDGE = 14, GAP = 16, MIN = 13, MAX = 15, open = false;
        var HK = [0.62, 0.55, 0.5, 0.45, 0.4];
        function px(v) { return parseFloat(v) || 0; }
        function set(name, v) { ob.style.setProperty(name, v); }
        function showStatus() { return status && !status.hidden; }
        // Fit the panel to a width and read its natural height at a given type size.
        function panelHeight(w, size) {
            panel.style.width = w + 'px'; set('--ob-pf', size + 'px');
            return panel.offsetHeight;
        }
        // Must run with .ob-measuring on and .is-open off. Leaves the result in custom properties.
        function fit() {
            var wide = wideMq.matches, i;
            ob.classList.toggle('ob-narrow', !wide); panel.classList.toggle('is-narrow', !wide);
            ob.classList.remove('is-open');
            var o = ob.getBoundingClientRect();
            var W = o.width, H = o.height, safe = wide ? 0 : 6;
            var c = credit.getBoundingClientRect(), s = showStatus() ? status.getBoundingClientRect() : null;
            var fs = wide ? 0.78 : 0.82;
            set('--ob-fs', fs);
            // Corners: credit's right (wide) or left (narrow) edge and bottom move to the screen edge.
            var cdx = wide ? (o.right - EDGE) - c.right : (o.left + EDGE) - c.left;
            var cdy = (o.bottom - EDGE - safe) - c.bottom;
            var cH = c.height * fs;
            set('--ob-cx', cdx + 'px'); set('--ob-cy', cdy + 'px');
            var sdx = 0, sdy = 0, sRight = o.left + EDGE;
            if (s) {
                var padL = px(getComputedStyle(status).paddingLeft), sp = padL;
                var textLeft = s.left + padL;
                sdx = (o.left + EDGE) - textLeft;
                var sCenter = s.top + s.height / 2;
                var tCenter = wide ? (o.bottom - EDGE - cH / 2) : (o.bottom - EDGE - safe - cH - 6 - (s.height * fs) / 2);
                sdy = tCenter - sCenter;
                sRight = (o.left + EDGE) + (s.width - 2 * sp) * fs;   // visible text right edge
            }
            set('--ob-sx', sdx + 'px'); set('--ob-sy', sdy + 'px');
            var panelLeft, panelRight, panelBottom, bandTop;
            var creditLeft = wide ? (o.right - EDGE) - c.width * fs : o.left;
            if (wide) {
                panelLeft = sRight + GAP * 1.5; panelRight = creditLeft - GAP * 1.5;
                panelBottom = o.bottom - EDGE;
            } else {
                panelLeft = o.left + px(getComputedStyle(ob).paddingLeft); panelRight = o.right - px(getComputedStyle(ob).paddingRight);
                var footTop = (s ? o.bottom - EDGE - safe - cH - 6 - s.height * fs : o.bottom - EDGE - safe - cH);
                if (s) footTop += (s.height * (1 - fs)) / 2 * 0;   // halo padding gives the breathing room
                panelBottom = footTop - GAP * 0.5;
            }
            var w = Math.max(panelRight - panelLeft, 120);
            set('--ob-l', (panelLeft - o.left) + 'px');
            set('--ob-r', (o.right - panelRight) + 'px');
            set('--ob-b', (o.bottom - panelBottom) + 'px');
            // Shrink the hero step by step until the text at 13px+ fits below it.
            var best = null;
            for (i = 0; i < HK.length; i++) {
                var hk = HK[i];
                // the paragraph's own zoom: as large as 0.9 of the title's, never below 13px
                var fsText = px(getComputedStyle(text).fontSize);
                var tk = Math.max(Math.min(hk + 0.05, 0.9), MIN / fsText);
                set('--hk', hk); set('--tk', Math.min(tk, 1));
                ob.classList.add('is-open');
                var hb = Math.max(toggle.getBoundingClientRect().bottom, hero.getBoundingClientRect().bottom);
                ob.classList.remove('is-open');
                var avail = (panelBottom - GAP) - hb;
                // Is a 13px+ panel the right height for the room? The widest type that fits wins.
                var size = null;
                for (var f = MAX; f >= MIN; f -= 0.25) { if (panelHeight(w, f) <= avail) { size = f; break; } }
                best = { hk: hk, tk: tk, size: size, avail: avail };
                if (size) break;
            }
            set('--hk', best.hk); set('--tk', Math.min(best.tk, 1));
            if (!best.size) panelHeight(w, MIN);
            else panelHeight(w, best.size);
            panel.dataset.overflow = best.size ? '0' : String(Math.round(panelHeight(w, MIN) - best.avail));
            panel.dataset.size = String(best.size || MIN);
            panel.dataset.hk = String(best.hk);
        }
        // Measure with transitions off, then return to the closed layout so opening animates.
        function measure() {
            var was = ob.classList.contains('is-open');
            ob.classList.add('ob-measuring');
            fit();
            if (was) ob.classList.add('is-open');
            void ob.offsetHeight;
            ob.classList.remove('ob-measuring');
        }
        function setOpen(state) {
            open = state;
            if (open) { measure(); void ob.offsetHeight; }
            ob.classList.toggle('is-open', open);
            panel.classList.toggle('is-open', open);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) { document.addEventListener('keydown', onKey, true); }
            else { document.removeEventListener('keydown', onKey, true); }
        }
        function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); toggle.focus(); } }
        toggle.addEventListener('click', function () { setOpen(!open); });
        function refit() { if (open) measure(); }
        window.addEventListener('resize', refit);
        window.addEventListener('orientationchange', refit);
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
