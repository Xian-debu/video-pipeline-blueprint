import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FONT_SANS, PALETTE } from "../theme";
import type { Scene } from "../schema";

export const ImageScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const dur = scene.durationInFrames;
  const k = scene.kenBurns ?? 1.06;
  const scale = interpolate(frame, [0, dur], [1, k]);
  return (
    <AbsoluteFill style={{ background: PALETTE.ink, overflow: "hidden" }}>
      {scene.plate ? (
        <Img
          src={staticFile(scene.plate)}
          style={{ width: "100%", height: "100%", objectFit: "cover", transform: `scale(${scale})` }}
        />
      ) : (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", color: PALETTE.muted, fontFamily: FONT_SANS, fontSize: 40 }}>
          [image scene without plate]
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};
