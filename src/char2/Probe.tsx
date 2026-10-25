import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { useGltf } from "../design/three/Model";
import { Swift } from "./Swift";
import { HeroRig, NeutralRig, StageGround } from "./Stage";
import type { ClipName } from "./clips";

/**
 * 角色检查台（不参与成片）。四个机位对齐参考图的"三视图 + 一张三分之四"：
 *   front / side / back —— fov 5°、距 13 的近正交视线，用来和参考图逐像素比剪影
 *   tq（three-quarter） —— 透视、深底、投影，用来人眼判断"像不像、好不好看"
 *
 * 为什么不用真 orthographic 相机：在 1.05 单位高的物体上，fov 5°/距 13 的透视误差
 * 只有 0.4%，而正交相机会把光照与阴影也"平掉"，反而与成片观感不一致。
 */

const CameraAim: React.FC<{ pos: [number, number, number]; target: [number, number, number] }> = ({ pos, target }) => {
  const camera = useThree((s) => s.camera);
  React.useLayoutEffect(() => {
    camera.position.set(pos[0], pos[1], pos[2]);
    camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
    camera.updateProjectionMatrix();
  }, [camera, pos, target]);
  return null;
};

const ToneMapping: React.FC<{ exposure: number; mode: "aces" | "none" }> = ({ exposure, mode }) => {
  const gl = useThree((s) => s.gl);
  React.useLayoutEffect(() => {
    // ACES 是"看"的曲线（压高光、去饱和），量判据时它会把颜色推离反照率；
    // 所以英雄光走 ACES，中性量测光走线性直出。
    gl.toneMapping = mode === "aces" ? THREE.ACESFilmicToneMapping : THREE.NoToneMapping;
    gl.toneMappingExposure = mode === "aces" ? exposure : 1;
  }, [gl, exposure, mode]);
  return null;
};

const VIEWS = {
  front: { az: 0, fov: 5, dist: 13, y: 0.55, elev: 0 },
  side: { az: -90, fov: 5, dist: 13, y: 0.55, elev: 0 },
  back: { az: 180, fov: 5, dist: 13, y: 0.55, elev: 0 },
  left: { az: 90, fov: 5, dist: 13, y: 0.55, elev: 0 },
  tq: { az: 38, fov: 26, dist: 4.3, y: 0.56, elev: 9 },
} as const;

const HEAD = { fov: 14, dist: 3.2, y: 0.78, elev: 0 };

export type ProbeProps = {
  view: keyof typeof VIEWS;
  clip: ClipName;
  frame: number;
  tint: string;
  scale: number;
  focus: "body" | "head";
  rig: "neutral" | "hero";
  exposure: number;
  /** total irradiance multiplier for the neutral (measurement) rig, see Stage.tsx */
  light: number;
  /** environment intensity for the neutral rig (white sheen washes the albedo out) */
  env: number;
  /** hero (picture) lighting variants, see STAGE_MOODS */
  mood?: "stage" | "paper" | "studio";
};

/** Three hero looks for the look-dev pass. Same model, same camera; only the light
 *  and the room change -- the point is to choose one on pixels, not on adjectives. */
const STAGE_MOODS = {
  stage: { bg: "#0f1e24", ground: "#0d2a30", key: 2.9, rim: "#37e0d6", rimI: 9, fill: "#ffe9c9", fillI: 0.55, bounce: "#9f7bff", bounceI: 0.7, env: 0.9 },
  paper: { bg: "#f4ecdf", ground: "#efe3cf", key: 2.2, rim: "#ffffff", rimI: 2.2, fill: "#ffe9c9", fillI: 0.9, bounce: "#ffd7a8", bounceI: 0.5, env: 1.15 },
  studio: { bg: "#243038", ground: "#1d272e", key: 3.6, rim: "#ffffff", rimI: 4.5, fill: "#cfe6ff", fillI: 0.65, bounce: "#8ea7b8", bounceI: 0.5, env: 1.0 },
} as const;

export const Probe: React.FC<ProbeProps> = ({ view, clip, frame, tint, scale, focus, rig, exposure, light, env, mood = "stage" }) => {
  const M = STAGE_MOODS[mood];
  const { width, height } = useVideoConfig();
  const glb = useGltf("models/swift_v25.glb");
  const v = VIEWS[view];
  const f = focus === "head" ? { ...v, ...HEAD } : v;
  const rad = (f.az * Math.PI) / 180;
  const radY = (f.elev * Math.PI) / 180;
  const pos: [number, number, number] = [
    Math.sin(rad) * f.dist * Math.cos(radY),
    f.y + Math.sin(radY) * f.dist,
    Math.cos(rad) * f.dist * Math.cos(radY),
  ];
  const target: [number, number, number] = [0, focus === "head" ? 0.78 : 0.52, 0];
  const neutral = rig === "neutral";

  if (!glb) {
    return <AbsoluteFill style={{ background: neutral ? "#ffffff" : M.bg }} />;
  }
  return (
    <AbsoluteFill style={{ background: neutral ? "#ffffff" : M.bg }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows={!neutral}
        dpr={1}
        gl={{ antialias: true, alpha: false, preserveDrawingBuffer: true }}
        camera={{ fov: f.fov, position: pos, near: 0.05, far: 200 }}
      >
        <color attach="background" args={[neutral ? "#ffffff" : M.bg]} />
        <ToneMapping exposure={exposure} mode={neutral ? "none" : "aces"} />
        <CameraAim pos={pos} target={target} />
        {/* 量测光跟着机位转：三视图出自同一套光，否则侧/背视图会变暗，ΔE 变成"光的差"而不是"材质的差" */}
        <group rotation={[0, rad, 0]}>
          {neutral ? <NeutralRig k={light} env={env} /> : (
            <HeroRig key={M.key} keyI={M.key} rim={M.rim} rimI={M.rimI} fill={M.fill} fillI={M.fillI} bounce={M.bounce} bounceI={M.bounceI} env={M.env} />
          )}
        </group>
        {neutral ? null : <StageGround y={0} size={30} color={M.ground} />}
        <Swift source={glb} clip={clip} frame={frame} tint={tint} scale={scale} />
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
