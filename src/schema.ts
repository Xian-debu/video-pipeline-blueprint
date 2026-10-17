export type SceneKind = "title" | "image" | "graphic" | "video" | "outro";
export type CaptionPos = "bottom" | "center" | "top";
export type Transition = "fade" | "slide" | "none";

export type CaptionItem = {
  from: number;
  to: number;
  text: string;
  pos?: CaptionPos;
};

export type Scene = {
  id: string;
  kind: SceneKind;
  durationInFrames: number;
  plate?: string;
  bg?: string;
  fg?: string;
  title?: string;
  subtitle?: string;
  bullets?: string[];
  captions?: CaptionItem[];
  transitionIn?: Transition;
  kenBurns?: number;
};

export type Storyboard = {
  id: string;
  fps: number;
  width: number;
  height: number;
  scenes: Scene[];
  audio?: { narration?: string; music?: string; volumeDb?: number };
  debug?: boolean;
};

export const totalFrames = (s: Storyboard): number =>
  s.scenes.reduce((a, sc) => a + sc.durationInFrames, 0);

export const sceneStart = (s: Storyboard, index: number): number =>
  s.scenes.slice(0, index).reduce((a, sc) => a + sc.durationInFrames, 0);
