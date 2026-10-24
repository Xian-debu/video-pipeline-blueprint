import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Bar, Body, Card, Mono, Scene, PAD, BFPRT, cn, comma, frameOf, perElem, R_, T_, Foot } from "../shared";

/* 中位数：五个一组 → 组内中位数 → 这些中位数的中位数当枢轴。
 * 阶梯用 bfprt.json 实测的每层规模（只画规模，不混用比较口径）。 */
const N = 1000000;
const GROUPS = [
  [31, 8, 55, 17, 44],
  [62, 12, 49, 27, 36],
  [71, 5, 40, 24, 58],
  [19, 66, 33, 9, 51],
];

export const SMedians: React.FC = () => {
  const f = useCurrentFrame();
  const row = R_("bfprt", "random", N);
  const cmpE = perElem(row);
  const hoare = R_("hoare", "random", N);
  const bfprtT = T_("bfprt", "random", N);
  const hoareT = T_("hoare", "random", N);
  const levels = BFPRT.levels.slice(0, 5);
  const top = levels[0].size;

  return (
    <Scene id="medians">
      <div style={{ position: "absolute", left: PAD, top: 186, width: 1080 }}>
        <Build at={frameOf("medians", 0)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>08 / 最坏线性</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>五个人给的保证</div>
        </Build>

        <Build at={frameOf("medians", 2)} style={{ marginTop: 30 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {GROUPS.map((g, gi) => {
              const sorted = [...g].sort((a, b) => a - b);
              const med = sorted[2];
              return (
                <div key={gi} style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {sorted.map((v, i) => (
                    <div key={i} style={{
                      width: 72, height: 56, display: "flex", alignItems: "center", justifyContent: "center",
                      borderRadius: 8, border: "1px solid " + (i === 2 ? C.amber : C.panelLine),
                      background: i === 2 ? "rgba(251,191,36,0.10)" : C.panel,
                      fontFamily: FONT.mono, fontSize: FT.body, color: i === 2 ? C.ink : C.inkDim,
                    }}>{v}</div>
                  ))}
                  <Mono size={FT.micro} color={C.inkFaint}>{"组 " + (gi + 1) + " 排序后取中间"}</Mono>
                </div>
              );
            })}
          </div>
          <Mono size={FT.meta} color={C.amber} style={{ display: "block", marginTop: 14 }}>
            这些中位数的中位数，就是枢轴
          </Mono>
        </Build>

        <Build at={frameOf("medians", 6)} style={{ marginTop: 26 }}>
          <Card label="递推" accent={C.cyan} pad={20} style={{ width: 780 }}>
            <Mono size={FT.body} color={C.ink}>T(n) ≤ T(n/5) + T(7n/10) + cn</Mono>
            <Body size={FT.meta} style={{ marginTop: 8 }}>
              1/5 + 7/10 = 9/10 &lt; 1，级数收敛 → 最坏也是线性
            </Body>
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1230, top: 226, width: 560 }}>
        <Build at={frameOf("medians", 8)}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
            <Mono size={FT.display} color={C.cyan}>{cmpE.toFixed(2)}</Mono>
            <Mono size={FT.body} color={C.inkDim}>次 / 元素</Mono>
          </div>
          <Mono size={FT.meta} color={C.inkFaint}>{"n = " + cn(N) + " · 随机 · 实测"}</Mono>
        </Build>
        <Build at={frameOf("medians", 9)} style={{ marginTop: 16 }}>
          <Card accent={C.coral} pad={20}>
            <Mono size={FT.body} color={C.coral}>{"代价：比 Hoare 慢 " + (bfprtT.ms / hoareT.ms).toFixed(1) + " 倍时间"}</Mono>
            <Body size={FT.meta} style={{ marginTop: 6 }}>{"每元素 " + cmpE.toFixed(2) + " 次 vs Hoare " + perElem(hoare).toFixed(2) + " 次 · 用常数换最坏保证"}</Body>
          </Card>
        </Build>

        <Build at={frameOf("medians", 10)} style={{ marginTop: 26 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>实测每层规模</div>
          <div style={{ display: "flex", flexDirection: "column", gap: 0, marginTop: 12 }}>
            {levels.map((l, i) => (
              <Bar key={l.level} label={"第 " + l.level + " 层"} value={l.size} max={top} color={i === 0 ? C.amber : C.cyan}
                w={300} labelW={90} h={12} at={frameOf("medians", 10) + i * 8}
                text={l.size >= 10000 ? cn(l.size) : comma(l.size)} />
            ))}
          </div>
          <Body size={FT.tiny} style={{ marginTop: 10 }}>掉得比 7/10 的上界快：真实划分更均匀</Body>
        </Build>
      </div>
      <Foot at={frameOf("medians", 1)}>{"data/quickselect/{bench,bfprt}.json · bfprt · random · n=1e6"}</Foot>
    </Scene>
  );
};