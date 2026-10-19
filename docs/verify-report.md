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
| subtitle | 2 / 44 | 4.5 % | ok (was 6 / 44 = 13.6 %; D3 paid, see below) |
| overline | 8 / 36 | 22.2 % | Latin-only label, reported not enforced |
| ordinal | 2 / 30 | 6.7 % | Latin digits, reported not enforced |
| caption | 1 / 52 | 1.9 % | ok |

### D3 paid: the subtitle's tracking

The one CJK role over the limit was the title subtitle. Tracking on Chinese is not neutral: it opens
gaps between glyphs that a reader parses as word breaks, and at 44 px a 6 px step is visible. The
contract's own rule (CJK roles <= 5 %) said so; the deviation existed only because the value was
frozen before anyone looked at it. It is now 2 px (4.5 %), the deviation entry is gone, and
`design_check.py` still fails when a *new* CJK role crosses 5 % or keeps a stale deviation — so the
rule is enforced both ways.

| Frame | Before (6 px) | After (2 px) |
| --- | --- | --- |
| Storyboard f60 | ![before](images/still_typo_before.png) | ![after](images/still_typo_after.png) |

| Check | Result |
| --- | --- |
| `python3 scripts/qa/design_check.py` | PASS — 4 colour families, 3 presets, 7 roles, 3 nested families, 30 contrast targets |
| `node scripts/qa/still_lint.mjs` | PASS — 31 frames (the tighter subtitle cannot collide) |
| Storyboard f60 sha256 | `01ecdc89…` -> `af00254…` (the subtitle line changes, nothing else) |
| `bash scripts/verify.sh` | exit 0 — flicker `mean|d|=0.0459`, `max=6.56` (was 0.0461 / 6.57: the subtitle occupies fewer pixels) |

The lecture's chapter bar (3 px at 21 px = 14.3 %) is a different case and stays a ratcheted literal:
it is the accepted 305 s film's chrome, the film is released, and changing it would edit a master for
a typographic point nobody raised. It is recorded in `data/type-exceptions.json`, printed on every
`design_check` run, and cannot grow.

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


## One film, one directory (enforced, not assumed)

Two films used to share one `data/` root. That is where content quietly mixes: a film-specific JSON
at the root is ambiguous, and a film that reads another film's file changes its numbers without any
line of its own code moving. The layout is now a rule, and the rule is a gate:

| Location | Owns |
| --- | --- |
| `data/design.spec.json`, `data/type-exceptions.json` | the shared contract (style, not content) |
| `data/<film>/` | that film's facts: traces, counters, source lines, voice timings |
| `src/<film>/` | that film's scenes and its `script.ts` (`SCENES` + `LINES`) |

`scripts/qa/film_isolation.mjs` fails on an unpaired `data/<film>` (no matching `src/<film>`, or the
reverse), a film-specific JSON sitting at `data/` root, an import that crosses films, and a film
without a `script.ts` that exports `SCENES` and `FPS`. It runs in `verify.sh` step 1.1 and as the
`film isolation` stage of `make`, before anything renders.

What changed for the lecture film: `data/{trace,stats,code_lomuto,voice}.json` →
`data/lecture/`; imports, `generate_data.py`, `synthesize.py` and `retime_narration.py` follow.
Nothing in the picture or the audio changed.

Verified on this tree (gen24, Node v22.21.1):

| Check | Result |
| --- | --- |
| `node scripts/qa/film_isolation.mjs` | PASS — 2 films isolated (lecture, mult) |
| same script against a deliberately broken tree | FAIL — 4 issues, exit 1 (unpaired ×2, foreign import, film JSON at root) |
| `npx tsc --noEmit` | 0 errors (the moved JSON imports type-check) |
| `scripts/qa/design_check.py` | PASS — 4 colour families, 3 presets, 30 contrast targets |
| `scripts/qa/type_ratchet.py` | PASS — 52 grandfathered literals, list unchanged |
| `node scripts/qa/still_lint.mjs` | PASS — 24 frames (the lecture frames read the moved data) |
| `bash scripts/verify.sh` | exit 0 — `-15.2 LUFS`, `-1.6 dBTP`, flicker `mean|d|=0.0461`, `max=6.57` |

Two related hardenings landed in the same commit:

1. **No silent narration.** `make --narration <missing>` now exits 2 in the first second. Before, the
   file's absence was logged and the film was delivered with the score alone — a silent film that
   reported PASS. The default path is still allowed to be absent (a fresh clone runs `verify.sh`
   without narration), but an explicit request is a promise, not a hint.
2. **Input fingerprints in `report.json`.** `numbers.inputs` records a content hash of `src/`,
   `data/` and `scripts/`, so a delivery can be tied to the exact inputs that produced it — a stale
   working copy is otherwise indistinguishable from a clean run.
3. **Still-lint frames are never clamped.** A target frame past the composition's end means the
   target list is stale; it now fails (`exit 2`) instead of silently linting the last frame.

## Incremental render, and a fingerprint for the tree (P9)

The expensive stage is now resumable scene by scene (`scripts/render_scenes.mjs`): each scene is
rendered to its own file with `renderMedia({frameRange})` and keyed on a hash of the inputs that
scene actually reads — its lines, its position and the scene count, the film's components, the
film's data JSON, the shared design system. Segments are concatenated with `-c copy`. Measured on
this tree (gen24, Node v22.21.1, `tree 3d6e50078500b4a1`):

| Run | Segments | Wall clock |
| --- | --- | --- |
| first full render, cold cache | `reused=0 rendered=10 scenes=10 frames=17636` | 176 s of rendering (8.2/16.2/20.8/17.1/17.7/28.9/20.7/18.7/7.8 s per scene) |
| nothing changed | `reused=10 rendered=0` | seconds: hashing and concatenating |
| one subtitle line edited | `reused=9 rendered=1` — whole `make`, every gate | **126 s** |

The one-line edit changed the delivery by exactly its own scene: `Multiplication.mp4` went from
27,601,805 B (`823d9fd0…`) to 27,596,347 B (`a4140127…`), with loudness (-15 LUFS / -2 dBTP) and
flicker (`mean|d|=0.0147`, `max=8.75`, 9 declared hard cuts) unchanged.

Two caches, both keyed by *declared* inputs: the score is reused when `score.meta.json` still
matches its generation parameters (`seed`, `energy`, `bpm`, `prog`, length), and the picture is
reused when a segment's hash and frame count still match. `report.json` records both
(`numbers.scoreReused`, `numbers.segments`) plus `numbers.tree`.

**A stale copy fails in the first second.** `scripts/qa/tree_hash.mjs` prints one hash over `src/`,
`data/`, `scripts/` and the render config; `make --expect-tree` refuses to start when the working
copy disagrees:

```
$ node scripts/make.mjs ... --expect-tree=0000000000000000
make: FAIL — this tree is 3d6e50078500b4a1 but the caller expected 0000000000000000
             (stale copy? re-sync src/ data/ scripts/ before rendering)
exit 2  (no gate ran)
```

Still review frames are derived rather than listed: `still_lint.mjs` reads each film's `script.ts`
and takes the midpoint of every scene (accumulating `dur`, since the lecture's `SCENES` carry no
`start`), so 36 frames are linted — Storyboard 2, Showreel 2, Transitions 2, Typesetting 2, ThreeCube 1,
ThreeStage 3, PropStage 2, Presets 3, Lecture 9, Multiplication 10 — and a frame past the composition's
end is an error, never a clamp. (PlateStage is linted only when its plates exist, since `public/plates/`
is not in the repo.)

Two gate rules were fixed while doing this, both found by the new frames (`docs/known-issues.md`
K19): an out-of-range target used to be clamped to the last frame, and the overlap test used text
line boxes, so 108 px half-leading produced a phantom overlap that the picture does not have. The
overlap test now intersects the layout box with the text range; real overflow is still the `spills`
rule's job. `still_lint.mjs --fixtures` still reports 3 issues across 3 rules, so the gate is known
to fire.
## The 3D layer (`ThreeStage`, 900 frames)

The 3D composition was added after the recorded run above and verified with the same discipline:
frames rendered, looked at, then gated. Its gates:

```
npx tsc --noEmit                                                                    PASS
node scripts/qa/model_lint.mjs "public/models/*.glb" --watertight --allow=no-normals  PASS
  nailong_v3_15k.glb  262,396 B · 1 prim / 14,532 tris · extent 112.393×134.073×99.95
  ~ allowed: 1/1 primitives have no NORMAL — allowed: runtime computeVertexNormals()
node scripts/qa/three_frame_lint.mjs --composition=ThreeStage --frames=150,450,750 --repeat
  PASS frame 150  coverage 14.59%  bg 18  mean 37.18  sha256 b8d4e3d3d6cb2a68
  PASS frame 450  coverage 17.83%  bg 22  mean 38.00  sha256 11668ce1a95690af
  PASS frame 750  coverage  4.37%  bg 25  mean 27.01  sha256 21cfd6594f98c6b9
node scripts/qa/still_lint.mjs                                                     PASS (36 frames)
```

**What was seen, and what changed because of it.** The first frames of shots B and C contained no
model at all — the ground plane, light and shadow were correct, so the shots read as an empty
studio. Coverage passed (12.20 %) and determinism passed, because the empty frame is deterministic.
The cause was `@remotion/three` advancing the canvas once per frame with a `never` frameloop: a
model that arrives after mount is never drawn (K20). Fix: load outside the canvas, hold the frame
with `delayRender`, mount the canvas only when the scene graph exists.

With the model visible, three framing iterations followed, each judged on stills — none of them on a
gate:

1. `Orbit` radius 4.6 put the camera inside the silhouette: the model filled the frame and was cut
   on every edge.
2. Radius 7.2 fixed shot B, but the composite shot still pushed the model through the title block;
   the canvas was restricted to the right 60 % of the frame and its orbit radius grew to 7.6.
3. The procedural shot's dolly ended too close: the bottom row of cubes ran under the caption. The
   rig now ends at `[9.6, 6.6, 10.4]` with the look-at at `y = 0.4`, and frame 290 keeps the whole
   array above the caption band.

**Asset.** The imported `.glb` is a carved voxel mesh with no normals. Ten Taubin iterations
(`scripts/assets/smooth_glb.mjs`, λ = 0.5 / μ = -0.53) removed the staircase, kept the mesh
watertight, and left the bounding box unchanged. Deeper smoothing (80, 300 iterations) moved the
surface by less than 1 % of its extent and did **not** remove the residual banding — that is the
shading of a low-poly surface, so shot B draws a wireframe overlay instead of pretending the surface
is polished. This is recorded as an asset limitation, not a render setting.

## The plate branch (`PlateStage`, 90 frames)

A plate is a frame rendered offline by Blender and then used as an image layer. The point is not
"Blender can render": it is that the expensive picture becomes a **checksummed artifact** that the
Remotion side can replay without a GPU. So the branch ships with a contract and a gate, and no
plate is committed.

**Contract** (`docs/blender-plates.md`): `public/plates/<set>/plate_%04d.png` plus one
`report.json` carrying engine, device, samples, resolution, alpha, ground, the model's sha256, per
frame timings and per frame sha256. `public/plates/` is gitignored — the deliverable is the report,
the readable artifact is regenerable.

**What was rendered here** — Blender 5.2.2 LTS at `/opt/aigen/video2/env/blender`, Cycles on CUDA
(RTX 5070 Laptop), 64 spp, denoise, shadow catcher, alpha, 1920×1080, frames 0–89:

```
npm run plates -- --glb public/models/nailong_v3_15k.glb --samples 64 --alpha
  --radius 4.8 4.8  --height-cam 2.2 2.9  --azimuth 30 -30  --target-z 0.9
  --color '#b9b3a8'  --material matte  --ground shadow
  → 90 plate(s) in 736.0s (mean 8.177 s/frame, median 8.143)
```

Gates, in order:

```
node scripts/qa/plate_lint.mjs
  PASS public/plates/showcase  90 plate(s) · 1920×1080 · CYCLES 64 spp ·
       mean 8.18 s/frame · alpha · 74,860,576 B · model sha256 6300bc2a4bf6
npx remotion render PlateStage  →  90 frames · 1920×1080 · 30 fps · 387,962 B
python3 scripts/qa/luma_blink.py
  frames=90 mean=34.85 min=28.82 max=36.23
  mean|d|=0.0895 p99=0.5497 max=0.56 jump_thresh=12.0  → PASS
node scripts/qa/still_lint.mjs  →  PASS (36 frames)
```

**Three engine facts, each of which cost a cycle to find** (K21):

1. `blender -b` has no display, and EEVEE does not fail there — it silently falls back to Mesa's
   software rasteriser (`llvmpipe`), 8.82 s for a 64×64 / 4 spp probe. Cycles on CUDA did the same
   probe in 0.43 s. A successful EEVEE render is not evidence that a GPU rendered it.
2. The engine enum lies. With `--factory-startup` the Cycles add-on is enabled, yet
   `RenderSettings.bl_rna.properties["engine"].enum_items` lists only `BLENDER_EEVEE`. The renderer
   therefore *tries* `scene.render.engine = "CYCLES"` and catches `TypeError` instead of consulting
   the enum.
3. OptiX fails on this driver (`error code 7804`), so `set_cycles_device()` walks
   OPTIX → CUDA → HIP → ONEAPI → METAL and reports what it actually got (`device CUDA`,
   `scene_device GPU`) into the report. The report is the evidence; the command line is not.

**Framing was decided on stills, not on gates.** Radius 7.2 left the model at ~23 % of frame height
inside the stage's right column; radius 4.3 cut it at the edges; 4.8 is the shipped value. The first
material (`#e8e4dc` under a 1400 W key) clipped the top of the model to pure white — the silhouette
survived and the form did not — so the shipped set is `#b9b3a8` with key 1100 / fill 380 / rim 720.
Those numbers are arguments (`--color`, `--key-power`, …), which is the rule: a plate set is a
command, not a .blend file in the repo.

**A red gate found on the way in.** `type_ratchet.py` failed on `ThreeStage.tsx` and
`PlateStage.tsx`: both had been written with pixel literals (16/17/18/20/22, tracking 1/2/3), which
the contract forbids for new work. Rather than grandfather them into
`data/type-exceptions.json` (a list that may only shrink), the HUD got a fourth contract family,
`type.families.showcase` (`SC.*` / `SC_T.*`), frozen from the accepted stills. The ratchet now
reports *52 literals across 9 files, unchanged*, and the refactor is provably non-visual: frame 30
hashed `9beb01e7…` before and after.

## Generated assets (`PropStage`, 150 frames)

A third way to get geometry: write the shape as a distance field, not as a mesh. Props are CSG
expressions — a gear is a disc minus four lightening holes minus an axle bore, plus twelve teeth —
and a surface-nets extractor turns the field into triangles. The normal is the analytic gradient of
the field, so there are no carving steps to smooth away; watertightness is a property of the
construction, not a claim made afterwards.

```
npm run props          # gear, chip, nut -> public/models/prop_*.glb
  prop gear  112^3  bbox 1.92x0.38x1.92  tris 61,088  V 0.5847  mc 0.5871  dV 0.42%
               cell 0.0179  proj 18504 (max 0.0098)  boundary 0  nonManifold 0  flipped 0  2490 ms
  prop chip  112^3  bbox 2.5x0.28x2.3    tris 39,908  V 0.9109  mc 0.9298  dV 2.04%  …
  prop nut   112^3  bbox 1.6x0.44x1.6    tris 50,128  V 0.8151  mc 0.8284  dV 1.61%  …
npm run lint:props
  PASS prop_chip.glb   958,724 B · 1 prim / 39,908 tris · watertight · sha256 e3a84dbcf5afc3a1
  PASS prop_gear.glb 1,466,808 B · 1 prim / 61,088 tris · watertight · sha256 57ec4bd056425241
  PASS prop_nut.glb  1,203,956 B · 1 prim / 50,128 tris · watertight · sha256 e80ea5d20788f4ca
  model_lint: PASS — 4 asset(s), triangles ≤ 400000, watertight required
npx remotion render PropStage  →  150 frames · 1920×1080 · 30 fps · 764,905 B
node scripts/qa/still_lint.mjs →  PASS (36 frames)
```

Volume is checked two ways that share no code: the divergence theorem over the extracted triangles,
and a Monte-Carlo integration of the same distance field (200,000 samples). They agree to 0.42 %,
2.04 % and 1.61 %; a mesh that looks closed but is not would diverge on both, not just one.

**What was seen, and what changed because of it.** The first PropStage frames contained the ground
plane, the lights and the shadows — and no props at all: the three `useGltf` calls had been placed
*inside* the canvas subtree, the same trap as K20 in a different disguise. That is now a rule carved
into the composition: every `useGltf` runs in the body of the shot, outside `Canvas3D`.

With the props visible, the surfaces were covered in moiré bands. Two causes, found by turning
shadows off (the bands flattened, so half of it was shadow acne at 1024 map resolution — the shipped
setting is 2048 with `bias -0.0002` / `normalBias 0.02`), and the remaining bands are the honest
resolution limit of surface nets on hard-edged props: it has no edge representation, so a gear tooth
gets rounded at cell scale (0.018 units). Newton projection plus six Taubin rounds improved the
silhouette; they did not remove it. This is recorded as a limitation in `docs/sdf-assets.md`, not
hidden behind a blur.

**Three extractor bugs, all found by counting instead of looking** (K22). Marching tetrahedra on a
fixed cube decomposition left 161,172 boundary edges, because neighbouring cells triangulated their
shared face along different diagonals; a bounding box found by scanning for interior samples missed
the chip's 0.03-thick pins, so the extractor clipped the surface and produced 872 open edges; and a
Newton step normalised by `|grad f|` rather than `1` threw vertices 46 units away on a field whose
gradient is only a bound. Surface nets fixed the first, explicit per-prop bounds the second, and a
clamped step with a `|grad f|` floor the third. The generator now counts boundary and non-manifold
edges itself and refuses to write a file that fails.

**A regression this work caught in an older gate.** `still_lint` gained the PropStage frames
(34 → 36) and, in doing so, revealed that the type ratchet was already red on the previous commit
— see the plate section above.

## What this report does not prove

Narration quality (needs the TTS model), the Manim overlay (needs that asset), and whether the 3D
frames are *tasteful*: the 3D gates prove a frame was drawn (coverage, not black, deterministic),
never that the intended object was drawn — an empty studio passed all three (K20). 3D on a host
without working headless WebGL remains an optional environment note in `docs/deployment.md`.

## Re-verification of the published tree

After the fixes above were committed, the exact tree that is published here was extracted into an
empty directory, `npm install` was run into a fresh `node_modules` (289 packages), and
`bash scripts/verify.sh` was executed again - this time with the *system* Python, not a prepared venv.
Result: `doctor: all checks passed`, then steps 1-6 all PASS with the same numbers as the
recorded run above (-15.2 LUFS, -1.6 dBTP, max abs delta 6.57).

One prerequisite this exposed: the flicker gate needs `numpy`, and a bare `python3` does not have it.
`scripts/bootstrap.sh` now installs `python3-numpy`, and `scripts/doctor.sh` checks for it, so the
missing piece is reported before a render rather than after it.