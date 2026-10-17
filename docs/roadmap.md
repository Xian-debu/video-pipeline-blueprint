# Roadmap

Ordered by value per unit of work, based on what actually slowed the reference production down.

## Near term

1. **One orchestrator** — `storyboard.json | script.ts -> stills -> (human review) -> render ->
   mix -> loudnorm -> QA`, with a manifest of artefacts and per-stage logs. The stages already exist
   as separate scripts; this is glue plus bookkeeping, not new capability.
2. **Automated still linting** — safe-area / overlap / text-overflow checks on rendered frames
   (bounding boxes are unavailable, but luma-region diffs plus text-extent heuristics catch the two
   defects that slipped through: subtitle-over-title, panels out of frame).
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

## Known non-goals

- A GUI editor. The point of the pipeline is that content is data and diffs are reviewable.
- Cloud rendering or a hosted service.
- Auto-generating a film from an arbitrary prompt; the value here is control, not automation.
