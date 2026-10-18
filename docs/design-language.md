# Design language: what we took from ppt-master, and what we refused

This document is the **provenance and rationale** for `data/design.spec.json`. The contract says
*what* the numbers are; this file says *where each rule came from*, so a later change can argue with
the source instead of reinventing it.

Source: [ppt-master](https://github.com/hugohe3/ppt-master) v6.7.2, MIT. It is a *slide-deck*
generator (SVG → PPTX), not a video pipeline, so its code is not reusable here. Its design references
are, and they were mined deliberately:

| Source file (ppt-master v6.7.2) | What it is | Used for |
|---|---|---|
| `references/plan-core.md` §6 | visual system: colour roles, type scale ratios, icons | palette roles, type scale, debt list |
| `references/shared-standards-core.md` §6 | shared aesthetic baseline (rhythm, hierarchy, contrast, chrome) | layout rules, emphasis rules, chrome rule |
| `references/animations.md` §1, §4, §4.1, §7 | motion defaults, duty taxonomy, ambient motion, video contract | motion duties and budgets, Ken Burns rule |
| `references/visual-review.md` §1–§3 | per-page review rubric (H1–H9 hard, S1–S10 soft) | QA gate mapping, storyboard author checklist |
| `references/image-layout-patterns.md` | composition vocabulary P1/P2/P3, M1/M2/M3, A1/A2/A3, C1/C2/C3 | roadmap vocabulary for image scenes |

No SVG, template, font, palette or script from ppt-master is copied into this repository. What was
transferred is **wording of rules** (sometimes adapted) and **numbers we agreed with after measuring
our own output**. ppt-master's licence travels with the ideas where they are recognisable; see
`LICENSE` and the note at the end of this file.

## 1. Why the transfer is vocabulary, not code

ppt-master optimises for: many independent pages, PowerPoint as the renderer, static screens opened
at reading distance, and the ability to fix one slide without touching the rest.

This pipeline optimises for: one continuous 300-second timeline, frame-exact determinism, a viewer who
never gets to re-read a page, and quality gates that must be numbers.

Three consequences decide every adopt/reject below:

1. **A slide can be repaired locally; a frame cannot.** A bad slide is edited and re-exported. A bad
   frame at 04:12 sits in the middle of a timed narration track; the fix must be deterministic and
   re-render the whole film. So rules that assume "fix one page" become *up-front contract* rules here.
2. **There is no peripheral re-reading.** A slide's viewer can look back; a video's viewer cannot.
   Stable positions beat per-page composition novelty, and the safe area must be respected for the
   whole 5 minutes, not per page.
3. **Every motion is authored, not selected.** ppt-master animates a *finished* page by applying a
   preset. Here the animation *is* code, so a duty taxonomy is useful but a preset registry is not.

## 2. Adopted, with where it now lives

### 2.1 Contrast as a contract, not a review finding

ppt-master: body text ≥ 4.5:1 (WCAG AA), small text < 4.5:1 is a hard review failure, and text
≥ 24 px may use the 3.0 threshold for large text; a contrast failure caused by a **brand token** is
escalated deck-wide instead of being patched page by page (`visual-review.md` §1 H4, §1.1).

Here: `palette.families.*.roles[*]` declares `on[]` (the real backgrounds) and `minContrast`;
`scripts/qa/design_check.py` recomputes the worst case per role and fails the build. The escalation
rule becomes structural: since all colours are contract entries, a failing ratio can only be fixed by
editing the contract, which is a separate, reviewable commit (`docs/engineering-standards.md` §4, §8).

Measured worst cases at v1 of the contract (`design_check.py`, 13 contrast targets, all pass):

| family | role | on (worst) | ratio | required |
|---|---|---|---|---|
| lecture | text.primary `ink` | `panel` | 14.36 | 7.0 |
| lecture | text.secondary `inkDim` | `panel` | 6.85 | 4.5 |
| lecture | text.tertiary `inkFaint` | `panel` | 3.57 | 3.0 (minSize 24) |
| lecture | accent.primary `cyan` | `panel` | 11.33 | 4.5 |
| lecture | accent.warn `coral` | `panel` | 6.23 | 4.5 |
| storyboard | text.caption `white` | `ink2` | 17.73 | 7.0 |
| storyboard | accent.primary `accent` | `ink2` | 5.72 | 4.5 |

The principle taken from H4 is the important part, not the thresholds: **a contrast failure is a
token-level finding.** That is why the check prints ratios instead of the word PASS.

### 2.2 Anchor semantic roles, not every paint

ppt-master (`plan-core.md` §6.1): anchor recurring semantic roles (`surface`, `grid`, `scrim`,
`overlay`); leave page-local tints and one-off tones to execution, promoting one only when it
becomes reusable. 60-30-10 is a starting proportion, never a lock.

Here: the contract's role list is closed — `design_check.py` fails if a colour has no role
(coverage check) and if a role has neither `on[]` nor `usage`. Translucent overlays follow the same
rule: the caption's backdrop is the `surface.scrim` role (`usage: "fill"`, `alpha: 0.62`), and
components read it through `fillColor()`, so no new hex and no inline `rgba()` can appear. A fill role
carries an alpha instead of an `on[]` list; the checker enforces that split in both directions.

### 2.3 A small ordered type scale with ratios to body

ppt-master (`plan-core.md` §6.2): cover 2.5–5×, chapter 2–2.5×, page title 1.5–2×, subtitle
1.2–1.5×, lead 1.1–1.4×, body 1×, annotation 0.7–0.85×; anchors snapped to clean even px; at most
four families; avoid near-equivalent splits.

Here (`type.scale`, body = 30):

| token | px | × body | ppt-master band |
|---|---|---|---|
| `display` | 96 | 3.20 | cover title 2.5–5× |
| `h1` | 64 | 2.13 | chapter 2–2.5× |
| `h2` | 42 | 1.40 | subtitle 1.2–1.5× |
| `body` | 30 | 1.00 | body 1× |
| `caption` | 24 | 0.80 | annotation 0.7–0.85× |
| `mono` | 26 | 0.87 | code, no slide equivalent |
| `math` | 32 | 1.07 | formula, no slide equivalent |

Adopted: the *ratio discipline* and the "fewest semantic roles that stay legible at thumbnail scale"
rule — `design_check.py` enforces strictly decreasing order, unused-token detection and
"minReadable must be a real scale value", so no size can sneak in beside the ladder.
Rejected detail: the 0.5–0.65× footnote band. See §3.3.

### 2.4 Duty taxonomy for motion

ppt-master (`animations.md` §4): classify a lifecycle **before** choosing an effect —
`static` / `enter` / `emphasize` / `move` / `exit` — and only add effects for a real duty;
entrance-led choreography is the default; per-element animation is off by default because auto-firing
builds are the "AI deck" tell.

Here: `motion.duties` with a frame budget and a meaning per duty, consumed through
`dutyFrames(duty)` so a component cannot invent a duration. Current budget: `static` 0,
`enter` 12/24, `emphasize` 40/60, `move` 12/30, `exit` 12/24 (frames, then maxFrames).
`Build` defaults to `dutyFrames("enter")`; `staggerFrames` (8) is checked to stay inside the enter
budget, because a stagger longer than the reveal is a defect, not a style.

The taxonomy also settles an argument for free: the 305 s lecture has **no** `exit` animations —
hard cuts retire a scene, so "the same slide must remove or make room" never applies. That is a duty
decision, not a taste decision.

### 2.5 Slow ambient motion, subordinate and slow

ppt-master (`animations.md` §4.1): a static full-bleed page that should not look frozen gets slow
`path_*` motion on a **non-information-bearing** layer, paced far slower than a content reveal; the
scrim and foreground stay locked while the world moves behind them ("windows, not a sliding photo").

Here: `motion.ambient` fixes the band at 8–24 s, and `ImageScene`'s Ken Burns is the implementation
(`scale` 1.00 → `kenBurns` default 1.06 across the scene). It is the only motion an image page is
allowed beyond its caption, and it must never carry information.

The band is a *rate*, not a duration, and `ambientScale()` in `src/design/contract.ts` is what makes
that true: the delta is spread over `span = clamp(sceneSeconds, minSeconds, maxSeconds)`, so a scene
shorter than 8 s **travels less** (3 s → 1.0225) instead of moving faster, and a scene longer than
24 s reaches the full delta within the band and then holds. The contract states this in
`motion.ambient.rule`; `design_check.py` fails if that string is missing, so the rule cannot quietly
drift away from the code that implements it.

### 2.6 Aesthetic baseline items that became layout rules

From `shared-standards-core.md` §6, adopted as written (and folded into
`docs/engineering-standards.md` §3–§4):

- **Text-block rhythm**: paragraph gap visibly larger than the line step; list-item gap between the
  two; peer blocks share one rhythm. → `leading: 1.55`, `blockGap: 32`, and the rule that repeated
  peer blocks (proof lines, code lines) share one spacing constant.
- **Alignment and proximity**: spacing carries hierarchy; break an axis only when the offset performs
  hierarchy. → grid 4, gutter 24, page margin 72, safe area 64.
- **Emphasis never by colour alone**: combine luminance, weight, scale, position or explicit
  labelling. → standards §4; not machine-checkable, so it is a still-review item.
- **Natural wrapping**: break at semantic boundaries, never a stranded single character. → caption
  `maxCharsPerLine: 34` plus manual line breaks in `LINES`; the check cannot verify a break point, the
  review does.
- **Containers carry meaning**: a panel expresses grouping, boundary or material; peer containers
  share treatment. → the panel/panelLine pair in the lecture family, one radius (6).

### 2.7 The review rubric as a gate map

`visual-review.md` §1–§3 was the most useful transfer of all, because it separates *what a machine
can prove* from *what a human must look at*. Mapping:

| ppt-master rule | This pipeline's gate |
|---|---|
| H1 out of bounds, H2 text overflow, H3 text overlap, H6 collision | still-frame review; automated still lint is on the roadmap |
| H4 readability / contrast | `design_check.py` (contract level) — the only one mechanised so far |
| H7 declared chrome displaced | `ChapterBar` is the declared chrome; it is outside every scene's content flow |
| H9 missing key element | still review of every scene at one representative frame |
| S1/S4/S5 rhythm, alignment, grid uniformity | grid anchors in the contract; still review |
| S6 CJK letter-spacing ≤ 2–5 % | **violated today** — see debt §4 |
| S7 decorative accents compete | standards §4 "emphasis cannot rely on colour alone"; still review |
| S9 caption distance / text on busy image | caption scrim; still review |

The rubric's *iteration protocol* (§4) also got adopted in spirit: static check first, then render,
then review, and never review before the static checker passes.

### 2.8 Composition vocabulary for image scenes

`image-layout-patterns.md` is a catalog, explicitly "options, not a checklist". It is used here as
**vocabulary for the scene roadmap**, not as markup to copy:

- `#P1-01` full-bleed title field — what `ImageScene` does today (plate + Ken Burns).
- `#P1-02` side image with content field, `#P1-04` image band — the two cheapest next layouts; both
  fit the existing `Scene` schema (`plate` + text fields) without a new component.
- `#P2-01` annotated evidence — the natural home for a real algorithm visual (annotate the trace
  instead of tabulating it).
- `#P3-04` small multiples — comparison scenes (the 5-variant counter chart is currently a table).
- `#A2-02` frame breakout / `#M1-05` text subtraction — the two cutout techniques worth trying if a
  subject must interact with native text; both need a prepared transparent asset, which the asset
  rules (`docs/engineering-standards.md` §6) already allow with provenance.
- `#C2-01` pan / `#C3-01` matched framing — cross-scene continuity, the video-native use of the
  catalog: consecutive scenes that share one visual world read as one sustained shot.

Nothing in this list is implemented beyond `#P1-01`; it is recorded so the next image scene starts
from a named option instead of a mood.


### 2.9 Icons: a policy, not a library

`plan-core.md` §6.3 lists four legitimate icon bases (emoji / a built-in icon set / project-specific
icons / none) and two disciplines: one family per document and one stroke width from {1.5, 2, 3}. The
lecture uses **none**, and that is the first rule here — a 305 s film has no toolbar, so an icon has
to earn its place as a diagram element, not as decoration.

If one is needed:

- **Inline JSX, committed**: `src/design/icons.tsx`, `viewBox="0 0 24 24"`, `strokeWidth={2}`,
  `stroke="currentColor"`, size taken from the text role it labels (an icon next to a caption is
  24 px, never a new number). No icon font, no CDN sprite, no package dependency — an icon font is a
  font, and fonts at render time are both a determinism hazard and a licence to track.
- **No emoji.** They render differently per emoji font version; two machines would produce two films.
- **One family, stroke 2, geometric caps.** Mixing a filled set with an outline set is the icon
  equivalent of mixing two typefaces, and §2.2's "no near-equivalent split" applies to shapes too.
- **Meaning is never carried by the icon alone** (same reason as colour in §2.6); it labels text that
  already says the thing.
- **Brand marks** (a logo of a tool being discussed) must be the real mark, sourced from simple-icons
  or the vendor, with a row in `THIRD_PARTY_NOTICES.md`; a hand-drawn approximation of a logo is
  both a trademark problem and a credibility problem.

None of this is implemented because nothing needs it yet; it exists so the first icon is a decision
someone made, not a shape someone dropped in.

## 3. Deliberately diverged, with the reason

### 3.1 Page transitions: ppt-master fades, we hard cut

ppt-master's default page transition is `fade` 0.4 s — correct for driven slides. Here `K1`
(`docs/known-issues.md`) showed that a cross-fade between two full-frame scenes multiplies two
opacities and dips the mean luma; the flicker gate does not catch it because it is an area illusion,
not a luma jump. So `motion.transition.kind = "hard-cut"`, `fadeFrames: 0`, and the reason is stored
in the contract's `why` field and enforced by `design_check.py`. A reader who wants the fade back has
to argue with K1, not with this document.

### 3.2 Chrome and titles stay where they are

ppt-master (`shared-standards-core.md` §6): the page title is part of the composition, not an
automatic header band; add chrome only when it carries a job.

Adopted: the *job* test — `ChapterBar` exists because a 305 s film needs "which chapter am I in"
navigation, and it is static (never animated, never re-laid-out per scene).
Rejected: per-page title placement. In a film the viewer cannot page back; a title that moves is a
re-orientation cost every 20 seconds. Stable anchors win, and this is the one place where the slide
reasoning does not transfer.

### 3.3 No "captions may be smaller" escape

ppt-master explicitly refuses a universal font-size floor: captions and metadata may be smaller when
their role and context stay legible, and if nothing fits you should restructure, shorten or reflow.

Rejected, because the escape hatch does not exist here: a caption's text is fixed by `LINES` and
timed by the narration; there is no "reflow the text frame" at 30 fps. Taking the floor away would
leave miniaturisation as the only failure mode. So `minReadable: 24` is absolute, `caption` is the
floor, and the pressure is moved to `maxCharsPerLine` (34) and the 4.2–4.8 chars/s band — i.e. the
content must be written to fit, not shrunk to fit.

### 3.4 No preset registry, no Morph, no sidecar

ppt-master's 203 native presets, deterministic Morph pairing and `animations.json` sidecar exist
because PowerPoint is the runtime and a page is finished before it is animated. Here the animation is
React state over `useCurrentFrame()`; the equivalent of Morph is a component that interpolates
between two props, which is *more* deterministic (a frame is a pure function) and needs no pairing
registry. `MOTION` therefore stores duties and budgets only — no effect names, no easing registry.
The trade taken: less variety out of the box, no dependence on an external animation model.

### 3.5 No PPT-safe font list

ppt-master names concrete PowerPoint-installed faces per script because export resolves the first
named family. There is no PPTX target here; fonts are whatever the Linux render host has. We keep the
*spirit* (one named family per script, concord rather than accidental contrast; ≤ 4 families) and
record the actual stack in `tokens.ts`: Noto Sans CJK SC for UI/captions, Noto Serif CJK SC for
storyboard display type. Consequence: `K10`-style environment drift is real — a host without Noto
CJK renders tofu, which is why `doctor.sh` checks the fonts before rendering.

## 4. Debts recorded, not paid

| # | Debt | Why it is not fixed here | Where it will be paid |
|---|---|---|---|
| D1 | Two colour families (`lecture` and `storyboard`) with different values, both frozen | merging changes existing renders and needs a full re-verification, which this contract-only change is not allowed to do | `docs/roadmap.md`, palette merge commit |
| D2 | Hard-coded type sizes in storyboard scenes (128/92/46/44/40/36/30/52) instead of `TYPE_SCALE` | changing them changes the template's look; the check cannot see inside components anyway | scene refactor, one scene per commit |
| D3 | CJK/label letter-spacing violates ppt-master's S6 (chapter bar 2 px at 18 px = 11 %; `OVERVIEW` 8 px at 36 px = 22 %; subtitle 6 px at 44 px = 14 %) | tracking changes are visual changes; bundled here as a measured finding, not a silent edit | typography commit with stills before/after |
| ~~D4~~ | **Paid.** `ImageScene` reads `motion.ambient` through `ambientScale()`; a 3 s scene now travels 1.0225 instead of 1.06 | — | this commit |
| ~~D5~~ | **Paid.** Caption scrim is the `surface.scrim` fill role, read via `fillColor()`; `design_check.py` validates alpha and the fill/text split | — | this commit |
| D6 | `design_check` validates the contract only; no component-level scan for literal colours/sizes | static JSX analysis is a different tool, and pretending otherwise would be dishonest | roadmap: still-frame lint |

## 5. Author checklist for a storyboard scene

Read this before adding a scene; the machine check cannot see most of it.

1. Colours and sizes come from `PALETTE` / `TYPE_SCALE`; if you need a new one, the commit is a
   contract commit, not a scene commit.
2. Text over an image gets a scrim; text over a plate image is otherwise a review failure (H4/S9).
3. The caption goes where it does not collide with the title (the `center` position was moved to 62 %
   height for exactly this reason — see `Caption.tsx`).
4. Every frame must be renderable alone: no CSS animation, no `Math.random`, no timer.
5. A new visual idea names its catalog option (`#P1-02`, `#P3-04`, …) in the commit body, so the next
   author can find the precedent.
6. Run `python3 scripts/qa/design_check.py` and `npx tsc --noEmit` before asking for a review; paste
   the numbers, not the words.

## 6. Licence note

ppt-master is MIT. What this repository contains is original prose that describes rules we adopted
after testing them against our own output; no source file, palette, template, font or script is
reproduced. Where a rule is recognisably ppt-master's, the source file and section are named above so
attribution is explicit rather than implied.