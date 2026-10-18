/**
 * 通用分镜模板（src/storyboard）的历史令牌入口。
 * 值现在统一来自 data/design.spec.json 的 storyboard 色族，这里只做重导出，
 * 因此不再存在第二份可以漂移的色值。合并进 lecture 色族见 docs/roadmap.md。
 */
import { PALETTE_FAMILIES } from "./design/contract";
import { FONT } from "./design/tokens";

export const FONT_SANS = FONT.sans;
export const FONT_SERIF = FONT.serif;

export const PALETTE = PALETTE_FAMILIES.storyboard.colors;
