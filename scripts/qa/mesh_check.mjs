#!/usr/bin/env node
/**
 * Two gear outlines can look perfectly interlocked in a still frame and be a
 * collision course in motion. This gate takes the profiles from src/gears/profile.ts
 * and asks the only question that matters: over a full sweep of rotation, does any
 * edge of one gear cross an edge of another?
 *
 *   node scripts/qa/mesh_check.mjs
 *
 * It also proves it can fail: the same sweep is run with the phase shifted by half
 * a tooth, and at least one configuration must collide. A gate that never says no
 * is decoration.
 *
 * exit 0 pass, 1 a collision (or a senseless gate), 2 the profile module is broken.
 */
import { build } from "esbuild";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const dir = mkdtempSync(join(tmpdir(), "mesh-check-"));
const outfile = join(dir, "profile.mjs");
const DEG = Math.PI / 180;
let failed = 0;
const ok = (label, detail) => console.log("  PASS " + label + (detail ? "  " + detail : ""));
const bad = (label, detail) => { failed++; console.log("  FAIL " + label + (detail ? "  " + detail : "")); };

/** 两条闭合轮廓有多少条边相交（不相交时必须是 0）。 */
const segX = (a, b, c, d) => {
  const d1 = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
  const d2 = (b.x - a.x) * (d.y - a.y) - (b.y - a.y) * (d.x - a.x);
  const d3 = (d.x - c.x) * (a.y - c.y) - (d.y - c.y) * (a.x - c.x);
  const d4 = (d.x - c.x) * (b.y - c.y) - (d.y - c.y) * (b.x - c.x);
  return d1 > 0 !== d2 > 0 && d3 > 0 !== d4 > 0;
};
const crossings = (A, B) => {
  let n = 0;
  for (let i = 0; i < A.length; i++) {
    for (let j = 0; j < B.length; j++) {
      if (segX(A[i], A[(i + 1) % A.length], B[j], B[(j + 1) % B.length])) n++;
    }
  }
  return n;
};

try {
  await build({
    entryPoints: [join(ROOT, "src/gears/profile.ts")],
    bundle: true,
    format: "esm",
    platform: "node",
    outfile,
    logLevel: "error",
  });
  const m = await import(pathToFileURL(outfile).href);
  const P = JSON.parse((await import("node:fs")).readFileSync(join(ROOT, "data/gears/params.json"), "utf8"));
  const mk = (z, internal) =>
    m.gearShape2D({
      z,
      module: P.pairs.a.module,
      pressureAngleDeg: P.pressureAngleDeg,
      faceWidth: P.pairs.a.faceWidth,
      internal,
      backlashMm: P.pairs.a.backlashMm,
    });
  console.log("backlash " + P.pairs.a.backlashMm + " mm (the profiles are thinned by half of it per flank)");

  // ---- 外啮合：z1 的齿槽对准 z2 的齿。相位 = 半个齿距 = pi/z1。
  const z1 = P.pairs.a.z1;
  const z2 = P.pairs.a.z2;
  const g1 = mk(z1, false);
  const g2 = mk(z2, false);
  const centre = (P.pairs.a.module * (z1 + z2)) / 2;
  let worst = 0;
  for (let i = 0; i <= 36; i++) {
    const th = (i * 0.5) * DEG; // 扫过一整个齿距
    const A = m.rotateOutline(g1.outline, Math.PI / z1 + th);
    const B = m.translateOutline(m.rotateOutline(g2.outline, -th * (z1 / z2)), centre, 0);
    worst = Math.max(worst, crossings(A, B));
  }
  worst === 0
    ? ok("external pair " + z1 + "/" + z2 + " never collides", "swept " + ((36 * 0.5) / (360 / z1)).toFixed(2) + " pitches")
    : bad("external pair collides", worst + " edge crossings");

  // ---- 行星轮系：太阳、三个行星、内齿圈，扫 60 度太阳转角。
  const zs = P.pairs.b.zSun;
  const zp = P.pairs.b.zPlanet;
  const zr = P.pairs.b.zRing;
  const sun = mk(zs, false);
  const planet = mk(zp, false);
  const ring = mk(zr, true);
  const arm = (P.pairs.b.module * (zs + zp)) / 2;
  let worstSun = 0;
  let worstRing = 0;
  for (let i = 0; i <= 120; i++) {
    const th = (i * 0.5) * DEG;
    const carrier = th / (1 + zr / zs);
    // 行星在行星架上的自转：相对行星架，太阳与行星的齿数加权相位守恒。
    const spin = -th * (zs / zp) + carrier * (1 + zs / zp) + (Math.PI / zp);
    const S = m.rotateOutline(sun.outline, th);
    const R = m.rotateOutline(ring.outline, 0);
    for (let k = 0; k < 3; k++) {
      const psi = carrier + (k * 2 * Math.PI) / 3;
      const Pl = m.translateOutline(m.rotateOutline(planet.outline, spin), arm * Math.cos(psi), arm * Math.sin(psi));
      worstSun = Math.max(worstSun, crossings(S, Pl));
      worstRing = Math.max(worstRing, crossings(Pl, R));
    }
  }
  worstSun === 0 && worstRing === 0
    ? ok("planetary set never collides", "sun " + zs + " · planet " + zp + " · ring " + zr + ", 3 planets, 60 deg")
    : bad("planetary set collides", "sun " + worstSun + ", ring " + worstRing + " edge crossings");

  // ---- 灵敏度自证：把相位错开半个齿，必须撞上。
  let collide = 0;
  for (let i = 0; i <= 36; i++) {
    const th = (i * 0.5) * DEG;
    const A = m.rotateOutline(g1.outline, th);
    const B = m.translateOutline(m.rotateOutline(g2.outline, -th * (z1 / z2)), centre, 0);
    collide += crossings(A, B) > 0 ? 1 : 0;
  }
  collide > 0
    ? ok("a half-tooth phase error is caught", collide + " of 37 sampled angles collide")
    : bad("the collision test cannot fail", "a wrong phase passed — the gate proves nothing");
} catch (e) {
  console.error("mesh_check: " + (e && e.stack ? e.stack : e));
  rmSync(dir, { recursive: true, force: true });
  process.exit(2);
} finally {
  rmSync(dir, { recursive: true, force: true });
}

console.log(failed === 0 ? "mesh: PASS" : "mesh: FAIL — " + failed + " check(s)");
process.exit(failed === 0 ? 0 : 1);