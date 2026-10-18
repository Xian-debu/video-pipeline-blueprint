# Architecture

Three layers, joined only by files on disk. Nothing in the pipeline calls an LLM or a remote
service at render time, so a render is a pure function of committed inputs.

```
        data/<film>/*.json ─┐
   src/<film>/script.ts    ├─► React components ─► Remotion renderer ─► out/*.mp4
   public/**  (assets)    ─┘        (pure)              (Chromium)          │
                                                                          ▼
   narration.wav ─┐                                       ffmpeg loudnorm (EBU R128)
   score.wav      ├─► mix (ffmpeg amix) ─────────────────────────────────┘
                  ┘                                            │
                                                     qa/luma_blink.py (flicker gate)
```

## 1. Content layer

Two entry points share one renderer:

- **Generic**: `storyboard.json` validated by `src/schema.ts` (zod-free plain TS guards).
  A scene is a discriminated union — `title`, `graphic`, `image` — with duration, captions,
  and transition hints. `src/storyboard/Film.tsx` maps it to a `<Sequence>` list.
- **Per-film**: `src/<film>/script.ts` for each film (the quicksort lecture, the multiplication
  film). A film owns `src/<film>/` and `data/<film>/` and reads no other film's files — enforced by
  `scripts/qa/film_isolation.mjs`. Scenes are written as data
  (`SCENES` with `id`/`dur`/`title`), and every visible string lives in `LINES`, from which
  captions and the TTS script are derived. This keeps the narration, the subtitles and the scene
  budget in one place — the single most useful property of the whole project.

**Invariant: frame => content.** Every component reads `useCurrentFrame()` and computes its
state; nothing animates itself. Consequences: any frame is renderable in isolation
(`remotion still --frame=N`), stills are the review artefact, and the film is deterministic.

## 2. Render layer

- Compositions are registered in `src/Root.tsx`: `Storyboard`, `Showreel`, `Lecture`,
  `Transitions`, `Typesetting`, `ThreeCube`, `ManimOverlay`.
- Scenes are separated by **hard cuts**; each scene fades its own content in/out
  (`SceneShell` default 12 frames, `fadeFramesFor(deltaLuma, perFrame=10, min=10)`). Do not
  use cross-transitions between scenes with large luminance differences — see
  `docs/known-issues.md` K1 for why a 14-frame cross-fade produced a visible flicker that
  objective luma metrics did not detect.
- Motion primitives (`src/design/primitives.tsx`) exist so that repeated motion is consistent:
  `Build` (fade+rise), `CountRoll` (numeric tween), `ArcSwap` (arc swap between cells).
- Math is KaTeX rendered to HTML strings (`src/design/Math.tsx`). Display mode is emulated with
  `\displaystyle` inside an inline render, because `.katex-display` imposes its own centring
  and margins that fight the layout.
- 3D uses `@remotion/three` with an explicit canvas size and lights; no `useFrame` hooks, so the
  frame is still a function of the frame index. WebGL works headless through ANGLE.

## 3. Audio layer

Two independent tracks, mixed outside the renderer:

1. **Score** — `scripts/audio/engine.mjs` synthesises directly into an
   `OfflineAudioContext` from `node-web-audio-api`: seeded PRNG (mulberry32), detuned saw pads,
   bass, arpeggio, drums, convolution reverb, master compressor. Same seed => identical bytes.
   `render_music.mjs` is the CLI (`--key=value` form only).
2. **Narration** — `scripts/tts/synthesize.py` drives IndexTTS-2 over the same `LINES` array,
   writes one wav per line, then `retime_narration.py` measures each wav with `soundfile` and
   re-budgets scene durations so speech fits (`lead` 0.55 s, `tail` 0.35 s, gap clamped to
   [0.30, 1.20] s), writing the new durations back into the script.

Mixing and loudness are done with ffmpeg (`amix`, then two-pass `loudnorm`, then `-c:v copy`),
so the picture is never re-encoded. Target: I = -15 LUFS, TP = -2 dBTP for web delivery.

## 4. QA layer

- `scripts/qa/luma_blink.py` measures per-frame mean luma on the whole frame (or a background
  region) and flags jumps/dips above a threshold; it catches hard cuts in the wrong place, white
  flashes, and renderer glitches.
- Loudness is asserted, not eyeballed: `scripts/audio/loudnorm.sh` prints the measured values and
  `verify.sh` fails if they are outside the window.
- Stills are a build artefact: `out/verify/still_*.png`. Two real defects here (a subtitle over a
  title, proof panels out of frame) were found by looking at them, not by any metric.
- `scripts/qa/still_lint.mjs` turns the part of that look that a machine can name into a gate: the
  scene tree carries an inert `LintAudit` probe that, given `inputProps {lint:true, lintFrame:n}`,
  logs every laid-out text box (with its text range) and every non-text panel once the frame is
  ready; the script renders each target frame, applies four rules (`canvas`, `edge`, `spill`,
  `overlap`), and fails when a frame reports nothing at all. The probe costs one `div` when the props
  are absent, and `src/qa/LintFixtures.tsx` keeps the rules honest.

## 5. One orchestrator, not one monolith

Every stage has a different failure mode and a different debugging surface (Chromium, Node audio,
Python TTS, ffmpeg), so the stages stay separate scripts that can each be run alone
(`docs/deployment.md` §1-§3.5). `scripts/make.mjs` is glue, not a reimplementation: it spawns those
same scripts in dependency order, prints their output verbatim, keeps each exit code, and writes
`report.json`.

Three properties matter more than the convenience:

- **Order encodes an argument.** The score is rendered and gated *before* the picture, because a bed
  that cannot be heard must not be able to reach a render. The stills come *before* the mix, because
  a layout defect is cheapest to fix before 305 s of frames exist.
- **A failure is a file.** The run stops at the first failing stage and still writes the report, so
  what ran, what passed and which number failed survive the terminal scrollback.
- **The stages remain runnable alone.** `--skip-static` skips the contract checks, `--seconds`
  skips duration probing, `--cut-frames` acknowledges intentional hard cuts. Anything the
  orchestrator does can be reproduced by hand from the deployment doc — that is how it was debugged.

## 6. The expensive stage is resumable

Rendering is the only stage that costs minutes, so it is the only one built to be skipped
selectively. `scripts/render_scenes.mjs` renders a film scene by scene (`renderMedia`'s
`frameRange`) and keys each segment on a hash of exactly what that scene reads: its own lines, its
index and the scene count, the film's components, the film's data JSON, and the shared design
system. Segments are concatenated with `-c copy`, so a segment whose hash still matches costs a
file read and nothing else.

This is possible only because of the invariant in §2: a frame is a pure function of
`useCurrentFrame()`, so any frame can be rendered in isolation and two renders of the same inputs
are byte-identical. The cache inherits that determinism — a hash is a complete description of a
segment, not a hint. Scene timing is deliberately left out of the hash; a segment is reused only
when its frame count is unchanged, so a re-timed scene re-renders itself and its neighbours keep
their files.

The same reasoning applies to the score, which is keyed on its generation parameters rather than
content: `score.meta.json` records `seed`, `energy`, `bpm`, `prog` and the rendered length, and
`make` reuses the bed when those still describe the programme. Both caches are keyed by *declared
inputs*, which is why `report.json` also records `numbers.inputs` (per-directory content hashes) and
`numbers.tree` — a cached run has to be able to say which tree it measured and which inputs it
assumed.

