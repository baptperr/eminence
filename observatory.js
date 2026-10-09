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
    // "How the data works": an inline reveal that never scrolls. Opening lifts and shrinks the
    // hero a little, grows the text out of the toggle as a continuation of the hero paragraph,
    // and slides the Index link down into the bottom band between the status line and the
    // press credit (which never move). Everything is measured here with transitions off, so
    // whatever the screen the text sits in the real room at 13px or more; the hero shrinks and
    // the measure widens only as far as they must. Esc or a second click reverses it.
    (function () {
        var ob = document.querySelector('.ob');
        var hero = document.getElementById('obHero');
        var panel = document.getElementById('obMethod');
        var toggle = document.querySelector('.ob-method-toggle');
        var status = document.getElementById('obStatus');
        var credit = document.querySelector('.ob-credit');
        var link = hero && hero.querySelector('.ob-link');
        var text = hero && hero.querySelector('.ob-text');
        var wideMq = window.matchMedia('(min-width: 900px) and (min-height: 560px)');
        if (!ob || !hero || !panel || !toggle || !credit || !text || !link) return;
        var GAP = 30, MIN = 13, open = false;
        var HK = [0.85, 0.8, 0.72, 0.65, 0.58, 0.52, 0.46];
        function px(v) { return parseFloat(v) || 0; }
        function set(name, v) { ob.style.setProperty(name, v); }
        function showStatus() { return status && !status.hidden; }
        // Must run with .ob-measuring on. Leaves the result in custom properties.
        function fit() {
            var wide = wideMq.matches, i, j;
            ob.classList.toggle('ob-narrow', !wide); panel.classList.toggle('is-narrow', !wide);
            ob.classList.remove('is-open'); panel.classList.remove('is-open');
            var o = ob.getBoundingClientRect();
            var a = link.querySelector('a');
            var c = credit.getBoundingClientRect();
            var s = showStatus() ? status.getBoundingClientRect() : null;
            var sPad = s ? px(getComputedStyle(status).paddingLeft) : 0;
            var sPadV = s ? px(getComputedStyle(status).paddingTop) : 0;
            var lh = link.getBoundingClientRect().height;
            set('--lk-h', lh + 'px');
            // The band the link settles in: wide, centred between the status text and the credit,
            // its first line level with the status; narrow, just above the status line.
            var bandX, bandY, bandTop;
            var aH = a.getBoundingClientRect().height;
            if (wide) {
                var sRight = s ? s.right - sPad : o.left;
                bandX = (sRight + c.left) / 2;
                bandY = s ? s.top + s.height / 2 : c.top + c.height / 2;
                bandTop = bandY - aH / 2;
            } else {
                var footTop = s ? s.top + sPadV : c.top;
                bandTop = footTop - GAP * 0.6 - lh;
            }
            var fsText = px(getComputedStyle(text).fontSize), best = null;
            var fsSub = px(getComputedStyle(hero.querySelector('.ob-sub')).fontSize);
            // Size hierarchy: the hero paragraph stays HIER px larger than the new text, which
            // stays at 13px or more. The new text spans most of the viewport (above the status
            // line and press credit now), centred, so it needs few lines.
            var HIER = 1.5, wantW = Math.min(window.innerWidth * 0.78, 1000);
            for (i = 0; i < HK.length && !best; i++) {
                var hk = HK[i];
                var heroPx = Math.max(MIN + HIER, Math.min(fsText * Math.min(hk + 0.1, 0.85), fsText));
                var tk = heroPx / fsText, pk = Math.max(MIN, heroPx - HIER) / fsText;
                set('--hk', hk); set('--sk', Math.min(Math.max(hk, MIN / fsSub), 1)); set('--tk', tk); set('--pk', pk);
                set('--tw', wide ? Math.round(wantW / pk) + 'px' : 'none');
                set('--lk-dx', '0px'); set('--lk-dy', '0px');
                ob.classList.add('is-open'); panel.classList.add('is-open');
                var tb = toggle.getBoundingClientRect().bottom;
                var lr = link.getBoundingClientRect();
                var room = bandTop - (wide ? GAP : 14) - tb;
                if (room >= (wide ? 40 : 22) || i === HK.length - 1) {
                    var ar = a.getBoundingClientRect();
                    set('--lk-dx', wide ? (bandX - (ar.left + ar.width / 2)) + 'px' : '0px');
                    set('--lk-dy', (wide ? bandTop - ar.top : bandTop - lr.top) + 'px');
                    best = { hk: hk, tk: tk, pk: pk, room: room };
                    break;
                }
                ob.classList.remove('is-open'); panel.classList.remove('is-open');
            }
            ob.classList.remove('is-open'); panel.classList.remove('is-open');
            panel.dataset.room = String(Math.round(best.room));
            panel.dataset.hk = String(best.hk);
            panel.dataset.size = String(Math.round(fsText * best.pk * 10) / 10);
            panel.dataset.hero = String(Math.round(fsText * best.tk * 10) / 10);
        }
        // Measure with transitions off, then return to the prior state. The open flag is already set
        // when opening starts, so keepOpen says whether to restore the open look (a resize) or
        // leave the closed baseline in place (the opening click: the cause of the old jump).
        function measure(keepOpen) {
            var was = keepOpen;
            ob.classList.add('ob-measuring');
            fit();
            if (was) { ob.classList.add('is-open'); panel.classList.add('is-open'); }
            void ob.offsetHeight;
            ob.classList.remove('ob-measuring');
        }
        // Opening: measure with transitions off, let the browser paint that closed baseline, and
        // only then add the classes, so every property has a settled "from" value to animate from.
        var raf = 0;
        function apply() {
            ob.classList.toggle('is-open', open);
            panel.classList.toggle('is-open', open);
        }
        function setOpen(state) {
            open = state;
            cancelAnimationFrame(raf);
            toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
            if (open) {
                measure();
                raf = requestAnimationFrame(function () { raf = requestAnimationFrame(apply); });
                document.addEventListener('keydown', onKey, true);
            } else {
                apply();
                document.removeEventListener('keydown', onKey, true);
            }
        }
        function onKey(e) { if (e.key === 'Escape') { e.preventDefault(); setOpen(false); toggle.focus(); } }
        toggle.addEventListener('click', function () { setOpen(!open); });
        function refit() { if (open) measure(true); }
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
