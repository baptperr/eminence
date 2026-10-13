// Static build: source files + data exports in, a deployable folder out.
//
//   node scripts/build.mjs            → dist/          (real data; this is what gets deployed)
//   node scripts/build.mjs --sample   → dist-preview/  (fictional fixtures + drafts; never deployed)
//
// Only the files listed in STATIC are copied into the output. Everything else in the repo
// (data exports, scripts, docs, the Apps Script source) stays out of what gets served.

import { createHash } from 'node:crypto';
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { imageSize, loadArticles, loadIndex, loadPrivate, loadPublications } from './lib/data.mjs';
import { archivePage, articlePage, BRAND, divisionUrl, indexPage, internalDataPage, manifestoPage, mediaKitPage, notFoundPage, observatoryPage, privatePage, seoHead, setDefaultImage, setFighterPages, winnersLosersPage } from './lib/templates.mjs';
import { byDivision, divisionPage, eventPage, eventsIndexPage, fieldSvg, fighterPage, fightersIndexPage, methodologyPage, rankingsCsv, rankingsJson } from './lib/pages-data.mjs';
import { esc } from './lib/util.mjs';
import { COVER, coverChart, renderCover } from './lib/cover.mjs';

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
    'nav.js', 'menu.js', 'manifesto.js', 'pub-fit.js', 'pub-carousel.js', 'observatory.js', 'fighter.js', 'fuse.min.js',
    'favicon.png', 'logo.png', 'logo.svg',
    'fonts',
    'hero-pc.mp4', 'hero-mobile.mp4', 'brand-universal.mp4', 'promote.mp4', 'monetize.mp4',
    'observatory.mp4', 'observatory-poster.jpg', 'observatory-og.jpg', 'og-home.jpg',
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

    // The preview image (social cards, Discover) for any page without its own: the Observatory's,
    // since nearly every such page is a data page. The homepage has its own (og-home.jpg).
    setDefaultImage({ src: '/observatory-og.jpg', ...(await imageSize(path.join(ROOT, 'observatory-og.jpg'))), alt: 'The First Light Observatory' });

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
    // The manifesto is not listed: it is noindexed until it is written.
    const mtime = async (f) => (await stat(path.join(ROOT, f))).mtime.toISOString();
    const routes = [
        { url: '/', lastmod: await mtime('index.html') },
        { url: '/publications/', lastmod: articles[0]?.date ?? null },
        { url: '/observatory/', lastmod: await mtime('scripts/lib/templates.mjs') },
        { url: '/index/', lastmod: indexData?.generated_at ?? null },
    ];
    await write('index.html', homePage(await readFile(path.join(ROOT, 'index.html'), 'utf8')));
    // Article prose links fighters by exact name; a name two fighters share links to neither.
    const nameCount = new Map();
    for (const f of indexData?.fighters ?? []) nameCount.set(f.name, (nameCount.get(f.name) ?? 0) + 1);
    setFighterPages(new Map((indexData?.fighters ?? []).filter((f) => nameCount.get(f.name) === 1).map((f) => [f.name, `/fighters/${f.slug}/`])));

    await write('404.html', notFoundPage({ site: SITE }));
    await write('publications/index.html', archivePage({ articles, site: SITE }));
    await write('manifesto/index.html', manifestoPage({ site: SITE }));
    await write('observatory/index.html', observatoryPage({ site: SITE }));
    await write('observatory/methodology/index.html', methodologyPage({ site: SITE }));
    routes.push({ url: '/observatory/methodology/', lastmod: await mtime('scripts/lib/pages-data.mjs') });
    await write('index/index.html', indexPage({ data: indexData, articles, site: SITE }));
    if (indexData?.winners_losers) {
        await write('index/winners-losers/index.html', winnersLosersPage({ data: indexData, site: SITE }));
        routes.push({ url: '/index/winners-losers/', lastmod: indexData.generated_at });
    }
    if (indexData) {
        const updated = indexData.generated_at;
        await write('data/rankings.csv', rankingsCsv(indexData, SITE));
        await write('data/rankings.json', rankingsJson(indexData, SITE));
        const fightersBySlug = new Map(indexData.fighters.map((f) => [f.slug, f]));
        for (const [division, rows] of byDivision(indexData.rankings)) {
            if (!division) continue;
            const url = divisionUrl(division);
            await write(`${url.slice(1)}index.html`, divisionPage({ division, rows, data: indexData, fightersBySlug, site: SITE }));
            routes.push({ url, lastmod: updated });
        }
        if (indexData.fighters.length) {
            await write('fighters/index.html', fightersIndexPage({ fighters: indexData.fighters, data: indexData, site: SITE }));
            routes.push({ url: '/fighters/', lastmod: updated });
        }
        // The field every fighter page draws its own fighter over (see fieldChart).
        if (indexData.field) {
            await write('fighters/field.svg', fieldSvg(indexData.field));
            // Who on the field has a page, for fighter.js: [rating, fame, slug, name].
            await write('fighters/field.json', JSON.stringify(indexData.field.pages ?? []));
        }
        for (const f of indexData.fighters) {
            await write(`fighters/${f.slug}/index.html`, fighterPage({ f, site: SITE, generatedAt: updated, field: indexData.field }));
            routes.push({ url: `/fighters/${f.slug}/`, lastmod: updated });
        }
        if (indexData.events.length) {
            await write('events/index.html', eventsIndexPage({ events: indexData.events, data: indexData, site: SITE }));
            routes.push({ url: '/events/', lastmod: indexData.events[0].date });
        }
        for (const e of indexData.events) {
            await write(`events/${e.slug}/index.html`, eventPage({ e, site: SITE }));
            // An event's numbers settle within a few days of it; the page changes rarely after that.
            routes.push({ url: `/events/${e.slug}/`, lastmod: e.date });
        }
    }

    for (const article of articles) {
        // Every article's preview image is a snapshot of one of its charts (lib/cover.mjs), unless
        // its front matter names an image. Without Chrome on this machine it falls back to the default.
        const chart = !article.image && coverChart(article, path.join(ROOT, 'content/publications'));
        if (chart) {
            const out = path.join(OUT, 'publications', article.slug, 'cover.png');
            await mkdir(path.dirname(out), { recursive: true });
            if (await renderCover({ svgFile: chart, outFile: out, fontsDir: path.join(ROOT, 'fonts') })) {
                article.image = { src: `/publications/${article.slug}/cover.png`, ...COVER, alt: `Chart from “${article.title}”` };
            } else {
                console.warn(`  ${article.slug}: no Chrome found for its cover snapshot; using the default image (set CHROME_PATH)`);
            }
        }
        await write(`publications/${article.slug}/index.html`, articlePage({ article, site: SITE }));
        routes.push({ url: `/publications/${article.slug}/`, lastmod: article.updated ?? article.date });
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

    await write('feed.xml', feed(articles));

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

// The homepage is hand-written; its shared head (description, canonical, Open Graph, schema) is
// generated like every other page's and put where the `<!-- seo-head -->` marker is.
const HOME = {
    title: 'First Light — We take a stake in a fighter\'s name',
    description: 'First Light takes an equity stake in a fighter\'s name and builds it: branding, promotion and monetization, guided by Observatory data on 350,000 professional fighters. No fees, no cut of purses.',
};
function homePage(html) {
    if (!html.includes('<!-- seo-head -->')) throw new Error('index.html: the <!-- seo-head --> marker is missing');
    const image = { src: '/og-home.jpg', width: 1200, height: 630, alt: 'We find the person in the fighter and we make the world watch' };
    return html.replace('<!-- seo-head -->', seoHead({ ...HOME, url: '/', site: SITE, image }).join('\n    '));
}

// RSS: a feed readers and aggregators (Feedly, news apps, some search tools) poll for new articles.
function feed(articles) {
    const items = articles.map((a) => `    <item>
      <title>${esc(a.title)}</title>
      <link>${SITE}/publications/${a.slug}/</link>
      <guid isPermaLink="true">${SITE}/publications/${a.slug}/</guid>
      <pubDate>${new Date(`${a.date}T08:00:00Z`).toUTCString()}</pubDate>
      <description>${esc(a.summary)}</description>
    </item>`).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${BRAND}: publications</title>
    <link>${SITE}/publications/</link>
    <atom:link href="${SITE}/feed.xml" rel="self" type="application/rss+xml"/>
    <description>Data on fighters' fame and skill from the First Light Observatory.</description>
    <language>en</language>
${items}
  </channel>
</rss>
`;
}

// Cloudflare lets browsers keep a stylesheet or script for four hours, and a page is fetched fresh, so
// a returning visitor could pair a new page with an old stylesheet (an unstyled dropdown, for one).
// Every local css/js reference gets ?v=<hash of that file's content>, so a changed file is a new URL.
const VERSIONED = ['style.css', 'pages.css', 'manifesto.css', 'publication.css', 'observatory.css', 'nav.js', 'menu.js', 'manifesto.js', 'pub-fit.js', 'pub-carousel.js', 'observatory.js', 'fighter.js', 'fuse.min.js'];
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
