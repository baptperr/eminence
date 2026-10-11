// The data pages: one per fighter, per division, per event, the indexes that list them, and the
// methodology. Everything here is generated from data/index.json (the Observatory's export, see
// observatory/site_pages.py for what it carries and what it never does). Charts are inline SVG,
// so they need no script; each point carries a native tooltip and the numbers behind every chart
// are also in a table on the same page.

import { esc, fmtDate, FIGURE_CREDIT, OBSERVATORY_URL } from './util.mjs';
import {
    BRAND, FOOTER, HINT_FLI, HINT_FLR, HOLDINGS_TEXT, INDEX_TOP, byDivision, divisionUrl, fliAttrs, fliCell,
    fmtMultiple, num, rankingTable, shell, signed, subtabs,
} from './templates.mjs';

const fighterHref = (slug) => `/fighters/${slug}/`;
const eventHref = (slug) => `/events/${slug}/`;
const link = (name, slug) => (slug ? `<a href="${fighterHref(esc(slug))}">${esc(name)}</a>` : esc(name));
const eventLinkTo = (name, slug) => (slug ? `<a href="${eventHref(esc(slug))}">${esc(name)}</a>` : esc(name));

const ordinal = (n) => {
    const s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return `${num(n)}${s[(v - 20) % 10] || s[v] || s[0]}`;
};
const lower = (division) => division.replace(/^Men's /, '').toLowerCase();
const plural = (division) => {
    const d = lower(division);
    return d.endsWith('pound-for-pound') ? 'fighters pound-for-pound' : `${d}s`;
};
const RESULT = { win: 'Won', loss: 'Lost', draw: 'Draw', nc: 'No contest' };
const monthFmt = new Intl.DateTimeFormat('en-GB', { month: 'short', year: 'numeric', timeZone: 'UTC' });
const fmtMonth = (ym) => monthFmt.format(new Date(`${ym}-01T00:00:00Z`));

// The credit line every article ends on, in the same words and style.
const DATA_CREDIT = `<p class="art-credit dp-credit">Data Credit: <a href="${OBSERVATORY_URL}">First Light Observatory</a>.</p>`;

const METHOD_LINK = (anchor, text) => `<a href="/observatory/methodology/#${anchor}">${text}</a>`;

// ── Charts ───────────────────────────────────────────────────────────────────────────────
// One series each, so no legend: the section heading names it. Gridlines and labels stay
// recessive (12% white, muted text); the line and its points are bone; the latest point is the
// one value labelled directly.

const W = 720, H = 260, L = 52, R = 64, T = 18, B = 34;
const PW = W - L - R, PH = H - T - B;

function niceStep(span, target = 4) {
    const raw = span / target;
    const mag = 10 ** Math.floor(Math.log10(raw));
    return [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= target + 1);
}

function timeAxis(t0, t1, x) {
    const y0 = new Date(t0).getUTCFullYear(), y1 = new Date(t1).getUTCFullYear();
    const every = Math.max(1, Math.ceil((y1 - y0 + 1) / 8));
    const out = [];
    for (let y = y0 + 1; y <= y1; y += 1) {
        if ((y - y0) % every && y !== y1) continue;
        const t = Date.UTC(y, 0, 1);
        if (t <= t0 || t >= t1) continue;
        out.push(`<line class="ch-tick" x1="${x(t).toFixed(1)}" x2="${x(t).toFixed(1)}" y1="${T + PH}" y2="${T + PH + 5}"/><text class="ch-lab" x="${x(t).toFixed(1)}" y="${H - 8}" text-anchor="middle">${y}</text>`);
    }
    // A span inside one year still needs to say which.
    if (!out.length) out.push(`<text class="ch-lab" x="${L}" y="${H - 8}">${y0}</text>`);
    return out.join('');
}

export function skillChart(points, fights = []) {
    if (!points || points.length < 2) return '';
    const byDate = new Map(fights.map((f) => [f.date, f]));
    const t = points.map((p) => Date.parse(p.date));
    const v = points.map((p) => p.flr);
    const t0 = t[0], t1 = Math.max(t[t.length - 1], t0 + 86400000);
    let lo = Math.min(...v), hi = Math.max(...v);
    const pad = Math.max(20, (hi - lo) * 0.08);
    lo -= pad; hi += pad;
    const step = niceStep(hi - lo);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const x = (ti) => L + ((ti - t0) / (t1 - t0)) * PW;
    const y = (val) => T + PH - ((val - lo) / (hi - lo)) * PH;
    const grid = [];
    for (let g = lo; g <= hi + 1e-9; g += step) {
        grid.push(`<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${y(g).toFixed(1)}" y2="${y(g).toFixed(1)}"/><text class="ch-lab" x="${L - 8}" y="${(y(g) + 4).toFixed(1)}" text-anchor="end">${num(g)}</text>`);
    }
    const pts = points.map((p, i) => [x(t[i]), y(p.flr)]);
    const dots = points.map((p, i) => {
        const f = byDate.get(p.date);
        const what = f ? ` · ${RESULT[f.result] ?? f.result} ${f.result === 'win' ? 'against' : 'to'} ${f.opponent}` : '';
        return `<circle class="ch-dot" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="4"><title>${esc(`${fmtDate(p.date)} · FLR ${num(p.flr)}${what}`)}</title></circle>`;
    }).join('');
    const [lx, ly] = pts[pts.length - 1];
    return `<figure class="ch">
            <svg class="ch-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`First Light Rating after each pro fight, ${fmtDate(points[0].date)} to ${fmtDate(points[points.length - 1].date)}: from ${num(v[0])} to ${num(v[v.length - 1])}.`)}">
                ${grid.join('')}${timeAxis(t0, t1, x)}
                <polyline class="ch-line" points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}"/>
                ${dots}
                <text class="ch-val" x="${(lx + 10).toFixed(1)}" y="${(ly + 4).toFixed(1)}">${num(v[v.length - 1])}</text>
            </svg>
            ${FIGURE_CREDIT}
        </figure>
        <p class="ch-note">FLR after each pro fight. Hover a point for the fight.</p>`;
}

// Attention rank, 1 at the top, on a log scale: the difference between 1st and 10th matters as
// much as between 100th and 1,000th. Months with a fight are marked on the time axis.
export function attentionChart(series, fights = []) {
    if (!series || series.length < 3) return '';
    const t = series.map((p) => Date.parse(`${p.month}-15`));
    const t0 = Date.parse(`${series[0].month}-01`), t1 = Date.parse(`${series[series.length - 1].month}-28`);
    const of = Math.max(...series.map((p) => p.of));
    const top = 0, bottom = Math.log10(of);
    const x = (ti) => L + ((ti - t0) / (t1 - t0)) * PW;
    const y = (rank) => T + ((Math.log10(rank) - top) / (bottom - top)) * PH;
    const ticks = [1, 10, 100, 1000].filter((r) => r <= of);
    const grid = ticks.map((r) => `<line class="ch-grid" x1="${L}" x2="${W - R}" y1="${y(r).toFixed(1)}" y2="${y(r).toFixed(1)}"/><text class="ch-lab" x="${L - 8}" y="${(y(r) + 4).toFixed(1)}" text-anchor="end">${r === 1 ? '#1' : `#${num(r)}`}</text>`).join('');
    const fightMarks = fights.filter((f) => { const d = Date.parse(f.date); return d >= t0 && d <= t1; })
        .map((f) => `<line class="ch-fight" x1="${x(Date.parse(f.date)).toFixed(1)}" x2="${x(Date.parse(f.date)).toFixed(1)}" y1="${T}" y2="${T + PH}"><title>${esc(`${fmtDate(f.date)}: ${f.event}`)}</title></line>`).join('');
    const pts = series.map((p, i) => [x(t[i]), y(p.rank)]);
    const dots = series.map((p, i) => `<circle class="ch-dot" cx="${pts[i][0].toFixed(1)}" cy="${pts[i][1].toFixed(1)}" r="4"><title>${esc(`${fmtMonth(p.month)}: #${num(p.rank)} of ${num(p.of)}`)}</title></circle>`).join('');
    const last = series[series.length - 1];
    const [lx, ly] = pts[pts.length - 1];
    return `<figure class="ch">
            <svg class="ch-svg" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(`Wikipedia attention rank by month among ${num(of)} professional fighters, ${fmtMonth(series[0].month)} to ${fmtMonth(last.month)}. Latest: #${num(last.rank)}.`)}">
                ${grid}${fightMarks}${timeAxis(t0, t1, x)}
                <polyline class="ch-line" points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}"/>
                ${dots}
                <text class="ch-val" x="${(lx + 10).toFixed(1)}" y="${(ly + 4).toFixed(1)}">#${num(last.rank)}</text>
            </svg>
            ${FIGURE_CREDIT}
        </figure>
        <p class="ch-note">Rank by Wikipedia page views each month, among every professional fighter the Observatory reads Wikipedia for (1 = most read). Vertical lines are fights.</p>`;
}

// ── /fighters/<slug>/ ───────────────────────────────────────────────────────────────────

function fighterLede(f) {
    const bits = [];
    if (f.flr) bits.push(`ranked ${ordinal(f.flr.rank)} of ${num(f.flr.of)} ${plural(f.flr.division)} by the First Light Rating`);
    if (f.panel) bits.push(f.panel.champion ? `the UFC’s ${lower(f.panel.division)} champion` : `${ordinal(f.panel.rank)} in the UFC’s own ${lower(f.panel.division)} rankings`);
    if (!bits.length) return '';
    return `${f.name} is ${bits.join(', and ')}.`;
}

function fighterDescription(f) {
    const parts = [fighterLede(f)];
    if (f.fli != null) parts.push(`First Light Index ${signed(f.fli, 2)}: ${f.fli >= 0 ? 'more famous than their skill predicts' : 'better than their audience knows'}.`);
    parts.push('Skill fight by fight, Wikipedia attention month by month, and what each fight did to both.');
    return parts.filter(Boolean).join(' ');
}

function statTiles(f) {
    const tiles = [];
    if (f.flr) tiles.push(['FLR', `${num(f.flr.rating)}`, `${ordinal(f.flr.rank)} of ${num(f.flr.of)} · ${esc(f.flr.division)}`, HINT_FLR(false)]);
    if (f.fli != null) {
        const tr = f.fli_trend;
        const move = tr && tr.dir !== 'flat' ? ` · ${tr.dir === 'up' ? '▲' : '▼'} ${signed(tr.delta, 2)} in ${tr.days} days` : '';
        tiles.push(['FLI', signed(f.fli, 2), `${f.fli >= 0 ? 'Fame ahead of skill' : 'Skill ahead of fame'}${move}`, HINT_FLI(false)]);
    }
    if (f.phase) tiles.push(['Phase', esc(f.phase.phase), `Career-best FLR ${num(f.phase.best)}, ${fmtDate(f.phase.best_date)}`, METHOD_LINK('phase', 'Career phase')]);
    const att = f.attention?.[f.attention.length - 1];
    if (att) tiles.push(['Attention', `#${num(att.rank)}`, `of ${num(att.of)} on Wikipedia, ${fmtMonth(att.month)}`, METHOD_LINK('attention', 'Attention rank')]);
    if (f.record) tiles.push(['Record', `${f.record.w}–${f.record.l}${f.record.d ? `–${f.record.d}` : ''}`, `Pro${f.record.nc ? `, ${f.record.nc} NC` : ''}`, 'Record']);
    return `<dl class="dp-tiles" data-r>${tiles.map(([, value, sub, label]) => `
                <div class="dp-tile"><dt>${label}</dt><dd><span class="dp-tile-v">${value}</span><span class="dp-tile-s">${sub}</span></dd></div>`).join('')}
            </dl>`;
}

function fightsTable(f) {
    if (!f.fights?.length) return '';
    const anyMultiple = f.fights.some((x) => x.multiple != null);
    const rows = f.fights.map((x) => `
                    <tr>
                        <td class="dp-nowrap">${fmtDate(x.date)}</td>
                        <td><span class="dp-res dp-res--${esc(x.result)}">${RESULT[x.result] ?? esc(x.result)}</span> ${x.result === 'win' ? 'vs' : x.result === 'loss' ? 'to' : 'vs'} ${link(x.opponent, x.opponent_slug)}${x.title ? ' <span class="dp-flag">Title</span>' : ''}<span class="dp-sub">${eventLinkTo(x.event, x.event_slug)}${x.method ? ` · ${esc(x.method)}${x.round ? `, R${x.round}` : ''}` : ''}</span></td>
                        <td class="dp-num">${x.flr_change != null ? signed(x.flr_change, 0) : '—'}</td>${anyMultiple ? `
                        <td class="dp-num">${x.multiple != null ? fmtMultiple(x.multiple) : '—'}</td>` : ''}
                    </tr>`).join('');
    return `
    <section class="pg-body pg-body--rule" aria-labelledby="dp-fights">
        <div class="pg-inner pg-inner--wide">
            <h2 class="pg-h2 pg-h2--small" id="dp-fights" data-r>Recent fights.</h2>
            <div class="dp-table" data-r>
                <table>
                    <thead><tr><th scope="col">Date</th><th scope="col">Fight</th><th scope="col" class="dp-num">FLR</th>${anyMultiple ? '<th scope="col" class="dp-num">Attention</th>' : ''}</tr></thead>
                    <tbody>${rows}
                    </tbody>
                </table>
            </div>
            <p class="pg-fine" data-r>FLR is how many rating points the fight moved. ${anyMultiple ? `Attention is Wikipedia views in the three days after the fight, as a multiple of the fighter’s usual daily views (${METHOD_LINK('attention', 'how it is measured')}).` : ''}</p>
        </div>
    </section>`;
}

export function fighterPage({ f, site, generatedAt }) {
    const url = fighterHref(f.slug);
    const fights = f.fights ?? [];
    const skill = skillChart(f.skill, fights);
    const attention = attentionChart(f.attention, fights);
    const division = f.flr?.division;
    const body = `<main>
    <header class="pg-head">
        <div class="pg-inner pg-inner--wide">
            <p class="art-meta" data-r><a href="/index/">Rankings</a>${division ? `<span aria-hidden="true"> / </span><a href="${divisionUrl(division)}">${esc(division)}</a>` : ''}<span aria-hidden="true"> · </span>Updated <time datetime="${esc(generatedAt)}">${fmtDate(generatedAt)}</time></p>
            <h1 class="pg-title pg-title--name" data-r style="--d:60ms">${esc(f.name)}</h1>${f.nickname ? `
            <p class="dp-nick" data-r style="--d:90ms">“${esc(f.nickname)}”</p>` : ''}
            <p class="pg-lede" data-r style="--d:120ms">${esc(fighterLede(f))}</p>
            ${statTiles(f)}
        </div>
    </header>${skill ? `
    <section class="pg-body pg-body--rule" aria-labelledby="dp-skill">
        <div class="pg-inner pg-inner--wide">
            <h2 class="pg-h2 pg-h2--small" id="dp-skill" data-r>Skill, fight by fight.</h2>
            <div data-r>${skill}</div>
        </div>
    </section>` : ''}${attention ? `
    <section class="pg-body pg-body--rule" aria-labelledby="dp-att">
        <div class="pg-inner pg-inner--wide">
            <h2 class="pg-h2 pg-h2--small" id="dp-att" data-r>Attention, month by month.</h2>
            <div data-r>${attention}</div>
        </div>
    </section>` : ''}${fightsTable(f)}
    <section class="pg-body pg-body--rule">
        <div class="pg-inner pg-inner--wide">
            ${DATA_CREDIT}
            <p class="pg-fine" data-r>${METHOD_LINK('flr', 'How these numbers are made')}. ${HOLDINGS_TEXT}</p>
        </div>
    </section>
</main>
${FOOTER}`;
    const crumbs = [[BRAND, '/'], ['Rankings', '/index/'], ...(division ? [[division, divisionUrl(division)]] : []), [f.name, url]];
    return shell({
        title: `${f.name}: skill rating, fame and fight data — ${BRAND}`,
        description: fighterDescription(f),
        url, site, current: 'index', body, crumbs,
        ogType: 'profile',
        jsonld: {
            '@type': 'ProfilePage', '@id': `${site}${url}#page`, url: `${site}${url}`,
            dateModified: generatedAt, isPartOf: { '@id': `${site}/#website` },
            mainEntity: {
                '@type': 'Person', '@id': `${site}${url}#person`, name: f.name,
                ...(f.nickname ? { alternateName: f.nickname } : {}),
                jobTitle: 'Mixed martial artist', description: fighterLede(f),
            },
        },
    });
}

// ── /fighters/ ──────────────────────────────────────────────────────────────────────────

export function fightersIndexPage({ fighters, site }) {
    const groups = new Map();
    for (const f of [...fighters].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        const letter = f.name.normalize('NFD').charAt(0).toUpperCase();
        const key = /[A-Z]/.test(letter) ? letter : '#';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
    }
    const body = `<main>
    <header class="pg-head">
        <div class="pg-inner pg-inner--wide">
            <h1 class="pg-title" data-r>Fighters.</h1>
            <p class="pg-lede" data-r style="--d:80ms">Every fighter with a page: the top 30 of each division, and everyone the Observatory measured on a card in the last year. ${num(fighters.length)} in all.</p>
            <ul class="dp-az" aria-label="Jump to a letter">${[...groups.keys()].map((k) => `<li><a href="#l-${k === '#' ? 'other' : k}">${k}</a></li>`).join('')}</ul>
        </div>
    </header>
    <section class="pg-body pg-body--rule">
        <div class="pg-inner pg-inner--wide">${[...groups].map(([k, list]) => `
            <h2 class="pg-h2 pg-h2--small dp-letter" id="l-${k === '#' ? 'other' : k}">${k}</h2>
            <ul class="dp-names">${list.map((f) => `<li>${link(f.name, f.slug)}${f.flr ? `<span class="dp-sub">${esc(f.flr.division)}</span>` : ''}</li>`).join('')}</ul>`).join('')}
        </div>
    </section>
</main>
${FOOTER}`;
    return shell({
        title: `MMA fighters: ratings, fame and fight data — ${BRAND}`,
        description: `${num(fighters.length)} MMA fighters with their First Light Rating, First Light Index, skill curve and Wikipedia attention, fight by fight.`,
        url: '/fighters/', site, current: 'index', body,
        crumbs: [[BRAND, '/'], ['Fighters', '/fighters/']],
    });
}

// ── /index/<division>/ ──────────────────────────────────────────────────────────────────

function gapList(rows, fightersBySlug, division) {
    // Where the UFC's panel and the FLR disagree most, among this division's FLR top 30.
    const pairs = rows.map((r) => ({ r, f: fightersBySlug.get(r.slug) }))
        .filter(({ f }) => f?.panel && f.panel.division === division)
        .map(({ r, f }) => ({ r, panel: f.panel.champion ? 0 : f.panel.rank, gap: (f.panel.champion ? 0 : f.panel.rank) - r.rank }))
        .filter((p) => p.gap !== 0)
        .sort((a, b) => Math.abs(b.gap) - Math.abs(a.gap)).slice(0, 5);
    if (!pairs.length) return '';
    return `
            <div class="dp-col" data-r>
                <h3 class="dp-h3">Where the UFC panel disagrees.</h3>
                <ul class="dp-pairs">${pairs.map(({ r, panel, gap }) => `
                    <li>${link(r.name, r.slug)}<span class="dp-sub">FLR ${ordinal(r.rank)} · panel ${panel === 0 ? 'champion' : ordinal(panel)}</span><span class="dp-pair-v ${gap > 0 ? 'fli-pos' : 'fli-neg'}">${gap > 0 ? `${gap} higher here` : `${-gap} lower here`}</span></li>`).join('')}
                </ul>
            </div>`;
}

function fliExtremes(rows) {
    const with_ = rows.filter((r) => r.fli != null);
    if (with_.length < 6) return '';
    const sorted = [...with_].sort((a, b) => a.fli - b.fli);
    const list = (title, items) => `
            <div class="dp-col" data-r>
                <h3 class="dp-h3">${title}</h3>
                <ul class="dp-pairs">${items.map((r) => `
                    <li>${link(r.name, r.slug)}<span class="dp-sub">FLR ${ordinal(r.rank)}</span><span class="dp-pair-v ${r.fli >= 0 ? 'fli-pos' : 'fli-neg'}">${signed(r.fli, 2)}</span></li>`).join('')}
                </ul>
            </div>`;
    return list('Better than their audience knows.', sorted.slice(0, 3)) + list('Bigger names than their skill predicts.', sorted.slice(-3).reverse());
}

export function divisionPage({ division, rows, data, fightersBySlug, site }) {
    const url = divisionUrl(division);
    const isP4P = /pound-for-pound/i.test(division);
    const top = rows[0];
    const body = `<main>
    <header class="pg-head pg-head--rankings">
        <div class="pg-inner pg-inner--wide">
            ${subtabs('division', !!data.winners_losers, !!data.events?.length)}
            <h1 class="pg-title" data-r>${esc(division)} rankings.</h1>
            <p class="pg-lede" data-r style="--d:80ms">The top ${rows.length} ${plural(division)} by the First Light Rating, a skill score built from in-cage performance and results, with each one’s First Light Index: fame against what that skill predicts.${top ? ` ${esc(top.name)} leads at ${num(top.rating)}.` : ''}</p>
            <p class="pg-asof" data-r style="--d:100ms">${data.period ? `${esc(data.period)} · ` : ''}Updated <time datetime="${esc(data.generated_at)}">${fmtDate(data.generated_at)}</time> · <a href="/index/">All divisions</a></p>
        </div>
    </header>
    <section class="pg-body pg-body--flush" aria-label="${esc(division)} rankings">
        <div class="pg-inner pg-inner--wide">${rankingTable(division, rows, { collapse: false, heading: 'h2', link: false })}
        </div>
    </section>
    <section class="pg-body pg-body--rule" aria-label="What the numbers say">
        <div class="pg-inner pg-inner--wide dp-cols">${isP4P ? '' : gapList(rows, fightersBySlug, division)}${fliExtremes(rows)}
        </div>
    </section>
    <section class="pg-body pg-body--rule">
        <div class="pg-inner pg-inner--wide">${DATA_CREDIT}<p class="pg-fine" data-r>${METHOD_LINK('flr', 'How the FLR and FLI are measured')} · <a href="/data/rankings.csv">Download every division (CSV)</a> · ${HOLDINGS_TEXT}</p></div>
    </section>
</main>
${FOOTER}`;
    return shell({
        title: `${division} MMA rankings by skill and fame — ${BRAND}`,
        description: `The top ${rows.length} ${plural(division)} ranked by First Light Rating (skill), with each fighter’s First Light Index (fame against skill)${top ? `. ${top.name} leads` : ''}. Updated weekly.`,
        url, site, current: 'index', body,
        crumbs: [[BRAND, '/'], ['Rankings', '/index/'], [division, url]],
        jsonld: {
            '@type': 'ItemList', '@id': `${site}${url}#list`, name: `${division} rankings`,
            itemListOrder: 'https://schema.org/ItemListOrderAscending', numberOfItems: rows.length,
            itemListElement: rows.map((r) => ({ '@type': 'ListItem', position: r.rank, name: r.name, ...(r.slug ? { url: `${site}${fighterHref(r.slug)}` } : {}) })),
        },
    });
}

// ── /events/ and /events/<slug>/ ────────────────────────────────────────────────────────

const allMeasured = (e) => e.bouts.flatMap((b) => [
    { ...b.winner, result: 'win', opp: b.loser, bout: b },
    { ...b.loser, result: 'loss', opp: b.winner, bout: b },
]).filter((x) => x.multiple != null);

function eventSummary(e) {
    const m = allMeasured(e).sort((a, b) => b.multiple - a.multiple);
    const against = e.bouts.filter((b) => b.against_result).length;
    const lead = m[0] ? `${m[0].name} drew the most attention, ${fmtMultiple(m[0].multiple)} their usual Wikipedia views` : '';
    return [lead, against ? `${against} ${against === 1 ? 'fight' : 'fights'} went against the result` : ''].filter(Boolean).join('; ');
}

export function eventsIndexPage({ events, data, site }) {
    const body = `<main>
    <header class="pg-head pg-head--rankings">
        <div class="pg-inner pg-inner--wide">
            ${subtabs('events', !!data.winners_losers, true)}
            <p class="pg-lede" data-r style="--d:80ms">Every card of the last year, and what each fight did to the fighters’ attention: Wikipedia views in the three days after, against their usual.</p>
        </div>
    </header>
    <section class="pg-body pg-body--flush">
        <div class="pg-inner">
            <ol class="entries">${events.map((e) => `
                <li>
                    <a class="entry" href="${eventHref(esc(e.slug))}">
                        <time class="entry-date" datetime="${esc(e.date)}">${fmtDate(e.date)}</time>
                        <span class="entry-main"><span class="entry-title">${esc(e.name)}</span><span class="entry-sum">${esc(eventSummary(e))}.</span></span>
                        <span class="entry-type">${esc(e.promotion && e.promotion !== 'Other' ? e.promotion : 'Event')}</span>
                    </a>
                </li>`).join('')}
            </ol>
        </div>
    </section>
</main>
${FOOTER}`;
    return shell({
        title: `MMA events: who each fight made famous — ${BRAND}`,
        description: 'Every UFC, PFL, ONE and Rizin card of the last year, with the attention each fighter drew after their fight and the fights whose fame went against the result.',
        url: '/events/', site, current: 'index', body,
        crumbs: [[BRAND, '/'], ['Events', '/events/']],
    });
}

export function eventPage({ e, site }) {
    const url = eventHref(e.slug);
    const measured = allMeasured(e).sort((a, b) => b.multiple - a.multiple);
    const podium = measured.slice(0, 3);
    const anyM = measured.length > 0;
    const side = (s, won) => `<span class="dp-res dp-res--${won ? 'win' : 'loss'}">${won ? 'W' : 'L'}</span> ${link(s.name, s.slug)}`;
    const rows = e.bouts.map((b) => `
                    <tr${b.against_result ? ' class="dp-against"' : ''}>
                        <td>${side(b.winner, true)}<span class="dp-sub">${b.method ? esc(b.method) : ''}${b.round ? `, R${b.round}` : ''}${b.weight_class ? ` · ${esc(b.weight_class)}` : ''}${b.title ? ' · Title' : ''}</span></td>
                        <td class="dp-num">${b.winner.multiple != null ? fmtMultiple(b.winner.multiple) : '—'}</td>
                        <td>${side(b.loser, false)}${b.against_result ? '<span class="dp-sub dp-against-note">Drew more attention than the winner</span>' : ''}</td>
                        <td class="dp-num">${b.loser.multiple != null ? fmtMultiple(b.loser.multiple) : '—'}</td>
                    </tr>`).join('');
    const desc = `${e.name}, ${fmtDate(e.date)}: the attention every fighter on the card drew after their fight. ${eventSummary(e)}.`;
    const body = `<main>
    <header class="pg-head">
        <div class="pg-inner pg-inner--wide">
            <p class="art-meta" data-r><a href="/events/">Events</a><span aria-hidden="true"> / </span>${esc(e.promotion && e.promotion !== 'Other' ? e.promotion : 'Event')}<span aria-hidden="true"> · </span><time datetime="${esc(e.date)}">${fmtDate(e.date)}</time></p>
            <h1 class="pg-title pg-title--name" data-r style="--d:60ms">${esc(e.name)}</h1>
            <p class="pg-lede" data-r style="--d:120ms">${esc(eventSummary(e))}.</p>${podium.length ? `
            <dl class="dp-tiles" data-r>${podium.map((p, i) => `
                <div class="dp-tile"><dt>${['Most attention', 'Second', 'Third'][i]}</dt><dd><span class="dp-tile-v">${fmtMultiple(p.multiple)}</span><span class="dp-tile-s">${link(p.name, p.slug)}, ${p.result === 'win' ? 'won' : 'lost'}</span></dd></div>`).join('')}
            </dl>` : ''}
        </div>
    </header>
    <section class="pg-body pg-body--rule" aria-labelledby="dp-card">
        <div class="pg-inner pg-inner--wide">
            <h2 class="pg-h2 pg-h2--small" id="dp-card" data-r>The card.</h2>
            <div class="dp-table" data-r>
                <table>
                    <thead><tr><th scope="col">Winner</th><th scope="col" class="dp-num">${anyM ? 'Attention' : ''}</th><th scope="col">Loser</th><th scope="col" class="dp-num">${anyM ? 'Attention' : ''}</th></tr></thead>
                    <tbody>${rows}
                    </tbody>
                </table>
            </div>
            <p class="pg-fine" data-r>Attention is Wikipedia views in the three days after the fight, as a multiple of the fighter’s usual daily views; — means too little history to measure (${METHOD_LINK('attention', 'how it is measured')}). Highlighted fights went against the result: the loser drew more attention than the winner.</p>
            ${DATA_CREDIT}
        </div>
    </section>
</main>
${FOOTER}`;
    return shell({
        title: `${e.name}: who the fight made famous — ${BRAND}`,
        description: desc,
        url, site, current: 'index', body,
        crumbs: [[BRAND, '/'], ['Events', '/events/'], [e.name, url]],
        jsonld: {
            '@type': 'SportsEvent', '@id': `${site}${url}#event`, name: e.name, startDate: e.date,
            sport: 'Mixed martial arts', url: `${site}${url}`, eventStatus: 'https://schema.org/EventScheduled',
            ...(e.promotion && e.promotion !== 'Other' ? { organizer: { '@type': 'Organization', name: e.promotion } } : {}),
            competitor: [...new Map(e.bouts.flatMap((b) => [b.winner, b.loser]).map((p) => [p.name, p])).values()]
                .map((p) => ({ '@type': 'Person', name: p.name, ...(p.slug ? { url: `${site}${fighterHref(p.slug)}` } : {}) })),
        },
    });
}

// ── /observatory/methodology/ ───────────────────────────────────────────────────────────
// The accuracy figures come from fightscorer's walk-forward harness (docs/decisions.md, ADR-019
// and ADR-025; predictions_20260923T2212): every bout from 2015 to Sep 2026 predicted with only
// what was known the day before. Like-for-like means the same bouts for both models.
const ACCURACY = {
    window: 'January 2015 to September 2026',
    fm: { bouts: 10198, flr: 62.3, them: 58.5, record: 59.1, flrLL: 0.639, themLL: 0.680 },
    market: { bouts: 13266, flr: 63.8, them: 68.9, flrLL: 0.627, themLL: 0.580 },
    all: { bouts: 21643, flr: 64.3 },
};

export function methodologyPage({ site }) {
    const a = ACCURACY;
    const url = '/observatory/methodology/';
    const sec = (id, title, html) => `
    <section class="pg-body pg-body--rule" id="${id}" aria-labelledby="${id}-h">
        <div class="pg-inner pg-inner--read">
            <h2 class="pg-h2 pg-h2--small" id="${id}-h" data-r>${title}</h2>
            <div class="prose" data-r>${html}</div>
        </div>
    </section>`;
    const body = `<main>
    <header class="pg-head">
        <div class="pg-inner pg-inner--read">
            <p class="art-meta" data-r><a href="/observatory/">Observatory</a><span aria-hidden="true"> / </span>Methodology</p>
            <h1 class="pg-title" data-r style="--d:60ms">How the numbers are made.</h1>
            <p class="pg-lede" data-r style="--d:120ms">Two numbers carry the site: the First Light Rating, for skill, and the First Light Index, for fame against that skill. Here is what goes into each, and how well the rating predicts fights.</p>
        </div>
    </header>${sec('flr', 'The First Light Rating (FLR).', `
            <p>The FLR is a skill rating built for MMA. It starts from Glicko-2, a rating system that tracks both how good a fighter is and how sure it is of that, and adds three things a win-loss record cannot see.</p>
            <ul>
                <li><strong>How the fight was won.</strong> A dominant finish moves the rating more than a split decision.</li>
                <li><strong>Every round, scored.</strong> First Light Scorecards learn how judges score a round from its strikes, takedowns and control time, then score the rounds no judge saw because the fight ended early. A fifth-round loss after four dominant rounds is no longer the same as one after four losing rounds.</li>
                <li><strong>Where a fighter has been competing.</strong> Records built in a regional promotion are weighed by how that promotion’s fighters actually do when they move up.</li>
            </ul>
            <p>The published number is deliberately conservative: it is the rating minus twice its uncertainty, so a fighter with few fights on record sits lower until the results are in. The First Light Rankings order each division by it.</p>`)}${sec('accuracy', 'How accurate it is.', `
            <p>Every fight from ${a.window} was predicted with only what was known the day before it, and the prediction checked against the result. Nothing was fitted on the fights it was scored on.</p>
            <div class="prose-table"><table>
                <thead><tr><th scope="col">Picking the winner</th><th scope="col">Same fights</th><th scope="col">FLR</th><th scope="col">Compared with</th></tr></thead>
                <tbody>
                    <tr><td>Against Fight Matrix</td><td>${num(a.fm.bouts)}</td><td><strong>${a.fm.flr}%</strong></td><td>${a.fm.them}%</td></tr>
                    <tr><td>Against the betting market (closing odds)</td><td>${num(a.market.bouts)}</td><td><strong>${a.market.flr}%</strong></td><td>${a.market.them}%</td></tr>
                    <tr><td>Every rated fight</td><td>${num(a.all.bouts)}</td><td><strong>${a.all.flr}%</strong></td><td>—</td></tr>
                </tbody>
            </table></div>
            <p>On the fights both rate, the FLR picks the winner ${(a.fm.flr - a.fm.them).toFixed(1)} points more often than Fight Matrix, the longest-running algorithmic MMA ranking. Fight Matrix does slightly worse than simply backing the fighter with the better record (${a.fm.record}%). Its predictions are also less well calibrated: log loss ${a.fm.themLL.toFixed(3)} against the FLR’s ${a.fm.flrLL.toFixed(3)} (lower is better).</p>
            <p>The betting market is better still, and is expected to stay that way: closing odds know about injuries, weight cuts, short-notice replacements and styles, none of which a rating can see. The FLR is a measure of what fighters have shown in the cage, not a betting tool.</p>`)}${sec('fli', 'The First Light Index (FLI).', `
            <p>The FLI compares a fighter’s fame with what their FLR would predict. Fame is read across the platforms the Observatory follows (Instagram, YouTube, TikTok, X and Wikipedia), each converted to one scale. A curve is fitted to fame against skill over every rated fighter, because fame is winner-take-most: the very best are disproportionately famous.</p>
            <p>The FLI is where a fighter sits against that curve, on a scale from −1 to +1. Above zero, their audience is bigger than their skill explains. Below zero, they are better than their audience knows. The arrow on the rankings is its change over about 30 days.</p>`)}${sec('attention', 'Attention around a fight.', `
            <p>The attention multiple is a fighter’s Wikipedia page views in the three days after a fight, divided by their usual daily views: the median of days 8 to 28 before it. Views are summed over every language edition and count people, not bots. Fight day itself is left out, because a US card ends after midnight UTC.</p>
            <p>A fighter needs at least 14 days of views in that window and a median of at least 20 a day, or there is no honest baseline and no multiple is shown. A fight went <em>against the result</em> when the loser’s multiple was higher than the winner’s.</p>
            <p id="attention-rank">The <strong>attention rank</strong> on a fighter’s page is where their monthly Wikipedia views placed them among every professional fighter the Observatory reads Wikipedia for, about a thousand, 1 being the most read.</p>`)}${sec('phase', 'Career phase.', `
            <p>Each month, a fighter’s FLR is compared with their best so far. <strong>Prime</strong>: at or near their best. <strong>Developing</strong>: near their best and still climbing. <strong>Declining</strong>: clearly below it. <strong>Inactive</strong>: no fight in two years. <strong>Unproven</strong>: too few fights to say.</p>`)}${sec('cite', 'Using this data.', `
            <p>Journalists and researchers may publish anything on this site, with the credit <strong>Source: First Light Observatory</strong> and, online, a link to the page it came from. The current rankings are downloadable as <a href="/data/rankings.csv">CSV</a> and <a href="/data/rankings.json">JSON</a>. For anything else, or deeper data on a fighter, write to <a href="mailto:contact@firstlightequity.com">contact@firstlightequity.com</a>.</p>
            <p>${HOLDINGS_TEXT}</p>`)}
</main>
${FOOTER}`;
    return shell({
        title: `How the First Light Rating and Index work — ${BRAND}`,
        description: `How the First Light Rating (MMA skill) and First Light Index (fame against skill) are built. Tested on every fight since 2015: the FLR picks ${a.fm.flr}% of winners against Fight Matrix’s ${a.fm.them}% on the same fights.`,
        url, site, current: 'observatory', body,
        crumbs: [[BRAND, '/'], ['Observatory', '/observatory/'], ['Methodology', url]],
        jsonld: {
            '@type': 'TechArticle', '@id': `${site}${url}#article`, headline: 'How the First Light Rating and Index work',
            author: { '@id': `${site}/#organization` }, publisher: { '@id': `${site}/#organization` },
            about: { '@id': `${site}/observatory/#dataset` }, mainEntityOfPage: `${site}${url}`,
        },
    });
}

// ── /data/rankings.csv and .json ────────────────────────────────────────────────────────

const csvCell = (v) => (v == null ? '' : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

export function rankingsCsv(data, site) {
    const head = ['division', 'rank', 'fighter', 'flr', 'fli', 'fli_change_30d', 'page', 'updated'];
    const rows = data.rankings.map((r) => [r.division, r.rank, r.name, r.rating, r.fli, r.fli_trend?.delta,
        r.slug ? `${site}${fighterHref(r.slug)}` : '', data.generated_at.slice(0, 10)]);
    return `# First Light Rankings. Source: First Light Observatory (${site}/observatory/). Methodology: ${site}/observatory/methodology/\n${[head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n')}\n`;
}

export function rankingsJson(data, site) {
    return `${JSON.stringify({
        source: 'First Light Observatory', credit: 'Source: First Light Observatory',
        methodology: `${site}/observatory/methodology/`, updated: data.generated_at,
        rankings: data.rankings.map((r) => ({
            division: r.division, rank: r.rank, fighter: r.name, flr: r.rating ?? null, fli: r.fli ?? null,
            ...(r.slug ? { page: `${site}${fighterHref(r.slug)}` } : {}),
        })),
    }, null, 1)}\n`;
}

export { INDEX_TOP, byDivision };
