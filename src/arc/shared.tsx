import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../design/tokens";
import { ChapterBar, SceneShell } from "../design/Scene";
import { SCENES, LINES, TOTAL, FPS } from "./script";
import simJson from "../../data/arc/sim.json";
import evalJson from "../../data/arc/eval.json";

/* 第五部片（ARC 论文解读）的共用件：账本数据、字号/间距、场景壳，以及 12 场都会用到的小件。
 * 拆分理由同 Hawk（docs/known-issues.md K29）：每场一个文件，放在 scenes/ 下。 */

/* ---------- 数据类型（由 scripts/generate_arc_data.py 产出） ---------- */
export type SimData = {
  source: string; note: string; seed: number; pages: number; requests: number;
  cacheSizes: number[];
  sweep: { cachePages: number[]; arc: number[]; lru: number[]; frc: Record<string, number[]> };
  walk: { c: number; every: number; p: number[]; pMin: number; pMax: number; t1: number[]; t2: number[] };
  caseMix: Record<string, number>; caseMixPct: Record<string, number>; caseMixTotal: number;
  scan: {
    c: number; pre: number; scan: number; post: number;
    preRatio: { arc: number; lru: number };
    post100: { arc: number; lru: number };
    t2AtScanEnd: number;
    rows: { at: number; hit: boolean; p: number; t1: number; t2: number }[];
    ratios: { at: number; arc: number; lru: number; p: number }[];
  };
  tape: { c: number; rows: { page: number; hit: boolean; p: number; t1: number; t2: number; b1: number; b2: number }[] };
};

export const SIM = simJson as unknown as SimData;
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
  values: (number | null)[]; w: number; h: number; lo: number; hi: number;
  color: string; width?: number; at: number; dur?: number; fill?: boolean; dash?: boolean;
}> = ({ values, w, h, lo, hi, color, width = 2, at, dur = 40, fill, dash }) => {
  const f = useCurrentFrame();
  const p = pct(f, at, at + dur);
  if (!values.length) return null;
  const span = hi - lo || 1;
  const pts = values.flatMap((v, i) => {
    if (v === null) return [];
    const x = (i / Math.max(1, values.length - 1)) * w;
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
        strokeDasharray={dash ? "0.01 0.012" : p + " 1"}
      />
    </svg>
  );
};

/** 原文图版：paper 底 + 细边框 + 「原文」角标，子元素可用百分比坐标叠标注。 */
export const Fig: React.FC<{
  id: string; src: string; width: number; w: number; h: number;
  at?: number; label?: string; tag?: string; filter?: string; children?: React.ReactNode;
}> = ({ id, src, width, w, h, at = 0, label, tag, filter, children }) => {
  const f = useCurrentFrame();
  const p = at === 0 ? 1 : pct(f, at, at + 24);
  return (
    <div style={{ width, opacity: p, position: "relative" }}>
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

/** 一页：缓存里的小方格。dim = 幽灵（只留页号），fresh = 刚被放进来的高亮。 */
export const Cell: React.FC<{
  label?: string | number; size?: number; dim?: boolean; fresh?: boolean; accent?: string; title?: string;
}> = ({ label, size = 52, dim, fresh, accent = C.cyan, title }) => (
  <div style={{
    width: size, height: size, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
    background: dim ? "transparent" : fresh ? "rgba(120,200,220,0.18)" : C.panel,
    border: "1px solid " + (fresh ? accent : dim ? C.panelLine : C.panelLine),
    borderStyle: dim ? "dashed" : "solid",
    color: dim ? C.inkFaint : C.ink,
    fontFamily: FONT.mono, fontSize: Math.round(size * 0.34), opacity: dim ? 0.75 : 1,
  }} title={title}>{label}</div>
);

/** 一条 LRU 列表：从左到右 = MRU → LRU。 */
export const ListRow: React.FC<{
  name: string; cells: (string | number)[]; cap?: number; w?: number; at?: number; accent?: string; ghost?: boolean; size?: number;
}> = ({ name, cells, cap, w, at = 0, accent = C.cyan, ghost, size }) => {
  const f = useCurrentFrame();
  const p = at === 0 ? 1 : pct(f, at, at + 18);
  const s = size ?? (w ? Math.max(18, Math.min(46, Math.floor(w / Math.max(1, cells.length)) - 6)) : 40);
  return (
    <div style={{ opacity: p }}>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, letterSpacing: FT_T.meta, color: ghost ? C.inkFaint : C.inkDim, marginBottom: 8 }}>
        {name}{cap ? " · 上限 " + cap : ""}
      </div>
      <div style={{ display: "flex", gap: 6, flexWrap: "nowrap" }}>
        {cells.map((c, i) => <Cell key={i} label={c} size={s} dim={ghost} fresh={i === 0 && !ghost} accent={accent} />)}
        {!cells.length ? <Mono color={C.inkFaint}>（空）</Mono> : null}
      </div>
    </div>
  );
};

/** 水平对比条：同一行两个数（如 LRU 与 ARC），宽度按 max 归一。 */
export const BarRow: React.FC<{
  label: string; value: number; max: number; color: string; w?: number; at?: number; suffix?: string; strong?: boolean; note?: string;
}> = ({ label, value, max, color, w = 520, at = 0, suffix = "%", strong, note }) => {
  const f = useCurrentFrame();
  const p = pct(f, at, at + 26);
  const width = Math.max(2, (value / Math.max(1e-6, max)) * w * p);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, height: 44 }}>
      <div style={{ width: 118, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkDim, textAlign: "right" }}>{label}</div>
      <div style={{ width, height: 16, background: C.panel, borderRadius: 4, overflow: "hidden", border: "1px solid " + C.panelLine }}>
        <div style={{ width, height: "100%", background: color, opacity: strong ? 0.95 : 0.55 }} />
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.mono, color: strong ? color : C.inkDim, fontVariantNumeric: "tabular-nums" }}>
        {p >= 1 ? value.toFixed(2) + suffix : ""}
      </div>
      {note ? <div style={{ fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkFaint }}>{note}</div> : null}
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

/* ---- 口播与画面同一拍（同 Hawk）：每场的入场落在某句旁白的起点上 ---- */
export const sceneFrames = (id: string): number => {
  const s = SCENES.find((x) => x.id === id);
  return s ? Math.round(s.dur * FPS) : 900;
};

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

export const beatAt = (id: string, i: number, n: number): number => {
  const target = (sceneFrames(id) * (i + 1)) / Math.max(1, n + 1);
  const beats = beatFrames(id);
  if (!beats.length) return Math.round(target);
  return beats.reduce((best, f) => (Math.abs(f - target) < Math.abs(best - target) ? f : best), beats[0]);
};

export const TOTAL_SEC = TOTAL / FPS;
