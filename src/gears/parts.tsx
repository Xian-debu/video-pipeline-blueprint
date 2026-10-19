import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { C, FONT, FT, FT_T, G } from "../design/tokens";
import { ChapterBar, SceneShell } from "../design/Scene";
import type { DofSettings } from "../design/three/DepthOfField";
import { Canvas3D } from "../design/three/Canvas3D";
import { Dolly, Orbit } from "../design/three/CameraRig";
import { StudioLights } from "../design/three/lighting";
import { PAL, makeMaterial, type MaterialPreset } from "../design/three/materials";
import { SCENES, LINES, FPS, TOTAL, frameOf, linesOf, sceneOf } from "./script";
import { centreDistance, gearGeometry, meshPhase, planetaryPhase, type GearGeometrySpec } from "./geometry";
import { gearShape2D, inv } from "./profile";
import PARAMS from "../../data/gears/params.json";
import GEOM from "../../data/gears/geometry.json";
import PLANETARY from "../../data/gears/planetary.json";
import BACKLASH from "../../data/gears/backlash.json";
import RATIO from "../../data/gears/ratio.json";
import TORQUE from "../../data/gears/torque.json";

/**
 * 一部片的零件库：3D 零件（齿轮对、行星轮、渐开线描线）、2D 图版、场景外壳（Header/Stage/Bullet/Value）。
 *
 * 这些是 11 个场景共用的部分，与"第几场"无关：改图版不会碰到场次，改场次不会碰到零件。
 */
export const MM = 28; // 28 mm = 1 个场景单位
export const PA = PARAMS.pressureAngleDeg;

type Vec3 = [number, number, number];

export const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
export const pct = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);

/* ------------------------------------------------------------------ 3D 零件 */

export const Gear: React.FC<{
  spec: GearGeometrySpec;
  phase?: number;
  position?: Vec3;
  material?: MaterialPreset;
  color?: string;
  opacity?: number;
}> = ({ spec, phase = 0, position = [0, 0, 0], material = "satin", color = PAL.paper, opacity }) => {
  const key = JSON.stringify(spec);
  const geometry = useMemo(() => gearGeometry(spec), [key]);
  const mat = useMemo(
    () => makeMaterial(material, color, opacity === undefined ? {} : { transparent: true, opacity }),
    [material, color, opacity]
  );
  return <mesh geometry={geometry} material={mat} rotation={[0, 0, phase]} position={position} castShadow receiveShadow />;
};

/** 一对啮合的外齿轮（含相位）。th 是小轮转角，大轮按齿数比反向转。 */
export const Pair: React.FC<{ th: number; material?: MaterialPreset; shade?: boolean; highlight?: number }> = ({
  th,
  material = "satin",
  shade = false,
  highlight = 0,
}) => {
  const a = PARAMS.pairs.a;
  const z1 = a.z1;
  const z2 = a.z2;
  const d = centreDistance(a.module, z1, z2);
  // 小轮多转半个齿距，大轮才咬在齿槽里：相位不是调出来的，是算出来的。
  const p1 = meshPhase(z1) + th;
  const p2 = -th * (z1 / z2);
  const bright = (base: string, k: number) => (shade ? base : base);
  return (
    <group>
      <Gear
        spec={{ z: z1, module: a.module, pressureAngleDeg: PA, faceWidth: a.faceWidth, bore: 6 }}
        phase={p1}
        material={material}
        color={highlight === 1 ? PAL.accent : bright(PAL.paper, 1)}
      />
      <Gear
        spec={{ z: z2, module: a.module, pressureAngleDeg: PA, faceWidth: a.faceWidth, bore: 12, lightening: { radius: 8, at: 28, count: 5 } }}
        phase={p2}
        position={[d, 0, 0]}
        material={material}
        color={highlight === 2 ? PAL.accent : PAL.paper}
      />
    </group>
  );
};

/** 行星轮系：太阳 + 三个行星 + 内齿圈（固定齿圈模式）。 */
export const Planetary: React.FC<{ th: number; material?: MaterialPreset }> = ({ th, material = "satin" }) => {
  const b = PARAMS.pairs.b;
  const zs = b.zSun;
  const zp = b.zPlanet;
  const zr = b.zRing;
  const arm = centreDistance(b.module, zs, zp);
  const { carrier, spin } = planetaryPhase(th, zs, zp, zr);
  const planet = { z: zp, module: b.module, pressureAngleDeg: PA, faceWidth: b.faceWidth, bore: 5 } satisfies GearGeometrySpec;
  return (
    <group>
      <Gear
        spec={{ z: zr, module: b.module, pressureAngleDeg: PA, faceWidth: b.faceWidth, internal: true }}
        phase={0}
        material="satin"
        color={PAL.note}
      />
      <Gear
        spec={{ z: zs, module: b.module, pressureAngleDeg: PA, faceWidth: b.faceWidth, bore: 8 }}
        phase={th}
        material={material}
        color={PAL.paper}
      />
      {[0, 1, 2].map((k) => {
        const psi = carrier + (k * 2 * Math.PI) / 3;
        return (
          <group key={k} position={[Math.cos(psi) * arm, Math.sin(psi) * arm, 0]}>
            <Gear spec={planet} phase={spin} material={material} color={PAL.note} />
          </group>
        );
      })}
    </group>
  );
};

/** 渐开线：基圆、解开的绳子、绳子端点划出的曲线。 */
export const Involute: React.FC<{ f: number; duration: number; shaded?: boolean }> = ({ f, duration, shaded = false }) => {
  const a = PARAMS.pairs.a;
  const rb = (a.module * a.z1) / 2 * Math.cos((PA * Math.PI) / 180);
  const t = pct(f, 6, duration * 0.62) * 2.6;
  const pts = useMemo(() => {
    const out: THREE.Vector3[] = [];
    const n = 180;
    for (let i = 0; i <= n; i++) {
      const tt = (i / n) * Math.max(0.02, t);
      const x = rb * (Math.cos(tt) + tt * Math.sin(tt));
      const y = rb * (Math.sin(tt) - tt * Math.cos(tt));
      out.push(new THREE.Vector3(x, y, 0));
    }
    return out;
  }, [t, rb]);
  // 线宽在 WebGL 里不可靠（linewidth 基本被忽略），所以曲线用一根细管子画。
  const line = useMemo(() => {
    const curve = new THREE.CatmullRomCurve3(pts);
    const g = new THREE.TubeGeometry(curve, Math.min(240, pts.length * 2), 2.4, 8, false);
    return new THREE.Mesh(g, new THREE.MeshStandardMaterial({ color: new THREE.Color(PAL.paper), emissive: new THREE.Color(PAL.paper), emissiveIntensity: 0.55, roughness: 0.4, metalness: 0 }));
  }, [pts]);
  const stringEnd = new THREE.Vector3(rb * (Math.cos(t) + t * Math.sin(t)), rb * (Math.sin(t) - t * Math.cos(t)), 0);
  const basePoint = new THREE.Vector3(rb * Math.cos(t), rb * Math.sin(t), 0);
  return (
    <group>
      <mesh material={useMemo(() => makeMaterial("glow", PAL.accent), [shaded])}>
        <torusGeometry args={[rb, 0.45, 10, 120]} />
      </mesh>
      {/* 解开的绳子：从切点到曲线终点的一段直线 */}
      <mesh
        position={[(basePoint.x + stringEnd.x) / 2, (basePoint.y + stringEnd.y) / 2, 0]}
        rotation={[0, 0, Math.atan2(stringEnd.y - basePoint.y, stringEnd.x - basePoint.x)]}
        material={useMemo(() => makeMaterial("glow", PAL.warn), [])}
      >
        <boxGeometry args={[Math.hypot(stringEnd.x - basePoint.x, stringEnd.y - basePoint.y), 0.9, 0.9]} />
      </mesh>
      <primitive object={line} />
      <mesh position={[basePoint.x, basePoint.y, 0]} material={useMemo(() => makeMaterial("glow", PAL.note, { transparent: true, opacity: 0.9 }), [])}>
        <sphereGeometry args={[0.5, 12, 12]} />
      </mesh>
      <mesh position={[stringEnd.x, stringEnd.y, 0]} material={useMemo(() => makeMaterial("glow", PAL.accent), [])}>
        <sphereGeometry args={[0.8, 16, 16]} />
      </mesh>
    </group>
  );
};

/* ------------------------------------------------------------------ 2D 图版 */

export const Diagram: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>{children}</div>
);

/** 啮合线：两条基圆的内公切线，接触点永远落在这条线上。坐标先按 mm 算，再整体换成 px。 */
export const S = 9; // px per mm（背隙图用这个）
export const SD = 4.4; // 啮合线图要装下两个基圆，比例单独取
export const ConjugateDiagram: React.FC<{ f: number }> = ({ f }) => {
  const a = PARAMS.pairs.a;
  const alpha = (PA * Math.PI) / 180;
  const r1 = (a.module * a.z1) / 2;
  const r2 = (a.module * a.z2) / 2;
  const rb1 = r1 * Math.cos(alpha);
  const rb2 = r2 * Math.cos(alpha);
  const d = r1 + r2;
  const eps = GEOM.pairA.contactRatio;
  // 啮合线长 = 重合度 × 齿距，方向与中心线的垂线成 alpha 角。
  const L = eps * Math.PI * a.module * Math.cos(alpha);
  const dx = Math.sin(alpha);
  const dy = Math.cos(alpha);
  const u = pct(f, 10, 120) * 2 - 1;
  const X = (mmx: number) => mmx * SD;
  const Y = (mmy: number) => -mmy * SD; // SVG 的 y 轴朝下
  const contact = { x: r1 + ((u * L) / 2) * dx, y: ((u * L) / 2) * dy };
  const line = { x1: r1 - (L / 2) * dx, y1: -(L / 2) * dy, x2: r1 + (L / 2) * dx, y2: (L / 2) * dy };
  return (
    <svg width={1320} height={470} viewBox={`${-r1 * SD - 100} ${-250} ${(d + r2) * SD + 160} 470`}>
      <circle cx={X(0)} cy={0} r={r1 * SD} fill="none" stroke={C.panelLine} strokeWidth={3} />
      <circle cx={X(d)} cy={0} r={r2 * SD} fill="none" stroke={C.panelLine} strokeWidth={3} />
      <circle cx={X(0)} cy={0} r={rb1 * SD} fill="none" stroke={C.cyan} strokeWidth={3} strokeDasharray="8 7" />
      <circle cx={X(d)} cy={0} r={rb2 * SD} fill="none" stroke={C.cyan} strokeWidth={3} strokeDasharray="8 7" />
      <line x1={X(0)} y1={0} x2={X(d)} y2={0} stroke={C.inkFaint} strokeWidth={2.5} strokeDasharray="5 7" />
      <line x1={X(line.x1)} y1={Y(line.y1)} x2={X(line.x2)} y2={Y(line.y2)} stroke={C.amber} strokeWidth={4} />
      <circle cx={X(r1)} cy={0} r={8} fill={C.inkDim} />
      <circle cx={X(contact.x)} cy={Y(contact.y)} r={11} fill={C.amber} />
      <text x={X(contact.x) + 14} y={Y(contact.y) - 18} fill={C.amber} fontSize={26} fontFamily={FONT.mono}>
        接触点
      </text>
      <text x={X(r1) - 16} y={40} fill={C.inkFaint} fontSize={24} fontFamily={FONT.mono} textAnchor="end">
        节点 P
      </text>
      <text x={X(d)} y={r2 * SD + 46} fill={C.inkFaint} fontSize={24} fontFamily={FONT.mono} textAnchor="middle">
        啮合线长 = ε·π·m·cos α
      </text>
      <text x={X(0)} y={r1 * SD + 46} fill={C.inkFaint} fontSize={24} fontFamily={FONT.mono} textAnchor="middle">
        基圆 rb = r·cos20°
      </text>
    </svg>
  );
};

/** 背隙：两个齿之间那道缝，换算成轴上的角度误差。坐标同样先算 mm 再换 px。 */
export const BacklashDiagram: React.FC<{ f: number }> = ({ f }) => {
  const a = PARAMS.pairs.a;
  const r = (a.module * a.z1) / 2;
  const half = Math.PI / (2 * a.z1);
  const gap = interpolate(pct(f, 10, 110), [0, 1], [1, 5]);
  const P = (rr: number, ang: number) => ({ x: rr * Math.cos(ang) * S, y: -rr * Math.sin(ang) * S });
  const p1 = P(r, -half);
  const p1b = P(r + 2.2, -half);
  const p2 = P(r, half + gap / 100);
  const p2b = P(r + 2.2, half + gap / 100);
  return (
    <svg width={760} height={520} viewBox={`${-r * S - 80} ${-260} ${2 * r * S + 160} 520`}>
      <circle cx={0} cy={0} r={r * S} fill="none" stroke={C.panelLine} strokeWidth={3} />
      <circle cx={0} cy={0} r={r * Math.cos((PA * Math.PI) / 180) * S} fill="none" stroke={C.cyan} strokeWidth={2.5} strokeDasharray="7 6" />
      <path d={`M ${p1.x} ${p1.y} L ${p1b.x} ${p1b.y}`} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
      <path d={`M ${p2.x} ${p2.y} L ${p2b.x} ${p2b.y}`} stroke={C.ink} strokeWidth={7} strokeLinecap="round" />
      <text x={0} y={r * S + 60} fill={C.inkFaint} fontSize={24} fontFamily={FONT.mono} textAnchor="middle">
        齿厚 = 半个齿距 − 背隙
      </text>
    </svg>
  );
};

/* ------------------------------------------------------------------ 场景外壳 */

export const Head: React.FC<{ id: string }> = ({ id }) => {
  const sc = sceneOf(id);
  return (
    <div style={{ paddingTop: 44, maxWidth: 900 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, letterSpacing: FT_T.meta, color: C.cyan }}>{sc.kicker}</div>
      <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, marginTop: 10, lineHeight: 1.1 }}>{sc.title}</div>
      <div style={{ fontSize: FT.body, color: C.inkFaint, marginTop: 10 }}>{sc.goal}</div>
    </div>
  );
};

/**
 * 3D 是全画幅、透明背景的一层：不裁 canvas 的宽度（ThreeCanvas 的宽高永远取自
 * useVideoConfig，用 CSS 缩一半只会把画面拉歪）。要把画面让给左侧文字，就把
 * 物体在相机空间里整体右移 —— 这是几何，不是布局。
 */
export const Stage: React.FC<{
  children: React.ReactNode;
  camera?: "wide" | "product" | "low" | "top";
  shift?: number;
  /** 正面补光强度：盘面几乎与主光垂直，没有它只剩轮廓（K23）。 */
  front?: number;
  /** ACES 曝光。齿轮材质是浅色纸感，满曝光时盘面读成"贴纸"；0.9 让白色落到 210 附近。 */
  exposure?: number;
  /** 给景深就开景深（只有真正近景的场才该薄）。 */
  dof?: DofSettings;
}> = ({ children, camera = "product", shift = 1.25, front = 2.2, exposure = 0.9, dof }) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <Canvas3D camera={camera} background={null} exposure={exposure} dof={dof}>
      <group position={[shift, 0, 0]}>
        <directionalLight position={[1.2, 3.2, 9]} intensity={front} color={C.paper} />
        {children}
      </group>
    </Canvas3D>
    {/* 镜头暗角，只压在 3D 层上：文字在同一层之上，不会被一起压暗。
        不是滤镜——是把注意力从四角收回画面中心（docs/32 §2）。 */}
    <div
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
        background:
          "radial-gradient(ellipse 80% 80% at 52% 46%, rgba(0,0,0,0) 42%, rgba(0,0,0,0.17) 78%, rgba(0,0,0,0.34) 100%)",
      }}
    />
  </AbsoluteFill>
);

export const Bullet: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const o = pct(f, at, at + 12);
  return <div style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)`, fontSize: FT.body, color: C.inkDim, marginTop: 12 }}>{children}</div>;
};

export const Value: React.FC<{ label: string; value: string; at: number }> = ({ label, value, at }) => {
  const f = useCurrentFrame();
  const o = pct(f, at, at + 10);
  return (
    <div style={{ opacity: o, marginTop: 10 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>{label}</div>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.h2, color: C.paper, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
};