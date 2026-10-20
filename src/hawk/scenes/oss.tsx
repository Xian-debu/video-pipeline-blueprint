import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE, sceneFrames, beatAt } from "../shared";

export const SOss: React.FC = () => {
  return (
    <Scene id="oss">
      <Head kicker="10 / 资源" title="代码、数据、许可证" goal="论文最后一句给了地址，这里把入口摆出来" />
      <div style={{ position: "absolute", left: PAD, top: 268, width: CW }}>
        <Card accent={C.cyan} style={{ padding: 34 }}>
          <Body size={FT.meta} color={C.inkFaint}>GitHub</Body>
          <div style={{ marginTop: 10 }}><Mono size={FT.lead} color={C.cyan}>{EV.oss.repo}</Mono></div>
          <Build at={beatAt("oss", 1, 6)} style={{ display: "flex", gap: 14, marginTop: 22 }}>
            {EV.oss.includes.map((s) => (
              <div key={s} style={{
                border: "1px solid " + C.panelLine, background: C.bgSoft, borderRadius: 999,
                padding: "6px 16px", fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkDim,
              }}>{s}</div>
            ))}
          </Build>
        </Card>
      </div>
      <div style={{ position: "absolute", left: PAD, top: 560, width: CW, display: "flex", gap: 24 }}>
        {[
          { k: "22 台", d: "实验室电器，其中 18 台可编程" },
          { k: "32.2 小时", d: "有效采集时长" },
          { k: "18.91 秒", d: "平均一次开关事件" },
          { k: "0.877", d: "ON 状态类别平衡比（基线 1.22e-4）" },
        ].map((s, i) => (
          <Build key={s.k} at={beatAt("oss", 2, 6)} style={{ flex: 1 }}>
          <Card style={{ flex: 1, padding: 24 }}>
            <Mono size={FT.lead} color={C.ink}>{s.k}</Mono>
            <Body size={FT.tiny} color={C.inkFaint} style={{ marginTop: 6 }}>{s.d}</Body>
          </Card>
          </Build>
        ))}
      </div>
      <div style={{ position: "absolute", left: PAD, top: 790, width: CW, display: "flex", justifyContent: "space-between" }}>
        <Build at={beatAt("oss", 4, 6)}><Mono size={FT.meta} color={C.inkFaint}>{"许可：" + EV.oss.license + "（论文页面标注）"}</Mono></Build>
        <Build at={beatAt("oss", 5, 6)}><Mono size={FT.meta} color={C.inkFaint}>{"DOI：" + EV.oss.doi}</Mono></Build>
      </div>
    </Scene>
  );
};
