#!/usr/bin/env node
/**
 * plate_lint —— Blender plate 序列的门禁（P16）。
 *
 * 为什么需要它：plate 是"离线渲一遍、在线用很多遍"的产物，一旦渲染中断、被
 * 覆盖、或者 composition 的时长和序列长度对不上，画面不会报错，只会安静地
 * 少几帧或者多出几张空白（P15 的 K20 就是这么骗过门禁的）。所以这里把
 * report.json 当契约：每张图的字节数与 sha256 必须与报告一致，帧号必须连续，
 * 报告里的帧数必须等于 PlateStage 声明的时长。
 *
 * 用法：
 *   node scripts/qa/plate_lint.mjs                          # 默认 public/plates/showcase
 *   node scripts/qa/plate_lint.mjs --dir=public/plates/x
 *   node scripts/qa/plate_lint.mjs --json
 *
 * 退出码：0 通过 / 1 报告与文件不一致 / 2 plate 还没渲（按文档跑 npm run plates）。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, "");
    const [k, ...rest] = s.split("=");
    return [k, rest.length ? rest.join("=") : true];
  }),
);

const rel = (p) => path.relative(ROOT, p) || ".";
const die = (msg) => {
  console.error("plate_lint: " + msg);
  process.exit(2);
};
const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

const dirArg = args.dir ?? "public/plates/showcase";
const dir = path.isAbsolute(dirArg) ? dirArg : path.join(ROOT, dirArg);
const reportPath = path.join(dir, "report.json");
const asJson = Boolean(args.json);
const problems = [];
const notes = [];

if (!fs.existsSync(dir)) {
  die(
    "no plate directory " + rel(dir) + " — plates are rendered, not committed.\n" +
      "      Render them first:  npm run plates -- --glb public/models/nailong_v3_15k.glb --alpha\n" +
      "      (docs/blender-plates.md has the cost table and the exact commands.)",
  );
}
if (!fs.existsSync(reportPath)) {
  die("no report.json in " + rel(dir) + " — the plate set has no provenance, re-render it (npm run plates)");
}

let report;
try {
  report = JSON.parse(fs.readFileSync(reportPath, "utf8"));
} catch (err) {
  die("report.json is not valid JSON: " + err.message);
}

// ---- 1. the report describes a render, not an aspiration --------------------
const required = {
  blender: "string",
  engine: "string",
  resolution: "object",
  samples: "number",
  alpha: "boolean",
  frames: "object",
  timing: "object",
  plates: "object",
  model: "object",
  camera: "object",
};
for (const [key, type] of Object.entries(required)) {
  if (report[key] == null) problems.push("report is missing " + key);
  else if (typeof report[key] !== type) problems.push("report." + key + " is not a " + type);
}
if (problems.length) {
  for (const p of problems) console.error("     - " + p);
  console.error("plate_lint: FAIL — report.json does not match the contract");
  process.exit(1);
}

const KNOWN_ENGINES = ["CYCLES", "BLENDER_EEVEE", "BLENDER_EEVEE_NEXT", "BLENDER_WORKBENCH"];
if (!KNOWN_ENGINES.includes(report.engine)) problems.push("unknown engine " + report.engine);
if (!(report.samples > 0)) problems.push("samples " + report.samples + " is not positive");
const [w, h] = report.resolution ?? [];
if (!(w > 0 && h > 0)) problems.push("resolution " + JSON.stringify(report.resolution) + " is not usable");
if (!(report.timing.mean_s > 0)) problems.push("mean_s " + report.timing.mean_s + " is not positive");
if (!report.alpha) notes.push("plates are opaque (no --alpha): the stage cannot compose them over 2D text");

// ---- 2. the frames are contiguous and the count is stated once -------------
const { start, end, count } = report.frames ?? {};
if (!Number.isInteger(count) || count <= 0) problems.push("frames.count " + count + " is not a positive integer");
if (count !== report.plates.length) problems.push("frames.count " + count + " != plates.length " + report.plates.length);
if (count !== end - start + 1) problems.push("frames " + start + ".." + end + " is " + (end - start + 1) + " frames, not " + count);

report.plates.forEach((plate, index) => {
  if (plate.frame !== start + index) problems.push("plate " + index + " is frame " + plate.frame + ", want " + (start + index));
});

// ---- 3. every plate exists and is the byte-for-byte file the report claims --
let bytes = 0;
for (const plate of report.plates) {
  const file = path.join(dir, plate.file);
  if (!fs.existsSync(file)) {
    problems.push("missing " + plate.file);
    continue;
  }
  const buf = fs.readFileSync(file);
  bytes += buf.length;
  if (typeof plate.bytes === "number" && buf.length !== plate.bytes) {
    problems.push(plate.file + " is " + buf.length + " B, report says " + plate.bytes + " B");
  }
  if (typeof plate.sha256 === "string" && sha256(buf) !== plate.sha256) {
    problems.push(plate.file + " sha256 does not match the report (re-rendered, or edited?)");
  }
}

// ---- 4. the composition's duration is the plate count ----------------------
const stagePath = path.join(ROOT, "src/showcase/PlateStage.tsx");
if (fs.existsSync(stagePath)) {
  const source = fs.readFileSync(stagePath, "utf8");
  const match = source.match(/PLATE_STAGE_FRAMES\s*=\s*(\d+)/);
  if (!match) problems.push("PlateStage.tsx no longer declares PLATE_STAGE_FRAMES");
  else if (Number(match[1]) !== count) {
    problems.push("PLATE_STAGE_FRAMES is " + match[1] + " but the plate set has " + count + " frames — " +
      "the stage would run past the plates (or stop short); render " + match[1] + " frames or change the constant");
  }
}

// ---- 5. the model the plates came from is still the model in the repo ------
if (typeof report.model.sha256 === "string") {
  const modelPath = path.isAbsolute(report.model.path) ? report.model.path : path.join(ROOT, report.model.path);
  if (fs.existsSync(modelPath)) {
    const actual = sha256(fs.readFileSync(modelPath));
    if (actual !== report.model.sha256) {
      problems.push("plates were rendered from a different " + report.model.path + " (sha256 " + actual.slice(0, 16) + ")");
    }
  } else {
    notes.push("model " + report.model.path + " is not in this checkout; sha256 check skipped");
  }
}

const summary =
  report.plates.length +
  " plate(s) · " +
  (w && h ? w + "×" + h + " · " : "") +
  report.engine.replace("BLENDER_", "") +
  " " +
  report.samples +
  " spp · mean " +
  report.timing.mean_s.toFixed(2) +
  " s/frame · " +
  (report.alpha ? "alpha" : "opaque") +
  " · " +
  bytes.toLocaleString("en-US") +
  " B · model sha256 " +
  String(report.model.sha256 ?? "").slice(0, 12);

if (asJson) {
  console.log(JSON.stringify({ ok: problems.length === 0, dir: rel(dir), summary, problems, notes }, null, 2));
} else {
  console.log((problems.length === 0 ? "PASS " : "FAIL ") + rel(dir) + "  " + summary);
  for (const n of notes) console.log("     ~ " + n);
  for (const p of problems) console.log("     - " + p);
}

if (problems.length) {
  console.error("plate_lint: FAIL — " + problems.length + " problem(s) in " + rel(dir));
  process.exit(1);
}
console.log("plate_lint: PASS — plates are contiguous, byte-stable and match the stage's duration");
