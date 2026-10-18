# Roadmap

Ordered by value per unit of work, based on what actually slowed the reference production down.

## Near term

1. ~~**One orchestrator**~~ — **Done** (`scripts/make.mjs`, `npm run make`). `contract -> score ->
   score gate -> picture-only render -> stills -> still lint -> mix -> mix gate -> mux -> loudnorm ->
   flicker -> delivery exports`, with a `report.json` manifest carrying every measured number and the
   exit code of every stage. A failed stage stops the pipeline and still writes the report. The score
   is produced *before* the picture, so a bed that fails the gate never reaches a render.
2. ~~**Automated still linting**~~ — **Done** (`scripts/qa/still_lint.mjs`). Rather than pixel
   heuristics (which cannot tell a title from a caption), the component under test prints the DOM
   boxes it laid out; the script renders a frame per target and fails on an off-frame box, text
   inside the 24 px safe-area margin, a text range spilling its own box, or two text boxes
   overlapping by more than 25 % of the smaller one. A fixture composition proves the rules still
   fire, and a frame with no measurement fails the gate (exit 2) instead of passing silently.
3. ~~**Incremental render, and a fingerprint for the tree**~~ — **Done** (`scripts/render_scenes.mjs`,
   `scripts/qa/tree_hash.mjs`). The expensive stage is resumable scene by scene: a segment is keyed
   on a hash of its own lines, its position, the film's components, the film's data and the shared
   design system, and reused unless one of those changed. Frame numbers for still review are derived
   from `SCENES` instead of being listed by hand, and a target outside the composition is an error
   (never a clamp). `make --expect-tree <hash>` fails in the first second when the gates are about to
   run on a stale copy, and `report.json` records `numbers.tree` and `numbers.segments`.
4. **Storyboard schema hardening** — version field, zod validation, and a migrator so old
   storyboards keep rendering.
5. ~~**3D scene layer**~~ — **Done** (`src/design/three/`, `ThreeStage`, `docs/3d.md`). Five
   primitives (canvas, studio lights + ground, dolly/orbit rigs, materials, glTF model) driven only by
   the frame number, plus a transparent canvas that composites over 2D text. Two new gates: a pure
   Node GLB parser (`model_lint.mjs`: triangle budget, extent, watertight) and a frame gate
   (`three_frame_lint.mjs`: coverage floor/ceiling, not-black, sha256 twice). The asset path is
   documented as the hard part: `@remotion/three` advances the canvas once per frame, so anything
   loading after mount is never drawn (K20).
6. **Score presets** — a few named arrangements (calm/lecture/tutorial) instead of manual BPM/energy.

## Medium term

7. **Component library extraction** — the scene components (title, cards, array/trace view, proof
   panel, bar chart) are reusable; package them with a prop contract and a visual catalogue.
8. **TTS adapters** — one interface, three backends: IndexTTS-2, Piper, edge-tts. The retiming stage
   already abstracts this away; only synthesis needs an adapter.
9. **Automatic retiming after content edits** — currently a narration change requires a re-run of
   synthesis and retiming; cache per-line wavs keyed by text+voice hash.
10. **GPU-free TTS by default** — recommend Piper in the quick start, IndexTTS-2 as the quality tier.

## Longer term / open questions

11. **Multi-language subtitles** from one narration track (Whisper alignment), still frame-driven.
12. **Deterministic Chrome**: pin the Chromium build hash alongside the Remotion version, since a
    browser upgrade can shift font rasterisation by a pixel.
13. **Acceptance as code**: encode the E1-E8 style checklist (resolution, loudness, no-overflow,
    determinism, still review) as machine-checkable rules where possible.

## Design contract debts

Recorded when `data/design.spec.json` landed; the full reasoning is in
[`docs/design-language.md`](design-language.md) §4. Each one is a separate, verifiable commit — none
of them is "fix the look".

| # | Debt | Paid by |
|---|---|---|
| D1 | Two frozen colour families (`lecture`, `storyboard`) with different values | a palette merge commit that re-verifies every still |
| ~~D2~~ | **Paid for the template, ratcheted for the film** — storyboard scenes read `SB.*` / `SB_T.*` from `type.families.storyboard` (11 stills byte-identical before/after); the lecture's own literals are grandfathered in `data/type-exceptions.json` and can only shrink | this commit |
| ~~D3~~ | **Paid for the template** — title subtitle 13.6 % -> 4.5 % (2 px at 44 px), with before/after stills; `OVERVIEW` is Latin-only and reported, not enforced. The lecture chapter bar (14.3 %) stays a ratcheted literal of the released film | this typography commit |
| ~~D4~~ | **Paid** — `ImageScene` reads `motion.ambient` via `ambientScale()`; a 3 s scene travels 1.0225, not 1.06 | this roadmap's contract commit |
| ~~D5~~ | **Paid** — caption scrim is the `surface.scrim` fill role (`usage: fill`, `alpha: 0.62`), read via `fillColor()` | this roadmap's contract commit |
| ~~D7~~ | **Paid** — scenes read colour roles through `PaletteScope` instead of the single `PALETTE` map; presets `midnight` / `paper` / `slate` are families checked by the same contrast rules, `Presets` renders the same title in each | this commit |
| ~~D6~~ | **Paid** — `design_check` still validates the contract only, but `still_lint.mjs` renders frames and fails on off-frame boxes, edge text, spill and overlap; it cannot see a literal colour, it sees the consequence | near-term item 2 |

## Known non-goals

- A GUI editor. The point of the pipeline is that content is data and diffs are reviewable.
- Cloud rendering or a hosted service.
- Auto-generating a film from an arbitrary prompt; the value here is control, not automation.