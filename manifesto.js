// The manifesto's big words slide up when their band scrolls into view. The hidden
// starting state is only applied once this script is running (the `mf-js` class), so
// without JS the words are simply there.
(function () {
    if (!('IntersectionObserver' in window)) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    document.documentElement.classList.add('mf-js');
    var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
            if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
        });
    }, { threshold: 0.25 });
    document.querySelectorAll('.mf-band').forEach(function (el) { io.observe(el); });
})();
