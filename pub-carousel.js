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
    });
})();
