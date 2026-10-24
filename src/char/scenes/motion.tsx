import React from "react";
import { useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Head, Mono, PAD, Scene, frameOf } from "../shared";
import { PLATES, Plate } from "../plates";

/* 运动场：四段真实渲染的序列帧，各自按自己的帧数循环。
 * 姿势是 f(帧号) 算出来的，所以同一帧永远是同一张图 —— 可以拿 sha256 对比。 */

const CLIPS: { name: string; key: string; label: string; desc: string; at: number }[] = [
  { name: "clip_idle", key: "idle", label: "待机", desc: "胸腔起伏 1.6°", at: 1 },
  { name: "clip_wave", key: "wave", label: "挥手", desc: "上臂 95° + 前臂 22°", at: 2 },
  { name: "clip_turn", key: "turn", label: "转身", desc: "根骨 360°", at: 3 },
  { name: "clip_walk", key: "walk", label: "走路", desc: "腿反相 24°", at: 4 },
];

const COUNTS: Record<string, number> = { idle: 24, wave: 24, turn: 24, walk: 30 };

const Tile: React.FC<{ clip: typeof CLIPS[number] }> = ({ clip }) => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const n = COUNTS[clip.key];
  const idx = Math.floor((f * 24) / fps) % n;
  return (
    <div style={{ width: 424 }}>
      <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 12, overflow: "hidden" }}>
        <div style={{ background: C.bgSoft }}>
          <Plate name={clip.name + "_" + String(idx).padStart(3, "0")} w={422} />
        </div>
        <div style={{ padding: "10px 14px", display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
          <Mono size={FT.body} color={C.ink}>{clip.label}</Mono>
          <Mono size={FT.micro} color={C.inkFaint}>{idx + 1} / {n}</Mono>
        </div>
      </div>
      <Mono size={FT.micro} color={C.inkDim} style={{ display: "block", marginTop: 8 }}>{clip.desc}</Mono>
    </div>
  );
};

export const SMotion: React.FC = () => (
  <Scene id="motion">
    <Head kicker="07 / 帧号驱动" title="同一帧，永远是同一张图" goal="姿势 = f(帧号)：没有随机、没有时钟、没有 requestAnimationFrame" />

    <div style={{ position: "absolute", left: PAD, top: 300, display: "flex", gap: 26 }}>
      {CLIPS.map((c) => (
        <Build key={c.name} at={frameOf("motion", c.at)}>
          <Tile clip={c} />
        </Build>
      ))}
    </div>

    <div style={{ position: "absolute", left: PAD, top: 800, width: 1100 }}>
      <Build at={frameOf("motion", 5)}>
        <Card label="为什么这样算" accent={C.violet}>
          <Body size={FT.body} color={C.inkDim} style={{ lineHeight: 1.75 }}>
            正弦驱动关节角度，第几帧决定相位；渲染器只负责把这一帧画出来。<br />
            好处是回放、比对、重跑都不会漂 —— 每一张贴片的 sha256 都记在账本里。
          </Body>
        </Card>
      </Build>
    </div>

    <div style={{ position: "absolute", left: 1230, top: 812 }}>
      <Mono size={FT.meta} color={C.inkFaint}>共 {PLATES.count} 张贴片 · Cycles {"48"} spp · 每张约 9 秒</Mono>
    </div>
  </Scene>
);
