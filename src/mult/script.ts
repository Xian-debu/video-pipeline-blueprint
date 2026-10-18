/**
 * 逐位乘法片的唯一真源：章节、讲稿、时长全部由这里派生。
 *
 * 讲稿即字幕（P9）：一句一条，中文 4.2-4.8 字/秒，单句 ≤34 字；
 * speech 同时是 TTS 输入与字幕文本，因此「旁白/字幕偏差 ≤6 帧」天然成立。
 * 场景时长不手写：由该场讲稿的实测时长 + 首尾留白算出，改讲稿即改片长。
 */
import schoolbookJson from "../../data/mult/schoolbook.json";
import karatsubaJson from "../../data/mult/karatsuba.json";
import toomJson from "../../data/mult/toom.json";
import nttJson from "../../data/mult/ntt.json";
import benchJson from "../../data/mult/bench.json";
import codeJson from "../../data/mult/code.json";
import voiceJson from "../../data/mult/voice.json";

export const FPS = 30;

export const SCHOOLBOOK = schoolbookJson as any;
export const KARATSUBA = karatsubaJson as any;
export const TOOM = toomJson as any;
export const NTT = nttJson as any;
export const BENCH = benchJson as any;
export const CODE = codeJson as any;

type SceneSpec = {
  id: string;
  chapter: string;
  kicker: string;
  title: string;
  goal: string;
  lines: string[];
};

/** 讲稿：每场一组，不写时间点（时间点由 layout 计算）。 */
const SPEC: SceneSpec[] = [
  {
    id: "open",
    chapter: "开场",
    kicker: "ALGORITHM / MULTIPLICATION",
    title: "逐位乘法",
    goal: "从小学竖式，走到大数库真正在用的算法",
    lines: [
      "两个很大的整数相乘，计算机到底在做什么？",
      "我们从小学竖式出发，一路走到大数库真正用的算法。",
      "每个数字都在同一台机器上跑出来，可以重跑，也可以被检查。",
      "四级台阶：平方、一点五八五、一点四六五、最后是 n log n。",
    ],
  },
  {
    id: "school",
    chapter: "竖式",
    kicker: "01 / 一位数乘一位数",
    title: "先数清楚代价",
    goal: "为什么 n 位乘 n 位，乘法次数是 n 的平方",
    lines: [
      "先看最小的一步：一位数乘一位数，再加上进位。",
      "四位数乘四位数，就是十六次这样的小乘法。",
      "每次小乘法还要处理进位，写进下一列。",
      "所以竖式的代价，是位数的平方。",
      "四千七百六十一乘三千零八十二，我们真跑一遍。",
      "四乘二得八，写在这一列；再乘下一位，加上进位。",
      "十六次乘法，二十四次加法，得到一千四百六十七万三千四百零二。",
      "这不是估计，是逐位数出来的。",
      "为什么是平方：每一位都要和对方的每一位碰一次。",
      "n 位乘 n 位，就是 n 乘 n 次小乘法，这个下界很硬。",
    ],
  },
  {
    id: "split",
    chapter: "拆半",
    kicker: "02 / KARATSUBA 恒等式",
    title: "把四次乘法变成三次",
    goal: "一次代数恒等式，换掉一次大乘法",
    lines: [
      "一九六零年，柯拉楚巴发现四次乘法可以变成三次。",
      "把两个数都拆成高低两半，a 等于 a1 乘 B 加 a0。",
      "展开之后有三项：z2 乘 B 平方，z1 乘 B，还有 z0。",
      "朴素做法要算四次乘法：z0、z1、z2 各一次，再补一次。",
      "关键恒等式：z1 等于两个和的乘积，再减掉 z0 和 z2。",
      "它只多用了加法，却省下一次大乘法。",
      "递归下去，乘法次数变成三的幂，指数换成 log 二底三。",
      "log 二底三约等于一点五八五。",
      "六十四位的一对数，竖式二百五十六次，这里八十一。",
      "一千零二十四位时，六万五千五百三十六次对六千五百六十一次。",
      "省下的不是常数，是指数。",
      "恒等式可以逐项验证：展开、合并、再相减，两边相等。",
    ],
  },
  {
    id: "recur",
    chapter: "递归",
    kicker: "03 / 递归树与主定理",
    title: "T(n) = 3T(n/2) + O(n)",
    goal: "用归纳法把「少了四分之一」写成严格上界",
    lines: [
      "为什么指数是一点五八五：看递归树。",
      "每一层把问题对半拆，生成三个新问题。",
      "深度是 log 二底 n，叶子数是三的深度次方。",
      "于是 T(n) 等于三 T(n/2) 加 cn。",
      "代入展开：三层之后是九 T(n/4) 加常数倍的 cn。",
      "一般地，T(n) 等于 n 的 log 二底三 次方，乘一个常数。",
      "严格地说，猜 c n 的 p 次方减二 dn，才闭得上。",
      "归纳一步：三个子问题代进去，恰好又回到同一个式子。",
      "只要 c 足够大让基例成立，归纳就闭合了。",
      "同一张表里，Toom-3 一点四六五，NTT 一点零乘 log n。",
      "指数的每一次下调，都是把乘法换成加法或置换。",
    ],
  },
  {
    id: "toom",
    chapter: "插值",
    kicker: "04 / TOOM-3",
    title: "用五个点换掉九次乘法",
    goal: "把整数看成多项式：求值、点乘、插值",
    lines: [
      "与其拆成两半，不如把数看成多项式，在点上求值。",
      "取零、一、负一、二、无穷远五个点。",
      "在每个点上，大乘法退化成小整数的乘法。",
      "五点定五次以下多项式，五个乘积足以还原全部系数。",
      "九亿零八万零七，乘四亿零五万零三。",
      "五个点上的乘积是二十一、二百八十八、十六、一千七百一十一、三十六。",
      "插值还原系数：二十一、五十九、九十五、七十七、三十六。",
      "拼回去，正好等于两数直接相乘的结果。",
      "指数从一点五八五降到一点四六五。",
      "代价是插值要除法，而整数除法很贵。",
      "工程上用移位和逆元，把除法换成乘法和右移。",
    ],
  },
  {
    id: "ntt",
    chapter: "变换",
    kicker: "05 / FFT 与 NTT",
    title: "把乘法变成点乘",
    goal: "从 n 方到 n log n：离散傅里叶变换为什么对",
    lines: [
      "再往上，拆分不再划算，因为拆出来的块太多。",
      "换一个视角：乘法就是多项式的卷积。",
      "卷积难算，是因为每一对系数都要相乘再相加。",
      "但如果先做一次变换，卷积就变成逐点相乘。",
      "这个变换就是离散傅里叶变换，在单位根上求值。",
      "单位根满足 w 的 n 次方等于一，求值可以分治。",
      "分治把 n 方次求值，降到 n log n 次蝶形运算。",
      "整数上不用复数，用模一个质数的单位根。",
      "取质数九亿九千八百二十四万四千三百五十三，原根是三。",
      "这就是 NTT：数论变换，全程整数，没有浮点误差。",
      "一二三四乘五六七八，补零到八位。",
      "变换之后，两组各八个点值，逐个相乘。",
      "逆变换回来，系数是五、十六、三十四、六十、六十一、五十二、三十二。",
      "和直接卷积的结果一模一样。",
      "为什么对：变换把卷积变成乘法，逆变换再变回卷积。",
      "代价是三次变换，三十六个蝶形，而不是十六次乘法。",
      "指数是一点零乘 log n，终于跑赢了平方。",
    ],
  },
  {
    id: "bench",
    chapter: "实测",
    kicker: "06 / 同一台机器",
    title: "什么时候真的更快",
    goal: "算法决定斜率，实现决定截距",
    lines: [
      "理论说完，回到同一台机器：这是实测。",
      "横轴是位数，纵轴是毫秒，对数坐标。",
      "一千零二十四位：竖式十一点五毫秒，对手四十九点八毫秒。",
      "等一下，Karatsuba 反而慢了四倍。",
      "因为它省的是乘法，付出的是加法和递归调用。",
      "纯 Python 里，一次加法的开销和一次乘法差不多。",
      "常数因子把指数的优势吃掉了。",
      "同样一千零二十四位，CPython 自己的乘法只要零点零零五毫秒。",
      "它也是 Karatsuba，但常数小了四个数量级。",
      "测它从一千位到六万五千位的增长，指数是一点六二四。",
      "接近一点五八五，说明标准库确实用了 Karatsuba。",
      "NTT 在一千零二十四位要四点九毫秒，一万六千位要一百一十毫秒。",
      "结论：算法决定斜率，实现决定截距，两者都要。",
    ],
  },
  {
    id: "magic",
    chapter: "特殊情形",
    kicker: "07 / 工程里的魔法",
    title: "那些看不见的常数级胜利",
    goal: "真实的大数库是怎么把理论磨成产品的",
    lines: [
      "真实的大数库还有一批特殊情况，每一个都是常数级的胜利。",
      "第一，平方：平方比一般乘法便宜，硬件有专门的路径。",
      "第二，小乘数：乘一个机器字，就是一次线性扫描。",
      "第三，二的幂：乘二的一百次方，只是左移一百位。",
      "第四，阈值：小规模退回竖式，因为常数更小。",
      "CPython 的阈值是七十位，低于它直接用竖式。",
      "第五，稀疏：乘数里大量是零，可以整块跳过。",
      "第六，分段：数太长，就切成几段分别变换再拼接。",
      "第七，模数：NTT 的质数要能容纳乘积，不够就换更大的。",
      "第八，也是最重要的：不要自己写，用 GMP 或者标准库。",
      "它们把这些情况做了几十年，还有测试和向量化。",
      "我们要学的是为什么，不是重新实现一遍。",
    ],
  },
  {
    id: "code",
    chapter: "代码 trace",
    kicker: "08 / PYTHON",
    title: "高亮行就是正在执行的行",
    goal: "十三行代码，每一次调用都被数了出来",
    lines: [
      "最后看代码：十三行的 Karatsuba，最小实现。",
      "输入是十二万七千九百零九和十七万八千一百二十一。",
      "两数的位宽分别是十七位和十八位。",
      "超过阈值八位，所以进入拆分分支。",
      "取一半位宽，用掩码取低位，右移取高位。",
      "然后三次递归调用，深度优先，先算 z0。",
      "每一次调用都记在左边，缩进就是深度。",
      "高亮的行，就是这一帧正在执行的那一行。",
      "三次递归都返回之后，z1 由两次减法得到。",
      "最后按位权拼回去，和两数直接相乘一位不差。",
      "每一次调用、每一次乘法，都被数了出来。",
      "视频里的数字不是画的，是跑出来的。",
    ],
  },
  {
    id: "outro",
    chapter: "结论",
    kicker: "09 / 结论",
    title: "一条用加法换乘法的路",
    goal: "四级台阶，同一个目标：少做一次乘法",
    lines: [
      "四级台阶：平方、一点五八五、一点四六五、n log n。",
      "每一级都用加法、插值或者变换，换掉一次乘法。",
      "这是计算机科学里最漂亮的一条线：算法改变斜率。",
      "所有数字来自这台机器，脚本在仓库里，随时可以重跑。",
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
 * 实测每句时长（秒），键 "scene#index"，由 scripts/tts/synthesize_mult.py 写入。
 * 一旦有实测值，场景时长就按**真实语音**排，而不是按字数猜：
 * 猜出来的时长会让画面与旁白在片尾累积到秒级偏差。
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
      // 语速门禁只抓"这句被吞了"或"这句被拖了"，不是抓风格：
      // 本片 106 句实测 4.20-8.20 字/秒（中位数 5.10，p90 6.27），越过 3.6-9.0 就说明
      // TTS 少读了字或多吞了静音，字幕会与声音错位。
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

/** 讲稿长度/节奏的自查结果：为空才算通过（scripts/qa/script_check.mjs 会读它）。 */
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
/** 第 k 句在该场的开始时间（秒，相对本场）。 */
export const within = (id: string, k: number) => {
  const ls = linesOf(id);
  const l = ls[Math.min(ls.length - 1, Math.max(0, k))];
  return l.start - sceneOf(id).start;
};
/** 第 k 句的相对帧号，场景组件用它来同步画面。 */
export const frameOf = (id: string, k: number) => Math.round(within(id, k) * FPS);