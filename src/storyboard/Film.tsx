import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { Scene, Storyboard } from "../schema";
import { sceneStart } from "../schema";
import { Caption } from "./Caption";
import { TitleScene } from "./TitleScene";
import { GraphicScene } from "./GraphicScene";
import { ImageScene } from "./ImageScene";
import { PaletteScope, useRole } from "../design/palette";

const FADE = 12;

const SceneBody: React.FC<{ scene: Scene }> = ({ scene }) => {
  const background = useRole("background");
  switch (scene.kind) {
    case "title":
      return <TitleScene scene={scene} />;
    case "graphic":
      return <GraphicScene scene={scene} />;
    case "image":
      return <ImageScene scene={scene} />;
    case "outro":
      return <TitleScene scene={scene} />;
    default:
      return <AbsoluteFill style={{ background }} />;
  }
};

const SceneShell: React.FC<{ scene: Scene; localFrame: number }> = ({ scene, localFrame }) => {
  const background = useRole("background");
  const t = scene.transitionIn ?? "fade";
  const opacity = t === "none" ? 1 : interpolate(localFrame, [0, FADE], [0, 1], { extrapolateRight: "clamp" });
  const dx = t === "slide" ? interpolate(localFrame, [0, FADE], [80, 0], { extrapolateRight: "clamp" }) : 0;
  // The background is placed by the scene itself and is NOT faded: fading it would dip the
  // full-frame luminance through the parent colour and read as a blink. Only content fades.
  return (
    <AbsoluteFill style={{ background: scene.bg ?? background }}>
      <AbsoluteFill style={{ opacity, transform: "translateX(" + dx + "px)" }}>
        <SceneBody scene={scene} />
        {(scene.captions ?? []).map((c, i) => (
          <Caption key={i} item={c} localFrame={localFrame} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

const dbToGain = (db: number) => Math.pow(10, db / 20);

const FilmBody: React.FC<{ storyboard: Storyboard }> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const background = useRole("background");
  const music = storyboard.audio?.music;
  const musicGain = dbToGain(storyboard.audio?.volumeDb ?? 0);
  return (
    <AbsoluteFill style={{ background }}>
      {music ? <Audio src={staticFile(music)} volume={musicGain} /> : null}
      {storyboard.scenes.map((scene, i) => {
        const start = sceneStart(storyboard, i);
        return (
          <Sequence key={scene.id} from={start} durationInFrames={scene.durationInFrames} name={"scene " + (i + 1)}>
            <SceneShell scene={scene} localFrame={frame - start} />
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * 分镜片。preset 决定配色外观（data/design.spec.json 的 palette.presets）；
 * 不传 = 默认预设 = storyboard 族 = 已验收影片的外观，像素不变。
 * 例：npx remotion render Storyboard out/paper.mp4 --props='{"preset":"paper"}'
 */
export const StoryboardFilm: React.FC<{ storyboard: Storyboard; preset?: string }> = ({ storyboard, preset }) =>
  preset === undefined ? (
    // 没有显式 preset 时继承外层 PaletteScope（预设画廊就是这样嵌套的），
    // 最外层没有 Provider 时上下文默认是 storyboard 族 —— 即已验收影片的外观。
    <FilmBody storyboard={storyboard} />
  ) : (
    <PaletteScope preset={preset}>
      <FilmBody storyboard={storyboard} />
    </PaletteScope>
  );
