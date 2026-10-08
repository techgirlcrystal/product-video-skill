# Getting real material out of the product

The video's credibility comes from showing the product's real output. Rebuilding simple things (bars, counters, score dials) as HTML from real numbers gives the smoothest motion. Complex visuals (diagrams, graphs, long reports) should be lifted straight from the product.

## 1. Find a safe source

In order of preference:
1. A built-in example/demo generator in the repo (look for `example`, `demo`, `fixture`, `sample` in package.json scripts and `tools/`). It uses invented data, so there's no PII risk.
2. A public example page the user points to (e.g. `https://product.com/example-dashboard`). If the network blocks it, the repo often builds the same file.
3. Test fixtures that the product's pipeline can render.

Never use a real customer's account for a public video.

If a build script launches Playwright's own Chromium and it isn't installed, don't run `playwright install`. Copy the script with `chromium.launch({ executablePath: <pre-installed chrome> })` patched in (scripts/_common.mjs `findChrome()` finds it).

## 2. Survey it

Open it in Playwright at 1440×900 and:
- List the tabs/sections (`[role=tab]`, `button[data-view]`, nav anchors) and click through each one. Tab panes are often injected by JS, so inspect the live DOM, not the HTML source.
- Dump each pane's `innerText` to a file and read it. That's where the real numbers and item names are.
- Screenshot each pane (scroll to the pane's top first, since content often sits below the fold) and look at them before storyboarding.

## 3. Lift visuals

**SVG diagrams (mermaid, custom SVG):** serialize the live element so it stays vector-sharp and can be animated part by part:
```js
const ser = el => { const c = el.cloneNode(true); const r = el.getBoundingClientRect();
  c.setAttribute('width', r.width); c.setAttribute('height', r.height);
  c.setAttribute('xmlns', 'http://www.w3.org/2000/svg'); return c.outerHTML; };
fs.writeFileSync('assets/diagram.svg', await page.locator('svg').filter({ hasText: 'Some node label' }).first().evaluate(ser));
```
Watch out: the viewBox can be larger than the displayed size. Normalize reveal timing by `svg.viewBox.baseVal`, not by the pixel size, or the timing comes out wrong.
Find a specific node for highlighting by its text (`/Label text/.test(g.textContent)`), not by its coordinates.

**Force/network graphs:** extract node positions, radii and colors, then redraw them in your own `<svg>` so nodes can pop in from the center outward:
```js
const toSvg = (el, x, y) => new DOMPoint(x, y).matrixTransform(el.getCTM());
circles.map(c => ({ ...toSvg(c, +c.getAttribute('cx'), +c.getAttribute('cy')), r: +c.getAttribute('r') * c.getCTM().a, fill: getComputedStyle(c).fill }))
```
Save it as `graph.json`. Wait several seconds after opening the graph so the simulation settles before you extract.

**Long reports/pages for a pan shot:** element screenshot at `deviceScaleFactor: 2` (Playwright captures beyond the viewport). Sticky headers can overlap element screenshots of diagrams; if they do, use the SVG route above. Hide "example" banners before capturing so the report looks like a customer's.

## 4. Brand

- Font: look for embedded `@font-face` CSS in the repo (report kits often base64-embed it, which is perfect: it works offline). Copy it into `assets/fonts.css`.
- Colors: grep CSS tokens (`--accent`, `--brand`, `data-product=` overrides) for the product's accent. Use it for the headline's second beat, eyebrows, chips and the URL pill.
- The marketing site may be blocked by the sandbox's network policy. If so, say you matched the product's in-app branding, and offer to swap in the real logo and colors if the user sends them.
