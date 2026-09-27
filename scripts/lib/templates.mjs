// HTML for every generated route. Four templates, on purpose:
//   • archive/article/index  — the standard reading shell (pages.css)
//   • manifesto              — standalone full-bleed page (manifesto.css)
//   • private                — the standard shell, minus everything that could leak the URL
//   • publication kit        — no shell at all: no nav, no logo, no site footer (publication.css)

import { esc, safeUrl, isExternal, fmtDate, renderMarkdown, slugify } from './util.mjs';

const YEAR = 2026;

const NAV = (current) => `<nav class="nav" id="mainNav" aria-label="Site">
    <div class="nav-menu">
        <a href="/" class="nav-logo"><img src="/logo.svg" alt="FIRST LIGHT" class="nav-logo-img"></a>
        <div class="nav-drop" id="navDrop">
            <ul>
                <li><a href="/publications/"${current === 'publications' ? ' aria-current="page"' : ''}>Publications</a></li>
                <li><a href="/index/"${current === 'index' ? ' aria-current="page"' : ''}>Index</a></li>
            </ul>
        </div>
    </div>
</nav>`;

const FOOTER = `<footer>
    <a href="/" class="foot-logo"><img src="/logo.svg" alt="FIRST LIGHT" class="foot-logo-img"></a>
    <nav class="foot-links">
        <a href="mailto:contact@firstlight.agency" class="foot-link">contact@firstlight.agency</a>
        <a href="/privacy.html" class="foot-link foot-link-legal">Privacy</a>
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
function shell({ title, description, url, site, current, body, css = ['/pages.css'], bodyClass = '', noindex = false, og = true, nav = true, scripts = true, js = null }) {
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
    }
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
                    <a class="entry entry--pinned" href="/publications/manifesto/" data-r>
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
${renderMarkdown(article.body)}
            </div>
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

// ── /publications/manifesto/ ── standalone, full-bleed, inverted.
export function manifestoPage({ site }) {
    const body = `<main class="mf">
    <section class="mf-band mf-band--paper" aria-labelledby="mf-title">
        <h1 class="mf-word" id="mf-title"><span class="mf-clip"><span class="mf-slide">Manifesto</span></span></h1>
        <p class="mf-note">The FIRST LIGHT manifesto is being written.</p>
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
        url: '/publications/manifesto/', site, current: 'publications', body,
        css: ['/manifesto.css'], bodyClass: 'page-manifesto', scripts: false,
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
                <p class="key-text"><strong>First Light Rating.</strong> A skill score built from a fighter's fight results, and the number these rankings are sorted by. It is deliberately conservative: the less we know about a fighter, the lower they are rated until the results are in.</p>
            </div>
            <div class="key-item" data-r>
                <h2 class="key-name">FLI</h2>
                <p class="key-text"><strong>First Light Index.</strong> It compares a fighter's fame with what their FLR rating would predict, on a scale from −1 to +1. Above zero, their audience is bigger than their skill explains: they know how to be a star. Below zero, they are better than their audience knows. The arrow shows how the FLI has moved over about the last 30 days; hover it to see the trend.</p>
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
                        <span class="wl-change wl-change--${kind}"><span class="wl-glyph" aria-hidden="true">${e.change < 0 ? '▼' : '▲'}</span> ${signed(e.change)}%</span>
                    </li>`;
    }).join('');
    return `
        <section class="wl-col wl-col--${kind}" aria-labelledby="wl-${kind}">
            <h2 class="pg-h2" id="wl-${kind}" data-r>${heading}</h2>
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
    <div class="pub-inner"><p class="pub-foot-line">Data measured by the First Light Observatory · <a href="mailto:contact@firstlight.agency">contact@firstlight.agency</a></p></div>
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

// A histogram for cohort.differentiators[].distribution, on the same Observatory ground: peer
// bars quiet, this fighter's own position the one bright mark, exactly the funnel's convention.
function distributionChart(dist) {
    const { values, marker, width, height, bins } = dist;
    const heights = bins.map((b) => (typeof b === 'number' ? b : (b?.count ?? b?.height ?? 0)));
    const n = heights.length || 1;
    const gap = 2;
    const barW = Math.max(1, (width - gap * (n - 1)) / n);
    const maxBin = Math.max(...heights, 1);
    const bars = heights.map((h, i) => {
        const bh = (h / maxBin) * height;
        const x = i * (barW + gap);
        return `<rect class="pub-dist-bar" x="${x.toFixed(1)}" y="${(height - bh).toFixed(1)}" width="${barW.toFixed(1)}" height="${bh.toFixed(1)}"/>`;
    }).join('');
    let markerMark = '';
    if (marker != null && values?.length) {
        const lo = Math.min(...values), hi = Math.max(...values);
        const mx = hi > lo ? ((marker - lo) / (hi - lo)) * width : width / 2;
        markerMark = `<line class="pub-dist-marker" x1="${mx.toFixed(1)}" x2="${mx.toFixed(1)}" y1="0" y2="${height}"/><circle class="pub-dist-marker-dot" cx="${mx.toFixed(1)}" cy="0" r="3.5"/>`;
    }
    return `<figure class="pub-panel pub-panel--dist">
        <svg class="pub-panel-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="Distribution across similar fighters, with this fighter's own value marked">${bars}${markerMark}</svg>
        <div class="pub-legend"><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--main"></i>This fighter</span><span class="pub-legend-item"><i class="pub-legend-swatch pub-legend-swatch--ref"></i>Similar fighters</span></div>
    </figure>`;
}

// A horizontal bar panel for relative indices (Markets' two measures): one hue, top item = 100.
function barsChart(items, opts = {}) {
    if (!items?.length) return '';
    const { unit } = opts;
    const W = 300, rowH = 22, gapY = 8, labelW = 100;
    const H = items.length * (rowH + gapY) - gapY;
    const maxV = Math.max(...items.map((i) => i.value), 1);
    const barsW = W - labelW - 34;
    const rows = items.map((it, i) => {
        const y = i * (rowH + gapY);
        const w = Math.max(2, (it.value / maxV) * barsW);
        return `<text class="pub-bar-label" x="0" y="${(y + rowH / 2 + 4).toFixed(1)}">${esc(it.label)}</text><rect class="pub-bar" x="${labelW}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${rowH - 5}" rx="2"/><text class="pub-bar-value" x="${(labelW + w + 7).toFixed(1)}" y="${(y + rowH / 2 + 4).toFixed(1)}">${Math.round(it.value)}</text>`;
    }).join('');
    return `<figure class="pub-panel pub-panel--bars">
        <svg class="pub-panel-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(unit || 'index by market')}">${rows}</svg>
        ${unit ? `<p class="pub-panel-unit">${esc(unit)}</p>` : ''}
    </figure>`;
}

// The attention funnel, drawn as a funnel: one continuous silhouette, band width at each stage
// = the retention index the assembler already computed (typical similar fighter = 100, the
// dashed tube), the same idiom the Observatory's own panel uses. Colour is tone() again — wider
// than typical reads green, narrower reads red, both shaded by how far from 100 they sit.
function funnelGraphic(fn) {
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
function stat(value, label) {
    if (value == null) return '';
    const lbl = label && typeof label === 'object' ? label.html : esc(label);
    return `<div class="pub-stat"><span class="pub-stat-n">${esc(value)}</span><span class="pub-stat-label">${lbl}</span></div>`;
}
function statRow(items) {
    const parts = items.filter(([v]) => v != null).map(([v, l]) => stat(v, l));
    return parts.length ? `<div class="pub-stat-row">${parts.join('')}</div>` : '';
}

// A plain table for internal-data's multi-column rows (geography, off-cycle, billing). Cells
// arrive pre-escaped/pre-formatted by the caller, the same convention privatePage's rows() uses.
// Wrapped so a table wider than the phone it's read on visibly continues past the edge, rather
// than looking like the row simply ends (see .pub-table-wrap in publication.css).
function table(headers, rows) {
    if (!rows.length) return '';
    return `<div class="pub-table-wrap"><table class="pub-table">
                <thead><tr>${headers.map((h) => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead>
                <tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${c}</td>`).join('')}</tr>`).join('')}</tbody>
            </table></div>`;
}

// A section always shows its explanation before its numbers. `note` is the payload's own
// per-fighter sentence where the contract defines one (still landing — see the build report);
// until then a fixed, evergreen line explains the section itself, exactly the pattern this file
// already uses for engagement_basis: the page's own words, never invented data.
function section(id, heading, inner, note) {
    if (!inner) return '';
    return `
    <section class="pub-section" aria-labelledby="${id}">
        <div class="pub-inner">
            <h2 class="pub-h2" id="${id}">${esc(heading)}</h2>
            ${note ? `<p class="pub-note pub-note--lead">${esc(note)}</p>` : ''}
            ${inner}
        </div>
    </section>`;
}

// FLI/FLR: named, defined on hover, and linked to the rankings key — reusing the exact one-line
// descriptions HINT_FLR/HINT_FLI already put on /index/, not a second, drifting copy of them.
const KEY_HREF = '/index/#key';
const hintLink = (label, name, desc) =>
    `<a class="hint pub-hint" href="${KEY_HREF}">${label}<span class="hint-tip"><strong>${esc(name)}</strong><span class="hint-desc">${esc(desc)}</span></span></a>`;
const fliHint = () => hintLink('FLI', 'First Light Index', 'fame compared to skill');
const flrHint = () => hintLink('FLR', 'First Light Rating', 'measure of true skill');

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

function socialBlock(s) {
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
    // The caveat, not the headline: engagement_basis is a real sentence ("the median over the
    // last 12 of 12 posts"), not a 30-day window, and now reads that way — small print under
    // everything else, not the second line of the block.
    return `
            <div class="pub-platform">
                <h3 class="pub-h3">${esc(s.platform)}</h3>
                ${rows}${mix}
                <p class="pub-fine pub-fine--tiny">Engagement is ${esc(s.engagement_basis)} — not a 30-day window. Measured ${fmtDate(s.measured_on)}.</p>
            </div>`;
}

// A GitHub-contribution-style grid, one cell per day, symbol = media type, colour = that post's
// engagement relative to this fighter's own — replacing a flat "top posts" list. Reads the
// payload's own per-day field (`data.posting_calendar`, contract v2) once it lands; until then,
// falls back to the days we can already place from `top_posts` alone, labelled honestly as the
// posts on file so a sparse grid reads as a thin sample, never as "this fighter doesn't post".
const TYPE_SYMBOL = { Photo: 'P', Video: 'V', Carousel: 'C', Reel: 'R', Story: 'S', Text: 'T' };
function calendarCells(cells) {
    if (!cells.length) return '';
    const first = new Date(`${cells[0].date}T00:00:00Z`);
    const pad = first.getUTCDay();
    const padded = [...Array(pad).fill(null), ...cells];
    return padded.map((c) => {
        if (!c) return '<span class="pub-cal-cell pub-cal-cell--pad" aria-hidden="true"></span>';
        if (!c.type) return `<span class="pub-cal-cell" title="${esc(fmtDate(c.date))}: no post on file"></span>`;
        const sym = TYPE_SYMBOL[c.type] ?? c.type.slice(0, 1).toUpperCase();
        const rel = c.rel != null ? Math.max(0.18, Math.min(1, c.rel)) : 0.55;
        return `<span class="pub-cal-cell pub-cal-cell--post" style="--rel:${rel.toFixed(2)}" title="${esc(fmtDate(c.date))} · ${esc(c.type)}">${esc(sym)}</span>`;
    }).join('');
}
function calendarLegend(types) {
    const items = types.map((t) => `<span class="pub-cal-legend-item"><i class="pub-cal-sym">${esc(TYPE_SYMBOL[t] ?? t.slice(0, 1).toUpperCase())}</i>${esc(t)}</span>`).join('');
    return `<div class="pub-cal-legend">${items}<span class="pub-cal-legend-item pub-cal-legend-item--scale"><i class="pub-cal-scale"></i>Less <span class="pub-cal-scale-arrow">→</span> more engagement</span></div>`;
}
function postingCalendarBlock(d) {
    const cal = d.posting_calendar; // future field: {window_days, cells, media_types, best, typical}
    if (cal?.cells?.length) {
        const grid = calendarCells(cal.cells);
        const types = cal.media_types ?? [...new Set(cal.cells.map((c) => c.type).filter(Boolean))];
        return `<div class="pub-cal-wrap"><div class="pub-cal">${grid}</div></div>${calendarLegend(types)}
            <p class="pub-fine pub-fine--dim">Posts on file over the last ${cal.window_days} days.</p>
            ${statRow([[cal.best?.text ?? null, 'Best post'], [cal.typical?.text ?? null, 'Typical post']])}`;
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
            ${panel(series, { unit: 'Wikipedia pageviews per day', yRefs: refs, bouts, tone: 'accent' })}
            ${langs}
            <p class="pub-fine pub-fine--dim">Source: Wikipedia pageviews, all languages, ${w.window_days}-day average.</p>`;
}

// Bars when the payload gives relative indices per market (`data.market_concentration.countries`,
// mirroring internal_data.geography's own field names — not yet in the contract for the media
// kit, so this is a defensive read: it renders once that field lands, and falls back to today's
// ordered list until then). Order only, no dollar figures, exactly as the contract requires.
function marketsBlock(mc) {
    if (!mc) return '';
    if (Array.isArray(mc.countries) && mc.countries.length) {
        const search = mc.countries.filter((c) => c.search_volume_index != null).map((c) => ({ label: c.country, value: c.search_volume_index }));
        const market = mc.countries.filter((c) => c.market_value_index != null).map((c) => ({ label: c.country, value: c.market_value_index }));
        return `
            <h3 class="pub-h3">Search interest</h3>
            <p class="pub-fine">How much people search for this fighter, by country — relative only; the top market is 100.</p>
            ${barsChart(search, { unit: 'Search-volume index (top market = 100)' })}
            <h3 class="pub-h3">Market size</h3>
            <p class="pub-fine">Ad spend per internet user, by country — relative only; the top market is 100.</p>
            ${barsChart(market, { unit: 'Market-size index (top market = 100)' })}
            <p class="pub-fine pub-fine--dim">Basis: ${esc(mc.basis)}. Relative indices only — no dollar figures.</p>`;
    }
    return `<ol class="pub-order">${mc.countries_ranked.map((c) => `<li>${esc(c)}</li>`).join('')}</ol>
            <p class="pub-fine pub-fine--dim">Order of ${esc(mc.basis)}.</p>`;
}

function fightWeekBlock(fw, series) {
    if (!fw) return '';
    const refs = extremeRefs(series, {
        hi: `${num(fw.peak_views_per_day)}/day peak`,
        lo: `${num(fw.baseline)}/day baseline`,
    });
    return `<p class="pub-line"><strong>vs ${esc(fw.opponent)}</strong> · ${fmtDate(fw.fight_date)}</p>
            ${statRow([
                [`×${fw.lift_ratio.toFixed(1)}`, 'Peak vs. baseline'],
                [num(fw.peak_views_per_day), 'Peak pageviews / day'],
                [num(fw.baseline), 'Baseline pageviews / day'],
            ])}
            ${panel(series, { unit: 'Wikipedia pageviews per day', yRefs: refs, bouts: [{ opponent: fw.opponent, date: fw.fight_date }], tone: 'accent' })}`;
}

function broadcastList(rows) {
    if (!rows.length) return '';
    return `<ul class="pub-list">${rows.map((b) => `
                <li class="pub-list-row">
                    <div class="pub-list-main">
                        <span class="pub-list-title">${esc(b.event)}</span>
                        <time class="pub-list-date" datetime="${esc(b.date)}">${fmtDate(b.date)}</time>
                        <p class="pub-fine pub-fine--dim">${esc(b.promotion)} · ${esc(b.card_section)} · ${esc(b.event_tier)}</p>
                    </div>
                    <div class="pub-list-figures"><span class="pub-tone-text-${resultTone(b.result)}">${esc(b.result)}</span></div>
                </li>`).join('')}
            </ul>`;
}

// Where the manager and the brand cannot get a read anywhere else: not where a fighter is, but
// where they're headed. Every field here is payload-pending (contract v2, `data.trajectory`) —
// rendered defensively, so the section simply doesn't appear until it lands (see build report).
function trajectoryBlock(t) {
    if (!t) return '';
    const rows = statRow([
        [t.followers_growth_text ?? null, 'Follower growth'],
        [t.rank_movement_text ?? null, 'Rank movement'],
    ]);
    const shift = t.fame_shift?.sentence
        ? `<p class="pub-note pub-tone-text-${t.fame_shift.direction === 'down' ? 'bad' : 'good'}">${esc(t.fame_shift.sentence)}</p>` : '';
    return `${rows}${shift}${t.note ? `<p class="pub-note">${esc(t.note)}</p>` : ''}`;
}

export function mediaKitPage({ page, site }) {
    const d = page.data;
    const f = d.fighter;
    const headerMeta = [f.division, f.organization, f.gym, f.nationality].filter(Boolean).join(' · ');
    const bouts = [d.fight_week, d.next_fight].filter(Boolean).map((x) => ({ opponent: x.opponent, date: x.date ?? x.fight_date }));

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
                [streakText(f.streak), 'Streak'],
            ])}
        </div>
    </header>
${section('pub-next', 'Next fight', nextFightBlock(d.next_fight))}
${section('pub-social', 'Social', d.social.length ? `${d.social.map(socialBlock).join('')}${panel(d.charts.followers, { unit: 'Followers', yRefs: extremeRefs(d.charts.followers, { hi: d.social[0]?.followers != null ? `${num(d.social[0].followers)} today` : null }), tone: 'accent' })}` : '')}
${section('pub-posts', 'Posting activity', postingCalendarBlock(d), 'One cell per day the window covers; colour shows how that post did against this fighter’s own average, not against anyone else’s.')}
${section('pub-wiki', 'Attention', attentionBlock(d.wikipedia, d.charts.pageviews, bouts))}
${section('pub-geo', 'Markets', marketsBlock(d.market_concentration))}
${section('pub-fw', 'Fight week', fightWeekBlock(d.fight_week, d.charts.fight_week))}
${section('pub-off', 'Between fights', offCycleTable(offCycleRows(d.off_cycle)), offCycleNote(d.off_cycle) ?? (offCycleRows(d.off_cycle).length ? 'Weeks with a real jump in attention even though no fight was near — he draws attention outside fight weeks too.' : null))}
${(() => {
    // Bare array, or {rows, note} once the assembler carries its own explanation.
    const rows = Array.isArray(d.broadcast) ? d.broadcast : (d.broadcast?.rows ?? []);
    const note = (!Array.isArray(d.broadcast) && d.broadcast?.note)
        || (rows.length ? 'Recent results on file — not a complete record.' : null);
    return section('pub-broadcast', 'Recent broadcast history', broadcastList(rows), note);
})()}
${section('pub-trajectory', 'Trajectory', trajectoryBlock(d.trajectory))}
</main>
${PUB_FOOTER}`;

    return shell({
        title: `${f.name} — Media kit — FIRST LIGHT`,
        description: `Audience and performance measurement for ${f.name}, measured ${page.measured_on}.`,
        url: '', site, current: null, body,
        css: ['/publication.css'], noindex: true, og: true, nav: false, js: ['/pub-fit.js'],
    });
}

// ── internal data ──

function overviewBlock(fl) {
    if (!fl) return '';
    // Audience the fighter's level predicts, then what's actually measured, then the gap
    // between them — leading with the audience, not the rating (FLR is context, per the spec).
    const rows = statRow([
        [fl.expected != null ? num(fl.expected) : null, 'Audience its level predicts'],
        [fl.actual != null ? num(fl.actual) : null, 'Audience measured'],
        [fl.gap != null ? signed(fl.gap, 2) : null, 'Gap'],
        [fl.rating != null ? num(fl.rating) : null, { html: flrHint() }],
    ]);
    const fliBlock = fl.score != null ? `
        <div class="pub-fli-block">
            <p class="pub-fli-label">${fliHint()} <span class="pub-fli-n pub-tone-text-${fl.score < -0.04 ? 'bad' : fl.score > 0.04 ? 'good' : 'neutral'}">${signed(fl.score, 2)}</span></p>
            ${fliRangeBar(fl.score)}
        </div>` : '';
    return `${rows}${fliBlock}
        <p class="pub-note pub-note--lead">Audience is a calibrated followers-equivalent across the platforms we track — not a number you can reproduce by adding up follower counts.</p>
        ${fl.reading ? `<p class="pub-note">${esc(fl.reading)}</p>` : ''}`;
}

function funnelBlock(fn) {
    if (!fn) return '';
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
    const graphic = funnelGraphic(fn);
    return `${stages}${graphic}${fn.leak?.sentence ? `<p class="pub-note${fn.leak.named ? ' pub-tone-text-bad' : ''}">${esc(fn.leak.sentence)}</p>` : ''}`;
}

function geographyBlock(g) {
    if (!g) return '';
    const rows = table(['Country', 'Search index', 'Market value index'], g.countries.map((c) => [
        `${esc(c.country)}${c.estimated ? ' *' : ''}`,
        c.search_volume_index != null ? num(c.search_volume_index) : '—',
        c.market_value_index != null ? num(c.market_value_index) : '—',
    ]));
    const hasEstimate = g.countries.some((c) => c.estimated);
    const langs = (g.languages ?? []).length
        ? `<p class="pub-fine">${g.languages.map((l) => `${esc(l.market)} ${pct(l.share, 0)}`).join(' · ')}</p>` : '';
    return `${rows}${hasEstimate ? '<p class="pub-fine pub-fine--dim">* modelled estimate.</p>' : ''}${langs}`;
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
function compoundingChart(comp) {
    const series = comp?.chart;
    if (!series || !Array.isArray(series.labels) || !series.labels.length) return '';
    const W = series.width, H = series.height, padTop = 16, padBottom = 34;
    const pts = parsePts(series.points);
    const marks = series.labels;
    const steps = comp.steps ?? [];
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
        <p class="pub-panel-unit">Audience level (relative) — a step up holds, a spike falls back</p>
    </figure>`;
}
function compoundingBlock(comp) {
    if (!comp) return '';
    const rows = statRow([
        [comp.first_level_text ?? null, 'Level at the first fight tracked'],
        [comp.latest_level_text ?? null, 'Level now'],
        [comp.mean_step_text ?? null, 'Average step per fight'],
    ]);
    const verdictTone = comp.compounding === true ? ' pub-tone-text-good' : comp.compounding === false ? ' pub-tone-text-bad' : '';
    const verdict = comp.sentence ? `<p class="pub-note pub-note--lead${verdictTone}">${esc(comp.sentence)}</p>` : '';
    const chart = compoundingChart(comp);
    const meta = [comp.span_text, comp.n != null ? `${comp.n} fights` : null].filter(Boolean).join(' · ');
    return `${verdict}${rows}${chart}${meta ? `<p class="pub-fine pub-fine--dim">${esc(meta)}</p>` : ''}`;
}

function retentionBlock(items, comp) {
    const compHtml = compoundingBlock(comp);
    if (!items.length && !compHtml) return '';
    const perFight = items.length ? `${compHtml ? '<h3 class="pub-h3">Fight by fight</h3>' : ''}${items.map((r) => {
        const missingSearch = r.search_afterglow == null && r.wiki_afterglow != null
            ? `<p class="pub-fine pub-fine--dim">No search reading: Google Trends only returns daily data for about three months, so a fight this old can never have one. Wikipedia has no such limit.</p>` : '';
        return `
            <div class="pub-bout">
                <p class="pub-line"><strong>vs ${esc(r.opponent)}</strong> · ${fmtDate(r.fight_date)}</p>
                ${statRow([
                    [r.level_before ?? null, 'Level before'],
                    [r.level_after ?? null, 'Level ~30 days after'],
                    [r.step_text ?? null, 'Step'],
                    [r.search_afterglow != null ? pct(r.search_afterglow) : null, 'Search attention kept, 30 days out'],
                    [r.wiki_afterglow != null ? pct(r.wiki_afterglow) : null, 'Wikipedia attention kept, 30 days out'],
                    [r.growth_velocity != null ? `×${num(r.growth_velocity, 2)}` : null, 'Follower growth velocity'],
                    [r.peak != null ? num(r.peak) : null, 'Peak'],
                    [r.baseline != null ? num(r.baseline) : null, 'Baseline'],
                ])}
                ${missingSearch}
                ${panel(r.curve, { unit: 'Attention, relative to baseline', bouts: [{ opponent: r.opponent, date: r.fight_date }], tone: 'accent' })}
            </div>`;
    }).join('')}` : '';
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
    const whenVsBout = (d) => (d == null ? '—' : d === 0 ? 'fight day' : `${Math.abs(d)} days ${d < 0 ? 'before' : 'after'}`);
    return table(['Week', 'Lift', 'Baseline', 'Nearest bout', ''], rows.map((o) => [
        esc(fmtDate(o.week_start)),
        `×${o.ratio.toFixed(2)}`,
        o.baseline != null ? num(o.baseline) : '—',
        o.nearest_bout_date ? esc(fmtDate(o.nearest_bout_date)) : '—',
        whenVsBout(o.days_from_bout),
    ]));
}

// Zips the chart's own pixel points against the table's own rows (oldest first, matching the
// rows sorted newest-first in reverse) when the two are the same length — which they always are,
// since the assembler draws one point per billed fight — so every tick is a real date and a real
// score already printed a few lines above, never a value read off the curve's geometry.
function billingBlock(b) {
    if (!b) return '';
    const rows = table(['Date', 'Event', 'Card section', 'Tier', 'Actual', 'Expected', 'Signal'], b.rows.map((r) => [
        esc(fmtDate(r.date)),
        esc(r.event),
        esc(r.card_section),
        esc(r.event_tier),
        r.actual != null ? num(r.actual, 2) : '—',
        r.expected != null ? num(r.expected, 2) : '—',
        // Signed, because the sign IS the reading: billed above the slot this matchup
        // predicted, or below it. Never a word — the assembler sends a number and the
        // page does not editorialise it into "outperformed".
        r.signal != null ? `${r.signal > 0 ? '+' : r.signal < 0 ? '−' : ''}${num(Math.abs(r.signal), 2)}` : '—',
    ]));
    const pts = b.chart ? parsePts(b.chart.points) : [];
    let chartSeries = b.chart;
    if (b.chart && pts.length === b.rows.length) {
        const chron = [...b.rows].reverse();
        chartSeries = { ...b.chart, labels: chron.map((r, i) => ({ x: pts[i][0], y: pts[i][1], text: `${fmtDate(r.date)} · ${r.actual != null ? num(r.actual, 2) : '—'}` })) };
    }
    return `${rows}
        ${panel(chartSeries, { unit: 'Card-slot score', mainLabel: 'Actual', refLabel: 'Expected for this slot', tone: 'accent' })}
        <p class="pub-fine pub-fine--dim">The score is usually between 0 and 1; a promotion's championship weighting (PFL, for one) can push it above 1.0.</p>`;
}

function cohortBlock(c) {
    if (!c) return '';
    const t = c.target;
    // Every cohort figure arrives with its own printed form (`*_text`): a rate as "5.6%",
    // a count as "11 posts", a multiplier as "×2.4". The raw `value` beside it is for the
    // chart's geometry only. Formatting the raw number here instead is what once put
    // "0.06" in this block next to a sentence saying "5.6%" about the same quantity.
    const shown = (text, raw) => (text != null ? esc(text) : raw != null ? num(raw, 2) : '—');
    const target = statRow([
        [shown(t.fighter_value_text, t.fighter_value), t.label],
        [shown(t.peer_median_text, t.peer_median), `Peer median (${t.basis}, n=${t.n})`],
    ]);
    const diffs = c.differentiators.map((d) => `
            <div class="pub-diff">
                <p class="pub-line"><strong>${esc(d.label)}</strong></p>
                ${statRow([
                    [shown(d.fighter_value_text, d.fighter_value), 'This fighter'],
                    [shown(d.better_median_text, d.better_median), `Kept more (n=${d.n_better})`],
                    [shown(d.worse_median_text, d.worse_median), `Kept less (n=${d.n_worse})`],
                ])}
                ${distributionChart(d.distribution)}
                <p class="pub-note">${esc(d.sentence)}</p>
            </div>`).join('');
    return `${target}${diffs}`;
}

export function internalDataPage({ page, site }) {
    const d = page.data;

    const body = `<main class="pub">
    <header class="pub-head">
        <div class="pub-inner">
            ${nameLines(page.fighter_name)}
            <p class="pub-asof">Data measured on ${fmtDate(page.measured_on)}.</p>
        </div>
    </header>
${section('pub-fl', 'Overview', overviewBlock(d.first_light))}
${section('pub-funnel', 'Attention funnel', funnelBlock(d.funnel), 'Width at each stage shows how much of this fighter’s audience is still there, compared with a typical fighter at the same level (dashed = typical). Narrower than the tube means they lose more people than usual at that step; wider means they keep more.')}
${section('pub-geo', 'Geography', geographyBlock(d.geography), 'Search-volume and market-size indices by country, each relative to its own top market (100). No dollar figures.')}
${(() => {
    // retention arrives either as a bare array or as {note, rows, compounding}; compounding
    // may also sit at the top level. Read both, so the section does not silently lose its
    // lead just because the assembler grouped a section's parts together.
    const rows = Array.isArray(d.retention) ? d.retention : (d.retention?.rows ?? []);
    const comp = d.compounding ?? d.retention?.compounding ?? null;
    const note = (!Array.isArray(d.retention) && d.retention?.note) || (comp
        ? 'Each fight either lifts the baseline permanently — a step up the audience keeps — or attention fades back to where it started. The pattern across fights is what decides whether this audience compounds.'
        : 'Afterglow: how much of the search and Wikipedia attention a fight brought is still there 30 days later, against this fighter’s own pre-fight baseline.');
    return section('pub-retention', 'Fight-week retention', retentionBlock(rows, comp), note);
})()}
${section('pub-off', 'Between fights', offCycleTable(offCycleRows(d.off_cycle)), offCycleNote(d.off_cycle) ?? 'Weeks where attention spiked with no fight nearby — a sponsor push, a media hit, a story — shown against how far that week sat from the nearest bout.')}
${section('pub-billing', 'Card position', billingBlock(d.billing))}
${section('pub-cohort', 'Compared to peers', cohortBlock(d.cohort))}
</main>
${PUB_FOOTER}`;

    return shell({
        title: `${page.fighter_name} — Internal data — FIRST LIGHT`,
        description: `Internal measurement for ${page.fighter_name}'s management team, measured ${page.measured_on}.`,
        url: '', site, current: null, body,
        css: ['/publication.css'], noindex: true, og: true, nav: false, js: ['/pub-fit.js'],
    });
}
