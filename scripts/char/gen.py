#!/usr/bin/env python3
"""Procedural character for the Char film. Blender CLI only, scene-as-command.

The model is *constructed* from three-view measurements, not fitted: every horizontal
section is a superellipse whose half-width a(t) comes from the front view and whose
half-depth b(t) + depth centre cy(t) come from the side view (docs/41 §2).

Everything the film shows comes out of this one script:
  compare   3 orthographic views (alpha mask + beauty) for the L1 silhouette gate
  hero      3/4 perspective beauty stills
  turntable orbit frames (root bone rotates)
  poses     3 test poses x front/side
  clips     idle / wave / turn / walk frame sequences (skinned animation)
  colors    the same shot in three material colours
  build     progressive construction stages (rings revealed from the hips up)
  closeups  eyes / mouth / hand / foot
  patch     the geometry-plate failure vs the object-space mask

Usage (in gen24):
  /opt/aigen/video2/env/blender/blender -b --factory-startup --python scripts/char/gen.py -- \
    --params data/char/params.json --ref data/char/ref_views.json --out out/char \
    --res 1080p --samples 64 --jobs compare,hero --glb public/models/char_v1.glb
"""
import bpy, bmesh, hashlib, json, math, os, sys, time
import numpy as np
from mathutils import Vector, Euler

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from bones import BONES  # noqa: E402  the one place the skeleton is written down

# ---------------------------------------------------------------- args
argv = sys.argv[sys.argv.index("--") + 1:] if "--" in sys.argv else []


def arg(name, default=None):
    if name in argv:
        i = argv.index(name)
        return argv[i + 1] if i + 1 < len(argv) else default
    return default


PARAMS = arg("--params", "data/char/params.json")
REF = arg("--ref", "data/char/ref_views.json")
OUT = arg("--out", "out/char")
RES = arg("--res", "1080p")
SAMPLES = int(arg("--samples", "64"))
JOBS = [j for j in arg("--jobs", "compare").split(",") if j]
GLB = arg("--glb")
# GLB 里要不要把修改器（subsurf）烘进去？要。早先 --glb 导出没带 export_apply，
# 于是 three.js 拿到的是**未细分**的原始放样：顶点法线还在，但 C0 环接缝和头顶
# 那圈 8 环穹顶全是硬折——画面上一眼就是"多面体帽子"。而 Blender 的 Cycles 静帧
# 走的是细分后的网格，两边根本不是同一个模型（docs/46 K98）。
GLB_SUBSURF = int(arg("--glb-subsurf", "1"))
COLOR = arg("--color")
PATCH_MODE = arg("--patch-mode", "mask")
T0 = time.time()

P = json.load(open(PARAMS))
R = json.load(open(REF))
if COLOR:
    P["col_yellow"] = json.loads(COLOR)
RESOLUTIONS = {"ref": (832, 624), "720p": (1280, 720), "1080p": (1920, 1080), "split": (1080, 1080)}
RX, RY = RESOLUTIONS[RES]
os.makedirs(OUT, exist_ok=True)
REPORT = {"params": PARAMS, "res": [RX, RY], "samples": SAMPLES,
          "params_sha256": hashlib.sha256(json.dumps(P, sort_keys=True).encode()).hexdigest(),
          "frames": [], "parts": {}, "bones": 0}

# ---------------------------------------------------------------- silhouettes
def prof(view):
    L = np.array([(a if a is not None else 0.0) for a, b in R[view]["prof128"]], dtype=np.float64)
    Rt = np.array([(b if b is not None else 0.0) for a, b in R[view]["prof128"]], dtype=np.float64)
    return L, Rt


def smooth(y, win=7, passes=2):
    k = np.ones(win) / win
    for _ in range(passes):
        y = np.convolve(np.pad(y, (win // 2, win // 2), mode="edge"), k, mode="valid")
    return y


PFL, PFR = prof("front")
PSL, PSR = prof("side")


def smooth_keep_peak(L, R, win=11, passes=3):
    """Smooth the two silhouette edges, then rescale them about their own centre so the
    widest section keeps its measured width. Without the rescale the smoothing eats the
    peak (docs/41 K64); without the smoothing every row boundary becomes a C0 crease."""
    Ls, Rs = smooth(L, win, passes), smooth(R, win, passes)
    k = (R - L).max() / max((Rs - Ls).max(), 1e-9)
    c = (Ls + Rs) / 2
    return c + (Ls - c) * k, c + (Rs - c) * k


PFL, PFR = smooth_keep_peak(PFL, PFR)
PSL, PSR = smooth_keep_peak(PSL, PSR)
TT = np.linspace(0, 1, 128)


def interp(t, L, Rt):
    t = min(max(t, 0.0), 1.0)
    return float(np.interp(t, TT, L)), float(np.interp(t, TT, Rt))


def body_ab(t):
    """half width, half depth, depth centre at height fraction t (0 = top of head)."""
    l, r = interp(t, PFL, PFR)
    sl, sr = interp(t, PSL, PSR)
    a = max((r - l) / 2, 0.003)
    b = max((sr - sl) / 2, 0.003)
    # The side crop faces RIGHT (+x = the character's face), while in Blender the face is
    # at -Y. Keeping the crop's sign here mirrored the whole depth profile: the reference
    # leans BACK over the hips and this model leaned forward by the same amount (0.058h at
    # 0.2h), which cost 8 points of side silhouette IoU and made the two profiles disagree
    # exactly where the arm is not in the way. y_model = -x_crop.
    cy = -(sl + sr) / 2
    ab = P.get("arm_band")
    if ab:
        k = max(0.0, 1.0 - abs(t - ab["t"]) / ab["w"])
        a -= ab["dx"] * (k * k * (3 - 2 * k))
        b *= P.get("depth_scale", 1.0)
        cy += P.get("depth_shift", 0.0)
    return a, b, cy


def surf_y(x, z):
    """front surface y at (x, z) on the torso (used to seat eyes and mouth)."""
    tb, te = P["body_top"], P["body_bottom"]
    t = min(max(1 - z, tb), te)
    a, b, cy = body_ab(t)
    q = min(1.0, abs(x) / max(a, 1e-4))
    return cy - b * (1 - q ** 2.35) ** (1 / 2.35)


# ---------------------------------------------------------------- scene
bpy.ops.wm.read_factory_settings(use_empty=True)
SC = bpy.context.scene


def newmat(name, rgb, rough=0.6):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes["Principled BSDF"]
    b.inputs["Base Color"].default_value = (*rgb, 1)
    b.inputs["Roughness"].default_value = rough
    return m


M_yellow = newmat("BodyYellow", P["col_yellow"], P["rough_body"])
M_cream = newmat("BellyCream", P["col_cream"], 0.72)
M_tan = newmat("FootTan", P["col_tan"], 0.62)
M_grey = newmat("HandGrey", P["col_grey"], 0.55)
M_eye = newmat("EyeGreen", P["col_eye"], 0.28)
M_pupil = newmat("Pupil", (0.010, 0.010, 0.012), 0.18)
M_dark = newmat("MouthDark", (0.16, 0.09, 0.05), 0.6)
M_cut = newmat("CrossSection", (0.62, 0.48, 0.33), 0.85)


def patch_factor(co):
    """cream patch weight in REST coordinates.

    A material that samples object coordinates samples them on the *deformed*
    mesh, so the moment the rig spins the root the patch slides onto the back.
    Computing the weight once, in rest pose, and storing it as a vertex attribute
    keeps the patch welded to the skin through every pose.
    """
    PR = P["patch"]
    z0 = 1.0 - PR["t"]
    ux = co.x / PR["rx"]
    vz = (co.z - z0) / PR["rz"]
    r2 = ux * ux + vz * vz
    mr = min(max((1.0 - r2) / 0.10, 0.0), 1.0)
    gate = min(max((0.005 - co.y) / 0.025, 0.0), 1.0)
    return mr * gate


def body_mask_material():
    """cream patch from a rest-space vertex attribute: no extra geometry."""
    m = bpy.data.materials.new("BodyMask")
    m.use_nodes = True
    nt = m.node_tree
    nodes, links = nt.nodes, nt.links
    cream = nodes.new("ShaderNodeBsdfPrincipled")
    cream.inputs["Base Color"].default_value = (*P["col_cream"], 1)
    cream.inputs["Roughness"].default_value = 0.72
    ms = nodes.new("ShaderNodeMixShader")
    attr = nodes.new("ShaderNodeAttribute")
    attr.attribute_type = "GEOMETRY"
    attr.attribute_name = "patch"
    links.new(attr.outputs["Color"], ms.inputs[0])
    links.new(nodes["Principled BSDF"].outputs[0], ms.inputs[1])
    links.new(cream.outputs[0], ms.inputs[2])
    base = nodes["Principled BSDF"]
    base.inputs["Base Color"].default_value = (*P["col_yellow"], 1)
    base.inputs["Roughness"].default_value = P["rough_body"]
    links.new(ms.outputs[0], nodes["Material Output"].inputs["Surface"])
    return m


M_body = body_mask_material()

# ---------------------------------------------------------------- geometry kit
SEGS = P["segs"]


def ring_pts(z, cy, a, b, segs, n, yoff=0.0):
    e = 2.0 / n
    pts = []
    for s in range(segs):
        th = 2 * math.pi * s / segs
        c, sn = math.cos(th), math.sin(th)
        pts.append((a * math.copysign(abs(c) ** e, c),
                    cy + yoff + b * math.copysign(abs(sn) ** e, sn), z))
    return pts


def loft(name, rings, segs=SEGS, n=2.35, mat=None, cap0=True, cap1=True):
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    allv, idx = [], []
    for r in rings:
        zz, cy, a, b = r[0], r[1], r[2], r[3]
        yo = r[4] if len(r) > 4 else 0.0
        n_r = n(zz) if callable(n) else n
        idx.append(list(range(len(allv), len(allv) + segs)))
        allv.extend(ring_pts(zz, cy, a, b, segs, n_r, yo))
    faces = []
    for ri in range(len(rings) - 1):
        A, B = idx[ri], idx[ri + 1]
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((A[s], A[s2], B[s2], B[s]))
    if cap0:
        c = len(allv)
        allv.append(Vector((0, rings[0][1], rings[0][0])))
        for s in range(segs):
            faces.append((c, idx[0][(s + 1) % segs], idx[0][s]))
    if cap1:
        c = len(allv)
        allv.append(Vector((0, rings[-1][1], rings[-1][0])))
        for s in range(segs):
            faces.append((c, idx[-1][s], idx[-1][(s + 1) % segs]))
    me.from_pydata(allv, [], faces)
    me.validate()
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    if mat:
        ob.data.materials.append(mat)
    return ob


def subsurf(ob, l=2):
    m = ob.modifiers.new("sub", "SUBSURF")
    m.levels = l
    m.render_levels = l
    return ob


def smoothstep(a, b, x):
    if a == b:
        return 1.0 if x >= b else 0.0
    t = min(max((x - a) / (b - a), 0.0), 1.0)
    return t * t * (3 - 2 * t)


def weight(ob, fn):
    """fn(co) -> {group: weight}; weights are normalised so skinning never drops a vert."""
    groups = {}
    for v in ob.data.vertices:
        w = {k: val for k, val in fn(v.co).items() if val > 1e-4}
        s = sum(w.values())
        if s <= 1e-6:
            w = {"spine": 1.0}
            s = 1.0
        for k, val in w.items():
            g = groups.get(k)
            if g is None:
                g = groups[k] = ob.vertex_groups.new(name=k)
            g.add([v.index], val / s, "REPLACE")


# ---------------------------------------------------------------- build the character
build_t0 = time.time()
TB, TE, NR = P["body_top"], P["body_bottom"], P["body_rings"]
# K99: the crown must not push the model past height 1.0. The reference frame puts the
# sole at 0 and the crown at 1.0, so whatever the dome rises must be taken *out* of the
# body's top: solve TB = DOME_H so the apex lands exactly on 1.0 (a fixed DOME_H made the
# whole character 6% too tall, which by itself cost 5 points of silhouette IoU -- every
# row sampled a lower slice of the profile than it should).
for _ in range(30):
    _a0, _b0, _ = body_ab(TB)
    TB = 0.9 * max(_a0, _b0)
P["body_top"] = TB
body_rings = []
# crown dome: the reference's top is a *rounded* plateau 0.054h wide, not a disc
# with a sharp rim (the rim read as a tin can in the closeups).
a0, b0, cy0 = body_ab(TB)
# 穹顶高度必须跟顶部半径成比例。写死 0.030 的后果是：顶部半径只有 ~0.011，
# 却拉出 0.03 高的锥子——渲染出来就是"尖帽"，而且整只人高了 3%（宽度占比被压低，
# 三视图比对的宽高比随之差 4.5%，docs/46 K98b）。改成 0.9×半径后穹顶仍是圆的，
# 但总高只多 0.7%。
# apex = 1 - TB + DOME_H - subsurf_drop. Measured on real exports: DOME_H = 1.00*TB gives
# apex 0.9851, DOME_H = 1.45*TB gives 1.0235 -> solve 1.175*TB for apex == 1.000.
# K101: the old profile was r = sin θ, y = 1 - sin θ -> a straight line in (r, y),
# i.e. a CONE, not a dome (the "尖帽" in the closeups; the silhouette gate cannot see it
# because the head is narrow from the front). A round crown needs the ellipse r = cos θ,
# y = sin θ, so the top is hemispherical for as long as DOME_H ~= a0.
DOME_H = 1.036 * TB   # solved against apex == 1.000 on the ellipse profile (see K101)
for k in range(7, -1, -1):   # k=8 would duplicate the body's top ring and leave a seam
    th = (k / 8.0) * math.pi / 2
    f = max(math.cos(th), 0.0)
    body_rings.append((1 - TB + DOME_H * math.sin(th), cy0, a0 * f, b0 * f))
for k in range(NR):
    t = TB + (TE - TB) * k / (NR - 1.0)
    a, b, cy = body_ab(t)
    body_rings.append((1 - t, cy, a, b))
a, b, cy = body_ab(TE)
for k in range(1, 13):
    u = k / 13.0
    f = (1.0 - u * u) ** 0.5
    body_rings.append((1 - TE - P["bottom_drop"] * u, cy + P["bottom_back"] * u, a * f, b * f))
# squarish through the torso, round through the head: a single exponent puts a
# hard ridge down the back of the skull (docs/41 K64)
body = loft("Body", body_rings, SEGS,
            lambda z: 2.0 + 0.42 * smoothstep(0.30, 0.62, 1 - z), mat=M_body)
pcol = body.data.color_attributes.new(name="patch", type="FLOAT_COLOR", domain="POINT")
for _i, _v in enumerate(body.data.vertices):
    _f = patch_factor(_v.co)
    pcol.data[_i].color = (_f, _f, _f, 1.0)


def body_weights(co):
    z = co.z
    wh = smoothstep(0.78, 0.94, z)
    wc = smoothstep(0.54, 0.80, z) * (1 - wh)
    return {"head": wh, "chest": wc, "spine": max(0.0, 1 - wh - wc)}


weight(body, body_weights)
subsurf(body, 2)

LC = P["leg"]
for sign, tag in ((1, "l"), (-1, "r")):
    rr = []
    for k in range(28):
        t = k / 27.0
        z = LC["top"] - (LC["top"] - LC["ankle"]) * t
        r = LC["r_top"] + (LC["r_ankle"] - LC["r_top"]) * t ** 0.65
        rr.append((z, 0.0, r, r * LC["depth_ratio"]))
    ob = loft("Leg" + tag, rr, 48, 2.0, mat=M_yellow)
    for v in ob.data.vertices:
        f = (LC["top"] - v.co.z) / max(LC["top"] - LC["ankle"], 1e-4)
        f = min(max(f, 0.0), 1.0)
        v.co.x = float(v.co.x + sign * (LC["x"] + (LC["x_ankle"] - LC["x"]) * f))
        # the legs hang BEHIND the torso centre (Blender +y = back); leaving them on y=0
        # put the whole lower leg 0.02-0.03h in front of the reference profile
        v.co.y = float(v.co.y + LC.get("dy", 0.0))

    def leg_w(co, tag=tag):
        z = co.z
        wshin = smoothstep(LC["ankle"] + 0.02, LC["top"] * 0.62, z)
        return {"thigh_" + tag: wshin, "shin_" + tag: 1 - wshin}

    weight(ob, leg_w)
    subsurf(ob, 2)

FC = P["foot"]


def paw(name, sections, segs=40):
    """Loft a foot along depth (heel at +y, toe at -y): an ellipsoid reads as a pancake,
    the reference foot is a wedge with a heel, an arch and a rounded toe."""
    me = bpy.data.meshes.new(name)
    ob = bpy.data.objects.new(name, me)
    bpy.context.collection.objects.link(ob)
    allv, idx = [], []
    for (y, wx, hz, zc) in sections:
        ring = []
        for s in range(segs):
            th = 2 * math.pi * s / segs
            ring.append((wx * math.cos(th), y, zc + hz * math.sin(th)))
        idx.append(list(range(len(allv), len(allv) + segs)))
        allv.extend(ring)
    faces = []
    for ri in range(len(sections) - 1):
        A, B = idx[ri], idx[ri + 1]
        for s in range(segs):
            s2 = (s + 1) % segs
            faces.append((A[s], A[s2], B[s2], B[s]))
    for c, ring_i in ((-1, 0), (-1, -1)):
        ci = len(allv)
        allv.append((0.0, sections[ring_i][0], max(1e-4, sections[ring_i][3])))
        for s in range(segs):
            if ring_i == 0:
                faces.append((ci, idx[0][(s + 1) % segs], idx[0][s]))
            else:
                faces.append((ci, idx[-1][s], idx[-1][(s + 1) % segs]))
    me.from_pydata(allv, [], faces)
    me.validate()
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob.data.materials.append(M_tan)
    return ob


for sign, tag in ((1, "l"), (-1, "r")):
    h, ln, wd = FC["h"], FC["len"], FC["w"]
    y0 = FC["y"]
    # K99b: the mid-foot section is a full circle of radius h, so the paw dipped 0.0172h
    # below the ground plane -- the whole character then measured 1.017h tall against a
    # reference frame whose sole sits exactly at 0. Seat the sole on z = 0 instead.
    fz = FC.get("z", 0.0)
    secs = [
        (y0 + ln * 0.50, wd * 0.42, h * 0.52, h * 0.62 + fz),
        (y0 + ln * 0.34, wd * 0.72, h * 0.80, h * 0.58 + fz),
        (y0 + ln * 0.08, wd * 1.00, h * 1.00, h * 0.52 + fz),
        (y0 - ln * 0.14, wd * 0.92, h * 0.86, h * 0.50 + fz),
        (y0 - ln * 0.34, wd * 0.70, h * 0.60, h * 0.47 + fz),
        (y0 - ln * 0.50, wd * 0.34, h * 0.34, h * 0.42 + fz),
    ]
    ob = paw("Foot" + tag, secs)
    weight(ob, lambda co, tag=tag: {"foot_" + tag: 1.0})
    ob.location = (sign * FC["x"], 0.0, 0.0)
    ob.rotation_euler = Euler((0, 0, math.radians(-sign * FC["yaw"])))
    subsurf(ob, 2)
    if FC.get("sole_flat"):
        # The reference's sole is FLAT on the ground: a chain of full ellipse sections
        # leaves a rounded ball, so the bottom rows of the silhouette collapse to a 0.02h
        # sliver instead of the reference's full-length footprint (worth a third of the
        # side-profile RMSE). Clamping before subsurf does not survive Catmull-Clark, so
        # bake the modifier, clamp the real vertices, then add one smoothing level back.
        bpy.context.view_layer.objects.active = ob
        for m in list(ob.modifiers):
            bpy.ops.object.modifier_apply(modifier=m.name)
        _z0 = 0.0   # K99b: the ground plane IS the sole; min() kept the pre-clamp dip (-0.0176)
        # K102: a hard clamp folds the ring under the paw and the folded edge reads as a
        # zig-zag skirt in the closeup. Compress the last band quadratically instead: the
        # sole still touches z0, but the transition has a tangent, so Catmull-Clark keeps
        # it smooth.
        _band = FC.get("sole_band", 0.030)
        for v in ob.data.vertices:
            _dz = v.co.z - _z0
            if _dz < _band:
                _dz = max(_dz, 0.0)
                v.co.z = _z0 + (_dz * _dz) / _band
        m2 = ob.modifiers.new("sub2", "SUBSURF")
        m2.levels = m2.render_levels = 1

AC = P["arm"]
for sign, tag in ((1, "l"), (-1, "r")):
    rr = []
    for k in range(30):
        t = k / 29.0
        z = AC["top"] - (AC["top"] - AC["wrist"]) * t
        r = AC["r_top"] + (AC["r_wrist"] - AC["r_top"]) * t ** 0.6
        rr.append((z, 0.0, r, r * 0.92))
    ob = loft("Arm" + tag, rr, 40, 2.0, mat=M_yellow)
    zt, zb = AC["top"], AC["wrist"]
    inset, azi = AC.get("shoulder_inset", 0.05), AC.get("azi", 0.42)
    for v in ob.data.vertices:
        u = min(max((zt - v.co.z) / max(zt - zb, 1e-4), 0.0), 1.0)
        r_now = AC["r_top"] + (AC["r_wrist"] - AC["r_top"]) * u ** 0.6
        # The limb lies on the flank at azimuth azi (0 = mid depth, 1 = fully forward)
        # and its crown is pulled INSIDE the torso, so the tube has no visible cap
        # and no shadow step where it meets the shoulder.
        aa, bb, ccy = body_ab(min(max(1 - v.co.z, P["body_top"]), P["body_bottom"]))
        cx = aa - r_now * 0.30 - inset * (1 - u) ** 2
        cyv = ccy - bb * azi * (1 - 0.22 * u)
        v.co.x = float(v.co.x + sign * cx)
        v.co.y = float(v.co.y + cyv)

    def arm_w(co, tag=tag):
        u = min(max((zt - co.z) / max(zt - zb, 1e-4), 0.0), 1.0)
        wf = smoothstep(0.45, 0.75, u)
        return {"arm_" + tag: 1 - wf, "forearm_" + tag: wf}

    weight(ob, arm_w)
    subsurf(ob, 2)

for sign, tag in ((1, "l"), (-1, "r")):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=1.0)
    ob = bpy.context.object
    ob.name = "Hand" + tag
    ob.scale = (P["hand"]["r"], P["hand"]["r"] * 0.9, P["hand"]["rz"])
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    hz = AC["wrist"] - 0.010
    ha, hb, hcy = body_ab(min(max(1 - hz, P["body_top"]), P["body_bottom"]))
    hx = ha - P["hand"]["r"] * 0.25
    ob.location = (sign * hx, hcy - hb * AC.get("azi", 0.42) * 0.80 - P["hand"]["r"] * 0.15, hz)
    for p in ob.data.polygons:
        p.use_smooth = True
    ob.data.materials.append(M_grey)
    weight(ob, lambda co, tag=tag: {"hand_" + tag: 1.0})
    subsurf(ob, 1)

# eyes: seated on the solved surface, pupil in front of the sclera
t_eye = P["eye"]["t"]
ze = 1 - t_eye
for sign in (1, -1):
    xe = sign * P["eye"]["x"]
    yf = surf_y(xe, ze)
    r = P["eye"]["r"]
    yc = yf + r * 0.35
    bpy.ops.mesh.primitive_uv_sphere_add(segments=36, ring_count=26, radius=r)
    sc = bpy.context.object
    sc.name = "Eye"
    sc.location = (xe, yc, ze)
    for p in sc.data.polygons:
        p.use_smooth = True
    sc.data.materials.append(M_eye)
    weight(sc, lambda co: {"head": 1.0})
    pr = P["eye"]["pupil_r"]
    bpy.ops.mesh.primitive_uv_sphere_add(segments=28, ring_count=18, radius=pr)
    pu = bpy.context.object
    pu.name = "Pupil"
    pu.location = (xe, yc - r * 0.92, ze)
    pu.scale = (1, 0.4, 1)
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    for p in pu.data.polygons:
        p.use_smooth = True
    pu.data.materials.append(M_pupil)
    weight(pu, lambda co: {"head": 1.0})

# mouth: a swept tube along the smile arc (a torus would show its whole ring)
MO = P["mouth"]
zm = 1 - MO["t"]


def smile_arc():
    n = 32
    half = MO["r"] * MO["wide"]
    pts = []
    for i in range(n + 1):
        u = -1 + 2 * i / n
        x = u * half
        z = zm - MO["curve"] * (1 - u * u)
        pts.append(Vector((x, surf_y(x, z) - 0.0012, z)))
    verts, faces = [], []
    NSEG, rad = 10, MO["thick"]
    for i, p in enumerate(pts):
        if i == 0:
            tg = pts[1] - pts[0]
        elif i == len(pts) - 1:
            tg = pts[-1] - pts[-2]
        else:
            tg = pts[i + 1] - pts[i - 1]
        tg.normalize()
        nrm = Vector((0, -1, 0))
        bi = tg.cross(nrm)
        if bi.length < 1e-6:
            bi = Vector((1, 0, 0))
        bi.normalize()
        nrm = tg.cross(bi).normalized() * -1
        for s in range(NSEG):
            th = 2 * math.pi * s / NSEG
            verts.append(p + bi * math.cos(th) * rad + nrm * math.sin(th) * rad)
    for i in range(len(pts) - 1):
        for s in range(NSEG):
            faces.append((i * NSEG + s, i * NSEG + (s + 1) % NSEG,
                          (i + 1) * NSEG + (s + 1) % NSEG, (i + 1) * NSEG + s))
    me = bpy.data.meshes.new("Mouth")
    ob = bpy.data.objects.new("Mouth", me)
    bpy.context.collection.objects.link(ob)
    me.from_pydata([tuple(v) for v in verts], [], faces)
    me.validate()
    me.update()
    for p in me.polygons:
        p.use_smooth = True
    ob.data.materials.append(M_dark)
    subsurf(ob, 1)
    return ob


mouth = smile_arc()
weight(mouth, lambda co: {"head": 1.0})

# the "geometry plate" failure mode, only built when asked for (patch job)
patch_plate = None
if PATCH_MODE == "geom":
    PRP = P["patch"]
    zc = 1 - PRP["t"]
    rr = []
    for k in range(24):
        u = k / 23.0
        ang = math.pi * (u - 0.5)
        z = zc + PRP["rz"] * math.sin(ang)
        a = PRP["rx"] * math.cos(ang)
        b = PRP["rx"] * 0.55 * math.cos(ang)
        cyb = body_ab(min(max(1 - z, P["body_top"]), P["body_bottom"]))[2]
        rr.append((z, cyb, a, b))
    plate = loft("PatchPlate", rr, 64, 2.0, mat=M_cream)
    for v in plate.data.vertices:
        v.co.y = float(v.co.y - 0.02)
    weight(plate, body_weights)
    subsurf(plate, 1)
    patch_plate = plate

bpy.ops.object.select_all(action="SELECT")
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
model = bpy.context.object
model.name = "Character"
REPORT["parts"]["verts"] = len(model.data.vertices)
REPORT["parts"]["faces"] = len(model.data.polygons)
REPORT["parts"]["build_seconds"] = round(time.time() - build_t0, 2)

# ---------------------------------------------------------------- armature (explicit groups, no auto weights)
# BONES comes from scripts/char/bones.py (imported at the top) so the film can draw
# the same skeleton it was built with — see scripts/char/manifest.py.
arm_data = bpy.data.armatures.new("CharRig")
rig = bpy.data.objects.new("CharRig", arm_data)
bpy.context.collection.objects.link(rig)
bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode="EDIT")
for nm, head, tail, parent in BONES:
    eb = arm_data.edit_bones.new(nm)
    eb.head = head
    eb.tail = tail
    if parent:
        eb.parent = arm_data.edit_bones[parent]
bpy.ops.object.mode_set(mode="OBJECT")
bpy.ops.object.select_all(action="DESELECT")
model.select_set(True)
rig.select_set(True)
bpy.context.view_layer.objects.active = rig
# ARMATURE_NAME: use the vertex groups we wrote, do not invent automatic weights
bpy.ops.object.parent_set(type="ARMATURE_NAME")
bones_on_model = sum(1 for v in model.data.vertices if len(v.groups) > 0)
REPORT["bones"] = len(BONES)
REPORT["parts"]["weighted_verts"] = bones_on_model

# ---------------------------------------------------------------- lights, camera, render settings
w = bpy.data.worlds.new("W")
SC.world = w
w.use_nodes = True
bgn = w.node_tree.nodes["Background"]
bgn.inputs[0].default_value = (0.90, 0.90, 0.90, 1)
bgn.inputs[1].default_value = P["world"]


def area(loc, energy, size, rot):
    d = bpy.data.lights.new("A", "AREA")
    d.energy = energy
    d.size = size
    o = bpy.data.objects.new("A", d)
    bpy.context.collection.objects.link(o)
    o.location = loc
    o.rotation_euler = Euler(rot)
    return o


L = P["lights"]
area((2.4, -2.8, 3.0), L["key"], 3.0, (math.radians(50), 0, math.radians(40)))
area((-3.0, -2.0, 1.3), L["fill"], 4.0, (math.radians(78), 0, math.radians(-55)))
area((0.3, 3.4, 2.8), L["rim"], 3.0, (math.radians(125), 0, math.radians(180)))

cam_d = bpy.data.cameras.new("Cam")
cam = bpy.data.objects.new("Cam", cam_d)
bpy.context.collection.objects.link(cam)
SC.camera = cam
cam_d.type = "ORTHO"
cam_d.ortho_scale = 1.32

SC.render.resolution_x = RX
SC.render.resolution_y = RY
SC.render.resolution_percentage = 100
SC.render.image_settings.file_format = "PNG"
SC.render.image_settings.color_mode = "RGBA"
SC.view_settings.view_transform = "Standard"
SC.view_settings.exposure = P["exposure"]
SC.render.engine = "CYCLES"
SC.cycles.samples = SAMPLES
SC.cycles.use_denoising = True
SC.cycles.device = "GPU"
SC.render.fps = 30
prefs = bpy.context.preferences.addons["cycles"].preferences
prefs.compute_device_type = "CUDA"
prefs.get_devices()

VIEWS = {
    "front": ((0, -3.0, 0.5), (math.radians(90), 0, 0)),
    "side": ((-3.0, 0, 0.5), (math.radians(90), 0, math.radians(-90))),
    "back": ((0, 3.0, 0.5), (math.radians(90), 0, math.radians(180))),
}


def look_at(loc, target):
    d = Vector(target) - Vector(loc)
    return d.to_track_quat("-Z", "Y").to_euler()


# Framing is aspect-aware: 1.32 was tuned on the 4:3 reference render, and on a
# 16:9 frame that same ortho_scale would crop the crown and the feet (ortho_scale
# spans the LONGER frame side). Keep 'ref' byte-identical for the gate, and for
# the film resolutions cover 1.21 world units vertically instead of 0.99.
REF_ASPECT = 832.0 / 624.0
FRAME_MARGIN = 1.0 if RES == "ref" else 1.22


def ortho_scale():
    return 1.32 * (RX / float(RY)) / REF_ASPECT * FRAME_MARGIN


def set_cam(kind):
    if kind in VIEWS:
        loc, rot = VIEWS[kind]
        cam_d.type = "ORTHO"
        cam_d.ortho_scale = ortho_scale()
        cam.location = loc
        cam.rotation_euler = Euler(rot)
    elif kind == "hero":
        cam_d.type = "PERSP"
        cam_d.lens = 72
        # A perspective camera's vertical coverage shrinks with a wider frame, so
        # the distance has to be solved from the aspect, not multiplied by a constant.
        need_h = 0.97 if RES == "ref" else 1.16
        half_w = need_h * (RX / float(RY)) / 2.0
        dist = half_w / (18.0 / 72.0)
        off = Vector((1.05, -2.35, 0.30)).normalized() * dist
        cam.location = Vector((0, 0, 0.52)) + off
        cam.rotation_euler = look_at(cam.location, (0, 0, 0.52))
    elif kind == "closeup":
        cam_d.type = "PERSP"
        cam_d.lens = 105
        cam.location = (0.30, -0.95, 0.86)
        cam.rotation_euler = look_at(cam.location, (0.03, -0.05, 0.80))


def sha(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def render(name, job, transparent=True):
    t = time.time()
    SC.render.film_transparent = transparent
    SC.render.filepath = os.path.join(OUT, name + ".png")
    bpy.ops.render.render(write_still=True)
    path = SC.render.filepath
    REPORT["frames"].append({"job": job, "name": name, "path": os.path.relpath(path),
                             "sha256": sha(path), "seconds": round(time.time() - t, 2)})
    print("FRAME %s %.2fs" % (name, time.time() - t), flush=True)
    return path


def reset_pose():
    for pb in rig.pose.bones:
        pb.rotation_mode = "XYZ"
        pb.rotation_euler = (0, 0, 0)
        pb.location = (0, 0, 0)


def apply_pose(pose):
    reset_pose()
    for bone, (axis, deg) in pose.items():
        pb = rig.pose.bones[bone]
        e = list(pb.rotation_euler)
        e[axis] += math.radians(deg)
        pb.rotation_euler = e
    bpy.context.view_layer.update()


def cut_top(frac):
    """body_ab t coordinate the construction has reached: 0.705 (hips) -> 0.004 (crown)."""
    tb = P["body_top"]
    te = P["body_bottom"] + P["bottom_drop"]
    return te + (tb - te) * max(0.0, min(1.0, frac))


POSES = {
    "pose_arm": {"arm_l": (1, -62), "forearm_l": (1, -38), "arm_r": (1, 16),
                 "head": (1, 10), "chest": (0, 5)},
    "pose_walk": {"thigh_l": (1, 26), "shin_l": (1, -42), "thigh_r": (1, -16),
                  "arm_l": (1, -18), "arm_r": (1, -18), "head": (0, -12)},
    "pose_squat": {"thigh_l": (1, 30), "thigh_r": (1, 30), "shin_l": (1, -50),
                   "shin_r": (1, -50), "chest": (1, 12), "head": (1, -8)},
}


def clip_pose(name, f, n):
    """deterministic per-frame pose: no randomness, no clock, only frame index."""
    ph = 2 * math.pi * f / n
    if name == "idle":
        return {"chest": (1, 1.6 * math.sin(ph)), "head": (1, -1.2 * math.sin(ph)),
                "spine": (0, 2.0 * math.sin(ph)), "arm_l": (1, -2.5 * math.sin(ph)),
                "arm_r": (1, -2.5 * math.sin(ph))}
    if name == "wave":
        return {"arm_r": (1, -95 + 6 * math.sin(ph * 2)), "forearm_r": (1, -30 + 22 * math.sin(ph * 2)),
                "hand_r": (1, 12 * math.sin(ph * 2)), "head": (0, -6),
                "arm_l": (1, -6), "spine": (0, 3)}
    if name == "turn":
        # root points +Z, so its LOCAL Y axis is the bone axis: index 1 spins the
        # figure around the world vertical. Index 2 tipped it on its side.
        return {"root": (1, 360.0 * f / n)}
    if name == "walk":
        return {"thigh_l": (1, 24 * math.sin(ph)), "thigh_r": (1, -24 * math.sin(ph)),
                "shin_l": (1, -30 * max(0.0, math.sin(ph + 0.9))),
                "shin_r": (1, -30 * max(0.0, -math.sin(ph + 0.9))),
                "arm_l": (1, -16 * math.sin(ph)), "arm_r": (1, 16 * math.sin(ph)),
                "chest": (1, 1.5 + 1.5 * math.cos(ph * 2)), "head": (1, -1.5 * math.cos(ph * 2))}
    return {}


CLIP_FRAMES = {"idle": 24, "wave": 24, "turn": 24, "walk": 30}

# ---------------------------------------------------------------- jobs
for job in JOBS:
    if job == "compare":
        for view in ("front", "side", "back"):
            set_cam(view)
            render("mask_" + view, "compare", transparent=True)
            render("beauty_" + view, "compare", transparent=False)
    elif job == "hero":
        set_cam("hero")
        render("hero", "hero", transparent=False)
        render("hero_alpha", "hero", transparent=True)
    elif job == "turntable":
        set_cam("hero")
        n = 36
        for f in range(n):
            apply_pose({"root": (1, 360.0 * f / n)})
            render("turn_%03d" % f, "turntable", transparent=True)
    elif job == "poses":
        for pname, pose in POSES.items():
            apply_pose(pose)
            for view in ("front", "side"):
                set_cam(view)
                render("%s_%s" % (pname, view), "poses", transparent=True)
        reset_pose()
    elif job == "clips":
        set_cam("hero")
        for cname, n in CLIP_FRAMES.items():
            for f in range(n):
                apply_pose(clip_pose(cname, f, n))
                render("clip_%s_%03d" % (cname, f), "clips", transparent=True)
        reset_pose()
    elif job == "colors":
        set_cam("hero")
        def recolour(rgb):
            # body and limbs are two materials (the body one carries the cream patch);
            # a variant that recolours only the torso leaves yellow arms and legs
            for mat in (M_body, M_yellow):
                mat.node_tree.nodes["Principled BSDF"].inputs["Base Color"].default_value = (*rgb, 1)
            P["col_yellow"] = rgb
            bpy.context.view_layer.update()

        for cname, rgb in P["col_variants"].items():
            recolour(rgb)
            render("color_" + cname, "colors", transparent=True)
        # put the body back: the recolour above mutates the shared material node, and
        # every later job (build/closeups/patch) would inherit the last variant's hue
        recolour(json.loads(COLOR) if COLOR else P["col_variants"]["yellow"])
    elif job == "build":
        set_cam("hero")
        model.data.materials.append(M_cut)
        cut_idx = len(model.data.materials) - 1
        base = model.data.copy()
        for i, frac in enumerate(P["build_steps"]):
            # a real partial loft: drop the faces above a moving cut height
            me = base.copy()
            model.data = me
            cut = 1.0 - cut_top(frac)
            bm = bmesh.new()
            bm.from_mesh(me)
            # A slice, not a hole: deleting the faces above the cut left the inside
            # of the shell visible (magenta = polygon index past the material slots).
            # Bisect and cap the opening so every build step is a closed solid.
            cutres = bmesh.ops.bisect_plane(
                bm, geom=bm.verts[:] + bm.edges[:] + bm.faces[:],
                plane_co=(0, 0, cut), plane_no=(0, 0, 1), clear_outer=True)
            loop = [e for e in cutres["geom_cut"] if isinstance(e, bmesh.types.BMEdge)]
            if loop:
                bmesh.ops.edgenet_fill(bm, edges=loop)
            for f in bm.faces:
                if abs(f.calc_center_median().z - cut) < 1e-4:
                    f.smooth = False
                    f.material_index = cut_idx
            bm.to_mesh(me)
            bm.free()
            nmat = max(1, len(me.materials))
            for poly in me.polygons:
                if poly.material_index >= nmat:
                    poly.material_index = 0
            me.update()
            render("build_%02d" % i, "build", transparent=True)
        model.data = base
    elif job == "closeups":
        # Closeups keep the reference's vertical coverage: pull the camera back by
        # the aspect ratio so a detail tile isn't tighter on a 16:9 frame.
        cs = (RX / float(RY)) / REF_ASPECT

        def closeup(loc, target, lens=105):
            cam_d.type = "PERSP"
            cam_d.lens = lens
            cam.location = Vector(target) + (Vector(loc) - Vector(target)) * cs
            cam.rotation_euler = look_at(cam.location, target)

        closeup((0.18, -0.72, 0.94), (0.0, -0.05, 0.90), 85)
        render("closeup_face", "closeups", transparent=True)
        closeup((0.42, -0.90, 0.45), (0.16, -0.05, 0.40))
        render("closeup_hand", "closeups", transparent=True)
        closeup((0.32, -0.85, 0.16), (0.10, -0.02, 0.06))
        render("closeup_foot", "closeups", transparent=True)
        closeup((0.0, -0.60, 0.96), (0.0, -0.05, 0.93))
        render("closeup_eyes", "closeups", transparent=True)
    elif job == "patch":
        set_cam("hero")
        render("patch_" + PATCH_MODE, "patch", transparent=True)
    else:
        raise SystemExit("unknown job: " + job)

if GLB:
    os.makedirs(os.path.dirname(GLB) or ".", exist_ok=True)
    # 只降细分级别，不删修改器：级别 1 已经足够把环接缝和头顶穹顶拉平，
    # 三角数却从 128 万降到 32 万（渲染端还能跑实时）。
    dumped = {}
    for ob in bpy.data.objects:
        if ob.type != "MESH":
            continue
        for m in ob.modifiers:
            if m.type == "SUBSURF":
                dumped[ob.name] = max(dumped.get(ob.name, 0), m.levels)
                m.levels = min(m.levels, GLB_SUBSURF)
                m.render_levels = m.levels
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.export_scene.gltf(filepath=GLB, export_format="GLB", use_selection=False, export_apply=True)
    REPORT["glb_subsurf"] = {"level": GLB_SUBSURF, "was": dumped}
    REPORT["glb"] = {"path": GLB, "bytes": os.path.getsize(GLB), "sha256": sha(GLB)}
    print("GLB", GLB, os.path.getsize(GLB), flush=True)

REPORT["seconds"] = round(time.time() - T0, 2)
with open(os.path.join(OUT, "report.json"), "w") as f:
    json.dump(REPORT, f, indent=1)
print("DONE", json.dumps({"frames": len(REPORT["frames"]), "seconds": REPORT["seconds"],
                          "verts": REPORT["parts"]["verts"], "bones": REPORT["bones"]}), flush=True)