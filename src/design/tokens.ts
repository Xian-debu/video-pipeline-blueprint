/** 设计令牌：由 data/design.spec.json 派生，组件只从这里取值（新值先改契约）。 */
import { PALETTE_FAMILIES, SPACING, TYPE_SCALE } from "./contract";

export const C = PALETTE_FAMILIES.lecture.colors;

export const T = TYPE_SCALE;

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
