#!/usr/bin/env node
/**
 * three_frame_lint —— 3D 镜头的像素级门禁。
 *
 * 2D 的 still_lint 量 DOM（盒子、溢出、重叠），3D 没有 DOM 可量：画布永远是一个
 * 铺满的 canvas。所以这里退回到像素，只问三件在 3D 里最容易静默失败的事：
 *
 *   1. 画面不是空的      —— 与背景的差异覆盖率达到下限（资产没加载、相机对着虚空）
 *   2. 画面不是满的      —— 覆盖率不超过上限（相机进了模型内部、几何糊住全屏）
 *   3. 同一帧两次一样    —— 渲染两次 sha256 相等（WebGL 的随机/时间因素必须为零）
 *
 * 构图（主体偏左/偏右/出血多少）故意不在这里判：3D 镜头允许贴边、允许被文字压住，
 * 逐帧像素规则只能把好构图判成错。构图走人眼关卡，静帧与结论记进 docs/3d.md。
 *
 * 背景取画面四周 4 px 边框的灰度中位数，而不是直方图众数：渐变底、带文字的镜头
 * 都没有「一个众数背景」，边框中位数才是稳定的参照。
 *
 * 用法：
 *   node scripts/qa/three_frame_lint.mjs --composition=ThreeStage --frames=150,450,750
 *   node scripts/qa/three_frame_lint.mjs --composition=ThreeStage --frames=150 --repeat
 *
 * 退出码：0 通过 / 1 有帧失败 / 2 环境问题（bundle 失败、帧号越界等）
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, "");
    const [k, ...rest] = s.split("=");
    return [k, rest.length ? rest.join("=") : true];
  }),
);
const num = (k, d) => (args[k] == null ? d : Number(args[k]));
const die = (msg) => {
  console.error("three_frame_lint: " + msg);
  process.exit(2);
};

if (!args.composition) die("--composition=<id> is required");
const COMP = String(args.composition);
const FRAMES = String(args.frames ?? "")
  .split(",")
  .map((s) => Number(s.trim()))
  .filter((n) => Number.isFinite(n));
if (!FRAMES.length) die("--frames=150,450,750 is required");

const MIN_COVERAGE = num("min-coverage", 1.5);
const MAX_COVERAGE = num("max-coverage", 96);
const MIN_MEAN = num("min-mean", 2);
const REPEAT = Boolean(args.repeat);

async function main() {
  const { bundle } = await import("@remotion/bundler");
  const { renderStill, selectComposition } = await import("@remotion/renderer");

  console.log("three_frame_lint: bundling " + COMP + " for frames " + FRAMES.join(", "));
  const serveUrl = await bundle({ entryPoint: path.join(ROOT, "src/index.ts"), publicDir: path.join(ROOT, "public") });
  const composition = await selectComposition({ serveUrl, id: COMP });
  for (const f of FRAMES) {
    if (f < 0 || f >= composition.durationInFrames)
      die("frame " + f + " is outside " + COMP + " (" + composition.durationInFrames + " frames) — update the targets, do not clamp");
  }

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "3d-lint-"));
  const rows = [];
  let failed = 0;

  const render = async (frame, suffix) => {
    const out = path.join(tmp, COMP + "-" + frame + (suffix ? "-" + suffix : "") + ".png");
    await renderStill({ composition, serveUrl, frame, output: out, logLevel: "error" });
    return out;
  };

  const gray = (png) => {
    const r = spawnSync("ffmpeg", ["-v", "error", "-i", png, "-f", "rawvideo", "-pix_fmt", "gray", "-"], {
      maxBuffer: 256 * 1024 * 1024,
    });
    if (r.status !== 0) die("ffmpeg could not decode " + png + ": " + r.stderr?.toString());
    return r.stdout;
  };

  for (const frame of FRAMES) {
    const png = await render(frame);
    const buf = fs.readFileSync(png);
    const sha = createHash("sha256").update(buf).digest("hex");
    const px = gray(png);
    const w = composition.width;
    const h = composition.height;
    if (px.length !== w * h) die("decoded " + px.length + " bytes, expected " + w * h);

    // 背景 = 四周 4 px 边框的灰度中位数；主体 = 与背景差 > 20 灰度级的像素。
    const border = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < 4 || y < 4 || x >= w - 4 || y >= h - 4) border.push(px[y * w + x]);
      }
    }
    border.sort((a, b) => a - b);
    const bg = border[Math.floor(border.length / 2)];
    let count = 0;
    let sum = 0;
    for (let i = 0; i < px.length; i++) {
      sum += px[i];
      if (Math.abs(px[i] - bg) > 20) count++;
    }
    const coverage = (count / (w * h)) * 100;
    const mean = sum / px.length;

    const problems = [];
    if (mean < MIN_MEAN) problems.push("frame is essentially black (mean " + mean.toFixed(2) + ")");
    if (coverage < MIN_COVERAGE)
      problems.push("coverage " + coverage.toFixed(2) + "% < min-coverage " + MIN_COVERAGE + "% (asset missing, or camera pointing at nothing)");
    if (coverage > MAX_COVERAGE)
      problems.push("coverage " + coverage.toFixed(2) + "% > max-coverage " + MAX_COVERAGE + "% (geometry inside the lens)");

    let repeatSha = null;
    if (REPEAT) {
      const again = await render(frame, "again");
      repeatSha = createHash("sha256").update(fs.readFileSync(again)).digest("hex");
      if (repeatSha !== sha) problems.push("two renders of the same frame differ (not deterministic)");
    }

    const ok = problems.length === 0;
    if (!ok) failed++;
    rows.push({ frame, ok, coverage, mean, bg, sha, repeatSha, problems });
  }

  for (const r of rows) {
    console.log(
      (r.ok ? "PASS " : "FAIL ") +
        "frame " +
        r.frame +
        "  coverage " +
        r.coverage.toFixed(2) +
        "%  bg " +
        r.bg +
        "  mean " +
        r.mean.toFixed(2) +
        "  sha256 " +
        r.sha.slice(0, 16),
    );
    for (const p of r.problems) console.log("     - " + p);
  }

  if (failed) {
    console.error("three_frame_lint: FAIL — " + failed + "/" + rows.length + " frame(s)");
    process.exit(1);
  }
  console.log("three_frame_lint: PASS — " + rows.length + " frame(s)" + (REPEAT ? " (determinism checked)" : ""));
}

main().catch((e) => die(String(e && e.stack ? e.stack : e)));