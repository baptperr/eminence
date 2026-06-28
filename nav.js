(function () {
    document.addEventListener('DOMContentLoaded', function () {
        // ── Drawer ──
        const hamburger = document.getElementById('hamburger');
        const drawer = document.getElementById('drawer');
        const overlay = document.getElementById('drawerOverlay');
        const drawerClose = document.getElementById('drawerClose');

        function openDrawer() {
            drawer.classList.add('open');
            overlay.classList.add('open');
            document.body.style.overflow = 'hidden';
            hamburger.setAttribute('aria-expanded', 'true');
        }
        function closeDrawer() {
            drawer.classList.remove('open');
            overlay.classList.remove('open');
            document.body.style.overflow = '';
            hamburger.setAttribute('aria-expanded', 'false');
        }

        if (hamburger) hamburger.addEventListener('click', openDrawer);
        if (drawerClose) drawerClose.addEventListener('click', closeDrawer);
        if (overlay) overlay.addEventListener('click', closeDrawer);
        document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeDrawer(); });

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
                var chunks = textNode.textContent.split(/(\s+)/);
                var frag = document.createDocumentFragment();
                chunks.forEach(function (chunk) {
                    if (/^\s+$/.test(chunk)) {
                        frag.appendChild(document.createTextNode(chunk));
                    } else if (chunk) {
                        var wrap = document.createElement('span');
                        wrap.className = 'split-wrap';
                        var inner = document.createElement('span');
                        inner.className = 'split-word';
                        inner.style.setProperty('--wi', wordIndex++);
                        inner.textContent = chunk;
                        wrap.appendChild(inner);
                        frag.appendChild(wrap);
                    }
                });
                textNode.parentNode.replaceChild(frag, textNode);
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
