// One command, one delivery package.
//
// Stages: contract -> probe -> score -> score gate -> picture-only render -> review stills -> DOM
// lint -> mix -> mix gate -> mux -> loudnorm -> flicker -> delivery exports -> report.json. The
// score is generated before the picture on purpose: a bed that cannot be heard never reaches a
// render. Each stage is the same command the docs describe;
// this script exists so the order and the gates cannot be skipped by hand, and so every number a
// release claims is written down by the machine that measured it.
//
//   node scripts/make.mjs --composition Lecture --out out/package
//
// A stage that fails stops the pipeline and still writes out/package/report.json with what passed
// and what did not, so the failure is inspectable rather than inferred from a truncated log.
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { spawnSync } from "node:child_process";

import { FILMS } from "./film_registry.mjs";
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

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), "..");
const COMP = args.composition ?? "Lecture";
/** Which film backs a composition: script, export prefix, generators. One map, shared with the
 *  still gate — see scripts/film_registry.mjs and docs/known-issues.md K27. */
const EXPORTS = FILMS;
const OUT = path.resolve(ROOT, args.out ?? "out/package");
const NARRATION = args.narration ?? "public/voice/narration.wav";
// If a person asked for a narration, an absent file is an error, not a quieter film. The default
// path may legitimately be absent in a fresh clone (verify.sh needs no narration), but an explicit
// --narration that does not exist is a typo the pipeline must not swallow.
const NARRATION_EXPLICIT = args.narration != null;
const STILL_FRAMES = (args["still-frames"] ?? "").split(",").filter(Boolean);
const PYTHON = process.env.PYTHON ?? "python3";
const SKIP_STATIC = args["skip-static"] != null && args["skip-static"] !== "false";

// Fail in the first second, not after the render: a narration that was asked for and does not
// exist is a typo, and the old behaviour delivered a silent film instead of reporting it.
if (NARRATION_EXPLICIT && !fs.existsSync(path.resolve(ROOT, NARRATION))) {
  console.error("make: FAIL — --narration " + NARRATION + " does not exist (cwd " + ROOT + ")");
  process.exit(2);
}

// Which tree is this run about to measure? A copy in another distro cannot see this disk, so the
// expected hash is passed on the command line and checked before anything expensive starts.
const TREE = treeHashName(ROOT);
const EXPECT_TREE = args["expect-tree"];
if (EXPECT_TREE && EXPECT_TREE !== "true" && EXPECT_TREE !== TREE.tree) {
  console.error("make: FAIL — this tree is " + TREE.tree + " but the caller expected " + EXPECT_TREE
    + " (stale copy? re-sync src/ data/ scripts/ before rendering)");
  process.exit(2);
}

fs.mkdirSync(path.join(OUT, "stills"), { recursive: true });
const report = {
  generatedAt: new Date().toISOString(),
  composition: COMP,
  out: path.relative(ROOT, OUT),
  stages: [],
  numbers: { tree: TREE.tree },
  pass: false,
};

const log = (s) => process.stdout.write(s + "\n");

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

function writeReport() {
  fs.writeFileSync(path.join(OUT, "report.json"), JSON.stringify(report, null, 2));
}

// Which inputs produced this delivery. A stale working copy, or a film built from a different
// commit than the one on disk, is otherwise indistinguishable from a clean run: the report says
// what was measured, this says what it was measured on.
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

// composition duration without rendering: the CLI prints one row per composition
const probeComposition = (id) => {
  const t = run("probe composition", "npx", ["remotion", "compositions", "src/index.ts"]);
  const re = new RegExp("^" + id + "\\s+\\d+\\s+\\S+\\s+(\\d+) \\(([\\d.]+) sec\\)", "m");
  const m = t.match(re);
  if (!m) throw new Error("composition " + id + " not found in src/index.ts");
  return { frames: Number(m[1]), seconds: Number(m[2]) };
};

// For values that are bookkeeping rather than measurements: no stage row, no gate.
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
  // ---- 0. derived numbers come first: a clean clone has no data/hawk/gray.json, and every gate
  //         below imports them. The map and the tree must also agree, or a gate iterates nothing.
  if (!SKIP_STATIC) {
    run("film coverage", "node", ["scripts/qa/film_coverage.mjs"]);
    if (EXPORTS[COMP]) run("derive data", "node", ["scripts/qa/derive_data.mjs", "--composition=" + COMP]);
    run("derived check", "node", ["scripts/qa/derived_check.mjs"]);
  }

  // ---- 1. the contract and the type ratchet are cheap; fail here before rendering anything
  if (!SKIP_STATIC) {
    run("design contract", PYTHON, ["scripts/qa/design_check.py"]);
    run("type ratchet", PYTHON, ["scripts/qa/type_ratchet.py"]);
    run("film isolation", "node", ["scripts/qa/film_isolation.mjs"]);
    run("typecheck", "npx", ["tsc", "--noEmit"]);
    // only a paper film owns a claims ledger, and only a claims ledger can be checked against the
    // paper it cites; a film without one skips this stage by design, not by accident
    if (fs.existsSync(path.join(ROOT, "data", COMP.toLowerCase(), "claims.json"))) {
      run("claims check", "node", ["scripts/qa/claims_check.mjs", "--film=" + COMP.toLowerCase()]);
    }
    run("docs check", "node", ["scripts/qa/docs_check.mjs"]);
  }

  // ---- 2. the score is built for the composition's declared duration, gated, and only then
  //         allowed near a render (a bed nobody can hear must not reach the picture at all)
  const probed = args.seconds ? { seconds: Number(args.seconds) } : probeComposition(COMP);
  const seconds = probed.seconds;
  report.numbers.seconds = Number(seconds.toFixed(3));
  log("duration " + report.numbers.seconds + " s (" + (probed.frames ?? "?") + " frames)");

  // A 10-minute bed costs ~19 minutes to synthesize and does not depend on the picture, so a
  // picture-only iteration must not rebuild it. Reuse is keyed on the generation parameters
  // (in a sidecar), never on "a score.wav exists": the same seed and energy must produce the same
  // bytes, and a bed shorter than the programme is not a bed.
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
    // Record what the bed is worth knowing: its real length decides whether the next run may
    // reuse it, and the generation parameters are the ones this run would have used.
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
  // The demo compositions (Storyboard, Showreel) embed a score in the picture via
  // public/music/demo.wav, which verify.sh generates and which is not committed. Generate the same
  // bytes here instead of failing inside Chromium with a 404 for a staticFile.
  const demoBed = path.join(ROOT, "public/music/demo.wav");
  if (COMP !== "Lecture" && !fs.existsSync(demoBed)) {
    run("demo bed (public/music/demo.wav)", "node", ["scripts/audio/render_music.mjs",
      "--out=public/music/demo.wav", "--duration=32", "--bpm=92", "--seed=11", "--energy=0.55"]);
  }

  const rawMp4 = path.join(OUT, "raw_video.mp4");
  if (args.raw) {
    // Same reason as --score: a gate that fails after the picture is final must not cost
    // another 25-minute render. The duration check below still guards the reuse.
    fs.copyFileSync(path.resolve(args.raw), rawMp4);
    log("\n== render (reused " + args.raw + ")");
  } else if (EXPORTS[COMP]) {
    // A film made of scenes is rendered scene by scene: an edit to one paragraph re-renders that
    // scene and concatenates the rest untouched (scripts/render_scenes.mjs). The duration check
    // below still guards the result.
    const summary = run("render (picture only, scene segments)", "node", ["scripts/render_scenes.mjs",
      "--composition=" + COMP, "--script=" + EXPORTS[COMP].script,
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
  run("still lint", "node", ["scripts/qa/still_lint.mjs"]);

  // ---- 5. narration mix when the narration exists; otherwise the score is the programme audio
  let audio = score;
  const narrationPath = path.resolve(ROOT, NARRATION);
  if (fs.existsSync(narrationPath)) {
    const mix = path.join(OUT, "mix.wav");
    const mixOut = run("mix", "node", ["scripts/audio/mix.mjs", "--narration", NARRATION,
      "--music", score, "--out", mix]);
    report.numbers.mix = JSON.parse(mixOut.trim().split("\n").filter((l) => l.startsWith("{")).pop());
    const mixGate = run("music gate (mix)", PYTHON, ["scripts/qa/music_gate.py", "--mix", mix, "--narration", NARRATION]);
    report.numbers.mixGate = JSON.parse(mixGate.trim().split("\n").filter((l) => l.startsWith("{")).pop());
    audio = mix;
  } else {
    log("\n! " + NARRATION + " not found: delivering the score alone (no --narration was requested)");
    report.numbers.narration = "absent (no --narration given)";
  }

  // ---- 6. mux, normalise, gate the finished programme
  const mixed = path.join(OUT, "programme_unnorm.mp4");
  // explicit maps: the picture's own audio stream (if its composition embeds one) is dropped, so
  // the programme audio is exactly what the gate measured
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

  // --cut-frames: a hard cut between scenes is intentional; the gate ignores those frames.
  // Without it the gate is strict, which is right for the lecture (and for any film whose cuts
  // are crossfades).
  const blinkArgs = ["scripts/qa/luma_blink.py", finalMp4, "--thresh", "12", "--region", "full"];
  if (args["cut-frames"]) blinkArgs.push("--cut-frames", args["cut-frames"]);
  const blink = run("flicker gate", PYTHON, blinkArgs);
  // The gate prints two lines that both contain "max=": the frame-luma range, then the diff
  // statistics. Read the diff line, or the report would quote a legitimate luma range as a flicker.
  const diffLine = blink.split("\n").find((l) => l.includes("mean|d|=")) || "";
  if (!diffLine) throw new Error("could not read the flicker statistics");
  report.numbers.flicker = {
    meanAbsDelta: pick(diffLine, /mean\|d\|=([\d.]+)/, "mean |delta|"),
    p99: pick(diffLine, /p99=([\d.]+)/, "p99"),
    max: Number((diffLine.match(/max=([\d.]+)/) || [])[1]),
    // a cut is a jump the gate was told to ignore; recorded so a reader is not surprised by a raw
    // max (e.g. 107.59) next to a PASS
    cutFrames: args["cut-frames"] ? args["cut-frames"].split(",").map(Number) : null,
  };

  // ---- 7. delivery exports, copied next to the film. The exporter is bound to the lecture
  //         script (its cues and chapters are that script), so other compositions skip it unless
  //         asked explicitly with --exports
  const exp = EXPORTS[COMP];
  const doExports = args.exports ? args.exports !== "false" : Boolean(exp);
  if (doExports) {
    if (!exp) throw new Error("no export script known for " + COMP + " (add it to EXPORTS in make.mjs)");
    run("publish", "node", ["scripts/export/publish.mjs", "--composition=" + COMP,
      "--script=" + exp.script, "--prefix=" + exp.prefix]);
    const exported = [];
    for (const f of [exp.prefix + ".srt", exp.prefix + ".chapters.txt", exp.prefix + ".chapters.ffmeta.txt", "cover.png"]) {
      const from = path.join(ROOT, "out/export", f);
      if (!fs.existsSync(from)) throw new Error("publish did not produce " + f);
      fs.copyFileSync(from, path.join(OUT, f));
      exported.push(f);
    }
    report.numbers.exports = exported;
  } else if (EXPORTS[COMP]) {
    // A film whose srt/chapters/cover are missing is not a delivery. This used to print a note and
    // exit 0, which is how the first Hawk make "passed" without them (K27).
    throw new Error(COMP + " is a film, so it owes srt/chapters/cover, but args.exports=false");
  } else {
    log("\n== delivery exports: " + COMP + " is a design demo, no srt/chapters are owed");
    report.numbers.exports = "not applicable (design demo)";
  }

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