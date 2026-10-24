import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Bar, Big, Body, Card, Mono, Scene, PAD, cn, comma, frameOf, perElem, R_, T_, Foot } from "../shared";

/* 重复：全等输入下 Lomuto 每轮只前进一格；三路划分一次收走等值段。
 * 被上限截断的那一行必须标注截断，不能把 2 万的数字冒充 100 万。 */
const N = 1000000;

export const SDuplicate: React.FC = () => {
  const f = useCurrentFrame();
  const lomCap = R_("lomuto", "all_equal", N);
  const capNote = lomCap.capped ? "被截断在 n = " + cn(lomCap.n_measured) : "n = " + cn(lomCap.n);
  const three = R_("threeway", "all_equal", N);
  const threeT = T_("threeway", "all_equal", N);
  const lomFew = R_("lomuto", "few_distinct", N);
  const threeFew = R_("threeway", "few_distinct", N);
  const nthFew = R_("std_nth", "few_distinct", N);
  const fewMax = Math.max(perElem(lomFew), perElem(threeFew), perElem(nthFew));

  return (
    <Scene id="duplicate">
      <div style={{ position: "absolute", left: PAD, top: 190, width: 1120 }}>
        <Build at={frameOf("duplicate", 0)}>
          <Mono size={FT.label} color={C.violet} style={{ letterSpacing: FT_T.label }}>07 / 大量重复</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>所有元素都相等</div>
        </Build>

        <div style={{ display: "flex", gap: 20, marginTop: 34 }}>
          <Build at={frameOf("duplicate", 1)}>
            <Card label={"Lomuto · 全部相等 · " + capNote} accent={C.coral} pad={22} style={{ width: 520 }}>
              <Big to={lomCap.cmp} at={frameOf("duplicate", 4)} format={cn} size={FT.display} color={C.coral} />
              <Mono size={FT.meta} color={C.inkDim} style={{ display: "block", marginTop: 8 }}>次比较 · 深度 {comma(lomCap.depth)}</Mono>
            </Card>
          </Build>
          <Build at={frameOf("duplicate", 5)}>
            <Card label={"三路划分 · 全部相等 · n = " + cn(N)} accent={C.cyan} pad={22} style={{ width: 520 }}>
              <Big to={three.cmp} at={frameOf("duplicate", 5)} format={cn} size={FT.display} color={C.cyan} />
              <Mono size={FT.meta} color={C.inkDim} style={{ display: "block", marginTop: 8 }}>
                {"次比较 · " + threeT.ms.toFixed(2) + " ms · 深度 " + three.depth}
              </Mono>
            </Card>
          </Build>
        </div>

        <Build at={frameOf("duplicate", 7)} style={{ marginTop: 30 }}>
          <Card label={"八个不同取值 · n = " + cn(N) + " · 每元素比较次数"} accent={C.amber} pad={22} style={{ width: 1060 }}>
            <Bar label="Lomuto" value={perElem(lomFew)} max={fewMax} color={C.coral} w={560} labelW={150}
              at={frameOf("duplicate", 7)} text={perElem(lomFew).toFixed(2)} />
            <Bar label="三路" value={perElem(threeFew)} max={fewMax} color={C.cyan} w={560} labelW={150}
              at={frameOf("duplicate", 7) + 10} text={perElem(threeFew).toFixed(2)} strong />
            <Bar label="std::nth_element" value={perElem(nthFew)} max={fewMax} color={C.inkDim} w={560} labelW={150}
              at={frameOf("duplicate", 7) + 20} text={perElem(nthFew).toFixed(2)} />
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1290, top: 330, width: 500 }}>
        <Build at={frameOf("duplicate", 2)}>
          <Body size={FT.meta}>
            最后一个元素当枢轴，它是当前区间的最大值：
            左边全留下，右边一个都没有。
          </Body>
        </Build>
        <Build at={frameOf("duplicate", 3)} style={{ marginTop: 18 }}>
          <Mono size={FT.h2} color={C.coral}>{"n² / 2 · 每轮只前进一格"}</Mono>
        </Build>
        <Build at={frameOf("duplicate", 9)} style={{ marginTop: 30 }}>
          <div style={{ borderLeft: "3px solid " + C.violet, paddingLeft: 14 }}>
            <Body size={FT.body} color={C.ink}>重复值不是边角情况，是真实数据的长相。</Body>
          </div>
        </Build>
      </div>
      <Foot at={frameOf("duplicate", 1)}>{"data/quickselect/{bench,timing}.json · all_equal 与 few_distinct · n=1e6"}</Foot>
    </Scene>
  );
};