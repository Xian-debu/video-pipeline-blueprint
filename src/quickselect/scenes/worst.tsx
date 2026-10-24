import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Big, Body, Card, Line, Mono, Scene, PAD, DEG, cn, comma, frameOf, pct, perElem, R_, Foot } from "../shared";

/* 最坏：有序输入 + 端点枢轴 → 平方级。左边是实测阶梯，画成折线。 */
const lom = DEG.lomuto;
const nth = DEG.nth_element;
const LAST = lom[lom.length - 1];

export const SWorst: React.FC = () => {
  const f = useCurrentFrame();
  const ns = lom.map((d) => d.n);
  // 线性纵轴：平方级增长在屏幕上才会「炸」出来。对数轴会把它压成一条直线，看着像线性。
  const top = LAST.cmp;
  const toY = (v: number) => v / top;
  const flatten = (rows: { cmp: number }[]) => rows.map((r) => toY(r.cmp));
  const nthFlat = nth.map((r) => toY(r.cmp));
  const stdRow = R_("std_nth", "sorted", 1000000);

  return (
    <Scene id="worst">
      <div style={{ position: "absolute", left: PAD, top: 186, width: 1130 }}>
        <Build at={frameOf("worst", 0)}>
          <Mono size={FT.label} color={C.coral} style={{ letterSpacing: FT_T.label }}>05 / 有序输入</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>端点枢轴的塌方</div>
          <Mono size={FT.meta} color={C.inkFaint} style={{ marginTop: 10 }}>已排序的输入 · 最后一个元素当枢轴 · 比较次数（线性纵轴）</Mono>
        </Build>

        <Build at={frameOf("worst", 4)} style={{ marginTop: 34 }}>
          <Card accent={C.coral} pad={22} style={{ width: 1040 }}>
            <div style={{ position: "relative", height: 300 }}>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 300 }}>
                <Line values={flatten(lom)} w={980} h={280} lo={0} hi={1} color={C.coral} at={frameOf("worst", 4)} dur={40} />
              </div>
              <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 300 }}>
                <Line values={nthFlat} w={980} h={280} lo={0} hi={1} color={C.cyan} at={frameOf("worst", 8)} dur={30} />
              </div>
              <div style={{ position: "absolute", left: 0, bottom: -8, display: "flex", width: 980, justifyContent: "space-between" }}>
                {lom.map((d, i) => (
                  <Mono key={d.n} size={FT.micro} color={i === lom.length - 1 ? C.inkDim : C.inkFaint} style={{ opacity: pct(f, frameOf("worst", 4) + i * 3, frameOf("worst", 4) + i * 3 + 12) }}>
                    {d.n >= 1000 ? d.n / 1000 + "k" : d.n}
                  </Mono>
                ))}
              </div>
            </div>
            <div style={{ display: "flex", gap: 26, marginTop: 18 }}>
              <Mono size={FT.meta} color={C.coral}>Lomuto · 端点枢轴</Mono>
              <Mono size={FT.meta} color={C.cyan}>std::nth_element（贴在底部，每元素 1.75 次）</Mono>
            </div>
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1272, top: 226, width: 520 }}>
        <Build at={frameOf("worst", 5)}>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>
            {"n = " + cn(LAST.n) + " · 实测比较次数"}
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginTop: 8 }}>
            <Big to={LAST.cmp} at={frameOf("worst", 5)} format={cn} size={FT.display} color={C.coral} />
          </div>
          <Body size={FT.meta} style={{ marginTop: 6 }}>{"深度 " + comma(LAST.depth) + " 层 · 每次只削掉一个"}</Body>
        </Build>
        <Build at={frameOf("worst", 6)} style={{ marginTop: 26 }}>
          <Card accent={C.amber} pad={20}>
            <Mono size={FT.body} color={C.amber}>长度翻倍 → 比较次数翻四倍</Mono>
            <Body size={FT.meta} style={{ marginTop: 8 }}>
              {"n = " + comma(lom[4].n) + " → " + comma(lom[5].n) + " 时，" + cn(lom[4].cmp) + " → " + cn(lom[5].cmp)}
            </Body>
          </Card>
        </Build>
        <Build at={frameOf("worst", 8)} style={{ marginTop: 24 }}>
          <Mono size={FT.meta} color={C.inkFaint}>标准库 · 同样输入</Mono>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginTop: 6 }}>
            <Mono size={FT.h1} color={C.cyan}>{perElem(stdRow).toFixed(2)}</Mono>
            <Mono size={FT.meta} color={C.inkDim}>次 / 元素</Mono>
          </div>
          <Body size={FT.tiny} style={{ marginTop: 8 }}>它不随机：中位数取样 + 深度上限</Body>
        </Build>
      </div>
      <Foot at={frameOf("worst", 1)}>{"data/quickselect/degradation.json · lomuto / nth_element · 已排序输入"}</Foot>
    </Scene>
  );
};