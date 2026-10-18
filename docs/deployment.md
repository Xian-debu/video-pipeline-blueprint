# Deployment, stage by stage

Reference machine: WSL2 Ubuntu 24.04, RTX 5070 Laptop (8 GB), 20 cores, 54 GB RAM, Node 22.21.1,
ffmpeg 6.1.1, Python 3.12.3. Times below are measured on that machine.

## 0. System prerequisites

```bash
bash scripts/bootstrap.sh
```

It installs (Debian/Ubuntu): `ffmpeg`, `fonts-noto-cjk`, and the Chromium shared libraries
(`libnss3 libnspr4 libxcomposite1 libxdamage1 libxrandr2 libatk1.0-0 libatk-bridge2.0-0 libcups2
libdrm2 libgbm1 libasound2t64`). Missing any of them shows up as a silent Chromium crash during
the first still.

It also downloads Node 22.21.1 into `.tools/node` (a tarball, not the distro package — the distro
Node is too old for Remotion 4). `NODE_MIRROR` and `SKIP_APT=1` are supported.

Then `npm install` (280 packages, ~400 MB) and `npm run browser` (headless Chromium, 99 MB).

Verify the environment read-only:

```bash
bash scripts/doctor.sh
```

## 1. Typecheck and stills

```bash
npx tsc --noEmit
npx remotion still Storyboard out/verify/still_storyboard.png --frame=60
```

A still is the cheapest possible end-to-end test: it exercises Node, TSX, Chromium, fonts and
layout. **Look at it.** Font fallback (missing CJK) and overflow are only visible here.

## 2. Programmatic score

```bash
node scripts/audio/render_music.mjs --out=public/music/demo.wav --duration=32 --bpm=92 --seed=11 --energy=0.55
```

Note the `--key=value` syntax; space-separated flags yield `NaN` durations. Output: 48 kHz
stereo wav. Determinism check: run twice with the same seed, `sha256sum` must match.

## 3. Narrated lecture (optional, needs a GPU or patience)

### 3.1 TTS environment

IndexTTS-2 pins Python < 3.12 and `torch==2.8`. On a 3.12 host with torch 2.9, install the repo
without dependencies into a side venv and borrow the main interpreter's packages:

```bash
git clone https://github.com/index-tts/index-tts pkg/index-tts
python3 -m venv --system-site-packages env/tts
echo /path/to/main/venv/lib/python3.12/site-packages > env/tts/lib/python3.12/site-packages/_mainvenv.pth
env/tts/bin/pip install -r pkg/index-tts/requirements.txt --no-deps   # plus: modelscope, cn2an, jieba, munch, opencv-python-headless, descript-audiotools, openai-whisper
env/tts/bin/pip install transformers==4.52.1   # 4.57 deleted QuantizedCacheConfig, which IndexTTS imports
```

Weights (~5.5 GB + ~4.3 GB downloaded on first use) go to `shared/models/IndexTTS-2`.
HF direct access was unreachable here; `HF_ENDPOINT=https://hf-mirror.com` plus
`USE_MODELSCOPE=false` works (K5 in `docs/known-issues.md`).

### 3.2 Torchaudio compatibility

torchaudio >= 2.9 needs TorchCodec for wav IO; IndexTTS calls `torchaudio.save` and fails.
Apply the documented patch (idempotent, re-checks itself):

```bash
python3 scripts/tts/patch_indextts.py --indextts pkg/index-tts --check
python3 scripts/tts/patch_indextts.py --indextts pkg/index-tts
```

### 3.3 Synthesis and timing

```bash
PYTHON=env/tts/bin/python python3 scripts/tts/synthesize.py \
  --script src/lecture/script.ts --out public/voice \
  --indextts pkg/index-tts --model-dir shared/models/IndexTTS-2 \
  --ref-audio pkg/index-tts/examples/voice_03.wav

PYTHON=env/tts/bin/python python3 scripts/tts/retime_narration.py \
  --script src/lecture/script.ts --voice public/voice --out public/voice/narration.wav
```

41 lines took ~9 minutes (RTF ~1.75, GPU saturated). `retime_narration.py` rewrites the scene
durations in `src/lecture/script.ts` when speech does not fit — commit that diff, it is content.

### 3.4 Score, mix, render, normalise

The mix is deliberately outside the renderer: the stems can be re-levelled, re-gated and re-muxed
without rendering 305 s of frames again.

```bash
# 1. score: deterministic, seeded, same bytes for the same arguments
node scripts/audio/render_music.mjs --out=public/music/score.wav --duration=305 --seed=11 --energy=0.8

# 2. gate the stem: the energy has to be in a band a phone speaker can reproduce
python3 scripts/qa/music_gate.py --music public/music/score.wav

# 3. picture only — music and narration muted, they are mixed afterwards
npx remotion render Lecture out/lecture_raw.mp4 --props='{"music":null,"narration":null}'

# 4. mix narration + score (ducking, fades, peak guard), then gate the programme
node scripts/audio/mix.mjs --narration public/voice/narration.wav \
  --music public/music/score.wav --out out/lecture_mix.wav
python3 scripts/qa/music_gate.py --mix out/lecture_mix.wav --narration public/voice/narration.wav

# 5. mux, then normalise the finished programme
ffmpeg -i out/lecture_raw.mp4 -i out/lecture_mix.wav -c:v copy -c:a aac -b:a 192k \
  -shortest out/lecture_mixed.mp4
bash scripts/audio/loudnorm.sh out/lecture_mixed.mp4 out/lecture_final.mp4
```

Measured on the 305 s film: render ~5 min (2 concurrent renderers); score stem -25.1 dBFS full band,
**-27.9 dBFS through a 300 Hz high-pass** (a 2.8 dB loss), 63% of its power in 250-4k, 7% in 20-120 Hz;
mix speech -16.2 dBFS, gap bed -28.5 dBFS audible band (-12.3 dB under speech), peak -2.83 dBFS before
normalisation; final I = -15.0 LUFS, TP = -2.0 dBTP, 14.3 MB.

Why the gate exists: the first delivered score was -34.6 dBFS after the same high-pass and sounded
like no music at all, even though it was mixed and correlated (docs/known-issues.md K14).

### 3.5 Delivery exports (subtitles, chapters, cover)

```bash
npm run publish      # -> out/export/{lecture.srt, lecture.chapters.txt, lecture.chapters.ffmeta.txt, cover.png}
```

All four are derived, never typed again: the SRT is `LINES`, the chapters are `SCENES`, and the cover
is a real rendered frame (`--cover-frame=180`, i.e. 6.0 s, the clean stretch of the opening title
before the first caption). The script refuses to write anything when a cue overlaps the next one,
runs past the film, or would put more than `text.caption.maxCharsPerLine` characters (34, from
`data/design.spec.json`) on one subtitle line — so an edit to the narration cannot silently leave a
stale SRT behind.

Two things worth knowing:

- 16 of the 41 cues run past 34 characters (the longest is 51) and are wrapped onto a second line at
  a punctuation boundary. The comment in `src/lecture/script.ts` claims every line is <= 34
  characters; that is true on screen only because the caption box wraps, and it is not true of the
  text. The SRT honours the contract budget, the film honours the caption box — same words, same
  times, different wrap points.
- `lecture.chapters.ffmeta.txt` is the ffmpeg chapter sidecar:
  `ffmpeg -i in.mp4 -i lecture.chapters.ffmeta.txt -map_metadata 1 -c copy out.mp4`.

## 4. Optional capability passes

| Capability | Command | Cost |
| --- | --- | --- |
| Animated formula overlay | Manim: `--transparent --format=mov` (qtrle/argb; `webm` has no alpha) then `<OffthreadVideo transparent>` | ~1 GB apt (TeX) + venv |
| 3D | `npx remotion still ThreeCube out/cube.png --gl=angle` | none; needs WebGL via ANGLE |
| Transitions sample | `npx remotion still Transitions out/t.png --frame=90` | none |
| Delivery exports | `npm run publish` (SRT + chapters + cover; needs headless Chromium for the cover) | none |

## 5. Failure triage

| Symptom | First thing to check |
| --- | --- |
| Chromium exits immediately | `scripts/doctor.sh` shared libraries; re-run bootstrap apt step |
| CJK renders as boxes | `fc-list :lang=zh` empty => `fonts-noto-cjk` missing |
| `ERR_MODULE_NOT_FOUND` in Node audio | a dependency is missing from `package.json`, not from disk |
| Loudness assertion fails | read the first-pass JSON keys (`input_i`), not `measured_i` |
| wav is silent | TTS wrote via `torchaudio` without TorchCodec; run the patch script |
| Tail of the film is black | `TransitionSeries` consumed frames: duration must subtract `(N-1)*fade` |
