// Static build: source files + data exports in, a deployable folder out.
//
//   node scripts/build.mjs            → dist/          (real data; this is what gets deployed)
//   node scripts/build.mjs --sample   → dist-preview/  (fictional fixtures + drafts; never deployed)
//
// Only the files listed in STATIC are copied into the output. Everything else in the repo
// (data exports, scripts, docs, the Apps Script source) stays out of what gets served.

import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadArticles, loadIndex, loadPrivate } from './lib/data.mjs';
import { archivePage, articlePage, indexPage, manifestoPage, notFoundPage, privatePage, winnersLosersPage } from './lib/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const SAMPLE = args.has('--sample');

const OUT = path.join(ROOT, SAMPLE ? 'dist-preview' : 'dist');
const DATA = path.join(ROOT, SAMPLE ? 'data/sample' : 'data');
const SITE = (process.env.SITE_URL || 'https://firstlight.agency').replace(/\/$/, '');

const STATIC = [
    'index.html', 'privacy.html', '_redirects',
    'style.css', 'pages.css', 'manifesto.css',
    'nav.js', 'menu.js', 'manifesto.js',
    'favicon.png', 'logo.png', 'logo.svg',
    'fonts',
    'hero-pc.mp4', 'hero-mobile.mp4', 'brand-universal.mp4', 'promote.mp4', 'monetize.mp4',
];

const write = async (rel, content) => {
    const file = path.join(OUT, rel);
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, content);
};

async function walk(dir) {
    const files = [];
    for (const e of await readdir(dir, { withFileTypes: true })) {
        const p = path.join(dir, e.name);
        if (e.isDirectory()) files.push(...(await walk(p)));
        else files.push(p);
    }
    return files;
}

async function main() {
    await rm(OUT, { recursive: true, force: true });
    await mkdir(OUT, { recursive: true });
    for (const item of STATIC) await cp(path.join(ROOT, item), path.join(OUT, item), { recursive: true });

    // A git-triggered Cloudflare build has no access to the local export, so it must not
    // publish the "being compiled" placeholder over a live rankings page. Failing the build
    // leaves the previous deployment serving.
    if (!SAMPLE && (process.env.WORKERS_CI || process.env.CF_PAGES)) {
        const hasData = await readFile(path.join(DATA, 'index.json')).then(() => true, () => false);
        if (!hasData) {
            throw new Error('Cloudflare build without data/index.json: this site is deployed from the laptop (npm run deploy). Disconnect the Git build in Cloudflare, or commit data/index.json.');
        }
    }

    const articles = await loadArticles(path.join(ROOT, 'content/publications'), { drafts: SAMPLE });
    const indexData = await loadIndex(path.join(DATA, 'index.json'));
    const privatePages = await loadPrivate(path.join(DATA, 'private'));

    // Public routes. `lastmod` feeds the sitemap.
    const routes = [
        { url: '/', lastmod: null },
        { url: '/publications/', lastmod: articles[0]?.date ?? null },
        { url: '/publications/manifesto/', lastmod: null },
        { url: '/index/', lastmod: indexData?.generated_at ?? null },
    ];
    await write('404.html', notFoundPage({ site: SITE }));
    await write('publications/index.html', archivePage({ articles, site: SITE }));
    await write('publications/manifesto/index.html', manifestoPage({ site: SITE }));
    await write('index/index.html', indexPage({ data: indexData, articles, site: SITE }));
    if (indexData?.winners_losers) {
        await write('index/winners-losers/index.html', winnersLosersPage({ data: indexData, site: SITE }));
        routes.push({ url: '/index/winners-losers/', lastmod: indexData.generated_at });
    }
    for (const article of articles) {
        await write(`publications/${article.slug}/index.html`, articlePage({ article, site: SITE }));
        routes.push({ url: `/publications/${article.slug}/`, lastmod: article.date });
        // Images and other files that sit next to an article: content/publications/<slug>/*
        const assets = path.join(ROOT, 'content/publications', article.slug);
        await cp(assets, path.join(OUT, 'publications', article.slug), { recursive: true }).catch((e) => {
            if (e.code !== 'ENOENT') throw e;
        });
    }

    // Private pages are written but never added to `routes`, so they cannot reach the
    // sitemap, and nothing above is handed their tokens.
    for (const page of privatePages) {
        await write(`publications/private/${page.token}/index.html`, privatePage({ page, site: SITE }));
    }

    const day = (iso) => (iso ? new Date(iso).toISOString().slice(0, 10) : null);
    await write('sitemap.xml', `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${routes.map((r) => `  <url><loc>${SITE}${r.url}</loc>${r.lastmod ? `<lastmod>${day(r.lastmod)}</lastmod>` : ''}</url>`).join('\n')}
</urlset>
`);

    // No Disallow for /publications/private/: robots.txt is public, so it would publish the
    // path, and a blocked crawler never sees the noindex tag anyway.
    await write('robots.txt', `User-agent: *\nAllow: /\n\nSitemap: ${SITE}/sitemap.xml\n`);

    await write('_headers', `/publications/private/*
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
  Referrer-Policy: no-referrer
  Cache-Control: private, no-store
  X-Content-Type-Options: nosniff
`);

    await versionAssets();

    await verify(privatePages);

    console.log(`${SAMPLE ? 'Sample build' : 'Built'} → ${path.relative(ROOT, OUT)}/`);
    console.log(`  ${articles.length} article(s), index ${indexData ? 'from data' : 'placeholder (no data/index.json)'}, ${privatePages.length} private page(s)`);
    if (SAMPLE) console.log('  Preview only: fictional data. Deploys come from dist/, not this folder.');
}

// Cloudflare lets browsers keep a stylesheet or script for four hours, and a page is fetched fresh, so
// a returning visitor could pair a new page with an old stylesheet (an unstyled dropdown, for one).
// Every local css/js reference gets ?v=<hash of that file's content>, so a changed file is a new URL.
const VERSIONED = ['style.css', 'pages.css', 'manifesto.css', 'nav.js', 'menu.js', 'manifesto.js'];
async function versionAssets() {
    const hashes = {};
    for (const f of VERSIONED) {
        hashes[f] = createHash('sha256').update(await readFile(path.join(OUT, f))).digest('hex').slice(0, 10);
    }
    const ref = new RegExp(`((?:href|src)=")(/?)(${VERSIONED.map((f) => f.replace('.', '\\.')).join('|')})(")`, 'g');
    for (const file of await walk(OUT)) {
        if (!file.endsWith('.html')) continue;
        const html = await readFile(file, 'utf8');
        const next = html.replace(ref, (_, pre, slash, name, post) => `${pre}${slash}${name}?v=${hashes[name]}${post}`);
        if (next !== html) await writeFile(file, next);
    }
}

// Fails the build if anything public points at, or contains, a private page.
async function verify(privatePages) {
    const privRoot = path.join(OUT, 'publications', 'private');
    const problems = [];
    const tokens = privatePages.map((p) => p.token);
    const TEXT = /\.(html|xml|txt|css|js|json|svg|md)$/;

    for (const file of await walk(OUT)) {
        const rel = path.relative(OUT, file).split(path.sep).join('/');
        const inPrivate = file.startsWith(privRoot + path.sep);
        if (inPrivate) {
            const parts = rel.split('/');
            // Exactly publications/private/<token>/index.html — no listing page, nothing else.
            if (!(parts.length === 4 && tokens.includes(parts[2]) && parts[3] === 'index.html')) {
                problems.push(`unexpected file in private tree: ${rel}`);
            } else if (!/name="robots" content="noindex/.test(await readFile(file, 'utf8'))) {
                problems.push(`${rel}: missing noindex`);
            }
            continue;
        }
        if (rel === '_headers' || !TEXT.test(rel)) continue;
        const text = await readFile(file, 'utf8');
        if (text.includes('publications/private')) problems.push(`${rel}: mentions the private path`);
        for (const t of tokens) if (text.includes(t)) problems.push(`${rel}: contains a private token`);
    }

    if (problems.length) {
        console.error('Build aborted, private pages would leak:\n  ' + problems.join('\n  '));
        process.exit(1);
    }
}

main().catch((err) => {
    console.error(err.message);
    process.exit(1);
});
