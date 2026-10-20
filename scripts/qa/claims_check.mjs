// Every number on screen must have a quote in the paper behind it.
//
//   node scripts/qa/claims_check.mjs
//
// data/hawk/claims.json is the ledger: one row per number the film shows or says, each with the
// verbatim sentence from the paper that it comes from. This gate proves the cheap half of that
// promise mechanically:
//
//   1. the quote really is in data/hawk/paper.txt (whitespace-normalised), so a made-up citation
//      or a paraphrase passed off as a quote fails here rather than in a viewer's reply;
//   2. the value is really in one of the committed ledgers (eval/gray/wave), so the film and the
//      ledger cannot drift apart;
//   3. the scene it is attributed to exists in src/hawk/script.ts.
//
// What it CANNOT do: it cannot tell that 71.5× is the wrong direction, or that 2304 hours belongs
// to a different dataset. Those are meaning, and they were caught by reading the paper next to the
// screen (K25). A gate that pretends otherwise is worse than no gate.
import fs from "node:fs";
import path from "node:path";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const read = (p) => fs.readFileSync(path.join(ROOT, p), "utf8");
const normalize = (s) => s.replace(/\s+/g, " ").trim();

const ledger = JSON.parse(read("data/hawk/claims.json"));
const paper = normalize(read("data/hawk/paper.txt"));
const ledgers = ["data/hawk/eval.json", "data/hawk/gray.json", "data/hawk/wave.json"].map((p) => normalize(read(p)));
const script = read("src/hawk/script.ts");
const sceneIds = new Set([...script.matchAll(/id:\s*"([a-z]+)"/g)].map((m) => m[1]));

const problems = [];
const seen = new Set();
const exceptions = [];
for (const c of ledger.claims) {
  const tag = c.id ?? "(no id)";
  for (const f of ["id", "scene", "onScreen", "value", "quote", "where"]) {
    if (!c[f]) problems.push(tag + ": missing " + f);
  }
  if (seen.has(c.id)) problems.push(tag + ": duplicate id");
  seen.add(c.id);
  if (c.quote && !paper.includes(normalize(c.quote))) problems.push(tag + ": quote is not in paper.txt — " + c.quote.slice(0, 70));
  // A value that no committed ledger carries is allowed only as an explicit, reviewed exception:
  // it is said in the narration or derived in the film, and the row says so. Silence is a failure.
  if (c.value && !ledgers.some((l) => l.includes(String(c.value)))) {
    if ((c.note ?? "").includes("UNSOURCED IN LEDGERS")) exceptions.push(tag);
    else problems.push(tag + ": value " + c.value + " is in none of eval/gray/wave and the row does not say why");
  }
  if (c.scene && !sceneIds.has(c.scene)) problems.push(tag + ": scene \"" + c.scene + "\" is not in src/hawk/script.ts");
}

const byScene = {};
for (const c of ledger.claims) byScene[c.scene] = (byScene[c.scene] ?? 0) + 1;
const missingScenes = [...sceneIds].filter((s) => !byScene[s]);

if (problems.length) {
  console.error("FAIL claims ledger is not self-consistent (" + problems.length + ")");
  for (const p of problems) console.error("  " + p);
  process.exit(1);
}
console.log("claims check: " + ledger.claims.length + " claims quoted from paper.txt ("
  + paper.length + " chars), values present in the ledgers, scenes "
  + Object.keys(byScene).sort().join("/"));
if (missingScenes.length) console.log("  note: no claim rows for scene(s) " + missingScenes.join(", "));
if (exceptions.length) console.log("  note: " + exceptions.length + " value(s) have no ledger row and say so: " + exceptions.join(", "));
