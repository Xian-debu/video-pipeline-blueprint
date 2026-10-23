import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Card, Cell, ListRow, Mono, Body, Scene, SIM, PAD, CW, beatAt, pct } from "../shared";

/* 概念：页 / 请求流 / 目录（2c）/ 幽灵 / L1 与 L2 / 份额 p / FRC_p。
 * 一张图走完：上面请求流，左下缓存（c 页），右下目录（2c 槽，虚线 = 只记页号）。 */
export const SConcepts: React.FC = () => {
  const f = useCurrentFrame();
  const stream = SIM.tape.rows.slice(0, 12).map((r) => r.page);
  const cache = [4, 9, 2, 7, 11, 5];
  const ghost = [13, 6, 8, 1, 15, 10];
  const p = 3;
  const pOn = pct(f, beatAt("concepts", 5, 10), beatAt("concepts", 5, 10) + 20);

  return (
    <Scene id="concepts">
      <div style={{ position: "absolute", left: PAD, top: 96, width: CW }}>
        <Build at={beatAt("concepts", 0, 10)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>03 / 四个词</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>先把名词说清楚</div>
        </Build>

        <div style={{ display: "flex", alignItems: "center", gap: 16, marginTop: 40, opacity: pct(f, beatAt("concepts", 2, 10), beatAt("concepts", 2, 10) + 18) }}>
          <Mono size={FT.meta} color={C.inkFaint}>请求流</Mono>
          <div style={{ display: "flex", gap: 6 }}>
            {stream.map((n, i) => (
              <div key={i} style={{
                width: 44, height: 44, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                fontFamily: FONT.mono, fontSize: FT.meta, color: C.ink, background: C.panel, border: "1px solid " + C.panelLine,
              }}>{n}</div>
            ))}
          </div>
          <Mono size={FT.meta} color={C.inkFaint}>→ 一个接一个</Mono>
        </div>

        <div style={{ display: "flex", gap: 56, marginTop: 44 }}>
          <div style={{ width: 560 }}>
            <Build at={beatAt("concepts", 1, 10)}>
              <Card label={"缓存 · 只装得下 c 页（这里 c = " + cache.length + "）"} accent={C.cyan}>
                <div style={{ display: "flex", gap: 8 }}>
                  {cache.map((n, i) => <Cell key={i} label={n} size={60} />)}
                </div>
                <Body style={{ marginTop: 16 }}>页是缓存搬运的最小单位；数据存在这里，才算命中。</Body>
              </Card>
            </Build>
            <div style={{ height: 24 }} />
            <Build at={beatAt("concepts", 7, 10)}>
              <Card label="目录 · 记住 2c 页" accent={C.violet}>
                <div style={{ display: "flex", gap: 24 }}>
                  <ListRow name="L1 · 只见过一次" cells={[4, 9, 2]} size={44} accent={C.cyan} />
                  <ListRow name="L2 · 见过两次以上" cells={[7, 11, 5]} size={44} accent={C.amber} />
                </div>
                <div style={{ marginTop: 16, opacity: pct(f, beatAt("concepts", 4, 10), beatAt("concepts", 4, 10) + 18) }}>
                  <Mono size={FT.meta} color={C.inkFaint}>目录只记页号，不存数据，所以很便宜。</Mono>
                </div>
              </Card>
            </Build>
          </div>

          <div style={{ width: 640 }}>
            <Build at={beatAt("concepts", 3, 10)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                <Mono size={FT.meta} color={C.inkFaint}>幽灵 · 被淘汰、还可能回来的页只留页号</Mono>
                <Mono size={FT.tiny} color={C.inkFaint}>{"2c = " + cache.length * 2 + " 槽"}</Mono>
              </div>
              <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap", width: 640 }}>
                {ghost.map((n, i) => (
                  <Cell key={i} label={n} size={58} dim />
                ))}
              </div>
              <Body style={{ marginTop: 14 }}>
                缓存里放 c 页，目录里记 2c 页 —— 多出来的那一倍，全是页号。
              </Body>
            </Build>

            <div style={{ marginTop: 36, opacity: pOn }}>
              <Mono size={FT.meta} color={C.inkFaint}>份额 p · 允许 recency 一侧用多少页</Mono>
              <div style={{ display: "flex", gap: 8, marginTop: 12 }}>
                {Array.from({ length: cache.length }).map((_, i) => (
                  <div key={i} style={{
                    width: 58, height: 26, borderRadius: 5,
                    background: i < p ? "rgba(120,200,220,0.5)" : "rgba(200,140,90,0.35)",
                    border: "1px solid " + (i < p ? C.cyan : C.amber),
                  }} />
                ))}
              </div>
              <div style={{ display: "flex", gap: 20, marginTop: 10 }}>
                <Mono size={FT.tiny} color={C.cyan}>{"T1 最多 p = " + p}</Mono>
                <Mono size={FT.tiny} color={C.amber}>{"T2 最多 c − p = " + (cache.length - p)}</Mono>
              </div>
              <div style={{ marginTop: 18, opacity: pct(f, beatAt("concepts", 6, 10), beatAt("concepts", 6, 10) + 18) }}>
                <Mono size={FT.body} color={C.ink}>固定 p 的这一族策略，论文记作 FRC_p。</Mono>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Scene>
  );
};
