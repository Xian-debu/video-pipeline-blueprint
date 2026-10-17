/** 设计令牌：单一来源，所有场景从这里取色与字号。 */
export const C = {
  bg: "#0B0F14",
  bgSoft: "#111823",
  panel: "#151E2B",
  panelLine: "#22303F",
  ink: "#E8EEF5",
  inkDim: "#9AA7B6",
  inkFaint: "#66758A",
  cyan: "#5EEAD4",
  cyanDeep: "#0F766E",
  coral: "#FB7185",
  coralDeep: "#7F1D1D",
  amber: "#FBBF24",
  violet: "#A78BFA",
  paper: "#F3EEE3",
  paperInk: "#1A1A17",
} as const;

export const T = {
  display: 96,
  h1: 64,
  h2: 42,
  body: 30,
  caption: 24,
  mono: 26,
  math: 32,
} as const;

export const G = { grid: 4, gutter: 24, pad: 76, safe: 64 } as const;

export const FONT = {
  sans: '"Noto Sans CJK SC", "Noto Sans SC", system-ui, sans-serif',
  serif: '"Noto Serif CJK SC", "Noto Serif SC", Georgia, serif',
  mono: '"JetBrains Mono", "Noto Sans Mono CJK SC", ui-monospace, monospace',
} as const;
