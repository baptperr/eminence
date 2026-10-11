// Article preview images (social cards, Google Discover): a 1200x630 snapshot of one of the
// article's charts on the site's black, taken with headless Chrome at build time. Every article
// gets one without anyone having to make it: the chart named by `cover_chart:` in the front
// matter, else the first chart in the body. An `image:` in the front matter overrides all this.

import { execFile } from 'node:child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const run = promisify(execFile);
const CHROME = process.env.CHROME_PATH || '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
export const COVER = { width: 1200, height: 630 };

// The chart to use: `cover_chart` (a file in the article's folder) or the first SVG the body shows.
export function coverChart(article, dir) {
    const name = article.coverChart
        ?? article.body.match(new RegExp(`!\\[[^\\]]*\\]\\(/publications/${article.slug}/([^)\\s]+\\.svg)\\)`))?.[1];
    return name ? path.join(dir, article.slug, name) : null;
}

export async function renderCover({ svgFile, outFile, fontsDir }) {
    if (!(await stat(CHROME).then(() => true, () => false))) return false;
    const svg = (await readFile(svgFile, 'utf8')).replace(/<\?xml[^>]*\?>/, '');
    const font = (f) => `url("file://${path.join(fontsDir, f)}") format("woff2")`;
    const html = `<!DOCTYPE html><html><head><meta charset="utf-8"><style>
@font-face { font-family: 'DM Sans'; src: ${font('dm-sans-var-latin.woff2')}; font-weight: 100 1000; }
html, body { margin: 0; width: ${COVER.width}px; height: ${COVER.height}px; background: #000; overflow: hidden; }
body { display: flex; align-items: center; justify-content: center; }
svg { width: ${COVER.width - 120}px; height: ${COVER.height - 100}px; }
</style></head><body>${svg}</body></html>`;
    const tmp = await mkdtemp(path.join(os.tmpdir(), 'cover-'));
    try {
        const page = path.join(tmp, 'cover.html');
        await writeFile(page, html);
        await run(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', '--force-device-scale-factor=1',
            `--window-size=${COVER.width},${COVER.height}`, `--screenshot=${outFile}`, `file://${page}`], { timeout: 30000 });
        return true;
    } finally {
        await rm(tmp, { recursive: true, force: true });
    }
}
