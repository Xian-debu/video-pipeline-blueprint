import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Bar, Big, Body, Card, Mono, Scene, PAD, cn, comma, frameOf, perElem, R_, T_, Foot } from "../shared";

/* 朴素：同一批数据上，全排序 vs 只选择。比较次数与毫秒都摆出来。 */
const N = 1000000;

export const SNaive: React.FC = () => {
  const f = useCurrentFrame();
  const sortR = R_("std_sort", "random", N);
  const nthR = R_("std_nth", "random", N);
  const sortT = T_("std_sort", "random", N);
  const nthT = T_("std_nth", "random", N);
  const ratioC = sortR.cmp / nthR.cmp;
  const ratioT = sortT.ms / nthT.ms;

  return (
    <Scene id="naive">
      <div style={{ position: "absolute", left: PAD, top: 190, width: 1180 }}>
        <Build at={frameOf("naive", 0)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>02 / 全排序</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>排完再取，贵在哪</div>
          <Mono size={FT.meta} color={C.inkFaint} style={{ marginTop: 10 }}>{"n = " + cn(N) + " 个随机整数 · k = 中位数 · 同一台机器"}</Mono>
        </Build>

        <Build at={frameOf("naive", 2)} style={{ marginTop: 34 }}>
          <Card label="比较次数" accent={C.coral} pad={24} style={{ width: 1080 }}>
            <Bar label="std::sort" value={sortR.cmp} max={sortR.cmp} color={C.coral} w={620} labelW={170}
              at={frameOf("naive", 2)} text={cn(sortR.cmp) + " 次"} strong />
            <Bar label="std::nth_element" value={nthR.cmp} max={sortR.cmp} color={C.cyan} w={620} labelW={170}
              at={frameOf("naive", 4)} text={cn(nthR.cmp) + " 次"} strong />
          </Card>
        </Build>

        <Build at={frameOf("naive", 3)} style={{ marginTop: 20 }}>
          <Card label="墙钟时间（5 次取中位）" accent={C.amber} pad={24} style={{ width: 1080 }}>
            <Bar label="std::sort" value={sortT.ms} max={sortT.ms} color={C.coral} w={620} labelW={170}
              at={frameOf("naive", 3)} text={sortT.ms.toFixed(1) + " ms"} />
            <Bar label="std::nth_element" value={nthT.ms} max={sortT.ms} color={C.cyan} w={620} labelW={170}
              at={frameOf("naive", 5)} text={nthT.ms.toFixed(1) + " ms"} strong />
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1352, top: 300, width: 440 }}>
        <Build at={frameOf("naive", 5)}>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>倍率</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
            <Big to={ratioC} at={frameOf("naive", 5)} format={(v) => v.toFixed(1) + "×"} size={FT.display} color={C.coral} />
          </div>
          <Mono size={FT.body} color={C.inkDim}>比较次数</Mono>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 18 }}>
            <Mono size={FT.h2} color={C.amber}>{ratioT.toFixed(1) + "×"}</Mono>
            <Mono size={FT.meta} color={C.inkDim}>墙钟</Mono>
          </div>
        </Build>
        <Build at={frameOf("naive", 7)} style={{ marginTop: 30 }}>
          <Body size={FT.meta}>
            差额全在 log n：排序要定下所有两两关系，
            选择只关心谁在第 k 位。
          </Body>
        </Build>
        <Build at={frameOf("naive", 9)} style={{ marginTop: 22 }}>
          <div style={{ borderLeft: "3px solid " + C.cyan, paddingLeft: 14 }}>
            <Body size={FT.body} color={C.ink}>省下的不是一个常数，是问题本身的一部分。</Body>
          </div>
        </Build>
      </div>
      <Foot at={frameOf("naive", 1)}>{"data/quickselect/{bench,timing}.json · std_sort / std_nth_element · random · n=1e6"}</Foot>
    </Scene>
  );
};