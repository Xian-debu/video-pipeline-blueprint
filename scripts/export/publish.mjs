#!/usr/bin/env node
/**
 * Delivery exports that must agree with the film: subtitles, chapters, cover.
 *
 * Everything here is derived, never typed twice. The lecture script is the
 * single source: LINES become the SRT, SCENES become the chapter marks, and the
 * cover is a real rendered frame (not a separately designed image that would
 * drift from the video).
 *
 * Usage: node scripts/export/publish.mjs [--out=out/export] [--cover-frame=180]
 *          [--composition=Lecture] [--script=src/lecture/script.ts] [--prefix=lecture]
 * Outputs: <prefix>.srt, <prefix>.chapters.txt, <prefix>.chapters.ffmeta.txt,
 *          cover.png (1920x1080) — the cover is the frame of that composition.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { build } from "esbuild";
import { bundle } from "@remotion/bundler";
import { selectComposition, renderStill } from "@remotion/renderer";

const SPEC = JSON.parse(fs.readFileSync(path.resolve("data/design.spec.json"), "utf8"));
const MAX_CHARS = SPEC.text.caption.maxCharsPerLine;

const argOf = (name, fallback) => {
  const hit = process.argv.find((a) => a.startsWith("--" + name + "="));
  return hit ? hit.slice(name.length + 3) : fallback;
};

const OUT = path.resolve(argOf("out", "out/export"));
const COVER_FRAME = Number(argOf("cover-frame", "180"));
const FPS = 30;
/** A film names itself: the same exporter serves every composition. */
const COMPOSITION = argOf("composition", "Lecture");
const SCRIPT = path.resolve(argOf("script", "src/lecture/script.ts"));
const PREFIX = argOf("prefix", COMPOSITION === "Lecture" ? "lecture" : COMPOSITION.toLowerCase());

/** Bundle the film script so this stays a plain Node program (no ts-node). */
const loadScript = async () => {
  const result = await build({
    entryPoints: [SCRIPT],
    bundle: true,
    format: "esm",
    platform: "node",
    write: false,
    logLevel: "error",
  });
  const tmp = path.join(fs.mkdtempSync(path.join(os.tmpdir(), "publish-")), "script.mjs");
  fs.writeFileSync(tmp, result.outputFiles[0].text);
  return import(pathToFileURL(tmp).href);
};

const pad = (n, w = 2) => String(n).padStart(w, "0");

const srtTime = (seconds) => {
  const ms = Math.round(seconds * 1000);
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  return pad(h) + ":" + pad(m) + ":" + pad(s) + "," + pad(ms % 1000, 3);
};

const clock = (seconds) => {
  const s = Math.floor(seconds);
  return pad(Math.floor(s / 3600)) + ":" + pad(Math.floor((s % 3600) / 60)) + ":" + pad(s % 60);
};

/**
 * Wrap a cue to the caption line budget the design contract sets (34 CJK chars).
 * Break at punctuation where possible, then hard-split, so a subtitle line never
 * exceeds what the caption component is allowed to put on one line.
 */
const wrapCue = (text, max) => {
  const chars = Array.from(text.trim());
  const lines = [];
  let line = "";
  let pending = "";
  for (let i = 0; i < chars.length; i += 1) {
    const ch = chars[i];
    pending += ch;
    if ("，。、；：！？,.;:!?".includes(ch)) {
      if (Array.from(line + pending).length > max && line !== "") {
        lines.push(line);
        line = pending;
      } else {
        line += pending;
      }
      pending = "";
      continue;
    }
    if (Array.from(line + pending).length >= max) {
      line += pending;
      lines.push(line);
      line = "";
      pending = "";
    }
  }
  line += pending;
  if (line !== "") lines.push(line);
  // A single clause longer than the budget is split at the budget.
  const out = [];
  for (const l of lines) {
    const a = Array.from(l);
    for (let i = 0; i < a.length; i += max) out.push(a.slice(i, i + max).join(""));
  }
  return out;
};

const srt = (lines) =>
  lines
    .map((l, i) => {
      const body = wrapCue(l.speech, MAX_CHARS).join("\n");
      return String(i + 1) + "\n" + srtTime(l.start) + " --> " + srtTime(l.start + l.dur) + "\n" + body + "\n";
    })
    .join("\n");

const chapters = (scenes) => {
  const out = [];
  let t = 0;
  for (const s of scenes) {
    out.push({ start: t, end: t + s.dur, title: s.chapter + " · " + s.title });
    t += s.dur;
  }
  return out;
};

const ffmeta = (marks) =>
  ";FFMETADATA1\n" +
  marks
    .map(
      (m) =>
        "[CHAPTER]\nTIMEBASE=1/1000\nSTART=" + Math.round(m.start * 1000) + "\nEND=" + Math.round(m.end * 1000) + "\ntitle=" + m.title + "\n",
    )
    .join("");

const humanChapters = (marks) => marks.map((m) => clock(m.start) + "  " + m.title).join("\n") + "\n";

/** Fail loudly rather than ship a subtitle file that disagrees with the film. */
const check = (lines, marks, totalSec) => {
  const problems = [];
  for (let i = 0; i < lines.length; i += 1) {
    for (const l of wrapCue(lines[i].speech, MAX_CHARS)) {
      if (Array.from(l).length > MAX_CHARS) problems.push("cue " + (i + 1) + " has a line longer than the caption budget (" + Array.from(l).length + " > " + MAX_CHARS + ")");
    }
  }
  for (let i = 0; i < lines.length; i += 1) {
    const l = lines[i];
    if (!(l.dur > 0)) problems.push("line " + i + " has non-positive duration");
    if (l.speech.trim() === "") problems.push("line " + i + " is empty");
    if (i > 0 && l.start < lines[i - 1].start + lines[i - 1].dur - 0.001) {
      problems.push("line " + i + " starts before the previous one ends (" + l.start + " < " + (lines[i - 1].start + lines[i - 1].dur).toFixed(2) + ")");
    }
    if (l.start + l.dur > totalSec + 0.05) problems.push("line " + i + " ends after the film (" + (l.start + l.dur).toFixed(2) + " > " + totalSec + ")");
  }
  const sum = marks.reduce((a, m) => a + (m.end - m.start), 0);
  if (Math.abs(sum - totalSec) > 0.02) problems.push("chapters sum to " + sum.toFixed(2) + " s but the lecture is " + totalSec.toFixed(2) + " s");
  for (const m of marks) if (Math.round(m.end * 1000) <= Math.round(m.start * 1000)) problems.push("empty chapter: " + m.title);
  return problems;
};

const main = async () => {
  const { LINES, SCENES, TOTAL_SEC } = await loadScript();
  fs.mkdirSync(OUT, { recursive: true });

  const marks = chapters(SCENES);
  const problems = check(LINES, marks, TOTAL_SEC);
  if (problems.length) {
    console.error("publish: refusing to write deliverables");
    for (const p of problems) console.error("  - " + p);
    process.exit(1);
  }

  fs.writeFileSync(path.join(OUT, PREFIX + ".srt"), srt(LINES));
  fs.writeFileSync(path.join(OUT, PREFIX + ".chapters.txt"), humanChapters(marks));
  fs.writeFileSync(path.join(OUT, PREFIX + ".chapters.ffmeta.txt"), ffmeta(marks));

  // The cover is a frame of the film, so it cannot drift from it.
  const serveUrl = await bundle({ entryPoint: path.resolve("src/index.ts") });
  const composition = await selectComposition({ serveUrl, id: COMPOSITION });
  const frame = Math.min(COVER_FRAME, composition.durationInFrames - 1);
  await renderStill({
    composition,
    serveUrl,
    output: path.join(OUT, "cover.png"),
    frame,
    logLevel: "error",
    inputProps: { music: null, narration: null },
  });

  const cues = LINES.map((l) => wrapCue(l.speech, MAX_CHARS));
  const wrapped = cues.filter((c) => c.length > 1).length;
  const longestLine = Math.max(...cues.flat().map((l) => Array.from(l).length));
  const speaking = LINES.reduce((a, l) => a + l.dur, 0);
  console.log(PREFIX + ": " + LINES.length + " subtitle cues, " + marks.length + " chapters, " + TOTAL_SEC.toFixed(1) + " s");
  console.log("subtitle span " + srtTime(LINES[0].start) + " -> " + srtTime(LINES[LINES.length - 1].start + LINES[LINES.length - 1].dur) + ", speaking " + speaking.toFixed(1) + " s");
  console.log("caption budget " + MAX_CHARS + " chars/line from data/design.spec.json; " + wrapped + " of " + LINES.length + " cues wrapped to 2 lines, longest line " + longestLine);
  console.log("chapters sum " + marks.reduce((a, m) => a + (m.end - m.start), 0).toFixed(2) + " s, first " + clock(marks[0].start) + ", last " + clock(marks[marks.length - 1].start));
  console.log("cover: cover.png frame " + frame + " (" + (frame / FPS).toFixed(2) + " s)");
  console.log("publish: PASS - " + OUT);
};

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
