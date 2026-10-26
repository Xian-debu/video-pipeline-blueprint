#!/usr/bin/env node
/**
 * Film isolation: a film's content may not leak into another film's build.
 *
 * The failure this prevents is quiet: film B edits a shared data file that film A also reads, film
 * A's numbers change, and nothing in the output says why. So the layout is a rule, and the rule is
 * checked against the manifest the engine was built from:
 *
 *   data/                    shared contract only: design.spec.json, type-exceptions.json
 *   data/<film>/             one film's own inputs (traces, counters, voice timings)
 *   data/series/<id>/        a series' shared inputs, readable only by that series' episodes
 *   src/<film>/              one film's own scenes; may read only data/<film>/ and the contract
 *   src/series/<id>/         a series' shared components, importable only from its episodes
 *   src/design|storyboard|qa|showcase   the engine, shared by every film
 *
 * Rules (each is a failure, not a warning):
 *   unpaired   a manifest film without its mounted data directory, or an extra film directory
 *   foreign    a film imports another film's JSON or source
 *   shared     a film imports a data/*.json that is neither its own nor the contract
 *   timeline   a film has no script.ts, or its script.ts declares no SCENES/FPS
 *
 * Usage: node scripts/qa/film_isolation.mjs [--root <dir>]
 */
import fs from "node:fs";
import path from "node:path";

import { ROOT as ENGINE_ROOT, loadManifest } from "../lib/content.mjs";

const args = process.argv.slice(2);
const argOf = (name) => {
  const i = args.indexOf(name);
  return i >= 0 ? args[i + 1] : null;
};
const ROOT = path.resolve(argOf("--root") ?? ENGINE_ROOT);

const ENGINE = new Set(["design", "storyboard", "qa", "showcase", "series"]);
const SHARED_DATA = new Set(["design.spec.json", "type-exceptions.json"]);
const manifest = loadManifest(ROOT);
const films = manifest.films ?? [];

const exists = (p) => fs.existsSync(p);
const isDir = (p) => exists(p) && fs.statSync(p).isDirectory();
const srcDir = path.join(ROOT, "src");
const dataDir = path.join(ROOT, "data");
const issues = [];
const fail = (rule, file, message) => issues.push({ rule, file: path.relative(ROOT, file), message });

const filmIds = new Set(films.map((f) => f.id));
const dataTops = new Set(films.map((f) => (f.dataDir ?? "data/" + f.id).split("/").pop()));

// 1. every manifest film is mounted, and no extra film directory exists
for (const film of films) {
  const data = path.join(ROOT, film.dataDir ?? "data/" + film.id);
  if (!isDir(data)) fail("unpaired", data, "film " + film.id + " has no mounted data directory");
}
for (const d of fs.readdirSync(srcDir, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name.startsWith(".")) continue;
  if (!ENGINE.has(d.name) && !filmIds.has(d.name)) fail("unpaired", path.join(srcDir, d.name), "src/" + d.name + "/ is not in the manifest");
}
for (const d of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (!d.isDirectory() || d.name === "series") continue;
  if (!dataTops.has(d.name)) fail("unpaired", path.join(dataDir, d.name), "data/" + d.name + "/ is not in the manifest");
}

const walk = (dir) => fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
  const p = path.join(dir, e.name);
  if (e.name === "__pycache__" || e.name === "node_modules" || e.name.startsWith(".")) return [];
  return e.isDirectory() ? walk(p) : [p];
});

// 2. imports stay inside the film, its series, the engine, and the contract
const checkImports = (root, owner, allowedSeries) => {
  if (!isDir(root)) return;
  for (const file of walk(root).filter((f) => /\.(ts|tsx)$/.test(f))) {
    const text = fs.readFileSync(file, "utf8");
    for (const m of text.matchAll(/(?:from\s+|import\s*\(\s*|import\s+)["']([^"']+)["']/g)) {
      const spec = m[1];
      if (!spec.startsWith(".")) continue;
      const abs = path.resolve(path.dirname(file), spec);
      const relData = path.relative(dataDir, abs);
      if (!relData.startsWith("..") && relData !== "") {
        const parts = relData.split(path.sep);
        if (parts.length === 1 && SHARED_DATA.has(parts[0])) continue;
        if (parts[0] === "series" && allowedSeries && parts[1] === allowedSeries) continue;
        if (parts[0] === owner) continue;
        fail("foreign", file, "imports " + path.relative(ROOT, abs) + " (belongs to " + parts[0] + ")");
        continue;
      }
      const relSrc = path.relative(srcDir, abs);
      if (relSrc.startsWith("..")) {
        fail("foreign", file, "import escapes src/: " + path.relative(ROOT, abs));
        continue;
      }
      const parts = relSrc.split(path.sep);
      if (parts[0] === owner || ENGINE.has(parts[0])) {
        if (parts[0] === "series" && allowedSeries && parts[1] !== allowedSeries) {
          fail("foreign", file, "imports another series' source: " + path.relative(ROOT, abs));
        }
        continue;
      }
      fail("foreign", file, "imports another film's source: " + path.relative(ROOT, abs));
    }
  }
};

for (const film of films) {
  checkImports(path.join(srcDir, film.id), film.id, film.series?.id ?? null);
}
const seriesRoot = path.join(srcDir, "series");
if (isDir(seriesRoot)) {
  for (const d of fs.readdirSync(seriesRoot, { withFileTypes: true })) {
    if (d.isDirectory()) checkImports(path.join(seriesRoot, d.name), "__series_shared__", d.name);
  }
}

// 3. shared data is shared-only: no film-specific JSON may sit at data/ root
for (const f of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (f.isDirectory() || !f.name.endsWith(".json")) continue;
  if (!SHARED_DATA.has(f.name)) fail("shared", path.join(dataDir, f.name), "film data at data/ root: move it to data/<film>/");
}

// 4. each film owns its timeline
for (const film of films) {
  const script = path.join(srcDir, film.id, "script.ts");
  if (!exists(script)) {
    if (film.status === "draft") continue;
    fail("timeline", script, "film " + film.id + " has no script.ts");
    continue;
  }
  const text = fs.readFileSync(script, "utf8");
  const hasExport = (name) =>
    new RegExp("export\\s+const\\s+" + name + "\\b").test(text) ||
    new RegExp("export\\s+const\\s*\\{[^}]*\\b" + name + "\\b").test(text) ||
    new RegExp("export\\s*\\{[^}]*\\b" + name + "\\b").test(text);
  for (const need of ["SCENES", "FPS"]) {
    if (!hasExport(need)) {
      fail("timeline", script, "script.ts does not export " + need);
    }
  }
}

const summary = "films=" + films.map((f) => f.id).join(",");
if (!manifest.contentRoot) {
  console.log("PASS - engine-only mode (no content manifest)");
  process.exit(0);
}
if (issues.length) {
  for (const i of issues) console.log("  " + i.rule + ": " + i.file + " — " + i.message);
  console.log("FAIL - " + issues.length + " isolation issue(s); " + summary);
  process.exit(1);
}
console.log("PASS - " + films.length + " film(s) isolated (" + summary + ")");
