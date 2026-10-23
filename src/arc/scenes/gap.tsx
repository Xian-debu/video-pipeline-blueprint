import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Card, Mono, Body, Line, Scene, SIM, PAD, CW, beatAt, pct, sceneFrames } from "../shared";

/* 难点：两个理想世界（SDD→LRU，IRM→LFU），真实负载在两者之间漂移；
 * 折中方案是固定份额 p，但 p 由谁定？图上画的是模拟器里 FRC_p 的实测曲线：
 * 小缓存偏爱 p=0，大缓存偏爱 p=25，没有哪一个处处最好。 */
export const SGap: React.FC = () => {
  const f = useCurrentFrame();
  const sw = SIM.sweep;
  const cs = sw.cachePages;
  const drift = Array.from({ length: 90 }, (_, i) => 0.5 + 0.42 * Math.sin(i / 6.5));
  const bestSmall = sw.frc.p0[0] >= sw.frc.p25[0] && sw.frc.p0[0] >= sw.frc.p50[0] ? "p = 0" : "p = 25";
  const last = cs.length - 1;
  const bestLarge = sw.frc.p25[last] >= sw.frc.p0[last] && sw.frc.p25[last] >= sw.frc.p50[last] ? "p = 25" : "p = 50";

  return (
    <Scene id="gap">
      <div style={{ position: "absolute", left: PAD, top: 96, width: CW }}>
        <Build at={beatAt("gap", 0, 12)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>02 / 为什么需要自适应</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>两个世界，一个参数</div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: PAD, top: 250, width: 470 }}>
        <Build at={beatAt("gap", 1, 12)}>
          <Card label="理想世界一 · SDD" accent={C.cyan}>
            <Body>栈距离分布。LRU 在这个世界里就是最优。</Body>
            <div style={{ marginTop: 12 }}><Mono size={FT.h2} color={C.cyan}>LRU 最优</Mono></div>
          </Card>
        </Build>
        <div style={{ height: 22 }} />
        <Build at={beatAt("gap", 3, 12)}>
          <Card label="理想世界二 · IRM" accent={C.amber}>
            <Body>独立引用模型。每个请求与历史无关，最优的是 LFU。</Body>
            <div style={{ marginTop: 12 }}><Mono size={FT.h2} color={C.amber}>LFU 最优</Mono></div>
          </Card>
        </Build>
        <div style={{ height: 22 }} />
        <Build at={beatAt("gap", 5, 12)}>
          <Card label="真实负载" accent={C.violet}>
            <Mono size={FT.meta} color={C.inkFaint}>在两个世界之间来回漂移（示意）</Mono>
            <div style={{ marginTop: 10 }}>
              <Line values={drift} w={410} h={90} lo={0} hi={1} color={C.violet} at={beatAt("gap", 5, 12) + 10} dur={44} />
            </div>
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 610, top: 250, width: 1180 }}>
        <Build at={beatAt("gap", 4, 12)}>
          <Card label="折中：给 recency 一个固定份额 p（FRC_p）" accent={C.cyan}>
            <div style={{ display: "flex", gap: 26, alignItems: "flex-start" }}>
              <div>
                <Mono size={FT.meta} color={C.inkFaint}>命中率 %</Mono>
                <div style={{ marginTop: 8 }}>
                  <Line values={sw.frc.p0} w={640} h={250} lo={0} hi={75} color={C.cyan} at={beatAt("gap", 4, 12) + 8} dur={sceneFrames("gap") * 0.5} />
                  <div style={{ marginTop: -250 }}>
                    <Line values={sw.frc.p25} w={640} h={250} lo={0} hi={75} color={C.violet} at={beatAt("gap", 4, 12) + 16} dur={sceneFrames("gap") * 0.5} />
                  </div>
                  <div style={{ marginTop: -250 }}>
                    <Line values={sw.frc.p50} w={640} h={250} lo={0} hi={75} color={C.coral} at={beatAt("gap", 4, 12) + 24} dur={sceneFrames("gap") * 0.5} />
                  </div>
                  <div style={{ marginTop: -250 }}>
                    <Line values={sw.arc} w={640} h={250} lo={0} hi={75} color={C.ink} at={beatAt("gap", 4, 12) + 32} dur={sceneFrames("gap") * 0.5} />
                  </div>
                </div>
                <div style={{ display: "flex", gap: 20, marginTop: 14 }}>
                  <Mono size={FT.tiny} color={C.cyan}>— p=0</Mono>
                  <Mono size={FT.tiny} color={C.violet}>— p=25</Mono>
                  <Mono size={FT.tiny} color={C.coral}>— p=50</Mono>
                  <Mono size={FT.tiny} color={C.ink}>— ARC（自适应）</Mono>
                </div>
              </div>
              <div style={{ width: 470 }}>
                <Body size={FT.body}>
                  图的横轴是缓存页数 c（16 → 1024），同一台合成负载上实测。
                </Body>
                <div style={{ marginTop: 22, opacity: pct(f, beatAt("gap", 6, 12), beatAt("gap", 6, 12) + 20) }}>
                  <Mono size={FT.body} color={C.ink}>{"c = " + cs[0] + "：" + bestSmall + " 最好"}</Mono>
                  <div style={{ height: 8 }} />
                  <Mono size={FT.body} color={C.ink}>{"c = " + cs[last] + "：" + bestLarge + " 最好"}</Mono>
                </div>
                <div style={{ marginTop: 24, opacity: pct(f, beatAt("gap", 7, 12), beatAt("gap", 7, 12) + 20) }}>
                  <Body size={FT.body} color={C.inkDim}>
                    LRU-2 把这个参数叫 CIP，它直接决定命中率；换一个缓存大小，同一个参数就不再好用。
                  </Body>
                </div>
              </div>
            </div>
          </Card>
        </Build>

        <div style={{ marginTop: 26, opacity: pct(f, beatAt("gap", 8, 12), beatAt("gap", 8, 12) + 22) }}>
          <Body size={FT.lead} color={C.ink}>
            「没有哪个事先定好的选择处处都好。」
          </Body>
        </div>
      </div>
    </Scene>
  );
};