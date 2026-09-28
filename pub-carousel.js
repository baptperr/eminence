// Arrow-key scrolling for the fight-week / retention carousels (see .pub-carousel in
// publication.css). The strip itself sits in the tab order (tabindex="0" in templates.mjs),
// which is how a keyboard reaches these cards at all; once it has focus, ArrowLeft/ArrowRight
// step it by one card. Touch and trackpad scroll it natively — this script never touches that
// path, only the one thing neither touch nor a wheel can do.
//
// With no scroll-snap support the @supports gate in publication.css never turns the strip
// sideways, so the cards render as a plain vertical stack instead; the arrow-key handler below
// still attaches (harmlessly — there is nothing to scroll) rather than needing its own
// feature check.
(function () {
    function cardStep(strip) {
        var card = strip.querySelector('.pub-carousel-card');
        if (!card) return strip.clientWidth;
        var style = window.getComputedStyle ? getComputedStyle(strip) : null;
        var gap = style ? (parseFloat(style.columnGap || style.gap || '0') || 0) : 0;
        return card.getBoundingClientRect().width + gap;
    }

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return;
        var strip = e.target && e.target.closest ? e.target.closest('.pub-carousel') : null;
        if (!strip) return;
        e.preventDefault();
        var step = cardStep(strip) * (e.key === 'ArrowRight' ? 1 : -1);
        // Instant, not smooth: publication.css's own `scroll-behavior: smooth` is for the
        // native touch/trackpad/scrollbar path, which this script never touches. Firing a
        // second smooth scroll here, on top of one already settling from a snap-align pass or
        // a held-down key, was found in testing to be silently dropped rather than queued —
        // clearing scroll-behavior around a plain scrollLeft write bypasses that entirely, and
        // an instant jump reads fine for a discrete key press regardless.
        var prev = strip.style.scrollBehavior;
        strip.style.scrollBehavior = 'auto';
        strip.scrollLeft += step;
        strip.style.scrollBehavior = prev;
        syncDots(strip);
    });
    // Dots: which card is showing, kept in sync with any scroll source (touch, trackpad,
    // arrow keys, a dot click), and clickable to jump. Position is read from scrollLeft
    // rather than tracked in a variable, so a native scroll the script never saw still
    // lands on the right dot.
    function dotsFor(strip) {
        return document.querySelector('.pub-carousel-dots[data-dots-for="' + strip.id + '"]');
    }

    function syncDots(strip) {
        var wrap = dotsFor(strip);
        if (!wrap) return;
        var step = cardStep(strip) || 1;
        var i = Math.round(strip.scrollLeft / step);
        var dots = wrap.querySelectorAll('.pub-carousel-dot');
        var max = dots.length - 1;
        if (i < 0) i = 0; else if (i > max) i = max;
        for (var d = 0; d <= max; d++) dots[d].classList.toggle('is-current', d === i);
    }

    function eachStrip(fn) {
        var strips = document.querySelectorAll('.pub-carousel');
        for (var i = 0; i < strips.length; i++) fn(strips[i]);
    }

    eachStrip(function (strip) {
        strip.addEventListener('scroll', function () {
            // Coalesce a scroll burst into one paint: a native flick fires this dozens of
            // times and the dots only need the settled answer.
            if (strip._dotFrame) return;
            strip._dotFrame = requestAnimationFrame(function () {
                strip._dotFrame = null;
                syncDots(strip);
            });
        });
        var wrap = dotsFor(strip);
        if (!wrap) return;
        wrap.addEventListener('click', function (e) {
            var dot = e.target.closest ? e.target.closest('.pub-carousel-dot') : null;
            if (!dot) return;
            var prev = strip.style.scrollBehavior;
            strip.style.scrollBehavior = 'auto';
            strip.scrollLeft = cardStep(strip) * Number(dot.getAttribute('data-index'));
            strip.style.scrollBehavior = prev;
            syncDots(strip);
        });
        syncDots(strip);
    });
})();
