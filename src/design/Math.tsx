import React from "react";
import katex from "katex";
import "katex/dist/katex.min.css";
import { C, FONT } from "./tokens";

/**
 * KaTeX 公式（纯静态 HTML，渲染确定性）。
 * block=true 时用 \displaystyle 走行内模式：既得到展示尺寸，又受父容器 textAlign 控制，
 * 避免 katex-display 默认居中/上下大间距导致排版失控。
 */
export const Math: React.FC<{
  tex: string;
  block?: boolean;
  size?: number;
  color?: string;
  align?: "left" | "center" | "right";
  style?: React.CSSProperties;
}> = ({ tex, block = false, size = 32, color = C.ink, align = "center", style }) => {
  const source = block ? "\\displaystyle " + tex : tex;
  const html = katex.renderToString(source, {
    displayMode: false,
    throwOnError: false,
    output: "html",
    strict: "ignore",
    trust: false,
  });
  return (
    <div
      style={{
        fontSize: size,
        color,
        fontFamily: FONT.sans,
        textAlign: align,
        lineHeight: 1.6,
        ...style,
      }}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
};

/** 带编号的推导行：左侧 TeX，右侧 (1)(2)(3)；active 时高亮左侧竖线。 */
export const MathLine: React.FC<{
  tex: string;
  no?: string;
  size?: number;
  color?: string;
  active?: boolean;
  dim?: boolean;
}> = ({ tex, no, size = 30, color = C.ink, active = false, dim = false }) => (
  <div
    style={{
      display: "flex",
      alignItems: "center",
      gap: 16,
      padding: active ? "6px 14px" : "6px 14px",
      borderRadius: 10,
      background: active ? "rgba(94,234,212,0.08)" : "transparent",
      borderLeft: active ? "3px solid " + C.cyan : "3px solid transparent",
      opacity: dim ? 0.42 : 1,
    }}
  >
    <div style={{ flex: 1, minWidth: 0 }}>
      <Math tex={tex} block size={size} color={color} align="left" />
    </div>
    {no ? (
      <div style={{ fontFamily: FONT.mono, fontSize: 19, color: C.inkFaint, minWidth: 50, textAlign: "right", flexShrink: 0, whiteSpace: "nowrap" }}>{no}</div>
    ) : null}
  </div>
);
