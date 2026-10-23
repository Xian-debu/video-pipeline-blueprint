import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { Body, Mono, Scene, PAD, beatAt, pct } from "../shared";

/* 开场：层级 → 缓存 → 满了就得赶人 → 2003 IBM → ARC。
 * 画面里不放任何论文没给的数字（延迟只说「快 / 慢」），避免给自己造证据。 */
const TIERS = [
  { name: "处理器缓存", note: "最快，最小", w: 0.22, color: C.cyan },
  { name: "内存", note: "次之", w: 0.5, color: C.cyanDeep },
  { name: "磁盘", note: "最慢，最大", w: 0.95, color: C.panelLine },
];

export const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  const pulse = pct(f, beatAt("open", 2, 8), beatAt("open", 2, 8) + 60);
  const evictAt = beatAt("open", 4, 8);
  const cPages = [7, 12, 3, 19, 5, 8];

  return (
    <Scene id="open">
      <div style={{ position: "absolute", left: PAD, top: 250, width: 760 }}>
        <Build at={beatAt("open", 0, 8)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>论文解读 · FAST '03</Mono>
        </Build>
        <Build at={beatAt("open", 0, 8) + 8}>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.cover, color: C.ink, lineHeight: 1, marginTop: 18, letterSpacing: FT_T.cover }}>ARC</div>
        </Build>
        <Build at={beatAt("open", 1, 8)}>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.inkDim, marginTop: 16 }}>自适应替换缓存</div>
        </Build>
        <Build at={beatAt("open", 6, 8)}>
          <div style={{ width: 120, height: 3, background: C.cyan, marginTop: 30 }} />
          <Body style={{ marginTop: 24 }}>
            Megiddo &amp; Modha · IBM Almaden 研究中心<br />
            USENIX FAST '03 · 115–130 页
          </Body>
        </Build>
      </div>

      <div style={{ position: "absolute", left: 960, top: 246, width: 780 }}>
        {TIERS.map((tier, i) => (
          <Build key={tier.name} at={beatAt("open", 1, 8) + i * 10}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                <Mono size={FT.meta} color={tier.color}>{tier.name}</Mono>
                <Mono size={FT.meta} color={C.inkFaint}>{tier.note}</Mono>
              </div>
              <div style={{ width: 780 * tier.w, height: 26, background: tier.color, opacity: 0.28, borderRadius: 4 }} />
            </div>
          </Build>
        ))}

        <div style={{ marginTop: 22, opacity: pct(f, beatAt("open", 3, 8), beatAt("open", 3, 8) + 18) }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <Mono size={FT.meta} color={C.cyan}>{"缓存 · c 页"}</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>{"装不下的，就赶走"}</Mono>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            {cPages.map((n, i) => {
              const gone = evictAt > 0 && f >= evictAt && i === cPages.length - 1;
              return (
                <div key={i} style={{
                  width: 62, height: 62, borderRadius: 8, opacity: gone ? 0.25 : 1,
                  border: "1px solid " + (gone ? C.coral : C.panelLine),
                  background: gone ? "rgba(200,110,90,0.10)" : C.panel,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontFamily: FONT.mono, fontSize: FT.mono, color: gone ? C.coral : C.ink,
                }}>{n}</div>
              );
            })}
            <div style={{ display: "flex", alignItems: "center", marginLeft: 10, opacity: pct(f, evictAt + 10, evictAt + 28) }}>
              <Mono size={FT.meta} color={C.coral}>← 新页进来，谁走？</Mono>
            </div>
          </div>
        </div>
      </div>

      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <line x1={935} y1={318} x2={935} y2={690} stroke={C.panelLine} strokeWidth={2} strokeDasharray="6 8" />
        <circle cx={935} cy={690 - (690 - 318) * pulse} r={7} fill={C.amber} opacity={pulse > 0 && pulse < 1 ? 0.9 : 0} />
      </svg>
    </Scene>
  );
};
