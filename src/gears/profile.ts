/**
 * 齿轮的平面几何：所有齿廓都从 data/gears/params.json 的模数、齿数、压力角算出来。
 *
 * 这里**不 import three**：轮廓必须是纯函数，才能在没有浏览器、没有 WebGL 的
 * node 里被 scripts/qa/mesh_check.mjs 拿去验算"两个轮廓到底有没有互相穿进去"。
 * three 只在 geometry.ts 里出场，负责把这堆点做成可挤出的 Shape。
 *
 * 约定：齿的中心在角度 0（外齿轮），角度用弧度，点在 XY 平面上，绕 z 轴挤出。
 */

export type P2 = { x: number; y: number };

const TAU = Math.PI * 2;

/** 渐开线函数 inv(a) = tan(a) - a。齿廓的角度全由它给出。 */
export const inv = (a: number) => Math.tan(a) - a;

/** 半径 r 处的压力角：cos(alpha_r) = rb / r。r <= rb 时无定义。 */
export function alphaAt(r: number, rb: number) {
  const c = Math.min(1, Math.max(-1, rb / r));
  return Math.acos(c);
}

/** 半径 r 处齿侧的角度偏移（相对齿中线）。 */
function flankAngle(r: number, rb: number, rp: number, z: number, internal: boolean, half: number) {
  const ap = alphaAt(rp, rb);
  const ar = alphaAt(Math.max(r, rb), rb);
  // 外齿轮：半径变大，齿变薄；内齿轮：半径变大，齿变厚（因为它在挖空间）。
  return internal ? half + (inv(ar) - inv(ap)) : half - (inv(ar) - inv(ap));
}

export type GearSpec = {
  z: number;
  module: number;
  pressureAngleDeg: number;
  /** 齿宽（挤出厚度）。 */
  faceWidth: number;
  internal?: boolean;
  /** 齿数之外的样本密度：每侧齿廓取多少个点。 */
  flankSamples?: number;
  /**
   * 总背隙（毫米，沿节圆弧度量）。齿厚要按它减薄，否则两个理论齿廓在节点处
   * **恰好相切**：多边形近似会在接触点附近偶尔交叠一两条边，看起来像碰撞。
   * 这一点缝就是真齿轮也必须留的（背隙），不是为了让门禁好过。
   */
  backlashMm?: number;
};

export type GearShape2D = {
  /** 外轮廓（逆时针）。内齿轮时这是**内**齿廓，由调用方当 hole 用。 */
  outline: P2[];
  rPitch: number;
  rBase: number;
  rTip: number;
  rRoot: number;
  spec: GearSpec;
};

const polar = (r: number, a: number): P2 => ({ x: r * Math.cos(a), y: r * Math.sin(a) });

/**
 * 一条完整的齿廓。外齿轮：齿顶在外、齿根在内；内齿轮反过来。
 * 齿根用径向直线收进去（不做圆角）：这是 std 教科书里最常用的简化，
 * 也是本片明确承认的近似——齿根过渡曲线有专门的国标，这里不假装有。
 */
export function gearShape2D(spec: GearSpec): GearShape2D {
  const { z, module: m } = spec;
  const alpha = (spec.pressureAngleDeg * Math.PI) / 180;
  const internal = !!spec.internal;
  const rPitch = (m * z) / 2;
  const rBase = rPitch * Math.cos(alpha);
  const addendum = m;
  const dedendum = 1.25 * m;
  const rTip = internal ? rPitch - addendum : rPitch + addendum;
  const rRoot = internal ? rPitch + dedendum : rPitch - dedendum;
  const n = spec.flankSamples ?? 10;
  // 齿厚减薄：总背隙分到两侧齿面，换算成节圆上的角度。
  const half = Math.PI / (2 * z) - (spec.backlashMm ?? 0.05) / 2 / rPitch;

  // 齿根圆可能落在基圆以内：渐开线从基圆开始，基圆到齿根这一段走径向直线。
  const rStart = Math.max(rBase, Math.min(rPitch, rTip));
  const bAngle = flankAngle(rStart, rBase, rPitch, z, internal, half);

  const points: P2[] = [];
  const push = (r: number, a: number) => points.push(polar(r, a));

  for (let k = 0; k < z; k++) {
    const phi = (TAU * k) / z;
    const dir = internal ? -1 : 1; // 内齿轮：齿往圆心方向长，角度的符号跟着翻
    // 1) 从齿槽中线走到这一齿的齿根
    const gapHalf = Math.PI / z; // 齿槽中线到齿中线 = 半个齿距
    push(rRoot, phi - gapHalf);
    // 2) 齿根圆弧走到齿侧起点（用两点近似，够用：齿根不是本片的考点）
    push(rRoot, phi - bAngle * dir);
    // 3) 径向到基圆（若齿根在基圆外则直接接渐开线）
    if (rRoot < rBase && !internal) push(rBase, phi - bAngle);
    // 4) 渐开线一侧：从基圆到齿顶
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const r = internal
        ? rStart - (rStart - rTip) * t
        : rStart + (rTip - rStart) * t;
      push(r, phi - flankAngle(Math.max(r, rBase), rBase, rPitch, z, internal, half));
    }
    // 5) 齿顶圆弧另一侧
    for (let i = 1; i <= n; i++) {
      const t = i / n;
      const r = internal
        ? rTip + (rStart - rTip) * t
        : rTip - (rTip - rStart) * t;
      push(r, phi + flankAngle(Math.max(r, rBase), rBase, rPitch, z, internal, half));
    }
    // 6) 径向回到齿根，再把齿根圆弧走到齿槽中线
    if (rRoot < rBase && !internal) push(rBase, phi + bAngle);
    push(rRoot, phi + bAngle * dir === phi + bAngle ? phi + bAngle : phi + bAngle);
    push(rRoot, phi + gapHalf);
  }
  return { outline: points, rPitch, rBase, rTip, rRoot, spec };
}

/** 逆时针旋转一个轮廓（啮合相位就是靠它调的）。 */
export function rotateOutline(pts: P2[], angle: number): P2[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  return pts.map((p) => ({ x: p.x * c - p.y * s, y: p.x * s + p.y * c }));
}

/** 把一个轮廓平移到给定中心。 */
export function translateOutline(pts: P2[], dx: number, dy: number): P2[] {
  return pts.map((p) => ({ x: p.x + dx, y: p.y + dy }));
}

/** 闭合多边形的有向面积（外轮廓应为正）。 */
export function signedArea(pts: P2[]) {
  let a = 0;
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    const q = pts[(i + 1) % pts.length];
    a += p.x * q.y - q.x * p.y;
  }
  return a / 2;
}

/** 点到线段的距离。 */
export function pointSegment(px: number, py: number, ax: number, ay: number, bx: number, by: number) {
  const dx = bx - ax;
  const dy = by - ay;
  const len2 = dx * dx + dy * dy;
  let t = len2 === 0 ? 0 : ((px - ax) * dx + (py - ay) * dy) / len2;
  t = Math.max(0, Math.min(1, t));
  const cx = ax + t * dx;
  const cy = ay + t * dy;
  return Math.hypot(px - cx, py - cy);
}

/** 两条闭合轮廓之间的最小距离（不相交时为正）。 */
export function polygonDistance(a: P2[], b: P2[]) {
  let best = Infinity;
  for (const p of a) {
    for (let i = 0; i < b.length; i++) {
      const q = b[i];
      const r = b[(i + 1) % b.length];
      const d = pointSegment(p.x, p.y, q.x, q.y, r.x, r.y);
      if (d < best) best = d;
    }
  }
  return best;
}

/** 点在闭合多边形内（射线法）。 */
export function pointInPolygon(p: P2, poly: P2[]) {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const a = poly[i];
    const b = poly[j];
    if (a.y > p.y !== b.y > p.y && p.x < ((b.x - a.x) * (p.y - a.y)) / (b.y - a.y) + a.x) inside = !inside;
  }
  return inside;
}