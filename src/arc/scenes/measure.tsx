import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { BarRow, Card, Fig, Mono, Body, Scene, EV, PAD, beatAt, pct } from "../shared";

/* 实验：Table VIII 原文 + 两条负载的柱状对比（LRU / ARC / 离线最优）。 */
export const SMeasure: React.FC = () => {
  const f = useCurrentFrame();
  const s = EV.spc1;
  const p6 = EV.p6;

  return (
    <Scene id="measure">
      <div style={{ position: "absolute", left: PAD, top: 92, width: 940 }}>
        <Build at={beatAt("measure", 0, 11)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>09 / 23 条负载</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>把离线最优当作标尺</div>
        </Build>

        <Build at={beatAt("measure", 1, 11)} style={{ marginTop: 26 }}>
          <Card label={"SPC1 like · 4 GB 缓存（" + s.cacheMB + " MB）"} accent={C.cyan} pad={22}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <BarRow label="LRU" value={s.lru} max={24} color={C.coral} w={420} at={beatAt("measure", 2, 11)} />
              <BarRow label="ARC" value={s.arc} max={24} color={C.cyan} w={420} at={beatAt("measure", 3, 11)} strong />
              <BarRow label="离线最优" value={s.offlineFrc} max={24} color={C.inkDim} w={420} at={beatAt("measure", 4, 11)} />
            </div>
          </Card>
        </Build>

        <Build at={beatAt("measure", 5, 11)} style={{ marginTop: 20 }}>
          <Card label={"P6 · 16 MB 缓存（离线最优反而更低）"} accent={C.amber} pad={22}>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <BarRow label="LRU" value={p6.lru} max={26} color={C.coral} w={420} at={beatAt("measure", 6, 11)} />
              <BarRow label="ARC" value={p6.arc} max={26} color={C.cyan} w={420} at={beatAt("measure", 6, 11)} strong />
              <BarRow label="离线最优" value={p6.offlineFrc} max={26} color={C.inkDim} w={420} at={beatAt("measure", 7, 11)} />
            </div>
          </Card>
        </Build>

        <div style={{ marginTop: 20, display: "flex", gap: 26, opacity: pct(f, beatAt("measure", 10, 11), beatAt("measure", 10, 11) + 20) }}>
          <Mono size={FT.body} color={C.ink}>常数时间</Mono>
          <Mono size={FT.body} color={C.inkFaint}>·</Mono>
          <Mono size={FT.body} color={C.ink}>{"空间开销 " + EV.paper.spaceOverheadPct + "%"}</Mono>
        </div>
      </div>

      <div style={{ position: "absolute", left: 1088, top: 150, width: 640 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: FT.label, letterSpacing: FT_T.label, color: C.cyan, marginBottom: 10, opacity: pct(f, beatAt("measure", 2, 11), beatAt("measure", 2, 11) + 20) }}>
          {EV.paper.traces + " 条真实负载 · Table VIII 原文"}
        </div>
        <Fig id="table8" src="arc/table8.png" width={608} w={692} h={771}
          at={beatAt("measure", 2, 11)} tag="Table VIII" />
      </div>
    </Scene>
  );
};