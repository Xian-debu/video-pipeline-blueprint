#!/usr/bin/env node
// scripts/films.mjs — the only bridge between this engine and a content repo.
//
// The engine owns craft: design system, storyboard runtime, QA harness, audio mixing,
// rendering and publishing. The content repo (video_project) owns films: sources, data,
// assets, build scripts, docs and delivery.
//
// sync   read <content>/catalog.json, copy each pack into git-ignored mount points,
//        write .films/index.json and src/films.generated.tsx.
// check  verify mounts and registry match the manifest (byte hashes), optionally strict.
// status print one line per film.
// clean  remove every mount this tool created, empty the registry, drop .films/.
//
// Node 22 stdlib only. No dependencies, no network.

import {
  existsSync, readFileSync, writeFileSync, mkdirSync, rmSync, cpSync, readdirSync, statSync,
} from "node:fs";
import { createHash } from "node:crypto";
import { dirname, join, resolve, relative, basename, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const MANIFEST_DIR = join(ROOT, ".films");
const MANIFEST = join(MANIFEST_DIR, "index.json");
const REGISTRY = join(ROOT, "src", "films.generated.tsx");
const EXCLUDE = join(ROOT, ".git", "info", "exclude");
const BLOCK_START = "# >>> films.mjs mounts (managed; do not edit) >>>";
const BLOCK_END = "# <<< films.mjs mounts <<<";

const DEMO_COMPOSITIONS = new Set([
  "Storyboard", "Showreel", "Transitions", "Typesetting", "ThreeCube", "ThreeStage",
  "PlateStage", "PropStage", "Presets", "ManimOverlay", "LintFixtures",
]);

function die(msg, code = 2) {
  console.error("films: " + msg);
  process.exit(code);
}
function arg(name, fallback = null) {
  const i = process.argv.indexOf("--" + name);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : fallback;
}
function flag(name) { return process.argv.includes("--" + name); }
function readJson(file) { return JSON.parse(readFileSync(file, "utf8")); }
function writeJson(file, value) { mkdirSync(dirname(file), { recursive: true }); writeFileSync(file, JSON.stringify(value, null, 2) + "\n"); }
function isDir(p) { try { return statSync(p).isDirectory(); } catch { return false; } }
function isFile(p) { try { return statSync(p).isFile(); } catch { return false; } }
function posix(p) { return p.split(sep).join("/"); }

function git(cwd, args) {
  const r = spawnSync("git", ["-C", cwd, ...args], { encoding: "utf8" });
  return r.status === 0 ? r.stdout.trim() : null;
}

function findContentRoot() {
  const explicit = arg("content") || process.env.VIDEO_PROJECT || process.env.VIDEO_CONTENT_ROOT;
  if (explicit) return resolve(ROOT, explicit);
  const cfg = join(ROOT, ".video-project.json");
  if (isFile(cfg)) {
    try {
      const value = readJson(cfg).contentRoot;
      if (value) return resolve(ROOT, value);
    } catch { /* fall through */ }
  }
  for (const candidate of ["../video_project", "../../video_project"]) {
    const p = resolve(ROOT, candidate);
    if (isFile(join(p, "catalog.json"))) return p;
  }
  return null;
}

function fileList(dir) {
  const out = [];
  if (!isDir(dir)) return out;
  const walk = (d) => {
    const entries = readdirSync(d, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name));
    for (const e of entries) {
      if (e.name === ".git" || e.name === "__pycache__" || e.name === "node_modules" || e.name === ".DS_Store") continue;
      const p = join(d, e.name);
      if (e.isDirectory()) walk(p);
      else if (e.isFile()) out.push(p);
    }
  };
  walk(dir);
  return out;
}

function treeHash(dir) {
  const h = createHash("sha256");
  const files = fileList(dir);
  for (const f of files) {
    h.update(posix(relative(dir, f)));
    h.update("\0");
    h.update(readFileSync(f));
    h.update("\0");
  }
  return { hash: h.digest("hex"), files: files.length };
}

function hydrate(entry) {
  // entries carry pack-relative source paths; resolve against the current content root
  const source = join(entry.contentRoot, entry.packRel, entry.from);
  const target = join(ROOT, entry.to);
  return { ...entry, source, target };
}

function mount(entry, { force = false } = {}) {
  const m = hydrate(entry);
  if (!isDir(m.source)) die(`${m.id}: missing mount source ${posix(relative(m.contentRoot, m.source))}`);
  if (existsSync(m.target) && !force) {
    die(`${m.to} already exists and is not recorded in .films/index.json; remove it, or pass --force`, 3);
  }
  rmSync(m.target, { recursive: true, force: true });
  mkdirSync(dirname(m.target), { recursive: true });
  cpSync(m.source, m.target, { recursive: true });
  const { hash, files } = treeHash(m.target);
  return { ...m, hash, files, source: undefined, target: undefined };
}

function loadManifest() {
  return isFile(MANIFEST) ? readJson(MANIFEST) : null;
}

function removeMounts(manifest) {
  for (const entry of manifest?.films ?? []) {
    for (const m of entry.mounts ?? []) rmSync(join(ROOT, m.to), { recursive: true, force: true });
  }
  for (const s of manifest?.series ?? []) {
    for (const m of s.mounts ?? []) rmSync(join(ROOT, m.to), { recursive: true, force: true });
  }
}

function updateExclude(paths) {
  if (!isFile(EXCLUDE)) return;
  const current = readFileSync(EXCLUDE, "utf8");
  const start = current.indexOf(BLOCK_START);
  const end = current.indexOf(BLOCK_END);
  let outside = current;
  if (start >= 0 && end >= 0) outside = (current.slice(0, start) + current.slice(end + BLOCK_END.length)).trimEnd();
  const block = paths.length
    ? `\n${BLOCK_START}\n# generated by scripts/films.mjs sync — never commit\n` +
      paths.map((p) => "/" + posix(p)).join("\n") + `\n${BLOCK_END}\n`
    : "";
  writeFileSync(EXCLUDE, outside.trimEnd() + "\n" + block);
}

function readCatalog(contentRoot) {
  const catalog = readJson(join(contentRoot, "catalog.json"));
  if (catalog.schemaVersion !== 1) die("catalog.json: schemaVersion must be 1");
  const films = [];
  const series = [];
  const ids = new Map();
  const comps = new Map();
  const prefixes = new Map();

  const add = (film, packRel, kind, seriesRef, dirName) => {
    for (const [value, map, label] of [
      [film.id, ids, "id"], [film.composition, comps, "composition"], [film.prefix, prefixes, "prefix"],
    ]) {
      if (typeof value !== "string" || !value) die(`${packRel}/film.json: missing ${label}`);
      if (map.has(value)) die(`${packRel}: duplicate ${label} "${value}" (also ${map.get(value)})`);
      map.set(value, packRel);
    }
    if (DEMO_COMPOSITIONS.has(film.composition)) die(`${packRel}: composition "${film.composition}" collides with an engine demo`);
    for (const k of ["component", "total", "fps"]) {
      if (typeof film.exports?.[k] !== "string") die(`${packRel}: exports.${k} is required`);
    }
    for (const k of ["width", "height", "fps"]) {
      if (!Number.isInteger(film[k]) || film[k] <= 0) die(`${packRel}: ${k} must be a positive integer`);
    }
    if (!film.entry || !/^src\/.+\.tsx$/.test(film.entry)) die(`${packRel}: entry must be src/*.tsx`);
    const paths = film.paths;
    if (!paths || paths.src !== "src" || paths.data !== "data" || paths.public !== "assets/public") {
      die(`${packRel}: paths must be {src:"src",data:"data",public:"assets/public"}`);
    }
    films.push({ packRel, packAbs: join(contentRoot, packRel), film, kind, seriesRef, dirName });
  };

  for (const id of catalog.singles ?? []) {
    const packRel = `singles/${id}`;
    const fp = join(contentRoot, packRel, "film.json");
    if (!isFile(fp)) die(`${packRel}/film.json is missing`);
    const film = readJson(fp);
    if (film.id !== id) die(`${packRel}: id "${film.id}" does not match folder`);
    if (film.kind !== "single") die(`${packRel}: kind must be "single"`);
    add(film, packRel, "single", null, null);
  }
  for (const sid of catalog.series ?? []) {
    const sRel = `series/${sid}`;
    const sp = join(contentRoot, sRel, "series.json");
    if (!isFile(sp)) die(`${sRel}/series.json is missing`);
    const sj = readJson(sp);
    if (!Array.isArray(sj.episodes)) die(`${sRel}/series.json: episodes must be an array`);
    for (const d of ["src", "data", "public"]) {
      if (!isDir(join(contentRoot, sRel, "shared", d))) die(`${sRel}: shared/${d} is missing`);
    }
    const eps = [];
    sj.episodes.forEach((dirName, i) => {
      const packRel = `${sRel}/episodes/${dirName}`;
      const fp = join(contentRoot, packRel, "film.json");
      if (!isFile(fp)) die(`${packRel}/film.json is missing`);
      const film = readJson(fp);
      if (film.kind !== "series-episode") die(`${packRel}: kind must be "series-episode"`);
      if (film.series?.id !== sid) die(`${packRel}: series.id must be "${sid}"`);
      if (film.series?.order !== i + 1) die(`${packRel}: series.order must be ${i + 1}`);
      add(film, packRel, "series-episode", { id: sid, json: sj, rel: sRel }, dirName);
      eps.push({ packRel, film });
    });
    series.push({ id: sid, rel: sRel, json: sj, episodes: eps });
  }
  return { catalog, films, series };
}

function makeEntries(contentRoot, parsed) {
  const entries = [];
  for (const f of parsed.films) {
    const mounts = [
      { id: f.film.id, from: f.film.paths.src, to: `src/${f.film.id}`, kind: "src" },
      { id: f.film.id, from: f.film.paths.data, to: `data/${f.film.id}`, kind: "data" },
    ];
    if (isDir(join(f.packAbs, f.film.paths.public))) {
      mounts.push({ id: f.film.id, from: f.film.paths.public, to: `public/${f.film.id}`, kind: "public" });
    }
    const entryModule = "./" + posix(relative(join(ROOT, "src"), join(ROOT, "src", f.film.id, basename(f.film.entry))).replace(/\.tsx$/, ""));
    entries.push({
      id: f.film.id,
      kind: f.kind,
      series: f.seriesRef ? { id: f.seriesRef.id, order: f.film.series.order, dir: f.dirName } : null,
      title: f.film.title,
      packRel: f.packRel,
      composition: f.film.composition,
      entry: f.film.entry,
      entryModule,
      exports: f.film.exports,
      width: f.film.width,
      height: f.film.height,
      fps: f.film.fps,
      prefix: f.film.prefix,
      status: f.film.status,
      assetsStatus: f.film.assetsStatus,
      paper: f.film.paper ?? null,
      claims: f.film.claims ?? null,
      derive: f.film.derive ?? [],
      derived: f.film.derived ?? [],
      narration: f.film.narration ? { path: f.film.narration, abs: join(f.packAbs, f.film.narration) } : null,
      audio: f.film.audio ?? { music: null },
      delivery: f.film.delivery,
      docs: f.film.docs ?? [],
      dataDir: join("data", f.film.id),
      publicDir: join("public", f.film.id),
      contentRoot,
      mounts: mounts.map((m) => ({ ...m, contentRoot, packRel: f.packRel })),
    });
  }
  const series = [];
  for (const s of parsed.series) {
    const mounts = [
      { id: s.id, from: "shared/src", to: `src/series/${s.id}`, kind: "series-src" },
      { id: s.id, from: "shared/data", to: `data/series/${s.id}`, kind: "series-data" },
      { id: s.id, from: "shared/public", to: `public/series/${s.id}`, kind: "series-public" },
    ];
    series.push({ id: s.id, title: s.json.title, packRel: s.rel, contentRoot, mounts: mounts.map((m) => ({ ...m, contentRoot, packRel: s.rel })) });
  }
  return { entries, series };
}

function renderRegistry(entries) {
  const lines = [];
  lines.push("// GENERATED by scripts/films.mjs — do not edit, do not commit.");
  lines.push("// Source of truth: the content repo catalog + each pack's film.json.");
  lines.push('import type { ComponentType } from "react";');
  entries.forEach((e, i) => lines.push(`import * as film${i} from "${e.entryModule}";`));
  lines.push("");
  lines.push("export type ContentFilm = {");
  lines.push("  id: string;");
  lines.push("  kind: \"single\" | \"series-episode\";");
  lines.push("  series: { id: string; order: number; dir: string } | null;");
  lines.push("  title: string;");
  lines.push("  composition: string;");
  lines.push("  component: ComponentType<{ music?: string | null; narration?: string | null }>;");
  lines.push("  total: number;");
  lines.push("  fps: number;");
  lines.push("  width: number;");
  lines.push("  height: number;");
  lines.push("  prefix: string;");
  lines.push("  entry: string;");
  lines.push("  pack: string;");
  lines.push("  narration: string | null;");
  lines.push("};");
  lines.push("");
  lines.push("export const CONTENT_FILMS: ContentFilm[] = [");
  entries.forEach((e, i) => {
    const m = `film${i}`;
    lines.push("  {");
    lines.push(`    id: "${e.id}",`);
    lines.push(`    kind: "${e.kind}",`);
    lines.push(e.series ? `    series: { id: "${e.series.id}", order: ${e.series.order}, dir: "${e.series.dir}" },` : "    series: null,");
    lines.push(`    title: ${JSON.stringify(e.title)},`);
    lines.push(`    composition: "${e.composition}",`);
    lines.push(`    component: (${m} as unknown as { ${e.exports.component}: ContentFilm["component"] })[${JSON.stringify(e.exports.component)}],`);
    lines.push(`    total: (${m} as unknown as { ${e.exports.total}: number })[${JSON.stringify(e.exports.total)}],`);
    lines.push(`    fps: (${m} as unknown as { ${e.exports.fps}: number })[${JSON.stringify(e.exports.fps)}],`);
    lines.push(`    width: ${e.width}, height: ${e.height},`);
    lines.push(`    prefix: "${e.prefix}",`);
    lines.push(`    entry: ${JSON.stringify(e.entry)},`);
    lines.push(`    pack: ${JSON.stringify(e.packRel)},`);
    lines.push(`    narration: ${e.narration ? JSON.stringify(e.narration.path) : "null"},`);
    lines.push("  },");
  });
  lines.push("];");
  lines.push("");
  return lines.join("\n");
}

function sync() {
  const contentRoot = findContentRoot();
  const allowEmpty = flag("allow-empty");
  const force = flag("force");
  if (!contentRoot) {
    if (!allowEmpty) die("no content repo found (set VIDEO_PROJECT or create .video-project.json)");
    const previous = loadManifest();
    if (previous) removeMounts(previous);
    writeJson(MANIFEST, {
      schemaVersion: 1, generatedBy: "scripts/films.mjs", contentRoot: null, contentCommit: null,
      contentDirty: null, syncedAt: new Date().toISOString(), films: [], series: [],
    });
    writeFileSync(REGISTRY, renderRegistry([]));
    updateExclude([]);
    console.log("films: synced 0 films (engine-only mode)");
    return;
  }
  if (!isFile(join(contentRoot, "catalog.json"))) die(`${contentRoot} is not a content repo (catalog.json missing)`);
  const parsed = readCatalog(contentRoot);
  const { entries: specs, series: seriesSpecs } = makeEntries(contentRoot, parsed);

  const previous = loadManifest();
  removeMounts(previous);

  // series shared mounts first, then film mounts
  const series = seriesSpecs.map((s) => ({
    id: s.id, title: s.title, packRel: s.packRel,
    mounts: s.mounts.map((m) => mount(m, { force })),
  }));
  const films = specs.map((spec) => {
    const mounts = spec.mounts.map((m) => mount(m, { force }));
    return { ...spec, mounts };
  });

  const contentCommit = git(contentRoot, ["rev-parse", "HEAD"]);
  const dirty = git(contentRoot, ["status", "--porcelain"]);
  const manifest = {
    schemaVersion: 1,
    generatedBy: "scripts/films.mjs",
    contentRoot,
    contentCommit,
    contentDirty: dirty ? dirty.split("\n").filter(Boolean).length : 0,
    syncedAt: new Date().toISOString(),
    films,
    series,
  };
  writeJson(MANIFEST, manifest);
  writeFileSync(REGISTRY, renderRegistry(films));
  updateExclude([...series.flatMap((s) => s.mounts.map((m) => m.to)), ...films.flatMap((f) => f.mounts.map((m) => m.to))]);
  console.log(`films: synced ${films.length} film(s), ${series.length} series from ${contentRoot}` +
    (manifest.contentDirty ? ` (content dirty: ${manifest.contentDirty} path(s))` : ""));
}

function check() {
  const strict = flag("strict");
  const manifest = loadManifest();
  if (!manifest) die("no .films/index.json; run: node scripts/films.mjs sync", 3);
  const errors = [];
  for (const f of manifest.films) {
    for (const m of f.mounts) {
      const target = join(ROOT, m.to);
      if (!isDir(target)) { errors.push(`${f.id}: mount missing: ${m.to}`); continue; }
      const { hash, files } = treeHash(target);
      if (hash !== m.hash || files !== m.files) errors.push(`${f.id}: mount drifted: ${m.to} (expected ${m.files} files)`);
    }
    if (!f.entryModule.startsWith("./")) errors.push(`${f.id}: bad entryModule ${f.entryModule}`);
  }
  for (const s of manifest.series) {
    for (const m of s.mounts) {
      const target = join(ROOT, m.to);
      if (!isDir(target)) errors.push(`series ${s.id}: mount missing: ${m.to}`);
      else if (treeHash(target).hash !== m.hash) errors.push(`series ${s.id}: mount drifted: ${m.to}`);
    }
  }
  const registry = isFile(REGISTRY) ? readFileSync(REGISTRY, "utf8") : "";
  if (registry !== renderRegistry(manifest.films)) errors.push("src/films.generated.tsx is stale; run sync");
  if (strict && manifest.contentRoot) {
    if (!isDir(manifest.contentRoot)) errors.push(`content root is missing: ${manifest.contentRoot}`);
    else {
      const commit = git(manifest.contentRoot, ["rev-parse", "HEAD"]);
      if (commit !== manifest.contentCommit) errors.push(`content HEAD moved (${manifest.contentCommit} -> ${commit}); run sync`);
      if (git(manifest.contentRoot, ["status", "--porcelain"])) errors.push("content repo is dirty; commit or sync");
    }
  }
  if (errors.length) {
    console.error("films check failed:\n" + errors.map((e) => "  x " + e).join("\n"));
    process.exit(1);
  }
  console.log(`films: ok — ${manifest.films.length} film(s), ${manifest.series.length} series; registry current` +
    (strict ? "; content clean" : ""));
}

function status() {
  const manifest = loadManifest();
  if (!manifest) die("no .films/index.json; run: node scripts/films.mjs sync", 3);
  console.log(["id", "comp", "frames", "fps", "status", "derive", "narration", "pack"].join("\t"));
  for (const f of manifest.films) {
    console.log([
      f.id, f.composition, f.total ?? "?", f.fps, f.status, (f.derive ?? []).length,
      f.narration ? "yes" : "no", f.packRel,
    ].join("\t"));
  }
  console.log(`content: ${manifest.contentRoot ?? "(none)"} @ ${(manifest.contentCommit ?? "-").slice(0, 8)}` +
    (manifest.contentDirty ? ` dirty=${manifest.contentDirty}` : ""));
}

function clean() {
  const manifest = loadManifest();
  if (manifest) removeMounts(manifest);
  rmSync(MANIFEST_DIR, { recursive: true, force: true });
  writeFileSync(REGISTRY, renderRegistry([]));
  updateExclude([]);
  console.log("films: cleaned all managed mounts");
}

const command = process.argv[2] && !process.argv[2].startsWith("--") ? process.argv[2] : "sync";
switch (command) {
  case "sync": sync(); break;
  case "check": check(); break;
  case "status": status(); break;
  case "clean": clean(); break;
  default: die(`unknown command "${command}" (sync|check|status|clean)`);
}
