// One number that says which tree a run is about to render.
//
// The failure this prevents: the working copy in another machine/distro is a stale rsync, so a
// 20-minute render measures code that no longer exists on the author's disk. The copy cannot see
// the original, so the original's hash travels with the command and make refuses to start when the
// two disagree (--expect-tree).
//
//   node scripts/qa/tree_hash.mjs                     -> "TREE <16 hex>"
//   node scripts/qa/tree_hash.mjs --json              -> {"tree":..., "parts":{...}, "files":N}
//
// Scope: everything that can change rendered bytes or measured numbers — src/, data/, scripts/, and
// the render configuration at the root. Deliberately excluded: docs/, out/, node_modules/, .git/,
// public/ media that is not committed, and this file's own mtime (content only, so a fresh checkout
// has the same hash as the tree it was copied from).
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { loadManifest } from "../lib/content.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const DIRS = ["src", "data", "scripts"];
const FILES = ["package.json", "package-lock.json", "tsconfig.json", "remotion.config.ts"];
const IGNORE = new Set(["node_modules", ".git", "out", ".remotion", ".tools"]);

function walk(dir, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    if (IGNORE.has(e.name)) continue;
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out);
    else out.push(p);
  }
  return out;
}

const sha = (files) => {
  const h = crypto.createHash("sha256");
  for (const f of [...files].sort()) {
    h.update(path.relative(ROOT, f).split(path.sep).join("/"));
    h.update("\0");
    h.update(fs.readFileSync(f));
    h.update("\0");
  }
  return h;
};

export function treeHashName(root = ROOT) {
  const parts = {};
  let count = 0;
  for (const d of DIRS) {
    const files = walk(path.join(root, d));
    parts[d] = sha(files).digest("hex").slice(0, 16);
    count += files.length;
  }
  const rootFiles = FILES.map((f) => path.join(root, f)).filter((f) => fs.existsSync(f));
  parts.root = sha(rootFiles).digest("hex").slice(0, 16);
  count += rootFiles.length;
  // The mounted sources have the content commit baked into the manifest. A copy synced from an
  // older content commit has different bytes in src/ data/ anyway; this makes the provenance
  // explicit in the one number a render is allowed to trust.
  const manifest = loadManifest(root);
  parts.content = crypto.createHash("sha256")
    .update(manifest.contentRoot ? (manifest.contentCommit ?? "none") + (manifest.contentDirty ? ":dirty" : "") : "none")
    .digest("hex").slice(0, 16);
  const tree = crypto.createHash("sha256")
    .update(["src", "data", "scripts", "root", "content"].map((k) => parts[k]).join("\0"))
    .digest("hex").slice(0, 16);
  return { tree, parts, files: count };
}

if (import.meta.url === "file://" + process.argv[1]) {
  const r = treeHashName();
  if (process.argv.includes("--json")) console.log(JSON.stringify(r));
  else console.log("TREE " + r.tree);
}
