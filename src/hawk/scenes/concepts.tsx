import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE, sceneFrames, beatAt } from "../shared";

const CONCEPTS = [
  { n: "01", zh: "状态", en: "state", d: "每个电器开或关，合成一个状态。18 台电器就是 2¹⁸ 种。" },
  { n: "02", zh: "叠加", en: "superposition", d: "电表读到的总电流，是所有电器电流之和。" },
  { n: "03", zh: "签名", en: "signature", d: "开与关前后两段稳态之间的台阶幅值与波形，就是它的签名。" },
  { n: "04", zh: "时间", en: "shared clock", d: "不同设备采到的点，必须落在同一个时刻上。" },
];
const ConceptGlyph: React.FC<{ i: number; at: number }> = ({ i, at }) => {
  const f = useCurrentFrame();
  const p = pct(f, at + 4, at + 30);
  const stroke = C.cyan;
  return (
    <svg width={300} height={96} style={{ display: "block", overflow: "visible", opacity: 0.4 + 0.6 * p }}>
      {i === 0
        ? [0, 1, 2].map((k) => (
            <rect key={k} x={20 + k * 92} y={26} width={66} height={44} rx={6}
              fill={k === 1 ? "rgba(94,234,212,0.18)" : "transparent"} stroke={k === 1 ? stroke : C.panelLine} strokeWidth={2} />
          ))
        : null}
      {i === 1 ? (
        <React.Fragment>
          <polyline points="10,26 90,26 90,64 170,64 170,40 290,40" fill="none" stroke={C.inkFaint} strokeWidth={2} />
          <polyline points="10,50 120,50 120,72 200,72 200,20 290,20" fill="none" stroke={stroke} strokeWidth={2} />
        </React.Fragment>
      ) : null}
      {i === 2 ? (
        <polyline points="10,70 60,70 60,30 120,30 120,58 190,58 190,22 290,22" fill="none" stroke={stroke} strokeWidth={2} />
      ) : null}
      {i === 3 ? (
        <React.Fragment>
          <polyline points={Array.from({ length: 48 }, (_, k) => (10 + k * 6).toFixed(1) + "," + (50 - Math.sin(k / 3) * 22).toFixed(1)).join(" ")}
            fill="none" stroke={stroke} strokeWidth={2} />
          {[0, 1, 2, 3].map((k) => <circle key={k} cx={10 + k * 76} cy={50 - Math.sin((k * 76) / 18) * 22} r={4} fill={C.amber} />)}
        </React.Fragment>
      ) : null}
    </svg>
  );
};
export const SConcepts: React.FC = () => {
  return (
    <Scene id="concepts">
      <Head kicker="03 / 四个约定" title="状态、叠加、签名、时间" goal="后面所有的设计，都建立在这四个词上" />
      <div style={{ position: "absolute", left: PAD, top: 300, width: CW, display: "flex", gap: 24 }}>
        {CONCEPTS.map((c, i) => (
          <Build key={c.n} at={beatAt("concepts", i, 4)} style={{ flex: 1 }}>
            <Card style={{ height: 430, padding: 26 }}>
              <Mono size={FT.label} color={C.cyanDeep} style={{ letterSpacing: FT_T.meta }}>{c.n}</Mono>
              <div style={{ fontFamily: FONT.serif, fontSize: FT.h2, color: C.ink, marginTop: 10 }}>{c.zh}</div>
              <Mono size={FT.meta} color={C.inkFaint} style={{ display: "block", marginTop: 6 }}>{c.en}</Mono>
              <div style={{ marginTop: 22 }}><ConceptGlyph i={i} at={beatAt("concepts", i, 4)} /></div>
              <Body size={FT.body} color={C.inkDim} style={{ marginTop: 18 }}>{c.d}</Body>
            </Card>
          </Build>
        ))}
      </div>
    </Scene>
  );
};
