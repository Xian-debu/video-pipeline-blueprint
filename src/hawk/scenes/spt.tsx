import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE } from "../shared";

export const SSpt: React.FC = () => {
  const f = useCurrentFrame();
  const N = 220;
  const W = 860;
  const H = 300;
  const sine = Array.from({ length: N }, (_, k) => {
    const x = 20 + (k / (N - 1)) * (W - 40);
    const y = H / 2 - Math.sin((k / (N - 1)) * Math.PI * 4) * 96;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const mainDots = Array.from({ length: 7 }, (_, k) => 20 + (k / 6) * (W - 40));
  const off = (W - 40) / 220 * 4.5;
  const reveal = pct(f, 20, 60);
  return (
    <Scene id="spt">
      <Head kicker="05 / 同步" title="让电压当共同的钟" goal="不需要额外布线，只要各设备看同一个电压过零" />
      <Card style={{ position: "absolute", left: PAD, top: 268, width: 940 }} label="三台设备各采各的；只要电压波形对得上，时间就对得上">
        <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
          <polyline points={sine} fill="none" stroke={C.cyan} strokeWidth={2} pathLength={1} strokeDasharray={reveal + " 1"} />
          {mainDots.map((x, k) => {
            const y1 = H / 2 - Math.sin((((x - 20) / (W - 40)) * Math.PI * 4)) * 96;
            const x2 = x + off;
            const y2 = H / 2 - Math.sin((((x2 - 20) / (W - 40)) * Math.PI * 4)) * 96;
            const o = pct(f, 30 + k * 4, 38 + k * 4);
            return (
              <React.Fragment key={k}>
                <circle cx={x} cy={y1} r={6} fill={C.amber} opacity={o} />
                <circle cx={x2} cy={y2} r={6} fill={C.violet} opacity={o} />
                <line x1={x} y1={y1} x2={x2} y2={y2} stroke={C.inkFaint} strokeWidth={1} opacity={o * 0.7} />
              </React.Fragment>
            );
          })}
        </svg>
        <div style={{ display: "flex", gap: 26, marginTop: 8 }}>
          <Mono size={FT.tiny} color={C.amber}>● 主计量采样</Mono>
          <Mono size={FT.tiny} color={C.violet}>● 从机采样（有偏移）</Mono>
          <Mono size={FT.tiny} color={C.inkFaint}>电压过零 = 天然时间戳</Mono>
        </div>
      </Card>
      <div style={{ position: "absolute", left: PAD + 980, top: 268, width: CW - 980 }}>
        <Fig id="fig10" tag="Figure 10" src="hawk/fig10.png" width={520} w={598} h={341} at={34} label="同一时刻的采样误差分布（红线 = 220 µs）">
          <div style={{ position: "absolute", left: "18%", top: 0, width: 2, height: "100%", background: "rgba(251,113,133,0.9)" }} />
        </Fig>
        <div style={{ marginTop: 10 }}>
          <Mono size={FT.tiny} color={C.inkDim}>{"99.65% 的同步误差落在 220 µs 以内"}</Mono>
        </div>
        <div style={{ marginTop: 14 }}>
          <Mono size={FT.num} color={C.cyan}>{EV.sync.maxSyncErrorUs + " µs"}</Mono>
          <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 4 }}>最大同步误差（TSF 的 1/17.2）</Body>
        </div>
      </div>
      <Build at={70} style={{ position: "absolute", left: PAD, top: 700 }}>
        <Body size={FT.lead} color={C.ink}>
          于是「什么时候开的」不需要问人，<span style={{ color: C.cyan }}>数据自己会对齐</span>。
        </Body>
      </Build>
    </Scene>
  );
};
