import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";

/**
 * 二维排版层（第八部片）。所有元素都由帧驱动：淡入、位移、计数都是帧的函数，
 * 没有 CSS 动画（AGENTS.md 禁止），所以同一帧两次渲染是同一张图。
 *
 * 字号只从 film 字号族取：标题 h1=54、正文 body=26、小字 label=21、数字 num=40。
 * still_lint 要求正文 ≥26 px、每行 ≤34 字，讲稿在 script.ts 里已经卡住 34 字。
 */

export const PAD = G.pad;
export const W = 1920 - PAD * 2;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const rv = (f: number, at: number, dur = 14) => interpolate(f, [at, at + dur], [0, 1], clamp);

/** 场景标题块（左上）。at 给延迟。 */
export const Head: React.FC<{ kicker: string; title: string; goal?: string; at?: number; top?: number }> = ({
  kicker,
  title,
  goal,
  at = 0,
  top = 92,
}) => {
  const f = useCurrentFrame();
  const p = rv(f, at);
  return (
    <div style={{ position: "absolute", left: PAD, top, width: W * 0.62, opacity: p, transform: `translateY(${(1 - p) * 14}px)` }}>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.label, letterSpacing: FT_T.label, color: C.cyan }}>{kicker}</div>
      <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10, lineHeight: 1.18 }}>{title}</div>
      {goal ? <div style={{ fontFamily: FONT.sans, fontSize: FT.body, color: C.inkDim, marginTop: 12 }}>{goal}</div> : null}
    </div>
  );
};

/** 要点行：左边一条竖线 + 一行字，逐条出现。 */
export const Row: React.FC<{ children: React.ReactNode; at: number; color?: string; num?: string }> = ({
  children,
  at,
  color = C.cyan,
  num,
}) => {
  const f = useCurrentFrame();
  const p = rv(f, at, 10);
  return (
    <div style={{ display: "flex", alignItems: "flex-start", gap: 14, opacity: p, transform: `translateX(${(1 - p) * 16}px)` }}>
      <div style={{ width: 3, alignSelf: "stretch", background: color, opacity: 0.75, borderRadius: 2 }} />
      <div style={{ fontFamily: FONT.sans, fontSize: FT.body, color: C.ink, lineHeight: 1.55 }}>
        {num ? <span style={{ fontFamily: FONT.mono, color, marginRight: 10 }}>{num}</span> : null}
        {children}
      </div>
    </div>
  );
};

/** 大数字：从 from 数到 to。 */
export const Stat: React.FC<{
  to: number;
  label: string;
  at: number;
  from?: number;
  unit?: string;
  fmt?: (v: number) => string;
  color?: string;
  size?: number;
}> = ({ to, label, at, from = 0, unit, fmt, color = C.ink, size = FT.display }) => {
  const f = useCurrentFrame();
  const p = rv(f, at, 26);
  const v = from + (to - from) * p;
  const text = fmt ? fmt(v) : v.toFixed(2);
  return (
    <div style={{ opacity: rv(f, at, 10) }}>
      <div style={{ fontFamily: FONT.mono, fontSize: size, color, lineHeight: 1.05, fontVariantNumeric: "tabular-nums" }}>
        {text}
        {unit ? <span style={{ fontSize: size * 0.42, color: C.inkDim, marginLeft: 6 }}>{unit}</span> : null}
      </div>
      <div style={{ fontFamily: FONT.sans, fontSize: FT.label, color: C.inkFaint, marginTop: 8 }}>{label}</div>
    </div>
  );
};

/** 图版：带细框与角标。可选缓慢推近（Ken Burns），保证"看图"时画面也在动。 */
export const Plate: React.FC<{
  src: string;
  left: number;
  top: number;
  width: number;
  label?: string;
  at?: number;
  zoom?: number;
  fit?: "contain" | "cover";
  height?: number;
  bg?: string;
}> = ({ src, left, top, width, label, at = 0, zoom = 0.04, fit = "contain", height, bg = "#0d161c" }) => {
  const f = useCurrentFrame();
  const p = rv(f, at, 12);
  const z = 1 + zoom * (f / 240);
  return (
    <div style={{ position: "absolute", left, top, width, height, opacity: p }}>
      <div style={{ position: "relative", overflow: "hidden", borderRadius: 10, border: `1px solid ${C.panelLine}`, background: bg, height }}>
        <div style={{ width: "100%", height: "100%", transform: `scale(${z})` }}>
          <Img src={staticFile(src)} style={{ width: "100%", height: "100%", objectFit: fit }} />
        </div>
      </div>
      {label ? (
        <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, letterSpacing: FT_T.meta, color: C.inkFaint, marginTop: 8 }}>{label}</div>
      ) : null}
    </div>
  );
};

/** 代码/命令块。 */
export const Cmd: React.FC<{ children: React.ReactNode; at?: number; accent?: boolean }> = ({ children, at = 0, accent }) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        fontFamily: FONT.mono,
        fontSize: FT.mono,
        color: accent ? C.cyan : C.inkDim,
        opacity: rv(f, at, 10),
        lineHeight: 1.7,
        whiteSpace: "pre",
      }}
    >
      {children}
    </div>
  );
};

/** 色块 + 名字。 */
export const Swatch: React.FC<{ rgb: [number, number, number]; name: string; at: number; on?: boolean }> = ({
  rgb,
  name,
  at,
  on = false,
}) => {
  const f = useCurrentFrame();
  const p = rv(f, at, 10);
  const css = `rgb(${rgb.map((v) => Math.round(Math.pow(v, 1 / 2.2) * 255)).join(",")})`;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, opacity: p, transform: `scale(${on ? 1.06 : 1})` }}>
      <div style={{ width: 34, height: 34, borderRadius: 9, background: css, border: `2px solid ${on ? C.cyan : "transparent"}` }} />
      <div style={{ fontFamily: FONT.mono, fontSize: FT.label, color: on ? C.ink : C.inkFaint }}>{name}</div>
    </div>
  );
};

/** 公式/记号块（深底细框）。 */
export const Fx: React.FC<{ children: React.ReactNode; at?: number; left?: number; top?: number; width?: number }> = ({
  children,
  at = 0,
  left,
  top,
  width,
}) => {
  const f = useCurrentFrame();
  return (
    <div
      style={{
        position: left === undefined ? "relative" : "absolute",
        left,
        top,
        width,
        padding: "16px 22px",
        background: "rgba(9,17,22,0.72)",
        border: `1px solid ${C.panelLine}`,
        borderRadius: 10,
        opacity: rv(f, at, 12),
        fontFamily: FONT.mono,
        fontSize: FT.mono,
        color: C.inkDim,
        lineHeight: 1.7,
        whiteSpace: "pre",
      }}
    >
      {children}
    </div>
  );
};
