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
    let lastKey = null;
    for (const line of m[1].split(/\r?\n/)) {
        if (!line.trim() || line.trim().startsWith('#')) continue;
        // Indented `- item` lines under a key add list items to it (see `<key>_items`).
        const item = line.match(/^\s+-\s+(.+)$/);
        if (item && lastKey) { (meta[`${lastKey}_items`] ||= []).push(item[1].trim()); continue; }
        const i = line.indexOf(':');
        if (i < 1) throw new Error(`${file}: bad front matter line "${line}"`);
        lastKey = line.slice(0, i).trim();
        meta[lastKey] = line.slice(i + 1).trim().replace(/^(['"])(.*)\1$/, '$2');
    }
    return { meta, body: m[2] };
}

// ── Markdown subset: ##/### headings, paragraphs, - and 1. lists, > quotes, ---, | tables |,
// ![alt](src) images, and **bold** *italic* `code` [text](url) inline. ──
// Escaping happens first and everything after works on escaped text, so nothing in the
// source can inject markup.
function inline(raw) {
    let s = esc(raw).replace(/\s*&lt;br&gt;\s*/gi, '<br>'); // literal <br> is a line break
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

export const OBSERVATORY_URL = '/observatory/';
const OBS_LINK = (text) => `<a href="${OBSERVATORY_URL}">${text}</a>`;

// Article credit for the Observatory, applied to rendered HTML so every article inherits it:
// every "Source: First Light Observatory" is linked, and so is the first other mention in
// the prose. Only text nodes are touched; existing links and figure captions are skipped.
// Plain internal links: followed, no rel attribute.
export function linkObservatory(html) {
    let inA = 0, inCap = 0, first = true;
    return html.split(/(<[^>]+>)/).map((part) => {
        if (part.startsWith('<')) {
            if (/^<a[\s>]/.test(part)) inA++; else if (part === '</a>') inA--;
            else if (part === '<figcaption>') inCap++; else if (part === '</figcaption>') inCap--;
            return part;
        }
        if (inA || inCap) return part;
        return part.replace(/(Source: )?(First Light Observatory|Observatory)/g, (all, src, name) => {
            if (src) { first = false; return `${src}${OBS_LINK(name)}`; }
            if (!first) return all;
            first = false;
            return OBS_LINK(name);
        });
    }).join('');
}

// Credit under every chart: the figure caption plus the link, from one place.
// The one credit under a chart, styled in pages.css as the subtle small line with a thin underline.
export const FIGURE_CREDIT = `<figcaption>Source: ${OBS_LINK('First Light Observatory')}.</figcaption>`;

// A credit the author typed by hand ("*Source: First Light Observatory.*", with or without a
// link) is removed so the template's own credit is the only one. An italic caption that says
// more keeps its words and loses only the credit sentence.
const SOURCE_SENTENCE = /\s*Source: (?:\[First Light Observatory\]\([^)]*\)|First Light Observatory)\.?/g;
function captionWithoutCredit(para) {
    const text = para.join(' ').trim();
    const m = text.match(/^\*([^*]+)\*$/);
    if (!m) return null;
    return m[1].replace(SOURCE_SENTENCE, '').trim();
}

export function renderMarkdown(md, { figureCredit = false } = {}) {
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
            i++;
            // A hand-typed italic credit right after the chart would be a second credit.
            let j = i, extra = '';
            while (j < lines.length && !lines[j].trim()) j++;
            if (figureCredit && j < lines.length && /^\*[^*]/.test(lines[j])) {
                const para = [];
                let k = j;
                while (k < lines.length && lines[k].trim() && !isBlockStart(lines[k])) para.push(lines[k++]);
                const rest = captionWithoutCredit(para);
                if (rest !== null && SOURCE_SENTENCE.test(para.join(' '))) {
                    SOURCE_SENTENCE.lastIndex = 0;
                    if (rest) extra = `<p>${inline(`*${rest}*`)}</p>`;
                    i = k;
                }
                SOURCE_SENTENCE.lastIndex = 0;
            }
            if (src) out.push(`<figure><img src="${esc(src)}" alt="${esc(m[1])}" loading="lazy">${figureCredit ? FIGURE_CREDIT : ''}</figure>${extra}`);
            continue;
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
        // A line ending in a backslash is a hard line break inside the paragraph.
        // A paragraph opening with "Credits:" is the solid end-of-article credit line.
        // A hand-typed "Credits:" line is dropped: the template ends every article with the one
        // "Data Credit: First Light Observatory".
        if (figureCredit && /^Credits: /.test(para[0])) continue;
        const cls = /^Credits: /.test(para[0]) ? ' class="credits"' : '';
        out.push(`<p${cls}>${para.map((l) => (l.endsWith('\\') ? `${inline(l.slice(0, -1).trimEnd())}<br>` : inline(l))).join(' ').replace(/<br> /g, '<br>')}</p>`);
    }
    return out.join('\n');
}
