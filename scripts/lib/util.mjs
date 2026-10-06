// Small helpers shared by the build: escaping, URL vetting, dates, and a deliberately
// tiny Markdown renderer for articles. No dependencies.

export function esc(value) {
    return String(value ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Only web, mail and phone links and site-relative paths survive. Everything else
// (javascript:, data:, protocol-relative //host) is dropped rather than escaped.
export function safeUrl(url) {
    const u = String(url ?? '').trim();
    if (/^https?:\/\//i.test(u) || /^mailto:/i.test(u) || /^tel:/i.test(u)) return u;
    if (u.startsWith('/') && !u.startsWith('//')) return u;
    if (u.startsWith('#')) return u;
    return null;
}

export const isExternal = (url) => /^https?:\/\//i.test(url);

const dateFmt = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC',
});
export function fmtDate(iso) {
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) throw new Error(`Not a date: ${iso}`);
    return dateFmt.format(d);
}

export function slugify(text) {
    return String(text).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')
        .replace(/['’]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}

// ── Front matter: `key: value` lines between two `---` fences. ──
export function parseFrontMatter(source, file) {
    const m = source.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) throw new Error(`${file}: missing front matter (--- fences)`);
    const meta = {};
    for (const line of m[1].split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        const i = line.indexOf(':');
        if (i < 1) throw new Error(`${file}: bad front matter line "${line}"`);
        meta[line.slice(0, i).trim()] = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    }
    return { meta, body: m[2] };
}

// ── Markdown subset: ##/### headings, paragraphs, - and 1. lists, > quotes, ---, | tables |,
// ![alt](src) images, and **bold** *italic* `code` [text](url) inline. ──
// Escaping happens first and everything after works on escaped text, so nothing in the
// source can inject markup.
function inline(raw) {
    let s = esc(raw);
    s = s.replace(/`([^`]+)`/g, '<code>$1</code>');
    s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (all, text, href) => {
        const url = safeUrl(href.replace(/&amp;/g, '&'));
        if (!url) return text;
        const ext = isExternal(url) ? ' target="_blank" rel="noopener noreferrer"' : '';
        return `<a href="${esc(url)}"${ext}>${text}</a>`;
    });
    s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    s = s.replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>');
    return s;
}

export function renderMarkdown(md) {
    const lines = md.replace(/\r\n/g, '\n').split('\n');
    const out = [];
    let i = 0;
    const isBlockStart = (l) => /^(#{2,3} |> |- |\d+\. |---\s*$|!\[|\|)/.test(l);
    const cells = (l) => l.trim().replace(/^\||\|$/g, '').split('|').map((c) => c.trim());
    while (i < lines.length) {
        const line = lines[i];
        if (!line.trim()) { i++; continue; }

        let m;
        if ((m = line.match(/^(#{2,3}) (.*)$/))) {
            out.push(`<h${m[1].length}>${inline(m[2])}</h${m[1].length}>`); i++; continue;
        }
        if (/^---\s*$/.test(line)) { out.push('<hr>'); i++; continue; }
        if ((m = line.match(/^!\[([^\]]*)\]\(([^)\s]+)\)\s*$/))) {
            const src = safeUrl(m[2]);
            if (src) out.push(`<figure><img src="${esc(src)}" alt="${esc(m[1])}" loading="lazy"></figure>`);
            i++; continue;
        }
        // | a | b | tables: a header row, a |---|---| rule, then body rows.
        if (line.startsWith('|') && /^\|[\s:|-]+\|\s*$/.test(lines[i + 1] || '')) {
            const head = cells(line).map((c) => `<th>${inline(c)}</th>`).join('');
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].startsWith('|')) {
                rows.push(`<tr>${cells(lines[i++]).map((c) => `<td>${inline(c)}</td>`).join('')}</tr>`);
            }
            out.push(`<div class="prose-table"><table><thead><tr>${head}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`);
            continue;
        }
        if (line.startsWith('> ')) {
            const q = [];
            while (i < lines.length && lines[i].startsWith('> ')) q.push(lines[i++].slice(2));
            out.push(`<blockquote><p>${inline(q.join(' '))}</p></blockquote>`); continue;
        }
        if (/^- /.test(line) || /^\d+\. /.test(line)) {
            const ordered = /^\d+\. /.test(line);
            const items = [];
            while (i < lines.length && (ordered ? /^\d+\. /.test(lines[i]) : /^- /.test(lines[i]))) {
                items.push(`<li>${inline(lines[i++].replace(/^(- |\d+\. )/, ''))}</li>`);
            }
            out.push(ordered ? `<ol>${items.join('')}</ol>` : `<ul>${items.join('')}</ul>`); continue;
        }
        const para = [];
        while (i < lines.length && lines[i].trim() && !isBlockStart(lines[i])) para.push(lines[i++]);
        out.push(`<p>${inline(para.join(' '))}</p>`);
    }
    return out.join('\n');
}
