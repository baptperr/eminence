// HTML for every generated route. Three templates, on purpose:
//   • archive/article/index  — the standard reading shell (pages.css)
//   • manifesto              — standalone full-bleed page (manifesto.css)
//   • private                — the standard shell, minus everything that could leak the URL

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

// Every page goes through here. `private` pages get no canonical URL, no Open Graph tags
// (a link preview would leak the title into chat apps), noindex, and no referrer.
function shell({ title, description, url, site, current, body, css = ['/pages.css'], bodyClass = '', priv = false, scripts = true }) {
    const head = priv
        ? `<meta name="robots" content="noindex, nofollow, noarchive, nosnippet">
    <meta name="referrer" content="no-referrer">`
        : `<meta name="description" content="${esc(description)}">
    <link rel="canonical" href="${esc(site + url)}">
    <meta property="og:site_name" content="FIRST LIGHT">
    <meta property="og:type" content="website">
    <meta property="og:title" content="${esc(title)}">
    <meta property="og:description" content="${esc(description)}">
    <meta property="og:url" content="${esc(site + url)}">`;
    return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${esc(title)}</title>
    ${head}
    <link rel="icon" type="image/png" href="/favicon.png">
    <link rel="apple-touch-icon" href="/favicon.png">
    <link rel="preload" href="/fonts/dm-sans-var-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="preload" href="/fonts/red-hat-display-800-latin.woff2" as="font" type="font/woff2" crossorigin>
    <link rel="stylesheet" href="/style.css">
${css.map((c) => `    <link rel="stylesheet" href="${c}">`).join('\n')}
</head>
<body class="${bodyClass}">

${NAV(current)}

${body}
${scripts ? `
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
    <section class="key" aria-label="How to read the rankings">
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
        url: '', site, current: null, body, priv: true,
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
    return shell({ title: 'Not found — FIRST LIGHT', url: '', site, current: null, body, priv: true });
}
