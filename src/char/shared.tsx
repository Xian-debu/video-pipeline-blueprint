import React from "react";
import { interpolate, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../design/tokens";
import { ChapterBar, SceneShell } from "../design/Scene";
import { SCENES, LINES, TOTAL, FPS, frameOf } from "./script";
import gateJson from "../../data/char/gate.json";
import refJson from "../../data/char/ref_views.json";
import bonesJson from "../../data/char/bones.json";
import { PLATES } from "./plates";
export { PLATES };

/* 第七部片《从一张三视图到会走路的胖梨》的共用件。
 *
 * 屏幕上的每一个测量数字都从这三个账本读出来，不在场景里手写：
 *   data/char/gate.json     建模的判据（scripts/char/check.py 写）
 *   data/char/plates.json   贴片的账（scripts/char/gen.py 渲，manifest.py 裁）
 *   data/char/bones.json    骨架（scripts/char/bones.py 是唯一来源）
 * 讲稿里念的数字与这三个账本是同一批数，所以旁白不会和画面对不上。 */

export type GateView = {
  iou: number;
  min_iou: number;
  w_over_h_render: number;
  w_over_h_ref: number;
  w_over_h_err: number;
  profile_rmse: number;
  pass: boolean;
};
export type Gate = {
  reference: { path: string; sha256: string; bytes: number };
  thresholds: { iou: Record<string, number>; w_over_h: number; profile_rmse: number };
  views: Record<string, GateView>;
  anchors: Record<string, unknown>;
  checks: Record<string, boolean>;
  pass: boolean;
};
export type RefView = {
  bbox: [number, number, number, number];
  h: number;
  prof128: [number | null, number | null][];
  crotch_rel: number | null;
};
export type Bone = { name: string; head: [number, number, number]; tail: [number, number, number]; parent: string | null };

export const GATE = gateJson as unknown as Gate;
export const REF = refJson as unknown as Record<"front" | "side" | "back", RefView>;
export const BONES = (bonesJson as unknown as { bones: Bone[] }).bones;
export const VIEWS: ("front" | "side" | "back")[] = ["front", "side", "back"];

/** 取一个视图的判据行。 */
export const V_ = (v: string): GateView => {
  const row = GATE.views[v];
  if (!row) throw new Error("no gate view " + v);
  return row;
};
/** 三位小数（判据一律三位，念稿与屏幕一致）。 */
export const f3 = (v: number) => v.toFixed(3);
/** 百分比，一位小数。 */
export const pc1 = (v: number) => (v * 100).toFixed(1) + "%";

/* ---------- 格式化 ---------- */
export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const pct = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
export const PAD = G.pad;
export const CW = 1920 - PAD * 2;

/** 千分位整数。 */
export const comma = (v: number) => Math.round(v).toLocaleString("en-US");
/** 万/千分位。 */
export const cn = (v: number) => (v >= 1e4 ? (v / 1e4).toFixed(1) + " 万" : comma(v));

/* ---------- 通用小件（与 quickselect 同源的版式） ---------- */
export const Head: React.FC<{ kicker: string; title: string; goal?: string; top?: number }> = ({ kicker, title, goal, top = 92 }) => (
  <div style={{ position: "absolute", left: PAD, top, width: CW }}>
    <div style={{ fontFamily: FONT.mono, fontSize: FT.label, letterSpacing: FT_T.label, color: C.cyan }}>{kicker}</div>
    <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10, lineHeight: 1.15 }}>{title}</div>
    {goal ? <div style={{ fontFamily: FONT.sans, fontSize: FT.label, color: C.inkFaint, marginTop: 10 }}>{goal}</div> : null}
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
}> = ({ from = 0, to, at, dur = 30, size = FT.display, color = C.ink, format = f3, style }) => {
  const f = useCurrentFrame();
  const p = pct(f, at, at + dur);
  const v = from + (to - from) * p;
  return <div style={{ fontFamily: FONT.mono, fontSize: size, color, fontVariantNumeric: "tabular-nums", lineHeight: 1.1, ...style }}>{format(v)}</div>;
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
}> = ({ cols, rows, at = 0, stagger = 5, size = FT.mono, rowH = 46, headColor = C.inkFaint }) => {
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

/** 横条：同一坐标系下比长度。 */
export const Bar: React.FC<{
  label: string; value: number; max: number; color: string; w?: number; at?: number;
  text?: string; strong?: boolean; h?: number; labelW?: number; min?: number;
}> = ({ label, value, max, color, w = 560, at = 0, text, strong, h = 18, labelW = 150, min = 0 }) => {
  const f = useCurrentFrame();
  const p = pct(f, at, at + 24);
  const frac = Math.max(0, Math.min(1, (value - min) / Math.max(1e-9, max - min)));
  const width = Math.max(2, frac * w * p);
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, height: Math.max(40, h + 22) }}>
      <div style={{ width: labelW, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkDim, textAlign: "right" }}>{label}</div>
      <div style={{ width: w, height: h, background: C.bgSoft, borderRadius: 4, overflow: "hidden", border: "1px solid " + C.panelLine }}>
        <div style={{ width, height: "100%", background: color, opacity: strong ? 0.95 : 0.6 }} />
      </div>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.mono, color: strong ? color : C.inkDim, fontVariantNumeric: "tabular-nums", minWidth: 130 }}>
        {text ?? f3(value)}
      </div>
    </div>
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

/** 页脚证据条：这一屏的数字出自哪个文件。让「有出处」变成画面的一部分。 */
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

/* ---- 口播与画面同一拍（与 quickselect 同一套节拍函数） ---- */
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

export const TOTAL_SEC = TOTAL / FPS;
export const PLATE_SECONDS = PLATES.seconds;
export const PLATE_COUNT = PLATES.count;

export { frameOf };
