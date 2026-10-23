import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { BarRow, Card, Cell, Line, Mono, Body, Scene, SIM, PAD, beatAt, pct, sceneFrames } from "../shared";

/* 扫描抵抗：三段负载的时间轴 + T2 存活的页数 + 扫描后 100 次的命中率对比。 */
export const SScan: React.FC = () => {
  const f = useCurrentFrame();
  const s = SIM.scan;
  const rows = s.rows.filter((_, i) => i % 3 === 0);
  const t2 = rows.map((r) => r.t2);
  const phases = [
    { label: "热点请求", n: s.pre, c: C.cyan },
    { label: "顺序扫描", n: s.scan, c: C.coral },
    { label: "回到热点", n: s.post, c: C.amber },
  ];
  const total = phases.reduce((a, b) => a + b.n, 0);

  return (
    <Scene id="scan">
      <div style={{ position: "absolute", left: PAD, top: 92, width: 1000 }}>
        <Build at={beatAt("scan", 0, 11)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>08 / 一次扫描</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>只被看一次的页，不该住下来</div>
        </Build>

        <div style={{ marginTop: 30, opacity: pct(f, beatAt("scan", 1, 11), beatAt("scan", 1, 11) + 24) }}>
          <Mono size={FT.meta} color={C.inkFaint}>{"自测：c = " + s.c + " 页，三段负载依次跑"}</Mono>
          <div style={{ display: "flex", marginTop: 10, height: 56, borderRadius: 10, overflow: "hidden", border: "1px solid " + C.panelLine }}>
            {phases.map((p) => (
              <div key={p.label} style={{
                width: (p.n / total) * 940, background: C.panel, borderRight: "1px solid " + C.panelLine,
                display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
              }}>
                <div style={{ fontFamily: FONT.sans, fontSize: FT.meta, color: C.ink }}>{p.label}</div>
                <div style={{ fontFamily: FONT.mono, fontSize: FT.tiny, color: p.c, marginTop: 2 }}>{p.n + " 次"}</div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 28 }}>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <Mono size={FT.meta} color={C.inkFaint}>ARC 的 T2 里还剩多少页（扫描段用红色标出）</Mono>
            <Mono size={FT.meta} color={C.inkFaint}>{"扫描结束时 " + s.t2AtScanEnd + " 页"}</Mono>
          </div>
          <div style={{ marginTop: 12, background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 12, padding: "16px 20px", position: "relative" }}>
            <Line values={t2} w={920} h={200} lo={0} hi={Math.max(...t2, 1)} color={C.cyan} at={beatAt("scan", 2, 11)} dur={sceneFrames("scan") * 0.45} fill />
            <div style={{
              position: "absolute", top: 16, bottom: 16,
              left: 20 + (s.pre / total) * 920, width: (s.scan / total) * 920,
              background: "rgba(220,120,110,0.10)", borderLeft: "1px solid " + C.coral, borderRight: "1px solid " + C.coral,
            }} />
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8 }}>
              <Mono size={FT.tiny} color={C.inkFaint}>{"0"}</Mono>
              <Mono size={FT.tiny} color={C.inkFaint}>{"→ " + total + " 次请求"}</Mono>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 26, opacity: pct(f, beatAt("scan", 5, 11), beatAt("scan", 5, 11) + 20) }}>
          <Card label="紧接着的 100 次热点请求，命中率" accent={C.amber} pad={18}>
            <div style={{ display: "flex", gap: 40 }}>
              <BarRow label="ARC" value={s.post100.arc} max={50} color={C.cyan} w={300} at={beatAt("scan", 6, 11)} strong />
              <BarRow label="LRU" value={s.post100.lru} max={50} color={C.coral} w={300} at={beatAt("scan", 6, 11)} />
            </div>
          </Card>
        </div>
      </div>

      <div style={{ position: "absolute", left: 1120, top: 240, width: 700 }}>
        <Build at={beatAt("scan", 1, 11) + 6}>
          <Card label="顺序扫描时发生了什么" accent={C.coral}>
            <div style={{ display: "flex", gap: 8 }}>
              {[31, 32, 33, 34, 35, 36].map((n, i) => <Cell key={i} label={n} size={42} fresh accent={C.coral} />)}
            </div>
            <Body style={{ marginTop: 14 }}>新页一律进 T1 的最前面，只从 T1 的最后面出局。</Body>
            <div style={{ height: 22 }} />
            <div style={{ display: "flex", gap: 8 }}>
              {[104, 101, 7, 12, 88].map((n, i) => <Cell key={i} label={n} size={42} accent={C.amber} />)}
            </div>
            <Body style={{ marginTop: 14 }}>真正在用的页在 T2 里，扫描页碰不到它们。</Body>
          </Card>
        </Build>
      </div>
    </Scene>
  );
};
