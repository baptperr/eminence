// Logo dropdown. Hover and keyboard focus are handled in CSS (style.css, .nav-drop);
// this covers what CSS can't: touch, where there is no hover, and Escape.
(function () {
    var menu = document.querySelector('.nav-menu');
    if (!menu) return;
    var logo = menu.querySelector('.nav-logo');
    var noHover = window.matchMedia('(hover: none)');

    // On touch the first tap opens the menu; a second tap on the logo follows its link.
    logo.addEventListener('click', function (e) {
        if (noHover.matches && !menu.classList.contains('open')) {
            e.preventDefault();
            menu.classList.add('open');
        }
    });

    document.addEventListener('pointerdown', function (e) {
        if (!menu.contains(e.target)) menu.classList.remove('open');
    });

    document.addEventListener('keydown', function (e) {
        if (e.key !== 'Escape') return;
        menu.classList.remove('open');
        if (menu.contains(document.activeElement)) document.activeElement.blur();
    });
})();
