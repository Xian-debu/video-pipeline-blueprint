import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS, FONT_SERIF, PALETTE } from "../theme";
import type { Scene } from "../schema";

export const TitleScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg ?? PALETTE.paper;
  const s = spring({ frame, fps, config: { damping: 200 } });
  const rise = interpolate(s, [0, 1], [60, 0]);
  const line = interpolate(frame, [10, 40], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill
      style={{ background: scene.bg ?? PALETTE.ink, justifyContent: "center", alignItems: "center", padding: "0 10%" }}
    >
      <div
        style={{
          fontFamily: FONT_SERIF,
          fontSize: 128,
          color: fg,
          letterSpacing: 4,
          transform: `translateY(${rise}px)`,
          opacity: s,
          textAlign: "center",
        }}
      >
        {scene.title}
      </div>
      <div style={{ width: 520 * line, height: 6, background: PALETTE.accent, margin: "34px 0", borderRadius: 3 }} />
      {scene.subtitle ? (
        <div
          style={{
            fontFamily: FONT_SANS,
            fontSize: 44,
            color: fg,
            opacity: interpolate(frame, [20, 45], [0, 0.75], { extrapolateRight: "clamp" }),
            letterSpacing: 6,
          }}
        >
          {scene.subtitle}
        </div>
      ) : null}
    </AbsoluteFill>
  );
};
