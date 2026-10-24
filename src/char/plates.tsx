import React from "react";
import { Img, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import platesJson from "../../data/char/plates.json";

/* 贴片层：画面里的三维部分全部是 Blender 事先渲好的 alpha PNG（scripts/char/gen.py），
 * 这里只负责按名字取图、按帧号取序列帧。
 *
 * 为什么不在渲染时开实时三维：见 gen24-admin/docs/44 —— 同一份 GLB 在 Remotion 里
 * 要处理 useGltf 加载先于 canvas 挂载、帧率手动推进、色彩空间这几件事，收益不抵风险；
 * 贴片是「先算清楚再播」，每一帧都有 sha256，确定性由账本保证。
 *
 * 贴片清单 data/char/plates.json 是进 git 的（scripts/char/manifest.py 从渲染账本裁出来），
 * 所以取不到图时报错信息能指到具体的名字，而不是静默空画面（K20 那个坑）。 */

export type PlateEntry = { name: string; job: string; seconds: number; sha256: string };
export type PlatesJson = {
  source: string;
  res: [number, number];
  samples: number;
  params: Record<string, unknown>;
  params_sha256: string;
  parts: { verts: number; faces: number; build_seconds: number; weighted_verts: number };
  bones: number;
  glb: { path: string; bytes: number; sha256: string } | null;
  seconds: number;
  count: number;
  jobs: Record<string, number>;
  plates: PlateEntry[];
};

export const PLATES = platesJson as unknown as PlatesJson;
export const PLATE_RES = PLATES.res;

const BY_NAME: Record<string, PlateEntry> = {};
for (const p of PLATES.plates) BY_NAME[p.name] = p;

/** 贴片清单里没有这个名字 = 账本与画面不一致，直接失败（比空画面好查）。 */
export const plateOf = (name: string): PlateEntry => {
  const e = BY_NAME[name];
  if (!e) throw new Error("plate not in data/char/plates.json: " + name + " (rendered: " + PLATES.count + ")");
  return e;
};

export const plateSrc = (name: string): string => staticFile("plates/char/" + plateOf(name).name + ".png");

/** 同一组贴片里某个 job 的名字列表（按名字排序，帧序即字典序）。 */
export const platesOfJob = (job: string): string[] =>
  PLATES.plates.filter((p) => p.job === job).map((p) => p.name).sort();

/** 一张贴片：默认按 1920 宽等比缩放，透明背景直接叠在版面上。 */
export const Plate: React.FC<{
  name: string;
  w?: number;
  style?: React.CSSProperties;
  className?: string;
}> = ({ name, w = 1920, style }) => (
  <Img
    src={plateSrc(name)}
    style={{ width: w, height: "auto", display: "block", pointerEvents: "none", ...style }}
  />
);

/**
 * 序列帧：按当前帧号取第 index 张（index 由 fps 决定，循环）。
 * 帧号驱动，没有时钟、没有 requestAnimationFrame —— 同一帧永远是同一张图。
 */
export const PlateSeq: React.FC<{
  prefix: string;
  count: number;
  fps?: number;
  w?: number;
  style?: React.CSSProperties;
  hold?: number;
}> = ({ prefix, count, fps = 24, w = 1920, style, hold = 0 }) => {
  const f = useCurrentFrame();
  const { fps: videoFps } = useVideoConfig();
  const idx = Math.floor(((f + hold) * fps) / videoFps) % count;
  return <Plate name={prefix + "_" + String(idx).padStart(3, "0")} w={w} style={style} />;
};

/** 参考图（public/char/reference.png，sha256 记在 data/char/gate.json 里）。 */
export const Reference: React.FC<{ w?: number; style?: React.CSSProperties }> = ({ w = 832, style }) => (
  <Img src={staticFile("char/reference.png")} style={{ width: w, height: "auto", display: "block", ...style }} />
);
