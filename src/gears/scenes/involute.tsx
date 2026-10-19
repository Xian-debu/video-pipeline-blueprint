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

export default SInvolute;
