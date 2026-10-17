import React from "react";
import { AbsoluteFill, useCurrentFrame, interpolate } from "remotion";
import { ThreeCanvas } from "@remotion/three";
import { useVideoConfig } from "remotion";

/** P1 探针：验证 headless chrome 下 WebGL(angle) 能否渲染 React Three Fiber */
export const ThreeCube: React.FC = () => {
  const frame = useCurrentFrame();
  const { width, height } = useVideoConfig();
  const rot = interpolate(frame, [0, 120], [0, Math.PI * 1.2]);
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#0B0E14,#1B2438)" }}>
      <ThreeCanvas width={width} height={height}>
        <ambientLight intensity={0.9} />
        <directionalLight position={[3, 4, 5]} intensity={2.2} />
        <mesh rotation={[0.6, rot, 0.2]}>
          <boxGeometry args={[2.6, 2.6, 2.6]} />
          <meshStandardMaterial color="#57C8B5" metalness={0.35} roughness={0.25} />
        </mesh>
      </ThreeCanvas>
    </AbsoluteFill>
  );
};
