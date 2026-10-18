import traceJson from "../../data/lecture/trace.json";
import statsJson from "../../data/lecture/stats.json";
import codeJson from "../../data/lecture/code_lomuto.json";

export type TraceStep = {
  type: string;
  array: number[];
  i?: number;
  j?: number;
  pivot?: number | null;
  lo?: number;
  hi?: number;
  depth?: number;
  line?: number;
};
const trace = traceJson as unknown as { array: number[]; steps: TraceStep[] };
export const STEPS: any[] = (trace as any).steps.map((s: any) => ({ ...s, type: s.op }));

export const STATS = statsJson as any;
export const CODE: string[] = (codeJson as any).lines ?? (codeJson as any);

export const FPS = 30;

export type SceneDef = { id: string; dur: number; chapter: string; kicker: string; title: string };

/** 九场结构，合计 300 s（docs/15 P13）。 */
export const SCENES: SceneDef[] = [
  { id: "open", dur: 17.5, chapter: "开场", kicker: "ALGORITHM / QUICKSORT", title: "快，是可以解释的" },
  { id: "idea", dur: 38, chapter: "直觉", kicker: "01 / 分治与不变式", title: "三步里只有一步真的在动" },
  { id: "trace", dur: 48, chapter: "运行实例", kicker: "02 / 真实执行", title: "一次划分，看得见每一次比较" },
  { id: "recursion", dur: 20, chapter: "递归树", kicker: "02 / 递归结构", title: "好的划分把问题对半劈开" },
  { id: "complexity", dur: 26.5, chapter: "复杂度", kicker: "03 / 三种命运", title: "同一份代码，三种命运" },
  { id: "proof", dur: 74, chapter: "严格证明", kicker: "04 / 期望比较次数", title: "E[C] ≤ 2n ln n" },
  { id: "optimize", dur: 44, chapter: "工程优化", kicker: "05 / 四个洞", title: "把最坏情况压回去" },
  { id: "code", dur: 22, chapter: "代码执行", kicker: "06 / PYTHON", title: "高亮行 = 正在执行的那一步" },
  { id: "outro", dur: 15, chapter: "结论", kicker: "07 / 结论", title: "快，是有结构的" },
];

export const TOTAL_SEC = SCENES.reduce((a, s) => a + s.dur, 0);
export const TOTAL = TOTAL_SEC * FPS;

export const STARTS: Record<string, number> = (() => {
  const o: Record<string, number> = {};
  let c = 0;
  for (const s of SCENES) {
    o[s.id] = c * FPS;
    c += s.dur;
  }
  return o;
})();

export type Line = { start: number; dur: number; speech: string };

/**
 * 讲稿即字幕（P9）：一句一条，中文 4.2-4.8 字/秒，单句 ≤34 字；
 * speech 同时是 TTS 输入与字幕文本，因此 P11 E11（旁白/字幕偏差 ≤6 帧）天然成立。
 */
export const LINES: Line[] = [

  { start: 0.55, dur: 4.53, speech: "排序算法里，快速排序是最常被使用的那一个。" },
  { start: 6.04, dur: 5.33, speech: "一百万个数字，标准库一秒之内就能排完。它凭什么这么快？" },
  { start: 12.32, dur: 4.83, speech: "答案不是感觉，而是一条能写下来、能验证的推理链。" },

  { start: 18.05, dur: 4.77, speech: "先看它在做什么。分治三步：划分、递归、合并。" },
  { start: 24.02, dur: 5.64, speech: "合并这一步什么都不用做，因为它是原地排序，代价全压在划分上。" },
  { start: 30.86, dur: 5.55, speech: "选一个基准，把数组分成不大于它、和大于它两段，基准就位。" },
  { start: 37.61, dur: 6.64, speech: "划分过程中维持一个不变式：左侧全部不大于基准，中间全部大于基准。" },
  { start: 45.45, dur: 5.89, speech: "指针 j 从左往右扫，遇到不大于基准的元素，就把它换到左侧。" },

  { start: 56.05, dur: 8.02, speech: "现在把这段过程真实跑一遍，八个数字：七、二、一、六、八、五、三、四。" },
  { start: 65.27, dur: 5.22, speech: "基准取最后一个数四。指针 j 从第一个开始，逐个和四比较。" },
  { start: 71.70, dur: 4.97, speech: "七大于四，留在右侧；二不大于四，和左侧边界交换。" },
  { start: 77.87, dur: 6.55, speech: "继续扫描。每次比较、每次交换都被记录下来，视频只是把数据画出来。" },
  { start: 85.61, dur: 7.56, speech: "扫描结束时，基准换到分界位置，左边全部不大于四，右边全部大于四。" },
  { start: 94.37, dur: 5.25, speech: "接下来两段各自递归。这一步不需要合并，数组已经是有序的了。" },

  { start: 104.05, dur: 6.11, speech: "递归的结构是一棵树。理想情况下每次对半劈开，深度是 log n 量级。" },
  { start: 111.36, dur: 4.89, speech: "如果每次只劈掉一个元素，树就退化成链条，深度接近 n。" },
  { start: 117.44, dur: 4.70, speech: "所以复杂度不是一个数字，而取决于划分有多均匀。" },

  { start: 124.05, dur: 4.81, speech: "最好情况：每次均匀对半，比较次数是 n log n 量级。" },
  { start: 129.30, dur: 4.83, speech: "最坏情况：有序数组配上末尾基准，退化成 n 平方。" },
  { start: 134.58, dur: 7.16, speech: "一千个有序数字，实测比较四十九万九千五百次，正好等于 n 乘 n 减一除以二。" },
  { start: 142.19, dur: 7.47, speech: "同样一千个数随机打乱，只要一万零九百六十九次，低于上界一万三千八百一十五。" },

  { start: 150.55, dur: 7.05, speech: "现在证明最关键的一句话：随机化快排的期望比较次数不超过二 n 倍自然对数 n。" },
  { start: 158.16, dur: 5.39, speech: "第一步，定义指示变量：元素 i 和 j 被比较过就记一，否则记零。" },
  { start: 164.10, dur: 6.03, speech: "总比较次数是这些变量之和；取期望，就变成每个事件概率之和。" },
  { start: 170.69, dur: 8.32, speech: "第二步是关键观察：i 与 j 会被比较，当且仅当区间 i 到 j 里第一个被选中的基准是 i 或 j。" },
  { start: 179.57, dur: 6.44, speech: "因为一旦先选中区间内部的某个元素，i 和 j 就被分到两侧，再也不会相遇。" },
  { start: 186.57, dur: 7.83, speech: "第三步算概率：区间长度是 j 减 i 加一，随机基准落在两端的概率是二除以它。" },
  { start: 194.96, dur: 6.75, speech: "第四步求和。距离为 k 的数对有 n 减 k 个，每个的概率不超过二除以 k 加一。" },
  { start: 202.26, dur: 6.44, speech: "把求和放大成二 n 乘以调和级数，因为二除以 k 加一不超过二除以 k。" },
  { start: 209.26, dur: 7.70, speech: "调和级数不超过自然对数 n 加一，于是期望比较次数不超过二 n 倍 ln n 加二 n。" },
  { start: 217.52, dur: 6.13, speech: "这就是 O n log n。它对任意固定输入、只对随机基准取期望，都成立。" },

  { start: 224.55, dur: 6.83, speech: "工程实现要补四个洞：随机化基准、三路划分、小数组阈值、内省排序。" },
  { start: 232.58, dur: 5.03, speech: "随机化让最坏输入变成概率事件，而不是必然事件。" },
  { start: 238.80, dur: 10.26, speech: "三路划分把等于基准的元素一次分完。一千个全相等的数，普通快排四十九万九千五百次，三路只要一千次。" },
  { start: 250.27, dur: 6.84, speech: "小数组交给插入排序，常数更小；递归太深就转堆排序，最坏也是 n log n。" },
  { start: 258.31, dur: 4.50, speech: "这就是标准库的做法：平均快，最坏也有下界。" },

  { start: 268.55, dur: 6.36, speech: "最后看代码。左边是真实的 Python 实现，右边是执行到这一帧的数组状态。" },
  { start: 276.11, dur: 6.27, speech: "高亮的这一行，就是正在执行的那一步。比较几次、交换几次，都是数出来的。" },
  { start: 283.58, dur: 5.39, speech: "所以这个视频里的每个数字，都能回到一次真实的函数调用。" },

  { start: 290.55, dur: 5.99, speech: "常数小、期望稳、最坏可控，这三件事加起来，才是它快的原因。" },
  { start: 297.73, dur: 6.92, speech: "算法不是背下来的复杂度，而是一条能被检查、能被证明、也能被工程修补的路径。" },
];

export const CAPTIONS = LINES.map((l) => ({ from: l.start, to: l.start + l.dur, text: l.speech }));
