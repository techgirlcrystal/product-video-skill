#!/usr/bin/env python3
"""UI sound effects, synthesized from scratch (no stock audio, no licensing), and mixed onto a timeline.

  python3 sfx.py kit  <dir>                         # write the sound kit as WAVs, to audition them
  python3 sfx.py mix  cues.json --duration 80 --out sfx.wav
  python3 sfx.py final video.mp4 --sfx sfx.wav [--music track.mp3 --offset 0 --fade 3 --music-gain -3] --out out.mp4

cues.json: [{"t": 19.3, "s": "click", "g": -6}, ...]   (t seconds, s sound name, g gain in dB; optional "p" pitch ratio)
Sounds: click, pop, whoosh, soft (quiet whoosh for cards), tick, key, chime, thud.

Design notes: sounds are short and quiet, so they sit UNDER the music and read as polish, not as a cartoon.
Everything is deterministic (seeded noise), so re-running gives identical audio.
"""
import argparse, json, subprocess, sys, shutil, wave
import numpy as np

SR = 48000
rng = np.random.default_rng(7)


def env_exp(n, tau):
    return np.exp(-np.arange(n) / (tau * SR))


def onepole_lp(x, fc):
    """Time-varying one-pole low-pass; fc may be scalar or per-sample array."""
    fc = np.broadcast_to(fc, x.shape)
    a = np.exp(-2 * np.pi * fc / SR)
    y = np.empty_like(x); s = 0.0
    for i in range(len(x)):
        s = (1 - a[i]) * x[i] + a[i] * s
        y[i] = s
    return y


def hp(x, fc):
    return x - onepole_lp(x, fc)


def bp(x, lo, hi):
    return onepole_lp(hp(x, lo), hi)


def sine(freq, n):
    freq = np.broadcast_to(freq, (n,))
    return np.sin(2 * np.pi * np.cumsum(freq) / SR)


def norm(x, peak=0.9):
    m = np.max(np.abs(x)) or 1.0
    return x / m * peak


def s_click():
    # Mouse click: sharp press transient + a quieter release 55ms later.
    def tr(n, f, tau):
        noise = hp(rng.standard_normal(n), 2500) * env_exp(n, 0.0015)
        tone = sine(f, n) * env_exp(n, tau) * 0.5
        return noise + tone
    n = int(0.12 * SR); out = np.zeros(n)
    a = tr(int(0.03 * SR), 3200, 0.004); out[:len(a)] += a
    b = tr(int(0.03 * SR), 2600, 0.003) * 0.45; o = int(0.055 * SR); out[o:o + len(b)] += b
    return norm(out, 0.8)


def s_pop():
    # Bubbly UI pop: fast downward pitch sweep with soft attack.
    n = int(0.16 * SR); t = np.arange(n) / SR
    f = 1100 * np.exp(-t * 18) + 420
    e = (1 - np.exp(-t / 0.002)) * np.exp(-t / 0.05)
    return norm(sine(f, n) * e, 0.7)


def s_whoosh(dur=0.5, lo=300, hi=3500):
    # Filtered noise swell with a rising filter sweep: the classic transition swish.
    n = int(dur * SR); t = np.linspace(0, 1, n)
    e = np.sin(np.pi * np.clip(t, 0, 1)) ** 2 * (1 - 0.35 * t)
    fc = lo + (hi - lo) * (t ** 1.5)
    x = onepole_lp(hp(rng.standard_normal(n), 150), fc)
    x = onepole_lp(x, fc * 1.4)
    return norm(x * e, 0.6)


def s_soft():
    return s_whoosh(0.38, 250, 2000) * 0.7


def s_tick():
    n = int(0.03 * SR)
    x = sine(4200, n) * env_exp(n, 0.004) + hp(rng.standard_normal(n), 3000) * env_exp(n, 0.001) * 0.4
    return norm(x, 0.5)


def s_key():
    # Keyboard tap: short band-passed noise with a little body.
    n = int(0.045 * SR)
    x = bp(rng.standard_normal(n), 900, 5000) * env_exp(n, 0.006) + sine(180, n) * env_exp(n, 0.008) * 0.25
    return norm(x, 0.45)


def s_chime():
    # Bright two-note chime (E6 then B6 shimmer) for the end-card URL.
    n = int(1.6 * SR); out = np.zeros(n)
    for f, delay, g in [(1318.5, 0.0, 1.0), (1975.5, 0.09, 0.8), (2637.0, 0.09, 0.35), (3951.1, 0.09, 0.15)]:
        o = int(delay * SR); m = n - o; t = np.arange(m) / SR
        tone = sine(f * (1 + 0.002 * np.sin(2 * np.pi * 5 * t)), m) * np.exp(-t / 0.45) * (1 - np.exp(-t / 0.003))
        out[o:] += tone * g
    return norm(out, 0.6)


def s_thud():
    # Low soft impact for big reveals (hook number landing, logo).
    n = int(0.5 * SR); t = np.arange(n) / SR
    f = 120 * np.exp(-t * 6) + 45
    x = sine(f, n) * np.exp(-t / 0.18) * (1 - np.exp(-t / 0.004))
    x += onepole_lp(rng.standard_normal(n), 400) * np.exp(-t / 0.03) * 0.6
    return norm(x, 0.85)


KIT = {'click': s_click, 'pop': s_pop, 'whoosh': s_whoosh, 'soft': s_soft, 'tick': s_tick, 'key': s_key, 'chime': s_chime, 'thud': s_thud}


def write_wav(path, x):
    x = np.clip(x, -1, 1)
    st = np.stack([x, x], axis=1) if x.ndim == 1 else x
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((st * 32767).astype('<i2').tobytes())


def ffmpeg():
    p = shutil.which('ffmpeg')
    if p:
        return p
    try:
        import imageio_ffmpeg
        return imageio_ffmpeg.get_ffmpeg_exe()
    except ImportError:
        sys.exit('ffmpeg not found: pip install imageio-ffmpeg')


def cmd_kit(a):
    import os
    os.makedirs(a.dir, exist_ok=True)
    for k, f in KIT.items():
        write_wav(f'{a.dir}/{k}.wav', f())
    print('wrote', ', '.join(KIT))


def cmd_mix(a):
    cues = json.load(open(a.cues))
    n = int((a.duration + 2) * SR)
    track = np.zeros((n, 2))
    cache = {}
    for c in cues:
        s = c['s']
        if s not in KIT:
            print('unknown sound', s, file=sys.stderr); continue
        key = (s, c.get('p', 1.0))
        if key not in cache:
            x = KIT[s]()
            p = c.get('p', 1.0)
            if p != 1.0:  # simple resample for pitch variation
                idx = np.arange(0, len(x) - 1, p)
                x = np.interp(idx, np.arange(len(x)), x)
            cache[key] = x
        x = cache[key] * (10 ** (c.get('g', 0) / 20))
        pan = c.get('pan', 0.0)  # -1 left .. 1 right
        lg, rg = np.sqrt((1 - pan) / 2) * 1.414, np.sqrt((1 + pan) / 2) * 1.414
        o = int(c['t'] * SR)
        if o < 0 or o >= n:
            continue
        m = min(len(x), n - o)
        track[o:o + m, 0] += x[:m] * lg
        track[o:o + m, 1] += x[:m] * rg
    track = track[:int(a.duration * SR)]
    peak = np.max(np.abs(track)) or 1
    if peak > 0.89:
        track *= 0.89 / peak
    write_wav(a.out, track)
    print(f'wrote {a.out}: {len(cues)} cues over {a.duration}s (peak {min(peak, 0.89):.2f})')


def integrated_lufs(path):
    out = subprocess.run([ffmpeg(), '-hide_banner', '-i', path, '-af', 'ebur128', '-f', 'null', '-'], capture_output=True, text=True).stderr
    vals = [l.split('I:')[1].split('LUFS')[0] for l in out.splitlines() if l.strip().startswith('I:')]
    return float(vals[-1]) if vals else -16.0


def cmd_final(a):
    import os, tempfile
    out = subprocess.run([ffmpeg(), '-i', a.video], capture_output=True, text=True).stderr
    h, m, s = out.split('Duration:')[1].split(',')[0].strip().split(':')
    vd = int(h) * 3600 + int(m) * 60 + float(s)
    inputs = ['-i', a.sfx]
    if a.music:
        inputs += ['-i', a.music]
        fade_st = max(0, vd - a.fade)
        fc = (f'[1:a]atrim={a.offset}:{a.offset + vd},asetpts=PTS-STARTPTS,loudnorm=I=-16:TP=-1.5:LRA=11,'
              f'volume={a.music_gain}dB,afade=t=out:st={fade_st}:d={a.fade}[m];'
              f'[0:a]volume={a.sfx_gain}dB[s];[m][s]amix=inputs=2:normalize=0:duration=first[a]')
    else:
        fc = f'[0:a]volume={a.sfx_gain}dB[a]'
    tmp = os.path.join(tempfile.mkdtemp(prefix='sfxmix-'), 'mix.wav')
    subprocess.run([ffmpeg(), '-loglevel', 'error', '-y', *inputs, '-filter_complex', fc, '-map', '[a]', '-t', str(vd), '-ar', '48000', tmp], check=True)
    # One static gain to hit -16 LUFS (a dynamic loudnorm on the full mix would flatten the click transients).
    gain = -16.0 - integrated_lufs(tmp)
    subprocess.run([ffmpeg(), '-loglevel', 'error', '-y', '-i', a.video, '-i', tmp, '-map', '0:v', '-map', '1:a',
                    '-af', f'volume={gain:.2f}dB,alimiter=limit=0.89:level=false', '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k',
                    '-ar', '48000', '-shortest', '-movflags', '+faststart', a.out], check=True)
    print(f'wrote {a.out} ({vd:.1f}s, sfx{" + music" if a.music else ""}, gain {gain:+.1f} dB to -16 LUFS)')


ap = argparse.ArgumentParser()
sub = ap.add_subparsers(dest='cmd', required=True)
k = sub.add_parser('kit'); k.add_argument('dir')
m = sub.add_parser('mix'); m.add_argument('cues'); m.add_argument('--duration', type=float, required=True); m.add_argument('--out', required=True)
f = sub.add_parser('final'); f.add_argument('video'); f.add_argument('--sfx', required=True); f.add_argument('--out', required=True)
f.add_argument('--music'); f.add_argument('--offset', type=float, default=0.0); f.add_argument('--fade', type=float, default=3.0)
f.add_argument('--music-gain', type=float, default=-6.0, help='dB applied after loudnorm; lower it if the SFX feel buried')
f.add_argument('--sfx-gain', type=float, default=3.0)
a = ap.parse_args()
{'kit': cmd_kit, 'mix': cmd_mix, 'final': cmd_final}[a.cmd](a)
