/** 设计令牌：由 data/design.spec.json 派生，组件只从这里取值（新值先改契约）。 */
import { PALETTE_FAMILIES, SPACING, TYPE_FAMILIES, TYPE_SCALE } from "./contract";

export const C = PALETTE_FAMILIES.lecture.colors;

export const T = TYPE_SCALE;

/** storyboard 模板的字号族（契约里的第二套阶梯，值冻结自 D2 之前的那一版渲染）。 */
export const SB = TYPE_FAMILIES.storyboard.sizes;

/** 同一族排的字距（px）。CJK 超过 5% 的项在契约里标为已知偏差。 */
export const SB_T = TYPE_FAMILIES.storyboard.tracking as Record<string, number>;

/** 逐位乘法片的字号族：契约里的第三套阶梯（cover 108 到 tiny 15）。 */
export const FT = TYPE_FAMILIES.film.sizes;

export const FT_T = TYPE_FAMILIES.film.tracking as Record<string, number>;

export const G = {
  grid: SPACING.grid,
  gutter: SPACING.gutter,
  pad: SPACING.pageMargin,
  safe: SPACING.safeArea,
} as const;

export const FONT = {
  sans: '"Noto Sans CJK SC", "Noto Sans SC", system-ui, sans-serif',
  serif: '"Noto Serif CJK SC", "Noto Serif SC", Georgia, serif',
  mono: '"JetBrains Mono", "Noto Sans Mono CJK SC", ui-monospace, monospace',
} as const;
