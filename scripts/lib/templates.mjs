// HTML for every generated route. Four templates, on purpose:
//   • archive/article/index  — the standard reading shell (pages.css)
//   • manifesto              — standalone full-bleed page (manifesto.css)
//   • observatory            — standalone single-viewport page over video (observatory.css)
//   • private                — the standard shell, minus everything that could leak the URL
//   • publication kit        — no shell at all: no nav, no logo, no site footer (publication.css)

import { esc, safeUrl, isExternal, fmtDate, renderMarkdown, linkObservatory, OBSERVATORY_URL, slugify } from './util.mjs';

const YEAR = 2026;

const NAV = (current) => `<nav class="nav" id="mainNav" aria-label="Site">
    <div class="nav-menu">
        <a href="/" class="nav-logo"><img src="/logo.svg" alt="FIRST LIGHT" class="nav-logo-img"></a>
        <button type="button" class="nav-toggle" aria-label="Menu" aria-expanded="false" aria-controls="navDrop"></button>
        <div class="nav-drop" id="navDrop">
            <ul>
                <li><a href="/">Home</a></li>
                <li><a href="/publications/"${current === 'publications' ? ' aria-current="page"' : ''}>Publications</a></li>
                <li><a href="/index/"${current === 'index' ? ' aria-current="page"' : ''}>Index</a></li>
                <li><a href="/observatory/"${current === 'observatory' ? ' aria-current="page"' : ''}>Observatory</a></li>
            </ul>
        </div>
    </div>
</nav>`;

const FOOTER = `<footer>
    <a href="/" class="foot-logo"><img src="/logo.svg" alt="FIRST LIGHT" class="foot-logo-img"></a>
    <nav class="foot-links">
        <span class="foot-contact"><span class="foot-cta">Bring us a fighter:</span><a href="mailto:contact@firstlightequity.com" class="foot-link">contact@firstlightequity.com</a></span>
    </nav>
    <p class="foot-copy">© ${YEAR} FIRST LIGHT</p>
</footer>`;

// Every page goes through here. Three concerns that used to travel together as one `priv`
// flag now vary independently, because the publication pages need a combination the site
// never needed before (noindex, but still carrying Open Graph, and no nav at all):
//   • `noindex`  — robots noindex/nofollow/noarchive/nosnippet + no-referrer, and no canonical
//                  link or <meta name="description"> (both would be dead weight on a page
//                  that's never indexed and is only ever reached by direct link).
//   • `og`       — Open Graph tags, so a forwarded link unfurls with a title and description.
//                  `og:url` is skipped when `noindex` is set: these pages have no canonical
//                  address worth asserting.
//   • `nav`      — the site nav (logo + dropdown). Off for the publication pages, which have
//                  no nav, no logo and no links out at all.
// Existing call sites are unaffected: `priv: true` (the old private-page behaviour) is exactly
// `noindex: true, og: false`, and every other site still gets its nav.
// `image` ({ src, width, height, alt }) adds og:image and a large Twitter card; `jsonld` is an
// object (or array) written as one application/ld+json block.
function shell({ title, description, url, site, current, body, css = ['/pages.css'], bodyClass = '', noindex = false, og = true, nav = true, scripts = true, js = null, image = null, jsonld = null }) {
    const head = [];
    if (noindex) {
        head.push('<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">', '<meta name="referrer" content="no-referrer">');
    } else {
        head.push(`<meta name="description" content="${esc(description)}">`, `<link rel="canonical" href="${esc(site + url)}">`);
    }
    if (og) {
        head.push(
            '<meta property="og:site_name" content="FIRST LIGHT">',
            '<meta property="og:type" content="website">',
            `<meta property="og:title" content="${esc(title)}">`,
            `<meta property="og:description" content="${esc(description)}">`,
        );
        if (!noindex) head.push(`<meta property="og:url" content="${esc(site + url)}">`);
        if (image) {
            head.push(
                `<meta property="og:image" content="${esc(site + image.src)}">`,
                `<meta property="og:image:width" content="${image.width}">`,
                `<meta property="og:image:height" content="${image.height}">`,
                `<meta property="og:image:alt" content="${esc(image.alt)}">`,
                '<meta name="twitter:card" content="summary_large_image">',
                `<meta name="twitter:title" content="${esc(title)}">`,
                `<meta name="twitter:description" content="${esc(description)}">`,
                `<meta name="twitter:image" content="${esc(site + image.src)}">`,
                `<meta name="twitter:image:alt" content="${esc(image.alt)}">`,
            );
        }
    }
    // `<` is escaped so no string inside the JSON can close the script element.
    if (jsonld) head.push(`<script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>`);
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    ${head.join('\n    ')}
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="apple-touch-icon" href="/favicon.png">
    <link rel="preload" href="/fonts/dm-sans-var-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/red-hat-display-800-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/style.css">
${css.map((c) => `    <link rel="stylesheet" href="${c}">`).join('\n')}
</head>
<body class="${bodyClass}">

${nav ? `${NAV(current)}\n\n` : ''}${body}
${js
    // An explicit list replaces the site's own scripts rather than adding to them: the
    // publication pages have no nav and no menu to drive, so shipping menu.js there
    // would be a request that does nothing.
    ? js.map((src) => `<script src="${src}" defer></script>`).join('\n')
    : scripts ? `
<script src="/menu.js"></script>
<script src="/nav.js"></script>` : '<script src="/menu.js"></script>'}
</body>
</html>
`;
}

const TYPE_LABEL = { article: 'Article', 'case-study': 'Case study' };

// ── /publications/ ──
export function archivePage({ articles, site }) {
    const rows = articles.map((a) => `
            <li>
                <a class="entry" href="/publications/${a.slug}/" data-r>
                    <time class="entry-date" datetime="${esc(a.date)}">${fmtDate(a.date)}</time>
                    <span class="entry-main">
                        <span class="entry-title">${esc(a.title)}</span>
                        <span class="entry-sum">${esc(a.summary)}</span>
                    </span>
                    <span class="entry-type">${TYPE_LABEL[a.type]}</span>
                </a>
            </li>`).join('');

    const body = `<main>
    <header class="pg-head">
        <div class="pg-inner">
            <h1 class="pg-title" data-r>Publications.</h1>
        </div>
    </header>
    <section class="pg-body">
        <div class="pg-inner">
            <ol class="entries">
                <li>
                    <a class="entry entry--pinned" href="/manifesto/" data-r>
                        <span class="entry-date">Coming soon</span>
                        <span class="entry-main">
                            <span class="entry-title">Manifesto</span>
                        </span>
                        <span class="entry-type">Essay</span>
                    </a>
                </li>${rows}
            </ol>${articles.length ? '' : `
            <p class="pg-empty" data-r>Nothing else published yet.</p>`}
        </div>
    </section>
</main>
${FOOTER}`;
    return shell({
        title: 'Publications — FIRST LIGHT',
        description: 'Articles and case studies from FIRST LIGHT on building a fighter\'s name and turning it into income.',
        url: '/publications/', site, current: 'publications', body,
    });
}

// ── /publications/[slug]/ ──
export function articlePage({ article, site }) {
    const body = `<main>
    <article class="art">
        <header class="art-head">
            <div class="pg-inner pg-inner--read">
                <p class="art-meta" data-r><a href="/publications/">Publications</a><span aria-hidden="true"> / </span>${TYPE_LABEL[article.type]}<span aria-hidden="true"> · </span><time datetime="${esc(article.date)}">${fmtDate(article.date)}</time></p>
                <h1 class="art-title" data-r style="--d:60ms">${esc(article.title)}</h1>
                <p class="art-dek" data-r style="--d:120ms">${esc(article.summary)}</p>
            </div>
        </header>
        <div class="pg-inner pg-inner--read">
            <div class="prose">
${linkObservatory(renderMarkdown(article.body, { figureCredit: true }))}
            </div>
            <p class="art-credit">Data Credit: <a href="${OBSERVATORY_URL}">First Light Observatory</a>.</p>
            <div class="art-end">
                <a href="/index/">Where fighters stand now: the Index</a>
                <a href="/publications/">All publications</a>
            </div>
        </div>
    </article>
</main>
${FOOTER}`;
    return shell({
        title: `${article.title} — FIRST LIGHT`,
        description: article.summary,
        url: `/publications/${article.slug}/`, site, current: 'publications', body,
    });
}

// ── /manifesto/ ── standalone, full-bleed, inverted. (/publications/manifesto/ redirects here.)
export function manifestoPage({ site }) {
    const body = `<main class="mf">
    <section class="mf-band mf-band--paper" aria-labelledby="mf-title">
        <h1 class="mf-word" id="mf-title"><span class="mf-clip"><span class="mf-slide">Manifesto</span></span></h1>
        <p class="mf-note">The First Light manifesto is being written.</p>
    </section>
    <section class="mf-band mf-band--ink">
        <p class="mf-word mf-word--soon"><span class="mf-clip"><span class="mf-slide mf-slide--late">Coming soon.</span></span></p>
        <p class="mf-back"><a href="/publications/">&larr; Publications</a></p>
    </section>
</main>
<script src="/manifesto.js"></script>`;
    return shell({
        title: 'Manifesto — FIRST LIGHT',
        description: 'The FIRST LIGHT manifesto. Coming soon.',
        url: '/manifesto/', site, current: 'publications', body,
        css: ['/manifesto.css'], bodyClass: 'page-manifesto', scripts: false,
    });
}

// ── /observatory/ ── one viewport, text over a darkened loop of the Observatory itself.
// The video has no src in the HTML: observatory.js attaches it only when motion is allowed,
// picking the portrait cut on portrait screens, so reduced-motion and no-JS visitors get the
// still (a CSS background, portrait or landscape) and nothing else. The status line
// starts hidden; observatory.js fills and reveals it (see there: it is cosmetic).
const OBSERVATORY_TEXT_LINES = [
    'The Observatory follows every professional fighter across promotions worldwide, from their first bout to their latest post. It measures what a name is worth inside and outside the cage, and what moves it. Its readings decide which names First Light backs.',
];
const OBSERVATORY_TEXT = OBSERVATORY_TEXT_LINES.join(' ');
const OBSERVATORY_DESC = 'The First Light Observatory measures fighter fame against skill. Sources: Google, Wikipedia, Instagram, TikTok, YouTube, X. Earnings in and out of the cage.';
// Collapsed by default (founder, 9 Oct 2026: keep the page light; no SEO bloat). Breadth as the
// founder specified it. Scale figures: 20 entries in config/promotions.yaml (19 named
// promotions plus 'Other'), and ~350,000 total fighters in Observatory (docs/firstlight/decisions.md),
// of which ~20,000 are active, relevant professionals. Using conservative round numbers: 40+ organisations, 20,000+ active fighters.
const OBSERVATORY_METHOD = [
    'The Observatory reads Google Search, Wikipedia page views, Instagram, TikTok, YouTube and X. It captures followers, views, engagement, search, countries, markets and languages. Fight performance is measured by the First Light Rating (FLR). It does not just look at panel rankings: it is built from in-cage performance and results, and tracks a fighter\u2019s level beyond the simple win/loss record. It is more accurate than the industry incumbents. The Observatory also records earnings: money earned inside the cage and out.',
    'Coverage spans 40+ organisations and 20,000+ active fighters, with readings taken continuously around every event. The First Light Index (FLI) compares a fighter\u2019s fame against what the FLR predicts, on a scale from \u22121 to +1. It shows which fighters are better than their audience knows, and which ones know how to be a star.',
    'On the sport, no filter: fighters, bouts and promotions from everywhere, not only the UFC. On the audience, a deliberate Western lens, mostly English-speaking and American, because that is where the advertising market is largest. Hence the platforms we read.',
];

// Holdings disclosure: a small, quiet line under the Index link on the Observatory and
// under the FLI definition on the rankings.
const HOLDINGS_TEXT = 'First Light may hold interests in athletes covered by the Index.';

export function observatoryPage({ site }) {
    const url = '/observatory/';
    const org = {
        '@type': 'Organization', '@id': `${site}/#organization`,
        name: 'First Light', url: `${site}/`, logo: `${site}/logo.png`, email: 'contact@firstlightequity.com',
    };
    const body = `<main class="ob">
    <div class="ob-bg" aria-hidden="true">
        <video class="ob-video" data-src="/observatory.mp4" data-src-portrait="/observatory-mobile.mp4" muted autoplay loop playsinline disablepictureinpicture preload="none"></video>
    </div>
    <div class="ob-hero" id="obHero">
    <h1 class="ob-title" id="ob-title">The First Light Observatory</h1>
    <p class="ob-sub">The deepest record of commercial value in professional fighting.</p>
    <p class="ob-text">${esc(OBSERVATORY_TEXT_LINES[0])}</p>
    <div class="ob-panel" id="obMethod" role="region" aria-label="How the data works" tabindex="-1"><div class="ob-panel-clip"><div class="ob-panel-in">${OBSERVATORY_METHOD.map(t => `<p>${esc(t)}</p>`).join('')}</div></div></div>
    <div class="ob-method"><button type="button" class="ob-method-toggle" aria-expanded="false" aria-controls="obMethod">How the data works</button></div>
    <div class="ob-link"><a href="/index/">First Light Index <span aria-hidden="true">&rarr;</span></a><small class="ob-disclose">${HOLDINGS_TEXT}</small></div>
    </div>
    <p class="ob-status" id="obStatus" hidden><span class="ob-dot" aria-hidden="true"></span>Last reading: <time id="obStatusTime"></time></p>
    <p class="ob-credit"><span>Journalists may publish Observatory data.</span><span>Credit: First Light Observatory.</span><span><a href="mailto:contact@firstlightequity.com">contact@firstlightequity.com</a></span></p>
</main>`;
    return shell({
        title: 'First Light Observatory',
        description: OBSERVATORY_DESC,
        url, site, current: 'observatory', body,
        css: ['/observatory.css'], bodyClass: 'page-observatory', js: ['/menu.js', '/observatory.js'],
        image: { src: '/observatory-og.jpg', width: 1200, height: 630, alt: 'The First Light Observatory' },
        jsonld: {
            '@context': 'https://schema.org',
            '@graph': [org, {
                '@type': 'Dataset', '@id': `${site}${url}#dataset`,
                name: 'First Light Observatory', description: OBSERVATORY_TEXT,
                url: `${site}${url}`, creator: { '@id': org['@id'] },
            }],
        },
    });
}

// ── /index/ (rankings) and /index/winners-losers/ ──
const num = (n, digits = 0) => new Intl.NumberFormat('en-GB', { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(n);
const signed = (n, digits = 1) => `${n > 0 ? '+' : n < 0 ? '−' : ''}${num(Math.abs(n), digits)}`;

const TOP_OPEN = 3;

// prev_rank: a number is last period's rank, null means not ranked then (new), and absent
// means there is nothing to compare with, in which case the whole column is left out.
function movement(r) {
    if (r.prev_rank == null) return { glyph: '', text: 'New', label: 'New entry', dir: 'new' };
    const d = r.prev_rank - r.rank;
    if (d === 0) return { glyph: '', text: '', label: 'No change', dir: 'same' };
    return d > 0
        ? { glyph: '↑', text: String(d), label: `Up ${d} ${d === 1 ? 'place' : 'places'}`, dir: 'up' }
        : { glyph: '↓', text: String(-d), label: `Down ${-d} ${-d === 1 ? 'place' : 'places'}`, dir: 'down' };
}

// A small line chart of one fighter's FLI over the window, as inline SVG so it needs no
// script. The vertical scale fits the series (never tighter than 0.1 of FLI) so a quiet
// month doesn't look like a crash; a dashed line marks zero when it's in range.
function sparkline(history) {
    const W = 176, H = 52, PAD = 6;
    const t = history.map((p) => new Date(p.date).getTime());
    const v = history.map((p) => p.fli);
    const t0 = t[0], t1 = t[t.length - 1];
    let lo = Math.min(...v), hi = Math.max(...v);
    if (hi - lo < 0.1) { const mid = (hi + lo) / 2; lo = mid - 0.05; hi = mid + 0.05; }
    const x = (i) => PAD + ((t[i] - t0) / (t1 - t0 || 1)) * (W - 2 * PAD);
    const y = (val) => H - PAD - ((val - lo) / (hi - lo)) * (H - 2 * PAD);
    const pts = v.map((val, i) => `${x(i).toFixed(1)},${y(val).toFixed(1)}`);
    const zero = lo < 0 && hi > 0 ? `<line class="sp-zero" x1="${PAD}" x2="${W - PAD}" y1="${y(0).toFixed(1)}" y2="${y(0).toFixed(1)}"/>` : '';
    const last = pts[pts.length - 1].split(',');
    return `<svg class="sp" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" aria-hidden="true" focusable="false">${zero}<polyline class="sp-line" points="${pts.join(' ')}"/><circle class="sp-end" cx="${last[0]}" cy="${last[1]}" r="2.5"/></svg>`;
}

// FLI colour: sign picks green or red, size of the value picks how far from white, linearly, so a
// mild reading looks mild. FLI is bounded to ±1; about ±0.25 is one standard deviation of the
// index and ±0.6 is a strong reading, so the scale reaches full colour there. Readings within
// ±0.04 of zero stay white.
function tone(value, full) {
    if (Math.abs(value) < 0.04) return { cls: 'fli-zero', m: '0' };
    const m = Math.min(1, Math.abs(value) / full);
    return { cls: value > 0 ? 'fli-pos' : 'fli-neg', m: m.toFixed(2) };
}

// A column-header abbreviation with a two-line tooltip: the full name, then what it measures.
const hint = (label, name, desc, right = false) =>
    `<span class="hint${right ? ' hint--right' : ''}">${label}<span class="hint-tip"><strong>${esc(name)}</strong><span class="hint-desc">${esc(desc)}</span></span></span>`;
const HINT_FLR = (right) => hint('FLR', 'First Light Rating', 'measure of true skill', right);
const HINT_FLI = (right) => hint('FLI', 'First Light Index', 'fame compared to skill', right);

// Mobile shrinks a division name beside the fighter's own to a 2-4 letter code (own row is too
// narrow for "Light Heavyweight"). Standard MMA-media shorthand; the full name is still the text
// a screen reader gets, since only the visual rendering swaps (see .rk-weight in pages.css).
const WEIGHT_ABBR = {
    'Heavyweight': 'HW', 'Light Heavyweight': 'LHW', 'Middleweight': 'MW', 'Welterweight': 'WW',
    'Lightweight': 'LW', 'Featherweight': 'FW', 'Bantamweight': 'BW', 'Flyweight': 'FLW',
    "Women's Featherweight": 'WFW', "Women's Bantamweight": 'WBW', "Women's Flyweight": 'WFLW',
    "Women's Strawweight": 'WSW', "Women's Atomweight": 'WAW',
};

// FLI value, its 30-day ticker, and (when there is a history) the sparkline on hover/focus.
function fliCell(r) {
    if (r.fli_status === 'pending') return `<span class="rk-flag hint">Pending<span class="hint-tip">Withheld until this fighter’s audience has been fully checked.</span></span>`;
    if (r.fli == null) return '—';
    const tr = r.fli_trend;
    const hist = r.fli_history && r.fli_history.length >= 3 ? r.fli_history : null;
    let tick = '';
    if (tr) {
        const glyph = tr.dir === 'up' ? '▲' : tr.dir === 'down' ? '▼' : '';
        // The delta ("+0.13") sits in its own span so a narrow row can drop it and keep only the
        // glyph — the direction still reads, the magnitude is a tap/hover away via the sparkline.
        const text = tr.dir === 'flat' ? '—' : `${glyph}<span class="rk-tick-delta"> ${signed(tr.delta, 2)}</span>`;
        const said = tr.dir === 'flat' ? 'unchanged' : `${tr.dir === 'up' ? 'up' : 'down'} ${num(Math.abs(tr.delta), 2)}`;
        const label = `FLI ${said} over ${tr.days} days`;
        tick = hist
            ? `<span class="rk-tickwrap rk-tickwrap--${tr.dir}"><button type="button" class="rk-tick rk-tick--${tr.dir}" aria-label="${esc(label)}. Show trend.">${text}</button><span class="rk-spark" role="tooltip">${sparkline(hist)}<span class="rk-spark-cap">${esc(`Last ${tr.days} days: ${signed(hist[0].fli, 2)} → ${signed(hist[hist.length - 1].fli, 2)}`)}</span></span></span>`
            : `<span class="rk-tick rk-tick--${tr.dir}" title="${esc(label)}" aria-label="${esc(label)}">${text}</span>`;
    }
    return `<span class="rk-fli-top"><span class="rk-fli-n">${signed(r.fli, 2)}</span>${tick}</span><span class="rk-bar" aria-hidden="true"><span class="${r.fli < 0 ? 'neg' : 'pos'}" style="width:${(Math.min(Math.abs(r.fli), 1) * 50).toFixed(1)}%"></span></span>`;
}

function fliAttrs(r) {
    if (r.fli == null) return 'class="rk-fli"';
    const t = tone(r.fli, 0.6);
    return `class="rk-fli ${t.cls}" style="--m:${t.m}"`;
}

function rankRows(rows, { hasMove, hasFlr, hasFli }) {
    return rows.map((r) => {
        const mv = movement(r);
        const weight = r.weight
            ? ` <span class="rk-weight" data-abbr="${esc(WEIGHT_ABBR[r.weight] || r.weight)}">${esc(r.weight)}</span>` : '';
        const move = hasMove && mv.text
            ? ` <span class="rk-move rk-move--${mv.dir}" aria-label="${esc(mv.label)}">${mv.glyph ? `<span class="rk-glyph" aria-hidden="true">${mv.glyph}</span>` : ''}${esc(mv.text)}</span>` : '';
        return `
                    <tr>
                        <th scope="row" class="rk-rank"><span class="rk-n">${r.rank}</span></th>
                        <td class="rk-name"><span class="rk-name-row"><span class="rk-name-text">${esc(r.name)}</span>${weight}${move}</span></td>${hasFlr ? `
                        <td class="rk-num" data-label="FLR">${r.rating != null ? num(r.rating) : '—'}</td>` : ''}${hasFli ? `
                        <td ${fliAttrs(r)} data-label="FLI">${fliCell(r)}</td>` : ''}
                    </tr>`;
    }).join('');
}

// One division: the top three always showing, the rest behind a CSS-only toggle whose control
// sits at the very bottom, so it is where you are looking whether the list is open or shut.
// Both tables share fixed column widths so they read as one.
function rankingTable(division, rows) {
    const cols = {
        hasMove: rows.some((r) => r.prev_rank !== undefined),
        hasFlr: rows.some((r) => r.rating != null),
        hasFli: rows.some((r) => r.fli != null || r.fli_status === 'pending'),
    };
    const head = (hidden) => `
                <thead${hidden ? ' class="sr-only"' : ''}>
                    <tr>
                        <th scope="col" class="rk-rank">Rank</th>
                        <th scope="col" class="rk-name">Fighter</th>${cols.hasFlr ? `
                        <th scope="col" class="rk-num">${hidden ? 'FLR' : HINT_FLR(true)}</th>` : ''}${cols.hasFli ? `
                        <th scope="col" class="rk-fli">${hidden ? 'FLI' : HINT_FLI(true)}</th>` : ''}
                    </tr>
                </thead>`;
    // Explicit column widths (not the header row) set the layout, so the hidden header of the
    // second table can't change it and both tables line up.
    const colgroup = `<colgroup><col class="c-rank"><col>${cols.hasFlr ? '<col class="c-num">' : ''}${cols.hasFli ? '<col class="c-fli">' : ''}</colgroup>`;
    const table = (part, hiddenHead, caption) => `<table class="rk">
                <caption class="sr-only">${esc(caption)}</caption>${colgroup}${head(hiddenHead)}
                <tbody>${rankRows(part, cols)}
                </tbody>
            </table>`;
    const top = rows.slice(0, TOP_OPEN), rest = rows.slice(TOP_OPEN);
    const name = division || 'Overall';
    const slug = slugify(name);
    const last = rows[rows.length - 1].rank;
    return `
        <div class="rk-div"${division ? ` id="${esc(slug)}"` : ''} data-r>${division ? `
            <h3 class="rk-div-name">${esc(division)}</h3>` : ''}${rest.length ? `
            <input type="checkbox" class="rk-toggle" id="${esc(slug)}-more" aria-label="Show ranks ${TOP_OPEN + 1} to ${last}">` : ''}
            ${table(top, false, `${name}, top ${top.length}`)}${rest.length ? `
            <div class="rk-rest">
                ${table(rest, true, `${name}, ranks ${TOP_OPEN + 1} to ${last}`)}
            </div>
            <label class="rk-more" for="${esc(slug)}-more"><span class="rk-more-open">Expand</span><span class="rk-more-close">Collapse</span></label>` : ''}
        </div>`;
}

// The two sections of the Index, as a header: the current one is the page title (white, underlined),
// the other is a link to it.
function subtabs(current, hasWinners) {
    const tab = (id, label, href) => current === id
        ? `<h1 class="subtab is-on" aria-current="page">${label}</h1>`
        : `<a class="subtab" href="${href}">${label}</a>`;
    return `<div class="subtabs" data-r>${tab('rankings', 'Rankings', '/index/')}${hasWinners ? tab('winners', 'Last weekend’s winners', '/index/winners-losers/') : ''}</div>`;
}

const KEY = `
    <section class="key" id="key" aria-label="How to read the rankings">
        <div class="pg-inner pg-inner--wide">
            <div class="key-item" data-r>
                <h2 class="key-name">FLR</h2>
                <p class="key-text"><strong>First Light Rating.</strong> The industry's most accurate algorithmic skill score, built from a fighter's in-cage performance and fight results. The First Light Rankings are based on it. It is deliberately conservative: the less we know about a fighter, the lower they are rated until the results are in.</p>
            </div>
            <div class="key-item" data-r>
                <h2 class="key-name">FLI</h2>
                <div class="key-body">
                    <p class="key-text"><strong>First Light Index.</strong> It compares a fighter's fame with what their FLR rating would predict, on a scale from −1 to +1. Above zero, their audience is bigger than their skill explains: they know how to be a star. Below zero, they are better than their audience knows. The arrow shows how the FLI has moved over about the last 30 days; hover it to see the trend.</p>
                    <small class="key-disclose">${HOLDINGS_TEXT}</small>
                </div>
            </div>
        </div>
    </section>`;

function archiveTeaser(articles) {
    const latest = articles.slice(0, 3);
    if (!latest.length) return '';
    return `
    <section class="pg-body pg-body--rule" aria-labelledby="latest-h">
        <div class="pg-inner">
            <h2 class="pg-h2 pg-h2--small" id="latest-h" data-r>From the archive.</h2>
            <ol class="entries">${latest.map((a) => `
                <li>
                    <a class="entry" href="/publications/${a.slug}/" data-r>
                        <time class="entry-date" datetime="${esc(a.date)}">${fmtDate(a.date)}</time>
                        <span class="entry-main"><span class="entry-title">${esc(a.title)}</span><span class="entry-sum">${esc(a.summary)}</span></span>
                        <span class="entry-type">${TYPE_LABEL[a.type]}</span>
                    </a>
                </li>`).join('')}
            </ol>
        </div>
    </section>
`;
}

export function indexPage({ data, articles, site }) {
    const meta = {
        title: 'Rankings — FIRST LIGHT',
        description: 'FIRST LIGHT rankings: FLR ratings and First Light Index scores for the top fighters in every division.',
        url: '/index/', site, current: 'index',
    };

    if (!data) {
        return shell({
            ...meta,
            body: `<main>
    <header class="pg-head">
        <div class="pg-inner">
            <h1 class="pg-title" data-r>Rankings.</h1>
            <p class="pg-lede" data-r style="--d:80ms">The first rankings are being compiled.</p>
        </div>
    </header>
</main>
${FOOTER}`,
        });
    }

    // Divisions keep the order the export gives them; fighters within one are by rank.
    const divisions = new Map();
    for (const r of data.rankings) {
        const key = r.division ?? '';
        if (!divisions.has(key)) divisions.set(key, []);
        divisions.get(key).push(r);
    }
    for (const rows of divisions.values()) rows.sort((a, b) => a.rank - b.rank);

    const body = `<main>
    <header class="pg-head pg-head--rankings">
        <div class="pg-inner pg-inner--wide">
            ${subtabs('rankings', !!data.winners_losers)}
            <p class="pg-asof" data-r style="--d:80ms">${data.period ? `${esc(data.period)} · ` : ''}Updated <time datetime="${esc(data.generated_at)}">${fmtDate(data.generated_at)}</time></p>
            ${divisions.size > 1 ? `<details class="jump-wrap">
                <summary class="jump-summary">Jump to a division</summary>
                <ul class="jump" aria-label="Jump to a division">${[...divisions.keys()].map((d) => `<li><a href="#${esc(slugify(d))}">${esc(d)}</a></li>`).join('')}</ul>
            </details>
` : ''}        </div>
    </header>

    <section class="pg-body pg-body--flush" aria-label="Rankings by division">
        <div class="pg-inner pg-inner--wide">${data.rankings.length
            ? [...divisions].map(([div, rows]) => rankingTable(div, rows)).join('')
            : '\n            <p class="pg-empty">No rankings this period.</p>'}
        </div>
    </section>
${KEY}${data.methodology ? `
    <section class="pg-body pg-body--rule">
        <div class="pg-inner pg-inner--wide"><p class="pg-fine" data-r>${esc(data.methodology)}</p></div>
    </section>
` : ''}${archiveTeaser(articles)}</main>
${FOOTER}`;
    return shell({ ...meta, body });
}

// Each side's rule, in a line under its heading: the figures only make sense against it.
const WL_RULE = {
    winners: 'Lost the fight, and still grew their audience far more than fighters of a similar size.',
    losers: 'Won the fight, and grew their audience far less than fighters of a similar size.',
};

function wlList(kind, heading, items) {
    const rows = items.map((e) => {
        const won = e.outcome === 'win';
        const versus = e.opponent ? ` ${won ? 'against' : 'to'} ${esc(e.opponent)}` : '';
        const where = [e.event ? esc(e.event) : '', e.date ? fmtDate(e.date) : ''].filter(Boolean).join(' · ');
        return `
                    <li class="wl-row">
                        <span class="wl-who"><span class="wl-name">${esc(e.name)}</span>
                            <span class="wl-line"><span class="wl-res wl-res--${won ? 'won' : 'lost'}">${won ? 'Won' : 'Lost'}</span>${versus}${e.method ? ` · ${esc(e.method)}` : ''}</span>${where ? `
                            <span class="wl-line wl-line--dim">${where}</span>` : ''}</span>
                        <span class="wl-fig"><span class="wl-change wl-change--${kind}"><span class="wl-glyph" aria-hidden="true">${e.change < 0 ? '▼' : '▲'}</span> ${signed(e.change)}%</span>${e.typical != null ? `
                            <span class="wl-typical">typical ${signed(e.typical)}%</span>` : ''}</span>
                    </li>`;
    }).join('');
    return `
        <section class="wl-col wl-col--${kind}" aria-labelledby="wl-${kind}">
            <h2 class="pg-h2" id="wl-${kind}" data-r>${heading}</h2>
            <p class="wl-rule" data-r>${WL_RULE[kind]}</p>
            <ol class="wl-list" data-r>${rows || '\n                    <li class="wl-row wl-row--none">None this period.</li>'}
            </ol>
        </section>`;
}

export function winnersLosersPage({ data, site }) {
    const wl = data.winners_losers;
    const body = `<main>
    <header class="pg-head pg-head--rankings">
        <div class="pg-inner pg-inner--wide">
            ${subtabs('winners', true)}
            <p class="pg-asof" data-r style="--d:80ms">${wl.period ? `${esc(wl.period)} · ` : ''}Updated <time datetime="${esc(data.generated_at)}">${fmtDate(data.generated_at)}</time></p>
        </div>
    </header>
    <div class="pg-body pg-body--flush">${wl.winners.length || wl.losers.length ? `
        <div class="pg-inner pg-inner--wide wl">${wlList('winners', 'Winners', wl.winners)}${wlList('losers', 'Losers', wl.losers)}
        </div>` : `
        <div class="pg-inner pg-inner--wide"><p class="pg-empty" data-r>No clear winners or losers yet.</p></div>`}
    </div>
</main>
${FOOTER}`;
    return shell({
        title: 'Last weekend’s winners — FIRST LIGHT',
        description: 'Fighters whose fame went against the result: lost the fight and gained fame, won it and gained none.',
        url: '/index/winners-losers/', site, current: 'index', body,
    });
}

// ── /publications/private/[token]/ ──
function rows(pairs) {
    const items = pairs.filter(([, v]) => v != null && String(v).trim() !== '');
    if (!items.length) return '';
    return `<dl class="pv-rows">${items.map(([k, v]) => `
                <div class="pv-row"><dt>${esc(k)}</dt><dd>${v.html ?? esc(v)}</dd></div>`).join('')}
            </dl>`;
}

const mail = (e) => (e ? { html: `<a href="mailto:${esc(e)}">${esc(e)}</a>` } : null);
const tel = (p) => (p ? { html: `<a href="tel:${esc(String(p).replace(/[^+\d]/g, ''))}">${esc(p)}</a>` } : null);

export function privatePage({ page, site }) {
    const f = page.fighter;
    const m = page.manager;
    const media = (page.media ?? []).map((item) => {
        const url = safeUrl(item.url);
        if (!url) return '';
        const ext = isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `
                <li><a class="pv-file" href="${esc(url)}"${ext}><span class="pv-file-label">${esc(item.label)}</span>${item.note ? `<span class="pv-file-note">${esc(item.note)}</span>` : ''}</a></li>`;
    }).join('');

    const body = `<main>
    <header class="pg-head pg-head--private">
        <div class="pg-inner">
            <p class="pv-flag" data-r>Private · not for distribution${page.updated ? ` · Updated ${fmtDate(page.updated)}` : ''}</p>
            <h1 class="pg-title pg-title--name" data-r style="--d:60ms">${esc(f?.name ?? m?.name ?? page.title ?? 'Media kit')}</h1>${f?.nickname ? `
            <p class="pg-lede" data-r style="--d:120ms">“${esc(f.nickname)}”</p>` : ''}
        </div>
    </header>
${f ? `
    <section class="pg-body" aria-labelledby="pv-fighter">
        <div class="pg-inner">
            <h2 class="pg-h2 pg-h2--small" id="pv-fighter" data-r>Fighter.</h2>
            ${f.bio ? `<div class="prose" data-r>${renderMarkdown(f.bio)}</div>` : ''}
            <div data-r>${rows([
                ['Record', f.record], ['Division', f.division], ['Organisation', f.organization],
                ['Gym', f.gym], ['Based in', f.location],
                ...(f.stats ?? []).map((s) => [s.label, s.value]),
            ])}</div>
        </div>
    </section>
` : ''}${m ? `
    <section class="pg-body pg-body--rule" aria-labelledby="pv-manager">
        <div class="pg-inner">
            <h2 class="pg-h2 pg-h2--small" id="pv-manager" data-r>Management.</h2>
            <div data-r>${rows([['Manager', m.name], ['Company', m.company], ['Email', mail(m.email)], ['Phone', tel(m.phone)], ['Notes', m.notes]])}</div>
        </div>
    </section>
` : ''}${media ? `
    <section class="pg-body pg-body--rule" aria-labelledby="pv-media">
        <div class="pg-inner">
            <h2 class="pg-h2 pg-h2--small" id="pv-media" data-r>Media kit.</h2>
            <ul class="pv-files" data-r>${media}
            </ul>
        </div>
    </section>
` : ''}${page.notes ? `
    <section class="pg-body pg-body--rule">
        <div class="pg-inner">
            <div class="prose" data-r>${renderMarkdown(page.notes)}</div>
        </div>
    </section>
` : ''}</main>
${FOOTER}`;
    return shell({
        title: `${page.title || 'Media kit'} — FIRST LIGHT`,
        url: '', site, current: null, body, noindex: true, og: false,
    });
}

// ── 404 ── Cloudflare Pages serves the homepage for any unknown URL unless a 404.html exists, so a
// wrong or guessed address (a private-page URL included) would look like a real page.
export function notFoundPage({ site }) {
    const body = `<main>
    <header class="pg-head">
        <div class="pg-inner">
            <h1 class="pg-title">Not found.</h1>
            <p class="pg-lede"><a href="/">FIRST LIGHT</a></p>
        </div>
    </header>
</main>
${FOOTER}`;
    return shell({ title: 'Not found — FIRST LIGHT', url: '', site, current: null, body, noindex: true, og: false });
}

// ── /publications/kit/[slug-token]/{media-kit,internal-data}/ ──
//
// Contract: observatory-publications/docs/publications-contract.md. These are the only two
// templates in the file with no NAV, no logo and no site FOOTER — one footer line, a plain
// mailto, nothing else — and the only two that never link anywhere, including to each other.
// mediaKitPage() reads only media_kit.data; internalDataPage() reads only internal_data.data.
// Neither imports the other's field names, so a template mistake can't leak one page's shape
// into the other's.

const PUB_FOOTER = `<footer class="pub-foot">
    <div class="pub-inner"><p class="pub-foot-line">Data measured by the First Light Observatory · <a href="mailto:contact@firstlightequity.com">contact@firstlightequity.com</a></p></div>
</footer>`;

// ── the one chart component ──
//
// Both pages are almost entirely numbers, and the owner's one complaint that mattered was
// "line shape only — no axes, no ticks, no units, no legend, monochrome". Rather than fixing
// that six times, everything that plots a <series> (the {width,height,points,extra_points,
// labels} geometry the Observatory computes and both repos already share) goes through panel()
// below. It moves to the Observatory's own ground for this one purpose — dark blue-green
// surface, monospace figures, hairline grid — while the rest of the page keeps the site's own
// type. `points` is always the fighter's own series; `extra_points`, when present, is the peer
// or reference series (the contract's own convention, unchanged).
//
// Real ticks need a real domain, and the geometry the payload sends is pre-scaled pixels with
// no domain attached (no y-min/max, no x start/end date) — the contract doesn't carry one yet.
// Rather than invent a scale, panel() only ever labels a tick with a number the payload already
// gave it somewhere else on the same page (a baseline, a peak, a row's own actual/expected, a
// fight's own date) and places that label at the pixel the curve itself already puts it at.
// Nothing here is a guess; see the build report for the domain fields that would remove the
// remaining gaps (a continuous date axis on a curve with no per-row anchor to zip against).
function parsePts(s) {
    return String(s).trim().split(/\s+/).filter(Boolean).map((p) => p.split(',').map(Number));
}
function nearestY(pointsStr, x) {
    const pts = parsePts(pointsStr);
    if (!pts.length) return 0;
    let best = pts[0];
    for (const p of pts) if (Math.abs(p[0] - x) < Math.abs(best[0] - x)) best = p;
    return best[1];
}
// Labels the curve's own highest and lowest point with a real number already sitting elsewhere
// in the payload (a peak, a baseline) — never a value read off the pixel geometry itself.
function extremeRefs(series, { hi, lo } = {}) {
    if (!series || (hi == null && lo == null)) return [];
    const pts = parsePts(series.points);
    if (!pts.length) return [];
    const out = [];
    if (hi != null) out.push({ y: pts.reduce((a, b) => (b[1] < a[1] ? b : a))[1], text: hi });
    if (lo != null) out.push({ y: pts.reduce((a, b) => (b[1] > a[1] ? b : a))[1], text: lo });
    return out;
}
// Cross-references a marker's free text ("vs. Yusuf Demir") against bouts already named
// elsewhere in the same payload, so the marker can carry the fight's real date without the
// payload having to send the same date twice.
function withBoutDate(text, bouts) {
    const hit = (bouts ?? []).find((b) => b?.opponent && b?.date && text.includes(b.opponent));
    return hit ? `${fmtDate(hit.date)} · ${text}` : text;
}
const TONE_LINE = { good: 'good', bad: 'bad', accent: 'accent', neutral: 'neutral' };
function panel(series, opts = {}) {
    if (!series) return '';
    // The second line is NOT a peer series. Depending on the chart it is this same
    // fighter's own 28-day level, his own pre-fight baseline, or the expected-slot
    // model — so there is no honest default name for it, and the wrong one
    // ("Similar fighters") is a false claim on a page a sponsor reads and checks.
    // The payload names both lines; where it has not, the legend is omitted rather
    // than guessed, and the caption still says what the chart shows.
    const {
        unit, mainLabel = series.label, refLabel = series.extra_label,
        yRefs = [], bouts = [], caption, tone: seriesTone = 'accent',
    } = opts;
    const W = series.width, H = series.height, padTop = 16, padBottom = 34;
    const grid = [0.25, 0.5, 0.75].map((f) => `<line class="pub-grid-line" x1="0" x2="${W}" y1="${(H * f).toFixed(1)}" y2="${(H * f).toFixed(1)}"/>`).join('');
    const refLines = yRefs.map((r) => `<g class="pub-ref"><line class="pub-ref-line" x1="0" x2="${W}" y1="${r.y.toFixed(1)}" y2="${r.y.toFixed(1)}"/><text class="pub-ref-label" x="${W}" y="${(r.y - 4).toFixed(1)}" text-anchor="end">${esc(r.text)}</text></g>`).join('');
    const extra = series.extra_points ? `<polyline class="pub-series pub-series--ref" points="${esc(series.extra_points)}"/>` : '';
    const main = `<polyline class="pub-series pub-series--main pub-tone-line-${TONE_LINE[seriesTone] ?? 'accent'}" points="${esc(series.points)}"/>`;
    // Two marks closer together than this collide if both labels sit on the same line, so
    // adjacent marks alternate a line lower — a leader (the dashed line itself) still ties each
    // label back to its own point, cheaper than computing real label widths.
    const labels = series.labels ?? [];
    const withBout = labels.map((l) => withBoutDate(l.text, bouts));
    // These labels are free text of unknown width, so rather than measure it, every other one
    // simply sits a line lower — two neighbours can never collide, however wide their text.
    const marks = labels.map((l, i) => {
        const y = nearestY(series.points, l.x);
        const ly = H + 15 + (labels.length > 1 && i % 2 === 1 ? 11 : 0);
        // A label centred on a mark right at the chart's edge would spill past the panel;
        // the two end marks anchor inward instead, everything else stays centred on its line.
        const anchor = l.x < W * 0.08 ? 'start' : l.x > W * 0.92 ? 'end' : 'middle';
        return `<g class="pub-mark"><line class="pub-mark-line" x1="${l.x}" x2="${l.x}" y1="0" y2="${H}"/><circle class="pub-mark-dot" cx="${l.x}" cy="${y.toFixed(1)}" r="3.5"/><text class="pub-mark-label" x="${l.x}" y="${ly}" text-anchor="${anchor}">${esc(withBout[i])}</text></g>`;
    }).join('');
    const legend = series.extra_points && mainLabel && refLabel
        ? `<div class="pub-legend"><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--main"></i>${esc(mainLabel)}</span><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--ref"></i>${esc(refLabel)}</span></div>`
        : '';
    return `<figure class="pub-panel">
        <svg class="pub-panel-svg" viewBox="0 -${padTop} ${W} ${H + padTop + padBottom}" role="img" aria-label="${esc(caption || unit || 'chart')}">
            <g class="pub-grid">${grid}</g>
            ${refLines}
            ${extra}
            ${main}
            <g class="pub-marks">${marks}</g>
        </svg>
        ${legend}${unit ? `<p class="pub-panel-unit">${esc(unit)}</p>` : ''}
    </figure>`;
}

// ── internal-data charts: series that carry their own domain (contract v3) ──
//
// v1/v2's <series> was pre-scaled pixel geometry with no domain attached — no axis could ever
// be drawn from it, which is why a five-point weekly curve read as a slope and a score ended up
// printed among the x-axis date labels. v3's <series> carries real x/y values plus their own
// domain (min/max/ticks), so the page scales the data itself and draws a real, labelled axis.
// isAxisSeries() tells the two shapes apart; panel() above keeps rendering the old one (still
// what the media kit, and any publication generated before the payload rewrite, carries).
function isAxisSeries(series) {
    return !!series && typeof series === 'object' && !!series.x && !!series.y && Array.isArray(series.points);
}

// A tick's label is written by the payload ("56k", "1 Aug") — the one place a number here is
// ever formatted is the fallback below, for a domain the payload hasn't ticked itself yet.
function autoTicks(lo, hi, n = 4) {
    if (!(hi > lo)) return [{ value: lo, label: num(lo) }];
    return Array.from({ length: n + 1 }, (_, i) => {
        const v = lo + ((hi - lo) * i) / n;
        return { value: v, label: num(v, Number.isInteger(v) ? 0 : 1) };
    });
}

// Two adjacent x-axis tick labels ("15 Aug", "fight day") collide once their pixel gap runs
// narrower than roughly the wider label's own width — rather than measure real text width,
// every other tight pair simply drops a line, the same alternating trick this file already
// uses for point/opponent labels (see panel()'s `marks`). CHAR_W is a deliberately generous
// per-glyph estimate for the 9-10px axis-label type, so it errs toward wrapping a label that
// would have just barely fit rather than letting two overlap.
const TICK_CHAR_W = 5.4;
function tickCollides(a, b, gap) {
    return gap < Math.max(String(a).length, String(b).length) * TICK_CHAR_W;
}
function tickDy(labels, positions, i) {
    if (i === 0) return 0;
    return tickCollides(labels[i], labels[i - 1], Math.abs(positions[i] - positions[i - 1])) && i % 2 === 1 ? 11 : 0;
}

// The shared plot frame every axis chart draws inside: a fixed-width left column for y-tick
// text (so panels line up with each other whatever their numbers look like), gridlines at
// every y-tick, and the two axis rules. Time always runs left-to-right, oldest-to-newest —
// points are sorted by x before anything is drawn, never trusted to already arrive in order.
// On a date axis every x is an ISO string, so arithmetic on it silently yields NaN: every
// point, tick and marker collapsed onto the left edge and the line vanished entirely, which
// is exactly how the Attention chart shipped. Coordinates are read through xv() from here
// on, which turns a date into epoch milliseconds and leaves a number alone.
const xv = (v) => (typeof v === 'string' ? Date.parse(v) : v);

// Ticks at 1, 2 and 5 per decade: on a log axis evenly spaced ticks would not be evenly
// spaced on the page, and a reader needs the decades named to read one off at all.
function logTicks(min, max) {
    const out = [];
    for (let e = Math.floor(Math.log10(min)); e <= Math.ceil(Math.log10(max)); e++) {
        for (const m of [1, 2, 5]) {
            const v = m * 10 ** e;
            if (v >= min && v <= max) out.push({ value: v, label: num(v) });
        }
    }
    return out.length > 1 ? out : [{ value: min, label: num(min) }, { value: max, label: num(max) }];
}

function buildAxisFrame(series, { W = 600, H = 220, logY = false } = {}) {
    const pts = [...(series.points ?? [])].sort((a, b) => xv(a.x) - xv(b.x));
    const xs = pts.map((p) => xv(p.x)), ys = pts.map((p) => p.y);
    const xDesc = series.x ?? {}, yDesc = series.y ?? {};
    const xMin = xv(xDesc.min) ?? Math.min(...xs), xMax = xv(xDesc.max) ?? Math.max(...xs);
    // A log axis cannot start at zero, and must not be handed the payload's linear ticks.
    const posYs = ys.filter((v) => v > 0);
    const yMin = logY ? Math.max(1, Math.min(...posYs) * 0.8) : (yDesc.min ?? Math.min(0, ...ys));
    const yMax = logY ? Math.max(...posYs) * 1.15 : (yDesc.max ?? Math.max(...ys));
    const xTicks = xDesc.ticks?.length ? xDesc.ticks : autoTicks(xMin, xMax, Math.min(4, xs.length - 1 || 1));
    const yTicks = logY ? logTicks(yMin, yMax)
        : yDesc.ticks?.length ? yDesc.ticks : autoTicks(yMin, yMax, 4);

    const padTop = 16, padBottom = 30, padRight = 10, axisW = 40;
    const plotX0 = axisW, plotX1 = W - padRight, plotY0 = padTop, plotY1 = H - padBottom;
    const xScale = (raw) => { const v = xv(raw); return plotX0 + (xMax > xMin ? (v - xMin) / (xMax - xMin) : 0.5) * (plotX1 - plotX0); };
    const lg = (v) => Math.log10(Math.max(v, 1e-6));
    const yFrac = logY
        ? (v) => (lg(yMax) > lg(yMin) ? (lg(Math.max(v, yMin)) - lg(yMin)) / (lg(yMax) - lg(yMin)) : 0.5)
        : (v) => (yMax > yMin ? (v - yMin) / (yMax - yMin) : 0.5);
    const yScale = (v) => plotY1 - yFrac(v) * (plotY1 - plotY0);
    const toPoly = (arr) => [...arr].sort((a, b) => xv(a.x) - xv(b.x)).map((p) => `${xScale(p.x).toFixed(1)},${yScale(p.y).toFixed(1)}`).join(' ');

    const gridY = yTicks.map((t) => `<line class="pub-grid-line" x1="${plotX0}" x2="${plotX1}" y1="${yScale(t.value).toFixed(1)}" y2="${yScale(t.value).toFixed(1)}"/>`).join('');
    const yLabels = yTicks.map((t) => `<text class="pub-axis-label" x="${(plotX0 - 7).toFixed(1)}" y="${(yScale(t.value) + 3).toFixed(1)}" text-anchor="end">${esc(t.label)}</text>`).join('');
    const xPositions = xTicks.map((t) => xScale(t.value));
    const xLabels = xTicks.map((t, i) => `<text class="pub-axis-label" x="${xPositions[i].toFixed(1)}" y="${(plotY1 + 18 + tickDy(xTicks.map((tt) => tt.label), xPositions, i)).toFixed(1)}" text-anchor="middle">${esc(t.label)}</text>`).join('');
    const axisLines = `<line class="pub-axis-line" x1="${plotX0}" x2="${plotX1}" y1="${plotY1.toFixed(1)}" y2="${plotY1.toFixed(1)}"/><line class="pub-axis-line" x1="${plotX0}" x2="${plotX0}" y1="${plotY0}" y2="${plotY1.toFixed(1)}"/>`;

    return { pts, W, H, plotX0, plotX1, plotY0, plotY1, xScale, yScale, toPoly, gridY, yLabels, xLabels, axisLines };
}

// The line/spike chart for the new series shape: retention curves, the compounding level,
// card-position over time. Every point is drawn — no curve smoothing — so a dense daily
// series (~40 points) reads as spikes rather than a slope, and a single isolated spike stays
// visible with a dot at each point once there are few enough of them to tell apart.
function axisChart(series, opts = {}) {
    if (!series || !series.points?.length) return '';
    const { tone: seriesTone = 'accent', size } = opts;
    const f = buildAxisFrame(series, size);
    // A ref line near the very bottom of the range (a baseline dwarfed by a fight-week peak,
    // say) would otherwise print its label right on top of the x-axis tick row below it — the
    // label never sits lower than a few px clear of the axis, whatever height the line itself
    // is drawn at.
    const refLines = (series.ref_lines ?? []).map((r) => {
        const y = f.yScale(r.y);
        const ly = Math.min(y - 4, f.plotY1 - 8);
        return `<g class="pub-ref"><line class="pub-ref-line" x1="${f.plotX0}" x2="${f.plotX1}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/><text class="pub-ref-label" x="${f.plotX1}" y="${ly.toFixed(1)}" text-anchor="end">${esc(r.label)}</text></g>`;
    }).join('');
    // A second series in DIFFERENT units cannot share the first one's axis: search interest
    // runs 0 to 100 and Wikipedia views ran to 69,000, so the overlay was drawn flat along
    // the bottom of the panel and read as missing data. It gets its own scale, and its own
    // labelled axis on the right, so both lines are legible and neither implies the other's
    // magnitude.
    const ex = series.extra;
    const exYs = ex?.points?.length ? ex.points.map((p) => p.y) : [];
    const exMax = exYs.length ? Math.max(...exYs) : null;
    const exScaled = exMax != null && exMax > 0 && exMax < (series.y?.max ?? 0) / 4;
    const exScale = (v) => f.plotY1 - (v / exMax) * (f.plotY1 - f.plotY0);
    const extra = ex?.points?.length
        ? `<polyline class="pub-series pub-series--ref" points="${exScaled
            ? [...ex.points].sort((a, b) => xv(a.x) - xv(b.x)).map((p) => `${f.xScale(p.x).toFixed(1)},${exScale(p.y).toFixed(1)}`).join(' ')
            : f.toPoly(ex.points)}"/>` : '';
    const exAxis = exScaled ? `
            <g class="pub-axis-labels pub-axis-labels--right">
                <text class="pub-axis-label" x="${(f.plotX1 + 4).toFixed(1)}" y="${(f.plotY0 + 4).toFixed(1)}" text-anchor="start">${esc(num(Math.round(exMax)))}</text>
                <text class="pub-axis-label" x="${(f.plotX1 + 4).toFixed(1)}" y="${f.plotY1.toFixed(1)}" text-anchor="start">0</text>
            </g>` : '';
    const main = `<polyline class="pub-series pub-series--main pub-tone-line-${TONE_LINE[seriesTone] ?? 'accent'}" points="${f.toPoly(f.pts)}"/>`;
    const dots = f.pts.length <= 60
        ? f.pts.map((p) => `<circle class="pub-point-dot" cx="${f.xScale(p.x).toFixed(1)}" cy="${f.yScale(p.y).toFixed(1)}" r="1.6"/>`).join('') : '';
    const markerLines = (series.markers ?? []).map((m) => `<line class="pub-mark-line" x1="${f.xScale(m.x).toFixed(1)}" x2="${f.xScale(m.x).toFixed(1)}" y1="${f.plotY0}" y2="${f.plotY1.toFixed(1)}"/>`).join('');
    // Two fights a week apart put their labels on top of each other ("vs. Paul Hughes" over
    // "vs. Alfie Davis", unreadable). Sorted by position, a colliding label steps up a line
    // instead, the same alternating trick the x-axis ticks use.
    const sortedMarkers = [...(series.markers ?? [])].sort((a, b) => f.xScale(a.x) - f.xScale(b.x));
    const markerXs = sortedMarkers.map((m) => f.xScale(m.x));
    const markerLabels = sortedMarkers.map((m, i) => {
        const x = markerXs[i];
        const anchor = x < f.plotX0 + 30 ? 'start' : x > f.plotX1 - 30 ? 'end' : 'middle';
        const dy = tickDy(sortedMarkers.map((mm) => mm.label), markerXs, i);
        return `<text class="pub-mark-label pub-mark-label--top" x="${x.toFixed(1)}" y="${(f.plotY0 - 5 - dy).toFixed(1)}" text-anchor="${anchor}">${esc(m.label)}</text>`;
    }).join('');
    const legend = series.extra?.label
        ? `<div class="pub-legend"><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--main"></i>${esc(series.y?.label ?? 'This fighter')}</span><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--ref"></i>${esc(series.extra.label)}</span></div>`
        : '';
    // The unit is only appended when the label has not already said it: "Wikipedia views
    // per day" + "/day" printed as "Wikipedia views per day, /day". The y-axis ticks carry
    // the unit anyway, so this line is a name, not a second statement of scale.
    const yLabel = series.y?.label ?? '';
    const yUnit = series.y?.unit ?? '';
    const unitSaid = yUnit && (yLabel.toLowerCase().includes(yUnit.replace(/^\//, '').toLowerCase())
        || /per (day|month|post)\b/i.test(yLabel));
    // The legend already names the main series, so repeating its label underneath is the
    // same words twice, and on a two-series chart it reads as if it described both.
    const namedInLegend = Boolean(series.extra?.label);
    const unitLine = namedInLegend ? '' : [yLabel, unitSaid ? '' : yUnit].filter(Boolean).join(', ');
    return `<figure class="pub-panel">
        <svg class="pub-panel-svg" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="${esc(unitLine || 'chart')}">
            <g class="pub-grid">${f.gridY}</g>
            ${f.axisLines}
            ${refLines}
            ${extra}
            ${main}
            ${dots}
            <g class="pub-marks">${markerLines}${markerLabels}</g>
            <g class="pub-axis-labels">${f.yLabels}${f.xLabels}</g>
            ${exAxis}
        </svg>
        ${legend}${unitLine ? `<p class="pub-panel-unit">${esc(unitLine)}</p>` : ''}
    </figure>`;
}

// Renders whichever <series> generation the payload actually sent — the new axis shape once
// it lands for a given field, the old pixel panel() until then. Never invents a domain the old
// shape doesn't carry: a series with no axis stays exactly what it was rather than guessing.
function chart(series, opts = {}) {
    if (!series) return '';
    return isAxisSeries(series) ? axisChart(series, opts) : panel(series, opts);
}

// A histogram for cohort.differentiators[].distribution, on the same Observatory ground: peer
// bars quiet, this fighter's own position the one bright mark, exactly the funnel's convention.
// `marker` arrives already placed on the same 0..width pixel line the bars are drawn on (the
// assembler's own geometry, not a raw value to re-derive) — a bin's x0/x1 stay in the metric's
// real units and give the two axis labels, since the assembler doesn't yet send tick text of
// its own for this chart (see the build report).
// Local numeric helpers: templates.mjs does not import the loader's validators, and the
// chart code needs both a type check and a defaulting read for an optional domain bound.
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const num0 = (v, fallback) => (isNum(v) ? v : fallback);

// The cohort distribution: where every comparable fighter landed on one measure, with this
// fighter's own mark on it. v3 sends `bins` as {x0, x1, count} and `marker` on the metric's
// OWN value scale, with an `x` axis descriptor (label/unit/min/max/ticks) — so the bars sit
// at their real positions and the axis carries real numbers, rather than the bin index
// standing in for a value. The older pixel shape (width/height, marker pre-scaled) still
// renders, unchanged, for publications generated before the rewrite.
function distributionChart(dist, opts = {}) {
    if (!dist) return '';
    const axis = dist.x;
    // padBottom leaves room for a tick label that drops to a second line (see tickDy) — a
    // dense bin axis would otherwise print its lower row past the figure's own bottom edge.
    const W = 300, H = 92, axisW = 30, padTop = 8, padBottom = 26;
    const width = axis ? W : dist.width, height = axis ? H : dist.height;
    if (!isNum(width) || !isNum(height)) return '';
    const plotW = width - axisW, plotH = height - padTop - padBottom;

    const bins = dist.bins ?? [];
    const counts = bins.map((b) => (typeof b === 'number' ? b : (b?.count ?? b?.height ?? 0)));
    const maxCount = Math.max(...counts, 1);
    const unit = axis?.unit ? ` ${axis.unit}` : '';

    // Value → x. With an axis the domain is the metric's own range; without one, bins are
    // evenly spaced because that is all the older shape ever said.
    const lo = axis ? num0(axis.min, bins[0]?.x0 ?? 0) : 0;
    const hi = axis ? num0(axis.max, bins[bins.length - 1]?.x1 ?? 1) : 1;
    const span = hi - lo || 1;
    const vx = (v) => axisW + ((v - lo) / span) * plotW;

    const bars = counts.map((c, i) => {
        const bh = (c / maxCount) * plotH;
        const b = bins[i];
        const x0 = axis && isNum(b?.x0) ? vx(b.x0) : axisW + (i / counts.length) * plotW;
        const x1 = axis && isNum(b?.x1) ? vx(b.x1) : axisW + ((i + 1) / counts.length) * plotW;
        const w = Math.max(1, x1 - x0 - 1);
        return `<rect class="pub-dist-bar" x="${x0.toFixed(1)}" y="${(padTop + plotH - bh).toFixed(1)}" width="${w.toFixed(1)}" height="${bh.toFixed(1)}"><title>${esc(String(c))} fighter${c === 1 ? '' : 's'}</title></rect>`;
    }).join('');

    let markerMark = '';
    if (dist.marker != null) {
        // With an axis the marker is a VALUE; in the old shape it was already a pixel
        // position across the full width.
        const mx = axis ? vx(dist.marker) : axisW + (dist.marker / (dist.width || 1)) * plotW;
        markerMark = `<line class="pub-dist-marker" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="${padTop}" y2="${(padTop + plotH).toFixed(1)}"/><circle class="pub-dist-marker-dot" cx="${mx.toFixed(1)}" cy="${padTop}" r="3.5"/>`;
    }

    const fmt = (v) => (Math.abs(v) > 0 && Math.abs(v) < 1 ? v.toFixed(2) : num(Math.round(v)));
    const tickList = axis?.ticks?.length ? axis.ticks : [{ value: lo, label: fmt(lo) + unit }, { value: hi, label: fmt(hi) + unit }];
    const tickX = tickList.map((t) => vx(t.value));
    const ticks = tickList
        .map((t, i, all) => {
            const x = tickX[i];
            const anchor = i === 0 ? 'start' : i === all.length - 1 ? 'end' : 'middle';
            const dy = tickDy(tickList.map((tt) => tt.label), tickX, i);
            return `<line class="pub-axis-tick" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${(padTop + plotH).toFixed(1)}" y2="${(padTop + plotH + 3).toFixed(1)}"/>`
                + `<text class="pub-axis-label" x="${x.toFixed(1)}" y="${(height - 6 + dy).toFixed(1)}" text-anchor="${anchor}">${esc(t.label)}</text>`;
        }).join('');

    const axisLines = `<line class="pub-axis-line" x1="${axisW}" x2="${width}" y1="${(padTop + plotH).toFixed(1)}" y2="${(padTop + plotH).toFixed(1)}"/>`
        + `<line class="pub-axis-line" x1="${axisW}" x2="${axisW}" y1="${padTop}" y2="${(padTop + plotH).toFixed(1)}"/>`;
    // The y axis counts fighters, so its top tick is the fullest bin -- a bare "Fighters"
    // with no number told the reader nothing about how many that bar represents.
    const yAxis = `<text class="pub-axis-label" x="${(axisW - 4).toFixed(1)}" y="${(padTop + 7).toFixed(1)}" text-anchor="end">${esc(String(maxCount))}</text>`
        + `<text class="pub-axis-label" x="${(axisW - 4).toFixed(1)}" y="${(padTop + plotH).toFixed(1)}" text-anchor="end">0</text>`;

    const caption = axis?.label ? `${axis.label}${unit ? ` (${axis.unit})` : ''}` : opts.xLabel;
    return `<figure class="pub-panel pub-panel--dist">
        <svg class="pub-panel-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="How many comparable fighters landed at each ${esc(axis?.label || opts.xLabel || 'value')}, with this fighter's own value marked">
            ${axisLines}${bars}${markerMark}${ticks}${yAxis}
        </svg>
        <div class="pub-legend"><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--main"></i>This fighter</span><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--ref"></i>Fighters at this level</span><span class="pub-legend-item pub-legend-item--tube">Height = how many fighters</span></div>
        ${caption ? `<p class="pub-panel-unit">${esc(caption)}</p>` : ''}
    </figure>`;
}

// Markets: one chart, two readings. The owner's complaint was that search-volume and
// market-value used to draw as two disconnected bar charts; this draws one pair of bars per
// country instead (search above, market below), sharing a label column and a 0-100 scale, so
// it reads as the same countries measured twice rather than two unrelated lists. Colour reuses
// the chart palette's own main/reference convention (accent = the fighter's own read, ink =
// the reference figure) rather than a third hue.
// A country name has to fit the chart's label column, which is a fixed width because the bars
// beside it must line up. The long official forms are the only ones that overflow, and each has
// a short form everyone already uses; anything else long enough to spill is cut with an ellipsis
// and keeps its full name in a <title>, so nothing is silently lost.
const COUNTRY_SHORT = {
    'United States': 'USA', 'United Arab Emirates': 'UAE', 'United Kingdom': 'UK',
    'Bosnia and Herzegovina': 'Bosnia', 'Democratic Republic of the Congo': 'DR Congo',
    'Republic of Ireland': 'Ireland', 'Czech Republic': 'Czechia',
    'Dominican Republic': 'Dominican Rep.', 'Trinidad and Tobago': 'Trinidad',
    'South Korea': 'S. Korea', 'North Macedonia': 'N. Macedonia',
    'New Zealand': 'New Zealand', 'Saudi Arabia': 'Saudi Arabia',
};
const LABEL_MAX_CHARS = 15;
function shortCountry(name) {
    const short = COUNTRY_SHORT[name] ?? name;
    return short.length > LABEL_MAX_CHARS ? `${short.slice(0, LABEL_MAX_CHARS - 1)}…` : short;
}

// `marketTerm`/`marketExplainer`: the payload names the phrase inside the caption that
// carries the method ("relative market value" -> "ad spend per internet user"), so the page
// can underline that phrase alone and keep the recipe on hover instead of in the caption.
function marketsPairedChart(countries, { searchCaption, marketCaption, marketTerm, marketExplainer } = {}) {
    if (!countries?.length) return '';
    const W = 300, barH = 9, barGap = 3, pairH = barH * 2 + barGap, rowGap = 11, labelW = 92;
    const H = countries.length * (pairH + rowGap) - rowGap;
    const barsW = W - labelW - 30;
    const maxV = Math.max(...countries.flatMap((c) => [c.search_volume_index, c.market_value_index]).filter(isNum), 1);
    const bar = (cls, y, v) => {
        if (!isNum(v)) return '';
        const w = Math.max(2, (v / maxV) * barsW);
        return `<rect class="pub-bar ${cls}" x="${labelW}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${barH}" rx="2"/><text class="pub-bar-value" x="${(labelW + w + 6).toFixed(1)}" y="${(y + barH - 1.5).toFixed(1)}">${Math.round(v)}</text>`;
    };
    const rows = countries.map((c, i) => {
        const y0 = i * (pairH + rowGap);
        const short = shortCountry(c.country);
        const label = `<text class="pub-bar-label" x="0" y="${(y0 + pairH / 2 + 3).toFixed(1)}">${esc(short)}${short === c.country ? '' : `<title>${esc(c.country)}</title>`}</text>`;
        return label
            + bar('pub-bar--search', y0, c.search_volume_index)
            + bar('pub-bar--market', y0 + barH + barGap, c.market_value_index);
    }).join('');
    return `<figure class="pub-panel pub-panel--bars">
        <svg class="pub-panel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Search interest and market value index by country, both relative to the top country at 100">${rows}</svg>
        <div class="pub-legend">
            <span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--main"></i>${esc(searchCaption)}</span>
            <span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--market"></i>${withTerm(marketCaption, marketTerm, marketExplainer)}</span>
        </div>
        <p class="pub-panel-unit">Index, relative to the top country at 100 (0 to 100)</p>
    </figure>`;
}

// LEGACY: the pre-ladder funnel (graphic.segments), kept so a publication generated before the
// ladder rework still renders. The current shape is ladderBlock() below.
// The attention funnel, drawn as a funnel: one continuous silhouette, band width at each stage
// = the retention index the assembler already computed (typical similar fighter = 100, the
// dashed tube), the same idiom the Observatory's own panel uses. Colour is tone() again — wider
// than typical reads green, narrower reads red, both shaded by how far from 100 they sit.
function legacyFunnelGraphic(fn) {
    const g = fn?.graphic;
    if (!g || !Array.isArray(g.segments) || !g.segments.length) return '';
    const bandH = 46, padTop = 6, padBottom = 6;
    const H = g.segments.length * bandH + padTop + padBottom;
    const W = g.width || 420;
    const typical = g.typical_width || 100;
    const maxW = Math.max(typical, ...g.segments.map((s) => s.width), 1);
    const usable = W / 2 - 16;
    const half = (w) => Math.max(2, (w / maxW) * usable);
    const cx = W / 2;
    const bands = g.segments.map((s, i) => {
        const y0 = padTop + i * bandH, y1 = y0 + bandH;
        const hTop = half(s.width);
        const hBot = half(i + 1 < g.segments.length ? g.segments[i + 1].width : s.width);
        const t = tone((s.width - typical) / typical, 1);
        const cls = t.cls === 'fli-pos' ? 'good' : t.cls === 'fli-neg' ? 'bad' : 'zero';
        const d = `M${(cx - hTop).toFixed(1)} ${y0} L${(cx + hTop).toFixed(1)} ${y0} L${(cx + hBot).toFixed(1)} ${y1} L${(cx - hBot).toFixed(1)} ${y1} Z`;
        return `<path class="pub-funnel-band pub-funnel-band--${cls}" style="--m:${t.m}" d="${d}"/>`;
    }).join('');
    const dividers = g.segments.slice(0, -1).map((s, i) => {
        const y = padTop + (i + 1) * bandH;
        const h = half(g.segments[i + 1].width);
        return `<line class="pub-funnel-div" x1="${(cx - h).toFixed(1)}" x2="${(cx + h).toFixed(1)}" y1="${y}" y2="${y}"/>`;
    }).join('');
    const tubeHalf = half(typical);
    const tube = `<line class="pub-funnel-tube" x1="${(cx - tubeHalf).toFixed(1)}" x2="${(cx - tubeHalf).toFixed(1)}" y1="0" y2="${H}"/><line class="pub-funnel-tube" x1="${(cx + tubeHalf).toFixed(1)}" x2="${(cx + tubeHalf).toFixed(1)}" y1="0" y2="${H}"/>`;
    const idx = g.segments.map((s, i) => {
        const y = padTop + i * bandH + bandH / 2 + 4;
        return `<text class="pub-funnel-idx" x="${W - 8}" y="${y.toFixed(1)}" text-anchor="end">${Math.round(s.width)}</text>`;
    }).join('');
    return `<figure class="pub-panel pub-panel--funnel">
        <svg class="pub-panel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="Attention funnel: how much of this fighter's audience is left at each stage, relative to a typical fighter at the same level">
            <g class="pub-grid">${tube}</g>
            ${bands}${dividers}${idx}
        </svg>
        <div class="pub-legend"><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--main"></i>This fighter</span><span class="pub-legend-item pub-legend-item--tube">Dashed = a typical similar fighter (100)</span></div>
    </figure>`;
}


// ── the field: where this fighter sits among every rated fighter ──
//
// The Observatory's own skill-vs-fame scatter, as a compact square that only shows where the
// fighter sits: the dots, the fit line and its band, and this fighter ringed and named with
// dotted guides down to both axes. No ticks, legend or caption (just the two axis names): the section's
// prose says what the axes are and where the fighter sits, so a picture that explained itself
// again would only be a second, competing text. The payload owns the geometry (one shared
// viewBox, in the Bridge's pixels); this crops that viewBox to the plot, padded for the two axis names.
// Peers are drawn as one path of zero-length round-capped segments, so ~900 dots are one
// element rather than ~900.
function fieldChart(f) {
    if (!f || !f.you || !Array.isArray(f.peers) || !f.plot || !f.width || !f.height) return '';
    const p = f.plot, you = f.you;
    // The frame keeps the payload's own proportions (wider than tall) so dots and type are
    // never stretched, with a strip left of it for the rotated vertical name and one under it
    // for the horizontal name.
    const pad = 10, padL = 26, padB = 30;
    const vx = p.left - padL, vy = p.top - pad;
    const vw = p.right - p.left + padL + pad, vh = p.bottom - p.top + pad + padB;
    const xName = f.x?.label ? `<text class="pub-axis-label" x="${((p.left + p.right) / 2).toFixed(1)}" y="${(p.bottom + 22).toFixed(1)}" text-anchor="middle">${esc(f.x.label)}</text>` : '';
    const yCx = p.left - 14, yCy = (p.top + p.bottom) / 2;
    const yName = f.y?.label ? `<text class="pub-axis-label" x="${yCx}" y="${yCy.toFixed(1)}" text-anchor="middle" transform="rotate(-90 ${yCx} ${yCy.toFixed(1)})">${esc(f.y.label)}</text>` : '';
    const axes = `<line class="pub-axis-line" x1="${p.left}" x2="${p.right}" y1="${p.bottom}" y2="${p.bottom}"/><line class="pub-axis-line" x1="${p.left}" x2="${p.left}" y1="${p.top}" y2="${p.bottom}"/>`;
    const band = f.fit?.band ? `<path class="pub-field-band" d="${esc(f.fit.band)}"/>` : '';
    // The fit CURVES against a linear level axis (it is a straight line only in log-log
    // space): flat across the low ratings, steepening at the top. Drawing the payload's two
    // endpoints as one segment cut a chord through the middle of the field and misread the
    // whole shape. Prefer the sampled path; the endpoints remain the fallback for a payload
    // generated before it was carried.
    const fl = f.fit?.line;
    const fit = f.fit?.path
        ? `<path class="pub-field-fit" d="${esc(f.fit.path)}" fill="none"/>`
        : fl ? `<line class="pub-field-fit" x1="${fl.x1}" y1="${fl.y1}" x2="${fl.x2}" y2="${fl.y2}"/>` : '';
    const peers = f.peers.length ? `<path class="pub-field-peers" d="${f.peers.map(([x, y]) => `M${x} ${y}h0`).join('')}"/>` : '';
    const guides = `<line class="pub-field-guide" x1="${you.x}" x2="${you.x}" y1="${you.y}" y2="${p.bottom}"/><line class="pub-field-guide" x1="${p.left}" x2="${you.x}" y1="${you.y}" y2="${you.y}"/>`;
    // The name sits inward of the point, so it never runs off the square: to the left of a
    // fighter in the right half, to the right of one in the left half, never above the frame.
    const right = you.x > p.left + (p.right - p.left) * 0.5;
    const ly = Math.max(p.top + 22, you.y - 16);
    const label = `<text class="pub-field-name" x="${right ? you.x - 20 : you.x + 20}" y="${ly}" text-anchor="${right ? 'end' : 'start'}">${esc(you.name ?? '')}</text>`;
    const summary = `${you.name ?? 'This fighter'} against every rated fighter: level across, audience up on a log scale.`;
    return `<figure class="pub-panel pub-field-mini">
        <svg class="pub-panel-svg" viewBox="${vx.toFixed(0)} ${vy.toFixed(0)} ${vw.toFixed(0)} ${vh.toFixed(0)}" role="img" aria-label="${esc(summary)}">
            ${axes}${xName}${yName}${band}${peers}${fit}${guides}
            <circle class="pub-field-ring" cx="${you.x}" cy="${you.y}" r="12"/><circle class="pub-field-dot" cx="${you.x}" cy="${you.y}" r="5"/>
            ${label}
        </svg>
    </figure>`;
}

// ── the attention ladder ──
//
// Rungs: Exposure (unmeasured), Curiosity, Retained interest, Commitment, Activity, then
// Monetization (unmeasured). One continuous silhouette, drawn from the Bridge's own geometry
// (graphic.d, .tube, .gaps, .clips, .leak, .tail): each rung's row carries its own slice of that
// shape, cut at the rung's y0..y1, so the rows stack back into the same ladder the Observatory
// draws. Every figure and every sentence is the payload's; this only lays them out. Each rung is
// a different audience, so nothing here says or implies people moving down a funnel.
//
// "Not comparable yet" and "not measured yet" are words, never a zero or an absence: an
// unmeasured rung says so and shows why, and a rung with no fight to compare against says that.
function ladderSlice(g, y0, y1, uid, { tail = false, label = null } = {}) {
    const f1 = (n) => Number(n).toFixed(1);
    const h = Math.max(1, y1 - y0);
    const clipId = `pub-lad-clip-${uid}`;
    const tube = g.tube ? `<path class="pub-lad-tube" d="M${f1(g.tube.x1)} ${y0}V${y1}M${f1(g.tube.x2)} ${y0}V${y1}"/>` : '';
    let inner = '';
    if (tail && g.tail) {
        inner = `<path class="pub-lad-tail" d="M${f1(g.tail.x1)} ${y0}V${y1}M${f1(g.tail.x2)} ${y0}V${y1}"/>`;
    } else if (g.d) {
        const gaps = g.gaps ?? [];
        inner = `<defs><clipPath id="${clipId}"><path d="${esc(g.d)}"/></clipPath></defs>
            <path class="pub-lad-sil" d="${esc(g.d)}"/>
            ${gaps.map((gp) => `<rect class="pub-lad-gapfill" x="0" y="${gp.y0}" width="${g.w}" height="${gp.y1 - gp.y0}" clip-path="url(#${clipId})"/>`).join('')}
            <path class="pub-lad-div" d="${(g.dividers ?? []).map((d) => `M${f1(d.x1)} ${d.y}H${f1(d.x2)}`).join('')}"/>
            ${gaps.map((gp) => `<path class="pub-lad-gap-erase" d="${esc(gp.d)}"/><path class="pub-lad-gap" d="${esc(gp.d)}"/>`).join('')}
            ${(g.clips ?? []).map((c) => `<path class="pub-lad-clip" d="M${c.xl - 4} ${c.y - 6}l-5 6l5 6M${c.xr + 4} ${c.y - 6}l5 6l-5 6"/>`).join('')}
            ${g.leak?.left ? `<path class="pub-lad-leak" d="${esc(g.leak.left)}${esc(g.leak.right ?? '')}"/>` : ''}`;
    }
    return `<svg class="pub-lad-svg" viewBox="0 ${y0} ${g.w} ${h}" preserveAspectRatio="none" ${label ? `role="img" aria-label="${esc(label)}"` : 'aria-hidden="true"'} focusable="false">${inner}${tube}</svg>`;
}

// A rung's multiplier reads green when it beats a typical fighter at this level, red when it
// trails, white when level: the page's own tone() again, applied to the multiplier (index 100
// is typical).
function ladderTone(index) {
    if (index == null) return 'neutral';
    const t = tone((index - 100) / 100, 0.6);
    return t.cls === 'fli-pos' ? 'good' : t.cls === 'fli-neg' ? 'bad' : 'neutral';
}

// One line of figures per rung, and nothing else: the name, the figure and the multiplier.
// What each rung means, how it compares and what it implies is the section's prose.
function ladderRung(gs, top, shown) {
    const unmeasured = gs.measured === false;
    const notComparable = gs.status === 'no_fight_window';
    // Number by POSITION on the page, not by the rung's own id. The payload drops the rungs
    // it cannot measure, so its ids run 01, 02, 04: printing the gap tells the reader a rung
    // is missing, which is the thing dropping it was meant to avoid.
    const n = String(shown ?? gs.n ?? '').padStart(2, '0');
    const chip = unmeasured ? 'not measured yet'
        : notComparable ? 'not comparable yet'
        : gs.index_text ? `${gs.index_text}${gs.index_word ? ` ${gs.index_word}` : ''}`
        : gs.status === 'base' ? 'the baseline' : null;
    const chipTone = unmeasured || notComparable || gs.status === 'base' ? 'dim' : ladderTone(gs.index);
    const figure = unmeasured
        ? ''
        : `<p class="pub-rung-figure"><b>${esc(gs.num ?? '')}</b>${gs.unit ? ` <span>${esc(gs.unit)}</span>` : ''}</p>`;
    return `<li class="pub-rung${unmeasured || notComparable ? ' pub-rung--none' : ''}">
        <div class="pub-rung-shape">${top}</div>
        <div class="pub-rung-body">
            <span class="pub-rung-name"><span class="pub-rung-n">${n}</span> ${esc(gs.title ?? '')}</span>
            ${figure}${chip ? `<span class="pub-rung-chip pub-rung-chip--${chipTone}">${esc(chip)}</span>` : ''}
        </div>
    </li>`;
}

// `hasStory` is kept for symmetry with the other blocks: with a story the worked example and
// the leak sentence (which the prose already says) are dropped; without one they stay above.
function ladderBlock(fn, hasStory = false) {
    const g = fn.graphic ?? {};
    const gstages = g.stages ?? [];
    const worked = hasStory ? '' : [g.worked?.size, g.worked?.conversion].filter(Boolean)
        .map((t) => `<p class="pub-note pub-note--lead">${esc(t)}</p>`).join('');
    const leak = !hasStory && fn.leak?.sentence ? `<p class="pub-note${fn.leak.named ? ' pub-tone-text-bad' : ''}">${esc(fn.leak.sentence)}</p>` : '';
    const exposure = fn.exposure ? `<li class="pub-rung pub-rung--none pub-rung--edge">
        <div class="pub-rung-shape"></div>
        <div class="pub-rung-body">
            <span class="pub-rung-name"><span class="pub-rung-n">00</span> ${esc(fn.exposure.title ?? 'Exposure')}</span>
            <span class="pub-rung-chip pub-rung-chip--dim">not comparable yet</span>
        </div>
    </li>` : '';
    // The silhouette is ONE continuous shape and each rung draws the band of it between its
    // own y0 and y1. The payload drops the rungs it cannot measure but leaves the geometry
    // describing the whole ladder, so a dropped rung's band was simply never drawn and the
    // outline broke at that seam: rung 02 ended where the hidden rung began and rung 04
    // resumed further down, with the stack closing the gap. Each visible rung now runs to
    // where the NEXT visible one starts, so a hidden rung's band is absorbed by its
    // neighbour and the shape stays whole.
    const rows = gstages.map((gs, i) => {
        const y0 = gs.y0 ?? 0;
        const y1 = gstages[i + 1]?.y0 ?? gs.y1 ?? g.band_h ?? 150;
        const slice = ladderSlice(g, y0, y1, i, { label: i === 0 ? g.aria : null });
        return ladderRung(gs, slice, i + 1);
    }).join('');
    const future = (fn.future ?? []).map((x) => `<li class="pub-rung pub-rung--none pub-rung--edge">
        <div class="pub-rung-shape">${g.tail ? ladderSlice(g, g.tail.y0, g.tail.y1, 'tail', { tail: true }) : ''}</div>
        <div class="pub-rung-body">
            <span class="pub-rung-name"><span class="pub-rung-n">${String(x.n ?? '').padStart(2, '0')}</span> ${esc(x.title ?? '')}</span>
            <span class="pub-rung-chip pub-rung-chip--dim">not measured yet</span>
        </div>
    </li>`).join('');
    return `${worked}${leak}<figure class="pub-panel pub-panel--ladder">
        <ol class="pub-rungs">${exposure}${rows}${future}</ol>
        <p class="pub-panel-unit">Width is the share of this fighter's audience still there at each rung. Dashed is a typical fighter at this level. 1.0× is typical.</p>
    </figure>
    ${/* Name the sources, never what each one measures. Mapping "Wikipedia page views" to
         curiosity and "Instagram followers" to commitment hands over the recipe; the step
         from a raw count to the measure it stands for is the part that is ours. Contract v6. */ ''}
    ${fineNote('Sources: Wikipedia page views, Instagram and YouTube followers and posts.', 'small_print')}`;
}

// A small centred bar for the FLI's own −1..+1 range, the rankings page's own rk-bar idiom
// (see fliAttrs/fliCell above), reused rather than invented twice.
function fliRangeBar(score) {
    if (score == null) return '';
    const t = tone(score, 0.6);
    const w = (Math.min(Math.abs(score), 1) * 50).toFixed(1);
    const side = score < 0 ? 'neg' : 'pos';
    return `<div class="pub-fli-bar" role="img" aria-label="First Light Index ${signed(score, 2)} on a scale from -1 to +1, ${score < 0 ? 'below' : 'above'} the midpoint">
        <span class="pub-fli-bar-track"><span class="pub-fli-bar-fill pub-fli-bar-fill--${side}" style="width:${w}%; --m:${t.m}"></span></span>
        <span class="pub-fli-bar-scale"><span>−1</span><span>0</span><span>+1</span></span>
    </div>`;
}

const pct = (v, digits = 1) => `${(v * 100).toFixed(digits)}%`;
const median = (nums) => {
    const s = nums.filter((n) => n != null).sort((a, b) => a - b);
    if (!s.length) return null;
    const mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
};

// label may be a plain string, or {html} when it needs to carry markup (the FLI/FLR hover-link).
// `tone` colours the FIGURE only (green good, red bad), never the label or any prose around
// it: colour on a whole sentence reads as a verdict, and spending it everywhere leaves it
// meaning nothing where it matters.
function stat(value, label, tone) {
    if (value == null) return '';
    const lbl = label && typeof label === 'object' ? label.html : esc(label);
    const toneCls = tone ? ` pub-tone-text-${tone}` : '';
    return `<div class="pub-stat"><span class="pub-stat-n${toneCls}">${esc(value)}</span><span class="pub-stat-label">${lbl}</span></div>`;
}
// The multiple between the two everyday-audience figures, taken from the rounded values the
// card prints so the tile and the figures above it agree.
function levelMultiple(r) {
    const a = r.level_before != null ? Math.round(r.level_before) : null;
    const b = r.level_after != null ? Math.round(r.level_after) : null;
    if (!a || b == null) return null;
    return `${(b / a).toFixed(1)}×`;
}

function statRow(items, opts = {}) {
    const parts = items.filter(([v]) => v != null).map(([v, l, t]) => stat(v, l, t ?? opts.tone));
    const cls = `pub-stat-row${opts.cols === 2 ? ' pub-stat-row--pairs' : ''}`;
    return parts.length ? `<div class="${cls}">${parts.join('')}</div>` : '';
}

// A plain table for internal-data's multi-column rows (geography, off-cycle, billing). Cells
// arrive pre-escaped/pre-formatted by the caller, the same convention privatePage's rows() uses.
// Wrapped so a table wider than the phone it's read on visibly continues past the edge, rather
// than looking like the row simply ends (see .pub-table-wrap in publication.css).
// `freeze` pins the first column in place as the table scrolls sideways (card position: the
// date is the one column short enough to make a good anchor while the rest scroll under it).
// `bodyClass` adds a table-specific class for a column that needs its own rules (event names
// wrapping instead of the default single-line cell).
function table(headers, rows, { freeze = false, bodyClass = '' } = {}) {
    if (!rows.length) return '';
    return `<div class="pub-table-wrap"><table class="pub-table${freeze ? ' pub-table--freeze' : ''}${bodyClass ? ` ${bodyClass}` : ''}">
                <thead><tr>${headers.map((h) => `<th scope="col">${h && typeof h === 'object' ? h.html : esc(h)}</th>`).join('')}</tr></thead>
                <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div>`;
}

// A horizontal, snap-scrolling strip of cards: fight week (media kit) and fight-by-fight
// retention (internal data) both have the same shape, one card per fight, and both used to be
// one vertical section per fight before the owner's own review flagged it. The base CSS stacks
// `.pub-carousel-card` in normal document flow — a plain, always-correct list — and only the
// `@supports (scroll-snap-type: x mandatory)` block in publication.css turns that sideways,
// so a browser (or a screen reader) with no scroll-snap support gets the vertical stack with
// no extra branch here. Touch and trackpad scroll it natively; pub-carousel.js only adds
// ArrowLeft/ArrowRight on the strip itself, which is also how a keyboard reaches it — it is
// the one thing in the tab order these cards need, not a stop per card.
function carousel(id, cards, ariaLabel) {
    if (!cards.length) return '';
    // Dots below the strip, the way a phone carousel signals its own length: how many cards
    // there are and which one you are on. Decorative for a screen reader (the cards
    // themselves are all in the DOM and reachable), but clickable, because a dot that shows
    // position and refuses to move there is a tease. pub-carousel.js keeps them in sync with
    // whatever the strip is actually showing, from any scroll source.
    const dots = cards.length > 1 ? `
            <div class="pub-carousel-dots" data-dots-for="${id}" aria-hidden="true">${cards.map((_, i) => `
                <button type="button" class="pub-carousel-dot${i === 0 ? ' is-current' : ''}" data-index="${i}" tabindex="-1"></button>`).join('')}
            </div>` : '';
    return `<div class="pub-carousel" id="${id}" tabindex="0" role="group" aria-roledescription="carousel" aria-label="${esc(ariaLabel)}">${cards.map((c) => `
                <div class="pub-carousel-card">${c}</div>`).join('')}
            </div>${dots}`;
}

// A note whose sibling `<field>_style` reads "small_print" renders in the page's faintest,
// smallest style (pub-fine--tiny — the same treatment engagement_basis already had); every
// other note gets the ordinary faded fine print. Interpretation never goes through here: it
// stays at full weight in pub-note / pub-note--lead, wherever it already renders.
function fineNote(text, style) {
    if (!text) return '';
    return `<p class="pub-fine${style === 'small_print' ? ' pub-fine--tiny' : ' pub-fine--dim'}">${esc(text)}</p>`;
}

// A section always shows its explanation before its numbers. `note` is the payload's own
// per-fighter sentence where the contract defines one (still landing — see the build report);
// until then a fixed, evergreen line explains the section itself, exactly the pattern this file
// already uses for engagement_basis: the page's own words, never invented data.
//
// v8: the text is the spine. A section's `story` (validated paragraphs, written once at
// generation) leads the section at body size, above every figure and chart, and it IS the
// explanation: where one exists the fixed or generic note is not rendered at all. A section
// without a story keeps exactly what it had. `story` may arrive as an array of paragraphs, a
// string (paragraphs split on blank lines) or {paragraphs}; the first candidate that yields
// text wins, so callers can pass a block, then its container.
function storyParas(...candidates) {
    for (const c of candidates) {
        const raw = c && typeof c === 'object' && !Array.isArray(c) && 'story' in c ? c.story : c;
        const list = Array.isArray(raw) ? raw
            : raw && typeof raw === 'object' && Array.isArray(raw.paragraphs) ? raw.paragraphs
            : typeof raw === 'string' ? raw.split(/\n\s*\n/) : [];
        const paras = list.filter((t) => typeof t === 'string' && t.trim()).map((t) => t.trim());
        if (paras.length) return paras;
    }
    return null;
}
const storyHtml = (paras) => (paras ? `<div class="pub-story">${paras.map((t) => `<p>${esc(t)}</p>`).join('')}</div>` : '');

function section(id, heading, inner, note, story = null) {
    if (!inner) return '';
    const paras = Array.isArray(story) ? story : storyParas(story);
    return `
    <section class="pub-section" aria-labelledby="${id}">
        <div class="pub-inner">
            <h2 class="pub-h2" id="${id}">${esc(heading)}</h2>
            ${paras ? storyHtml(paras) : note ? `<p class="pub-note pub-note--lead">${esc(note)}</p>` : ''}
            ${inner}
        </div>
    </section>`;
}

// FLI/FLR: named, defined on hover, and linked to the rankings key — reusing the exact one-line
// descriptions HINT_FLR/HINT_FLI already put on /index/, not a second, drifting copy of them.
const KEY_HREF = '/index/#key';
const hintLink = (label, name, desc) =>
    `<a class="hint pub-hint" href="${KEY_HREF}">${label}<span class="hint-tip"><strong>${esc(name)}</strong><span class="hint-desc">${esc(desc)}</span></span></a>`;
// The wording differs from /index/'s own hints by one word on purpose: these pages say
// "level", never "skill", because skill reads as an opinion about a fighter and level
// reads as a position among fighters. Same metric, same definition, same link.
const fliHint = () => hintLink('FLI', 'First Light Index', 'audience compared with level');
const flrHint = () => hintLink('FLR', 'First Light Rating', 'a fighter\'s level, from results');

// A caption with one phrase in it explained on hover: everything is escaped, and the phrase
// has to appear verbatim in the caption or the caption renders untouched (never a silent
// half-substitution).
function withTerm(caption, term, explainer, opts) {
    if (!caption) return '';
    if (!term || !explainer || !caption.includes(term)) return esc(caption);
    const [before, ...rest] = caption.split(term);
    return `${esc(before)}${hintText(term, explainer, opts)}${esc(rest.join(term))}`;
}

// A hover explainer with no link behind it: "122 fighters compared" reads as 122 random
// fighters unless the page can say, in a breath, who they actually are. Same dotted-underline
// affordance as the FLR/FLI hints, but the text comes from the payload rather than a fixed
// definition, because who is in the comparison depends on the fighter.
const hintText = (label, desc, { sentence = false } = {}) => (desc
    ? `<span class="hint pub-hint">${esc(label)}<span class="hint-tip"><span class="hint-desc${sentence ? ' hint-desc--sentence' : ''}">${esc(desc)}</span></span></span>`
    : esc(label));

// What the card-position score is, in plain words. The page's own sentences do the judging;
// this only says what the number is, what 1.00 is, what the bracket is, and which way is better.
const CARD_SCORE_HINT = 'How high the fight sits on the card. 1.00 is a normal main event. Lower numbers sit further down the card. A championship fight can go above 1.00. The number in brackets is how far that is from where fighters at this level usually sit: plus means higher than usual, minus means lower. Higher is better.';

// Win green, loss red, a draw stays neutral — reusing tone()'s own two colours rather than a
// second palette, the same rule the spec asks the charts to follow.
function resultTone(result) {
    const r = String(result ?? '').toLowerCase();
    if (r.startsWith('w')) return 'good';
    if (r.startsWith('l')) return 'bad';
    return 'neutral';
}
// Event names arrive display-ready: the assembler already drops a redundant long-form
// promotion prefix ("Professional Fighters League - PFL New York" -> "PFL New York")
// while keeping the short code where it is part of the name. A second strip here turned
// "UFC 308" into a bare "308", which is why there is no longer one.

// The fighter's name is the page's wordmark, so it is set like the site's own hero: the
// last name on its own line, both lines fitted to the SAME measure. A long surname
// ("Nurmagomedov") otherwise wraps mid-name under a short given name, which reads as a
// layout accident on the one element the page is built around.
//
// The split is on the LAST space: everything before it is line one, the final word is
// line two. A single-word name renders as one line and is simply fitted on its own.
// The equal-width fit itself happens in the browser (pub-fit.js) by binary search, the
// same technique index.html uses for the hero and the creed; with no script the clamp
// size in publication.css still renders both lines legibly, it just does not fit them.
function nameLines(full) {
    const name = (full ?? '').trim();
    if (!name) return '';
    const cut = name.lastIndexOf(' ');
    const lines = cut === -1 ? [name] : [name.slice(0, cut), name.slice(cut + 1)];
    return `<h1 class="pub-name" data-fit-name>${lines
        .map((l) => `<span class="pub-name-line">${esc(l)}</span>`).join('')}</h1>`;
}

// ── media kit ──

function recordText(r) {
    const base = `${r.wins}-${r.losses}-${r.draws}`;
    return r.ncs > 0 ? `${base} (${r.ncs} NC)` : base;
}

// An unbeaten fighter's run is stated from the record, which needs no bout history:
// `undefeated_in` is set exactly when the assembler can back it, and it replaces a streak
// that partial history (or a no-contest mid-record) would understate. Usman Nurmagomedov
// read "5 wins in a row" under a 22-0-0 record because a no-contest in 2023 broke the run.
function runLabel(f) {
    if (f.undefeated_in != null) return ['Undefeated', `in ${num(f.undefeated_in)} fights`];
    const t = streakText(f.streak);
    return t ? [t, 'Streak'] : [null, 'Streak'];
}

function streakText(s) {
    if (!s) return null;
    const r = String(s.result).toLowerCase();
    const word = r.startsWith('w') ? 'win' : r.startsWith('l') ? 'loss' : 'draw';
    return `${s.n} ${word}${s.n === 1 ? '' : 's'} in a row`;
}

// A discreet line, not a stat tile: "Bantamweight: #84 ranked (First Light Skill Rankings)".
function rankLine(r) {
    if (!r) return '';
    const place = r.is_champion ? 'Champion' : `#${r.rank} ranked`;
    return `<p class="pub-rank-line">${esc(r.division)}: <strong>${esc(place)}</strong> <span class="pub-rank-src">(${esc(r.source)})</span></p>`;
}

function nextFightBlock(n) {
    if (!n) return '';
    return `<p class="pub-line"><strong>vs ${esc(n.opponent)}</strong> · ${esc(n.event)} (${esc(n.promotion)}) · ${fmtDate(n.date)}</p>`;
}

// Which follower chart belongs to this platform's block. Each social[] entry carries its own
// (`followers_chart`); an older payload sent only charts.followers, one platform's history —
// it goes under the platform it names (series.platform, else its axis label), never tacked
// on after whichever platform happens to come last.
function platformFollowerChart(s, legacy) {
    if (s.followers_chart !== undefined) return s.followers_chart;
    if (!legacy) return null;
    const named = legacy.platform ?? legacy.y?.label ?? legacy.label ?? '';
    return String(named).toLowerCase().startsWith(String(s.platform).toLowerCase()) ? legacy : null;
}

function socialBlock(s, legacy) {
    const rows = statRow([
        [s.followers != null ? num(s.followers) : null, 'Followers'],
        [s.engagement_rate != null ? pct(s.engagement_rate, 2) : null, 'Engagement'],
        [s.avg_likes != null ? num(s.avg_likes) : null, 'Avg. likes'],
        [s.avg_comments != null ? num(s.avg_comments) : null, 'Avg. comments'],
        [s.avg_video_views != null ? num(s.avg_video_views) : null, 'Avg. video views'],
        [s.posts_per_30d != null ? num(s.posts_per_30d) : null, 'Posts / 30 days'],
    ]);
    const mix = (s.media_mix ?? []).length
        ? `<p class="pub-fine">${s.media_mix.map((m) => `${esc(m.type)} ${pct(m.share, 0)}`).join(' · ')}</p>` : '';
    const fc = platformFollowerChart(s, legacy);
    const followers = chart(fc, { unit: 'Followers', yRefs: extremeRefs(fc, { hi: s.followers != null ? `${num(s.followers)} today` : null }), tone: 'accent' });
    // The caveat, not the headline: engagement_basis is a real sentence ("the median over the
    // last 12 of 12 posts"), not a 30-day window, and now reads that way — small print under
    // everything else, not the second line of the block.
    return `
            <div class="pub-platform">
                <h3 class="pub-h3">${esc(s.platform)}</h3>
                ${storyHtml(storyParas(s))}
                ${rows}${mix}
                <p class="pub-fine pub-fine--tiny">Engagement is ${esc(s.engagement_basis)}, not a 30-day window. Measured ${fmtDate(s.measured_on)}.</p>
                ${followers}
            </div>`;
}

// A GitHub-contribution-style grid, one cell per day, symbol = media type, colour = that post's
// engagement relative to this fighter's own — replacing a flat "top posts" list. Reads the
// payload's own per-day field (`data.posting_calendar`, contract v2) once it lands; until then,
// falls back to the days we can already place from `top_posts` alone, labelled honestly as the
// posts on file so a sparse grid reads as a thin sample, never as "this fighter doesn't post".
const TYPE_SYMBOL = { Photo: 'P', Video: 'V', Carousel: 'C', Reel: 'R', Story: 'S', Text: 'T' };
// The grid runs one column per week, seven rows Monday to Sunday, like a commit calendar:
// the EMPTY days carry as much as the filled ones, since they are what show whether someone
// posts steadily, in bursts or barely at all. The assembler sends every day in the window
// already week-aligned, so nothing is padded here except an older, unaligned payload.
// Month blocks, weeks running left to right, seven columns: an ordinary calendar rather
// than the commit-calendar's vertical weeks, which reads as a data tool rather than as a
// month someone can scan. Each month starts on the right weekday and only the days it
// actually has.
const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
                     'July', 'August', 'September', 'October', 'November', 'December'];
function calendarMonths(cells) {
    if (!cells.length) return '';
    const months = new Map();
    for (const c of cells) {
        const key = c.date.slice(0, 7);
        if (!months.has(key)) months.set(key, []);
        months.get(key).push(c);
    }
    return [...months.entries()].map(([key, days]) => {
        const [y, m] = key.split('-').map(Number);
        const firstDow = (new Date(Date.UTC(y, m - 1, Number(days[0].date.slice(8, 10)))).getUTCDay() + 6) % 7;
        const pad = Array(firstDow).fill('<span class="pub-cal-cell pub-cal-cell--pad" aria-hidden="true"></span>').join('');
        return `<div class="pub-cal-month">
                <p class="pub-cal-month-name">${esc(MONTH_NAMES[m - 1])} ${y}</p>
                <div class="pub-cal-grid">${pad}${calendarCells(days, { padded: true })}</div>
            </div>`;
    }).join('');
}

function calendarCells(cells, { padded = false } = {}) {
    if (!cells.length) return '';
    const firstDow = padded ? 0 : (new Date(`${cells[0].date}T00:00:00Z`).getUTCDay() + 6) % 7;  // Monday = 0
    const withPad = [...Array(firstDow).fill(null), ...cells];
    return withPad.map((c) => {
        if (!c) return '<span class="pub-cal-cell pub-cal-cell--pad" aria-hidden="true"></span>';
        if (c.future) return '<span class="pub-cal-cell pub-cal-cell--future" aria-hidden="true"></span>';
        if (!c.type) return `<span class="pub-cal-cell" title="${esc(fmtDate(c.date))}: no post"></span>`;
        const sym = TYPE_SYMBOL[c.type] ?? c.type.slice(0, 1).toUpperCase();
        // No floor: the lowest tier is exactly the empty-day colour (a post that did nothing has
        // the impact of no post; the letter alone says a post happened).
        const rel = c.rel != null ? Math.max(0, Math.min(1, c.rel)) : 0.55;
        const count = c.posts > 1 ? `, ${c.posts} posts` : '';
        return `<span class="pub-cal-cell pub-cal-cell--post${rel >= 0.52 ? ' pub-cal-cell--hi' : ''}" style="--rel:${rel.toFixed(2)}" title="${esc(fmtDate(c.date))} · ${esc(c.type)}${count}">${esc(sym)}</span>`;
    }).join('');
}
function calendarLegend(types) {
    const items = types.map((t) => `<span class="pub-cal-legend-item"><i class="pub-cal-sym">${esc(TYPE_SYMBOL[t] ?? t.slice(0, 1).toUpperCase())}</i>${esc(t)}</span>`).join('');
    return `<div class="pub-cal-legend">${items}<span class="pub-cal-legend-item pub-cal-legend-item--scale"><i class="pub-cal-scale"></i>engagement</span></div>`;
}
function postingCalendarBlock(d) {
    // The assembler sends `days` ({date, media_type, intensity}), a `window` with its two
    // ends and a `basis` line saying these are the posts ON FILE. This block used to read
    // `cells`/`window_days`/`best.text`, none of which it ever sent, so it fell through to a
    // top-posts fallback that v4 had already removed and the whole section disappeared.
    const cal = d.posting_calendar;
    const days = cal?.days ?? cal?.cells;
    if (days?.length) {
        const cells = days.map((c) => ({ date: c.date, type: c.media_type ?? c.type,
            rel: c.intensity ?? c.rel, posts: c.posts, future: c.future }));
        const types = cal.media_types ?? [...new Set(cells.map((c) => c.type).filter(Boolean))];
        const bestText = cal.best?.value_text ?? cal.best?.text
            ?? (cal.best?.likes != null ? `${num(cal.best.likes)} likes` : null);
        const typicalText = cal.typical?.value_text ?? cal.typical?.text
            ?? (cal.typical?.likes != null ? `${num(cal.typical.likes)} likes` : null);
        return `<div class="pub-cal-wrap"><div class="pub-cal">${calendarMonths(cells)}</div></div>${calendarLegend(types)}
            ${cal.basis ? `<p class="pub-fine pub-fine--tiny">${esc(cal.basis)}</p>` : ''}
            ${statRow([[bestText, 'Best post'], [typicalText, 'Typical post']])}`;
    }
    const posts = d.top_posts ?? [];
    if (!posts.length) return '';
    const dates = posts.map((p) => new Date(`${p.date}T00:00:00Z`).getTime()).sort((a, b) => a - b);
    const start = new Date(dates[0]), end = new Date(dates[dates.length - 1]);
    const byDate = new Map(posts.map((p) => [p.date, p]));
    const maxEng = Math.max(...posts.map((p) => (p.likes ?? 0) + (p.comments ?? 0)), 1);
    const cells = [];
    for (let t = new Date(start); t <= end; t = new Date(t.getTime() + 86400000)) {
        const iso = t.toISOString().slice(0, 10);
        const p = byDate.get(iso);
        cells.push(p ? { date: iso, type: p.media_type, rel: ((p.likes ?? 0) + (p.comments ?? 0)) / maxEng } : { date: iso, type: null });
    }
    const types = [...new Set(posts.map((p) => p.media_type))];
    const best = posts.reduce((a, b) => (((b.likes ?? 0) + (b.comments ?? 0)) > ((a.likes ?? 0) + (a.comments ?? 0)) ? b : a));
    const typicalLikes = median(posts.map((p) => p.likes));
    return `<div class="pub-cal-wrap"><div class="pub-cal">${calendarCells(cells)}</div></div>${calendarLegend(types)}
        <p class="pub-fine pub-fine--dim">Posts on file: ${fmtDate(start.toISOString())} – ${fmtDate(end.toISOString())} (${posts.length} posts). A sparse grid reflects what we have on file, not how often this fighter actually posts.</p>
        ${statRow([
            [best.likes != null ? `${num(best.likes)} likes` : null, 'Best post'],
            [typicalLikes != null ? `${num(Math.round(typicalLikes))} likes` : null, 'Typical post'],
        ])}`;
}

function attentionBlock(w, series, bouts, fw) {
    if (!w) return '';
    const langs = (w.languages ?? []).length
        ? `<p class="pub-fine">${w.languages.map((l) => `${esc(l.market)} ${pct(l.share, 0)}`).join(' · ')}</p>` : '';
    // The same fight-week peak/baseline printed under "Fight week" below, reused here to label
    // this curve's own extremes with real numbers rather than leaving the y-axis bare.
    const refs = fw ? extremeRefs(series, { hi: `${num(fw.peak_views_per_day)}/day peak`, lo: `${num(fw.baseline)}/day baseline` }) : [];
    return `${statRow([[num(w.views_per_day), `Pageviews / day (${w.window_days}d avg)`]])}
            ${chart(series, { unit: 'Wikipedia pageviews per day', yRefs: refs, bouts, tone: 'accent' })}
            ${langs}
            <p class="pub-fine pub-fine--tiny">Source: ${esc(w.provenance ?? `Wikipedia pageviews, all languages, ${w.window_days}-day average.`)}</p>`;
}

// Markets: one chart, two readings, not two unrelated ones (see marketsPairedChart). The exact
// caption text is the contract's own wording; a payload that later names its own captions
// (search_caption/market_caption) overrides it, read defensively since neither field exists
// yet. `countries_ranked` is the older order-only shape, still accepted so a publication
// generated before the indices landed keeps rendering — order only, no dollar figures, exactly
// as the contract requires.
function marketsBlock(mc) {
    if (!mc) return '';
    if (Array.isArray(mc.countries) && mc.countries.length) {
        return `${marketsPairedChart(mc.countries, {
            searchCaption: mc.search_volume_caption ?? mc.search_caption ?? 'Relative search interest by country',
            marketCaption: mc.market_value_caption ?? mc.market_caption ?? 'Adjusted by relative ad spend per internet user, by country',
            marketTerm: mc.market_value_term, marketExplainer: mc.market_value_explainer,
        })}
            <p class="pub-fine pub-fine--tiny">Basis: ${esc(mc.basis)}. Relative indices only, no dollar figures.</p>`;
    }
    return `<ol class="pub-order">${mc.countries_ranked.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
            <p class="pub-fine pub-fine--tiny">Order of ${esc(mc.basis)}.</p>`;
}

// data.fight_week is moving from one object (the most recent scored fight only) to a list of
// recent fights — read all three shapes a payload might send: the legacy bare object, a bare
// array, or {rows, note} (the same convention broadcast/retention/off_cycle already use).
function fightWeekRows(fw) {
    if (!fw) return [];
    if (Array.isArray(fw)) return fw;
    if (Array.isArray(fw.rows)) return fw.rows;
    return [fw];
}

// One fight's own card: opponent, date, the peak/baseline figures, and its own curve. A
// per-fight curve travels on the row itself (`curve`/`chart`) once the payload sends one there
// — the same place internal_data.retention.rows already keeps its curve; the single legacy
// fight_week object instead shares the one series still sitting at data.charts.fight_week.
function fightWeekCard(fw, series) {
    const refs = extremeRefs(series, {
        hi: `${num(fw.peak_views_per_day)}/day peak`,
        lo: `${num(fw.baseline)}/day baseline`,
    });
    return `<p class="pub-line"><strong>vs ${esc(fw.opponent)}</strong> · ${fmtDate(fw.fight_date)}</p>
            ${storyHtml(storyParas(fw))}
            ${statRow([
                [`×${fw.lift_ratio.toFixed(1)}`, 'Peak vs. baseline'],
                [num(fw.peak_views_per_day), 'Peak pageviews / day'],
                [num(fw.baseline), 'Baseline pageviews / day'],
            ])}
            ${chart(series, { unit: 'Wikipedia pageviews per day', yRefs: refs, bouts: [{ opponent: fw.opponent, date: fw.fight_date }], tone: 'accent' })}`;
}

// One section, many fights, a horizontal carousel rather than one vertical block per fight
// (see carousel() above).
function fightWeekBlock(rows, legacySeries) {
    if (!rows.length) return '';
    const cards = rows.map((r) => fightWeekCard(r, r.curve ?? r.chart ?? (rows.length === 1 ? legacySeries : null)));
    return carousel('pub-fw-carousel', cards, 'Fight week, by fight');
}

// Opponent named on every row (a card appearance without one is half a fact); the matching
// caveat drops to the smallest, faintest style on the page rather than sitting as the
// section's own lead note.
function broadcastList(rows, note) {
    if (!rows.length) return '';
    // Two lines a fight, not four: the event and the result on one, everything that
    // qualifies it (opponent, date, promotion, slot, tier) joined on the next. Four separate
    // lines each holding one short fact turned eight fights into a page of scrolling.
    return `<ul class="pub-list">${rows.map((b) => {
        const meta = [b.opponent ? `vs ${b.opponent}` : null, fmtDate(b.date), b.promotion,
                      b.card_section, b.event_tier].filter(Boolean).map(esc).join(' · ')
            + (b.is_title ? ' <span class="pub-tag">Title fight</span>' : '');
        return `
                <li class="pub-list-row pub-list-row--tight">
                    <div class="pub-list-main">
                        <span class="pub-list-title">${esc(b.event)}</span>
                        <p class="pub-fine pub-fine--dim">${meta}</p>
                    </div>
                    <div class="pub-list-figures"><span class="pub-tone-text-${resultTone(b.result)}">${esc(b.result)}</span></div>
                </li>`;
    }).join('')}
            </ul>${note ? `<p class="pub-fine pub-fine--tiny">${esc(note)}</p>` : ''}`;
}

// Where the manager and the brand cannot get a read anywhere else: not where a fighter is, but
// where they're headed — follower growth, a confirmed step up in typical attention, and rank
// movement (`data.trajectory.follower_growth` / `.attention_shift` / `.rank_movement`).
// `t.note` is passed to section()'s own note slot by the caller, not baked in here: that way
// section()'s empty-inner guard still suppresses the whole thing when none of the three actually
// landed, instead of the heading and an explanatory note showing over nothing — the empty
// section the owner hit here.
// Before and after, as two bars on one scale: the step a fame shift is a RATIO of. Its own
// small chart rather than the paired-country one, which carries two measures per row; here
// there is one measure at two moments.
function levelPairChart(levels, unit) {
    const W = 300, rowH = 26, gap = 10, labelW = 96;
    const H = levels.length * (rowH + gap) - gap;
    const max = Math.max(...levels.map((l) => l.value), 1);
    const barW = W - labelW - 46;
    const rows = levels.map((l, i) => {
        const y = i * (rowH + gap);
        const w = Math.max(2, (l.value / max) * barW);
        const cls = i === levels.length - 1 ? 'pub-bar--search' : 'pub-bar--market';
        return `<text class="pub-bar-label" x="0" y="${(y + rowH / 2).toFixed(1)}">${esc(l.label)}</text>`
            + `<rect class="pub-bar ${cls}" x="${labelW}" y="${y}" width="${w.toFixed(1)}" height="${rowH}" rx="2"/>`
            + `<text class="pub-bar-value" x="${(labelW + w + 6).toFixed(1)}" y="${(y + rowH / 2).toFixed(1)}">${esc(num(l.value))}</text>`;
    }).join('');
    return `<figure class="pub-panel pub-panel--bars">
        <svg class="pub-panel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit)}, before and after the step up">${rows}</svg>
        <p class="pub-panel-unit">${esc(unit)}</p>
    </figure>`;
}

function trajectoryBlock(t, hasStory = false) {
    if (!t) return '';
    const fg = t.follower_growth, rm = t.rank_movement, as = t.attention_shift;
    const rows = statRow([
        [fg?.value_text ?? null, fg ? `${fg.platform} followers, last ${fg.window_days}d` : null],
        [fg?.per_month_text ?? null, 'Follower growth, per month'],
        [rm ? (rm.delta > 0 ? `+${rm.delta}` : String(rm.delta)) : null, rm ? `${rm.division} rank movement, last ${rm.window_days}d` : null],
    ]);
    // Colour marks the KEY NUMBER, never the prose: a whole green sentence reads as a
    // verdict rather than a reading, and it stops the green meaning anything where it does
    // appear. The step also gets shown, not just asserted: the two levels the ratio compares,
    // side by side, when the payload carries them.
    const shift = as ? `
        ${as.ratio != null ? statRow([[`×${num(as.ratio, 1)}`, `Everyday attention since ${esc(as.since ?? 'the step up')}`]], { tone: as.direction === 'down' ? 'bad' : 'good' }) : ''}
        ${as.levels?.length ? levelPairChart(as.levels, as.unit ?? 'Wikipedia views per day') : ''}
        ${as.sentence && !hasStory ? `<p class="pub-note">${esc(as.sentence)}</p>` : ''}
        ${fineNote(as.note, 'small_print')}` : '';
    return `${rows}${shift}`;
}

export function mediaKitPage({ page, site }) {
    const d = page.data;
    const f = d.fighter;
    const headerMeta = [f.division, f.organization, f.gym, f.nationality].filter(Boolean).join(' · ');
    // `fight_weeks` since it became a list of recent fights; `fight_week` is the
    // single-fight key publications generated before that carried.
    const fwRows = fightWeekRows(d.fight_weeks ?? d.fight_week);
    const bouts = [...fwRows, d.next_fight].filter(Boolean).map((x) => ({ opponent: x.opponent, date: x.date ?? x.fight_date }));

    const body = `<main class="pub">
    <header class="pub-head">
        <div class="pub-inner">
            ${nameLines(f.name)}${f.nickname ? `
            <p class="pub-nick">“${esc(f.nickname)}”</p>` : ''}${headerMeta ? `
            <p class="pub-meta">${esc(headerMeta)}</p>` : ''}
            <p class="pub-asof">Data measured on ${fmtDate(page.measured_on)}.</p>
            ${rankLine(d.rank)}
            ${statRow([
                [recordText(f.record), 'Record'],
                runLabel(f),
            ])}
        </div>
    </header>
${section('pub-next', 'Next fight', nextFightBlock(d.next_fight), null, storyParas(d.next_fight))}
${section('pub-social', 'Social', d.social.length ? d.social.map((s) => socialBlock(s, d.charts.followers)).join('') : '', null, storyParas(d.social_story))}
${section('pub-posts', 'Posting activity', postingCalendarBlock(d), 'One cell per day the window covers; colour shows how that post did against this fighter’s own average, not against anyone else’s.', storyParas(d.posting_calendar))}
${section('pub-wiki', 'Attention', attentionBlock(d.wikipedia, d.charts.pageviews, bouts, fwRows[0]), null, storyParas(d.wikipedia))}
${section('pub-geo', 'Markets', marketsBlock(d.market_concentration), null, storyParas(d.market_concentration))}
${section('pub-fw', 'Fight week', fightWeekBlock(fwRows, d.charts.fight_week), null, storyParas(d.fight_weeks, d.fight_week))}
${section('pub-compound', 'Audience retention', compoundingBlock(d.compounding, !!storyParas(d.compounding)), null, storyParas(d.compounding))}
${section('pub-off', 'Between fights', offCycleTable(offCycleRows(d.off_cycle)), offCycleNote(d.off_cycle) ?? (offCycleRows(d.off_cycle).length ? 'Weeks with a real jump in attention even though no fight was near: he draws attention outside fight weeks too.' : null), storyParas(d.off_cycle))}
${(() => {
    // Bare array, or {rows, note} once the assembler carries its own explanation.
    const rows = Array.isArray(d.broadcast) ? d.broadcast : (d.broadcast?.rows ?? []);
    const note = (!Array.isArray(d.broadcast) && d.broadcast?.note) || (rows.length ? 'Not a complete record.' : null);
    return section('pub-broadcast', 'Recent broadcast history', broadcastList(rows, note), null, storyParas(d.broadcast));
})()}
${section('pub-trajectory', 'Trajectory', trajectoryBlock(d.trajectory, !!storyParas(d.trajectory)), d.trajectory?.note, storyParas(d.trajectory))}
</main>
${PUB_FOOTER}`;

    return shell({
        title: `${f.name} · Media kit · FIRST LIGHT`,
        description: `Audience and performance measurement for ${f.name}, measured ${page.measured_on}.`,
        url: '', site, current: null, body,
        css: ['/publication.css'], noindex: true, og: true, nav: false, js: ['/pub-fit.js', '/pub-carousel.js'],
    });
}

// ── internal data ──

// v3 owner review: lead with the LEVEL, so "the audience it predicts" has something to refer
// back to, then the predicted audience, the measured audience and the gap between them, named
// as such. The reading is the assembler's own one-or-two-sentence prose (`reading_sentence`) —
// not the lowercase fragment ("more fame than their level alone predicts") that used to sit
// under the FLI number by itself. The calibration caveat is real, but it explains how the
// number is BUILT, not what it means — small print, not the lead.
function overviewBlock(fl, field, hasStory = false) {
    if (!fl) return '';
    // v3 replaced `gap` (the index's own magnitude delta, formatted to 2 decimals) with
    // `audience_gap` (measured minus predicted, a real count in the audience's own units) —
    // the loader accepts either (see data.mjs), so the renderer has to as well, and the two
    // are NOT interchangeable: a count formatted like an index reads as "+172000.00".
    const gapText = fl.audience_gap_text ?? (fl.audience_gap != null ? signed(fl.audience_gap, 0)
        : (fl.gap != null ? signed(fl.gap, 2) : null));
    const rows = statRow([
        [fl.rating != null ? num(fl.rating) : null, { html: flrHint() }],
        [fl.expected_text ?? (fl.expected != null ? num(fl.expected) : null), 'Audience its level predicts'],
        [fl.actual_text ?? (fl.actual != null ? num(fl.actual) : null), 'Audience measured'],
        [gapText, 'Audience gap'],
    ]);
    const reading = fl.reading_sentence ?? fl.reading;
    const readingHtml = reading && !hasStory ? `<p class="pub-note pub-note--lead">${esc(reading)}</p>` : '';
    const fliBlock = fl.score != null ? `
        <div class="pub-panel pub-fli-block">
            <p class="pub-fli-label">${fliHint()} <span class="pub-fli-n pub-tone-text-${fl.score < -0.04 ? 'bad' : fl.score > 0.04 ? 'good' : 'neutral'}">${signed(fl.score, 2)}</span></p>
            ${fliRangeBar(fl.score)}
        </div>` : '';
    // note_gap was the field name before audience_gap replaced gap; note_audience_gap is its
    // replacement, kept alongside the old name so a publication built before the rename still
    // renders. A note's own `<field>_style` sibling ("small_print") picks the faintest,
    // smallest treatment — see fineNote.
    const smallPrint = [
        { text: fl.note_audience ?? 'Audience is a calibrated followers-equivalent across the platforms we track, not a number you can reproduce by adding up follower counts.', style: fl.note_audience_style },
        { text: fl.note_audience_gap ?? fl.note_gap, style: fl.note_audience_gap_style },
        { text: fl.trend?.delta != null ? `FLI moved ${signed(fl.trend.delta, 2)} over the last ${fl.trend.days} days.` : null, style: null },
    ].filter((s) => s.text);
    // 
    // The field is a small square beside the figures (under them on a phone), never a panel of
    // its own. Its verdict sentence is only shown when no story carries it.
    const fieldHtml = fieldChart(field);
    const verdictHtml = !hasStory && fieldHtml && field.verdict ? `<p class="pub-note pub-note--lead pub-field-verdict">${esc(field.verdict)}</p>` : '';
    return `<div class="pub-fl-figures${fieldHtml || fliBlock ? ' pub-fl-figures--field' : ''}">
        <div class="pub-fl-nums">${rows}</div>${fieldHtml || fliBlock ? `<div class="pub-fl-side">${fieldHtml}${fliBlock}</div>` : ''}
    </div>${readingHtml}${verdictHtml}${smallPrint.map((s) => fineNote(s.text, s.style)).join('')}`;
}

function funnelBlock(fn, hasStory = false) {
    if (!fn) return '';
    // The reworked ladder carries per-rung geometry (graphic.stages); the pre-ladder funnel
    // carried graphic.segments and keeps its own rendering below.
    if (Array.isArray(fn.graphic?.stages) && fn.graphic.stages.length) return ladderBlock(fn, hasStory);
    // Each stage arrives display-ready from the assembler: `title` names it, `text` is the
    // figure already in its own units ("590K views"), `peer_text` is the typical fighter at
    // the same level and `pct_text` where this one sits among them ("better than X% of
    // fighters at this level" — the assembler's own words, never "Xth percentile"). An
    // unmeasured stage says so rather than printing a zero.
    const stages = (fn.stages ?? []).length
        ? `<ol class="pub-stages">${fn.stages.map((s) => `
                <li class="pub-stage${s.measured === false ? ' pub-stage--none' : ''}">
                    <p class="pub-stage-name">${esc(s.title ?? '')}</p>
                    <p class="pub-stage-figure">${s.measured === false ? 'not measured' : esc(s.text ?? '')}</p>
                    ${s.what ? `<p class="pub-fine pub-fine--dim">${esc(s.what)}</p>` : ''}
                    ${s.peer_text || s.pct_text ? `<p class="pub-fine">${[s.peer_text, s.pct_text].filter(Boolean).map(esc).join(' · ')}</p>` : ''}
                </li>`).join('')}</ol>` : '';
    const graphic = legacyFunnelGraphic(fn);
    return `${stages}${graphic}${fn.leak?.sentence ? `<p class="pub-note${fn.leak.named ? ' pub-tone-text-bad' : ''}">${esc(fn.leak.sentence)}</p>` : ''}`;
}

// v4: the same paired chart the media kit's Markets section uses (marketsPairedChart) rather
// than two disconnected bar charts — the same countries measured twice, side by side. The
// trailing language list stays dropped: a row of percentages with no stated meaning was the
// review's own description of it, and the payload carries no sentence yet that would make
// sense of it (see the build report).
function geographyBlock(g) {
    if (!g) return '';
    const label = (c) => `${c.country}${c.estimated ? ' *' : ''}`;
    const countries = g.countries.map((c) => ({ country: label(c), search_volume_index: c.search_volume_index, market_value_index: c.market_value_index }));
    const hasEstimate = g.countries.some((c) => c.estimated);
    return `${marketsPairedChart(countries, {
        searchCaption: g.search_volume_caption ?? g.search_caption ?? 'Relative search interest by country',
        marketCaption: g.market_value_caption ?? g.market_caption ?? 'Adjusted by relative ad spend per internet user, by country',
        marketTerm: g.market_value_term, marketExplainer: g.market_value_explainer,
    })}
        ${hasEstimate ? '<p class="pub-fine pub-fine--tiny">* modelled estimate.</p>' : ''}`;
}

// Retention only matters if it COMPOUNDS: a fight that spikes attention 30× for a week and
// leaves nothing behind a month later is a fighter running in place, however big the spike
// looked. So the section now leads with the level itself, across every fight, not with three
// per-fight afterglow ratios — those move down to supporting detail underneath.
//
// Payload shape this expects (contract update in flight, so every field is read defensively):
//   data.compounding: {
//     n, span_text, mean_step_text, first_level_text, latest_level_text,
//     compounding: true|false|null,   // which of the assembler's two readings applies
//     sentence,                       // the assembler's own prose for that reading — never ours
//     chart: <series>,                // level over time, one marker per fight (chart.labels)
//     steps: [{ direction: 'up'|'down'|'flat' }],  // per fight, chronological, same order as chart.labels
//   }
//   data.retention[i].level_before / .level_after / .step_text  // optional, additive
//
// Until data.compounding lands this whole lead is skipped and the section falls back to
// exactly the per-fight afterglow view it had before — never a claim this renderer invented.
function stepTone(direction) {
    return direction === 'up' ? 'good' : direction === 'down' ? 'bad' : 'neutral';
}
// One line, coloured green where the level holds higher after a fight and red where it falls
// back — the segment between two fight markers takes its colour from the step INTO the next
// marker, so the staircase (or the flat line with spikes on it) is unmistakable at a glance.
// Handles both series generations: the new axis shape draws a real, labelled axis around the
// same coloured-segment idiom; the old pixel shape (still what a publication generated before
// the payload rewrite carries) keeps its previous axis-less rendering.
// The measured curve. `series.daily` is the real day-by-day attention, so THAT is the line:
// a spike at each fight, a fall back, and wherever the floor ends up. The settled level of each
// fight (the median 30 to 90 days after) is only a reference laid over it: a flat bar across the
// window it was measured in, green where it sits above the level the fighter started that cycle
// from, red where it fell back. Nothing joins one fight's level to the next, because nothing
// was measured that way. A day the payload does not carry was never tracked, so the line breaks
// there rather than bridging it.
function compoundingDailyChart(series, steps) {
    const days = [...series.daily.points].sort((a, b) => xv(a.x) - xv(b.x));
    // Log scale: three fight spikes reach 69k while the thing this chart is ABOUT, the level
    // the audience settles back to, lives between 800 and 2,100. On a linear axis that is the
    // bottom twentieth of the plot and the settled levels are unreadable.
    const f = buildAxisFrame({ ...series, points: days }, { logY: true });
    const gaps = days.slice(1).map((p, i) => xv(p.x) - xv(days[i].x)).sort((a, b) => a - b);
    const typical = gaps.length ? gaps[Math.floor(gaps.length / 2)] : 0;
    const runs = [];
    let run = [];
    days.forEach((p, i) => {
        if (i > 0 && xv(p.x) - xv(days[i - 1].x) > typical * 2) { runs.push(run); run = []; }
        run.push(p);
    });
    runs.push(run);
    const line = runs.map((r) => (r.length > 1
        ? `<polyline class="pub-series pub-series--main pub-series--daily pub-tone-line-neutral" points="${f.toPoly(r)}"/>`
        : `<circle class="pub-point-dot" cx="${f.xScale(r[0].x).toFixed(1)}" cy="${f.yScale(r[0].y).toFixed(1)}" r="1.2"/>`)).join('');
    const stepByDate = new Map(steps.map((s) => [s.fight_date, s]));
    // A band from the settled level down to the floor of the plot, with the level itself as a
    // thick rule on top of it. Drawn BEFORE the daily line and behind it, so making the levels
    // readable never costs a spike: the line is the measurement, the band is the reading.
    const levels = (series.levels ?? []).map((l) => {
        const dir = stepByDate.get(l.fight_date)?.direction;
        const tone = TONE_LINE[stepTone(dir)];
        const y = f.yScale(l.y), x0 = f.xScale(l.x0), x1 = f.xScale(l.x1);
        return `<rect class="pub-level-band pub-tone-fill-${tone}" x="${x0.toFixed(1)}" y="${y.toFixed(1)}" width="${Math.max(x1 - x0, 1).toFixed(1)}" height="${Math.max(f.plotY1 - y, 0).toFixed(1)}"/>`
            + `<line class="pub-series pub-series--level pub-tone-line-${tone}"${l.partial ? ' stroke-dasharray="7 5"' : ''} x1="${x0.toFixed(1)}" x2="${x1.toFixed(1)}" y1="${y.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
    }).join('');
    const hasPartial = (series.levels ?? []).some((l) => l.partial);
    const key = (cls, dash, text) => `<span class="pub-key-item"><span class="pub-key-rule pub-key-rule--${cls}${dash ? ' pub-key-rule--dashed' : ''}"></span>${esc(text)}</span>`;
    const legend = `<p class="pub-key">
        ${key('neutral', false, 'Views per day, measured')}
        ${key('good', false, 'Settled higher than before that fight')}
        ${key('bad', false, 'Settled lower than before that fight')}
    </p>`;
    const marks = series.markers ?? [];
    const markerLines = marks.map((m) => `<line class="pub-mark-line" x1="${f.xScale(m.x).toFixed(1)}" x2="${f.xScale(m.x).toFixed(1)}" y1="${f.plotY0}" y2="${f.plotY1.toFixed(1)}"/>`).join('');
    const markerLabels = marks.map((m, i) => {
        const x = f.xScale(m.x);
        const anchor = x < f.plotX0 + 30 ? 'start' : x > f.plotX1 - 30 ? 'end' : 'middle';
        const y = f.plotY0 - 5 - (marks.length > 1 && i % 2 === 1 ? 11 : 0);
        return `<text class="pub-mark-label pub-mark-label--top" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${esc(m.label)}</text>`;
    }).join('');
    return `<figure class="pub-panel">
        <svg class="pub-panel-svg" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="Views per day over time, with a spike at each fight and a fall back after it. A bar marks the level each fight settled at, green where it sits above where that cycle started and red where it fell back">
            <g class="pub-grid">${f.gridY}</g>
            ${f.axisLines}
            ${levels}${line}
            <g class="pub-marks">${markerLines}${markerLabels}</g>
            <g class="pub-axis-labels">${f.yLabels}${f.xLabels}</g>
        </svg>
        ${legend}
        <p class="pub-panel-unit">${esc(series.y?.label ?? 'Everyday audience')}, log scale. Each band starts 30 days after the fight.</p>
    </figure>`;
}
function compoundingChart(comp) {
    const series = comp?.chart;
    const steps = comp?.steps ?? [];
    if (!series) return '';
    if (isAxisSeries(series) && series.daily?.points?.length > 1) return compoundingDailyChart(series, steps);
    if (isAxisSeries(series)) {
        const marks = series.markers ?? [];
        if (!marks.length) return axisChart(series, { tone: 'accent' });
        const f = buildAxisFrame(series);
        // A STEP line, not a ramp: each fight's point is the level the audience SETTLED at,
        // measured outside that fight's own promotional window. Nothing was measured between
        // the fights, so the line stays flat at the previous level until the fight and steps
        // there. Joining the points diagonally read as a gradual climb and as if the spikes had
        // been dropped. Each riser takes its fight's own direction colour (steps[i-1] belongs to
        // pts[i]; pts[0] is the starting level).
        const lines = f.pts.slice(1).map((p, i) => {
            const q = f.pts[i];
            const dir = steps[i]?.direction ?? (p.y > q.y ? 'up' : p.y < q.y ? 'down' : null);
            const d = `M${f.xScale(q.x).toFixed(1)},${f.yScale(q.y).toFixed(1)}H${f.xScale(p.x).toFixed(1)}V${f.yScale(p.y).toFixed(1)}`;
            return `<path class="pub-series pub-series--main pub-tone-line-${TONE_LINE[stepTone(dir)]}" d="${d}"/>`;
        }).join('');
        const dots = f.pts.map((p) => `<circle class="pub-mark-dot" cx="${f.xScale(p.x).toFixed(1)}" cy="${f.yScale(p.y).toFixed(1)}" r="2.5"/>`).join('');
        const markerLines = marks.map((m) => `<line class="pub-mark-line" x1="${f.xScale(m.x).toFixed(1)}" x2="${f.xScale(m.x).toFixed(1)}" y1="${f.plotY0}" y2="${f.plotY1.toFixed(1)}"/>`).join('');
        const markerLabels = marks.map((m, i) => {
            const x = f.xScale(m.x);
            const anchor = x < f.plotX0 + 30 ? 'start' : x > f.plotX1 - 30 ? 'end' : 'middle';
            const y = f.plotY0 - 5 - (marks.length > 1 && i % 2 === 1 ? 11 : 0);
            return `<text class="pub-mark-label pub-mark-label--top" x="${x.toFixed(1)}" y="${y.toFixed(1)}" text-anchor="${anchor}">${esc(m.label)}</text>`;
        }).join('');
        return `<figure class="pub-panel">
            <svg class="pub-panel-svg" viewBox="0 0 ${f.W} ${f.H}" role="img" aria-label="Audience level over time, one marker per fight, green where the level holds higher afterward and red where it falls back">
                <g class="pub-grid">${f.gridY}</g>
                ${f.axisLines}
                ${lines}${dots}
                <g class="pub-marks">${markerLines}${markerLabels}</g>
                <g class="pub-axis-labels">${f.yLabels}${f.xLabels}</g>
            </svg>
            <p class="pub-panel-unit">${esc(series.y?.label ?? 'Audience level (relative)')}. Each step is the level it settled at after that fight. A step up holds, a step down falls back.</p>
        </figure>`;
    }
    if (!Array.isArray(series.labels) || !series.labels.length) return '';
    const W = series.width, H = series.height, padTop = 16, padBottom = 34;
    const pts = parsePts(series.points);
    const marks = series.labels;
    const bounds = [pts[0][0], ...marks.map((m) => m.x), pts[pts.length - 1][0]];
    const segs = [];
    for (let i = 0; i < bounds.length - 1; i++) {
        const x0 = bounds[i], x1 = bounds[i + 1];
        const segPts = pts.filter((p) => p[0] >= x0 - 0.01 && p[0] <= x1 + 0.01);
        segs.push({ pts: segPts, dir: steps[i]?.direction });
    }
    const grid = [0.25, 0.5, 0.75].map((f) => `<line class="pub-grid-line" x1="0" x2="${W}" y1="${(H * f).toFixed(1)}" y2="${(H * f).toFixed(1)}"/>`).join('');
    const lines = segs.filter((s) => s.pts.length > 1)
        .map((s) => `<polyline class="pub-series pub-series--main pub-tone-line-${TONE_LINE[stepTone(s.dir)]}" points="${s.pts.map((p) => p.join(',')).join(' ')}"/>`).join('');
    const marksHtml = marks.map((l, i) => {
        const y = nearestY(series.points, l.x);
        const ly = H + 15 + (marks.length > 1 && i % 2 === 1 ? 11 : 0);
        const anchor = l.x < W * 0.08 ? 'start' : l.x > W * 0.92 ? 'end' : 'middle';
        return `<g class="pub-mark"><line class="pub-mark-line" x1="${l.x}" x2="${l.x}" y1="0" y2="${H}"/><circle class="pub-mark-dot" cx="${l.x}" cy="${y.toFixed(1)}" r="3.5"/><text class="pub-mark-label" x="${l.x}" y="${ly}" text-anchor="${anchor}">${esc(l.text)}</text></g>`;
    }).join('');
    return `<figure class="pub-panel">
        <svg class="pub-panel-svg" viewBox="0 -${padTop} ${W} ${H + padTop + padBottom}" role="img" aria-label="Audience level over time, one marker per fight, green where the level holds higher afterward and red where it falls back">
            <g class="pub-grid">${grid}</g>
            ${lines}
            <g class="pub-marks">${marksHtml}</g>
        </svg>
        <p class="pub-panel-unit">Audience level (relative). A step up holds, a spike falls back.</p>
    </figure>`;
}
function compoundingBlock(comp, hasStory = false) {
    if (!comp) return '';
    const rows = statRow([
        [comp.first_level_text ?? null, 'Level at the first fight tracked'],
        [comp.latest_level_text ?? null, 'Level now'],
        [comp.mean_step_text ?? null, 'Average step per fight'],
    ]);
    const verdictTone = comp.compounding === true ? ' pub-tone-text-good' : comp.compounding === false ? ' pub-tone-text-bad' : '';
    const verdict = comp.sentence && !hasStory ? `<p class="pub-note pub-note--lead${verdictTone}">${esc(comp.sentence)}</p>` : '';
    const chart = compoundingChart(comp);
    const meta = [comp.span_text, comp.n != null ? `${comp.n} fights` : null].filter(Boolean).join(' · ');
    return `${verdict}${rows}${chart}${meta ? `<p class="pub-fine pub-fine--dim">${esc(meta)}</p>` : ''}`;
}

// v3: every level gets a noun instead of a bare figure — "862 level before / 2,984 level ~30
// days after / 1,634 baseline / 56,296 peak" was four numbers with nothing said about what was
// being compared. The payload doesn't carry these labels as fields yet (see the build report),
// so the exact wording the owner's review itself specifies is used here rather than inventing
// different words for the same thing. The missing-search paragraph is gone outright — the v3
// review's own instruction ("say nothing instead") — a fight too old for a search reading
// simply shows the Wikipedia figures with no explanatory aside.
function retentionBlock(items, comp, hasStory = false) {
    const compHtml = compoundingBlock(comp, hasStory);
    if (!items.length && !compHtml) return '';
    const cards = items.map((r) => `
                <p class="pub-line"><strong>vs ${esc(r.opponent)}</strong> · ${fmtDate(r.fight_date)}</p>
                ${storyHtml(storyParas(r))}
                ${statRow([
                    // Rounded and grouped like every other count on the page: a raw
                    // "2433.5" beside a formatted "56,296" reads as two different kinds
                    // of number, and half a page view is not a thing.
                    // Three rows of two, in reading order: where the audience was and where it
                    // ended up, then what the fight week itself did, then the two summary
                    // figures. The pairs are the comparisons, so they sit side by side.
                    [r.level_before != null ? num(Math.round(r.level_before)) : null, 'Everyday audience before the fight'],
                    [r.level_after != null ? num(Math.round(r.level_after)) : null, 'Everyday audience a month later'],
                    [r.baseline != null ? num(r.baseline) : null, 'Typical day, this fight week'],
                    [r.peak != null ? num(r.peak) : null, 'Peak on the biggest day'],
                    // The multiple of the two figures printed above, not the payload's
                    // sentence: a stat tile wants "2.5×", and computing it from the same
                    // rounded numbers keeps it dividing correctly for anyone who checks.
                    [levelMultiple(r) ?? r.step_text ?? null, 'Change in everyday audience'],
                    [r.wiki_afterglow != null ? pct(r.wiki_afterglow) : null, 'Attention kept, 30 days out'],
                    [r.search_afterglow != null ? pct(r.search_afterglow) : null, 'Search attention kept, 30 days out'],
                    [r.growth_velocity != null ? `×${num(r.growth_velocity, 2)}` : null, 'Follower growth velocity'],
                ], { cols: 2 })}
                ${chart(r.curve, { unit: 'Wikipedia views per day', bouts: [{ opponent: r.opponent, date: r.fight_date }], tone: 'accent' })}`);
    // A horizontal carousel, same shape and same fix as the media kit's fight week (see
    // carousel()) — this used to be one vertical, divider-separated block per fight.
    const perFight = items.length ? `${compHtml ? '<h3 class="pub-h3">Fight by fight</h3>' : ''}${carousel('pub-retention-carousel', cards, 'Fight-by-fight retention, one card per fight')}` : '';
    return `${compHtml}${perFight}`;
}

// Shared with the media kit, which now gets these too (a sponsor-relevant signal: this
// fighter draws attention outside fight weeks). `off_cycle` may still arrive as the bare array
// it always has been, or as {rows, note} once the assembler has a sentence to attach to it —
// read both shapes rather than assume the newer one has landed.
const offCycleRows = (oc) => (Array.isArray(oc) ? oc : (oc?.rows ?? []));
const offCycleNote = (oc) => (Array.isArray(oc) ? null : (oc?.note ?? null));
function offCycleTable(rows) {
    if (!rows.length) return '';
    // days_from_bout is signed around the bout (negative = the spike came first), which is
    // unreadable as a bare "-74". Say which side of the fight it fell on instead.
    const whenVsBout = (d) => (d == null ? '–' : d === 0 ? 'fight day' : `${Math.abs(d)} days ${d < 0 ? 'before' : 'after'}`);
    return table(['Week', 'Lift', 'Baseline', 'Nearest bout', ''], rows.map((o) => [
        esc(fmtDate(o.week_start)),
        `×${o.ratio.toFixed(2)}`,
        o.baseline != null ? num(o.baseline) : '–',
        o.nearest_bout_date ? esc(fmtDate(o.nearest_bout_date)) : '–',
        whenVsBout(o.days_from_bout),
    ]));
}

// "Regular season" is a raw event-tier label reading as a league fixture, not a fight
// promotion's own term for it — the v3 review's own fix, applied here as a stopgap until the
// assembler's own label filter carries it (every OTHER enum already arrives display-ready per
// the contract; this is the one that slipped through).
const TIER_RELABEL = { 'Regular season': 'Regular bout' };
const relabelTier = (t) => TIER_RELABEL[t] ?? t;

// v3: actual/expected/signal as three separate columns were "meaningless as named". One
// column now carries the card-position score with its delta from what the matchup predicted
// beside it, in the same cell — condensed, not three numbers a reader has to do the subtraction
// on themselves. Newest fight first (the payload's own row order); the chart underneath still
// always runs oldest-to-newest left-to-right, independent of how the table is sorted.
function billingBlock(b) {
    if (!b) return '';
    // Four columns, one line per row: the card section and the card tier used to be two columns
    // saying nearly the same thing ("Main event" on every row beside "Regular card"). One
    // position column now, with the title-fight chip inline after the event name; the tier keeps its own
    // narrow column because it is what explains the score.
    const rows = table(['Date', 'Event', 'Slot', 'Card', { html: hintText('Score', CARD_SCORE_HINT, { sentence: true }) }], b.rows.map((r) => [
        `<span class="pub-nowrap">${esc(fmtDate(r.date).replace(/ 20(\d\d)$/, ' ’$1'))}</span>`,
        // The title chip rides inline after the event name (the one column that can wrap), so the
        // fixed-width columns stay narrow.
        `${esc(r.event)}${r.is_title ? ' <span class="pub-tag">Title fight</span>' : ''}`,
        `<span class="pub-nowrap">${esc(r.card_section)}</span>`,
        // The tier is what produces the score (a regular card and a championship card sit on
        // different scales), so it stays a visible column, never a hover.
        `<span class="pub-nowrap">${esc(relabelTier(r.event_tier))}</span>`,
        // v3 renamed actual/signal to card_position_score/delta, and sends both already
        // formatted; the older names still render for publications made before that.
        (() => {
            const score = r.card_position_score_text
                ?? (r.card_position_score ?? r.actual) != null ? (r.card_position_score_text ?? num(r.card_position_score ?? r.actual, 2)) : null;
            const d = r.delta ?? r.signal;
            const dText = r.delta_text ?? (d != null ? `${d > 0 ? '+' : d < 0 ? '−' : ''}${num(Math.abs(d), 2)}` : null);
            if (score == null) return '–';
            const tone = d == null ? 'neutral' : d > 0 ? 'good' : d < 0 ? 'bad' : 'neutral';
            return `<span class="pub-nowrap">${esc(score)}${dText ? ` <span class="pub-table-delta pub-tone-text-${tone}">(${esc(dText)})</span>` : ''}</span>`;
        })(),
    ]), { freeze: true, bodyClass: 'pub-table--card' });
    const series = b.chart;
    // Old pixel format carries no per-point date, only the two ends (x_start/x_end) — the one
    // fix possible without that is dropping the score that used to ride along inside the
    // x-axis label text ("27 Sep · 0.91"), which is the exact bug the v3 review calls out.
    const chartHtml = isAxisSeries(series) ? axisChart(series, { tone: 'accent' }) : (() => {
        if (!series) return '';
        const pts = parsePts(series.points);
        let labelled = series;
        if (pts.length === b.rows.length) {
            const chron = [...b.rows].reverse();
            labelled = { ...series, labels: chron.map((r, i) => ({ x: pts[i][0], y: pts[i][1], text: fmtDate(r.date) })) };
        }
        return chart(labelled, { unit: 'Card-position score', mainLabel: 'Actual', refLabel: 'Expected for this slot', tone: 'accent' });
    })();
    return `${rows}${chartHtml}`;
}

// v3: interpretation first. Every differentiator already carries a plain sentence written by
// the assembler ("posted a median of 11 times in the month after the fight") — that leads now,
// the raw fighter/better/worse figures follow as supporting detail, and the distribution gets
// an axis and a unit like every other chart on the page (see distributionChart).
function cohortBlock(c) {
    if (!c) return '';
    const t = c.target;
    // Every cohort figure arrives with its own printed form (`*_text`): a rate as "5.6%",
    // a count as "11 posts", a multiplier as "×2.4". The raw `value` beside it is for the
    // chart's geometry only. Formatting the raw number here instead is what once put
    // "0.06" in this block next to a sentence saying "5.6%" about the same quantity.
    const shown = (text, raw) => (text != null ? esc(text) : raw != null ? num(raw, 2) : '–');
    // The second figure's label is the payload's own words for who was compared, with the
    // explainer on hover; the pre-v5 payloads fall back to naming the sample plainly rather
    // than to "Peer median (similar, n=122)", which was the statistics-speak the review hit.
    const basisLabel = t.basis_label ?? (t.n != null ? `${num(t.n)} fighters compared` : 'Fighters compared');
    const peerLabel = t.peer_label ?? basisLabel;
    // Side by side and joined by "vs", because these two are ONE comparison: stacked, and
    // with values as far apart as +182% and -3%, they read as two unrelated measurements.
    const target = `<div class="pub-versus">${statRow([
        [shown(t.fighter_value_text, t.fighter_value), t.label],
    ])}<span class="pub-versus-join" aria-hidden="true">vs</span>${statRow([
        [shown(t.peer_median_text, t.peer_median), { html: hintText(peerLabel, t.basis_explainer) }],
    ])}</div>${t.sentence ? `<p class="pub-note pub-note--lead">${esc(t.sentence)}</p>` : ''}${fineNote(t.note, t.note_style)}`;
    const diffs = c.differentiators.map((d) => `
            <div class="pub-diff">
                <p class="pub-note pub-note--lead">${esc(d.sentence)}</p>
                ${distributionChart(d.distribution, { xLabel: d.label })}
                ${statRow([
                    [shown(d.fighter_value_text, d.fighter_value), 'This fighter'],
                    [shown(d.better_median_text, d.better_median), `Kept more (n=${d.n_better})`],
                    [shown(d.worse_median_text, d.worse_median), `Kept less (n=${d.n_worse})`],
                ])}
            </div>`).join('');
    return `${target}${diffs}`;
}

// Every section draws nothing when its data is missing, so a fighter with no measured
// attention yet would get a name, a date and nothing else — which reads as a broken page.
// Say what is missing instead.
function emptyInternal(name) {
    return section('pub-empty', 'Nothing measured yet',
        `<p class="pub-line">We do not yet hold the readings this page is built from for ${esc(name)}: Wikipedia attention, search geography, card positions or a rating. Sections appear here as those readings come in.</p>`);
}

export function internalDataPage({ page, site }) {
    const d = page.data;
    const sections = `
${section('pub-fl', 'Overview', overviewBlock(d.first_light, d.field, !!storyParas(d.first_light, d.field)), null, storyParas(d.first_light, d.field))}
${(() => {
    const ladder = Array.isArray(d.funnel?.graphic?.stages);
    const story = storyParas(d.funnel);
    return section('pub-funnel', ladder ? 'Attention ladder' : 'Attention funnel', funnelBlock(d.funnel, !!story), ladder ? d.funnel.note : 'Width at each stage shows how much of this fighter’s audience is still there, compared with a typical fighter at the same level (dashed = typical). Narrower than the tube means they lose more people than usual at that step; wider means they keep more.', story);
})()}
${section('pub-geo', 'Audience geography', geographyBlock(d.geography), null, storyParas(d.geography))}
${(() => {
    // retention arrives either as a bare array or as {note, rows, compounding}; compounding
    // may also sit at the top level. Read both, so the section does not silently lose its
    // lead just because the assembler grouped a section's parts together.
    const rows = Array.isArray(d.retention) ? d.retention : (d.retention?.rows ?? []);
    const comp = d.compounding ?? d.retention?.compounding ?? null;
    const note = (!Array.isArray(d.retention) && d.retention?.note) || (comp
        ? 'Each fight either lifts the baseline permanently (a step up the audience keeps) or attention fades back to where it started. The pattern across fights is what decides whether this audience compounds.'
        : 'Afterglow: how much of the search and Wikipedia attention a fight brought is still there 30 days later, against this fighter’s own pre-fight baseline.');
    const story = storyParas(d.retention, comp);
    return section('pub-retention', 'Fight-week retention', retentionBlock(rows, comp, !!story), note, story);
})()}
${section('pub-off', 'Between fights', offCycleTable(offCycleRows(d.off_cycle)), offCycleNote(d.off_cycle) ?? 'Weeks where attention spiked with no fight nearby (a sponsor push, a media hit, a story) shown against how far that week sat from the nearest bout.', storyParas(d.off_cycle))}
${section('pub-billing', 'Card position', billingBlock(d.billing), d.billing ? 'The card-position score is how high this fighter is billed relative to what their level alone predicts for that matchup: above zero means billed higher than expected, below means lower. A promotion’s own championship weighting (PFL, for one) can push the score above 1.0.' : null, storyParas(d.billing))}
${section('pub-cohort', 'Compared with fighters at the same level', cohortBlock(d.cohort), null, storyParas(d.cohort))}
`;

    const body = `<main class="pub">
    <header class="pub-head">
        <div class="pub-inner">
            ${nameLines(page.fighter_name)}
            <p class="pub-asof">Data measured on ${fmtDate(page.measured_on)}.</p>
        </div>
    </header>
${sections.trim() ? sections : emptyInternal(page.fighter_name)}
</main>
${PUB_FOOTER}`;

    return shell({
        title: `${page.fighter_name} · Internal data · FIRST LIGHT`,
        description: `Internal measurement for ${page.fighter_name}'s management team, measured ${page.measured_on}.`,
        url: '', site, current: null, body,
        css: ['/publication.css'], noindex: true, og: true, nav: false, js: ['/pub-fit.js', '/pub-carousel.js'],
    });
}
