/**
 * 《一张三视图，一个会动的角色》—— 第八部片（实时 three.js 角色建模）。
 *
 * 讲稿即字幕，也是 TTS 的输入：一条字符串既是屏幕上的字，也是旁白要念的话。
 * 时间点不按字数猜：data/char2/voice.json 里是实测语音秒数（scripts/tts/synthesize_char2.py 写），
 * 文件为空时退回 CPS 估算，这样在配音之前也能出 still 校验画面。
 *
 * 屏幕上的数字只从两个账本读：
 *   data/char2/spec.json   模型/调色/阈值（scripts/char2/spec.py）
 *   data/char2/gate_anim.json 绑定判据（scripts/char2/gate_anim.py）
 * 讲稿里念的数字与账本是同一批数。
 */
import voiceJson from "../../data/char2/voice.json";

export const FPS = 30;
/** 语速估算（字/秒），只在没有实测语音时用。 */
export const CPS = 4.5;
export const GAP = 0.55;
export const LEAD = 1.2;
export const TAIL = 2.2;
export const MAX_CHARS = 34;
export const LINE_PAD = 0.35;
export const MIN_LINE = 1.4;

export type SceneSpec = {
  id: string;
  chapter: string;
  kicker: string;
  title: string;
  goal: string;
  /** 画面形态：stage=实时 3D；plate=参考图/对照；chart=数字墙；type=纯排版 */
  form: "stage" | "plate" | "chart" | "type";
  /** 本场是"满屏无卡片"的留白场（L4 要求 ≥2 次） */
  bleed?: boolean;
  lines: string[];
};

const SPEC: SceneSpec[] = [
  {
    id: "open",
    chapter: "开场",
    kicker: "CHAR2 / 实时角色管线",
    title: "一张三视图，一个会动的角色",
    goal: "从参考图到会走、会转身、会换色的实时模型",
    form: "stage",
    bleed: true,
    lines: [
      "这张图上有三个视角，画的是同一个角色。",
      "今天把它变成一个真能动的三维模型。",
      "上一部用离线渲染，一帧要八秒多。",
      "这一次换成实时渲染，一帧不到半秒。",
      "同一张参考图，同一套放样算法。",
      "但整条片子，从测量到演示可以连续跑。",
      "先看结果：它转一圈，再走两步。",
    ],
  },
  {
    id: "why",
    chapter: "为什么重做",
    kicker: "00 / 上一部片的问题",
    title: "好看不是形容词，是数字",
    goal: "先把上一部片量一遍，才知道要改什么",
    form: "chart",
    lines: [
      "先说实话：上一部的成片并不好看。",
      "四百九十四秒里，有运动的只有三点四秒。",
      "一秒一个窗口去量，运动率只有百分之零点一。",
      "最长的一个静止镜头，停了五十点九秒。",
      "一百六十二张画面里，只有一百零二帧是动作。",
      "问题不在执行，在于我们没给好看设判据。",
      "所以这一部先立规矩：运动率不低于百分之八十。",
      "单个镜头不超过六十秒，静态画面不超过三秒。",
    ],
  },
  {
    id: "measure",
    chapter: "测量",
    kicker: "01 / 把图量成数字",
    title: "先量高度，再量剖面",
    goal: "色度分割 → 逐层极值 → 剖面与锚点",
    form: "plate",
    lines: [
      "回到参考图。建模之前，先把图量成数字。",
      "用色度阈值，把三个视图从白底上切出来。",
      "在每一层高度上，量出最左和最右的边界。",
      "正视给出左右宽度，侧视给出前后厚度。",
      "两张图合起来，才有一个真正的体积。",
      "脚底到头顶算一个单位高，所有数字按它归一。",
      "这里有个坑：模型的真实高度必须恰好是一。",
      "高百分之六，每一层都会量错一层。",
      "所以先量高度，再量剖面，顺序不能反。",
      "眼睛、肚皮、裆部，另存成锚点，单独校。",
    ],
  },
  {
    id: "loft",
    chapter: "放样",
    kicker: "02 / 逐环放样",
    title: "身体是一圈一圈长出来的",
    goal: "超椭圆截面 × 逐层放样 × 平滑动峰",
    form: "stage",
    lines: [
      "有了剖面，身体不是雕出来的，是放样出来的。",
      "每一层取一个截面：宽度来自正视，深度来自侧视。",
      "截面的形状是一个超椭圆，指数二点三五。",
      "指数大一点更方，小一点更尖，二点三五刚好是蛋形。",
      "一层一层连起来，就是一百七十圈闭合曲面。",
      "侧面还要允许圆心前后偏移，驼背就靠它。",
      "测量出来的曲线有折点，直接放样会有横条纹。",
      "所以要平滑，但平滑会削掉最宽的地方。",
      "办法是平滑后，按原始最宽处缩放回去。",
    ],
  },
  {
    id: "crown",
    chapter: "收口",
    kicker: "03 / 头顶解方程",
    title: "穹顶高度不能写死",
    goal: "抬升多少，就得先下沉多少",
    form: "stage",
    lines: [
      "头顶是最容易翻车的地方。",
      "最初我们把穹顶高度写死，结果长出一顶尖帽子。",
      "后来改成按顶部半径的比例，帽子更大。",
      "真正的约束是一个方程：抬升多少，就要先下沉多少。",
      "迭代三十次求下沉量，再乘一点一七五。",
      "这个系数不是猜的，是两个实测点插值出来的。",
      "太矮，封口被细分吃掉；太高，尖顶冒出去。",
    ],
  },
  {
    id: "foot",
    chapter: "落地",
    kicker: "04 / 脚掌",
    title: "脚掌要平，还要站在原点",
    goal: "平底 + 脚心归零 + 外八",
    form: "stage",
    lines: [
      "脚掌也有两个坑。",
      "第一，脚底必须是平的。",
      "细分会把平底吃掉，所以要先把细分烘掉再压平。",
      "第二，脚要站在原点附近，不能前后偏。",
      "参考图上的脚印，中心就在零，脚趾朝前。",
      "脚掌还要外八十四度，才撑得住那个肚子。",
    ],
  },
  {
    id: "depth",
    chapter: "方向",
    kicker: "05 / 深度轴",
    title: "整条深度轴都反了",
    goal: "先确认坐标轴，再谈参数",
    form: "stage",
    lines: [
      "这一轮最隐蔽的 bug，是整条深度轴反了。",
      "侧视图的右边是脸，但在模型里脸朝负方向。",
      "我们照着图上的坐标搬，整只人往后仰。",
      "剪影上看不太出来，侧视一量就露馅。",
      "侧视的重合度，从零点七九涨到零点九。",
      "教训是：先确认坐标轴，再谈参数。",
      "方向错一条，后面所有参数都在给错误做补偿。",
    ],
  },
  {
    id: "gate",
    chapter: "判据",
    kicker: "06 / 三视图门禁",
    title: "三条都过，才允许往下走",
    goal: "重合度 / 宽高比 / 剖面误差",
    form: "plate",
    lines: [
      "判据是这一部的地基，三条都要过。",
      "第一条是剪影重合度，正侧背都要过门。",
      "第二条是宽高比误差，不超过百分之三。",
      "第三条是每层剖面误差，小于零点零二五。",
      "现在三条全过：零点八八、零点九零、零点八八。",
      "颜色只在正视图上卡，因为参考图换个视角就变九。",
      "这是判据的问题，不是模型的错，所以重新标定。",
    ],
  },
  {
    id: "rig",
    chapter: "骨架",
    kicker: "07 / 十六根骨",
    title: "骨轴不是世界轴",
    goal: "rest 乘增量，权重解析算",
    form: "stage",
    lines: [
      "几何过关了，才轮到骨架。",
      "十六根骨：根、脊、胸、头、两条手臂、两条腿。",
      "骨头的局部轴不是世界轴，这是最容易忘的。",
      "大腿骨的局部正方向，在世界里朝下。",
      "所以旋转要写成 rest 四元数乘增量。",
      "直接累乘，会一帧一帧漂走。",
      "权重是解析算的，不是自动绑的。",
      "每个顶点最多四个影响，权重和小于二乘十的负七次方。",
    ],
  },
  {
    id: "motion",
    chapter: "动作",
    kicker: "08 / 四段动作",
    title: "动作是算出来的，不是画出来的",
    goal: "待机 / 挥手 / 转身 / 行走 + 脚滑判据",
    form: "stage",
    lines: [
      "四段动作：待机、挥手、转身、行走。",
      "动作不是逐帧画出来的，是参数算出来的。",
      "每帧每根骨一个增量四元数，再加根结点的位移。",
      "渲染端只搬数字，不做插值。",
      "判据是脚滑：支撑脚在落地期间位移不超过零点零一。",
      "行走的脚滑量，实测是零。",
      "转身是最难的，因为参考图里没有转体的证据。",
      "所以转身只转身，不改姿势。",
    ],
  },
  {
    id: "color",
    chapter: "染色",
    kicker: "09 / 解析遮罩",
    title: "斑块要焊在皮肤上",
    goal: "静止坐标遮罩 + 调色板",
    form: "stage",
    lines: [
      "染色不是改一张贴图，是改一个解析函数。",
      "奶油色的肚皮，是绑定姿势下的一个椭圆。",
      "如果按当前顶点位置算，转身时斑块会滑到背上。",
      "所以我们用静止坐标，也就是绑定姿势的坐标。",
      "这样任何姿势下，斑块都焊在皮肤上。",
      "颜色也不是死的：黄、薄荷、梅子三套。",
      "换颜色只换一个变量，不重新生成模型。",
    ],
  },
  {
    id: "build",
    chapter: "生长",
    kicker: "10 / 从一到整",
    title: "一圈一圈长出来",
    goal: "",
    form: "stage",
    bleed: true,
    lines: [
      "现在，把这一切连起来看一遍。",
      "从一圈剖面开始，一圈一圈往上长。",
      "长到顶，收口，脚掌落地。",
      "然后骨架进来，动作进来，颜色进来。",
      "这就是从一张图到一个角色。",
    ],
  },
  {
    id: "demo",
    chapter: "演示",
    kicker: "11 / 成品",
    title: "它现在能走、能挥手、能换色",
    goal: "",
    form: "stage",
    bleed: true,
    lines: [
      "接下来是成品演示。",
      "它可以在舞台上走，可以挥手。",
      "可以转身，可以看到背面。",
      "也可以换成别的颜色，还是同一个角色。",
      "所有帧都是实时算出来的，没有一张离线贴图。",
    ],
  },
  {
    id: "close",
    chapter: "复现",
    kicker: "12 / 复刻清单",
    title: "三个输入，一条命令",
    goal: "参考图 + 参数 + 脚本",
    form: "chart",
    lines: [
      "最后是复刻清单。",
      "参考图、参数文件、生成脚本，三个输入。",
      "一条命令导出模型，一条命令跑三视图判据。",
      "改一行参数，模型立刻变，判据立刻告诉你过没过。",
      "换一个角色，只需要换参考图和参数。",
      "所有数字都在报告里，所有代码都在仓库里。",
      "你可以用它做你自己的角色。",
    ],
  },
];

const MEASURED = voiceJson as Record<string, number>;

const round2 = (v: number) => Math.round(v * 100) / 100;

const built = (() => {
  const scenes: {
    id: string; chapter: string; kicker: string; title: string; goal: string;
    form: SceneSpec["form"]; bleed?: boolean; lines: string[];
    dur: number; start: number; chapterIndex: number;
  }[] = [];
  const lines: { start: number; dur: number; speech: string; scene: string; index: number }[] = [];
  let cursor = 0;
  SPEC.forEach((s, i) => {
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

/** 讲稿长度自查（>MAX_CHARS 构建期报错）。 */
export const SCRIPT_PROBLEMS: string[] = (() => {
  const p: string[] = [];
  for (const s of SPEC) {
    s.lines.forEach((t, k) => {
      if (t.length > MAX_CHARS) p.push(`${s.id}[${k}] ${t.length} chars: ${t}`);
      if (t.length < 8) p.push(`${s.id}[${k}] too short: ${t}`);
    });
  }
  return p;
})();

export const TOTAL_SEC = round2(SCENES.reduce((a, s) => a + s.dur, 0));
export const TOTAL = Math.round(TOTAL_SEC * FPS);

export const STARTS: Record<string, number> = (() => {
  const o: Record<string, number> = {};
  for (const s of SCENES) o[s.id] = Math.round(s.start * FPS);
  return o;
})();

export const linesOf = (id: string) => LINES.filter((l) => l.scene === id);
export const sceneOf = (id: string) => SCENES.find((s) => s.id === id)!;
/** 第 k 句在本场内的相对秒数。 */
export const within = (id: string, k: number) => {
  const ls = linesOf(id);
  const l = ls[Math.min(ls.length - 1, Math.max(0, k))];
  return l.start - sceneOf(id).start;
};
/** 第 k 句的相对帧号（画面靠它同步，不手抄时间）。 */
export const frameOf = (id: string, k: number) => Math.round(within(id, k) * FPS);
