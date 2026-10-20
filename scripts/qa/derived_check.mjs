// Derived numbers must not be committed. data/gears has followed this since P12 (params.json and
// voice.json are the sources; everything else is written by the generator). The Hawk film shipped
// its gray.json and wave.json in git, which makes a review of the diff look like a review of
// authored data — and lets the generator and the committed copy drift apart silently.
//
//   node scripts/qa/derived_check.mjs
//
// Reads the rule from scripts/film_registry.mjs (per film), asks git what is actually tracked,
// and fails naming the file and the generator that owns it. "git answers" is the point: a .gitignore
// line that is one character wrong looks identical to a correct one until you ask (K28).
import { spawnSync } from "node:child_process";
import path from "node:path";

import { FILMS } from "../film_registry.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const res = spawnSync("git", ["ls-files", "data/"], { cwd: ROOT, encoding: "utf8" });
if (res.status !== 0) {
  console.log("derived check: SKIPPED — this is not a git checkout, so the derived-data rule was NOT checked here (run it in the clone)");
  process.exit(0);
}
const tracked = res.stdout.split("\n").filter(Boolean);

const matches = (pattern, file) => {
  if (pattern.endsWith("/*.json")) {
    return file.startsWith(pattern.slice(0, -"*.json".length)) && file.endsWith(".json");
  }
  return file === pattern;
};

const violations = [];
for (const [id, film] of Object.entries(FILMS)) {
  for (const file of tracked) {
    const positive = film.derived.filter((p) => !p.startsWith("!")).some((p) => matches(p, file));
    if (!positive) continue;
    const excepted = film.derived.filter((p) => p.startsWith("!")).some((p) => matches(p.slice(1), file));
    if (excepted) continue;
    violations.push({ id, file, derive: film.derive.join(", ") || "(no generator listed)" });
  }
}

if (violations.length) {
  console.error("FAIL derived data is tracked — only its sources belong in git");
  for (const v of violations) console.error("  " + v.file + " (" + v.id + ", written by " + v.derive + ")");
  console.error("  fix: git rm --cached <file> and add it to .gitignore");
  process.exit(1);
}
console.log("derived check: " + tracked.length + " tracked data files, none of them derived");
