// The engine's docs are not gated by anything, so they drift — and a README that names a film
// that no longer exists in this repo is worse than no README, because it is trusted. This gate
// checks only the anchors a cheap grep can settle: the content-repo contract exists, the verify
// step count matches, and every doc is reachable. Prose and measured numbers still need a human;
// docs/verify-report.md is where they are dated.
//
//   node scripts/qa/docs_check.mjs
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const problems = [];
const readme = read("README.md");

// 1. the engine/content contract must be stated where a new operator looks first
for (const needle of ["scripts/films.mjs", "video_project"]) {
  if (!readme.includes(needle)) problems.push("README: does not mention " + needle + " (engine/content boundary)");
}

// 2. the verify step count, quoted in README §8
const steps = [...read("scripts/verify.sh").matchAll(/^\s*step "/gm)].length;
if (!readme.includes("That is " + steps + " steps")) {
  problems.push('README: §8 does not say "That is ' + steps + ' steps" (verify.sh has ' + steps + ")");
}

// 3. the known-issues index must reach the newest entry, without gaps
const ks = [...read("docs/known-issues.md").matchAll(/^## K(\d+)/gm)].map((m) => Number(m[1]));
const newest = Math.max(...ks);
if (!readme.includes("K1–K" + newest)) problems.push("README: known-issues index does not reach K" + newest);
if (newest !== ks.length) problems.push("known-issues.md: K numbering has gaps (" + ks.length + " entries, newest K" + newest + ")");

// 4. every docs/*.md is reachable from README (an orphan doc is a doc nobody updates)
const docs = fs.readdirSync(path.join(ROOT, "docs")).filter((f) => f.endsWith(".md"));
for (const f of docs) {
  if (!readme.includes("docs/" + f)) problems.push("README: docs/" + f + " is never linked");
}

if (problems.length) {
  console.error("FAIL docs disagree with the tree (" + problems.length + ")");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("docs check: " + steps + " verify steps, K1–K" + newest + ", " + docs.length + " docs linked, content contract stated");
