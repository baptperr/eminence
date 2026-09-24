// Tiny static server for looking at a build locally: `npm run preview`.
// Serves a folder the way Cloudflare does: /foo/ -> foo/index.html, and honours no other magic.

import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const dir = path.resolve(process.argv[2] || 'dist-preview');
const port = Number(process.env.PORT) || 8765;
const TYPES = {
    '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'text/javascript',
    '.svg': 'image/svg+xml', '.png': 'image/png', '.mp4': 'video/mp4', '.woff2': 'font/woff2',
    '.xml': 'application/xml', '.txt': 'text/plain',
};

createServer(async (req, res) => {
    let file = path.join(dir, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(dir)) { res.writeHead(403).end(); return; }
    try {
        if ((await stat(file)).isDirectory()) file = path.join(file, 'index.html');
        const body = await readFile(file);
        res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream' }).end(body);
    } catch {
        res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found');
    }
}).listen(port, () => console.log(`Serving ${path.relative(process.cwd(), dir) || '.'} at http://localhost:${port}/  (ctrl-c to stop)`));
