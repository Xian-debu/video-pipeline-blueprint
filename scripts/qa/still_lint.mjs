#!/usr/bin/env node
/**
 * Still lint: measures the DOM of a rendered frame instead of guessing from
 * pixels, so "text over text" and "panel off frame" are decidable facts.
 *
 *   node scripts/qa/still_lint.mjs                 # default targets
 *   node scripts/qa/still_lint.mjs --fixtures      # QA fixtures must be reported
 *   node scripts/qa/still_lint.mjs --compositions Lecture --frames 300,2500
 *
 * Rules (each is a failure, not a warning):
 *   canvas   an element's box leaves the frame
 *   edge     text sits within EDGE_PX of the frame edge (it would clip on any crop)
 *   spill    a text range paints outside its own element's box
 *   overlap  two text boxes intersect by more than OVERLAP_RATIO of the smaller
 *
 * The measurement itself happens in src/design/lint.tsx; this script only asks
 * for frames, parses the LINTBOXES lines, and applies the rules. Exit 1 on any
 * violation, 2 when the probe did not report (that is a broken gate, not a pass).
 */
import path from "node:path";
import os from "node:os";
import fs from "node:fs";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const EDGE_PX = 24;
const OVERLAP_RATIO = 0.25;

const DEFAULT_TARGETS = [
  { id: "Storyboard", frames: [60, 300] },
  { id: "Showreel", frames: [90, 400] },
  { id: "Lecture", frames: [300, 2500] },
  // Transitions is a showcase of cross-fades: at a fade both the outgoing and
  // the incoming scene are on screen, so their text boxes are meant to
  // intersect. Overlap is the one rule this composition cannot satisfy.
  { id: "Transitions", frames: [60, 120], skip: ["overlap"] },
  { id: "Typesetting", frames: [60, 200] },
  { id: "ThreeCube", frames: [30] },
  // One frame per preset: the gallery exists so a look can be checked, and the
  // check that matters most is that text still sits inside the frame in it.
  { id: "Presets", frames: [45, 135, 225] },
  // Multiplication: one frame per scene of the multiplication film, so a broken
  // layout in any single scene fails the gate. Frames are inside each scene's
  // comfortable middle, not on a hard cut.
  { id: "Multiplication", frames: [398, 1604, 3459, 5429, 7263, 9558, 12029, 14131, 16061, 17353] },
  // ManimOverlay is not in the default set: it needs public/manim/Formula.mov,
  // which is a locally rendered artefact and not committed. Render it first and
  // run `--compositions ManimOverlay --frames 30`.
];

const args = process.argv.slice(2);
const fixtures = args.includes("--fixtures");
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};

const targets = fixtures
  ? [{ id: "LintFixtures", frames: [0] }]
  : argOf("--compositions")
    ? [{ id: argOf("--compositions"), frames: (argOf("--frames") ?? "0").split(",").map(Number) }]
    : DEFAULT_TARGETS;

const rect = (b) => ({ x: b.x, y: b.y, w: b.w, h: b.h });
const intersect = (a, b) => {
  const x = Math.max(a.x, b.x);
  const y = Math.max(a.y, b.y);
  const r = Math.min(a.x + a.w, b.x + b.w);
  const bo = Math.min(a.y + a.h, b.y + b.h);
  return Math.max(0, r - x) * Math.max(0, bo - y);
};

const checkFrame = (comp, frame, payload, skip = []) => {
  const issues = [];
  const W = payload.width;
  const H = payload.height;
  const boxes = payload.boxes;

  for (const b of boxes) {
    const label = b.text ? `"${b.text}"` : `<${b.tag} panel>`;
    if (b.x < -1 || b.y < -1 || b.x + b.w > W + 1 || b.y + b.h > H + 1) {
      issues.push({ rule: "canvas", comp, frame, label, detail: `box ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)} leaves the ${W}x${H} frame` });
    }
    // A formula's boxes are the browser typesetting the maths: sub/superscript
    // glyph boxes overlap by design, so maths is exempt from the text rules.
    if (!b.boxClip && !b.math) {
      const margin = Math.min(b.x, b.y, W - (b.x + b.w), H - (b.y + b.h));
      if (margin < EDGE_PX) {
        issues.push({ rule: "edge", comp, frame, label, detail: `only ${margin.toFixed(0)} px from the frame edge (floor ${EDGE_PX})` });
      }
      if (b.spills) {
        issues.push({ rule: "spill", comp, frame, label, detail: `text range ${Math.round(b.tx)},${Math.round(b.ty)} ${Math.round(b.tw)}x${Math.round(b.th)} vs box ${Math.round(b.x)},${Math.round(b.y)} ${Math.round(b.w)}x${Math.round(b.h)}` });
      }
    }
  }

  const texts = boxes.filter((b) => !b.boxClip && b.text && !b.math);
  for (let i = 0; i < texts.length && !skip.includes("overlap"); i += 1) {
    for (let j = i + 1; j < texts.length; j += 1) {
      const a = rect(texts[i]);
      const b = rect(texts[j]);
      const area = Math.min(a.w * a.h, b.w * b.h);
      if (area <= 0) continue;
      const overlap = intersect(a, b) / area;
      if (overlap > OVERLAP_RATIO) {
        issues.push({
          rule: "overlap",
          comp,
          frame,
          label: `"${texts[i].text.slice(0, 30)}" / "${texts[j].text.slice(0, 30)}"`,
          detail: `boxes intersect by ${(overlap * 100).toFixed(0)}% of the smaller one (limit ${(OVERLAP_RATIO * 100).toFixed(0)}%)`,
        });
      }
    }
  }
  return issues;
};

const main = async () => {
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "still-lint-"));
  const all = [];
  const probes = [];

  for (const { id, frames, skip } of targets) {
    const composition = await selectComposition({ serveUrl, id });
    for (const wanted of frames) {
      // Never clamp: a frame past the end means the target list is stale after a timeline edit,
      // and clamping would quietly lint the last frame instead of the one that was meant.
      if (!Number.isInteger(wanted) || wanted < 0 || wanted >= composition.durationInFrames) {
        console.error("still lint: " + id + " frame " + wanted + " is outside the composition ("
          + composition.durationInFrames + " frames) — update the targets, do not clamp");
        process.exit(2);
      }
      const frame = wanted;
      const lines = [];
      await renderStill({
        composition,
        serveUrl,
        output: path.join(tmp, `${id}-${frame}.png`),
        frame,
        overwrite: true,
        logLevel: "error",
        inputProps: { lint: true, lintFrame: frame },
        onBrowserLog: (log) => {
          if (typeof log.text === "string" && log.text.startsWith("LINTBOXES ")) lines.push(log.text);
        },
      });
      if (lines.length !== 1) {
        console.error(`still lint: ${id} frame ${frame} reported ${lines.length} probes (expected 1)`);
        process.exit(2);
      }
      const payload = JSON.parse(lines[0].slice("LINTBOXES ".length));
      probes.push(`${id} f${frame}: ${payload.boxes.length} boxes`);
      all.push(...checkFrame(id, frame, payload, skip ?? []));
    }
  }

  fs.rmSync(tmp, { recursive: true, force: true });

  for (const p of probes) console.log("  " + p);

  if (fixtures) {
    // The fixtures exist to prove the probe sees what it claims to see.
    const found = new Set(all.map((i) => i.rule));
    for (const issue of all) console.log(`  fixture ${issue.rule}: ${issue.label} — ${issue.detail}`);
    const missing = ["canvas", "spill", "overlap"].filter((r) => !found.has(r));
    if (missing.length) {
      console.error("still lint: fixtures did not trigger " + missing.join(", "));
      process.exit(1);
    }
    console.log(`still lint fixtures: PASS — ${all.length} issues across ${found.size} rules, all expected`);
    process.exit(0);
  }

  if (all.length === 0) {
    console.log(`still lint: PASS — ${probes.length} frames, no off-frame box, no edge text, no spill, no text overlap`);
    process.exit(0);
  }
  for (const i of all) {
    console.log(`FAIL ${i.rule} ${i.comp} f${i.frame} ${i.label} — ${i.detail}`);
  }
  console.log(`still lint: ${all.length} violation(s) on ${probes.length} frames`);
  process.exit(1);
};

main().catch((err) => {
  console.error("still lint: " + (err && err.stack ? err.stack : err));
  process.exit(2);
});