import React from "react";
import { AbsoluteFill, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import { ThreeCanvas } from "@remotion/three";
import * as THREE from "three";
import { C } from "../tokens";

/**
 * 显式色彩管线。three 的默认值（NoToneMapping）意味着"渲染器输出什么，屏幕就显示什么"，
 * 高光会直接顶到 255 并失去色相：本片 backlash 场那对浅色齿轮的盘面就是这样烧成一整片白的。
 *
 * ACESFilmic 把高光滚到白色之前先收一档，曝光再补回来——这不是滤镜，是把"场景亮度"
 * 映射到"显示亮度"的那一步，缺了它，材质参数再调也没有上限。
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
}> = ({ children, camera = "wide", background = C.bg, shadows = true, exposure = 1 }) => {
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
        {children}
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
