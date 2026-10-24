# 《从一张三视图到会走路的胖梨》—— 角色建模教学片

第七部片子，也是第一部**把建模过程当教材**的片子：材料不是论文、不是算法，
而是一张 832x624 的角色三视图（`public/char/reference.png`，原图
`E:\Strata-data\models\swift-IQ2_XS\视图.png`）和一个要求 ——
「尽量还原，还要有骨架、能动、能染色，最后演示一段」。

composition id `Char`，12 场，1920x1080 / 30 fps。

## 1. 这类片子难在哪

前面六部片子，画面要么是排出来的（Lecture/Multiplication），要么是算出来的
（Gears/Hawk/Arc/Quickselect）。这一部要先**造一个东西**，再讲怎么造的。

1. **参考图重建是被证伪过的路线**。第三支片（gen24-admin docs/29）试过"多视图轮廓
   雕刻"：蛋度 0.742、部件暴露率 ≤16 %、六个变体全失败。所以这次换了个方向：
   不雕刻体，而是**把剪影量成剖面，再按剖面放样**。正面第 i 行的左右极值给出
   水平半宽 a(t)，侧面同一行给出深度半宽 b(t) 与深度中心 cy(t)；截面用超椭圆
   （指数 2.35，不是正圆），逐环连成曲面。这样正面与侧面的剪影**按构造**就对，
   不需要优化器去找。
2. **"像不像"必须能算，也必须能看**。于是有两道关：机器算交并比（IoU）、宽高比、
   轮廓 RMSE，人看三色叠加图（红=参考独有、蓝=渲染独有、绿=重合）。
   片上出现的每个数都来自 `data/char/gate.json`。
3. **能动**。16 根骨头、显式顶点组（不用自动权重：自动权重会让抬手带动肚皮，
   K68），四段逐帧函数驱动的动作（待机/挥手/转身/走路），全部由脚本生成，
   没有一根骨头是手工摆的。
4. **贴片要确定性**。三维部分不是渲染时实时的，而是 Blender 事先渲好的 alpha PNG
   （Cycles，1080p，48 spp），每张记 sha256；画面里按帧号取图。这条选择与 P15
   的"three.js 实时层"相比牺牲了灵活性，换来"同一帧永远是同一张图"。

## 2. 建模方法：从图到环

`scripts/char/measure.py`（一个命令、一个文件）把参考图变成 `data/char/ref_views.json`：

- 前景 = 色度 > 14 且亮度 < 250（白纸、饱和黄；脚底的灰影色度低，自然被丢掉）；
- 三个视图的边框是**固定**的（x0,x1,y0,y1 一次量准就冻结 —— 每次重跑的自动分割不是测量）；
- 128 个高度上取左右极值，按图形高度归一化（1.0 = 一个图高）；
- 裆部 = 剪影第一次裂成两段且间距 > 10 px 的那一行；
- 奶油斑块 = 前景内部、低色度、亮度 > 200 的面积占比。

`scripts/char/gen.py` 读这份剖面，做三件事：

1. **机身放样**。`body_ab(t)` 把 128 行剖面（先去峰平滑，再把峰值按比例还原，
   否则最宽处会被平滑削掉）变成 a(t)、b(t)、cy(t)，用 `ring_pts(z, cy, a, b, segs, n)`
   生成超椭圆环，170 环 x 160 段连面。手臂占位的高度带上躯干收窄（测到的剪影是臂，
   不是躯干），侧面 overall 再乘 depth_scale / 加 depth_shift。
2. **部件贴面**。眼睛、瞳孔、嘴从 `surf_y(x, z)` 求表面高度后贴上去：眼是巩膜球
   嵌进脸里、瞳孔是巩膜前极外侧的小球；嘴是沿微笑弧线扫掠的细管（不是 torus ——
   torus 会把整圈都露出来，K66）。四肢是分段放样：腿（大腿到踝，外撇）、脚（压扁椭球，
   偏航 8°）、手臂（沿身体曲面走、肩端埋进躯干）、手（球）。
3. **奶油斑块是材质分支，不是几何**。r² = (x/rx)² + ((z-z0)/rz)²，中间 0.90–1.00 做软边界，
   再乘一个 Y 朝向门，Mix Shader 在黄与奶油之间切。关键是**权重在静止姿势里算一次、烘成顶点属性**
   （`color_attributes.new(name="patch", type="FLOAT_COLOR", domain="POINT")`）：材质里的 Object
   坐标取的是形变后的网格，根骨一转、斑块就滑到背上 —— 这个坑是渲染完转台贴片才看出来的。
   做过的错事：用独立面片贴上去（像贴了个白盘子）；用逐面材质索引（边界锯齿）；直接在着色器里算。

## 3. 骨架与动作

`scripts/char/bones.py` 是骨头的唯一来源（16 行：名字、头、尾、父级），
`gen.py` 与 `scripts/char/manifest.py`（写 `data/char/bones.json` 给画面用）都从它读。

权重不用 `ARMATURE_AUTO`：`weight()` 按高度分带写顶点组（身 → 头/胸/脊椎，
腿 → 大腿/小腿，臂 → 上臂/前臂，手/脚/眼/瞳孔/嘴给满）。结果是 40028 个顶点
全部有权重，且抬手不会拽动肚皮。

动作是纯帧号函数 `clip_pose(name, f, n)`：待机 24 帧（胸腔起伏）、挥手 24 帧、
转身 24 帧（根骨 360°）、走路 30 帧（腿反相）。**没有随机、没有时钟、没有
requestAnimationFrame**，所以每一张贴片可复算、可比对。

## 4. 判据

`scripts/char/check.py` 把渲染的 alpha 掩码与参考剪影各自按高度缩到 400 px 高、
水平居中，在同一坐标系里算：

| 视角 | IoU | 门槛 | 宽高比误差 | 轮廓 RMSE |
| --- | --- | --- | --- | --- |
| front | 0.8512 | 0.840 | 1.56 % | 0.0201 |
| side | 0.8146 | 0.800 | 0.66 % | 0.0335 |
| back | 0.8595 | 0.850 | 3.30 % | 0.0232 |

退出码是结论：三条都过为 0，否则 1 —— 可以直接放进流水线当门。

**已知缺陷（不藏）**：脚的外扩、肩背弧线、腿的粗细。参考图边缘自带阴影与柔光，
绝对交并比到不了 0.9；再磨下去的收益已经小于噪声，所以停在这一版并把差距标出来。

## 5. 画面：贴片 + 排版

三维部分全部是 `public/plates/char/*.png`（alpha PNG，1080p，Cycles 48 spp，
一帧约 9 秒，共 162 张）：hero、转台 36 帧、姿势 6 张、动作 102 帧、染色 3 张、
构建 8 档、特写 4 张、斑块遮罩 1 张。渲染账 `public/plates/char/report.json`
（每张 sha256）由 `scripts/char/manifest.py` 裁成 `data/char/plates.json` 进 git ——
画面取不到图时报错会指名道姓（K20 那种"空画面照样过门"的坑）。

排版是 Remotion 的二维层：`src/char/shared.tsx` 提供 Head/Card/Tbl/Bar/Foot，
`src/char/plates.tsx` 负责按名字/按帧号取图，12 个场景各自一个文件。

## 6. 12 场

| # | id | 章节 | 时长 | 句数 | 画面主体 |
|---|----|------|------|------|----------|
| 1 | open | 开场 | 40.2 s | 7 | 参考图三视图 + 成片里的角色 |
| 2 | measure | 测量 | 41.6 s | 8 | 参考图上的剖面线 + 128 行数字 |
| 3 | loft | 放样 | 48.9 s | 9 | 环 x 环的构建贴片 |
| 4 | parts | 部件 | 41.3 s | 8 | 眼/嘴/手/脚特写 |
| 5 | patch | 斑块 | 44.5 s | 7 | 顶点属性公式 + 材质分支 |
| 6 | judge | 判据 | 50.9 s | 9 | 三色叠加图 + IoU 表 |
| 7 | rig | 骨架 | 46.3 s | 8 | 16 根骨头的 SVG + 姿势贴片 |
| 8 | motion | 运动 | 42.7 s | 8 | 四段序列帧同时循环 |
| 9 | color | 染色 | 32.0 s | 6 | 三色变体 + 材质树 |
| 10 | compare | 对照 | 38.9 s | 7 | 叠加图 + 残差说明 |
| 11 | teach | 复刻 | 42.8 s | 8 | 五条真命令 |
| 12 | close | 收尾 | 23.8 s | 5 | 转台一圈 + 三个数 |

合计 **493.93 s / 14,818 帧 / 90 句**：这个数不是估的，是 `data/char/lines.json` 排完 TTS 实测时长后的结果（排期估算 515.88 s，实测语音 378.7 s）。改一个字就要重跑 `dump_script.mjs` 和 `build_char_narration.py`，画面时长跟着走。

## 7. 复刻

```bash
python3 scripts/char/measure.py --image public/char/reference.png --out data/char/ref_views.json
blender -b --factory-startup --python scripts/char/gen.py -- --params data/char/params.json \
  --jobs compare --res ref --out out/char
python3 scripts/char/check.py --shots out/char          # 退出码 0 才算过
blender -b --factory-startup --python scripts/char/gen.py -- --params data/char/params.json \
  --jobs hero,turntable,poses,clips,colors,build,closeups,patch --res 1080p --out out/char_hd
python3 scripts/char/manifest.py --report public/plates/char/report.json --out data/char
node scripts/make.mjs --composition=Char --narration public/voice/char_narration.wav
```

换角色 = 换参考图 + 改 `data/char/params.json`，脚本不用改一行。

## 8. 出处

- 探针与路线判决：gen24-admin `docs/41-3d-character-route.md`（8 轮迭代、K62–K69、P19–P23）
- 片厂工具链对齐：gen24-admin `docs/42-toolchain-alignment.md`
- 本片规划：gen24-admin `docs/43-char-film-plan.md`
- 参考图：user-provided, `E:\Strata-data\models\swift-IQ2_XS\视图.png`
