import React, { createContext, useContext } from "react";
import { PALETTE_FAMILIES, PRESETS, colorOf, fillOf, paletteOfPreset, type PaletteLike } from "./contract";

/**
 * 一个组件只认角色名（text.primary / accent.primary / surface.scrim…），不认族名。
 * 这层 Provider 决定"当前是哪个预设"，于是同一份版式可以出多个外观，
 * 而场景代码里没有任何 if (theme === ...) 分支。
 *
 * 默认值是 storyboard 族 —— 也就是已验收影片的外观，不传 preset 时像素不变。
 */
const PaletteContext = createContext<PaletteLike>(PALETTE_FAMILIES.storyboard);

export const PaletteScope: React.FC<{ preset?: string | null; children: React.ReactNode }> = ({
  preset,
  children,
}) => <PaletteContext.Provider value={paletteOfPreset(preset)}>{children}</PaletteContext.Provider>;

export const usePalette = (): PaletteLike => useContext(PaletteContext);

/** 当前预设下某个语义角色的色值（文字/线条）。 */
export const useRole = (role: string): string => colorOf(usePalette(), role);

/** 当前预设下某个填充角色的 rgba()。 */
export const useFill = (role: string): string => fillOf(usePalette(), role);

/** 预设清单（供画廊与文档使用）。 */
export { PRESETS };
