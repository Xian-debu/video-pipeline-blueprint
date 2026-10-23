import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Card, ListRow, Mono, Body, Scene, PAD, CW, beatAt, pct } from "../shared";

/* DBL(2c)：一个比缓存大一倍的目录，两条 LRU 列表。c = 3 的手算例子，
 * 四个状态跟着旁白走：命中 → 移到 L2 前；L1 满时的缺失；L1 不满时的缺失。 */
const C_PAGES = 3;
const STATES = [
  { l1: [4, 2, 9], l2: [7, 11], note: "初始：目录里 5 页，缓存只放前 c 页" },
  { l1: [4, 2, 9], l2: [11, 7], note: "命中 11：移到 L2 的最前面" },
  { l1: [4, 2], l2: [14, 11, 7], note: "缺失 14，L1 已满：淘汰 L1 最后，新页进 L2" },
  { l1: [16, 4, 2], l2: [14, 11, 7], note: "缺失 16，L1 未满：新页进 L1 最前面" },
];

export const SDbl: React.FC = () => {
  const f = useCurrentFrame();
  const ats = [0, 1, 2, 3].map((i) => beatAt("dbl", [2, 3, 4, 5][i], 10));
  const idx = ats.reduce((n, at, i) => (f >= at ? i : n), 0);
  const st = STATES[idx];

  return (
    <Scene id="dbl">
      <div style={{ position: "absolute", left: PAD, top: 96, width: CW }}>
        <Build at={beatAt("dbl", 0, 10)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>04 / DBL(2c)</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>一个比缓存大一倍的目录</div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: PAD, top: 268, width: 1000 }}>
        <Card label={"c = " + C_PAGES + " · 目录容量 2c = " + C_PAGES * 2 + " 页"} accent={C.cyan}>
          <div style={{ display: "flex", flexDirection: "column", gap: 26 }}>
            <ListRow name="L1 · 只见过一次" cells={st.l1} cap={C_PAGES} w={900} accent={C.cyan} />
            <ListRow name="L2 · 见过两次以上" cells={st.l2} w={900} accent={C.amber} />
          </div>
          <div style={{ marginTop: 30, display: "flex", gap: 18 }}>
            <div style={{ width: 470 }}>
              <Mono size={FT.meta} color={C.inkFaint}>MRU</Mono>
              <div style={{ height: 4, background: C.cyan, opacity: 0.5, marginTop: 6 }} />
            </div>
            <div style={{ width: 470 }}>
              <Mono size={FT.meta} color={C.inkFaint}>LRU · 最久没被用</Mono>
              <div style={{ height: 4, background: C.coral, opacity: 0.5, marginTop: 6 }} />
            </div>
          </div>
        </Card>

        <div style={{ marginTop: 26, height: 40 }}>
          <Mono size={FT.body} color={C.ink}>{"→ " + st.note}</Mono>
        </div>
      </div>

      <div style={{ position: "absolute", left: 1120, top: 268, width: 670 }}>
        <Card label="两条不变量" accent={C.violet}>
          <Mono size={FT.h2} color={C.ink}>{"0 < |L1| + |L2| ≤ 2c"}</Mono>
          <div style={{ height: 12 }} />
          <Mono size={FT.h2} color={C.ink}>{"0 ≤ |L1| ≤ c，0 ≤ |L2| ≤ 2c"}</Mono>
        </Card>
        <div style={{ height: 22 }} />
        <Build at={beatAt("dbl", 6, 10)}>
          <Card label="它是一个框架，不是算法" accent={C.amber}>
            <Body>把一个参数设成 p = c，DBL 就退化成 LRU。</Body>
            <div style={{ marginTop: 14 }}>
              <Mono size={FT.body} color={C.amber}>规则没变，只是不再自适应。</Mono>
            </div>
          </Card>
        </Build>
      </div>
    </Scene>
  );
};
