import type { Storyboard } from "../schema";

export const DEMO_STORYBOARD: Storyboard = {
  id: "demo-storyboard",
  fps: 30,
  width: 1920,
  height: 1080,
  debug: false,
  scenes: [
    {
      id: "s1",
      kind: "title",
      durationInFrames: 120,
      bg: "#0B0E14",
      fg: "#F5F1E8",
      title: "真实数据看板",
      subtitle: "2026 年第三季度运营复盘",
      transitionIn: "fade",
      captions: [{ from: 15, to: 115, text: "这是一个数据驱动的分镜示例。", pos: "bottom" }],
    },
    {
      id: "s2",
      kind: "graphic",
      durationInFrames: 150,
      bg: "#121826",
      fg: "#F5F1E8",
      title: "三条产品线",
      bullets: ["内容生产", "渲染管线", "素材工厂"],
      transitionIn: "slide",
      captions: [{ from: 10, to: 145, text: "完全由代码控制排版与节奏，逐帧可预测。", pos: "bottom" }],
    },
    {
      id: "s3",
      kind: "outro",
      durationInFrames: 90,
      bg: "#FF5A3C",
      fg: "#0B0E14",
      title: "END",
      subtitle: "gen24 · video2",
      transitionIn: "fade",
    },
  ],
};
