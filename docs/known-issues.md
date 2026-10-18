# Known issues

Every item below was hit during the reference production. None are hypothetical; each lists the
symptom, the mechanism, the workaround and whether it is fixed here.

## K1 — Cross-fade between scenes produces a visible flicker

**Symptom.** Scene changes look like a dip to black then a brighten ("dark flash"). Per-frame mean
luma stays within ±2, so the luma gate passes; a human sees it immediately.

**Mechanism.** Two effects multiply. `TransitionSeries` renders both scenes simultaneously for the
overlap length; and each scene's own fade-in/fade-out contributes another opacity ramp. During the
overlap the effective opacity of the incoming content is the product of two ~0.5 ramps, so the
brightness dips and recovers. Text edges also double-expose for 14 frames (ghosting).

**Fix here.** No cross-transitions between scenes. Hard `<Sequence>` cuts plus per-scene content
fades (`SceneShell`, 12 frames). A genuine fade between two very different backgrounds is only
acceptable with a much longer ramp (`fadeFramesFor()`), and even then it must be verified visually.

Two more rules came out of the same defect. The **background is painted by the scene itself and never
participates in the fade** — only the content fades — so a cut can never pull the whole frame through
the parent's base colour. And **neighbouring scenes stay in one low-luminance palette family**; a
bright scene next to a dark one needs a ramp long enough that nobody would want it between two shots.

**Lesson.** Mean-luma QA is necessary but not sufficient; it cannot see motion/ghosting illusions.
Design rules beat detectors.

## K2 — Tone.js cannot render offline in Node

**Symptom.** `Tone.Offline()` throws `Error: Missing the native OfflineAudioContext constructor`.
Injecting `node-web-audio-api`'s `OfflineAudioContext` instead yields
`Error: The given parameters are not valid.`

**Mechanism.** Tone.js targets browsers and relies on `standardized-audio-context`, whose parameter
validation rejects the Node implementation's option shapes. Shimming `window`/`AudioContext`
does not help.

**Fix here.** Score synthesis talks to `node-web-audio-api`'s `OfflineAudioContext` directly
(`scripts/audio/engine.mjs`), no Tone.js. The code is ~150 lines and fully deterministic.

## K3 — torchaudio >= 2.9 requires TorchCodec for wav IO

**Symptom.** IndexTTS fails while saving: `OSError: Could not load this library:
.../libtorchcodec_image.so` (or a silent failure depending on the version).

**Mechanism.** Since 2.9, torchaudio's save/load paths delegate to TorchCodec, which must match the
torch build. The wheel available here did not.

**Fix here.** `scripts/tts/patch_indextts.py` wraps `save_pcm_wav()` in a `try/except` and
falls back to `soundfile.write(path, arr.T, sr, subtype="PCM_16")`. Idempotent; verifies itself
with `--check`. torchcodec is uninstalled.

## K4 — IndexTTS-2 pins Python < 3.12 and torch 2.8

**Symptom.** Installing the model's requirements on a Python 3.12 + torch 2.9 host either fails to
resolve or downgrades torch, breaking the render environment.

**Mechanism.** `pyproject.toml` declares `python >=3.10,<3.12` and `torch==2.8`; the model code
works on newer versions in practice.

**Fix here.** `pip install --no-deps` into a side venv that borrows the main site-packages via a
`.pth` file (a venv created with `--system-site-packages` does **not** inherit another venv).
Then pin `transformers==4.52.1` in the side venv: 4.57 removed `QuantizedCacheConfig`, which
IndexTTS imports. Use `use_fp16=True, use_cuda_kernel=False, use_deepspeed=False`.
Peak VRAM: ~7.9 GB of 8 GB.

## K5 — Downloading the TTS weights

**Symptom.** `hf download` stalls at 60-70%, or raises 404 when the library falls back to ModelScope
internally. Two files download at ~1.8 MB/s each — this is the link, not a bug (1.75 MB/s ≈ 14 Mbps
per stream; two streams ≈ 28 Mbps of a 30 Mbps line).

**Workaround.** `HF_ENDPOINT=https://hf-mirror.com` and `USE_MODELSCOPE=false`; pre-download the
two lazy files (`conformer_shaw.pt` ~2.2 GB, `model.safetensors` ~2.2 GB) with a resumable
downloader, then point `--model-dir` at the directory.

## K6 — ffmpeg loudnorm: the first-pass JSON keys

**Symptom.** The second pass produces nonsense or the assertion fails with `null` values.

**Mechanism.** The first-pass JSON exposes `input_i`, `input_tp`, `input_lra`,
`input_thresh`, `target_offset`, `output_i`… There is no `measured_i` key on the input side;
a pattern built around `measured_i` matches nothing and the script silently builds an invalid
filter chain. Also, the analysis pass must drop video (`-vn`) or ffmpeg errors with
"Output file does not contain any stream".

**Fix here.** `scripts/audio/loudnorm.sh` matches the `input_*` block and asserts every value
before use.

## K7 — TransitionSeries eats frames

**Symptom.** The last 1-2 seconds of a film are black, or captions drift out of sync at the end.

**Mechanism.** With N scenes and fade length F, the composition duration is
`sum(durations) - (N-1)*F`. Declaring `sum(durations)` leaves a black tail.

**Fix here.** The demo uses hard cuts (no overlap), so duration equals the sum. If you add
transitions, subtract `(N-1)*F` in `Root.tsx`.

## K8 — KaTeX display mode fights the layout

**Symptom.** Equations are centred and carry large vertical margins inside a left-aligned panel;
lines overflow a fixed-height card.

**Fix here.** Render inline (`displayMode:false`) with `\\displaystyle` prefixed to the TeX, and
control alignment from the parent. `MathLine` then owns numbering and active-state highlighting.

## K9 — Long jobs die with their shell

**Symptom.** A 5-minute render or a 4 GB download is killed when the controlling session ends; in
our harness, waiting on a job with a very long blocking timeout also killed the child process tree.

**Fix here.** Run long stages under a supervisor
(`systemd-run --unit=... --collect --property=StandardOutput=file:/tmp/x.log`) and read the log.
`nohup` and `setsid` from a session that exits were not reliable here.

## K10 — npm scripts and PATH

**Symptom.** `env: 'node': No such file or directory` when running `npm run ...` with a
tarball-installed Node.

**Mechanism.** npm's shebang is `#!/usr/bin/env node`; if the tarball's `bin` directory is not on
PATH, npm itself runs but child scripts cannot find `node`.

**Fix here.** `scripts/bootstrap.sh` exports the local Node path, and every script re-exports it.

## K11 — WSL2 disk space does not shrink

**Symptom.** Files are deleted inside the distro, but the Windows `.vhdx` stays the same size.

**Fix here.** `fstrim -av` inside the distro, then (with the distro fully stopped)
`wsl --manage <distro> --set-sparse true` or `diskpart` `compact vdisk`. In this project
59.6 GiB was reclaimed inside the guest and the image dropped from 159.8 GB to 93.0 GB after
compaction. Stopping the distro from inside itself does not work: a separate host-side stop
(`wsl --shutdown`) is required.

## K12 — A trace field that the renderer assumed

**Symptom.** One step caption reads `"pivot placed at index undefined"`, and the pivot highlight
disappears on exactly those steps. Everything else renders fine, so stills sampled elsewhere miss it.

**Mechanism.** The recorder emits `{op:"place", p:3, lo, hi}` — the final slot lives in `p` — while
the renderer's earlier draft used `{type:"place", i:3}`. `script.ts` normalises `op` to
`type`, which hid half the mismatch, but `st.i` stayed undefined. A code-generated film inherits
every assumption its data schema broke.

**Fix here.** Read both spellings through one accessor:
`const iOf = (st: any) => st.i !== undefined ? st.i : st.p;` plus `opOf()` for the op name — and
assert on a sample frame where a `place` step is on screen. (Careful with a global regex rename of
`st.i`: it rewrites the accessor's own body into infinite recursion and Remotion fails with
`RangeError: Maximum call stack size exceeded`.)

## K13 — Two mounts in the render page, and a probe that measures the wrong one

**Symptom.** The still-lint probe either reported every box at coordinates like `-66,-1000777`, or
reported nothing at all for some compositions while working for others, so the gate exited 2.

**Mechanism.** `@remotion/renderer` mounts the composition twice: the Studio bundle keeps a hidden
mount (`position:fixed; top:-999999`, laid out at zero width) and it mounts *first*; the composition
that is actually screenshotted lives in `#remotion-canvas` and appears later. Worse, React does not
remount when the renderer moves that DOM into the canvas, so a layout effect that runs once will
measure the hidden mount and never run again.

**Fix here.** Do not measure on the first effect. Poll (25 ms, up to 3 s, while `delayRender` keeps
the frame blocked) until a `#remotion-canvas` exists that *contains the probe and has children*,
then measure relative to its rect. Keep the "exactly one report per frame" assertion in the
script — a silent probe is a broken gate, not a pass.

## K14 — A score that is present, mixed, correlated, and inaudible

**Symptom.** The delivered lecture "has no BGM". The mix disagrees: in every pause the final
programme correlates with the score stem at r = 0.9999, so the music was rendered, mixed at a sane
level and normalised — it is simply not hearable on a phone or a laptop speaker.

**Mechanism.** The score's energy lived where small speakers cannot go. The old stem measured
-24.65 dBFS full band but **-34.56 dBFS after a 300 Hz high-pass** (a 9.9 dB loss), with 36% of its
power between 20 and 120 Hz (kick 0.5 and a bass sine 0.16) while the pad sat at 0.055/3 ≈ 0.018 per
voice and the arpeggio at 0.035. In a pause the bed's audible residue was about -36 dB against a
-16 dB narration: 20 dB down, i.e. silence to the ear. Loudness normalisation cannot repair this —
it raises the whole spectrum, and the missing band stays missing. Measured through a 300 Hz
high-pass, the delivered mix's gaps read -41.95 dBFS; a bed needs roughly -34..-20 dBFS *there*.

**Fix here.** Three things, in this order: (1) put the score's power in 250-4k — pad low-pass up to
1200-2100 Hz, pad 0.13/voice, arp 0.13+0.04·energy, bass 0.045, kick 0.10·energy; (2) mix outside the
renderer with `scripts/audio/mix.mjs` (ducking -4.5 dB, fades, peak guard) so levels can be changed
without re-rendering 305 s of frames; (3) gate it with `scripts/qa/music_gate.py` in two modes —
`--music` on the stem (>= 50% of power in 250-4k, <= 20% in 20-120 Hz, high-pass loss <= 7 dB) and
`--mix/--narration` on the programme (bed 5-18 dB under speech in gaps, gap audible band
-34..-20 dBFS). The gate ships with `--self-test` fixtures so it cannot quietly stop firing.

## K15 — A "share of energy" gate that summed magnitudes

**Symptom.** `music_gate.py --self-test` rejected its own good fixture: three pure tones (440/660/880
Hz) reported an "audible band share" of 21%.

**Mechanism.** The share was computed on `|rfft()|` summed bin by bin. A windowed noise floor — even at
1% of the signal's power — contributes ~100k small magnitudes, and their sum swamps three sine peaks.
Magnitude-sum is not energy. With the same fix, the real stems also changed verdict: the old one went
from "39% audible / 36% sub" to **11% / 76%**, i.e. the gate had been under-reporting the defect it
was written to catch.

**Fix here.** Weight by power (`|X|**2`) whenever a share of energy is meant, and keep the fixture:
a gate whose fixture passes for the wrong reason will pass the real input for the wrong reason too.
