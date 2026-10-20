import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE } from "../shared";

export const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  const total = WAVE.series.total;
  const bgPts = total.length ? total.map((v, i) => ((i / (total.length - 1)) * 1920).toFixed(1) + "," + (905 - (v / 1700) * 130).toFixed(1)).join(" ") : "";
  return (
    <Scene id="open">
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
        {bgPts ? <polyline points={bgPts} fill="none" stroke={C.cyanDeep} strokeWidth={2} /> : null}
      </svg>
      <div style={{ position: "absolute", left: PAD, top: 236, width: 1180 }}>
        <Build at={4}><Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>SENSYS 2024 · 论文解读</Mono></Build>
        <Build at={10}><div style={{ fontFamily: FONT.serif, fontSize: FT.cover, color: C.ink, lineHeight: 1, marginTop: 22, letterSpacing: FT_T.cover }}>HAWK</div></Build>
        <Build at={18}><div style={{ width: 140, height: 3, background: C.cyan, marginTop: 26 }} /></Build>
        <Build at={24}><div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.inkDim, marginTop: 26, lineHeight: 1.25 }}>看不见的用电，怎么被看见</div></Build>
        <Build at={34}><div style={{ fontFamily: FONT.sans, fontSize: FT.body, color: C.inkFaint, marginTop: 22, lineHeight: 1.6 }}>一篇关于「非侵入式电器识别」的论文，<br />以及它为了「造数据」和「认小信号」做的两件事。</div></Build>
        <Build at={48}>
          <div style={{ display: "flex", gap: 28, marginTop: 44, alignItems: "center" }}>
            <Mono size={FT.meta} color={C.inkFaint}>Zijian Wang 等 · 中科院计算所</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>SenSys '24 · Hangzhou</Mono>
          </div>
        </Build>
      </div>
      <Build at={60} style={{ position: "absolute", right: PAD, bottom: 156 }}>
        <Mono size={FT.meta} color={C.inkFaint}>{"全片约 " + Math.round(TOTAL / FPS / 60) + " 分钟 · 12 段"}</Mono>
      </Build>
    </Scene>
  );
};
