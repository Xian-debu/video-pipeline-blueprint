import React, { useMemo } from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { ChapterBar, SceneShell } from "../../design/Scene";
import { Canvas3D } from "../../design/three/Canvas3D";
import { Crane } from "../../design/three/CameraRig";
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
        {/* 开场：摇臂从高处落下并横移，像把镜头放到工作台上。 */}
        <Crane radius={12.4} fromHeight={6.6} toHeight={3.6} fromDeg={-14} toDeg={10} target={[0, 0.2, 0]} />
      </Stage>
    </SceneShell>
  );
};

export default SOpen;