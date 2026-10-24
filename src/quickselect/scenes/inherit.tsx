import React from "react";
import { useCurrentFrame } from "remotion";
import { C, FONT, FT, FT_T } from "../../design/tokens";
import { Build } from "../../design/primitives";
import { ArrayStrip, Body, Card, Mono, Scene, PAD, TRACE, frameOf, pct, Foot } from "../shared";

/* 继承：划分把枢轴钉到最终位置 p，于是只走一边。
 * 划分过程直接用 bench 的 trace（真跑出来的 9 步），不是手画的示意。 */
const T = TRACE.lomuto;

export const SInherit: React.FC = () => {
  const f = useCurrentFrame();
  const f1 = frameOf("inherit", 1);
  const f3 = frameOf("inherit", 3);
  const span = Math.max(1, f3 - f1);
  const raw = f < f1 ? 0 : Math.floor(((f - f1) / span) * T.steps.length);
  const idx = Math.min(T.steps.length - 1, Math.max(0, raw));
  const step = T.steps[idx];
  const pivot = T.array[T.hi];
  const placed = step.action === "place";
  const pAt = placed ? (step.p ?? step.i) : -1;
  const states = step.array.map((v, i) => {
    if (placed) return i === pAt ? ("pivot" as const) : i < pAt ? ("lt" as const) : ("idle" as const);
    if (i === T.hi) return "pivot" as const;
    if (i < step.i) return "lt" as const;
    if (i === step.i) return "mark" as const;
    return "idle" as const;
  });
  const leftCount = T.steps[T.steps.length - 1].p ?? 3;

  return (
    <Scene id="inherit">
      <div style={{ position: "absolute", left: PAD, top: 190, width: 1300 }}>
        <Build at={frameOf("inherit", 0)}>
          <Mono size={FT.label} color={C.cyan} style={{ letterSpacing: FT_T.label }}>03 / 划分</Mono>
          <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, color: C.ink, marginTop: 10 }}>只走一边</div>
        </Build>

        <Build at={f1} style={{ marginTop: 36 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 18 }}>
            <Mono size={FT.meta} color={C.inkFaint}>{"步骤 " + (idx + 1) + " / " + T.steps.length}</Mono>
            <Mono size={FT.meta} color={C.amber}>{"枢轴 = " + pivot + "（最右）"}</Mono>
            <Mono size={FT.meta} color={C.cyan}>{step.action === "place" ? "p = " + (step.p ?? leftCount) : step.action}</Mono>
          </div>
          <ArrayStrip values={step.array} at={f1} states={states} size={86} gap={12}
            pointers={{ i: step.i, j: step.j }} />
        </Build>

        <div style={{ display: "flex", gap: 24, marginTop: 44 }}>
          <Build at={f3}>
            <Card label="p 的含义" accent={C.amber} pad={20} style={{ width: 420 }}>
              <Mono size={FT.h2} color={C.amber}>{"a[p] 已在最终位置"}</Mono>
              <Body size={FT.meta} style={{ marginTop: 8 }}>左边全比它小，右边全比它大</Body>
            </Card>
          </Build>
          <Build at={frameOf("inherit", 5)}>
            <Card label="三种结局" accent={C.cyan} pad={20} style={{ width: 620 }}>
              <div style={{ display: "flex", gap: 26 }}>
                {[
                  { t: "p = k", d: "答案就是 a[p]", c: C.cyan },
                  { t: "k < p", d: "只看左半边", c: C.violet },
                  { t: "k > p", d: "只看右半边", c: C.coral },
                ].map((x) => (
                  <div key={x.t} style={{ opacity: pct(f, frameOf("inherit", 5), frameOf("inherit", 5) + 16) }}>
                    <Mono size={FT.body} color={x.c}>{x.t}</Mono>
                    <Body size={FT.tiny} style={{ marginTop: 6 }}>{x.d}</Body>
                  </div>
                ))}
              </div>
            </Card>
          </Build>
        </div>
      </div>

      <div style={{ position: "absolute", left: 1268, top: 250, width: 520 }}>
        <Build at={frameOf("inherit", 2)}>
          <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>递归宽度</div>
        </Build>
        {[
          { line: 2, label: "第 1 轮", keep: 1, tag: "n" },
          { line: 3, label: "第 2 轮", keep: 0.5, tag: "n/2" },
          { line: 4, label: "第 3 轮", keep: 0.25, tag: "n/4" },
          { line: 6, label: "第 4 轮", keep: 0.125, tag: "n/8" },
        ].map((row) => {
          const at = frameOf("inherit", row.line);
          const grow = pct(f, at, at + 22);
          return (
            <Build key={row.label} at={at} style={{ marginTop: 16 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <Mono size={FT.micro} color={C.inkFaint} style={{ width: 58 }}>{row.label}</Mono>
                <div style={{ position: "relative", width: 340, height: 20, background: C.panel, borderRadius: 4 }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: 340 * row.keep * grow, background: C.cyan, borderRadius: 4 }} />
                </div>
                <Mono size={FT.micro} color={C.inkDim}>{row.tag}</Mono>
              </div>
            </Build>
          );
        })}
        <Build at={frameOf("inherit", 7)} style={{ marginTop: 24 }}>
          <Body size={FT.tiny}>快排两边都做，选择只做一边</Body>
        </Build>
        <Build at={frameOf("inherit", 8)} style={{ marginTop: 22 }}>
          <Mono size={FT.meta} color={C.cyan}>Hoare 1961 · FIND</Mono>
          <Body size={FT.tiny} style={{ marginTop: 6 }}>CACM 4(7):321–322</Body>
        </Build>
      </div>
      <Foot at={frameOf("inherit", 1)}>{"data/quickselect/trace.json · lomuto 划分 9 步（n=8 的真实执行）"}</Foot>
    </Scene>
  );
};