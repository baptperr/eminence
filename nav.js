(function () {
    document.addEventListener('DOMContentLoaded', function () {
        // ── Drawer ──
        const navLogo = document.getElementById('navLogo');
        const drawer = document.getElementById('drawer');
        const overlay = document.getElementById('drawerOverlay');
        const drawerClose = document.getElementById('drawerClose');
        const canHover = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

        function openDrawer() {
            drawer.classList.add('open');
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            if (navLogo) navLogo.setAttribute('aria-expanded', 'true');
        }
        function closeDrawer() {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            if (navLogo) navLogo.setAttribute('aria-expanded', 'false');
        }

        if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
        if (overlay) overlay.addEventListener('click', closeDrawer);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

        if (navLogo) {
            if (canHover) {
                // Desktop: hovering the logo pulls the drawer out; moving away closes it.
                var closeTimer = null;
                var cancelClose = function () { clearTimeout(closeTimer); };
                var scheduleClose = function () { cancelClose(); closeTimer = setTimeout(closeDrawer, 200); };
                navLogo.addEventListener('mouseenter', function () { cancelClose(); openDrawer(); });
                navLogo.addEventListener('mouseleave', scheduleClose);
                drawer.addEventListener('mouseenter', cancelClose);
                drawer.addEventListener('mouseleave', scheduleClose);
            } else {
                // Touch: tapping the logo opens the drawer instead of navigating immediately.
                navLogo.addEventListener('click', function (e) {
                    if (!drawer.classList.contains('open')) {
                        e.preventDefault();
                        openDrawer();
                    }
                });
            }
        }

        // Active page in drawer
        const page = window.location.pathname.split('/').pop() || 'index.html';
        document.querySelectorAll('.drawer-link[data-page]').forEach(function (link) {
            if (link.dataset.page === page) link.classList.add('active');
        });

        // ── Hero word-split reveal (load) ──
        document.querySelectorAll('.hero-hl').forEach(function (el) {
            var wordIndex = 0;
            var walker = document.createTreeWalker(el, NodeFilter.SHOW_TEXT, null, false);
            var textNodes = [];
            var n;
            while ((n = walker.nextNode())) { if (n.textContent.trim()) textNodes.push(n); }
            textNodes.forEach(function (textNode) {
                var isAccent = !!textNode.parentElement.closest('.hero-accent');
                var chunks = textNode.textContent.split(/(\s+)/);
                var frag = document.createDocumentFragment();
                chunks.forEach(function (chunk) {
                    if (/^\s+$/.test(chunk)) {
                        frag.appendChild(document.createTextNode(chunk));
                    } else if (chunk) {
                        var wrap = document.createElement('span');
                        wrap.className = isAccent ? 'split-wrap split-wrap-accent' : 'split-wrap';
                        var inner = document.createElement('span');
                        inner.className = isAccent ? 'split-word split-accent' : 'split-word';
                        inner.style.setProperty('--wi', isAccent ? 999 : wordIndex++);
                        inner.textContent = chunk;
                        wrap.appendChild(inner);
                        frag.appendChild(wrap);
                    }
                });
                textNode.parentNode.replaceChild(frag, textNode);
            });
            // Push accent words to after all normal words, with an extra 3-step pause (~225ms gap)
            var total = wordIndex;
            el.querySelectorAll('.split-accent').forEach(function (w, i) {
                w.style.setProperty('--wi', total + 3 + i);
            });
        });
        requestAnimationFrame(function () {
            requestAnimationFrame(function () {
                document.body.classList.add('page-loaded');
            });
        });

        // ── Scroll reveal ──
        document.documentElement.classList.add('js');
        const io = new IntersectionObserver(function (entries) {
            entries.forEach(function (e) {
                if (e.isIntersecting) { e.target.classList.add('on'); io.unobserve(e.target); }
            });
        }, { threshold: 0.08, rootMargin: '0px 0px -32px 0px' });
        document.querySelectorAll('[data-r]').forEach(function (el) { io.observe(el); });

        // ── Beliefs: horizontal drift scrubbed continuously to scroll position ──
        (function () {
            const items = Array.prototype.slice.call(document.querySelectorAll('.belief'));
            if (!items.length) return;
            if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

            // "range" is how much scroll distance (in viewport heights) it takes to resolve — this
            // is what controls actual speed (drift / range), so it's spread out aggressively here
            // while drift stays fairly close across rows. That way row 1 snaps into place almost
            // immediately, while row 4 visibly crawls, still catching up long after row 1 has
            // settled — the rows desync in pace, not just in how far apart they land.
            // mobileRange is set separately (not just a scaled-down version of range) — a mobile
            // viewport is much shorter, so it's tuned directly against each row's own measured
            // height instead of desktop's range values: a row is roughly 0.2-0.26 of the viewport
            // tall on mobile. Resolving right at that ratio uses the entire time the row is scrolling
            // into frame for the drift, so it reads clearly during a normal scroll — going much
            // lower resolves it while the row is still mostly below the fold, invisibly fast.
            const CONFIG = [
                { drift: 200, range: 0.6, mobileRange: 0.21 },
                { drift: 260, range: 1.4, mobileRange: 0.185 },
                { drift: 320, range: 2.8, mobileRange: 0.245 },
                { drift: 380, range: 5.5, mobileRange: 0.245 },
            ];
            let ticking = false;

            function update() {
                const vh = window.innerHeight;
                // Cap travel to a share of viewport width so narrow (mobile) screens don't leave
                // text clipped off-canvas for most of its scroll — the raw drift values are tuned
                // for desktop-width rows and would badly overshoot a ~350px mobile column.
                const maxDrift = window.innerWidth * 0.55;
                // The "range" values below assume a scroll distance that's realistic on a tall
                // desktop viewport. On a short mobile viewport, a short belief row scrolls past
                // entirely before a large range ever resolves, so a row can sit clipped/unreadable
                // for its whole time on screen. Shrink range on narrow screens so every row settles
                // to its resting position well before it scrolls out of view.
                const isMobile = window.innerWidth < 700;
                items.forEach(function (el, i) {
                    const cfg = CONFIG[i % CONFIG.length];
                    const drift = Math.min(cfg.drift, maxDrift);
                    const rect = el.getBoundingClientRect();
                    const effectiveRange = isMobile ? cfg.mobileRange : cfg.range;
                    // 0 as the row's top edge enters the bottom of the viewport, 1 once it's scrolled past the top
                    let progress = (vh - rect.top) / (vh * effectiveRange);
                    progress = Math.max(0, Math.min(1, progress));
                    el.style.transform = 'translateX(' + (-drift * (1 - progress)) + 'px)';
                });
                ticking = false;
            }

            function onScroll() {
                if (!ticking) {
                    requestAnimationFrame(update);
                    ticking = true;
                }
            }

            window.addEventListener('scroll', onScroll, { passive: true });
            window.addEventListener('resize', onScroll);
            update();
        })();

        // ── Social fields ──
        const MAX_SOCIALS = 10;
        const PLATFORMS = ['Instagram', 'TikTok', 'YouTube', 'Twitter / X', 'Facebook', 'Snapchat', 'LinkedIn', 'Threads', 'Other'];

        function makePlatformSelect() {
            const sel = document.createElement('select');
            sel.name = 'platform[]';
            sel.setAttribute('aria-label', 'Platform');
            PLATFORMS.forEach(function (p) {
                const opt = document.createElement('option');
                opt.value = p; opt.textContent = p;
                sel.appendChild(opt);
            });
            return sel;
        }

        function makeHandleInput() {
            const inp = document.createElement('input');
            inp.type = 'text';
            inp.name = 'handle[]';
            inp.placeholder = '@handle or URL';
            inp.setAttribute('aria-label', 'Handle or URL');
            return inp;
        }

        function addSocialEntry(list, darkMode) {
            const entry = document.createElement('div');
            entry.className = 'social-entry' + (darkMode ? ' on-dark' : '');
            const sel = makePlatformSelect();
            if (darkMode) {
                sel.style.setProperty('background-image', "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%23d4925a' stroke-width='1.2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E\")");
                sel.style.setProperty('background-repeat', 'no-repeat');
                sel.style.setProperty('background-position', 'right 0.25rem center');
            }
            const inp = makeHandleInput();
            const rm = document.createElement('button');
            rm.type = 'button'; rm.className = 'remove-social'; rm.textContent = '×';
            rm.setAttribute('aria-label', 'Remove social');
            rm.addEventListener('click', function () {
                entry.remove();
                updateAddBtn(list);
            });
            entry.appendChild(sel);
            entry.appendChild(inp);
            entry.appendChild(rm);
            list.appendChild(entry);
            updateAddBtn(list);
        }

        function updateAddBtn(list) {
            const wrap = list.closest('.socials-wrap');
            if (!wrap) return;
            const btn = wrap.querySelector('.add-social-btn');
            if (!btn) return;
            const count = list.querySelectorAll('.social-entry').length;
            btn.style.display = count >= MAX_SOCIALS ? 'none' : '';
            btn.textContent = 'Add social';
            btn.style.setProperty('--before-content', '"+"');
        }

        document.querySelectorAll('.socials-wrap').forEach(function (wrap) {
            const list = wrap.querySelector('.socials-list');
            const btn = wrap.querySelector('.add-social-btn');
            const darkMode = wrap.dataset.dark === 'true';
            if (!list || !btn) return;
            // Seed one entry
            addSocialEntry(list, darkMode);
            btn.addEventListener('click', function () {
                const count = list.querySelectorAll('.social-entry').length;
                if (count < MAX_SOCIALS) addSocialEntry(list, darkMode);
            });
        });
    });
})();
