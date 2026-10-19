#!/usr/bin/env node
/**
 * Re-derive the film's geometry from the single source (data/gears/params.json) and
 * fail when the picture would be a lie. A gear scene can look perfect and be wrong:
 * centres that are not the pitch radii sum, a profile that is not an involute, a
 * planetary set whose ring tooth count does not close. This gate is cheap and runs
 * before any render.
 *
 *   node scripts/qa/geometry_check.mjs
 *
 * exit 0 pass, 1 a geometric invariant is broken, 2 the inputs are missing.
 */
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(new URL("../..", import.meta.url).pathname);
const read = (p) => JSON.parse(readFileSync(resolve(ROOT, p), "utf8"));

let failed = 0;
const ok = (label, detail) => console.log("  PASS " + label + (detail ? "  " + detail : ""));
const bad = (label, detail) => {
  failed++;
  console.log("  FAIL " + label + (detail ? "  " + detail : ""));
};
const near = (a, b, tol = 1e-9) => Math.abs(a - b) <= tol;

let params, geom, involute;
try {
  params = read("data/gears/params.json");
  geom = read("data/gears/geometry.json");
  involute = read("data/gears/involute.json");
} catch (e) {
  console.error("geometry_check: cannot read the gear data (" + e.message + ") — run scripts/generate_gear_data.py first");
  process.exit(2);
}

const alpha = (params.pressureAngleDeg * Math.PI) / 180;
const a = params.pairs.a;
const g = geom.pairA;

/** 1. centre distance is the sum of pitch radii, which is what the 3D scene places. */
const centre = (a.module * (a.z1 + a.z2)) / 2;
near(centre, g.centreDistance)
  ? ok("centre distance = m(z1+z2)/2", centre.toFixed(6))
  : bad("centre distance", "scene has " + g.centreDistance + ", m(z1+z2)/2 is " + centre);

/** 2. base radii follow from the pressure angle; the involute is defined by them. */
const rb1 = g.pinion.pitchRadius * Math.cos(alpha);
const rb2 = g.wheel.pitchRadius * Math.cos(alpha);
near(rb1, g.pinion.baseRadius, 1e-9) && near(rb2, g.wheel.baseRadius, 1e-9)
  ? ok("base radius = r cos(alpha)", rb1.toFixed(6) + " / " + rb2.toFixed(6))
  : bad("base radius", rb1 + " vs " + g.pinion.baseRadius);

/** 3. ratio from tooth counts, and the meshing identity omega1*z1 = omega2*z2. */
const ratio = a.z2 / a.z1;
const omega1 = 7.5;
const omega2 = (omega1 * a.z1) / a.z2;
near(ratio, g.ratio) && near(omega1 * a.z1, omega2 * a.z2, 1e-12)
  ? ok("omega1*z1 = omega2*z2", "i = " + ratio.toFixed(6))
  : bad("ratio", ratio + " vs " + g.ratio);

/** 4. the sampled profile really is an involute: r(t) = rb*sqrt(1+t^2). */
let worstR = 0;
let worstTangent = 0;
for (let i = 1; i < involute.samples.length; i++) {
  const s = involute.samples[i];
  const want = rb1 * Math.sqrt(1 + s.t * s.t);
  worstR = Math.max(worstR, Math.abs(Math.hypot(s.x, s.y) - want));
  // tangent at parameter t points along (cos t, sin t): the unwound string is
  // perpendicular to the radius of the base point, which is the definition.
  const p = involute.samples[i];
  const q = involute.samples[i - 1];
  const dx = p.x - q.x;
  const dy = p.y - q.y;
  const len = Math.hypot(dx, dy);
  if (len < 1e-12) continue;
  const cross = Math.abs(Math.cos(p.t) * dy - Math.sin(p.t) * dx) / len;
  worstTangent = Math.max(worstTangent, cross);
}
worstR < 1e-9 ? ok("involute radius identity", "max error " + worstR.toExponential(2))
  : bad("involute radius identity", "max error " + worstR);
// The samples are a chord approximation, so the tangent test can only be as sharp as
// the sampling: a chord over dt deviates from the tangent by about sin(dt/2).
const dt = involute.tMax / (involute.samples.length - 1);
const tangentTol = 1.5 * Math.sin(dt / 2);
worstTangent < tangentTol
  ? ok("involute tangent is the string direction", "max error " + worstTangent.toExponential(2) + " (< " + tangentTol.toExponential(2) + ")")
  : bad("involute tangent", "max error " + worstTangent + ", sampling allows " + tangentTol);

/** 5. contact ratio >= 1 — otherwise the pair jumps a tooth gap. */
const num =
  Math.sqrt(g.pinion.addendumRadius ** 2 - g.pinion.baseRadius ** 2) +
  Math.sqrt(g.wheel.addendumRadius ** 2 - g.wheel.baseRadius ** 2) -
  g.centreDistance * Math.sin(alpha);
const eps = num / (Math.PI * a.module * Math.cos(alpha));
near(eps, g.contactRatio, 1e-9) && eps >= 1
  ? ok("contact ratio >= 1", eps.toFixed(4))
  : bad("contact ratio", eps.toFixed(4) + " (scene says " + g.contactRatio + ")");

/** 6. planetary set closes: z_ring = z_sun + 2*z_planet, and three planets fit. */
const b = params.pairs.b;
const closes = b.zRing === b.zSun + 2 * b.zPlanet;
const planet = read("data/gears/planetary.json");
closes && planet.conditionHolds
  ? ok("planetary ring closes", b.zRing + " = " + b.zSun + " + 2*" + b.zPlanet)
  : bad("planetary ring", b.zRing + " vs " + (b.zSun + 2 * b.zPlanet));
// equal planet spacing needs the sun+ring tooth count to be divisible by the count
const spacingOk = (b.zSun + b.zRing) % b.planets === 0;
spacingOk ? ok("planets equally spaced", b.planets + " x " + (b.zSun + b.zRing) / b.planets)
  : bad("planet spacing", (b.zSun + b.zRing) + " not divisible by " + b.planets);

/** 7. Willis: the three modes are the same equation, evaluated. */
const willis = (ns, nc, nr) => (ns - nc) / (nr - nc);
const k = -b.zRing / b.zSun;
let willisErr = 0;
for (const s of planet.states) {
  if (s.nRing === s.nCarrier) continue;
  willisErr = Math.max(willisErr, Math.abs(willis(s.nSun, s.nCarrier, s.nRing) - k));
}
willisErr < 1e-9 ? ok("Willis equation holds in every state", "k = " + k.toFixed(4))
  : bad("Willis", "max error " + willisErr);

/** 8. backlash: the angle a clearance corresponds to, in degrees. */
const backlash = read("data/gears/backlash.json");
let backErr = 0;
for (const row of backlash.rows) {
  const want = (Math.atan(row.clearanceMm / row.pitchRadius) * 180) / Math.PI;
  backErr = Math.max(backErr, Math.abs(want - row.angularErrorDeg));
}
backErr < 1e-9 ? ok("backlash -> angle error", "max error " + backErr.toExponential(2))
  : bad("backlash", "max error " + backErr);

console.log(failed === 0 ? "geometry: PASS" : "geometry: FAIL — " + failed + " invariant(s)");
process.exit(failed === 0 ? 0 : 1);