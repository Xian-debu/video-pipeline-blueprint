/**
 * 设计契约（design contract）。
 * 数据源：data/design.spec.json —— 本文件只做类型化读取与计算，不存任何数值。
 * 判据脚本：scripts/qa/design_check.py 校验同一份 JSON；两边读同一个文件，因此不会漂移。
 */
import raw from "../../data/design.spec.json";

export type PaletteFamily = "lecture" | "storyboard";
export type Duty = "static" | "enter" | "emphasize" | "move" | "exit";

type ColorMap = Record<string, string>;
export type RoleDef = {
  color?: string;
  colors?: string[];
  minContrast?: number;
  minSize?: number;
  on?: string[];
  usage?: string;
  alpha?: number;
  meaning?: string;
};
type RoleMap = Record<string, RoleDef>;
type FamilySpec = { colors: ColorMap; roles: RoleMap };

export const spec = raw;

export const PALETTE_FAMILIES = raw.palette.families as unknown as Record<PaletteFamily, FamilySpec>;

/** 画布常量：与 Root.tsx 的 composition 声明一致。 */
export const CANVAS = raw.canvas;

/** 间距锚：场景与外壳只从这四个值取 padding / gap。 */
export const SPACING = raw.spacing.anchors;

/** 字号层级：语义角色 -> 像素。 */
export const TYPE_SCALE = raw.type.scale;

/** 字号族：非主阶梯的表面（storyboard 模板）自己的角色 -> 像素，值冻结自已验收的渲染。 */
export const TYPE_FAMILIES = raw.type.families as unknown as Record<
  string,
  { sizes: Record<string, number>; order: string[]; tracking?: Record<string, number>; trackingRules?: string[] }
>;

/** 未入契约的字面量：白名单 + 只能减少的棘轮。 */
export const TYPE_RATCHET = raw.type.ratchet;

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

/** family 内某个语义角色的定义（色名、对比度目标、alpha）。 */
export const roleSpec = (family: PaletteFamily, role: string): RoleDef => {
  const def = PALETTE_FAMILIES[family].roles[role];
  if (!def) throw new Error("design contract: unknown role " + family + "/" + role);
  return def;
};

/** family 内某个语义角色对应的色值。 */
export const roleColor = (family: PaletteFamily, role: string): string => {
  const fam = PALETTE_FAMILIES[family];
  const def = roleSpec(family, role);
  const name = def.color ?? def.colors?.[0];
  if (!name) throw new Error("design contract: role " + family + "/" + role + " has no color");
  const hex = fam.colors[name];
  if (!hex) throw new Error("design contract: unknown color " + family + "/" + name);
  return hex;
};

/** 填充角色 -> rgba()：alpha 只在契约里声明，组件不再内联 rgba。 */
export const fillColor = (family: PaletteFamily, role: string): string => {
  const def = roleSpec(family, role);
  if (def.usage !== "fill") throw new Error("design contract: " + family + "/" + role + " is not a fill role");
  if (typeof def.alpha !== "number") throw new Error("design contract: " + family + "/" + role + " has no alpha");
  const hex = roleColor(family, role).replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return "rgba(" + r + "," + g + "," + b + "," + def.alpha + ")";
};

/**
 * 环境运动的终点倍率（Ken Burns）。
 * 契约说 ambient 是一次漂移应持续 8-24 秒：比 minSeconds 短的场景"走得少"而不是"走得快"，
 * 比 maxSeconds 长的场景在 maxSeconds 内走完余下的路然后静止。返回值 >= 1。
 */
export const ambientScale = (targetScale: number, durationInFrames: number, fps: number): number => {
  const delta = targetScale - 1;
  if (delta <= 0) return 1;
  const seconds = durationInFrames / fps;
  const span = Math.min(Math.max(seconds, MOTION.ambient.minSeconds), MOTION.ambient.maxSeconds);
  const travelled = delta * (Math.min(seconds, span) / span);
  return 1 + travelled;
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
