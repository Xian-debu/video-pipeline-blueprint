import React, { useLayoutEffect, useMemo } from "react";
import { useCurrentFrame } from "remotion";
import { useThree } from "@react-three/fiber";
import * as THREE from "three";
import { clone as cloneSkeleton } from "three/examples/jsm/utils/SkeletonUtils.js";
import { BONES, HEIGHT, SPEC, clipFrame, poseAt, type ClipName } from "./clips";

/**
 * 角色渲染器：把 GLB 里的蒙皮网格 + 解析出来的动作数据变成画面。
 *
 * 三件事必须在这里做对，否则画面会错但门禁看不出来：
 *
 * 1. **克隆要带骨架**。THREE.Object3D.clone() 不重绑 skeleton，克隆出来的
 *    SkinnedMesh 会跟着**源**骨骼动（或者直接摊平）。所以用 SkeletonUtils.clone。
 * 2. **肚皮斑块必须是"静止坐标"的解析遮罩**。GLB 里奶油色是 Blender 材质节点上的
 *    遮罩，导出时丢了（只剩一份全白的 COLOR_0）；如果改用物体坐标采样，蒙皮之后
 *    斑块会随形变滑到背上去（K88）。这里注入的 fragment 用的是顶点属性 position，
 *    也就是**绑定姿势**的坐标，任何姿势下都焊在皮肤上。
 * 3. **rest 四元数要留底**。anim.json 存的是增量，骨骼上已经是 rest 值；直接
 *    q.multiply(delta) 会一帧一帧累积。第一次应用时把 rest 抄进 userData。
 *
 * 成片另外要三个"看得见结构"的显示模式（mode）与一个生长裁剪面（grow），
 * 都只改材质/裁剪，不改几何 —— 画面里的模型永远是 GLB 里那一个。
 */

// spec 里的颜色是**线性** RGB（Blender base_color 直接搬过来），所以不能再按 sRGB 解码一次：
// 第一次渲染全身发褐就是多解了一层的症状（线性 0.82/0.50/0.045 应是金黄，不是褐色）。
const lin = (c: number[]) => new THREE.Color().setRGB(c[0], c[1], c[2]);

const PATCH_FRAG_HEAD = [
  "varying vec3 vRest;",
  "uniform vec3 uYellow;",
  "uniform vec3 uCream;",
  "uniform vec4 uPatch;",
].join("\n");

// 奶油斑块：与 scripts/char/gen.py 的 patch_factor() 是同一个函数（rest 坐标）。
const PATCH_FRAG_BODY = [
  "  float pz = uPatch.x;",
  "  float prx = uPatch.y;",
  "  float prz = uPatch.z;",
  "  float px = vRest.x / prx;",
  "  float py = (vRest.y - pz) / prz;",
  "  float pr = clamp((1.0 - px * px - py * py) / uPatch.w, 0.0, 1.0);",
  "  float pg = clamp((0.005 + vRest.z) / 0.025, 0.0, 1.0);",
  "  diffuseColor.rgb = mix(uYellow, uCream, pr * pg);",
].join("\n");

const makePatched = (
  base: THREE.MeshStandardMaterial,
  palette: { yellow: THREE.Color; cream: THREE.Color },
  patch: { t: number; rx: number; rz: number }
) => {
  const m = base.clone();
  const z0 = 1 - patch.t;
  m.onBeforeCompile = (shader) => {
    shader.uniforms.uYellow = { value: palette.yellow };
    shader.uniforms.uCream = { value: palette.cream };
    shader.uniforms.uPatch = { value: new THREE.Vector4(z0, patch.rx, patch.rz, 0.1) };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vRest;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\n  vRest = position;");
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\n" + PATCH_FRAG_HEAD)
      .replace("#include <color_fragment>", "#include <color_fragment>\n" + PATCH_FRAG_BODY);
  };
  // 同一份着色器能配不同 uniform，但 three 按 cacheKey 复用编译结果：
  // 颜色写进 key，换色时才重新编译，否则会拿到上一个颜色的程序。
  m.customProgramCacheKey = () => "swift-patch-" + palette.yellow.getHexString() + "-" + palette.cream.getHexString();
  return m;
};

const ROUGH: Record<string, number> = {
  BodyMask: 0.6,
  BodyYellow: 0.6,
  FootTan: 0.62,
  HandGrey: 0.55,
  EyeGreen: 0.28,
  Pupil: 0.18,
  MouthDark: 0.6,
};

/** 权重彩图用的色相序列（按骨骼次序循环）。 */
const BONE_HUES = [0.02, 0.1, 0.16, 0.3, 0.38, 0.46, 0.55, 0.62, 0.68, 0.75, 0.82, 0.88, 0.92, 0.96, 0.05, 0.35];

/**
 * 生长：把 y 超过 uCut 的顶点压到 uCut 平面上（顶点着色器里 min 一下），**不裁剪**。
 *
 * 为什么不用 clippingPlanes：裁掉上半身会露出空心的内壁（"碗"），眼睛和肚皮的反面
 * 直接穿帮。压平则把上半身折叠成一张贴着切面的盖，从任何机位看都是一个实心断面。
 * 代价是切面上方那一圈法线不重算，光会略平 —— 这在"逐环生长"的镜头里反而是想要的。
 */
const CUT_UNIFORM = "uCut";

const injectCut = (m: THREE.Material | undefined, store: Map<THREE.Material, { value: number }>) => {
  if (!m) {
    // 有些节点（如未挂载材质的占位 Mesh）没有 material：跳过，别让生长镜头整帧失败。
    if (typeof console !== "undefined") console.warn("injectCut: mesh without material");
    return null;
  }
  if (store.has(m)) return store.get(m)!;
  const u = { value: 1e3 };
  const anyMat = m as unknown as { onBeforeCompile?: (s: any) => void; customProgramCacheKey?: () => string };
  const prevOBC = anyMat.onBeforeCompile;
  // 读默认实现时必须绑定 this：three 的 Material.prototype.customProgramCacheKey
  // 内部是 this.onBeforeCompile.toString()，裸函数调用会 this=undefined 直接炸。
  const prevKeyStr = anyMat.customProgramCacheKey ? anyMat.customProgramCacheKey.call(m) : "swift";
  anyMat.onBeforeCompile = (shader: any) => {
    if (prevOBC) prevOBC.call(m, shader);
    shader.uniforms[CUT_UNIFORM] = u;
    shader.vertexShader =
      "uniform float " + CUT_UNIFORM + ";\n" +
      shader.vertexShader.replace(
        "#include <skinning_vertex>",
        "#include <skinning_vertex>\n  float over = max(transformed.y - " + CUT_UNIFORM + ", 0.0);\n  transformed.y = min(transformed.y, " + CUT_UNIFORM + " + over * 0.02);"
      );
  };
  anyMat.customProgramCacheKey = () => prevKeyStr + "-cut";
  m.needsUpdate = true;
  store.set(m, u);
  return u;
};

export type SwiftMode = "shaded" | "wire" | "weights" | "bones";

export type SwiftProps = {
  /** useGltf 载入的原始场景图（画布外，K20）。 */
  source: THREE.Group;
  clip: ClipName;
  /** 片段内的帧（不是影片帧）；不给就按 start/speed 从影片帧映射。 */
  frame?: number;
  start?: number;
  speed?: number;
  /** 调色：默认 yellow；mint/plum 来自 spec.palette.variants。 */
  tint?: string | number[];
  /** 整体缩放：glb 身高 1.0，场景里通常要 1.7 左右。 */
  scale?: number;
  position?: [number, number, number];
  /** root 的额外位移（片段自身的前进量之外）。 */
  offset?: [number, number, number];
  /** 显示模式：着色 / 线框 / 权重彩图 / 骨架。 */
  mode?: SwiftMode;
  /** 生长裁剪：世界坐标下可见的上限高度（米）；不给就是完整模型。 */
  grow?: number;
  /** 模型自身偏航（度），转台用。 */
  spin?: number;
};

export const Swift: React.FC<SwiftProps> = ({
  source,
  clip,
  frame,
  start = 0,
  speed = 1,
  tint = "yellow",
  scale = 1,
  position = [0, 0, 0],
  offset = [0, 0, 0],
  mode = "shaded",
  grow,
  spin = 0,
}) => {
  const filmFrame = useCurrentFrame();
  const f = frame ?? clipFrame(clip, filmFrame, start, speed);
  const key = poseAt(clip, f);
  const gl = useThree((s) => s.gl);

  const palette = useMemo(() => {
    const p = SPEC.palette;
    const variant = typeof tint === "string" ? p.variants[tint] ?? p.yellow : tint;
    return {
      yellow: lin(variant),
      cream: lin(p.cream),
      tan: lin(p.tan),
      grey: lin(p.grey),
      eye: lin(p.eye),
    };
  }, [tint]);

  const root = useMemo(() => {
    const r = cloneSkeleton(source);
    r.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone) {
        b.userData.restQ = b.quaternion.clone();
        b.userData.restP = b.position.clone();
      }
    });
    r.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const mat = (Array.isArray(mesh.material) ? mesh.material[0] : mesh.material) as THREE.MeshStandardMaterial;
      const name = mat?.name ?? "";
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      if (name === "BodyMask") {
        mesh.material = makePatched(mat, palette, SPEC.patch);
      } else if (name === "BodyYellow") {
        const m = mat.clone();
        m.color = palette.yellow;
        mesh.material = m;
      } else {
        const m = mat.clone();
        m.roughness = ROUGH[name] ?? m.roughness;
        if (name === "FootTan") m.color = palette.tan;
        if (name === "HandGrey") m.color = palette.grey;
        if (name === "EyeGreen") m.color = palette.eye;
        mesh.material = m;
      }
    });
    return r;
  }, [source, palette]);

  const bones = useMemo(() => {
    const map: Record<string, THREE.Bone> = {};
    root.traverse((o) => {
      const b = o as THREE.Bone;
      if (b.isBone) map[b.name] = b;
    });
    return map;
  }, [root]);

  // 逐帧写骨骼：rest * delta（不累积）。root 再叠片段自己的位移。
  const tmp = useMemo(() => new THREE.Quaternion(), []);
  for (const name of BONES) {
    const b = bones[name];
    if (!b) continue;
    const restQ = (b.userData.restQ as THREE.Quaternion | undefined) ?? b.quaternion.clone();
    const dq = key.q[name];
    if (dq) {
      tmp.set(dq[0], dq[1], dq[2], dq[3]);
      b.quaternion.copy(restQ).multiply(tmp);
    } else {
      b.quaternion.copy(restQ);
    }
    if (name === "root") {
      const restP = (b.userData.restP as THREE.Vector3 | undefined) ?? new THREE.Vector3();
      b.position.set(restP.x + key.t[0] + offset[0], restP.y + key.t[1] + offset[1], restP.z + key.t[2] + offset[2]);
    }
  }

  // ---- 权重彩图：从 skinIndex/skinWeight 直接算顶点色（不靠渲染器扩展） ----
  useMemo(() => {
    if (mode !== "weights") return;
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const g = mesh.geometry as THREE.BufferGeometry;
      const si = g.getAttribute("skinIndex");
      const sw = g.getAttribute("skinWeight");
      if (!si || !sw || g.getAttribute("color")) return;
      const n = si.count;
      const arr = new Float32Array(n * 3);
      const c = new THREE.Color();
      for (let i = 0; i < n; i++) {
        let best = 0;
        let bw = -1;
        for (let k = 0; k < 4; k++) {
          const w = sw.getComponent(i, k);
          if (w > bw) {
            bw = w;
            best = si.getComponent(i, k);
          }
        }
        c.setHSL(BONE_HUES[best % BONE_HUES.length], 0.7, 0.34 + 0.3 * Math.min(1, bw));
        arr[i * 3] = c.r;
        arr[i * 3 + 1] = c.g;
        arr[i * 3 + 2] = c.b;
      }
      g.setAttribute("color", new THREE.BufferAttribute(arr, 3));
    });
  }, [root, mode]);

  const cutStore = useMemo(() => new Map<THREE.Material, { value: number }>(), []);
  const wireFill = useMemo(
    () => new THREE.MeshBasicMaterial({ wireframe: true, color: "#6ff3e2", transparent: true, opacity: 0.5 }),
    []
  );
  const weightMat = useMemo(
    () => new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.5, metalness: 0 }),
    []
  );

  useLayoutEffect(() => {
    // 模型空间里的切面高度：世界坐标 grow 除以 (scale / HEIGHT)。
    const cutModel = grow === undefined ? 1e3 : grow / (scale / HEIGHT);
    root.traverse((o) => {
      const mesh = o as THREE.Mesh;
      if (!mesh.isMesh) return;
      const orig = (mesh.userData.origMat as THREE.Material | undefined) ?? (mesh.material as THREE.Material);
      mesh.userData.origMat = orig;
      mesh.material = mode === "wire" ? wireFill : mode === "weights" ? weightMat : orig;
      const m = mesh.material as THREE.Material | undefined;
      const u = injectCut(m, cutStore);
      if (u) {
        if (u.value !== cutModel) u.value = cutModel;
        m!.needsUpdate = true;
      }
    });
  }, [root, mode, grow, scale, cutStore, wireFill, weightMat]);


  const helper = useMemo(() => {
    if (mode !== "bones") return null;
    const h = new THREE.SkeletonHelper(root);
    const hm = h.material as THREE.LineBasicMaterial;
    hm.color = new THREE.Color("#8ef8ff");
    hm.transparent = true;
    hm.opacity = 0.95;
    hm.depthTest = false;
    return h;
  }, [root, mode]);

  return (
    <group rotation={[0, (spin * Math.PI) / 180, 0]}>
      <primitive object={root} position={position} scale={scale / HEIGHT} />
      {helper ? <primitive object={helper} /> : null}
    </group>
  );
};
