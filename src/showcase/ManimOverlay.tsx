import React from "react";
import { AbsoluteFill, OffthreadVideo, staticFile } from "remotion";
import { C, FONT } from "../design/tokens";
import { ChapterBar } from "../design/Scene";

/**
 * Manim 透明片段集成示范：manim 渲出带 alpha 的 webm，
 * Remotion 当素材叠在自绘背景上——公式进场景时可以「动」，且和 KaTeX 静态排版可混用。
 */
export const ManimOverlay: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink, padding: 72 }}>
    <ChapterBar chapter="Manim 透明图层" index={1} total={1} progress={0.4} />
    <div style={{ fontFamily: FONT.mono, fontSize: 22, color: C.cyan, letterSpacing: 3 }}>MANIM · ALPHA OVERLAY</div>
    <div style={{ fontFamily: FONT.serif, fontSize: 58, marginTop: 8 }}>公式可以「推」进来</div>
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center" }}>
      <OffthreadVideo src={staticFile("manim/Formula.mov")} transparent style={{ width: 1100 }} />
    </AbsoluteFill>
    <div style={{ position: "absolute", bottom: 90, left: 72, right: 72, fontSize: 26, color: C.inkDim }}>
      Manim CE 0.22 用 --format=mov 输出 qtrle(argb) 才带 alpha；webm 实测丢 alpha。
    </div>
  </AbsoluteFill>
);
