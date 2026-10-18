import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import { FONT_SANS, PALETTE } from "../theme";
import { fillColor } from "../design/contract";
import type { CaptionItem } from "../schema";

/**
 * 字幕层。
 * - bottom：贴底 9%（最常见）
 * - center：放在画面 62% 高度（**不压标题**，QA 实测居中会盖住大标题）
 * - top：贴顶
 */
export const Caption: React.FC<{ item: CaptionItem; localFrame: number }> = ({ item, localFrame }) => {
  if (localFrame < item.from || localFrame > item.to) return null;
  const fade = 6;
  const opacity = Math.min(
    interpolate(localFrame, [item.from, item.from + fade], [0, 1], { extrapolateRight: "clamp" }),
    interpolate(localFrame, [item.to - fade, item.to], [1, 0], { extrapolateLeft: "clamp" })
  );
  const pos = item.pos ?? "bottom";
  const layout =
    pos === "bottom"
      ? { justifyContent: "flex-end", padding: "0 8% 9% 8%" }
      : pos === "top"
        ? { justifyContent: "flex-start", padding: "7% 8% 0 8%" }
        : { justifyContent: "center", padding: "0 8% 0 8%", transform: "translateY(26%)" };
  return (
    <AbsoluteFill style={{ alignItems: "center", pointerEvents: "none", ...layout }}>
      <div
        style={{
          opacity,
          fontFamily: FONT_SANS,
          fontSize: 52,
          lineHeight: 1.35,
          color: PALETTE.white,
          background: fillColor("storyboard", "surface.scrim"),
          padding: "14px 28px",
          borderRadius: 10,
          maxWidth: 1500,
          textAlign: "center",
          letterSpacing: 1,
        }}
      >
        {item.text}
      </div>
    </AbsoluteFill>
  );
};
