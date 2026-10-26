#!/usr/bin/env node
/**
 * Dump a film script to JSON so tools outside the renderer (TTS, narration build)
 * read the same numbers the picture does instead of re-deriving them.
 *
 *   node scripts/qa/dump_script.mjs src/mult/script.ts data/mult/lines.json
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync, writeFileSync, mkdirSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const entry = resolve(process.argv[2] ?? "src/mult/script.ts");
const out = resolve(process.argv[3] ?? "data/mult/lines.json");
const dir = mkdtempSync(join(tmpdir(), "dump-script-"));
const outfile = join(dir, "script.mjs");

try {
  await build({ entryPoints: [entry], bundle: true, format: "esm", platform: "node", outfile, logLevel: "error" });
  const { SCENES, LINES, TOTAL_SEC, TOTAL, FPS } = await import(pathToFileURL(outfile).href);
  const totalSec = TOTAL_SEC ?? (TOTAL && FPS ? TOTAL / FPS : null);
  const payload = {
    entry: entry.replace(resolve(".") + "/", ""),
    fps: FPS,
    totalSec,
    scenes: SCENES.map((s) => ({ id: s.id, chapter: s.chapter, start: s.start, dur: s.dur })),
    lines: LINES.map((l) => ({ scene: l.scene, index: l.index, start: l.start, dur: l.dur, speech: l.speech })),
  };
  mkdirSync(dirname(out), { recursive: true });
  writeFileSync(out, JSON.stringify(payload, null, 1) + "\n", "utf8");
  console.log("wrote " + out + " (" + payload.lines.length + " lines, " + (totalSec ?? 0).toFixed(2) + " s)");
} finally {
  rmSync(dir, { recursive: true, force: true });
}
