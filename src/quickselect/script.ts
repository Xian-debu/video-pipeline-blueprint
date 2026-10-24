/**
 * 《快速选择：只找第 k 小》—— 第六部片。
 *
 * 讲稿即字幕，也是 TTS 的输入：一条字符串既是屏幕上的字，也是旁白要念的话。
 * 时间点不按字数猜，由 data/quickselect/voice.json 里实测的语音时长决定
 * （scripts/tts/synthesize_quickselect.py 写入）。
 *
 * 屏幕上的每一个数字都必须能在 data/quickselect/*.json 里找到同源的一项：
 * 比较次数、交换次数、毫秒、每层规模，全部来自 scripts/quickselect/bench.cpp
 * 在同一台机器上的实测，生成器是 scripts/generate_quickselect_data.py。
 * 文献只出现在"谁先做的、哪一年"，不引用任何文献里的常数。
 */
import voiceJson from "../../data/quickselect/voice.json";

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
    "id": "open",
    "chapter": "开场",
    "kicker": "QUICKSELECT / 第 k 小",
    "title": "一亿个数里，第 k 小是谁",
    "goal": "从一个不许排序的问题说起",
    "lines": [
      "先给一个问题，不许排序：一亿个数里，第 k 小是哪个？",
      "你不需要把一亿个数排好序，你只需要其中一个。",
      "可直觉总想先把队排整齐，再伸手去拿。",
      "这一部片就做一件事：把这个问题一路做到深处。",
      "先看排序要多贵，再看只找一个人能省掉什么。",
      "然后拆开常数：比较次数不等于时间。",
      "最后给出四种保证，和一张选型表。",
      "所有的数字，都是这台机器上跑出来的。"
    ]
  },
  {
    "id": "problem",
    "chapter": "问题",
    "kicker": "01 / 顺序统计量",
    "title": "第 k 小，到底在问什么",
    "goal": "把问题写成定义，先算出下界",
    "lines": [
      "第 k 小的元素，术语叫顺序统计量。",
      "k 等于零是最小值，k 等于 n 减一是最大值。",
      "中间的 k 叫中位数，它是这一场的主角。",
      "读一遍数组就知道最小值要 n 减一次比较。",
      "所以任何正确算法，都逃不掉这 n 减一次。",
      "下界只是起点，问题在于多花的那些比较。",
      "最省事的解法是全排序，然后取下标 k。",
      "排序的下界是 n log n，比 n 多一个 log。",
      "一亿个数取中位数，这个 log 就是二十多倍。",
      "问题因此变成：能不能不排序，就拿到第 k 个。"
    ]
  },
  {
    "id": "naive",
    "chapter": "朴素",
    "kicker": "02 / 全排序",
    "title": "排完再取，贵在哪",
    "goal": "实测排序与选择的差距",
    "lines": [
      "先老老实实测一遍，全排序到底多贵。",
      "一百万个随机整数，取中位数，排完再取。",
      "标准库排序用了两千三百五十万次比较。",
      "一共五十一毫秒，机器没有波动。",
      "同一批数据，标准库的选择只用二百七十四万次。",
      "时间六毫秒，快了八倍多。",
      "比较次数少了八倍半，比例几乎一样。",
      "差额全在 log n 上：排序要把所有两两关系都定下来。",
      "选择只要知道谁在第 k 位，其余关系与它无关。",
      "省下来的不是常数，是问题本身的一部分。"
    ]
  },
  {
    "id": "inherit",
    "chapter": "继承",
    "kicker": "03 / 划分",
    "title": "只走一边",
    "goal": "从快排的划分拿到选择",
    "lines": [
      "怎么只定一个位置？先看快排的划分。",
      "选一个枢轴，扫一遍，比它小的放左边。",
      "划分结束时，枢轴落在了它最终的位置上。",
      "位置叫 p，左边全比它小，右边全比它大。",
      "如果 p 正好等于 k，答案就是它，到此为止。",
      "如果 k 比 p 小，答案一定在左半边。",
      "如果 k 比 p 大，答案一定在右半边。",
      "被排除的那一半，连看都不必再看。",
      "一九六一年，霍尔把这个观察写成了算法，叫 FIND。",
      "快排两边都做，选择只做一边。",
      "差别只有一个词：递归的宽度。",
      "宽度从二变成一，代价就坍缩成期望线性。"
    ]
  },
  {
    "id": "expectation",
    "chapter": "期望",
    "kicker": "04 / 为什么是线性",
    "title": "n 加 n 半加 n 四分之一",
    "goal": "等比级数收敛到 2n",
    "lines": [
      "随机枢轴的划分，大约把数组对半分。",
      "第一次扫 n 个元素，第二次扫 n 的一半。",
      "第三次四分之一，一直加到收敛。",
      "这个等比级数的和是二 n，不是 n log n。",
      "一百万个随机数，实测每次元素平均比较三点九七次。",
      "理论说二 n，实测多出来的是枢轴本身和对半的偏差。",
      "同一批数据上，全排序是二十三点五次。",
      "差约六倍，这就是少做一半换来的。",
      "注意这是期望：它依赖随机枢轴真的随机。",
      "把随机数去掉，期望就退化成运气。",
      "下一场就把这份运气抽走。"
    ]
  },
  {
    "id": "worst",
    "chapter": "最坏",
    "kicker": "05 / 有序输入",
    "title": "端点枢轴的塌方",
    "goal": "平方级比较的实测阶梯",
    "lines": [
      "把输入换成一个已经排好序的数组，什么都不改。",
      "最后一个元素当枢轴，它就是当前区间的最大值。",
      "划分结果：左边全留下，右边一个都没有。",
      "每次只削掉一个元素，区间长度从 n 掉到 n 减一。",
      "比较次数就成了 n 加 n 减一，一直加到一。",
      "二万个有序数，实测一亿四千八百万次比较。",
      "增长是平方：长度翻倍，比较次数翻四倍。",
      "一亿个数按这个走，需要的时间以年为单位。",
      "标准库的选择在同样输入上只用了一点七五次比较每元素。",
      "它不随机，它用中位数取样，再限深度。",
      "所以最坏情况不是理论问题，是必须处理的工程事实。",
      "朴素版本到这里就该被淘汰了。"
    ]
  },
  {
    "id": "constant",
    "chapter": "常数",
    "kicker": "06 / 比较不等于时间",
    "title": "同样的次数，不同的毫秒",
    "goal": "拆开一次比较背后做了什么",
    "lines": [
      "现在回答第一部片没回答的问题：常数是什么。",
      "同样期望线性，写法不同，时间差一倍多。",
      "一百万个随机数，霍尔式六点七毫秒，三路式十一九毫秒。",
      "比较次数几乎一样，时间却差了这么多。",
      "差在每一次比较背后做了什么。",
      "洛穆托版每次交换都写下标，写比读贵。",
      "三路版每轮多一次相等判断，分支更难预测。",
      "数组一大，缓存装不下，访问模式开始收费。",
      "所以比较次数只是上界的代理，不是时间。",
      "要谈常数，就得同时给出比较次数和毫秒。",
      "这是这一部片和第一部最大的区别。"
    ]
  },
  {
    "id": "duplicate",
    "chapter": "重复",
    "kicker": "07 / 大量重复",
    "title": "所有元素都相等",
    "goal": "三路划分把等值段一次收走",
    "lines": [
      "还有一种输入，朴素划分同样会塌。",
      "一百万个元素全部相等。",
      "洛穆托版每轮把枢轴放到最右，然后递归左边。",
      "它每次都只前进一格，比较次数变成 n 平方除以二。",
      "实测一亿五千万次，两万个数就这么多。",
      "换成三路划分，等于枢轴的那一段一次处理完。",
      "同样一百万个全等元素，两百万次比较，零点二九毫秒。",
      "八个不同取值的输入，洛穆托要七十三次每元素。",
      "三路只要四点三八次，标准库二点一二次。",
      "重复值不是边角情况，它是真实数据的长相。"
    ]
  },
  {
    "id": "medians",
    "chapter": "中位数",
    "kicker": "08 / 最坏线性",
    "title": "五个人给的保证",
    "goal": "中位数的中位数与 T(7n/10)",
    "lines": [
      "要最坏也线性，就不能靠随机。",
      "一九七三年，五个人给出了确定性的办法。",
      "把数组每五个一组，组内排好，取中位数。",
      "这些中位数的中位数，就是枢轴。",
      "它保证至少三成的元素比它小，也至少三成比它大。",
      "于是每次至少砍掉三成，剩下的七成进入下一轮。",
      "递推里 n 拆成 n/5 和 7n/10，再加 c n。",
      "十分之九小于一，级数收敛，最坏线性。",
      "一百万个随机数，实测每次元素九点九八次比较。",
      "代价是常数大：二十一毫秒，是标准库的三倍半。",
      "实测每层规模：一百万、五十万、二十五万。",
      "它比七成的上界掉得快，因为真实划分更均匀。"
    ]
  },
  {
    "id": "floyd",
    "chapter": "抽样",
    "kicker": "09 / 跳过数据",
    "title": "先抽样，再圈定",
    "goal": "用两个样本值夹住答案",
    "lines": [
      "有没有办法既没有随机性，常数又小？",
      "一九七五年，弗洛伊德和里维斯特给了另一个答案。",
      "先随机抽一批元素，估计第 k 个大约落在哪个值区间。",
      "在这两个样本值上做一次划分，中间那一段就是要找的。",
      "一次划分跳过百分之九十九的数据。",
      "一百万个随机数，实测每次元素一点八一次比较。",
      "四点五七毫秒，比标准库还快一点。",
      "抽样只决定跳多远，不决定正确性。",
      "抽偏了就退回普通划分，答案永远对。",
      "它把随机性用在了省略上，而不是用在枢轴上。",
      "样本越大，跳过越多，但采样本身也要花钱。"
    ]
  },
  {
    "id": "std",
    "chapter": "标准库",
    "kicker": "10 / 工业解法",
    "title": "introselect 与选型表",
    "goal": "把方法放回场景里选",
    "lines": [
      "工业代码不自己写这些，它调标准库。",
      "标准库的选择叫 introselect，思路是两层。",
      "先用快速划分，深度超过阈值就换有最坏界的方法。",
      "一百万个随机数，它用二点七四次比较每元素。",
      "六毫秒，比我们手写的霍尔版还快。",
      "因为它把划分的写法也优化过。",
      "要前 k 个排好序，用它旁边的 partial_sort。",
      "只要求最大的 k 个，用堆，一点二五次比较每元素。",
      "选择不需要全序，这是所有优化的共同前提。",
      "要一个值，用 nth_element。",
      "要前 k 个有序用 partial_sort；要最坏保证用中位数。",
      "其余情况，先量再选。"
    ]
  },
  {
    "id": "outro",
    "chapter": "结语",
    "kicker": "11 / 三句话",
    "title": "记住三件事",
    "goal": "结论、下界与下一部",
    "lines": [
      "最后用三句话收束。",
      "第一，选择比排序少一个 log，这是结构上的省。",
      "第二，期望线性来自每次只走一边。",
      "第三，最坏和常数是两件事，要分别处理。",
      "下界是 n 减一次比较，谁都逃不掉。",
      "所有这些数字来自 C++ 基准，代码在仓库里。",
      "算法不难，难的是分清哪句话有证据。",
      "这一部就到这里，下一部见。"
    ]
  }
];

/** 讲稿节奏：中文 4.5 字/秒，句间 0.55 s，场首 1.2 s，场尾 2.2 s。 */
const CPS = 4.5;
const GAP = 0.55;
const LEAD = 1.2;
const TAIL = 2.2;
const MAX_CHARS = 34;

/** 实测每句时长（秒），键 "scene#index"，由 scripts/tts/synthesize_quickselect.py 写入。 */
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