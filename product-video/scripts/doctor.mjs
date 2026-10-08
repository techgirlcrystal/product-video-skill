// Check everything the product-video skill needs, and print the exact fix for anything missing.
//
//   node doctor.mjs          (run from the product repo, since Playwright is resolved from the current directory)
//
// Exit code 0 = ready. Nothing is installed automatically.
import { execSync } from 'node:child_process';
import { findChrome, findFfmpeg, loadPlaywright } from './_common.mjs';

const rows = []; let ok = true;
const check = (name, pass, detail, fix) => { rows.push({ name, pass, detail, fix }); if (!pass) ok = false; };
const sh = cmd => { try { return execSync(cmd, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; } };

const major = +process.versions.node.split('.')[0];
check('Node.js >= 18', major >= 18, process.versions.node, 'Install Node 18+ (https://nodejs.org), or use nvm: nvm install 22');

let pw = null;
try { pw = await loadPlaywright(); check('playwright (npm)', true, 'importable from ' + process.cwd(), ''); }
catch { check('playwright (npm)', false, 'not found from ' + process.cwd(), 'Run from a repo that has it, or: npm i -D playwright   (add PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1 if a Chromium is already installed)'); }

if (pw) {
  const exe = findChrome();
  try {
    const b = await pw.chromium.launch({ executablePath: exe });
    const v = b.version(); await b.close();
    check('Chromium', true, `${v}${exe ? ' at ' + exe : ' (Playwright default)'}`, '');
  } catch (e) {
    check('Chromium', false, String(e.message).split('\n')[0], 'npx playwright install chromium   (or set CHROME=/path/to/chrome)');
  }
}

const py = sh('python3 --version');
check('Python 3', !!py, py || 'not found', 'Install Python 3.9+');
if (py) {
  const np = sh(`python3 -c "import numpy;print(numpy.__version__)"`);
  check('numpy (sound effects)', !!np, np || 'not installed', 'pip install numpy');
}

try { const f = findFfmpeg(); check('ffmpeg', true, f, ''); }
catch { check('ffmpeg', false, 'not found', 'pip install imageio-ffmpeg   (or install ffmpeg: brew install ffmpeg / apt install ffmpeg)'); }

for (const r of rows) console.log(`${r.pass ? '✓' : '✗'} ${r.name.padEnd(24)} ${r.detail}${r.pass ? '' : `\n    fix: ${r.fix}`}`);
console.log(ok ? '\nReady to make videos.' : '\nFix the ✗ items above, then run this again.');
process.exit(ok ? 0 : 1);
