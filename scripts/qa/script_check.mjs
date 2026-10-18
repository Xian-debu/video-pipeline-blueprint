#!/usr/bin/env node
/**
 * Read the film's script back and print what it implies: scene table, narration
 * pacing, caption budget. Fails on an over-long caption line or a scene whose
 * narration cannot fit, so those are caught before a 20-minute render.
 *
 *   node scripts/qa/script_check.mjs [src/mult/script.ts]
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const entry = resolve(process.argv[2] ?? "src/mult/script.ts");
const dir = mkdtempSync(join(tmpdir(), "script-check-"));
const outfile = join(dir, "script.mjs");
let failed = false;

try {
  await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile, logLevel: "error" });
  const mod = await import(pathToFileURL(outfile).href);
  const { SCENES, LINES, TOTAL_SEC, SCRIPT_PROBLEMS, FPS } = mod;

  console.log("entry  " + entry);
  console.log("scene  id          t0      dur    lines  chars  chars/s");
  for (const s of SCENES) {
    const ls = LINES.filter((l) => l.scene === s.id);
    const chars = ls.reduce((a, l) => a + l.speech.length, 0);
    const speech = ls.reduce((a, l) => a + l.dur, 0);
    console.log(
      "      " + s.id.padEnd(11) + String(s.start.toFixed(2)).padStart(7) + String(s.dur.toFixed(2)).padStart(8) +
        String(ls.length).padStart(7) + String(chars).padStart(7) + (chars / Math.max(0.01, speech)).toFixed(2).padStart(9)
    );
  }
  console.log("total  " + TOTAL_SEC.toFixed(2) + " s · " + LINES.length + " lines · " + (TOTAL_SEC * FPS) + " frames");

  const longest = LINES.reduce((a, l) => Math.max(a, l.speech.length), 0);
  console.log("longest caption " + longest + " chars (budget 34)");

  for (const p of SCRIPT_PROBLEMS) {
    console.error("script: " + p);
    failed = true;
  }
  if (TOTAL_SEC > 900) {
    console.error("script: total " + TOTAL_SEC.toFixed(1) + " s exceeds the 15-minute budget");
    failed = true;
  }
} finally {
  rmSync(dir, { recursive: true, force: true });
}

if (failed) process.exit(1);
console.log("script check: PASS");
