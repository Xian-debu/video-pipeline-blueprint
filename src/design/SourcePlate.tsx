import React from "react";
import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "./tokens";

/**
 * A page from the source itself: a standard clause, a paper figure, a table row.
 *
 * Material-based films are judged on whether the source is visible, not only on our redrawing of
 * it. This component is the only sanctioned way to put an excerpt on screen, so every such frame
 * carries the same three things: the 原文 badge, the page/figure number, and the attribution line.
 * The highlight is drawn outside the source's own annotation: the box is an outline, the source is
 * never darkened, and the highlight rect is expressed in ratios so a crop can change size without
 * re-measuring pixels.
 *
 * The height is reserved from the native size before the image decodes, otherwise the caption
 * jumps and the DOM probe reports an overlap on a frame that renders fine (K-known-issues).
 */
export const SourcePlate: React.FC<{
  src: string;
  width: number;
  nativeW: number;
  nativeH: number;
  badge?: string;
  caption?: string;
  attribution?: string;
  highlight?: { x: number; y: number; w: number; h: number };
  at?: number;
  dim?: boolean;
}> = ({ src, width, nativeW, nativeH, badge, caption, attribution, highlight, at = 0, dim = false }) => {
  const frame = useCurrentFrame();
  const opacity = at === 0 ? 1 : interpolate(frame, [at, at + 18], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const height = Math.round((width * nativeH) / nativeW);
  return (
    <div style={{ width, opacity }}>
      <div
        style={{
          position: "relative",
          width,
          height,
          background: C.paper,
          borderRadius: 6,
          overflow: "hidden",
          border: "1px solid " + C.panelLine,
          filter: dim ? "saturate(0.85) brightness(0.94)" : undefined,
        }}
      >
        <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
        {highlight ? (
          <div
            style={{
              position: "absolute",
              left: (highlight.x * 100).toFixed(2) + "%",
              top: (highlight.y * 100).toFixed(2) + "%",
              width: (highlight.w * 100).toFixed(2) + "%",
              height: (highlight.h * 100).toFixed(2) + "%",
              border: "2px solid " + C.amber,
              borderRadius: 3,
              boxSizing: "border-box",
              pointerEvents: "none",
            }}
          />
        ) : null}
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            padding: "4px 10px",
            background: C.paperInk,
            color: C.paper,
            fontFamily: FONT.mono,
            fontSize: FT.tiny,
            letterSpacing: FT_T.micro,
          }}
        >
          {"原文" + (badge ? " · " + badge : "")}
        </div>
        {attribution ? (
          <div
            style={{
              position: "absolute",
              left: 0,
              right: 0,
              bottom: 0,
              padding: "5px 10px",
              background: "rgba(26,26,23,0.86)",
              color: C.paper,
              fontFamily: FONT.sans,
              fontSize: FT.micro,
              letterSpacing: FT_T.micro,
            }}
          >
            {attribution}
          </div>
        ) : null}
      </div>
      {caption ? (
        <div style={{ fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkFaint, marginTop: 8, lineHeight: 1.55 }}>{caption}</div>
      ) : null}
    </div>
  );
};
