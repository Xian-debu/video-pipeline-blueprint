import * as THREE from "three";
import { C } from "../tokens";

/**
 * 材质预设：3D 的颜色不写死，全部从设计令牌取。
 * 这样 3D 镜头和 2D 排版是同一套语义色，不会出现「3D 是蓝的、字幕条是青的」。
 */
export const PAL = {
  accent: C.cyan,
  warn: C.amber,
  note: C.violet,
  alert: C.coral,
  paper: C.paper,
  ink: C.ink,
  surface: C.panel,
} as const;

export type MaterialPreset = "matte" | "satin" | "metal" | "glow";

export const MATERIAL: Record<MaterialPreset, { roughness: number; metalness: number; emissiveIntensity: number }> = {
  matte: { roughness: 0.88, metalness: 0.0, emissiveIntensity: 0.0 },
  satin: { roughness: 0.42, metalness: 0.18, emissiveIntensity: 0.0 },
  metal: { roughness: 0.22, metalness: 0.95, emissiveIntensity: 0.0 },
  glow: { roughness: 0.6, metalness: 0.0, emissiveIntensity: 0.55 },
};

/** 新建一个材质（不要复用同一个实例跨 mesh，避免 R3F 卸载时把别人的材质 dispose 掉）。 */
export const makeMaterial = (preset: MaterialPreset, color: string, opts: { transparent?: boolean; opacity?: number } = {}) => {
  const m = MATERIAL[preset];
  return new THREE.MeshStandardMaterial({
    color: new THREE.Color(color),
    roughness: m.roughness,
    metalness: m.metalness,
    emissive: new THREE.Color(color),
    emissiveIntensity: m.emissiveIntensity,
    transparent: opts.transparent ?? false,
    opacity: opts.opacity ?? 1,
    side: THREE.DoubleSide,
  });
};
