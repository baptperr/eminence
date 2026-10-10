#!/usr/bin/env node
// Two-series year-by-year line chart in the look of yearly-series.mjs: a bright series and a
// grey one, hollow dots for partial/thin years, series named directly on the lines. Usage:
//   node scripts/charts/two-lines.mjs scripts/charts/configs/<piece>-<chart>.json
// Config: out, title, alt, footnote, yRange, gridlines, unit {suffix, decimals, gridDecimals},
// series [{name, color, width, labelDy, points:[{year, value, partial?}]}], endLabels [{year}] (value labels).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
const { suffix = '', decimals = 0, gridDecimals = decimals } = cfg.unit || {};
const fmt = (v, d = decimals) => `${v.toFixed(d)}${suffix}`;
const X0 = 70, X1 = 680, Y0 = 300, YT = 60;
const years = cfg.series[0].points.map((p) => p.year);
const step = (X1 - X0 - 80) / (years.length - 1);
const x = (yr) => X0 + 20 + years.indexOf(yr) * step;
const [vmin, vmax] = cfg.yRange;
const y = (v) => Y0 - ((v - vmin) / (vmax - vmin)) * (Y0 - YT);
const grid = cfg.gridlines.map((v) => `<line x1="${X0}" x2="${X1}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#fff" stroke-opacity=".12"/><text x="${X0 - 8}" y="${(y(v) + 4).toFixed(1)}" fill="#a6a6a6" font-size="12" text-anchor="end">${fmt(v, gridDecimals)}</text>`).join('');
const axis = years.map((yr, i) => {
    const thin = cfg.series.some((s) => s.points[i].partial);
    return `<text x="${x(yr)}" y="${Y0 + 22}" fill="#a6a6a6" font-size="12" text-anchor="middle">${yr}${thin ? '*' : ''}</text>`;
}).join('');
const body = cfg.series.map((s) => {
    const pts = s.points.map((p) => ({ ...p, px: x(p.year), py: y(p.value) }));
    const line = `<polyline fill="none" stroke="${s.color}" stroke-width="${s.width}" points="${pts.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ')}"/>`;
    const dots = pts.map((p) => p.partial
        ? `<circle cx="${p.px}" cy="${p.py.toFixed(1)}" r="4" fill="#000" stroke="${s.color}" stroke-width="2"/>`
        : `<circle cx="${p.px}" cy="${p.py.toFixed(1)}" r="4" fill="${s.color}"/>`).join('');
    const vals = (cfg.endLabels || []).map((e) => {
        const p = pts.find((q) => q.year === e.year);
        return `<text x="${p.px}" y="${(p.py + s.labelDy).toFixed(1)}" fill="${s.color}" font-size="12" font-weight="700" text-anchor="middle">${fmt(p.value)}${p.partial ? '*' : ''}</text>`;
    }).join('');
    const last = pts[pts.length - 1];
    const name = `<text x="${(last.px + 14).toFixed(1)}" y="${(last.py + 4).toFixed(1)}" fill="${s.color}" font-size="12">${s.name}</text>`;
    return line + dots + vals + name;
}).join('');
const H = cfg.height || 360;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 ${H}" role="img" aria-label="${cfg.alt}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="720" height="${H}" fill="#000"/><text x="${X0}" y="26" fill="#fff" font-size="16" font-weight="700">${cfg.title}</text>${grid}${body}${axis}${(cfg.footnote || []).map((t, i) => `<text x="${X0}" y="${H - 10 - (cfg.footnote.length - 1 - i) * 14}" fill="#a6a6a6" font-size="11">${t}</text>`).join('')}</svg>`;
writeFileSync(resolve(root, cfg.out), svg);
console.log(`wrote ${cfg.out}`);
