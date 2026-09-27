// Fit the fighter's name so both lines fill the same measure.
//
// Same binary search index.html uses for the hero and the creed: set a size, measure,
// halve the interval. Because the two lines rarely have the same number of characters,
// filling an identical width lands them on different sizes — that difference is the
// effect, not something set by hand, and it is what stops a long surname wrapping under
// a short given name.
//
// Measured with a Range rather than the element box: the lines are block-level, so their
// boxes stretch to the container whatever the type size is, and measuring the box would
// return the container width every time.
//
// Runs after the webfont has loaded (a fit measured against the fallback face is wrong by
// the difference in their metrics) and again on resize. With this script blocked the
// clamp size in publication.css still renders both lines legibly; only the exact fit is
// lost, so the page never depends on it.
(function () {
    // MAX has to clear the size a SHORT line needs to fill the same measure as a long
    // one -- "Usman" over "Nurmagomedov" wants ~166px at a 540px measure, and a 160 cap
    // silently left the two lines unequal, which is the whole thing this fixes. The real
    // ceiling is the container width, not this number.
    var MIN = 12, MAX = 400;

    function fit() {
        var blocks = document.querySelectorAll('[data-fit-name]');
        if (!blocks.length || !document.createRange) return;
        var range = document.createRange();

        Array.prototype.forEach.call(blocks, function (block) {
            var lines = block.querySelectorAll('.pub-name-line');
            if (!lines.length) return;

            // Clear any previous fit before measuring the container: a stale size on a
            // wide line can itself be what is widening the box on the way back down.
            Array.prototype.forEach.call(lines, function (el) { el.style.fontSize = ''; });
            var target = block.clientWidth;
            if (!target) return;

            Array.prototype.forEach.call(lines, function (el) {
                var lo = MIN, hi = MAX, mid;
                for (var i = 0; i < 24; i++) {
                    mid = (lo + hi) / 2;
                    el.style.fontSize = mid + 'px';
                    range.selectNodeContents(el);
                    if (range.getBoundingClientRect().width > target) hi = mid; else lo = mid;
                }
                el.style.fontSize = lo + 'px';
            });
        });
    }

    (document.fonts ? document.fonts.ready : Promise.resolve()).then(fit);
    window.addEventListener('resize', fit);
})();
