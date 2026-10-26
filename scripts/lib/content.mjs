// Read the content manifest that scripts/films.mjs sync writes.
//
// The engine does not know any film by name: everything about a film comes from
// .films/index.json, which in turn is generated from video_project/catalog.json and each
// pack's film.json. Getters here never invent a path; a caller that needs a path gets one
// only for a film the manifest actually lists.
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

export function readJson(file) {
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function loadManifest(root = ROOT) {
  const file = path.join(root, ".films", "index.json");
  if (!fs.existsSync(file)) {
    return { schemaVersion: 1, contentRoot: null, contentCommit: null, contentDirty: null, films: [], series: [] };
  }
  return readJson(file);
}

export function films(root = ROOT) {
  return loadManifest(root).films ?? [];
}

export function findFilm(root, needle) {
  if (!needle) return null;
  const wanted = String(needle).toLowerCase();
  return films(root).find((f) => f.id.toLowerCase() === wanted || f.composition.toLowerCase() === wanted) ?? null;
}

export function filmScriptRel(film) {
  return "src/" + film.id + "/script.ts";
}

export function filmScriptAbs(film) {
  return path.join(ROOT, filmScriptRel(film));
}

export function filmDataRel(film) {
  return film.dataDir ?? "data/" + film.id;
}

export function filmDataAbs(film) {
  return path.join(ROOT, filmDataRel(film));
}

export function filmPackAbs(film, rel) {
  return path.join(film.contentRoot, film.packRel, rel);
}

export function filmDeliveryAbs(film) {
  return path.join(film.contentRoot, film.packRel, film.delivery ?? "delivery");
}

export function contentGit(film, args) {
  if (!film?.contentRoot) return null;
  const r = spawnSync("git", ["-C", film.contentRoot, ...args], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

export function contentRevision(film) {
  return {
    root: film?.contentRoot ?? null,
    commit: film ? contentGit(film, ["rev-parse", "HEAD"]) : null,
    dirty: film ? (contentGit(film, ["status", "--porcelain"]) ?? "").split("\n").filter(Boolean).length : null,
  };
}
