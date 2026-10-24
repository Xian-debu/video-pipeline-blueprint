import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Mono, Scene, PAD, Tbl, cn, frameOf, perElem, R_, msOf, Foot } from "../shared";

/* 标准库与选型表：把方法放回场景里。 */
const N = 1000000;
const METHODS: { id: string; name: string; note: string }[] = [
  { id: "std_nth", name: "std::nth_element", note: "只要一个值" },
  { id: "floyd", name: "Floyd–Rivest", note: "抽样夹逼" },
  { id: "hoare", name: "Hoare 划分", note: "期望线性" },
  { id: "threeway", name: "三路划分", note: "重复值多" },
  { id: "bfprt", name: "中位数的中位数", note: "最坏线性" },
  { id: "heap_topk", name: "堆 top-k", note: "只要最大的 k 个" },
  { id: "partial_sort", name: "partial_sort", note: "前 k 个要有序" },
  { id: "std_sort", name: "std::sort", note: "本来就要全序" },
];

export const SStd: React.FC = () => {
  const f = useCurrentFrame();
  const rows = METHODS.map((m) => {
    const r = R_(m.id, "random", N);
    return { ...m, cmp: perElem(r), ms: msOf(m.id, "random", N) };
  });

  return (
    <Scene id="std">
      <div style={{ position: "absolute", left: PAD, top: 176, width: 1180 }}>
        <Build at={frameOf("std", 0)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>10 / 工业解法</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>introselect 与选型表</div>
          <Mono size={FT.meta} color={C.inkFaint} style={{ marginTop: 8 }}>{"n = " + cn(N) + " · 随机 · k 中位"}</Mono>
        </Build>

        <Build at={frameOf("std", 2)} style={{ marginTop: 26 }}>
          <Tbl
            cols={[
              { key: "name", label: "方法", w: 300 },
              { key: "cmp", label: "次 / 元素", w: 180, align: "right" },
              { key: "ms", label: "毫秒", w: 160, align: "right" },
              { key: "note", label: "用在", w: 320 },
            ]}
            rows={rows.map((r) => ({
              key: r.id,
              strong: r.id === "std_nth",
              cells: {
                name: <Mono size={FT.mono} color={r.id === "std_nth" ? C.cyan : C.inkDim}>{r.name}</Mono>,
                cmp: <span style={{ color: r.id === "std_nth" ? C.cyan : C.inkDim }}>{r.cmp.toFixed(2)}</span>,
                ms: <span>{Number.isFinite(r.ms) ? r.ms.toFixed(2) : "—"}</span>,
                note: <span style={{ fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkFaint }}>{r.note}</span>,
              },
            }))}
            at={frameOf("std", 2)}
            stagger={7}
            rowH={50}
          />
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1360, top: 250, width: 430 }}>
        <Build at={frameOf("std", 1)}>
          <Card label="introselect · 两层" accent={C.cyan} pad={20}>
            <Body size={FT.meta}>先用快速划分；深度超过阈值，换成有最坏界的方法。</Body>
          </Card>
        </Build>
        <Build at={frameOf("std", 9)} style={{ marginTop: 22 }}>
          <div style={{ borderLeft: "3px solid " + C.cyan, paddingLeft: 14, display: "flex", flexDirection: "column", gap: 12 }}>
            <Body size={FT.meta} color={C.ink}>要一个值 → nth_element</Body>
            <Body size={FT.meta} color={C.ink}>要前 k 个有序 → partial_sort</Body>
            <Body size={FT.meta} color={C.ink}>要最坏保证 → 中位数方法</Body>
            <Body size={FT.meta} color={C.inkFaint}>其余情况，先量再选</Body>
          </div>
        </Build>
      </div>
      <Foot at={frameOf("std", 1)}>{"data/quickselect/{bench,timing}.json · 11 种方法 · random · n=1e6"}</Foot>
    </Scene>
  );
};