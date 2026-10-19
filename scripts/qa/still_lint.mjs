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
import { build } from "esbuild";
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";

const EDGE_PX = 24;
const OVERLAP_RATIO = 0.25;

const DEFAULT_TARGETS = [
  { id: "Storyboard", frames: [60, 300] },
  { id: "Showreel", frames: [90, 400] },
  // Film compositions are not listed here: their frames are derived from the film script itself
  // (one still at each scene's midpoint), so a timeline edit cannot leave a stale frame number
  // behind. See FILM_SCRIPTS.
  // Transitions is a showcase of cross-fades: at a fade both the outgoing and
  // the incoming scene are on screen, so their text boxes are meant to
  // intersect. Overlap is the one rule this composition cannot satisfy.
  { id: "Transitions", frames: [60, 120], skip: ["overlap"] },
  { id: "Typesetting", frames: [60, 200] },
  { id: "ThreeCube", frames: [30] },
  // One frame per 3D shot: procedural lattice, imported glTF, transparent composite.
  { id: "ThreeStage", frames: [150, 450, 750] },
  { id: "PropStage", frames: [45, 110] },
  // One frame per preset: the gallery exists so a look can be checked, and the
  // check that matters most is that text still sits inside the frame in it.
  { id: "Presets", frames: [45, 135, 225] },
  // ManimOverlay is not in the default set: it needs public/manim/Formula.mov,
  // which is a locally rendered artefact and not committed. Render it first and
  // run `--compositions ManimOverlay --frames 30`.
];

/**
 * Compositions whose content comes from a film script, and the script that owns them.
 * One still per scene, at the scene's midpoint: no cut, no transition, and a layout broken in any
 * single scene still fails the gate. A hard-coded frame list was wrong the moment the timeline
 * moved (and was clamped silently before that), so the list is computed from the source of truth.
 */
const FILM_SCRIPTS = {
  Lecture: "src/lecture/script.ts",
  Multiplication: "src/mult/script.ts",
  Gears: "src/gears/script.ts",
  Hawk: "src/hawk/script.ts",
};

async function filmTargets() {
  const out = [];
  for (const [id, script] of Object.entries(FILM_SCRIPTS)) {
    const tmp = path.join(os.tmpdir(), "lint-frames-" + id + "-" + process.pid + ".mjs");
    await build({
      entryPoints: [path.resolve(script)],
      bundle: true,
      format: "esm",
      platform: "node",
      outfile: tmp,
      logLevel: "error",
      external: ["@remotion/*", "remotion"],
    });
    const mod = await import("file://" + tmp + "?t=" + Date.now());
    fs.rmSync(tmp, { force: true });
    const { SCENES, FPS } = mod;
    if (!Array.isArray(SCENES) || !Number.isFinite(FPS)) throw new Error("still lint: " + script + " has no SCENES/FPS");
    // Not every film script carries `start` (the lecture declares durations only), so the
    // accumulation is done here: the midpoint of scene k is the sum of the durations before it.
    let cursor = 0;
    const frames = SCENES.map((s) => {
      const mid = cursor + s.dur / 2;
      cursor += s.dur;
      return Math.round(mid * FPS);
    });
    out.push({ id, frames });
    console.error("still lint: " + id + " -> " + frames.length + " frames from " + script);
  }
  return out;
}

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
    : [...DEFAULT_TARGETS, ...(await filmTargets())];

const rect = (b) => ({ x: b.x, y: b.y, w: b.w, h: b.h });

// Measured with the glyph rect, not the element box. A chart label is a leaf element whose box is
// often wider (or taller) than the text it paints, and a label that shares a container with its
// value is not two texts on top of each other. Text vs text is the question the rule asks.
// The text range's box includes the line box's half-leading (a 108 px title reports a 155 px
// range), so it is clipped to its own element: what the reader sees is the layout box the text was
// fitted into. Text that genuinely paints outside its box is a separate rule (`spills`), so
// clipping here cannot hide a real overflow.
const paintRect = (b) => {
  if (!(b.text && b.tw > 0 && b.th > 0)) return rect(b);
  const x = Math.max(b.x, b.tx);
  const y = Math.max(b.y, b.ty);
  const r = Math.min(b.x + b.w, b.tx + b.tw);
  const bottom = Math.min(b.y + b.h, b.ty + b.th);
  return { x, y, w: Math.max(0, r - x), h: Math.max(0, bottom - y) };
};
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
      const a = paintRect(texts[i]);
      const b = paintRect(texts[j]);
      const area = Math.min(a.w * a.h, b.w * b.h);
      if (area <= 0) continue;
      if (a.w <= 0 || a.h <= 0 || b.w <= 0 || b.h <= 0) continue;
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