import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Head, Mono, PAD, REF, Scene, frameOf, pct, VIEWS } from "../shared";
import { Reference } from "../plates";

/* 测量场：参考图原样放在那里，上面盖一层同一坐标系的 SVG。
 * 曲线不是示意——每个视图的左右边界就是 data/char/ref_views.json 里那 128 行数字，
 * 建模脚本吃的也是这两条曲线，所以这一屏既是讲解也是复算。 */

const IMG_W = 832;
const IMG_H = 624;
const VIEW_COLOR: Record<string, string> = { front: C.cyan, side: C.violet, back: C.amber };

const silhouette = (view: "front" | "side" | "back"): string => {
  const v = REF[view];
  const x0 = v.bbox[0];
  const y0 = v.bbox[1];
  const h = v.bbox[3] - v.bbox[1] + 1;
  const left: string[] = [];
  const right: string[] = [];
  v.prof128.forEach((pair, k) => {
    const y = y0 + (h * (k + 0.5)) / 128;
    const l = pair[0];
    const r = pair[1];
    if (l === null || r === null) return;
    left.push((x0 + l * h).toFixed(2) + "," + y.toFixed(2));
    right.push((x0 + r * h).toFixed(2) + "," + y.toFixed(2));
  });
  return left.concat(right.reverse()).join(" ");
};

export const SMeasure: React.FC = () => {
  const f = useCurrentFrame();
  const draw = (k: number) => pct(f, frameOf("measure", k), frameOf("measure", k) + 26);

  return (
    <Scene id="measure">
      <Head kicker="01 / 把图量成数字" title="建模之前，先把图量干净" goal="三视图 → 每条边 128 个采样 → 左右两条曲线" />

      <div style={{ position: "absolute", left: PAD, top: 320, width: 900 }}>
        <div style={{ position: "relative", width: IMG_W, borderRadius: 10, overflow: "hidden", border: "1px solid " + C.panelLine }}>
          <Reference w={IMG_W} style={{ opacity: 0.92 }} />
          <svg viewBox={"0 0 " + IMG_W + " " + IMG_H} width={IMG_W} height={IMG_H}
            style={{ position: "absolute", inset: 0, overflow: "visible" }}>
            {VIEWS.map((v, i) => {
              const p = draw(i + 1);
              if (p <= 0) return null;
              const vv = REF[v];
              const y0 = vv.bbox[1];
              const h = vv.bbox[3] - vv.bbox[1] + 1;
              return (
                <g key={v}>
                  <polygon points={silhouette(v)} fill="none" stroke={VIEW_COLOR[v]} strokeWidth={2}
                    strokeLinejoin="round" pathLength={1} strokeDasharray={p.toFixed(3) + " 1"} opacity={0.95} />
                  {[0.25, 0.5, 0.75].map((t) => (
                    <line key={t} x1={vv.bbox[0] - 6} y1={y0 + h * t} x2={vv.bbox[2] + 6} y2={y0 + h * t}
                      stroke={VIEW_COLOR[v]} strokeWidth={1} opacity={0.35 * p} />
                  ))}
                </g>
              );
            })}
          </svg>
        </div>
        <Mono size={FT.micro} color={C.inkFaint} style={{ marginTop: 10, display: "block" }}>
          public/char/reference.png · 832×624 · sha256 记在 data/char/gate.json · 曲线 = data/char/ref_views.json
        </Mono>
      </div>

      <div style={{ position: "absolute", left: 1050, top: 330, width: 800 }}>
        <Build at={frameOf("measure", 1)}>
          <Card label="量法" accent={C.cyan}>
            <Body size={FT.body} color={C.inkDim} style={{ lineHeight: 1.75 }}>
              色度阈值把图形从白底上切下来，<br />
              每一行取最左、最右的边界像素，<br />
              除以图高归一化 —— 于是三个视图共用一套单位。
            </Body>
          </Card>
        </Build>
        <div style={{ display: "flex", gap: 24, marginTop: 26 }}>
          {[
            { k: "视图", v: "3", at: 2 },
            { k: "每视图折线", v: "128", at: 3 },
            { k: "单位高度", v: "1.000", at: 4 },
          ].map((c) => (
            <Build key={c.k} at={frameOf("measure", c.at)} style={{ flex: 1 }}>
              <Card pad={20}>
                <Mono size={FT.meta} color={C.inkFaint}>{c.k}</Mono>
                <div style={{ fontFamily: FONT.mono, fontSize: FT.num, color: C.ink, marginTop: 6 }}>{c.v}</div>
              </Card>
            </Build>
          ))}
        </div>
        <Build at={frameOf("measure", 6)} style={{ marginTop: 26 }}>
          <Body size={FT.body} color={C.inkDim}>
            正视给宽度，侧视给厚度 —— 两张图合起来才有体积。<br />
            这张剪影，是后面所有误差的地基。
          </Body>
        </Build>
      </div>
    </Scene>
  );
};
