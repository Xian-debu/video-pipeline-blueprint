import React from "react";
import { C } from "../tokens";

/**
 * 三点光：主光（暖白、投影）、补光（紫，压暗部）、轮廓光（青，勾边）。
 * 颜色同样来自令牌——3D 的灯光是设计系统的一部分，不是渲染参数。
 * 阴影贴图固定 1024，避免不同机器上的默认值差异。
 */
export const StudioLights: React.FC<{ ambient?: number; key?: number; rim?: number }> = ({
  ambient = 0.42,
  key = 2.6,
  rim = 1.5,
}) => (
  <>
    <ambientLight intensity={ambient} color={C.bgSoft} />
    <directionalLight
      position={[5.2, 7.4, 4.6]}
      intensity={key}
      color={C.paper}
      castShadow
      shadow-mapSize={[1024, 1024]}
      shadow-bias={-0.0006}
      shadow-camera-left={-9}
      shadow-camera-right={9}
      shadow-camera-top={9}
      shadow-camera-bottom={-9}
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
