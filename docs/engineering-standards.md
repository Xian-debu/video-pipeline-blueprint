# Engineering standards

This repository is a **production**, not a demo folder. A finished film ships with evidence:
committed inputs, a reproducible render, measured audio, a measured flicker gate, and still frames
a human actually looked at. Two defects in v1.0.0 (a subtitle overlapping a title, four proof panels
leaving the frame) passed every automated metric and were caught only by eyes on a still — the rules
below exist because "it rendered" is not "it is correct".

Everything here is enforceable. If a rule cannot be checked, it is written as a review item instead
of a rule, and says so.

## 1. Source-of-truth hierarchy

One fact, one home. When two files can disagree, the one higher in this list wins:

| Rank | Artifact | Owns |
| --- | --- | --- |
| 1 | `data/design.spec.json` | the design contract: palette roles, type scale, spacing anchors, motion duties, text rules |
| 2 | `src/design/tokens.ts` | derived TypeScript view of (1); the only place components import design values from |
| 3 | `src/<film>/script.ts` | that film's content: scene budget (`SCENES`) and every visible string (`LINES`) |
| 4 | `data/<film>/*.json` | recorded facts that film visualises (traces, counters, source lines) |
| 5 | components under `src/` | composition only — no literal colours, sizes, or timings |

Corollary: **changing a design value is a change to `data/design.spec.json` plus the derived
tokens, in one commit**, never a tweak buried inside a scene component.

**One film, one directory pair.** A film owns `src/<film>/` and `data/<film>/`; it may read its
own data plus the two shared files (`data/design.spec.json`, `data/type-exceptions.json`) and the
engine (`src/design/`, `src/storyboard/`). It may not read another film's data or source. The rule
is mechanically checked by `scripts/qa/film_isolation.mjs`, wired into `verify.sh` and `make`:
an unpaired directory, a film-specific JSON sitting at `data/` root, a cross-film import, or a film
without its own `script.ts` fails the build. Adding a film is therefore: `src/<name>/` +
`data/<name>/` + a composition in `Root.tsx` — never an edit to a neighbouring film's inputs.

## 2. Invariants (breaking one is a bug, not a style choice)

1. **frame => content.** Every visual state is a pure function of `useCurrentFrame()`, props, and
   committed data. No `Math.random()`, no `Date.now()`, no timers, no `requestAnimationFrame`.
2. **No CSS animation or transition.** CSS keyframes run on the wall clock, not the frame clock;
   they desynchronise during render and make a still meaningless. Motion is arithmetic.
3. **No network at render time.** No LLM, no remote API, no web fonts fetched at runtime.
4. **Hard cuts between scenes.** Each scene fades its own content; never cross-fade two scenes with
   a large luminance delta (see `docs/known-issues.md` K1 and K7).
5. **Text is derived, never typed twice.** Captions, the TTS script, SRT and chapters all come from
   `LINES`. If a string appears in two places, one of them is wrong already.
6. **Only committed inputs affect the output.** A render on a clean checkout must reproduce the
   published film; anything else is not a render, it is an improvisation.

## 3. Repository layout rules

- A film's scenes live either in one `src/<film>/<Film>.tsx` (lecture, multiplication, gears) or in
  `src/<film>/scenes/<scene>.tsx` when the film is large enough that one file stops being readable
  (`src/hawk/`: 12 scenes plus `shared.tsx`). A generic film is a storyboard template in
  `src/storyboard/`. Do not add a new top-level directory without documenting it in
  `docs/architecture.md` and updating the tree in `README.md` §4.
- **A new film is registered in `scripts/film_registry.mjs` and nowhere else.** That list is what
  `make`, `verify.sh` and the still-lint gate read; adding a film directory without registering it
  turns its gates off silently (K27), and `qa/film_coverage.mjs` now fails the run instead.
- Reusable visual behaviour goes in `src/design/primitives.tsx`; a scene-local effect that is used
  once stays in the scene.
- QA and tooling live in `scripts/<area>/`. Every script is idempotent, prints what it asserts, and
  exits non-zero on failure.
- Generated media goes to `out/` (git-ignored). Only small, provenance-recorded assets are
  committed under `public/`.

## 4. Design rules

The contract is data, so these are checks, not opinions:

- **Colour:** components import semantic roles from `tokens.ts`, never a raw hex literal. Every text
  role declares the background it is validated against and a minimum contrast ratio; `design_check`
  fails the build below it. A tertiary role may sit at 3.0:1 **only** when the contract also pins a
  minimum font size — small and faint is the failure mode, not faint alone.
- **Type:** a short, ordered scale (display > h1 > h2 > body > caption, plus mono and math). New
  sizes are a contract change, not a one-off. Body copy must stay legible at the intended viewing
  distance, which is why the scale is fixed rather than fitted per scene. A surface that needs its
  own ladder gets a *family* (`type.families.storyboard`, `type.families.film`,
  `type.families.showcase`) rather than a private set of numbers, and
  its tracking is declared next to the sizes: CJK tracking above 5 % of the size is a recorded
  deviation, not a tool for emphasis. Literals that predate the rule are listed in
  `data/type-exceptions.json`; `type_ratchet.py` fails when that list grows.
- **Spacing:** layouts snap to the declared anchors (page margin, safe area, gutter, grid) so two
  neighbouring scenes share rhythm. Content stays inside the safe area unless the overflow is the
  point and is reviewed as such on a still.
- **Motion:** every animation declares a duty — `static`, `enter`, `emphasize`, `move`, or `exit` —
  and takes its duration from the contract's budget for that duty. One dominant rhythm per scene.
  Chrome (background grid, frame furniture) does not animate. Ambient drift, when used, is slow
  enough to read as "alive" rather than "moving".
- **Emphasis:** never colour alone. Weight, position, or a bracket does the work; colour supports it.
- **Colour is a role, never a hex.** A scene names `text.primary`, `accent.primary`,
  `surface.scrim` and reads it through `useRole()` / `useFill()`; a family answers those names. A
  new *look* is therefore a new preset family in `palette.families` plus a row in
  `palette.presets` — never a hex edit in a component, and never a second render path. Every
  preset passes the same contrast rules, and the default preset is pinned to the family the
  released film was reviewed in: promoting another look to default is a re-release.

## 5. Content rules

- One caption line is at most 34 CJK characters, read at 4.2–4.8 characters per second. A line that
  needs longer is two lines or a shorter sentence — the timing is a hard budget, not a target.
- Scene durations are declared in `SCENES` and must sum to the intended runtime; the total is
  printed by `dump_script.mjs` and recorded in the delivery `report.json`. Trimming content is
  preferred over speeding narration up.
- Every claim visualised on screen must trace to `data/` (recorded) or to a cited source. A drawing
  that illustrates nothing measurable is decoration.

## 6. Asset provenance

- Anything binary added under `public/` gets a row in `THIRD_PARTY_NOTICES.md`: what it is, licence,
  source URL, size, sha256. No row, no merge.
- Dependencies are pinned by the committed `package-lock.json` and installed with `npm ci`. Never
  resolve a floating tree into a release; if a version must change, the lockfile change is its own
  commit and the verification numbers are re-taken.
- Reproduce assets with a script when possible (scores, counters, layouts). A generated asset is
  regenerated by `scripts/generate_data.py` or `scripts/audio/render_music.mjs`, not hand-edited.
- Keep the checkout lean: large media (renders, narration models, film masters) belongs in release
  assets, not in history. Target well under 100 MB for a fresh clone.
- Third-party **code** keeps its licence text; third-party **content** keeps attribution. Never
  relicense borrowed material by omission.

## 7. Definition of done

A change is done when all of the following are true and their numbers are written down:

1. `npx tsc --noEmit` passes, and the film-level gates ran first: `node scripts/qa/film_coverage.mjs`
   (every `src/*/script.ts` is in `scripts/film_registry.mjs`, every registered film exists),
   `node scripts/qa/derive_data.mjs --all` (the generators a film names were run) and
   `node scripts/qa/derived_check.mjs` (no derived JSON is tracked by git — this one needs a git
   checkout, so on a render box it prints SKIPPED and the checkout run is the evidence). A film with
   a claims ledger also passes `node scripts/qa/claims_check.mjs`.
2. `python3 scripts/qa/design_check.py` passes (contract integrity) and
   `python3 scripts/qa/type_ratchet.py` reports the exception list unchanged.
3. `node scripts/qa/still_lint.mjs` passes (no off-frame box, no text in the safe-area margin, no
   spill, no text overlap) and `--fixtures` still passes — the fixture proves the gate itself works.
   A change that touches 3D also passes `node scripts/qa/model_lint.mjs "public/models/*.glb"
   --watertight --allow=no-normals` and `node scripts/qa/three_frame_lint.mjs
   --composition=ThreeStage --frames=150,450,750 --repeat`, and its framing was reviewed on stills
   (composition is deliberately not machine-judged — see `docs/3d.md`). A change that touches plates
   also passes `node scripts/qa/plate_lint.mjs` (manifest vs. files vs. consumer duration) and
   states which engine and device rendered them: a plate set is evidence only if it says what made
   it, and "it rendered" is not "the GPU rendered" — see `docs/known-issues.md` K21. A change that adds or regenerates a generated asset also
    passes `npm run lint:props`: watertight is a hard requirement there, not a nicety, and the
    generator proves it from its own topology before writing the file (every undirected edge exactly
    twice, opposite directions — see K22 and `docs/sdf-assets.md`).
4. Stills regenerated for the changed scenes and **looked at**; the finding is recorded in
   `docs/verify-report.md` (what was checked, what was seen).
5. A render exists and its duration matches the scene budget.
6. `scripts/audio/loudnorm.sh` reports I in [-16, -13] LUFS and TP <= -1.5 dBFS.
7. `scripts/qa/music_gate.py --music <stem>` passes, and on a real delivery
   `--mix <mix> --narration <narration>` passes too: the bed carries >= 50% of its power in
   250-4k Hz and sits 5-18 dB under speech in the gaps. `--self-test` still fires on a sub-only bed.
   Loudness normalisation cannot save a bed nobody can hear — the energy has to be in a band a phone
   speaker can produce, not below 120 Hz.
8. `scripts/qa/luma_blink.py` reports mean |Δ| <= 12 and no dip, over the full frame.
9. When narration or scene durations changed, `npm run publish` was re-run: the SRT, chapters and
   cover in `out/export/` must belong to the same script as the render (they are derived, so a stale
   one is a forgotten command, not a missing edit).
10. A delivery was produced by `npm run make`, not by hand-run stages, and `report.json` is quoted
    in `docs/verify-report.md`: the stage table is the evidence that each gate actually ran. A
    delivery assembled from shell history is a delivery whose gates nobody can prove.
11. `report.json` names the tree it measured: `numbers.tree` matches `node scripts/qa/tree_hash.mjs`
    on the authoring checkout, and `numbers.segments` shows how much of the picture was reused. A run
    on a copy of the repo passes `--expect-tree <hash>`; if the hashes disagree, the run never starts.
    A delivery whose report cannot say which tree it measured is a delivery of unknown provenance —
    see `docs/known-issues.md` K18.
12. The diff is committed, and the commit message says what changed and why.

"No claim of done without the numbers." A green `verify` alone is necessary and not sufficient —
see §7.3 and the two v1.0.0 defects.

## 8. Git discipline

- **One stage, one commit.** Environment, content, design, assets, and docs are separate commits.
  Never mix a refactor with a behaviour change, or a design-token change with a scene rewrite.
- **Message format:** `<area>: <what changed, imperative, lower case>`. Areas: `design`, `scene`,
  `content`, `audio`, `qa`, `docs`, `scripts`, `assets`, `chore`. Body: why, and the evidence
  numbers when the change affects output.
- **Never commit** `out/`, `node_modules/`, `.remotion/`, rendered `.wav`/`.mp4`, logs, or editor
  droppings. If a file must be excluded, add an ignore rule in the same commit.
- **Before an irreversible step** (rewriting a scene, replacing an asset, re-rendering a master),
  the working tree is clean or the unfinished work is committed. A failed experiment is reverted,
  not left half-applied.
- **Releases are tags.** `vX.Y.Z` on a passing `verify`, with the film master attached as a release
  asset and its sha256 recorded in `docs/verify-report.md`.

## 9. Review checklist

Author self-review before every commit:

- [ ] Does any component contain a colour, size, or duration literal that belongs in the contract?
- [ ] Is every visible string in `LINES` (or `data/`) rather than inline in JSX?
- [ ] Does any animation run on the wall clock, or ignore its declared duty?
- [ ] Do the stills of the changed scenes show text inside the safe area and off other text?
- [ ] Does the caption timing fit 4.2–4.8 chars/s, and the scene budget still sum to the runtime?
- [ ] Are new binaries recorded in `THIRD_PARTY_NOTICES.md`?
- [ ] Is the evidence (numbers, what was looked at) in `docs/verify-report.md`?
- [ ] If a film was delivered: did `npm run make` produce it, and is `report.json` quoted?

## 10. Decisions log

Append one line per irreversible decision, newest last: date, decision, why, and what it costs.

- 2026-10: **hard cuts instead of cross-fades** — `TransitionSeries` overlap multiplies two
  opacities and produced a flicker the luma gate could not see. Cost: no dissolve look between
  scenes; each scene must fade its own content.
- 2026-10: **programmatic score instead of Tone.js** — no `OfflineAudioContext` under Node. Cost: the
  score is arithmetic over an oscillator bank, not a DAW-style graph.
- 2026-10: **one token source, derived from a checked contract** — the project had two palette
  modules that could disagree. Cost: editing a colour now touches the spec file first.
- 2026-10: **the score is rendered before the picture** — `make.mjs` gates the stem first, so a bed
  that cannot be heard never reaches a render. Cost: a score-only rerun takes ~40 s before any frame
  is drawn; a picture-only iteration must use `remotion render` directly.
- 2026-10: **local TTS (IndexTTS-2) with measured re-timing** — cloud TTS breaks determinism and
  offline rendering. Cost: a 13 GB model and a python <3.12 side venv.