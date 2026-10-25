import * as THREE from "three";
import React from "react";
import { AbsoluteFill, Composition, registerRoot, useCurrentFrame } from "remotion";
import { useThree } from "@react-three/fiber";
import { Canvas3D } from "../design/three/Canvas3D";
import { Ground, StudioLights } from "../design/three/lighting";
import { PALETTE, TORSO_BOTTOM, TORSO_TOP, buildTaper, buildTorso, makeMaterial } from "./loft";

const SCALE = 2.2;
const FEET_Y = 0.06;

const Pear: React.FC = () => {
  const torso = React.useMemo(() => buildTorso(), []);
  const legL = React.useMemo(() => buildTaper(0.42, FEET_Y, 0.072, 0.05, 0.088, 0, 48, 30), []);
  const legR = React.useMemo(() => buildTaper(0.42, FEET_Y, 0.072, 0.05, -0.088, 0, 48, 30), []);
  const armL = React.useMemo(() => buildTaper(0.74, 0.44, 0.044, 0.03, 0.163, 0.012, 40, 26), []);
  const armR = React.useMemo(() => buildTaper(0.74, 0.44, 0.044, 0.03, -0.163, 0.012, 40, 26), []);
  const mat = React.useMemo(() => makeMaterial(), []);
  const eyeMat = React.useMemo(
    () => new THREE.MeshPhysicalMaterial({ color: PALETTE.eye, roughness: 0.32, clearcoat: 0.7 }),
    [],
  );
  const eyeY = 0.93;
  return (
    <group position={[0, -SCALE * FEET_Y, 0]} scale={SCALE}>
      <mesh geometry={torso} material={mat} castShadow receiveShadow />
      <mesh geometry={legL} material={mat} castShadow />
      <mesh geometry={legR} material={mat} castShadow />
      <mesh geometry={armL} material={mat} castShadow />
      <mesh geometry={armR} material={mat} castShadow />
      {[0.055, -0.055].map((x) => (
        <mesh key={x} position={[x, eyeY, 0.062]} material={eyeMat} castShadow>
          <sphereGeometry args={[0.024, 24, 24]} />
        </mesh>
      ))}
      {[0.055, -0.055].map((x) => (
        <mesh key={"p" + x} position={[x, eyeY, 0.081]}>
          <sphereGeometry args={[0.0118, 18, 18]} />
          <meshStandardMaterial color={PALETTE.pupil} roughness={0.25} />
        </mesh>
      ))}
      <mesh position={[0, 0.878, 0.078]} rotation={[0.1, 0, 0]}>
        <torusGeometry args={[0.03, 0.0042, 10, 28, Math.PI * 0.9]} />
        <meshStandardMaterial color="#6b4a20" roughness={0.6} />
      </mesh>
    </group>
  );
};

const PearScene: React.FC = () => (
  <>
    <StudioLights ambient={0.55} key={2.2} rim={1.1} shadowExtent={4} />
    <Ground />
    <Pear />
  </>
);

/** 解析权重蒙皮：验证"权重能纯算出来、骨骼能变形而不撕裂"。 */
const skin = (g: THREE.BufferGeometry, bones: THREE.Bone[]) => {
  const pos = g.getAttribute("position") as THREE.BufferAttribute;
  const si: number[] = [];
  const sw: number[] = [];
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i);
    const w = bones.map((b) => Math.max(0, 1 - Math.abs(y - b.position.y) / 0.26));
    const order = w.map((v, k) => [v, k] as [number, number]).sort((a, b) => b[0] - a[0]);
    const top = order.slice(0, 4);
    const sum = top.reduce((s, t) => s + t[0], 0) || 1;
    const idx4 = [0, 0, 0, 0];
    const wt4 = [0, 0, 0, 0];
    top.forEach(([v, k], n) => {
      idx4[n] = k;
      wt4[n] = v / sum;
    });
    si.push(...idx4);
    sw.push(...wt4);
  }
  g.setAttribute("skinIndex", new THREE.Uint16BufferAttribute(si, 4));
  g.setAttribute("skinWeight", new THREE.Float32BufferAttribute(sw, 4));
  return g;
};

const Pose: React.FC = () => {
  const frame = useCurrentFrame();
  const built = React.useMemo(() => {
    const geo = skin(buildTorso(110, 110), [] as THREE.Bone[]);
    const hips = new THREE.Bone();
    hips.position.set(0, TORSO_BOTTOM, 0);
    const ys = [0.4, 0.56, 0.74, 0.9];
    const bones: THREE.Bone[] = [hips];
    let parent = hips;
    for (const y of ys) {
      const b = new THREE.Bone();
      b.position.set(0, y - parent.position.y, 0);
      parent.add(b);
      bones.push(b);
      parent = b;
    }
    hips.updateMatrixWorld(true);
    const skeleton = new THREE.Skeleton(bones);
    skin(geo, bones);
    const mesh = new THREE.SkinnedMesh(geo, makeMaterial());
    mesh.add(hips);
    mesh.bind(skeleton);
    mesh.frustumCulled = false;
    return { mesh, bones };
  }, []);

  React.useLayoutEffect(() => {
    const t = (frame / 59) * Math.PI;
    const b = built.bones;
    b[1].rotation.z = Math.sin(t) * 0.5;
    b[2].rotation.z = Math.sin(t) * 0.35;
    b[3].rotation.x = Math.sin(t) * 0.4;
    b[3].rotation.z = Math.cos(t) * 0.2;
    built.mesh.updateMatrixWorld(true);
  }, [frame, built]);

  return (
    <group position={[0, -SCALE * FEET_Y, 0]} scale={SCALE}>
      <primitive object={built.mesh} />
    </group>
  );
};

const PoseScene: React.FC = () => (
  <>
    <StudioLights ambient={0.55} key={2.2} rim={1.1} shadowExtent={4} />
    <Ground />
    <Pose />
  </>
);

/** 运镜 + 环境层：证明"同一机位也能有空间感"。 */
const Drift: React.FC = () => {
  const frame = useCurrentFrame();
  const cam = useThree((s) => s.camera);
  React.useLayoutEffect(() => {
    const k = frame / 59;
    cam.position.set(3.2 - k * 0.5, 2.0 - k * 0.35, 4.1 + k * 0.5);
    cam.lookAt(0, 1.05, 0);
    cam.updateMatrixWorld(true);
  }, [cam, frame]);
  return null;
};

const Stage: React.FC = () => (
  <>
    <StudioLights ambient={0.45} key={2.4} rim={1.4} shadowExtent={5} />
    <Ground size={40} />
    {[2.2, 3.4].map((r, i) => (
      <mesh key={r} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.002, 0]}>
        <ringGeometry args={[r, r + 0.02, 96]} />
        <meshBasicMaterial color={PALETTE.foot} transparent opacity={i === 0 ? 0.35 : 0.18} />
      </mesh>
    ))}
    <Pear />
    <Drift />
  </>
);

const Root: React.FC = () => (
  <>
    <Composition
      id="SpikePear"
      component={() => (
        <Canvas3D camera="product" background="#fbf7ef" exposure={1.05}>
          <PearScene />
        </Canvas3D>
      )}
      durationInFrames={60}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="SpikePose"
      component={() => (
        <Canvas3D camera="product" background="#fbf7ef" exposure={1.05}>
          <PoseScene />
        </Canvas3D>
      )}
      durationInFrames={60}
      fps={30}
      width={1920}
      height={1080}
    />
    <Composition
      id="SpikeStage"
      component={() => (
        <>
          <Canvas3D camera="product">
            <Stage />
          </Canvas3D>
          <AbsoluteFill style={{ pointerEvents: "none" }}>
            <div
              style={{
                position: "absolute",
                left: 80,
                bottom: 70,
                color: "#f2e7d2",
                font: "500 34px/1.4 sans-serif",
                opacity: 0.9,
              }}
            >
              放样 170×160 · 解析权重 · 同一机位也能有空间感
            </div>
          </AbsoluteFill>
        </>
      )}
      durationInFrames={60}
      fps={30}
      width={1920}
      height={1080}
    />
  </>
);

registerRoot(Root);
