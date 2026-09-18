(function () {
    // Where the contact form posts. This is the /exec URL of the Apps Script web
    // app in apps-script/ — it appends a row to the Sheet and emails a
    // notification. Paste the URL here after deploying; see apps-script/README.md.
    // Until it is set, the form refuses to submit and says so rather than
    // pretending a message was sent.
    const FORM_ENDPOINT = 'https://script.google.com/macros/s/AKfycbw2wB29YbAfUXGh5efd-AZfb2zA7He8O7j0wZE4-TsiptrCLdghdfy1eOu7bvr_AQ4OIg/exec';

    document.addEventListener('DOMContentLoaded', function () {
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
                { drift: 140, range: 0.3, mobileRange: 0.21 },
                { drift: 170, range: 0.5, mobileRange: 0.185 },
                { drift: 200, range: 0.7, mobileRange: 0.245 },
                { drift: 230, range: 0.9, mobileRange: 0.245 },
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

        // ── Contact form ──
        // Posted to the Apps Script web app rather than submitted natively, so the
        // sender stays on the page and gets told what happened. A failure leaves
        // every answer on screen: a form that clears itself on a network error has
        // thrown away a message.
        document.querySelectorAll('form.apply-form-wrap').forEach(function (form) {
            const btn = form.querySelector('button[type="submit"]');
            if (!btn) return;
            const label = btn.textContent;
            let status = null;

            function setStatus(msg, isError) {
                if (!status) {
                    status = document.createElement('p');
                    status.className = 'form-status';
                    // Announced to screen readers when it changes, since the result of
                    // pressing submit is otherwise invisible to them.
                    status.setAttribute('role', 'status');
                    status.setAttribute('aria-live', 'polite');
                    btn.insertAdjacentElement('afterend', status);
                }
                status.textContent = msg;
                status.classList.toggle('err', !!isError);
                status.style.display = msg ? '' : 'none';
            }

            form.addEventListener('submit', function (e) {
                e.preventDefault();
                if (!form.reportValidity()) return;

                if (FORM_ENDPOINT.indexOf('https://') !== 0) {
                    setStatus('This form isn\'t connected yet. Nothing was sent.', true);
                    return;
                }

                const body = new URLSearchParams(new FormData(form));
                body.set('page', location.href);
                // The intake Sheet has a single Name column, so the two name fields
                // are joined here rather than landing in "Other fields" apart.
                if (body.has('firstname') || body.has('lastname')) {
                    body.set('name', [body.get('firstname'), body.get('lastname')]
                        .filter(Boolean).join(' ').trim());
                    body.delete('firstname');
                    body.delete('lastname');
                }

                btn.disabled = true;
                btn.textContent = 'Sending…';
                setStatus('', false);

                // URL-encoded keeps this a CORS "simple" request: Apps Script web apps
                // answer a preflight with a redirect, which browsers reject, so a JSON
                // content type would fail here.
                fetch(FORM_ENDPOINT, { method: 'POST', body: body })
                    .then(function (r) {
                        return r.json().catch(function () { return { ok: r.ok }; });
                    })
                    .then(function (res) {
                        if (!res || !res.ok) throw new Error((res && res.error) || 'rejected');
                        const done = document.createElement('p');
                        done.className = 'form-done';
                        done.setAttribute('role', 'status');
                        done.textContent = 'Message received. We\'ll get back to you.';
                        form.replaceChildren(done);
                    })
                    .catch(function () {
                        btn.disabled = false;
                        btn.textContent = label;
                        setStatus('That didn\'t send, so we haven\'t got it. Check your connection and try again.', true);
                    });
            });
        });
    });
})();
