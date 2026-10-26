// Derived numbers must not be committed.
//
//   node scripts/qa/derived_check.mjs
//
// Reads each film's rule from the manifest, asks the content repo's git what is actually tracked,
// and fails naming the file and the generator that owns it. "git answers" is the point: a
// .gitignore line that is one character wrong looks identical to a correct one until you ask (K28).
import { spawnSync } from "node:child_process";

import { ROOT, loadManifest } from "../lib/content.mjs";

const manifest = loadManifest(ROOT);
if (!manifest.contentRoot) {
  console.log("derived check: engine-only mode (no content repo)");
  process.exit(0);
}

const res = spawnSync("git", ["-C", manifest.contentRoot, "ls-files"], { encoding: "utf8" });
if (res.status !== 0) {
  console.log("derived check: SKIPPED — content repo is not a git checkout");
  process.exit(0);
}
const tracked = res.stdout.split("\n").filter(Boolean);

const matches = (pattern, file) => {
  if (pattern.endsWith("/*.json")) {
    return file.startsWith(pattern.slice(0, -"*.json".length)) && file.endsWith(".json");
  }
  const re = new RegExp("^" + pattern
    .replace(/[.+^$(){}|\\]/g, "\\$&")
    .replace(/\*\*\//g, "(?:.*/)?")
    .replace(/\*\*/g, ".*")
    .replace(/\*/g, "[^/]*")
    .replace(/\?/g, "[^/]") + "$");
  return re.test(file);
};

const violations = [];
let checked = 0;
for (const film of manifest.films) {
  const prefix = film.packRel + "/";
  for (const file of tracked) {
    if (!file.startsWith(prefix)) continue;
    const rel = file.slice(prefix.length);
    const positive = (film.derived ?? []).filter((p) => !p.startsWith("!")).some((p) => matches(p, rel));
    if (!positive) continue;
    const excepted = (film.derived ?? []).filter((p) => p.startsWith("!")).some((p) => matches(p.slice(1), rel));
    if (excepted) continue;
    const commands = (film.derive ?? []).map((d) => (typeof d === "string" ? d : d.command)).join(", ") || "(no generator listed)";
    violations.push({ id: film.id, file: prefix + rel, derive: commands });
  }
  checked += (film.derived ?? []).length;
}
if (violations.length) {
  console.error("FAIL derived data is tracked — only its sources belong in git");
  for (const v of violations) console.error("  " + v.file + " (" + v.id + ", written by " + v.derive + ")");
  console.error("  fix: git rm --cached <file> and add it to the pack's .gitignore");
  process.exit(1);
}
console.log("derived check: " + manifest.films.length + " film(s), " + checked + " derived pattern(s), none tracked");
