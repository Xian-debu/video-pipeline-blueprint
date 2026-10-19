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
        {/* 摇臂升起：先从侧面看三个零件，再抬高看清内齿圈把行星咬在里面。 */}
        <Crane radius={7.4} fromHeight={2.6} toHeight={6.2} fromDeg={-16} toDeg={6} target={[0, 0.1, 0]} />
      </Stage>
    </SceneShell>
  );
};

export default SPlanetary;