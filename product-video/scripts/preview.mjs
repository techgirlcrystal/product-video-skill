// Render still frames at chosen timestamps (and an optional contact sheet) to check a composition before the full render.
//
//   node preview.mjs --url http://127.0.0.1:8765/index.html --dir prev [--w 1920 --h 1080] [--sheet] 5.5 9.5 22 31
//
// Look at every frame you render. It's the cheapest place to catch overlaps, bad wraps and mistimed reveals.
import { mkdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { findChrome, findFfmpeg, args, loadPlaywright } from './_common.mjs';

const a = args();
const times = (a._ || []).map(Number);
if (!a.url || !a.dir || !times.length) { console.error('usage: node preview.mjs --url <page> --dir <outdir> [--w --h] [--sheet] t1 t2 ...'); process.exit(1); }
const W = +(a.w || 1920), H = +(a.h || 1080);
mkdirSync(a.dir, { recursive: true });
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ executablePath: findChrome() });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', e => console.error('PAGE ERROR', e.message));
p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) console.error('CONSOLE', m.text()); });
await p.goto(a.url + (a.url.includes('?') ? '&' : '?') + 't=0');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await p.waitForTimeout(300);
const files = [];
for (const t of times) {
  await p.evaluate(t => window.seek(t), t);
  const f = path.join(a.dir, `f_${t}.jpg`);
  await p.screenshot({ path: f, type: 'jpeg', quality: 75 });
  files.push(f);
}
await b.close();
if (a.sheet && files.length > 1) {
  // One horizontal strip; each frame scaled so the strip stays readable.
  const tw = W >= H ? 640 : 360;
  const inputs = files.flatMap(f => ['-i', f]);
  const chain = files.map((_, i) => `[${i}]scale=${tw}:-1[v${i}]`).join(';') + ';' + files.map((_, i) => `[v${i}]`).join('') + `hstack=${files.length}`;
  const out = path.join(a.dir, 'sheet.jpg');
  spawnSync(findFfmpeg(), ['-y', '-loglevel', 'error', ...inputs, '-filter_complex', chain, out], { stdio: 'inherit' });
  console.log(out);
}
console.log(files.join('\n'));
