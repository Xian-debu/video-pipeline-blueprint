# Contributing

This repo is a working production pipeline, so contributions are judged by the same bar as the
original film: reproducible, measured, and reviewed by eye where it matters.

## Before you start

Read, in this order:

1. `docs/engineering-standards.md` — the binding rules (source-of-truth hierarchy, invariants,
   design rules, definition of done, git discipline).
2. `docs/architecture.md` — how the three layers fit, and why a render is a pure function of
   committed inputs.
3. `docs/known-issues.md` — K1–K15, so you do not "fix" something that is a deliberate workaround.

## Local setup

```bash
bash scripts/bootstrap.sh   # apt libs, CJK fonts, node, headless Chromium
bash scripts/doctor.sh      # must print "all checks passed"
npm run verify              # typecheck -> design check -> type ratchet -> still lint -> stills ->
                            # score + music gate -> render -> loudness -> flicker
```

Stills under `out/verify/` are part of the check, not decoration: open them.

To produce a delivery (rather than to check the repo), run the orchestrator instead of the stages by
hand — same scripts, same order, plus the gates people skip:

```bash
npm run make -- --composition Lecture --narration public/voice/narration.wav
# -> out/Lecture/Lecture.mp4, out/Lecture/report.json (every stage's exit code and every number)
```

## What a change should look like

| You want to change | Edit | Do not |
| --- | --- | --- |
| a colour, size, spacing anchor, or motion timing | `data/design.spec.json` (+ derived `src/design/tokens.ts` if the shape changes) | hard-code a literal in a scene |
| a new palette look (preset) | `palette.families` + a `palette.presets` row in the contract | hard-code hex in a scene or fork a component per look |
| the storyboard template's type | `type.families.storyboard` in the contract (sizes **and** tracking) | edit the numbers in `TitleScene`/`GraphicScene` |
| the showcase HUD's type (chips, counters, provenance rows) | `type.families.showcase` (`SC.*` / `SC_T.*`) | write a `fontSize` literal into a showcase composition |
| a scene's composition | the scene component, using tokens and primitives | add a new colour or type size |
| narration or on-screen text | `src/lecture/script.ts` (`LINES`) | duplicate the string in a component |
| recorded data a scene shows | `data/<film>/` via that film's generator script | hand-edit the JSON |
| a new film | `src/<film>/` + `data/<film>/` + a composition in `src/Root.tsx` | put its data at `data/` root or import from another film |
| the score (levels, bands, arrangement) | `scripts/audio/engine.mjs` — then re-run `npm run gate:music` | raise the level to make it audible: put the energy in 250-4k |
| a third-party asset | `public/` **and** a row in `THIRD_PARTY_NOTICES.md` | drop a binary without provenance |
| the pipeline's stage order or a gate | `scripts/make.mjs` + `scripts/verify.sh` | add a stage that only runs when someone remembers it |
| a new dependency | say why in the commit body | add one for something 30 lines of code can do |

## Commit format

```
<area>: <what changed, imperative>

Why this change, and the evidence numbers when output changes
(e.g. "loudness -15.1 LUFS / -1.8 dBFS; flicker max |d| 9.68").
```

Areas: `design`, `scene`, `content`, `audio`, `qa`, `docs`, `scripts`, `assets`, `chore`.
One stage, one commit — no mixed refactor + behaviour changes, no "and also" commits.

## Pull / review checklist

- [ ] `npx tsc --noEmit`, `python3 scripts/qa/design_check.py`, `npm run lint:type` and
      `npm run lint:still` pass.
- [ ] Changed stills were rendered and looked at; findings recorded in `docs/verify-report.md`.
- [ ] `npm run verify` passes end to end (loudness and flicker numbers included in the report).
- [ ] If a film was delivered: it came from `npm run make`, and `report.json` is quoted in
      `docs/verify-report.md`.
- [ ] If the score or the mix changed: `python3 scripts/qa/music_gate.py --self-test` passes and the
      stem's audible-band share is reported; a delivery mix was gated with `--mix ... --narration ...`.
- [ ] No new literal colour/size/timing outside the design contract. If a pre-existing literal went
      away, `data/type-exceptions.json` was regenerated with `npm run lint:type -- --write` in the
      same commit.
- [ ] New binaries listed in `THIRD_PARTY_NOTICES.md` with licence, source, size, sha256.
- [ ] `git status` clean apart from the intended change.

## Reporting a defect

Give the frame number, the composition, and a still. Most real defects here are visible in a single
frame; a description alone ("the animation glitches") cannot be reproduced, and the automated gates
will pass it.
