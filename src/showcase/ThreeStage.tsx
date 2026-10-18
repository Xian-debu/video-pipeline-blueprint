import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame } from "remotion";
import { C, FONT, G, SB, SB_T, T } from "../design/tokens";
import { Canvas3D } from "../design/three/Canvas3D";
import { Dolly, Orbit } from "../design/three/CameraRig";
import { Ground, StudioLights } from "../design/three/lighting";
import { Model, useGltf } from "../design/three/Model";
import { PAL } from "../design/three/materials";

/**
 * ThreeStage —— 3D 场景层的验收片（30 s，三个镜头）：
 *   A 0-300   程序化几何：一个 7x7 的立方阵列按帧起伏，镜头推轨     （零资产）
 *   B 300-600 导入资产：public/models/nailong_v3_15k.glb，归一化 + 令牌材质 + 转台
 *   C 600-900 3D + 2D 合成：3D 画布透明，2D 文字/底板在它下面
 *
 * 判据见 scripts/qa/three_frame_lint.mjs（像素层）与 scripts/qa/still_lint.mjs（2D 层），
 * 以及 docs/3d.md 的验收表。文本是样板文字，不是讲话稿。
 */

const LATTICE = 7;
const CELL = 1.05;

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: FONT.mono, fontSize: 22, letterSpacing: 3, color: C.cyan }}>{children}</div>
);

const Title: React.FC<{ children: React.ReactNode; size?: number }> = ({ children, size = T.h1 }) => (
  <div style={{ fontFamily: FONT.serif, fontSize: size, lineHeight: 1.15 }}>{children}</div>
);

const Caption: React.FC<{ children: React.ReactNode }> = ({ children }) => (
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
        fontSize: SB.caption,
        color: C.ink,
        fontFamily: FONT.sans,
      }}
    >
      {children}
    </div>
  </div>
);

const Progress: React.FC<{ frame: number; total: number }> = ({ frame, total }) => (
  <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 3, background: C.panelLine }}>
    <div style={{ width: ((frame / total) * 100).toFixed(2) + "%", height: 3, background: C.cyan }} />
  </div>
);

/** A：程序化几何。零资产，全部由帧号派生。 */
const LatticeShot: React.FC = () => {
  const frame = useCurrentFrame();
  // 每个格子一个相位，波动沿对角线传播；相位与帧号成线性关系，因此可复现。
  const cubes = [];
  for (let i = 0; i < LATTICE; i++) {
    for (let j = 0; j < LATTICE; j++) {
      const phase = (i + j) * 0.55;
      const wave = Math.sin(frame / 22 - phase);
      const h = 0.35 + 1.55 * (wave * 0.5 + 0.5);
      const x = (i - (LATTICE - 1) / 2) * CELL;
      const z = (j - (LATTICE - 1) / 2) * CELL;
      const warm = (i + j) / (2 * (LATTICE - 1));
      const color = warm > 0.72 ? PAL.warn : warm > 0.4 ? PAL.accent : PAL.note;
      cubes.push(
        <mesh key={i + ":" + j} position={[x, h / 2, z]} castShadow receiveShadow>
          <boxGeometry args={[0.78, h, 0.78]} />
          <meshStandardMaterial color={color} roughness={0.72} metalness={0.12} />
        </mesh>
      );
    }
  }
  return (
    <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink }}>
      <Canvas3D camera="wide">
        <StudioLights />
        <Ground y={-0.02} />
        <Dolly from={[11.0, 7.8, 11.8]} to={[9.6, 6.6, 10.4]} target={[0, 0.4, 0]} end={300} />
        {cubes}
      </Canvas3D>
      <AbsoluteFill style={{ padding: G.pad }}>
        <Kicker>SCENE LAYER / PROCEDURAL</Kicker>
        <Title>几何本身就是分镜</Title>
        <div style={{ marginTop: 10, fontSize: T.caption, color: C.inkDim, maxWidth: 820 }}>
          位置、高度、颜色都从帧号算出来：没有资产文件，也没有随机数。
        </div>
      </AbsoluteFill>
      <Caption>四十九个立方体，一个公式：高度是帧号的正弦。</Caption>
    </AbsoluteFill>
  );
};

/** B：导入资产。归一化到声明高度，材质/灯光来自令牌。 */
const SpecimenShot: React.FC = () => {
  // 画布只在模型就绪后才挂载；加载期间 useGltf 用 delayRender 拦住取帧。
  const gltf = useGltf("models/nailong_v3_15k.glb");
  if (!gltf) return <AbsoluteFill style={{ background: C.bg }} />;
  return (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink }}>
    <Canvas3D camera="product">
      <StudioLights ambient={0.5} key={2.9} />
      <Ground y={0} />
      <Orbit radius={7.2} height={2.7} fromDeg={28} toDeg={-22} target={[0, 1.0, 0]} />
      <Model source={gltf} height={2.0} material="matte" color={PAL.paper} spin={0.22} wireframe />
    </Canvas3D>
    <AbsoluteFill style={{ padding: G.pad }}>
      <Kicker>IMPORTED ASSET / glTF</Kicker>
      <Title>外部模型也是场景</Title>
      <div style={{ marginTop: 10, fontSize: T.caption, color: C.inkDim, maxWidth: 760 }}>
        归一化到 2.0 单位、底面落地；材质与三点光来自设计令牌，不是渲染参数。
      </div>
      <div
        style={{
          position: "absolute",
          right: G.pad,
          bottom: 150,
          width: 330,
          background: C.panel,
          border: "1px solid " + C.panelLine,
          borderRadius: 14,
          padding: "18px 20px",
        }}
      >
        {[
          ["文件", "nailong_v3_15k.glb"],
          ["体积", "262,396 B"],
          ["顶点", "7,270"],
          ["法线", "缺失 → 重算"],
        ].map(([k, v]) => (
          <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontFamily: FONT.mono, fontSize: 17, color: C.inkFaint, letterSpacing: 1 }}>{k}</span>
            <span style={{ fontSize: 20, color: C.ink }}>{v}</span>
          </div>
        ))}
      </div>
    </AbsoluteFill>
    <Caption>同一个 .glb：归一化、补法线、换材质，就能进任何机位。</Caption>
  </AbsoluteFill>
  );
};

/** C：3D 与 2D 同帧。画布透明，文字与底板在它下面。 */
const CompositeShot: React.FC = () => {
  const frame = useCurrentFrame();
  const lift = interpolate(frame, [0, 300], [0, 1], { extrapolateRight: "clamp" });
  const gltf = useGltf("models/nailong_v3_15k.glb");
  if (!gltf) return <AbsoluteFill style={{ background: C.bg }} />;
  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(155deg," + C.bg + " 0%," + C.bgSoft + " 62%," + C.panel + " 100%)",
        fontFamily: FONT.sans,
        color: C.ink,
      }}
    >
      <AbsoluteFill style={{ padding: G.pad }}>
        <div style={{ display: "flex", gap: 44, alignItems: "flex-start" }}>
          <div style={{ flex: 1 }}>
            <Kicker>COMPOSITE / 2D + 3D</Kicker>
            <Title size={SB.title}>一层是代码，一层是几何</Title>
            <div style={{ marginTop: 12, fontSize: SB.subtitle, color: C.inkDim, maxWidth: 700 }}>
              3D 画布背景透明，底下的渐变、文字、进度条照常参与排版。
            </div>
            <div style={{ marginTop: 26, display: "flex", gap: 12 }}>
              {["frame → content", "无 CSS 动画", "渲染期不联网"].map((t) => (
                <span
                  key={t}
                  style={{
                    fontFamily: FONT.mono,
                    fontSize: 16,
                    letterSpacing: 2,
                    color: C.cyan,
                    border: "1px solid " + C.cyanDeep,
                    borderRadius: 999,
                    padding: "6px 14px",
                  }}
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>
      </AbsoluteFill>
      {/* 3D 只占画面右半：透明画布叠在 2D 之上，但不该压住左边的标题与胶囊。 */}
      <AbsoluteFill style={{ left: "40%", opacity: 0.35 + 0.65 * lift }}>
        <Canvas3D camera="product" background={null}>
          <StudioLights />
          <Orbit radius={7.6} height={2.3} fromDeg={-26} toDeg={26} target={[0, 0.9, 0]} />
          <Model source={gltf} height={1.7} material="metal" color={PAL.accent} spin={-0.18} />
        </Canvas3D>
      </AbsoluteFill>
      <AbsoluteFill style={{ padding: G.pad, pointerEvents: "none" }}>
        <div style={{ position: "absolute", right: G.pad, top: G.pad, fontFamily: FONT.mono, fontSize: 18, letterSpacing: SB_T.overline, color: C.inkFaint }}>
          03 / 03 · COMPOSITE
        </div>
      </AbsoluteFill>
      <Progress frame={frame} total={300} />
      <Caption>透明画布是关键：3D 不是一整块视频，是一个图层。</Caption>
    </AbsoluteFill>
  );
};

export const THREE_STAGE_FRAMES = 900;

export const ThreeStage: React.FC = () => (
  <AbsoluteFill style={{ background: C.bg }}>
    <Sequence from={0} durationInFrames={300} name="A procedural">
      <LatticeShot />
    </Sequence>
    <Sequence from={300} durationInFrames={300} name="B imported">
      <SpecimenShot />
    </Sequence>
    <Sequence from={600} durationInFrames={300} name="C composite">
      <CompositeShot />
    </Sequence>
  </AbsoluteFill>
);