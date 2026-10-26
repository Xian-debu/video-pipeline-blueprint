// One command, one delivery package.
//
// Stages: content check -> contract -> probe -> score -> score gate -> picture-only render ->
// review stills -> DOM lint -> mix -> mix gate -> mux -> loudnorm -> flicker -> delivery exports ->
// report.json. The score is generated before the picture on purpose: a bed that cannot be heard
// never reaches a render. Each stage is the same command the docs describe; this script exists so
// the order and the gates cannot be skipped by hand, and so every number a release claims is
// written down by the machine that measured it.
//
//   node scripts/make.mjs --film hawk
//   node scripts/make.mjs --composition Storyboard --out out/demo-package
//
// Everything film-specific (script, data, exports, narration, delivery directory) comes from
// .films/index.json, written by scripts/films.mjs from the content repo. A stage that fails stops
// the pipeline and still writes <out>/report.json with what passed and what did not.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

import {
  ROOT, loadManifest, findFilm, filmScriptRel, filmScriptAbs, filmDataRel, filmDeliveryAbs, contentRevision,
} from "./lib/content.mjs";
import { treeHashName } from "./qa/tree_hash.mjs";

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

const manifest = loadManifest();
const requested = args.film ?? args.composition;
const FILM = requested ? findFilm(ROOT, requested) : null;
if (args.film && !FILM) {
  console.error("make: FAIL — no film \"" + args.film + "\" in .films/index.json (run: node scripts/films.mjs sync)");
  process.exit(2);
}
const COMP = FILM ? FILM.composition : (args.composition ?? "Storyboard");
const OUT = args.out
  ? path.resolve(ROOT, args.out)
  : FILM
    ? filmDeliveryAbs(FILM)
    : path.resolve(ROOT, "out/package");
const SCRIPT = FILM ? filmScriptAbs(FILM) : null;
const SCRIPT_REL = FILM ? filmScriptRel(FILM) : null;
const DATA_REL = FILM ? filmDataRel(FILM) : null;
const STILL_FRAMES = (args["still-frames"] ?? "").split(",").filter(Boolean);
const PYTHON = process.env.PYTHON ?? "python3";
const SKIP_STATIC = args["skip-static"] != null && args["skip-static"] !== "false";

if (FILM && !fs.existsSync(SCRIPT)) {
  console.error("make: FAIL — " + SCRIPT_REL + " is in the manifest but not mounted (run sync)");
  process.exit(2);
}

// Narration resolution: an explicit --narration is a promise; a film.json narration is a promise
// too. Silence is only allowed for a film that never declared one.
const NARRATION = args.narration
  ? path.resolve(ROOT, args.narration)
  : FILM?.narration?.abs ?? null;
if (args.narration && !fs.existsSync(NARRATION)) {
  console.error("make: FAIL — --narration " + args.narration + " does not exist");
  process.exit(2);
}
if (!args.narration && FILM?.narration?.abs && !fs.existsSync(NARRATION)) {
  console.error("make: FAIL — " + FILM.packRel + " declares narration " + FILM.narration.path
    + " but the file is missing (commit it, or pass --narration)");
  process.exit(2);
}

// Which tree is this run about to measure? The tree hash includes the content commit, so a copy
// in another distro cannot silently render older film sources.
const TREE = treeHashName(ROOT);
const EXPECT_TREE = args["expect-tree"];
if (EXPECT_TREE && EXPECT_TREE !== "true" && EXPECT_TREE !== TREE.tree) {
  console.error("make: FAIL — this tree is " + TREE.tree + " but the caller expected " + EXPECT_TREE
    + " (stale copy? re-sync src/ data/ scripts/ before rendering)");
  process.exit(2);
}

/**
 * Resolve --cut-frames. "auto" reads the film's own measured layout: data/<film>/lines.json is what
 * dump_script.mjs writes from the script's real TTS durations, so the declared cuts are the frames
 * the renderer actually cuts on. Anything else is passed through as typed.
 */
function resolveCutFrames(raw) {
  if (!raw || raw === "true") return null;
  if (raw !== "auto") return raw;
  if (!FILM) throw new Error("--cut-frames auto needs a film");
  const lines = path.join(ROOT, DATA_REL, "lines.json");
  if (!fs.existsSync(lines)) {
    throw new Error("--cut-frames auto needs " + path.relative(ROOT, lines) + ": run dump_script.mjs first");
  }
  const layout = JSON.parse(fs.readFileSync(lines, "utf8"));
  const frames = layout.scenes.map((s) => Math.round(s.start * layout.fps)).filter((n) => n > 0);
  if (!frames.length) throw new Error("--cut-frames auto: " + path.relative(ROOT, lines) + " has no scenes");
  return frames.join(",");
}

fs.mkdirSync(path.join(OUT, "stills"), { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  composition: COMP,
  film: FILM ? { id: FILM.id, pack: FILM.packRel, series: FILM.series?.id ?? null } : null,
  out: path.relative(ROOT, OUT),
  stages: [],
  numbers: { tree: TREE.tree },
  pass: false,
};

const log = (s) => process.stdout.write(s + "\n");

function writeReport() {
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
}

function run(name, cmd, cmdArgs, opts = {}) {
  log("\n== " + name + "\n$ " + [cmd, ...cmdArgs].join(" "));
  const res = spawnSync(cmd, cmdArgs, {
    cwd: ROOT,
    encoding: "utf8",
    env: { ...process.env, PYTHON },
    maxBuffer: 64 * 1024 * 1024,
  });
  const text = (res.stdout ?? "") + (res.stderr ?? "");
  if (text.trim()) process.stdout.write(text.replace(/\s+$/, "") + "\n");
  const stage = { name, command: [cmd, ...cmdArgs].join(" "), exitCode: res.status, ok: res.status === 0 };
  report.stages.push(stage);
  if (!stage.ok) {
    report.pass = false;
    writeReport();
    throw new Error("stage failed: " + name + " (exit " + res.status + ")");
  }
  return text;
}

// Which inputs produced this delivery. A stale working copy, or a film built from a different
// commit than the one on disk, is otherwise indistinguishable from a clean run.
const fingerprint = (dir) => {
  const root = path.join(ROOT, dir);
  const files = [];
  const walk = (d) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      if (e.name === "node_modules" || e.name === ".git" || e.name === "out") continue;
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else files.push(p);
    }
  };
  if (!fs.existsSync(root)) return null;
  walk(root);
  files.sort();
  const h = crypto.createHash("sha256");
  for (const f of files) {
    h.update(path.relative(root, f).split(path.sep).join("/"));
    h.update("\0");
    h.update(fs.readFileSync(f));
  }
  return { files: files.length, sha256: h.digest("hex").slice(0, 16) };
};

function pick(text, re, label) {
  const m = text.match(re);
  if (!m) throw new Error("could not read " + label + " from the stage output");
  return Number(m[1]);
}

const probeComposition = (id) => {
  const t = run("probe composition", "npx", ["remotion", "compositions", "src/index.ts"]);
  const re = new RegExp("^" + id + "\\s+\\d+\\s+\\S+\\s+(\\d+) \\(([\\d.]+) sec\\)", "m");
  const m = t.match(re);
  if (!m) throw new Error("composition " + id + " not found in src/index.ts");
  return { frames: Number(m[1]), seconds: Number(m[2]) };
};

const probeQuiet = (file) => {
  const res = spawnSync("ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file], { encoding: "utf8" });
  const v = Number((res.stdout ?? "").trim().split("\n").filter(Boolean).pop());
  return Number.isFinite(v) && v > 0 ? v : null;
};

const ffprobeDuration = (file) => {
  const t = run("probe duration", "ffprobe", ["-v", "error", "-show_entries", "format=duration",
    "-of", "default=noprint_wrappers=1:nokey=1", file]);
  const v = Number(t.trim().split("\n").filter(Boolean).pop());
  if (!Number.isFinite(v) || v <= 0) throw new Error("ffprobe returned no duration for " + file);
  return v;
};

try {
  // ---- 0. the manifest is the contract: mounts must be exactly what the content commit says,
  //         and a film's derived numbers come from its own pack before any gate imports them.
  if (FILM && !SKIP_STATIC) {
    run("content check", "node", ["scripts/films.mjs", "check", "--strict"]);
  }
  if (!SKIP_STATIC) {
    run("film coverage", "node", ["scripts/qa/film_coverage.mjs"]);
    if (FILM?.derive?.length) {
      run("derive data", "node", ["scripts/qa/derive_data.mjs", "--film=" + FILM.id]);
      run("sync mounts", "node", ["scripts/films.mjs", "sync"]);
    }
    run("derived check", "node", ["scripts/qa/derived_check.mjs"]);
  }

  // ---- 1. the contract and the type ratchet are cheap; fail here before rendering anything
  if (!SKIP_STATIC) {
    run("design contract", PYTHON, ["scripts/qa/design_check.py"]);
    run("type ratchet", PYTHON, ["scripts/qa/type_ratchet.py"]);
    run("film isolation", "node", ["scripts/qa/film_isolation.mjs"]);
    run("typecheck", "npx", ["tsc", "--noEmit"]);
    if (FILM?.claims) {
      run("claims check", "node", ["scripts/qa/claims_check.mjs", "--film=" + FILM.id]);
    }
    run("docs check", "node", ["scripts/qa/docs_check.mjs"]);
  }

  // ---- 2. the score is built for the composition's declared duration, gated, and only then
  //         allowed near a render (a bed nobody can hear must not reach the picture at all)
  const probed = args.seconds ? { seconds: Number(args.seconds) } : probeComposition(COMP);
  const seconds = probed.seconds;
  report.numbers.seconds = Number(seconds.toFixed(3));
  log("duration " + report.numbers.seconds + " s (" + (probed.frames ?? "?") + " frames)");

  const score = path.join(OUT, "score.wav");
  const scoreMeta = path.join(OUT, "score.meta.json");
  const scoreParams = {
    durationSec: Math.ceil(seconds),
    seed: Number(args.seed ?? 11),
    energy: Number(args.energy ?? 0.8),
    bpm: Number(args.bpm ?? 84),
    prog: args.prog ?? "minor",
  };
  const scoreReusable = (() => {
    if (args.score || args["regen-score"] || !fs.existsSync(score) || !fs.existsSync(scoreMeta)) return false;
    try {
      const old = JSON.parse(fs.readFileSync(scoreMeta, "utf8"));
      return ["seed", "energy", "bpm", "prog"].every((k) => old[k] === scoreParams[k])
        && old.durationSec >= scoreParams.durationSec;
    } catch {
      return false;
    }
  })();
  if (args.score) {
    fs.mkdirSync(path.dirname(score), { recursive: true });
    fs.copyFileSync(path.resolve(args.score), score);
    const bedSeconds = probeQuiet(score);
    fs.writeFileSync(scoreMeta, JSON.stringify({ ...scoreParams, durationSec: bedSeconds ?? 0, source: args.score }, null, 2));
    log("\n== score (reused " + args.score + ", " + (bedSeconds ?? "?") + " s)");
  } else if (scoreReusable) {
    log("\n== score (reused: same seed/energy/bpm/prog, bed >= " + scoreParams.durationSec + " s)");
  } else {
    run("score", "node", ["scripts/audio/render_music.mjs", "--out=" + score,
      "--duration=" + scoreParams.durationSec, "--seed=" + scoreParams.seed, "--energy=" + scoreParams.energy,
      "--bpm=" + scoreParams.bpm, "--prog=" + scoreParams.prog]);
    fs.writeFileSync(scoreMeta, JSON.stringify(scoreParams, null, 2));
  }
  report.numbers.scoreReused = scoreReusable;
  const stemGate = run("music gate (stem)", PYTHON, ["scripts/qa/music_gate.py", "--music", score]);
  report.numbers.stem = JSON.parse(stemGate.trim().split("\n").filter((l) => l.startsWith("{")).pop());

  // ---- 3. picture only: the renderer must not own the audio, the mux does
  const demoBed = path.join(ROOT, "public/music/demo.wav");
  if (!fs.existsSync(demoBed)) {
    run("demo bed (public/music/demo.wav)", "node", ["scripts/audio/render_music.mjs",
      "--out=public/music/demo.wav", "--duration=32", "--bpm=92", "--seed=11", "--energy=0.55"]);
  }

  const rawMp4 = path.join(OUT, "raw_video.mp4");
  if (args.raw) {
    fs.copyFileSync(path.resolve(args.raw), rawMp4);
    log("\n== render (reused " + args.raw + ")");
  } else if (FILM) {
    const summary = run("render (picture only, scene segments)", "node", ["scripts/render_scenes.mjs",
      "--composition=" + COMP, "--script=" + SCRIPT_REL,
      "--out=" + path.join(OUT, "scenes"), "--output=" + rawMp4,
      ...(args["force-render"] ? ["--force"] : [])]);
    const m = summary.match(/RENDER reused=(\d+) rendered=(\d+) scenes=(\d+) frames=(\d+)/);
    if (!m) throw new Error("could not read the segment summary from render_scenes.mjs");
    report.numbers.segments = { reused: Number(m[1]), rendered: Number(m[2]), scenes: Number(m[3]), frames: Number(m[4]) };
    log("segments: reused " + m[1] + ", rendered " + m[2] + " of " + m[3]);
  } else {
    run("render (picture only)", "npx", ["remotion", "render", COMP, rawMp4,
      "--props={\"music\":null,\"narration\":null}", "--log=error"]);
  }
  const realSeconds = ffprobeDuration(rawMp4);
  report.numbers.renderedSeconds = Number(realSeconds.toFixed(3));
  if (Math.abs(realSeconds - seconds) > 0.15) {
    throw new Error("render is " + realSeconds + " s but the composition declares " + seconds + " s");
  }

  // ---- 4. stills for human eyes, then the machine version of the same question
  const frames = STILL_FRAMES.length
    ? STILL_FRAMES.map(Number)
    : [Math.round(seconds * 0.1 * 30), Math.round(seconds * 0.45 * 30), Math.round(seconds * 0.8 * 30)];
  for (const f of frames) {
    run("still frame " + f, "npx", ["remotion", "still", COMP,
      path.join(OUT, "stills", "frame_" + f + ".png"), "--frame=" + f,
      "--props={\"music\":null,\"narration\":null}", "--log=error"]);
  }
  // Lint the exact review frames of this film. Full per-scene coverage is the content verify
  // pass; make is about the frames a human is about to look at.
  run("still lint", "node", ["scripts/qa/still_lint.mjs", "--compositions=" + COMP, "--frames=" + frames.join(",")]);

  // ---- 5. narration mix when the narration exists; otherwise the score is the programme audio
  let audio = score;
  if (NARRATION && fs.existsSync(NARRATION)) {
    const mix = path.join(OUT, "mix.wav");
    const mixOut = run("mix", "node", ["scripts/audio/mix.mjs", "--narration", NARRATION,
      "--music", score, "--out", mix]);
    report.numbers.mix = JSON.parse(mixOut.trim().split("\n").filter((l) => l.startsWith("{")).pop());
    const mixGate = run("music gate (mix)", PYTHON, ["scripts/qa/music_gate.py", "--mix", mix, "--narration", NARRATION]);
    report.numbers.mixGate = JSON.parse(mixGate.trim().split("\n").filter((l) => l.startsWith("{")).pop());
    audio = mix;
  } else {
    log("\n! no narration for " + COMP + ": delivering the score alone");
    report.numbers.narration = "absent (film declares none)";
  }

  // ---- 6. mux, normalise, gate the finished programme
  const mixed = path.join(OUT, "programme_unnorm.mp4");
  run("mux", "ffmpeg", ["-y", "-v", "error", "-i", rawMp4, "-i", audio, "-map", "0:v:0", "-map", "1:a:0",
    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-shortest", mixed]);
  const finalMp4 = path.join(OUT, COMP + ".mp4");
  const norm = run("loudnorm", "bash", ["scripts/audio/loudnorm.sh", mixed, finalMp4]);
  const lm = norm.match(/out I=(-?[\d.]+) TP=(-?[\d.]+)/);
  if (!lm) throw new Error("could not read the normalised loudness from loudnorm.sh");
  report.numbers.I = Number(lm[1]);
  report.numbers.TP = Number(lm[2]);
  if (report.numbers.I < -16.5 || report.numbers.I > -13 || report.numbers.TP > -1.5) {
    throw new Error("loudness out of range: I=" + report.numbers.I + " TP=" + report.numbers.TP);
  }
  log("PASS loudness: I=" + report.numbers.I + " LUFS, TP=" + report.numbers.TP + " dBFS");

  // Declare the script's own scene cuts by default. A hard cut is not a flicker, but the
  // gate cannot tell them apart without the list — leaving it out turns every cut into a
  // false failure on films that actually cut on scene boundaries (K-known-issues).
  const cutDefault = FILM && fs.existsSync(path.join(ROOT, DATA_REL, "lines.json")) ? "auto" : null;
  const cutArg = resolveCutFrames(args["cut-frames"] ?? cutDefault);
  const blinkArgs = ["scripts/qa/luma_blink.py", finalMp4, "--thresh", "12", "--region", "full"];
  if (cutArg) blinkArgs.push("--cut-frames", cutArg);
  const blink = run("flicker gate", PYTHON, blinkArgs);
  const diffLine = blink.split("\n").find((l) => l.includes("mean|d|=")) || "";
  if (!diffLine) throw new Error("could not read the flicker statistics");
  report.numbers.flicker = {
    meanAbsDelta: pick(diffLine, /mean\|d\|=([\d.]+)/, "mean |delta|"),
    p99: pick(diffLine, /p99=([\d.]+)/, "p99"),
    max: Number((diffLine.match(/max=([\d.]+)/) || [])[1]),
    cutFrames: cutArg ? cutArg.split(",").map(Number) : null,
  };

  // ---- 7. delivery exports: a film owes srt/chapters/cover; a demo owes none.
  const doExports = args.exports ? args.exports !== "false" : Boolean(FILM);
  if (doExports) {
    if (!FILM) throw new Error("--exports needs a film");
    run("publish", "node", ["scripts/export/publish.mjs", "--composition=" + COMP,
      "--script=" + SCRIPT_REL, "--prefix=" + FILM.prefix]);
    const exported = [];
    for (const f of [FILM.prefix + ".srt", FILM.prefix + ".chapters.txt", FILM.prefix + ".chapters.ffmeta.txt", "cover.png"]) {
      const from = path.join(ROOT, "out/export", f);
      if (!fs.existsSync(from)) throw new Error("publish did not produce " + f);
      fs.copyFileSync(from, path.join(OUT, f));
      exported.push(f);
    }
    report.numbers.exports = exported;
  } else if (FILM) {
    throw new Error(COMP + " is a film, so it owes srt/chapters/cover, but args.exports=false");
  } else {
    log("\n== delivery exports: " + COMP + " is a design demo, no srt/chapters are owed");
    report.numbers.exports = "not applicable (design demo)";
  }

  const rev = FILM ? contentRevision(FILM) : null;
  report.numbers.content = FILM ? { id: FILM.id, pack: FILM.packRel, commit: rev.commit, dirty: rev.dirty } : null;
  report.numbers.inputs = { src: fingerprint("src"), data: fingerprint("data"), scripts: fingerprint("scripts") };
  report.pass = true;
  writeReport();
  const extras = doExports ? " + srt/chapters/cover" : "";
  log("\nmake: PASS — " + path.relative(ROOT, finalMp4) + " (" + report.numbers.seconds + " s, "
    + report.numbers.I + " LUFS, TP " + report.numbers.TP + " dBFS)" + extras + " + report.json");
} catch (err) {
  writeReport();
  log("\nmake: FAIL — " + err.message + " (see " + path.relative(ROOT, path.join(OUT, "report.json")) + ")");
  process.exit(1);
}
