# 《ARC：一块会自己调参的缓存》—— 论文解读片

第五部片子，第二部**非原创内容**的片子：材料是
*ARC: A Self-Tuning, Low Overhead Replacement Cache*（Nimrod Megiddo & Dharmendra S. Modha，
IBM Almaden Research Center，USENIX FAST '03，pp. 115–130，开放获取），
成片做的是"给完全没读过这篇论文的人讲清楚替换策略为什么要自己调参"。

composition id `Arc`，12 场、时间轴 610.56 s（18,317 帧）、1920×1080 / 30 fps。

## 1. 这类片子难在哪

前四部里 `Hawk` 也是别人的论文，但 ARC 多一条更硬的约束：**算法必须能被执行**。
片子里说"p 会跟着负载走""扫描页碰不到 L2"，如果只是念论文，观众无法判断真假；
如果自己写一遍算法跑出曲线，数字就变成可以复算的。

1. **每一个数字都要有出处**。9.19、20.00、0.75%、28.92 这些数必须能在 `paper.txt` 找到行。
   于是有 `data/arc/eval.json`：手写、逐条抄自原文，`meta.note` 记它来自哪张表。
2. **讲清楚算法，而不是讲清楚论文**。原文的顺序是"相关工作 → DBL → Π(c) → FRC_p → ARC →
   实验"，照搬会把没读过的人劝退。片子重排成：
   问题（缓存为什么难）→ 难点（两个世界与一个固定份额 p）→ 四个概念 →
   DBL 中间构造 → 策略类 Π(c) → ARC(c) 四情形 → p 的自适应 → 扫描抵抗 →
   23 条负载的实测 → 普适与边界 → 结语。
3. **自己写一遍算法，并且让它可以被验算**。`scripts/generate_arc_data.py` 用 Figure 4 的
   四情形 + REPLACE 子程序实现 ARC，跑三条合成负载，产出的曲线就是画面上的曲线。
   它同时是"证据"：任何一行都能在 `data/arc/sim.json` 里查到。
4. **两栏排版 + 数学符号**。`pdftotext -layout` 会把左右栏塞进同一条物理行（K30），
   而且正文字体里的数字在抽取时全部丢失（"hit ratio of  while"）。所以
   `data/arc/paper.txt` 是逐页 220 dpi 的 tesseract 文本：数字在，但数学符号会被打散
   （`T_1` 变 `TJ`、`c−p` 变 `c—p`）。**含数学的行不能当 quote**，只能选纯文字行。

## 2. 12 场

| # | id | 章节 | 时长 | 句数 | 画面主体 | 原文图 |
|---|----|------|------|------|----------|--------|
| 1 | open | 开场 | 41.81 | 8 | 三层存储 + 缓存格 + 淘汰高亮 | — |
| 2 | problem | 问题 | 50.76 | 11 | 前 32 次请求的命中流 + 命中率公式 + LRU 五格 | — |
| 3 | gap | 难点 | 58.45 | 13 | SDD / IRM 两个世界 + 漂移 + FRC_p 四条曲线 | — |
| 4 | concepts | 概念 | 48.77 | 10 | 请求流 / 缓存 / 目录 2c / 幽灵 / FRC_p | — |
| 5 | dbl | 中间构造 | 53.65 | 10 | c=3 手算序列 + 两条不变量 + p=c 退化成 LRU | dbl_fig1, dbl_fig2 |
| 6 | class | 策略类 | 49.24 | 10 | T1/T2 在缓存内、B1/B2 在目录里 + 份额条 | pi_fig3 |
| 7 | arc | 算法 | 54.50 | 11 | 四情形卡 + δ₁/δ₂ 公式 + REPLACE 判据 | arc_fig4 |
| 8 | walk | 自适应 | 47.11 | 10 | 原文引语 + 自测 p 曲线 + 论文 Figure 7 | p_fig7 |
| 9 | scan | 扫描抵抗 | 55.91 | 11 | 三段负载时间轴 + T2 存活曲线 + 命中率对比 | — |
| 10 | measure | 实验 | 60.15 | 11 | SPC1 / P6 命中率 + 常数时间与 0.75% 开销 | table8 |
| 11 | universal | 普适与边界 | 49.11 | 10 | 普适引语 + P8 的 1.41 点代价 + 四条负载差距 | — |
| 12 | outro | 结语 | 41.10 | 8 | 三个要点 + 出处 + 论文之外（OpenZFS） | title, cover |

场次时长不是估的：`script.ts` 每句先按字数算初值（`CPS=4.5`），合成旁白后由
`data/arc/voice.json` 的实测长度重排（见 §6）。123 句，硬切 11 个。

## 3. 三个真源

`data/arc/eval.json`（手写，论文数字）—— 每张表一个键，`tableVIII` 是 23 行全表：

```json
{
  "spc1": { "cacheMB": 4096, "lru": 9.19, "mq": 14.96, "twoQ": 17.88, "arc": 20, "offlineFrc": 20.11 },
  "p6":   { "cacheMB": 16, "lru": 4.24, "arc": 23.84, "offlineFrc": 22.62 },
  "p8":   { "lruAt32768Pages": 17.18, "arcAt32768Pages": 27.51, "offlineFrc": 28.92 }
}
```

`data/arc/sim.json`（派生，`scripts/generate_arc_data.py`，seed 固定，跑两次逐字节一致）——
四条合成负载跑 ARC 与 LRU：

- `sweep`：7 个缓存大小上的命中率（c=1024 时 ARC 68.705 / LRU 67.2），外加 FRC 的
  p=0/25/50/75/100 五条固定份额曲线 —— 用来现场算"没有哪个固定 p 处处最好"
  （c=16 时 p=0 最好 17.078，c=1024 时 p=25 最好 68.799）。
- `walk`：c=256 上 p 的全程游走（0 → 256 → 自己走回来），复现论文 §V.H 的形状。
- `scan`：c=128，热点 6000 → 顺序扫描 3000 → 回到热点 4000；扫描段命中率为 0，
  扫描结束时 T2 还活着 118 页，紧接着的 100 次请求 ARC 40.0% / LRU 18.0%。
- `tape`：c=8 的 32 个手写页号，逐请求的 p/T1/T2/B1/B2 —— 开场请求流的来源。

`data/arc/claims.json`（手写，32 行）—— 每个上屏数字一行，字段
`id/scene/onScreen/value/quote/where/note`，`quote` 必须是 `paper.txt` 里某一行的原文切片。
门禁 `claims_check.mjs --film=arc` 证明三件事：引文真在这份文本里、数值真在某个账本里、
场次真是 `script.ts` 里的一场。它证明不了"方向对不对"——那是 §5 的事。

## 4. 原文图版

`scripts/assets/arc_paper.py`，PyMuPDF，220 dpi，`get_pixmap(annots=False)` 关掉批注层，
再逐张数黄色像素（占比 > 0.002 就报 YELLOW，`--fail-on-yellow` 可直接失败）。
八张图版全部检查通过，黄像素 0.0000：

| id | 页 | 用途 |
|----|----|------|
| `cover` | 1 | 会议封面（FAST '03，San Francisco） |
| `title` | 2 | 标题 + 两位作者 + IBM Almaden |
| `dbl_fig1` / `dbl_fig2` | 7 | DBL(2c) 算法框 / 两条 LRU 列表结构 |
| `pi_fig3` | 8 | Π(c) 的 T1/B1/T2/B2 结构 |
| `arc_fig4` | 10 | Figure 4 全算法（含 REPLACE 子程序） |
| `table8` | 15 | Table VIII 全 23 行 |
| `p_fig7` | 16 | P4 上 p 随虚拟时间的曲线 |

裁切框是踩出来的：`dbl_fig1` 的说明文字一直延伸到 y=350，而 `dbl_fig2` 从 344 起，
两个框一开始互相重叠；`table8` 第一次只切到 S1，少了两行半；`arc_fig4` 第一次把
REPLACE 的 `else` 切掉了 —— 每张都必须 `read_image` 目检，不能靠估。

## 5. 事实核查：四处必须回读原文

1. **Case IV 的缩进**。第一版按 OCR 文本实现，`If/else/endif` 被 OCR 打散，
   REPLACE 被调了两次，每次缺失少淘汰一页 —— 命中率塌到 1.15%，`caseMix` 四类比例明显不对。
   回读 Figure 4 的**图像**才看清：Case A 里 `|T1|<c` 才删 B1 的幽灵页并 REPLACE，
   否则（B1 空）只删 T1 的 LRU、**不调 REPLACE**；Case B 只在四表合计 ≥ c 时才 REPLACE。
   教训写进 `generate_arc_data.py` 的注释：**文字版 OCR 不能用来实现算法，要看图**。
2. **P6 的 23.82 vs 23.84**。摘要写 23.82，Table VIII 写 23.84。片子用表值 23.84，
   claims 的 note 里写明这处论文内部不一致。
3. **P4 的离线 FRC 是 11.60**。OCR 把这一格读成 `OAL`，回读 p.15 的原图才确认。
4. **SPC1 的 20% vs 20.00**。摘要取整成 20%，Table VI/VIII 是 20.00；片子显示 20.00。

## 6. 旁白：一次 fp16 的教训

`scripts/tts/synthesize_arc.py` 与 hawk 同构：按句文本寻址（`l%03d_<sha1[:8]>.wav`），
改一句只重合成那一句；`build_arc_narration.py` 按 `script.ts` 的起点叠加，并打印 overrun。

第一遍忘了 `--fp16`：第一句 6 秒的旁白花了 **310.8 s**（约 50× 实时），
按这个速度 123 句要 12 小时。加上 `--fp16` 后是 **3 s/句**，整片 **13 分钟** ——
`docs/deployment.md` 里那句"fp16 是 12 小时和 13 分钟的区别"就是这个意思。
最终：123 句 / 465.7 s 语音 / **0 overrun**，容器 610.56 s。

## 7. 门禁与交付

`npm run make -- --composition Arc --narration public/voice/arc_narration.wav --cut-frames 1254,2777,4531,5994,7603,9080,10715,12129,13806,15611,17084` 一次走过全部阶段。实测（`out/arc/report.json`）：

| 项 | 实测 |
| --- | --- |
| 成片 | 610.57 s / 18,317 帧 / 1920×1080 / 30 fps |
| 场景 | 12 场，硬切 11 个（帧号见上面 `--cut-frames`） |
| 分段渲染 | rendered 12 / reused 0（首跑；改一场只重渲一场） |
| 静帧检查 | 1832 / 8243 / 14654 三帧，still lint 对 12 场的每场中点帧量 DOM 盒子，无溢出错位 |
| 混音 | peak -2.04 dBFS，duck 4.5 dB / 62.7 % 时间被压低；mix gate speech -15.44、gap -28.81、bed 41.2 dB |
| 响度 | I = -15 LUFS，TP = -2 dBTP（两遍 loudnorm） |
| 闪烁 | mean|Δ| 0.0336、p99 0.2034、max 67.15（阈值 12，硬切帧已声明） |
| 字幕 | 123 条，0 条折行，最长 34 字 |
| 章节 | 12 章，cover 帧 180 |
| 体积 / sha256 | 27,687,467 B / `fa24989fd52cec618dc7163cfd2182e73d9ef73fb2e8056a99bfa7f414b9a6a2` |

两处过程记录，值得留给下一部片：

- **第一次失败在 still lint**：measure 场的 BarRow 用 `beatAt("measure", 6, 11)` 作入场，而 still
  lint 量的是场景**中点**帧——那一刻柱宽还是 0，卡片看上去是空的；同时 Table VIII 的图版
  `h={802}` 太高，图底压进字幕带。改法是把柱子的 `at` 提前到 beat 2/3/4，图版按实际像素
  `608×771` 收边。教训：**入场时刻必须相对场景中点检查**，不是相对场景开头。
- **Table VIII 裁了四次**：302 带进了 caption 首行，272 切掉了 S3/Merge(S)，290 仍缺最后两行，
  292 才完整（692×772）。表格类 bbox 每改一次都必须 read_image 数行数——行数是唯一的验收标准。


## 8. 怎么做下一部论文片

1. 抽文本：`pdftotext` 拿结构，**逐页 OCR** 拿数字；两栏论文要用 OCR 的行来当 quote。
2. 手写 `eval.json`，一行一格，`where` 写到表号。
3. 写 `script.ts` 的 `SPEC`（scene id / 章节 / 讲稿句子），先按字数估时长看总长合不合 A1。
4. 写场景组件：能用自己画的曲线/动画就不用截图；只有"画出来会更假"的位置用原文图版。
5. `claims.json` 逐条回读原文；含数学的行不许当 quote。
6. TTS 带 `--fp16`；`dump_script` 重排时长；总长不在 540–720 s 就删/加句。
7. `npm run make` 一次过全部门禁，把数字回填到 §7 与 README。
