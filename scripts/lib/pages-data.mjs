// The data pages: one per fighter, per division, per event, the indexes that list them, and the
// methodology. Everything here is generated from data/index.json (the Observatory's export, see
// observatory/site_pages.py for what it carries and what it never does). Charts are inline SVG,
// so they need no script; each point carries a native tooltip and the numbers behind every chart
// are also in a table on the same page.

import { esc, fmtDate, FIGURE_CREDIT, OBSERVATORY_URL } from './util.mjs';
import {
    BRAND, FOOTER, HINT_FLI, HINT_FLR, HOLDINGS_TEXT, INDEX_TOP, byDivision, divisionUrl, fliAttrs, fliCell,
    num, rankingTable, shell, signed, subtabs,
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

// ── Fame against skill: the FLI as a field ─────────────────────────────────────────────
// Every fighter with an FLI at (FLR, fame), fame standardised so no position carries a count,
// and the curve the FLI is measured from. The dots and curve are one shared image the build
// writes once (/fighters/field.svg); each page draws its axes and its own fighter over it in the
// same coordinates, so 400 pages do not each carry a thousand dots.
const FW = 720, FH = 380, FL = 46, FR = 20, FT = 16, FB = 40;
function fieldScale(field) {
    const xs = field.points.map((p) => p[0]), ys = field.points.map((p) => p[1]);
    const x0 = Math.floor(Math.min(...xs) / 100) * 100, x1 = Math.ceil(Math.max(...xs) / 100) * 100;
    const y0 = Math.min(...ys) - 0.2, y1 = Math.max(...ys) + 0.2;
    return {
        x0, x1, y0, y1,
        x: (v) => FL + ((v - x0) / (x1 - x0)) * (FW - FL - FR),
        y: (v) => FT + (1 - (v - y0) / (y1 - y0)) * (FH - FT - FB),
    };
}

export function fieldSvg(field) {
    const s = fieldScale(field);
    const dots = field.points.map(([a, b]) => `<circle cx="${s.x(a).toFixed(1)}" cy="${s.y(b).toFixed(1)}" r="2.6"/>`).join('');
    const curve = field.curve.map(([a, b]) => `${s.x(a).toFixed(1)},${s.y(b).toFixed(1)}`).join(' ');
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FW} ${FH}" width="${FW}" height="${FH}"><g fill="#f0ebe3" fill-opacity="0.22">${dots}</g><polyline points="${curve}" fill="none" stroke="#f0ebe3" stroke-opacity="0.7" stroke-width="2" stroke-dasharray="6 5"/></svg>\n`;
}

function fieldChart(field, f) {
    if (!field || !f.field) return '';
    const s = fieldScale(field);
    const [fx, fy] = f.field;
    const ticks = [];
    for (let v = s.x0; v <= s.x1; v += 200) ticks.push(`<text class="ch-lab" x="${s.x(v).toFixed(1)}" y="${FH - 14}" text-anchor="middle">${num(v)}</text>`);
    const cx = s.x(fx), cy = s.y(fy);
    const right = cx > FW - 200;
    return `<figure class="ch">
            <div class="fm-wrap">
                <img class="fm-bg" src="/fighters/field.svg" alt="" width="${FW}" height="${FH}" loading="lazy">
                <svg class="fm-top ch-svg" viewBox="0 0 ${FW} ${FH}" data-x0="${s.x0}" data-x1="${s.x1}" data-y0="${s.y0}" data-y1="${s.y1}" data-me="${esc(f.slug)}" role="img" aria-label="${esc(`${f.name} on the field of every fighter with an FLI: skill across, fame up. ${f.fli != null ? (f.fli >= 0 ? 'Above the curve: more famous than their skill predicts.' : 'Below the curve: better than their fame.') : ''}`)}">
                    <line class="ch-axis" x1="${FL}" x2="${FW - FR}" y1="${FH - FB}" y2="${FH - FB}"/>
                    <line class="ch-axis" x1="${FL}" x2="${FL}" y1="${FT}" y2="${FH - FB}"/>
                    <g class="fm-hits"></g>
                    ${ticks.join('')}
                    <text class="ch-lab" x="${FW - FR}" y="${FH - 28}" text-anchor="end">Skill (FLR) →</text>
                    <text class="ch-lab" x="${FL - 8}" y="${FT + 10}" text-anchor="end">Fame ↑</text>
                    <circle class="fm-me" cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="7"/>
                    <text class="ch-val" x="${(cx + (right ? -12 : 12)).toFixed(1)}" y="${(cy + 4).toFixed(1)}" text-anchor="${right ? 'end' : 'start'}">${esc(f.name)}</text>
                </svg>
            </div>
            ${FIGURE_CREDIT}
        </figure>
        <p class="ch-note">Every fighter with an FLI, by skill and fame. Hover a dot for the fighter; click to open their page. The dashed curve is the fame their skill predicts: above it, a fighter is more famous than their skill; below it, better than their fame.</p>`;
}

// ── A career, and where it is heading ──────────────────────────────────────────────────
// Skill and attention on one chart and one scale. Attention is drawn at the rating its fame would
// match on the FLI's curve (the export does the conversion), so attention above skill is an FLI
// above zero and the gap between the lines is the FLI. Each line runs on into the fan of what the
// most comparable fighters did over the next two years: 10th to 90th percentile, darker 25th to
// 75th, dashed median. Time is in dates; the fighter's age at each year is in brackets.
const CW = 720, CH = 340, CL = 52, CR = 96, CT = 16, CB = 40;
const ym = (s) => { const [y, m] = s.split('-').map(Number); return y + (m - 0.5) / 12; };

function courseChart(f) {
    const sk = f.course, at = f.attention_course;
    if (!sk) return '';
    const series = [{ key: 'skill', label: 'Skill', c: sk }, ...(at ? [{ key: 'att', label: 'Attention', c: at }] : [])];
    const t0 = Math.min(...series.map((s) => ym(s.c.line[0][0])));
    const t1 = Math.max(...series.map((s) => ym((s.c.fan.at(-1) ?? { date: s.c.line.at(-1)[0] }).date)));
    const skillVals = [...sk.line.map((p) => p[1]), ...sk.fan.flatMap((b) => [b.p10, b.p90])];
    const attVals = at ? [...at.line.map((p) => p[1]), ...at.fan.flatMap((b) => [b.p10, b.p90])] : [];
    // The scale follows skill, and attention as far down as 150 below the lowest skill: a career's
    // first months can sit far below, and are cut at the floor rather than flattening the rest.
    let lo = Math.min(...skillVals, ...attVals.filter((v) => v >= Math.min(...skillVals) - 150));
    let hi = Math.max(...skillVals, ...attVals);
    const pad = Math.max(20, (hi - lo) * 0.05); lo -= pad; hi += pad;
    const step = niceStep(hi - lo, 4);
    lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
    const x = (t) => CL + ((t - t0) / (t1 - t0 || 1)) * (CW - CL - CR);
    const y = (v) => CT + (1 - (v - lo) / (hi - lo)) * (CH - CT - CB);
    const inside = (v) => v >= lo && v <= hi;
    const grid = [];
    for (let v = lo; v <= hi + 1e-9; v += step) grid.push(`<line class="ch-grid" x1="${CL}" x2="${CW - CR}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}"/><text class="ch-lab" x="${CL - 8}" y="${(y(v) + 4).toFixed(1)}" text-anchor="end">${num(v)}</text>`);
    // Years along the bottom, with the age then in brackets when the date of birth is known.
    const span = t1 - t0, every = span > 14 ? 4 : span > 7 ? 2 : 1;
    const age = sk.age ?? at?.age;
    const ageAt = (yr) => (age ? Math.floor(age.years - (ym(age.at) - yr)) : null);
    const years = [];
    for (let yr = Math.ceil(t0); yr <= Math.floor(t1); yr += 1) {
        if ((yr - Math.ceil(t0)) % every) continue;
        const a = ageAt(yr);
        years.push(`<line class="ch-tick" x1="${x(yr).toFixed(1)}" x2="${x(yr).toFixed(1)}" y1="${CH - CB}" y2="${CH - CB + 5}"/><text class="ch-lab" x="${x(yr).toFixed(1)}" y="${CH - 14}" text-anchor="middle">${yr}${a != null ? ` (${a})` : ''}</text>`);
    }
    // A line broken wherever it leaves the scale.
    const path = (pts) => {
        const runs = [[]];
        for (const [d, v] of pts) { if (inside(v)) runs.at(-1).push(`${x(ym(d)).toFixed(1)},${y(v).toFixed(1)}`); else if (runs.at(-1).length) runs.push([]); }
        return runs.filter((r) => r.length > 1).map((r) => r.join(' '));
    };
    const draw = (s) => {
        const fan = s.c.fan.length ? [{ date: s.c.line.at(-1)[0], p10: s.c.line.at(-1)[1], p25: s.c.line.at(-1)[1], p50: s.c.line.at(-1)[1], p75: s.c.line.at(-1)[1], p90: s.c.line.at(-1)[1] }, ...s.c.fan] : [];
        const clamp = (v) => Math.min(hi, Math.max(lo, v));
        const area = (a, b) => `${fan.map((p) => `${x(ym(p.date)).toFixed(1)},${y(clamp(p[a])).toFixed(1)}`).join(' ')} ${[...fan].reverse().map((p) => `${x(ym(p.date)).toFixed(1)},${y(clamp(p[b])).toFixed(1)}`).join(' ')}`;
        const end = s.c.line.at(-1);
        return `<g class="cs-${s.key}">${fan.length > 1 ? `<polygon class="cs-fan" points="${area('p10', 'p90')}"/><polygon class="cs-fan cs-fan--in" points="${area('p25', 'p75')}"/><polyline class="cs-mid" points="${fan.map((p) => `${x(ym(p.date)).toFixed(1)},${y(clamp(p.p50)).toFixed(1)}`).join(' ')}"/>` : ''}${path(s.c.line).map((pts) => `<polyline class="cs-line" points="${pts}"/>`).join('')}${inside(end[1]) ? `<circle class="cs-dot" cx="${x(ym(end[0])).toFixed(1)}" cy="${y(end[1]).toFixed(1)}" r="4"/>` : ''}</g>`;
    };
    // Direct labels at the right end of each fan (or line), nudged apart if they would touch.
    const ends = series.map((s) => { const last = s.c.fan.at(-1) ?? { date: s.c.line.at(-1)[0], p50: s.c.line.at(-1)[1] }; return { s, x: x(ym(last.date)) + 8, y: y(Math.min(hi, Math.max(lo, last.p50))) }; });
    if (ends.length === 2 && Math.abs(ends[0].y - ends[1].y) < 16) { const mid = (ends[0].y + ends[1].y) / 2, up = ends[0].y <= ends[1].y ? 0 : 1; ends[up].y = mid - 8; ends[1 - up].y = mid + 8; }
    const nowX = x(ym(sk.line.at(-1)[0])).toFixed(1);
    return `<figure class="ch">
            <ul class="ch-legend" aria-hidden="true">${series.map((s) => `<li class="cs-key cs-key--${s.key}">${s.label}</li>`).join('')}</ul>
            <svg class="ch-svg" viewBox="0 0 ${CW} ${CH}" role="img" aria-label="${esc(`${f.name}'s skill${at ? ' and attention' : ''} over time, on the First Light Rating scale${at ? ', attention placed at the rating its fame would match' : ''}, with what comparable fighters did over the next two years.`)}">
                ${grid.join('')}
                <line class="ch-axis" x1="${CL}" x2="${CL}" y1="${CT}" y2="${CH - CB}"/><line class="ch-axis" x1="${CL}" x2="${CW - CR}" y1="${CH - CB}" y2="${CH - CB}"/>
                <line class="cs-now" x1="${nowX}" x2="${nowX}" y1="${CT}" y2="${CH - CB}"/>
                ${series.map(draw).join('')}
                ${ends.map((e) => `<text class="ch-val cs-end--${e.s.key}" x="${e.x.toFixed(1)}" y="${(e.y + 4).toFixed(1)}">${e.s.label}</text>`).join('')}
                ${years.join('')}
            </svg>
            ${FIGURE_CREDIT}
        </figure>
        <p class="ch-note">Both on the First Light Rating scale. Attention is placed at the rating whose usual fame it matches: where it runs above skill, the fighter is more famous than their skill predicts. Right of the line, the shaded bands are what the fighters whose careers were most like this one at this point went on to do over the next two years: most inside the light band, half inside the dark one, the dashed line typical.${age ? ' Age in brackets.' : ''}</p>`;
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
    parts.push('Skill fight by fight, fame against skill, and what each fight did to the rating.');
    return parts.filter(Boolean).join(' ');
}

function statTiles(f) {
    const tiles = [];
    if (f.flr) tiles.push(['FLR', `${num(f.flr.rating)}`, `${ordinal(f.flr.rank)} of ${num(f.flr.of)} · ${esc(f.flr.division)}`, HINT_FLR(false)]);
    if (f.fli != null) {
        const tr = f.fli_trend;
        const move = tr && tr.dir !== 'flat' ? `<br>${tr.dir === 'up' ? '▲' : '▼'} ${signed(tr.delta, 2)} in ${tr.days} days` : '';
        tiles.push(['FLI', signed(f.fli, 2), `${f.fli >= 0 ? 'Fame ahead of skill' : 'Skill ahead of fame'}${move}`, HINT_FLI(false)]);
    }
    if (f.phase) tiles.push(['Phase', esc(f.phase.phase), `Career-best FLR ${num(f.phase.best)}, ${fmtDate(f.phase.best_date)}`, METHOD_LINK('phase', 'Career phase')]);
    if (f.record) tiles.push(['Record', `${f.record.w}–${f.record.l}${f.record.d ? `–${f.record.d}` : ''}`, `Pro${f.record.nc ? `, ${f.record.nc} NC` : ''}`, 'Record']);
    return `<dl class="dp-tiles" data-r>${tiles.map(([, value, sub, label]) => `
                <div class="dp-tile"><dt>${label}</dt><dd><span class="dp-tile-v">${value}</span><span class="dp-tile-s">${sub}</span></dd></div>`).join('')}
            </dl>`;
}

function fightsTable(f) {
    if (!f.fights?.length) return '';
    const anyFli = f.fights.some((x) => x.fli_change != null);
    const rows = f.fights.map((x) => `
                    <tr>
                        <td class="dp-nowrap">${fmtDate(x.date)}</td>
                        <td><span class="dp-res dp-res--${esc(x.result)}">${RESULT[x.result] ?? esc(x.result)}</span> ${x.result === 'loss' ? 'to' : 'vs'} ${link(x.opponent, x.opponent_slug)}${x.title ? ' <span class="dp-flag">Title</span>' : ''}<span class="dp-sub">${eventLinkTo(x.event, x.event_slug)}${x.method ? ` · ${esc(x.method)}${x.round ? `, R${x.round}` : ''}` : ''}</span></td>
                        <td class="dp-num">${x.flr_change != null ? signed(x.flr_change, 0) : '—'}</td>${anyFli ? `
                        <td class="dp-num">${x.fli_change != null ? signed(x.fli_change, 2) : '—'}${x.verdict ? `<span class="dp-sub dp-verdict">${VERDICT[x.verdict]}</span>` : ''}</td>` : ''}
                    </tr>`).join('');
    return `
    <section class="pg-body pg-body--rule" aria-labelledby="dp-fights">
        <div class="pg-inner pg-inner--wide">
            <h2 class="pg-h2 pg-h2--small" id="dp-fights" data-r>Recent fights.</h2>
            <div class="dp-table" data-r>
                <table>
                    <thead><tr><th scope="col">Date</th><th scope="col">Fight</th><th scope="col" class="dp-num">FLR</th>${anyFli ? '<th scope="col" class="dp-num">FLI</th>' : ''}</tr></thead>
                    <tbody>${rows}
                    </tbody>
                </table>
            </div>
            <p class="pg-fine" data-r>FLR is the First Light Rating points the fight earned or cost them.${anyFli ? '<br>FLI is what the fight did to their fame against their skill.' : ''}<br>${METHOD_LINK('fight', 'How it is measured')}.</p>
        </div>
    </section>`;
}

export function fighterPage({ f, site, generatedAt, field }) {
    const url = fighterHref(f.slug);
    const fights = f.fights ?? [];
    const map = fieldChart(field, f);
    const course = courseChart(f);
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
    </header>${map ? `
    <section class="pg-body pg-body--rule" aria-labelledby="dp-field">
        <div class="pg-inner pg-inner--wide">
            <h2 class="pg-h2 pg-h2--small" id="dp-field" data-r>Fame against skill.</h2>
            <div data-r>${map}</div>
        </div>
    </section>
    <script src="/field.js" defer></script>` : ''}${course ? `
    <section class="pg-body pg-body--rule" aria-labelledby="dp-course">
        <div class="pg-inner pg-inner--wide">
            <h2 class="pg-h2 pg-h2--small" id="dp-course" data-r>Skill and attention, and where they are heading.</h2>
            <div data-r>${course}</div>
        </div>
    </section>` : ''}${fightsTable(f)}
    <section class="pg-body pg-body--rule">
        <div class="pg-inner pg-inner--wide">
            ${DATA_CREDIT}
            <p class="pg-fine" data-r>${METHOD_LINK('flr', 'How these numbers are made')}.<br>${HOLDINGS_TEXT}</p>
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

// One line under a name: where the fighter stands. "Bantamweight · 30th · FLI +0.48".
const standing = (f) => [f.flr ? `${f.flr.division} · ${ordinal(f.flr.rank)}` : null, f.fli != null ? `FLI ${signed(f.fli, 2)}` : null]
    .filter(Boolean).join(' · ');

export function fightersIndexPage({ fighters, data, site }) {
    const groups = new Map();
    for (const f of [...fighters].sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
        const letter = f.name.normalize('NFD').charAt(0).toUpperCase();
        const key = /[A-Z]/.test(letter) ? letter : '#';
        if (!groups.has(key)) groups.set(key, []);
        groups.get(key).push(f);
    }
    const body = `<main>
    <header class="pg-head pg-head--rankings">
        <div class="pg-inner pg-inner--wide">
            ${subtabs('fighters', data)}
            <p class="pg-lede" data-r style="--d:80ms">Every fighter with a page: the top 30 of each division, and everyone on a card the Observatory read in full. ${num(fighters.length)} in all.</p>
            <div class="dp-find" data-r>
                <label class="sr-only" for="dpFind">Find a fighter</label>
                <input id="dpFind" class="dp-find-in" type="search" placeholder="Find a fighter" autocomplete="off" spellcheck="false" hidden>
            </div>
            <ul class="dp-az" aria-label="Jump to a letter">${[...groups.keys()].map((k) => `<li><a href="#l-${k === '#' ? 'other' : k}">${k}</a></li>`).join('')}</ul>
        </div>
    </header>
    <section class="pg-body pg-body--rule">
        <div class="pg-inner pg-inner--wide" id="dpNames">${[...groups].map(([k, list]) => `
            <div class="dp-group">
                <h2 class="pg-h2 pg-h2--small dp-letter" id="l-${k === '#' ? 'other' : k}">${k}</h2>
                <ul class="dp-names">${list.map((f) => `<li data-n="${esc(f.name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase())}">${link(f.name, f.slug)}${standing(f) ? `<span class="dp-sub">${esc(standing(f))}</span>` : ''}</li>`).join('')}</ul>
            </div>`).join('')}
            <p class="pg-empty dp-none" hidden>No fighter by that name has a page yet.</p>
        </div>
    </section>
</main>
<script>
// Filters the list as you type (accents and case ignored). Without script the box stays hidden
// and the full A to Z list is the page.
(function () {
    var box = document.getElementById('dpFind'), root = document.getElementById('dpNames');
    if (!box || !root) return;
    box.hidden = false;
    var items = Array.prototype.slice.call(root.querySelectorAll('li[data-n]'));
    var groups = Array.prototype.slice.call(root.querySelectorAll('.dp-group'));
    var none = root.querySelector('.dp-none'), az = document.querySelector('.dp-az');
    box.addEventListener('input', function () {
        var q = box.value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
        var shown = 0;
        items.forEach(function (li) { var on = !q || li.getAttribute('data-n').indexOf(q) !== -1; li.hidden = !on; if (on) shown++; });
        groups.forEach(function (g) { g.hidden = !g.querySelector('li[data-n]:not([hidden])'); });
        none.hidden = shown > 0;
        if (az) az.hidden = !!q;
    });
})();
</script>
${FOOTER}`;
    return shell({
        title: `MMA fighters: ratings, fame and fight data — ${BRAND}`,
        description: `${num(fighters.length)} MMA fighters with their First Light Rating, First Light Index, skill curve and what every fight did to their rating.`,
        url: '/fighters/', site, current: 'index', body,
        crumbs: [[BRAND, '/'], ['Index', '/index/'], ['Fighters', '/fighters/']],
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
            ${subtabs('division', data)}
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

// What a fame verdict (observatory/fame_verdict.py) says, in the page's own words.
const VERDICT = { fame_winner: 'Lost, but drew a lot of attention', fame_loser: 'Won, but drew very little attention' };

// The fighters on a card whose attention went against the result, fame winners first.
const turned = (e) => e.bouts.flatMap((b) => [{ ...b.winner, result: 'win' }, { ...b.loser, result: 'loss' }])
    .filter((p) => p.verdict).sort((a, b) => (a.verdict === b.verdict ? Math.abs(b.fli_change) - Math.abs(a.fli_change) : a.verdict === 'fame_winner' ? -1 : 1));

function eventSummary(e) {
    const t = turned(e);
    if (!t.length) return 'Every fighter’s attention followed the result';
    const say = (p) => `${p.name} ${p.verdict === 'fame_winner' ? 'lost, but drew a lot of attention' : 'won, but drew very little attention'}`;
    return t.slice(0, 2).map(say).join('; ') + (t.length > 2 ? `; ${t.length - 2} more` : '');
}

export function eventsIndexPage({ events, data, site }) {
    const body = `<main>
    <header class="pg-head pg-head--rankings">
        <div class="pg-inner pg-inner--wide">
            ${subtabs('events', data)}
            <p class="pg-lede" data-r style="--d:80ms">Every card since the Observatory began reading fights in full, and what each fight did to the fighters’ attention, their skill and the FLI between them.</p>
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
        description: 'Every UFC, PFL, ONE and Rizin card of the last year, with what each fight did to every fighter’s attention, skill and First Light Index.',
        url: '/events/', site, current: 'index', body,
        crumbs: [[BRAND, '/'], ['Events', '/events/']],
    });
}

export function eventPage({ e, site }) {
    const url = eventHref(e.slug);
    const tiles = turned(e).slice(0, 3).map((p) => [VERDICT[p.verdict], p]);
    const side = (p, won) => `<span class="dp-res dp-res--${won ? 'win' : 'loss'}">${won ? 'W' : 'L'}</span> ${link(p.name, p.slug)}${p.flr_change != null ? ` <span class="dp-flr">FLR ${signed(p.flr_change, 0)}</span>` : ''}${p.verdict ? `<span class="dp-sub dp-verdict">${VERDICT[p.verdict]}</span>` : ''}`;
    const fli = (p) => (p.fli_change != null ? signed(p.fli_change, 2) : '—');
    const rows = e.bouts.map((b) => `
                    <tr${b.winner.verdict || b.loser.verdict ? ' class="dp-against"' : ''}>
                        <td>${side(b.winner, true)}<span class="dp-sub">${b.method ? esc(b.method) : ''}${b.round ? `, R${b.round}` : ''}${b.weight_class ? ` · ${esc(b.weight_class)}` : ''}${b.title ? ' · Title' : ''}</span></td>
                        <td class="dp-num">${fli(b.winner)}</td>
                        <td>${side(b.loser, false)}</td>
                        <td class="dp-num">${fli(b.loser)}</td>
                    </tr>`).join('');
    const body = `<main>
    <header class="pg-head">
        <div class="pg-inner pg-inner--wide">
            <p class="art-meta" data-r><a href="/events/">Events</a><span aria-hidden="true"> / </span>${esc(e.promotion && e.promotion !== 'Other' ? e.promotion : 'Event')}<span aria-hidden="true"> · </span><time datetime="${esc(e.date)}">${fmtDate(e.date)}</time></p>
            <h1 class="pg-title pg-title--name" data-r style="--d:60ms">${esc(e.name)}</h1>
            <p class="pg-lede" data-r style="--d:120ms">${esc(eventSummary(e))}.</p>${tiles.length ? `
            <dl class="dp-tiles" data-r>${tiles.map(([label, p]) => `
                <div class="dp-tile"><dt>${label}</dt><dd><span class="dp-tile-v">${signed(p.fli_change, 2)}</span><span class="dp-tile-s">${link(p.name, p.slug)}, ${p.result === 'win' ? 'won' : 'lost'}</span></dd></div>`).join('')}
            </dl>` : ''}
        </div>
    </header>
    <section class="pg-body pg-body--rule" aria-labelledby="dp-card">
        <div class="pg-inner pg-inner--wide">
            <h2 class="pg-h2 pg-h2--small" id="dp-card" data-r>The card.</h2>
            <div class="dp-table" data-r>
                <table>
                    <thead><tr><th scope="col">Winner</th><th scope="col" class="dp-num">FLI</th><th scope="col">Loser</th><th scope="col" class="dp-num">FLI</th></tr></thead>
                    <tbody>${rows}
                    </tbody>
                </table>
            </div>
            <p class="pg-fine" data-r>FLI is what the fight did to each fighter’s fame against their skill; — means it could not be read.<br>FLR is the First Light Rating points the fight earned or cost them. Highlighted fights are where attention went against the result.<br>${METHOD_LINK('fight', 'How it is measured')}.</p>
            ${DATA_CREDIT}
        </div>
    </section>
</main>
${FOOTER}`;
    return shell({
        title: `${e.name}: who the fight made famous — ${BRAND}`,
        description: `${e.name}, ${fmtDate(e.date)}: what every fight on the card did to each fighter’s attention, skill and First Light Index. ${eventSummary(e)}.`,
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
    // FLR and FLI sit in two columns, like the key under the rankings: the acronym large on the
    // left, the text to its right. Every other section is the usual centred reading column.
    const sec = (id, title, html, label = '') => label ? `
    <section class="pg-body pg-body--rule" id="${id}" aria-labelledby="${id}-h">
        <div class="pg-inner pg-inner--wide mt-item">
            <p class="mt-label" aria-hidden="true" data-r>${label}</p>
            <div class="mt-body">
                <h2 class="pg-h2 pg-h2--small" id="${id}-h" data-r>${title}</h2>
                <div class="prose" data-r>${html}</div>
            </div>
        </div>
    </section>` : `
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
    </header>${sec('flr', 'The First Light Rating.', `
            <p>The FLR is a skill rating built for MMA. It starts from Glicko-2, a rating system that tracks both how good a fighter is and how sure it is of that, and adds three things a win-loss record cannot see.</p>
            <ul>
                <li><strong>How the fight was won.</strong> A dominant finish moves the rating more than a split decision.</li>
                <li><strong>Every round, scored.</strong> First Light Scorecards learn how judges score a round from its strikes, takedowns and control time, then score the rounds no judge saw because the fight ended early. A fifth-round loss after four dominant rounds is no longer the same as one after four losing rounds.</li>
                <li><strong>Where a fighter has been competing.</strong> Records built in a regional promotion are weighed by how that promotion’s fighters actually do when they move up.</li>
            </ul>
            <p>The published number is deliberately conservative: it is the rating minus twice its uncertainty, so a fighter with few fights on record sits lower until the results are in. The First Light Rankings order each division by it.</p>`, 'FLR')}${sec('accuracy', 'How accurate it is.', `
            <p>Every fight from ${a.window} was predicted with only what was known the day before it, and the prediction checked against the result. Nothing was fitted on the fights it was scored on.</p>
            <div class="prose-table"><table>
                <thead><tr><th scope="col">Picking the winner</th><th scope="col">Same fights</th><th scope="col">FLR</th><th scope="col">Compared with</th></tr></thead>
                <tbody>
                    <tr><td>Against Fight Matrix</td><td>${num(a.fm.bouts)}</td><td><strong>${a.fm.flr}%</strong></td><td>${a.fm.them}%</td></tr>
                    <tr><td>Against the betting market (closing odds)</td><td>${num(a.market.bouts)}</td><td><strong>${a.market.flr}%</strong></td><td>${a.market.them}%</td></tr>
                    <tr><td>Every rated fight</td><td>${num(a.all.bouts)}</td><td><strong>${a.all.flr}%</strong></td><td>—</td></tr>
                </tbody>
            </table></div>
            <p>On the fights both rate, the FLR picks the winner ${(a.fm.flr - a.fm.them).toFixed(1)} points more often than Fight Matrix, the longest-running algorithmic MMA ranking. Its probabilities are also better calibrated: when the FLR gives a fighter a 70% chance, they win close to 70% of the time (log loss ${a.fm.flrLL.toFixed(3)} against ${a.fm.themLL.toFixed(3)}, lower is better).</p>
            <p>The betting market is better still, and is expected to stay that way: closing odds know about injuries, weight cuts, short-notice replacements and styles, none of which a rating can see. The FLR is a measure of what fighters have shown in the cage, not a betting tool.</p>`)}${sec('fli', 'The First Light Index.', `
            <p>The FLI compares a fighter’s fame with what their FLR would predict. Fame is the size of the audience a fighter commands, read across Google Search, Wikipedia, Instagram, YouTube, TikTok and X, each weighted by what it is worth and brought to one scale. A curve is fitted to fame against skill over every rated fighter, because fame is winner-take-most: the very best are disproportionately famous.</p>
            <p>The FLI is where a fighter sits against that curve, on a scale from −1 to +1. Above zero, their audience is bigger than their skill explains. Below zero, they are better than their audience knows. The arrow on the rankings is its change over about 30 days.</p>`, 'FLI')}${sec('fight', 'What a fight does to the FLI.', `
            <p>A fight moves both sides of the FLI. The rating moves with the performance. Attention moves with how the public took it: the fame the fight added across the platforms the Observatory reads, each weighted by what it is worth, the same way the FLI weighs them. The fight’s FLI change is the two together, in one number.</p>
            <p><strong>When attention goes against the result.</strong> A fighter who lost, whose rating barely moved, and whose fight added at least the attention a winner typically gains, won the night in the eyes of the public. A fighter who won and whose fight added no more attention than a loser typically gains lost it, and the more the rating rose, the more the performance went unrewarded. A rise in the FLI that comes only from a heavy defeat never counts.</p>`)}${sec('phase', 'Career phase.', `
            <p>Each month, a fighter’s FLR is compared with their best so far.</p>
            <ul>
                <li><strong>Developing.</strong> Near their best and still climbing.</li>
                <li><strong>Prime.</strong> At or near their best.</li>
                <li><strong>Declining.</strong> Clearly below their best.</li>
                <li><strong>Inactive.</strong> No fight in two years.</li>
                <li><strong>Unproven.</strong> Too few fights to say.</li>
            </ul>`)}${sec('cite', 'Using this data.', `
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
