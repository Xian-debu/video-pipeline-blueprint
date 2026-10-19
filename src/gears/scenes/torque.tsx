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

export default STorque;
