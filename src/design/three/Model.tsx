import React, { useEffect, useMemo, useState } from "react";
import { cancelRender, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import * as THREE from "three";
import { GLTFLoader } from "three/examples/jsm/loaders/GLTFLoader.js";
import { makeMaterial, PAL, type MaterialPreset } from "./materials";

/**
 * 载入 glTF 并交出场景图。**在画布外调用**。
 *
 * 为什么不在画布里面加载：@remotion/three 的 ThreeCanvas 在渲染时把 R3F 的
 * frameloop 设为 "never"，只在帧号变化时手动 advance 一次。画布挂载之后才异步
 * 到达的模型不会触发重绘，于是每帧都渲出一张「有地面、没有模型」的空场景——
 * 而且它是确定性的，门禁和静帧都看不出来（静帧里地面已经占了 12% 覆盖率）。
 *
 * 所以模型必须在画布出现之前就绪：本 hook 用 delayRender 拦住取帧，等到模型
 * 解析完成后，调用方再挂载画布；画布第一次 advance 时模型已经在场景里。
 */
export const useGltf = (url: string): THREE.Group | null => {
  const [scene, setScene] = useState<THREE.Group | null>(null);
  useEffect(() => {
    const handle = delayRender("loading glTF " + url);
    let settled = false;
    // staticFile 不是可有可无的装饰：路径要带上页面注入的静态前缀（/public/…），
    // 直接把 "models/x.glb" 交给 loader 会请求 /models/x.glb 并 404。
    new GLTFLoader().load(
      staticFile(url),
      (gltf) => {
        settled = true;
        setScene(gltf.scene);
        continueRender(handle);
      },
      undefined,
      (err) => {
        settled = true;
        cancelRender(new Error("glTF failed to load: " + url + " — " + String(err)));
      }
    );
    return () => {
      if (!settled) continueRender(handle);
    };
  }, [url]);
  return scene;
};

/** 归一化 + 材质覆盖 + 法线补齐（雕刻网格常常没有平滑法线，会出台阶）。 */
export const prepare = (source: THREE.Group, height: number, preset: MaterialPreset, color: string): THREE.Group => {
  const root = source.clone(true);
  root.updateMatrixWorld(true);
  const box = new THREE.Box3().setFromObject(root);
  const size = new THREE.Vector3();
  box.getSize(size);
  const scale = height / Math.max(size.y, 1e-6);
  const center = new THREE.Vector3();
  box.getCenter(center);
  const wrapper = new THREE.Group();
  root.scale.setScalar(scale);
  root.position.set(-center.x * scale, -box.min.y * scale, -center.z * scale);
  wrapper.add(root);
  wrapper.traverse((o) => {
    const mesh = o as THREE.Mesh;
    if (!mesh.isMesh) return;
    const g = mesh.geometry as THREE.BufferGeometry;
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.material = makeMaterial(preset, color);
  });
  return wrapper;
};

/** 一个已就绪的模型：接收场景图（不是地址），因此不涉及任何异步。 */
export const Model: React.FC<{
  source: THREE.Group;
  height?: number;
  material?: MaterialPreset;
  color?: string;
  y?: number;
  /** 每秒转多少弧度（帧驱动，不用真实时钟）。 */
  spin?: number;
  /**
   * 叠一层线框。扫描/雕刻资产的面密度不均匀，平滑法线会在粗三角形上留下
   * 可见的环状明暗带；线框把这层"网格本身"变成刻意展示的信息，而不是
   * 假装它是抛光塑料。
   */
  wireframe?: boolean;
  wireframeColor?: string;
}> = ({ source, height = 2, material = "matte", color = PAL.paper, y = 0, spin = 0, wireframe = false, wireframeColor = "#7ee0c8" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const obj = useMemo(() => {
    const prepared = prepare(source, height, material, color);
    if (wireframe) {
      // 先收集再挂载：traverse 期间往树里加节点会让遍历无限深入（子节点也会被遍历）。
      const meshes: THREE.Mesh[] = [];
      prepared.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.isMesh) meshes.push(mesh);
      });
      for (const mesh of meshes) {
        const overlay = new THREE.Mesh(
          mesh.geometry,
          new THREE.MeshBasicMaterial({ color: wireframeColor, wireframe: true, transparent: true, opacity: 0.28 })
        );
        overlay.scale.setScalar(1.001);
        mesh.add(overlay);
      }
    }
    return prepared;
  }, [source, height, material, color, wireframe, wireframeColor]);
  return <primitive object={obj} position={[0, y, 0]} rotation={[0, (frame / fps) * spin, 0]} />;
};