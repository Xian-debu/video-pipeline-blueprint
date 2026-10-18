# Contributing

This repo is a working production pipeline, so contributions are judged by the same bar as the
original film: reproducible, measured, and reviewed by eye where it matters.

## Before you start

Read, in this order:

1. `docs/engineering-standards.md` — the binding rules (source-of-truth hierarchy, invariants,
   design rules, definition of done, git discipline).
2. `docs/architecture.md` — how the three layers fit, and why a render is a pure function of
   committed inputs.
3. `docs/known-issues.md` — K1–K12, so you do not "fix" something that is a deliberate workaround.

## Local setup

```bash
bash scripts/bootstrap.sh   # apt libs, CJK fonts, node, headless Chromium
bash scripts/doctor.sh      # must print "all checks passed"
npm run verify              # typecheck -> design check -> still lint -> stills -> render -> loudness -> flicker
```

Stills under `out/verify/` are part of the check, not decoration: open them.

## What a change should look like

| You want to change | Edit | Do not |
| --- | --- | --- |
| a colour, size, spacing anchor, or motion timing | `data/design.spec.json` (+ derived `src/design/tokens.ts` if the shape changes) | hard-code a literal in a scene |
| a scene's composition | the scene component, using tokens and primitives | add a new colour or type size |
| narration or on-screen text | `src/lecture/script.ts` (`LINES`) | duplicate the string in a component |
| recorded data a scene shows | `data/` via `scripts/generate_data.py` | hand-edit the JSON |
| a third-party asset | `public/` **and** a row in `THIRD_PARTY_NOTICES.md` | drop a binary without provenance |
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

- [ ] `npx tsc --noEmit`, `python3 scripts/qa/design_check.py` and `npm run lint:still` pass.
- [ ] Changed stills were rendered and looked at; findings recorded in `docs/verify-report.md`.
- [ ] `npm run verify` passes end to end (loudness and flicker numbers included in the report).
- [ ] No new literal colour/size/timing outside the design contract.
- [ ] New binaries listed in `THIRD_PARTY_NOTICES.md` with licence, source, size, sha256.
- [ ] `git status` clean apart from the intended change.

## Reporting a defect

Give the frame number, the composition, and a still. Most real defects here are visible in a single
frame; a description alone ("the animation glitches") cannot be reproduced, and the automated gates
will pass it.
