// Every number on screen must have a quote in the paper behind it.
//
//   node scripts/qa/claims_check.mjs --film=hawk
//
// A film's pack owns data/claims.json: one row per number the film shows or says, each with the
// verbatim sentence from the paper that it comes from. This gate proves the cheap half of that
// promise mechanically:
//
//   1. the quote really is in the pack's paper.txt (whitespace-normalised), so a made-up citation
//      or a paraphrase passed off as a quote fails here rather than in a viewer's reply;
//   2. the value is really in one of the committed ledgers, so the film and the ledger cannot drift;
//   3. the scene it is attributed to exists in the mounted script.
//
// What it CANNOT do: it cannot tell that 71.5x is the wrong direction. Those are meaning, and were
// caught by reading the paper next to the screen (K25). A gate that pretends otherwise is worse
// than no gate.
import fs from "node:fs";
import path from "node:path";

import { ROOT, findFilm, filmScriptAbs, filmDataAbs } from "../lib/content.mjs";

const argv = process.argv.slice(2);
const arg = (k) => {
  const p = argv.find((a) => a.startsWith("--" + k + "="));
  return p ? p.slice(k.length + 3) : null;
};
const film = findFilm(ROOT, arg("film") ?? "hawk");
if (!film) {
  console.error("claims check: unknown film " + (arg("film") ?? "hawk"));
  process.exit(2);
}
if (!film.claims?.ledger || !film.claims?.paper) {
  console.error("claims check [" + film.id + "]: film.json declares no claims ledger/paper");
  process.exit(2);
}
const pack = path.join(film.contentRoot, film.packRel);
const read = (p) => fs.readFileSync(path.isAbsolute(p) ? p : path.join(pack, p), "utf8");
const normalize = (s) => s.replace(/\s+/g, " ").trim();

const ledger = JSON.parse(read(film.claims.ledger));
const paper = normalize(read(film.claims.paper));
const EXCLUDE = new Set(["claims.json", "clips.json", "crops.json", "voice.json", "lines.json"]);
const dataDir = filmDataAbs(film);
const ledgerFiles = fs.readdirSync(dataDir)
  .filter((f) => f.endsWith(".json") && !EXCLUDE.has(f))
  .sort()
  .map((f) => path.join(dataDir, f));
const ledgers = ledgerFiles.map((p) => normalize(fs.readFileSync(p, "utf8")));
const script = fs.readFileSync(filmScriptAbs(film), "utf8");
const sceneIds = new Set([...script.matchAll(/id:\s*"([A-Za-z0-9_-]+)"/g)].map((m) => m[1]));

const problems = [];
const seen = new Set();
const exceptions = [];
for (const c of ledger.claims ?? []) {
  const tag = c.id ?? "(no id)";
  for (const f of ["id", "scene", "onScreen", "value", "quote", "where"]) {
    if (!c[f]) problems.push(tag + ": missing " + f);
  }
  if (seen.has(c.id)) problems.push(tag + ": duplicate id");
  seen.add(c.id);
  if (c.quote && !paper.includes(normalize(c.quote))) problems.push(tag + ": quote is not in paper.txt — " + c.quote.slice(0, 70));
  if (c.value && !ledgers.some((l) => l.includes(String(c.value)))) {
    if ((c.note ?? "").includes("UNSOURCED IN LEDGERS")) exceptions.push(tag);
    else problems.push(tag + ": value " + c.value + " is in none of " + ledgerFiles.map((p) => path.basename(p)).join("/") + " and the row does not say why");
  }
  if (c.scene && !sceneIds.has(c.scene)) problems.push(tag + ': scene "' + c.scene + '" is not in ' + path.relative(ROOT, filmScriptAbs(film)));
}

const byScene = {};
for (const c of ledger.claims ?? []) byScene[c.scene] = (byScene[c.scene] ?? 0) + 1;
const missingScenes = [...sceneIds].filter((s) => !byScene[s]);
if (problems.length) {
  console.error("FAIL claims ledger is not self-consistent (" + problems.length + ")");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("claims check [" + film.id + "]: " + (ledger.claims ?? []).length + " claims quoted from paper.txt ("
  + paper.length + " chars), values present in the ledgers, scenes " + Object.keys(byScene).sort().join("/"));
if (missingScenes.length) console.log("  note: no claim rows for scene(s) " + missingScenes.join(", "));
if (exceptions.length) console.log("  note: " + exceptions.length + " value(s) have no ledger row and say so: " + exceptions.join(", "));
