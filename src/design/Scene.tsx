import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT } from "./tokens";

/**
 * 场景外壳：统一底色 + 入场/出场淡变。
 * 目的：消除「硬切闪白」——任意场景切换时亮度在 8-12 帧内连续过渡，
 * 相邻帧平均亮度差（QA 阈值 12/255）永远达标。
 */
export const SceneShell: React.FC<{
  children: React.ReactNode;
  fadeIn?: number;
  fadeOut?: number;
  bg?: string;
  pad?: number;
}> = ({ children, fadeIn = 0, fadeOut = 0, bg = C.bg, pad = 72 }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  // fadeIn/fadeOut 允许为 0（硬切）：interpolate 的 inputRange 必须严格递增，为 0 时直接跳过。
  const inO = fadeIn <= 0 ? 1 : interpolate(f, [0, fadeIn], [0, 1], { extrapolateRight: "clamp" });
  const outO =
    fadeOut <= 0
      ? 1
      : interpolate(f, [durationInFrames - fadeOut, durationInFrames], [1, 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
  return (
    <AbsoluteFill style={{ background: bg }}>
      <AbsoluteFill style={{ opacity: Math.min(inO, outO), padding: pad, fontFamily: FONT.sans, color: C.ink }}>
        {children}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

/**
 * 跨亮度区间切换时该用多少帧做淡变。
 * 实测结论：12 帧淡变跨越 224 级亮度，单帧差仍有 18.7 > 阈值 12/255 会被 QA 判失败。
 * 因此按「每帧最多变化 10 级」反推帧数，再留 2 帧余量。
 */
export const fadeFramesFor = (deltaLuma: number, perFrame = 10, min = 10) =>
  Math.max(min, Math.ceil(Math.abs(deltaLuma) / perFrame) + 2);

/** 章节条：任意帧都能知道「现在在第几章」。 */
export const ChapterBar: React.FC<{ chapter: string; index: number; total: number; progress: number }> = ({
  chapter,
  index,
  total,
  progress,
}) => (
  <>
    <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: C.panelLine }}>
      <div style={{ width: (progress * 100).toFixed(3) + "%", height: 3, background: C.cyan }} />
    </div>
    <div
      style={{
        position: "absolute",
        top: 26,
        right: 72,
        fontFamily: FONT.mono,
        fontSize: 18,
        letterSpacing: 2,
        color: C.inkFaint,
      }}
    >
      {String(index).padStart(2, "0")} / {String(total).padStart(2, "0")} · {chapter}
    </div>
  </>
);
