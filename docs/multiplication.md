# 逐位乘法：一条用加法换乘法的路

第二部成片（composition `Multiplication`）。一部 590 秒的科普片，讲清楚一件事：**每一次提速，
都是用加法、插值或变换，换掉一次乘法。** 从小学竖式一直走到 NTT，每一步都给出证明，每个数字都
由 `scripts/generate_mult_data.py` 数出来或测出来。

- 目标读者：不懂大数乘法的观众，最后能看懂 `T(n) = 3T(n/2) + O(n)` 与单位根为什么能把卷积变成点乘。
- 硬约束：不在画面里编数字（只读 `data/mult/*.json`）；证明必须真的成立（归纳法的猜想写错过一次，
  见 §4.2 与 docs/known-issues.md）；每个场景的版式都过静帧 lint。

## 1. 十章结构

| # | scene | 章节 | 屏幕上的东西 | 这一场要立住的东西 |
| --- | --- | --- | --- | --- |
| 01 | `open` | 开场 | 四级台阶：n² / n^1.585 / n^1.465 / n log n | 全片的路线图与口号 |
| 02 | `school` | 竖式 | 4×4 格阵，每格写出两位数乘法与进位，右侧步骤条同步 | n 位乘 n 位要 n² 次一位数乘法（实测 4761×3082 走 16 次乘法、24 次加法） |
| 03 | `split` | 拆半 | 4761 与 3082 拆成 a0·B+a1，四次乘法变三次；z1 的恒等式与验证 | Karatsuba 的代数恒等式，z1=(a0+a1)(b0+b1)−z0−z2 |
| 04 | `recur` | 递归 | 三叉递归树（n=16→8→4），T(n)=3T(n/2)+cn，强化归纳证明，1024 位乘法次数表 | 为什么指数是 log₂3 ≈ 1.585；归纳法怎么写才闭得上 |
| 05 | `toom` | 五点 | 900800007×400500003：五点求值、五点乘积、插值还原系数 | 五次以下多项式由五个点唯一确定，所以五次乘法足够；代价是除法 |
| 06 | `ntt` | 变换 | [1,2,3,4]×[5,6,7,8] 补零到 8 位：正变换 8 个点值、逐个相乘、逆变换 | 单位根的正交性让卷积变成点乘；代价 3·(n/2)·log₂n 个蝶形 |
| 07 | `bench` | 实测 | 1024 位四种实现的对数条形图 + CPython int 的增长表 | 算法决定斜率，实现决定截距（纯 Python 的 Karatsuba 反而更慢） |
| 08 | `magic` | 特殊情形 | 八张常数级胜利：平方、小乘数、2 的幂、阈值、稀疏、分段、模数、用现成库 | 真实大数库在理论之外还做了什么 |
| 09 | `code` | 代码 trace | 13 行 Python Karatsuba，左边调用树，高亮行 = 这一帧正在执行的行 | 127909×178121 的完整执行轨迹，结果与直接相乘一位不差 |
| 10 | `outro` | 结论 | 四级台阶对照表（乘法次数） | 一条线的收束：算法改变斜率 |

## 2. 数字从哪来

`python3 scripts/generate_mult_data.py` 写 `data/mult/*.json`。两件事严格区分：

- **计数**（乘法次数、加法次数、蝶形数）：由插桩实现数出来，不估。所以 1024 位竖式是 65,536 次
  乘法、Karatsuba 是 6,561 次（1024 位 = 256 个万进制块，threshold=1）。
- **墙钟**（毫秒）：本机实测，JSON 里记着是哪台机器（Intel Core Ultra 7 255HX，Python 3.12.3，
  numpy 2.3.5，底数 10⁴）。换机器重跑会得到不同的毫秒数，计数不变。

| 文件 | 内容 |
| --- | --- |
| `data/mult/schoolbook.json` | 4761×3082 的每一格、每一步、进位与对角线求和 |
| `data/mult/karatsuba.json` | 拆半、三次乘法、z 值、拼回、1024 位计数阶梯 |
| `data/mult/toom.json` | 五点求值、五点乘积、插值系数、拼回 |
| `data/mult/ntt.json` | 8 点变换的每个点值、点乘结果、逆变换系数、蝶形计数 |
| `data/mult/bench.json` | 64/256/1024/4096 位的四种实现耗时与计数；NTT 的 1024/4096/16384 位 |
| `data/mult/code.json` | 13 行源码、逐帧调用栈、高亮行、验证位 |
| `data/mult/voice.json` | 106 句的实测时长（TTS 产出，提交入库，见 §5） |

组件里不写数字：屏幕上出现的每个值都来自这些 JSON，或由它们算出来的（百分比、条形长度、比值）。

## 3. 旁白与时间轴

时间轴不是按字数估的。先合成、再量长度、再用长度定场景时长：

```bash
node scripts/qa/dump_script.mjs src/mult/script.ts data/mult/lines.json      # 1. 冻结台词表
python3 scripts/tts/synthesize_mult.py ... --fp16                          # 2. 逐句合成，写 voice.json
node scripts/qa/dump_script.mjs src/mult/script.ts data/mult/lines.json      # 3. 用实测时长重排
python3 scripts/tts/build_mult_narration.py ...                            # 4. 铺成一条旁白
```

第 3 步必须在第 2 步之后重跑，否则旁白用的还是旧时长（曾经因此产生两句被切断的旁白，见
docs/deployment.md §3.3）。`voice.json` 提交入库：它决定时间轴，换机器重合成就会换时间轴。

## 4. 屏幕上的四个证明

### 4.1 n²：每一位两两相乘

n 位十进制数拆成 n 个一位数，两两相乘得 n×n 个积。片子用一个 4×4 格阵把这 16 个积摆出来，
再沿对角线进位求和。这是"看得到的计数"，不是公式。

### 4.2 Karatsuba：从四次乘法到三次

把 a=a₀·B+a₁、b=b₀·B+b₁ 展开，交叉项 a₀b₁+a₁b₀ 可以写成 (a₀+a₁)(b₀+b₁)−a₀b₀−a₁b₁：
一次加法换掉一次乘法。于是 T(n)=3T(n/2)+O(n)，p=log₂3≈1.585。

归纳法在屏幕上完整写出，**猜的是强化形式** T(n) ≤ c·nᵖ − 2dn：

- 猜：T(n) ≤ c·nᵖ − 2dn
- 步：3(c(n/2)ᵖ − dn) + dn = c·nᵖ − 2dn（因为 3/2ᵖ = 1，正是 p 的定义）
- 基例：取 c 足够大即可，与 n 无关

只猜 T(n) ≤ c·nᵖ 是闭不上的：代入后多出来的 dn 无处可去（3/2ᵖ = 1 时右边没有余量）。
第一版就是错在这里，画面与旁白都已改（docs/known-issues.md K16）。

### 4.3 Toom-3：五个点定一个多项式

三个块的多项式是四次的，由五个点唯一确定，所以五次乘法（而不是九次）就够；剩下的是插值。
屏幕用 900800007×400500003 走一遍：五点求值 → 五点相乘 21/288/16/1711/36 → 插值出
21/59/95/77/36 → 拼回 360077009500590021，与直接相乘一致。

### 4.4 NTT：单位根把卷积变成点乘

Σⱼ ω^(j(k−k′)) = n·[k=k′]：交叉项全部抵消，只剩逐点乘积。代价是三次变换、每次 (n/2)log₂n 个
蝶形；n=8 时是 36 个蝶形，而不是直接卷积的 4×4=16 次乘法。整数上用模 998,244,353 的原根 3，
全程整数运算，没有浮点误差。

## 5. 一次重跑

```bash
python3 scripts/generate_mult_data.py                      # 计数与实测（换机器可重测）
node scripts/make.mjs --composition Multiplication \
  --narration public/voice/mult_narration.wav \
  --score public/music/score.wav \
  --cut-frames 795,2413,4505,6257,8075,10848,13018,15052,16878 \
  --out out/pkg_mult --exports=true
```

`--cut-frames` 是九处硬切：场与场之间硬切，切点前后各两帧的亮度跳变不是闪烁，必须掩掉
（`luma_blink.py` 的语义见 docs/deployment.md §3.6）。**绝不抬 `--thresh` 来换通过。**

## 6. 边界与取舍（不要拿去当反例）

- **纯 Python 的 Karatsuba 比竖式慢**（1024 位：11.5 ms vs 49.8 ms）。片子明说这一点：省的是乘法，
  付出的是加法与递归调用，而纯 Python 里一次加法与一次乘法同价。要证明"渐近更快"，看计数，
  不要看这份墙钟。
- **阈值与魔法来自工程实践**（CPython 的 70 位阈值、GMP 的分段与 CRT），不是这部片测出来的。
- **NTT 用单模数**，只为演示；真实实现要 CRT 拼多个模数。
- 片长 588 秒，配音 106 句，10 场，9 处硬切。

## 7. 实测交付（本机，gen24，2026-10-18）

一次 `npm run make` 的 report.json，不是手抄：

| 项 | 实测 |
| --- | --- |
| 成片 | 27,717,606 B，587.900 s 容器 / 587.87 s 时间轴，h264 1920x1080 30 fps + aac 48 kHz 立体声 |
| sha256 | `af276de189cbf923684f986f65ff950d8e4455c91e088ff8079762b92e3ced17` |
| 响度 | I = -15 LUFS，TP = -2 dBTP |
| 闪烁 | meanAbsDelta 0.0147 / p99 0.1428 / max 8.74（阈值 12，9 个切点已掩） |
| 配乐 | full -25.08 / 可听带 -27.86 dBFS，audible_share 0.631，sub_share 0.068 |
| 混音 | 589.07 s，duck 4.5 dB（65.7% 时间生效），peak -2.00 dBFS，rms -19.12 |
| 说话/空档 | speech -15.28 / gap_full -25.57 / gap_audible -28.29 dB，bed 贡献 41.7 dB |
| 静帧 lint | 24 帧 PASS（当时口径；现在全仓 59 帧），Multiplication 十帧盒数 27/93/132/111/51/154/38/32/47/26 |
| 交付集 | 106 条 SRT、10 章（FFMETADATA + 人读章节表）、cover.png 92,711 B |

抽检四段音轨（volumedetect，t=120/300/420/560：mean -18.2/-20.4/-18.7/-25.8 dB，峰值
-2.1/-3.4/-3.1/-7.6 dBFS）。t=560 落在 code 场尾的静场，所以偏低；其余三段都在 -18 到 -20 dB，
说明旁白与配乐全长都在，不存在"某一段只剩 BGM"。

18 个 stage 全 exit 0：design contract → type ratchet → typecheck → probe composition →
music gate (stem) → demo bed → render (picture only) → probe duration → stills ×3 → still lint →
mix → music gate (mix) → mux → loudnorm → flicker gate → publish。

字幕预算：106 句最长 34 字（`script_check.mjs` 的 MAX_CHARS = 34），SRT 折行 0 条 —— 全片
没有一句需要折两行。上一版有一句 44 字，被 `script_check` 判失败后重录了那一句（见
docs/known-issues.md K16 的收尾）。