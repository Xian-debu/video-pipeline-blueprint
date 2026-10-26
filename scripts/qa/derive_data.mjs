// Run the generators a film depends on, before anything imports their output.
//
//   node scripts/qa/derive_data.mjs --film=hawk
//   node scripts/qa/derive_data.mjs --all
//
// A clean clone has no data/hawk/gray.json: the numbers there are derived from the paper, not
// authored, so they are not committed. Without this step every gate that imports them fails with
// a module-not-found that looks like a code bug. Generators run with the content pack as cwd, so
// their own "ROOT" is the pack and they write data/<film>/ where the mount expects it.
import { spawnSync } from "node:child_process";
import path from "node:path";

import { ROOT, loadManifest, findFilm } from "../lib/content.mjs";

const argv = process.argv.slice(2);
const args = Object.fromEntries(
  argv.filter((a) => a.startsWith("--")).map((a) => {
    const eq = a.indexOf("=");
    return eq === -1 ? [a.slice(2), "true"] : [a.slice(2, eq), a.slice(eq + 1)];
  }),
);
const film = args.film ? findFilm(ROOT, args.film) : null;
if (args.film && !film) {
  console.error("derive: unknown film " + args.film + " (not in .films/index.json)");
  process.exit(2);
}
if (!args.all && !args.film) {
  console.error("derive: pass --film=<id> or --all");
  process.exit(2);
}
if (!args.all && !film) {
  console.log("derive: " + args.film + " is not a film, nothing to derive");
  process.exit(0);
}

const selected = args.all ? loadManifest(ROOT).films : [film];
let ran = 0;
for (const f of selected) {
  for (const step of f.derive ?? []) {
    const command = typeof step === "string" ? step : step.command;
    if (!command) {
      console.error("derive [" + f.id + "]: entry has no command");
      process.exit(2);
    }
    console.log("derive " + f.id + ": " + command);
    const res = spawnSync("bash", ["-c", command], {
      cwd: path.join(f.contentRoot, f.packRel), encoding: "utf8", env: { ...process.env },
    });
    const text = (res.stdout ?? "") + (res.stderr ?? "");
    if (text.trim()) process.stdout.write(text.replace(/\s+$/, "") + "\n");
    if (res.status !== 0) {
      console.error("derive [" + f.id + "]: FAIL — " + command + " exited " + res.status);
      process.exit(1);
    }
    ran += 1;
  }
}
console.log("derive: " + ran + " generator(s) OK; run `node scripts/films.mjs sync` to remount");
