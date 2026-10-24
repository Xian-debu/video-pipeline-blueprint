import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Mono, Scene, PAD, comma, frameOf, R_, Foot } from "../shared";

/* 结语：三句话 + 下界 + 出处。 */
const N = 1000000;

export const SOutro: React.FC = () => {
  const f = useCurrentFrame();
  const lo = R_("std_nth", "random", N).n - 1;
  const CARDS = [
    { k: "一", t: "选择比排序少一个 log", c: C.cyan, d: "结构上的省，不是常数上的省" },
    { k: "二", t: "期望线性来自只走一边", c: C.violet, d: "宽度从二变成一" },
    { k: "三", t: "最坏与常数是两件事", c: C.amber, d: "要分别处理、分别实测" },
  ];

  return (
    <Scene id="outro">
      <div style={{ position: "absolute", left: PAD, top: 176, width: 1500 }}>
        <Build at={frameOf("outro", 0)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>11 / 三句话</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>记住三件事</div>
        </Build>

        <div style={{ display: "flex", gap: 22, marginTop: 36 }}>
          {CARDS.map((x, i) => (
            <Build key={x.k} at={frameOf("outro", 1) + i * 12}>
              <div style={{ width: 440, borderTop: "2px solid " + x.c, paddingTop: 16 }}>
                <Mono size={FT.meta} color={x.c}>{x.k}</Mono>
                <div style={{ fontFamily: FONT.serif, fontSize: FT.h2, color: C.ink, marginTop: 8 }}>{x.t}</div>
                <Body size={FT.meta} style={{ marginTop: 8 }}>{x.d}</Body>
              </div>
            </Build>
          ))}
        </div>

        <Build at={frameOf("outro", 4)} style={{ marginTop: 48 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
            <Mono size={FT.body} color={C.inkDim}>下界</Mono>
            <Mono size={FT.h1} color={C.cyan}>{"n − 1 = " + comma(lo)}</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>次比较，谁都逃不掉</Mono>
          </div>
        </Build>

        <Build at={frameOf("outro", 5)} style={{ marginTop: 30 }}>
          <Body size={FT.meta}>
            所有这些数字来自 C++ 基准，代码与数据生成器都在仓库里。
          </Body>
        </Build>
        <Build at={frameOf("outro", 6)} style={{ marginTop: 18 }}>
          <div style={{ width: 120, height: 3, background: C.cyan }} />
          <div style={{ fontFamily: FONT.serif, fontSize: FT.lead, color: C.ink, marginTop: 16 }}>
            算法不难，难的是分清哪句话有证据。
          </div>
        </Build>
      </div>
      <Foot at={frameOf("outro", 1)}>{"data/quickselect/ · scripts/quickselect/bench.cpp · generate_quickselect_data.py"}</Foot>
    </Scene>
  );
};