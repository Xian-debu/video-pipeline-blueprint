import React, { useMemo } from "react";
import { AbsoluteFill, useCurrentFrame, useVideoConfig } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { useGltf } from "../../design/three/Model";
import { Swift, type SwiftMode } from "../Swift";
import type { ClipName } from "../clips";

/**
 * 成片舞台（第八部片）。
 *
 * 与 Probe（检查台）分开的理由：检查台要"量",舞台要"看"。这里的光、背景、
 * 地面都是为画面调的，判据一律在检查台里量，两边互不影响。
 *
 * 取景的三条纪律：
 *   1. 相机每帧由**帧号**算出来（screen 上没有 CSS 动画，AGENTS.md 禁止）；
 *   2. 背景是二维渐变，画布是透明的（alpha:true），三维只负责角色与地面 ——
 *      这样背景永远是干净的渐层，不会有"地平线切一刀"；
 *   3. 角色站在 y=0，脚底贴一池柔光，投影落在同一层上。
 */

/* ------------------------------ 相机 ------------------------------ */

export type CamPair = [number, number];
export type CamMove = {
  /** 方位角（度）。0=正对脸（模型朝 -Y，见 Probe 的推导） */
  az?: CamPair;
  /** 仰角（度） */
  el?: CamPair;
  /** 距离（米） */
  dist?: CamPair;
  /** 竖直视场（度） */
  fov?: CamPair;
  /** 目标点高度 */
  ty?: CamPair;
  /** 目标点左右 */
  tx?: CamPair;
};

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
/** 平滑（smootherstep），用于所有相机通道：起止都不顿。 */
export const smooth = (t: number) => {
  const x = Math.max(0, Math.min(1, t));
  return x * x * x * (x * (x * 6 - 15) + 10);
};

/** 某帧的相机参数：t∈[0,1] 由本场进度给出。 */
export const camAt = (m: CamMove, t: number) => {
  const e = smooth(t);
  const g = (p?: CamPair, d = 0) => (p ? lerp(p[0], p[1], e) : d);
  return {
    az: g(m.az, 18),
    el: g(m.el, 6),
    dist: g(m.dist, 3.5),
    fov: g(m.fov, 30),
    tx: g(m.tx, 0),
    ty: g(m.ty, 0.85),
  };
};

const posOf = (az: number, el: number, dist: number, tx: number, ty: number) => {
  const a = (az * Math.PI) / 180;
  const b = (el * Math.PI) / 180;
  return new THREE.Vector3(
    tx + Math.sin(a) * dist * Math.cos(b),
    ty + Math.sin(b) * dist,
    Math.cos(a) * dist * Math.cos(b)
  );
};

const Aim: React.FC<{ c: ReturnType<typeof camAt> }> = ({ c }) => {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera;
  const p = posOf(c.az, c.el, c.dist, c.tx, c.ty);
  React.useLayoutEffect(() => {
    camera.fov = c.fov;
    camera.position.copy(p);
    camera.lookAt(c.tx, c.ty, 0);
    camera.updateProjectionMatrix();
  }, [camera, c.fov, p.x, p.y, p.z, c.tx, c.ty]);
  return null;
};

/* ------------------------------ 光 ------------------------------ */

const Env: React.FC<{ intensity: number }> = ({ intensity }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  React.useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      rt.dispose();
      room.dispose?.();
      pmrem.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
};

/** 成片光：一颗暖主光 + 冷补光 + 青色轮廓 + 紫反光。env 只给一点点，
 *  给多了白色环境高光会把黄色冲成浅黄（look-dev 的结论）。 */
export const FilmRig: React.FC<{ keyI?: number; rimI?: number; env?: number; shadow?: number }> = ({
  keyI = 2.05,
  rimI = 5.5,
  env = 0.22,
  shadow = 2048,
}) => (
  <>
    <Env intensity={env} />
    <ambientLight intensity={0.32} color="#9fc4d0" />
    <hemisphereLight args={["#dff1ff", "#0b1416", 0.28]} />
    <directionalLight
      position={[2.4, 3.8, 2.4]}
      intensity={keyI}
      color="#fff1d6"
      castShadow
      shadow-mapSize={[shadow, shadow]}
      shadow-bias={-0.0005}
      shadow-normalBias={0.02}
      shadow-camera-left={-2}
      shadow-camera-right={2}
      shadow-camera-top={2}
      shadow-camera-bottom={-2}
      shadow-camera-near={0.2}
      shadow-camera-far={20}
    />
    <directionalLight position={[-2.6, 1.4, 2.2]} intensity={0.42} color="#8fd4ff" />
    <spotLight position={[-2.4, 2.2, -3.2]} angle={0.95} penumbra={1} intensity={rimI} color="#3fe3d2" />
    <directionalLight position={[0.4, 0.9, -3.6]} intensity={0.5} color="#8f7bff" />
  </>
);

/* ------------------------------ 地面 ------------------------------ */

/** 一池柔光的地面：用程序化径向渐变贴图（无外部文件，确定性）。 */
export const GroundPool: React.FC<{ color?: string; size?: number; y?: number }> = ({
  color = "#2ad6c4",
  size = 9,
  y = 0,
}) => {
  const tex = useMemo(() => {
    const c = document.createElement("canvas");
    c.width = c.height = 256;
    const g = c.getContext("2d")!;
    const grad = g.createRadialGradient(128, 128, 4, 128, 128, 126);
    grad.addColorStop(0, "rgba(255,255,255,0.55)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.16)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    g.fillStyle = grad;
    g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  }, []);
  return (
    <>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
        <circleGeometry args={[size * 0.42, 64]} />
        <meshStandardMaterial color="#0a181c" roughness={0.95} metalness={0} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y + 0.004, 0]}>
        <planeGeometry args={[size, size]} />
        <meshBasicMaterial map={tex} color={color} transparent depthWrite={false} opacity={0.5} blending={THREE.AdditiveBlending} />
      </mesh>
    </>
  );
};

/* ------------------------------ 三维层 ------------------------------ */

export type Actor = {
  clip: ClipName;
  mode?: SwiftMode;
  tint?: string | number[];
  scale?: number;
  position?: [number, number, number];
  offset?: [number, number, number];
  grow?: number;
  spin?: number;
  /** 片段内的帧（不给就按全局帧取模） */
  frame?: number;
};

export type ShotProps = {
  cam: CamMove;
  /** 本场总帧数（相机进度 = 当前帧 / 帧数）；不给就取 Sequence 的 durationInFrames */
  span?: number;
  actor?: Actor;
  /** 背景两层色（上/下） */
  top?: string;
  bottom?: string;
  /** 主色（地面光池、暗角） */
  accent?: string;
  lights?: React.ReactNode;
  ground?: boolean;
  shadow?: boolean;
  children?: React.ReactNode;
};

const Tone: React.FC<{ exposure: number }> = ({ exposure }) => {
  const gl = useThree((s) => s.gl);
  React.useLayoutEffect(() => {
    gl.toneMapping = THREE.ACESFilmicToneMapping;
    gl.toneMappingExposure = exposure;
  }, [gl, exposure]);
  return null;
};

/** 三维层：不含任何二维排版（排版在 scenes 里叠在它上面）。 */
export const Shot: React.FC<ShotProps> = ({
  cam,
  span = 0,
  actor,
  top = "#123039",
  bottom = "#050d11",
  accent = "#2ad6c4",
  lights,
  ground = true,
  shadow = true,
  children,
}) => {
  const frame = useCurrentFrame();
  const { width, height, durationInFrames } = useVideoConfig();
  const glb = useGltf("models/swift_v23.glb");
  // 相机进度用**本场的实际帧数**（Sequence 给的 durationInFrames），不信外部传的 span：
  // 这样改讲稿时长时镜头自动拉长/压短，不会有"相机走完了画面还在"的错位。
  const total = (span ?? 0) > 1 ? span! : Math.max(2, durationInFrames);
  const c = camAt(cam, frame / (total - 1));
  const a = actor;

  const bg = `radial-gradient(120% 90% at 50% 34%, ${top} 0%, ${bottom} 78%)`;

  return (
    <AbsoluteFill style={{ background: bg }}>
      {glb ? (
        <ThreeCanvas
          width={width}
          height={height}
          shadows={shadow}
          dpr={1}
          gl={{ antialias: true, alpha: true, preserveDrawingBuffer: true }}
          camera={{ fov: c.fov, position: [0, 1, 3.5], near: 0.05, far: 200 }}
        >
          <Tone exposure={0.92} />
          <Aim c={c} />
          {lights ?? <FilmRig />}
          {ground ? <GroundPool color={accent} /> : null}
          {a ? (
            <Swift
              source={glb}
              clip={a.clip}
              frame={a.frame}
              mode={a.mode ?? "shaded"}
              tint={a.tint ?? "yellow"}
              scale={a.scale ?? 1.72}
              position={a.position ?? [0, 0, 0]}
              offset={a.offset ?? [0, 0, 0]}
              grow={a.grow}
              spin={a.spin ?? 0}
            />
          ) : null}
          {children}
        </ThreeCanvas>
      ) : null}
      {/* 暗角：把注意力收到中间 */}
      <AbsoluteFill
        style={{
          background: "radial-gradient(80% 70% at 50% 45%, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)",
          pointerEvents: "none",
        }}
      />
    </AbsoluteFill>
  );
};
