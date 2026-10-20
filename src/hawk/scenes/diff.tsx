import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE, sceneFrames, beatAt } from "../shared";

export const SDiff: React.FC = () => {
  const total = WAVE.series.total;
  const w = 1080;
  const hTot = 210;
  const hDif = 210;
  const tLo = Math.min(...total) - 20;
  const tHi = Math.max(...total) + 20;
  const N = total.length;
  /** 稳态差分：与 LAG 个电压周期前的自己相减。前 LAG 个点没有历史，留空。 */
  const LAG = 30;
  const d30: (number | null)[] = total.map((v, i) => (i < LAG ? null : v - total[i - LAG]));
  /** 纵轴放大到 ±90W：1500W 的台阶会冲出量程，40W 的台阶正好落在中间看得见。 */
  const zLo = -90;
  const zHi = 90;
  // 找出 +40W 平台（差分后一段稳定落在 18–90W 的区间）和冲出量程的大台阶。
  const plateau = (() => {
    let best = { a: -1, b: -1 };
    let cur = -1;
    d30.forEach((v, i) => {
      const ok = v !== null && v > 18 && v < 90;
      if (ok && cur < 0) cur = i;
      if (cur >= 0 && (!ok || i === N - 1)) {
        if (i - cur > best.b - best.a) best = { a: cur, b: i };
        cur = -1;
      }
    });
    return best;
  })();
  const clipped = d30.map((v, i) => (v === null ? -1 : Math.abs(v) > 90 ? i : -1)).filter((i) => i >= 0);
  const clipAt = clipped.length ? clipped[0] : -1;
  const s = WAVE.sinr;
  return (
    <Scene id="diff">
      <Head kicker="06 / 特征" title="不看总量，看变化量" goal="先减掉上一个稳态，剩下的才是信号" />
      <div style={{ position: "absolute", left: PAD, top: 258, width: w + 40 }}>
        <Card label="总电流：40W 的开关被 1500W 的台阶压得看不见" style={{ width: w + 40, padding: 22 }}>
          <Line values={total} w={w} h={hTot} lo={tLo} hi={tHi} color={C.inkDim} at={6} dur={sceneFrames("diff") * 0.16} />
        </Card>
        <Card label="稳态差分：与 30 个周期前的自己相减（纵轴放大到 ±90 W）" style={{ width: w + 40, padding: 22, marginTop: 16 }} accent={C.cyan}>
          <div style={{ position: "relative" }}>
            <Line values={d30} w={w} h={hDif} lo={zLo} hi={zHi} color={C.cyan} at={Math.round(sceneFrames("diff") * 0.17)} dur={sceneFrames("diff") * 0.2} />
            {plateau.a >= 0 ? (
              <div style={{
                position: "absolute", left: (plateau.a / N) * 100 + "%", width: ((plateau.b - plateau.a) / N) * 100 + "%",
                top: 0, height: hDif, border: "1px dashed " + C.amber, borderRadius: 6, pointerEvents: "none",
              }}>
                <Mono size={14} color={C.amber} style={{ position: "absolute", left: 8, top: 6 }}>{"+40 W 台阶"}</Mono>
              </div>
            ) : null}
            {clipAt >= 0 ? (
              <div style={{ position: "absolute", left: (clipAt / N) * 100 + "%", top: -4, transform: "translateX(-50%)", pointerEvents: "none" }}>
                <Mono size={13} color={C.coral}>{"1500 W 台阶冲出量程"}</Mono>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: PAD + w + 90, top: 300, width: CW - w - 90 }}>
        <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.meta }}>SINR：信号 / 干扰</Mono>
        <div style={{ marginTop: 18 }}>
          <Body size={FT.meta} color={C.inkFaint}>直接看总电流</Body>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Mono size={FT.num} color={C.coral}>{s.direct.ratio.toFixed(3)}</Mono>
            <Mono size={FT.tiny} color={C.inkFaint}>{s.direct.target + " / " + s.direct.others + " W"}</Mono>
          </div>
          <div style={{ height: 1, background: C.panelLine, margin: "18px 0" }} />
          <Body size={FT.meta} color={C.inkFaint}>差分之后</Body>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Mono size={FT.num} color={C.cyan}>{s.diff.ratio.toFixed(3)}</Mono>
            <Mono size={FT.tiny} color={C.inkFaint}>{s.diff.target + " / " + (s.diff.other ?? 60) + " W"}</Mono>
          </div>
          <div style={{ height: 1, background: C.panelLine, margin: "18px 0" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Mono size={FT.lead} color={C.amber}>{"+" + s.gainDb.toFixed(1) + " dB"}</Mono>
            <Mono size={FT.tiny} color={C.inkFaint}>可分性提升</Mono>
          </div>
        </div>
        <Build at={beatAt("diff", 3, 5)} style={{ marginTop: 34 }}>
          <Body size={FT.meta} color={C.inkFaint} style={{ lineHeight: 1.7 }}>
            窗口取 {WAVE.window ? WAVE.window.cycles : 30} 个电压周期，<br />
            跳过前 {WAVE.window ? WAVE.window.transientCycles : 4} 个瞬态周期。
          </Body>
        </Build>
      </div>
      <Build at={beatAt("diff", 4, 5)} style={{ position: "absolute", left: PAD, bottom: 190 }}>
        <Mono size={FT.meta} color={C.inkFaint}>{"示意波形：按论文 §4.1 的 41/1480 与 39/60 复现，不是实测数据"}</Mono>
      </Build>
    </Scene>
  );
};
