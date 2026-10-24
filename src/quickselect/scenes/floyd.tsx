import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Big, Body, Card, Mono, Scene, PAD, cn, comma, frameOf, perElem, pct, R_, T_, Foot } from "../shared";

/* 抽样：抽 s 个样本，用两个样本值 L、R 把答案夹在中间，一次划分跳过绝大多数数据。 */
const N = 1000000;

export const SFloyd: React.FC = () => {
  const f = useCurrentFrame();
  const row = R_("floyd", "random", N);
  const stdRow = R_("std_nth", "random", N);
  const cmpE = perElem(row);
  const stdE = perElem(stdRow);
  const floydT = T_("floyd", "random", N);
  const at = frameOf("floyd", 3);

  return (
    <Scene id="floyd">
      <div style={{ position: "absolute", left: PAD, top: 186, width: 1240 }}>
        <Build at={frameOf("floyd", 0)}>
          <Mono size={FT.label} color={C.violet} style={{ letterSpacing: FT_T.label }}>09 / 跳过数据</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>先抽样，再圈定</div>
        </Build>

        <Build at={at} style={{ marginTop: 40 }}>
          <Card label="值空间 · 一次划分只保留中间那一段" accent={C.cyan} pad={26} style={{ width: 1140 }}>
            <div style={{ position: "relative", height: 96 }}>
              <div style={{ position: "absolute", top: 40, left: 0, width: 1080, height: 24, borderRadius: 6, overflow: "hidden", display: "flex" }}>
                <div style={{ width: 1080 * 0.28, background: "rgba(251,113,133,0.28)" }} />
                <div style={{ width: 1080 * 0.30, background: "rgba(94,234,212,0.45)" }} />
                <div style={{ width: 1080 * 0.42, background: "rgba(167,139,250,0.28)" }} />
              </div>
              {[
                { x: 0.28, t: "小于 L", c: C.coral, side: -1 },
                { x: 0.58, t: "介于 L 与 R", c: C.cyan, side: 0 },
                { x: 0.79, t: "大于 R", c: C.violet, side: 1 },
              ].map((m, i) => (
                <div key={m.t} style={{ position: "absolute", left: 1080 * m.x - 80, top: 4, width: 160, textAlign: "center", opacity: pct(f, at + i * 10, at + i * 10 + 14) }}>
                  <Mono size={FT.meta} color={m.c}>{m.t}</Mono>
                </div>
              ))}
              <div style={{ position: "absolute", left: 1080 * 0.28 - 1, top: 30, width: 2, height: 44, background: C.cyan }} />
              <div style={{ position: "absolute", left: 1080 * 0.58 - 1, top: 30, width: 2, height: 44, background: C.cyan }} />
              <div style={{ position: "absolute", left: 1080 * 0.28 - 10, top: 78, width: 20, fontFamily: FONT.mono, fontSize: FT.meta, color: C.cyan, textAlign: "center" }}>L</div>
              <div style={{ position: "absolute", left: 1080 * 0.58 - 10, top: 78, width: 20, fontFamily: FONT.mono, fontSize: FT.meta, color: C.cyan, textAlign: "center" }}>R</div>
            </div>
            <Body size={FT.meta} style={{ marginTop: 6 }}>
              两个样本值把答案夹住：k 落在哪一段，答案就在哪一段。
            </Body>
          </Card>
        </Build>

        <Build at={frameOf("floyd", 4)} style={{ marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 16 }}>
            <Big to={99} at={frameOf("floyd", 4)} format={(v) => Math.round(v) + "%"} size={FT.display} color={C.amber} />
            <Mono size={FT.body} color={C.inkDim}>的数据，一次划分就不再看了</Mono>
          </div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1352, top: 236, width: 440 }}>
        <Build at={frameOf("floyd", 5)}>
          <Card label={"实测 · n = " + cn(N)} accent={C.cyan} pad={22}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
              <Mono size={FT.display} color={C.cyan}>{cmpE.toFixed(2)}</Mono>
              <Mono size={FT.meta} color={C.inkDim}>次 / 元素</Mono>
            </div>
            <Mono size={FT.body} color={C.ink} style={{ display: "block", marginTop: 8 }}>{"比较 " + cn(row.cmp) + " 次 · " + floydT.ms.toFixed(2) + " ms"}</Mono>
          </Card>
        </Build>
        <Build at={frameOf("floyd", 6)} style={{ marginTop: 18 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Mono size={FT.h1} color={C.amber}>{floydT.ns_per_elem.toFixed(1)}</Mono>
            <Mono size={FT.meta} color={C.inkDim}>ns / 元素（墙钟）</Mono>
          </div>
          <Body size={FT.meta} style={{ marginTop: 8 }}>{"标准库 " + stdE.toFixed(2) + " 次 / 元素；抽样版更少"}</Body>
        </Build>
        <Build at={frameOf("floyd", 7)} style={{ marginTop: 24 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <Body size={FT.meta}>· 抽样只决定跳多远，不决定正确性</Body>
            <Body size={FT.meta}>· 抽偏了就退回普通划分，答案永远对</Body>
            <Body size={FT.meta}>· 样本越大跳得越远，但采样也要钱</Body>
          </div>
        </Build>
      </div>
      <Foot at={frameOf("floyd", 1)}>{"data/quickselect/{bench,timing}.json · floyd · random · n=1e6"}</Foot>
    </Scene>
  );
};