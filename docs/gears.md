# 《啮合：齿轮如何把速度换成力》—— 第三部片，3D 为主、2D 为辅

第三部片子。前两部（`Lecture`、`Multiplication`）是纯 2D 排版；这一部反过来：画面主体是
真实的 3D 齿轮，2D 只做标题、字幕、参数面板和两张图版。验收目标不在这个仓库里，而在
`gen24-admin/docs/30-gears-film-acceptance.md`（A1–A15 是硬指标，C1–C6 是内容要求）。

片名《啮合》，composition id `Gears`，11 场、332.77 秒（9,983 帧，script 侧 332.78）、1920×1080 / 30 fps。

## 1. 为什么是齿轮

- 它天生是 3D 的：齿廓、啮合相位、行星轮系都只能在三维里看清楚（A4 要求 3D 帧占比 ≥ 60%）。
- 它的每个数字都能验算：中心距、基圆、重合度、Willis 方程、背隙角误差。
- 它有一条可讲的发展弧：水车（木齿）→ 摆钟（齿数比定时间）→ 行星轮系（三个速比）→ 风电齿轮箱。

片子不讲"齿轮很伟大"，讲**齿形为什么必须是这条曲线**：渐开线 → 共轭 → 重合度 → 扭矩 →
行星 → 背隙 → 模数 → 来历。

## 2. 11 场

| # | id | 章节 | 时长 | 3D 占比 | 画面主体 |
|---|----|------|------|---------|----------|
| 1 | open | 开场 | 26.43 | 100% | 20/50 齿对开始转 |
| 2 | ratio | 速比 | 29.52 | 100% | 同一对轮的转速差与"转一圈转 144°" |
| 3 | involute | 渐开线 | 32.28 | 100% | 基圆 + 解开的绳子 + 绳子端点画出的曲线 |
| 4 | conjugate | 为什么是它 | 31.85 | 35% | 啮合线图版（2D SVG）+ 远处的齿对 |
| 5 | contact | 重合度 | 31.04 | 100% | 齿对近景 + 啮合线走过几个齿距的进度 |
| 6 | torque | 扭矩 | 31.35 | 100% | 同一对轮，功率不变时扭矩怎么涨 |
| 7 | planetary | 行星轮系 | 33.55 | 100% | 太阳 + 3 行星 + 内齿圈，齿圈固定 |
| 8 | backlash | 背隙 | 29.02 | 45% | 背隙图版（2D SVG）+ 齿对近景 |
| 9 | module | 模数 | 29.12 | 100% | 20/50 齿对与 m=3 的同齿数齿轮对照 |
| 10 | history | 来历 | 30.51 | 75% | 12 齿木轮与 60 齿轮（摆钟/水车比例） |
| 11 | outro | 结论 | 28.11 | 100% | 齿对收束 |

场次时长不是估的：`script.ts` 里每句台词先按字数算初值，合成旁白后由
`data/gears/voice.json` 的实测长度重新定场长（见 §6）。`scene_3d_budget.mjs` 用每场的
`mode` 与 `three`（该场里 3D 画布真正在渲染的时长占比）算加权占比：

```
3D     288.49 s weighted = 86.7% (floor 60%)
flat   60.87 s of scenes under half 3D = 18.3% (ceiling 40%)
```

把 `three` 全部改成 0.1，这条门禁会红（21.5% / 90.7%）—— 它验的是数字，不是文案。

## 3. 一个真源：data/gears/params.json

```json
{
  "pressureAngleDeg": 20,
  "pairs": {
    "a": { "module": 2, "z1": 20, "z2": 50, "faceWidth": 3, "backlashMm": 0.05 },
    "b": { "module": 2, "zSun": 24, "zPlanet": 18, "zRing": 60, "planets": 3, "faceWidth": 3, "backlashMm": 0.05 }
  }
}
```

`python3 scripts/generate_gear_data.py`（= `npm run gears:data`）从这一个文件生成七个 JSON：

| 文件 | 内容 |
|------|------|
| `geometry.json` | 中心距 70.0、基圆 18.793852 / 46.984631、速比 2.5、重合度 1.6558、基节 |
| `ratio.json` | 5 行转速表（小轮转 0–4 圈，大轮转 −144°/圈） |
| `involute.json` | 49 个渐开线点、`tMax` 0.6087、恒等式 `r(t)=r_b·√(1+t²)` |
| `torque.json` | P=1000 W、ω₁=30 rad/s ⇒ τ₁ 33.3 N·m、τ₂ 83.3 N·m |
| `planetary.json` | Willis `(n_s−n_c)/(n_r−n_c) = −z_r/z_s = −2.5`，三种固定模式与四组数值状态 |
| `backlash.json` | 0.02/0.05/0.10/0.20 mm ⇒ `atan(c/r)` 的角误差 |
| `history.json` | 摆钟 12:1、怀表 3600:1、风电 80–120:1（标注为典型值，不是实测值） |

组件不写数字：屏幕上出现的每一个值都来自这些 JSON，或者由它们算出来。

## 4. 几何：齿廓是算出来的

`src/gears/profile.ts` 是纯函数（不 import three），所以同一份代码既给渲染器用，也给
node 门禁用：

- 齿侧角 `flankAngle(r) = half − (inv(α_r) − inv(α_p))`（外齿），内齿取加号；`inv(a)=tan a − a`。
- 齿顶 `rTip = r ± m`，齿根 `rRoot = r ∓ 1.25m`；齿根到基圆之间走径向直线 —— 这是
  **明确承认的近似**（齿根过渡曲线有专门国标，这里不假装有）。
- 齿厚 `half = π/(2z) − backlash/2/r`。**背隙不是装饰**：没有它，两条理论齿廓在节点处恰好
  相切，多边形近似会在接触点附近偶尔交叠一两条边，啮合门禁就会误报碰撞。
- 相位：外啮合 `φ₁ = π/z₁ + θ`、`φ₂ = −θ·z₁/z₂`；行星（齿圈固定）
  `carrier = θ/(1+z_r/z_s)`、`spin = −θ·z_s/z_p + carrier·(1+z_s/z_p) + π/z_p`，
  行星位置角 `ψ = carrier + k·2π/3`。三个行星能同时在 0°/120°/240° 啮合，是因为
  `z_s+z_r` 能被行星数整除（24+60=84，84/3=28 齿距）。

`src/gears/geometry.ts` 把它变成 `THREE.ExtrudeGeometry`（模块级缓存，齿宽居中），内齿圈是
外圆 + 齿廓 hole，外齿轮可加轴孔与减重孔。

### 两条门禁

`npm run lint:geometry`（`scripts/qa/geometry_check.mjs`）验 8 条不变量：

```
PASS centre distance = m(z1+z2)/2  70.000000
PASS base radius = r cos(alpha)  18.793852 / 46.984631
PASS omega1*z1 = omega2*z2  i = 2.500000
PASS involute radius identity  max error 7.11e-15
PASS involute tangent is the string direction  max error 6.32e-3 (< 9.51e-3)
PASS contact ratio >= 1  1.6558
PASS planetary ring closes  60 = 24 + 2*18
PASS planets equally spaced  3 x 28
PASS Willis equation holds in every state  k = -2.5000
PASS backlash -> angle error  max error 0.00e+0
```

它在第一版里真的红过三条（切线容差过紧、Willis 状态生成写错、背隙用度而不是 `atan`），
所以这几条不是装饰。

`node scripts/qa/mesh_check.mjs` 验"画出来的东西不会互相穿模"：把两条齿廓离散成边，
数边与边的交点。

```
backlash 0.05 mm (the profiles are thinned by half of it per flank)
PASS external pair 20/50 never collides  swept 1.00 pitches
PASS planetary set never collides  sun 24 · planet 18 · ring 60, 3 planets, 60 deg
PASS a half-tooth phase error is caught  37 of 37 sampled angles collide
```

最后一条是**灵敏度自证**：把相位错半个齿，门禁必须红。没有这一条，"0 相交"可能只是门禁
看不见东西。

## 5. 3D 舞台：全画幅 + 画面右移

`src/gears/Gears.tsx` 的 `Stage` 是全画幅透明画布，物体在相机空间里整体右移 `shift`，
左侧留给文字。这是这一部与前两部最大的结构差别，也是踩过的坑（K23）：

- **不要用 CSS 把画布裁成半屏**。`ThreeCanvas` 的宽高取自 `useVideoConfig()`（1920×1080），
  CSS 只占 54% 宽只会把画面横向拉伸、机位整体偏右。第一版静帧里齿对只剩最右边一小块。
- **平面物体需要一盏正面灯**。三点光的 key 在 `(5.2, 7.4, 4.6)`，齿轮盘面几乎与它垂直，
  盘面只剩轮廓、齿顶发白。`Stage` 里补一盏 `(1.2, 3.2, 9)`、强度 2.2 的正面光之后才有形体。
- **`THREE.Line` 的 `linewidth` 在 WebGL 里基本被忽略**。渐开线曲线改用
  `TubeGeometry`（半径 2.4 mm）画，才在 1080p 里看得见。
- 画面里出现的每个齿轮都用同一份 `profile.ts`，没有导入模型；所以 §4 的门禁验的就是画面。

## 6. 旁白与时间轴（实测驱动）

```bash
node scripts/qa/dump_script.mjs src/gears/script.ts data/gears/lines.json
python3 scripts/tts/synthesize_gears.py --lines data/gears/lines.json \
  --out public/voice/gears --voice-json data/gears/voice.json \
  --indextts pkg/index-tts --model-dir shared/models/IndexTTS-2 \
  --ref-audio pkg/index-tts/examples/voice_03.wav --fp16
node scripts/qa/dump_script.mjs src/gears/script.ts data/gears/lines.json   # 必须重跑
python3 scripts/tts/build_gears_narration.py --lines data/gears/lines.json \
  --clips public/voice/gears --out public/voice/gears_narration.wav
```

第三步必须重跑：`script.ts` 从 `data/gears/voice.json` 读实测时长，重排之后场长才是真的。
`build_gears_narration.py` 会打印每一句的 overrun，零才是可接受的数字（乘法部片子就因为漏了
这一步被切掉两句）。

## 7. 复现

```bash
npm run gears:data        # params.json -> 七个 JSON
npm run lint:geometry     # 8 条不变量
node scripts/qa/mesh_check.mjs
npm run lint:budget       # 3D 占比
npx remotion still Gears out/still_gears.png --frame=900 --log=error
node scripts/make.mjs --composition=Gears --narration public/voice/gears_narration.wav \
  --cut-frames=793,1679,2647,3602,4534,5474,6481,7351,8225,9140 --out out/gears-package
```

## 7.5 交付实测（make: PASS）

```bash
node scripts/make.mjs --composition=Gears \
  --narration=public/voice/gears_narration.wav --score=out/package_gears/score.wav \
  --cut-frames=793,1679,2647,3602,4534,5474,6481,7351,8225,9140 \
  --out=out/package_gears --force-render
# make: PASS — out/package_gears/Gears.mp4 (332.77 s, -15 LUFS, TP -2 dBFS) + srt/chapters/cover
```

| 项目 | 实测 |
|------|------|
| 时长 / 帧数 | 332.77 s / 9,983 帧（composition 与容器一致，误差 < 0.15 s） |
| 画面 | 1920×1080 h264 High，30 fps，52,793,604 B |
| 响度 | I = -15 LUFS，TP = -2 dBTP |
| 配乐 | stem 全带 -25.08 dBFS、可听带 -27.87、audible_share 0.631、sub_share 0.068 |
| 混合 | duck 4.5 dB 覆盖 60.3% 时间轴，峰值 -2.29 dBFS，rms -19.59；speech -15.39 / gap_full -25.33 |
| 闪烁门禁 | mean\|Δ\| 0.0288、p99 0.1209、raw max 35.24，10 个硬切帧按声明屏蔽（阈值 12） |
| 静帧门禁 | 全仓 47 帧（Gears 11 帧），无出框/贴边/溢出/文字重叠 |
| 字幕 | 64 条 cue，0 条需要折行，最长 26 字（预算 34）；11 章，封面 frame 180 |
| sha256 | `458d15f08137e001433810ec1dcdfb8b369383f8eddb16d84c6beb95c4b993ef` |

第一次渲染其实失败在闪烁门禁：216.00 s 处有一帧只有背景（luma 14.0，前后 23.7 / 59.3）。
原因是场次用 `from=round(start·30)` + `durationInFrames=round(dur·30)` 摆放，而分段渲染按
下一场的起点切；两个独立取整在 4533 / 6480 / 7350 三处各留了一个空帧。改成按边界算时长
（`nextStart - thisStart`，末场到 `TOTAL`）后空洞消失，见 K24。

## 8. 已知限制

- 齿根是径向直线，不是过渡曲线；重合度按标准公式算，没有做齿顶修形。
- 齿廓用 10 段折线近似渐开线（`flankSamples`），所以"齿面"在很近的镜头里能看出折面。
- 行星轮系只演齿圈固定模式；另外两种模式只出现在数字里（Willis 表）。
- 没有材质贴图、没有 UV、没有角色动画、没有物理引擎：这部片子的 3D 只有"刚性几何 + 光"。
- 历史场的比例是典型值（12:1、3600:1、80–120:1），标注了出处，不当作实测。
- 渲染成本：9,983 帧里 3D 场面占 86.7%，比纯 2D 贵一个量级，长片必须走 `render_scenes.mjs` 的分段缓存。