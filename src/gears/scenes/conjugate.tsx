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

export default SConjugate;
