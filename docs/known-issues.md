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

## K16 — An induction proof that does not close

**Symptom.** The multiplication film's recursion scene proved `T(n) = Theta(n^log2 3)` by guessing
`T(n) <= c n^p` and substituting: `3c(n/2)^p + cn <= cn^p + cn`, therefore `cn <= cn^p (1 - 3/2^p)`,
"which holds for large enough c". At `p = log2 3` the right side is **zero**, and the inequality is
false for every n > 0. The narration said the `dn` term "gets absorbed"; it cannot.

**Mechanism.** With `3/2^p = 1` the substitution reproduces exactly the bound plus one `dn`, so the
plain guess has no slack left to pay for the merge step. This is the standard reason the textbook
induction strengthens the hypothesis: guess `T(n) <= c n^p - 2dn`. Then
`3(c(n/2)^p - dn) + dn = c n^p - 2dn` — the extra term cancels itself, and only the base case needs
a large enough `c`.

**Fix here.** Screen and narration both replaced with the strengthened guess. The lesson is not about
Karatsuba: a proof written for a video is still a proof, so substitute one step before believing it.
A slide that says "for large enough c" is a smell — check that the algebra actually has a free c.

## K17 — `--out` that quietly became a boolean

**Symptom.** `node scripts/audio/render_music.mjs --out /tmp/score.wav --duration=593` spent 20 minutes
rendering and left no `/tmp/score.wav`. The JSON summary said `"out":"true"`.

**Mechanism.** `render_music.mjs` parsed arguments as `--k=v` only: `a.replace(/^--/,"").split("=")`
gives `["out", undefined]` for `--out`, which the fallback turned into the string `"true"`. The score
was written to a file literally named `true` in the working directory. `make.mjs` and `mix.mjs` had
already learned to accept both forms; this one had not.

**Fix here.** One parser for both forms (`--k=v` and `--k v`), plus an explicit refusal:
`if (args.out === "true") throw`. When an option takes a path, "present but empty" has to be an error,
not a default.

## K18 — A gate that measured a different tree

**Symptom.** Two 20-minute renders were thrown away because the working copy in the WSL distro
(`/tmp/bp`) was a synced snapshot from before the edit. Every gate passed — on the old tree. Nothing
in the output said which tree it had measured, so the mistake only surfaced when the frames were
looked at.

**Mechanism.** Gates assert properties of whatever files are on disk. A copy in another filesystem
(WSL `/tmp`, a container, a scratch clone) has no link back to the authoring tree, and the sync step
is a shell pipeline whose failure is easy to miss: the copy looks present and complete, it is just
old. Cost rises with the expensive stage — the further into the run the mismatch is discovered, the
more of it is wasted, and the failure is silent because a stale tree is a *valid* tree.

**Fix here.** `scripts/qa/tree_hash.mjs` prints one hash over `src/`, `data/`, `scripts/` and the
render config (per-part hashes plus a combined tree hash, 16 hex chars each). `make` writes it to
`report.json` as `numbers.tree` and refuses to start when `--expect-tree` disagrees:
`make: FAIL — this tree is 3f2a... but the caller expected 5b91...`. The check runs before any gate,
so the cost of a stale copy is one second instead of one render.

## K19 — Hard-coded review frames, and a line box that is not the glyph

**Symptom (a).** After the still-lint gate was written, every later change to a scene's duration
silently moved what the listed frames showed. The gate kept passing: it was still rendering *some*
frame, just not the one a human had reviewed. The clamp made it worse —
`Math.min(wanted, durationInFrames - 1)` turned an out-of-range target into the last frame instead of
an error.

**Symptom (b).** With frames derived from the script, one frame reported an overlap between a kicker
(`ALGORITHM / MULTIPLICATION`) and the 108 px title below it, though the picture shows clear space.
Both boxes were correct: the title's *layout box* starts at y=169, but its text range starts at
y=147 — a 108 px line box carries ~22 px of half-leading above the glyphs.

**Mechanism.** (a) Frame numbers are derived data: they depend on scene durations, which live in the
script. Anything that stores them by hand rots. A clamp converts a rotten target into a plausible
wrong answer, which is worse than a crash. (b) `getClientRects()` describes line boxes, not ink. An
overlap test on line boxes reports overlaps that no reader can see.

**Fix here.** (a) `still_lint.mjs` derives frames per film from `SCENES` (midpoint of each scene,
accumulated — the lecture's `SCENES` carry `dur`, not `start`) and exits 2 on an out-of-range frame
with `update the targets, do not clamp`. (b) For text boxes the overlap test uses the intersection of
the layout box and the text range, so half-leading cannot create a phantom overlap; real overflow is
still caught by the `spills` rule, which measures against the layout box.

## K20 — A 3D canvas renders once per frame, so a late asset is silently absent

**Symptom.** The imported `.glb` never appeared in shots B and C of `ThreeStage`. The frames were
not broken: the ground plane, the lighting and the shadow were all there, so the scene read as an
empty studio rather than a failure. The coverage gate passed (12.20 % on frame 450 — the ground
plane alone exceeds the 1.5 % floor) and the determinism check passed, because the empty frame is
perfectly deterministic. Copying the model into `public/models/` and reloading changed nothing.

**Mechanism.** Two independent traps sit between "the file exists" and "the frame shows it".

1. `@remotion/three` renders with the R3F frameloop set to `never`. The canvas advances once per
   frame, from `useCurrentFrame()`, inside `ManualFrameRenderer`'s effect
   (`advance(performance.now()); onRendered()`). A model that finishes parsing after the canvas has
   mounted changes the scene graph, but nothing advances the loop afterwards — R3F's own
   `invalidate()` has no listener in this mode. Deferring `continueRender` with
   `requestAnimationFrame` does not help either: the capture frame is still empty, and it violates
   the no-real-clock rule.
2. `GLTFLoader` given `"models/x.glb"` requests `/models/x.glb` and 404s, because the bundle
   serves `public/` under `<bundle>/public/` and the page exposes that prefix as
   `window.remotion_staticBase`. `staticFile()` is not cosmetic.

The same shape of bug appears with any async resource inside a `ThreeCanvas`: textures, environment
maps, HDRIs, `useLoader` calls made from a component *inside* the canvas.

**Fix here.** Assets load **before** the canvas mounts. `useGltf` runs outside `Canvas3D`, holds
the frame with `delayRender`, and the shot returns an empty background until the scene graph is
ready; only then does the canvas appear, and its first advance already contains the model. Paths go
through `staticFile()`. See `docs/3d.md`.

**Lesson for the gate.** Coverage, mean luma and determinism all passed on a wrong frame: they
measure "something was drawn", not "the thing we meant was drawn". A gate cannot distinguish an
empty studio from a studio with a model — the still review does. Keep both.

## K21 — "It rendered" is not "the GPU rendered", and the engine enum lies

**Symptom.** Two passes that looked like successes and were not.

1. `--engine eevee --probe` returned `{"ok": true, "engine": "BLENDER_EEVEE", "seconds": 8.82}` for a
   **64×64, 4-sample** frame. It rendered. It rendered on `llvmpipe`, Mesa's software rasteriser,
   which is what `blender -b` gets when there is no display: `libEGL warning: failed to get driver
   name for fd -1`, `MESA: error: ZINK: failed to choose pdev`, `EGL Error (0x3009): EGL_BAD_MATCH`.
   The same probe on Cycles/CUDA took **0.43 s** on the `RTX 5070 Laptop GPU`.
2. `--engine cycles` reported `"engine 'cycles' unavailable", "available": ["BLENDER_EEVEE"]` while
   the Cycles module was demonstrably loaded and enabled.

**Mechanism.** The first is a silent backend downgrade: EEVEE needs a GL context, a headless Linux
box has none, Mesa hands back llvmpipe, and Blender is happy. Nothing in the exit status or the
output JSON says "this is 20× slower than it should be"; you have to read the renderer string. The
second is a Blender implementation detail: engines added by an addon register dynamically, and
`bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items` keeps listing only the built-ins.
Under `--factory-startup` the Cycles addon is loaded but not enabled either, so even a "did it load"
check passes while the engine stays unreachable.

**Fix here.** `resolve_engine()` probes by **assignment** — `scene.render.engine = "CYCLES"` inside a
`try`, `TypeError` means unavailable — and `ensure_cycles()` enables the addon before that. The probe
prints `gpu.renderer` and the actual `compute_device_type`/`device list`, so "which silicon" is part
of the evidence rather than an assumption. Plates are rendered with Cycles; EEVEE in background mode
is documented as a CI trap.

**Lesson for the gate.** A green `ok: true` from a renderer answers "did a PNG appear", not "did the
path we paid for run". Probes should print the thing that would differ if the fast path were
unavailable — here the renderer string and the device name — and someone should read it.

## K22 — An isosurface extractor is watertight right up until it quietly drops a quad

**Symptom.** Three ways the same extractor produced a mesh that looked fine on screen and was not
a solid:

1. Marching tetrahedra with a fixed cube decomposition: 161,172 boundary edges on the gear and
   56,584 non-manifold edges. Every triangle was in the right place; the shared faces between
   neighbouring cells were triangulated along *different diagonals*, so the surface had hairline
   cracks the whole way through.
2. Surface nets, bounding box found by scanning for interior samples at 48³: the scan missed the
   chip's 0.03-half-thickness pins, the box closed onto the solid, the extractor clipped the
   surface at the boundary, and 872 edges came out open. The mesh still rendered, just with a hole
   where the clip was.
3. Newton-projecting each vertex onto the isosurface with `p -= f * grad f / |grad f|^2`: vertices
   flew 46 units away from a 2-unit prop and the volume came out 4×10⁴ % high.

**Mechanism.** Each is the same class of bug: a step that is *usually* a no-op becomes visible only
when a feature is smaller than a cell. A tetrahedral face diagonal is invisible on a smooth blob and
fatal on a lathe; a bounding-box scan is exact for a sphere and wrong for a pin; Newton's step is
exact for a true distance field (`|grad f| = 1`) and divergent where a boolean of primitives gives
only a bound, because `|grad f|` can be near zero while the threshold check ("gradient is not
zero") still passes. And watertightness cannot be seen in a picture — an open crack renders as a
slightly different shade.

**Fix here.** Surface nets (one vertex per crossed cell, one quad per crossing grid edge) makes
watertightness a property of the construction. Props declare their own cubic bounds instead of
scanning for one. The Newton step is normalised, clamped to 1.2 cells and skipped when
`|grad f| < 0.2`; the gradient itself is a centred difference *divided by 2h* (the undivided
version has `|g| ≈ 0.015`, which silently skips every projection — that cost a round too).
Finally, the generator counts boundary and non-manifold edges itself, refuses to write a file that
fails, and `model_lint --watertight` re-derives the same numbers from the bytes.

**Lesson for the gate.** "It is a closed surface" is a countable claim, so count it: every
undirected edge used exactly twice, in opposite directions (and every edge oriented consistently
with the outward normal). If a generator cannot prove that from its own topology, it cannot claim
watertight in a doc either. The corollary is documented as a limit in `docs/sdf-assets.md`: a
feature thinner than one cell does not degrade gracefully — it tears the mesh.

## K23 — A 3D canvas inset with CSS is still a 1920×1080 camera

**Symptom.** The gears film put `<Canvas3D>` inside a `div` that started at 46 % of the frame
width, to leave the left half for text. Frames came back with the subject clipped to the right
edge, and an involute shot where the whole gear was a thin sliver at 3 % coverage. Nothing errored:
the composition rendered, the frame gate (coverage ≥ 1.5 %) passed, and only a human could see
that the composition was wrong.

**Mechanism.** `ThreeCanvas` takes its drawing-buffer width and height from `useVideoConfig()`,
which is 1920×1080 regardless of the CSS box it is placed in. A 54 %-wide parent therefore
*stretches* a full-frame projection; the camera does not get a narrower frustum, it gets a
distorted one. The same mistake has a second form: a flat part (a gear plate, a disc) lit only by
the three-point rig from above reflects almost nothing on its face — the key light at
`(5.2, 7.4, 4.6)` is nearly perpendicular to the face normal, so the plate renders as a dark
silhouette with lit edges. And `THREE.Line`'s `linewidth` is ignored by WebGL, so a 1 px line on
a 1080p frame is invisible.

**Fix here.** The canvas is full-bleed and transparent; to give the left half to text, the *scene
graph* is shifted in camera space (`<group position={[shift, 0, 0]}>`), not the DOM. Every flat
shot adds a front fill light (`position={[1.2, 3.2, 9]}`, intensity 2.2) so the plate face gets
diffuse light. Curves are drawn as tubes (`TubeGeometry`, 2.4 mm radius), never as lines.

**Lesson for the gate.** A coverage floor proves *something* was drawn in the right region; it
cannot prove the camera is framed. Two gates that would have caught this cheaply: render one
full-frame still at the same frame with the 3D layer isolated and compare its bounding box against
a declared rectangle, and assert the canvas element's aspect ratio equals the composition's. Both
are cheaper than a human noticing a sliver.

## K24 — Two independent roundings leave a one-frame hole, and the hole is black

**Symptom.** The first delivery of the gears film failed the flicker gate on one frame:
`frame 6480 (216.00 s) depth=9.7 val=14.0 peak_l=23.7 peak_r=59.3` plus jumps of 24.4 and 44.9
at two other scene borders. The frames were not dim — they were *empty*: background only, no
title, no subtitle, no model, luma 14.0 exactly.

**Mechanism.** A scene list has fractional starts (26.43 s, 55.95 s …). The composition placed each
scene with `from={round(start*30)}` and `durationInFrames={round(dur*30)}`, while the editor
renders segments on boundaries derived from the *next* scene's start. When the two roundings
disagree by one, the last frame of a segment belongs to neither scene: every `<Sequence>` has
ended and the next has not begun. `Gears` had three such holes (frames 4533, 6480, 7350), all of
which rendered as bare background — which is exactly what a one-frame black flash is.

**Fix here.** Boundaries, not durations: `durationInFrames={nextStart - thisStart}` with
`TOTAL - start` for the last scene, so consecutive sequences tile the timeline exactly. Re-render
with the same cut list; the gate goes from three failures to `PASS no luma jump and no blink dip`.

**Lesson for the gate.** A composition can render, pass coverage, pass determinism, and still have a
one-frame hole, because nothing in the frame gate watches *time*. The flicker gate is the only one
that sees it, and it only sees it if nobody masks it away: the cut-frame list is a declaration that
"this frame is supposed to be different", so it must be earned — the first run's list would have
hidden the black frame too if the gate had been given it before the fix.

**Corollary for the editor.** `render_scenes.mjs` already tiles by boundaries; the composition must
use the same arithmetic, or the two disagree at the seams. There is now a second reason to keep the
scene table integer where possible: `start` values that land on a half frame (x.5) round
inconsistently between the two files.

## K25 — One number under the wrong label inverts the whole argument

**Symptom.** None. The hawk film rendered clean, passed tsc, passed all four static gates, and looked
right in twelve still frames. Then I re-read `paper.txt` line by line against `eval.json` and found
eleven numbers carrying the wrong label — the worst being "采集开销是基线的 **71.5 倍**"
(the paper's `collectionTimeRatio` is **1/71.5**, i.e. this system is 71.5× *cheaper*) and
"同步精度 5 ms" (5 ms is LIT2020's number; Hawk's own is 61.8 µs max / 220 µs at 99.65%,
three orders of magnitude and someone else's credit).

**Mechanism.** A paper-reading film has two independent sources of error and both are silent:
the picture can be wrong (caught by still lint) and the *claim* can be wrong (caught by nothing).
The gates all measure the renderer: contrast, type tokens, film isolation, luma, loudness. Not one of
them reads the sentence. And because a narration line and its number card are authored at different
times, a wrong ratio survives as long as the two agree with each other.

**Fix here.** A single hand-written ledger (`data/hawk/eval.json`) that no component may bypass, each
entry carrying `meta.note` with the source table; then a full pass where every on-screen number is
grepped back to a line in `paper.txt`. Eleven corrections, all listed in `docs/hawk.md` §5.
The narration lines that quoted a wrong value were changed too, and the TTS was re-run — which is why
content-addressed clip naming (K-less, see §6 of the doc) matters: 13 clips re-synthesised, 136 reused.

**Lesson.** For a film whose subject is someone else's evidence, "the code type-checks" is worth
nothing. The only gate that would have caught these is a human reading the ledger against the source,
so the ledger has to be small enough to read in one sitting and structured so each row is checkable in
isolation — number, label, unit, source. Numbers that come in pairs (this system vs. baseline) are
where the direction gets flipped, and every one of them needs both halves written down explicitly.

## K26 — A pre-computed difference series argued the opposite of the slide it was drawn on

**Symptom.** Scene 7 was supposed to show "subtract the previous steady state, and a 40 W step rises out
from under a 1500 W background". The rendered curve showed a clean `+40 W` plateau *and* a
`−1500 W` cliff that dominated the axis; the dashed highlight landed on the wrong segment, and with a
naive autoscale the whole `+40 W` region collapsed into a flat line.

**Mechanism.** `wave.json` carried `series.diff` — a 30-cycle sliding-window difference, useful for the
SNR argument but wrong for *this* picture. When the 1500 W kettle step slides out of the 30-cycle
window, the difference returns to zero with a 1500 W edge, so the series contains a huge negative step
that has nothing to do with the appliance being recognised. The paper's "steady-state difference" is
not that series; it is "after the step settles, difference against the new steady state".

**Fix here.** Compute it in the component, for the picture's purpose:
`d30[i] = total[i] - total[i - LAG]` with `LAG = 30`, clip the axis to ±90 W, annotate the 1500 W edge
as explicitly out of range, and auto-detect the `18 < v < 90` run to place the `+40 W` box.
Also: the raw series has 30 leading `null`s (no history), and `Math.min(...arr)` over that is `NaN`,
which silently kills the whole polyline — the `Line` component now takes `(number|null)[]` and skips
null segments instead of interpolating through them.

**Lesson.** A derived data file is derived *for one question*. Reusing it in a scene that asks a
different question produces a figure that is internally consistent, correct-looking, and arguing the
opposite. The tell was that the argument and the picture disagreed in mood ("40 W emerges" vs. a
1500 W cliff); when a chart needs a sentence to explain why it looks wrong, the chart is wrong.

## K27 — The DOM probe measures before the image decodes, so a correct frame fails

**Symptom.** With `still_lint` finally pointed at the hawk film (it had been missing from `FILM_SCRIPTS`,
so the gate passed on a list that did not include the new film), two of twelve frames failed on
`overlap`: the `原文 Figure 10` badge against the caption under the same figure, boxes intersecting by
76 % of the smaller one. Both frames render perfectly — the badge is in the top-left corner of the
figure and the caption is 300 px below it.

**Mechanism.** The probe is `src/design/lint.tsx`, a React effect that reports `getBoundingClientRect`
for every text node — it runs when the composition is ready, which is before the `<Img>` has finished
decoding. `Fig` sized its box from the image itself (`<Img style={{width:"100%"}}>`), so at probe time
the box was zero-height, the caption sat 8 px under the badge, and the measured layout described a
frame that never existed on screen. Only figures that carry both a badge and a caption can fail, which
is why exactly the two `Fig` frames were flagged and the other ten were clean.

**Fix here.** `Fig` takes the native pixel size (`w`/`h`) and reserves `height = width*h/w` on the box,
so layout no longer depends on decode order. The gate then measures what paints; the frame itself is
byte-identical after load, but a picture is not allowed to depend on a race just because that race
happens to be resolved by the time it is encoded.

**Lesson.** "The rendered PNG looks right" and "the probe says the layout is wrong" are compatible when
the probe runs earlier than paint. Both are true statements about different moments. A layout that
needs a loaded asset to have its correct size is a latent bug in *any* measuring pipeline — and the
still-frame gate is the only gate here that measures layout rather than pixels, so it is the only one
that can see it. Corollary: adding a film to the repository but not to `FILM_SCRIPTS` silently turns
the gate off for that film — which is what happened here for two make runs before the list caught up.

## K28 — A `.gitignore` rule appended without a leading newline disables nothing, quietly

**Symptom.** `git status` showed `?? public/voice/hawk/` (26 MB, 149 wav files) after the commit that was
supposed to ignore it. The rule was there: line 20 of `.gitignore` read `*.logpublic/voice/hawk/`.

**Mechanism.** The previous line was `*.log` with no trailing newline; the append concatenated two
patterns into one string that matches neither. git reported no error, the file looked right in an
editor that soft-wraps, and the next `git add -A` would have committed the audio.

**Fix here.** Split the line, then confirm with `git check-ignore -v` rather than by eye
(`git check-ignore` names the matching rule and its line number). The habit worth keeping: after
editing an ignore file, ask git what it thinks, not the file.

## K29 documentation drift is invisible because nothing reads the docs

**Symptom.** The README described a 12-composition repo with two films; the tree had 15
compositions and four films. It quoted 591 s for a 587.9 s film, 86.5 % for an 86.7 % 3D share,
"24 frames" for a 59-frame still gate, an 11-composition tree without `src/hawk/`, and a
known-issues index that stopped at K23 while the file reached K28. Every number was true on the day
it was typed.

**Why the gates missed it.** No gate read a prose file. `tsc` does not care what the README says,
and `docs/verify-report.md` is a record, not an assertion — so it aged quietly while the code moved.

**Fix.** `scripts/qa/docs_check.mjs` (gate 0.7) checks the anchors a grep can settle: the
composition count (from `src/Root.tsx`) appears in the README twice, every film in
`film_registry.mjs` is named, the verify step count quoted in §8 equals the number of `step`
lines in `verify.sh`, the K index reaches the newest entry and has no gaps, and every
`docs/*.md` is linked from the README. Prose and measured numbers still need a human — so
`docs/verify-report.md` is dated per section instead of being rewritten in place.

**Lesson.** A doc that quotes a number is a cache of that number with no invalidation. Either derive
it (a link, a generated table) or gate the copy.

## K30 a two-column PDF extracted with pdftotext -layout mixes columns inside a line

**Symptom.** `pdftotext -layout` on the Hawk paper produces lines that contain the left column and
then the right column of the page, so a sentence is intact but its *neighbours* are from another
column. A quote taken across two lines of that file is a quote that does not exist in the paper.

**Consequence for the claims gate.** Every `quote` in `data/hawk/claims.json` is a contiguous
slice of **one physical line** of `paper.txt`, of 20-120 characters, and the gate normalises
whitespace before matching. That is a real constraint on how the ledger is written, and it is why
the file is committed: a gate that cannot quote the text it checks is decoration.

**Lesson.** Extraction is part of the evidence chain. When the artefact is a text dump, say which
tool produced it and what it mangles; then shape the checker around the mangling instead of hoping.

## K31 a "how much did the picture move" metric can hide motion, not just reveal it

**Symptom.** `pacing.py` reported a 16 s still run inside the Hawk diff scene, and three scenes
above 12 s. Two of those numbers were artefacts: the metric was the **mean** absolute difference over
the whole frame, so a line being drawn slowly across 12 s changed too little on average to register,
while a genuinely dead card and a crawling line were indistinguishable in the output. Chasing the
number would have meant speeding up a plot that was already readable.

**Fix.** Judge on **how many pixels changed** (`>2/255`, ≥ 0.4 % of the frame counts as movement)
instead of the frame mean. Slow drawing now counts, a static card still does not. Re-measured, the
worst run in the film is 5.8 s, not 16 s.

**What remained real.** The beats change (`beatAt` / `beatFrames` in `src/hawk/shared.tsx`) was
still worth doing: vote went 13.0 → 4.6 s, concepts 12.4 → 5.2 s, limits 10.0 → 4.8 s, gray
13.8 → 5.6 s. That part was a real dead-zone list, not a metric artefact.

**Lesson.** A measurement is a model of the viewer, and it can be wrong in the direction that wastes
work. When a metric says "fix this", open the file it measured and look at the frames before rewriting
the animation — and if the metric cannot tell two different defects apart, fix the metric first.
