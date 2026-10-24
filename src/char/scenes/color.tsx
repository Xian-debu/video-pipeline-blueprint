import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Head, Mono, PAD, PLATES, Scene, frameOf } from "../shared";
import { Plate } from "../plates";

/* 染色场：三张贴片是同一份几何、同一套灯，只换了身体材质的颜色常量。
 * 右上角写的是脚本里那个参数的名字，让「变体是参数」不是一句口号。 */

const VARIANTS = [
  { name: "color_yellow", label: "黄", note: "0.82, 0.50, 0.05" },
  { name: "color_mint", label: "薄荷绿", note: "0.10, 0.62, 0.45" },
  { name: "color_plum", label: "梅子紫", note: "0.46, 0.10, 0.34" },
];

const swatch = (rgb: number[]) => {
  const to = (v: number) => Math.round(Math.min(1, Math.max(0, v)) ** (1 / 2.2) * 255);
  return "rgb(" + to(rgb[0]) + "," + to(rgb[1]) + "," + to(rgb[2]) + ")";
};

export const SColor: React.FC = () => {
  const f = useCurrentFrame();
  const variants = (PLATES.params.col_variants ?? {}) as Record<string, number[]>;
  return (
    <Scene id="color">
      <Head kicker="08 / 变体是参数" title="换色不改模型" goal="同一份几何，同一个材质树" />

      <div style={{ position: "absolute", left: PAD, top: 300, display: "flex", gap: 22 }}>
        {VARIANTS.map((v, i) => (
          <Build key={v.name} at={frameOf("color", i + 1)} style={{ width: 372 }}>
            <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 12, overflow: "hidden" }}>
              <Plate name={v.name} w={370} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginTop: 10 }}>
              <div style={{ width: 14, height: 14, borderRadius: 3, background: swatch(variants[v.label === "黄" ? "yellow" : v.label === "薄荷绿" ? "mint" : "plum"] ?? [1, 1, 1]) }} />
              <Mono size={FT.body} color={C.ink}>{v.label}</Mono>
              <Mono size={FT.micro} color={C.inkFaint}>{v.note}</Mono>
            </div>
          </Build>
        ))}
      </div>

      <div style={{ position: "absolute", left: 1240, top: 300, width: 608 }}>
        <Build at={frameOf("color", 2)}>
          <Card label="材质树 · body" accent={C.amber}>
            <div style={{ fontFamily: FONT.mono, fontSize: FT.code, color: C.inkDim, lineHeight: 1.9 }}>
              Object 坐标 → u=(x/rx)², v=((z-z0)/rz)²<br />
              r² = u + v → MapRange 1.00→0.90<br />
              × Y 朝向门 → Mix Shader<br />
              黄 BSDF ⇄ 奶油 BSDF
            </div>
            <div style={{ height: 1, background: C.panelLine, margin: "16px 0" }} />
            <Body size={FT.meta} color={C.inkFaint}>
              斑块不是贴上去的几何，是同一个表面上的第二个分支 —— 所以绑定不会撕开，换色只改一个常量。
            </Body>
          </Card>
        </Build>
        <Build at={frameOf("color", 4)} style={{ marginTop: 24 }}>
          <Mono size={FT.meta} color={C.inkFaint}>
            灯光不变 · 相机不变 · 只有 col_variants 变了
          </Mono>
        </Build>
      </div>

      <div style={{ position: "absolute", left: PAD, top: 800, width: 1100 }}>
        <Build at={frameOf("color", 5)}>
          <Body size={FT.body} color={C.inkDim}>
            三种颜色，同一份几何，同一份骨架。
          </Body>
        </Build>
      </div>
    </Scene>
  );
};
