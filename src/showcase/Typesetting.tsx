import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { C, FONT, T } from "../design/tokens";
import { Math, MathLine } from "../design/Math";

/** KaTeX 排版自检：快速排序期望比较次数证明的真实推导序列。 */
export const Typesetting: React.FC = () => {
  const f = useCurrentFrame();
  const lines = [
    { tex: "X_{ij} = \\mathbf{1}\\left[\\text{elements } i \\text{ and } j \\text{ were compared}\\right]", no: "(1)" },
    { tex: "C = \\sum_{1 \\le i < j \\le n} X_{ij}", no: "(2)" },
    { tex: "\\mathbb{E}[C] = \\sum_{i<j} \\Pr\\left(X_{ij} = 1\\right)", no: "(3)" },
    { tex: "\\Pr\\left(X_{ij}=1\\right) = \\frac{2}{\\,j-i+1\\,}", no: "(4)" },
    { tex: "\\mathbb{E}[C] = \\sum_{k=1}^{n-1}(n-k)\\frac{2}{k+1} \\;\\le\\; 2n\\sum_{k=1}^{n}\\frac{1}{k} = 2n\\,H_n", no: "(5)" },
    { tex: "H_n \\le \\ln n + 1 \\;\\Longrightarrow\\; \\mathbb{E}[C] \\le 2n\\ln n + 2n = O(n\\log n)", no: "(6)" },
  ];
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink, padding: 72 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: 22, color: C.cyan, letterSpacing: 3 }}>PROOF / EXPECTED COMPARISONS</div>
      <div style={{ fontFamily: FONT.serif, fontSize: T.h1, marginTop: 8, marginBottom: 6 }}>期望比较次数 ≤ 2n ln n</div>
      <div style={{ fontSize: T.caption, color: C.inkDim, marginBottom: 22 }}>随机化快排：pivot 从区间中均匀随机选取，与输入无关。</div>
      <div style={{ display: "flex", gap: 36, flex: 1 }}>
        <div style={{ flex: 1.55, background: C.panel, borderRadius: 16, border: "1px solid " + C.panelLine, padding: "14px 26px" }}>
          {lines.map((l, i) => {
            const appear = interpolate(f, [i * 8, i * 8 + 12], [0, 1], { extrapolateRight: "clamp" });
            return (
              <div key={l.no} style={{ opacity: appear }}>
                <MathLine tex={l.tex} no={l.no} size={i === 5 ? 26 : 28} active={f > 150 && i === 5} />
              </div>
            );
          })}
        </div>
        <div style={{ flex: 0.8, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ background: C.panel, borderRadius: 16, border: "1px solid " + C.panelLine, padding: 20 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 17, color: C.inkFaint, letterSpacing: 2 }}>KEY STEP</div>
            <div style={{ fontSize: 24, marginTop: 8, lineHeight: 1.5 }}>区间 [i, j] 内第一个被选中的 pivot 是 i 或 j</div>
            <div style={{ marginTop: 12, padding: "8px 12px", background: "rgba(94,234,212,0.08)", borderRadius: 10 }}>
              <Math tex="\Pr = \dfrac{2}{j-i+1}" size={30} color={C.cyan} />
            </div>
          </div>
          <div style={{ background: C.bgSoft, borderRadius: 16, border: "1px solid " + C.panelLine, padding: 20 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 17, color: C.inkFaint, letterSpacing: 2 }}>CHECK n = 1000</div>
            <div style={{ marginTop: 8, fontSize: 23, lineHeight: 1.6 }}>上界 2n ln n = 13,815.5，实测随机输入 10,969</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};
