/**
 * 《ARC：让缓存自己学会平衡》—— 第五部片，论文解读。
 *
 * 素材：Nimrod Megiddo & Dharmendra S. Modha, "ARC: A Self-Tuning, Low Overhead
 * Replacement Cache", USENIX FAST '03, pp. 115-130.
 *
 * 唯一真源：章节、讲稿、时长。讲稿即字幕（TTS 输入与字幕同一条字符串），
 * 时间点由实测语音时长（data/arc/voice.json）决定，不按字数猜。
 *
 * 与第四部片 Hawk 的差别：屏幕上关于 ARC 自己的数字（p 的轨迹、双列表大小、
 * 扫描前后的命中率）都由 scripts/generate_arc_data.py 里的模拟器算出，走「自测」角标；
 * 论文的数字走 data/arc/eval.json 与 claims 账本。两套数字不许混。
 */
import voiceJson from "../../data/arc/voice.json";

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
    kicker: "ARC / FAST '03",
    title: "缓存只记得很少的东西",
    goal: "从一个所有人都遇到过的等待说起",
    lines: [
      "先从一个每个人都遇到过的等待说起。",
      "处理器要一页数据，磁盘要几毫秒才给。",
      "两者之间放一小块更快的存储，叫作缓存。",
      "缓存只装得下 c 页，数据却有千千万万页。",
      "它满的时候再来新页，就必须赶走一页。",
      "赶走谁，决定了以后还能不能命中。",
      "2003 年，两位 IBM 研究者盯上了这个问题。",
      "他们给出的算法叫 ARC：自适应替换缓存。",
    ],
  },
  {
    id: "problem",
    chapter: "问题",
    kicker: "01 / 命中率",
    title: "满的时候，谁该走",
    goal: "把淘汰问题写成一句话",
    lines: [
      "缓存比磁盘小得多，这是它存在的全部意义。",
      "每个请求进来，先问缓存里有没有。",
      "有叫命中，没有叫缺失。",
      "命中率等于命中次数除以请求总数。",
      "命中率每高一个点，磁盘就少读一次。",
      "缺失时缓存已满，必须挑一页淘汰。",
      "挑错了，下一次请求就落空。",
      "最常见也最笨的规则叫 LRU。",
      "它淘汰最久没有被用过的那一页。",
      "这个假设叫 recency：刚用过的，还会再用。",
      "另一个假设叫 frequency：用得多的，值得留下。",
    ],
  },
  {
    id: "gap",
    chapter: "难点",
    kicker: "02 / 为什么需要自适应",
    title: "两个世界，一个参数",
    goal: "为什么固定的策略总有一半是错的",
    lines: [
      "这两个假设，各自都有一个理想世界。",
      "第一个叫 SDD，栈距离分布。",
      "在这个世界里，LRU 就是最优策略。",
      "第二个叫 IRM，独立引用模型。",
      "在这个世界里，最优的是 LFU。",
      "真实负载不属于任何一个世界。",
      "更糟的是，它会在两者之间来回漂移。",
      "于是大家做出一类折中：给个固定份额 p。",
      "p 大更信 recency，p 小更信 frequency。",
      "问题是，p 由谁来定？",
      "论文里 LRU-2 的参数叫 CIP，它直接决定命中率。",
      "换一个缓存大小，同一个参数就不再好用。",
      "作者的原话是：没有哪个事先定好的选择处处都好。",
    ],
  },
  {
    id: "concepts",
    chapter: "概念",
    kicker: "03 / 四个词",
    title: "先把名词说清楚",
    goal: "页、目录、幽灵、份额",
    lines: [
      "后面会反复用到几个词，先一次说清。",
      "页，是缓存搬运的最小单位。",
      "请求流，是一串页号，一个接一个。",
      "缓存只装得下 c 页，目录却可以更大。",
      "目录只记页号、不存数据，所以很便宜。",
      "幽灵目录，记那些最近被淘汰、还可能回来的页。",
      "论文的目录记住 2c 页，缓存只放 c 页。",
      "L1 记只见过一次的页，L2 记见过两次以上的页。",
      "份额 p，是留给 recency 一侧的页数。",
      "固定 p 的策略记作 FRC_p，它是后面的对照组。",
    ],
  },
  {
    id: "dbl",
    chapter: "中间构造",
    kicker: "04 / DBL(2c)",
    title: "一个比缓存大一倍的目录",
    goal: "把 LRU 放进一个更大的框架",
    lines: [
      "作者先不只造一个算法，而是造一个框架。",
      "它管理 2c 页，分成两条 LRU 列表。",
      "L1 装只见过一次的页，L2 装见过两次以上的页。",
      "命中时，页被移到 L2 的最前面。",
      "缺失时分两种：L1 已经有 c 页，就淘汰 L1 的最后。",
      "新页直接进 L2 的最前面。",
      "如果 L1 还不满，先看目录是不是已经满了 2c。",
      "满了就淘汰 L2 的最后，新页进 L1 的最前面。",
      "两条不变量：L1 不超过 c，目录不超过 2c。",
      "这个结构叫 DBL；把参数设成 p 等于 c，它就是 LRU。",
    ],
  },
  {
    id: "class",
    chapter: "策略类",
    kicker: "05 / Π(c)",
    title: "一族策略，一个参数",
    goal: "可调到底是什么意思",
    lines: [
      "现在把 DBL 收紧：缓存里只留最近用过的 c 页。",
      "被淘汰的页只留页号在目录里。",
      "这样得到一族策略，论文记作 Π(c)。",
      "目录分成四张表：T1、B1、T2、B2。",
      "T1 和 T2 在缓存里，B1 和 B2 只是页号。",
      "B1 里的页从 T1 淘汰下来，B2 里的从 T2 淘汰下来。",
      "缺失时，只有两个可能的动作。",
      "淘汰 T1 的最后一页，或者 T2 的最后一页。",
      "固定 p 时，T1 最多 p 页，T2 最多 c 减 p 页。",
      "p 取满就是纯 LRU，取零就只剩频率。",
    ],
  },
  {
    id: "arc",
    chapter: "算法",
    kicker: "06 / ARC(c)",
    title: "让 p 自己动起来",
    goal: "四种情况，两个增量",
    lines: [
      "ARC 就是给 Π(c) 加了一条规则：p 自己动。",
      "整个算法只有四种情况。",
      "情况一：命中，页在 T1 或 T2 里。",
      "把它移到 T2 的最前面，结束。",
      "情况二：命中的是 B1 里的页号。",
      "只见过一次的页又被需要，说明 recency 吃亏了。",
      "于是 p 增大：B1 不小于 B2 时加一。",
      "否则加 B2 除以 B1，B1 越小加得越多。",
      "情况三：命中的是 B2 里的页号，p 减小，减幅对称。",
      "情况四：全新的页，先淘汰，再放进 T1 的最前面。",
      "淘汰的判据只有一句：T1 够大就淘汰 T1，否则淘汰 T2。",
    ],
  },
  {
    id: "walk",
    chapter: "自适应",
    kicker: "07 / p 的舞步",
    title: "p 跟着负载走",
    goal: "这不是调参，是学习",
    lines: [
      "四个增量里藏着一个很干净的直觉。",
      "B1 命中，说明 recency 分到的太少。",
      "B2 命中，说明 frequency 分到的太少。",
      "每次只挪一点点，p 就在 0 和 c 之间游走。",
      "作者的原话是：p 跟着负载的曲子在跳舞。",
      "我们用同一套算法，在自己的合成负载上跑了一遍。",
      "缓存 256 页，记录每一次 p 的变化。",
      "p 从 0 出发，走到 256，又走回来。",
      "没有一行代码告诉它该选哪个值。",
      "论文在真实负载 P4 上，看到的是同样的舞步。",
    ],
  },
  {
    id: "scan",
    chapter: "扫描抵抗",
    kicker: "08 / 一次扫描",
    title: "只被看一次的页，不该住下来",
    goal: "扫描抵抗",
    lines: [
      "最后一个性质，叫扫描抵抗。",
      "想象有人顺序读一个大文件，每页只读一次。",
      "这些页永远不该挤掉真正在用的页。",
      "在 ARC 里，新页一律先放进 T1 的最前面。",
      "它们从 T1 的最后面被淘汰，碰不到 T2。",
      "所以 T2 里那些反复被用的页，一动不动。",
      "我们做了一次自测：先让 3000 次带热点的请求填满缓存。",
      "再顺序读 3000 个新页，命中率为零，这很正常。",
      "扫描结束时，ARC 的 T2 里还有 118 页。",
      "而 LRU 的缓存，已经被新页冲刷干净。",
      "紧接着的 100 次请求：ARC 命中 40%，LRU 18%。",
    ],
  },
  {
    id: "measure",
    chapter: "实验",
    kicker: "09 / 23 条负载",
    title: "把离线最优当作标尺",
    goal: "论文测量部分的数字",
    lines: [
      "论文的测量部分，用了 23 条真实负载。",
      "工作站磁盘、数据库、搜索引擎、合成扫描。",
      "缓存从几 MB 到几 GB，一档一档地扫。",
      "对照组里有一个特别的：离线最优。",
      "它提前知道整个负载，再挑一个最好的 p。",
      "这是 Table VIII，每条负载一行。",
      "SPC1 上，LRU 是 9.19%，ARC 是 20.00%。",
      "离线最优是 20.11%，只差 0.11 个百分点。",
      "P6 上，LRU 是 4.24%，ARC 是 23.84%。",
      "离线最优只有 22.62%，ARC 反而更高。",
      "速度上两者都是常数时间，空间开销 0.75%。",
    ],
  },
  {
    id: "universal",
    chapter: "普适与边界",
    kicker: "10 / 经验普适",
    title: "更强的一句话",
    goal: "结论和它付出的代价",
    lines: [
      "把这些数字放在一起，结论比更快更强。",
      "一个完全在线的算法，追上了离线挑好的最优。",
      "作者把这件事叫经验普适。",
      "它不挑负载，也不需要事先知道工作集。",
      "但代价也写在论文里。",
      "在稳定负载上，离线最优仍然略高一点。",
      "P8 上，离线是 28.92%，ARC 是 27.51%。",
      "原因是常数步长的自适应，带来了抖动。",
      "论文还给了扩展 ARC(c,k)，多一张 k 页的 Z 表。",
      "代价是只保证期望常数时间，这是它的边界。",
    ],
  },
  {
    id: "outro",
    chapter: "结语",
    kicker: "11 / 三句话",
    title: "记住三件事",
    goal: "结论、出处与论文之外的实现",
    lines: [
      "最后用三句话收束。",
      "第一，把两种份额做成在线学习量。",
      "第二，常数时间、常数空间，可以像 LRU 一样实现。",
      "第三，它不挑负载，离线最优就在眼前。",
      "论文在 USENIX 开放获取，115 到 130 页。",
      "作者是 IBM Almaden 的 Megiddo 和 Modha。",
      "论文之外，OpenZFS 里的 ARC 是最有名的工业实现。",
      "它的贡献不是证明，而是一个能跑、能验算的答案。",
    ],
  },
];

/** 讲稿节奏：中文 4.5 字/秒，句间 0.55 s，场首 1.2 s，场尾 2.2 s。 */
const CPS = 4.5;
const GAP = 0.55;
const LEAD = 1.2;
const TAIL = 2.2;
const MAX_CHARS = 34;

/** 实测每句时长（秒），键 "scene#index"，由 scripts/tts/synthesize_arc.py 写入。 */
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
