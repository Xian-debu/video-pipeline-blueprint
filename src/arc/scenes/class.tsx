import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Card, Cell, Mono, Body, Scene, PAD, CW, beatAt, pct } from "../shared";

/* Π(c)：四张表 T1 / B1 / T2 / B2 的布局；缓存里只有 T1 ∪ T2（恰好 c 页），
 * B1/B2 只留页号。两个可能的淘汰动作，以及固定 p 时 T1 的份额。 */
export const SClass: React.FC = () => {
  const f = useCurrentFrame();
  const p = 4;
  const c = 10;
  const t1 = [4, 9, 2, 7];
  const t2 = [11, 5, 8, 1, 6, 3];
  const b1 = [13, 15, 10];
  const b2 = [12, 14, 16, 17];
  const actAt = beatAt("class", 3, 10);

  return (
    <Scene id="class">
      <div style={{ position: "absolute", left: PAD, top: 96, width: CW }}>
        <Build at={beatAt("class", 0, 10)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>05 / Π(c)</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>一族策略，一个参数</div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: PAD, top: 250, width: 1010 }}>
        <div style={{ border: "1px solid " + C.panelLine, borderRadius: 14, padding: 26, background: C.panel }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 16 }}>
            <Mono size={FT.meta} color={C.cyan}>{"缓存 · 恰好 c = " + c + " 页"}</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>T1 和 T2 是真数据</Mono>
          </div>
          <div style={{ display: "flex", gap: 18 }}>
            <div style={{ width: 430 }}>
              <Mono size={FT.meta} color={C.cyan}>{"T1 · " + t1.length + " 页（上限 p）"}</Mono>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {t1.map((n, i) => <Cell key={i} label={n} size={62} accent={C.cyan} />)}
              </div>
            </div>
            <div style={{ width: 500 }}>
              <Mono size={FT.meta} color={C.amber}>{"T2 · " + t2.length + " 页"}</Mono>
              <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
                {t2.map((n, i) => <Cell key={i} label={n} size={62} accent={C.amber} />)}
              </div>
            </div>
          </div>

          <div style={{ marginTop: 30, opacity: pct(f, actAt, actAt + 20) }}>
            <div style={{ display: "flex", gap: 22 }}>
              <div style={{ width: 430, borderTop: "2px solid " + C.cyan, paddingTop: 10 }}>
                <Mono size={FT.meta} color={C.cyan}>动作一：淘汰 T1 的最后一页 → 进 B1</Mono>
              </div>
              <div style={{ width: 500, borderTop: "2px solid " + C.amber, paddingTop: 10 }}>
                <Mono size={FT.meta} color={C.amber}>动作二：淘汰 T2 的最后一页 → 进 B2</Mono>
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 30, marginTop: 26 }}>
          <div style={{ width: 490 }}>
            <Mono size={FT.meta} color={C.inkFaint}>B1 · 从 T1 淘汰下来的页号</Mono>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {b1.map((n, i) => <Cell key={i} label={n} size={52} dim />)}
            </div>
          </div>
          <div style={{ width: 490 }}>
            <Mono size={FT.meta} color={C.inkFaint}>B2 · 从 T2 淘汰下来的页号</Mono>
            <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
              {b2.map((n, i) => <Cell key={i} label={n} size={52} dim />)}
            </div>
          </div>
        </div>
      </div>

      <div style={{ position: "absolute", left: 1110, top: 250, width: 680 }}>
        <Build at={beatAt("class", 2, 10)}>
          <Card label="固定 p 的份额" accent={C.violet}>
            <div style={{ display: "flex", gap: 6 }}>
              {Array.from({ length: c }).map((_, i) => (
                <div key={i} style={{
                  width: 34, height: 34, borderRadius: 5,
                  background: i < p ? "rgba(120,200,220,0.45)" : "rgba(200,140,90,0.35)",
                  border: "1px solid " + (i < p ? C.cyan : C.amber),
                }} />
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 10 }}>
              <Mono size={FT.tiny} color={C.cyan}>{"T1 ≤ p = " + p}</Mono>
              <Mono size={FT.tiny} color={C.amber}>{"T2 ≤ c − p = " + (c - p)}</Mono>
            </div>
          </Card>
        </Build>
        <div style={{ height: 22 }} />
        <Build at={beatAt("class", 3, 10)}>
          <Card label="两个端点" accent={C.amber}>
            <Body>p = c 时没有 T2，只有 recency，就是 LRU。</Body>
            <Body style={{ marginTop: 10 }}>p = 0 时没有 T1，只剩频率。</Body>
          </Card>
        </Build>
        <div style={{ height: 22 }} />
        <Build at={beatAt("class", 4, 10)}>
          <Card label="关键约束" accent={C.cyan}>
            <Body>命中时也只能动这两处：T1 的最后一页，或 T2 的最后一页。</Body>
          </Card>
        </Build>
      </div>
    </Scene>
  );
};
