import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame } from "remotion";
import type * as THREE from "three";
import { C, FONT, G, SC, SC_T, T } from "../design/tokens";
import { Canvas3D } from "../design/three/Canvas3D";
import { Orbit } from "../design/three/CameraRig";
import { Ground, StudioLights } from "../design/three/lighting";
import { Model, useGltf } from "../design/three/Model";
import { PAL } from "../design/three/materials";

/**
 * PropStage —— SDF/CSG 资产的验收片：三个道具同台，镜头绕半圈。
 *
 * 为什么这类资产要单独出片：它们不是扫描来的，是 scripts/assets/sdf_props.mjs
 * 用有向距离场算出来、再用 surface nets 抽成网格的。判据有两条，缺一不可：
 *   ① 文件层：node scripts/qa/model_lint.mjs --watertight（水密 + 有 NORMAL + 面数）
 *   ② 像素层：这一帧里表面必须是连续的曲面，而不是台阶/空洞
 * 第 ② 条只能看，所以它进 still_lint 的静帧集。
 *
 * 资产是 .glb，跑 npm run props 可复现（同一份代码 + 同一个 res → 同一个 sha256）。
 */

export const PROP_STAGE_FRAMES = 150;

const PROPS = [
  { file: "models/prop_gear.glb", name: "GEAR", note: "轮体 − 4 孔 − 轴孔", color: PAL.accent },
  { file: "models/prop_chip.glb", name: "CHIP", note: "圆角体 + 12 引脚 − 槽", color: PAL.note },
  { file: "models/prop_nut.glb", name: "NUT", note: "3 板并集 − 螺纹孔", color: PAL.paper },
];

/**
 * 道具只接收「已就绪的场景图」，不自己加载。
 * 这里踩过一次 K20 的变体：把 useGltf 放进画布子树，模型在画布挂载后才到达，
 * @remotion/three 的 frameloop=never 不会再画一次，于是得到一张干净的空场景。
 */
const Prop: React.FC<{ index: number; source: THREE.Group }> = ({ index, source }) => {
  const p = PROPS[index];
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [index * 12, 40 + index * 12], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const x = (index - 1) * 2.9;
  return (
    <group position={[x, 0, 0]}>
      <Model source={source} height={1.55} fit="max" material="satin" color={p.color} spin={0.12} y={lift * 0.02} />
    </group>
  );
};

export const PropStage: React.FC = () => {
  // 三个模型都必须在画布挂载前就绪 —— useGltf 在画布外调用（见 K20）。
  const gear = useGltf(PROPS[0].file);
  const chip = useGltf(PROPS[1].file);
  const nut = useGltf(PROPS[2].file);
  const sources = [gear, chip, nut];
  const ready = sources.every(Boolean);
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink }}>
      {ready ? (
        <Canvas3D camera="wide">
          <StudioLights ambient={0.5} key={2.9} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
          <Ground y={0} size={30} />
          <Orbit radius={8.6} height={3.4} fromDeg={-24} toDeg={22} target={[0, 1.0, 0]} />
          {sources.map((s, i) => (s ? <Prop key={i} index={i} source={s} /> : null))}
        </Canvas3D>
      ) : null}
      <AbsoluteFill style={{ padding: G.pad }}>
        <div style={{ fontFamily: FONT.mono, fontSize: SC.kicker, letterSpacing: SC_T.kicker, color: C.cyan }}>
          SDF / CSG / SURFACE NETS
        </div>
        <div style={{ fontFamily: FONT.serif, fontSize: T.h1, lineHeight: 1.15 }}>形状是算出来的，不是雕出来的</div>
        <div style={{ marginTop: 10, fontSize: T.caption, color: C.inkDim, maxWidth: 780 }}>
          距离场描述形体，布尔运算组合零件，网格由等值面抽出：法线是解析梯度，所以没有台阶。
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: G.pad }}>
        <div style={{ position: "absolute", right: G.pad, bottom: 150, width: 380 }}>
          {PROPS.map((p) => (
            <div
              key={p.name}
              style={{
                display: "flex",
                justifyContent: "space-between",
                marginBottom: 8,
                fontFamily: FONT.mono,
                fontSize: SC.label,
                letterSpacing: SC_T.label,
              }}
            >
              <span style={{ color: C.cyan }}>{p.name}</span>
              <span style={{ color: C.inkDim }}>{p.note}</span>
            </div>
          ))}
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: G.pad }}>
        <div
          style={{
            position: "absolute",
            left: G.pad,
            right: G.pad,
            bottom: 48,
            display: "flex",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              background: "rgba(11,15,20,0.82)",
              border: "1px solid " + C.panelLine,
              borderRadius: 10,
              padding: "12px 22px",
              fontSize: T.caption,
              color: C.ink,
            }}
          >
            三个道具，三份 CSG 表达式，一份生成器；网格全部水密。
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
