import React from "react";
import { AbsoluteFill, Audio, interpolate, Sequence, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { C, FONT, FT, FT_T } from "../design/tokens";
import { ChapterBar, SceneShell } from "../design/Scene";
import { Build, CountRoll } from "../design/primitives";
import { Math as Tex, MathLine } from "../design/Math";
import { SCENES, LINES, SCHOOLBOOK, KARATSUBA, TOOM, NTT, BENCH, CODE, FPS, TOTAL, frameOf } from "./script";

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

const pct = (f: number, a: number, b: number) => interpolate(f, [a, b], [0, 1], clamp);

const Head: React.FC<{ kicker: string; title: string; goal?: string }> = ({ kicker, title, goal }) => (
  <div>
    <div style={{ fontFamily: FONT.mono, fontSize: FT.label, letterSpacing: FT_T.label, color: C.cyan }}>{kicker}</div>
    <div style={{ fontFamily: FONT.serif, fontSize: FT.h1, marginTop: 6, lineHeight: 1.12 }}>{title}</div>
    {goal ? <div style={{ fontSize: FT.label, color: C.inkFaint, marginTop: 6 }}>{goal}</div> : null}
  </div>
);

const Card: React.FC<{
  label?: string;
  accent?: string;
  children: React.ReactNode;
  style?: React.CSSProperties;
  pad?: string;
}> = ({ label, accent = C.cyan, children, style, pad = "18px 22px" }) => (
  <div style={{ background: C.panel, border: "1px solid " + C.panelLine, borderRadius: 16, padding: pad, ...style }}>
    {label ? (
      <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, letterSpacing: FT_T.meta, color: accent, marginBottom: 8 }}>{label}</div>
    ) : null}
    {children}
  </div>
);

const Chip: React.FC<{ children: React.ReactNode; color?: string; hot?: boolean }> = ({ children, color = C.inkDim, hot = false }) => (
  <div
    style={{
      padding: "8px 16px",
      borderRadius: 999,
      border: "1px solid " + (hot ? color : C.panelLine),
      color: hot ? color : C.inkDim,
      fontSize: FT.meta,
      fontFamily: FONT.mono,
      whiteSpace: "nowrap",
    }}
  >
    {children}
  </div>
);

const Mono: React.FC<{ children: React.ReactNode; size?: number; color?: string; style?: React.CSSProperties }> = ({
  children,
  size = FT.mono,
  color = C.ink,
  style,
}) => <span style={{ fontFamily: FONT.mono, fontSize: size, color, fontVariantNumeric: "tabular-nums", ...style }}>{children}</span>;

const Scene: React.FC<{ id: string; children: React.ReactNode }> = ({ id, children }) => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const sc = SCENES.find((s) => s.id === id)!;
  return (
    <SceneShell>
      <ChapterBar chapter={sc.chapter} index={sc.chapterIndex} total={SCENES.length} progress={Math.min(1, f / durationInFrames)} />
      {children}
    </SceneShell>
  );
};

/* ---------------------------------------------------------------- 01 · open */

const LADDER = [
  { label: "n^2", note: "竖式：一位数乘一位数", w: 1, color: C.inkDim },
  { label: "n^1.585", note: "Karatsuba，1960", w: 0.55, color: C.cyan },
  { label: "n^1.465", note: "Toom-3，1963", w: 0.42, color: C.amber },
  { label: "n log n", note: "FFT / NTT，1971", w: 0.26, color: C.violet },
];

const SOpen: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene id="open">
      <div style={{ marginTop: 54 }}>
        <div style={{ fontFamily: FONT.mono, fontSize: FT.body, letterSpacing: FT_T.label, color: C.cyan }}>ALGORITHM / MULTIPLICATION</div>
        <div style={{ fontFamily: FONT.serif, fontSize: FT.cover, marginTop: 6, lineHeight: 1.04 }}>逐位乘法</div>
        <Build at={frameOf("open", 1)}>
          <div style={{ fontSize: FT.lead, color: C.inkDim, marginTop: 10, maxWidth: 1320 }}>
            从小学竖式，到大数库真正在用的算法：每一步都数得清，也证得明。
          </div>
        </Build>
        <Build at={frameOf("open", 2)}>
          <div style={{ display: "flex", gap: 12, marginTop: 20 }}>
            <Chip hot color={C.inkDim}>4761 × 3082</Chip>
            <Chip hot color={C.cyan}>Karatsuba</Chip>
            <Chip hot color={C.amber}>Toom-3</Chip>
            <Chip hot color={C.violet}>FFT / NTT</Chip>
            <Chip>真机实测</Chip>
            <Chip>完整证明</Chip>
          </div>
        </Build>
      </div>
      <div style={{ display: "flex", gap: 34, marginTop: 42, alignItems: "flex-end" }}>
        {LADDER.map((r, i) => {
          const p = pct(f, 60 + i * 14, 84 + i * 14);
          return (
            <div key={r.label} style={{ width: 320, opacity: p, transform: "translateY(" + (1 - p) * 14 + "px)" }}>
              <Mono size={FT.h2} color={r.color}>{r.label}</Mono>
              <div style={{ height: 7, width: 300 * r.w, background: r.color, borderRadius: 4, marginTop: 8, opacity: 0.85 }} />
              <div style={{ fontSize: FT.meta, color: C.inkFaint, marginTop: 8 }}>{r.note}</div>
            </div>
          );
        })}
      </div>
      <div style={{ position: "absolute", left: 72, right: 72, bottom: 42, display: "flex", justifyContent: "space-between", fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>
        <span>CODE-DRIVEN LECTURE</span>
        <span>{Math.floor(TOTAL / FPS / 60)} 分 {String(Math.round((TOTAL / FPS) % 60)).padStart(2, "0")} 秒 · {SCENES.length} 章 · 每个数字都能重跑</span>
      </div>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 02 · school */

const A_MSB = String(SCHOOLBOOK.a).split("").map(Number);
const B_MSB = String(SCHOOLBOOK.b).split("").map(Number);
const A_LSB = A_MSB.slice().reverse();
const B_LSB = B_MSB.slice().reverse();
const N = A_LSB.length;

const CELLS = A_LSB.map((a, i) =>
  B_LSB.map((b, j) => ({ i, j, a, b, prod: a * b, tens: Math.floor((a * b) / 10), units: (a * b) % 10 }))
);

const DIAG = (() => {
  const out: number[] = [];
  let carry = 0;
  for (let k = 0; k <= 2 * N - 1; k++) {
    let s = carry;
    for (const row of CELLS) for (const cell of row) {
      if (cell.i + cell.j === k) s += cell.units;
      if (cell.i + cell.j === k - 1) s += cell.tens;
    }
    out.push(s % 10);
    carry = Math.floor(s / 10);
  }
  while (carry > 0) {
    out.push(carry % 10);
    carry = Math.floor(carry / 10);
  }
  return out;
})();

const PRODUCT = DIAG.slice().reverse().join("");

type Lattice = (typeof CELLS)[number][number];
const LatticeCell: React.FC<{ cell: Lattice; show: boolean }> = ({ cell, show }) => (
  <div
    style={{
      position: "relative",
      width: 118,
      height: 118,
      border: "1px solid " + C.panelLine,
      background: show ? "rgba(94,234,212,0.07)" : C.panel,
      opacity: show ? 1 : 0.25,
    }}
  >
    <div
      style={{
        position: "absolute",
        inset: 0,
        background: "linear-gradient(to top right, transparent 49.4%, " + C.panelLine + " 49.4%, " + C.panelLine + " 50.6%, transparent 50.6%)",
      }}
    />
    <div style={{ position: "absolute", left: 10, bottom: 8 }}>
      <Mono size={FT.mono} color={C.inkDim}>{cell.tens}</Mono>
    </div>
    <div style={{ position: "absolute", right: 10, top: 8 }}>
      <Mono size={FT.mono} color={C.ink}>{cell.units}</Mono>
    </div>
  </div>
);

const SSchool: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const step = Math.min(N * N, Math.max(0, Math.floor((f - 12 * FPS) / (1.8 * FPS))));
  const order = CELLS.flat().slice().sort((x, y) => {
    const rx = N - 1 - x.i;
    const ry = N - 1 - y.i;
    return rx !== ry ? rx - ry : N - 1 - x.j - (N - 1 - y.j);
  });
  const revealed = new Set(order.slice(0, step).map((c) => c.i * N + c.j));
  const last = step > 0 ? order[step - 1] : null;
  const diagP = pct(f, durationInFrames - 7 * FPS, durationInFrames - 1.2 * FPS);
  const showProduct = diagP > 0;
  return (
    <Scene id="school">
      <Head kicker="01 / 一位数乘一位数" title="先数清楚代价" goal="为什么 n 位乘 n 位，乘法次数是 n 的平方" />
      <div style={{ display: "flex", gap: 44, marginTop: 22 }}>
        <div>
          <div style={{ display: "flex", alignItems: "flex-end", gap: 6, marginBottom: 8 }}>
            <div style={{ width: 76 }} />
            {B_MSB.map((d, k) => (
              <div key={k} style={{ width: 118, textAlign: "center" }}>
                <Mono size={FT.h2} color={C.cyan}>{d}</Mono>
              </div>
            ))}
          </div>
          {A_MSB.map((d, r) => {
            const i = N - 1 - r;
            return (
              <div key={r} style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 6 }}>
                <div style={{ width: 76, textAlign: "right", paddingRight: 10 }}>
                  <Mono size={FT.h2} color={C.cyan}>{d}</Mono>
                </div>
                {B_MSB.map((_, c) => {
                  const j = N - 1 - c;
                  const cell = CELLS[i][j];
                  return <LatticeCell key={c} cell={cell} show={revealed.has(i * N + j)} />;
                })}
              </div>
            );
          })}
          <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 10 }}>
            <div style={{ width: 76, textAlign: "right", paddingRight: 10, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint }}>sum</div>
            {DIAG.slice().reverse().map((d, k) => (
              <div
                key={k}
                style={{
                  width: 118,
                  height: 56,
                  borderTop: "2px solid " + (showProduct ? C.amber : C.panelLine),
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: showProduct ? 1 : 0.3,
                }}
              >
                <Mono size={FT.h2} color={showProduct ? C.amber : C.inkFaint}>{d}</Mono>
              </div>
            ))}
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card label={"STEP " + step + " / 16"}>
            <div style={{ fontSize: FT.lead, fontFamily: FONT.mono, minHeight: 44 }}>
              {last ? last.a + " × " + last.b + " = " + last.prod + "  →  写 " + last.units + "，进位 " + last.tens : "网格里每一格，都是一次一位数乘法"}
            </div>
          </Card>
          <div style={{ display: "flex", gap: 14, marginTop: 14 }}>
            <Card label="一位数乘法" style={{ flex: 1 }} accent={C.cyan}>
              <Mono size={FT.num} color={C.cyan}>{String(step).padStart(2, "0")}</Mono>
            </Card>
            <Card label="进位/加法" style={{ flex: 1 }} accent={C.coral}>
              <Mono size={FT.num} color={C.coral}>{String(Math.round((step / 16) * 24)).padStart(2, "0")}</Mono>
            </Card>
          </div>
          <Card label="结果（对角线进位求和）" accent={C.amber} style={{ marginTop: 14 }}>
            <Mono size={FT.h1} color={C.amber}>{showProduct ? PRODUCT : "— · — · — · —"}</Mono>
            <div style={{ fontSize: FT.meta, color: C.inkFaint, marginTop: 6 }}>
              实测：{SCHOOLBOOK.digitMuls} 次乘法、{SCHOOLBOOK.digitAdds} 次加法
            </div>
          </Card>
          <Build at={Math.round(durationInFrames * 0.62)}>
            <Card label="所以" accent={C.violet} style={{ marginTop: 14 }}>
              <Tex tex="T(n) = n \cdot n = n^2" block size={FT.num} color={C.ink} align="left" />
            </Card>
          </Build>
        </div>
      </div>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 03 · split */

const SPLIT_HALF = Math.floor(A_MSB.length / 2);
const A0 = Number(A_MSB.slice(SPLIT_HALF).join(""));
const A1 = Number(A_MSB.slice(0, SPLIT_HALF).join(""));
const B0 = Number(B_MSB.slice(SPLIT_HALF).join(""));
const B1 = Number(B_MSB.slice(0, SPLIT_HALF).join(""));
const BASE_S = Math.pow(10, SPLIT_HALF);
const Z0 = A0 * B0;
const Z2 = A1 * B1;
const Z1 = (A0 + A1) * (B0 + B1) - Z0 - Z2;

const LADDER_ROWS = KARATSUBA.ladder.filter((r: any) => [16, 64, 256].includes(r.limbs));

const SSplit: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const pulse = 0.5 + 0.5 * Math.sin(f / 9);
  const half = Math.round(durationInFrames / 2);
  return (
    <Scene id="split">
      <Head kicker="02 / KARATSUBA 恒等式" title="把四次乘法变成三次" goal="一次代数恒等式，换掉一次大乘法" />
      <div style={{ display: "flex", gap: 30, marginTop: 20 }}>
        <div style={{ width: 700 }}>
          <Card label={"拆半 · B = 10^" + SPLIT_HALF}>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {[
                { name: "a", hi: A1, lo: A0, val: SCHOOLBOOK.a, color: C.cyan },
                { name: "b", hi: B1, lo: B0, val: SCHOOLBOOK.b, color: C.amber },
              ].map((r) => (
                <div key={r.name} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <Mono size={FT.mono} color={C.inkFaint}>{r.name} =</Mono>
                  <div style={{ padding: "6px 16px", border: "1px solid " + r.color, borderRadius: 10, background: "rgba(94,234,212,0.06)" }}>
                    <Mono size={FT.body} color={r.color}>{String(r.hi)}</Mono>
                  </div>
                  <div style={{ padding: "6px 16px", border: "1px solid " + C.panelLine, borderRadius: 10 }}>
                    <Mono size={FT.body} color={C.ink}>{String(r.lo)}</Mono>
                  </div>
                  <Mono size={FT.meta} color={C.inkFaint}>{"= " + r.hi + " × " + BASE_S + " + " + r.lo + "   (" + r.val + ")"}</Mono>
                </div>
              ))}
            </div>
          </Card>
          <Card label="朴素做法：四次乘法" accent={C.coral} style={{ marginTop: 14 }}>
            <div style={{ display: "flex", gap: 12 }}>
              {[
                { t: "a0 · b0", v: Z0, on: true },
                { t: "a0 · b1", v: A0 * B1, on: true },
                { t: "a1 · b0", v: A1 * B0, on: true },
                { t: "a1 · b1", v: Z2, on: true },
              ].map((c, i) => (
                <div
                  key={c.t}
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    border: "1px solid " + (i === 3 && pct(f, half, half + 20) > 0.5 ? C.cyan : C.panelLine),
                    borderRadius: 10,
                    background: C.bg,
                  }}
                >
                  <Mono size={FT.meta} color={C.inkFaint}>{c.t}</Mono>
                  <div style={{ marginTop: 2 }}>
                    <Mono size={FT.body} color={C.ink}>{String(c.v)}</Mono>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card label="关键恒等式：三次乘法" accent={C.cyan}>
            <MathLine tex={"z_0 = a_0 b_0"} no={"(" + Z0 + ")"} size={FT.mono} dim />
            <MathLine tex={"z_2 = a_1 b_1"} no={"(" + Z2 + ")"} size={FT.mono} dim />
            <MathLine
              tex={"z_1 = (a_0+a_1)(b_0+b_1) - z_0 - z_2"}
              no={"(" + Z1 + ")"}
              size={FT.mono}
              active={pulse > 0.5}
            />
            <div style={{ fontSize: FT.meta, color: C.inkFaint, marginTop: 6, lineHeight: 1.6 }}>
              验证：{A0} 加 {A1} 是 {A0 + A1}，{B0} 加 {B1} 是 {B0 + B1}，{A0 + A1} × {B0 + B1} = {(A0 + A1) * (B0 + B1)}，
              减去 {Z0} 和 {Z2}，得 {Z1}。
            </div>
          </Card>
          <Build at={half}>
            <Card label="同一对数拼回去" accent={C.amber} style={{ marginTop: 14 }}>
              <Tex
                tex={"z_2 \\cdot B^2 + z_1 \\cdot B + z_0 = " + Z2 * BASE_S * BASE_S + " + " + Z1 * BASE_S + " + " + Z0 + " = " + PRODUCT}
                block
                size={FT.mono}
                align="left"
              />
            </Card>
          </Build>
        </div>
      </div>
      <Build at={Math.round(durationInFrames * 0.5)}>
        <div style={{ display: "flex", gap: 20, marginTop: 20 }}>
          <Card label="计数的乘法次数（limb = 4 位十进制）" style={{ flex: 1 }}>
            {LADDER_ROWS.map((r: any) => (
              <div key={r.limbs} style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 8 }}>
                <Mono size={FT.meta} color={C.inkFaint} style={{ width: 128 }}>{r.digits + " 位"}</Mono>
                <div style={{ flex: 1, height: 16, background: C.bg, borderRadius: 8, position: "relative" }}>
                  <div style={{ position: "absolute", left: 0, top: 0, bottom: 0, width: (r.schoolbookMuls / 65536) * 100 + "%", background: C.inkDim, borderRadius: 8, opacity: 0.5 }} />
                  <div style={{ position: "absolute", left: 0, top: 4, height: 8, width: (r.karatsubaMuls / 65536) * 100 + "%", background: C.cyan, borderRadius: 4 }} />
                </div>
                <Mono size={FT.meta} color={C.inkDim} style={{ width: 90, textAlign: "right" }}>{r.schoolbookMuls.toLocaleString()}</Mono>
                <Mono size={FT.meta} color={C.cyan} style={{ width: 74, textAlign: "right" }}>{r.karatsubaMuls.toLocaleString()}</Mono>
              </div>
            ))}
            <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 10 }}>灰 = 竖式，青 = Karatsuba；两列都是数出来的，不是估的。</div>
          </Card>
          <Card label="指数" accent={C.violet} style={{ width: 380 }}>
            <Tex tex="\log_2 3 \approx 1.585" block size={FT.h2} align="left" />
            <div style={{ fontSize: FT.meta, color: C.inkFaint, marginTop: 4 }}>省下的不是常数，是指数。</div>
          </Card>
        </div>
      </Build>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 04 · recursion */

type Node3 = { depth: number; lo: number; hi: number };
const TREE_NODES: Node3[] = (() => {
  const out: Node3[] = [];
  for (let d = 0; d <= 2; d++) {
    const count = Math.pow(3, d);
    for (let k = 0; k < count; k++) out.push({ depth: d, lo: k, hi: count });
  }
  return out;
})();

// 1024 位十进制 = 256 个万进制块：n² = 65,536、3^8 = 6,561、256^1.465 ≈ 3,373、n log n = 2,048。
const EXPONENTS = [
  { name: "n^2", value: 65536, label: "65,536", color: C.inkDim, note: "竖式" },
  { name: "n^1.585", value: 6561, label: "6,561", color: C.cyan, note: "Karatsuba" },
  { name: "n^1.465", value: 3373, label: "≈ 3,373", color: C.amber, note: "Toom-3" },
  { name: "n log n", value: 2048, label: "2,048", color: C.violet, note: "FFT / NTT" },
];

const SRecur: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const W = 1180;
  const yOf = (d: number) => 8 + d * 118;
  const xOf = (n: Node3) => (n.hi === 1 ? W / 2 : ((n.lo + 0.5) / n.hi) * W);
  return (
    <Scene id="recur">
      <Head kicker="03 / 递归树与主定理" title="T(n) = 3T(n/2) + O(n)" goal="用归纳法把「少了四分之一」写成严格上界" />
      <div style={{ display: "flex", gap: 34, marginTop: 18 }}>
        <div style={{ width: 1180, position: "relative", height: 330 }}>
          {TREE_NODES.filter((n) => n.depth > 0).map((n) => {
            const parentDepth = n.depth - 1;
            const pIndex = Math.floor(n.lo / 3);
            const px = xOf({ depth: parentDepth, lo: pIndex, hi: Math.pow(3, parentDepth) });
            const py = yOf(parentDepth) + 46;
            const grow = pct(f, 24 + n.depth * 22, 46 + n.depth * 22);
            return (
              <svg key={"e" + n.depth + "-" + n.lo} width={W} height={340} style={{ position: "absolute", left: 0, top: 0 }}>
                <line x1={px} y1={py} x2={xOf(n)} y2={yOf(n.depth)} stroke={C.panelLine} strokeWidth={2} opacity={grow} />
              </svg>
            );
          })}
          {TREE_NODES.map((n) => {
            const appear = pct(f, 8 + n.depth * 20, 30 + n.depth * 20);
            const size = n.depth === 2 ? 30 : n.depth === 1 ? 40 : 54;
            const t = Math.pow(3, n.depth);
            return (
              <div
                key={n.depth + "-" + n.lo}
                style={{
                  position: "absolute",
                  left: xOf(n) - 42,
                  top: yOf(n.depth),
                  width: 84,
                  height: size,
                  borderRadius: 10,
                  border: "1px solid " + (n.depth === 0 ? C.cyan : C.panelLine),
                  background: n.depth === 2 ? "rgba(94,234,212,0.10)" : C.panel,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  opacity: appear,
                  transform: "translateY(" + (1 - appear) * 10 + "px)",
                }}
              >
                <Mono size={n.depth === 0 ? FT.body : FT.tiny} color={n.depth === 0 ? C.cyan : C.inkDim}>
                  {n.depth === 0 ? "n=16" : n.depth === 1 ? "n=8" : "n=4"}
                </Mono>
              </div>
            );
          })}
          <div style={{ position: "absolute", left: 0, bottom: -6, display: "flex", gap: 34, fontSize: FT.meta, color: C.inkFaint }}>
            <span>深度 d：{Math.pow(3, 0)} · {Math.pow(3, 1)} · {Math.pow(3, 2)} 个节点</span>
            <span style={{ color: C.cyan }}>叶子数 = 3^d = 3^(log₂ n) = n^1.585</span>
          </div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card label="递归式">
            <MathLine tex="T(n) = 3\,T(n/2) + cn" no="(1)" size={FT.h2} active={pct(f, 40, 60) > 0.4} />
            <MathLine tex="T(n) = \Theta(n^{\log_2 3})" no="(2)" size={FT.h2} active={pct(f, durationInFrames * 0.3, durationInFrames * 0.3 + 20) > 0.4} />
          </Card>
          <Build at={Math.round(durationInFrames * 0.42)}>
            <Card label="归纳：猜强一点，才闭得上" accent={C.amber} style={{ marginTop: 12 }}>
              <MathLine tex="T(n) \le c\,n^{p} - 2dn" no="猜" size={FT.mono} dim />
              <MathLine tex="3\big(c(n/2)^p - dn\big) + dn" no="步" size={FT.meta} />
              <MathLine tex="= c\,n^{p} - 2dn" no="=" size={FT.meta} active />
              <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 4 }}>
                3/2^p = 1 正是 p 的定义；只猜 c n^p 时 +dn 无处可去，所以减去 2dn 才闭合。
              </div>
            </Card>
          </Build>
        </div>
      </div>
      <Build at={Math.round(durationInFrames * 0.56)}>
        <Card label="1024 位时按指数估算的乘法次数" accent={C.violet} style={{ marginTop: 22 }}>
          <div style={{ display: "flex", gap: 20 }}>
            {EXPONENTS.map((e) => (
              <div key={e.name} style={{ flex: 1 }}>
                <Mono size={FT.mono} color={e.color}>{e.name}</Mono>
                {/* 条形只用来排序与"差多少"的直觉：对数刻度映射到 8%-100%，既不让 n^2 撑出画框，也不让 10,240 缩成一条线。 */}
                <div style={{ height: 10, marginTop: 6, width: LADDER_BAR(e.value) + "%", background: e.color, borderRadius: 5, opacity: 0.8 }} />
                <div style={{ marginTop: 6 }}>
                  <Mono size={FT.body} color={e.color}>{e.label}</Mono>
                </div>
                <div style={{ fontSize: FT.tiny, color: C.inkFaint }}>{e.note}</div>
              </div>
            ))}
          </div>
        </Card>
      </Build>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 05 · toom */

/** 对数刻度映射到 8%-100%：最小的 n log n 也有可见长度，最大的 n^2 到满格，不越出卡片。 */
const LADDER_BAR = (v: number) => {
  const lo = Math.log(2048);
  const hi = Math.log(65536);
  return Math.round(8 + 92 * ((Math.log(v) - lo) / (hi - lo)));
};

const SPOINTS = TOOM.points;

const SToom: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <Scene id="toom">
      <Head kicker="04 / TOOM-3" title="用五个点换掉九次乘法" goal="把整数看成多项式：求值、点乘、插值" />
      <div style={{ display: "flex", gap: 30, marginTop: 20 }}>
        <Card label="在五个点上求值" style={{ width: 820 }}>
          <div style={{ display: "flex", fontFamily: FONT.mono, fontSize: FT.tiny, color: C.inkFaint, letterSpacing: FT_T.meta, paddingBottom: 6, borderBottom: "1px solid " + C.panelLine }}>
            <span style={{ width: 120 }}>POINT</span>
            <span style={{ width: 210, textAlign: "right" }}>A(t)</span>
            <span style={{ width: 210, textAlign: "right" }}>B(t)</span>
            <span style={{ width: 230, textAlign: "right" }}>A(t)·B(t)</span>
          </div>
          {SPOINTS.map((p: any, i: number) => {
            const on = pct(f, 20 + i * 26, 44 + i * 26);
            return (
              <div
                key={p.point}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "7px 0",
                  fontFamily: FONT.mono,
                  fontSize: FT.mono,
                  color: on > 0.5 ? C.ink : C.inkFaint,
                  borderBottom: "1px solid " + C.panelLine,
                }}
              >
                <span style={{ width: 120, color: on > 0.5 ? C.cyan : C.inkFaint }}>{p.point === "inf" ? "∞" : "t = " + p.point}</span>
                <span style={{ width: 210, textAlign: "right" }}>{p.a}</span>
                <span style={{ width: 210, textAlign: "right" }}>{p.b}</span>
                <span style={{ width: 230, textAlign: "right", color: on > 0.5 ? C.amber : C.inkFaint }}>{p.product.toLocaleString()}</span>
              </div>
            );
          })}
          <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 10 }}>
            {TOOM.aValue.toLocaleString()} × {TOOM.bValue.toLocaleString()}，五个点上的乘积都是小整数，可以竖式直接算。
          </div>
        </Card>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card label="插值：解范德蒙德方程" accent={C.amber}>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
              {TOOM.coeffs.map((c: number, i: number) => (
                <div key={i} style={{ padding: "8px 14px", border: "1px solid " + C.amber, borderRadius: 10, background: "rgba(251,191,36,0.08)" }}>
                  <Mono size={FT.body} color={C.amber}>{c}</Mono>
                </div>
              ))}
            </div>
            <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 10 }}>
              用 Fractions 精确求解，不用浮点；系数按 10^4 进位拼回去。
            </div>
          </Card>
          <Card label="拼回去" style={{ marginTop: 12 }}>
            <Mono size={FT.mono} color={C.ink}>{TOOM.product}</Mono>
            <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 6 }}>
              与直接相乘的结果一致：{TOOM.verify ? "逐位相同" : "不一致"}。只用了 {TOOM.limbMuls} 次小乘法。
            </div>
          </Card>
          <Build at={Math.round(durationInFrames * 0.45)}>
            <Card label="指数" accent={C.violet} style={{ marginTop: 12 }}>
              <Tex tex="\log_3 5 \approx 1.465" block size={FT.h2} align="left" />
              <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 4 }}>代价：插值要除法，整数除法很贵，工程上用移位和逆元替换。</div>
            </Card>
          </Build>
        </div>
      </div>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 06 · ntt */

const STAGES = NTT.stages as any[];
const CHIP: React.FC<{ children: React.ReactNode; color?: string; dim?: boolean }> = ({ children, color = C.ink, dim = false }) => (
  <div
    style={{
      padding: "6px 10px",
      border: "1px solid " + C.panelLine,
      borderRadius: 8,
      background: C.bg,
      opacity: dim ? 0.55 : 1,
      minWidth: 62,
      textAlign: "center",
    }}
  >
    <Mono size={FT.tiny} color={color}>{children}</Mono>
  </div>
);

const SNtt: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const rows = [
    { key: "input", label: "输入 a, b（补零到 8 位）", color: C.inkDim },
    { key: "dft", label: "正变换：在 8 个单位根上求值", color: C.cyan },
    { key: "pointwise", label: "点乘：逐点相乘", color: C.amber },
    { key: "inverse", label: "逆变换：换回系数", color: C.violet },
  ];
  return (
    <Scene id="ntt">
      <Head kicker="05 / FFT 与 NTT" title="把乘法变成点乘" goal="从 n² 到 n log n：离散傅里叶变换为什么对" />
      <div style={{ display: "flex", gap: 26, marginTop: 18 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card label="卷积就是多项式乘法">
            <div style={{ display: "flex", gap: 26, alignItems: "center" }}>
              <Tex tex="(a * b)_k = \sum_{i} a_i\,b_{k-i}" size={FT.h2} align="left" />
              <div style={{ fontFamily: FONT.mono, fontSize: FT.tiny, color: C.inkFaint }}>
                朴素：n² 次乘加
              </div>
            </div>
          </Card>
          {rows.map((r, i) => {
            const st = STAGES.find((s: any) => s.stage === r.key);
            const vals: number[] = r.key === "pointwise" || r.key === "inverse" ? st.values : st.a;
            const valsB: number[] | null = r.key === "input" || r.key === "dft" ? st.b : null;
            const on = pct(f, 40 + i * 46, 66 + i * 46);
            return (
              <div key={r.key} style={{ marginTop: 12, opacity: on, transform: "translateY(" + (1 - on) * 10 + "px)" }}>
                <div style={{ fontFamily: FONT.mono, fontSize: FT.tiny, letterSpacing: FT_T.meta, color: r.color, marginBottom: 6 }}>
                  {r.label}
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {vals.map((v, k) => (
                    <CHIP key={k} color={k === 0 ? r.color : C.inkDim}>{String(v)}</CHIP>
                  ))}
                </div>
                {valsB ? (
                  <div style={{ display: "flex", gap: 6, marginTop: 6 }}>
                    {valsB.map((v, k) => (
                      <CHIP key={k} dim color={C.inkDim}>{String(v)}</CHIP>
                    ))}
                  </div>
                ) : null}
              </div>
            );
          })}
          <div style={{ display: "flex", gap: 10, alignItems: "center", marginTop: 14 }}>
            <Mono size={FT.meta} color={C.inkFaint}>结果系数</Mono>
            {NTT.coeffs.map((c: number, i: number) => (
              <CHIP key={i} color={C.amber}>{c}</CHIP>
            ))}
            <Mono size={FT.meta} color={C.cyan}>{"= 整数卷积 " + NTT.coeffs.join(",")}</Mono>
          </div>
        </div>
        <div style={{ width: 620 }}>
          <Card label="为什么对：变换把卷积变成乘法">
            <MathLine tex="\hat{a}_j = \sum_k a_k\, \omega^{jk}" no="DFT" size={FT.mono} dim />
            <MathLine tex="\widehat{a*b}_j = \hat{a}_j \cdot \hat{b}_j" no="对角化" size={FT.mono} active />
            <MathLine tex="c_k = \frac{1}{n}\sum_j \hat{c}_j\, \omega^{-jk}" no="逆变换" size={FT.mono} />
            <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 6, lineHeight: 1.7 }}>
              代入单位根的正交性：Σ_j ω^(j(k−k′)) = n·[k=k′]，交叉项全部抵消，只剩逐点乘积。
            </div>
          </Card>
          <Card label="代价" accent={C.violet} style={{ marginTop: 12 }}>
            <Tex tex="3 \cdot \frac{n}{2}\log_2 n = 36" block size={FT.h2} align="left" />
            <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 4 }}>
              n = 8 时 36 次蝶形，而朴素卷积要 4 × 4 = 16 次乘加；规模越大，n log n 越占优。
            </div>
          </Card>
          <Card label="整数上的实现" accent={C.cyan} style={{ marginTop: 12 }}>
            <div style={{ fontSize: FT.tiny, color: C.inkDim, lineHeight: 1.8 }}>
              模数 p = {NTT.prime.toLocaleString()}，原根 g = {NTT.root}；
              全程整数运算，没有浮点误差，也没有舍入讨论。
            </div>
          </Card>
        </div>
      </div>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 07 · bench */

const barW = (ms: number) => Math.max(4, ((Math.log10(ms) + 3.2) / 5.2) * 560);
// 微秒级的行不能四舍五入成 "0.1 ms"：小到一定程度就换单位，否则读者会被舍入骗了。
const fmtMs = (ms: number) => (ms < 1 ? (ms * 1000).toFixed(2) + " µs" : ms.toFixed(1) + " ms");
// 卡片的标题写的是 1024 位，所以取 digits === 1024 的那一行：narration 报的也是这一行。
const BENCH_1024 = BENCH.rows.find((r: any) => r.digits === 1024);
const NTT_1024 = BENCH.ntt.find((r: any) => r.digits === 1024);
// 右卡的「增长」序列里也有 1024 位这一行。同一件事只能有一个数字：条形图取那一行，
// 否则同屏会出现两次原生乘法（5.40 µs 与 4.86 µs），读者只会以为哪里算错了。
const NATIVE_1024 = BENCH.native.rows.find((r: any) => r.digits === 1024);
const NATIVE_MS = NATIVE_1024.micros / 1000;
const BENCH_ROWS = [
  { name: "竖式（纯 Python）", ms: BENCH_1024.schoolbookMs, muls: BENCH_1024.schoolbookMuls, color: C.inkDim },
  { name: "Karatsuba（纯 Python）", ms: BENCH_1024.karatsubaMs, muls: BENCH_1024.karatsubaMuls, color: C.coral },
  { name: "NTT（numpy）", ms: NTT_1024.nttMs, muls: null, color: C.amber },
  { name: "CPython 内建 int", ms: NATIVE_MS, muls: null, color: C.cyan },
];
const BENCH_CUT = Math.round((1 - BENCH_1024.karatsubaMuls / BENCH_1024.schoolbookMuls) * 1000) / 10;
const NATIVE_RATIO = Math.round(BENCH_1024.karatsubaMs / NATIVE_MS);

const SBench: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  return (
    <Scene id="bench">
      <Head kicker="06 / 同一台机器" title="什么时候真的更快" goal="算法决定斜率，实现决定截距" />
      <div style={{ display: "flex", gap: 30, marginTop: 20 }}>
        <Card label={"1024 位十进制数相乘 · 本机实测 · 对数坐标"} style={{ width: 980 }}>
          {BENCH_ROWS.map((r, i) => {
            const on = pct(f, 20 + i * 24, 44 + i * 24);
            return (
              <div key={r.name} style={{ marginTop: 12, opacity: on }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.mono, fontSize: FT.meta }}>
                  <span style={{ color: r.color }}>{r.name}</span>
                  <span style={{ color: C.ink }}>{fmtMs(r.ms)}</span>
                </div>
                <div style={{ height: 20, marginTop: 4, background: C.bg, borderRadius: 10, border: "1px solid " + C.panelLine }}>
                  <div style={{ height: "100%", width: on > 0.99 ? barW(r.ms) : 0, background: r.color, borderRadius: 10, opacity: 0.85, transition: "none" }} />
                </div>
              </div>
            );
          })}
          <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 12 }}>
            计数的乘法次数：竖式 {BENCH_1024.schoolbookMuls.toLocaleString()}，Karatsuba {BENCH_1024.karatsubaMuls.toLocaleString()}（少 {BENCH_CUT}%），
            但纯 Python 的加法与调用开销把优势吃光了。
          </div>
        </Card>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card label="CPython 内建 int 的增长（微秒）" accent={C.cyan}>
            {BENCH.native.rows.map((r: any, i: number) => (
              <div key={r.digits} style={{ display: "flex", justifyContent: "space-between", fontFamily: FONT.mono, fontSize: FT.meta, padding: "4px 0", opacity: pct(f, 30 + i * 12, 46 + i * 12) }}>
                <span style={{ color: C.inkDim }}>{r.digits.toLocaleString()} 位</span>
                <span style={{ color: C.ink }}>{r.micros} µs</span>
              </div>
            ))}
            <div style={{ marginTop: 8, fontFamily: FONT.mono, fontSize: FT.mono, color: C.amber }}>
              {"实测指数 " + BENCH.native.measuredExponent}
            </div>
            <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 4 }}>
              接近 1.585，说明标准库用的正是 Karatsuba；常数小了四个数量级。
            </div>
          </Card>
          <Build at={Math.round(durationInFrames * 0.55)}>
            <Card label="结论" accent={C.violet} style={{ marginTop: 12 }}>
              <div style={{ fontSize: FT.body, color: C.ink, lineHeight: 1.5 }}>
                算法决定斜率，实现决定截距。同一份理论，换个实现语言就差 {NATIVE_RATIO.toLocaleString()} 倍。
              </div>
            </Card>
          </Build>
        </div>
      </div>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 08 · magic */

const MAGIC = [
  { n: "01", t: "平方", d: "x·x 比一般乘法便宜，硬件有专用路径", color: C.cyan },
  { n: "02", t: "小乘数", d: "乘一个机器字，是一次线性扫描", color: C.cyan },
  { n: "03", t: "二的幂", d: "乘 2^100 就是左移 100 位", color: C.amber },
  { n: "04", t: "阈值", d: "小规模退回竖式（CPython：70 位）", color: C.amber },
  { n: "05", t: "稀疏", d: "乘数里大量是零，整块跳过", color: C.violet },
  { n: "06", t: "分段", d: "超长数切段变换，再拼接进位", color: C.violet },
  { n: "07", t: "模数", d: "NTT 质数要容得下卷积和", color: C.coral },
  { n: "08", t: "用现成库", d: "GMP / 标准库；别自己写第二遍", color: C.coral },
];

const SMagic: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene id="magic">
      <Head kicker="07 / 工程里的魔法" title="那些看不见的常数级胜利" goal="真实的大数库是怎么把理论磨成产品的" />
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, marginTop: 24, width: 1728 }}>
        {MAGIC.map((m, i) => {
          const on = pct(f, 20 + i * 30, 44 + i * 30);
          return (
            <div
              key={m.n}
              style={{
                width: 420,
                height: 196,
                opacity: on,
                transform: "translateY(" + (1 - on) * 12 + "px)",
                background: C.panel,
                border: "1px solid " + C.panelLine,
                borderLeft: "3px solid " + m.color,
                borderRadius: 14,
                padding: "16px 20px",
                display: "flex",
                flexDirection: "column",
                justifyContent: "center",
              }}
            >
              <div style={{ display: "flex", alignItems: "baseline", gap: 10 }}>
                <Mono size={FT.tiny} color={m.color}>{m.n}</Mono>
                <div style={{ fontSize: FT.h2, fontFamily: FONT.serif }}>{m.t}</div>
              </div>
              <div style={{ fontSize: FT.meta, color: C.inkDim, marginTop: 8, lineHeight: 1.6 }}>{m.d}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 18, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint }}>
        每一个都是常数级胜利；合起来才是大数库。
      </div>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 09 · code */

const CODE_LINES: string[] = CODE.lines;
const EVENTS: any[] = CODE.trace.events;

const SCode: React.FC = () => {
  const f = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const p = pct(f, 4 * FPS, durationInFrames - 5 * FPS);
  const idx = Math.min(EVENTS.length - 1, Math.floor(p * (EVENTS.length - 1)));
  const cur = EVENTS[idx];
  const recent = EVENTS.slice(Math.max(0, idx - 7), idx + 1);
  return (
    <Scene id="code">
      <Head kicker="08 / PYTHON" title="高亮行就是正在执行的行" goal="十三行代码，每一次调用都被数了出来" />
      <div style={{ display: "flex", gap: 26, marginTop: 18 }}>
        <Card label="karatsuba.py" style={{ width: 980, padding: "16px 20px" }}>
          {CODE_LINES.map((line, i) => {
            const active = cur && cur.line === i + 1;
            return (
              <div
                key={i}
                style={{
                  display: "flex",
                  gap: 18,
                  padding: "3px 10px",
                  borderRadius: 6,
                  background: active ? "rgba(94,234,212,0.12)" : "transparent",
                  borderLeft: active ? "3px solid " + C.cyan : "3px solid transparent",
                }}
              >
                <Mono size={FT.tiny} color={C.inkFaint} style={{ width: 22, textAlign: "right" }}>{i + 1}</Mono>
                <Mono size={FT.code} color={active ? C.cyan : C.inkDim} style={{ whiteSpace: "pre" }}>{line}</Mono>
              </div>
            );
          })}
        </Card>
        <div style={{ flex: 1, minWidth: 0 }}>
          <Card label={"CALL LOG · depth " + (cur ? cur.depth : 0)} accent={C.amber}>
            <div style={{ fontFamily: FONT.mono, fontSize: FT.tiny, minHeight: 240 }}>
              {recent.map((e, k) => (
                <div key={k} style={{ paddingLeft: e.depth * 26, marginTop: 4, color: k === recent.length - 1 ? C.amber : C.inkFaint, lineHeight: 1.5 }}>
                  {"└ " + e.note}
                </div>
              ))}
            </div>
          </Card>
          <Card label="当前调用" style={{ marginTop: 12 }}>
            <div style={{ fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkDim, lineHeight: 1.8 }}>
              x = <span style={{ color: C.cyan }}>{cur ? cur.x : "—"}</span>
              <br />y = <span style={{ color: C.cyan }}>{cur ? cur.y : "—"}</span>
            </div>
          </Card>
          <Card label="验证" accent={C.violet} style={{ marginTop: 12 }}>
            <Mono size={FT.meta} color={C.ink}>{CODE.trace.x + " × " + CODE.trace.y + " = " + CODE.trace.product}</Mono>
            <div style={{ fontSize: FT.tiny, color: C.inkFaint, marginTop: 4 }}>
              与 Python 直接相乘一致：{CODE.trace.verify ? "一位不差" : "不一致"}。
            </div>
          </Card>
        </div>
      </div>
    </Scene>
  );
};

/* ---------------------------------------------------------------- 10 · outro */

const OUTRO_ROWS = [
  { name: "竖式", expo: "n^2", at: "65,536", note: "每一位碰每一位", color: C.inkDim },
  { name: "Karatsuba", expo: "n^1.585", at: "6,561", note: "三次半长乘法", color: C.cyan },
  { name: "Toom-3", expo: "n^1.465", at: "≈ 3,373", note: "五点插值", color: C.amber },
  { name: "FFT / NTT", expo: "n log n", at: "2,048", note: "把乘法变成点乘", color: C.violet },
];

const SOutro: React.FC = () => {
  const f = useCurrentFrame();
  return (
    <Scene id="outro">
      <Head kicker="09 / 结论" title="一条用加法换乘法的路" goal="四级台阶，同一个目标：少做一次乘法" />
      <div style={{ marginTop: 26 }}>
        {OUTRO_ROWS.map((r, i) => {
          const on = pct(f, 12 + i * 26, 36 + i * 26);
          return (
            <div
              key={r.name}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 26,
                padding: "12px 18px",
                marginBottom: 8,
                borderLeft: "3px solid " + r.color,
                background: C.panel,
                borderRadius: 10,
                opacity: on,
                transform: "translateX(" + (1 - on) * -14 + "px)",
              }}
            >
              <div style={{ width: 260, fontSize: FT.h2, fontFamily: FONT.serif }}>{r.name}</div>
              <Mono size={FT.h2} color={r.color} style={{ width: 260 }}>{r.expo}</Mono>
              <Mono size={FT.mono} color={C.inkDim} style={{ width: 300 }}>{"1024 位约 " + r.at}</Mono>
              <div style={{ fontSize: FT.meta, color: C.inkFaint }}>{r.note}</div>
            </div>
          );
        })}
      </div>
      <div style={{ marginTop: 22, fontSize: FT.body, color: C.inkDim }}>
        每下一级，都只是把一次乘法换成加法、插值或者变换。
      </div>
      <div style={{ marginTop: 16, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>
        npx remotion render Multiplication out/multiplication.mp4
      </div>
      <div style={{ position: "absolute", left: 72, bottom: 40, fontFamily: FONT.mono, fontSize: FT.meta, color: C.inkFaint, letterSpacing: FT_T.meta }}>
        CODE-DRIVEN LECTURE · MULTIPLICATION
      </div>
    </Scene>
  );
};

/* ---------------------------------------------------------------- subtitle + root */

const Subtitle: React.FC = () => {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = f / fps;
  const line = LINES.find((c) => t >= c.start && t < c.start + c.dur);
  if (!line) return null;
  const local = (t - line.start) / line.dur;
  const o = interpolate(local, [0, 0.05, 0.95, 1], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 26, display: "flex", justifyContent: "center", opacity: o }}>
      <div
        style={{
          background: C.panel,
          border: "1px solid " + C.panelLine,
          borderRadius: 12,
          padding: "10px 26px",
          fontSize: FT.h2,
          color: C.ink,
          maxWidth: 1440,
          textAlign: "center",
          lineHeight: 1.45,
        }}
      >
        {line.speech}
      </div>
    </div>
  );
};

const SCENE_COMPONENTS: Record<string, React.FC> = {
  open: SOpen,
  school: SSchool,
  split: SSplit,
  recur: SRecur,
  toom: SToom,
  ntt: SNtt,
  bench: SBench,
  magic: SMagic,
  code: SCode,
  outro: SOutro,
};

export const Multiplication: React.FC<{ music?: string | null; narration?: string | null }> = ({
  music = "music/score.wav",
  narration = null,
}) => (
  <AbsoluteFill style={{ background: C.bg, fontFamily: FONT.sans, color: C.ink }}>
    {music ? <Audio src={staticFile(music)} volume={0.16} /> : null}
    {narration ? <Audio src={staticFile(narration)} volume={1} /> : null}
    {SCENES.map((s, i) => (
      <Sequence key={s.id} from={Math.round(s.start * FPS)} durationInFrames={Math.round(s.dur * FPS)}>
        {React.createElement(SCENE_COMPONENTS[s.id])}
      </Sequence>
    ))}
    <Subtitle />
  </AbsoluteFill>
);
