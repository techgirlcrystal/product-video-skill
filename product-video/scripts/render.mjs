// Render a seek(t) composition to MP4, frame by frame.
//
//   node render.mjs --url http://127.0.0.1:8765/index.html --out video.mp4 [--w 1920 --h 1080 --fps 30 --from 0 --to <DURATION>]
//
// The page must define window.seek(t), window.DURATION and set window.__ready = true once assets are loaded.
// Every frame is a pure function of t, so the output is deterministic regardless of machine speed.
import { spawn } from 'node:child_process';
import { findChrome, findFfmpeg, args, loadPlaywright } from './_common.mjs';

const a = args();
if (!a.url || !a.out) { console.error('usage: node render.mjs --url <page url> --out <file.mp4> [--w 1920 --h 1080 --fps 30 --from s --to s]'); process.exit(1); }
const W = +(a.w || 1920), H = +(a.h || 1080), FPS = +(a.fps || 30);
const { chromium } = await loadPlaywright();
const b = await chromium.launch({ executablePath: findChrome() });
const p = await b.newPage({ viewport: { width: W, height: H } });
p.on('pageerror', e => console.error('PAGE ERROR', e.message));
await p.goto(a.url + (a.url.includes('?') ? '&' : '?') + 't=0');
await p.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
await p.waitForTimeout(500); // let fonts settle
const D = await p.evaluate(() => window.DURATION);
const from = +(a.from || 0), to = +(a.to || D);
const ff = spawn(findFfmpeg(), ['-y', '-loglevel', 'error', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '17', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', a.out], { stdio: ['pipe', 'ignore', 'inherit'] });
const N = Math.round((to - from) * FPS); const t0 = Date.now();
for (let i = 0; i < N; i++) {
  await p.evaluate(t => window.seek(t), from + i / FPS);
  const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
  if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
  if (i % 300 === 0) console.error(`frame ${i}/${N}  ${((Date.now() - t0) / 1000).toFixed(0)}s`);
}
ff.stdin.end();
const code = await new Promise(r => ff.on('close', r));
await b.close();
if (code !== 0) { console.error('ffmpeg exited with', code); process.exit(code); }
console.error(`done ${a.out}  ${N} frames, ${(to - from).toFixed(1)}s @ ${W}x${H}`);
