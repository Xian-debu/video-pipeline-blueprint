/**
 * 把 profile.ts 的二维齿廓变成 three 的几何体。
 *
 * 这里没有"美术资产"：每个齿都是 ExtrudeGeometry 当场挤出来的，
 * 参数只有一个来源 data/gears/params.json，所以片子里出现的轮系
 * 与 geometry_check / mesh_check 验算的是同一组数。
 *
 * 反面教材：如果这里改成读一个 .glb，门禁验的就不再是画面里的东西了。
 */
import * as THREE from "three";
import { gearShape2D, type GearSpec, type P2 } from "./profile";

export type GearGeometrySpec = GearSpec & {
  /** 中心孔半径（mm）。0 表示不开孔。 */
  bore?: number;
  /** 减重孔：半径与所在半径；只对外齿轮有意义。 */
  lightening?: { radius: number; at: number; count: number };
};

const cache = new Map<string, THREE.BufferGeometry>();

const toPath = (pts: P2[]) => {
  const path = new THREE.Path();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  path.closePath();
  return path;
};

/** 单位 mm、绕 +z 挤出、沿 z 居中。 */
export function gearGeometry(spec: GearGeometrySpec): THREE.BufferGeometry {
  const key = JSON.stringify(spec);
  const hit = cache.get(key);
  if (hit) return hit;

  const shape2d = gearShape2D(spec);
  const depth = spec.faceWidth;
  const opt = { depth, bevelEnabled: false, curveSegments: 1, steps: 1 };
  let geometry: THREE.BufferGeometry;

  if (spec.internal) {
    // 内齿圈：外圈是实心圆，齿廓是挖掉的洞。
    const shape = new THREE.Shape();
    shape.absarc(0, 0, shape2d.rRoot + spec.module * 1.5, 0, Math.PI * 2, false);
    shape.holes.push(toPath(shape2d.outline));
    geometry = new THREE.ExtrudeGeometry(shape, opt);
  } else {
    const shape = new THREE.Shape(toPath(shape2d.outline).getPoints(0));
    if (spec.bore && spec.bore > 0) {
      const bore = new THREE.Path();
      bore.absarc(0, 0, spec.bore, 0, Math.PI * 2, true);
      shape.holes.push(bore);
    }
    if (spec.lightening) {
      const { radius, at, count } = spec.lightening;
      for (let i = 0; i < count; i++) {
        const a = (i / count) * Math.PI * 2 + Math.PI / count;
        const hole = new THREE.Path();
        hole.absarc(Math.cos(a) * at, Math.sin(a) * at, radius, 0, Math.PI * 2, true);
        shape.holes.push(hole);
      }
    }
    geometry = new THREE.ExtrudeGeometry(shape, opt);
  }
  geometry.translate(0, 0, -depth / 2);
  geometry.computeVertexNormals();
  cache.set(key, geometry);
  return geometry;
}

/** 中心距：两个外齿轮的节圆半径之和。 */
export const centreDistance = (module: number, z1: number, z2: number) => (module * (z1 + z2)) / 2;

/** 一转里两个齿轮的相位关系：外啮合相位差 pi/z1（齿槽对齿）。 */
export const meshPhase = (z1: number) => Math.PI / z1;

/**
 * 行星轮系的相位（与 scripts/qa/mesh_check.mjs 验算是同一组公式）：
 * 太阳转角 th，行星架 th/(1+zr/zs)，行星自转 -(zs/zp)*th + 行星架修正。
 */
export function planetaryPhase(th: number, zs: number, zp: number, zr: number) {
  const carrier = th / (1 + zr / zs);
  const spin = -th * (zs / zp) + carrier * (1 + zs / zp) + Math.PI / zp;
  return { carrier, spin };
}
