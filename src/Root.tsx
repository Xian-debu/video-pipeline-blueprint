import React from "react";
import { Composition } from "remotion";
import { StoryboardFilm } from "./storyboard/Film";
import { DEMO_STORYBOARD } from "./storyboard/default";
import { DEMO_FILM } from "./storyboard/demo";
import { totalFrames } from "./schema";
import { QuicksortLecture } from "./lecture/Lecture";
import { TOTAL as LECTURE_FRAMES, FPS as LECTURE_FPS } from "./lecture/script";
import { Transitions } from "./showcase/Transitions";
import { Typesetting } from "./showcase/Typesetting";
import { ThreeCube } from "./showcase/ThreeCube";
import { ManimOverlay } from "./showcase/ManimOverlay";

/**
 * 注册的 Composition 分三类：
 *   1) Storyboard / Showreel —— 通用分镜模板，输入 Storyboard JSON 即可出片
 *   2) Lecture               —— 本次验证过的 305 s 教学片（quicksort），数据来自真实执行
 *   3) Transitions / Typesetting / ThreeCube / ManimOverlay —— 单项能力的最小样张
 *
 * Lecture 的默认配乐指向 public/music/score.wav（由 scripts/audio/render_music.mjs 生成）。
 * 旁白默认关闭：先跑 scripts/tts/synthesize.py 产出 public/voice/narration.wav，
 * 再把 narration 传成 "voice/narration.wav"（见 docs/deployment.md 第 4 步）。
 */
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Storyboard"
        component={StoryboardFilm}
        durationInFrames={totalFrames(DEMO_STORYBOARD)}
        fps={DEMO_STORYBOARD.fps}
        width={DEMO_STORYBOARD.width}
        height={DEMO_STORYBOARD.height}
        defaultProps={{ storyboard: DEMO_STORYBOARD }}
      />
      <Composition
        id="Showreel"
        component={StoryboardFilm}
        durationInFrames={totalFrames(DEMO_FILM)}
        fps={DEMO_FILM.fps}
        width={DEMO_FILM.width}
        height={DEMO_FILM.height}
        defaultProps={{ storyboard: DEMO_FILM }}
      />
      <Composition
        id="Lecture"
        component={QuicksortLecture}
        durationInFrames={LECTURE_FRAMES}
        fps={LECTURE_FPS}
        width={1920}
        height={1080}
        defaultProps={{ music: "music/score.wav", narration: null }}
      />
      <Composition id="Transitions" component={Transitions} durationInFrames={178} fps={30} width={1920} height={1080} />
      <Composition id="Typesetting" component={Typesetting} durationInFrames={240} fps={30} width={1920} height={1080} />
      <Composition id="ThreeCube" component={ThreeCube} durationInFrames={120} fps={30} width={1280} height={720} />
      <Composition id="ManimOverlay" component={ManimOverlay} durationInFrames={60} fps={30} width={1920} height={1080} />
    </>
  );
};
