// Creates a skeleton for a new private one-off page with a fresh random token.
//
//   npm run new-private
//
// The token is the only thing that protects the page and it is the page's whole address,
// so it is generated here once, stored in the file, and never derived from a name. Rebuilds
// reuse it; the URL only changes if you delete the file and make a new one.

import { randomBytes } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(ROOT, 'data/private');
const token = randomBytes(24).toString('base64url'); // 192 bits, 32 characters

const skeleton = {
    token,
    draft: true, // skipped by the build until you delete this line
    title: 'Media kit',
    updated: new Date().toISOString().slice(0, 10),
    fighter: {
        name: '', nickname: '', record: '', division: '', organization: '', gym: '', location: '',
        bio: '',
        stats: [],
    },
    manager: { name: '', company: '', email: '', phone: '', notes: '' },
    media: [],
    notes: '',
};

await mkdir(dir, { recursive: true });
const file = path.join(dir, `${token}.json`);
await writeFile(file, JSON.stringify(skeleton, null, 2) + '\n', { flag: 'wx' });
console.log(`Created ${path.relative(ROOT, file)}`);
console.log(`Address once built and deployed: /publications/private/${token}/`);
