# Notes for AI agents working in this repository

This file is read by coding agents. It does not replace `docs/engineering-standards.md`; it tells you
what to do first and what not to do unattended.

## First five minutes

1. `git status` and `git log --oneline -5` — know what state you inherited. Never start work on a
   dirty tree you did not create without asking.
2. Read `docs/engineering-standards.md` (short) and the relevant part of `docs/architecture.md`.
3. Read `docs/known-issues.md` before "fixing" anything in the render or audio path — several
   oddities are documented workarounds (hard cuts, KaTeX display mode, the loudnorm key names).

## Hard rules

- **Never invent a design value in a component.** Colours, type sizes, spacing anchors, and motion
  budgets come from `data/design.spec.json` via `src/design/tokens.ts`. Editing the contract is a
  separate, explainable commit.
- **Keep determinism.** No `Math.random()`, `Date.now()`, timers, `requestAnimationFrame`, CSS
  animations/transitions, or network calls at render time. If a frame cannot be rendered in
  isolation, the change is wrong.
- **Content lives in `LINES`.** Captions, TTS script, SRT and chapters are derived; never type a
  string twice.
- **Do not commit** `out/`, `node_modules/`, rendered media, or logs. Do not `git add -A` blindly.
- **Do not install system packages, models, or large downloads without being asked.** Running
  `scripts/bootstrap.sh` on a fresh machine is expected; fetching a 13 GB TTS model is a decision the
  user makes.

## Definition of done, for an agent

You may not say "done" or "verified" without pasting the numbers: typecheck exit, design-check exit,
the still you looked at (and what you saw), render duration, loudness I/TP, flicker mean |d|/max.
If a gate was skipped, say which and why. A passing `npm run verify` is necessary and not sufficient —
two defects in v1.0.0 passed every metric and were caught on stills.

## Working with the user's other projects

This package is the deployment surface; production state also lives in `gen24-admin` (audit and
decisions) and in the WSL2 `gen24` distro (runtime, models, renders). Changes to this repo that
affect the runtime should be noted in `gen24-admin` rather than duplicated here.
