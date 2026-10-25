import React from "react";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";

/**
 * 角色的两套光。角色片有一条硬规矩：**量的时候用一种光，看的时候用另一种光**。
 *
 * NeutralRig —— 白底、白灯、无阴影、无环境色偏。给三视图对照与门禁用：
 *               IoU/剖面/ΔE 这些数字不能被"好看"的灯光影响，否则数字会随灯光漂。
 * HeroRig    —— 深底、暖主光、青色轮廓、环境贴图、地面投影。给成片画面用。
 *
 * 两套光都显式写死，不吃库的默认值：环境贴图用 RoomEnvironment（程序化、无外部文件），
 * 走 PMREM 预过滤，保证同一台机器同一帧两次渲出来是同一张图（P0 已验证 sha256 相同）。
 */

const Env: React.FC<{ intensity?: number }> = ({ intensity = 1 }) => {
  const gl = useThree((s) => s.gl);
  const scene = useThree((s) => s.scene);
  React.useLayoutEffect(() => {
    const pmrem = new THREE.PMREMGenerator(gl);
    const room = new RoomEnvironment();
    const rt = pmrem.fromScene(room, 0.04);
    scene.environment = rt.texture;
    scene.environmentIntensity = intensity;
    return () => {
      scene.environment = null;
      rt.dispose();
      room.dispose?.();
      pmrem.dispose();
    };
  }, [gl, scene, intensity]);
  return null;
};

/** 量判据用的中性光：白背景、白灯、不投影、不染色。
 *
 * k 是总辐照系数。门禁要求"渲染出来的身体颜色 = 参考图上的颜色"，而参考图的黄色
 * (232,189,60) 恰好就是反照率 (0.82,0.50,0.045) 的 sRGB —— 也就是说中性光的
 * 总辐照必须≈1.0、而且不能有白色高光把颜色冲淡。k 就是用来把这个和调到 1.0 的
 * 唯一旋钮（见 scripts/char2/views.py 的 dEBody 门）。 */
export const NeutralRig: React.FC<{ env?: number; k?: number }> = ({ env = 0.12, k = 1 }) => (
  <>
    <Env intensity={env * k} />
    {/* Measured, not assumed: a flat-looking rig is NOT view-invariant. Swapping most of
        the irradiance into ambient made every view darker and the front-to-back gradient
        stayed at ~6% (the room environment's specular term follows the view direction).
        So the rig stays a shaped key light and the colour gate is applied where it is
        meaningful -- on the front, where the sample band faces the key dead-on. Side and
        back report dE plus the reference's own cross-view spread instead of gating it. */}
    <ambientLight intensity={0.55 * k} color="#ffffff" />
    <hemisphereLight args={["#ffffff", "#ffffff", 0.25 * k]} />
    <directionalLight position={[2.6, 4.2, 6.0]} intensity={1.25 * k} color="#ffffff" />
    <directionalLight position={[-3.4, 1.6, 2.2]} intensity={0.35 * k} color="#ffffff" />
    <directionalLight position={[0, 2.2, -5.0]} intensity={0.30 * k} color="#ffffff" />
  </>
);

/** 成片用的电影光。参数化是因为 look-dev 要拿同一台机器上的三组候选做像素比较，
 *  而不是靠形容词选。默认值 = 深底青轮廓那一组（stage）。 */
export const HeroRig: React.FC<{
  keyI?: number;
  rim?: string;
  rimI?: number;
  fill?: string;
  fillI?: number;
  bounce?: string;
  bounceI?: number;
  env?: number;
  shadowSize?: number;
  extent?: number;
}> = ({
  keyI = 2.9,
  rim = "#37e0d6",
  rimI = 9,
  fill = "#ffe9c9",
  fillI = 0.55,
  bounce = "#9f7bff",
  bounceI = 0.7,
  env = 0.9,
  shadowSize = 2048,
  extent = 3.2,
}) => (
  <>
    <Env intensity={env} />
    <ambientLight intensity={0.28} color="#8fb4bf" />
    <directionalLight
      position={[3.4, 5.2, 3.2]}
      intensity={keyI}
      color="#fff2d6"
      castShadow
      shadow-mapSize={[shadowSize, shadowSize]}
      shadow-bias={-0.0004}
      shadow-normalBias={0.02}
      shadow-camera-left={-extent}
      shadow-camera-right={extent}
      shadow-camera-top={extent}
      shadow-camera-bottom={-extent}
      shadow-camera-near={0.2}
      shadow-camera-far={30}
    />
    <directionalLight position={[-2.6, 1.4, 2.8]} intensity={fillI} color={fill} />
    <spotLight position={[-3.0, 2.6, -3.4]} angle={0.9} penumbra={1} intensity={rimI} color={rim} />
    <directionalLight position={[0.6, 1.0, -4.4]} intensity={bounceI} color={bounce} />
  </>
);

export const StageGround: React.FC<{ y?: number; size?: number; color?: string }> = ({
  y = 0,
  size = 24,
  color = "#0d2a30",
}) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
    <planeGeometry args={[size, size]} />
    <meshStandardMaterial color={color} roughness={0.92} metalness={0} />
  </mesh>
);