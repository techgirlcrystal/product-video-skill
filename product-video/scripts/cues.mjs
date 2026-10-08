// Derive a sound-effect cue list from a seek(t) composition, so the sounds are locked to the animation.
//
//   node cues.mjs --url http://127.0.0.1:8765/index.html --out cues.json [--w 1920 --h 1080] [--from 0 --to D]
//
// Rules (kept sparse on purpose; too many sounds reads as cheap):
//   scene start (after the first)       -> whoosh      (dark scenes a bit louder than light)
//   data-a="card"                       -> soft whoosh
//   data-a="pop"                        -> pop          (.url element -> chime; .logo -> thud)
//   data-a="left" (chips/rows sliding)  -> pop, quieter, pitch nudged up
//   data-count (first of a cluster)     -> a decelerating run of ticks
//   window.CURSOR clicks                -> click
//   window.SFX_EXTRA [{t,s,g}]          -> added as-is (hook counters, typing, custom moments)
// Headline "rise" entrances get no sound. Cues of the same sound closer than 0.12s are merged (0.04s for key/tick).
// --from/--to re-time cues for a segment (cues outside are dropped), for reels cut with cutdown.py.
import { writeFileSync } from 'node:fs';
import { findChrome, args, loadPlaywright } from './_common.mjs';

const a = args();
if (!a.url || !a.out) { console.error('usage: node cues.mjs --url <page> --out cues.json [--w --h] [--from --to]'); process.exit(1); }
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ executablePath: findChrome() });
const p = await b.newPage({ viewport: { width: +(a.w || 1920), height: +(a.h || 1080) } });
await p.goto(a.url + (a.url.includes('?') ? '&' : '?') + 't=0');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });

const raw = await p.evaluate(() => {
  const cues = [];
  // SCENES may be {id:start} or {id:[start,end]}
  let scenes = {};
  try { scenes = eval('SCENES'); } catch {}
  const starts = Object.entries(scenes).map(([id, v]) => [id, Array.isArray(v) ? v[0] : v]).sort((x, y) => x[1] - y[1]);
  starts.slice(1).forEach(([id, t]) => {
    const dark = document.getElementById(id)?.classList.contains('dark');
    cues.push({ t: Math.max(0, t - 0.12), s: 'whoosh', g: dark ? -10 : -14 });
  });
  document.querySelectorAll('[data-a]').forEach(el => {
    const t = +el.dataset.in, kind = el.dataset.a;
    if (el.classList.contains('url')) cues.push({ t, s: 'chime', g: -8 });
    else if (el.classList.contains('logo')) cues.push({ t, s: 'thud', g: -8 });
    else if (kind === 'pop') cues.push({ t, s: 'pop', g: -11 });
    else if (kind === 'card') cues.push({ t, s: 'soft', g: -16 });
    else if (kind === 'left') cues.push({ t, s: 'pop', g: -17, p: 1.25 });
  });
  const counts = [...document.querySelectorAll('[data-count]')].map(e => +e.dataset.cin).sort((x, y) => x - y);
  let last = -9;
  for (const t0 of counts) {
    if (t0 - last < 1.0) continue; // one tick run per cluster of counters
    last = t0;
    for (let i = 0; i < 7; i++) cues.push({ t: t0 + 1.3 * Math.pow(i / 7, 1.6), s: 'tick', g: -8 + i * 0.3 });
  }
  (window.CURSOR || []).forEach(s => s.moves.forEach(m => { if (m.click != null) cues.push({ t: m.click, s: 'click', g: -1 }); }));
  (window.SFX_EXTRA || []).forEach(c => cues.push(c));
  return cues;
});
await b.close();

raw.sort((x, y) => x.t - y.t);
const merged = [];
for (const c of raw) {
  const prev = merged.findLast?.(m => m.s === c.s) ?? [...merged].reverse().find(m => m.s === c.s);
  const gap = (c.s === 'key' || c.s === 'tick') ? 0.04 : 0.12; // rapid sounds are meant to repeat
  if (prev && c.t - prev.t < gap) continue;
  merged.push(c);
}
let out = merged;
if (a.from != null || a.to != null) {
  const from = +(a.from || 0), to = +(a.to || 1e9);
  out = merged.filter(c => c.t >= from - 0.05 && c.t < to).map(c => ({ ...c, t: Math.max(0, c.t - from) }));
}
writeFileSync(a.out, JSON.stringify(out, null, 1));
const counts = out.reduce((m, c) => (m[c.s] = (m[c.s] || 0) + 1, m), {});
console.log(`wrote ${a.out}: ${out.length} cues`, counts);
