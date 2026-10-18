/**
 * 设计契约（design contract）。
 * 数据源：data/design.spec.json —— 本文件只做类型化读取与计算，不存任何数值。
 * 判据脚本：scripts/qa/design_check.py 校验同一份 JSON；两边读同一个文件，因此不会漂移。
 */
import raw from "../../data/design.spec.json";

export type PaletteFamily = "lecture" | "storyboard";
export type Duty = "static" | "enter" | "emphasize" | "move" | "exit";

type ColorMap = Record<string, string>;
type RoleMap = Record<string, { color?: string; colors?: string[]; minContrast?: number; minSize?: number; on?: string[]; usage?: string }>;
type FamilySpec = { colors: ColorMap; roles: RoleMap };

export const spec = raw;

export const PALETTE_FAMILIES = raw.palette.families as unknown as Record<PaletteFamily, FamilySpec>;

/** 画布常量：与 Root.tsx 的 composition 声明一致。 */
export const CANVAS = raw.canvas;

/** 间距锚：场景与外壳只从这四个值取 padding / gap。 */
export const SPACING = raw.spacing.anchors;

/** 字号层级：语义角色 -> 像素。 */
export const TYPE_SCALE = raw.type.scale;

/** 动效预算：每个 duty 的帧数上限。 */
export const MOTION = {
  transition: raw.motion.transition,
  duties: raw.motion.duties,
  stagger: raw.motion.staggerFrames,
  ambient: raw.motion.ambient,
} as const;

/** 字幕/旁白预算。 */
export const CAPTION = raw.text.caption;

export const dutyFrames = (duty: Duty): number => MOTION.duties[duty].frames;

/** family 内某个语义角色对应的色值。 */
export const roleColor = (family: PaletteFamily, role: string): string => {
  const fam = PALETTE_FAMILIES[family];
  const def = fam.roles[role];
  if (!def) throw new Error("design contract: unknown role " + family + "/" + role);
  const name = def.color ?? def.colors?.[0];
  if (!name) throw new Error("design contract: role " + family + "/" + role + " has no color");
  const hex = fam.colors[name];
  if (!hex) throw new Error("design contract: unknown color " + family + "/" + name);
  return hex;
};

const channel = (v: number): number => (v / 255 <= 0.03928 ? v / 255 / 12.92 : Math.pow((v / 255 + 0.055) / 1.055, 2.4));

export const relativeLuminance = (hex: string): number => {
  const h = hex.replace("#", "");
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
};

/** WCAG 2.1 对比度；design_check.py 用同一公式，保证 TS 与 Python 结论一致。 */
export const contrastRatio = (a: string, b: string): number => {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const hi = Math.max(la, lb);
  const lo = Math.min(la, lb);
  return (hi + 0.05) / (lo + 0.05);
};
