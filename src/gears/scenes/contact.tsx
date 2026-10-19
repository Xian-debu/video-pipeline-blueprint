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

const SContact: React.FC = () => {
  const f = useCurrentFrame();
  const dur = sceneOf("contact").dur * FPS;
  const a = PARAMS.pairs.a;
  const eps = GEOM.pairA.contactRatio;
  const travel = pct(f, 12, dur - 16);
  return (
    <SceneShell>
      <ChapterBar chapter="重合度" index={5} total={SCENES.length} progress={Math.min(1, f / dur)} />
      <Head id="contact" />
      <Bullet at={frameOf("contact", 2)}>
        重合度 ε = {eps.toFixed(4)}：平均 {eps.toFixed(2)} 对齿同时接触。
      </Bullet>
      <Bullet at={frameOf("contact", 4)}>ε &lt; 1 就会一跳一跳地过齿：每对齿都要独自扛下全部载荷。</Bullet>
      <div style={{ marginTop: 18 }}>
        <div style={{ height: 10, width: 560, background: C.panelLine, borderRadius: 6, overflow: "hidden" }}>
          <div style={{ height: 10, width: `${travel * 100}%`, background: C.amber }} />
        </div>
        <div style={{ marginTop: 8, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>
          啮合线走过 {(travel * eps).toFixed(2)} 个齿距
        </div>
      </div>
      {/* 推轨近景：齿顶一排排退向远处。9.5 取自深度图（中段啮合处 10.5，收尾推到 8.0），
          推轨全片只走 2.6 个单位，range 8 下这点漂移落在 1 px 以内。 */}
      <Stage camera="product" dof={{ focus: 9.5, range: 5, blur: 4 }}>
        <StudioLights ambient={0.5} key={2.9} shadowSize={2048} shadowBias={-0.0002} shadowNormalBias={0.02} />
        <group position={[0, 0.1, 0]} rotation={[0.42, -0.3, 0]} scale={1 / (MM * 0.8)}>
          <Pair th={f * 0.05} material="satin" highlight={0} />
        </group>
        <Dolly from={[9.6, 5.2, 10.4]} to={[8.2, 4.2, 8.8]} target={[0, 0.1, 0]} />
      </Stage>
    </SceneShell>
  );
};

export default SContact;