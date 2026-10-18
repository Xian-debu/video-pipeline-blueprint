/**
 * 通用分镜模板（src/storyboard）的历史令牌入口。
 * 字体值来自 data/design.spec.json；颜色不再从这里取 —— 场景用 usePalette() 的角色名，
 * 因为颜色现在取决于当前预设（见 src/design/palette.tsx）。
 */
import { FONT } from "./design/tokens";

export const FONT_SANS = FONT.sans;
export const FONT_SERIF = FONT.serif;
