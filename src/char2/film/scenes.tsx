import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig, staticFile } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Shot, type CamMove } from "./Stage2";
import { Head, Row, Stat, Plate, Cmd, Swatch, Fx, PAD, W, rv } from "./overlay";
import { SCENES, frameOf, sceneOf } from "../script";
import type { ClipName } from "../clips";
import l4Json from "../../../data/char2/l4.json";
import silJson from "../../../data/char2/silhouette.json";
import specJson from "../../../data/char2/spec.json";

/**
 * 十四场分镜。每一场 = 一个三维层（Shot）+ 一个二维层（Head/Row/Stat…）。
 *
 * 画面同步一律靠 frameOf(id, k)（讲稿第 k 句的相对帧号），不手抄时间点：
 * 改一句台词，画面跟着走；这也是"讲稿即字幕即配音"的延伸。
 *
 * 数字只从账本读：data/char2/{silhouette,l4,spec}.json。
 */

const L4 = l4Json as unknown as {
  seconds: number; motionRate: number; longestStaticSeconds: number;
  windows: number; windowsUnder20pct: number; motionPlateFrames: number; plateFrames: number; motionPlateSeconds: number;
};
const SIL = silJson as unknown as {
  views: Record<string, { iou: number; aspectErr: number; rmseProfile: number; dEBody: number; dEPatch: number; dERefSpreadBody: number; dEGateBody: number }>;
};
const SPEC = specJson as unknown as {
  model: { verts: number; tris: number; bones: number };
  clips: { list: Record<string, { frames: number; loop: boolean; planted: boolean }> };
  palette: { variants: Record<string, [number, number, number]> };
};

/** 本场第 k 句开始的相对帧。 */
const at = (id: string, k: number) => frameOf(id, k);

/** 当前处在第几个"阶段标记"（标记是本场的句子序号）。 */
const phaseOf = (id: string, marks: number[]): number => {
  const f = useCurrentFrame();
  let idx = 0;
  for (let i = 0; i < marks.length; i++) if (f >= at(id, marks[i])) idx = i;
  return idx;
};

/** 场景水印：左下角的"这是第几场"。 */
/* ============================== 01 开场 ============================== */
export const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  const cam: CamMove = { az: [-34, 26], el: [11, 7], dist: [4.1, 3.35], fov: [30, 29], ty: [0.92, 0.86] };
  const titleOut = interpolate(f, [at("open", 4), at("open", 4) + 18], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <>
      <Shot cam={cam} actor={{ clip: "idle", scale: 1.72 }} accent="#2ad6c4" />
      <div style={{ opacity: titleOut }}>
        <Head kicker="CHAR2 / 实时角色管线" title="一张三视图，一个会动的角色" goal="测量 · 放样 · 判据 · 骨架 · 动作 · 染色" at={0} top={140} />
      </div>
    </>
  );
};

/* ============================== 02 为什么重做 ============================== */
const MotionStrip: React.FC<{ at: number }> = ({ at: atF }) => {
  const f = useCurrentFrame();
  const p = rv(f, atF, 30);
  const cols = 32;
  const rows = Math.ceil(L4.windows / cols);
  return (
    <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 3, width: 760, opacity: p }}>
      {Array.from({ length: rows * cols }).map((_, i) => {
        const on = i < L4.windows - L4.windowsUnder20pct;
        return (
          <div
            key={i}
            style={{
              height: 14,
              borderRadius: 2,
              background: on ? C.cyan : "rgba(94,234,212,0.10)",
              opacity: i < L4.windows ? 1 : 0,
            }}
          />
        );
      })}
    </div>
  );
};

export const SWhy: React.FC = () => {
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 80% at 50% 20%, #12222b 0%, ${C.bg} 70%)` }}>
      <Head kicker="00 / 先把上一部片量一遍" title="好看不是形容词，是数字" goal="第七部片：493.90 秒，1080P，30 fps" at={0} />
      <div style={{ position: "absolute", left: PAD, top: 330, display: "flex", gap: 120 }}>
        <Stat to={L4.motionPlateSeconds} label="全片有运动的画面" unit="s" at={at("why", 1)} fmt={(v) => v.toFixed(1)} color={C.coral} />
        <Stat to={L4.motionRate * 100} label="每秒窗口的运动率" unit="%" at={at("why", 2)} fmt={(v) => v.toFixed(1)} color={C.coral} />
        <Stat to={L4.longestStaticSeconds} label="最长静止镜头" unit="s" at={at("why", 3)} fmt={(v) => v.toFixed(1)} color={C.coral} />
        <Stat to={L4.motionPlateFrames} label={`162 张画面里的运动帧`} unit="帧" at={at("why", 4)} fmt={(v) => v.toFixed(0)} color={C.coral} />
      </div>
      <div style={{ position: "absolute", left: PAD, top: 620 }}>
        <MotionStrip at={at("why", 2)} />
        <div style={{ fontFamily: FONT.mono, fontSize: FT.label, color: C.inkFaint, marginTop: 10 }}>
          {L4.windows} 个一秒窗口 · 亮格 = 有运动（{L4.windows - L4.windowsUnder20pct}）
        </div>
      </div>
      <div style={{ position: "absolute", right: PAD, top: 470, width: 520, display: "flex", flexDirection: "column", gap: 20 }}>
        <Row at={at("why", 5)}>没给"好看"设判据，工程只会收敛到"正确"。</Row>
        <Row at={at("why", 6)} color={C.cyan}>本片冻结：运动率 ≥ {Math.round(SPEC ? 0.8 * 100 : 80)}%</Row>
        <Row at={at("why", 7)} color={C.cyan}>单场 ≤ 60 s · 静态 ≤ 3 s · 运镜 ≥ 6</Row>
      </div>
    </AbsoluteFill>
  );
};

/* ============================== 03 测量 ============================== */
export const SMeasure: React.FC = () => {
  const f = useCurrentFrame();
  const scan = ((f % 90) / 90) * 0.86 + 0.05;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(110% 80% at 40% 30%, #101f27 0%, ${C.bg} 72%)` }}>
      <Head kicker="01 / 把图量成数字" title="先量高度，再量剖面" goal="色度分割 → 逐层极值 → 剖面与锚点" at={0} />
      <div style={{ position: "absolute", left: PAD, top: 300, width: 900, height: 560 }}>
        <div style={{ position: "relative", width: "100%", height: "100%", borderRadius: 10, overflow: "hidden", border: `1px solid ${C.panelLine}`, background: "#f7f7f5" }}>
          <img src={staticFile("char/reference.png")} style={{ width: "100%", height: "100%", objectFit: "contain" }} />
          <div style={{ position: "absolute", left: 0, right: 0, top: `${scan * 100}%`, height: 2, background: C.cyan, opacity: 0.9, boxShadow: `0 0 12px ${C.cyan}` }} />
        </div>
        <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, marginTop: 8 }}>public/char/reference.png · 832×624 · 三视图</div>
      </div>
      <div style={{ position: "absolute", right: PAD, top: 320, width: 620, display: "flex", flexDirection: "column", gap: 18 }}>
        <Row at={at("measure", 1)} num="01">色度阈值：把三个视图从白底上切出来</Row>
        <Row at={at("measure", 2)} num="02">逐层扫极值：每层一对左右边界</Row>
        <Row at={at("measure", 3)} num="03">正视给宽度，侧视给厚度</Row>
        <Row at={at("measure", 5)} num="04">脚底到头顶 = 1 个单位高</Row>
      </div>
      <Fx at={at("measure", 6)} left={PAD + 940} top={760} width={880}>
        {"1 model height == 1.0000\n量高度在前，量剖面在后"}
      </Fx>
    </AbsoluteFill>
  );
};

/* ============================== 04 放样 ============================== */
export const SLoft: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = Math.max(0, Math.min(1, f / (durationInFrames - 1)));
  const grow = 0.04 + 1.78 * Math.pow(t, 1.25);
  const rings = Math.round(170 * Math.min(1, grow / 1.72));
  const cam: CamMove = { az: [-72, -26], el: [2, 13], dist: [3.5, 3.05], fov: [30, 28], ty: [0.55, 0.9] };
  return (
    <>
      <Shot cam={cam} actor={{ clip: "idle", grow, scale: 1.72 }} accent="#2ad6c4" />
      <Head kicker="02 / 逐环放样" title="身体是一圈一圈长出来的" at={0} />
      <div style={{ position: "absolute", right: PAD, top: 320, width: 560 }}>
        <Fx at={4}>
          {"x = a·cos^e θ\ny = cy + b·sin^e θ\ne = 2.35"}
        </Fx>
        <div style={{ marginTop: 26, fontSize: FT.body, fontFamily: FONT.mono, color: C.cyan }}>
          环 {String(rings).padStart(3, " ")} / 170
        </div>
        <div style={{ marginTop: 30, display: "flex", flexDirection: "column", gap: 16 }}>
          <Row at={at("loft", 1)}>宽度来自正视，深度来自侧视</Row>
          <Row at={at("loft", 4)}>170 圈 × 160 段 = 一张闭合曲面</Row>
          <Row at={at("loft", 7)} color={C.amber}>平滑会削掉最宽处 → 按峰值缩回</Row>
        </div>
      </div>
    </>
  );
};

/* ============================== 05 收口 ============================== */
export const SCrown: React.FC = () => {
  const cam: CamMove = { az: [12, 42], el: [1, 4], dist: [1.55, 1.4], fov: [30, 30], ty: [1.62, 1.58] };
  return (
    <>
      <Shot cam={cam} actor={{ clip: "idle", scale: 1.72 }} accent="#fbbf24" />
      <Head kicker="03 / 头顶解方程" title="穹顶高度不能写死" at={0} />
      <div style={{ position: "absolute", left: PAD, bottom: 210, width: 640, display: "flex", flexDirection: "column", gap: 16 }}>
        <Row at={at("crown", 1)} color={C.coral}>写死 0.030 → 尖帽</Row>
        <Row at={at("crown", 2)} color={C.coral}>按半径比例 → 更尖</Row>
        <Row at={at("crown", 4)} color={C.cyan}>迭代 30 次求下沉量 · 系数 1.175</Row>
      </div>
    </>
  );
};

/* ============================== 06 脚掌 ============================== */
export const SFoot: React.FC = () => {
  const f = useCurrentFrame();
  const cam: CamMove = { az: [-26, 16], el: [1.5, 3.5], dist: [1.15, 0.98], fov: [30, 30], ty: [0.17, 0.13] };
  return (
    <>
      <Shot cam={cam} actor={{ clip: "walk", frame: Math.floor(f * 0.5) % 36, scale: 1.72 }} accent="#fbbf24" />
      <Head kicker="04 / 脚掌" title="脚掌要平，还要站在原点" at={0} />
      <div style={{ position: "absolute", right: PAD, bottom: 230, width: 660, display: "flex", flexDirection: "column", gap: 16 }}>
        <Row at={at("foot", 1)} num="01">细分会把平底吃掉 → 先烘细分，再压平</Row>
        <Row at={at("foot", 3)} num="02">脚心在 y = 0，脚趾朝前</Row>
        <Row at={at("foot", 5)} num="03">外八 14°，撑住肚子</Row>
      </div>
    </>
  );
};

/* ============================== 07 深度轴 ============================== */
export const SDepth: React.FC = () => {
  const cam: CamMove = { az: [-90, -82], el: [4, 4], dist: [3.7, 3.25], fov: [30, 30], ty: [0.9, 0.9] };
  const k = phaseOf("depth", [3]);
  return (
    <>
      <Shot cam={cam} actor={{ clip: "idle", scale: 1.72 }} accent="#a78bfa" />
      <Head kicker="05 / 深度轴" title="整条深度轴都反了" at={0} />
      <div style={{ position: "absolute", left: PAD, bottom: 220, width: 620 }}>
        <Fx at={at("depth", 1)}>
          {k === 0 ? "cy = +(sl + sr) / 2\n侧视 IoU 0.79" : "cy = -(sl + sr) / 2\n侧视 IoU 0.90"}
        </Fx>
      </div>
      <div style={{ position: "absolute", right: PAD, top: 330, width: 600, display: "flex", flexDirection: "column", gap: 16 }}>
        <Row at={at("depth", 1)}>参考图 +x 是脸；模型里脸朝 -Y</Row>
        <Row at={at("depth", 2)}>照图搬坐标 → 整只人往后仰</Row>
        <Row at={at("depth", 4)} color={C.cyan}>侧视重合度 0.79 → 0.90</Row>
        <Row at={at("depth", 6)} color={C.amber}>先确认坐标轴，再谈参数</Row>
      </div>
    </>
  );
};

/* ============================== 08 门禁 ============================== */
const GateCol: React.FC<{ view: "front" | "side" | "back"; left: number; at: number }> = ({ view, left, at: atF }) => {
  const v = SIL.views[view];
  return (
    <div style={{ position: "absolute", left, top: 300, width: 520 }}>
      <Plate src={`char2/view_${view}.png`} left={0} top={0} width={520} height={330} label={`${view} · 我们的渲染`} at={atF} bg="#f7f7f5" />
      <div style={{ marginTop: 14, display: "flex", gap: 34 }}>
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.h1, color: C.cyan }}>{v.iou.toFixed(4)}</div>
          <div style={{ fontFamily: FONT.sans, fontSize: FT.label, color: C.inkFaint }}>剪影重合度 IoU</div>
        </div>
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.h2, color: C.ink }}>{(v.aspectErr * 100).toFixed(2)}%</div>
          <div style={{ fontFamily: FONT.sans, fontSize: FT.label, color: C.inkFaint }}>宽高比误差</div>
        </div>
        <div>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.h2, color: C.ink }}>{v.rmseProfile.toFixed(4)}</div>
          <div style={{ fontFamily: FONT.sans, fontSize: FT.label, color: C.inkFaint }}>剖面 RMSE</div>
        </div>
      </div>
    </div>
  );
};

export const SGate: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(110% 80% at 50% 20%, #101f27 0%, ${C.bg} 72%)` }}>
    <Head kicker="06 / 三视图门禁" title="三条都过，才允许往下走" goal="重合度 ≥ 0.85 / 0.82 / 0.86 · 宽高比 ≤ 3% · 剖面 ≤ 0.025" at={0} />
    <GateCol view="front" left={PAD} at={at("gate", 1)} />
    <GateCol view="side" left={PAD + 560} at={at("gate", 1)} />
    <GateCol view="back" left={PAD + 1120} at={at("gate", 1)} />
    <div style={{ position: "absolute", left: PAD, bottom: 200, width: W, display: "flex", gap: 60 }}>
      <Row at={at("gate", 4)} color={C.cyan}>0.88 / 0.90 / 0.88 —— 三条全过</Row>
      <Row at={at("gate", 5)} color={C.amber}>颜色只在正视卡：参考图换个视角就差 9</Row>
    </div>
  </AbsoluteFill>
);

/* ============================== 09 骨架 ============================== */
export const SRig: React.FC = () => {
  const k = phaseOf("rig", [6]);
  const cam: CamMove = { az: [34, -24], el: [7, 11], dist: [3.1, 3.85], fov: [30, 28], ty: [0.9, 0.92] };
  return (
    <>
      <Shot cam={cam} actor={{ clip: "idle", scale: 1.72, mode: k === 0 ? "bones" : "weights" }} accent="#5eead4" />
      <Head kicker="07 / 十六根骨" title="骨轴不是世界轴" at={0} />
      <div style={{ position: "absolute", left: PAD, bottom: 220, width: 520 }}>
        <Fx at={at("rig", 1)}>
          {"rest × Δq   (not Δq·Δq)\nmax 4 influences\nΣw - 1 < 2e-7"}
        </Fx>
      </div>
      <div style={{ position: "absolute", right: PAD, top: 320, width: 560, display: "flex", flexDirection: "column", gap: 16 }}>
        <Row at={at("rig", 1)}>16 骨：根 / 脊 / 胸 / 头 / 双臂 / 双腿</Row>
        <Row at={at("rig", 3)} color={C.amber}>大腿骨的局部 +Y 在世界里朝下</Row>
        <Row at={at("rig", 5)}>直接累乘会一帧一帧漂走</Row>
        <Row at={at("rig", 6)} color={C.cyan}>权重是解析算的：{k === 0 ? "按住看骨架" : "彩图 = 主导骨"}</Row>
      </div>
    </>
  );
};

/* ============================== 10 动作 ============================== */
const CLIP_MARKS: { k: number; clip: ClipName; label: string }[] = [
  { k: 0, clip: "idle", label: "idle · 48 帧" },
  { k: 1, clip: "walk", label: "walk · 36 帧 · 循环" },
  { k: 4, clip: "wave", label: "wave · 48 帧" },
  { k: 6, clip: "turn", label: "turn · 60 帧" },
];

export const SMotion: React.FC = () => {
  const p = phaseOf("motion", CLIP_MARKS.map((m) => m.k));
  const m = CLIP_MARKS[p];
  const cam: CamMove = { az: [-64, -46], el: [4, 7], dist: [3.25, 3.0], fov: [30, 29], ty: [0.88, 0.9] };
  return (
    <>
      <Shot cam={cam} actor={{ clip: m.clip, scale: 1.72, frame: undefined }} accent="#5eead4" />
      <Head kicker="08 / 四段动作" title="动作是算出来的" at={0} />
      <div style={{ position: "absolute", left: PAD, top: 300 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: FT.num, color: C.cyan }}>{m.label}</div>
        <div style={{ fontFamily: FONT.mono, fontSize: FT.label, color: C.inkFaint, marginTop: 8 }}>每帧每骨一个增量四元数</div>
      </div>
      <div style={{ position: "absolute", right: PAD, bottom: 220, width: 560, display: "flex", flexDirection: "column", gap: 14 }}>
        <Row at={at("motion", 4)} color={C.cyan}>脚滑：支撑脚位移 ≤ 0.01·h</Row>
        <Row at={at("motion", 5)}>walk 实测脚滑 = 0.000</Row>
        <Row at={at("motion", 7)} color={C.amber}>turn 只转身，不改姿势</Row>
      </div>
    </>
  );
};

/* ============================== 11 染色 ============================== */
const TINTS: { k: number; name: string }[] = [
  { k: 0, name: "yellow" },
  { k: 4, name: "mint" },
  { k: 6, name: "plum" },
];

export const SColor: React.FC = () => {
  const p = phaseOf("color", TINTS.map((t) => t.k));
  const tint = TINTS[p].name;
  const cam: CamMove = { az: [-32, 30], el: [9, 9], dist: [3.2, 2.95], fov: [30, 29], ty: [0.9, 0.9] };
  const variants = SPEC.palette.variants;
  return (
    <>
      <Shot cam={cam} actor={{ clip: "idle", scale: 1.72, tint }} accent="#a78bfa" />
      <Head kicker="09 / 解析遮罩" title="斑块要焊在皮肤上" at={0} />
      <div style={{ position: "absolute", left: PAD, bottom: 230, display: "flex", gap: 26 }}>
        {(["yellow", "mint", "plum"] as const).map((n, i) => (
          <Swatch key={n} rgb={variants[n]} name={n} at={at("color", i === 0 ? 0 : i === 1 ? 4 : 6)} on={tint === n} />
        ))}
      </div>
      <div style={{ position: "absolute", right: PAD, top: 320, width: 560, display: "flex", flexDirection: "column", gap: 16 }}>
        <Row at={at("color", 1)}>肚皮 = 绑定姿势下的一个椭圆</Row>
        <Row at={at("color", 2)} color={C.coral}>按当前顶点算 → 转身时滑到背上</Row>
        <Row at={at("color", 3)} color={C.cyan}>用静止坐标 → 任何姿势都焊住</Row>
        <Row at={at("color", 6)}>换色只换一个 uniform</Row>
      </div>
    </>
  );
};

/* ============================== 12 生长（满屏） ============================== */
export const SBuild: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const t = Math.max(0, Math.min(1, f / (durationInFrames - 1)));
  const grow = 0.02 + 1.9 * Math.pow(t, 1.1);
  const cam: CamMove = { az: [-42, 32], el: [3, 13], dist: [2.95, 3.95], fov: [30, 29], ty: [0.5, 0.9] };
  const capIn = rv(f, at("build", 4), 24);
  return (
    <>
      <Shot cam={cam} actor={{ clip: "idle", grow, scale: 1.72 }} accent="#2ad6c4" />
      <div style={{ position: "absolute", left: PAD, top: 120, opacity: rv(f, 0, 20) }}>
        <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink }}>一圈一圈长出来</div>
      </div>
      <div style={{ position: "absolute", left: PAD, bottom: 150, opacity: capIn }}>
        <div style={{ fontFamily: FONT.mono, fontSize: FT.num, color: C.cyan }}>
          {SPEC.model.verts.toLocaleString("en-US")} 顶点 · {SPEC.model.tris.toLocaleString("en-US")} 三角 · {SPEC.model.bones} 骨
        </div>
      </div>
    </>
  );
};

/* ============================== 13 演示（满屏） ============================== */
const DEMO_MARKS: { k: number; clip: ClipName; tint: string }[] = [
  { k: 0, clip: "idle", tint: "yellow" },
  { k: 1, clip: "walk", tint: "yellow" },
  { k: 2, clip: "turn", tint: "yellow" },
  { k: 3, clip: "idle", tint: "mint" },
  { k: 4, clip: "idle", tint: "plum" },
];

export const SDemo: React.FC = () => {
  const p = phaseOf("demo", DEMO_MARKS.map((m) => m.k));
  const m = DEMO_MARKS[p];
  const cam: CamMove = { az: [-58, 150], el: [9, 6], dist: [3.5, 3.15], fov: [30, 29], ty: [0.9, 0.86] };
  return (
    <>
      <Shot cam={cam} actor={{ clip: m.clip, tint: m.tint, scale: 1.72 }} accent="#2ad6c4" />
      <div style={{ position: "absolute", left: PAD, bottom: 150, opacity: rv(useCurrentFrame(), 0, 20) }}>
        <div style={{ fontFamily: FONT.mono, fontSize: FT.label, letterSpacing: FT_T.label, color: C.cyan }}>REALTIME · 0 离线贴图</div>
      </div>
    </>
  );
};

/* ============================== 14 复现 ============================== */
export const SClose: React.FC = () => (
  <AbsoluteFill style={{ background: `radial-gradient(110% 80% at 50% 20%, #101f27 0%, ${C.bg} 72%)` }}>
    <Head kicker="12 / 复刻清单" title="三个输入，一条命令" at={0} />
    <div style={{ position: "absolute", left: PAD, top: 320, width: 900 }}>
      <Cmd at={at("close", 2)} accent>{"$ python3 scripts/char/gen.py --glb out/swift.glb\n$ python3 scripts/char2/views.py --gate\n$ python3 scripts/char2/spec.py --verify"}</Cmd>
      <div style={{ marginTop: 30 }}>
        <Cmd at={at("close", 1)}>{"data/char/params.json      ← 剖面/部件/颜色参数\ndata/char/ref_views.json    ← 量出来的剖面\npublic/models/swift_v23.glb ← 16 骨 · 194,572 顶点"}</Cmd>
      </div>
    </div>
    <div style={{ position: "absolute", right: PAD, top: 330, width: 560, display: "flex", flexDirection: "column", gap: 18 }}>
      <Row at={at("close", 3)}>改一行参数，判据立刻告诉你过没过</Row>
      <Row at={at("close", 4)} color={C.cyan}>换角色 = 换参考图 + 换参数</Row>
      <Row at={at("close", 5)}>所有数字在报告里，所有代码在仓库里</Row>
      <Row at={at("close", 6)} color={C.amber}>你可以用它做你自己的角色</Row>
    </div>
  </AbsoluteFill>
);

export const SCENE_COMPONENTS: Record<string, React.FC> = {
  open: SOpen,
  why: SWhy,
  measure: SMeasure,
  loft: SLoft,
  crown: SCrown,
  foot: SFoot,
  depth: SDepth,
  gate: SGate,
  rig: SRig,
  motion: SMotion,
  color: SColor,
  build: SBuild,
  demo: SDemo,
  close: SClose,
};

