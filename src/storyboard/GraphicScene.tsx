import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS, PALETTE } from "../theme";
import { SB, SB_T } from "../design/tokens";
import type { Scene } from "../schema";

export const GraphicScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const fg = scene.fg ?? PALETTE.paper;
  const bars = [0.62, 0.86, 0.47];
  return (
    <AbsoluteFill style={{ background: scene.bg ?? PALETTE.ink2, padding: "100px 120px", fontFamily: FONT_SANS }}>
      <div style={{ fontSize: SB.overline, color: PALETTE.muted, letterSpacing: SB_T.overline }}>OVERVIEW</div>
      <div style={{ fontSize: SB.headline, color: fg, marginTop: 12, fontWeight: 700 }}>{scene.title}</div>
      <div style={{ display: "flex", gap: 40, marginTop: 80 }}>
        {(scene.bullets ?? []).map((b, i) => {
          const s = spring({ frame: frame - 10 - i * 8, fps, config: { damping: 200 } });
          return (
            <div
              key={b}
              style={{
                flex: 1,
                background: "rgba(255,255,255,0.05)",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: 18,
                padding: 36,
                transform: `translateY(${(1 - s) * 70}px)`,
                opacity: s,
              }}
            >
              <div style={{ fontSize: SB.ordinal, color: PALETTE.accent2, letterSpacing: SB_T.ordinal }}>0{i + 1}</div>
              <div style={{ fontSize: SB.card, color: fg, marginTop: 14 }}>{b}</div>
              <div style={{ height: 12, marginTop: 28, borderRadius: 6, background: "rgba(255,255,255,0.10)", overflow: "hidden" }}>
                <div
                  style={{
                    width: `${interpolate(frame, [20 + i * 10, 55 + i * 10], [0, bars[i] * 100], { extrapolateRight: "clamp" })}%`,
                    height: "100%",
                    background: PALETTE.accent,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          left: 120,
          right: 120,
          bottom: 90,
          height: 2,
          background: "rgba(255,255,255,0.18)",
          transform: `scaleX(${interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" })})`,
          transformOrigin: "left",
        }}
      />
    </AbsoluteFill>
  );
};
