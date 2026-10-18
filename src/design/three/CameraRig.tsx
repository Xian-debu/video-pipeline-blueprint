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
