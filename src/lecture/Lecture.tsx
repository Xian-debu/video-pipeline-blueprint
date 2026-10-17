import React from "react";
import { AbsoluteFill, Sequence, interpolate, useCurrentFrame, useVideoConfig, Audio, staticFile } from "remotion";
import { C, FONT } from "../design/tokens";
import { SceneShell, ChapterBar, fadeFramesFor } from "../design/Scene";
import { Build, CountRoll, ArcSwap } from "../design/primitives";
import { Math as Tex, MathLine } from "../design/Math";
import { SCENES, FPS, STEPS, STATS, CODE, CAPTIONS } from "./script";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const Head: React.FC<{ kicker: string; title: string; goal?: string; kickerColor?: string }> = ({ kicker, title, goal, kickerColor = C.cyan }) => (
  <div>
    <div style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: 3, color: kickerColor }}>{kicker}</div>
    <div style={{ fontFamily: FONT.serif, fontSize: 54, marginTop: 6, lineHeight: 1.15 }}>{title}</div>
    {goal ? <div style={{ fontSize: 21, color: C.inkFaint, marginTop: 8 }}>{goal}</div> : null}
  </div>
);

const Card: React.FC<{ label?: string; accent?: string; children: React.ReactNode; style?: React.CSSProperties; pad?: string }> = ({
  label,
  accent = C.cyan,
  children,
  style,
  pad = "20px 24px",
}) => (
  <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 16, padding: pad, ...style }}>
    {label ? <div style={{ fontFamily: FONT.mono, fontSize: 16, letterSpacing: 2, color: accent, marginBottom: 8 }}>{label}</div> : null}
    {children}
  </div>
);

const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  const chips = ["分治", "原地划分", "期望 O(n log n)", "严格证明", "真实 trace"];
  return (
    <SceneShell>
      <ChapterBar chapter="开场" index={1} total={SCENES.length} progress={Math.min(1, f / 240)} />
      <div style={{ marginTop: 96 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 22, letterSpacing: 4, color: C.cyan }}>ALGORITHM / QUICKSORT</div>
        <div style={{ fontFamily: FONT.serif, fontSize: 108, marginTop: 10, letterSpacing: 2 }}>快速排序</div>
        <Build at={12}>
          <div style={{ fontSize: 32, color: C.inkDim, marginTop: 10 }}>从直觉，到实测，到一条完整的证明</div>
        </Build>
        <div style={{ display: "flex", gap: 12, marginTop: 30 }}>
          {chips.map((c, i) => (
            <Build key={c} at={20 + i * 6}>
              <div style={{ padding: "9px 18px", borderRadius: 999, border: "1px solid " + C.panelLine, color: i === 4 ? C.cyan : C.inkDim, fontSize: 21 }}>{c}</div>
            </Build>
          ))}
        </div>
        <Build at={56}>
          <div style={{ marginTop: 44, fontSize: 24, color: C.inkFaint }}>全片 5 分钟 · 9 章 · 所有数字来自同一台机器上的真实执行</div>
        </Build>
      </div>
      <div style={{ position: "absolute", right: 72, bottom: 68, textAlign: "right", fontFamily: FONT.mono, fontSize: 17, color: C.inkFaint, letterSpacing: 3 }}>
        CODE-DRIVEN LECTURE
        <div style={{ fontSize: 17, letterSpacing: 1 }}>2026</div>
      </div>
    </SceneShell>
  );
};

const SIdea: React.FC = () => {
  const f = useCurrentFrame();
  const swapP = interpolate(f, [560, 660], [0, 1], clamp);
  return (
    <SceneShell>
      <ChapterBar chapter="直觉" index={2} total={SCENES.length} progress={Math.min(1, f / 1140)} />
      <Head kicker="01 / 分治与不变式" title="三步里只有一步真的在动" goal="合并为什么可以省掉，代价又压在哪里" />
      <div style={{ display: "flex", gap: 20, marginTop: 28 }}>
        {[
          { n: "01", t: "划分 Partition", d: "选基准，把数组劈成「不大于」和「大于」两段", hot: true },
          { n: "02", t: "递归 Recurse", d: "基准已就位，两段各自再排" },
          { n: "03", t: "合并 Merge", d: "不需要：原地排序，没有额外合并成本" },
        ].map((s, i) => (
          <Build key={s.t} at={10 + i * 8} style={{ flex: 1 }}>
            <Card accent={s.hot ? C.coral : C.cyan} label={s.n} style={{ height: 134, borderColor: s.hot ? "rgba(251,113,133,0.45)" : C.panelLine }}>
              <div style={{ fontSize: 27, fontFamily: FONT.serif }}>{s.t}</div>
              <div style={{ fontSize: 19, color: C.inkDim, marginTop: 6, lineHeight: 1.5 }}>{s.d}</div>
            </Card>
          </Build>
        ))}
      </div>
      <Build at={300}>
        <div style={{ marginTop: 30, fontFamily: FONT.mono, fontSize: 17, letterSpacing: 3, color: C.inkFaint }}>LOMUTO 不变式 · 交换一次</div>
      </Build>
      <Build at={330}>
        <div style={{ marginTop: 10 }}>
          <ArcSwap values={[7, 2, 1, 6, 8, 5, 3, 4]} from={1} to={2} progress={swapP} cell={70} />
        </div>
      </Build>
      <Build at={380}>
        <div style={{ marginTop: 14, display: "flex", gap: 26, fontSize: 20 }}>
          <span style={{ color: C.cyan }}>≤ pivot（已归位）</span>
          <span style={{ color: C.coral }}>&gt; pivot（已归位）</span>
          <span style={{ color: C.inkFaint }}>未处理 → j 之前全部处理完</span>
        </div>
      </Build>
      <Build at={440}>
        <div style={{ marginTop: 24, fontSize: 24, color: C.ink, lineHeight: 1.6, maxWidth: 1520 }}>
          每轮只把 j 处的元素并进左区或右区；i 指向左区末尾，j 之前全部处理完。
        </div>
      </Build>
      <Build at={760}>
        <Card label="为什么不用合并" accent={C.amber} style={{ marginTop: 18 }}>
          <div style={{ fontSize: 22, color: C.inkDim, lineHeight: 1.6 }}>
            基准位置一旦确定就再也不会移动。左右两段排好之后整个数组自然有序——合并是免费的，但划分不是。
          </div>
        </Card>
      </Build>
    </SceneShell>
  );
};

const sceneDur = (id: string) => SCENES.find((s) => s.id === id)!.dur;
const stepAt = (f: number, id: string) => { const dur = sceneDur(id); const lead = 1.0; const span = Math.max(1, dur - lead - 1.2); return Math.max(0, Math.min(STEPS.length - 1, Math.floor(((f / FPS - lead) / span) * STEPS.length))); };

// The trace uses "op" and "p" (the final pivot slot); older drafts used "type"/"i".
const opOf = (st: any): string => st.op ?? st.type;
const iOf = (st: any): number | undefined => (st.i !== undefined ? st.i : st.p);

const opText = (st: (typeof STEPS)[number]) => {
  switch (opOf(st)) {
    case "enter":
      return "进入区间 [" + st.lo + ", " + st.hi + "]，基准 = " + st.array[st.hi as number];
    case "compare":
      return (
        "比较：a[" + st.j + "] = " + st.array[st.j as number] + " 与 pivot = " + st.pivot +
        (st.array[st.j as number] <= (st.pivot as number) ? "，不大于" : "，大于")
      );
    case "swap":
      return "交换 a[" + iOf(st) + "] 与 a[" + st.j + "]";
    case "place":
      return "基准归位到索引 " + iOf(st) + "，区间 [" + st.lo + ", " + st.hi + "] 完成";
    default:
      return "结束";
  }
};

const ArrayRow: React.FC<{ values: number[]; i?: number; j?: number; pivotIdx?: number; lo?: number; hi?: number; cell?: number; fs?: number }> = ({
  values,
  i,
  j,
  pivotIdx,
  lo,
  hi,
  cell = 78,
  fs = 34,
}) => (
  <div style={{ display: "flex", gap: 8, alignItems: "flex-end" }}>
    {values.map((v, idx) => {
      const inRange = lo === undefined || hi === undefined || (idx >= lo && idx <= hi);
      const isPivot = idx === pivotIdx;
      const isI = idx === i;
      const isJ = idx === j;
      const color = isPivot ? C.amber : isI ? C.cyan : isJ ? C.coral : C.panelLine;
      return (
        <div key={idx} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
          <div
            style={{
              width: cell,
              height: cell,
              borderRadius: 10,
              border: "2px solid " + color,
              background: isPivot ? "rgba(251,191,36,0.12)" : isI ? "rgba(94,234,212,0.12)" : isJ ? "rgba(251,113,133,0.12)" : C.panel,
              opacity: inRange ? 1 : 0.32,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT.mono,
              fontSize: fs,
              color: C.ink,
            }}
          >
            {v}
          </div>
          <div style={{ fontFamily: FONT.mono, fontSize: 15, color: isI ? C.cyan : isJ ? C.coral : C.inkFaint, height: 18 }}>
            {isI ? "i" : isJ ? "j" : isPivot ? "p" : ""}
          </div>
        </div>
      );
    })}
  </div>
);

const STrace: React.FC = () => {
  const f = useCurrentFrame();
  const k = stepAt(f, "trace");
  const st = STEPS[k];
  const swaps = STEPS.slice(0, k + 1).filter((s) => opOf(s) === "swap").length;
  const comps = STEPS.slice(0, k + 1).filter((s) => opOf(s) === "compare").length;
  const pivotIdx = opOf(st) === "place" ? (iOf(st) as number) : st.pivot !== undefined && st.pivot !== null ? st.array.indexOf(st.pivot as number) : undefined;
  return (
    <SceneShell>
      <ChapterBar chapter="运行实例" index={3} total={SCENES.length} progress={k / STEPS.length} />
      <Head kicker="02 / 真实执行（TRACE，不是手绘）" title="一次划分，看得见每一次比较" goal="八个数，三十四步，每一步都是真的跑出来的" />
      <div style={{ marginTop: 28, display: "flex", gap: 26, alignItems: "flex-start" }}>
        <div style={{ flex: 1 }}>
          <ArrayRow values={st.array} i={iOf(st)} j={st.j} pivotIdx={pivotIdx} lo={st.lo} hi={st.hi} cell={80} fs={36} />
          <Card style={{ marginTop: 18 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: 16, color: C.inkFaint, letterSpacing: 2 }}>
              STEP {k + 1} / {STEPS.length} · {st.type.toUpperCase()}
            </div>
            <div style={{ fontSize: 29, marginTop: 6, fontFamily: FONT.mono }}>{opText(st)}</div>
          </Card>
          <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
            <Card label="比较" pad="10px 20px" style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 32, color: C.cyan }}>{comps}</div>
            </Card>
            <Card label="交换" accent={C.coral} pad="10px 20px" style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 32, color: C.coral }}>{swaps}</div>
            </Card>
            <Card label="区间" accent={C.amber} pad="10px 20px" style={{ flex: 1 }}>
              <div style={{ fontFamily: FONT.mono, fontSize: 28 }}>[{st.lo ?? 0}, {st.hi ?? 7}]</div>
            </Card>
          </div>
        </div>
        <Card label="当前 pivot" accent={C.amber} style={{ width: 240 }}>
          <div style={{ fontFamily: FONT.mono, fontSize: 56, color: C.amber }}>{st.pivot ?? "—"}</div>
          <div style={{ fontSize: 18, color: C.inkFaint, marginTop: 6 }}>取区间最后一个元素</div>
        </Card>
      </div>
    </SceneShell>
  );
};

type TNode = { id: string; lo: number; hi: number; p: number; depth: number; parent: string | null };

const TREE: TNode[] = [
  { id: "0-7", lo: 0, hi: 7, p: 4, depth: 0, parent: null },
  { id: "0-2", lo: 0, hi: 2, p: 3, depth: 1, parent: "0-7" },
  { id: "4-7", lo: 4, hi: 7, p: 6, depth: 1, parent: "0-7" },
  { id: "0-1", lo: 0, hi: 1, p: 1, depth: 2, parent: "0-2" },
  { id: "6-7", lo: 6, hi: 7, p: 8, depth: 2, parent: "4-7" },
];

const SRecursion: React.FC = () => {
  const f = useCurrentFrame();
  const kidsOf = (id: string) => TREE.filter((n) => n.parent === id);
  const slots: Record<string, number> = {};
  let cursor = 0;
  const place = (n: TNode): number => {
    const kids = kidsOf(n.id);
    if (kids.length === 0) {
      slots[n.id] = cursor++;
      return slots[n.id];
    }
    const xs = kids.map(place);
    slots[n.id] = (xs[0] + xs[xs.length - 1]) / 2;
    return slots[n.id];
  };
  const roots = TREE.filter((n) => n.parent === null);
  roots.forEach(place);
  const maxSlot = Math.max(1, cursor - 1);
  const AREA = 1180;
  const NW = 250;
  const xOf = (n: TNode) => 60 + (slots[n.id] / maxSlot) * (AREA - NW);
  const yOf = (n: TNode) => 10 + n.depth * 128;
  return (
    <SceneShell>
      <ChapterBar chapter="递归树" index={4} total={SCENES.length} progress={Math.min(1, f / 540)} />
      <Head kicker="02 / 递归结构" title="好的划分把问题对半劈开" goal="树的深度就是栈的深度，也是复杂度的形状" />
      <div style={{ marginTop: 20, position: "relative", height: 430 }}>
        <svg width={1320} height={430} style={{ position: "absolute", left: 0, top: 0 }}>
          {TREE.filter((n) => n.parent).map((n) => {
            const par = TREE.find((m) => m.id === n.parent)!;
            const x1 = xOf(par) + NW / 2;
            const y1 = yOf(par) + 76;
            const x2 = xOf(n) + NW / 2;
            const y2 = yOf(n);
            const grow = interpolate(f, [14 + n.depth * 16, 34 + n.depth * 16], [0, 1], clamp);
            return (
              <path
                key={"e" + n.id}
                d={"M " + x1 + " " + y1 + " L " + x1 + " " + (y1 + (y2 - y1) / 2) + " L " + x2 + " " + (y1 + (y2 - y1) / 2) + " L " + x2 + " " + y2}
                stroke={C.panelLine}
                strokeWidth={2}
                fill="none"
                pathLength={1}
                strokeDasharray={1}
                strokeDashoffset={1 - grow}
              />
            );
          })}
        </svg>
        {TREE.map((n) => {
          const o = interpolate(f, [8 + n.depth * 14, 30 + n.depth * 14], [0, 1], clamp);
          return (
            <div
              key={n.id}
              style={{
                position: "absolute",
                left: xOf(n),
                top: yOf(n),
                width: NW,
                opacity: o,
                transform: "translateY(" + (1 - o) * 12 + "px)",
                padding: "12px 18px",
                borderRadius: 12,
                border: "1px solid " + (n.depth === 0 ? C.cyan : C.panelLine),
                background: n.depth === 0 ? "rgba(94,234,212,0.10)" : C.panel,
                fontFamily: FONT.mono,
                fontSize: 22,
              }}
            >
              [{n.lo}..{n.hi}]
              <span style={{ color: C.inkFaint, marginLeft: 12, fontSize: 17 }}>n={n.hi - n.lo + 1} · p={n.p}</span>
            </div>
          );
        })}
      </div>
      <Build at={90}>
        <div style={{ marginTop: 10, fontSize: 23, color: C.inkDim, lineHeight: 1.6 }}>
          理想情况每层把区间对半，深度约 log₂ n；最坏情况每次只切掉一个元素，深度接近 n——这正是后面要修的问题。
        </div>
      </Build>
    </SceneShell>
  );
};

const SComplexity: React.FC = () => {
  const f = useCurrentFrame();
  const rows: any[] = [
    { k: "最好", f: "T(n) = 2T(n/2) + \\Theta(n)", r: "\\Theta(n\\log n)", c: C.cyan },
    { k: "最坏", f: "T(n) = T(n-1) + \\Theta(n)", r: "\\Theta(n^2)", c: C.coral },
    { k: "平均", f: "随机 pivot 的期望", plain: true, r: "O(n\\log n)", c: C.ink },
  ];
  return (
    <SceneShell>
      <ChapterBar chapter="复杂度" index={5} total={SCENES.length} progress={Math.min(1, f / 780)} />
      <Head kicker="03 / 三种命运" title="同一份代码，三种命运" goal="先看结论，再看实测：理论值和真实数字必须对上" />
      <div style={{ marginTop: 20 }}>
        {rows.map((r, i) => (
          <Build key={r.k} at={10 + i * 12}>
            <div style={{ display: "flex", alignItems: "center", gap: 26, padding: "10px 0", borderBottom: "1px solid " + C.panelLine }}>
              <div style={{ width: 80, fontSize: 25, color: r.c }}>{r.k}</div>
              <div style={{ flex: 1 }}>
                {r.plain ? <div style={{ fontSize: 26 }}>{r.f}</div> : <Tex tex={r.f} size={29} align="left" />}
              </div>
              <div style={{ width: 280, textAlign: "right" }}>
                <Tex tex={r.r} size={33} color={r.c} align="right" />
              </div>
            </div>
          </Build>
        ))}
      </div>
      <div style={{ display: "flex", gap: 18, marginTop: 24 }}>
        <Build at={54} style={{ flex: 1 }}>
          <Card label="已排序输入 · n = 1000" accent={C.coral}>
            <CountRoll to={499500} start={58} dur={40} size={52} color={C.coral} />
            <div style={{ fontSize: 19, color: C.inkDim, marginTop: 6 }}>正好等于 n(n-1)/2 = 499,500</div>
          </Card>
        </Build>
        <Build at={62} style={{ flex: 1 }}>
          <Card label="随机输入 · n = 1000">
            <CountRoll to={10969} start={66} dur={40} size={52} color={C.cyan} />
            <div style={{ fontSize: 19, color: C.inkDim, marginTop: 6 }}>上界 2n ln n = 13,815.5</div>
          </Card>
        </Build>
      </div>
    </SceneShell>
  );
};

const PROOF = [
  { tex: "X_{ij} = 1\\ \\text{若 } i,j \\text{ 被比较过，否则 } 0", no: "(1)" },
  { tex: "C = \\sum_{1 \\le i < j \\le n} X_{ij}", no: "(2)" },
  { tex: "\\mathbb{E}[C] = \\sum_{i<j} \\Pr(X_{ij} = 1)", no: "(3)" },
  { tex: "\\Pr(X_{ij} = 1) = \\frac{2}{\\,j - i + 1\\,}", no: "(4)" },
  { tex: "\\mathbb{E}[C] = \\sum_{k=1}^{n-1} (n-k)\\frac{2}{k+1} \\le 2n\\sum_{k=1}^{n}\\frac{1}{k} = 2n H_n", no: "(5)" },
  { tex: "H_n \\le \\ln n + 1 \\ \\Longrightarrow\\ \\mathbb{E}[C] \\le 2n\\ln n + 2n = O(n\\log n)", no: "(6)" },
];

const SProof: React.FC = () => {
  const f = useCurrentFrame();
  const sec = f / FPS;
  const active = sec < 12 ? 0 : sec < 22 ? 1 : sec < 32 ? 2 : sec < 42 ? 3 : sec < 56 ? 4 : 5;
  return (
    <SceneShell>
      <ChapterBar chapter="严格证明" index={6} total={SCENES.length} progress={Math.min(1, f / 2220)} />
      <Head kicker="04 / 期望比较次数" title="E[C] ≤ 2n ln n" goal="对任意固定输入，只对随机基准取期望" />
      <div style={{ marginTop: 18, display: "flex", gap: 24 }}>
        <div style={{ flex: 1.62 }}>
          <Card pad="8px 20px">
            {PROOF.map((p, i) => (
              <Build key={p.no} at={6 + i * 10} dy={8}>
                <MathLine tex={p.tex} no={p.no} size={i === 5 ? 24 : 26} active={active === i} dim={i > active} />
              </Build>
            ))}
          </Card>
          <Build at={330}>
            <div style={{ marginTop: 12, fontSize: 20, color: C.inkFaint, lineHeight: 1.5 }}>
              第 (5) 步是唯一需要「放大」的地方：把 2/(k+1) 放大成 2/k，才凑出调和级数。
            </div>
          </Build>
        </div>
        <div style={{ flex: 0.78, display: "flex", flexDirection: "column", gap: 14 }}>
          <Card label="关键观察" accent={C.cyan}>
            <div style={{ fontSize: 21, lineHeight: 1.5 }}>区间 [i, j] 内第一个被选中的基准恰好是 i 或 j</div>
            <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(94,234,212,0.08)", borderRadius: 10 }}>
              <Tex tex={"\\Pr = \\frac{2}{j-i+1}"} size={28} color={C.cyan} align="left" />
            </div>
          </Card>
          <Build at={120}>
            <Card label="为什么是「第一个」" accent={C.amber}>
              <div style={{ fontSize: 18, color: C.inkDim, lineHeight: 1.55 }}>
                先选中区间内部元素，i 与 j 立刻被分到两侧，此后不再相遇。只有先选中端点，两者才会被比较一次。
              </div>
            </Card>
          </Build>
          <Build at={180}>
            <Card label="n = 1000 校验">
              <div style={{ fontSize: 19, lineHeight: 1.6 }}>
                上界 2n ln n = 13,815.5
                <br />
                实测随机输入 10,969
              </div>
            </Card>
          </Build>
          <Build at={2100}>
            <Card label="结论" accent={C.cyan}>
              <div style={{ fontSize: 21, lineHeight: 1.5 }}>期望 O(n log n)；最坏仍 Θ(n²)</div>
            </Card>
          </Build>
        </div>
      </div>
    </SceneShell>
  );
};

const SOptimize: React.FC = () => {
  const f = useCurrentFrame();
  const rnd = STATS?.results?.random ?? {};
  const ORDER: [string, string][] = [
    ["lomuto", "Lomuto"],
    ["hoare", "Hoare"],
    ["random", "随机化"],
    ["three_way", "三路"],
    ["hybrid_mo3", "混合 mo3"],
  ];
  const bars = ORDER.filter(([k]) => rnd[k]).map(([k, label]) => ({ variant: label, cmp: rnd[k].cmp, swap: rnd[k].swap }));
  const maxC = bars.length ? Math.max(...bars.map((b: any) => b.cmp)) : 1;
  return (
    <SceneShell>
      <ChapterBar chapter="工程优化" index={7} total={SCENES.length} progress={Math.min(1, f / 1320)} />
      <Head kicker="05 / 四个洞" title="把最坏情况压回去" goal="每一个优化都对应前面暴露过的一个具体失效" />
      <div style={{ display: "flex", gap: 16, marginTop: 20 }}>
        {[
          { t: "随机化 pivot", d: "期望与输入无关，杜绝「已排序即最坏」" },
          { t: "三路划分", d: "重复键一次分完，全相等降到 O(n)" },
          { t: "小数组阈值", d: "≤16 个元素走插入排序，常数更小" },
          { t: "introsort", d: "超过 2log n 层转堆排序，最坏 O(n log n)" },
        ].map((o, i) => (
          <Build key={o.t} at={8 + i * 8} style={{ flex: 1 }}>
            <Card accent={i === 1 ? C.cyan : C.inkDim} style={{ height: 130 }}>
              <div style={{ fontSize: 23, fontFamily: FONT.serif }}>{o.t}</div>
              <div style={{ fontSize: 18, color: C.inkDim, marginTop: 6, lineHeight: 1.5 }}>{o.d}</div>
            </Card>
          </Build>
        ))}
      </div>
      <Build at={52}>
        <div style={{ marginTop: 24 }}>
          <div style={{ fontSize: 19, color: C.inkFaint, marginBottom: 8 }}>随机输入，n = 1000，比较次数（同机实测）</div>
          <div style={{ display: "flex", gap: 24, alignItems: "flex-end", height: 240 }}>
            {bars.map((b: any, i: number) => {
              const h = 22 + 190 * (b.cmp / maxC);
              const grow = interpolate(f, [60 + i * 5, 92 + i * 5], [0, 1], clamp);
              return (
                <div key={b.variant} style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                  <div style={{ fontFamily: FONT.mono, fontSize: 18, color: C.inkDim }}>{b.cmp.toLocaleString("en-US")}</div>
                  <div style={{ width: "60%", height: h * grow, background: i === 3 ? C.cyan : C.panelLine, borderRadius: "8px 8px 0 0" }} />
                  <div style={{ fontSize: 18, color: i === 3 ? C.cyan : C.inkDim }}>{b.variant}</div>
                </div>
              );
            })}
          </div>
        </div>
      </Build>
      <Build at={300}>
        <div style={{ marginTop: 18, fontSize: 22, color: C.inkDim, lineHeight: 1.55 }}>
          全相等时：Lomuto 499,500 次 vs 三路 1,000 次 —— 差 499.5 倍。这就是「重复键」这个洞的真实代价。
        </div>
      </Build>
    </SceneShell>
  );
};

const SCode: React.FC = () => {
  const f = useCurrentFrame();
  const st = STEPS[stepAt(f, "code")];
  const hl =
    opOf(st) === "compare" ? 10 : opOf(st) === "swap" ? 12 : opOf(st) === "place" ? 13 : opOf(st) === "enter" ? 2 : 14;
  const upto = STEPS.indexOf(st) + 1;
  const comps = STEPS.slice(0, upto).filter((s) => opOf(s) === "compare").length;
  const swaps = STEPS.slice(0, upto).filter((s) => opOf(s) === "swap").length;
  return (
    <SceneShell>
      <ChapterBar chapter="代码执行" index={8} total={SCENES.length} progress={Math.min(1, f / 660)} />
      <Head kicker="06 / 真实 Python 实现" title="高亮行 = 正在执行的那一步" goal="源码、trace、画面三者对得上" />
      <div style={{ marginTop: 20, display: "flex", gap: 22 }}>
        <Card pad="14px 18px" style={{ flex: 1.3, background: "#0A1018" }}>
          {CODE.map((line, i) => {
            const n = i + 1;
            const isHl = n === hl + 1;
            return (
              <div
                key={n}
                style={{
                  display: "flex",
                  gap: 16,
                  padding: "1px 10px",
                  borderRadius: 6,
                  background: isHl ? "rgba(94,234,212,0.13)" : "transparent",
                  borderLeft: "3px solid " + (isHl ? C.cyan : "transparent"),
                }}
              >
                <span style={{ width: 24, textAlign: "right", fontFamily: FONT.mono, fontSize: 19, color: C.inkFaint }}>{n}</span>
                <span style={{ fontFamily: FONT.mono, fontSize: 19, color: isHl ? C.cyan : C.ink, whiteSpace: "pre" }}>{line}</span>
              </div>
            );
          })}
        </Card>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 12 }}>
          <Card label={"区间 [" + (st.lo ?? 0) + ", " + (st.hi ?? 7) + "]"}>
            <ArrayRow values={st.array} i={iOf(st)} j={st.j} cell={50} fs={23} />
          </Card>
          <Card label="执行计数" accent={C.coral}>
            <div style={{ display: "flex", gap: 34 }}>
              <div>
                <div style={{ fontFamily: FONT.mono, fontSize: 15, color: C.inkFaint }}>比较</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 32, color: C.cyan }}>{comps}</div>
              </div>
              <div>
                <div style={{ fontFamily: FONT.mono, fontSize: 15, color: C.inkFaint }}>交换</div>
                <div style={{ fontFamily: FONT.mono, fontSize: 32, color: C.coral }}>{swaps}</div>
              </div>
            </div>
          </Card>
          <div style={{ fontSize: 18, color: C.inkFaint, lineHeight: 1.55 }}>
            这份 trace 由真实 Python 执行产出：每次比较、每次交换都记录在案，视频只是把数据画出来。
          </div>
        </div>
      </div>
    </SceneShell>
  );
};

const SOutro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <SceneShell>
      <ChapterBar chapter="结论" index={9} total={SCENES.length} progress={Math.min(1, f / 420)} />
      <div style={{ marginTop: 110 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: 21, letterSpacing: 3, color: C.cyan }}>07 / 结论</div>
        <div style={{ fontFamily: FONT.serif, fontSize: 86, marginTop: 8 }}>快，是有结构的</div>
        <div style={{ marginTop: 34, display: "flex", flexDirection: "column", gap: 16, fontSize: 26, color: C.inkDim }}>
          {[
            "常数小：原地交换，缓存友好",
            "期望稳：随机化把最坏输入变成普通输入",
            "最坏可控：introsort 给出 O(n log n) 下界",
          ].map((t, i) => (
            <Build key={t} at={20 + i * 16}>
              <div style={{ display: "flex", gap: 14, alignItems: "center" }}>
                <div style={{ width: 7, height: 7, borderRadius: 99, background: C.coral }} />
                {t}
              </div>
            </Build>
          ))}
        </div>
        <Build at={110}>
          <div style={{ marginTop: 36, fontSize: 23, color: C.inkFaint }}>
            算法不是背下来的复杂度，而是一条能被检查、证明与修补的路径。
          </div>
        </Build>
      </div>
    </SceneShell>
  );
};

const Subtitle: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const line = CAPTIONS.find((c) => t >= c.from && t < c.to);
  if (!line) return null;
  const local = (t - line.from) / (line.to - line.from);
  const o = interpolate(local, [0, 0.05, 0.95, 1], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 48, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          background: "rgba(6,10,16,0.84)",
          border: "1px solid rgba(120,140,165,0.25)",
          borderRadius: 12,
          padding: "11px 26px",
          fontSize: 29,
          color: "#EDF2F8",
          maxWidth: 1500,
          textAlign: "center",
          lineHeight: 1.45,
        }}
      >
        {line.text}
      </div>
    </div>
  );
};

const SCENE_COMPONENTS: Record<string, React.FC> = {
  open: SOpen,
  idea: SIdea,
  trace: STrace,
  recursion: SRecursion,
  complexity: SComplexity,
  proof: SProof,
  optimize: SOptimize,
  code: SCode,
  outro: SOutro,
};

const FADE = 0;

/**
 * 选段策略：**不再用 TransitionSeries 交叉淡化**。
 * 实测：交叉淡化期间两个场景同时可见（14 帧），文字互相叠影 + 双层 opacity 相乘
 * 造成一次「暗一下再亮回来」的假闪烁，肉眼比硬切更难受。
 * 改为硬切 + 每场自带的「内容淡入/淡出到背景」：任一时刻只有一场在屏，亮度连续。
 */
export const QuicksortLecture: React.FC<{ music?: string | null; narration?: string | null }> = ({
  music = "music/qsort_v2.wav",
  narration = null,
}) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink }}>
    {music ? <Audio src={staticFile(music)} volume={0.18} /> : null}
    {narration ? <Audio src={staticFile(narration)} volume={1} /> : null}
    {SCENES.map((s, i) => {
      const Comp = SCENE_COMPONENTS[s.id];
      const from = SCENES.slice(0, i).reduce((acc, x) => acc + x.dur * FPS, 0);
      return (
        <Sequence key={s.id} from={from} durationInFrames={s.dur * FPS}>
          <Comp />
        </Sequence>
      );
    })}
    <Subtitle />
  </AbsoluteFill>
);
