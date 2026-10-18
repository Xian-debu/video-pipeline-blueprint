import React from "react";
import { AbsoluteFill, Sequence } from "remotion";
import type { Storyboard } from "../schema";
import { StoryboardFilm } from "../storyboard/Film";
import { PaletteScope, PRESETS, useRole } from "../design/palette";
import { FONT_SANS } from "../theme";
import { SB, SB_T } from "../design/tokens";

/**
 * 预设画廊：同一份版式、同一段文字，逐个预设各演一遍。
 * 用途不是播放，而是**并排审片** —— 导出静帧即可看到每个预设的对比度与极性是否成立。
 * 每个预设的画格里带一个角标（预设名 + 序号），角标本身也用该预设的角色色。
 */
const FRAMES_PER_PRESET = 90;

const SAMPLE: Storyboard = {
  id: "preset-sample",
  fps: 30,
  width: 1920,
  height: 1080,
  scenes: [
    {
      id: "preset-scene",
      kind: "title",
      durationInFrames: FRAMES_PER_PRESET,
      title: "真实数据看板",
      subtitle: "2026 年第三季度运营复盘",
      captions: [{ from: 20, to: 86, text: "同一份版式，换一套角色配色。", pos: "bottom" }],
    },
  ],
};

const PanelLabel: React.FC<{ index: number; total: number; label: string }> = ({ index, total, label }) => {
  const color = useRole("text.secondary");
  return (
    <AbsoluteFill style={{ padding: "56px 64px", pointerEvents: "none" }}>
      <div style={{ fontFamily: FONT_SANS, fontSize: SB.overline, letterSpacing: SB_T.overline, color }}>
        {`PRESET ${String(index + 1).padStart(2, "0")} / ${String(total).padStart(2, "0")} · ${label.toUpperCase()}`}
      </div>
    </AbsoluteFill>
  );
};

export const PresetGallery: React.FC = () => {
  const items = PRESETS.items;
  return (
    <AbsoluteFill>
      {items.map((preset, i) => (
        <Sequence
          key={preset.id}
          from={i * FRAMES_PER_PRESET}
          durationInFrames={FRAMES_PER_PRESET}
          name={"preset " + preset.id}
        >
          <PaletteScope preset={preset.id}>
            <StoryboardFilm storyboard={SAMPLE} />
            <PanelLabel index={i} total={items.length} label={preset.label} />
          </PaletteScope>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
};

export const PRESET_GALLERY_FRAMES = FRAMES_PER_PRESET * Math.max(PRESETS.items.length, 1);
