import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE, sceneFrames, beatAt } from "../shared";

export const SGray: React.FC = () => {
  const f = useCurrentFrame();
  const states = GRAY.code4.states;
  const flips = GRAY.code4.flipsPerBit;
  const g = GRAY.grouped;
  const sched = g.schedule ?? [];
  const cell = 42;
  // 16 行码表铺在前三分之一，三张卡依次在旁白讲到时入场；网格的 12 列再往后铺开，
  // 整场都有东西在长，而不是前四秒长完。
  const D = sceneFrames("gray");
  const rowAt = beatAt("gray", 0, 7);
  const rowStep = Math.max(1, Math.round((D * 0.3) / 16));
  const gridAt = beatAt("gray", 5, 7);
  return (
    <Scene id="gray">
      <Head kicker="04 / 数据集" title="像做实验一样安排开关" goal="让「状态」均匀地出现，而不是等它自己出现" />
      <Card style={{ position: "absolute", left: PAD, top: 268, width: 760 }} label="4 位平衡格雷码：相邻状态只差一位，每一位都翻 4 次">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {states.slice(0, 16).map((s, i) => {
            const prev = i === 0 ? null : states[i - 1];
            const flip = prev ? s.split("").findIndex((b, k) => b !== prev[k]) : -1;
            const on = pct(f, rowAt + i * rowStep, rowAt + i * rowStep + 8);
            return (
              <div key={i} style={{ display: "flex", gap: 6, opacity: on }}>
                {s.split("").map((b, k) => (
                  <div key={k} style={{
                    width: cell, height: 28, borderRadius: 4,
                    background: k === flip ? "rgba(94,234,212,0.22)" : C.bgSoft,
                    border: "1px solid " + (k === flip ? C.cyan : C.panelLine),
                    color: b === "1" ? C.ink : C.inkFaint,
                    fontFamily: FONT.mono, fontSize: FT.meta, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{b}</div>
                ))}
                <div style={{ marginLeft: 10, alignSelf: "center" }}>
                  <Mono size={FT.tiny} color={C.inkFaint}>{"s" + i}</Mono>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 18 }}>
          {flips.map((n, k) => (
            <Mono key={k} size={FT.meta} color={C.cyan}>{"bit" + k + " × " + n}</Mono>
          ))}
          <Mono size={FT.meta} color={C.inkFaint}>单次只动一个开关</Mono>
        </div>
      </Card>
      <div style={{ position: "absolute", left: PAD + 800, top: 268, width: CW - 800 }}>
        <Card accent={C.cyan} style={{ padding: 26 }}>
          <Body size={FT.body} color={C.inkDim}>不分组，18 台电器要覆盖全部状态：</Body>
          <div style={{ marginTop: 8 }}><CountRoll to={g.stateUngrouped} start={beatAt("gray", 2, 7)} dur={sceneFrames("gray") * 0.12} size={FT.num} /></div>
          <Body size={FT.body} color={C.inkDim} style={{ marginTop: 18 }}>分成 6 组、每组 3 台（示意推导，论文只给一般公式），每轮只要：</Body>
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 16 }}>
            <Mono size={FT.num} color={C.cyan}>{"6 × 2³ = " + g.eventsPerRoundGrouped}</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>{"≈ 1/" + Math.round(g.ratio) + " 的事件量"}</Mono>
          </div>
        </Card>
        <Build at={beatAt("gray", 3, 7)}>
        <Card style={{ marginTop: 20, padding: 26 }} label={"论文实测：训练 " + GRAY.paper.trainRounds + " 轮 / 验证 " + GRAY.paper.valRounds + " 轮"}>
          <div style={{ display: "flex", gap: 36 }}>
            {[
              { k: "训练事件", v: GRAY.paper.trainEvents },
              { k: "训练状态", v: GRAY.paper.trainStates },
              { k: "验证期间重叠", v: null, s: GRAY.paper.overlapPct + "%" },
            ].map((it) => (
              <div key={it.k}>
                <Mono size={FT.lead} color={C.ink}>{it.s ?? (it.v === null ? "—" : it.v.toLocaleString("en-US"))}</Mono>
                <div style={{ fontFamily: FONT.sans, fontSize: FT.tiny, color: C.inkFaint, marginTop: 4 }}>{it.k}</div>
              </div>
            ))}
          </div>
        </Card>
        </Build>
        <Build at={gridAt}>
        <Card style={{ marginTop: 18, padding: 18 }} label={"12 轮里激活的组（示意）"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: 6 }, (_, gi) => (
              <div key={gi} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Mono size={FT.tiny} color={C.inkFaint} style={{ width: 34 }}>{"g" + gi}</Mono>
                {Array.from({ length: 12 }, (_, r) => {
                  const on = sched[r] ? sched[r].active.indexOf(gi) >= 0 : false;
                  const shown = pct(f, gridAt + r * Math.max(2, Math.round((D - gridAt - 36) / 5)), gridAt + r * Math.max(2, Math.round((D - gridAt - 36) / 5)) + 6);
                  return (
                    <div key={r} style={{
                      width: 24, height: 15, borderRadius: 3,
                      background: on ? "rgba(94,234,212," + (0.25 + 0.6 * shown) + ")" : C.bgSoft,
                      border: "1px solid " + (on ? C.cyan : C.panelLine),
                    }} />
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
        </Build>
      </div>
    </Scene>
  );
};
