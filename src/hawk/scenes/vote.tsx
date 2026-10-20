import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE, sceneFrames, beatAt } from "../shared";

export const SVote: React.FC = () => {
  const f = useCurrentFrame();
  const v = WAVE.vote;
  const cats = Object.keys(v.counts);
  const labels: string[] = [];
  cats.forEach((c) => { for (let k = 0; k < v.counts[c]; k++) labels.push(c); });
  while (labels.length < 30) labels.push(cats[0]);
  const mixed: string[] = [];
  const n = 30;
  for (let i = 0; i < n; i++) mixed.push(labels[Math.floor((i * 13) % n)]);
  const D = sceneFrames("vote");
  /** 一票一个周期：30 个方块按旁白的节拍逐个落位，而不是开场两秒内全部亮完。 */
  const voteStep = Math.max(2, Math.round((D * 0.62 - 14) / 30));
  const colOf = (c: string) => (c === v.decided ? C.cyan : c === "noise" ? C.amber : C.inkFaint);
  return (
    <Scene id="vote">
      <Head kicker="07 / 决策" title="一次判断不可靠，那就数票" goal="30 个周期各判一次，够票才报" />
      <div style={{ position: "absolute", left: PAD, top: 262, width: 980 }}>
        <Card label="30 个周期的分类结果（每个方块 = 一个周期）" style={{ width: 980, padding: 26 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 10 }}>
            {mixed.map((c, i) => {
              const o = pct(f, 14 + i * voteStep, 14 + i * voteStep + 10);
              return (
                <div key={i} style={{
                  height: 42, borderRadius: 6, opacity: 0.25 + 0.75 * o,
                  background: c === v.decided ? "rgba(94,234,212,0.16)" : "transparent",
                  border: "1px solid " + colOf(c), display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONT.mono, fontSize: FT.micro, color: colOf(c),
                }}>{c === v.decided ? "GO" : c === "noise" ? "NO" : "·"}</div>
              );
            })}
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: PAD + 1030, top: 262, width: CW - 1030 }}>
        <Card accent={C.cyan} style={{ padding: 26 }}>
          <Body size={FT.meta} color={C.inkFaint}>通过阈值</Body>
          <div style={{ marginTop: 6 }}><CountRoll to={v.counts[v.decided]} start={beatAt("vote", 3, 6)} dur={30} size={FT.num} color={C.cyan} /></div>
          <div style={{ marginTop: 6 }}>
            <Mono size={FT.meta} color={C.inkFaint}>{"阈值 " + v.threshold + " 票 · 共 30 个周期"}</Mono>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ position: "relative", height: 12, background: C.bgSoft, borderRadius: 6, border: "1px solid " + C.panelLine }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6, background: C.cyan,
                width: pct(f, beatAt("vote", 3, 6), beatAt("vote", 3, 6) + 40) * Math.min(100, (v.counts[v.decided] / 30) * 100) + "%",
              }} />
              <div style={{ position: "absolute", top: -6, bottom: -6, left: (v.threshold / 30) * 100 + "%", width: 2, background: C.coral }} />
            </div>
          </div>
        </Card>
        <Build at={beatAt("vote", 4, 6)} style={{ marginTop: 24 }}>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h2, color: C.ink }}>{"判定：" + v.decided}</div>
          <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 8 }}>
            单个周期会看错；30 票里错几票，不影响结论。
          </Body>
        </Build>
      </div>
      <Build at={beatAt("vote", 5, 6)} style={{ position: "absolute", left: PAD, bottom: 200 }}>
        <Mono size={FT.meta} color={C.inkFaint}>窗口太短，瞬态占比太高；太长，容易撞上第二次开关。</Mono>
      </Build>
    </Scene>
  );
};
