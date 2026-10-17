import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "./tokens";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 逐项淡入上移（替代一次性铺满屏幕）。 */
export const Build: React.FC<{
  at: number;
  children: React.ReactNode;
  dy?: number;
  dur?: number;
  style?: React.CSSProperties;
}> = ({ at, children, dy = 18, dur = 12, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [at, at + dur], [0, 1], clamp);
  return (
    <div style={{ opacity: p, transform: "translateY(" + (1 - p) * dy + "px)", ...style }}>{children}</div>
  );
};

/** 数字滚动（计数），用于「比较次数」这类量。 */
export const CountRoll: React.FC<{ from?: number; to: number; start: number; dur?: number; size?: number; color?: string; suffix?: string }> = ({
  from = 0,
  to,
  start,
  dur = 30,
  size = 64,
  color = C.ink,
  suffix = "",
}) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [start, start + dur], [0, 1], clamp);
  const v = Math.round(from + (to - from) * p);
  return (
    <span style={{ fontFamily: FONT.mono, fontSize: size, color, fontVariantNumeric: "tabular-nums" }}>
      {v.toLocaleString("en-US")}
      {suffix}
    </span>
  );
};

/** 弧线交换：数组两格沿二次贝塞尔互换（不是瞬移）。 */
export const ArcSwap: React.FC<{
  values: number[];
  from: number;
  to: number;
  progress: number;
  cell?: number;
}> = ({ values, from, to, progress, cell = 68 }) => {
  const gap = 8;
  const idx = (i: number) => i * (cell + gap);
  const lift = 62 * Math.sin(Math.PI * progress);
  const x1 = idx(from) + (idx(to) - idx(from)) * progress;
  const x2 = idx(to) + (idx(from) - idx(to)) * progress;
  return (
    <div style={{ position: "relative", height: cell, width: values.length * (cell + gap) }}>
      {values.map((v, i) => {
        const moving = i === from || i === to;
        const x = i === from ? x1 : i === to ? x2 : idx(i);
        const y = moving ? -lift : 0;
        const opacity = i === from || i === to ? 1 : 0.55;
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              left: 0,
              top: 0,
              transform: "translate(" + x + "px," + y + "px)",
              width: cell,
              height: cell,
              borderRadius: 12,
              border: "1.5px solid " + (moving ? C.cyan : C.panelLine),
              background: moving ? "rgba(94,234,212,0.10)" : C.panel,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT.mono,
              fontSize: 34,
              color: moving ? C.cyan : C.ink,
              opacity,
            }}
          >
            {v}
          </div>
        );
      })}
    </div>
  );
};

/** 本章目标（一句话）——强制每个场景先讲「为什么要看这个」。 */
export const SceneGoal: React.FC<{ text: string }> = ({ text }) => (
  <div style={{ fontSize: 22, color: C.inkFaint, marginTop: 6, marginBottom: 18 }}>本段目标：{text}</div>
);
