import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT } from "../design/tokens";
import { SCENES, LINES, TOTAL, FPS } from "./script";
import { SCENE_COMPONENTS } from "./film/scenes";

/**
 * 第八部片的成片壳。与第七部同一套约定：
 *   每场一个 Sequence（时长由讲稿算出来）→ 场内的三维层 + 二维层 → 全片字幕 → 两条音轨。
 * 讲稿是唯一时间源（LINES），所以"改一句台词 → 字幕、配音、镜头长度一起变"。
 */

const cl = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

/** 全片字幕：取当前时刻所在的那一句，头尾各 6% 淡入淡出。 */
const Subtitle: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const line = LINES.find((c) => t >= c.start && t < c.start + c.dur);
  if (!line) return null;
  const local = (t - line.start) / line.dur;
  const op = interpolate(local, [0, 0.06, 0.94, 1], [0, 1, 1, 0], cl);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 30, display: "flex", justifyContent: "center", opacity: op }}>
      <div style={{
        background: "rgba(9,17,22,0.82)",
        border: `1px solid ${C.panelLine}`,
        borderRadius: 12,
        padding: "12px 30px",
        fontFamily: FONT.sans,
        fontSize: FT.h2,
        lineHeight: 1.45,
        color: C.ink,
        maxWidth: 1460,
        textAlign: "center",
      }}>
        {line.speech}
      </div>
    </div>
  );
};

/** 右上角章节条：第几场 / 共几场，场名。 */
const Chapter: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const i = SCENES.findIndex((s, k) => t >= s.start && (k + 1 === SCENES.length || t < SCENES[k + 1].start));
  const s = SCENES[Math.max(0, i)];
  return (
    <div style={{ position: "absolute", right: 72, top: 54, textAlign: "right" }}>
      <div style={{ fontFamily: FONT.mono, fontSize: FT.label, letterSpacing: 3, color: C.inkFaint }}>
        {String(s.chapterIndex).padStart(2, "0")} / {String(SCENES.length).padStart(2, "0")}
      </div>
      <div style={{ fontFamily: FONT.sans, fontSize: FT.label, color: C.inkDim, marginTop: 6 }}>{s.chapter}</div>
    </div>
  );
};

export const Char2: React.FC<{ music?: string | null; narration?: string | null }> = ({ music = null, narration = null }) => (
  <AbsoluteFill style={{ background: C.bg }}>
    {music ? <Audio src={staticFile(music)} volume={0.16} /> : null}
    {narration ? <Audio src={staticFile(narration)} volume={1} /> : null}
    {SCENES.map((s, i) => {
      const from = Math.round(s.start * FPS);
      const to = i + 1 < SCENES.length ? Math.round(SCENES[i + 1].start * FPS) : TOTAL;
      return (
        <Sequence key={s.id} from={from} durationInFrames={Math.max(1, to - from)} name={s.id}>
          {SCENE_COMPONENTS[s.id] ? React.createElement(SCENE_COMPONENTS[s.id]) : null}
        </Sequence>
      );
    })}
    <Chapter />
    <Subtitle />
  </AbsoluteFill>
);

export const CHAR2_TOTAL = TOTAL;
export const CHAR2_FPS = FPS;
