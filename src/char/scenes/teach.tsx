import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Head, Mono, PAD, Scene, frameOf, pct } from "../shared";

/* 复刻场：把真命令行打在屏幕上。这些命令都在仓库里跑得通 —— 不是「类似这样」的伪代码。 */

const STEPS = [
  {
    n: "1",
    what: "量图",
    cmd: "python3 scripts/char/measure.py --image public/char/reference.png --out data/char/ref_views.json",
  },
  {
    n: "2",
    what: "建模 + 判据（三个视角，一轮半分钟）",
    cmd: "blender -b --factory-startup --python scripts/char/gen.py -- --params data/char/params.json --jobs compare --res ref --out out/char",
  },
  {
    n: "3",
    what: "打分，退出码非零就不算过",
    cmd: "python3 scripts/char/check.py --shots out/char",
  },
  {
    n: "4",
    what: "渲染成片用的贴片（1080p / 48 spp / 一帧九秒）",
    cmd: "blender -b --factory-startup --python scripts/char/gen.py -- --params data/char/params.json --jobs hero,turntable,poses,clips,colors,build,closeups,patch --res 1080p --out out/char_hd",
  },
  {
    n: "5",
    what: "把渲染账本裁成贴片清单，再交给片厂",
    cmd: "python3 scripts/char/manifest.py --report public/plates/char/report.json --out data/char",
  },
];

export const STeach: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene id="teach">
      <Head kicker="10 / 你要怎么再来一遍" title="复刻需要的东西都在仓库里" goal="三个脚本 + 一条命令" />

      <div style={{ position: "absolute", left: PAD, top: 286, width: 1200 }}>
        {STEPS.map((s, i) => {
          const p = pct(f, frameOf("teach", i + 1), frameOf("teach", i + 1) + 12);
          return (
            <div key={s.n} style={{ display: "flex", gap: 18, marginBottom: 22, opacity: p }}>
              <div style={{ width: 34, paddingTop: 4, fontFamily: FONT.mono, fontSize: FT.mono, color: C.cyan }}>{s.n}</div>
              <div style={{ flex: 1 }}>
                <Mono size={FT.meta} color={C.inkDim}>{s.what}</Mono>
                <div style={{
                  marginTop: 6, background: C.bgSoft, border: "1px solid " + C.panelLine,
                  borderRadius: 8, padding: "12px 16px",
                  fontFamily: FONT.mono, fontSize: FT.code, color: C.ink,
                  lineHeight: 1.5, wordBreak: "break-all",
                }}>
                  <span style={{ color: C.inkFaint }}>$ </span>{s.cmd}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: 1320, top: 286, width: 528 }}>
        <Build at={frameOf("teach", 2)}>
          <Card label="三个脚本的分工" accent={C.cyan}>
            <Body size={FT.meta} color={C.inkDim} style={{ lineHeight: 1.9 }}>
              measure.py　　图 → 剖面数字<br />
              gen.py　　　　数字 → 几何 + 骨架 + 贴片<br />
              check.py　　　渲染 → 交并比 + 退出码
            </Body>
          </Card>
        </Build>
        <Build at={frameOf("teach", 4)} style={{ marginTop: 22 }}>
          <Card label="为什么能换角色" accent={C.violet}>
            <Body size={FT.meta} color={C.inkDim} style={{ lineHeight: 1.9 }}>
              脚本里没有写死「胖梨」。<br />
              换一张三视图、改 params.json、<br />
              再跑一遍 —— 骨架和动作都是脚本生成的。
            </Body>
          </Card>
        </Build>
        <div style={{ marginTop: 22 }}>
          <Mono size={FT.micro} color={C.inkFaint}>
            退出码：check.py 过 = 0，不过 = 1
          </Mono>
        </div>
      </div>
    </Scene>
  );
};
