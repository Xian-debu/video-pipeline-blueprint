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
        {/* 从钟表尺度升到风机尺度：慢摇臂 + 反向横移，给"同一条曲线、不同尺度"一个空间动作。 */}
        <Crane radius={9.6} fromHeight={2.9} toHeight={5.4} fromDeg={16} toDeg={-12} target={[0, 0.2, 0]} />
      </Stage>
    </SceneShell>
  );
};

export default SHistory;