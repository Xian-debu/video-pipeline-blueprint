import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { BarRow, Card, Mono, Body, Scene, EV, PAD, CW, beatAt, pct } from "../shared";

/* 普适与边界：P8 上 ARC 与离线最优的差距 + ARC(c,k) 的代价。 */
export const SUniversal: React.FC = () => {
  const f = useCurrentFrame();
  const p8 = EV.p8;
  const gaps = [
    { n: "P4", arc: 11.24, frc: 11.6, win: true },
    { n: "P6", arc: 23.84, frc: 22.62, win: true },
    { n: "SPC1", arc: 20.0, frc: 20.11, win: true },
    { n: "P8", arc: 27.51, frc: 28.92, win: false },
  ];

  return (
    <Scene id="universal">
      <div style={{ position: "absolute", left: PAD, top: 92, width: CW }}>
        <Build at={beatAt("universal", 0, 10)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>10 / 经验普适</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>更强的一句话</div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: PAD, top: 250, width: 860 }}>
        <Build at={beatAt("universal", 2, 10)}>
          <Card label="论文原文（摘要）" accent={C.cyan} pad={22}>
            <Body size={FT.label} color={C.ink} style={{ fontStyle: "italic", lineHeight: 1.5 }}>
              The policy ARC is empirically universal.
            </Body>
            <Body size={FT.meta} style={{ marginTop: 10 }}>“ARC 在经验意义上是普适的：即便对手用的是离线挑好的最优参数，它也不落下风。”</Body>
          </Card>
        </Build>

        <Build at={beatAt("universal", 5, 10)} style={{ marginTop: 24 }}>
          <Card label="但代价也写在论文里：稳定负载上的抖动" accent={C.amber} pad={22}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <BarRow label="ARC" value={p8.arcAt32768Pages} max={32} color={C.cyan} w={420} at={beatAt("universal", 6, 10)} strong />
              <BarRow label="离线最优" value={p8.offlineFrc} max={32} color={C.inkDim} w={420} at={beatAt("universal", 6, 10)} />
            </div>
            <Body size={FT.meta} style={{ marginTop: 12 }}>{"P8，16 MB 缓存：差 1.41 个百分点，因为 p 一直在动。"}</Body>
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1080, top: 250, width: 730 }}>
        <Mono size={FT.meta} color={C.inkFaint}>四条负载：ARC 与离线最优的差距</Mono>
        <div style={{ marginTop: 16, display: "flex", flexDirection: "column", gap: 10 }}>
          {gaps.map((g, i) => (
            <div key={g.n} style={{ display: "flex", alignItems: "center", gap: 14, opacity: pct(f, beatAt("universal", 1, 10) + i * 8, beatAt("universal", 1, 10) + i * 8 + 16) }}>
              <div style={{ width: 76, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkDim, textAlign: "right" }}>{g.n}</div>
              <div style={{ fontFamily: FONT.mono, fontSize: FT.body, color: g.win ? C.cyan : C.coral, width: 92 }}>
                {g.arc.toFixed(2) + "%"}
              </div>
              <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, width: 150 }}>
                {"离线 " + g.frc.toFixed(2) + "%"}
              </div>
              <div style={{ fontFamily: FONT.sans, fontSize: FT.meta, color: g.win ? C.cyan : C.coral }}>
                {g.win ? (g.arc === g.frc ? "持平" : "更高") : "低 1.41"}
              </div>
            </div>
          ))}
        </div>

        <Build at={beatAt("universal", 6, 10)} style={{ marginTop: 30 }}>
          <Card label="扩展版 ARC(c,k)" accent={C.violet} pad={20}>
            <Body size={FT.label}>多一张 k 页的 Z 表，记住从 L2 淘汰的页号；Z 命中不调整 p。</Body>
            <Body size={FT.meta} style={{ marginTop: 10 }}>代价：一次可能删掉任意多页，所以只保证期望常数时间。</Body>
          </Card>
        </Build>
      </div>
    </Scene>
  );
};
