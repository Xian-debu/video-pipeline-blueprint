#!/usr/bin/env node
/**
 * model_lint —— glTF 资产的门禁（与渲染无关，只看文件本身）。
 *
 * 为什么需要它：3D 画面坏掉最常见的原因不是灯光，而是资产：没有法线（雕刻网格
 * 一片台阶）、三角形数量失控（一帧渲十几秒）、包围盒巨大（相机进去了满屏黑）、
 * 或者网格不封闭（体积/布尔运算没法做）。这些都能在 100 ms 内从 .glb 头部读出来，
 * 不需要起浏览器，所以它排在所有 3D 渲染之前。
 *
 * 用法：
 *   node scripts/qa/model_lint.mjs                       # 默认查 public/models/*.glb
 *   node scripts/qa/model_lint.mjs --glb=public/models/x.glb
 *   node scripts/qa/model_lint.mjs --max-tris=300000 --watertight --max-extent=4
 *
 * 退出码：0 通过 / 1 有规则失败 / 2 用法或解析失败（门禁本身坏了）。
 */
import fs from "node:fs";
import path from "node:path";
import { createHash } from "node:crypto";

const ROOT = path.resolve(import.meta.dirname, "..", "..");
const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const s = a.replace(/^--/, "");
    const [k, ...rest] = s.split("=");
    return [k, rest.length ? rest.join("=") : true];
  }),
);

const num = (k, d) => (args[k] == null ? d : Number(args[k]));
const die = (msg) => {
  console.error("model_lint: " + msg);
  process.exit(2);
};

const GLB_MAGIC = 0x46546c67;
const CHUNK_JSON = 0x4e4f534a;
const CHUNK_BIN = 0x004e4942;

export function readGlb(buf) {
  if (buf.length < 12) die("file is shorter than a GLB header");
  if (buf.readUInt32LE(0) !== GLB_MAGIC) die("not a binary glTF (magic is not 'glTF')");
  const version = buf.readUInt32LE(4);
  const total = buf.readUInt32LE(8);
  if (version !== 2) die("glTF version " + version + " is not supported (want 2)");
  if (total !== buf.length) die("header length " + total + " != file length " + buf.length);

  let off = 12;
  let json = null;
  let bin = null;
  while (off + 8 <= buf.length) {
    const len = buf.readUInt32LE(off);
    const type = buf.readUInt32LE(off + 4);
    const body = buf.subarray(off + 8, off + 8 + len);
    if (type === CHUNK_JSON) json = JSON.parse(body.toString("utf8"));
    if (type === CHUNK_BIN) bin = body;
    off += 8 + len + ((4 - (len % 4)) % 4);
  }
  if (!json) die("no JSON chunk");
  return { json, bin };
}

const COMP = {
  5120: { size: 1, get: "readInt8", n: 1 },
  5121: { size: 1, get: "readUInt8", n: 1 },
  5122: { size: 2, get: "readInt16LE", n: 1 },
  5123: { size: 2, get: "readUInt16LE", n: 1 },
  5125: { size: 4, get: "readUInt32LE", n: 1 },
  5126: { size: 4, get: "readFloatLE", n: 1 },
};
const NUM_COMP = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4 };

function accessorView(json, bin, index) {
  const acc = json.accessors[index];
  const comp = COMP[acc.componentType];
  if (!comp) die("accessor " + index + " has unknown componentType " + acc.componentType);
  const count = acc.count;
  const ncomp = NUM_COMP[acc.type];
  if (!ncomp) die("accessor " + index + " has unknown type " + acc.type);
  if (acc.bufferView == null) return { acc, count, ncomp, values: null };
  const view = json.bufferViews[acc.bufferView];
  if (!view) die("accessor " + index + " points at missing bufferView");
  const base = (view.byteOffset ?? 0) + (acc.byteOffset ?? 0);
  const stride = view.byteStride ?? comp.size * ncomp;
  const out = new Array(count * ncomp);
  for (let i = 0; i < count; i++) {
    for (let c = 0; c < ncomp; c++) {
      const at = base + i * stride + c * comp.size;
      out[i * ncomp + c] = bin[comp.get](at);
    }
  }
  return { acc, count, ncomp, values: out };
}

function main() {
  const files = args.glb
    ? [path.resolve(ROOT, String(args.glb).replace(/^\.\//, ""))]
    : fs.existsSync(path.join(ROOT, "public/models"))
      ? fs
          .readdirSync(path.join(ROOT, "public/models"))
          .filter((f) => f.toLowerCase().endsWith(".glb") || f.toLowerCase().endsWith(".gltf"))
          .map((f) => path.join(ROOT, "public/models", f))
      : [];
  if (!files.length) die("no .glb under public/models and no --glb given");

  const maxTris = num("max-tris", 400000);
  const maxExtent = num("max-extent", 0); // 0 = 不判
  const wantWatertight = Boolean(args.watertight);
  // 有意的、写下来的豁免。没有这个开关，一条规则要么永远为假、要么被悄悄删掉。
  const allow = new Set(String(args.allow ?? "").split(",").filter(Boolean));
  const asJson = Boolean(args.json);

  let failed = 0;
  const rows = [];

  for (const file of files) {
    const src = fs.readFileSync(file);
    const { json, bin } = readGlb(src);
    const rel = path.relative(ROOT, file);
    const sha = createHash("sha256").update(src).digest("hex");

    const problems = [];
    const number = {};

    // 1. 资产级契约
    if (!json.asset || !String(json.asset.version || "").startsWith("2")) problems.push("asset.version is not 2.x");
    if (json.extensionsRequired?.some((e) => e !== "KHR_materials_unlit" && !e.startsWith("KHR_")))
      problems.push("requires unsupported extensions: " + json.extensionsRequired.join(","));

    // 2. 网格：三角形数、法线、包围盒
    let tris = 0;
    let prims = 0;
    let withNormals = 0;
    let unindexed = 0;
    const min = [Infinity, Infinity, Infinity];
    const max = [-Infinity, -Infinity, -Infinity];
    let boundary = 0;
    let nonManifold = 0;

    for (const mesh of json.meshes ?? []) {
      for (const prim of mesh.primitives ?? []) {
        prims++;
        const pos = prim.attributes?.POSITION;
        if (pos == null) {
          problems.push("a primitive has no POSITION");
          continue;
        }
        if (prim.attributes.NORMAL != null) withNormals++;
        const pa = json.accessors[pos];
        if (pa.min && pa.max) {
          for (let i = 0; i < 3; i++) {
            min[i] = Math.min(min[i], pa.min[i]);
            max[i] = Math.max(max[i], pa.max[i]);
          }
        }
        if (prim.indices != null) {
          const ia = json.accessors[prim.indices];
          tris += Math.floor(ia.count / 3);
          if (wantWatertight && bin) {
            const idx = accessorView(json, bin, prim.indices);
            const edges = new Map();
            const bump = (a, b) => {
              const k = a < b ? a + ":" + b : b + ":" + a;
              edges.set(k, (edges.get(k) ?? 0) + 1);
            };
            for (let i = 0; i + 2 < idx.values.length; i += 3) {
              bump(idx.values[i], idx.values[i + 1]);
              bump(idx.values[i + 1], idx.values[i + 2]);
              bump(idx.values[i + 2], idx.values[i]);
            }
            for (const c of edges.values()) {
              if (c === 1) boundary++;
              else if (c > 2) nonManifold++;
            }
          }
        } else {
          unindexed++;
          tris += Math.floor(pa.count / 3);
        }
      }
    }

    number.primitives = prims;
    number.triangles = tris;
    number.boundaryEdges = boundary;
    number.nonManifoldEdges = nonManifold;

    if (!prims) problems.push("no mesh primitives");
    if (prims && withNormals !== prims) {
      const msg = prims - withNormals + "/" + prims + " primitives have no NORMAL (facets, not surfaces)";
      if (allow.has("no-normals")) number.allowed = [...(number.allowed ?? []), msg + " — allowed: runtime computeVertexNormals()"];
      else problems.push(msg);
    }
    if (tris > maxTris) problems.push("triangles " + tris + " > max-tris " + maxTris);
    if (unindexed) problems.push(unindexed + " primitives are unindexed (cannot weld or dedupe)");

    const extent = min[0] === Infinity ? null : max.map((v, i) => v - min[i]);
    number.bboxMin = min[0] === Infinity ? null : min.map((v) => +v.toFixed(3));
    number.bboxMax = max[0] === Infinity ? null : max.map((v) => +v.toFixed(3));
    number.extent = extent ? extent.map((v) => +v.toFixed(3)) : null;
    if (maxExtent && extent) {
      const longest = Math.max(...extent);
      if (longest > maxExtent) problems.push("longest extent " + longest.toFixed(2) + " > max-extent " + maxExtent);
    }

    if (wantWatertight && (boundary || nonManifold))
      problems.push("mesh is not watertight: " + boundary + " boundary edges, " + nonManifold + " non-manifold edges");

    number.bytes = src.length;
    number.sha256 = sha;

    if (problems.length) failed++;
    rows.push({ file: rel, ok: problems.length === 0, problems, number });
  }

  if (asJson) {
    console.log(JSON.stringify({ ok: failed === 0, targets: rows }, null, 2));
  } else {
    for (const row of rows) {
      console.log(
        (row.ok ? "PASS " : "FAIL ") +
          row.file +
          "  " +
          row.number.bytes.toLocaleString("en-US") +
          " B · " +
          row.number.primitives +
          " prim / " +
          row.number.triangles.toLocaleString("en-US") +
          " tris · extent " +
          (row.number.extent ? row.number.extent.join("×") : "?") +
          " · sha256 " +
          row.number.sha256.slice(0, 16),
      );
      for (const p of row.number.allowed ?? []) console.log("     ~ allowed: " + p);
      for (const p of row.problems) console.log("     - " + p);
    }
  }

  if (failed) {
    console.error("model_lint: FAIL — " + failed + "/" + rows.length + " asset(s) failed");
    process.exit(1);
  }
  console.log("model_lint: PASS — " + rows.length + " asset(s), triangles ≤ " + maxTris + (wantWatertight ? ", watertight required" : ""));
}

main();