/**
 * 《从一张三视图到会走路的胖梨》—— 第七部片（角色建模）。
 *
 * 讲稿即字幕，也是 TTS 的输入：一条字符串既是屏幕上的字，也是旁白要念的话。
 * 时间点不按字数猜，由 data/char/voice.json 里实测的语音时长决定
 * （scripts/tts/synthesize_char.py 写入）。
 *
 * 屏幕上的每一个测量数字都只从两个文件读：data/char/gate.json（建模后的判据，
 * 由 scripts/char/check.py 写出）和 public/plates/char/report.json（贴片的渲染账本，
 * 由 scripts/char/gen.py 写出）。讲稿里出现的数字与这两个账本是同一批数。
 */
import voiceJson from "../../data/char/voice.json";

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
    kicker: "CHAR / 程序化角色",
    title: "从一张三视图，到会走路的胖梨",
    goal: "先说清楚这条路：测量、放样、判据、骨架",
    lines: [
      "这张图是三视图：正面、侧面、背面，同一个角色。",
      "我们要把它做成能转、能动、能换颜色的三维模型。",
      "整个过程只用脚本，跑在命令行里，没有手工雕刻。",
      "每一步都有可以量的判据，不合格就回去改参数。",
      "这一部讲这条路：从一张图到会走路的角色。",
      "参数、脚本、判据都写在仓库里，你可以照着复刻。",
      "先看参考图，再看测量，最后看它动起来。",
    ],
  },
  {
    id: "measure",
    chapter: "测量",
    kicker: "01 / 把图量成数字",
    title: "建模之前，先把图量干净",
    goal: "三个视图的剪影 → 两条剖面曲线",
    lines: [
      "第一步不是建模，是把图量成数字。",
      "用色度阈值把三个视图从白底上切出来。",
      "在每一个高度上，量出最左和最右的边界。",
      "正视给出宽度，侧视给出厚度，两张图合起来才有体积。",
      "每个视图归一化成一百二十八个高度采样。",
      "左右极值存成两条曲线，这就是角色的剖面。",
      "头顶到脚底算一个单位高度，所有数字按它归一。",
      "这张剪影，是后面所有误差的地基。",
    ],
  },
  {
    id: "loft",
    chapter: "放样",
    kicker: "02 / 剖面放样",
    title: "身体是一圈一圈长出来的",
    goal: "截面 = 正视宽度 × 侧视深度，圆心可偏移",
    lines: [
      "有了剖面，身体不是雕出来的，是放样出来的。",
      "每个高度取一个截面：宽度来自正视，深度来自侧视。",
      "截面圆心可以前后偏移，侧视的驼背就靠它。",
      "一圈一圈连起来，就是一张闭合的曲面。",
      "这里有一个坑：测量出来的曲线有折点。",
      "直接放样，曲面上会出现一圈一圈的横向条纹。",
      "所以要平滑，但平滑会把最宽的地方削小。",
      "办法是平滑之后，按原始最宽处的比例缩回去。",
      "这是这一部里最值得记住的一个技巧。",
    ],
  },
  {
    id: "parts",
    chapter: "部件",
    kicker: "03 / 四肢与五官",
    title: "腿、脚、手、眼睛、嘴",
    goal: "每个部件都是一个可参数化的放样体",
    lines: [
      "腿、脚、手臂、手、眼睛、嘴巴，各自是独立的放样体。",
      "脚不是球压扁，是沿前后方向放样出来的脚掌。",
      "眼睛要贴在身体曲面上，不能悬空，也不能埋进去。",
      "所以先算出那个高度上的曲面方程。",
      "再把眼珠放到表面的法线方向上。",
      "瞳孔比巩膜再往前一点，不然会被吃掉。",
      "嘴巴是一段圆弧扫出来的细管，不是圆环。",
      "圆环会把整个环露出来，这是最早的一个笑话。",
    ],
  },
  {
    id: "patch",
    chapter: "斑块",
    kicker: "04 / 奶油色肚皮",
    title: "用材质，不用几何",
    goal: "静止姿势算权重，烘进顶点属性",
    lines: [
      "肚子那块奶油色，一开始是做一片独立的面贴上去。",
      "结果它像一只白盘子，绑骨之后还会撕开。",
      "换成材质遮罩：先在静止姿势里算一个椭圆距离。",
      "距离在一以内是奶油色，一以外是黄色；中间一段平滑过渡。",
      "这个权重不留在着色器里算，而是烘成每个顶点的一个属性。",
      "因为物体坐标是在形变后的网格上取的，一转身，斑块就滑到背上去了。",
      "没有新几何，斑块跟着皮肤走，边界还能连续地调。",
    ],
  },
  {
    id: "judge",
    chapter: "判据",
    kicker: "05 / 像不像，要能量",
    title: "交并比、宽高比、剖面误差、锚点",
    goal: "四层判据，任何一层不过就回去改",
    lines: [
      "现在要回答：像不像。不能靠感觉。",
      "把渲染图和参考图，各自归一化成同样高度的剪影。",
      "两张剪影的交并比，就是第一层判据。",
      "正面、侧面、背面分别要过线，哪一个不过就回去改。",
      "宽高比是第二层：整体的胖瘦对不对。",
      "剖面均方根误差是第三层：形状沿高度分布对不对。",
      "第四层是锚点：眼睛中心、眼距、眼珠半径、斑块起点。",
      "这一版正面零点八五一，侧面零点八一五，背面零点八六零。",
      "宽高比误差百分之一点六，眼珠半径误差不到百分之一。",
    ],
  },
  {
    id: "rig",
    chapter: "骨架",
    kicker: "06 / 十六根骨头",
    title: "能动的关键不是动画，是权重",
    goal: "显式顶点组替代自动权重",
    lines: [
      "模型是壳，要动起来还得有骨架。",
      "十六根骨头：根、脊椎、胸、头，两条手臂各两节。",
      "两条腿各两节，再加两只脚。",
      "每根骨头按高度分配权重，肩到腕是渐变，手脚给满。",
      "自动权重省事，但会串扰：抬手时肚子边缘跟着动。",
      "所以这里显式写顶点组，谁属于谁，一行一行指定。",
      "四万零二十八个顶点全都有权重，一个不剩。",
      "举手、抬腿、下蹲三个测试姿势，形变都没有爆炸。",
    ],
  },
  {
    id: "motion",
    chapter: "运动",
    kicker: "07 / 帧号驱动",
    title: "同一帧，永远是同一张图",
    goal: "姿势 = f(帧号)，没有随机、没有时钟",
    lines: [
      "运动不播动画文件，是每一帧用帧号算出姿势。",
      "正弦驱动关节角度，第几帧决定相位。",
      "所以同一帧永远得到同一张图，可以拿校验和对比。",
      "待机是胸腔起伏两度，头和脊椎轻微反相。",
      "挥手是右臂抬到九十五度，前臂再摆二十二度。",
      "转身是根骨转一整圈，三十六帧走完。",
      "走路是两条腿反相摆二十四度，膝盖只向后弯。",
      "这是最省的做法，也是最可控的做法。",
    ],
  },
  {
    id: "color",
    chapter: "染色",
    kicker: "08 / 变体是参数",
    title: "换色不改模型",
    goal: "同一份几何，同一个材质树",
    lines: [
      "换色不用重新建模，改一个颜色常量就可以。",
      "因为身体和斑块，是同一个材质里的两个分支。",
      "黄色换成薄荷绿，再换成梅子紫。",
      "阴影和边缘光会跟着变，因为它们来自同一套灯。",
      "这就是程序化建模最实际的好处：变体是参数。",
      "三种颜色，同一份几何，同一份骨架。",
    ],
  },
  {
    id: "compare",
    chapter: "对照",
    kicker: "09 / 差距在哪",
    title: "把参考图和渲染图叠起来",
    goal: "已知缺陷也要标出来",
    lines: [
      "现在把参考图和渲染图叠在一起看。",
      "红色是参考有而渲染没有，蓝色是渲染有而参考没有。",
      "剩下的差距，主要在脚的外扩、肩背的弧线、腿的粗细。",
      "这些是这一版的已知缺陷，不是没看见。",
      "没有继续磨下去，因为误差已经进入阴影和柔光的范围。",
      "参考图边缘本身带阴影，绝对交并比到不了零点九。",
      "把它标出来，比假装完美有用。",
    ],
  },
  {
    id: "teach",
    chapter: "复刻",
    kicker: "10 / 你要怎么再来一遍",
    title: "复刻需要的东西都在仓库里",
    goal: "三个脚本 + 一条命令",
    lines: [
      "复刻需要的东西，全部在仓库里。",
      "一个测量脚本，一个建模脚本，一个判据脚本。",
      "建模脚本是命令行参数驱动的，改参数就改模型。",
      "一次渲染九秒上下，三个视图半分钟看完一轮。",
      "判据脚本退出码是零才算过，可以直接放进流水线。",
      "骨架和动作也是脚本，不是手工摆的。",
      "想换角色，换参考图和参数，脚本不用改。",
      "这就是把建模变成工程的方式。",
    ],
  },
  {
    id: "close",
    chapter: "收尾",
    kicker: "11 / 转一圈",
    title: "从图里长出来的角色",
    goal: "数字都在账本里",
    lines: [
      "最后转一圈，看看这个从图里长出来的角色。",
      "四万零二十八个顶点，十六根骨头，三个颜色。",
      "从一张三视图到会走路的模型，一共十六个参数版本。",
      "每一版都有数字，每一版都能回退。",
      "下一部片见。",
    ],
  },
];

/** 讲稿节奏：中文 4.5 字/秒，句间 0.55 s，场首 1.2 s，场尾 2.2 s。 */
const CPS = 4.5;
const GAP = 0.55;
const LEAD = 1.2;
const TAIL = 2.2;
const MAX_CHARS = 34;

/** 实测每句时长（秒），键 "scene#index"，由 scripts/tts/synthesize_char.py 写入。 */
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
