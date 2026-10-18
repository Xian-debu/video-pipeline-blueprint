import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { FONT_SANS, PALETTE } from "../theme";
import { ambientScale } from "../design/contract";
import type { Scene } from "../schema";

export const ImageScene: React.FC<{ scene: Scene }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const dur = scene.durationInFrames;
  const k = scene.kenBurns ?? 1.06;
  // The drift's rate comes from the contract (motion.ambient), not from the scene length:
  // a 3 s scene moves proportionally less, so the plate never reads as a push-in (D4).
  const end = ambientScale(k, dur, fps);
  const scale = interpolate(frame, [0, dur], [1, end]);
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
