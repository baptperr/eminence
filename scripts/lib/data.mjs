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
