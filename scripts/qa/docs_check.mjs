// The docs are not gated by anything, so they drift — and a README that names 11 compositions in a
// tree with 15 is worse than no README, because it is trusted. This gate only checks the anchors a
// cheap grep can settle (counts and step names); prose, dates and measured numbers still need a
// human, and `docs/verify-report.md` is where they are dated.
//
//   node scripts/qa/docs_check.mjs
import fs from "node:fs";
import path from "node:path";
import { FILMS } from "../film_registry.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const problems = [];

// 1. composition count: one number, said three times, all of them in README
const root = read("src/Root.tsx");
const compositions = [...root.matchAll(/id="([A-Za-z]+)"/g)].map((m) => m[1]);
const readme = read("README.md");
if (!readme.includes("registered compositions (" + compositions.length + ")")) {
  problems.push("README: composition count is not (" + compositions.length + ")");
}
if (!readme.includes("Compositions (" + compositions.length + ")")) {
  problems.push("README: the compositions paragraph does not say " + compositions.length);
}

// 2. every film appears in the README's composition paragraph
for (const id of Object.keys(FILMS)) {
  if (!new RegExp("\`" + id + "\`").test(readme)) problems.push("README: film " + id + " is never named");
}

// 3. the verify step count, quoted in README §8
const steps = [...read("scripts/verify.sh").matchAll(/^\s*step "/gm)].length;
if (!readme.includes("That is " + steps + " steps")) {
  problems.push("README: §8 does not say \"That is " + steps + " steps\" (verify.sh has " + steps + ")");
}

// 4. the known-issues index must reach the newest entry
const ks = [...read("docs/known-issues.md").matchAll(/^## K(\d+)/gm)].map((m) => Number(m[1]));
const newest = Math.max(...ks);
if (!readme.includes("K1–K" + newest)) problems.push("README: known-issues index does not reach K" + newest);
if (newest !== ks.length) problems.push("known-issues.md: K numbering has gaps (" + ks.length + " entries, newest K" + newest + ")");

// 5. every docs/*.md is reachable from README (an orphan doc is a doc nobody updates)
const docs = fs.readdirSync(path.join(ROOT, "docs")).filter((f) => f.endsWith(".md"));
for (const f of docs) {
  // the tree in §4 lists bare names; a link elsewhere in the README also counts
  if (!readme.includes("docs/" + f) && !readme.includes("](" + "docs/" + f)) {
    problems.push("README: docs/" + f + " is never linked");
  }
}

if (problems.length) {
  console.error("FAIL docs disagree with the tree (" + problems.length + ")");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("docs check: " + compositions.length + " compositions, " + Object.keys(FILMS).length
  + " films, " + steps + " verify steps, K1–K" + newest + ", " + docs.length + " docs linked");
