import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { ChapterBar, SceneShell } from "../../design/Scene";
import { Canvas3D } from "../../design/three/Canvas3D";
import { Dolly, Orbit } from "../../design/three/CameraRig";
import { StudioLights } from "../../design/three/lighting";
import { PAL, makeMaterial, type MaterialPreset } from "../../design/three/materials";
import { SCENES, LINES, FPS, TOTAL, frameOf, linesOf, sceneOf } from "../script";
import { centreDistance, gearGeometry, meshPhase, planetaryPhase, type GearGeometrySpec } from "../geometry";
import { gearShape2D, inv } from "../profile";
import PARAMS from "../../../data/gears/params.json";
import GEOM from "../../../data/gears/geometry.json";
import PLANETARY from "../../../data/gears/planetary.json";
import BACKLASH from "../../../data/gears/backlash.json";
import RATIO from "../../../data/gears/ratio.json";
import TORQUE from "../../../data/gears/torque.json";
import { MM, PA, clamp, pct, Gear, Pair, Planetary, Involute, Diagram, S, SD, ConjugateDiagram, BacklashDiagram, Head, Stage, Bullet, Value } from "../parts";

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
      {/* 这一场真的有两层：主对在焦平面上，m=3 那个轮子离机位更近、偏下，应该虚掉一层。 */}
      <Stage camera="product" dof={{ range: 5, blur: 8, subject: [0, 0.9, 0] }}>
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

export default SModule;