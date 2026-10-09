#!/usr/bin/env node
// Standard winners-losers measurement chart: a fighter's follower count over time,
// with named phase brackets. Reusable across pieces: copy a config from ./configs,
// change the data and `phases`, and run:
//   node scripts/charts/followers-timeline.mjs scripts/charts/configs/<piece>.json
// Output path comes from config.out (relative to the repo root).
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const cfg = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'));
const day = (s) => Date.parse(s + 'T00:00:00Z') / 864e5;
const fmtDate = (s) => { const d = new Date(s + 'T00:00:00Z'); return `${d.getUTCDate()} ${d.toLocaleString('en', { month: 'short', timeZone: 'UTC' })}`; };
const k = (v) => `${(v / 1000).toFixed(1)}k`;

const X0 = 70, X1 = 680, Y0 = 330, YT = 50;
const [d0, d1] = [day(cfg.start), day(cfg.end)];
const [vmin, vmax] = cfg.yRange;
const x = (s) => X0 + ((day(s) - d0) / (d1 - d0)) * (X1 - X0);
// y scale: vmin at Y0, 80k-equivalent gridline spacing of 112px per 20k
const ypx = (v) => Y0 - ((v - vmin) / 20000) * 112;

const phases = cfg.phases || [];
const rows = [];       // label rows to avoid overlapping text
const tw = (t) => t.length * 5.9;
const valueOn = (s) => { const f = cfg.points.find((q) => q.date === s); if (!f) throw new Error(`no point on ${s} for phase label`); return f.value; };
// "{pct}" in a phase label becomes the % change between the points on the phase's start and end dates.
const pctText = (p) => { const c = (valueOn(p.end) / valueOn(p.start) - 1) * 100; return `${c >= 0 ? '+' : '\u2212'}${Math.abs(c).toFixed(1)}%`; };
const phaseSvg = phases.map((raw) => {
  const p = { ...raw, label: raw.label.replace('{pct}', pctText(raw)) };
  const a = x(p.start), b = x(p.end), mid = (a + b) / 2, w = tw(p.label);
  let lx = mid, anchor = 'middle';
  if (b - a < w) { lx = a; anchor = 'start'; }
  const lo = anchor === 'middle' ? lx - w / 2 : lx, hi = lo + w;
  let r = rows.findIndex((last) => lo > last + 8);
  if (r < 0) { r = rows.length; rows.push(hi); } else rows[r] = hi;
  return `<path d="M${a} 360v8M${a} 364H${b}M${b} 360v8" fill="none" stroke="#fff" stroke-width="1.5"/>` +
    `<text x="${lx}" y="${382 + r * 14}" fill="#fff" font-size="11" text-anchor="${anchor}">${p.label}</text>`;
}).join('');
const H = 382 + Math.max(rows.length, 1) * 14 + 24;

const grid = (cfg.gridlines || []).map((v) => `<line x1="${X0}" x2="${X1}" y1="${ypx(v).toFixed(1)}" y2="${ypx(v).toFixed(1)}" stroke="#fff" stroke-opacity=".12"/><text x="${X0 - 8}" y="${(ypx(v) + 4).toFixed(1)}" fill="#a6a6a6" font-size="12" text-anchor="end">${v / 1000}k</text>`).join('');
const pts = cfg.points.map((p) => [x(p.date), ypx(p.value), p]);
const lastX = pts[pts.length - 1][0];
const dots = pts.map(([px, py, p], i) => {
  const end = px === lastX;
  // Steep climb ahead: the line would cut through a label above the dot, so put it below-right instead.
  const steep = !end && pts[i + 1][1] < py - 30;
  const lx = end ? px - 6 : steep ? px + 8 : px, ly = steep ? py + 18 : py - 12, la = end ? 'end' : steep ? 'start' : 'middle';
  return `<circle cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" r="4" fill="#fff"/><text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" fill="#fff" font-size="12" text-anchor="${la}">${k(p.value)}</text><text x="${px.toFixed(1)}" y="350" fill="#a6a6a6" font-size="11" text-anchor="middle">${fmtDate(p.date)}</text>`;
}).join('');
const ev = cfg.event ? `<line x1="${x(cfg.event.date)}" x2="${x(cfg.event.date)}" y1="${YT}" y2="${Y0}" stroke="#fff" stroke-dasharray="4 4"/><text x="${x(cfg.event.date) - 6}" y="62" fill="#fff" font-size="12" text-anchor="end">${cfg.event.label}</text>` : '';
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 720 ${H}" role="img" aria-label="${cfg.alt}" font-family="DM Sans, Helvetica, Arial, sans-serif"><rect width="720" height="${H}" fill="#000"/><text x="${X0}" y="26" fill="#fff" font-size="16" font-weight="700">${cfg.title}</text>${grid}${ev}<polyline fill="none" stroke="#fff" stroke-width="2.5" points="${pts.map(([a, b]) => `${a.toFixed(1)},${b.toFixed(1)}`).join(' ')}"/>${dots}${phaseSvg}<text x="${X0}" y="${H - 8}" fill="#a6a6a6" font-size="11">${cfg.footnote}</text></svg>`;
writeFileSync(resolve(root, cfg.out), svg);
console.log(`wrote ${cfg.out} (${phases.length} phases)`);
