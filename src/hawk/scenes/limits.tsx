import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE, sceneFrames, beatAt } from "../shared";

const LIMITS = [
  { n: "01", t: "加湿器", d: "最高功率的 LC 电路，野外实验误报最多：F1 掉到 85.41%。" },
  { n: "02", t: "< 10W 与连续变化", d: "超低功率、功率连续变化的设备，管线还认不动。" },
  { n: "03", t: "同型号电器", d: "两台一样的灯，电流签名一样，分不开。" },
  { n: "04", t: "电压波动", d: "电水壶的漏检多数来自电压漂移——电阻性负载的电流跟着电压跑。" },
  { n: "05", t: "采集规模", d: "22 台电器、32.2 小时，相对真实家庭的多样性仍不够。" },
];
export const SLimits: React.FC = () => {
  const rows = EV.field.rows.filter((r) => r.power === 40 || r.appliance === "LEDLamp24W");
  return (
    <Scene id="limits">
      <Head kicker="09 / 边界" title="论文自己承认的五个洞" goal="这一节是原文 §7 的「Limitations」" />
      <div style={{ position: "absolute", left: PAD, top: 262, width: 1040 }}>
        {LIMITS.map((l, i) => (
          <Build key={l.n} at={beatAt("limits", i, 6)} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <Mono size={FT.meta} color={C.coral} style={{ width: 34, paddingTop: 5 }}>{l.n}</Mono>
              <div style={{ flex: 1, borderLeft: "1px solid " + C.panelLine, paddingLeft: 20 }}>
                <div style={{ fontFamily: FONT.sans, fontSize: FT.lead, color: C.ink }}>{l.t}</div>
                <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 4 }}>{l.d}</Body>
              </div>
            </div>
          </Build>
        ))}
      </div>
      <div style={{ position: "absolute", left: PAD + 1090, top: 290, width: CW - 1090 }}>
        <Build at={beatAt("limits", 3, 6)}>
        <Card label="Table 4：办公室场景里最低的三行" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 74px 74px", rowGap: 10, columnGap: 6 }}>
            {["电器", "功率", "住宅", "办公室"].map((h) => (
              <Mono key={h} size={FT.tiny} color={C.inkFaint}>{h}</Mono>
            ))}
            {rows.map((r) => (
              <React.Fragment key={r.appliance}>
                <Mono size={FT.tiny} color={C.ink}>{r.appliance}</Mono>
                <Mono size={FT.tiny} color={C.inkDim}>{r.power + "W"}</Mono>
                <Mono size={FT.tiny} color={r.residence === null ? C.inkFaint : C.ink}>{r.residence === null ? "—" : r.residence.toFixed(2) + "%"}</Mono>
                <Mono size={FT.tiny} color={r.office === null ? C.inkFaint : C.coral}>{r.office === null ? "—" : r.office.toFixed(2) + "%"}</Mono>
              </React.Fragment>
            ))}
          </div>
        </Card>
        </Build>
        <Build at={beatAt("limits", 5, 6)} style={{ marginTop: 22 }}>
          <Body size={FT.meta} color={C.inkFaint} style={{ lineHeight: 1.75 }}>
            值得注意的是：论文没有回避这些。<br />
            它把「为什么掉」也写了出来——<br />
            这类坦白，比再刷一个百分点有用。
          </Body>
        </Build>
      </div>
    </Scene>
  );
};
