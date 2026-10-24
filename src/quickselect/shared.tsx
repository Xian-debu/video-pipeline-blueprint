import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../design/tokens";
import { ChapterBar, SceneShell } from "../design/Scene";
import { SCENES, LINES, TOTAL, FPS, frameOf } from "./script";
import benchJson from "../../data/quickselect/bench.json";
import timingJson from "../../data/quickselect/timing.json";
import traceJson from "../../data/quickselect/trace.json";
import degJson from "../../data/quickselect/degradation.json";
import bfprtJson from "../../data/quickselect/bfprt.json";

/* 第六部片《快速选择》的共用件：派生数据、格式化、以及 12 场都会用到的小件。
 * 屏幕上的每个数字都必须经由这里的选取函数从 data/quickselect/*.json 读出来，
 * 不在场景里手写常数——这样旁白和画面才不会各说一套。 */

/* ---------- 数据类型（scripts/generate_quickselect_data.py 产出） ---------- */
export type BenchRow = {
  method: string; dist: string; n: number; n_measured: number; capped: boolean;
  k: number; k_sel: string; cmp: number; exch: number; depth: number;
  expected: number; got: number; ok: boolean;
};
export type TimingRow = {
  method: string; dist: string; n: number; n_measured: number; capped: boolean;
  k: number; cmp: number; exch: number; ms: number; ns_per_elem: number;
  cmp_per_elem: number; ns_per_cmp: number;
};
export type TraceStep = {
  action: string; array: number[]; i: number; j: number;
  pivot?: number; p?: number; lt?: boolean | number; gt?: number; value?: number; note?: string;
};
export type TraceData = {
  lomuto: { array: number[]; lo: number; hi: number; k: number; steps: TraceStep[] };
  threeway: { array: number[]; pivot: number; steps: TraceStep[] };
};
export type DegData = Record<string, { n: number; cmp: number; depth: number; exch?: number }[]>;
export type BfprtData = { n: number; k: number; cmp: number; cmp_per_elem: number; levels: { level: number; size: number; ratio: number }[] };

export const BENCH = (benchJson as unknown as { rows: BenchRow[]; meta: Record<string, unknown> }).rows;
export const TIMING = (timingJson as unknown as { rows: TimingRow[]; meta: Record<string, unknown> }).rows;
export const TRACE = traceJson as unknown as TraceData;
export const DEG = degJson as unknown as DegData;
export const BFPRT = bfprtJson as unknown as BfprtData;

/** 取一行比较账。k_sel: min | median | max | quartile。 */
export const R_ = (method: string, dist: string, n: number, kSel = "median"): BenchRow => {
  const row = BENCH.find((r) => r.method === method && r.dist === dist && r.n === n && r.k_sel === kSel);
  if (!row) throw new Error("no bench row " + [method, dist, n, kSel].join("/"));
  return row;
};
/** 取一行计时账。 */
export const T_ = (method: string, dist: string, n: number): TimingRow => {
  const row = TIMING.find((r) => r.method === method && r.dist === dist && r.n === n);
  if (!row) throw new Error("no timing row " + [method, dist, n].join("/"));
  return row;
};
/** 每元素比较次数：除以真正测过的长度（被截断的行按截断长度算）。 */
export const perElem = (r: { cmp: number; n_measured: number }) => r.cmp / r.n_measured;

/* ---------- 格式化 ---------- */
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const pct = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
export const PAD = G.pad;
export const CW = 1920 - PAD * 2;

/** 千分位整数。 */
export const comma = (v: number) => Math.round(v).toLocaleString("en-US");
/** 中文量的读法：1.49 亿 / 2352 万 / 7,429。 */
export const cn = (v: number) => {
  if (v >= 1e8) return (v / 1e8).toFixed(2) + " 亿";
  if (v >= 1e6) return Math.round(v / 1e4).toLocaleString("en-US") + " 万";
  if (v >= 1e4) return (v / 1e4).toFixed(1) + " 万";
  return comma(v);
};
/** 倍数的中文说法：13.0 → 13，1.8 → 1.8。 */
export const times = (v: number) => (v >= 10 ? v.toFixed(0) : v.toFixed(1));

/* ---------- 通用小件（与 arc/hawk 同源的版式） ---------- */
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

/** 计数器：从 from 数到 to，帧驱动（确定性）。 */
export const Big: React.FC<{
  from?: number; to: number; at: number; dur?: number; size?: number; color?: string;
  format?: (v: number) => string; style?: React.CSSProperties;
}> = ({ from = 0, to, at, dur = 30, size = FT.display, color = C.ink, format = comma, style }) => {
  const f = useCurrentFrame();
  const p = pct(f, at, at + dur);
  const v = from + (to - from) * p;
  return <div style={{ fontFamily: FONT.mono, fontSize: size, color, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, ...style }}>{format(v)}</div>;
};

/** 水平条：同一坐标系下比长度，数值在右侧。 */
export const Bar: React.FC<{
  label: string; value: number; max: number; color: string; w?: number; at?: number;
  text?: string; strong?: boolean; h?: number; labelW?: number;
}> = ({ label, value, max, color, w = 640, at = 0, text, strong, h = 18, labelW = 150 }) => {
  const f = useCurrentFrame();
  const p = pct(f, at, at + 24);
  const width = Math.max(2, (value / Math.max(1e-9, max)) * w * p);
  const done = p >= 1;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, height: Math.max(40, h + 22) }}>
      <div style={{ width: labelW, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkDim, textAlign: "right" }}>{label}</div>
      <div style={{ width: w, height: h, background: C.bgSoft, borderRadius: 4, overflow: "hidden", border: "1px solid " + C.panelLine }}>
        <div style={{ width, height: "100%", background: color, opacity: strong ? 0.95 : 0.6 }} />
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.mono, color: strong ? color : C.inkDim, fontVariantNumeric: "tabular-nums", minWidth: 120 }}>
        {done ? (text ?? comma(value)) : ""}
      </div>
    </div>
  );
};

/** 小胶囊标签。 */
export const Chip: React.FC<{ children: React.ReactNode; color?: string; at?: number; solid?: boolean }> = ({
  children, color = C.cyan, at = 0, solid,
}) => {
  const f = useCurrentFrame();
  const p = at === 0 ? 1 : pct(f, at, at + 12);
  return (
    <span style={{
      display: "inline-block", padding: "6px 14px", borderRadius: 999, opacity: p,
      border: "1px solid " + color, background: solid ? color : "transparent",
      color: solid ? C.bg : color, fontFamily: FONT.mono, fontSize: FT.meta, letterSpacing: FT_T.meta,
    }}>{children}</span>
  );
};

/** 表格：行按 at 逐行淡入，数字右对齐等宽。 */
export const Tbl: React.FC<{
  cols: { key: string; label: string; w?: number; align?: "left" | "right"; color?: string }[];
  rows: { key: string; cells: Record<string, React.ReactNode>; strong?: boolean }[];
  at?: number; stagger?: number; size?: number; rowH?: number; headColor?: string;
}> = ({ cols, rows, at = 0, stagger = 6, size = FT.mono, rowH = 44, headColor = C.inkFaint }) => {
  const f = useCurrentFrame();
  return (
    <div>
      <div style={{ display: "flex", borderBottom: "1px solid " + C.panelLine, paddingBottom: 8, marginBottom: 4 }}>
        {cols.map((c) => (
          <div key={c.key} style={{
            width: c.w, flex: c.w ? undefined : 1, textAlign: c.align ?? "left",
            padding: "0 14px", boxSizing: "border-box",
            fontFamily: FONT.mono, fontSize: FT.meta, letterSpacing: FT_T.meta, color: headColor,
          }}>{c.label}</div>
        ))}
      </div>
      {rows.map((r, i) => {
        const p = pct(f, at + i * stagger, at + i * stagger + 14);
        return (
          <div key={r.key} style={{
            display: "flex", height: rowH, alignItems: "center", opacity: p,
            borderBottom: "1px solid " + C.panelLine,
          }}>
            {cols.map((c) => (
              <div key={c.key} style={{
                width: c.w, flex: c.w ? undefined : 1, textAlign: c.align ?? "left",
                padding: "0 14px", boxSizing: "border-box",
                fontFamily: FONT.mono, fontSize: size, color: c.color ?? (r.strong ? C.ink : C.inkDim),
                fontVariantNumeric: "tabular-nums",
              }}>{r.cells[c.key]}</div>
            ))}
          </div>
        );
      })}
    </div>
  );
};

/** 数组条：把划分过程画成一排格子；格子颜色由这一步的状态决定。 */
export const ArrayStrip: React.FC<{
  values: number[]; at: number; states?: ("idle" | "lt" | "gt" | "eq" | "pivot" | "mark")[];
  segEnd?: number; segFrom?: number; size?: number; gap?: number; pointers?: { i?: number; j?: number; lt?: number; gt?: number };
}> = ({ values, at, states, size = 78, gap = 12, pointers }) => {
  const f = useCurrentFrame();
  const p = at === 0 ? 1 : pct(f, at, at + 12);
  const colorOf = (s?: string) =>
    s === "pivot" ? C.amber : s === "lt" ? C.cyan : s === "gt" ? C.coral : s === "eq" ? C.violet : s === "mark" ? C.cyanDeep : C.panelLine;
  return (
    <div style={{ opacity: p, position: "relative" }}>
      <div style={{ display: "flex", gap, alignItems: "flex-end" }}>
        {values.map((v, i) => {
          const st = states?.[i];
          return (
            <div key={i} style={{ width: size, textAlign: "center" }}>
              <div style={{
                height: size, display: "flex", alignItems: "center", justifyContent: "center",
                borderRadius: 10, border: "1px solid " + colorOf(st),
                borderWidth: st && st !== "idle" ? 2 : 1,
                background: st === "idle" || !st ? C.panel : "rgba(94,234,212,0.07)",
                fontFamily: FONT.mono, fontSize: Math.round(size * 0.34),
                color: st === "idle" || !st ? C.inkDim : C.ink,
              }}>{v}</div>
              <div style={{ marginTop: 6, fontFamily: FONT.mono, fontSize: FT.tiny, color: C.inkFaint }}>{i}</div>
            </div>
          );
        })}
      </div>
      {pointers ? (
        <div style={{ display: "flex", gap, marginTop: 4 }}>
          {values.map((_, i) => (
            <div key={i} style={{ width: size, textAlign: "center", fontFamily: FONT.mono, fontSize: FT.tiny, color: C.cyan }}>
              {pointers.lt === i ? "lt" : pointers.i === i ? "i" : pointers.j === i ? "j" : pointers.gt === i ? "gt" : " "}
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
};

/** 折线（同 arc 的 Line，pathLength 描边，确定性）。 */
export const Line: React.FC<{
  values: (number | null)[]; w: number; h: number; lo: number; hi: number;
  color: string; width?: number; at: number; dur?: number; fill?: boolean;
}> = ({ values, w, h, lo, hi, color, width = 2, at, dur = 40, fill }) => {
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
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {fill ? <polygon points={"0," + h + " " + pts.join(" ") + " " + w + "," + h} fill={color} opacity={0.08 * p} /> : null}
      <polyline points={pts.join(" ")} fill="none" stroke={color} strokeWidth={width}
        strokeLinejoin="round" pathLength={1} strokeDasharray={p + " 1"} />
    </svg>
  );
};

/** 场景壳：ChapterBar + 进度。 */
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

/* ---- 口播与画面同一拍 ---- */
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

/** 句起点（相对本场帧号）由 script.ts 统一算，场景组件直接用它对齐画面与口播。 */
export { frameOf };

/** 某方法的墙钟毫秒；计时账里没有就返回 NaN（场景负责显示占位）。 */
export const msOf = (method: string, dist: string, n: number): number => {
  const row = TIMING.find((r) => r.method === method && r.dist === dist && r.n === n);
  return row ? row.ms : NaN;
};
/** 页脚证据条：这一屏的数字出自哪个文件、哪一行。让「有出处」变成画面的一部分。 */
export const Foot: React.FC<{ at?: number; children: React.ReactNode }> = ({ at = 0, children }) => {
  const f = useCurrentFrame();
  const p = at === 0 ? 1 : pct(f, at, at + 14);
  return (
    <div style={{
      position: "absolute", left: PAD, bottom: 112, opacity: p,
      fontFamily: FONT.mono, fontSize: FT.micro, color: C.inkFaint, letterSpacing: FT_T.micro,
    }}>{children}</div>
  );
};
