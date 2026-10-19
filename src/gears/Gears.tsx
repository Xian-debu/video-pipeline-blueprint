import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FT } from "../design/tokens";
import { SCENES, LINES, FPS, TOTAL } from "./script";
import { SCENE_COMPONENTS } from "./scenes";

/**
 * 《啮合：齿轮如何把速度换成力》—— 第三部片，3D 为主、2D 为辅。
 *
 * 每一帧的几何都由 data/gears/params.json 算出来（src/gears/profile.ts），
 * 不是导入的模型：所以 scripts/qa/geometry_check.mjs 与 mesh_check.mjs
 * 验算的东西，就是画面上出现的东西。2D 只做标题、字幕、参数面板这三件事。
 *
 * 机的尺寸单位是毫米（模数 2、中心距 70），进 3D 前整体缩放 1/28。
 */

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Subtitle: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const line = LINES.find((c) => t >= c.start && t < c.start + c.dur);
  if (!line) return null;
  const local = (t - line.start) / line.dur;
  const o = interpolate(local, [0, 0.06, 0.94, 1], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          background: C.panel,
          border: "1px solid " + C.panelLine,
          borderRadius: 12,
          padding: "10px 26px",
          fontSize: FT.h2,
          color: C.ink,
          maxWidth: 1440,
          textAlign: "center",
          lineHeight: 1.45,
        }}
      >
        {line.speech}
      </div>
    </div>
  );
};

export const Gears: React.FC<{ music?: string | null; narration?: string | null }> = ({
  music = "music/gears.wav",
  narration = null,
}) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink }}>
    {music ? <Audio src={staticFile(music)} volume={0.16} /> : null}
    {narration ? <Audio src={staticFile(narration)} volume={1} /> : null}
    {SCENES.map((s, i) => (
      // Boundaries come from the next scene's start, not from this scene's duration rounded on its
      // own: two independent roundings leave a one-frame hole wherever the fractional parts differ
      // (the hole renders as a bare background — a black flash the flicker gate catches, K24).
      <Sequence
        key={s.id}
        from={Math.round(s.start * FPS)}
        durationInFrames={(i + 1 < SCENES.length ? Math.round(SCENES[i + 1].start * FPS) : TOTAL) - Math.round(s.start * FPS)}
      >
        {React.createElement(SCENE_COMPONENTS[s.id])}
      </Sequence>
    ))}
    <Subtitle />
  </AbsoluteFill>
);

export { TOTAL as GEARS_TOTAL, FPS as GEARS_FPS };
