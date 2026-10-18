#!/usr/bin/env node
/**
 * Film isolation: a film's content may not leak into another film's build.
 *
 * The failure this prevents is quiet: film B edits a shared data file that film A
 * also reads, film A's numbers change, and nothing in the output says why. So the
 * layout is a rule, and the rule is checked:
 *
 *   data/                  shared contract only: design.spec.json, type-exceptions.json
 *   data/<film>/           one film's own inputs (traces, counters, voice timings)
 *   src/<film>/            one film's own scenes; may read only data/<film>/ and the contract
 *   src/design|storyboard  the engine, shared by every film
 *
 * Rules (each is a failure, not a warning):
 *   unpaired   data/<film>/ without src/<film>/, or a film without data/<film>/
 *   foreign    a film imports another film's JSON or source
 *   shared     a film imports a data/*.json that is neither its own nor the contract
 *   timeline   a film has no script.ts, or its script.ts declares no SCENES/FPS
 *
 * Usage: node scripts/qa/film_isolation.mjs [--root <dir>]
 */
import fs from "node:fs";
import path from "node:path";

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const ROOT = path.resolve(argOf("--root") ?? path.join(path.dirname(new URL(import.meta.url).pathname), "..", ".."));

const ENGINE = new Set(["design", "storyboard", "qa", "showcase"]);
const SHARED_DATA = new Set(["design.spec.json", "type-exceptions.json"]);

const exists = (p) => fs.existsSync(p);
const isDir = (p) => exists(p) && fs.statSync(p).isDirectory();

const srcDir = path.join(ROOT, "src");
const dataDir = path.join(ROOT, "data");

const filmDirs = fs.readdirSync(srcDir)
  .filter((d) => isDir(path.join(srcDir, d)) && !ENGINE.has(d))
  .sort();
const dataDirs = fs.readdirSync(dataDir)
  .filter((d) => isDir(path.join(dataDir, d)))
  .sort();

const issues = [];
const fail = (rule, file, message) => issues.push({ rule, file: path.relative(ROOT, file), message });

// 1. pair every film with exactly one data directory, and vice versa
for (const film of filmDirs) {
  if (!dataDirs.includes(film)) fail("unpaired", path.join(dataDir, film), "film " + film + " has no data/" + film + "/");
}
for (const d of dataDirs) {
  if (!filmDirs.includes(d)) fail("unpaired", path.join(dataDir, d), "data/" + d + "/ has no src/" + d + "/");
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  return e.isDirectory() ? walk(p) : [p];
});

// 2. imports stay inside the film, the engine, and the contract
for (const film of filmDirs) {
  const filmSrc = path.join(srcDir, film);
  const files = walk(filmSrc).filter((f) => /\.(ts|tsx)$/.test(f));
  for (const file of files) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*)["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue; // npm packages, not repository content
      const abs = path.resolve(path.dirname(file), spec);
      if (abs.startsWith(path.join(ROOT, "data"))) {
        const rel = path.relative(dataDir, abs);
        const top = rel.split(path.sep)[0];
        if (SHARED_DATA.has(rel) || rel === "") continue;
        if (top !== film) fail("foreign", file, "imports " + path.relative(ROOT, abs) + " (belongs to " + top + ")");
        continue;
      }
      const relSrc = path.relative(srcDir, abs).split(path.sep);
      const top = relSrc[0];
      if (top && !ENGINE.has(top) && top !== film) {
        fail("foreign", file, "imports another film's source: " + path.relative(ROOT, abs));
      }
    }
  }
}

// 3. shared data is shared-only: no film-specific JSON may sit at data/ root
for (const f of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (f.isDirectory() || !f.name.endsWith(".json")) continue;
  if (!SHARED_DATA.has(f.name)) fail("shared", path.join(dataDir, f.name), "film data at data/ root: move it to data/<film>/");
}

// 4. each film owns its timeline
for (const film of filmDirs) {
  const script = path.join(srcDir, film, "script.ts");
  if (!exists(script)) {
    fail("timeline", script, "film " + film + " has no script.ts");
    continue;
  }
  const text = fs.readFileSync(script, "utf8");
  for (const need of ["SCENES", "FPS"]) {
    if (!new RegExp("export const " + need + "\\b").test(text)) {
      fail("timeline", script, "script.ts does not export " + need);
    }
  }
}

const summary = "films=" + filmDirs.join(",") + " data=" + dataDirs.join(",");
if (issues.length) {
  for (const i of issues) console.log("  " + i.rule + ": " + i.file + " — " + i.message);
  console.log("FAIL - " + issues.length + " isolation issue(s); " + summary);
  process.exit(1);
}
console.log("PASS - " + filmDirs.length + " films isolated (" + summary + ")");
