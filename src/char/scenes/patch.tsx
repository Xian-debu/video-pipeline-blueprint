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
    <Head kicker="04 / 奶油色肚皮" title="用材质，不用几何" goal="物体坐标里算椭圆距离，再乘一个朝向门" />

    <div style={{ position: "absolute", left: PAD, top: 300 }}>
      <Plate name="patch_mask" w={760} />
      <Mono size={FT.meta} color={C.inkFaint}>patch_mask · 同一份几何，只换了材质（scripts/char/gen.py --jobs patch）</Mono>
    </div>

    <div style={{ position: "absolute", left: 960, top: 310, width: 880 }}>
      <Build at={frameOf("patch", 1)}>
        <Card label="节点链（Blender 材质里就有）" accent={C.amber}>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.code, color: C.ink, lineHeight: 1.95 }}>
            u = (x / {patch.rx.toFixed(3)})²<br />
            v = ((z − {patch.t.toFixed(2)}) / {patch.rz.toFixed(3)})²<br />
            r² = u + v&nbsp;&nbsp;<span style={{ color: C.cyan }}>→ Map Range 1.00 → 0.90</span><br />
            gate = Y&nbsp;<span style={{ color: C.violet }}>→ Map Range 0.005 → −0.02</span><br />
            mix = r² · gate&nbsp;&nbsp;<span style={{ color: C.amber }}>→ Mix Shader</span>
          </div>
        </Card>
      </Build>
      <Build at={frameOf("patch", 3)} style={{ marginTop: 26 }}>
        <Body size={FT.body} color={C.inkDim} style={{ lineHeight: 1.8 }}>
          距离在一以内是奶油色，一以外是黄色；中间 0.90–1.00 做平滑过渡，边界就没有锯齿。<br />
          朝向门保证只有正面才上色，背面仍然是纯黄。
        </Body>
      </Build>
      <Build at={frameOf("patch", 6)} style={{ marginTop: 24 }}>
        <Card label="为什么换掉几何" accent={C.coral}>
          <Body size={FT.body} color={C.inkDim}>
            独立面片在弯的地方靠偏移量硬贴，边缘会翘；绑上骨架以后，面片和身体的权重不同步，直接撕开。
            材质遮罩跟着同一批顶点走，永远不会分家。
          </Body>
        </Card>
      </Build>
    </div>
  </Scene>
);
