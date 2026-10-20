// The tree and the film map must agree, in both directions.
//
//   node scripts/qa/film_coverage.mjs
//
// A film exists as src/<dir>/script.ts. If such a file is not in scripts/film_registry.mjs then
// every gate that iterates the map silently ignores that film — which is exactly how the Hawk
// still lint passed over zero frames (K27). If the map names a script that does not exist, the
// next gate crashes halfway through instead of saying what is wrong. Both are cheap to prove.
import fs from "node:fs";
import path from "node:path";

import { FILMS } from "../film_registry.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const onDisk = fs
  .readdirSync(path.join(ROOT, "src"), { withFileTypes: true })
  .filter((e) => e.isDirectory() && fs.existsSync(path.join(ROOT, "src", e.name, "script.ts")))
  .map((e) => "src/" + e.name + "/script.ts");

const registered = Object.entries(FILMS).map(([id, f]) => ({ id, script: f.script, prefix: f.prefix }));
const problems = [];

for (const script of onDisk) {
  if (!registered.some((r) => r.script === script)) {
    problems.push(script + " has a film script but no entry in scripts/film_registry.mjs "
      + "(gates that iterate the map will skip it)");
  }
}
for (const r of registered) {
  if (!fs.existsSync(path.join(ROOT, r.script))) problems.push("film_registry.mjs names " + r.id + " but " + r.script + " does not exist");
  if (!r.prefix) problems.push("film_registry.mjs: " + r.id + " has no export prefix");
}
const prefixes = registered.map((r) => r.prefix);
for (const p of new Set(prefixes)) {
  if (prefixes.filter((x) => x === p).length > 1) problems.push("two films share the export prefix \"" + p + "\"");
}
// A film registered but missing from src/Root.tsx renders nothing, and no other gate says so.
const root = fs.readFileSync(path.join(ROOT, "src/Root.tsx"), "utf8");
for (const r of registered) {
  if (!root.includes('id="' + r.id + '"')) problems.push(r.id + " is in film_registry.mjs but src/Root.tsx registers no composition with that id");
}

if (problems.length) {
  console.error("FAIL film map and tree disagree (" + problems.length + ")");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("film coverage: " + onDisk.length + " film scripts on disk, all registered ("
  + registered.map((r) => r.id).join(", ") + ")");
