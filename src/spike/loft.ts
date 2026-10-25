import * as THREE from "three";

/**
 * P0 spike 几何：把 docs/41 的"剖面放样"用 TS 重写一遍（正式版在 P3 的发射器里）。
 * 只证明两件事：① 逐环放样的数学在 three 里能直接跑；② 顶点色分区足以在没有 UV 时给出可看的分界。
 * y 轴向上：脚底 y=0，头顶 y≈1（与参考图"从上往下量"的 t 值互为 1-t）。
 */

type Pt = [number, number];

/** Catmull-Rom 过控制点，得到半径剖面 r(u)。pts 必须是 u 升序。 */
const curve = (pts: Pt[]) => (u: number) => {
  const n = pts.length;
  const x = Math.min(1, Math.max(0, u)) * (n - 1);
  const i = Math.min(n - 2, Math.floor(x));
  const f = x - i;
  const y0 = pts[Math.max(0, i - 1)][1];
  const y1 = pts[i][1];
  const y2 = pts[i + 1][1];
  const y3 = pts[Math.min(n - 1, i + 2)][1];
  const f2 = f * f;
  const f3 = f2 * f;
  return 0.5 * (2 * y1 + (-y0 + y2) * f + (2 * y0 - 5 * y1 + 4 * y2 - y3) * f2 + (-y0 + 3 * y1 - 3 * y2 + y3) * f3);
};

export const TORSO_BOTTOM = 0.3;
export const TORSO_TOP = 0.98;

/** 从裆部到头顶的半宽（u=0 裆，u=1 头顶）。 */
const WIDTH = curve([
  [0, 0.148],
  [0.12, 0.176],
  [0.3, 0.192],
  [0.45, 0.19],
  [0.62, 0.168],
  [0.78, 0.132],
  [0.9, 0.102],
  [1, 0.076],
]);
/** 前后半深略小于半宽。 */
const DEPTH = curve([
  [0, 0.132],
  [0.12, 0.158],
  [0.3, 0.172],
  [0.45, 0.17],
  [0.62, 0.15],
  [0.78, 0.118],
  [0.9, 0.092],
  [1, 0.068],
]);

/** 超椭圆指数 2.35：比方圆更"胖"，和参考图的肚子一致。 */
const E = 2 / 2.35;
const se = (c: number) => Math.sign(c) * Math.pow(Math.abs(c), E);

export const PALETTE = {
  body: new THREE.Color("#d89826"),
  belly: new THREE.Color("#f2e7d2"),
  foot: new THREE.Color("#c9a86a"),
  eye: new THREE.Color("#4fc98a"),
  pupil: new THREE.Color("#1d1a16"),
};

/** 奶白肚皮：以 (0, 0.6) 为中心的椭圆，边缘 soft 过渡（正式版会用测量值，这里只是形）。 */
const bellyMix = (x: number, y: number, z: number, a: number, b: number) => {
  if (z <= 0) return 0;
  const ex = x / (a * 0.62);
  const ey = (y - 0.6) / (b * 1.05);
  const d = Math.hypot(ex, ey);
  const front = Math.min(1, z / (b * 0.5));
  return THREE.MathUtils.smoothstep((1 - d) * front, 0.1, 0.42);
};

const pushTri = (idx: number[], a: number, b: number, c: number) => idx.push(a, b, c);

/** 躯干：rings × segs 逐环放样 + 两端扇面封口。 */
export const buildTorso = (rings = 170, segs = 160): THREE.BufferGeometry => {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  const color = new THREE.Color();
  for (let i = 0; i < rings; i++) {
    const u = i / (rings - 1);
    const y = TORSO_BOTTOM + (TORSO_TOP - TORSO_BOTTOM) * u;
    const a = WIDTH(u);
    const b = DEPTH(u);
    for (let j = 0; j < segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      const x = a * se(Math.cos(th));
      const z = b * se(Math.sin(th));
      pos.push(x, y, z);
      color.copy(PALETTE.body).lerp(PALETTE.belly, bellyMix(x, y, z, a, b));
      col.push(color.r, color.g, color.b);
    }
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a0 = i * segs + j;
      const a1 = i * segs + ((j + 1) % segs);
      const b0 = (i + 1) * segs + j;
      const b1 = (i + 1) * segs + ((j + 1) % segs);
      pushTri(idx, a0, b0, b1);
      pushTri(idx, a0, b1, a1);
    }
  }
  // 封口：底面朝下、顶面朝上
  const bot = pos.length / 3;
  pos.push(0, TORSO_BOTTOM, 0);
  color.copy(PALETTE.body);
  col.push(color.r, color.g, color.b);
  for (let j = 0; j < segs; j++) pushTri(idx, bot, j, (j + 1) % segs);
  const top = pos.length / 3;
  pos.push(0, TORSO_TOP, 0);
  col.push(color.r, color.g, color.b);
  const base = (rings - 1) * segs;
  for (let j = 0; j < segs; j++) pushTri(idx, top, base + ((j + 1) % segs), base + j);
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** 锥台（腿/手臂共用）：从站着的一端 yTop 到 yBottom，可给端点封口。 */
export const buildTaper = (
  yTop: number,
  yBottom: number,
  rTop: number,
  rBottom: number,
  x: number,
  z = 0,
  segs = 48,
  rings = 40,
): THREE.BufferGeometry => {
  const pos: number[] = [];
  const col: number[] = [];
  const idx: number[] = [];
  for (let i = 0; i < rings; i++) {
    const v = i / (rings - 1);
    const y = yTop + (yBottom - yTop) * v;
    const r = rTop + (rBottom - rTop) * v;
    for (let j = 0; j < segs; j++) {
      const th = (j / segs) * Math.PI * 2;
      pos.push(x + r * Math.cos(th), y, z + r * Math.sin(th));
      col.push(PALETTE.body.r, PALETTE.body.g, PALETTE.body.b);
    }
  }
  for (let i = 0; i < rings - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a0 = i * segs + j;
      const a1 = i * segs + ((j + 1) % segs);
      const b0 = (i + 1) * segs + j;
      const b1 = (i + 1) * segs + ((j + 1) % segs);
      pushTri(idx, a0, a1, b1);
      pushTri(idx, a0, b1, b0);
    }
  }
  const all = pos.length / 3;
  // 两端封口
  const topC = all;
  pos.push(x, yTop, z);
  col.push(PALETTE.body.r, PALETTE.body.g, PALETTE.body.b);
  for (let j = 0; j < segs; j++) pushTri(idx, topC, (j + 1) % segs, j);
  const botC = all + 1;
  pos.push(x, yBottom, z);
  col.push(PALETTE.body.r, PALETTE.body.g, PALETTE.body.b);
  const b0 = (rings - 1) * segs;
  for (let j = 0; j < segs; j++) pushTri(idx, botC, b0 + j, b0 + ((j + 1) % segs));
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
};

/** 材质：顶点色 + 轻清漆，让"黄皮"在三点光下是塑料感而不是粉笔感。 */
export const makeMaterial = () =>
  new THREE.MeshPhysicalMaterial({
    vertexColors: true,
    roughness: 0.55,
    metalness: 0,
    clearcoat: 0.3,
    clearcoatRoughness: 0.45,
  });
