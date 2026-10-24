import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Head, Mono, PAD, PLATES, Scene, V_, f3, frameOf } from "../shared";
import { PlateSeq } from "../plates";

/* 收尾场：转台 36 帧循环一圈，右边是账本上的三个数。 */

const STATS = [
  { k: "顶点", v: String(PLATES.parts.verts), s: "带权重 · 显式顶点组" },
  { k: "骨头", v: String(PLATES.bones), s: "每根都有名字和父级" },
  { k: "参数版本", v: String(PLATES.params.version ?? 16), s: "一版一次提交，可回退" },
];

export const SClose: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene id="close">
      <Head kicker="11 / 转一圈" title="从图里长出来的角色" goal="数字都在账本里" />

      <Build at={frameOf("close", 0)} style={{ position: "absolute", left: 200, top: 268 }}>
        <PlateSeq prefix="turn" count={36} fps={7.5} w={620} />
      </Build>

      <div style={{ position: "absolute", left: 1280, top: 300, width: 568 }}>
        {STATS.map((s, i) => (
          <Build key={s.k} at={frameOf("close", i + 1)} style={{ marginBottom: 30 }}>
            <Mono size={FT.meta} color={C.inkFaint}>{s.k}</Mono>
            <div style={{ fontFamily: FONT.mono, fontSize: FT.num, color: C.ink, lineHeight: 1.1, marginTop: 4 }}>{s.v}</div>
            <Body size={FT.micro} color={C.inkFaint} style={{ marginTop: 6 }}>{s.s}</Body>
          </Build>
        ))}
        <Build at={frameOf("close", 4)}>
          <div style={{ borderTop: "1px solid " + C.panelLine, paddingTop: 18, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkDim }}>
            贴片 {PLATES.count} 张 · 渲染 {Math.round(PLATES.seconds / 60)} 分钟 · 正面交并比 {f3(V_("front").iou)}
          </div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: PAD, bottom: 150 }}>
        <Mono size={FT.tiny} color={C.inkFaint}>下一部片见。</Mono>
      </div>
    </Scene>
  );
};
