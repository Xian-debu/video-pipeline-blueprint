import React from "react";
import { AbsoluteFill, Audio, Img, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../design/tokens";
import { ChapterBar, SceneShell } from "../design/Scene";
import { Build, CountRoll } from "../design/primitives";
import { SCENES, LINES, TOTAL, FPS, frameOf } from "./script";
import grayJson from "../../data/hawk/gray.json";
import waveJson from "../../data/hawk/wave.json";
import evalJson from "../../data/hawk/eval.json";

/* ---------- 数据类型（由 scripts/generate_hawk_data.py 产出） ---------- */
type SchedRound = { round: number; active: number[] };
type GrayData = {
  code4: { states: string[]; flipsPerBit: number[]; singleFlip: boolean };
  grouped: { stateUngrouped: number; eventsPerRoundGrouped: number; ratio: number; schedule: SchedRound[] };
  paper: {
    trainRounds: number; trainEvents: number; trainStates: number;
    valRounds: number; valEvents: number; valStates: number; overlapPct: number;
  };
};
type WaveData = {
  meta?: { synthetic?: boolean; note?: string };
  series: { t: number[]; total: number[]; diff: (number | null)[] };
  events?: { t: number; appliance: string; on: boolean }[];
  /** others = 论文里的"干扰总量"（其它电器 + 背景），差分那栏是 other（单数）。 */
  sinr: {
    direct: { target: number; others: number; ratio: number };
    diff: { target: number; other?: number; others?: number; ratio: number };
    gainDb: number;
  };
  vote: { threshold: number; counts: Record<string, number>; decided: string };
  window?: { cycles: number; transientCycles: number };
  features?: { harmonics: { k: number; re: number; im: number; mag: number }[] };
};
const GRAY = grayJson as unknown as GrayData;
const WAVE = waveJson as unknown as WaveData;
const EV = evalJson as typeof evalJson;

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const pct = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);
const PAD = G.pad;
const CW = 1920 - PAD * 2;

/* ---------- 通用小件 ---------- */
const Head: React.FC<{ kicker: string; title: string; goal?: string }> = ({ kicker, title, goal }) => (
  <div style={{ position: "absolute", left: PAD, top: 92, width: CW }}>
    <div style={{ fontFamily: FONT.mono, fontSize: FT.label, letterSpacing: FT_T.label, color: C.cyan }}>{kicker}</div>
    <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10, lineHeight: 1.15 }}>{title}</div>
    {goal ? (
      <div style={{ fontFamily: FONT.sans, fontSize: FT.label, color: C.inkFaint, marginTop: 10 }}>{goal}</div>
    ) : null}
  </div>
);

const Card: React.FC<{ label?: string; accent?: string; children: React.ReactNode; style?: React.CSSProperties; pad?: number }> = ({
  label, accent = C.panelLine, children, style, pad = 28,
}) => (
  <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderTop: "2px solid " + accent, borderRadius: 14, padding: pad, ...style }}>
    {label ? (
      <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, letterSpacing: FT_T.meta, color: C.inkFaint, marginBottom: 14 }}>{label}</div>
    ) : null}
    {children}
  </div>
);

const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children, size = FT.mono, color = C.ink, style,
}) => <span style={{ fontFamily: FONT.mono, fontSize: size, color, fontVariantNumeric: "tabular-nums", ...style }}>{children}</span>;

const Body: React.FC<{ children: React.ReactNode; color?: string; size?: number; style?: React.CSSProperties }> = ({
  children, color = C.inkDim, size = FT.body, style,
}) => <div style={{ fontFamily: FONT.sans, fontSize: size, color, lineHeight: 1.6, ...style }}>{children}</div>;

/** 折线：values 归一化到 [lo,hi]。pathLength=1 + dasharray 做确定性描边。 */
const Line: React.FC<{
  /** null = 这一点没有值（例如差分序列的预热段），折线在该处断开，不做差补。 */
  values: (number | null)[]; w: number; h: number; lo: number; hi: number;
  color: string; width?: number; at: number; dur?: number; fill?: boolean;
}> = ({ values, w, h, lo, hi, color, width = 2, at, dur = 40, fill }) => {
  const f = useCurrentFrame();
  const p = pct(f, at, at + dur);
  if (!values.length) return null;
  const span = hi - lo || 1;
  const pts = values.flatMap((v, i) => {
    if (v === null) return [];
    const x = (i / (values.length - 1)) * w;
    const y = h - ((v - lo) / span) * h;
    return [x.toFixed(1) + "," + Math.max(0, Math.min(h, y)).toFixed(1)];
  });
  if (pts.length < 2) return null;
  const solid = values.every((v) => v !== null);
  return (
    <svg width={w} height={h} style={{ display: "block", overflow: "visible" }}>
      {fill && solid ? (
        <polygon points={"0," + h + " " + pts.join(" ") + " " + w + "," + h} fill={color} opacity={0.1 * p} />
      ) : null}
      <polyline
        points={pts.join(" ")}
        fill="none"
        stroke={color}
        strokeWidth={width}
        strokeLinejoin="round"
        pathLength={1}
        strokeDasharray={p + " 1"}
      />
    </svg>
  );
};

/** 原文图版：paper 底 + 细边框 + 「原文」角标，子元素可用百分比坐标叠标注。 */
const Fig: React.FC<{
  id: string; src: string; width: number; at?: number; label?: string; tag?: string; filter?: string; children?: React.ReactNode;
}> = ({ id, src, width, at = 0, label, tag, filter, children }) => {
  const f = useCurrentFrame();
  const p = at === 0 ? 1 : pct(f, at, at + 24);
  return (
    <div style={{ width, opacity: p, position: "relative" }}>
      <div style={{ position: "relative", background: C.paper, borderRadius: 8, overflow: "hidden", border: "1px solid " + C.panelLine, filter }}>
        <Img src={staticFile(src)} style={{ width: "100%", display: "block" }} />
        {children}
        <div style={{
          position: "absolute", left: 0, top: 0, padding: "4px 10px",
          background: "rgba(26,26,23,0.82)", color: C.paper, fontFamily: FONT.mono, fontSize: FT.tiny, letterSpacing: FT_T.micro,
        }}>{"原文 " + (tag ?? id)}</div>
      </div>
      {label ? (
        <div style={{ fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkFaint, marginTop: 8 }}>{label}</div>
      ) : null}
    </div>
  );
};

const Scene: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const f = useCurrentFrame();
  const i = SCENES.findIndex((s) => s.id === id);
  const s = SCENES[Math.max(0, i)];
  const dur = Math.max(1, Math.round(s.dur * FPS));
  return (
    <SceneShell>
      <ChapterBar chapter={s.chapter} index={i + 1} total={SCENES.length} progress={Math.min(1, f / dur)} />
      {children}
    </SceneShell>
  );
};

/* ============================ 01 开场 ============================ */
const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  const total = WAVE.series.total;
  const bgPts = total.length ? total.map((v, i) => ((i / (total.length - 1)) * 1920).toFixed(1) + "," + (905 - (v / 1700) * 130).toFixed(1)).join(" ") : "";
  return (
    <Scene id="open">
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: 0.35 }}>
        {bgPts ? <polyline points={bgPts} fill="none" stroke={C.cyanDeep} strokeWidth={2} /> : null}
      </svg>
      <div style={{ position: "absolute", left: PAD, top: 236, width: 1180 }}>
        <Build at={4}><Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>SENSYS 2024 · 论文解读</Mono></Build>
        <Build at={10}><div style={{ fontFamily: FONT.serif, fontSize: FT.cover, color: C.ink, lineHeight: 1, marginTop: 22, letterSpacing: FT_T.cover }}>HAWK</div></Build>
        <Build at={18}><div style={{ width: 140, height: 3, background: C.cyan, marginTop: 26 }} /></Build>
        <Build at={24}><div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.inkDim, marginTop: 26, lineHeight: 1.25 }}>看不见的用电，怎么被看见</div></Build>
        <Build at={34}><div style={{ fontFamily: FONT.sans, fontSize: FT.body, color: C.inkFaint, marginTop: 22, lineHeight: 1.6 }}>一篇关于「非侵入式电器识别」的论文，<br />以及它为了「造数据」和「认小信号」做的两件事。</div></Build>
        <Build at={48}>
          <div style={{ display: "flex", gap: 28, marginTop: 44, alignItems: "center" }}>
            <Mono size={FT.meta} color={C.inkFaint}>Zijian Wang 等 · 中科院计算所</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>SenSys '24 · Hangzhou</Mono>
          </div>
        </Build>
      </div>
      <Build at={60} style={{ position: "absolute", right: PAD, bottom: 156 }}>
        <Mono size={FT.meta} color={C.inkFaint}>{"全片约 " + Math.round(TOTAL / FPS / 60) + " 分钟 · 12 段"}</Mono>
      </Build>
    </Scene>
  );
};

/* ============================ 02 两个难点 ============================ */
const SProblem: React.FC = () => {
  const f = useCurrentFrame();
  const total = WAVE.series.total;
  const tMax = WAVE.series.t.length ? WAVE.series.t[WAVE.series.t.length - 1] : 4;
  const w = 1000;
  const h = 190;
  const lo = Math.min(...total) - 20;
  const hi = Math.max(...total) + 20;
  const ev = WAVE.events ? WAVE.events.find((e) => e.appliance === "humidifier" && e.on) : undefined;
  const evX = ev ? (ev.t / tMax) * w : 0;
  return (
    <Scene id="problem">
      <Head kicker="01 / 两个难点" title="数据贵，小信号听不见" goal="先看清问题，再谈方法" />
      <div style={{ position: "absolute", left: PAD, top: 262, display: "flex", gap: 40 }}>
        <Card accent={C.amber} style={{ width: 700, height: 300 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: FT.h2, color: C.ink }}>难点一：数据贵</div>
          <Body size={FT.body} style={{ marginTop: 18 }}>
            · BLUED 里 86% 的电器，一天开关不到 10 次<br />
            · 要覆盖不同家庭，就得长期上门采集<br />
            · 采完还得人工标注，错一件就脏一条
          </Body>
          <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 12 }}>
            <Mono size={FT.num} color={C.amber}>1/71.5</Mono>
            <Body size={FT.meta} color={C.inkFaint}>论文里相对基线的采集时间开销</Body>
          </div>
        </Card>
        <Card accent={C.coral} style={{ width: 700, height: 300 }}>
          <div style={{ fontFamily: FONT.sans, fontSize: FT.h2, color: C.ink }}>难点二：小信号听不见</div>
          <Body size={FT.body} style={{ marginTop: 18 }}>
            · 电表只读到「所有电器加起来」的总电流<br />
            · 40W 的加湿器，和 1500W 的电水壶叠在一起<br />
            · 开关瞬间的台阶，被背景电流淹掉
          </Body>
          <div style={{ marginTop: 18, display: "flex", alignItems: "baseline", gap: 12 }}>
            <Mono size={FT.num} color={C.coral}>2.7%</Mono>
            <Body size={FT.meta} color={C.inkFaint}>40W 相对于 1500W 的幅度</Body>
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: PAD, top: 610, width: CW }}>
        <Card label="一段总电流（示意）：1500W 的台阶很显眼，40W 的开关几乎贴着噪声" style={{ width: CW, paddingTop: 18 }}>
          <div style={{ position: "relative", width: w, margin: "0 auto" }}>
            <Line values={total} w={w} h={h} lo={lo} hi={hi} color={C.inkDim} at={20} dur={48} fill />
            {ev ? (
              <React.Fragment>
                <div style={{ position: "absolute", left: evX - 1, top: 0, width: 2, height: h, background: C.coral, opacity: 0.85 }} />
                <div style={{ position: "absolute", left: Math.min(evX + 10, w - 300), top: h - 62 }}>
                  <Mono size={FT.meta} color={C.coral}>{"40W 在这里 · t=" + (ev.t).toFixed(1) + "s"}</Mono>
                </div>
              </React.Fragment>
            ) : null}
          </div>
        </Card>
      </div>
    </Scene>
  );
};

/* ============================ 03 论文与团队 ============================ */
const SPaper: React.FC = () => {
  return (
    <Scene id="paper">
      <Head kicker="02 / 这篇论文" title="Hawk：两条腿走路" goal="SenSys 2024，嵌入式传感系统的顶级会议" />
      <div style={{ position: "absolute", left: PAD, top: 256, display: "flex", gap: 48 }}>
        <Fig id="header" tag="第 1 页" src="hawk/header.png" width={780} at={6} label="第 1 页 · 标题、作者与机构（会议名在页脚）" />
        <div style={{ width: 620 }}>
          <Build at={12}>
            <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.meta }}>作者团队</Mono>
            <Body size={FT.lead} color={C.ink} style={{ marginTop: 12, lineHeight: 1.75 }}>
              Zijian Wang · Xingzhou Zhang · Yifan Wang<br />
              Xiaohui Peng · Zhiwei Xu
            </Body>
            <Body size={FT.body} color={C.inkFaint} style={{ marginTop: 10 }}>
              中国科学院计算技术研究所 · 中国科学院大学 · 大湾区大学
            </Body>
          </Build>
          <Build at={25}>
            <div style={{ height: 1, background: C.panelLine, margin: "26px 0" }} />
            <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.meta }}>核心主张</Mono>
            <Body size={FT.body} color={C.ink} style={{ marginTop: 12 }}>
              与其「采」一个数据集，不如「安排」一个数据集；<br />
              与其硬认总电流，不如先做一次差分。
            </Body>
          </Build>
        </div>
      </div>
      <div style={{ position: "absolute", left: PAD, top: 780, width: CW, display: "flex", gap: 20 }}>
        {[
          { n: "阶段一", t: "数据集构建", c: "平衡格雷码 · 共享可感知时间 · HawkDATA", col: C.cyan },
          { n: "阶段二", t: "事件识别", c: "稳态差分 · 30 周期窗口 · 投票决策", col: C.violet },
        ].map((s, i) => (
          <Build key={s.n} at={40 + i * 10} style={{ flex: 1 }}>
            <Card accent={s.col} style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <Mono size={FT.meta} color={s.col}>{s.n}</Mono>
                <div style={{ fontFamily: FONT.sans, fontSize: FT.h2, color: C.ink }}>{s.t}</div>
              </div>
              <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 8 }}>{s.c}</Body>
            </Card>
          </Build>
        ))}
      </div>
    </Scene>
  );
};

/* ============================ 04 四个概念 ============================ */
const CONCEPTS = [
  { n: "01", zh: "状态", en: "state", d: "每个电器开或关，合成一个状态。18 台电器就是 2¹⁸ 种。" },
  { n: "02", zh: "叠加", en: "superposition", d: "电表读到的总电流，是所有电器电流之和。" },
  { n: "03", zh: "签名", en: "signature", d: "开与关前后两段稳态之间的台阶幅值与波形，就是它的签名。" },
  { n: "04", zh: "时间", en: "shared clock", d: "不同设备采到的点，必须落在同一个时刻上。" },
];
const ConceptGlyph: React.FC<{ i: number }> = ({ i }) => {
  const f = useCurrentFrame();
  const p = pct(f, 30 + i * 6, 48 + i * 6);
  const stroke = C.cyan;
  return (
    <svg width={300} height={96} style={{ display: "block", overflow: "visible", opacity: 0.4 + 0.6 * p }}>
      {i === 0
        ? [0, 1, 2].map((k) => (
            <rect key={k} x={20 + k * 92} y={26} width={66} height={44} rx={6}
              fill={k === 1 ? "rgba(94,234,212,0.18)" : "transparent"} stroke={k === 1 ? stroke : C.panelLine} strokeWidth={2} />
          ))
        : null}
      {i === 1 ? (
        <React.Fragment>
          <polyline points="10,26 90,26 90,64 170,64 170,40 290,40" fill="none" stroke={C.inkFaint} strokeWidth={2} />
          <polyline points="10,50 120,50 120,72 200,72 200,20 290,20" fill="none" stroke={stroke} strokeWidth={2} />
        </React.Fragment>
      ) : null}
      {i === 2 ? (
        <polyline points="10,70 60,70 60,30 120,30 120,58 190,58 190,22 290,22" fill="none" stroke={stroke} strokeWidth={2} />
      ) : null}
      {i === 3 ? (
        <React.Fragment>
          <polyline points={Array.from({ length: 48 }, (_, k) => (10 + k * 6).toFixed(1) + "," + (50 - Math.sin(k / 3) * 22).toFixed(1)).join(" ")}
            fill="none" stroke={stroke} strokeWidth={2} />
          {[0, 1, 2, 3].map((k) => <circle key={k} cx={10 + k * 76} cy={50 - Math.sin((k * 76) / 18) * 22} r={4} fill={C.amber} />)}
        </React.Fragment>
      ) : null}
    </svg>
  );
};
const SConcepts: React.FC = () => {
  return (
    <Scene id="concepts">
      <Head kicker="03 / 四个约定" title="状态、叠加、签名、时间" goal="后面所有的设计，都建立在这四个词上" />
      <div style={{ position: "absolute", left: PAD, top: 300, width: CW, display: "flex", gap: 24 }}>
        {CONCEPTS.map((c, i) => (
          <Build key={c.n} at={10 + i * 8} style={{ flex: 1 }}>
            <Card style={{ height: 430, padding: 26 }}>
              <Mono size={FT.label} color={C.cyanDeep} style={{ letterSpacing: FT_T.meta }}>{c.n}</Mono>
              <div style={{ fontFamily: FONT.serif, fontSize: FT.h2, color: C.ink, marginTop: 10 }}>{c.zh}</div>
              <Mono size={FT.meta} color={C.inkFaint} style={{ display: "block", marginTop: 6 }}>{c.en}</Mono>
              <div style={{ marginTop: 22 }}><ConceptGlyph i={i} /></div>
              <Body size={FT.body} color={C.inkDim} style={{ marginTop: 18 }}>{c.d}</Body>
            </Card>
          </Build>
        ))}
      </div>
    </Scene>
  );
};

/* ============================ 05 平衡格雷码 ============================ */
const SGray: React.FC = () => {
  const f = useCurrentFrame();
  const states = GRAY.code4.states;
  const flips = GRAY.code4.flipsPerBit;
  const g = GRAY.grouped;
  const sched = g.schedule ?? [];
  const cell = 42;
  return (
    <Scene id="gray">
      <Head kicker="04 / 数据集" title="像做实验一样安排开关" goal="让「状态」均匀地出现，而不是等它自己出现" />
      <Card style={{ position: "absolute", left: PAD, top: 268, width: 760 }} label="4 位平衡格雷码：相邻状态只差一位，每一位都翻 4 次">
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {states.slice(0, 16).map((s, i) => {
            const prev = i === 0 ? null : states[i - 1];
            const flip = prev ? s.split("").findIndex((b, k) => b !== prev[k]) : -1;
            const on = pct(f, 16 + i * 1.6, 24 + i * 1.6);
            return (
              <div key={i} style={{ display: "flex", gap: 6, opacity: on }}>
                {s.split("").map((b, k) => (
                  <div key={k} style={{
                    width: cell, height: 28, borderRadius: 4,
                    background: k === flip ? "rgba(94,234,212,0.22)" : C.bgSoft,
                    border: "1px solid " + (k === flip ? C.cyan : C.panelLine),
                    color: b === "1" ? C.ink : C.inkFaint,
                    fontFamily: FONT.mono, fontSize: FT.meta, display: "flex", alignItems: "center", justifyContent: "center",
                  }}>{b}</div>
                ))}
                <div style={{ marginLeft: 10, alignSelf: "center" }}>
                  <Mono size={FT.tiny} color={C.inkFaint}>{"s" + i}</Mono>
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ marginTop: 14, display: "flex", gap: 18 }}>
          {flips.map((n, k) => (
            <Mono key={k} size={FT.meta} color={C.cyan}>{"bit" + k + " × " + n}</Mono>
          ))}
          <Mono size={FT.meta} color={C.inkFaint}>单次只动一个开关</Mono>
        </div>
      </Card>
      <div style={{ position: "absolute", left: PAD + 800, top: 268, width: CW - 800 }}>
        <Card accent={C.cyan} style={{ padding: 26 }}>
          <Body size={FT.body} color={C.inkDim}>不分组，18 台电器要覆盖全部状态：</Body>
          <div style={{ marginTop: 8 }}><CountRoll to={g.stateUngrouped} start={40} dur={36} size={FT.num} /></div>
          <Body size={FT.body} color={C.inkDim} style={{ marginTop: 18 }}>分成 6 组、每组 3 台（示意推导，论文只给一般公式），每轮只要：</Body>
          <div style={{ marginTop: 8, display: "flex", alignItems: "baseline", gap: 16 }}>
            <Mono size={FT.num} color={C.cyan}>{"6 × 2³ = " + g.eventsPerRoundGrouped}</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>{"≈ 1/" + Math.round(g.ratio) + " 的事件量"}</Mono>
          </div>
        </Card>
        <Card style={{ marginTop: 20, padding: 26 }} label={"论文实测：训练 " + GRAY.paper.trainRounds + " 轮 / 验证 " + GRAY.paper.valRounds + " 轮"}>
          <div style={{ display: "flex", gap: 36 }}>
            {[
              { k: "训练事件", v: GRAY.paper.trainEvents },
              { k: "训练状态", v: GRAY.paper.trainStates },
              { k: "验证期间重叠", v: null, s: GRAY.paper.overlapPct + "%" },
            ].map((it) => (
              <div key={it.k}>
                <Mono size={FT.lead} color={C.ink}>{it.s ?? (it.v === null ? "—" : it.v.toLocaleString("en-US"))}</Mono>
                <div style={{ fontFamily: FONT.sans, fontSize: FT.tiny, color: C.inkFaint, marginTop: 4 }}>{it.k}</div>
              </div>
            ))}
          </div>
        </Card>
        <Card style={{ marginTop: 18, padding: 18 }} label={"12 轮里激活的组（示意）"}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {Array.from({ length: 6 }, (_, gi) => (
              <div key={gi} style={{ display: "flex", gap: 6, alignItems: "center" }}>
                <Mono size={FT.tiny} color={C.inkFaint} style={{ width: 34 }}>{"g" + gi}</Mono>
                {Array.from({ length: 12 }, (_, r) => {
                  const on = sched[r] ? sched[r].active.indexOf(gi) >= 0 : false;
                  const shown = pct(f, 60 + r * 2.5, 66 + r * 2.5);
                  return (
                    <div key={r} style={{
                      width: 24, height: 15, borderRadius: 3,
                      background: on ? "rgba(94,234,212," + (0.25 + 0.6 * shown) + ")" : C.bgSoft,
                      border: "1px solid " + (on ? C.cyan : C.panelLine),
                    }} />
                  );
                })}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Scene>
  );
};

/* ============================ 06 共享可感知时间 ============================ */
const SSpt: React.FC = () => {
  const f = useCurrentFrame();
  const N = 220;
  const W = 860;
  const H = 300;
  const sine = Array.from({ length: N }, (_, k) => {
    const x = 20 + (k / (N - 1)) * (W - 40);
    const y = H / 2 - Math.sin((k / (N - 1)) * Math.PI * 4) * 96;
    return x.toFixed(1) + "," + y.toFixed(1);
  }).join(" ");
  const mainDots = Array.from({ length: 7 }, (_, k) => 20 + (k / 6) * (W - 40));
  const off = (W - 40) / 220 * 4.5;
  const reveal = pct(f, 20, 60);
  return (
    <Scene id="spt">
      <Head kicker="05 / 同步" title="让电压当共同的钟" goal="不需要额外布线，只要各设备看同一个电压过零" />
      <Card style={{ position: "absolute", left: PAD, top: 268, width: 940 }} label="三台设备各采各的；只要电压波形对得上，时间就对得上">
        <svg width={W} height={H} style={{ display: "block", overflow: "visible" }}>
          <polyline points={sine} fill="none" stroke={C.cyan} strokeWidth={2} pathLength={1} strokeDasharray={reveal + " 1"} />
          {mainDots.map((x, k) => {
            const y1 = H / 2 - Math.sin((((x - 20) / (W - 40)) * Math.PI * 4)) * 96;
            const x2 = x + off;
            const y2 = H / 2 - Math.sin((((x2 - 20) / (W - 40)) * Math.PI * 4)) * 96;
            const o = pct(f, 30 + k * 4, 38 + k * 4);
            return (
              <React.Fragment key={k}>
                <circle cx={x} cy={y1} r={6} fill={C.amber} opacity={o} />
                <circle cx={x2} cy={y2} r={6} fill={C.violet} opacity={o} />
                <line x1={x} y1={y1} x2={x2} y2={y2} stroke={C.inkFaint} strokeWidth={1} opacity={o * 0.7} />
              </React.Fragment>
            );
          })}
        </svg>
        <div style={{ display: "flex", gap: 26, marginTop: 8 }}>
          <Mono size={FT.tiny} color={C.amber}>● 主计量采样</Mono>
          <Mono size={FT.tiny} color={C.violet}>● 从机采样（有偏移）</Mono>
          <Mono size={FT.tiny} color={C.inkFaint}>电压过零 = 天然时间戳</Mono>
        </div>
      </Card>
      <div style={{ position: "absolute", left: PAD + 980, top: 268, width: CW - 980 }}>
        <Fig id="fig10" tag="Figure 10" src="hawk/fig10.png" width={520} at={34} label="同一时刻的采样误差分布（红线 = 220 µs）">
          <div style={{ position: "absolute", left: "18%", top: 0, width: 2, height: "100%", background: "rgba(251,113,133,0.9)" }} />
        </Fig>
        <div style={{ marginTop: 10 }}>
          <Mono size={FT.tiny} color={C.inkDim}>{"99.65% 的同步误差落在 220 µs 以内"}</Mono>
        </div>
        <div style={{ marginTop: 14 }}>
          <Mono size={FT.num} color={C.cyan}>{EV.sync.maxSyncErrorUs + " µs"}</Mono>
          <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 4 }}>最大同步误差（TSF 的 1/17.2）</Body>
        </div>
      </div>
      <Build at={70} style={{ position: "absolute", left: PAD, top: 700 }}>
        <Body size={FT.lead} color={C.ink}>
          于是「什么时候开的」不需要问人，<span style={{ color: C.cyan }}>数据自己会对齐</span>。
        </Body>
      </Build>
    </Scene>
  );
};

/* ============================ 07 稳态差分 ============================ */
const SDiff: React.FC = () => {
  const total = WAVE.series.total;
  const w = 1080;
  const hTot = 210;
  const hDif = 210;
  const tLo = Math.min(...total) - 20;
  const tHi = Math.max(...total) + 20;
  const N = total.length;
  /** 稳态差分：与 LAG 个电压周期前的自己相减。前 LAG 个点没有历史，留空。 */
  const LAG = 30;
  const d30: (number | null)[] = total.map((v, i) => (i < LAG ? null : v - total[i - LAG]));
  /** 纵轴放大到 ±90W：1500W 的台阶会冲出量程，40W 的台阶正好落在中间看得见。 */
  const zLo = -90;
  const zHi = 90;
  // 找出 +40W 平台（差分后一段稳定落在 18–90W 的区间）和冲出量程的大台阶。
  const plateau = (() => {
    let best = { a: -1, b: -1 };
    let cur = -1;
    d30.forEach((v, i) => {
      const ok = v !== null && v > 18 && v < 90;
      if (ok && cur < 0) cur = i;
      if (cur >= 0 && (!ok || i === N - 1)) {
        if (i - cur > best.b - best.a) best = { a: cur, b: i };
        cur = -1;
      }
    });
    return best;
  })();
  const clipped = d30.map((v, i) => (v === null ? -1 : Math.abs(v) > 90 ? i : -1)).filter((i) => i >= 0);
  const clipAt = clipped.length ? clipped[0] : -1;
  const s = WAVE.sinr;
  return (
    <Scene id="diff">
      <Head kicker="06 / 特征" title="不看总量，看变化量" goal="先减掉上一个稳态，剩下的才是信号" />
      <div style={{ position: "absolute", left: PAD, top: 258, width: w + 40 }}>
        <Card label="总电流：40W 的开关被 1500W 的台阶压得看不见" style={{ width: w + 40, padding: 22 }}>
          <Line values={total} w={w} h={hTot} lo={tLo} hi={tHi} color={C.inkDim} at={10} dur={36} />
        </Card>
        <Card label="稳态差分：与 30 个周期前的自己相减（纵轴放大到 ±90 W）" style={{ width: w + 40, padding: 22, marginTop: 16 }} accent={C.cyan}>
          <div style={{ position: "relative" }}>
            <Line values={d30} w={w} h={hDif} lo={zLo} hi={zHi} color={C.cyan} at={40} dur={40} />
            {plateau.a >= 0 ? (
              <div style={{
                position: "absolute", left: (plateau.a / N) * 100 + "%", width: ((plateau.b - plateau.a) / N) * 100 + "%",
                top: 0, height: hDif, border: "1px dashed " + C.amber, borderRadius: 6, pointerEvents: "none",
              }}>
                <Mono size={14} color={C.amber} style={{ position: "absolute", left: 8, top: 6 }}>{"+40 W 台阶"}</Mono>
              </div>
            ) : null}
            {clipAt >= 0 ? (
              <div style={{ position: "absolute", left: (clipAt / N) * 100 + "%", top: -4, transform: "translateX(-50%)", pointerEvents: "none" }}>
                <Mono size={13} color={C.coral}>{"1500 W 台阶冲出量程"}</Mono>
              </div>
            ) : null}
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: PAD + w + 90, top: 300, width: CW - w - 90 }}>
        <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.meta }}>SINR：信号 / 干扰</Mono>
        <div style={{ marginTop: 18 }}>
          <Body size={FT.meta} color={C.inkFaint}>直接看总电流</Body>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Mono size={FT.num} color={C.coral}>{s.direct.ratio.toFixed(3)}</Mono>
            <Mono size={FT.tiny} color={C.inkFaint}>{s.direct.target + " / " + s.direct.others + " W"}</Mono>
          </div>
          <div style={{ height: 1, background: C.panelLine, margin: "18px 0" }} />
          <Body size={FT.meta} color={C.inkFaint}>差分之后</Body>
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Mono size={FT.num} color={C.cyan}>{s.diff.ratio.toFixed(3)}</Mono>
            <Mono size={FT.tiny} color={C.inkFaint}>{s.diff.target + " / " + (s.diff.other ?? 60) + " W"}</Mono>
          </div>
          <div style={{ height: 1, background: C.panelLine, margin: "18px 0" }} />
          <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
            <Mono size={FT.lead} color={C.amber}>{"+" + s.gainDb.toFixed(1) + " dB"}</Mono>
            <Mono size={FT.tiny} color={C.inkFaint}>可分性提升</Mono>
          </div>
        </div>
        <Build at={80} style={{ marginTop: 34 }}>
          <Body size={FT.meta} color={C.inkFaint} style={{ lineHeight: 1.7 }}>
            窗口取 {WAVE.window ? WAVE.window.cycles : 30} 个电压周期，<br />
            跳过前 {WAVE.window ? WAVE.window.transientCycles : 4} 个瞬态周期。
          </Body>
        </Build>
      </div>
      <Build at={95} style={{ position: "absolute", left: PAD, bottom: 190 }}>
        <Mono size={FT.meta} color={C.inkFaint}>{"示意波形：按论文 §4.1 的 41/1480 与 39/60 复现，不是实测数据"}</Mono>
      </Build>
    </Scene>
  );
};

/* ============================ 08 投票 ============================ */
const SVote: React.FC = () => {
  const f = useCurrentFrame();
  const v = WAVE.vote;
  const cats = Object.keys(v.counts);
  const labels: string[] = [];
  cats.forEach((c) => { for (let k = 0; k < v.counts[c]; k++) labels.push(c); });
  while (labels.length < 30) labels.push(cats[0]);
  const mixed: string[] = [];
  const n = 30;
  for (let i = 0; i < n; i++) mixed.push(labels[Math.floor((i * 13) % n)]);
  const colOf = (c: string) => (c === v.decided ? C.cyan : c === "noise" ? C.amber : C.inkFaint);
  return (
    <Scene id="vote">
      <Head kicker="07 / 决策" title="一次判断不可靠，那就数票" goal="30 个周期各判一次，够票才报" />
      <div style={{ position: "absolute", left: PAD, top: 262, width: 980 }}>
        <Card label="30 个周期的分类结果（每个方块 = 一个周期）" style={{ width: 980, padding: 26 }}>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(10, 1fr)", gap: 10 }}>
            {mixed.map((c, i) => {
              const o = pct(f, 12 + i * 1.3, 20 + i * 1.3);
              return (
                <div key={i} style={{
                  height: 42, borderRadius: 6, opacity: 0.25 + 0.75 * o,
                  background: c === v.decided ? "rgba(94,234,212,0.16)" : "transparent",
                  border: "1px solid " + colOf(c), display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONT.mono, fontSize: FT.micro, color: colOf(c),
                }}>{c === v.decided ? "GO" : c === "noise" ? "NO" : "·"}</div>
              );
            })}
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: PAD + 1030, top: 262, width: CW - 1030 }}>
        <Card accent={C.cyan} style={{ padding: 26 }}>
          <Body size={FT.meta} color={C.inkFaint}>通过阈值</Body>
          <div style={{ marginTop: 6 }}><CountRoll to={v.counts[v.decided]} start={50} dur={30} size={FT.num} color={C.cyan} /></div>
          <div style={{ marginTop: 6 }}>
            <Mono size={FT.meta} color={C.inkFaint}>{"阈值 " + v.threshold + " 票 · 共 30 个周期"}</Mono>
          </div>
          <div style={{ marginTop: 22 }}>
            <div style={{ position: "relative", height: 12, background: C.bgSoft, borderRadius: 6, border: "1px solid " + C.panelLine }}>
              <div style={{
                position: "absolute", left: 0, top: 0, bottom: 0, borderRadius: 6, background: C.cyan,
                width: pct(f, 50, 80) * Math.min(100, (v.counts[v.decided] / 30) * 100) + "%",
              }} />
              <div style={{ position: "absolute", top: -6, bottom: -6, left: (v.threshold / 30) * 100 + "%", width: 2, background: C.coral }} />
            </div>
          </div>
        </Card>
        <Build at={100} style={{ marginTop: 24 }}>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h2, color: C.ink }}>{"判定：" + v.decided}</div>
          <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 8 }}>
            单个周期会看错；30 票里错几票，不影响结论。
          </Body>
        </Build>
      </div>
      <Build at={110} style={{ position: "absolute", left: PAD, bottom: 200 }}>
        <Mono size={FT.meta} color={C.inkFaint}>窗口太短，瞬态占比太高；太长，容易撞上第二次开关。</Mono>
      </Build>
    </Scene>
  );
};

/* ============================ 09 实测 ============================ */
const SEval: React.FC = () => {
  const stats = [
    { k: "HawkDATA · 状态识别", v: EV.headline.stateAvgF1.toFixed(2) + "%", c: "比 SOTA 高 " + EV.headline.stateGainPct + " 个百分点", col: C.cyan },
    { k: "HawkDATA · 事件识别", v: EV.headline.eventAvgF1.toFixed(2) + "%", c: "比 SOTA 高 " + EV.headline.eventGainPct + " 个百分点", col: C.cyan },
    { k: "BLUED · 事件分类", v: EV.blued.hawkAvg.toFixed(2) + "%", c: "MTS-Shapelet " + EV.blued.mtsShapeletAvg.toFixed(2) + "%", col: C.amber },
    { k: "真实场景 · 事件", v: EV.field.residenceAvg.toFixed(2) + " / " + EV.field.officeAvg.toFixed(2) + "%", c: "住宅 / 办公室，都有未知背景电器", col: C.violet },
  ];
  return (
    <Scene id="eval">
      <Head kicker="08 / 实测" title="实验室之外还准不准" goal="两个公开/自建数据集，加两个真实场景" />
      <div style={{ position: "absolute", left: PAD, top: 258, width: CW, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        {stats.map((s, i) => (
          <Build key={s.k} at={8 + i * 8}>
            <Card style={{ padding: 26 }} accent={s.col}>
              <Body size={FT.meta} color={C.inkFaint}>{s.k}</Body>
              <div style={{ marginTop: 8 }}><Mono size={FT.num} color={C.ink}>{s.v}</Mono></div>
              <Body size={FT.tiny} color={C.inkFaint} style={{ marginTop: 8 }}>{s.c}</Body>
            </Card>
          </Build>
        ))}
      </div>
      <div style={{ position: "absolute", left: PAD, top: 800, width: CW }}>
        <Card label={"流式推理延迟（每 20ms 来一个周期，预算 " + EV.latency.realtimeBudgetMs + "ms）"} style={{ padding: 20 }}>
          <div style={{ display: "flex", gap: 44 }}>
            {EV.latency.rows.map((r) => (
              <div key={r.platform} style={{ flex: 1 }}>
                <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                  <Mono size={FT.lead} color={C.cyan}>{r.latencyMs.toFixed(2)} ms</Mono>
                  <Mono size={FT.tiny} color={C.inkFaint}>{r.memMB + " MB"}</Mono>
                </div>
                <Body size={FT.tiny} color={C.inkFaint} style={{ marginTop: 2 }}>{r.platform + " · " + r.cpu}</Body>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </Scene>
  );
};

/* ============================ 10 边界 ============================ */
const LIMITS = [
  { n: "01", t: "加湿器", d: "最高功率的 LC 电路，野外实验误报最多：F1 掉到 85.41%。" },
  { n: "02", t: "< 10W 与连续变化", d: "超低功率、功率连续变化的设备，管线还认不动。" },
  { n: "03", t: "同型号电器", d: "两台一样的灯，电流签名一样，分不开。" },
  { n: "04", t: "电压波动", d: "电水壶的漏检多数来自电压漂移——电阻性负载的电流跟着电压跑。" },
  { n: "05", t: "采集规模", d: "22 台电器、32.2 小时，相对真实家庭的多样性仍不够。" },
];
const SLimits: React.FC = () => {
  const rows = EV.field.rows.filter((r) => r.power === 40 || r.appliance === "LEDLamp24W");
  return (
    <Scene id="limits">
      <Head kicker="09 / 边界" title="论文自己承认的五个洞" goal="这一节是原文 §7 的「Limitations」" />
      <div style={{ position: "absolute", left: PAD, top: 262, width: 1040 }}>
        {LIMITS.map((l, i) => (
          <Build key={l.n} at={10 + i * 9} style={{ marginBottom: 16 }}>
            <div style={{ display: "flex", gap: 20, alignItems: "flex-start" }}>
              <Mono size={FT.meta} color={C.coral} style={{ width: 34, paddingTop: 5 }}>{l.n}</Mono>
              <div style={{ flex: 1, borderLeft: "1px solid " + C.panelLine, paddingLeft: 20 }}>
                <div style={{ fontFamily: FONT.sans, fontSize: FT.lead, color: C.ink }}>{l.t}</div>
                <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 4 }}>{l.d}</Body>
              </div>
            </div>
          </Build>
        ))}
      </div>
      <div style={{ position: "absolute", left: PAD + 1090, top: 290, width: CW - 1090 }}>
        <Card label="Table 4：办公室场景里最低的三行" style={{ padding: 20 }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 70px 74px 74px", rowGap: 10, columnGap: 6 }}>
            {["电器", "功率", "住宅", "办公室"].map((h) => (
              <Mono key={h} size={FT.tiny} color={C.inkFaint}>{h}</Mono>
            ))}
            {rows.map((r) => (
              <React.Fragment key={r.appliance}>
                <Mono size={FT.tiny} color={C.ink}>{r.appliance}</Mono>
                <Mono size={FT.tiny} color={C.inkDim}>{r.power + "W"}</Mono>
                <Mono size={FT.tiny} color={r.residence === null ? C.inkFaint : C.ink}>{r.residence === null ? "—" : r.residence.toFixed(2) + "%"}</Mono>
                <Mono size={FT.tiny} color={r.office === null ? C.inkFaint : C.coral}>{r.office === null ? "—" : r.office.toFixed(2) + "%"}</Mono>
              </React.Fragment>
            ))}
          </div>
        </Card>
        <Build at={70} style={{ marginTop: 22 }}>
          <Body size={FT.meta} color={C.inkFaint} style={{ lineHeight: 1.75 }}>
            值得注意的是：论文没有回避这些。<br />
            它把「为什么掉」也写了出来——<br />
            这类坦白，比再刷一个百分点有用。
          </Body>
        </Build>
      </div>
    </Scene>
  );
};

/* ============================ 11 开源资源 ============================ */
const SOss: React.FC = () => {
  return (
    <Scene id="oss">
      <Head kicker="10 / 资源" title="代码、数据、许可证" goal="论文最后一句给了地址，这里把入口摆出来" />
      <div style={{ position: "absolute", left: PAD, top: 268, width: CW }}>
        <Card accent={C.cyan} style={{ padding: 34 }}>
          <Body size={FT.meta} color={C.inkFaint}>GitHub</Body>
          <div style={{ marginTop: 10 }}><Mono size={FT.lead} color={C.cyan}>{EV.oss.repo}</Mono></div>
          <div style={{ display: "flex", gap: 14, marginTop: 22 }}>
            {EV.oss.includes.map((s) => (
              <div key={s} style={{
                border: "1px solid " + C.panelLine, background: C.bgSoft, borderRadius: 999,
                padding: "6px 16px", fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkDim,
              }}>{s}</div>
            ))}
          </div>
        </Card>
      </div>
      <div style={{ position: "absolute", left: PAD, top: 560, width: CW, display: "flex", gap: 24 }}>
        {[
          { k: "22 台", d: "实验室电器，其中 18 台可编程" },
          { k: "32.2 小时", d: "有效采集时长" },
          { k: "18.91 秒", d: "平均一次开关事件" },
          { k: "0.877", d: "ON 状态类别平衡比（基线 1.22e-4）" },
        ].map((s) => (
          <Card key={s.k} style={{ flex: 1, padding: 24 }}>
            <Mono size={FT.lead} color={C.ink}>{s.k}</Mono>
            <Body size={FT.tiny} color={C.inkFaint} style={{ marginTop: 6 }}>{s.d}</Body>
          </Card>
        ))}
      </div>
      <div style={{ position: "absolute", left: PAD, top: 790, width: CW, display: "flex", justifyContent: "space-between" }}>
        <Build at={60}><Mono size={FT.meta} color={C.inkFaint}>{"许可：" + EV.oss.license + "（论文页面标注）"}</Mono></Build>
        <Build at={66}><Mono size={FT.meta} color={C.inkFaint}>{"DOI：" + EV.oss.doi}</Mono></Build>
      </div>
    </Scene>
  );
};

/* ============================ 12 结论 ============================ */
const SOutro: React.FC = () => {
  return (
    <Scene id="outro">
      <div style={{ position: "absolute", left: PAD, top: 300, width: 1200 }}>
        <Build at={10}><div style={{ fontFamily: FONT.serif, fontSize: FT.display, color: C.ink, lineHeight: 1.2 }}>先问对问题，<br />再问怎么算。</div></Build>
        <Build at={36}><div style={{ width: 120, height: 3, background: C.cyan, marginTop: 30 }} /></Build>
      </div>
      <div style={{ position: "absolute", left: PAD + 1290, top: 320, width: CW - 1290 }}>
        {[
          "数据不是采集来的，是设计出来的。",
          "精度不是换模型换来的，是换特征换来的。",
          "4.12 美元一路的采样，加一个会看电压的钟。",
        ].map((s, i) => (
          <Build key={s} at={44 + i * 10} style={{ marginBottom: 20 }}>
            <div style={{ borderLeft: "1px solid " + C.panelLine, paddingLeft: 16, fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkDim, lineHeight: 1.6 }}>{s}</div>
          </Build>
        ))}
      </div>
      <Build at={80} style={{ position: "absolute", left: PAD, bottom: 180 }}>
        <Mono size={FT.tiny} color={C.inkFaint}>{"HAWK · SenSys 2024 · github.com/WZiJ/SenSys24-Hawk"}</Mono>
      </Build>
    </Scene>
  );
};

/* ============================ 成片壳 ============================ */
const SCENE_COMPONENTS: Record<string, React.FC> = {
  open: SOpen, problem: SProblem, paper: SPaper, concepts: SConcepts, gray: SGray,
  spt: SSpt, diff: SDiff, vote: SVote, eval: SEval, limits: SLimits, oss: SOss, outro: SOutro,
};

const Subtitle: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / FPS;
  const line = LINES.find((c) => t >= c.start && t < c.start + c.dur);
  if (!line) return null;
  const local = (t - line.start) / line.dur;
  const op = interpolate(local, [0, 0.06, 0.94, 1], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", justifyContent: "center", opacity: op }}>
      <div style={{
        background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 12, padding: "10px 26px",
        fontFamily: FONT.sans, fontSize: FT.h2, lineHeight: 1.45, color: C.ink, maxWidth: 1440, textAlign: "center",
      }}>{line.speech}</div>
    </div>
  );
};

export const Hawk: React.FC<{ music?: string | null; narration?: string | null }> = ({ music = null, narration = null }) => {
  return (
    <AbsoluteFill style={{ background: C.bg }}>
      {music ? <Audio src={staticFile(music)} volume={0.16} /> : null}
      {narration ? <Audio src={staticFile(narration)} volume={1} /> : null}
      {SCENES.map((s, i) => {
        const from = Math.round(s.start * FPS);
        const to = i + 1 < SCENES.length ? Math.round(SCENES[i + 1].start * FPS) : TOTAL;
        return (
          <Sequence key={s.id} from={from} durationInFrames={to - from} name={s.id}>
            {SCENE_COMPONENTS[s.id] ? React.createElement(SCENE_COMPONENTS[s.id]) : null}
          </Sequence>
        );
      })}
      <Subtitle />
    </AbsoluteFill>
  );
};

export const HAWK_TOTAL = TOTAL;
export const HAWK_FPS = FPS;
export const HAWK_frameOf = frameOf;
