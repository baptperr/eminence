#!/usr/bin/env node
// Year-by-year line chart in the same look as followers-timeline.mjs: one value per year,
// an optional partial last year (hollow dot, dashed segment), and a dashed threshold line
// that runs into a "call" slot for a future year. Usage:
//   node scripts/charts/yearly-series.mjs scripts/charts/configs/<piece>-<chart>.json
// Config: out, title, alt, footnote, yRange [min,max], gridlines [..], unit {suffix, decimals},
// points [{year, value, partial?}], threshold {value, year, label}.
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
const { suffix = '', decimals = 0, gridDecimals = decimals } = cfg.unit || {};
const fmt = (v, d = decimals) => `${v.toFixed(d)}${suffix}`;

const X0 = 70, X1 = 680, Y0 = 300, YT = 60;
const years = [...cfg.points.map((p) => p.year), ...(cfg.threshold ? [cfg.threshold.year] : [])];
const step = (X1 - X0 - 40) / (years.length - 1);
const x = (yr) => X0 + 20 + (years.indexOf(yr)) * step;
const [vmin, vmax] = cfg.yRange;
const y = (v) => Y0 - ((v - vmin) / (vmax - vmin)) * (Y0 - YT);

const grid = cfg.gridlines.map((v) => `<line x1="${X0}" x2="${X1}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" stroke="#fff" stroke-opacity=".12"/><text x="${X0 - 8}" y="${(y(v) + 4).toFixed(1)}" fill="#a6a6a6" font-size="12" text-anchor="end">${fmt(v, gridDecimals)}</text>`).join('');

const pts = cfg.points.map((p) => ({ ...p, px: x(p.year), py: y(p.value) }));
const solid = pts.filter((p) => !p.partial);
const line = `<polyline fill="none" stroke="#fff" stroke-width="2.5" points="${solid.map((p) => `${p.px.toFixed(1)},${p.py.toFixed(1)}`).join(' ')}"/>`;
const partial = pts.find((p) => p.partial);
const tail = partial ? `<line x1="${solid[solid.length - 1].px}" y1="${solid[solid.length - 1].py}" x2="${partial.px}" y2="${partial.py}" stroke="#fff" stroke-width="2.5" stroke-dasharray="5 4"/>` : '';

// Value labels go above the dot; `below: true` puts one under-right where a threshold line would cross it.
const dots = pts.map((p) => {
    const dot = p.partial
        ? `<circle cx="${p.px}" cy="${p.py.toFixed(1)}" r="4" fill="#000" stroke="#fff" stroke-width="2"/>`
        : `<circle cx="${p.px}" cy="${p.py.toFixed(1)}" r="4" fill="#fff"/>`;
    return `${dot}<text x="${p.below ? p.px + 10 : p.px}" y="${(p.below ? p.py + 20 : p.py - 12).toFixed(1)}" fill="#fff" font-size="12" text-anchor="${p.below ? 'start' : 'middle'}">${fmt(p.value)}${p.partial ? '*' : ''}</text><text x="${p.px}" y="${Y0 + 22}" fill="#a6a6a6" font-size="12" text-anchor="middle">${p.year}${p.partial ? '*' : ''}</text>`;
}).join('');

let th = '';
if (cfg.threshold) {
    const t = cfg.threshold, ty = y(t.value), tx = x(t.year);
    th = `<line x1="${X0}" x2="${X1}" y1="${ty.toFixed(1)}" y2="${ty.toFixed(1)}" stroke="#fff" stroke-opacity=".55" stroke-dasharray="4 4"/>` +
        `<rect x="${tx - 26}" y="${YT - 6}" width="52" height="${Y0 - YT + 6}" fill="#fff" fill-opacity=".06"/>` +
        `<text x="${tx}" y="${(ty - 10).toFixed(1)}" fill="#fff" font-size="12" font-weight="700" text-anchor="middle">${t.label}</text>` +
        `<text x="${tx}" y="${Y0 + 22}" fill="#fff" font-size="12" text-anchor="middle">${t.year}</text>`;
}
const H = 360;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 ${H}" role="img" aria-label="${cfg.alt}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="720" height="${H}" fill="#000"/><text x="${X0}" y="26" fill="#fff" font-size="16" font-weight="700">${cfg.title}</text>${grid}${th}${line}${tail}${dots}<text x="${X0}" y="${H - 10}" fill="#a6a6a6" font-size="11">${cfg.footnote}</text></svg>`;
writeFileSync(resolve(root, cfg.out), svg);
console.log(`wrote ${cfg.out}`);
