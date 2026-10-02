// Logo dropdown. Hover and keyboard focus are handled in CSS (style.css, .nav-drop);
// this covers what CSS can't: touch, where there is no hover, and Escape. The logo
// itself always links home; on touch the chevron beside it opens the menu.
(function () {
    var menu = document.querySelector('.nav-menu');
    if (!menu) return;
    var toggle = menu.querySelector('.nav-toggle');

    function setOpen(open) {
        menu.classList.toggle('open', open);
        if (toggle) toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    }

    if (toggle) toggle.addEventListener('click', function () {
        setOpen(!menu.classList.contains('open'));
    });

    document.addEventListener('pointerdown', function (e) {
        if (!menu.contains(e.target)) setOpen(false);
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        setOpen(false);
        if (menu.contains(document.activeElement)) document.activeElement.blur();
    });
})();
