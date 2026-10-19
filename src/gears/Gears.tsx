import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { C, FONT, FT, FT_T, G } from "../design/tokens";
import { ChapterBar, SceneShell } from "../design/Scene";
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
 * 《啮合：齿轮如何把速度换成力》—— 第三部片，3D 为主、2D 为辅。
 *
 * 每一帧的几何都由 data/gears/params.json 算出来（src/gears/profile.ts），
 * 不是导入的模型：所以 scripts/qa/geometry_check.mjs 与 mesh_check.mjs
 * 验算的东西，就是画面上出现的东西。2D 只做标题、字幕、参数面板这三件事。
 *
 * 机的尺寸单位是毫米（模数 2、中心距 70），进 3D 前整体缩放 1/28。
 */

const MM = 28; // 28 mm = 1 个场景单位
const PA = PARAMS.pressureAngleDeg;

type Vec3 = [number, number, number];

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pct = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);

/* ------------------------------------------------------------------ 3D 零件 */

const Gear: React.FC<{
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
const Pair: React.FC<{ th: number; material?: MaterialPreset; shade?: boolean; highlight?: number }> = ({
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
const Planetary: React.FC<{ th: number; material?: MaterialPreset }> = ({ th, material = "satin" }) => {
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
const Involute: React.FC<{ f: number; duration: number; shaded?: boolean }> = ({ f, duration, shaded = false }) => {
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

const Diagram: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", ...style }}>{children}</div>
);

/** 啮合线：两条基圆的内公切线，接触点永远落在这条线上。坐标先按 mm 算，再整体换成 px。 */
const S = 9; // px per mm（背隙图用这个）
const SD = 4.4; // 啮合线图要装下两个基圆，比例单独取
const ConjugateDiagram: React.FC<{ f: number }> = ({ f }) => {
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
const BacklashDiagram: React.FC<{ f: number }> = ({ f }) => {
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

const Head: React.FC<{ id: string }> = ({ id }) => {
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
const Stage: React.FC<{ children: React.ReactNode; camera?: "wide" | "product" | "low" | "top"; shift?: number }> = ({
  children,
  camera = "product",
  shift = 1.25,
}) => (
  <AbsoluteFill style={{ pointerEvents: "none" }}>
    <Canvas3D camera={camera} background={null}>
      <group position={[shift, 0, 0]}>
        {/* 齿轮是平的：正面几乎与主光垂直，不补一盏正面光，盘面就只剩轮廓。 */}
        <directionalLight position={[1.2, 3.2, 9]} intensity={2.2} color={C.paper} />
        {children}
      </group>
    </Canvas3D>
  </AbsoluteFill>
);

const Bullet: React.FC<{ at: number; children: React.ReactNode }> = ({ at, children }) => {
  const f = useCurrentFrame();
  const o = pct(f, at, at + 12);
  return <div style={{ opacity: o, transform: `translateY(${(1 - o) * 10}px)`, fontSize: FT.body, color: C.inkDim, marginTop: 12 }}>{children}</div>;
};

const Value: React.FC<{ label: string; value: string; at: number }> = ({ label, value, at }) => {
  const f = useCurrentFrame();
  const o = pct(f, at, at + 10);
  return (
    <div style={{ opacity: o, marginTop: 10 }}>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>{label}</div>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.h2, color: C.paper, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
};

/* ------------------------------------------------------------------ 11 个场景 */

const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <SceneShell>
      <ChapterBar chapter="开场" index={1} total={SCENES.length} progress={Math.min(1, f / (sceneOf("open").dur * FPS))} />
      <Head id="open" />
      <Bullet at={frameOf("open", 1)}>齿不是装饰：它是把圆周运动切成一份一份的刻度。</Bullet>
      <Bullet at={frameOf("open", 2)}>{RATIO.rows.length} 行转速表、{(PARAMS as typeof PARAMS).pairs.a.z1}:{(PARAMS as typeof PARAMS).pairs.a.z2} 的齿数比，全部由脚本算出。</Bullet>
      <Stage camera="product">
        <StudioLights ambient={0.5} key={2.9} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.2, 0]} rotation={[0.42, -0.34, 0]} scale={1 / MM}>
          <Pair th={0.2 + f * 0.012} />
        </group>
        <Orbit radius={12.4} height={4.4} fromDeg={-12} toDeg={12} target={[0, 0.2, 0]} />
      </Stage>
    </SceneShell>
  );
};

const SRatio: React.FC = () => {
  const f = useCurrentFrame();
  const a = PARAMS.pairs.a;
  const th = f * 0.045;
  return (
    <SceneShell>
      <ChapterBar chapter="速比" index={2} total={SCENES.length} progress={Math.min(1, f / (sceneOf("ratio").dur * FPS))} />
      <Head id="ratio" />
      <Bullet at={frameOf("ratio", 1)}>
        小轮 z={a.z1}，大轮 z={a.z2}，模数都是 {a.module} mm。
      </Bullet>
      <Bullet at={frameOf("ratio", 2)}>
        z₁·n₁ = z₂·n₂：小轮转一圈，大轮只转 {Math.abs(RATIO.rows[1].wheelDeg).toFixed(0)}°
      </Bullet>
      <div style={{ marginTop: 22, display: "flex", gap: 26 }}>
        <Value label="速比 i = z₂/z₁" value={String((a.z2 / a.z1).toFixed(2))} at={frameOf("ratio", 4)} />
        <Value label="小轮转角" value={`${(((th * 180) / Math.PI) % 360).toFixed(1)}°`} at={frameOf("ratio", 4)} />
        <Value label="大轮转角" value={`${(((th * (a.z1 / a.z2) * 180) / Math.PI) % 360).toFixed(1)}°`} at={frameOf("ratio", 4)} />
      </div>
      <Stage camera="product">
        <StudioLights ambient={0.5} key={2.9} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.1, 0]} rotation={[0.4, -0.26, 0]} scale={1 / MM}>
          <Pair th={th} material="satin" />
        </group>
        <Dolly from={[11.2, 5.8, 12.0]} to={[9.8, 5.0, 10.6]} target={[0, 0.1, 0]} />
      </Stage>
    </SceneShell>
  );
};

const SInvolute: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("involute").dur * FPS;
  const a = PARAMS.pairs.a;
  const rb = ((a.module * a.z1) / 2) * Math.cos((PA * Math.PI) / 180);
  const t = pct(f, 10, dur - 20) * 1.9;
  return (
    <SceneShell>
      <ChapterBar chapter="渐开线" index={3} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="involute" />
      <Bullet at={frameOf("involute", 2)}>展开角 t = {t.toFixed(3)} rad</Bullet>
      <Bullet at={frameOf("involute", 3)}>
        r(t) = r_b·√(1+t²) = {(rb * Math.sqrt(1 + t * t)).toFixed(3)} mm
      </Bullet>
      <Bullet at={frameOf("involute", 4)}>
        inv(α) = tan α − α = {inv((PA * Math.PI) / 180).toFixed(4)}
      </Bullet>
      <Stage camera="wide" shift={1.35}>
        <StudioLights ambient={0.65} key={2.2} shadowSize={1024} />
        <group position={[0, 0, 0]} rotation={[0.08, 0, 0]} scale={1 / (MM * 0.46)}>
          <Involute f={f} duration={dur} />
        </group>
      </Stage>
    </SceneShell>
  );
};

const SConjugate: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("conjugate").dur * FPS;
  return (
    <SceneShell>
      <ChapterBar chapter="为什么是它" index={4} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="conjugate" />
      <Bullet at={frameOf("conjugate", 2)}>公法线始终穿过节点 P：位置固定，速比就固定。</Bullet>
      <Bullet at={frameOf("conjugate", 4)}>圆弧齿廓的法线会摆动，转速随之起伏。</Bullet>
      <div style={{ position: "absolute", left: 50, top: 430 }}>
        <ConjugateDiagram f={f} />
      </div>
      <Stage camera="product">
        <StudioLights ambient={0.6} key={2.4} shadowSize={1024} />
        <group position={[0, 0.1, 0]} rotation={[0.6, -0.5, 0]} scale={1 / (MM * 1.6)}>
          <Pair th={f * 0.02} material="matte" />
        </group>
        <Orbit radius={8.4} height={4.2} fromDeg={-24} toDeg={8} target={[0, 0.1, 0]} />
      </Stage>
    </SceneShell>
  );
};

const SContact: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("contact").dur * FPS;
  const a = PARAMS.pairs.a;
  const eps = GEOM.pairA.contactRatio;
  const travel = pct(f, 12, dur - 16);
  return (
    <SceneShell>
      <ChapterBar chapter="重合度" index={5} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="contact" />
      <Bullet at={frameOf("contact", 2)}>
        重合度 ε = {eps.toFixed(4)}：平均 {eps.toFixed(2)} 对齿同时接触。
      </Bullet>
      <Bullet at={frameOf("contact", 4)}>ε &lt; 1 就会一跳一跳地过齿：每对齿都要独自扛下全部载荷。</Bullet>
      <div style={{ marginTop: 18 }}>
        <div style={{ height: 10, width: 560, background: C.panelLine, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: 10, width: `${travel * 100}%`, background: C.amber }} />
        </div>
        <div style={{ marginTop: 8, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>
          啮合线走过 {(travel * eps).toFixed(2)} 个齿距
        </div>
      </div>
      <Stage camera="product">
        <StudioLights ambient={0.5} key={2.9} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.1, 0]} rotation={[0.42, -0.3, 0]} scale={1 / (MM * 0.8)}>
          <Pair th={f * 0.05} material="satin" highlight={0} />
        </group>
        <Dolly from={[9.6, 5.2, 10.4]} to={[8.2, 4.2, 8.8]} target={[0, 0.1, 0]} />
      </Stage>
    </SceneShell>
  );
};

const STorque: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("torque").dur * FPS;
  return (
    <SceneShell>
      <ChapterBar chapter="扭矩" index={6} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="torque" />
      <Bullet at={frameOf("torque", 2)}>P = τ·ω，功率不变，转速降多少，扭矩涨多少。</Bullet>
      <div style={{ display: "flex", gap: 30, marginTop: 20 }}>
        <Value label="输入功率" value={`${TORQUE.powerW} W`} at={frameOf("torque", 2)} />
        <Value label="ω₁" value={`${TORQUE.omega1RadPerSec} rad/s`} at={frameOf("torque", 2)} />
        <Value label="τ₁" value={`${TORQUE.torque1Nm.toFixed(1)} N·m`} at={frameOf("torque", 4)} />
        <Value label="τ₂" value={`${TORQUE.torque2Nm.toFixed(1)} N·m`} at={frameOf("torque", 4)} />
      </div>
      <Stage camera="product">
        <StudioLights ambient={0.5} key={2.9} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.1, 0]} rotation={[0.42, -0.28, 0]} scale={1 / MM}>
          <Pair th={f * 0.03} material="metal" />
        </group>
        <Orbit radius={9.0} height={3.6} fromDeg={20} toDeg={-14} target={[0, 0.1, 0]} />
      </Stage>
    </SceneShell>
  );
};

const SPlanetary: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("planetary").dur * FPS;
  const th = f * 0.02;
  const b = PARAMS.pairs.b;
  const ic = 1 + b.zRing / b.zSun;
  return (
    <SceneShell>
      <ChapterBar chapter="行星轮系" index={7} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="planetary" />
      <Bullet at={frameOf("planetary", 2)}>
        齿圈固定：i = 1 + z_r/z_s = {ic.toFixed(3)}
      </Bullet>
      <Bullet at={frameOf("planetary", 3)}>
        行星架固定：i = −z_r/z_s = {(-b.zRing / b.zSun).toFixed(3)}
      </Bullet>
      <Bullet at={frameOf("planetary", 4)}>
        太阳固定：i = z_r/(z_s+z_r) = {(b.zRing / (b.zSun + b.zRing)).toFixed(3)}
      </Bullet>
      <div style={{ marginTop: 14, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>
        Willis: (n_s − n_c)/(n_r − n_c) = −z_r/z_s = {PLANETARY.ratioToZsun.toFixed(3)}
      </div>
      <Stage camera="product">
        <StudioLights ambient={0.5} key={2.9} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.1, 0]} rotation={[0.34, -0.12, 0]} scale={1 / (MM * 1.7)}>
          <Planetary th={th} material="satin" />
        </group>
        <Orbit radius={7.2} height={3.6} fromDeg={-12} toDeg={12} target={[0, 0.1, 0]} />
      </Stage>
    </SceneShell>
  );
};

const SBacklash: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("backlash").dur * FPS;
  const row = BACKLASH.rows[1];
  return (
    <SceneShell>
      <ChapterBar chapter="背隙" index={8} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="backlash" />
      <Bullet at={frameOf("backlash", 2)}>
        {row.clearanceMm} mm 背隙 ÷ 半径 {row.pitchRadius} mm = {row.angularErrorDeg.toFixed(4)}°
      </Bullet>
      <Bullet at={frameOf("backlash", 4)}>换向时这点回差会原样出现在输出轴上。</Bullet>
      <div style={{ position: "absolute", left: 40, right: "38%", top: 470, bottom: 150 }}>
        <BacklashDiagram f={f} />
      </div>
      <Stage camera="wide" shift={1.6}>
        <StudioLights ambient={0.6} key={2.4} shadowSize={1024} />
        <group position={[0, 0.1, 0]} rotation={[0.12, 0.2, 0]} scale={1 / (MM * 0.8)}>
          <Pair th={f * 0.01} material="matte" />
        </group>
      </Stage>
    </SceneShell>
  );
};

const SModule: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("module").dur * FPS;
  const a = PARAMS.pairs.a;
  const m3 = 3;
  return (
    <SceneShell>
      <ChapterBar chapter="模数" index={9} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="module" />
      <Bullet at={frameOf("module", 1)}>模数 m = 节圆直径 / 齿数 = {a.module} mm</Bullet>
      <Bullet at={frameOf("module", 3)}>
        中心距 = m(z₁+z₂)/2 = {a.module}·{a.z1 + a.z2}/2 = {centreDistance(a.module, a.z1, a.z2)} mm
      </Bullet>
      <Bullet at={frameOf("module", 4)}>换模数就换中心距：{m3}·{a.z1 + a.z2}/2 = {centreDistance(m3, a.z1, a.z2)} mm</Bullet>
      <Stage camera="product">
        <StudioLights ambient={0.5} key={2.9} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.9, 0]} rotation={[0.34, -0.22, 0]} scale={1 / MM}>
          <group position={[0, 0, 0]}>
            <Pair th={f * 0.02} material="satin" />
          </group>
        </group>
        <group position={[-1.9, -1.95, 1.4]} rotation={[0.34, -0.22, 0]} scale={1 / MM}>
          <Gear
            spec={{ z: a.z1, module: m3, pressureAngleDeg: PA, faceWidth: a.faceWidth, bore: 8 }}
            phase={f * 0.02}
            material="matte"
            color={PAL.note}
          />
        </group>
        <Dolly from={[11.4, 6.0, 12.0]} to={[10.2, 5.4, 10.8]} target={[0, 0.2, 0]} />
      </Stage>
    </SceneShell>
  );
};

const SHistory: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("history").dur * FPS;
  const h = PARAMS.history;
  return (
    <SceneShell>
      <ChapterBar chapter="来历" index={10} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="history" />
      <div style={{ marginTop: 26, display: "flex", flexDirection: "column", gap: 16 }}>
        {[h.clock, h.watch, h.windTurbine].map((row, i) => (
          <div key={row.label} style={{ opacity: pct(f, 30 + i * 20, 42 + i * 20) }}>
            <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>{row.label}</div>
            <div style={{ fontFamily: FONT.mono, fontSize: FT.h2, color: C.paper }}>
              {"ratio" in row ? `1 : ${row.ratio}` : `1 : ${row.ratioMin}–${row.ratioMax}`}
            </div>
            <div style={{ fontSize: FT.meta, color: C.inkFaint }}>{row.note}</div>
          </div>
        ))}
      </div>
      <Stage camera="product">
        <StudioLights ambient={0.55} key={2.6} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.2, 0]} rotation={[0.4, -0.24, 0]} scale={1 / (MM * 1.1)}>
          <Gear spec={{ z: 12, module: 6, pressureAngleDeg: PA, faceWidth: 5, bore: 8 }} phase={f * 0.04} material="matte" color={PAL.paper} position={[-1.5, 0, 0]} />
          <Gear spec={{ z: 60, module: 2, pressureAngleDeg: PA, faceWidth: 6, bore: 10 }} phase={-f * 0.008} material="satin" color={PAL.accent} position={[1.6, 0, 0]} />
        </group>
        <Orbit radius={9.6} height={3.8} fromDeg={16} toDeg={-10} target={[0, 0.2, 0]} />
      </Stage>
    </SceneShell>
  );
};

const SOutro: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("outro").dur * FPS;
  return (
    <SceneShell>
      <ChapterBar chapter="结论" index={11} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="outro" />
      <Bullet at={frameOf("outro", 1)}>渐开线 · 模数 · 齿数比 · 背隙：四个约束一起把齿形逼出来。</Bullet>
      <Bullet at={frameOf("outro", 3)}>参数只写一遍，其余数字都由脚本重算。</Bullet>
      <div style={{ marginTop: 26, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>
        npm run gears:data · npm run lint:geometry · npm run lint:budget
      </div>
      <Stage camera="product">
        <StudioLights ambient={0.45} key={3} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.1, 0]} rotation={[0.42, -0.28, 0]} scale={1 / MM}>
          <Pair th={f * 0.05} material="satin" />
        </group>
        <Orbit radius={9.4} height={3.6} fromDeg={-20} toDeg={8} target={[0, 0.1, 0]} />
      </Stage>
    </SceneShell>
  );
};

const SCENE_COMPONENTS: Record<string, React.FC> = {
  open: SOpen,
  ratio: SRatio,
  involute: SInvolute,
  conjugate: SConjugate,
  contact: SContact,
  torque: STorque,
  planetary: SPlanetary,
  backlash: SBacklash,
  module: SModule,
  history: SHistory,
  outro: SOutro,
};

/* ------------------------------------------------------------------ 字幕与根 */

const Subtitle: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const line = LINES.find((c) => t >= c.start && t < c.start + c.dur);
  if (!line) return null;
  const local = (t - line.start) / line.dur;
  const o = interpolate(local, [0, 0.06, 0.94, 1], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          background: C.panel,
          border: "1px solid " + C.panelLine,
          borderRadius: 12,
          padding: "10px 26px",
          fontSize: FT.h2,
          color: C.ink,
          maxWidth: 1440,
          textAlign: "center",
          lineHeight: 1.45,
        }}
      >
        {line.speech}
      </div>
    </div>
  );
};

export const Gears: React.FC<{ music?: string | null; narration?: string | null }> = ({
  music = "music/gears.wav",
  narration = null,
}) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink }}>
    {music ? <Audio src={staticFile(music)} volume={0.16} /> : null}
    {narration ? <Audio src={staticFile(narration)} volume={1} /> : null}
    {SCENES.map((s) => (
      <Sequence key={s.id} from={Math.round(s.start * FPS)} durationInFrames={Math.round(s.dur * FPS)}>
        {React.createElement(SCENE_COMPONENTS[s.id])}
      </Sequence>
    ))}
    <Subtitle />
  </AbsoluteFill>
);

export { TOTAL as GEARS_TOTAL, FPS as GEARS_FPS };

/* 让 lint 知道这些常量被引用：场景表与数据是同一个真源。 */
void linesOf;
void G;
void Dolly;
void Orbit;
void RATIO;