# 《Hawk：看不见的用电怎么被看见》—— 论文解读片

第四部片子，也是第一部**非原创内容**的片子：材料是别人的论文
（*Hawk: An Efficient NALM System for Accurate Low-Power Appliance Recognition*，
SenSys '24，CC BY 4.0），成片做的是"给完全没读过这篇论文的人讲清楚"。

composition id `Hawk`，12 场、757.36 秒（22,721 帧）、1920×1080 / 30 fps。

## 1. 这类片子难在哪

前三部（`Lecture`、`Multiplication`、`Gears`）的知识是我自己的，讲错了自己负责。
这一部有四条额外的硬约束：

1. **每一个数字都要有出处**。片子里出现的 71.5、93.94%、61.8 µs、32.2 小时，必须能在
   `paper.txt` 里指到行。所以有了 `data/hawk/eval.json`：手写、逐条抄自原文，
   并在 `meta.note` 里记下它对应原文哪张表。
2. **忠实与可看之间要选一个**。原文的图能直接截（复现成本高、或画出来会更假），
   但不能整场都是截图 —— 用户的原话是"完全套用原文内容就失去了意义"。
   做法见 §4：图版只在"我画不出来"的位置出现，其余全部自己画。
3. **截图不能带批注**。这份 PDF 上有用户自己加的高亮和便签。
   `page.get_pixmap(annots=False)` 把批注层整体关掉，再逐张目检黄色像素数；
   成品图里黄像素为 0。
4. **不能顺着论文的章节讲**。论文的 §3 是"系统设计"，直接照搬会把没读过的人劝退。
   片子重排成：问题 → 这是谁的论文 → 四个词 → 造数据 → 同步 → 差分 → 投票 → 实测 →
   局限 → 开源（§2）。

## 2. 12 场

用户给的结构要求是"开篇讲源知识、作者团队、必要概念；中间按论文内容；最后给开源资源"，
落成下面这张表。前 4 场是"进门前"的铺垫（44% 的时长里没有一句论文结论），
第 5–9 场是方法，第 10–12 场是边界与出口。

| # | id | 章节 | 时长 | 句数 | 画面主体 | 原文图 |
|---|----|------|------|------|----------|--------|
| 1 | open | 开场 | 41.95 | 7 | HAWK 字标 + 背景里一条总电流折线 | — |
| 2 | problem | 两个难点 | 59.60 | 11 | 数据贵 / 小信号听不见 + 40W 贴着 1500W 台阶 | — |
| 3 | paper | 这篇论文 | 56.66 | 10 | 标题页原图 + 作者团队 + 核心主张 + 两条腿 | header |
| 4 | concepts | 四个约定 | 56.49 | 12 | 状态 / 叠加 / 签名 / 时间（内联 SVG 小图） | — |
| 5 | gray | 造数据 | 98.35 | 19 | 4 位平衡格雷码表 + 分组后的轮次网格 | — |
| 6 | spt | 同步 | 91.61 | 18 | 电压正弦 + 主从采样错位 + 同步误差 CDF | Figure 10 |
| 7 | diff | 特征 | 80.53 | 17 | 总电流 vs 30 周期差分（±90 W 放大） | — |
| 8 | vote | 决策 | 69.07 | 14 | 30 格投票 + 阈值 12 | — |
| 9 | eval | 实测 | 69.70 | 14 | 4 张数字卡 + 三行延迟表 | — |
| 10 | limits | 边界 | 41.12 | 8 | 论文自认的五个洞 + Table 4 三行 | — |
| 11 | oss | 开源 | 66.45 | 14 | repo 地址 + 三个 chip + 四张数字卡 | — |
| 12 | outro | 结语 | 25.83 | 5 | "先问对问题，再问怎么算" | — |

场次时长不是估的：`script.ts` 每句先按字数算初值（`CPS=4.5`），合成旁白后由
`data/hawk/voice.json` 的实测长度重排（见 §6）。149 句，硬切帧 11 个。

## 3. 一个真源：data/hawk/eval.json

论文片的 `params.json` 不是几何参数，是**数字与出处**。全部手写，不生成：

```json
{
  "hawkdata": { "appliances": 22, "programmableAppliances": 18, "hours": 32.2,
                "baselineHours": 2304, "collectionTimeRatio": 71.5,
                "onStateBR": 0.877, "baselineOnStateBR": 0.000122,
                "categoryBR": 0.212, "stateComboGain": 6.34 },
  "headline":  { "stateAvgF1": 93.94, "eventAvgF1": 97.07,
                 "stateGainPct": 47.98, "eventGainPct": 11.57 },
  "sync":      { "within220usPct": 99.65, "maxSyncErrorUs": 61.8, "vsTsfRatio": 17.2 },
  "latency":   { "rows": [ {"device":"Desktop","ms":3.31,"rssMb":42.5},
                           {"device":"Jetson Orin NX","ms":4.07,"rssMb":40.19},
                           {"device":"Raspberry Pi 4B","ms":6.59,"rssMb":32.6} ] }
}
```

组件不写数字：屏幕上每个值都从 `eval.json` 取。这张表也是事实核查的物证 ——
下面 §5 列的 11 处错误，全部是"某个数字被贴到了错误的标签下"，靠回读原文才发现。

另有两个**派生**数据产物，由 `python3 scripts/generate_hawk_data.py` 确定性生成
（`seed 20241019/20241020`，跑两次逐字节一致）：

| 文件 | 内容 | 性质 |
|------|------|------|
| `gray.json` | 16 个 4 位状态的平衡格雷序列（回溯搜出来的，每位翻 4 次）；6 组 × 2³ = 48 的轮次表；论文实测的 30/18 轮、2880 事件、2584 状态、17% 重叠 | 序列是**推导**，论文只给一般公式 |
| `wave.json` | 200 点总电流示意波形、三次开关事件、SINR 三行、30 格投票 | **合成**，文件里自带 `disclaimer` 字段，画面右下角也照抄这句 |

`wave.json` 的 `meta.synthetic: true` 不是免责声明式的自我安慰：第 7 场的差分曲线
是**在组件里现算**的（`d30[i] = total[i] - total[i-30]`），不是从 JSON 读预计算序列。
原因见 §5 第 6 条 —— 预计算序列在这张画面里会推出反结论。

## 4. 原文图版：只用在画不出来的地方

`scripts/assets/hawk_paper.py` 用 PyMuPDF 按 bbox 裁切，`dpi=220`、`annots=False`，
`--fail-on-annots` 会检查批注层是否真的被关掉：

```bash
python3 scripts/assets/hawk_paper.py --only fig10
# page 8  598x341  annots=0  -> public/hawk/fig10.png
```

| 图 | 用途 | 为什么不自绘 |
|----|------|-------------|
| `header.png`（p1） | 第 3 场：证明"这是谁的论文" | 标题页本身就是证据 |
| `fig10.png`（p8） | 第 6 场：同步误差 CDF | 四条 CDF 曲线 + "No samples" 区段，重画等于伪造 |
| `fig8/9/3/13/16/7` | 备选，本版未入片 | — |

画面里每个图版都有角标 `原文 Figure 10` / `原文 第 1 页`（`Fig` 组件的 `tag` 参数），
让"引"和"讲"在视觉上分开。第 6 场的红线是**唯一**压在原图上的元素，
位置按 220 µs 在横轴上的比例算，和论文自己标的 99.65% 对齐 —— 这是"指示性解读"，
不是二次创作。

## 5. 事实核查：改了 11 处（这一节是这部片子最贵的部分）

初稿写完之后逐条回读 `paper.txt`，找到并改掉：

| # | 初稿 | 原文 | 后果 |
|---|------|------|------|
| 1 | 采集成本"71.5 倍" | 本文开销是基线的 **1/71.5**（`collectionTimeRatio`） | 方向反了，等于说本文更贵 |
| 2 | 同步精度"5 ms" | 61.8 µs 最大误差、220 µs 内 99.65%；5 ms 是**别人的** LIT2020 | 差三个数量级，且张冠李戴 |
| 3 | "16 台电器 / 16 台可编程" | 22 台，其中 18 台可编程 | 概念场的 2¹⁸ 跟着错 |
| 4 | "2304 小时" | 2304 是**基线数据集**的时长，本文 32.2 小时 | 把对照组的本事算成自己的 |
| 5 | 类别不平衡比"0.0014" | 本文 0.877 / 0.212，0.0014 是基线 | 同上 |
| 6 | 差分用 `wave.json` 的预计算 `diff` | 那是 30 周期滑窗差分 | 1500 W 台阶滚出窗口时冒出假台阶，与"40 W 浮出来"的论点相反 |
| 7 | 签名 = "开与关的瞬间" | 开与关**前后两段稳态之间**的台阶幅值与波形 | 差在"瞬间"三个字 |
| 8 | 状态组合 262144 直接标"论文" | 论文只给一般公式，分组数是我按 6×3 推的 | 加"示意推导"标注 |
| 9 | 30×48 说成 1440 = 2880 | 2880 是另一处统计口径，两者不能相提并论 | 两个数分开呈现 |
| 10 | 局限"22 台 / 2304 小时" | 32.2 小时 | 第 4 条的余波 |
| 11 | "每个状态组合停 20 秒"算成本 | 原文是每轮每状态 20 s 的停驻，成本按 **4.12 美元**一路 | 数字与单位都错 |

配套的机械保障：`eval.json` 里每个数字带 `meta.note` 说明出处；`wave.json` 带
`disclaimer`；第 7 场右下角把 disclaimer 原句印在画面上；第 5、6 场的示意图都标了
"按论文数值复现，不是实测"。

## 6. 旁白与时间轴（实测驱动）

```bash
node scripts/qa/dump_script.mjs src/hawk/script.ts data/hawk/lines.json
python3 scripts/tts/synthesize_hawk.py --lines data/hawk/lines.json
node scripts/qa/dump_script.mjs src/hawk/script.ts data/hawk/lines.json   # 必须重跑
python3 scripts/tts/build_hawk_narration.py --lines data/hawk/lines.json \
  --clips public/voice/hawk --out public/voice/hawk_narration.wav
```

与 gears 的差别：`synthesize_hawk.py` **按句子内容寻址**。每句的 wav 名是
`l%03d_<sha1(文本)[:8]>.wav`，`clips.json` 记录 hash，hash 相同且文件在就跳过。
所以改 11 处句子只重合成 13 条，其余 136 条复用 —— 整片重跑 TTS 的成本从 12 分钟
降到 1 分钟。代价是改句会留下孤儿 wav，需要按 `clips.json` 反查清理
（本片清掉 13 个，28 M → 26 M）。

`build_hawk_narration.py` 打印每句的 overrun，**零**才是可接受值。本片 149 句、
589.1 s 语音、0 overrun。

## 7. 复现

```bash
python3 scripts/assets/hawk_paper.py --only header,fig10     # 图版
python3 scripts/generate_hawk_data.py                        # gray/wave
node scripts/qa/dump_script.mjs src/hawk/script.ts data/hawk/lines.json
# …… TTS 四步见 §6 ……
node scripts/make.mjs --composition=Hawk \
  --narration=public/voice/hawk_narration.wav \
  --cut-frames=1258,3046,4746,6441,9392,12140,14556,16628,18719,19952,21946 \
  --out=out/hawk-package
```

## 7.5 交付实测

```bash
node scripts/make.mjs --composition=Hawk \
  --narration=public/voice/hawk_narration.wav --score=out/hawk-score.wav \
  --cut-frames=1258,3046,4746,6441,9392,12140,14556,16628,18719,19952,21946 \
  --out=out/hawk-package
# make: PASS — out/hawk-package/Hawk.mp4 (757.37 s, -15 LUFS, TP -2 dBFS) + srt/chapters/cover + report.json
```

| 项目 | 实测 |
|------|------|
| 时长 / 帧数 | 757.37 s / 22,721 帧（composition 与容器一致，误差 0.003 s） |
| 画面 | 1920×1080 h264 High，30 fps，34,375,786 B |
| 分段渲染 | 12 场全部重渲（reused 0 / rendered 12），4 分钟 |
| 响度 | I = -15 LUFS，TP = -2 dBTP |
| 配乐 | stem 全带 -25.09 dBFS、可听带 -27.85、audible_share 0.631、sub_share 0.068 |
| 混合 | duck 4.5 dB 覆盖 64.6% 时间轴，峰值 -1.72 dBFS，rms -19.33；speech -15.42 / gap_full -25.20 |
| 闪烁门禁 | mean\|Δ\| 0.0171、p99 0.1234、raw max 25.99，11 个硬切帧按声明屏蔽（阈值 12） |
| 静帧门禁 | 全仓 59 帧（Hawk 12 帧），无出框/贴边/溢出/文字重叠 |
| 字幕 | 149 条 cue，0 条需要折行，最长 34 字（预算 34）；12 章，封面 frame 180 |
| sha256 | `f44aa3a96f397ef1a091a077ccb4a9b9bf44df1e60dd5e914a8bde3528295e5a` |

两次失败都记在 `docs/known-issues.md`：第一次是 `make.mjs` 与 `still_lint.mjs` 没同步到渲染机，
Hawk 走了"通用 composition"分支（单次全片渲染、跳过交付导出），静帧门禁也因为 `FILM_SCRIPTS`
里没有 Hawk 而空跑（K27 的推论）；第二次同步之后，静帧门禁真的红了 —— 两张带角标又有说明文字的
图版被判"文字重叠"，原因是探针比图片解码更早（K27）。

## 8. 已知限制

- 第 5 场的格雷码序列是**我搜出来的**，论文只给一般公式；画面已标"示意推导"。
  48 的轮次划分同理。
- 第 7 场的波形是合成的，文件里和画面上都写了"不是实测数据"。它只用来讲清
  SNR 的量级差（0.028 → 0.650），不能当测量结果引用。
- 原文图版只用了 2 张。`fig8`（硬件照片）、`fig9`（部署平面图）、`fig13`（事件热图）、
  `fig16`（状态识别对比）都在 `public/hawk/` 里备着，本版没进片，因为对应的论点
  可以用数字卡说清楚，塞图只会拖慢节奏。
- 论文第 4 节的两阶段训练细节（优化器、超参、模型结构）没讲，片子面向的是"想知道
  这工作在做什么"的人，不是"想复现"的人。要复现请看原文 §4。
- 片中所有英文术语只在第一次出现时给全称，之后用中文简称（SPT = 共享感知时间）。
