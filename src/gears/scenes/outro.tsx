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

export default SOutro;
