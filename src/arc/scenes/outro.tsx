import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Card, Fig, Mono, Body, Scene, EV, PAD, CW, beatAt, pct } from "../shared";

/* 结语：三句话 + 出处 + 论文之外的工业实现。 */
const POINTS = [
  { k: "一", t: "把两种份额做成在线学习量", d: "p 不是参数，是状态" },
  { k: "二", t: "常数时间、常数空间", d: "可以像 LRU 一样实现" },
  { k: "三", t: "不挑负载", d: "离线最优就在眼前" },
];

export const SOutro: React.FC = () => {
  const f = useCurrentFrame();

  return (
    <Scene id="outro">
      <div style={{ position: "absolute", left: PAD, top: 92, width: CW }}>
        <Build at={beatAt("outro", 0, 8)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>11 / 三句话</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>记住三件事</div>
        </Build>
      </div>

      <div style={{ position: "absolute", left: PAD, top: 250, width: 900 }}>
        {POINTS.map((p, i) => (
          <div key={p.k} style={{ display: "flex", gap: 22, alignItems: "flex-start", marginBottom: 26, opacity: pct(f, beatAt("outro", i + 1, 8), beatAt("outro", i + 1, 8) + 20) }}>
            <div style={{ width: 54, textAlign: "center", fontFamily: FONT.serif, fontSize: FT.num, color: C.cyan }}>{p.k}</div>
            <div>
              <div style={{ fontFamily: FONT.sans, fontSize: FT.lead, color: C.ink }}>{p.t}</div>
              <div style={{ fontFamily: FONT.sans, fontSize: FT.meta, color: C.inkFaint, marginTop: 6 }}>{p.d}</div>
            </div>
          </div>
        ))}

        <Build at={beatAt("outro", 4, 8)} style={{ marginTop: 20 }}>
          <Card label="论文与出处" accent={C.amber} pad={20}>
            <Mono size={FT.body} color={C.ink}>{"USENIX 开放获取 · FAST '03 · pp. " + EV.paper.pages}</Mono>
            <Body size={FT.meta} style={{ marginTop: 8 }}>Nimrod Megiddo 与 Dharmendra S. Modha，IBM Almaden 研究中心</Body>
          </Card>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1060, top: 250, width: 740 }}>
        <Fig id="title" src="arc/title.png" width={740} w={1566} h={275}
          at={beatAt("outro", 5, 8)} tag="p.1 题头" label="论文题头：标题、作者与所属研究中心" />
        <div style={{ height: 22 }} />
        <Fig id="cover" src="arc/cover.png" width={470} w={1122} h={751}
          at={beatAt("outro", 5, 8)} tag="封面" label="FAST '03 会议论文集封面" />
        <Build at={beatAt("outro", 6, 8)} style={{ marginTop: 20 }}>
          <Card label="论文之外" accent={C.violet} pad={18}>
            <Body size={FT.label}>OpenZFS 的 ARC 是最有名的工业实现，同一套 p 学习规则跑在文件系统里。</Body>
          </Card>
        </Build>
      </div>
    </Scene>
  );
};
