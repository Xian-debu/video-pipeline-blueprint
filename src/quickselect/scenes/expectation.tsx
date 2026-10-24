import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Bar, Big, Body, Card, Mono, Scene, PAD, cn, frameOf, perElem, pct, R_, Foot } from "../shared";

/* 期望：等比级数 n + n/2 + n/4 + ... = 2n。
 * 左边把级数画成一组越来越短的条，右边给实测的每元素比较次数。 */
const N = 1000000;
const SERIES = [
  { label: "第 1 轮", frac: 1 },
  { label: "第 2 轮", frac: 0.5 },
  { label: "第 3 轮", frac: 0.25 },
  { label: "第 4 轮", frac: 0.125 },
  { label: "……", frac: 0.0625 },
];

export const SExpect: React.FC = () => {
  const f = useCurrentFrame();
  const hoare = R_("hoare", "random", N);
  const sortR = R_("std_sort", "random", N);
  const hoareE = perElem(hoare);
  const sortE = perElem(sortR);
  const ratio = sortE / hoareE;

  return (
    <Scene id="expectation">
      <div style={{ position: "absolute", left: PAD, top: 190, width: 1080 }}>
        <Build at={frameOf("expectation", 0)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>04 / 为什么是线性</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>n 加 n 半加 n 四分之一</div>
        </Build>

        <Build at={frameOf("expectation", 1)} style={{ marginTop: 34 }}>
          <Card label="每轮扫过的元素" accent={C.cyan} pad={22} style={{ width: 980 }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
              {SERIES.map((s, i) => (
                <Bar key={s.label} label={s.label} value={s.frac} max={1} color={i === 4 ? C.inkFaint : C.cyan}
                  w={560} labelW={110} h={14}
                  at={frameOf("expectation", 1) + i * 8}
                  text={(Math.round(s.frac * N) / 10000).toLocaleString("en-US") + " 万"} />
              ))}
            </div>
          </Card>
        </Build>

        <Build at={frameOf("expectation", 3)} style={{ marginTop: 20 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 20 }}>
            <Mono size={FT.body} color={C.inkDim}>和为</Mono>
            <Big to={2 * N} at={frameOf("expectation", 3)} format={cn} size={FT.num} color={C.cyan} />
            <Mono size={FT.h2} color={C.ink}>= 2n</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>不是 n log n</Mono>
          </div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1230, top: 240, width: 560 }}>
        <Build at={frameOf("expectation", 4)}>
          <Card label={"实测 · n = " + cn(N) + " · 随机 · k 中位"} accent={C.amber} pad={22}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <Big to={hoareE} at={frameOf("expectation", 4)} format={(v) => v.toFixed(2)} size={FT.display} color={C.cyan} />
              <Mono size={FT.body} color={C.inkDim}>次 / 元素</Mono>
            </div>
            <Body size={FT.meta} style={{ marginTop: 8 }}>Hoare 划分 · 期望 2n 之上多出的是枢轴与偏差</Body>
          </Card>
        </Build>
        <Build at={frameOf("expectation", 6)} style={{ marginTop: 20 }}>
          <Card label="同一批数据 · 全排序" accent={C.coral} pad={22}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
              <Mono size={FT.h1} color={C.coral}>{sortE.toFixed(1)}</Mono>
              <Mono size={FT.body} color={C.inkDim}>次 / 元素 · 约 {ratio.toFixed(1)} 倍</Mono>
            </div>
          </Card>
        </Build>
        <Build at={frameOf("expectation", 8)} style={{ marginTop: 24 }}>
          <div style={{ borderLeft: "3px solid " + C.violet, paddingLeft: 16 }}>
            <Body size={FT.body} color={C.ink}>这是期望：它依赖随机枢轴真的随机。</Body>
            <Body size={FT.meta} style={{ marginTop: 8 }}>把随机数去掉，期望就退化成运气。</Body>
          </div>
        </Build>
      </div>
      <Foot at={frameOf("expectation", 1)}>{"data/quickselect/bench.json · hoare/random/n=1e6 · 每元素比较次数"}</Foot>
    </Scene>
  );
};