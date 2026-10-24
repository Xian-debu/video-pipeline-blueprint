import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Chip, Mono, Scene, PAD, cn, frameOf, pct, R_ } from "../shared";

/* 开场：一亿个数里第 k 小。左边标题，右边一排数里只圈出一个。
 * 后面三件事是整部片的骨架，先说清楚要看什么。 */
const ROW = [61, 7, 94, 23, 88, 15, 42, 3, 77, 50, 19, 68];

export const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  const n = R_("std_nth", "random", 1000000).n;
  const pick = 5; // 这排数里的第 5 小（演示用，不是测量值）
  const sorted = [...ROW].sort((a, b) => a - b);
  const kth = sorted[pick]; // = 42，高亮按数值匹配，不按下标，避免圈错格子

  return (
    <Scene id="open">
      <div style={{ position: "absolute", left: PAD, top: 210, width: 860 }}>
        <Build at={frameOf("open", 0)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>QUICKSELECT · 第六部</Mono>
        </Build>
        <Build at={frameOf("open", 0) + 8}>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.cover, color: C.ink, lineHeight: 1.05, marginTop: 18, letterSpacing: FT_T.cover }}>
            快速选择
          </div>
        </Build>
        <Build at={frameOf("open", 0) + 16}>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.inkDim, marginTop: 14 }}>只找第 k 小</div>
        </Build>
        <Build at={frameOf("open", 1)} style={{ marginTop: 26 }}>
          <Body size={FT.lead} color={C.inkDim}>
            {cn(n)} 个数里，第 k 小是哪个？<br />
            不排序，只要一个。
          </Body>
        </Build>
        <Build at={frameOf("open", 7)} style={{ marginTop: 30 }}>
          <div style={{ width: 120, height: 3, background: C.cyan }} />
          <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 16 }}>
            所有数字来自这台机器上的 C++ 实测 · 代码在仓库里
          </Body>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1020, top: 236, width: 760 }}>
        <Build at={frameOf("open", 1)}>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            {ROW.map((v, i) => {
              const on = v === kth;
              const hot = f >= frameOf("open", 2) && on;
              return (
                <div key={i} style={{
                  width: 104, height: 96, display: "flex", alignItems: "center", justifyContent: "center",
                  borderRadius: 12, border: "2px solid " + (hot ? C.amber : C.panelLine),
                  background: hot ? "rgba(251,191,36,0.10)" : C.panel,
                  fontFamily: FONT.mono, fontSize: FT.num, color: hot ? C.ink : C.inkDim,
                }}>{v}</div>
              );
            })}
          </div>
        </Build>
        <Build at={frameOf("open", 2)} style={{ marginTop: 22 }}>
          <Mono size={FT.body} color={C.amber}>{"第 " + pick + " 小 = " + kth + "（这一排里）"}</Mono>
        </Build>
        <div style={{ marginTop: 40, display: "flex", flexDirection: "column", gap: 16 }}>
          <Build at={frameOf("open", 4)}><Chip color={C.cyan} at={0}>1 · 排序多贵</Chip></Build>
          <Build at={frameOf("open", 5)}><Chip color={C.violet} at={0}>2 · 比较次数不是时间</Chip></Build>
          <Build at={frameOf("open", 6)}><Chip color={C.amber} at={0}>3 · 四种保证</Chip></Build>
        </div>
      </div>
    </Scene>
  );
};