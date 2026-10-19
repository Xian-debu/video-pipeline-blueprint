import React from "react";
import { Easing, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";

type Vec3 = [number, number, number];

const aim = (camera: THREE.Camera, pos: Vec3, target: Vec3) => {
  camera.position.set(pos[0], pos[1], pos[2]);
  camera.lookAt(new THREE.Vector3(target[0], target[1], target[2]));
};

/**
 * 推轨：位置线性插值（缓动），从 from 到 to。
 * 不读真实时钟，也不用 useFrame —— 时间只有 useCurrentFrame()，这是整条产线的不变量。
 */
export const Dolly: React.FC<{ from: Vec3; to: Vec3; target?: Vec3; start?: number; end?: number }> = ({
  from,
  to,
  target = [0, 0.9, 0],
  start = 0,
  end,
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { camera } = useThree();
  const last = end ?? durationInFrames;
  const t = interpolate(frame, [start, Math.max(start + 1, last)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  aim(camera, [from[0] + (to[0] - from[0]) * t, from[1] + (to[1] - from[1]) * t, from[2] + (to[2] - from[2]) * t], target);
  return null;
};

/**
 * 摇臂：绕主体画弧的同时升降，落点也可以跟着移动。
 * 和 Dolly/Orbit 的区别是"两个轴同时动"：位置=球坐标(半径, 高度插值, 角度插值)，
 * 落点=两段插值。它比 Dolly 更像摄影机运动，比 Orbit 多一个竖直方向的信息。
 *
 * 同样只读 useCurrentFrame —— 不做物理、不用真实时钟。
 */
export const Crane: React.FC<{
  radius: number;
  fromHeight: number;
  toHeight: number;
  fromDeg: number;
  toDeg: number;
  target?: Vec3;
  targetTo?: Vec3;
  start?: number;
  end?: number;
}> = ({ radius, fromHeight, toHeight, fromDeg, toDeg, target = [0, 0.9, 0], targetTo, start = 0, end }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { camera } = useThree();
  const last = end ?? durationInFrames;
  const t = interpolate(frame, [start, Math.max(start + 1, last)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.cubic),
  });
  const deg = fromDeg + (toDeg - fromDeg) * t;
  const rad = (deg * Math.PI) / 180;
  const height = fromHeight + (toHeight - fromHeight) * t;
  const look = targetTo
    ? ([target[0] + (targetTo[0] - target[0]) * t, target[1] + (targetTo[1] - target[1]) * t, target[2] + (targetTo[2] - target[2]) * t] as Vec3)
    : target;
  aim(camera, [Math.sin(rad) * radius, height, Math.cos(rad) * radius], look);
  return null;
};

/** 环绕：固定半径与高度，从 fromDeg 转到 toDeg（度）。转台镜头用这个。 */
export const Orbit: React.FC<{ radius: number; height: number; fromDeg: number; toDeg: number; target?: Vec3 }> = ({
  radius,
  height,
  fromDeg,
  toDeg,
  target = [0, 0.9, 0],
}) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { camera } = useThree();
  const t = interpolate(frame, [0, Math.max(1, durationInFrames - 1)], [0, 1], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.inOut(Easing.quad),
  });
  const deg = fromDeg + (toDeg - fromDeg) * t;
  const rad = (deg * Math.PI) / 180;
  aim(camera, [Math.sin(rad) * radius, height, Math.cos(rad) * radius], target);
  return null;
};