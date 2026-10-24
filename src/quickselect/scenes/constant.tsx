import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Bar, Body, Card, Mono, Scene, PAD, cn, frameOf, perElem, R_, T_, Foot } from "../shared";

/* 常数：同样期望线性，比较次数接近，时间却差一倍多。
 * 第一列比较次数，第二列毫秒，第三列「每次比较花了多少纳秒」。 */
const N = 1000000;

export const SConstant: React.FC = () => {
  const f = useCurrentFrame();
  const hoare = R_("hoare", "random", N);
  const three = R_("threeway", "random", N);
  const hoareMs = T_("hoare", "random", N).ms;
  const threeMs = T_("threeway", "random", N).ms;
  const hoareE = perElem(hoare);
  const threeE = perElem(three);
  const nsPer = (cmp: number, ms: number) => (ms * 1e6) / cmp;

  return (
    <Scene id="constant">
      <div style={{ position: "absolute", left: PAD, top: 190, width: 1200 }}>
        <Build at={frameOf("constant", 0)}>
          <Mono size={FT.label} color={C.violet} style={{ letterSpacing: FT_T.label }}>06 / 比较不等于时间</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>同样的次数，不同的毫秒</div>
          <Mono size={FT.meta} color={C.inkFaint} style={{ marginTop: 10 }}>{"n = " + cn(N) + " · 随机 · k 中位 · 同一台机器"}</Mono>
        </Build>

        <Build at={frameOf("constant", 2)} style={{ marginTop: 32 }}>
          <Card label="每元素比较次数 · 几乎一样" accent={C.cyan} pad={22} style={{ width: 1000 }}>
            <Bar label="Hoare" value={hoareE} max={Math.max(hoareE, threeE) * 1.15} color={C.cyan} w={560} labelW={130}
              at={frameOf("constant", 2)} text={hoareE.toFixed(2)} />
            <Bar label="三路" value={threeE} max={Math.max(hoareE, threeE) * 1.15} color={C.violet} w={560} labelW={130}
              at={frameOf("constant", 2) + 10} text={threeE.toFixed(2)} />
          </Card>
        </Build>

        <Build at={frameOf("constant", 3)} style={{ marginTop: 18 }}>
          <Card label="墙钟毫秒 · 差一倍多" accent={C.coral} pad={22} style={{ width: 1000 }}>
            <Bar label="Hoare" value={hoareMs} max={threeMs} color={C.cyan} w={560} labelW={130}
              at={frameOf("constant", 3)} text={hoareMs.toFixed(2) + " ms"} strong />
            <Bar label="三路" value={threeMs} max={threeMs} color={C.coral} w={560} labelW={130}
              at={frameOf("constant", 3) + 10} text={threeMs.toFixed(2) + " ms"} strong />
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1370, top: 300, width: 420 }}>
        <Build at={frameOf("constant", 5)}>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>一次比较花掉</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 8 }}>
            <Mono size={FT.h1} color={C.cyan}>{nsPer(hoare.cmp, hoareMs).toFixed(2)}</Mono>
            <Mono size={FT.meta} color={C.inkDim}>ns</Mono>
          </div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 10 }}>
            <Mono size={FT.h1} color={C.coral}>{nsPer(three.cmp, threeMs).toFixed(2)}</Mono>
            <Mono size={FT.meta} color={C.inkDim}>ns</Mono>
          </div>
        </Build>
        <Build at={frameOf("constant", 5)} style={{ marginTop: 26 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {["洛穆托版：每次交换都写下标", "三路版：多一次相等判断，分支难预测", "数组一大，缓存装不下"].map((t, i) => (
              <Body key={t} size={FT.meta} color={i === 2 ? C.amber : C.inkDim}>{"· " + t}</Body>
            ))}
          </div>
        </Build>
        <Build at={frameOf("constant", 9)} style={{ marginTop: 28 }}>
          <div style={{ borderLeft: "3px solid " + C.violet, paddingLeft: 14 }}>
            <Body size={FT.body} color={C.ink}>比较次数只是上界的代理，不是时间。</Body>
          </div>
        </Build>
      </div>
      <Foot at={frameOf("constant", 1)}>{"data/quickselect/{bench,timing}.json · hoare 与 threeway · random · n=1e6"}</Foot>
    </Scene>
  );
};