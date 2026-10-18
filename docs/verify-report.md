# Verification report — the acceptance run

This file is the actual record of the acceptance run behind the numbers in the README. It was
produced by `npm run verify` in this repository, on the reference machine, on 2026-10-17.

## Environment used

| Item | Value |
| --- | --- |
| OS | Ubuntu 24.04.2 LTS under WSL2 (Windows 11 host) |
| CPU / RAM | 20 logical cores / 54 GB visible to WSL |
| GPU | RTX 5070 Laptop 8 GB (not used by this gate) |
| Node | v22.21.1 (tarball) |
| Remotion | 4.0.536, Chromium renderer with `angle` |
| ffmpeg | 6.1.1 |
| npm packages | 289 |

## First run failed — and why that was useful

The first full run on a clean directory ended at step 6 with:

```
[flicker] frame 450-462: single-frame delta 15.0-20.0
[flicker] frame 630: delta 224.5, blink depth 121.5
FAIL flicker
```

Two real defects in the demo template, both invisible to the loudness and typecheck gates:

1. `SceneShell` faded the *whole* layer, background included, so a cut pulled the frame through the
   parent's base colour — a dip that the mean-luma window of ±2 did not flag.
2. The palette mixed a near-white scene (`#F5F1E8`) with dark scenes, so any cross-fade crossed the
   entire luminance range.

Fix (committed here): the background is painted by each scene and never fades (only content does),
and consecutive scenes stay in one low-luminance family. No cross-transitions are used anywhere.

A second, unrelated failure in the same run was a missing dependency: `scripts/audio/engine.mjs`
imports `node-web-audio-api`, which had been left out of `package.json` (a fresh `npm install` in
the clean directory therefore produced a tree that could not render sound). It is declared now.
Step 3 of `verify.sh` runs that module for real, so the failure mode is loud rather than silent.

## Second run (the recorded result)

```
1/6  typecheck          tsc --noEmit                                    PASS
1.5/6 headless browser  npx remotion browser ensure                     PASS
2/6  stills             Storyboard f60, Lecture f2500, Typesetting f60  PASS
3/6  score              deterministic wav from seed 11                 PASS
4/6  render             Showreel 30.10 s, h264 + aac                   PASS
5/6  loudness           two-pass loudnorm                              PASS
6/6  flicker            per-frame luma jump + blink dip                PASS

loudnorm: in  I = -26.17 LUFS, TP = -10.47 dBTP
loudnorm: out I = -15.2  LUFS, TP =  -1.6  dBTP (linear)
flicker:  frames = 900, mean = 29.40, min = 13.25, max = 35.15
          mean|delta| = 0.0461, p99 = 0.8197, max = 6.57  (threshold 12)
VERIFY_EXIT=0
```

Artefacts written to `out/verify/`:

| File | Meaning |
| --- | --- |
| `still_storyboard.png` | generic storyboard composition, frame 60 |
| `still_lecture_proof.png` | the proof scene, frame 2500 — the frame that caught K12 |
| `still_typesetting.png` | KaTeX scene, frame 60 |
| `showreel.mp4` | 30 s render, pre-normalisation |
| `showreel_norm.mp4` | after two-pass loudnorm, video stream untouched |

## The full production (not part of `verify`)

The 305 s lecture in the README was rendered with the same code path:

| Property | Measured |
| --- | --- |
| Duration / fps / size | 305.100 s, 30 fps, 1920x1080 |
| Codec | h264 4:2:0, aac 48 kHz 192 kbit/s |
| Loudness | I = -15.1 LUFS, TP = -1.8 dBTP |
| Flicker gate | max single-frame delta 9.68 (threshold 12) |
| Render time | ~5 min, 2 concurrent renderers, CPU only |
| File size | 14,618,563 bytes |

Narration is 41 synthesized lines re-timed against measured speech durations; the score is 306 s
rendered from seed 11. Both are inputs to the render, not outputs of it.

## Presets: three looks, one role contract (D7)

Colour used to arrive through a single `PALETTE` object, so a second look meant a forked component.
Scenes now name a role and read it from a `PaletteScope`; a preset is a pointer to a family that
answers the same role names. Two preset families were added next to the shipped one, and the
gallery composition renders the same title scene in all three.

| Preset | Family | Polarity | Tightest contrast (needs 4.5 unless noted) |
| --- | --- | --- | --- |
| `midnight` (default) | `storyboard` | light on dark | accent.primary 5.72 on the raised surface |
| `paper` | `paper` | **dark on light** | accent.primary 4.83; text.primary 14.84 (needs 7) |
| `slate` | `slate` | light on dark | text.secondary 6.49 |

![Paper preset: dark ink on a warm ground, caption inverted onto a light scrim](images/still_preset_paper.png)

![Slate preset: the same layout, cool blue-black with a pale blue rule](images/still_preset_slate.png)

`paper` is the useful one to argue about: it flips the caption polarity, and it only works because
the caption reads `text.caption` / `surface.scrim` as roles instead of "white on black". The check
that a preset cannot cheat is structural — `design_check.py` runs each preset's family through the
same contrast rules, prints the tightest pair (`preset paper -> paper tightest: accent.primary 4.83`),
and fails a default that is not the `storyboard` family, so promoting a look to default has to be
admitted as a re-release.

Default-path evidence: with no `preset` prop, the eleven stills compared in the type section above
re-render **byte-identical** (`01ecdc89…`, `4f4563a6…`, `487d9aee…`, `5a8c6591…`, `dc082e57…`,
`3cd2f4c2…`, `e5dd114b…`, `914eade0…`, `a59a274e…`, `3b963bf4…`, `af76635c…`), including the
lecture frame whose AA state was already pinned in this tree. The refactor moved where colour is
looked up, not what is painted.

## Type: the template family and the ratchet (D2 / D3)

The storyboard template's eight sizes and five tracking values now live in
`data/design.spec.json` under `type.families.storyboard` and reach the components as `SB.*` /
`SB_T.*`; the four scene files no longer name a pixel value. The point of the change was to move
work, not to move pixels, so it was verified by re-rendering the same frames before and after:

| Frame | Before | After |
| --- | --- | --- |
| Storyboard f60 / f300 | `01ecdc89…` / `4f4563a6…` | identical |
| Showreel f90 / f400 | `487d9aee…` / `5a8c6591…` | identical |
| Lecture f1200 / f2500 / f4100 | `3cd2f4c2…` / `e5dd114b…` / `914eade0…` | identical |
| Transitions f90, Typesetting f90, ThreeCube f30 | `a59a274e…`, `3b963bf4…`, `af76635c…` | identical |
| Lecture f300 | `f9af751d…` (123,153 B) | `dc082e57…` (123,018 B) |

Ten of eleven frames are byte-identical. Lecture f300 differs in **19 pixels by at most 1/255**,
inside a 3 x 20 px strip at the page margin (rows 466-485, columns 72-74) — one antialiasing step on
one glyph edge, not a layout change. Three re-renders of the same tree produce the same
`dc082e57…`, so the difference is reproducible and belongs to the render (font/DOM ordering changed
with the bundle), not to a flaky capture. Recorded rather than rounded away: stills are content-
deterministic here, not byte-deterministic across bundle revisions, and a review that demands
byte-equality would fail on noise.

Tracking ratios, printed by `design_check.py` on every run:

| Role | Tracking / size | Ratio | Status |
| --- | --- | --- | --- |
| title | 4 / 128 | 3.1 % | ok |
| subtitle | 6 / 44 | 13.6 % | **declared deviation** (`trackingDeviations`) |
| overline | 8 / 36 | 22.2 % | Latin-only label, reported not enforced |
| ordinal | 2 / 30 | 6.7 % | Latin digits, reported not enforced |
| caption | 1 / 52 | 1.9 % | ok |

`design_check.py` now fails when a *new* CJK role crosses 5 % or when a declared deviation is stale
(ratio back under the limit), so D3 cannot grow quietly while its look-changing part stays open.

The lecture's own literals were not promoted into the contract: `src/lecture/Lecture.tsx` alone uses
**24 distinct font sizes** (15-108 px), which is the debt, not a scale. They are grandfathered in
`data/type-exceptions.json` — 52 literals across 9 files — and `scripts/qa/type_ratchet.py` fails
when the list gains an entry, duplicates a use, or keeps a stale one. Only storyboard/ reads tokens
today; the exception list is the measure of what is left.

## Delivery exports

`npm run publish` produces, from the lecture script alone:

| Artefact | Measured |
| --- | --- |
| `lecture.srt` | 41 cues, 00:00:00,550 -> 00:05:04,650, speaking 253.2 s; 16 cues wrapped to 2 lines, longest line 34 characters |
| `lecture.chapters.txt` | 9 chapters, 00:00:00 -> 00:05:00, sum 305.00 s |
| `lecture.chapters.ffmeta.txt` | same 9 chapters, ffmpeg sidecar (TIMEBASE 1/1000) |
| `cover.png` | frame 180 (6.00 s), 1920x1080, 104,308 bytes, sha256 9e323e57... |

The script exits non-zero instead of writing if any cue overlaps its neighbour, runs past the film,
or exceeds the 34-character caption budget in `data/design.spec.json`.

## Still lint (measurement of the rendered DOM)

`scripts/qa/still_lint.mjs` renders eleven frames across six compositions and reads the boxes the
browser actually produced. Result on this tree:

| Target | Frames | Boxes measured |
| --- | --- | --- |
| Storyboard | 60, 300 | 4, 3 |
| Showreel | 90, 400 | 4, 16 |
| Lecture | 300, 2500 | 14, 27 |
| Transitions | 60, 120 | 18, 2 (overlap rule skipped: a cross-fade superimposes two scenes) |
| Typesetting | 60, 200 | 151, 151 |
| ThreeCube | 30 | 0 (no text) |

Verdict: `PASS — 11 frames, no off-frame box, no edge text, no spill, no text overlap`. The fixture
composition still fails on exactly the three rules it breaks (`canvas`, `spill`, `overlap`), so the
gate is not vacuous; a frame that reports zero boxes exits 2 rather than passing.

Two refinements came out of the first run, and both are deliberate:

- Vertical text spill is only flagged beyond `max(6 px, 0.4 x font-size)`. A line box is shorter than
  its glyphs; descenders and KaTeX italic correction were being reported as layout defects.
- `Transitions` skips `overlap`. It exists to show a cross-fade, which by definition puts the
  outgoing and incoming scene's text in the same place for its duration.

## Sound: the bed that existed and could not be heard

The delivered v1 film appeared to have no background music. It had one: in every pause the programme
correlated with the score stem at r = 0.9999. The energy was simply outside what a laptop or phone
speaker can reproduce.

| Measurement | Old score/mix | New score/mix |
| --- | --- | --- |
| Stem, full-band median | -25.91 dBFS | -25.09 dBFS |
| Stem, 300 Hz high-pass median | -35.30 dBFS | -27.86 dBFS |
| Stem high-pass loss | 9.4 dB | 2.8 dB |
| Stem power 250-4k Hz | 11% | 63% |
| Stem power 20-120 Hz | 76% | 7% |
| Programme gaps, audible band | -41.95 dBFS | -28.50 dBFS |
| Bed vs speech in gaps | -22.9 dB | -12.3 dB |

The deliverable is gated by `scripts/qa/music_gate.py` in two modes: `--music` on the rendered
stem and `--mix/--narration` on the finished programme. `--self-test` synthesises a good and a
sub-only bed and requires the first to pass and the second to be rejected, so the gate cannot silently
stop firing. Fixing the gate changed its verdict on the *old* stem from "39% audible / 36% sub" to
"11% / 76%": it had been under-reporting the very defect it was written for, because it summed FFT
magnitudes instead of power (docs/known-issues.md K15).

## One command: `npm run make` (P5)

A delivery is now one command. The run below is the 305 s lecture, produced from the committed tree
with `node scripts/make.mjs --composition Lecture --out out/pkg_lecture --skip-static` — fifteen
stages, all exit 0, recorded in `out/pkg_lecture/report.json` (the file, not this table, is the
evidence; the table is a transcript of it).

| Stage | Result |
| --- | --- |
| probe composition | 305 s / 9150 frames declared |
| score | `render_music --duration=305 --seed=11 --energy=0.8` |
| music gate (stem) | full -25.09 dBFS, audible band -27.86 dBFS, 63.1 % in 250-4k, 6.8 % in 20-120 |
| render (picture only) | `--props '{"music":null,"narration":null}'` |
| probe duration | 305.000 s, 0.000 s from the declared duration |
| stills | frames 915 / 4118 / 7320 written for review |
| still lint | PASS, 14 target frames |
| mix | 306.2 s, duck 4.5 dB over 70.1 % of the film, peak -2.83 dBFS |
| music gate (mix) | speech -16.15, gap full-band -25.89, **gap audible-band -28.50** (-12.3 under speech) |
| mux | `-map 0:v:0 -map 1:a:0` — the picture's own track is dropped |
| loudnorm | I = -15.0 LUFS, TP = -2.0 dBTP |
| flicker gate | mean \|Δ\| 0.0121, p99 0.1095, **max 9.68** (threshold 12) |
| publish | 41 cues, 9 chapters summing to 305.00 s, cover frame 180 |

Film: 14,497,344 bytes, 305.000 s, sha256 `3b1fc7e37b90607a8e80ca1806594d8584940a68b369cc75b5390be824167b31`.
It is **not** byte-identical to the v1.0.0 release asset (14,618,563 bytes): that master was mixed
with the old, bass-heavy stem. Same picture, same narration, a score that survives a 300 Hz high-pass.

Two defects this orchestrator surfaced, both fixed in the same commit:

- The flicker gate prints the frame-luma range and then the diff statistics; both lines contain
  `max=`. The report quoted 25.17 (a legitimate luma *range*) as a flicker value. It now parses the
  `mean|d|` line only, and the report agrees with the gate: 9.68.
- A hard cut is a 100-level luma jump, so `Storyboard` (three scenes, hard cuts at 120/240) cannot
  pass a strict gate. `luma_blink.py` gained `--cut-frames`, which masks the cut ±2 frames and drops
  dips that span a cut; the default stays strict and the lecture's budget is unchanged at 12.

```
$ node scripts/make.mjs --composition Storyboard --out out/pkg_test --skip-static --cut-frames 120,240,270
...
mean|d|=0.3789 p99=0.9605 max=107.59 jump_thresh=12.0 cuts=3
PASS no luma jump and no blink dip
make: PASS — out/pkg_test/Storyboard.mp4 (12 s, -15 LUFS, TP -2 dBFS) + report.json
```

## The second film: `Multiplication` (one command, end to end)

Same orchestrator, different film — this is the check that P5 generalises rather than being a
quicksort-shaped script. Run on gen24 against the synced working copy:

```bash
node scripts/make.mjs --composition Multiplication \
  --narration /opt/aigen/outputs/mult_narration.wav \
  --score /opt/aigen/outputs/mult_score.wav \
  --raw /opt/aigen/outputs/mult_raw2.mp4 \
  --cut-frames 795,2413,4505,6257,8075,10848,13018,15052,16878 \
  --out out/pkg_mult --exports=true
```

18 stages, all exit 0. Numbers from `out/pkg_mult/report.json`:

| Gate | Measured | Verdict |
| --- | --- | --- |
| Duration | 587.87 s in composition, 587.900 s in container (Probe vs compositions table agree) | pass |
| Stem | full -25.08 dBFS, audible band -27.86, audible_share 0.631, sub_share 0.068 | pass |
| Mix | 589.07 s, duck 4.5 dB on 65.7% of the timeline, peak -2.00 dBFS, rms -19.12 | pass |
| Mix gate | speech -15.28 / gap_full -25.57 / gap_audible -28.29 dB; bed contributes 41.7 dB | pass |
| Loudness | I = -15 LUFS, TP = -2 dBTP (assertions: I ∈ [-16,-13], TP ≤ -1.5) | pass |
| Flicker | mean\|Δ\| 0.0147, p99 0.1428, max 8.74 with 9 cut frames masked (threshold 12) | pass |
| Still lint | 24 frames, no off-frame box, no edge text, no spill, no overlap | pass |
| Exports | 106 cues, 10 chapters, cover 92,711 B | pass |
| Caption budget | longest line 34 chars; 0 of 106 SRT cues needed wrapping | pass |

Delivered file: 27,717,606 B, sha256 `af276de189cbf923684f986f65ff950d8e4455c91e088ff8079762b92e3ced17`.

Audio was spot-checked after delivery with `volumedetect` at t=120/300/420/560 s
(mean -18.2 / -20.4 / -18.7 / -25.8 dBFS, peaks -2.1 / -3.4 / -3.1 / -7.6 dBFS): narration and bed
are both present for the whole film — the failure this was guarding against is a silent middle,
which loudness gates alone do not catch. The t=560 s sample lands on the quiet tail of the code
scene, which is why it is lower.

Two defects were found by auditing the finished film, not by a gate:

1. The induction proof on screen did not close. With `p = log₂3`, guessing `T(n) ≤ c·nᵖ` leaves
   `cn ≤ cn^p(1 − 3/2^p) = 0` — false for every n > 0. Fixed by guessing the stronger
   `T(n) ≤ c·nᵖ − 2dn`, which reproduces itself exactly (docs/known-issues.md K16).
2. The same 1024-digit native time appeared twice with different values (bar 5.40 µs from one
   measurement, growth table 4.86 µs from another). Both bars now read one field
   (`BENCH.native.rows[digits=1024].micros`); the ratio is computed from it, not typed.

A third defect was caught by `script_check.mjs` on the next pass: one rewritten narration line was
44 characters against the contract's 34-character caption budget. The line was re-synthesized
(one clip, `l032.wav`), the timeline re-derived from the new measured length (590.63 s → 587.87 s),
and the film re-rendered — the cheap check ran before the expensive one, which is the whole point
of having it.

## What this report does not prove

Narration quality (needs the TTS model), the Manim overlay (needs that asset), and 3D on a host
without working headless WebGL. Those are optional passes described in `docs/deployment.md`.

## Re-verification of the published tree

After the fixes above were committed, the exact tree that is published here was extracted into an
empty directory, `npm install` was run into a fresh `node_modules` (289 packages), and
`bash scripts/verify.sh` was executed again - this time with the *system* Python, not a prepared venv.
Result: `doctor: all checks passed`, then steps 1-6 all PASS with the same numbers as the
recorded run above (-15.2 LUFS, -1.6 dBTP, max abs delta 6.57).

One prerequisite this exposed: the flicker gate needs `numpy`, and a bare `python3` does not have it.
`scripts/bootstrap.sh` now installs `python3-numpy`, and `scripts/doctor.sh` checks for it, so the
missing piece is reported before a render rather than after it.