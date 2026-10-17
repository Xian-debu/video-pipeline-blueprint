import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import type { Scene, Storyboard } from "../schema";
import { sceneStart } from "../schema";
import { Caption } from "./Caption";
import { TitleScene } from "./TitleScene";
import { GraphicScene } from "./GraphicScene";
import { ImageScene } from "./ImageScene";
import { PALETTE } from "../theme";

const FADE = 12;

const SceneBody: React.FC<{ scene: Scene }> = ({ scene }) => {
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
      return <AbsoluteFill style={{ background: PALETTE.ink }} />;
  }
};

const SceneShell: React.FC<{ scene: Scene; localFrame: number }> = ({ scene, localFrame }) => {
  const t = scene.transitionIn ?? "fade";
  const opacity = t === "none" ? 1 : interpolate(localFrame, [0, FADE], [0, 1], { extrapolateRight: "clamp" });
  const dx = t === "slide" ? interpolate(localFrame, [0, FADE], [80, 0], { extrapolateRight: "clamp" }) : 0;
  // The background is placed by the scene itself and is NOT faded: fading it would dip the
  // full-frame luminance through the parent colour and read as a blink. Only content fades.
  return (
    <AbsoluteFill style={{ background: scene.bg ?? PALETTE.ink }}>
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

export const StoryboardFilm: React.FC<{ storyboard: Storyboard }> = ({ storyboard }) => {
  const frame = useCurrentFrame();
  const music = storyboard.audio?.music;
  const musicGain = dbToGain(storyboard.audio?.volumeDb ?? 0);
  return (
    <AbsoluteFill style={{ background: PALETTE.ink }}>
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
