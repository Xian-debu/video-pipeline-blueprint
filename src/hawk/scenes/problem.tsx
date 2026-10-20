import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE } from "../shared";

export const SProblem: React.FC = () => {
  const f = useCurrentFrame();
  const total = WAVE.series.total;
  const tMax = WAVE.series.t.length ? WAVE.series.t[WAVE.series.t.length - 1] : 4;
  const w = 1000;
  const h = 190;
  const lo = Math.min(...total) - 20;
  const hi = Math.max(...total) + 20;
  const ev = WAVE.events ? WAVE.events.find((e) => e.appliance === "humidifier" && e.on) : undefined;
  const evX = ev ? (ev.t / tMax) * w : 0;
  return (
    <Scene id="problem">
      <Head kicker="01 / 两个难点" title="数据贵，小信号听不见" goal="先看清问题，再谈方法" />
      <div style={{ position: "absolute", left: PAD, top: 262, display: "flex", gap: 40 }}>
        <Card accent={C.amber} style={{ width: 700, height: 300 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: FT.h2, color: C.ink }}>难点一：数据贵</div>
          <Body size={FT.body} style={{ marginTop: 18 }}>
            · BLUED 里 86% 的电器，一天开关不到 10 次<br />
            · 要覆盖不同家庭，就得长期上门采集<br />
            · 采完还得人工标注，错一件就脏一条
          </Body>
          <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 12 }}>
            <Mono size={FT.num} color={C.amber}>1/71.5</Mono>
            <Body size={FT.meta} color={C.inkFaint}>论文里相对基线的采集时间开销</Body>
          </div>
        </Card>
        <Card accent={C.coral} style={{ width: 700, height: 300 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: FT.h2, color: C.ink }}>难点二：小信号听不见</div>
          <Body size={FT.body} style={{ marginTop: 18 }}>
            · 电表只读到「所有电器加起来」的总电流<br />
            · 40W 的加湿器，和 1500W 的电水壶叠在一起<br />
            · 开关瞬间的台阶，被背景电流淹掉
          </Body>
          <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 12 }}>
            <Mono size={FT.num} color={C.coral}>2.7%</Mono>
            <Body size={FT.meta} color={C.inkFaint}>40W 相对于 1500W 的幅度</Body>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: PAD, top: 610, width: CW }}>
        <Card label="一段总电流（示意）：1500W 的台阶很显眼，40W 的开关几乎贴着噪声" style={{ width: CW, paddingTop: 18 }}>
          <div style={{ position: "relative", width: w, margin: "0 auto" }}>
            <Line values={total} w={w} h={h} lo={lo} hi={hi} color={C.inkDim} at={20} dur={48} fill />
            {ev ? (
              <React.Fragment>
                <div style={{ position: "absolute", left: evX - 1, top: 0, width: 2, height: h, background: C.coral, opacity: 0.85 }} />
                <div style={{ position: "absolute", left: Math.min(evX + 10, w - 300), top: h - 62 }}>
                  <Mono size={FT.meta} color={C.coral}>{"40W 在这里 · t=" + (ev.t).toFixed(1) + "s"}</Mono>
                </div>
              </React.Fragment>
            ) : null}
          </div>
        </Card>
      </div>
    </Scene>
  );
};
