# Roadmap

Ordered by value per unit of work, based on what actually slowed the reference production down.

## Near term

1. **One orchestrator** — `storyboard.json | script.ts -> stills -> (human review) -> render ->
   mix -> loudnorm -> QA`, with a manifest of artefacts and per-stage logs. The stages already exist
   as separate scripts; this is glue plus bookkeeping, not new capability.
2. ~~**Automated still linting**~~ — **Done** (`scripts/qa/still_lint.mjs`). Rather than pixel
   heuristics (which cannot tell a title from a caption), the component under test prints the DOM
   boxes it laid out; the script renders a frame per target and fails on an off-frame box, text
   inside the 24 px safe-area margin, a text range spilling its own box, or two text boxes
   overlapping by more than 25 % of the smaller one. A fixture composition proves the rules still
   fire, and a frame with no measurement fails the gate (exit 2) instead of passing silently.
3. **Storyboard schema hardening** — version field, zod validation, and a migrator so old
   storyboards keep rendering.
4. **Score presets** — a few named arrangements (calm/lecture/tutorial) instead of manual BPM/energy.

## Medium term

5. **Component library extraction** — the scene components (title, cards, array/trace view, proof
   panel, bar chart) are reusable; package them with a prop contract and a visual catalogue.
6. **TTS adapters** — one interface, three backends: IndexTTS-2, Piper, edge-tts. The retiming stage
   already abstracts this away; only synthesis needs an adapter.
7. **Automatic retiming after content edits** — currently a narration change requires a re-run of
   synthesis and retiming; cache per-line wavs keyed by text+voice hash.
8. **GPU-free TTS by default** — recommend Piper in the quick start, IndexTTS-2 as the quality tier.

## Longer term / open questions

9. **Multi-language subtitles** from one narration track (Whisper alignment), still frame-driven.
10. **Partial re-renders**: render only the scenes whose inputs changed, then concat. Remotion has no
    built-in incremental render; the scene-per-file structure makes it feasible.
11. **Deterministic Chrome**: pin the Chromium build hash alongside the Remotion version, since a
    browser upgrade can shift font rasterisation by a pixel.
12. **Acceptance as code**: encode the E1-E8 style checklist (resolution, loudness, no-overflow,
    determinism, still review) as machine-checkable rules where possible.

## Design contract debts

Recorded when `data/design.spec.json` landed; the full reasoning is in
[`docs/design-language.md`](design-language.md) §4. Each one is a separate, verifiable commit — none
of them is "fix the look".

| # | Debt | Paid by |
|---|---|---|
| D1 | Two frozen colour families (`lecture`, `storyboard`) with different values | a palette merge commit that re-verifies every still |
| ~~D2~~ | **Paid for the template, ratcheted for the film** — storyboard scenes read `SB.*` / `SB_T.*` from `type.families.storyboard` (11 stills byte-identical before/after); the lecture's own literals are grandfathered in `data/type-exceptions.json` and can only shrink | this commit |
| D3 | **Measured, not paid** — `OVERVIEW` 22.2 %, title subtitle 13.6 %, lecture chapter bar 14 %; the ratios are now printed by `design_check.py` and the subtitle is a declared deviation, so a new CJK violation fails the gate | a typography commit with before/after stills |
| ~~D4~~ | **Paid** — `ImageScene` reads `motion.ambient` via `ambientScale()`; a 3 s scene travels 1.0225, not 1.06 | this roadmap's contract commit |
| ~~D5~~ | **Paid** — caption scrim is the `surface.scrim` fill role (`usage: fill`, `alpha: 0.62`), read via `fillColor()` | this roadmap's contract commit |
| ~~D7~~ | **Paid** — scenes read colour roles through `PaletteScope` instead of the single `PALETTE` map; presets `midnight` / `paper` / `slate` are families checked by the same contrast rules, `Presets` renders the same title in each | this commit |
| ~~D6~~ | **Paid** — `design_check` still validates the contract only, but `still_lint.mjs` renders frames and fails on off-frame boxes, edge text, spill and overlap; it cannot see a literal colour, it sees the consequence | near-term item 2 |

## Known non-goals

- A GUI editor. The point of the pipeline is that content is data and diffs are reviewable.
- Cloud rendering or a hosted service.
- Auto-generating a film from an arbitrary prompt; the value here is control, not automation.