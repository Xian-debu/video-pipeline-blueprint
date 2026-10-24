import React from "react";
import { C, FONT, FT } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Head, Mono, PAD, PLATES, Scene, frameOf } from "../shared";
import { Plate } from "../plates";

/* 斑块场：这块奶油色一开始是一片独立的面贴上去的（白盘子、绑骨后撕开），
 * 现在它是同一个材质里的两个分支 —— 没有新几何，所以不会撕。 */

const patch = PLATES.params.patch as { t: number; rx: number; rz: number };

export const SPatch: React.FC = () => (
  <Scene id="patch">
    <Head kicker="04 / 奶油色肚皮" title="用材质，不用几何" goal="静止姿势算一次权重，烘成顶点属性，再乘一个朝向门" />

    <div style={{ position: "absolute", left: PAD, top: 300 }}>
      <Plate name="patch_mask" w={760} />
      <Mono size={FT.meta} color={C.inkFaint}>patch_mask · 同一份几何，只换了材质（scripts/char/gen.py --jobs patch）</Mono>
    </div>

    <div style={{ position: "absolute", left: 960, top: 292, width: 880 }}>
      <Build at={frameOf("patch", 1)}>
        <Card label="静止姿势里算一次，烘进顶点属性" accent={C.amber}>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.code, color: C.ink, lineHeight: 1.95 }}>
            u = (x / {patch.rx.toFixed(3)})²<br />
            v = ((z − {patch.t.toFixed(2)}) / {patch.rz.toFixed(3)})²<br />
            w = clamp((1 − (u + v)) / 0.10)&nbsp;<span style={{ color: C.cyan }}>→ 0.90…1.00 平滑</span><br />
            gate = clamp((0.005 − y) / 0.025)&nbsp;<span style={{ color: C.violet }}>→ 只给正面</span><br />
            patch = w · gate&nbsp;<span style={{ color: C.amber }}>→ 顶点属性 → Mix Shader</span>
          </div>
        </Card>
      </Build>
      <Build at={frameOf("patch", 3)} style={{ marginTop: 26 }}>
        <Body size={FT.body} color={C.inkDim} style={{ lineHeight: 1.8 }}>
          距离在一以内是奶油色，一以外是黄色；中间 0.90–1.00 做平滑过渡，边界就没有锯齿。<br />
          朝向门保证只有正面才上色，背面仍然是纯黄。权重按<strong>静止姿势</strong>算一次、烘成顶点属性，
          细分会把它插值开，所以边界照样连续。
        </Body>
      </Build>
      <Build at={frameOf("patch", 6)} style={{ marginTop: 24 }}>
        <Card label="为什么不直接在着色器里算" accent={C.coral}>
          <Body size={FT.meta} color={C.inkDim}>
            材质里的 Object 坐标取的是<strong>形变之后</strong>的网格：根骨一转，斑块就滑到背上。
            先在静止姿势算好、烘进顶点属性，它才真正长在皮肤上。
          </Body>
        </Card>
      </Build>
    </div>
  </Scene>
);
