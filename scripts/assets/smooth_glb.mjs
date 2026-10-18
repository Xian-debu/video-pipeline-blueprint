#!/usr/bin/env node
/**
 * Taubin 平滑器 —— 给体素/扫描资产去掉台阶，同时保持水密。
 *
 * 为什么需要它：3D 打印式雕刻网格的每个面都是轴对齐的台阶，靠
 * computeVertexNormals() 只能把硬边抹成「平滑的法线 + 仍旧台阶的几何」，
 * 结果是同心环状的莫尔纹。Taubin 的 λ/μ 交替（λ>0 收缩，μ<0 回弹）能在
 * 不显著改变体积的情况下抹掉台阶；纯粹的 Laplacian 平滑会整块缩水。
 *
 * 用法：node scripts/assets/smooth_glb.mjs <in.glb> <out.glb> [--iterations=10] [--lambda=0.5] [--mu=-0.53]
 * 只改 POSITION；拓扑、accessor 数量、buffer 布局保持不变（buf 大小不变），
 * 所以输出仍然是水密的，可以直接过 model_lint --watertight。
 */
import { readFileSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";

const args = process.argv.slice(2);
const positional = args.filter((a) => !a.startsWith("--"));
const flag = (name, fallback) => {
  const hit = args.find((a) => a.startsWith("--" + name + "="));
  return hit ? Number(hit.split("=")[1]) : fallback;
};
if (positional.length !== 2) {
  console.error("usage: node scripts/assets/smooth_glb.mjs <in.glb> <out.glb> [--iterations=10] [--lambda=0.5] [--mu=-0.53]");
  process.exit(2);
}
const [input, output] = positional;
const iterations = flag("iterations", 10);
const lambda = flag("lambda", 0.5);
const mu = flag("mu", -0.53);

const MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

const buf = readFileSync(input);
if (buf.readUInt32LE(0) !== MAGIC) throw new Error("not a GLB: " + input);
if (buf.readUInt32LE(4) !== 2) throw new Error("only glTF 2.0 supported");
let offset = 12;
let json = null;
let bin = null;
while (offset < buf.length) {
  const len = buf.readUInt32LE(offset);
  const type = buf.readUInt32LE(offset + 4);
  const body = buf.subarray(offset + 8, offset + 8 + len);
  if (type === CHUNK_JSON) json = JSON.parse(body.toString("utf8"));
  else if (type === CHUNK_BIN) bin = body;
  offset += 8 + len;
}
if (!json || !bin) throw new Error("GLB missing JSON or BIN chunk");

const GL = { 5120: 1, 5121: 1, 5122: 2, 5123: 2, 5125: 4, 5126: 4 };
const NCOMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };

const viewOf = (accessorIndex) => {
  const acc = json.accessors[accessorIndex];
  const bv = json.bufferViews[acc.bufferView];
  const stride = bv.byteStride || GL[acc.componentType] * NCOMP[acc.type];
  const start = (bv.byteOffset || 0) + (acc.byteOffset || 0);
  return { acc, bv, stride, start };
};

const readVec3 = (view, i) => {
  const p = view.start + i * view.stride;
  return [bin.readFloatLE(p), bin.readFloatLE(p + 4), bin.readFloatLE(p + 8)];
};
const writeVec3 = (view, i, v) => {
  const p = view.start + i * view.stride;
  bin.writeFloatLE(v[0], p);
  bin.writeFloatLE(v[1], p + 4);
  bin.writeFloatLE(v[2], p + 8);
};
const indicesOf = (prim) => {
  if (prim.indices == null) return null;
  const view = viewOf(prim.indices);
  const { acc } = view;
  const read = { 5121: (p) => bin.readUInt8(p), 5123: (p) => bin.readUInt16LE(p), 5125: (p) => bin.readUInt32LE(p) }[acc.componentType];
  const size = GL[acc.componentType];
  return Array.from({ length: acc.count }, (_, i) => read(view.start + i * size));
};

let touched = 0;
let moved = 0;
for (const mesh of json.meshes || []) {
  for (const prim of mesh.primitives || []) {
    const posIndex = prim.attributes?.POSITION;
    if (posIndex == null) continue;
    const view = viewOf(posIndex);
    const count = view.acc.count;
    // 焊接：雕刻网格里同一个空间点常被拆成多个顶点（法线/UV 分裂），
    // 只在索引里出现的邻接不够，按坐标哈希合并成一组再平均。
    const groups = new Map();
    const groupOf = new Array(count);
    for (let i = 0; i < count; i += 1) {
      const p = readVec3(view, i);
      const key = p.map((v) => v.toFixed(5)).join(",");
      let g = groups.get(key);
      if (g == null) {
        g = { verts: [], acc: [0, 0, 0] };
        groups.set(key, g);
      }
      g.verts.push(i);
      g.acc[0] += p[0]; g.acc[1] += p[1]; g.acc[2] += p[2];
      groupOf[i] = key;
    }
    const adjacency = new Map();
    for (const key of groups.keys()) adjacency.set(key, new Set());
    const idx = indicesOf(prim);
    if (idx) {
      for (let t = 0; t < idx.length; t += 3) {
        const a = groupOf[idx[t]], b = groupOf[idx[t + 1]], c = groupOf[idx[t + 2]];
        adjacency.get(a).add(b); adjacency.get(a).add(c);
        adjacency.get(b).add(a); adjacency.get(b).add(c);
        adjacency.get(c).add(a); adjacency.get(c).add(b);
      }
    }
    // 初始位置 = 每组质心（同一 key 的所有副本一起移动，避免接缝裂开）。
    const pos = new Map();
    for (const [key, g] of groups) pos.set(key, [g.acc[0] / g.verts.length, g.acc[1] / g.verts.length, g.acc[2] / g.verts.length]);
    const step = (factor) => {
      const next = new Map();
      for (const [key, p] of pos) {
        const nbrs = adjacency.get(key);
        if (!nbrs || nbrs.size === 0) { next.set(key, p); continue; }
        const avg = [0, 0, 0];
        for (const k of nbrs) {
          const q = pos.get(k);
          avg[0] += q[0]; avg[1] += q[1]; avg[2] += q[2];
        }
        avg[0] /= nbrs.size; avg[1] /= nbrs.size; avg[2] /= nbrs.size;
        next.set(key, [p[0] + factor * (avg[0] - p[0]), p[1] + factor * (avg[1] - p[1]), p[2] + factor * (avg[2] - p[2])]);
      }
      pos.clear();
      for (const [k, v] of next) pos.set(k, v);
    };
    for (let it = 0; it < iterations; it += 1) { step(lambda); step(mu); }
    // 保体积：平滑整体会略微内缩，把包围盒最大边长还原到原值。
    let minV = [Infinity, Infinity, Infinity], maxV = [-Infinity, -Infinity, -Infinity];
    for (const p of pos.values()) for (let k = 0; k < 3; k += 1) { minV[k] = Math.min(minV[k], p[k]); maxV[k] = Math.max(maxV[k], p[k]); }
    const extent = maxV.map((v, k) => v - minV[k]);
    const maxExtent = Math.max(...extent);
    let refMax = 0;
    for (let k = 0; k < 3; k += 1) {
      let lo = Infinity, hi = -Infinity;
      for (const g of groups.values()) { lo = Math.min(lo, g.acc[k] / g.verts.length); hi = Math.max(hi, g.acc[k] / g.verts.length); }
      refMax = Math.max(refMax, hi - lo);
    }
    const scale = maxExtent > 0 ? refMax / maxExtent : 1;
    const mid = minV.map((v, k) => (v + maxV[k]) / 2);
    for (const [key, g] of groups) {
      const p = pos.get(key);
      for (const i of g.verts) {
        const before = readVec3(view, i);
        const after = [mid[0] + (p[0] - mid[0]) * scale, mid[1] + (p[1] - mid[1]) * scale, mid[2] + (p[2] - mid[2]) * scale];
        writeVec3(view, i, after);
        moved += Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]);
        touched += 1;
      }
    }
  }
}

writeFileSync(output, buf);
const sha = createHash("sha256").update(buf).digest("hex").slice(0, 16);
console.log(
  "smoothed " + input + " → " + output + " · " + iterations + " iters (λ=" + lambda + ", μ=" + mu + ") · " +
  touched.toLocaleString("en-US") + " verts · mean move " + (moved / Math.max(touched, 1)).toFixed(4) + " · " + buf.length.toLocaleString("en-US") + " B · sha256 " + sha
);
