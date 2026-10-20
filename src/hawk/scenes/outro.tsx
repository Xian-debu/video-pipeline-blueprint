import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE } from "../shared";

export const SOutro: React.FC = () => {
  return (
    <Scene id="outro">
      <div style={{ position: "absolute", left: PAD, top: 300, width: 1200 }}>
        <Build at={10}><div style={{ fontFamily: FONT.serif, fontSize: FT.display, color: C.ink, lineHeight: 1.2 }}>先问对问题，<br />再问怎么算。</div></Build>
        <Build at={36}><div style={{ width: 120, height: 3, background: C.cyan, marginTop: 30 }} /></Build>
      </div>
      <div style={{ position: "absolute", left: PAD + 1290, top: 320, width: CW - 1290 }}>
        {[
          "数据不是采集来的，是设计出来的。",
          "精度不是换模型换来的，是换特征换来的。",
          "4.12 美元一路的采样，加一个会看电压的钟。",
        ].map((s, i) => (
          <Build key={s} at={44 + i * 10} style={{ marginBottom: 20 }}>
            <div style={{ borderLeft: "1px solid " + C.panelLine, paddingLeft: 16, fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkDim, lineHeight: 1.6 }}>{s}</div>
          </Build>
        ))}
      </div>
      <Build at={80} style={{ position: "absolute", left: PAD, bottom: 180 }}>
        <Mono size={FT.tiny} color={C.inkFaint}>{"HAWK · SenSys 2024 · github.com/WZiJ/SenSys24-Hawk"}</Mono>
      </Build>
    </Scene>
  );
};
