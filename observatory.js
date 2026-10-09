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
    // "How the data works": a centred pop-up. Opens from the toggle, closes with the x, Esc or a
    // click on the backdrop; focus moves into it and back to the toggle.
    (function () {
        var toggle = document.querySelector('.ob-method-toggle');
        var modal = document.getElementById('obModal');
        var dialog = document.getElementById('obMethod');
        var x = modal && modal.querySelector('.ob-modal-close');
        if (!toggle || !modal || !dialog) return;
        function close() {
            if (modal.hidden) return;
            modal.hidden = true;
            toggle.setAttribute('aria-expanded', 'false');
            document.removeEventListener('keydown', onKey, true);
            toggle.focus();
        }
        function onKey(e) {
            if (e.key === 'Escape') { e.preventDefault(); close(); }
            else if (e.key === 'Tab') {   // keep focus inside while open
                e.preventDefault();
                (document.activeElement === x ? dialog : x).focus();
            }
        }
        toggle.addEventListener('click', function () {
            modal.hidden = false;
            toggle.setAttribute('aria-expanded', 'true');
            document.addEventListener('keydown', onKey, true);
            dialog.scrollTop = 0;
            dialog.focus();
        });
        if (x) x.addEventListener('click', close);
        modal.addEventListener('click', function (e) { if (e.target === modal) close(); });
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
