/**
 * 动作数据（data/char2/anim.json）的读取层。
 *
 * anim.json 由 scripts/char2/anim.py 在宿主侧算好：每帧每根骨一个**局部增量四元数**，
 * 加 root 的世界平移。渲染端不做插值、不做 FK——它只把数字搬到骨骼上，
 * 于是"画面里的动作"和"门禁量的动作"必然是同一份数字（gate_anim.py 读的是同一个文件）。
 */
import animJson from "../../data/char2/anim.json";
import specJson from "../../data/char2/spec.json";

export type ClipName = "idle" | "wave" | "turn" | "walk";

type Key = { f: number; q: Record<string, [number, number, number, number]>; t: [number, number, number] };
type Clip = { frames: number; loop?: boolean; planted?: boolean; keys: Key[] };

const ANIM = animJson as unknown as { fps: number; height: number; bones: string[]; clips: Record<string, Clip> };

export const SPEC = specJson as unknown as {
  palette: { yellow: number[]; cream: number[]; tan: number[]; grey: number[]; eye: number[]; variants: Record<string, number[]> };
  patch: { t: number; rx: number; rz: number };
  clips: { fps: number; list: Record<string, { frames: number; loop: boolean; planted: boolean }> };
  model: { glb: string; verts: number; tris: number; bones: number; boneOrder: string[] };
  gates: Record<string, unknown>;
};

export const FPS = ANIM.fps;
export const HEIGHT = ANIM.height;
export const BONES: string[] = ANIM.bones;

/** 某一段动作在第 f 帧的姿态。loop 的片段用 f % frames（末帧是第 0 帧的重复）。 */
export const poseAt = (clip: ClipName, f: number): Key => {
  const c = ANIM.clips[clip];
  if (!c) throw new Error("no clip " + clip);
  const idx = c.loop ? ((f % c.frames) + c.frames) % c.frames : Math.max(0, Math.min(c.frames - 1, f));
  const k = c.keys[idx];
  return k ?? c.keys[0];
};

/** 一段动作按"播放速度"映射到影片帧，clamp 在片段长度内（末帧停住）。 */
export const clipFrame = (clip: ClipName, filmFrame: number, start: number, speed = 1): number => {
  const c = ANIM.clips[clip];
  if (!c) return 0;
  return Math.max(0, Math.min(c.frames - 1, Math.round((filmFrame - start) * speed)));
};

export const clipFrames = (clip: ClipName): number => ANIM.clips[clip].frames;

/** 在两个调色板颜色之间插值（渲染端统一用 spec 里的颜色）。 */
export const mixColor = (a: number[], b: number[], t: number): [number, number, number] =>
  [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t) as [number, number, number];
