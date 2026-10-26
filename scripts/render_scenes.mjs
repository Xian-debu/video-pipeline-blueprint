// Scene-by-scene picture render, so changing one paragraph costs one scene, not the film.
//
// A 588-second film takes ~18 minutes to render. Almost all script edits touch one scene, and
// only that scene's frames can change: the other scenes are pure functions of inputs that did not
// move. This script hashes each scene's inputs, reuses the segments whose hash still matches, and
// concatenates the rest into a single picture track (`-c copy`, no re-encode).
//
// What a scene's hash covers:
//   src/<film>/**            (except script.ts) — the components that draw it
//   data/<film>/**.json                           — the numbers it quotes
//   src/design/**, src/storyboard/**, data/design.spec.json — the shared visual language
//   this scene's own lines, its index and the scene count
// It deliberately does NOT cover scene timing: if a scene's duration changed, its frame count
// changes, and a segment is only reused when the frame count matches exactly.
//
//   node scripts/render_scenes.mjs --composition=<Composition> --script=src/<film>/script.ts \\
//     --out=out/package/scenes --output=out/package/raw_video.mp4
//   node scripts/render_scenes.mjs ... --only=magic      # smoke test: render one scene, no concat
//   node scripts/render_scenes.mjs ... --force           # ignore the cache
//
// Prints one machine-readable summary line per run (see the end of main()).
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

import { build } from "esbuild";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { findFilm } from "./lib/content.mjs";

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");

const argv = process.argv.slice(2);
const args = {};
for (let i = 0; i < argv.length; i++) {
  const raw = argv[i];
  if (!raw.startsWith("--")) continue;
  const eq = raw.indexOf("=");
  if (eq !== -1) args[raw.slice(2, eq)] = raw.slice(eq + 1);
  else if (i + 1 < argv.length && !argv[i + 1].startsWith("--")) args[raw.slice(2)] = argv[++i];
  else args[raw.slice(2)] = "true";
}

const need = (k) => {
  const v = args[k];
  if (!v || v === "true") throw new Error("render_scenes: --" + k + " needs a value");
  return v;
};

const COMP = need("composition");
const SCRIPT = path.resolve(ROOT, need("script"));
const SEG_DIR = path.resolve(ROOT, args.out ?? "out/scenes");
const OUTPUT = path.resolve(ROOT, args.output ?? path.join(path.dirname(SEG_DIR), "raw_video.mp4"));
const ONLY = (args.only ?? "").split(",").filter(Boolean);
const FORCE = args.force === "true" || args.force === "" || args.force === "1";
const MANIFEST = path.join(SEG_DIR, "manifest.json");

// Same picture the mux expects: no audio in the render, the audio comes from the stems.
const INPUT_PROPS = { music: null, narration: null };

function log(s) {
  process.stdout.write(s + "\n");
}

function hashFiles(files, label) {
  const h = crypto.createHash("sha256");
  for (const f of files) {
    h.update(path.relative(ROOT, f).split(path.sep).join("/"));
    h.update("\0");
    h.update(fs.readFileSync(f));
    h.update("\0");
  }
  return label + ":" + h.digest("hex").slice(0, 16);
}

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

function dirHash(dir, label, exclude = new Set()) {
  const files = walk(path.join(ROOT, dir))
    .filter((f) => !exclude.has(f))
    .sort();
  if (!files.length) return label + ":absent";
  return hashFiles(files, label);
}

// The film's script is the single source of scene definitions and subtitles, so it is imported
// rather than parsed: bundling is the only honest way to read a TypeScript module here.
async function loadScript() {
  const tmp = path.join(os.tmpdir(), "render_scenes_" + process.pid + ".mjs");
  await build({
    entryPoints: [SCRIPT],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile: tmp,
    logLevel: "error",
    external: ["@remotion/*", "remotion"],
  });
  const mod = await import("file://" + tmp + "?t=" + Date.now());
  fs.rmSync(tmp, { force: true });
  const { SCENES, FPS, TOTAL } = mod;
  if (!Array.isArray(SCENES) || !SCENES.length) throw new Error("script exports no SCENES");
  if (!Number.isFinite(FPS) || !Number.isFinite(TOTAL)) throw new Error("script exports no FPS/TOTAL");
  return { SCENES, FPS, TOTAL };
}

function ffmpegConcat(segments, output) {
  const list = path.join(SEG_DIR, "concat.txt");
  fs.writeFileSync(list, segments.map((s) => "file '" + s.replace(/'/g, "'\\''") + "'").join("\n") + "\n");
  fs.mkdirSync(path.dirname(output), { recursive: true });
  fs.rmSync(output, { force: true });
  // Every segment came out of the same encoder with the same settings, so -c copy is lossless and
  // takes a second instead of re-encoding 18 minutes of picture.
  const res = spawnSync("ffmpeg", ["-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", list,
    "-c", "copy", "-movflags", "+faststart", output], { cwd: ROOT, encoding: "utf8" });
  if (res.status !== 0) {
    throw new Error("ffmpeg concat failed: " + ((res.stderr ?? "").trim() || "exit " + res.status));
  }
}

async function main() {
  const { SCENES, FPS, TOTAL } = await loadScript();

  const bounds = SCENES.map((s, i) => (i === 0 ? 0 : Math.round(s.start * FPS)));
  const ranges = SCENES.map((s, i) => {
    const from = bounds[i];
    const to = i + 1 < SCENES.length ? bounds[i + 1] : TOTAL;
    return { from, to, count: to - from };
  });
  const sum = ranges.reduce((a, r) => a + r.count, 0);
  if (sum !== TOTAL) throw new Error("scene boundaries cover " + sum + " frames, script says " + TOTAL);

  const film = findFilm(ROOT, COMP);
  const filmDir = path.dirname(SCRIPT);
  const filmRel = path.relative(ROOT, filmDir).split(path.sep).join("/");
  const filmCode = dirHash(filmRel, "film", new Set([SCRIPT]));
  const dataHash = dirHash(film ? film.dataDir : "data/" + path.basename(filmDir), "data");
  const shared = [
    dirHash("src/design", "design"),
    dirHash("src/storyboard", "storyboard"),
    (() => {
      const spec = path.join(ROOT, "data/design.spec.json");
      return fs.existsSync(spec) ? hashFiles([spec], "spec") : "spec:absent";
    })(),
  ];
  // An episode may import its series' shared components and data; changing either must invalidate
  // every episode segment, not just the one whose own directory changed.
  if (film?.series?.id) {
    shared.push(dirHash("src/series/" + film.series.id, "series-src"));
    shared.push(dirHash("data/series/" + film.series.id, "series-data"));
  }
  const sharedHash = shared.join("|");

  fs.mkdirSync(SEG_DIR, { recursive: true });
  const prev = fs.existsSync(MANIFEST) ? JSON.parse(fs.readFileSync(MANIFEST, "utf8")) : { scenes: {} };
  const manifest = {
    composition: COMP,
    script: path.relative(ROOT, SCRIPT).split(path.sep).join("/"),
    fps: FPS,
    frames: TOTAL,
    filmCode,
    dataHash,
    sharedHash,
    scenes: {},
  };

  const plan = SCENES.map((s, i) => {
    const h = crypto.createHash("sha256")
      .update([filmCode, dataHash, sharedHash, s.id, String(i), String(SCENES.length), s.lines.join("\n")].join("\0"))
      .digest("hex").slice(0, 16);
    const old = prev.scenes?.[s.id];
    const seg = path.join(SEG_DIR, s.id + ".mp4");
    const cacheable = !FORCE && old && old.hash === h && old.count === ranges[i].count && fs.existsSync(seg);
    return { id: s.id, hash: h, seg, range: ranges[i], cacheable };
  });

  const todo = ONLY.length ? plan.filter((p) => ONLY.includes(p.id)) : plan;
  if (ONLY.length && todo.length !== ONLY.length) {
    throw new Error("--only names a scene that does not exist: " + ONLY.filter((id) => !plan.some((p) => p.id === id)).join(","));
  }

  let renderer = null;
  if (todo.some((p) => !p.cacheable)) {
    log("bundling src/index.ts ...");
    const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts") });
    const composition = await selectComposition({ serveUrl, id: COMP, inputProps: INPUT_PROPS });
    if (composition.durationInFrames !== TOTAL) {
      throw new Error("composition " + COMP + " is " + composition.durationInFrames + " frames, " + path.relative(ROOT, SCRIPT) + " says " + TOTAL);
    }
    renderer = { serveUrl, composition };
  }

  let reused = 0;
  for (const p of todo) {
    if (p.cacheable) {
      reused += 1;
      log("reuse  " + p.id + "  frames " + p.range.from + "-" + (p.range.to - 1) + "  " + (p.hash));
      manifest.scenes[p.id] = prev.scenes[p.id];
      continue;
    }
    const started = Date.now();
    log("render " + p.id + "  frames " + p.range.from + "-" + (p.range.to - 1) + "  (" + p.range.count + " frames)");
    await renderMedia({
      composition: renderer.composition,
      serveUrl: renderer.serveUrl,
      codec: "h264",
      outputLocation: p.seg,
      frameRange: [p.range.from, p.range.to - 1],
      inputProps: INPUT_PROPS,
      overwrite: true,
      logLevel: "error",
    });
    const bytes = fs.statSync(p.seg).size;
    manifest.scenes[p.id] = { hash: p.hash, count: p.range.count, bytes, renderedAt: new Date().toISOString() };
    log("done   " + p.id + "  " + (bytes / 1024 / 1024).toFixed(1) + " MB  " + ((Date.now() - started) / 1000).toFixed(1) + " s");
  }

  // Segments for scenes this run did not touch still have to be in the manifest, or the next run
  // would re-render them for no reason.
  for (const p of plan) {
    if (!manifest.scenes[p.id] && prev.scenes?.[p.id]) manifest.scenes[p.id] = prev.scenes[p.id];
  }

  // Only a run that has every segment may produce a picture track.
  const missing = plan.filter((p) => !fs.existsSync(p.seg) || !manifest.scenes[p.id]);
  if (!ONLY.length && missing.length) {
    throw new Error("cannot concatenate: no segment for " + missing.map((p) => p.id).join(", "));
  }
  if (!ONLY.length) ffmpegConcat(plan.map((p) => p.seg), OUTPUT);
  fs.writeFileSync(MANIFEST, JSON.stringify(manifest, null, 2));

  const rendered = todo.length - reused;
  log("RENDER reused=" + reused + " rendered=" + rendered + " scenes=" + plan.length + " frames=" + TOTAL);
  if (!ONLY.length) log("CONCAT " + path.relative(ROOT, OUTPUT));
}

main().catch((err) => {
  log("render_scenes: FAIL — " + err.message);
  process.exit(1);
});
