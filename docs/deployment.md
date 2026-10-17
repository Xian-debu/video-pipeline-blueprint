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

### 3.4 Render and normalise

```bash
npx remotion render Lecture out/lecture_raw.mp4
ffmpeg -i out/lecture_raw.mp4 -i public/voice/narration.wav ...   # mix: narration 1.0, music 0.48
bash scripts/audio/loudnorm.sh out/lecture_mixed.mp4 out/lecture_final.mp4
```

Measured: 305.000 s render in ~5 min (2 concurrent renderers), final I = -15.0 LUFS,
TP = -2.0 dBTP, 14.3 MB.

## 4. Optional capability passes

| Capability | Command | Cost |
| --- | --- | --- |
| Animated formula overlay | Manim: `--transparent --format=mov` (qtrle/argb; `webm` has no alpha) then `<OffthreadVideo transparent>` | ~1 GB apt (TeX) + venv |
| 3D | `npx remotion still ThreeCube out/cube.png --gl=angle` | none; needs WebGL via ANGLE |
| Transitions sample | `npx remotion still Transitions out/t.png --frame=90` | none |

## 5. Failure triage

| Symptom | First thing to check |
| --- | --- |
| Chromium exits immediately | `scripts/doctor.sh` shared libraries; re-run bootstrap apt step |
| CJK renders as boxes | `fc-list :lang=zh` empty => `fonts-noto-cjk` missing |
| `ERR_MODULE_NOT_FOUND` in Node audio | a dependency is missing from `package.json`, not from disk |
| Loudness assertion fails | read the first-pass JSON keys (`input_i`), not `measured_i` |
| wav is silent | TTS wrote via `torchaudio` without TorchCodec; run the patch script |
| Tail of the film is black | `TransitionSeries` consumed frames: duration must subtract `(N-1)*fade` |
