import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Card, Fig, Mono, Body, Scene, PAD, CW, beatAt, pct } from "../shared";

/* ARC(c)：四种情况 + 两个增量 + REPLACE 的判据；右侧直接给原文 Figure 4。 */
const CASES = [
  { k: "情况一", t: "命中", d: "页在 T1 或 T2 里，移到 T2 最前", c: C.cyan },
  { k: "情况二", t: "B1 命中", d: "p 增大（recency 给少了）", c: C.amber },
  { k: "情况三", t: "B2 命中", d: "p 减小（frequency 给多了）", c: C.violet },
  { k: "情况四", t: "全新页", d: "先淘汰一页，再放进 T1 最前", c: C.coral },
];

export const SArc: React.FC = () => {
  const f = useCurrentFrame();
  const pOn = pct(f, beatAt("arc", 5, 11), beatAt("arc", 5, 11) + 20);
  const dOn = pct(f, beatAt("arc", 6, 11), beatAt("arc", 6, 11) + 20);

  return (
    <Scene id="arc">
      <div style={{ position: "absolute", left: PAD, top: 92, width: 900 }}>
        <Build at={beatAt("arc", 0, 11)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>06 / ARC(c)</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>让 p 自己动起来</div>
        </Build>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 34, width: 900 }}>
          {CASES.map((c, i) => (
            <div key={c.k} style={{ width: 434, opacity: pct(f, beatAt("arc", i + 1, 11), beatAt("arc", i + 1, 11) + 18) }}>
              <Card label={c.k + " · " + c.t} accent={c.c} pad={20}>
                <Body size={FT.label} style={{ lineHeight: 1.45 }}>{c.d}</Body>
              </Card>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 26, opacity: pOn }}>
          <Mono size={FT.meta} color={C.inkFaint}>情况二与情况三的增量</Mono>
          <div style={{ display: "flex", gap: 26, marginTop: 12 }}>
            <div style={{ width: 420 }}>
              <Mono size={FT.body} color={C.amber}>{"情况二：p ← min{p + δ₁, c}"}</Mono>
              <div style={{ opacity: dOn, marginTop: 8 }}>
                <Mono size={FT.meta} color={C.inkDim}>{"δ₁ = 1，当 |B1| ≥ |B2|；否则 δ₁ = |B2| / |B1|"}</Mono>
              </div>
            </div>
            <div style={{ width: 420 }}>
              <Mono size={FT.body} color={C.violet}>{"情况三：p ← max{p − δ₂, 0}"}</Mono>
              <div style={{ opacity: dOn, marginTop: 8 }}>
                <Mono size={FT.meta} color={C.inkDim}>{"δ₂ 与 δ₁ 对称：B2 越小，减得越多"}</Mono>
              </div>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 24, opacity: pct(f, beatAt("arc", 10, 11), beatAt("arc", 10, 11) + 20) }}>
          <Card label="REPLACE 的判据，只有一句" accent={C.coral}>
            <Mono size={FT.body} color={C.ink}>{"T1 够大（|T1| > p）就淘汰 T1 的最后，否则淘汰 T2 的最后。"}</Mono>
          </Card>
        </div>
      </div>

      <div style={{ position: "absolute", left: 1010, top: 210, width: 780 }}>
        <Fig id="arc_fig4" src="arc/arc_fig4.png" width={780} w={1609} h={1555}
          at={beatAt("arc", 0, 11)} tag="Fig. 4" label="ARC(c) 的完整算法，原文未做任何删改" />
      </div>
    </Scene>
  );
};
