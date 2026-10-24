import React from "react";
import { C, FONT, FT } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Head, Mono, PAD, Scene, frameOf } from "../shared";
import { Plate } from "../plates";

/* 部件场：四肢与五官各自是独立的放样体，两个最容易做错的细节在这里摊开：
 * 眼睛要落在曲面上（先解出那个高度上的曲面方程），嘴巴要沿弧线扫掠。 */

const TILES: { name: string; label: string; at: number }[] = [
  { name: "closeup_eyes", label: "眼：巩膜 + 瞳孔，按法线分层", at: 2 },
  { name: "closeup_face", label: "嘴：微笑弧线扫出的细管", at: 3 },
  { name: "closeup_hand", label: "手：小圆手，灰色", at: 4 },
  { name: "closeup_foot", label: "脚：前后放样的脚掌，不是压扁的球", at: 5 },
];

export const SParts: React.FC = () => (
  <Scene id="parts">
    <Head kicker="03 / 四肢与五官" title="腿、脚、手、眼睛、嘴" goal="每个部件都是一个可参数化的放样体" />

    <div style={{ position: "absolute", left: PAD, top: 330, width: 820 }}>
      <Build at={frameOf("parts", 1)}>
        <Card label="贴到曲面上" accent={C.cyan}>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.code, color: C.ink, lineHeight: 1.8 }}>
            y = cy − b·(1 − |x/a|^2.35)^(1/2.35)
          </div>
          <Body size={FT.body} color={C.inkDim} style={{ marginTop: 14 }}>
            先算这个高度上的曲面，再把眼珠放到表面的法线方向上；<br />
            瞳孔比巩膜再往前一点，不然会被吃掉。
          </Body>
        </Card>
      </Build>
      <Build at={frameOf("parts", 6)} style={{ marginTop: 26 }}>
        <Card label="扫掠，不是圆环" accent={C.coral}>
          <Body size={FT.body} color={C.inkDim}>
            圆形圆环当嘴，环的后半段会从脸后面露出来。<br />
            改成沿微笑弧线取切线、法线、副法线，扫一根八边细管。
          </Body>
        </Card>
      </Build>
    </div>

    <div style={{ position: "absolute", left: 940, top: 300, width: 880, display: "flex", flexWrap: "wrap", gap: 24 }}>
      {TILES.map((t) => (
        <Build key={t.name} at={frameOf("parts", t.at)} style={{ width: 420 }}>
          <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ background: C.bgSoft }}>
              <Plate name={t.name} w={418} />
            </div>
            <div style={{ padding: "12px 14px" }}>
              <Mono size={FT.meta} color={C.inkDim}>{t.label}</Mono>
            </div>
          </div>
        </Build>
      ))}
    </div>
  </Scene>
);
