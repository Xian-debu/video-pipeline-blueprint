// The mounted tree and the content manifest must agree, in both directions.
//
//   node scripts/qa/film_coverage.mjs
//
// films.mjs check proves the bytes of every mount. This gate proves the structure around them:
// a film's script, entry, data directory and generated register all exist, no unregistered film
// directory is sitting in src/ or data/, and the generated register names every film. The old
// failure mode (K27) was a silent skip: a film present on disk but absent from the map every gate
// iterated. There is no map any more; the manifest is the map, and this is the gate that says so.
import fs from "node:fs";
import path from "node:path";

import { ROOT, loadManifest } from "../lib/content.mjs";

const ENGINE_SRC = new Set(["design", "storyboard", "qa", "showcase", "series"]);
const SHARED_DATA = new Set(["design.spec.json", "type-exceptions.json"]);
const manifest = loadManifest(ROOT);
const problems = [];
const films = manifest.films ?? [];

if (!manifest.contentRoot) {
  console.log("film coverage: engine-only mode (no content repo mounted)");
  process.exit(0);
}
if (!films.length) {
  console.log("film coverage: content repo mounted, 0 films (catalog has no packs)");
  process.exit(0);
}

const srcDir = path.join(ROOT, "src");
const dataDir = path.join(ROOT, "data");
const dirs = (p) => fs.readdirSync(p, { withFileTypes: true })
  .filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => e.name);

for (const film of films) {
  const script = path.join(srcDir, film.id, "script.ts");
  const data = path.join(ROOT, film.dataDir);
  const draft = film.status === "draft";
  if (!fs.existsSync(script)) {
    if (!draft) problems.push(film.id + ": missing mounted " + path.relative(ROOT, script));
    else console.log("  note: " + film.id + " is draft; no script.ts yet");
  }
  if (!fs.existsSync(data)) problems.push(film.id + ": missing mounted " + path.relative(ROOT, data));
  const entry = path.join(srcDir, film.id, path.basename(film.entry));
  if (!fs.existsSync(entry)) problems.push(film.id + ": entry " + film.entry + " is not mounted as " + path.relative(ROOT, entry));
  if (fs.existsSync(script)) {
    const text = fs.readFileSync(script, "utf8");
    const hasExport = (name) =>
      new RegExp("export\\s+const\\s+" + name + "\\b").test(text) ||
      new RegExp("export\\s+const\\s*\\{[^}]*\\b" + name + "\\b").test(text) ||
      new RegExp("export\\s*\\{[^}]*\\b" + name + "\\b").test(text);
    for (const need of ["SCENES", "FPS"]) {
      if (!hasExport(need)) problems.push(film.id + ": script.ts does not export " + need);
    }
  }
  for (const m of film.mounts ?? []) {
    if (!fs.existsSync(path.join(ROOT, m.to))) problems.push(film.id + ": mount missing " + m.to);
  }
}

const registry = fs.readFileSync(path.join(srcDir, "films.generated.tsx"), "utf8");
const root = fs.readFileSync(path.join(srcDir, "Root.tsx"), "utf8");
if (!root.includes("films.generated")) problems.push("src/Root.tsx does not import the generated film register");
for (const film of films) {
  if (!registry.includes(JSON.stringify(film.id))) problems.push(film.id + ": not in src/films.generated.tsx (run sync)");
}

const filmIds = new Set(films.map((f) => f.id));
for (const d of dirs(srcDir)) {
  if (!ENGINE_SRC.has(d) && !filmIds.has(d)) problems.push("src/" + d + "/ is not an engine directory and not a manifest film");
}
const dataTops = new Set(films.map((f) => f.dataDir.split("/").pop()));
for (const d of dirs(dataDir)) {
  if (d === "series") continue;
  if (!dataTops.has(d)) problems.push("data/" + d + "/ is not a manifest film directory");
}
for (const f of fs.readdirSync(dataDir, { withFileTypes: true })) {
  if (f.isFile() && f.name.endsWith(".json") && !SHARED_DATA.has(f.name)) {
    problems.push("data/" + f.name + " is film data at data/ root");
  }
}

if (problems.length) {
  console.error("FAIL film coverage (" + problems.length + ")");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("film coverage: " + films.length + " film(s), mounts/entry/script/data registered ("
  + films.map((f) => f.id).join(", ") + ")");
