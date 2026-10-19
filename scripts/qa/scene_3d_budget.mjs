#!/usr/bin/env node
/**
 * A film "about 3D" can quietly become a slideshow: the render is green, the captions
 * pass, and two thirds of it are flat cards with a gear in the corner. This gate reads
 * the script's own declaration of how much of each scene really is 3D and refuses to
 * let the promise slip.
 *
 *   node scripts/qa/scene_3d_budget.mjs [src/gears/script.ts]
 *
 * Rules (acceptance A3/A4/A5):
 *   - at least 8 scenes;
 *   - weighted 3D share >= 60% of total duration;
 *   - every scene has some 3D (three > 0);
 *   - scenes that are less than half 3D cover at most 40% of the film;
 *   - every scene is between 20 s and 60 s.
 * exit 0 pass, 1 the promise is broken, 2 the script cannot be built.
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const entry = resolve(process.argv[2] ?? "src/gears/script.ts");
const dir = mkdtempSync(join(tmpdir(), "scene-budget-"));
const outfile = join(dir, "script.mjs");
const failures = [];

const MIN_SCENES = 8;
const MIN_3D_SHARE = 0.6;
const MAX_FLAT_SHARE = 0.4;
const MIN_SCENE = 20;
const MAX_SCENE = 60;

try {
  await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile, logLevel: "error" });
  const mod = await import(pathToFileURL(outfile).href);
  const { SCENES, TOTAL_SEC } = mod;
  if (!Array.isArray(SCENES) || !SCENES.length) throw new Error("SCENES is empty");

  console.log("entry  " + entry);
  console.log("scene       dur   three   weighted  3d?");
  let threeSec = 0;
  let flatSec = 0;
  for (const s of SCENES) {
    const three = typeof s.three === "number" ? s.three : 1;
    if (three < 0 || three > 1) failures.push(s.id + ": three=" + three + " is not a fraction");
    if (three === 0) failures.push(s.id + ": no 3D at all (every scene needs a 3D shot)");
    if (s.dur < MIN_SCENE) failures.push(s.id + ": " + s.dur.toFixed(1) + " s is shorter than " + MIN_SCENE + " s");
    if (s.dur > MAX_SCENE) failures.push(s.id + ": " + s.dur.toFixed(1) + " s is longer than " + MAX_SCENE + " s");
    threeSec += s.dur * three;
    if (three < 0.5) flatSec += s.dur;
    console.log(
      "      " + s.id.padEnd(11) + String(s.dur.toFixed(2)).padStart(7) +
        String(three.toFixed(2)).padStart(8) + String((s.dur * three).toFixed(2)).padStart(11) +
        (three >= 0.5 ? "   yes" : "  part")
    );
  }
  const share = threeSec / TOTAL_SEC;
  const flatShare = flatSec / TOTAL_SEC;
  console.log("total  " + TOTAL_SEC.toFixed(2) + " s · " + SCENES.length + " scenes");
  console.log("3D     " + threeSec.toFixed(2) + " s weighted = " + (share * 100).toFixed(1) + "% (floor " + MIN_3D_SHARE * 100 + "%)");
  console.log("flat   " + flatSec.toFixed(2) + " s of scenes under half 3D = " + (flatShare * 100).toFixed(1) + "% (ceiling " + MAX_FLAT_SHARE * 100 + "%)");

  if (SCENES.length < MIN_SCENES) failures.push("only " + SCENES.length + " scenes (floor " + MIN_SCENES + ")");
  if (share < MIN_3D_SHARE) failures.push("3D share " + (share * 100).toFixed(1) + "% is below " + MIN_3D_SHARE * 100 + "%");
  if (flatShare > MAX_FLAT_SHARE) failures.push("flat share " + (flatShare * 100).toFixed(1) + "% is above " + MAX_FLAT_SHARE * 100 + "%");
} catch (e) {
  console.error("scene_3d_budget: cannot read the script (" + e.message + ")");
  rmSync(dir, { recursive: true, force: true });
  process.exit(2);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

for (const f of failures) console.error("budget: " + f);
if (failures.length) {
  console.error("scene 3D budget: FAIL — " + failures.length + " rule(s)");
  process.exit(1);
}
console.log("scene 3D budget: PASS");
