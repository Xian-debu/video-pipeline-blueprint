import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Card, Fig, Line, Mono, Body, Scene, SIM, PAD, beatAt, pct, sceneFrames } from "../shared";

/* 自适应：自测负载上 p 的游走曲线 + 原文 Fig. 7 的真实 P4 曲线。 */
export const SWalk: React.FC = () => {
  const f = useCurrentFrame();
  const w = SIM.walk;
  const step = 4;
  const series = w.p.filter((_, i) => i % step === 0);
  const cut = Math.max(2, Math.round(series.length * pct(f, beatAt("walk", 1, 10), sceneFrames("walk") * 0.78)));
  const shown = series.map((v, i) => (i < cut ? v : null));

  return (
    <Scene id="walk">
      <div style={{ position: "absolute", left: PAD, top: 92, width: 1000 }}>
        <Build at={beatAt("walk", 0, 10)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>07 / p 的舞步</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>p 跟着负载走</div>
        </Build>

        <Build at={beatAt("walk", 2, 10)} style={{ marginTop: 26 }}>
          <Card label="论文原文（第 16 页）" accent={C.amber} pad={22}>
            <Body size={FT.label} color={C.ink} style={{ fontStyle: "italic", lineHeight: 1.5 }}>
              Poetically, at any time, p dances to the tune being played by the workload.
            </Body>
            <Body size={FT.meta} style={{ marginTop: 10 }}>“诗意地说，p 随时跟着负载演奏的曲子起舞。”</Body>
          </Card>
        </Build>

        <div style={{ marginTop: 24 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
            <Mono size={FT.meta} color={C.inkFaint}>{"自测 · 合成负载，c = " + w.c + " 页，每 50 次请求记一点"}</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>{"0 ≤ p ≤ " + w.pMax}</Mono>
          </div>
          <div style={{ marginTop: 12, background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 12, padding: "18px 22px" }}>
            <Line values={shown} w={940} h={230} lo={0} hi={w.pMax} color={C.cyan} at={beatAt("walk", 1, 10)} dur={sceneFrames("walk") * 0.4} fill />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <Mono size={FT.tiny} color={C.inkFaint}>请求流 →</Mono>
              <Mono size={FT.tiny} color={C.inkFaint}>{"峰值 " + w.pMax}</Mono>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 20, display: "flex", gap: 20, opacity: pct(f, beatAt("walk", 6, 10), beatAt("walk", 6, 10) + 20) }}>
          <Mono size={FT.meta} color={C.cyan}>从 0 出发</Mono>
          <Mono size={FT.meta} color={C.inkFaint}>→</Mono>
          <Mono size={FT.meta} color={C.amber}>{"顶到 " + w.pMax}</Mono>
          <Mono size={FT.meta} color={C.inkFaint}>→</Mono>
          <Mono size={FT.meta} color={C.cyan}>自己走回来</Mono>
        </div>
      </div>

      <div style={{ position: "absolute", left: 1180, top: 210, width: 610 }}>
        <Fig id="p_fig7" src="arc/p_fig7.png" width={610} w={702} h={711}
          at={beatAt("walk", 3, 10)} tag="Fig. 7" label="P4 真实负载：p 在 0 与 32768 之间来回" />
      </div>
    </Scene>
  );
};
