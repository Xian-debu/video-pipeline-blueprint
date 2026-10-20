// Run the generators a film depends on, before anything imports their output.
//
//   node scripts/qa/derive_data.mjs --composition=Hawk
//   node scripts/qa/derive_data.mjs --all
//
// A clean clone has no data/hawk/gray.json: the numbers there are derived from the paper, not
// authored, so they are not committed (same policy data/gears has had since P12). Without this
// step every gate that imports them fails with a module-not-found that looks like a code bug.
import { spawnSync } from "node:child_process";
import path from "node:path";

import { FILMS } from "../film_registry.mjs";

const argv = process.argv.slice(2);
const args = Object.fromEntries(
  argv.filter((a) => a.startsWith("--")).map((a) => {
    const eq = a.indexOf("=");
    return eq === -1 ? [a.slice(2), "true"] : [a.slice(2, eq), a.slice(eq + 1)];
  }),
);
const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const PYTHON = process.env.PYTHON ?? "python3";

const selected = args.all
  ? Object.entries(FILMS)
  : [[args.composition ?? "", FILMS[args.composition ?? ""]]];
if (!args.all && !args.composition) {
  console.error("derive: pass --composition=<Id> or --all");
  process.exit(2);
}
if (!args.all && !selected[0][1]) {
  // A design demo has no film behind it and therefore no derived numbers. Not an error: make.mjs
  // calls this for every composition.
  console.log("derive: " + args.composition + " is not a film, nothing to derive");
  process.exit(0);
}

let ran = 0;
for (const [id, film] of selected) {
  if (!film) {
    console.error("derive: unknown film " + id);
    process.exit(2);
  }
  for (const script of film.derive) {
    console.log("derive " + id + ": " + PYTHON + " " + script);
    const res = spawnSync(PYTHON, [script], { cwd: ROOT, encoding: "utf8" });
    const text = (res.stdout ?? "") + (res.stderr ?? "");
    if (text.trim()) process.stdout.write(text.replace(/\s+$/, "") + "\n");
    if (res.status !== 0) {
      console.error("derive: FAIL — " + script + " exited " + res.status);
      process.exit(1);
    }
    ran += 1;
  }
}
console.log("derive: " + ran + " generator(s) OK");
