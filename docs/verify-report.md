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
