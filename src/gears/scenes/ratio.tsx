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

export default SRatio;
