import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build, CountRoll } from "../../design/primitives";
import { Card, Mono, Body, Scene, PAD, CW, SIM, beatAt, pct, sceneFrames } from "../shared";

/* 问题：一页一页地请求，命中还是缺失；缓存满了要挑一页走；LRU 与它的两个假设。
 * 请求流和命中标记来自模拟器的 tape（32 个请求，c=8），命中率是前缀的真实统计。 */
export const SProblem: React.FC = () => {
  const f = useCurrentFrame();
  const rows = SIM.tape.rows;
  const c = SIM.tape.c;
  const at0 = beatAt("problem", 1, 11);
  const idx = Math.min(rows.length - 1, Math.floor(pct(f, at0, sceneFrames("problem") * 0.82) * rows.length));
  const seen = rows.slice(0, idx + 1);
  const hits = seen.filter((r) => r.hit).length;
  const ratio = seen.length ? (hits / seen.length) * 100 : 0;
  const used = seen.length ? seen[seen.length - 1].t1 + seen[seen.length - 1].t2 : 0;
  const victim = beatAt("problem", 5, 11);

  return (
    <Scene id="problem">
      <div style={{ position: "absolute", left: PAD, top: 96, width: CW, display: "flex", gap: 40, alignItems: "flex-start" }}>
        <div style={{ width: 900 }}>
          <Build at={beatAt("problem", 0, 11)}>
            <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>01 / 命中率</Mono>
            <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>满的时候，谁该走</div>
          </Build>

          <div style={{ marginTop: 46 }}>
            <Mono size={FT.meta} color={C.inkFaint}>{"请求流 · 前 " + (idx + 1) + " 个请求（模拟器 tape，c=" + c + "）"}</Mono>
            <div style={{ display: "flex", gap: 6, marginTop: 12, flexWrap: "wrap", width: 900 }}>
              {rows.map((r, i) => {
                const on = i <= idx;
                return (
                  <div key={i} style={{
                    width: 40, height: 40, borderRadius: 6, display: "flex", alignItems: "center", justifyContent: "center",
                    fontFamily: FONT.mono, fontSize: FT.meta,
                    border: "1px solid " + (on ? (r.hit ? C.cyan : C.coral) : C.panelLine),
                    background: on ? (r.hit ? "rgba(120,200,220,0.14)" : "rgba(200,110,90,0.12)") : "transparent",
                    color: on ? (r.hit ? C.cyan : C.coral) : C.inkFaint,
                  }}>{r.page}</div>
                );
              })}
            </div>
            <div style={{ display: "flex", gap: 22, marginTop: 14 }}>
              <Mono size={FT.meta} color={C.cyan}>■ 命中</Mono>
              <Mono size={FT.meta} color={C.coral}>■ 缺失</Mono>
            </div>
          </div>

          <div style={{ display: "flex", gap: 34, marginTop: 34 }}>
            <div style={{ width: 430 }}>
              <Mono size={FT.meta} color={C.inkDim}>{"缓存 · 已占 " + used + " / " + c + " 页"}</Mono>
              <div style={{ display: "flex", gap: 6, marginTop: 10 }}>
                {Array.from({ length: c }).map((_, i) => (
                  <div key={i} style={{
                    width: 44, height: 44, borderRadius: 6,
                    border: "1px solid " + (i < used ? C.panelLine : C.inkFaint) + "88",
                    background: i < used ? C.panel : "transparent",
                    borderStyle: i < used ? "solid" : "dashed",
                  }} />
                ))}
              </div>
            </div>
            <Card label="命中率" style={{ width: 430 }} accent={C.cyan}>
              <Body size={FT.body} style={{ marginBottom: 10 }}>命中次数 ÷ 请求总数</Body>
              <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
                <Mono size={FT.num} color={C.cyan}>{hits}</Mono>
                <Mono size={FT.lead} color={C.inkFaint}>/ {seen.length}</Mono>
                <Mono size={FT.num} color={C.ink}>= {ratio.toFixed(1)}%</Mono>
              </div>
            </Card>
          </div>
        </div>

        <div style={{ width: 780 }}>
          <Card label="LRU · 淘汰最久没被用过的一页" accent={C.coral}>
            <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
              {[["a", "2"], ["b", "5"], ["c", "7"], ["d", "9"], ["e", "14"]].map(([k, age], i) => {
                const dying = f >= victim && i === 4;
                return (
                  <div key={k} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div style={{
                      width: 64, height: 64, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center",
                      fontFamily: FONT.mono, fontSize: FT.lead, color: dying ? C.coral : C.ink,
                      background: dying ? "rgba(200,110,90,0.14)" : C.panel,
                      border: "1px solid " + (dying ? C.coral : C.panelLine),
                    }}>{k}</div>
                    <Mono size={FT.tiny} color={C.inkFaint}>{"多久前用过 " + age}</Mono>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: 20, opacity: pct(f, victim + 8, victim + 24) }}>
              <Mono size={FT.meta} color={C.coral}>← 下一次缺失，它先走</Mono>
            </div>
          </Card>

          <div style={{ display: "flex", gap: 22, marginTop: 30 }}>
            <Card label="假设一 · recency" accent={C.cyan} style={{ width: 370 }}>
              <Body>刚被用过的页，<br />接下来还会被用到。</Body>
            </Card>
            <Card label="假设二 · frequency" accent={C.amber} style={{ width: 370 }}>
              <Body>用得越多的页，<br />越值得留在缓存里。</Body>
            </Card>
          </div>
          <div style={{ marginTop: 22, opacity: pct(f, beatAt("problem", 7, 11), beatAt("problem", 7, 11) + 20) }}>
            <Body size={FT.body} color={C.inkDim}>
              两个假设都对，但没人知道此刻该更信哪一个。
            </Body>
          </div>
        </div>
      </div>
    </Scene>
  );
};
