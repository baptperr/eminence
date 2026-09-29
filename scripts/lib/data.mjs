// Loading and validating the two data sources. The build fails loudly on malformed
// input rather than publishing half a page: the export script runs unattended.

import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';
import { parseFrontMatter, slugify } from './util.mjs';

export const RESERVED_SLUGS = new Set(['manifesto', 'private']);
export const TOKEN_RE = /^[A-Za-z0-9_-]{32,}$/;

const isObj = (v) => v && typeof v === 'object' && !Array.isArray(v);
const isNum = (v) => typeof v === 'number' && Number.isFinite(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';
const isArr = (v) => Array.isArray(v);

// A section arrives either as a bare array of rows, or as {rows, note, ...} once the
// assembler has an explanation to carry beside them. Both are valid; readers take the
// rows through this and never index the section directly.
const rowsOf = (v) => (Array.isArray(v) ? v : (isObj(v) ? v.rows : undefined));
const isInt = (v) => Number.isInteger(v);
const isDate = (v) => v != null && !Number.isNaN(new Date(v).getTime());

async function readJson(file) {
    try {
        return JSON.parse(await readFile(file, 'utf8'));
    } catch (err) {
        throw new Error(`${file}: ${err.message}`);
    }
}

const exists = (dir) => readdir(dir).then(() => true, () => false);

// ── Articles: content/publications/<slug>.md ──
export async function loadArticles(dir, { drafts }) {
    if (!(await exists(dir))) return [];
    const articles = [];
    for (const name of (await readdir(dir)).sort()) {
        if (!name.endsWith('.md')) continue;
        const file = path.join(dir, name);
        const slug = name.slice(0, -3);
        if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
            throw new Error(`${file}: slug must be lowercase letters, digits and hyphens`);
        }
        if (RESERVED_SLUGS.has(slug)) throw new Error(`${file}: "${slug}" is a reserved route`);

        const { meta, body } = parseFrontMatter(await readFile(file, 'utf8'), file);
        for (const key of ['title', 'date', 'summary']) {
            if (!isStr(meta[key])) throw new Error(`${file}: front matter needs "${key}"`);
        }
        if (Number.isNaN(new Date(meta.date).getTime())) throw new Error(`${file}: bad date "${meta.date}"`);
        const type = meta.type || 'article';
        if (!['article', 'case-study'].includes(type)) {
            throw new Error(`${file}: type must be "article" or "case-study"`);
        }
        const draft = meta.draft === 'true';
        if (draft && !drafts) continue;
        articles.push({ slug, title: meta.title, date: meta.date, summary: meta.summary, type, draft, body });
    }
    return articles.sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : a.slug.localeCompare(b.slug)));
}

// ── /index/ ──
export async function loadIndex(file) {
    let d;
    try {
        d = await readJson(file);
    } catch (err) {
        if (err.message.includes('ENOENT')) return null;
        throw err;
    }
    const bad = (msg) => { throw new Error(`${file}: ${msg}`); };

    if (!isObj(d)) bad('expected an object');
    if (Number.isNaN(new Date(d.generated_at).getTime())) bad('"generated_at" must be an ISO date');
    if (!Array.isArray(d.rankings)) bad('"rankings" must be an array');
    d.rankings.forEach((r, i) => {
        const at = `rankings[${i}]`;
        if (!isStr(r?.name)) bad(`${at}.name missing`);
        if (!Number.isInteger(r.rank) || r.rank < 1) bad(`${at}.rank must be a positive integer`);
        if (r.prev_rank != null && (!Number.isInteger(r.prev_rank) || r.prev_rank < 1)) bad(`${at}.prev_rank must be a positive integer or null`);
        if (r.rating != null && !isNum(r.rating)) bad(`${at}.rating must be a number`);
        if (r.fli != null && (!isNum(r.fli) || Math.abs(r.fli) > 1)) bad(`${at}.fli must be a number between -1 and 1`);
        if (r.fli_status != null && r.fli_status !== 'pending') bad(`${at}.fli_status must be "pending" when present`);
        if (r.fli_status === 'pending' && r.fli != null) bad(`${at} is pending, so it must not carry an fli`);
        if (r.fli_trend != null) {
            const t = r.fli_trend;
            if (!['up', 'down', 'flat'].includes(t.dir)) bad(`${at}.fli_trend.dir must be up, down or flat`);
            if (!isNum(t.delta)) bad(`${at}.fli_trend.delta must be a number`);
            if (!Number.isInteger(t.days) || t.days < 1) bad(`${at}.fli_trend.days must be a positive integer`);
        }
        if (r.fli_history != null) {
            if (!Array.isArray(r.fli_history)) bad(`${at}.fli_history must be an array`);
            r.fli_history.forEach((p, j) => {
                if (Number.isNaN(new Date(p?.date).getTime())) bad(`${at}.fli_history[${j}].date must be a date`);
                if (!isNum(p.fli) || Math.abs(p.fli) > 1) bad(`${at}.fli_history[${j}].fli must be between -1 and 1`);
            });
            const dates = r.fli_history.map((p) => p.date);
            if (dates.some((x, j) => j && x <= dates[j - 1])) bad(`${at}.fli_history must be oldest first, one point per date`);
        }
    });

    // Winners lost the fight and gained a lot of fame; losers won it and gained hardly any (their
    // change can be slightly positive). The export sets the bar; the build only refuses a list
    // whose results or signs contradict its heading.
    let wl = null;
    if (d.winners_losers != null) {
        wl = d.winners_losers;
        for (const [side, outcome, sign] of [['winners', 'loss', 1], ['losers', 'win', -1]]) {
            if (!Array.isArray(wl[side])) bad(`"winners_losers.${side}" must be an array`);
            wl[side].forEach((e, i) => {
                const at = `winners_losers.${side}[${i}]`;
                if (!isStr(e?.name)) bad(`${at}.name missing`);
                if (e.outcome !== outcome) bad(`${at}.outcome must be "${outcome}"`);
                if (!isNum(e.change) || (sign > 0 && e.change <= 0)) bad(`${at}.change must be ${sign > 0 ? 'positive' : 'a number'}`);
                if (e.date != null && Number.isNaN(new Date(e.date).getTime())) bad(`${at}.date must be a date`);
            });
        }
    }
    return { ...d, winners_losers: wl };
}

// ── /publications/private/<token>/ ──
export async function loadPrivate(dir) {
    if (!(await exists(dir))) return [];
    const pages = [];
    const seen = new Set();
    for (const name of (await readdir(dir)).sort()) {
        if (!name.endsWith('.json')) continue;
        const file = path.join(dir, name);
        const d = await readJson(file);
        const bad = (msg) => { throw new Error(`${file}: ${msg}`); };

        if (!isObj(d)) bad('expected an object');
        if (!TOKEN_RE.test(d.token ?? '')) {
            bad('"token" must be 32+ characters of A-Z a-z 0-9 - _ (generate one with `npm run new-private`)');
        }
        if (seen.has(d.token)) bad('duplicate token');
        seen.add(d.token);

        // A slug is a bearer credential and must carry no information: reject any token
        // that contains the fighter's or manager's name, however the name is split.
        const lowerToken = d.token.toLowerCase().replace(/[-_]/g, '');
        for (const who of [d.fighter?.name, d.fighter?.nickname, d.manager?.name]) {
            if (!who) continue;
            const parts = [slugify(who).replace(/-/g, ''), ...slugify(who).split('-').filter((p) => p.length >= 4)];
            if (parts.some((p) => p && lowerToken.includes(p))) bad('token contains a name; generate a random one');
        }

        if (d.draft === true) { console.log(`  skipping draft private page ${name}`); continue; }

        if (!d.fighter && !d.manager && !d.media) bad('needs at least one of "fighter", "manager", "media"');
        if (d.fighter && !isStr(d.fighter.name)) bad('"fighter.name" missing');
        if (d.manager && !isStr(d.manager.name)) bad('"manager.name" missing');
        if (d.media && !Array.isArray(d.media)) bad('"media" must be an array');
        (d.media ?? []).forEach((m, i) => {
            if (!isStr(m?.label) || !isStr(m?.url)) bad(`media[${i}] needs "label" and "url"`);
        });
        if (d.updated && Number.isNaN(new Date(d.updated).getTime())) bad('"updated" must be a date');
        pages.push(d);
    }
    return pages;
}

// ── /publications/kit/<slug>-<token>/{media-kit,internal-data}/ ──
//
// Contract: observatory-publications/docs/publications-contract.md. One envelope shape for
// both kinds; `kind` picks which of the two allowlisted `data` schemas applies.
//
// Unlike loadPrivate, the slug is deliberately readable (it's the fighter's own slug, part of
// a link a manager forwards) so the name-in-slug check does not apply here. But the token is
// still the only secret in the URL, so it must still never contain the fighter's name.
export const PUBLICATION_KINDS = ['media_kit', 'internal_data'];
const SLUG_RE = /^[a-z0-9]+(-[a-z0-9]+)*$/;

// Two generations of <series>. v1/v2: pre-scaled pixel geometry, no domain attached (still
// what the media kit and any publication generated before the payload rewrite carry). v3:
// values plus their own domain -- x/y axis descriptors and {x,y} data points -- so the page
// can draw real, labelled axes instead of a bare line shape. Both are accepted; the renderer
// picks its rendering path per series (see templates.mjs's isAxisSeries).
const isOldSeries = (v) => isObj(v) && isNum(v.width) && isNum(v.height) && isStr(v.points);
// An x coordinate is a number on a day-offset or value axis and an ISO date on a date
// axis -- the assembler sends dates as dates rather than as days-since-some-epoch the page
// would have to be told how to decode. y is always a number.
const isCoord = (v) => isNum(v) || isDate(v);
const isPoint = (v) => isObj(v) && isCoord(v.x) && isNum(v.y);
const isAxisDesc = (v) => isObj(v) && isStr(v.label)
    && (v.min == null || isCoord(v.min)) && (v.max == null || isCoord(v.max))
    && (v.ticks == null || (isArr(v.ticks) && v.ticks.every((t) => isCoord(t?.value) && isStr(t?.label))));
const isNewSeries = (v) => isObj(v) && isAxisDesc(v.x) && isAxisDesc(v.y)
    && isArr(v.points) && v.points.every(isPoint);

function checkSeries(v, label, bad) {
    if (v == null) return;
    if (isNewSeries(v)) {
        if (v.extra != null) {
            if (!isObj(v.extra) || !isStr(v.extra.label) || !isArr(v.extra.points) || !v.extra.points.every(isPoint)) {
                bad(`"${label}.extra" must be {label, points} or null`);
            }
        }
        if (v.markers != null) {
            if (!isArr(v.markers)) bad(`"${label}.markers" must be an array`);
            v.markers.forEach((m, i) => {
                if (!isCoord(m?.x) || !isStr(m?.label)) bad(`"${label}.markers[${i}]" needs "x" (number or date) and a "label" string`);
            });
        }
        if (v.ref_lines != null) {
            if (!isArr(v.ref_lines)) bad(`"${label}.ref_lines" must be an array`);
            v.ref_lines.forEach((r, i) => {
                if (!isNum(r?.y) || !isStr(r?.label)) bad(`"${label}.ref_lines[${i}]" needs numeric "y" and a "label" string`);
            });
        }
        return;
    }
    if (!isOldSeries(v)) bad(`"${label}" must be a chart series ({x,y,points,...} or the older {width,height,points,...}) or null`);
    if (v.extra_points != null && !isStr(v.extra_points)) bad(`"${label}.extra_points" must be a string or null`);
    if (v.labels != null) {
        if (!isArr(v.labels)) bad(`"${label}.labels" must be an array`);
        v.labels.forEach((l, i) => {
            if (!isNum(l?.x) || !isNum(l?.y) || !isStr(l?.text)) {
                bad(`"${label}.labels[${i}]" needs numeric "x", "y" and a "text" string`);
            }
        });
    }
}

function checkRecord(rec, label, bad) {
    if (!isObj(rec)) bad(`"${label}" must be an object`);
    for (const k of ['wins', 'losses', 'draws', 'ncs']) {
        if (!isInt(rec[k]) || rec[k] < 0) bad(`"${label}.${k}" must be a non-negative integer`);
    }
}

// ── media_kit.data: counts a sponsor could verify and direct ratios over them. Nothing
// modelled (no FLI, no expected slot, no market value, no percentile, no cohort) is read here
// — the fields simply don't exist on this branch, so no template mistake can surface them. ──
function checkMediaKit(data, bad) {
    if (!isObj(data.fighter)) bad('"data.fighter" must be an object');
    if (!isStr(data.fighter.name)) bad('"data.fighter.name" missing');
    checkRecord(data.fighter.record, 'data.fighter.record', bad);
    if (data.fighter.streak != null) {
        const s = data.fighter.streak;
        if (!isObj(s) || !isStr(s.result) || !isInt(s.n) || s.n < 1) bad('"data.fighter.streak" must be {result, n} or null');
    }

    if (data.rank != null) {
        const r = data.rank;
        if (!isObj(r) || !isStr(r.source) || !isStr(r.division) || !isInt(r.rank) || typeof r.is_champion !== 'boolean') {
            bad('"data.rank" must be {source, division, rank, is_champion} or null');
        }
    }

    if (data.next_fight != null) {
        const n = data.next_fight;
        if (!isObj(n) || !isDate(n.date) || !isStr(n.event) || !isStr(n.promotion) || !isStr(n.opponent)) {
            bad('"data.next_fight" must be {date, event, promotion, opponent} or null');
        }
    }

    if (!isArr(data.social)) bad('"data.social" must be an array');
    data.social.forEach((s, i) => {
        const at = `data.social[${i}]`;
        if (!isStr(s?.platform)) bad(`"${at}.platform" missing`);
        for (const k of ['followers', 'avg_likes', 'avg_comments', 'avg_video_views', 'posts_per_30d', 'engagement_rate']) {
            if (s?.[k] != null && !isNum(s[k])) bad(`"${at}.${k}" must be a number or null`);
        }
        // engagement_rate is a median over "the last handful of posts", not a 30-day window —
        // the payload must carry the honest label so the page never states it as one.
        if (!isStr(s?.engagement_basis)) bad(`"${at}.engagement_basis" missing`);
        if (!isArr(s?.media_mix)) bad(`"${at}.media_mix" must be an array`);
        s.media_mix.forEach((m, j) => {
            if (!isStr(m?.type) || !isNum(m?.share)) bad(`"${at}.media_mix[${j}]" needs "type" and a numeric "share"`);
        });
        if (!isDate(s?.measured_on)) bad(`"${at}.measured_on" must be a date`);
    });

    // Optional now: the posting calendar replaced the top-posts list, and a payload that
    // carries only the calendar is the current shape, not a malformed one. Still validated
    // where present, since older publications on the site were generated with it.
    if (data.top_posts != null && !isArr(data.top_posts)) bad('"data.top_posts" must be an array when present');
    (data.top_posts ?? []).forEach((p, i) => {
        const at = `data.top_posts[${i}]`;
        if (!isStr(p?.platform)) bad(`"${at}.platform" missing`);
        if (!isStr(p?.media_type)) bad(`"${at}.media_type" missing`);
        if (!isDate(p?.date)) bad(`"${at}.date" must be a date`);
        for (const k of ['likes', 'comments', 'views']) {
            if (p?.[k] != null && !isNum(p[k])) bad(`"${at}.${k}" must be a number or null`);
        }
    });

    if (data.wikipedia != null) {
        const w = data.wikipedia;
        if (!isObj(w) || !isNum(w.views_per_day) || !isInt(w.window_days)) {
            bad('"data.wikipedia" must be {views_per_day, window_days, languages} or null');
        }
        if (!isArr(w.languages)) bad('"data.wikipedia.languages" must be an array');
        w.languages.forEach((l, i) => {
            if (!isStr(l?.market) || !isNum(l?.share) || !isNum(l?.views)) {
                bad(`"data.wikipedia.languages[${i}]" needs "market", numeric "share" and numeric "views"`);
            }
        });
    }

    if (data.market_concentration != null) {
        const mc = data.market_concentration;
        if (!isObj(mc)) bad('"data.market_concentration" must be an object or null');
        if (!isStr(mc.basis)) bad('"data.market_concentration.basis" missing');
        // Two shapes. `countries` carries the two relative indices per country, each rescaled
        // to its own top market at 100 — magnitudes, so the page can show how far apart the
        // markets are rather than only their order. `countries_ranked` is the older
        // order-only list, still accepted so publications generated before the change keep
        // rendering. Exactly one of them must be present.
        if (mc.countries != null) {
            if (!isArr(mc.countries)) bad('"data.market_concentration.countries" must be an array');
            mc.countries.forEach((c, i) => {
                const at = `data.market_concentration.countries[${i}]`;
                if (!isStr(c?.country)) bad(`"${at}.country" missing`);
                for (const k of ['search_volume_index', 'market_value_index']) {
                    if (c?.[k] != null && !isNum(c[k])) bad(`"${at}.${k}" must be a number or null`);
                }
            });
        } else if (isArr(mc.countries_ranked) && mc.countries_ranked.every(isStr)) {
            // Order, never magnitude: a percentage or count in a NAME would read as a share
            // of audience, which Google Trends does not measure.
            if (mc.countries_ranked.some((c) => /[%\d]/.test(c))) {
                bad('"data.market_concentration.countries_ranked" must carry order only, not a percentage or count');
            }
        } else {
            bad('"data.market_concentration" needs "countries" (with indices) or "countries_ranked" (names only)');
        }
    }

    // Moving from one object (the most recent scored fight only) to a list of recent fights —
    // accept the legacy bare object, a bare array, or {rows, note} (the same convention
    // broadcast/off_cycle already use), so a build never breaks on whichever shape lands first.
    if ((data.fight_weeks ?? data.fight_week) != null) {
        const raw = data.fight_weeks ?? data.fight_week;
        const rows = isArr(raw) ? raw : (isArr(raw?.rows) ? raw.rows : [raw]);
        rows.forEach((fw, i) => {
            const at = `${data.fight_weeks ? 'data.fight_weeks' : 'data.fight_week'}.rows[${i}]`;
            if (!isObj(fw) || !isDate(fw.fight_date) || !isStr(fw.opponent) || !isNum(fw.lift_ratio)
                || !isNum(fw.peak_views_per_day) || !isNum(fw.baseline)) {
                bad(`"${at}" must be {fight_date, opponent, lift_ratio, peak_views_per_day, baseline}`);
            }
            // A per-fight curve travels on the row itself once the payload sends one there
            // (the same place internal_data.retention.rows keeps its curve) — optional, since
            // the single legacy fight_week object still gets its chart from data.charts.fight_week.
            if (fw?.curve != null) checkSeries(fw.curve, `${at}.curve`, bad);
            if (fw?.chart != null) checkSeries(fw.chart, `${at}.chart`, bad);
        });
    }

    const broadcast = rowsOf(data.broadcast);
    if (!isArr(broadcast)) bad('"data.broadcast" must be an array, or {rows, note}');
    broadcast.forEach((b, i) => {
        const at = `data.broadcast[${i}]`;
        if (!isDate(b?.date)) bad(`"${at}.date" must be a date`);
        for (const k of ['event', 'promotion', 'card_section', 'event_tier', 'result']) {
            if (!isStr(b?.[k])) bad(`"${at}.${k}" missing`);
        }
        // Not required yet (contract update in flight): the payload is adding the opponent's
        // name to each row, but an older publication generated before it lands must still pass.
        if (b?.opponent != null && !isStr(b.opponent)) bad(`"${at}.opponent" must be a string`);
    });

    if (!isObj(data.charts)) bad('"data.charts" must be an object');
    for (const k of ['followers', 'pageviews', 'fight_week']) checkSeries(data.charts[k], `data.charts.${k}`, bad);
}

// ── internal_data.data: the modelled read, for the fighter's own manager. ──
function checkInternalData(data, bad) {
    if (data.first_light != null) {
        const fl = data.first_light;
        // `gap` was the index's own magnitude delta under a caption claiming audience
        // units; v3 replaced it with `audience_gap` (measured minus predicted, a real
        // count). Either is accepted so publications generated before the change keep
        // rendering, but one of them must be there.
        const gap = fl?.audience_gap ?? fl?.gap;
        if (!isObj(fl) || !isNum(fl.score) || !isNum(fl.rating) || !isNum(fl.expected) || !isNum(fl.actual)
            || !isNum(gap) || !isStr(fl.reading)) {
            bad('"data.first_light" needs {score, rating, expected, actual, reading} and audience_gap (or the older gap)');
        }
    }

    // The field: the Observatory's own scatter, geometry and words both from the payload.
    // Optional (a publication generated before it existed has none), but never half-formed.
    if (data.field != null) {
        const f = data.field;
        const pt = (p) => isArr(p) && p.length === 2 && isNum(p[0]) && isNum(p[1]);
        if (!isObj(f) || !isStr(f.verdict) || !isNum(f.width) || !isNum(f.height) || !isObj(f.plot)
            || !isObj(f.x) || !isStr(f.x.label) || !isArr(f.x.ticks)
            || !isObj(f.y) || !isStr(f.y.label) || !isArr(f.y.ticks)
            || !isArr(f.peers) || !f.peers.every(pt)
            || !isObj(f.you) || !isNum(f.you.x) || !isNum(f.you.y) || !isStr(f.you.name)) {
            bad('"data.field" must be {verdict, width, height, plot, x, y, peers: [[x, y]], fit, you: {x, y, name}} or null');
        }
    }

    if (data.funnel != null) {
        const fn = data.funnel;
        if (!isObj(fn) || !isArr(fn.stages) || !isObj(fn.graphic)) bad('"data.funnel" must be {stages, graphic, leak} or null');
        if (!isObj(fn.leak) || !isStr(fn.leak.sentence)) bad('"data.funnel.leak" must have a "sentence"');
    }

    if (data.geography != null) {
        const g = data.geography;
        if (!isObj(g) || !isArr(g.countries)) bad('"data.geography" must be {countries, languages} or null');
        g.countries.forEach((c, i) => {
            const at = `data.geography.countries[${i}]`;
            if (!isStr(c?.country)) bad(`"${at}.country" missing`);
            if (c?.search_volume_index != null && !isNum(c.search_volume_index)) bad(`"${at}.search_volume_index" must be a number or null`);
            if (c?.market_value_index != null && !isNum(c.market_value_index)) bad(`"${at}.market_value_index" must be a number or null`);
            if (typeof c?.estimated !== 'boolean') bad(`"${at}.estimated" must be a boolean`);
        });
        if (!isArr(g.languages)) bad('"data.geography.languages" must be an array');
        g.languages.forEach((l, i) => {
            if (!isStr(l?.market) || !isNum(l?.share) || !isNum(l?.views)) {
                bad(`"data.geography.languages[${i}]" needs "market", numeric "share" and numeric "views"`);
            }
        });
    }

    // Either a bare array of fights, or {note, rows, compounding} — the same two shapes
    // off_cycle accepts, for the same reason: a section's own explanation belongs beside
    // its rows, and the assembler groups them that way once a section grows one.
    const retentionRows = rowsOf(data.retention);
    if (!isArr(retentionRows)) bad('"data.retention" must be an array, or {rows, note, compounding}');
    retentionRows.forEach((r, i) => {
        const at = `data.retention[${i}]`;
        if (!isDate(r?.fight_date)) bad(`"${at}.fight_date" must be a date`);
        if (!isStr(r?.opponent)) bad(`"${at}.opponent" missing`);
        for (const k of ['search_afterglow', 'wiki_afterglow', 'growth_velocity', 'peak', 'baseline']) {
            if (r?.[k] != null && !isNum(r[k])) bad(`"${at}.${k}" must be a number or null`);
        }
        checkSeries(r?.curve, `${at}.curve`, bad);
    });
    // compounding sits beside the rows once the assembler groups them, never inside the
    // array itself -- checked only when present, since it's still an optional block.
    const compounding = isObj(data.retention) ? data.retention.compounding : null;
    if (compounding != null) checkSeries(compounding.chart, 'data.retention.compounding.chart', bad);

    // Absent entirely when a fighter has no off-cycle events, which is the rule that no
    // section renders a heading over nothing: a null here is the correct shape, not a
    // malformed payload. Same for every other optional section below.
    const offCycle = data.off_cycle == null ? [] : rowsOf(data.off_cycle);
    if (!isArr(offCycle)) bad('"data.off_cycle" must be an array, {rows, note}, or absent');
    offCycle.forEach((o, i) => {
        const at = `data.off_cycle[${i}]`;
        if (!isDate(o?.week_start)) bad(`"${at}.week_start" must be a date`);
        if (!isNum(o?.ratio)) bad(`"${at}.ratio" must be a number`);
        if (o?.baseline != null && !isNum(o.baseline)) bad(`"${at}.baseline" must be a number or null`);
        if (o?.nearest_bout_date != null && !isDate(o.nearest_bout_date)) bad(`"${at}.nearest_bout_date" must be a date or null`);
        if (o?.days_from_bout != null && !isInt(o.days_from_bout)) bad(`"${at}.days_from_bout" must be an integer or null`);
    });

    if (data.billing != null) {
        const b = data.billing;
        if (!isObj(b) || !isArr(b.rows)) bad('"data.billing" must be {rows, chart} or null');
        b.rows.forEach((row, i) => {
            const at = `data.billing.rows[${i}]`;
            if (!isDate(row?.date)) bad(`"${at}.date" must be a date`);
            for (const k of ['event', 'card_section', 'event_tier']) {
                if (!isStr(row?.[k])) bad(`"${at}.${k}" missing`);
            }
            // actual/expected/signal are the billing model's own numbers (roughly 0..1,
            // signal signed). Null together when one corner carried no rating at fit
            // time — excluded from the model, never imputed.
            for (const k of ['actual', 'expected', 'signal']) {
                if (row?.[k] != null && !isNum(row[k])) bad(`"${at}.${k}" must be a number or null`);
            }
        });
        checkSeries(b.chart, 'data.billing.chart', bad);
    }

    if (data.cohort != null) {
        const c = data.cohort;
        if (!isObj(c)) bad('"data.cohort" must be an object or null');
        const t = c.target;
        if (!isObj(t) || !isStr(t.metric) || !isStr(t.label) || !isNum(t.fighter_value) || !isNum(t.peer_median)
            || !isStr(t.basis) || !isInt(t.n)) {
            bad('"data.cohort.target" must be {metric, label, fighter_value, peer_median, basis, n}');
        }
        if (!isArr(c.differentiators)) bad('"data.cohort.differentiators" must be an array');
        c.differentiators.forEach((d, i) => {
            const at = `data.cohort.differentiators[${i}]`;
            if (!isStr(d?.metric) || !isStr(d?.label)) bad(`"${at}" needs "metric" and "label"`);
            if (!isNum(d?.fighter_value)) bad(`"${at}.fighter_value" must be a number`);
            if (!isNum(d?.better_median) || !isNum(d?.worse_median)) bad(`"${at}" needs numeric "better_median" and "worse_median"`);
            if (!isInt(d?.n_better) || !isInt(d?.n_worse)) bad(`"${at}" needs integer "n_better" and "n_worse"`);
            // v3 dropped the pixel width/height and added an `x` axis descriptor, with
            // `marker`, `values` and `bins` all on the metric's own value scale (they used
            // to disagree: marker was pixel-scaled while bins stayed raw). Either shape
            // validates; the renderer draws the axis only when `x` is there.
            const dist = d?.distribution;
            const distOk = isObj(dist) && isArr(dist.values) && isArr(dist.bins)
                && (isAxisDesc(dist.x) || (isNum(dist.width) && isNum(dist.height)));
            if (!distOk) {
                bad(`"${at}.distribution" must be {values, bins, marker} with an "x" axis (or the older width/height)`);
            }
            if (!isStr(d?.sentence)) bad(`"${at}.sentence" missing`);
            // A differentiator observes; it never instructs. This is a loud safety net, not a
            // style-checker — the assembler is what actually guarantees the tone.
            if (/\b(must|should|needs? to|ought to)\b/i.test(d?.sentence ?? '')) {
                bad(`"${at}.sentence" reads as an instruction, not an observation`);
            }
        });
    }
}

export async function loadPublications(dir) {
    if (!(await exists(dir))) return [];
    const pages = [];
    const seen = new Set();
    for (const name of (await readdir(dir)).sort()) {
        if (!name.endsWith('.json')) continue;
        const file = path.join(dir, name);
        const d = await readJson(file);
        const bad = (msg) => { throw new Error(`${file}: ${msg}`); };

        if (!isObj(d)) bad('expected an object');
        if (!TOKEN_RE.test(d.token ?? '')) {
            bad('"token" must be 32+ characters of A-Z a-z 0-9 - _');
        }
        if (seen.has(d.token)) bad('duplicate token');
        seen.add(d.token);

        if (isStr(d.fighter_name)) {
            const lowerToken = d.token.toLowerCase().replace(/[-_]/g, '');
            const parts = [slugify(d.fighter_name).replace(/-/g, ''), ...slugify(d.fighter_name).split('-').filter((p) => p.length >= 4)];
            if (parts.some((p) => p && lowerToken.includes(p))) bad('token contains the fighter\'s name; generate a random one');
        }

        if (!PUBLICATION_KINDS.includes(d.kind)) bad('"kind" must be "media_kit" or "internal_data"');
        if (!SLUG_RE.test(d.slug ?? '')) bad('"slug" must be lowercase letters, digits and hyphens');
        if (!isStr(d.fighter_name)) bad('"fighter_name" missing');
        if (!isDate(d.generated_at)) bad('"generated_at" must be an ISO date');
        if (!isDate(d.measured_on)) bad('"measured_on" must be a date');
        if (!isObj(d.data)) bad('"data" must be an object');

        (d.kind === 'media_kit' ? checkMediaKit : checkInternalData)(d.data, bad);

        pages.push(d);
    }
    return pages;
}
