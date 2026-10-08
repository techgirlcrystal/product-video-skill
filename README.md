# Product Video Skill for Claude Code

Turn your software into a polished promo video. No voiceover needed, no editing app, no stock footage.

This skill teaches Claude Code to build an animated product video (16:9 and 9:16) straight from your product's real screens and real numbers. It adds an animated cursor, click sounds it makes itself, captions and your music, then cuts 15-second Reels from it.

## Credit

**This skill was not written by me.** It was created by the maker of **[Super Snapshot AI](https://supersnapshotai.com)** (a GoHighLevel tool) and shared with me. Their own Super Snapshot AI video is the worked example inside `product-video/assets/examples/supersnapshot/`.

All credit for the skill, the scripts and the method goes to them. I'm sharing it here with credit so my students can install it. If you are the author and want it changed or taken down, open an issue and I'll handle it right away.

No license file came with the original, so this repo doesn't add one. The bundled Manrope font is under the SIL Open Font License 1.1 (Mikhail Sharanda).

## What I changed

One line, in `product-video/scripts/_common.mjs`. On newer Node versions, loading Playwright from your project folder returned the module without `chromium` on it, so every script failed with `Cannot read properties of undefined (reading 'launch')`. The fix:

```js
const m = await import(pathToFileURL(req.resolve('playwright')).href);
return m.chromium ? m : m.default;
```

Everything else is exactly as shared.

## Install

1. Copy the `product-video` folder into your Claude Code skills folder:

```bash
cp -R product-video ~/.claude/skills/
```

2. Open Claude Code in a project that has Playwright installed. If yours doesn't, install it there first:

```bash
npm i -D playwright
```

3. Check your setup. Every line should show a ✓:

```bash
node ~/.claude/skills/product-video/scripts/doctor.mjs
```

## Use it

Tell Claude what you want, in plain words:

> Make a product video for my app. My audience is women coaches who run their business on GoHighLevel.

Claude finds your real screens and numbers, shows you a storyboard and waits for your yes, previews every scene, then renders. Send it a music track and it lines the beat drop up with the first feature. Then ask for the vertical cut and three 15-second Reels.

## What you need

- Claude Code (desktop app, CLI or web)
- Node.js 18+
- Python 3.9+ with `numpy`
- ffmpeg
- Playwright with Chromium

Shared by [Lady Hale](https://github.com/techgirlcrystal) for the Sassypreneurs Accelerator.
