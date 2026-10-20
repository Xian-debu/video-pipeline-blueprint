import React from "react";
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T, G } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { SCENES, TOTAL, FPS } from "../script";
import { Head, Card, Mono, Body, Line, Fig, Scene, PAD, CW, pct, clamp, EV, GRAY, WAVE } from "../shared";

export const SPaper: React.FC = () => {
  return (
    <Scene id="paper">
      <Head kicker="02 / 这篇论文" title="Hawk：两条腿走路" goal="SenSys 2024，嵌入式传感系统的顶级会议" />
      <div style={{ position: "absolute", left: PAD, top: 256, display: "flex", gap: 48 }}>
        <Fig id="header" tag="第 1 页" src="hawk/header.png" width={780} w={1485} h={513} at={6} label="第 1 页 · 标题、作者与机构（会议名在页脚）" />
        <div style={{ width: 620 }}>
          <Build at={12}>
            <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.meta }}>作者团队</Mono>
            <Body size={FT.lead} color={C.ink} style={{ marginTop: 12, lineHeight: 1.75 }}>
              Zijian Wang · Xingzhou Zhang · Yifan Wang<br />
              Xiaohui Peng · Zhiwei Xu
            </Body>
            <Body size={FT.body} color={C.inkFaint} style={{ marginTop: 10 }}>
              中国科学院计算技术研究所 · 中国科学院大学 · 大湾区大学
            </Body>
          </Build>
          <Build at={25}>
            <div style={{ height: 1, background: C.panelLine, margin: "26px 0" }} />
            <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.meta }}>核心主张</Mono>
            <Body size={FT.body} color={C.ink} style={{ marginTop: 12 }}>
              与其「采」一个数据集，不如「安排」一个数据集；<br />
              与其硬认总电流，不如先做一次差分。
            </Body>
          </Build>
        </div>
      </div>
      <div style={{ position: "absolute", left: PAD, top: 780, width: CW, display: "flex", gap: 20 }}>
        {[
          { n: "阶段一", t: "数据集构建", c: "平衡格雷码 · 共享可感知时间 · HawkDATA", col: C.cyan },
          { n: "阶段二", t: "事件识别", c: "稳态差分 · 30 周期窗口 · 投票决策", col: C.violet },
        ].map((s, i) => (
          <Build key={s.n} at={40 + i * 10} style={{ flex: 1 }}>
            <Card accent={s.col} style={{ padding: 22 }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: 14 }}>
                <Mono size={FT.meta} color={s.col}>{s.n}</Mono>
                <div style={{ fontFamily: FONT.sans, fontSize: FT.h2, color: C.ink }}>{s.t}</div>
              </div>
              <Body size={FT.meta} color={C.inkFaint} style={{ marginTop: 8 }}>{s.c}</Body>
            </Card>
          </Build>
        ))}
      </div>
    </Scene>
  );
};
