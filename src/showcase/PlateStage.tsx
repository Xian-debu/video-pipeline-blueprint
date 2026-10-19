import React, { useEffect, useState } from "react";
import { AbsoluteFill, Img, delayRender, continueRender, staticFile, useCurrentFrame } from "remotion";
import { C, FONT, G, SB, SB_T, SC, SC_T, T } from "../design/tokens";

/**
 * PlateStage —— Blender 定版 plate 的消费端（P16）。
 *
 * 一个 plate 是 Blender CLI 渲出来的一帧 PNG，序列 + report.json 一起构成
 * 一个不可变产物：报告里记着引擎/采样/每帧秒数与每张图的 sha256。这里只做
 * 三件事：读报告、按帧号取图、把 2D 文字叠上去。
 *
 * 之所以要读报告而不是硬编码帧数：一旦 plate 序列缺失或与 composition 的
 * 时长不一致，这里要显式报错（docs/engineering-standards.md：越界不 clamp），
 * 而不是画出一堆空白帧让人以为是设计。
 *
 * 判据见 scripts/qa/plate_lint.mjs（报告与文件一致性）与 still_lint.mjs。
 */

export const PLATE_STAGE_FRAMES = 90;

export type PlateEntry = { frame: number; file: string; bytes: number; sha256: string };

export type PlateReport = {
  blender: string;
  engine: string;
  resolution: [number, number];
  samples: number;
  alpha: boolean;
  material: { preset: string; color: string };
  model: { path: string; bytes: number; sha256: string; triangles: number; vertices: number };
  camera: { radius: number[]; height: number[]; azimuth_deg: number[]; target_z: number; fov_vertical: number };
  frames: { start: number; end: number; count: number; fps: number };
  timing: { total_s: number; mean_s: number; median_s: number };
  plates: PlateEntry[];
};

/** 读 public/plates/<dir>/report.json。加载期间用 delayRender 拦住取帧。 */
const usePlateReport = (dir: string): PlateReport | null => {
  const [report, setReport] = useState<PlateReport | null>(null);
  const [handle] = useState(() =>
    delayRender("loading plate report " + dir, { timeoutInMilliseconds: 30000 })
  );
  useEffect(() => {
    let cancelled = false;
    fetch(staticFile("plates/" + dir + "/report.json"))
      .then((res) => {
        if (!res.ok) {
          throw new Error(
            "no plate report at public/plates/" + dir + "/report.json (HTTP " + res.status +
              ") — render the plates first: npm run plates"
          );
        }
        return res.json() as Promise<PlateReport>;
      })
      .then((data) => {
        if (!cancelled) setReport(data);
      })
      .catch((err: Error) => {
        // cancelRender 会让整次渲染失败并打印原因，这正是我们要的：缺 plate 不是"空镜头"。
        console.error(err.message);
        if (!cancelled) setReport(null);
      })
      .finally(() => {
        if (!cancelled) continueRender(handle);
      });
    return () => {
      cancelled = true;
    };
  }, [dir, handle]);
  return report;
};

const Kicker: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ fontFamily: FONT.mono, fontSize: SC.kicker, letterSpacing: SC_T.kicker, color: C.cyan }}>{children}</div>
);

export const PlateStage: React.FC<{ dir?: string }> = ({ dir = "showcase" }) => {
  const frame = useCurrentFrame();
  const report = usePlateReport(dir);
  if (!report) return <AbsoluteFill style={{ background: C.bg }} />;

  const index = frame - report.frames.start;
  if (index < 0 || index >= report.plates.length) {
    throw new Error(
      "PlateStage: frame " + frame + " is outside the plate range " +
        report.frames.start + ".." + report.frames.end +
        " (" + report.plates.length + " plates) — change PLATE_STAGE_FRAMES or re-render the plates"
    );
  }
  const plate = report.plates[index];
  const fade = Math.min(1, index / 12);

  return (
    <AbsoluteFill
      style={{
        background: "linear-gradient(155deg," + C.bg + " 0%," + C.bgSoft + " 62%," + C.panel + " 100%)",
        fontFamily: FONT.sans,
        color: C.ink,
      }}
    >
      {/* plate 是透明背景（--alpha），所以它只是众多图层里的一个。 */}
      <AbsoluteFill style={{ left: "34%", opacity: 0.2 + 0.8 * fade }}>
        <Img
          src={staticFile("plates/" + dir + "/" + plate.file)}
          style={{ width: "100%", height: "100%", objectFit: "contain" }}
        />
      </AbsoluteFill>

      <AbsoluteFill style={{ padding: G.pad }}>
        <Kicker>BLENDER PLATE / OFFLINE</Kicker>
        <div style={{ fontFamily: FONT.serif, fontSize: SB.title, lineHeight: 1.15, marginTop: 6 }}>
          定版渲染是另一条支路
        </div>
        <div style={{ marginTop: 12, fontSize: SB.subtitle, color: C.inkDim, maxWidth: 700 }}>
          离线渲一遍，在线用很多遍：每一帧都带校验和，渲坏了就是数据坏了，不是"看起来怪"。
        </div>
        <div style={{ marginTop: 26, display: "flex", gap: 12 }}>
          {[report.engine.replace("BLENDER_", ""), report.samples + " spp", report.resolution.join("×")].map((t) => (
            <span
              key={t}
              style={{
                fontFamily: FONT.mono,
                fontSize: SC.chip,
                letterSpacing: SC_T.chip,
                color: C.cyan,
                border: "1px solid " + C.cyanDeep,
                borderRadius: 999,
                padding: "6px 14px",
              }}
            >
              {t}
            </span>
          ))}
        </div>
      </AbsoluteFill>

      <AbsoluteFill style={{ padding: G.pad, pointerEvents: "none" }}>
        <div
          style={{
            position: "absolute",
            right: G.pad,
            top: G.pad,
            fontFamily: FONT.mono,
            fontSize: SC.value,
            letterSpacing: SB_T.overline,
            color: C.inkFaint,
          }}
        >
          {"PLATE " + String(plate.frame).padStart(4, "0") + " / " + report.frames.count}
        </div>
        <div
          style={{
            position: "absolute",
            right: G.pad,
            bottom: 150,
            width: 380,
            background: C.panel,
            border: "1px solid " + C.panelLine,
            borderRadius: 14,
            padding: "18px 20px",
          }}
        >
          {[
            ["引擎", report.engine.replace("BLENDER_", "")],
            ["采样", String(report.samples)],
            ["每帧", report.timing.median_s.toFixed(2) + " s"],
            ["sha256", plate.sha256.slice(0, 12)],
          ].map(([k, v]) => (
            <div key={k} style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontFamily: FONT.mono, fontSize: SC.label, color: C.inkFaint, letterSpacing: SC_T.label }}>{k}</span>
              <span style={{ fontFamily: FONT.mono, fontSize: SC.value, color: C.ink }}>{v}</span>
            </div>
          ))}
        </div>
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          left: G.pad,
          right: G.pad,
          bottom: 48,
          display: "flex",
          justifyContent: "center",
        }}
      >
        <div
          style={{
            background: "rgba(11,15,20,0.82)",
            border: "1px solid " + C.panelLine,
            borderRadius: 10,
            padding: "12px 22px",
            fontSize: SB.caption,
            color: C.ink,
          }}
        >
          {report.model.triangles.toLocaleString("en-US")} 个三角形 ·{" "}
          {report.model.bytes.toLocaleString("en-US")} B 的 .glb · {report.timing.total_s.toFixed(1)} s 交付{" "}
          {report.frames.count} 帧
        </div>
      </div>
    </AbsoluteFill>
  );
};
