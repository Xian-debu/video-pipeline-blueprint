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

export default SBacklash;
