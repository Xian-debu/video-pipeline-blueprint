import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { C } from "../tokens";
import { DepthOfField, type DofSettings } from "./DepthOfField";

/**
 * 显式色彩管线。@react-three/fiber 未显式指定时默认就是 ACESFilmic（见其 Canvas 实现），
 * 所以这一层不是"修好了一个坏默认"，而是把"曲线是哪条、曝光是多少"写进工程：
 * 库的默认值可以变，片子的观感不能随库变。
 *
 * 实测：本片交付版就已经是 ACES；改成显式后参考帧逐像素不变。真正的问题不在曲线，
 * 而在平盘面本身没有明暗（见 docs/33 的测量记录）。
 *
 * 只在 ThreeCanvas 内部生效：所有 3D 镜头共用一条管线，场景代码不碰渲染器。
 */
const ToneMapping: React.FC<{ exposure: number }> = ({ exposure }) => {
  const gl = useThree((s) => s.gl);
  React.useLayoutEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);
  return null;
};

/**
 * 3D 画布：ThreeCanvas 的薄封装。
 * 只做三件事，全部是为了确定性：
 *   - dpr 固定为 1（设备像素比不参与渲染，同帧同像素）；
 *   - antialias 固定开、preserveDrawingBuffer 固定开（Remotion 逐帧取像）；
 *   - 背景可以显式设为 null，此时透明，2D 图层从底下透出来。
 */
export type CameraPreset = "wide" | "product" | "low" | "top";

/** 机位预设只描述相机，不描述场景：同一个场景换机位不需要改一行场景代码。 */
export const CAMERA: Record<CameraPreset, { fov: number; position: [number, number, number]; target: [number, number, number] }> = {
  wide: { fov: 38, position: [6.4, 3.6, 7.6], target: [0, 0.8, 0] },
  product: { fov: 30, position: [3.4, 2.1, 4.3], target: [0, 1.0, 0] },
  low: { fov: 40, position: [2.6, 0.5, 5.2], target: [0, 1.4, 0] },
  top: { fov: 45, position: [0.01, 9.2, 0.02], target: [0, 0, 0] },
};

export const Canvas3D: React.FC<{
  children: React.ReactNode;
  camera?: CameraPreset;
  /** null = 透明（2D 层透过来）；给字符串则作为场景背景。 */
  background?: string | null;
  shadows?: boolean;
  /** ACES 曝光。1.0 是"不改亮度"的起点；场景整体偏暗时由调用方抬，不在场景里堆灯光。 */
  exposure?: number;
  /** 给景深就开景深：一场戏要不要薄景深，是导演决定，不是渲染器决定。 */
  dof?: DofSettings;
}> = ({ children, camera = "wide", background = C.bg, shadows = true, exposure = 1, dof }) => {
  const { width, height } = useVideoConfig();
  const c = CAMERA[camera];
  return (
    <AbsoluteFill style={{ background: background ?? "transparent" }}>
      <ThreeCanvas
        width={width}
        height={height}
        shadows={shadows}
        dpr={1}
        gl={{ antialias: true, alpha: background === null, preserveDrawingBuffer: true }}
        camera={{ fov: c.fov, position: c.position, near: 0.1, far: 400 }}
      >
        {background ? <color attach="background" args={[background]} /> : null}
        <ToneMapping exposure={exposure} />
        {dof ? <DepthOfField settings={dof} exposure={exposure} /> : null}
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};