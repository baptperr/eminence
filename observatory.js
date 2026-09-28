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

    // The line stays hidden unless /observatory-status.json holds a real timestamp.
    var line = document.getElementById('obStatus');
    var out = document.getElementById('obStatusTime');
    if (!line || !out || !window.fetch) return;
    fetch('/observatory-status.json', { cache: 'no-cache' })
        .then(function (r) { if (!r.ok) throw 0; return r.json(); })
        .then(function (data) {
            var iso = data && data.last_reading;
            var d = typeof iso === 'string' ? new Date(iso) : null;
            if (!d || isNaN(d.getTime())) return;
            var two = function (n) { return (n < 10 ? '0' : '') + n; };
            out.textContent = two(d.getUTCDate()) + '.' + two(d.getUTCMonth() + 1) + '.' + d.getUTCFullYear() +
                ' · ' + two(d.getUTCHours()) + ':' + two(d.getUTCMinutes()) + ' UTC';
            out.setAttribute('datetime', d.toISOString());
            line.hidden = false;
        })
        .catch(function () {});
})();
