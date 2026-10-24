import React from "react";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Chip, Mono, Scene, PAD, frameOf } from "../shared";
import { Plate } from "../plates";

/* 开场：左边说这一部讲什么，右边把这个角色的定妆照放在那里。
 * 三枚胶囊是整部片的骨架：先量图，再放样，最后拿判据说话。 */
export const SOpen: React.FC = () => (
  <Scene id="open">
    <div style={{ position: "absolute", left: PAD, top: 208, width: 900 }}>
      <Build at={frameOf("open", 0)}>
        <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>CHAR · 第七部 / 程序化角色</Mono>
      </Build>
      <Build at={frameOf("open", 0) + 8}>
        <div style={{
          fontFamily: FONT.serif, fontSize: FT.cover, color: C.ink, lineHeight: 1.08,
          marginTop: 18, letterSpacing: FT_T.cover,
        }}>
          从一张三视图
        </div>
      </Build>
      <Build at={frameOf("open", 0) + 18}>
        <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.inkDim, marginTop: 10 }}>
          到会走路的胖梨
        </div>
      </Build>
      <Build at={frameOf("open", 2)} style={{ marginTop: 30 }}>
        <Body size={FT.lead} color={C.inkDim}>
          三道工序：把图量成曲线，把曲线放样成身体，<br />
          再用交并比、宽高比、剖面误差说话。
        </Body>
      </Build>
      <div style={{ display: "flex", gap: 14, marginTop: 36 }}>
        <Build at={frameOf("open", 3)}><Chip color={C.cyan}>测量 → 两条剖面曲线</Chip></Build>
        <Build at={frameOf("open", 4)}><Chip color={C.violet}>放样 → 一圈一圈的身体</Chip></Build>
        <Build at={frameOf("open", 5)}><Chip color={C.amber}>判据 → 不合格就改参数</Chip></Build>
      </div>
      <Build at={frameOf("open", 6)} style={{ marginTop: 34 }}>
        <div style={{ width: 120, height: 3, background: C.cyan }} />
        <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 16 }}>
          全程脚本 · Blender 命令行 · 没有一次手工雕刻
        </Body>
      </Build>
    </div>

    <div style={{ position: "absolute", right: 96, top: 96 }}>
      <Build at={frameOf("open", 1)} dur={18}>
        <Plate name="hero_alpha" w={780} />
      </Build>
    </div>
  </Scene>
);
