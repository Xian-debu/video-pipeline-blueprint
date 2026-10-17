import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { C, FONT } from "../design/tokens";
import { SceneShell, ChapterBar, fadeFramesFor } from "../design/Scene";

// 深底(#0B0F14, luma≈14) → 纸白(#F3EEE3, luma≈238)：跨度 224 → 24 帧；纸白 → 软底(≈24)：跨度 214 → 24 帧
const FADE_DARK_TO_PAPER = fadeFramesFor(224);
const FADE_PAPER_TO_SOFT = fadeFramesFor(214);
import { Build, CountRoll, ArcSwap } from "../design/primitives";

const Card: React.FC<{ title: string; children: React.ReactNode; accent?: string }> = ({ title, children, accent = C.cyan }) => (
  <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 18, padding: "22px 26px" }}>
    <div style={{ fontFamily: FONT.mono, fontSize: 17, letterSpacing: 2, color: accent }}>{title}</div>
    <div style={{ marginTop: 10 }}>{children}</div>
  </div>
);

const SceneA: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <SceneShell bg={C.bg}>
      <ChapterBar chapter="动效原语" index={1} total={3} progress={interpolate(f, [0, 80], [0, 1], { extrapolateRight: "clamp" })} />
      <div style={{ fontFamily: FONT.mono, fontSize: 22, color: C.cyan, letterSpacing: 3 }}>MOTION PRIMITIVES</div>
      <div style={{ fontFamily: FONT.serif, fontSize: 62, marginTop: 8 }}>不是瞬移，是过程</div>
      <div style={{ display: "flex", gap: 28, marginTop: 34 }}>
        <Build at={10} style={{ flex: 1 }}>
          <Card title="COUNT ROLL">
            <CountRoll to={10969} start={14} size={56} color={C.cyan} />
            <div style={{ fontSize: 22, color: C.inkDim, marginTop: 6 }}>真实比较次数（n=1000）</div>
          </Card>
        </Build>
        <Build at={24} style={{ flex: 1 }}>
          <Card title="ARC SWAP" accent={C.coral}>
            <ArcSwap values={[7, 2, 1, 6, 8]} from={0} to={4} progress={interpolate(f, [20, 56], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })} />
            <div style={{ fontSize: 22, color: C.inkDim, marginTop: 8 }}>交换沿弧线走，观众能看见「谁去了哪」</div>
          </Card>
        </Build>
      </div>
    </SceneShell>
  );
};

const SceneB: React.FC = () => (
  <SceneShell bg={C.paper}>
    <div style={{ color: C.paperInk }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 22, color: C.coralDeep, letterSpacing: 3 }}>TRANSITION</div>
      <div style={{ fontFamily: FONT.serif, fontSize: 62, marginTop: 8 }}>硬切会闪，淡变不会</div>
      <div style={{ fontSize: 28, marginTop: 20, lineHeight: 1.7 }}>
        相邻两帧平均亮度差必须 ≤ 12/255。深底到亮底跨度 224 级，用 {FADE_DARK_TO_PAPER} 帧淡变跨过去——12 帧不够，实测每帧差 18.7。
      </div>
    </div>
  </SceneShell>
);

const SceneC: React.FC = () => (
  <SceneShell bg={C.bgSoft}>
    <div style={{ fontFamily: FONT.serif, fontSize: 58 }}>滑入转场 · 同一套时间轴</div>
    <div style={{ fontSize: 26, color: C.inkDim, marginTop: 18 }}>TransitionSeries 只在场景交界处花帧，不破坏逐帧可复现。</div>
  </SceneShell>
);

export const Transitions: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <TransitionSeries>
      <TransitionSeries.Sequence durationInFrames={72}>
        <SceneA />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_DARK_TO_PAPER })} />
      <TransitionSeries.Sequence durationInFrames={54}>
        <SceneB />
      </TransitionSeries.Sequence>
      <TransitionSeries.Transition presentation={fade()} timing={linearTiming({ durationInFrames: FADE_PAPER_TO_SOFT })} />
      <TransitionSeries.Sequence durationInFrames={54}>
        <SceneC />
      </TransitionSeries.Sequence>
    </TransitionSeries>
  </AbsoluteFill>
);
