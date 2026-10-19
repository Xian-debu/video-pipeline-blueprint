/**
 * 《Hawk：把低功率电器从总电流里认出来》—— 第四部片，论文解读。
 *
 * 唯一真源：章节、讲稿、时长。讲稿即字幕（TTS 输入与字幕同一条字符串），
 * 时间点由实测语音时长（data/hawk/voice.json）决定，不按字数猜。
 *
 * 与 gears 的差别只有一处：论文解读没有 3D，全部是数据图版、公式与原文图版的指示性引用。
 */
import voiceJson from "../../data/hawk/voice.json";

export const FPS = 30;

type SceneSpec = {
  id: string;
  chapter: string;
  kicker: string;
  title: string;
  goal: string;
  lines: string[];
};

/** 讲稿：每场一组，不写时间点（时间点由下面的 layout 计算）。 */
const SPEC: SceneSpec[] = [
  {
    id: "open",
    chapter: "开场",
    kicker: "HAWK / NALM",
    title: "电表不知道谁在用电",
    goal: "从一个所有人都见过的表开始：它只报总数",
    lines: [
      "先想象一个场景：你家里有几十台电器，都在用电。",
      "墙上那个电表，只知道一共用了多少电。",
      "它不知道是空调在耗电，还是那盏忘了关的灯。",
      "这件事有个名字：非侵入式家电负载监测，简称 NALM。",
      "不装任何插座传感器，只从总电流里，反推出谁在用电。",
      "为什么值得做？它直接连着能耗、账单和居家照护。",
      "但要做准，尤其是小功率电器，很难。这篇论文主要针对这个。",
    ],
  },
  {
    id: "problem",
    chapter: "问题",
    kicker: "01 / 两个难点",
    title: "数据贵，小信号听不见",
    goal: "为什么这件事到今天还没被解决",
    lines: [
      "难点有两个。第一个是数据。",
      "训练模型需要家庭真实用电记录，可这种数据非常贵。",
      "公开数据集 UK-DALE 靠长期采集，标注还得靠人盯着时间戳。",
      "而且用电是稀疏的：一天里大部分时间，电器都关着。",
      "类别极不平衡：八成的电器，一天开关不到十次。",
      "第二个难点，是低功率电器本身。",
      "总电流是所有电器之和，小信号被大信号埋在里面。",
      "论文用信噪比来量这件事。",
      "一台四十瓦的加湿器，旁边是一千五百瓦的水壶。",
      "直接看总电流，它的信噪比只有四十一比一千四百八。",
      "也就是说，它几乎听不见。",
    ],
  },
  {
    id: "paper",
    chapter: "论文",
    kicker: "02 / SENSSYS 2024",
    title: "Hawk：两条腿走路",
    goal: "这份工作是什么，谁做的，结论有多硬",
    lines: [
      "论文的题目是 Hawk，一个高效的非侵入式系统。",
      "目标是准确识别低功率电器。",
      "发表于 2024 年的 SenSys，是嵌入式传感系统的顶级会议。",
      "作者来自中科院计算所、国科大和大湾区大学，五位研究者。",
      "他们的目标很具体：用低算力，把低功率电器的 F1 做到九十以上。",
      "方法分两条腿：先造一个便宜又平衡的数据集。",
      "再设计一条足够轻的识别管线。",
      "数据集叫 HawkDATA，管线是稳态差分加投票。",
      "先看结论：采集时间只要基线的七十一分之一。",
      "状态组合数量，是基线的六点三四倍。",
    ],
  },
  {
    id: "concepts",
    chapter: "概念",
    kicker: "03 / 四个约定",
    title: "状态、叠加、签名、时间",
    goal: "只补四个概念，够看懂后面的所有图",
    lines: [
      "进方法之前，先约定四个概念，只四个。",
      "第一个：状态和事件。",
      "电器开着是一种状态，按下开关是一个事件。",
      "状态识别回答现在谁开着，事件识别回答刚刚谁被打开。",
      "第二个概念：叠加。",
      "总电流等于所有电器电流之和，这是基尔霍夫定律。",
      "第三个概念：签名。",
      "不同电器的电流波形不一样，差别来自内部电路。",
      "所以论文按型号识别，而不是按类型。",
      "同样是灯，LED 和白炽灯的波形完全不同。",
      "第四个概念：时间。",
      "要训练模型，每个开关事件都必须知道准确的发生时刻。",
    ],
  },
  {
    id: "gray",
    chapter: "造数据",
    kicker: "04 / 平衡格雷码",
    title: "像做实验一样安排开关",
    goal: "不在真实家庭里等，而是主动安排事件",
    lines: [
      "先解决数据贵的问题。",
      "他们的做法，是不在真实家庭里等，而是把二十二台电器搬进实验室。",
      "每一台都改成可以程序控制，用舵机和继电器模拟人手。",
      "然后像做实验一样，主动安排它们开关。",
      "关键问题是：按什么顺序开关？",
      "如果随机开关，有些组合一辈子也碰不到，有些组合反复出现。",
      "他们用的是平衡格雷码。",
      "格雷码的相邻两个码，只有一位不同。",
      "换成电器，就是一个时刻只有一台电器动作，事件清清楚楚。",
      "平衡，指每一位翻转的次数接近相等。",
      "于是十八台电器被开关的次数，也就接近相等。",
      "可是十八位有二十六万种组合，一轮走完要很久。",
      "于是分组：每组内部走完整格雷码，组与组之间轮流激活。",
      "每一轮只激活少数几组，其余保持关闭，安全，也快。",
      "分组方式、执行顺序、组内起点都随机化，避免重复同样的状态。",
      "结果是训练集三十轮，两千八百八十个事件。",
      "两千五百八十四个不同状态。",
      "验证集十八轮，两千一百一十二个事件。",
      "两边重叠不到百分之十七。",
    ],
  },
  {
    id: "spt",
    chapter: "造数据",
    kicker: "05 / 同步",
    title: "让电压当共同的钟",
    goal: "自动标注靠的不是更准的时钟，而是共享的物理时间",
    lines: [
      "可光有事件序列还不够。",
      "还要知道每个事件发生的精确时刻。",
      "过去是两步：先把两块表对到同一个钟，再各自记下开关时间。",
      "问题是误差会累积。",
      "网络抖动是毫秒级，CPU 响应再抖一下。",
      "所以以前的数据集，最后都要人眼对着波形手工对齐。",
      "Hawk 换了个思路：时间不一定来自晶振，也可以来自物理世界。",
      "家里的电器是并联的，它们共享同一段电压。",
      "于是用同步 ADC 同时采电流和电压。",
      "给每个采样点打上时间戳：第几个电压周期，以及在这个周期里的相位。",
      "周期号由 WiFi 的时间戳计数器确认，相位由采样间隔量化。",
      "所有传感器看到的是同一个电压波形。",
      "所以它们的时间轴天然对齐。",
      "用共享的电压序列，构造出全局的电流序列。",
      "这就是 SPT，共享可感知时间。",
      "实测平均同步误差二十点六微秒。",
      "比 WiFi 时间戳提升百分之五十九。",
      "最大误差六十一点八微秒，是后者的十七点二分之一。",
    ],
  },
  {
    id: "diff",
    chapter: "识别",
    kicker: "06 / 稳态差分",
    title: "不看总量，看变化量",
    goal: "把被大信号淹没的小信号，从差分里捞出来",
    lines: [
      "数据有了，接下来是识别。",
      "这是论文的第二个贡献，核心操作只有一句话。",
      "不看总电流，看总电流的变化。",
      "公式是这样：信噪比等于目标功率，除以其余电器的功率加噪声。",
      "大功率在旁边，分母就很大，小功率永远吃亏。",
      "但如果我们取差分呢？",
      "开关前后两段总电流相减。",
      "背景在短时间内是稳定的，相减之后就抵消了。",
      "剩下的主要是被开关那台电器的功率。",
      "回到加湿器的例子。",
      "直接看，信噪比是四十一比一千四百八。",
      "差分之后，分母只剩差分噪声，大约六十瓦。",
      "信噪比变成三十九比六十。",
      "提升了二十多倍。",
      "这一步叫稳态差分，因为只在稳定状态下取差分。",
      "开关后的暂态被直接跳过，因为它的波形随机，最容易骗过分类器。",
      "差分对之间留一个间隔，通常是三十个周期，也就是零点六秒。",
    ],
  },
  {
    id: "vote",
    chapter: "识别",
    kicker: "07 / 投票",
    title: "一次判断不可靠，那就数票",
    goal: "一条流式管线，加一个后处理",
    lines: [
      "跳过暂态，一段稳定的差分电流，就成了一张指纹。",
      "识别管线是这样的。",
      "先用循环缓冲做周期级相减，得到一个差分波形。",
      "然后做 FFT，取前十次谐波的实部、虚部和幅值。",
      "这组数字交给 XGBoost，输出三十七个类别。",
      "十八台电器各自的开关，再加一个空闲类。",
      "一次分类可能错，但一个窗口里会连续分类很多次。",
      "所以最后加投票。",
      "三十个周期里，同一个类别达到阈值，才上报。",
      "阈值按电器在训练集上使 F1 最大来确定。",
      "比如加湿器的阈值是十二。",
      "投票带来的好处是容错。",
      "它可以容忍若干次漏报，也能容忍少量误报。",
      "整条管线是流式的，一个窗口一个窗口往前走。",
    ],
  },
  {
    id: "eval",
    chapter: "评估",
    kicker: "08 / 实测",
    title: "实验室之外还准不准",
    goal: "状态、事件、公开数据集、两个真实场景、延迟与成本",
    lines: [
      "现在看它到底有多准。",
      "状态识别，在 HawkDATA 上 F1 是九十三点九四。",
      "比最好的已有方法高四十七点九八个百分点。",
      "事件识别，HawkDATA 上九十二点七一。",
      "在公开数据集 BLUED 上是九十七点零七。",
      "比 SOTA 高十一点五七个百分点。",
      "更关键的是野外：模型只在实验室训练过。",
      "住宅场景，五台电器，平均九十六点零二。",
      "办公室，六台里五台是低功率，平均九十四点七六。",
      "背景里还有三十多台没见过的电器，这是一个很苛刻的测试。",
      "速度也够：i7 上三点三一毫秒。",
      "Jetson 上四点零七毫秒。",
      "树莓派 4B 上用六点五九毫秒，都远低于二十毫秒的实时线。",
      "硬件成本：单点十六千赫兹采样，平均四美元十二美分。",
    ],
  },
  {
    id: "limits",
    chapter: "局限",
    kicker: "09 / 边界",
    title: "论文自己承认的五个洞",
    goal: "能读到局限，才知道一项工作能走多远",
    lines: [
      "但论文自己写了局限，这部分同样值得读。",
      "第一，模型只处理二态电器：开和关。",
      "像冰箱这类多状态电器，还需要新的平衡抽象。",
      "第二，它按型号识别，这很准。",
      "但也意味着每换一批电器，就要重新采数据。",
      "第三，十瓦以下、功率持续变化的电器，仍然很难。",
      "第四，电压波动。住宅里电水壶的漏检，主要就是电压在抖。",
      "第五，加湿器是误报最多的电器。",
    ],
  },
  {
    id: "oss",
    chapter: "开源",
    kicker: "10 / 资源",
    title: "代码、数据、许可证",
    goal: "这一节是给想动手的人准备的",
    lines: [
      "最后是开源资源。",
      "这也是我推荐这篇论文的原因之一。",
      "代码和数据集都在 GitHub，仓库名 SenSys24-Hawk。",
      "HawkDATA 有两个版本。",
      "原始版一百二十七点八 GB，逐周期标注版更小。",
      "格式是 NPZ，十六千赫兹。",
      "包含总电流、电压，和十八台电器的单独电流。",
      "四十五百五十八个状态组合，三十二点二小时。",
      "五千七百九十六万个周期。",
      "论文是 CC BY 4.0，可以自由使用，引用即可。",
      "如果你想复现，硬件门槛不高：一套 ADC，一块单片机，一个路由器。",
      "真正的门槛不是钱，是耐心：每个状态组合都要停二十秒。",
      "但你可以先下载数据，用自己的模型试一遍。",
      "再决定要不要搭硬件。",
    ],
  },
  {
    id: "outro",
    chapter: "结语",
    kicker: "11 / 结论",
    title: "先问对问题",
    goal: "回到开头那个电表",
    lines: [
      "回到最开始的问题：电表只知道总数。",
      "Hawk 的答案是：把数据造得又便宜又平衡，把差分做得又轻又稳。",
      "它没有用更贵的硬件，也没有用更大的模型。",
      "这是这篇论文最值得学的地方。",
      "先问对问题，再问怎么算。",
    ],
  },
];

/** 讲稿节奏：中文 4.5 字/秒，句间 0.55 s，场首 1.2 s，场尾 2.2 s。 */
const CPS = 4.5;
const GAP = 0.55;
const LEAD = 1.2;
const TAIL = 2.2;
const MAX_CHARS = 34;

/**
 * 实测每句时长（秒），键 "scene#index"，由 scripts/tts/synthesize_hawk.py 写入。
 */
const MEASURED = voiceJson as Record<string, number>;
const LINE_PAD = 0.35;
const MIN_LINE = 1.4;

const round2 = (v: number) => Math.round(v * 100) / 100;

type Scene = SceneSpec & { dur: number; start: number; chapterIndex: number };
type Line = { start: number; dur: number; speech: string; scene: string; index: number };

const problems: string[] = [];

const built: { scenes: Scene[]; lines: Line[] } = (() => {
  const scenes: Scene[] = [];
  const lines: Line[] = [];
  let cursor = 0;
  SPEC.forEach((s, i) => {
    s.lines.forEach((text, k) => {
      if (text.length > MAX_CHARS) problems.push(s.id + "[" + k + "] " + text.length + " chars: " + text);
      if (text.length < 8) problems.push(s.id + "[" + k + "] too short: " + text);
      const said = MEASURED[s.id + "#" + k];
      if (said) {
        const cps = text.length / said;
        if (cps < 3.6 || cps > 9.0) problems.push(s.id + "[" + k + "] measured " + cps.toFixed(2) + " chars/s: " + text);
      }
    });
    const durs = s.lines.map((t, k) => {
      const said = MEASURED[s.id + "#" + k];
      return Math.max(MIN_LINE, (said ?? t.length / CPS) + LINE_PAD);
    });
    const speech = durs.reduce((a, b) => a + b, 0) + GAP * Math.max(0, s.lines.length - 1);
    const dur = round2(LEAD + speech + TAIL);
    const start = round2(cursor);
    scenes.push({ ...s, dur, start, chapterIndex: i + 1 });
    let t = start + LEAD;
    s.lines.forEach((text, k) => {
      lines.push({ start: round2(t), dur: round2(durs[k]), speech: text, scene: s.id, index: k });
      t += durs[k] + GAP;
    });
    cursor += dur;
  });
  return { scenes, lines };
})();

export const SCENES = built.scenes;
export const LINES = built.lines;

/** 讲稿长度/节奏自查：为空才算通过（scripts/qa/script_check.mjs 会读它）。 */
export const SCRIPT_PROBLEMS = problems;

export const TOTAL_SEC = round2(SCENES.reduce((a, s) => a + s.dur, 0));
export const TOTAL = Math.round(TOTAL_SEC * FPS);

export const STARTS: Record<string, number> = (() => {
  const o: Record<string, number> = {};
  for (const s of SCENES) o[s.id] = Math.round(s.start * FPS);
  return o;
})();

export const CAPTIONS = LINES.map((l) => ({ from: l.start, to: l.start + l.dur, text: l.speech }));

export const linesOf = (id: string) => LINES.filter((l) => l.scene === id);
export const sceneOf = (id: string) => SCENES.find((s) => s.id === id)!;
/** 第 k 句在该场内的开始时间（秒，相对本场）。 */
export const within = (id: string, k: number) => {
  const ls = linesOf(id);
  const l = ls[Math.min(ls.length - 1, Math.max(0, k))];
  return l.start - sceneOf(id).start;
};
/** 第 k 句的相对帧号，场景组件用它同步画面。 */
export const frameOf = (id: string, k: number) => Math.round(within(id, k) * FPS);
