/**
 * 齿轮片的唯一真源：章节、讲稿、时长、以及每一场"是不是 3D"都由这里派生。
 *
 * 与另外两部片的差别只在 SceneSpec：多了 mode 与 three 两个字段。
 *   mode  —— 这一场的**主导**表现形式，只用于阅读与统计口径的说明；
 *   three —— 这一场里真的有 3D 画面的帧占比（0..1）。3D 时长占比由它加权算出，
 *            而不是由 mode 猜：一场 2D 图版里塞一个 3D 小窗，它就不是纯 2D。
 *
 * 讲稿即字幕：一句一条，单句 ≤34 字；speech 同时喂 TTS 与字幕，
 * 所以"旁白/字幕错位"这类问题从构造上就不存在，只剩语速门禁去抓吞字。
 */
import voiceJson from "../../data/gears/voice.json";

export const FPS = 30;

type SceneSpec = {
  id: string;
  chapter: string;
  kicker: string;
  title: string;
  goal: string;
  mode: "3d" | "2d";
  /** 这一场里有 3D 画面的帧占比。 */
  three: number;
  lines: string[];
};

/** 讲稿：每场一组，不写时间点（时间点由下面的 layout 计算）。 */
const SPEC: SceneSpec[] = [
  {
    id: "open",
    chapter: "开场",
    kicker: "GEAR / MESHING",
    title: "两个圆，咬住彼此",
    goal: "从一个齿开始：为什么要做成这个形状",
    mode: "3d",
    three: 1,
    lines: [
      "两个轮子贴在一起转，靠的不是摩擦。",
      "它们边缘长出一圈齿，一个推一个。",
      "齿的形状决定了转得稳不稳，也决定了会不会卡。",
      "这一部片只讲一件事：齿为什么长成那样。",
      "所有数字都能在仓库里重算，不靠嘴说。",
    ],
  },
  {
    id: "ratio",
    chapter: "速比",
    kicker: "01 / RATIO",
    title: "齿数就是速比",
    goal: "二十齿带五十齿：一圈换零点四圈",
    mode: "3d",
    three: 1,
    lines: [
      "先看最容易量的一件事：转速。",
      "小轮二十齿，大轮五十齿，模数都是二毫米。",
      "每转过一个齿，两边必须同时换一个齿。",
      "所以齿数乘转速，两边永远相等。",
      "二十比五十，小轮转两圈半，大轮才转一圈。",
      "速比二点五，反过来就是减速。",
    ],
  },
  {
    id: "involute",
    chapter: "渐开线",
    kicker: "02 / INVOLUTE",
    title: "把绳子从圆上解开",
    goal: "齿廓不是圆弧，是解开的绳子画出的曲线",
    mode: "3d",
    three: 1,
    lines: [
      "那齿的侧面是什么形状？答案有点意外。",
      "在一根圆柱上绕一圈绳子，拉紧，然后慢慢解开。",
      "绳端划出的那条曲线，就叫渐开线。",
      "齿的工作面，就是这条线的一段。",
      "它从一个叫基圆的圆上长出来，半径是节圆乘余弦二十度。",
      "基圆以内没有渐开线，所以齿根必须有过渡。",
    ],
  },
  {
    id: "conjugate",
    chapter: "为什么是它",
    kicker: "03 / CONJUGACY",
    title: "为什么偏偏是渐开线",
    goal: "两条渐开线啮合，接触点的公法线永远过同一点",
    mode: "2d",
    three: 0.35,
    lines: [
      "为什么不用圆弧，非要用这条曲线？",
      "因为两条渐开线接触时，公法线永远穿过同一个点。",
      "这个点在两轮中心连线上，位置固定。",
      "法线固定，力臂就固定，传过去的转速比也就固定。",
      "换成圆弧，接触点一动，法线跟着摆动。",
      "转速就会一顿一顿，这就是为什么齿廓要算。",
    ],
  },
  {
    id: "contact",
    chapter: "重合度",
    kicker: "04 / CONTACT RATIO",
    title: "同一时刻，不止一对齿在受力",
    goal: "重合度一点六六：平均一点六六对齿同时接触",
    mode: "3d",
    three: 1,
    lines: [
      "一对齿从咬上到分开，走过的距离叫啮合线。",
      "这段长度除以齿距，就是重合度。",
      "这一对的参数算出来是一点六六。",
      "意思是平均有一点六六对齿同时在受力。",
      "所以载荷不是一下全压在一颗齿上。",
      "重合度低于一，齿轮就会一跳一跳地过齿。",
    ],
  },
  {
    id: "torque",
    chapter: "扭矩",
    kicker: "05 / TORQUE",
    title: "减速的同时，力被放大",
    goal: "一千瓦、三十弧度每秒：三十三点三牛米变八十三点三",
    mode: "3d",
    three: 1,
    lines: [
      "转速降下来，力气就上去了。这不是玄学。",
      "功率等于扭矩乘角速度，这条守恒不能破。",
      "假设输入一千瓦，小轮角速度三十弧度每秒。",
      "那么小轮上的扭矩是三十三点三牛米。",
      "大轮角速度只有十二，扭矩就涨到八十三点三。",
      "齿数比二点五，扭矩也正好放大了二点五倍。",
    ],
  },
  {
    id: "planetary",
    chapter: "行星轮系",
    kicker: "06 / PLANETARY",
    title: "三个零件，三种速比",
    goal: "同一个轮系，固定不同的件，得到完全不同的结果",
    mode: "3d",
    three: 1,
    lines: [
      "把齿圈套在外面，太阳轮放中间，中间塞三颗行星轮。",
      "这个结构叫行星轮系，它有三个能转的件。",
      "固定齿圈，太阳轮带行星架，速比三点五。",
      "固定行星架，太阳轮带齿圈，速比负二点五。",
      "固定太阳轮，行星架带齿圈，速比零点七一四。",
      "同一个轮系，固定谁就换一种机器。",
    ],
  },
  {
    id: "backlash",
    chapter: "背隙",
    kicker: "07 / BACKLASH",
    title: "留一点空，是为了转得动",
    goal: "零点零五毫米的间隙，折成零点零五七度",
    mode: "2d",
    three: 0.45,
    lines: [
      "齿不能做得严丝合缝，必须留一点缝。",
      "这点缝叫背隙，用来容纳加工误差和热膨胀。",
      "零点零五毫米的背隙，在半径五十毫米处。",
      "换成角度只有零点零五七度。",
      "听着很小，但换向的时候，它就是回差。",
      "精密传动要把它压到几个微米。",
    ],
  },
  {
    id: "module",
    chapter: "模数",
    kicker: "08 / MODULE",
    title: "模数：让齿轮能互换的那个数",
    goal: "模数二，二十齿和五十齿才能装在七十毫米的中心距上",
    mode: "3d",
    three: 1,
    lines: [
      "还有个数，决定了齿轮能不能配对。",
      "它叫模数，等于节圆直径除以齿数。",
      "模数相同，齿距就相同，两个轮才咬得上。",
      "这两个轮模数都是二，中心距就是七十毫米。",
      "工程师不挑齿形，只挑模数和齿数。",
      "标准化的意义，就是让零件可以互换。",
    ],
  },
  {
    id: "history",
    chapter: "来历",
    kicker: "09 / HISTORY",
    title: "从水车到风机",
    goal: "木齿、钟表、风电齿轮箱：同一条曲线，不同的尺度",
    mode: "3d",
    three: 0.75,
    lines: [
      "齿轮不是先有理论再有的。",
      "最早是水车上的木齿，能咬住就行，谈不上曲线。",
      "钟表要准，十二比一的传动不能有回差。",
      "于是渐开线被算了出来，成了标准齿形。",
      "今天风机的主齿轮箱，速比能到一百比一。",
      "摸的还是同一条曲线，只是尺度和材料变了。",
    ],
  },
  {
    id: "outro",
    chapter: "结论",
    kicker: "10 / 结论",
    title: "形状是算出来的",
    goal: "齿廓、速比、扭矩、背隙，四件事互相锁死",
    mode: "3d",
    three: 1,
    lines: [
      "回头看，齿形是被四个条件一起逼出来的。",
      "要传得稳，就要渐开线；要配对，就要同一个模数。",
      "要减速，就得接受扭矩放大；要转得动，就得留背隙。",
      "参数只写一遍，其余数字都由脚本重算。",
      "下一部片，换个题材，还是这条路。",
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
 * 实测每句时长（秒），键 "scene#index"，由 scripts/tts/synthesize_gears.py 写入。
 * 有实测值就按真实语音排，别按字数猜，否则片尾会累积到秒级偏差。
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

/** 3D 加权时长：scene.dur * scene.three 之和，供 scene_3d_budget.mjs 断言。 */
export const THREE_SEC = round2(SCENES.reduce((a, s) => a + s.dur * s.three, 0));
export const THREE_SHARE = round2(THREE_SEC / TOTAL_SEC);