import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Big, Body, Card, Mono, Scene, PAD, cn, comma, frameOf, pct, Foot } from "../shared";

/* 问题：定义（k=0 最小，k=n/2 中位数，k=n-1 最大）→ 下界 n-1 → 全排序多一个 log。 */
const N = 1000000;

export const SProblem: React.FC = () => {
  const f = useCurrentFrame();
  const logFactor = Math.round(Math.log2(N));
  const marks = [
    { k: 0, label: "k = 0", note: "最小值" },
    { k: N / 2, label: "k = n/2", note: "中位数 · 本片主角" },
    { k: N - 1, label: "k = n-1", note: "最大值" },
  ];

  return (
    <Scene id="problem">
      <div style={{ position: "absolute", left: PAD, top: 200, width: 1080 }}>
        <Build at={frameOf("problem", 0)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>01 / 顺序统计量</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>第 k 小，到底在问什么</div>
        </Build>

        <Build at={frameOf("problem", 2)} style={{ marginTop: 40 }}>
          <div style={{ position: "relative", width: 1000, height: 150 }}>
            <div style={{ position: "absolute", top: 74, left: 0, right: 0, height: 3, background: C.panelLine }} />
            {marks.map((m, i) => {
              // 首尾两个刻度贴边，标签不能按居中摆：0 号左对齐、末号右对齐，否则会出画
              const lx = i === 0 ? -8 : i === marks.length - 1 ? -300 : -150;
              return (
              <div key={m.k} style={{ position: "absolute", left: (m.k / (N - 1)) * 1000 - 8, top: 0, textAlign: "center", width: 16 }}>
                <div style={{ opacity: pct(f, frameOf("problem", 2) + i * 12, frameOf("problem", 2) + i * 12 + 14) }}>
                  <div style={{ width: 16, height: 16, borderRadius: 8, background: i === 1 ? C.amber : C.cyan }} />
                  <div style={{ position: "absolute", top: 96, left: lx, width: 300, textAlign: i === 0 ? "left" : i === marks.length - 1 ? "right" : "center", fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkDim }}>{m.label}</div>
                  <div style={{ position: "absolute", top: 122, left: lx, width: 300, textAlign: i === 0 ? "left" : i === marks.length - 1 ? "right" : "center", fontFamily: FONT.sans, fontSize: FT.meta, color: i === 1 ? C.amber : C.inkFaint }}>{m.note}</div>
                </div>
              </div>
              );
            })}
          </div>
        </Build>

        <Build at={frameOf("problem", 3)} style={{ marginTop: 44 }}>
          <Card label="下界 · 读一遍数组" accent={C.cyan} pad={24} style={{ width: 620 }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: 18 }}>
              <Big to={N - 1} at={frameOf("problem", 4)} format={cn} size={FT.num} color={C.cyan} />
              <Mono size={FT.body} color={C.inkDim}>次比较，一次也省不掉</Mono>
            </div>
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1330, top: 232, width: 460 }}>
        <Build at={frameOf("problem", 6)}>
          <Card label="最省事的解法 · 全排序再取 a[k]" accent={C.coral} pad={22}>
            <Mono size={FT.num} color={C.coral}>n log n</Mono>
            <Body size={FT.meta} style={{ marginTop: 10 }}>多出来的 log，就是白干的活</Body>
          </Card>
        </Build>
        <Build at={frameOf("problem", 8)} style={{ marginTop: 22 }}>
          <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
            <Big to={logFactor} at={frameOf("problem", 8)} size={FT.h1} color={C.amber} format={(v) => "≈ " + Math.round(v)} />
            <Mono size={FT.body} color={C.inkDim}>倍 · n = {cn(N)}</Mono>
          </div>
          <Body size={FT.meta} style={{ marginTop: 12 }}>
            取中位数，这个 log 就是二十多倍的无用工作。
          </Body>
        </Build>
        <Build at={frameOf("problem", 9)} style={{ marginTop: 26 }}>
          <div style={{ borderLeft: "3px solid " + C.cyan, paddingLeft: 16 }}>
            <Body size={FT.body} color={C.ink}>能不能不排序，就拿到第 k 个？</Body>
          </div>
        </Build>
      </div>
      <Foot at={frameOf("problem", 1)}>{"data/quickselect/bench.json · std_sort/random/n=1e6（排序下界来自 CLRS ch.9）"}</Foot>
    </Scene>
  );
};