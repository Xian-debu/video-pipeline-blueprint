import React from "react";
import { C } from "../tokens";

/**
 * 三点光：主光（暖白、投影）、补光（紫，压暗部）、轮廓光（青，勾边）。
 * 颜色同样来自令牌——3D 的灯光是设计系统的一部分，不是渲染参数。
 * 阴影贴图固定 1024，避免不同机器上的默认值差异。
 */
export const StudioLights: React.FC<{
  ambient?: number;
  key?: number;
  rim?: number;
  /** 阴影贴图边长。小而近的物体（道具在 1.5 单位量级）需要更大，否则自阴影出条纹。 */
  shadowSize?: number;
  shadowBias?: number;
  /** 沿法线的偏移，比 depth bias 更能压掉平面上的自阴影条纹。 */
  shadowNormalBias?: number;
  /** 主光阴影相机的半边长；场景越大越要放宽，太小会让阴影在视野外被裁掉。 */
  shadowExtent?: number;
}> = ({
  ambient = 0.42,
  key = 2.6,
  rim = 1.5,
  shadowSize = 1024,
  shadowBias = -0.0006,
  shadowNormalBias = 0,
  shadowExtent = 9,
}) => (
  <>
    <ambientLight intensity={ambient} color={C.bgSoft} />
    <directionalLight
      position={[5.2, 7.4, 4.6]}
      intensity={key}
      color={C.paper}
      castShadow
      shadow-mapSize={[shadowSize, shadowSize]}
      shadow-bias={shadowBias}
      shadow-normalBias={shadowNormalBias}
      shadow-camera-left={-shadowExtent}
      shadow-camera-right={shadowExtent}
      shadow-camera-top={shadowExtent}
      shadow-camera-bottom={-shadowExtent}
      shadow-camera-near={0.5}
      shadow-camera-far={40}
    />
    <directionalLight position={[-5.6, 3.2, -3.4]} intensity={0.7} color={C.violet} />
    <directionalLight position={[-2.2, 2.4, -6.2]} intensity={rim} color={C.cyan} />
  </>
);

/** 地面：接收阴影，颜色是比背景略亮一档的表面色，让「物体站在哪里」可读。 */
export const Ground: React.FC<{ y?: number; size?: number }> = ({ y = 0, size = 28 }) => (
  <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, y, 0]} receiveShadow>
    <planeGeometry args={[size, size]} />
    <meshStandardMaterial color={C.bgSoft} roughness={0.96} metalness={0} />
  </mesh>
);
