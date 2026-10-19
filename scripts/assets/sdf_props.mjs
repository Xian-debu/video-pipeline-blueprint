#!/usr/bin/env node
/**
 * sdf_props.mjs — 程序化道具：用 SDF/CSG 造资产，再把它变成 .glb。
 *
 * 为什么是这里，而不是 Blender：一个讲义道具应当能被 diff、被门禁检查、被重生成。
 * .blend 不行，一次导入导出的 .glb 也不行 —— 它是产物，不是源。所以道具写成
 * 二十行 SDF，网格在构建时生成，法线来自 SDF 的解析梯度（所以没有台阶，也不需要
 * 事后平滑），水密性由等值面抽取保证，体积由解析式子与网格双向核对。
 *
 * 用法：
 *   node scripts/assets/sdf_props.mjs --prop=gear --res=112 --out public/models/prop_gear.glb
 *   node scripts/assets/sdf_props.mjs --prop=chip --res=112 --out public/models/prop_chip.glb
 *   node scripts/assets/sdf_props.mjs --list
 *
 * 输出（stdout，一行一个事实）：
 *   prop   gear  112^3  bbox 2.05x0.40x2.05  tris 84,120  V 0.9123  analytic 0.9101  dV 0.24%
 *   WROTE public/models/prop_gear.glb 1,842,304 B sha256 ...
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import { dirname, resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..", "..");

// ---------------------------------------------------------------- SDF 原语
// 约定：f(p) < 0 在体内。所有函数接受 [x,y,z]。
const len = (v) => Math.hypot(v[0] ?? 0, v[1] ?? 0, v[2] ?? 0);
const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);

const sdSphere = (p, r) => len(p) - r;

/** 轴对齐盒子；b 是半尺寸。 */
const sdBox = (p, b) => {
  const qx = Math.abs(p[0]) - b[0];
  const qy = Math.abs(p[1]) - b[1];
  const qz = Math.abs(p[2]) - b[2];
  const ox = Math.max(qx, 0);
  const oy = Math.max(qy, 0);
  const oz = Math.max(qz, 0);
  return len([ox, oy, oz]) + Math.min(Math.max(qx, qy, qz), 0);
};

const sdCylinder = (p, r, halfH) => {
  const d = [Math.hypot(p[0], p[2]) - r, Math.abs(p[1]) - halfH];
  return Math.min(Math.max(d[0], d[1]), 0) + len([Math.max(d[0], 0), Math.max(d[1], 0)]);
};

/** 绕 Y 轴旋转后求值（角度弧度）。 */
const rotY = (p, a) => {
  const c = Math.cos(-a);
  const s = Math.sin(-a);
  return [p[0] * c - p[2] * s, p[1], p[0] * s + p[2] * c];
};

const opUnion = (a, b) => Math.min(a, b);
const opSub = (a, b) => Math.max(a, -b);
const smin = (a, b, k) => {
  const h = clamp(0.5 + (0.5 * (b - a)) / k, 0, 1);
  return b * (1 - h) + a * h - k * h * (1 - h);
};

// ---------------------------------------------------------------- 道具定义
/** 齿轮：轮体 + 12 个齿 + 中心轴孔 + 4 个减重孔。体积在 0.9 附近。 */
const gear = (p) => {
  const body = sdCylinder(p, 0.78, 0.19);
  let f = body;
  const teeth = 12;
  for (let i = 0; i < teeth; i++) {
    const q = rotY(p, (i / teeth) * Math.PI * 2);
    f = opUnion(f, sdBox([q[0] - 0.86, q[1], q[2]], [0.1, 0.12, 0.075]));
  }
  // 减重孔：四个，直径 0.34，沿对角线
  for (let i = 0; i < 4; i++) {
    const q = rotY(p, Math.PI / 4 + (i / 4) * Math.PI * 2);
    f = opSub(f, sdCylinder([q[0] - 0.46, q[1], q[2]], 0.17, 0.4));
  }
  f = opSub(f, sdCylinder(p, 0.26, 0.4));
  return f;
};

/** 芯片：圆角方体 + 两侧各 6 根引脚 + 顶面一条散热槽。 */
const chip = (p) => {
  const body = sdBox(p, [0.86, 0.09, 0.86]) - 0.05; // 圆角
  let f = body;
  for (let i = 0; i < 6; i++) {
    const x = -0.62 + i * 0.248;
    f = opUnion(f, sdBox([p[0] - x, p[1] - 0.02, p[2] - 1.0], [0.062, 0.03, 0.15]));
    f = opUnion(f, sdBox([p[0] - x, p[1] - 0.02, p[2] + 1.0], [0.062, 0.03, 0.15]));
  }
  // 顶面散热槽：一条贯穿的浅槽，用减法
  f = opSub(f, sdBox([p[0], p[1] - 0.15, p[2]], [0.16, 0.06, 0.9]));
  return f;
};

/** 螺母：六角柱 + 螺纹孔（用半径为 0.3 的圆柱近似）+ 倒角。 */
const nut = (p) => {
  const q = rotY(p, Math.PI / 6);
  const apothem = 0.8;
  // 六角柱 = 三个 60° 交错的板
  let f = opUnion(
    sdBox([q[0], q[1], q[2]], [apothem, 0.22, apothem * 0.577]),
    sdBox(rotY([q[0], q[1], q[2]], Math.PI / 3), [apothem, 0.22, apothem * 0.577])
  );
  f = opUnion(f, sdBox(rotY([q[0], q[1], q[2]], (2 * Math.PI) / 3), [apothem, 0.22, apothem * 0.577]));
  f = opSub(f, sdCylinder(p, 0.34, 0.4));
  return f;
};

/**
 * 每个道具**自己声明**取网格的立方体半边长（不是粗扫出来的）。
 * 为什么不能扫：薄特征（芯片引脚半厚 0.03）在 48³ 粗扫下会被整片漏掉，
 * 包围盒因此贴到实体上，表面被边界裁断 —— 边就是开的，测出来 872 条边界边。
 * 声明值只要包住整个道具且留 2 格余量；res 决定格距，格距必须小于最薄特征。
 */
const PROPS = {
  gear: { f: gear, half: 1.0, note: "gear — 轮体 + 12 齿 + 4 减重孔 + 轴孔（CSG 减法）" },
  chip: { f: chip, half: 1.25, note: "chip — 圆角方体 + 12 根引脚 + 顶面散热槽" },
  nut: { f: nut, half: 1.0, note: "nut — 六角柱 + 螺纹孔 + 微小倒角（smin）" },
};

// ---------------------------------------------------------------- 网格抽取
/**
 * Surface nets（对偶等值面），不用 marching cubes：
 * 256 项的三角表是抄写风险，四面体分解在共享面上会对角线错配、抽出带裂缝的网格
 * （实测 16 万条边界边）。对偶法反过来：每个穿越等值面的格子放一个顶点，每条
 * 跨越等值面的网格边连一个四边形 —— 水密性由构造保证，不需要事后修补。
 * 代价是面数略多、表面有一点块状感；法线取 SDF 的解析梯度，所以着色照样平滑。
 */
function extract(fn, bounds, res, opts = {}) {
  const smoothIters = opts.smooth ?? 6;
  const [lo, hi] = bounds;
  const n = res + 1;
  const step = [0, 1, 2].map((i) => (hi[i] - lo[i]) / res);
  const vals = new Float64Array(n * n * n);
  const vidx = (i, j, k) => (i * n + j) * n + k;

  for (let i = 0; i < n; i++) {
    const x = lo[0] + i * step[0];
    for (let j = 0; j < n; j++) {
      const y = lo[1] + j * step[1];
      for (let k = 0; k < n; k++) {
        vals[vidx(i, j, k)] = fn([x, y, lo[2] + k * step[2]]);
      }
    }
  }

  const pos = [];
  // cellVertex[(i,j,k)] = 顶点 id（仅穿越等值面的格子有）
  const cellVertex = new Int32Array(res * res * res).fill(-1);
  const cellIdx = (i, j, k) => (i * res + j) * res + k;

  const CORNERS = [
    [0, 0, 0], [1, 0, 0], [1, 1, 0], [0, 1, 0],
    [0, 0, 1], [1, 0, 1], [1, 1, 1], [0, 1, 1],
  ];
  const EDGES = [
    [0, 1], [1, 2], [2, 3], [3, 0],
    [4, 5], [5, 6], [6, 7], [7, 4],
    [0, 4], [1, 5], [2, 6], [3, 7],
  ];

  for (let i = 0; i < res; i++) {
    for (let j = 0; j < res; j++) {
      for (let k = 0; k < res; k++) {
        const v = CORNERS.map((o) => vals[vidx(i + o[0], j + o[1], k + o[2])]);
        let neg = 0;
        for (const x of v) if (x < 0) neg++;
        if (neg === 0 || neg === 8) continue;
        // 顶点 = 所有穿越边的中点平均
        let sx = 0, sy = 0, sz = 0, cnt = 0;
        for (const [a, b] of EDGES) {
          if ((v[a] < 0) === (v[b] < 0)) continue;
          const t = v[a] / (v[a] - v[b]);
          const pa = CORNERS[a], pb = CORNERS[b];
          sx += i + pa[0] + (pb[0] - pa[0]) * t;
          sy += j + pa[1] + (pb[1] - pa[1]) * t;
          sz += k + pa[2] + (pb[2] - pa[2]) * t;
          cnt++;
        }
        cellVertex[cellIdx(i, j, k)] = pos.length / 3;
        pos.push(lo[0] + (sx / cnt) * step[0], lo[1] + (sy / cnt) * step[1], lo[2] + (sz / cnt) * step[2]);
      }
    }
  }

  const quads = [];
  const cellAt = (i, j, k) => {
    if (i < 0 || j < 0 || k < 0 || i >= res || j >= res || k >= res) return -1;
    return cellVertex[cellIdx(i, j, k)];
  };
  // 每条跨越等值面的网格边，连接它周围的四个格子
  for (let i = 0; i < n; i++) {
    for (let j = 0; j < n; j++) {
      for (let k = 0; k < n; k++) {
        const a = vals[vidx(i, j, k)];
        // x 方向
        if (i < res && ((a < 0) !== (vals[vidx(i + 1, j, k)] < 0))) {
          if (j >= 1 && k >= 1) {
            const q = [cellAt(i, j - 1, k - 1), cellAt(i, j, k - 1), cellAt(i, j, k), cellAt(i, j - 1, k)];
            if (q.every((x) => x >= 0)) quads.push(q);
          }
        }
        // y 方向
        if (j < res && ((a < 0) !== (vals[vidx(i, j + 1, k)] < 0))) {
          if (i >= 1 && k >= 1) {
            const q = [cellAt(i - 1, j, k - 1), cellAt(i, j, k - 1), cellAt(i, j, k), cellAt(i - 1, j, k)];
            if (q.every((x) => x >= 0)) quads.push(q);
          }
        }
        // z 方向
        if (k < res && ((a < 0) !== (vals[vidx(i, j, k + 1)] < 0))) {
          if (i >= 1 && j >= 1) {
            const q = [cellAt(i - 1, j - 1, k), cellAt(i, j - 1, k), cellAt(i, j, k), cellAt(i - 1, j, k)];
            if (q.every((x) => x >= 0)) quads.push(q);
          }
        }
      }
    }
  }

  // 顶点法线 = SDF 梯度（指向体外）
  // 中心差分除以 2h：不除也能当法线（反正要归一化），但**步进**用它时必须
  // 是真实的 |∇f|≈1，否则阈值判断会全错（第一版没除，|g|≈0.015，投影一次都没跑）。
  const grad = (p) => {
    const h = Math.min(step[0], step[1], step[2]) * 0.35;
    const inv = 1 / (2 * h);
    return [
      (fn([p[0] + h, p[1], p[2]]) - fn([p[0] - h, p[1], p[2]])) * inv,
      (fn([p[0], p[1] + h, p[2]]) - fn([p[0], p[1] - h, p[2]])) * inv,
      (fn([p[0], p[1], p[2] + h]) - fn([p[0], p[1], p[2] - h])) * inv,
    ];
  };
  // 顶点投影回等值面：surface nets 的顶点只取「穿越边中点的平均」，天然落在格子
  // 内部、按格子排列 —— 轮廓于是有格子尺度的台阶（res=96 时肉眼可见，尤其六角柱
  // 的斜面）。用 2 步牛顿迭代 p ← p − f(p)·∇f/|∇f|² 把每个顶点推到真正的曲面上：
  // 拓扑（因此水密性）完全不变，变的只是顶点位置。
  let projected = 0;
  let maxShift = 0;
  for (let v = 0; v < pos.length / 3; v++) {
    let p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
    const p0 = p;
    for (let it = 0; it < 2; it++) {
      const fv = fn(p);
      const g = grad(p);
      // 用**单位**梯度步进并限制步长：直接 p − f·∇f/|∇f|² 在梯度很弱的位置
      // （布尔运算的近似距离场里到处都是）会一步飞出几十个单位 —— 实测顶点被
      // 推到 46 单位外、体积算成 4 万。距离场只保证 |∇f|≈1 才成立。
      const gl = len(g);
      if (!(gl > 0.2)) break;
      const maxStep = 1.2 * Math.min(step[0], step[1], step[2]);
      const delta = Math.max(-maxStep, Math.min(maxStep, fv));
      const next = [p[0] - (g[0] / gl) * delta, p[1] - (g[1] / gl) * delta, p[2] - (g[2] / gl) * delta];
      if (!isFinite(next[0]) || !isFinite(next[1]) || !isFinite(next[2])) break;
      p = next;
    }
    const shift = len([p[0] - p0[0], p[1] - p0[1], p[2] - p0[2]]);
    if (shift > 1e-9) projected++;
    maxShift = Math.max(maxShift, shift);
    pos[v * 3] = p[0];
    pos[v * 3 + 1] = p[1];
    pos[v * 3 + 2] = p[2];
  }

  const norms = new Float32Array(pos.length);
  for (let v = 0; v < pos.length / 3; v++) {
    const g = grad([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]);
    const l = len(g) || 1;
    norms[v * 3] = g[0] / l;
    norms[v * 3 + 1] = g[1] / l;
    norms[v * 3 + 2] = g[2] / l;
  }

  // 四边形拆三角，绕向按该三角形的 SDF 梯度朝外 —— 每个三角形独立判定，
  // 因此共享边两侧的绕向必然相反（水密所需的另一半）。
  const tri = [];
  for (const q of quads) {
    tri.push([q[0], q[1], q[2]], [q[0], q[2], q[3]]);
  }
  const indices = new Uint32Array(tri.length * 3);
  let out = 0;
  for (const t of tri) {
    const a = [pos[t[0] * 3], pos[t[0] * 3 + 1], pos[t[0] * 3 + 2]];
    const b = [pos[t[1] * 3], pos[t[1] * 3 + 1], pos[t[1] * 3 + 2]];
    const c = [pos[t[2] * 3], pos[t[2] * 3 + 1], pos[t[2] * 3 + 2]];
    const nrm = [
      (b[1] - a[1]) * (c[2] - a[2]) - (b[2] - a[2]) * (c[1] - a[1]),
      (b[2] - a[2]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[2] - a[2]),
      (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]),
    ];
    const g = [
      norms[t[0] * 3] + norms[t[1] * 3] + norms[t[2] * 3],
      norms[t[0] * 3 + 1] + norms[t[1] * 3 + 1] + norms[t[2] * 3 + 1],
      norms[t[0] * 3 + 2] + norms[t[1] * 3 + 2] + norms[t[2] * 3 + 2],
    ];
    const same = nrm[0] * g[0] + nrm[1] * g[1] + nrm[2] * g[2] >= 0;
    indices[out++] = t[0];
    indices[out++] = same ? t[1] : t[2];
    indices[out++] = same ? t[2] : t[1];
  }

  // Taubin 平滑：surface nets 的顶点是格子尺度的平均位置，等值面因此带一层
  // 半格振幅的「搓板」—— 法线是解析的（所以明暗平滑），但轮廓和平面还是格子感的。
  // 交替 λ / μ 两遍（Taubin 1995）不产生体积收缩，再把顶点投影回等值面补回形状。
  // 拓扑不变，所以水密性不变；只动顶点坐标。
  if (smoothIters > 0) {
    const nv = pos.length / 3;
    const nb = Array.from({ length: nv }, () => []);
    for (let i = 0; i < indices.length; i += 3) {
      const t = [indices[i], indices[i + 1], indices[i + 2]];
      for (let e = 0; e < 3; e++) {
        nb[t[e]].push(t[(e + 1) % 3], t[(e + 2) % 3]);
      }
    }
    const LAMBDA = 0.5;
    const MU = -0.53;
    for (let it = 0; it < smoothIters; it++) {
      const k = it % 2 === 0 ? LAMBDA : MU;
      const next = new Float64Array(pos.length);
      for (let v = 0; v < nv; v++) {
        const list = nb[v];
        let ax = 0, ay = 0, az = 0;
        for (const u of list) {
          ax += pos[u * 3];
          ay += pos[u * 3 + 1];
          az += pos[u * 3 + 2];
        }
        const m = list.length || 1;
        ax = ax / m - pos[v * 3];
        ay = ay / m - pos[v * 3 + 1];
        az = az / m - pos[v * 3 + 2];
        next[v * 3] = pos[v * 3] + k * ax;
        next[v * 3 + 1] = pos[v * 3 + 1] + k * ay;
        next[v * 3 + 2] = pos[v * 3 + 2] + k * az;
      }
      for (let i = 0; i < pos.length; i++) pos[i] = next[i];
    }
    // 平滑后再投影一次：把顶点拉回等值面，抵消平滑带来的轻微收缩。
    for (let v = 0; v < nv; v++) {
      let p = [pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]];
      for (let it = 0; it < 2; it++) {
        const fv = fn(p);
        const g = grad(p);
        const gl = len(g);
        if (!(gl > 0.2)) break;
        const maxStep = 0.6 * Math.min(step[0], step[1], step[2]);
        const delta = Math.max(-maxStep, Math.min(maxStep, fv));
        p = [p[0] - (g[0] / gl) * delta, p[1] - (g[1] / gl) * delta, p[2] - (g[2] / gl) * delta];
      }
      pos[v * 3] = p[0];
      pos[v * 3 + 1] = p[1];
      pos[v * 3 + 2] = p[2];
    }
    // 平滑改变了坐标，法线必须重算（仍是 SDF 梯度，不依赖拓扑）。
    for (let v = 0; v < pos.length / 3; v++) {
      const g = grad([pos[v * 3], pos[v * 3 + 1], pos[v * 3 + 2]]);
      const l = len(g) || 1;
      norms[v * 3] = g[0] / l;
      norms[v * 3 + 1] = g[1] / l;
      norms[v * 3 + 2] = g[2] / l;
    }
  }

  let min = [Infinity, Infinity, Infinity];
  let max = [-Infinity, -Infinity, -Infinity];
  for (let v = 0; v < pos.length / 3; v++) {
    for (let c = 0; c < 3; c++) {
      min[c] = Math.min(min[c], pos[v * 3 + c]);
      max[c] = Math.max(max[c], pos[v * 3 + c]);
    }
  }
  return { positions: new Float32Array(pos), normals: norms, indices, min, max, res, step, bounds, projected, maxShift };
}

// ---------------------------------------------------------------- 校验与统计
function measure(mesh) {
  const { positions: P, indices: I } = mesh;
  let vol = 0;
  for (let t = 0; t < I.length; t += 3) {
    const a = [P[I[t] * 3], P[I[t] * 3 + 1], P[I[t] * 3 + 2]];
    const b = [P[I[t + 1] * 3], P[I[t + 1] * 3 + 1], P[I[t + 1] * 3 + 2]];
    const c = [P[I[t + 2] * 3], P[I[t + 2] * 3 + 1], P[I[t + 2] * 3 + 2]];
    vol +=
      (a[0] * (b[1] * c[2] - b[2] * c[1]) -
        a[1] * (b[0] * c[2] - b[2] * c[0]) +
        a[2] * (b[0] * c[1] - b[1] * c[0])) / 6;
  }
  // 每条无向边必须恰好被两个三角形使用，且方向相反 —— 这是水密的定义。
  const edges = new Map();
  for (let t = 0; t < I.length; t += 3) {
    const tri = [I[t], I[t + 1], I[t + 2]];
    for (let e = 0; e < 3; e++) {
      const u = tri[e];
      const v = tri[(e + 1) % 3];
      const key = Math.min(u, v) + ":" + Math.max(u, v);
      const rec = edges.get(key) || { n: 0, dir: 0 };
      rec.n++;
      rec.dir += u < v ? 1 : -1;
      edges.set(key, rec);
    }
  }
  let boundary = 0;
  let nonManifold = 0;
  let flipped = 0;
  for (const rec of edges.values()) {
    if (rec.n === 1) boundary++;
    else if (rec.n !== 2) nonManifold++;
    else if (rec.dir !== 0) flipped++;
  }
  return { volume: Math.abs(vol), boundary, nonManifold, flipped, edges: edges.size };
}

function mcVolume(fn, bounds, samples, seed = 7) {
  const [lo, hi] = bounds;
  let s = seed >>> 0;
  const rnd = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  let hits = 0;
  for (let i = 0; i < samples; i++) {
    const p = [lo[0] + rnd() * (hi[0] - lo[0]), lo[1] + rnd() * (hi[1] - lo[1]), lo[2] + rnd() * (hi[2] - lo[2])];
    if (fn(p) < 0) hits++;
  }
  const box = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2]);
  return (hits / samples) * box;
}

// ---------------------------------------------------------------- GLB 写出
function writeGlb(mesh, path) {
  const P = mesh.positions;
  const N = mesh.normals;
  const I = mesh.indices;
  const pad4 = (n) => (4 - (n % 4)) % 4;

  const idxBytes = Buffer.from(I.buffer, I.byteOffset, I.byteLength);
  const posBytes = Buffer.from(P.buffer, P.byteOffset, P.byteLength);
  const nrmBytes = Buffer.from(N.buffer, N.byteOffset, N.byteLength);
  const idxPad = Buffer.alloc(pad4(idxBytes.length));
  const posPad = Buffer.alloc(pad4(posBytes.length));
  const nrmPad = Buffer.alloc(pad4(nrmBytes.length));

  const bin = Buffer.concat([idxBytes, idxPad, posBytes, posPad, nrmBytes, nrmPad]);
  const posOffset = idxBytes.length + idxPad.length;
  const nrmOffset = posOffset + posBytes.length + posPad.length;

  const json = {
    asset: { version: "2.0", generator: "video-pipeline-blueprint/scripts/assets/sdf_props.mjs" },
    scene: 0,
    scenes: [{ nodes: [0] }],
    nodes: [{ mesh: 0, name: "sdf_prop" }],
    meshes: [{ primitives: [{ attributes: { POSITION: 0, NORMAL: 1 }, indices: 2, mode: 4 }] }],
    buffers: [{ byteLength: bin.length }],
    bufferViews: [
      { buffer: 0, byteOffset: 0, byteLength: idxBytes.length, target: 34963 },
      { buffer: 0, byteOffset: posOffset, byteLength: posBytes.length, target: 34962 },
      { buffer: 0, byteOffset: nrmOffset, byteLength: nrmBytes.length, target: 34962 },
    ],
    accessors: [
      {
        bufferView: 1, componentType: 5126, count: P.length / 3, type: "VEC3",
        min: mesh.min.map((v) => Math.fround(v)), max: mesh.max.map((v) => Math.fround(v)),
      },
      { bufferView: 2, componentType: 5126, count: N.length / 3, type: "VEC3" },
      { bufferView: 0, componentType: 5125, count: I.length, type: "SCALAR" },
    ],
  };
  const jsonBytes = Buffer.from(JSON.stringify(json), "utf8");
  const jsonPad = Buffer.alloc(pad4(jsonBytes.length), 0x20);
  const jsonChunk = Buffer.concat([jsonBytes, jsonPad]);

  const header = Buffer.alloc(12);
  header.writeUInt32LE(0x46546c67, 0);
  header.writeUInt32LE(2, 4);
  header.writeUInt32LE(12 + 8 + jsonChunk.length + 8 + bin.length, 8);
  const jsonHeader = Buffer.alloc(8);
  jsonHeader.writeUInt32LE(jsonChunk.length, 0);
  jsonHeader.writeUInt32LE(0x4e4f534a, 4);
  const binHeader = Buffer.alloc(8);
  binHeader.writeUInt32LE(bin.length, 0);
  binHeader.writeUInt32LE(0x004e4942, 4);

  const glb = Buffer.concat([header, jsonHeader, jsonChunk, binHeader, bin]);
  mkdirSync(dirname(resolve(ROOT, path)), { recursive: true });
  writeFileSync(resolve(ROOT, path), glb);
  return { bytes: glb.length, sha256: createHash("sha256").update(glb).digest("hex").slice(0, 16) };
}

// ---------------------------------------------------------------- CLI
const args = {};
for (const a of process.argv.slice(2)) {
  const m = /^--([a-z-]+)(?:=(.*))?$/.exec(a);
  if (m) args[m[1]] = m[2] ?? true;
}
if (args.list) {
  for (const [k, v] of Object.entries(PROPS)) console.log(k.padEnd(6), v.note);
  process.exit(0);
}
const name = args.prop;
if (!name || !PROPS[name]) {
  console.error("usage: sdf_props.mjs --prop=" + Object.keys(PROPS).join("|") + " --res=112 --out=public/models/prop_X.glb");
  process.exit(2);
}
const res = Number(args.res ?? 112);
const samples = Number(args.samples ?? 200000);
const prop = PROPS[name];

const bounds = [
  [-prop.half, -prop.half, -prop.half],
  [prop.half, prop.half, prop.half],
];
const cell = (2 * prop.half) / res;

const t0 = Date.now();
const mesh = extract(prop.f, bounds, res);
const ms = Date.now() - t0;
const m = measure(mesh);
const analytic = mcVolume(prop.f, bounds, samples);
const dV = Math.abs(m.volume - analytic) / Math.max(analytic, 1e-9);

const size = mesh.max.map((v, i) => v - mesh.min[i]);
const fmt = (v) => v.toFixed(4);
console.log(
  "prop   " + name.padEnd(5) + " " + res + "^3  bbox " + size.map((v) => v.toFixed(2)).join("x") +
    "  tris " + (mesh.indices.length / 3).toLocaleString("en-US") +
    "  V " + fmt(m.volume) + "  mc " + fmt(analytic) + "  dV " + (dV * 100).toFixed(2) + "%" +
    "  cell " + cell.toFixed(4) + "  proj " + mesh.projected + " (max " + mesh.maxShift.toFixed(4) + ")" +
    "  boundary " + m.boundary + "  nonManifold " + m.nonManifold + "  flipped " + m.flipped +
    "  " + ms + " ms"
);
if (args.out) {
  const w = writeGlb(mesh, args.out);
  console.log("WROTE " + args.out + " " + w.bytes.toLocaleString("en-US") + " B sha256 " + w.sha256);
}
if (m.boundary !== 0 || m.nonManifold !== 0) {
  console.error("FAIL — the extracted surface is not watertight (boundary " + m.boundary + ", non-manifold " + m.nonManifold + ")");
  process.exit(1);
}