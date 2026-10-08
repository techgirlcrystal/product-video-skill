// Shared helpers: find a Chromium binary and an ffmpeg binary without downloading anything.
import { existsSync, readdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import path from 'node:path';

export function findChrome() {
  if (process.env.CHROME && existsSync(process.env.CHROME)) return process.env.CHROME;
  const roots = [process.env.PLAYWRIGHT_BROWSERS_PATH, '/opt/pw-browsers', path.join(process.env.HOME || '', '.cache/ms-playwright')].filter(Boolean);
  for (const root of roots) {
    if (!existsSync(root)) continue;
    // Prefer the full chromium build; headless_shell also works.
    const dirs = readdirSync(root).filter(d => /^chromium/.test(d)).sort().reverse();
    for (const d of dirs) {
      for (const rel of ['chrome-linux/chrome', 'chrome-linux64/chrome', 'chrome-headless-shell-linux64/chrome-headless-shell', 'chrome']) {
        const p = path.join(root, d, rel);
        if (existsSync(p)) return p;
      }
    }
  }
  return undefined; // let Playwright use its own default
}

export function findFfmpeg() {
  if (process.env.FFMPEG && existsSync(process.env.FFMPEG)) return process.env.FFMPEG;
  try { const p = execSync('command -v ffmpeg', { encoding: 'utf8' }).trim(); if (p) return p; } catch {}
  try {
    return execSync(`python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())"`, { encoding: 'utf8' }).trim();
  } catch {}
  throw new Error('ffmpeg not found. Run: pip install imageio-ffmpeg   (or set FFMPEG=/path/to/ffmpeg)');
}

const BOOL = new Set(['sheet']);
export function args() {
  const out = {}; const a = process.argv.slice(2);
  for (let i = 0; i < a.length; i++) {
    if (a[i].startsWith('--')) { const k = a[i].slice(2); const v = !BOOL.has(k) && a[i + 1] && !a[i + 1].startsWith('--') ? a[++i] : true; out[k] = v; }
    else (out._ ||= []).push(a[i]);
  }
  return out;
}

export async function loadPlaywright() {
  // Node resolves bare imports relative to THIS file, so also try the caller's working directory
  // (e.g. the product repo, which usually has playwright in its node_modules).
  try { return await import('playwright'); } catch {}
  try {
    const { createRequire } = await import('node:module');
    const { pathToFileURL } = await import('node:url');
    const req = createRequire(path.join(process.cwd(), 'noop.js'));
    const m = await import(pathToFileURL(req.resolve('playwright')).href);
    return m.chromium ? m : m.default;
  } catch {}
  throw new Error("Can't find 'playwright'. Run from a directory whose node_modules has it (e.g. the product repo), or `npm i playwright` in a scratch dir (set PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 if a browser is pre-installed).");
}
