import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Card, Head, Mono, PAD, PLATES, Scene, frameOf } from "../shared";
import { Plate } from "../plates";

/* 放样场：左边是「一圈一圈长出来」的真实渲染（build_00..07 是逐步删掉高处的面），
 * 右边是这一圈截面的定义，以及那个必须记住的平滑技巧。 */

const STEPS = 8;

export const SLoft: React.FC = () => {
  const f = useCurrentFrame();
  const at = frameOf("loft", 2);
  const span = Math.max(1, frameOf("loft", 7) - at);
  const step = f < at ? 0 : Math.min(STEPS - 1, Math.floor(((f - at) / span) * STEPS));

  return (
    <Scene id="loft">
      <Head kicker="02 / 剖面放样" title="身体是一圈一圈长出来的" goal="每个高度一个截面：宽度来自正视，深度来自侧视" />

      <div style={{ position: "absolute", left: PAD + 40, top: 300 }}>
        <Plate name={"build_0" + step} w={700} />
        <Mono size={FT.meta} color={C.inkFaint}>
          build_0{step} / 0{STEPS - 1} · 由下往上逐环生成（scripts/char/gen.py --jobs build）
        </Mono>
      </div>

      <div style={{ position: "absolute", left: 940, top: 320, width: 900 }}>
        <Build at={frameOf("loft", 1)}>
          <Card label="截面" accent={C.violet}>
            <div style={{ fontFamily: FONT.mono, fontSize: FT.code, color: C.ink, lineHeight: 1.85 }}>
              a(t) = (右(t) − 左(t)) / 2&nbsp;&nbsp;<span style={{ color: C.cyan }}>← 正视</span><br />
              b(t) = (前(t) − 后(t)) / 2&nbsp;&nbsp;<span style={{ color: C.violet }}>← 侧视</span><br />
              cy(t) = (前(t) + 后(t)) / 2&nbsp;&nbsp;<span style={{ color: C.amber }}>← 驼背靠它</span>
            </div>
            <Body size={FT.body} color={C.inkDim} style={{ marginTop: 16 }}>
              截面是超椭圆，指数 2.35；每圈 {String(PLATES.params.segs)} 段，共 {String(PLATES.params.body_rings)} 圈。
            </Body>
          </Card>
        </Build>

        <Build at={frameOf("loft", 5)} style={{ marginTop: 26 }}>
          <Card label="这一部最值得记住的技巧" accent={C.amber}>
            <Body size={FT.body} color={C.inkDim} style={{ lineHeight: 1.8 }}>
              量出来的曲线带折点，直接放样会在曲面上留下一圈圈横向条纹。<br />
              先平滑（窗 11、3 遍），再按原始最宽处等比缩回去 ——<br />
              峰值保住，折点消失。少了后半句，最宽处会被削小。
            </Body>
          </Card>
        </Build>

        <Build at={frameOf("loft", 8)} style={{ marginTop: 24 }}>
          <Mono size={FT.meta} color={C.inkFaint}>
            data/char/params.json · 参数版本 {String(PLATES.params.version)}
          </Mono>
        </Build>
      </div>
    </Scene>
  );
};
