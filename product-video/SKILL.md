---
name: product-video
description: "Build polished, animated product overview / explainer / promo videos (MP4, 16:9 and 9:16) for a software product, from the product's REAL output (demo account, example report, dashboards, diagrams), with on-screen captions, an animated clicking cursor, UI sound effects and a music track instead of narration. Motion-graphics style like modern SaaS launch videos: dark cinematic hook scenes, light split feature scenes, animated counters, diagrams drawing themselves, a 3D browser-window pan, and an end card with the URL. Use this whenever the user asks for a product video, demo video, feature walkthrough video, promo/launch video, explainer, sizzle reel, Reel/Short/TikTok for their tool, or a video 'like the one we made for X', or short 15-second Reel/Short/TikTok cuts, even if they don't say 'motion graphics' or name this skill. Also use it to turn an existing storyboard into a rendered video, or to add music to or re-cut (e.g. vertical) a video made this way."
---

# Product video

Make a music-driven product overview video with no voiceover, built as an HTML animation and rendered frame by frame to MP4. Every number, name and diagram in it comes from the product's real output. That's what makes it credible and what separates it from generic stock motion graphics.

**How it works:** one HTML page at the target resolution defines `window.seek(t)`, which draws the frame at time `t` as a pure function (no CSS animations, no timers). Playwright calls `seek(i/30)` and screenshots each frame, and the frames are piped into ffmpeg. Because frames don't depend on real time, the output is identical on any machine, you can preview any single frame, and changes re-render in minutes.

Bundled files:
- `scripts/render.mjs`: composition to MP4 (`--url --out [--w --h --fps --from --to]`)
- `scripts/preview.mjs`: stills at chosen times, plus `--sheet` for a contact strip
- `scripts/cutdown.py`: short reels (e.g. 15s) cut from an existing composition: renders chosen time ranges, joins them with hard cuts, puts the music's drop on the first cut
- `scripts/cues.mjs`: derives a sound-effect cue list from the composition (scene whooshes, card/chip pops, counter ticks, cursor clicks, the URL chime, plus `window.SFX_EXTRA`)
- `scripts/sfx.py`: synthesizes the UI sound kit from scratch (click, pop, whoosh, tick, key, chime, thud; no stock audio or licensing), mixes cues to a track, and does the final music + effects mix at -16 LUFS
- `scripts/music.py`: `analyze` a track's energy map, and `mux` it under the video (trim, fade, -16 LUFS)
- `scripts/doctor.mjs`: checks every requirement below and prints the exact fix for anything missing
- `scripts/_common.mjs`: finds a pre-installed Chromium and ffmpeg (pip `imageio-ffmpeg` fallback)
- `assets/template.html`: a working scene template; one file renders 16:9 **and** 9:16 through a portrait media query
- `assets/fonts-manrope.css`: embedded Manrope font (a fallback if the product has no embedded font)
- `assets/examples/supersnapshot/`: (Super Snapshot AI, a GoHighLevel tool) the full source of a finished 80s video (16:9 + vertical), a worked example of every pattern at production polish
- `references/story-and-copy.md`: the story arc, headline rules, honesty rules, timing conventions. **Read it before storyboarding.**
- `references/extraction.md`: how to find a safe data source and lift SVGs, graphs and screenshots out of the product. **Read it before capturing.**

## Requirements
The skill runs shell commands, so it needs **Claude Code** (CLI, desktop app, or Claude Code on the web). A plain chat without a code environment can plan a storyboard but can't render. On the machine or container:

| Needs | Why | Install |
|---|---|---|
| Node.js 18+ | runs the render scripts | nodejs.org or `nvm install 22` |
| `playwright` npm package, importable from the working directory | drives the browser frame by frame | `npm i -D playwright` (many web repos already have it) |
| Chromium | renders the frames | `npx playwright install chromium`, or reuse a pre-installed one (`CHROME=/path`; `/opt/pw-browsers` is found automatically) |
| Python 3.9+ with `numpy` | sound-effect synthesis and mixing | `pip install numpy` |
| ffmpeg | encoding, music, mixing | system ffmpeg, or `pip install imageio-ffmpeg` |

Network access is only needed for installing these. Rendering is fully offline. The user supplies their own music track; the sound effects are synthesized, so there's nothing to license.

## Workflow

### 0. Check the setup
From the product repo, run `node <skill>/scripts/doctor.mjs`. If anything shows ✗, run the printed fix (or ask the user to, if you can't install packages in this environment) before starting. Finding a missing ffmpeg after a 30-minute build wastes the whole session.

### 1. Find the real material
Read `references/extraction.md`. Locate a demo/example build of the product (repo scripts, fixtures, or a public example URL), open it in Playwright, click through every tab, and dump each pane's text. Screenshot the panes and look at them. You're hunting for: the most painful real number (the hook), the features a buyer would pay for, and the visuals that look good in motion.

### 2. Storyboard, then get a yes
Read `references/story-and-copy.md`. Propose a table: `# · time · what's on screen · on-screen caption`. Keep it to about 60–75s (or 30–45s for a social cut). Say honestly which features look weak on camera. Ask the few things only the user can answer, and nothing more:
- anything to avoid mentioning,
- the CTA (default: URL only),
- the brand look (default: match the product's own tokens).

Wait for their go-ahead before building, because re-cutting a finished render costs far more than editing a table.

### 3. Capture assets
Put everything in a scratch working dir outside the product repo (the session's scratchpad if it has one, else a temp dir): `<work>/index.html` + `<work>/assets/`. Lift diagram SVGs, graph JSON and tall report screenshots as described in `extraction.md`. Copy the product's embedded font CSS to `assets/fonts.css` (or `assets/fonts-manrope.css` from this skill).

### 4. Build the composition
Copy `assets/template.html` to `<work>/index.html`. Replace every `[BRACKETED]` placeholder with real content, remove the scenes you don't need, and duplicate the ones you do. Skim the example in `assets/examples/supersnapshot/index.html` for more patterns (warm "problem" cards, bar card with a callout box, score dial, radial dependency map, whole-account network, severity-tagged fix rows).

Things that matter:
- **Timing lives in two places:** `SCENES` start times, and each element's `data-in`. If you insert a scene, shift every later `data-in` and any hard-coded times in `seek()` by the same amount (a small regex over `data-in="…"` values ≥ the insert point does it).
- **Crossfades:** the new scene fades in over the old one, which stays solid underneath. Fading both at once dips light scenes to muddy gray.
- **Reveals:** SVG parts appear in reading order (top to bottom, or center outward). Arrowheads appear only once their line has landed. Key a highlight to a node by its label text.
- **Callouts:** chips and labels must never cover the thing they point at. Place them in empty space beside it, and have them follow it if the camera pans.

### 5. Preview before rendering
Serve the dir (`cd <work> && python3 -m http.server 8765 &`) and render stills at the key moment of every scene:
```bash
node <skill>/scripts/preview.mjs --url http://127.0.0.1:8765/index.html --dir <work>/prev --sheet 5 9 13 22 31 43 50 60
```
**Look at every frame.** Check for overlaps, awkward line breaks (force them with `<br>`), elements appearing before what they point at, empty cards, and placeholder text left behind. Fix and re-preview until clean. Scripts need `playwright`: run them from a directory whose `node_modules` has it (the product repo usually does). They also find a pre-installed Chromium on their own, so don't run `playwright install`.

### 6. Render and verify
```bash
node <skill>/scripts/render.mjs --url http://127.0.0.1:8765/index.html --out <work>/video.mp4
```
About 3–5 minutes for 80s at 1080p30. Afterwards, pull frames from the MP4 itself at scene transitions (`ffmpeg -ss <t> -i video.mp4 -frames:v 1 x.jpg`) to catch transition problems that single stills miss.

### 7. Music
When the user sends a track:
```bash
python3 <skill>/scripts/music.py analyze track.mp3             # find the intro, the drop, the breakdowns
python3 <skill>/scripts/music.py analyze track.mp3 --zoom 14 17 # pin the drop to the beat
python3 <skill>/scripts/music.py mux video.mp4 track.mp3 out.mp4 [--offset s]
```
The aim is for the drop to land on the cut from the brand reveal into the first feature scene. Choose `--offset` (or nudge `SCENES`) to get it there. Tell the user where the quiet stretches fall. If a key selling scene sits in a breakdown, suggest reordering scenes.

### 7b. Cursor and sound effects
They make the video feel like a real product being used, but only when each sound has something on screen causing it.

**Cursor:** the template's `CURSOR` list defines 2–4 click moments. The cursor glides to a real element (by CSS selector, measured every frame, so it follows pans and works in both orientations), presses, and leaves a ripple. Each click should **cause** what follows about 0.1–0.3s later: the bars fill, a step highlights, a map fans out, typing starts. Move the reaction's `data-in` if you need to. Check in previews that the target has **already appeared** when it's clicked; clicking a node that hasn't drawn yet looks broken. If a target has no handy selector, give it an id in `init()` (e.g. find a mermaid node by its label text).

**Sounds:**
```bash
node <skill>/scripts/cues.mjs --url http://127.0.0.1:8765/index.html --out <work>/cues.json
python3 <skill>/scripts/sfx.py mix <work>/cues.json --duration <DURATION> --out <work>/sfx.wav
python3 <skill>/scripts/sfx.py final <work>/video.mp4 --sfx <work>/sfx.wav --music track.mp3 [--offset s] --out <work>/final.mp4
```
`cues.mjs` places sounds from the animation's own timing, so they stay locked to it after any retime. Anything it can't see (counters driven by JS instead of `data-count`, typing, a hook landing) goes in `window.SFX_EXTRA`. Keep it sparse: no sound on headline entrances, one tick run per group of counters. Gains that worked against a busy corporate track: click about -1 dB, key about -6, tick about -8, pop -11, whoosh -10 to -14. To check a sound isn't buried, compare it with the music in the >2.5 kHz band (high-pass both, compare peaks); full-band peaks mislead because the music's bass dominates. If effects feel buried, lower `--music-gain` (default -6) before raising effect gains. `final` sets loudness with one static gain, since a dynamic loudnorm would flatten the clicks. `sfx.py kit <dir>` writes every sound as a WAV to audition.

### 8. Vertical 9:16
The template is orientation-aware: render the same page with `--w 1080 --h 1920` and the portrait media query takes over (headlines stacked above full-width cards, key content kept between y≈250 and y≈1550, clear of the social apps' overlays). Use `<br class="br-v">` for line breaks that should only happen in portrait. For a composition not built from the template (like the example), make a `vertical.html` copy with portrait positions. Preview the portrait frames too, since text wraps differently.

### 9. Short reels (15s)
Once the vertical video exists, cut 2–4 short reels from it. Each one has **one angle** (one pain, one feature cluster), so each can be tested as a separate ad or post. Don't rebuild anything: pick time ranges from the vertical composition and let `cutdown.py` render and join them.

```bash
python3 <skill>/scripts/cutdown.py --url http://127.0.0.1:8765/vertical.html \
  --seg 3.2-6.2 --seg 6.5-9.0 --seg 15.4-20.9 --seg 75.6-79.6 \
  --out <work>/reel1.mp4 --music track.mp3 --drop 15.0 --sfx
```
`--sfx` pulls each segment's sound cues from the composition, re-times them to the reel, and mixes them with the music.

Choosing segments (see "Short reels" in `references/story-and-copy.md`):
- **Shape:** hook (2.5–3s) → 1–2 feature beats (4–5.5s each) → end card (4s). Total 15s.
- **Start each segment after its scene has fully faded in** (scene start + about 0.5s) or on a key entrance, and **end it after its payoff has landed**: counters finished, the chip popped, the highlight lit. Check the `data-in`/count times in the composition. A counter cut off mid-count is the classic mistake.
- **Start the end card segment about 0.6s after the logo pops**, so the URL is on screen for 3s or more.
- **Keep every segment length a multiple of the beat** (0.5s at 120 BPM) so all cuts land on beats, and pass `--drop` so the drop hits the first cut.
- The first frame of a reel must already show the hook. There's no time for a slow fade-in.

After rendering, pull a frame from the middle and the end of each segment in the finished MP4 and look at them. Then tell the user which reel to post first (the one that opens on a problem), which ones are for warm audiences only (pure eye candy with no pain), and that fine print won't be readable at this pace, so the hook should also go in the post caption.

### 10. Deliver
Send the MP4(s) to the user as files. Then give an honest critique: total length (80s is long; 30–45s suits Reels/Shorts), the weakest scene, and one concrete cut or reorder. Offer the next steps: vertical cut, 15s reels, music, trims. Don't commit video files or build sources to the product repo unless asked.

## Shipping checklist
- [ ] Every number/name on screen matches the product's real output
- [ ] Nothing the user asked to leave out appears anywhere
- [ ] No `[placeholder]` text left, no clipped or overlapping elements in any previewed frame
- [ ] The hook number counts up in the first 5s; the URL is on screen for at least 3s at the end
- [ ] Transitions checked in the encoded MP4, not just in stills
- [ ] Music (if any) is trimmed, faded out, normalized, and its drop lands on a scene cut
- [ ] Every cursor click lands on an element that's already visible, and causes something
- [ ] Clicks, keys and ticks are audible over the music (check the >2.5 kHz band), and the final mix is -16 LUFS
- [ ] Reels: every segment ends after its payoff (no half-finished counters), the URL shows for 3s or more, cuts land on beats
