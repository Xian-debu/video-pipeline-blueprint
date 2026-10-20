import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE, sceneFrames, beatAt } from "../shared";

export const SEval: React.FC = () => {
  const stats = [
    { k: "HawkDATA · 状态识别", v: EV.headline.stateAvgF1.toFixed(2) + "%", c: "比 SOTA 高 " + EV.headline.stateGainPct + " 个百分点", col: C.cyan },
    { k: "HawkDATA · 事件识别", v: EV.headline.eventAvgF1.toFixed(2) + "%", c: "同一模型、同一测试集，只换任务", col: C.cyan },
    { k: "BLUED · 事件分类", v: EV.blued.hawkAvg.toFixed(2) + "%", c: "MTS-Shapelet " + EV.blued.mtsShapeletAvg.toFixed(2) + "%，高 " + EV.blued.deltaAvg + " 个百分点", col: C.amber },
    { k: "真实场景 · 事件", v: EV.field.residenceAvg.toFixed(2) + " / " + EV.field.officeAvg.toFixed(2) + "%", c: "住宅 / 办公室，都有未知背景电器", col: C.violet },
  ];
  return (
    <Scene id="eval">
      <Head kicker="08 / 实测" title="实验室之外还准不准" goal="两个公开/自建数据集，加两个真实场景" />
      <div style={{ position: "absolute", left: PAD, top: 258, width: CW, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {stats.map((s, i) => (
          <Build key={s.k} at={i === 0 ? 8 : beatAt("eval", i, 5)}>
            <Card style={{ padding: 26 }} accent={s.col}>
              <Body size={FT.meta} color={C.inkFaint}>{s.k}</Body>
              <div style={{ marginTop: 8 }}><Mono size={FT.num} color={C.ink}>{s.v}</Mono></div>
              <Body size={FT.tiny} color={C.inkFaint} style={{ marginTop: 8 }}>{s.c}</Body>
            </Card>
          </Build>
        ))}
      </div>
      <Build at={beatAt("eval", 4, 5)} style={{ position: "absolute", left: PAD, top: 800, width: CW }}>
        <Card label={"流式推理延迟（每 20ms 来一个周期，预算 " + EV.latency.realtimeBudgetMs + "ms）"} style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 44 }}>
            {EV.latency.rows.map((r) => (
              <div key={r.platform} style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <Mono size={FT.lead} color={C.cyan}>{r.latencyMs.toFixed(2)} ms</Mono>
                  <Mono size={FT.tiny} color={C.inkFaint}>{r.memMB + " MB"}</Mono>
                </div>
                <Body size={FT.tiny} color={C.inkFaint} style={{ marginTop: 2 }}>{r.platform + " · " + r.cpu}</Body>
              </div>
            ))}
          </div>
        </Card>
      </Build>
    </Scene>
  );
};
