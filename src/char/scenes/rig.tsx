import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { BONES, Body, Card, Head, Mono, PAD, PLATES, Scene, frameOf, pct } from "../shared";
import { Plate } from "../plates";

/* 骨架场：左边是那 16 根骨头本身（坐标来自 scripts/char/bones.py →
 * data/char/bones.json，建 Armature 用的是同一份），右边是它动起来的样子。 */

const BOX = { w: 420, h: 640, top: 330, cx: 205, scale: 470, zTop: 1.02 };
const px = (x: number) => BOX.cx + x * BOX.scale;
const py = (z: number) => BOX.top + (BOX.zTop - z) * BOX.scale;

const colorOf = (name: string) =>
  name.indexOf("arm") === 0 || name.indexOf("forearm") === 0 || name.indexOf("hand") === 0
    ? C.amber
    : name.indexOf("thigh") === 0 || name.indexOf("shin") === 0 || name.indexOf("foot") === 0
      ? C.violet
      : C.cyan;

export const SRig: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene id="rig">
      <Head kicker="06 / 十六根骨头" title="能动的关键不是动画，是权重" goal="显式顶点组替代自动权重" />

      <div style={{ position: "absolute", left: 60, top: BOX.top - 40, width: BOX.w }}>
        <svg width={BOX.w} height={BOX.h} style={{ display: "block", overflow: "visible" }}>
          <line x1={10} y1={py(0)} x2={BOX.w - 10} y2={py(0)} stroke={C.panelLine} strokeWidth={2} />
          {BONES.map((b, i) => {
            const p = pct(f, frameOf("rig", 1) + i * 3, frameOf("rig", 1) + i * 3 + 12);
            if (p <= 0) return null;
            return (
              <g key={b.name} opacity={p}>
                <line x1={px(b.head[0])} y1={py(b.head[2])} x2={px(b.tail[0])} y2={py(b.tail[2])}
                  stroke={colorOf(b.name)} strokeWidth={3} strokeLinecap="round" />
                <circle cx={px(b.head[0])} cy={py(b.head[2])} r={5} fill={C.bg} stroke={colorOf(b.name)} strokeWidth={2} />
              </g>
            );
          })}
        </svg>
        <Mono size={FT.micro} color={C.inkFaint} style={{ letterSpacing: FT_T.micro, display: "block", marginTop: 6 }}>
          {BONES.length} 根骨 · 坐标单位 = 图高 1.0 · scripts/char/bones.py
        </Mono>
      </div>

      <div style={{ position: "absolute", left: 520, top: 330, width: 600 }}>
        <Build at={frameOf("rig", 1)}>
          <Card label="权重" accent={C.cyan}>
            <Body size={FT.body} color={C.inkDim} style={{ lineHeight: 1.8 }}>
              身体按高度分带：头 / 胸 / 脊椎各有区间，肩到腕是渐变；<br />
              手、脚、眼、瞳孔、嘴给满。<br />
              自动权重会串扰 —— 抬手时肚子边缘跟着动，<br />
              所以这里一行一行写顶点组，谁属于谁是显式的。
            </Body>
          </Card>
        </Build>
        <Build at={frameOf("rig", 5)} style={{ marginTop: 26 }}>
          <div style={{ display: "flex", gap: 36 }}>
            {[
              { k: "顶点", v: String(PLATES.parts.verts) },
              { k: "有权重", v: String(PLATES.parts.weighted_verts) },
              { k: "骨头", v: String(PLATES.bones) },
            ].map((c) => (
              <div key={c.k}>
                <Mono size={FT.meta} color={C.inkFaint}>{c.k}</Mono>
                <div style={{ fontFamily: FONT.mono, fontSize: FT.num, color: C.ink, marginTop: 4 }}>{c.v}</div>
              </div>
            ))}
          </div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1180, top: 330, display: "flex", gap: 22 }}>
        {[
          { name: "pose_arm_front", label: "举手 + 转头" },
          { name: "pose_walk_front", label: "迈步 + 屈膝" },
        ].map((p) => (
          <Build key={p.name} at={frameOf("rig", 6)} style={{ width: 250 }}>
            <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 12, overflow: "hidden" }}>
              <Plate name={p.name} w={248} />
            </div>
            <Mono size={FT.micro} color={C.inkDim} style={{ marginTop: 8, display: "block" }}>{p.label}</Mono>
          </Build>
        ))}
      </div>
    </Scene>
  );
};
