import React from "react";
import { useCurrentFrame } from "remotion";
import { Img, staticFile } from "remotion";
import { C, FT } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Chip, Head, Mono, PAD, Scene, Tbl, V_, f3, frameOf, pc1 } from "../shared";

/* 对照场：三色叠加图 + 判据表。差距不藏起来，标出来 —— 这比「看起来还行」可信。 */

const OVERLAY = ["front", "side", "back"];

export const SCompare: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene id="compare">
      <Head kicker="09 / 差距在哪" title="把参考图和渲染图叠起来" goal="已知缺陷也要标出来" />

      <div style={{ position: "absolute", left: PAD, top: 292, display: "flex", gap: 26 }}>
        {OVERLAY.map((v, i) => {
          const src = staticFile("char/gate/cmp_" + v + ".png");
          return (
            <Build key={v} at={frameOf("compare", i + 1)} style={{ width: 556 }}>
              <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 10, overflow: "hidden" }}>
                <Img src={src} style={{ width: 556, display: "block" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
                <Mono size={FT.meta} color={C.inkDim}>{v.toUpperCase()}</Mono>
                <Mono size={FT.meta} color={V_(v).pass ? C.cyan : C.coral}>IoU {f3(V_(v).iou)}</Mono>
              </div>
            </Build>
          );
        })}
      </div>

      <div style={{ position: "absolute", left: PAD, top: 726, width: 1180 }}>
        <Build at={frameOf("compare", 3)}>
          <Tbl
            at={frameOf("compare", 3)}
            stagger={6}
            size={FT.mono}
            rowH={44}
            cols={[
              { key: "v", label: "视角", w: 130 },
              { key: "iou", label: "交并比", w: 150, align: "right" },
              { key: "wh", label: "宽高比误差", w: 190, align: "right" },
              { key: "rmse", label: "轮廓 RMSE", w: 190, align: "right" },
              { key: "p", label: "门槛", w: 130 },
            ]}
            rows={OVERLAY.map((v) => {
              const g = V_(v);
              return {
                key: v,
                cells: {
                  v: <span style={{ color: C.ink }}>{v}</span>,
                  iou: f3(g.iou),
                  wh: pc1(g.w_over_h_err),
                  rmse: f3(g.profile_rmse),
                  p: <span style={{ color: g.pass ? C.cyan : C.coral }}>{g.pass ? "过" : "不过"}</span>,
                },
              };
            })}
          />
        </Build>
      </div>

      <div style={{ position: "absolute", left: 1300, top: 726, width: 548 }}>
        <Build at={frameOf("compare", 5)}>
          <Card label="剩下的是这些" accent={C.coral}>
            <Body size={FT.meta} color={C.inkDim} style={{ lineHeight: 1.85 }}>
              脚的外扩 · 肩背弧线 · 腿的粗细<br />
              参考图边缘自带阴影和柔光，<br />
              绝对交并比到不了零点九。<br />
              <span style={{ color: C.inkFaint }}>继续磨下去，收益已经小于噪声。</span>
            </Body>
          </Card>
        </Build>
        <div style={{ marginTop: 20 }}>
          <Chip color={C.inkFaint} at={frameOf("compare", 6)}>公开账本 data/char/gate.json</Chip>
        </div>
      </div>
    </Scene>
  );
};
