import React from "react";
import { Img, staticFile } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Foot, GATE, Head, Mono, PAD, Scene, Tbl, f3, frameOf, pc1, V_, VIEWS } from "../shared";

/* 判据场：这一屏的每个数字都从 data/char/gate.json 读，讲稿念的也是这三个数。
 * 三层剪影判据 + 锚点，任何一层不过就回去改参数。 */

const CN: Record<string, string> = { front: "正面", side: "侧面", back: "背面" };

export const SJudge: React.FC = () => (
  <Scene id="judge">
    <Head kicker="05 / 像不像，要能量" title="交并比、宽高比、剖面误差、锚点" goal="四层判据，任何一层不过就回去改" />

    <div style={{ position: "absolute", left: PAD, top: 320, width: 900 }}>
      <Build at={frameOf("judge", 2)}>
        <Tbl
          cols={[
            { key: "v", label: "视图", w: 130 },
            { key: "iou", label: "交并比", w: 170, align: "right" },
            { key: "min", label: "门槛", w: 150, align: "right" },
            { key: "wh", label: "宽高比误差", w: 220, align: "right" },
            { key: "rmse", label: "剖面 RMSE", w: 200, align: "right" },
          ]}
          rows={VIEWS.map((v) => ({
            key: v,
            strong: true,
            cells: {
              v: CN[v],
              iou: f3(V_(v).iou),
              min: f3(V_(v).min_iou),
              wh: pc1(V_(v).w_over_h_err),
              rmse: f3(V_(v).profile_rmse),
            },
          }))}
          at={frameOf("judge", 2)}
        />
      </Build>

      <Build at={frameOf("judge", 6)} style={{ marginTop: 30 }}>
        <div style={{ display: "flex", gap: 40 }}>
          {[
            { k: "宽高比门槛", v: "+" + pc1(GATE.thresholds.w_over_h) },
            { k: "剖面门槛", v: f3(GATE.thresholds.profile_rmse) },
            { k: "总判定", v: GATE.pass ? "PASS" : "FAIL", hot: true },
          ].map((c) => (
            <div key={c.k}>
              <Mono size={FT.meta} color={C.inkFaint}>{c.k}</Mono>
              <div style={{ fontFamily: FONT.mono, fontSize: FT.num, color: c.hot ? C.cyan : C.ink, marginTop: 4 }}>{c.v}</div>
            </div>
          ))}
        </div>
      </Build>

      <Build at={frameOf("judge", 7)} style={{ marginTop: 30 }}>
        <Body size={FT.body} color={C.inkDim} style={{ lineHeight: 1.8 }}>
          两张剪影各自按高度归一化，再比交并比 —— 不比像素，比形状。<br />
          第四层是锚点：眼心、眼半径、眼距、斑块起点与面积、色调差。
        </Body>
      </Build>
    </div>

    <div style={{ position: "absolute", left: 1010, top: 300, width: 820, display: "flex", flexDirection: "column", gap: 14 }}>
      {VIEWS.map((v) => (
        <Build key={v} at={frameOf("judge", 3)}>
          <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
            <Img src={staticFile("char/gate/cmp_" + v + ".png")} style={{ width: 272, borderRadius: 8, border: "1px solid " + C.panelLine }} />
            <div>
              <Mono size={FT.body} color={C.ink}>{CN[v]}</Mono>
              <div style={{ fontFamily: FONT.mono, fontSize: FT.num, color: C.cyan, marginTop: 2 }}>{f3(V_(v).iou)}</div>
              <Mono size={FT.micro} color={C.inkFaint} style={{ letterSpacing: FT_T.micro }}>绿=重合 红=参考独有 蓝=渲染独有</Mono>
            </div>
          </div>
        </Build>
      ))}
    </div>

    <Foot at={frameOf("judge", 8)}>
      data/char/gate.json · 判据由 scripts/char/check.py 写出 · 参考图 sha256 {GATE.reference.sha256.slice(0, 12)}
    </Foot>
  </Scene>
);
