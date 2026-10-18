import React from "react";
import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS } from "../theme";
import { useFill, useRole } from "../design/palette";
import { SB, SB_T } from "../design/tokens";
import type { Scene } from "../schema";

export const GraphicScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const primary = useRole("text.primary");
  const secondary = useRole("text.secondary");
  const secondaryAccent = useRole("accent.secondary");
  const accent = useRole("accent.primary");
  const surface = useRole("surface");
  const tint = useFill("surface.tint");
  const tintStrong = useFill("surface.tintStrong");
  const hairline = useFill("surface.hairline");
  const rule = useFill("surface.rule");
  const fg = scene.fg ?? primary;
  const bars = [0.62, 0.86, 0.47];
  return (
    <AbsoluteFill style={{ background: scene.bg ?? surface, padding: "100px 120px", fontFamily: FONT_SANS }}>
      <div style={{ fontSize: SB.overline, color: secondary, letterSpacing: SB_T.overline }}>OVERVIEW</div>
      <div style={{ fontSize: SB.headline, color: fg, marginTop: 12, fontWeight: 700 }}>{scene.title}</div>
      <div style={{ display: "flex", gap: 40, marginTop: 80 }}>
        {(scene.bullets ?? []).map((b, i) => {
          const s = spring({ frame: frame - 10 - i * 8, fps, config: { damping: 200 } });
          return (
            <div
              key={b}
              style={{
                flex: 1,
                background: tint,
                border: "1px solid " + hairline,
                borderRadius: 18,
                padding: 36,
                transform: `translateY(${(1 - s) * 70}px)`,
                opacity: s,
              }}
            >
              <div style={{ fontSize: SB.ordinal, color: secondaryAccent, letterSpacing: SB_T.ordinal }}>0{i + 1}</div>
              <div style={{ fontSize: SB.card, color: fg, marginTop: 14 }}>{b}</div>
              <div style={{ height: 12, marginTop: 28, borderRadius: 6, background: tintStrong, overflow: "hidden" }}>
                <div
                  style={{
                    width: `${interpolate(frame, [20 + i * 10, 55 + i * 10], [0, bars[i] * 100], { extrapolateRight: "clamp" })}%`,
                    height: "100%",
                    background: accent,
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
          background: rule,
          transform: `scaleX(${interpolate(frame, [0, 30], [0, 1], { extrapolateRight: "clamp" })})`,
          transformOrigin: "left",
        }}
      />
    </AbsoluteFill>
  );
};
