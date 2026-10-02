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
import { loadArticles, loadIndex, loadPrivate, loadPublications } from './lib/data.mjs';
import { archivePage, articlePage, indexPage, internalDataPage, manifestoPage, mediaKitPage, notFoundPage, observatoryPage, privatePage, winnersLosersPage } from './lib/templates.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = new Set(process.argv.slice(2));
const SAMPLE = args.has('--sample');

const OUT = path.join(ROOT, SAMPLE ? 'dist-preview' : 'dist');
const DATA = path.join(ROOT, SAMPLE ? 'data/sample' : 'data');
const SITE = (process.env.SITE_URL || 'https://firstlightequity.com').replace(/\/$/, '');

const STATIC = [
    // privacy.html stays in the repo but is not published for now.
    'index.html', '_redirects',
    'style.css', 'pages.css', 'manifesto.css', 'publication.css', 'observatory.css',
    'nav.js', 'menu.js', 'manifesto.js', 'pub-fit.js', 'pub-carousel.js', 'observatory.js',
    'favicon.png', 'logo.png', 'logo.svg',
    'fonts',
    'hero-pc.mp4', 'hero-mobile.mp4', 'brand-universal.mp4', 'promote.mp4', 'monetize.mp4',
    'observatory.mp4', 'observatory-poster.jpg', 'observatory-og.jpg',
    'observatory-mobile.mp4', 'observatory-poster-mobile.jpg',
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
    const publications = await loadPublications(path.join(DATA, 'publications'));

    // Public routes. `lastmod` feeds the sitemap.
    const routes = [
        { url: '/', lastmod: null },
        { url: '/publications/', lastmod: articles[0]?.date ?? null },
        { url: '/manifesto/', lastmod: null },
        { url: '/observatory/', lastmod: null },
        { url: '/index/', lastmod: indexData?.generated_at ?? null },
    ];
    await write('404.html', notFoundPage({ site: SITE }));
    await write('publications/index.html', archivePage({ articles, site: SITE }));
    await write('manifesto/index.html', manifestoPage({ site: SITE }));
    await write('observatory/index.html', observatoryPage({ site: SITE }));
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

    // Publications: two pages per fighter, each its own token, never added to `routes` either.
    // The route segment is "<slug>-<token>", so a media kit and an internal-data page for the
    // same fighter live under two different directories even though they share a slug.
    const PUB_KIND = {
        media_kit: { segment: 'media-kit', render: mediaKitPage },
        internal_data: { segment: 'internal-data-kit', render: internalDataPage },
    };
    for (const page of publications) {
        const { segment, render } = PUB_KIND[page.kind];
        await write(`publications/kit/${page.slug}-${page.token}/${segment}/index.html`, render({ page, site: SITE }));
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

/publications/kit/*
  X-Robots-Tag: noindex, nofollow, noarchive, nosnippet
  Referrer-Policy: no-referrer
  Cache-Control: private, no-store
  X-Content-Type-Options: nosniff
`);

    await versionAssets();

    await verify(privatePages, publications);

    console.log(`${SAMPLE ? 'Sample build' : 'Built'} → ${path.relative(ROOT, OUT)}/`);
    console.log(`  ${articles.length} article(s), index ${indexData ? 'from data' : 'placeholder (no data/index.json)'}, ${privatePages.length} private page(s), ${publications.length} publication(s)`);
    if (SAMPLE) console.log('  Preview only: fictional data. Deploys come from dist/, not this folder.');
}

// Cloudflare lets browsers keep a stylesheet or script for four hours, and a page is fetched fresh, so
// a returning visitor could pair a new page with an old stylesheet (an unstyled dropdown, for one).
// Every local css/js reference gets ?v=<hash of that file's content>, so a changed file is a new URL.
const VERSIONED = ['style.css', 'pages.css', 'manifesto.css', 'publication.css', 'observatory.css', 'nav.js', 'menu.js', 'manifesto.js', 'pub-fit.js', 'pub-carousel.js', 'observatory.js'];
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

// Fails the build if anything public points at, or contains, a private page or a publication.
async function verify(privatePages, publications) {
    const privRoot = path.join(OUT, 'publications', 'private');
    const kitRoot = path.join(OUT, 'publications', 'kit');
    const problems = [];
    const privTokens = privatePages.map((p) => p.token);
    const kitTokens = publications.map((p) => p.token);
    const TEXT = /\.(html|xml|txt|css|js|json|svg|md)$/;

    // The one file each publication token is allowed to appear in: its own kind's page, under
    // its own slug-token directory. media-kit and internal-data never share a token, so this map
    // alone is what stops one page's build output from ever containing the other's address.
    const PUB_SEGMENT = { media_kit: 'media-kit', internal_data: 'internal-data-kit' };
    const kitExpected = new Map(publications.map((p) => [p.token, `${p.slug}-${p.token}/${PUB_SEGMENT[p.kind]}/index.html`]));

    for (const file of await walk(OUT)) {
        const rel = path.relative(OUT, file).split(path.sep).join('/');
        const inPrivate = file.startsWith(privRoot + path.sep);
        const inKit = file.startsWith(kitRoot + path.sep);

        if (inPrivate) {
            const parts = rel.split('/');
            // Exactly publications/private/<token>/index.html — no listing page, nothing else.
            if (!(parts.length === 4 && privTokens.includes(parts[2]) && parts[3] === 'index.html')) {
                problems.push(`unexpected file in private tree: ${rel}`);
            } else if (!/name="robots" content="noindex/.test(await readFile(file, 'utf8'))) {
                problems.push(`${rel}: missing noindex`);
            }
            continue;
        }

        if (inKit) {
            const relInKit = path.relative(kitRoot, file).split(path.sep).join('/');
            const ownToken = kitTokens.find((t) => relInKit === kitExpected.get(t));
            if (!ownToken) {
                // Exactly publications/kit/<slug>-<token>/{media-kit,internal-data-kit}/index.html —
                // nothing else, no listing page.
                problems.push(`unexpected file in kit tree: ${rel}`);
                continue;
            }
            const text = await readFile(file, 'utf8');
            if (!/name="robots" content="noindex/.test(text)) problems.push(`${rel}: missing noindex`);
            if (!/property="og:title"/.test(text)) problems.push(`${rel}: missing Open Graph tags`);
            // A media-kit page must never contain the internal-data token for the same
            // fighter (or anyone else's), and vice versa — that's the whole point of two tokens.
            for (const t of kitTokens) {
                if (t !== ownToken && text.includes(t)) problems.push(`${rel}: contains another publication's token`);
            }
            continue;
        }

        if (rel === '_headers' || !TEXT.test(rel)) continue;
        const text = await readFile(file, 'utf8');
        if (text.includes('publications/private')) problems.push(`${rel}: mentions the private path`);
        if (text.includes('publications/kit')) problems.push(`${rel}: mentions the publications/kit path`);
        for (const t of [...privTokens, ...kitTokens]) if (text.includes(t)) problems.push(`${rel}: contains a private or publication token`);
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
