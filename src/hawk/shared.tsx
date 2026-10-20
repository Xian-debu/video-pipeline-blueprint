import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../design/tokens";
import { ChapterBar, SceneShell } from "../design/Scene";
import { SCENES, LINES, TOTAL, FPS } from "./script";
import grayJson from "../../data/hawk/gray.json";
import waveJson from "../../data/hawk/wave.json";
import evalJson from "../../data/hawk/eval.json";

/* 第四部片（Hawk 论文解读）的共用件：数据类型、账本数据、字号/间距、场景壳，以及 12 场
 * 都会用到的小部件（Head/Card/Mono/Body/Line/Fig/Scene）。每场一个文件，放在 scenes/ 下。
 * 拆分理由见 docs/known-issues.md K29：单文件 859 行，改一处要通读全篇。 */

/* ---------- 数据类型（由 scripts/generate_hawk_data.py 产出） ---------- */
export type SchedRound = { round: number; active: number[] };
export type GrayData = {
  code4: { states: string[]; flipsPerBit: number[]; singleFlip: boolean };
  grouped: { stateUngrouped: number; eventsPerRoundGrouped: number; ratio: number; schedule: SchedRound[] };
  paper: {
    trainRounds: number; trainEvents: number; trainStates: number;
    valRounds: number; valEvents: number; valStates: number; overlapPct: number;
  };
};
export type WaveData = {
  meta?: { synthetic?: boolean; note?: string };
  series: { t: number[]; total: number[]; diff: (number | null)[] };
  events?: { t: number; appliance: string; on: boolean }[];
  /** others = 论文里的"干扰总量"（其它电器 + 背景），差分那栏是 other（单数）。 */
  sinr: {
    direct: { target: number; others: number; ratio: number };
    diff: { target: number; other?: number; others?: number; ratio: number };
    gainDb: number;
  };
  vote: { threshold: number; counts: Record<string, number>; decided: string };
  window?: { cycles: number; transientCycles: number };
  features?: { harmonics: { k: number; re: number; im: number; mag: number }[] };
};
export const GRAY = grayJson as unknown as GrayData;
export const WAVE = waveJson as unknown as WaveData;
export const EV = evalJson as typeof evalJson;

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const pct = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
export const PAD = G.pad;
export const CW = 1920 - PAD * 2;

/* ---------- 通用小件 ---------- */
export const Head: React.FC<{ kicker: string; title: string; goal?: string }> = ({ kicker, title, goal }) => (
  <div style={{ position: "absolute", left: PAD, top: 92, width: CW }}>
    <div style={{ fontFamily: FONT.mono, fontSize: FT.label, letterSpacing: FT_T.label, color: C.cyan }}>{kicker}</div>
    <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10, lineHeight: 1.15 }}>{title}</div>
    {goal ? (
      <div style={{ fontFamily: FONT.sans, fontSize: FT.label, color: C.inkFaint, marginTop: 10 }}>{goal}</div>
    ) : null}
  </div>
);

export const Card: React.FC<{ label?: string; accent?: string; children: React.ReactNode; style?: React.CSSProperties; pad?: number }> = ({
  label, accent = C.panelLine, children, style, pad = 28,
}) => (
  <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderTop: "2px solid " + accent, borderRadius: 14, padding: pad, ...style }}>
    {label ? (
      <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, letterSpacing: FT_T.meta, color: C.inkFaint, marginBottom: 14 }}>{label}</div>
    ) : null}
    {children}
  </div>
);

export const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children, size = FT.mono, color = C.ink, style,
}) => <span style={{ fontFamily: FONT.mono, fontSize: size, color, fontVariantNumeric: "tabular-nums", ...style }}>{children}</span>;

export const Body: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children, color = C.inkDim, size = FT.body, style,
}) => <div style={{ fontFamily: FONT.sans, fontSize: size, color, lineHeight: 1.6, ...style }}>{children}</div>;

/** 折线：values 归一化到 [lo,hi]。pathLength=1 + dasharray 做确定性描边。 */
export const Line: React.FC<{
  /** null = 这一点没有值（例如差分序列的预热段），折线在该处断开，不做差补。 */
  values: (number | null)[]; w: number; h: number; lo: number; hi: number;
  color: string; width?: number; at: number; dur?: number; fill?: boolean;
}> = ({ values, w, h, lo, hi, color, width = 2, at, dur = 40, fill }) => {
  const f = useCurrentFrame();
  const p = pct(f, at, at + dur);
  if (!values.length) return null;
  const span = hi - lo || 1;
  const pts = values.flatMap((v, i) => {
    if (v === null) return [];
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - lo) / span) * h;
    return [x.toFixed(1) + "," + Math.max(0, Math.min(h, y)).toFixed(1)];
  });
  if (pts.length < 2) return null;
  const solid = values.every((v) => v !== null);
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {fill && solid ? (
        <polygon points={"0," + h + " " + pts.join(" ") + " " + w + "," + h} fill={color} opacity={0.1 * p} />
      ) : null}
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={p + " 1"}
      />
    </svg>
  );
};

/** 原文图版：paper 底 + 细边框 + 「原文」角标，子元素可用百分比坐标叠标注。 */
export const Fig: React.FC<{
  id: string; src: string; width: number; /** native size, so the box is sized before the image decodes */ w: number; h: number;
  at?: number; label?: string; tag?: string; filter?: string; children?: React.ReactNode;
}> = ({ id, src, width, w, h, at = 0, label, tag, filter, children }) => {
  const f = useCurrentFrame();
  const p = at === 0 ? 1 : pct(f, at, at + 24);
  return (
    <div style={{ width, opacity: p, position: "relative" }}>
      {/* The height is reserved from the native size. Without it the caption sits at the top of a
          zero-height box until the image decodes, and the DOM probe — which measures earlier than
          paint — reports the 「原文」badge and the caption overlapping: a gate failure on a frame
          that renders fine. */}
      <div style={{ position: "relative", width, height: Math.round((width * h) / w), background: C.paper, borderRadius: 8, overflow: "hidden", border: "1px solid " + C.panelLine, filter }}>
        <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
        {children}
        <div style={{
          position: "absolute", left: 0, top: 0, padding: "4px 10px",
          background: "rgba(26,26,23,0.82)", color: C.paper, fontFamily: FONT.mono, fontSize: FT.tiny, letterSpacing: FT_T.micro,
        }}>{"原文 " + (tag ?? id)}</div>
      </div>
      {label ? (
        <div style={{ fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkFaint, marginTop: 8 }}>{label}</div>
      ) : null}
    </div>
  );
};

export const Scene: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const f = useCurrentFrame();
  const i = SCENES.findIndex((s) => s.id === id);
  const s = SCENES[Math.max(0, i)];
  const dur = Math.max(1, Math.round(s.dur * FPS));
  return (
    <SceneShell>
      <ChapterBar chapter={s.chapter} index={i + 1} total={SCENES.length} progress={Math.min(1, f / dur)} />
      {children}
    </SceneShell>
  );
};

/* ---- 口播与画面同一拍 ---------------------------------------------------------------
 * 每个元素的入场都落在某句旁白的起点上，并在整场里均匀铺开。这些数字原来都是写死的
 * （10、40、80 帧）：全场在前四秒揭示完毕，剩下的时间画面一动不动。scripts/qa/pacing.py
 * 在成片上一帧一帧量过，最长有 16 秒完全没有变化 —— 旁白是唯一确定的时间轴，让它来定节拍，
 * 声音讲到哪儿，画面就长到哪儿。 */
export const sceneFrames = (id: string): number => {
  const s = SCENES.find((x) => x.id === id);
  return s ? Math.round(s.dur * FPS) : 900;
};

/** 本场每一句旁白的起点（相对本场，单位帧），相邻两句至少隔 8 帧。 */
export const beatFrames = (id: string): number[] => {
  const s = SCENES.find((x) => x.id === id);
  if (!s) return [];
  const from = s.start;
  const to = s.start + s.dur;
  const out: number[] = [];
  for (const l of LINES) {
    if (l.start < from || l.start >= to) continue;
    const f = Math.round((l.start - from) * FPS);
    if (f >= 0 && (out.length === 0 || f > out[out.length - 1] + 8)) out.push(f);
  }
  return out;
};

/** 第 i 个（共 n 个）揭示的帧：按比例均匀铺开，再吸附到最近的旁白起点。 */
export const beatAt = (id: string, i: number, n: number): number => {
  const target = (sceneFrames(id) * (i + 1)) / Math.max(1, n + 1);
  const beats = beatFrames(id);
  if (!beats.length) return Math.round(target);
  return beats.reduce((best, f) => (Math.abs(f - target) < Math.abs(best - target) ? f : best), beats[0]);
};