#!/usr/bin/env python3
"""角色动作作者：解析 FK + 两骨 IK，输出 data/char2/anim.json。

为什么在宿主侧算而不是在 TS 里算：动作要能被"量"。脚有没有滑、循环有没有接上、
挥手时手腕到了没有，这些判据都要和画面用同一份数字；如果动作只在 TS 里凭空算，
门禁就只能看画面猜。这里的 JSON 既是渲染输入，也是 gate_anim.py 的唯一真源。

坐标：glb 里 Y 向上、+Z 朝前（参考图正视图的那一面）、X 向右。
骨骼：23 个节点里 16 根骨；每根骨的局部 +Y 是骨轴（Blender 约定），
rest 四元数见 model.ledger.json（腿/臂带着 180° 翻转，别拿世界轴当骨轴，K73）。

动作表示：每帧每根骨一个**局部增量四元数** delta，运行时 bone.quaternion = rest * delta。
这样做的好处：与 Blender 里怎么建骨无关，也不需要 euler 顺序的约定。

用法：
  python3 scripts/char2/anim.py --ledger data/char2/model.ledger.json --out data/char2/anim.json
"""
import argparse, json, math, sys

# ---------------------------------------------------------------- quaternion
def qmul(a, b):
    ax, ay, az, aw = a; bx, by, bz, bw = b
    return (aw*bx + ax*bw + ay*bz - az*by,
            aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw,
            aw*bw - ax*bx - ay*by - az*bz)

def qconj(q):
    x, y, z, w = q
    return (-x, -y, -z, w)

def qnorm(q):
    n = math.sqrt(sum(c*c for c in q)) or 1.0
    return tuple(c/n for c in q)

def qaxis(axis, ang):
    x, y, z = axis
    n = math.sqrt(x*x + y*y + z*z) or 1.0
    s = math.sin(ang/2)/n
    return (x*s, y*s, z*s, math.cos(ang/2))

def qrot(q, v):
    x, y, z, w = q; vx, vy, vz = v
    tx = 2*(y*vz - z*vy); ty = 2*(z*vx - x*vz); tz = 2*(x*vy - y*vx)
    return (vx + w*tx + y*tz - z*ty,
            vy + w*ty + z*tx - x*tz,
            vz + w*tz + x*ty - y*tx)

def qfrom_to(a, b):
    """把单位向量 a 转到 b 的最短弧四元数。"""
    d = sum(x*y for x, y in zip(a, b))
    if d > 0.999999:
        return (0.0, 0.0, 0.0, 1.0)
    if d < -0.999999:
        # 反向：挑一个与 a 正交的轴转 180°
        axis = (0.0, 0.0, 1.0) if abs(a[2]) < 0.9 else (0.0, 1.0, 0.0)
        c = (a[1]*axis[2]-a[2]*axis[1], a[2]*axis[0]-a[0]*axis[2], a[0]*axis[1]-a[1]*axis[0])
        return qaxis(c, math.pi)
    cx = a[1]*b[2]-a[2]*b[1]; cy = a[2]*b[0]-a[0]*b[2]; cz = a[0]*b[1]-a[1]*b[0]
    return qnorm((cx, cy, cz, 1.0 + d))

def qslerp(a, b, t):
    d = sum(x*y for x, y in zip(a, b))
    if d < 0:
        b = tuple(-c for c in b); d = -d
    if d > 0.9995:
        return qnorm(tuple(a[i] + (b[i]-a[i])*t for i in range(4)))
    th = math.acos(max(-1.0, min(1.0, d)))
    s = math.sin(th)
    wa = math.sin((1-t)*th)/s; wb = math.sin(t*th)/s
    return tuple(a[i]*wa + b[i]*wb for i in range(4))

def smooth(u):
    u = max(0.0, min(1.0, u))
    return u*u*(3-2*u)

# ---------------------------------------------------------------- skeleton
class Rig:
    def __init__(self, ledger):
        self.order = ledger["skins"][0]["joints"]
        nodes = {n["name"]: n for n in ledger["nodes"]}
        self.rest = {}
        self.parent = {}
        self.children = {}
        name_of = {n["i"]: n["name"] for n in ledger["nodes"]}
        for name in self.order:
            n = nodes[name]
            self.rest[name] = (tuple(n["t"]), tuple(n["r"]))
            self.children[name] = [name_of[c] for c in (n["children"] or [])]
        for name, ch in self.children.items():
            for c in ch:
                self.parent[c] = name
        self.root_parent_t = nodes["CharRig"]["t"]

    def fk(self, deltas, root_t=(0.0, 0.0, 0.0)):
        """返回 {bone: (world_pos, world_quat)}。root_t 是 root 骨的世界平移增量。

        骨的世界旋转 = 父世界旋转 * rest 局部旋转 * delta；
        骨的位置 = 父位置 + 父世界旋转 * 本骨 rest 平移（平移在父的旋转之后，K73）。
        """
        out = {}
        def walk(name, pq, ppos):
            t, r = self.rest[name]
            q = qnorm(qmul(pq, qmul(r, deltas.get(name, (0, 0, 0, 1)))))
            pos = tuple(ppos[i] + qrot(pq, t)[i] for i in range(3))
            out[name] = (pos, q)
            for c in self.children.get(name, []):
                walk(c, q, pos)
        q_root = qnorm(qmul(self.rest["root"][1], deltas.get("root", (0, 0, 0, 1))))
        start = (root_t[0], root_t[1] + self.rest["root"][0][1], root_t[2])
        out["root"] = (start, q_root)
        for c in self.children.get("root", []):
            walk(c, q_root, start)
        return out

def bone_axis_world(pose, name):
    """骨的局部 +Y 在世界里的方向。"""
    _, q = pose[name]
    return qrot(q, (0.0, 1.0, 0.0))

def aim(parent_pose_q, rest_local_q, world_dir, twist=0.0):
    """求某个骨"局部 +Y 指向 world_dir"所需的 delta 四元数。

    parent_pose_q 是父骨当前世界旋转；rest_local_q 是本骨 rest 局部旋转。
    骨的世界旋转 = parent_pose_q * rest_local_q * delta，
    所以 delta = (parent_pose_q*rest_local_q)^-1 * R_world，其中 R_world 把 +Y 转到 world_dir。
    骨轴方向与"骨的自由扭转"解耦：这里只约束骨轴，扭转交给 twist 显式给定。
    """
    q0 = qnorm(qmul(parent_pose_q, rest_local_q))
    qa = qfrom_to((0.0, 1.0, 0.0), world_dir)
    if twist:
        qa = qmul(qa, (0, 0, 0, 1))
    return qnorm(qmul(qconj(q0), qa))

# ---------------------------------------------------------------- clips
def clip_idle(rig, n=48):
    keys = []
    for f in range(n):
        u = f/(n-1)
        br = math.sin(2*math.pi*u)              # 呼吸
        sway = math.sin(2*math.pi*u + 0.7)
        d = {
            "spine": qaxis((1, 0, 0), math.radians(1.6)*br),
            "chest": qaxis((1, 0, 0), math.radians(2.2)*br),
            "head": qaxis((0, 0, 1), math.radians(2.0)*sway),
            "arm_l": qaxis((0, 0, 1), math.radians(2.4)*sway),
            "arm_r": qaxis((0, 0, 1), math.radians(-2.4)*sway),
            "hand_l": qaxis((1, 0, 0), math.radians(3.0)*br),
            "hand_r": qaxis((1, 0, 0), math.radians(-3.0)*br),
        }
        keys.append({"f": f, "q": {k: [round(c, 6) for c in v] for k, v in d.items()},
                     "t": [0.0, round(0.004*br, 5), 0.0]})
    return {"frames": n, "loop": True, "keys": keys}

def clip_wave(rig, n=48):
    keys = []
    # 目标：右臂抬到肩上方、前臂再折起，手腕画一个弧
    for f in range(n):
        u = f/(n-1)
        lift = smooth(min(1.0, u/0.35))
        drop = 1.0 - smooth(max(0.0, (u-0.75)/0.25))
        amt = lift*drop
        pose = rig.fk({})
        sh_q = pose["arm_r"][1]
        up = (0.72, 0.62, 0.30)
        d_arm = aim(sh_q, rig.rest["arm_r"][1], up)
        # 前臂：抬起来之后朝上，再叠一个 ±18° 的挥手摇摆
        el_q = qnorm(qmul(sh_q, qmul(rig.rest["arm_r"][1], d_arm)))
        wave = math.sin(2*math.pi*3.0*u)
        fore = (0.42 - 0.30*wave*amt, 0.86, 0.26)
        d_fore = aim(el_q, rig.rest["forearm_r"][1], fore)
        damp = lambda q: qslerp((0, 0, 0, 1), q, amt)
        d = {
            "arm_r": [round(c, 6) for c in damp(d_arm)],
            "forearm_r": [round(c, 6) for c in damp(d_fore)],
            "hand_r": [round(c, 6) for c in damp(qaxis((0, 1, 0), math.radians(28)*wave))],
            "chest": [round(c, 6) for c in qaxis((0, 1, 0), math.radians(-4.0)*amt)],
            "head": [round(c, 6) for c in qaxis((0, 0, 1), math.radians(-3.0)*amt)],
            "arm_l": [round(c, 6) for c in qaxis((0, 0, 1), math.radians(3.0)*amt)],
        }
        bob = 0.012*smooth(min(1.0, u/0.3))*drop
        keys.append({"f": f, "q": d, "t": [0.0, round(bob, 5), 0.0]})
    return {"frames": n, "loop": False, "keys": keys}

def clip_turn(rig, n=60):
    keys = []
    for f in range(n):
        u = f/(n-1)
        a = 2*math.pi*smooth(u)
        d = {
            "root": [round(c, 6) for c in qaxis((0, 1, 0), a)],
            "chest": [round(c, 6) for c in qaxis((0, 1, 0), math.radians(-6.0)*math.sin(math.pi*u))],
            "head": [round(c, 6) for c in qaxis((0, 1, 0), math.radians(10.0)*math.sin(math.pi*u))],
        }
        keys.append({"f": f, "q": d, "t": [0.0, round(0.01*math.sin(math.pi*u), 5), 0.0]})
    return {"frames": n, "loop": False, "keys": keys}

def clip_walk(rig, n=36):
    """原地走的"真走法"：脚在世界里站住，身体前进。

    这条腿在 rest 姿势下几乎伸直（髋到踝 0.4003 就是两节骨长之和），所以
    **必须先屈膝降低骨盆**，否则任何步幅都会超出可达半径，IK 被夹住，脚就滑。
    这是这个角色走路唯一真正的物理约束（K94）。

    做法：两骨 IK 把踝关节解到目标点（支撑脚相对 root 后退、摆动脚前移），
    root 每帧前进一个步速，支撑脚在世界里就静止；脚掌用一次"世界朝向对齐"
    抹平胫骨的倾斜，否则鞋底会跟着小腿翘起来。
    """
    th = rig.rest["thigh_r"][0]; sh = rig.rest["shin_r"][0]; ft = rig.rest["foot_r"][0]
    L2 = math.sqrt(sum(c*c for c in sh))     # 髋 -> 膝
    L3 = math.sqrt(sum(c*c for c in ft))     # 膝 -> 踝
    hip_y = rig.rest["root"][0][1] + th[1]
    ankle_y = hip_y - (L2 + L3)
    step = 0.10                               # 踝前后幅度（受可达半径限制，见上）
    lift = 0.05
    drop = -0.025                             # 屈膝：骨盆下沉 2.5% 身高
    speed = 2.0*step/(n/2)
    rest_pose = rig.fk({})
    rest_foot_world = {s: rest_pose["foot_"+s][1] for s in ("l", "r")}
    keys = []
    for f in range(n):
        u = f/n
        body = drop + 0.012*math.sin(4*math.pi*u)   # 每步一沉
        # root 不偏航：腿的 IK 是在矢状面里解的，让 root 转 3° 会把髋与目标点错开
        # 0.09·sin3°≈0.0047，正好变成"支撑脚滑一下"（K96）。上半身的活气交给胸腔与头。
        sway = math.radians(2.5)*math.sin(2*math.pi*u)
        d = {"chest": [round(c, 6) for c in qaxis((0, 1, 0), sway)],
             "head": [round(c, 6) for c in qmul(qaxis((0, 1, 0), -0.6*sway),
                                                 qaxis((1, 0, 0), math.radians(1.5)*math.sin(4*math.pi*u)))],
             "arm_l": [round(c, 6) for c in qaxis((1, 0, 0), math.radians(9.0)*math.sin(2*math.pi*u + math.pi))],
             "arm_r": [round(c, 6) for c in qaxis((1, 0, 0), math.radians(9.0)*math.sin(2*math.pi*u))]}
        q_root = rig.rest["root"][1]
        for side, phase in (("l", 0.0), ("r", 0.5)):
            uu = (u + phase) % 1.0
            if uu < 0.5:   # 支撑：脚相对 root 从 +step 退到 -step，不抬
                t = uu/0.5
                tz = step - 2*step*t
                ty = 0.0
            else:          # 摆动：抬起，从 -step 回到 +step
                t = (uu-0.5)/0.5
                tz = -step + 2*step*smooth(t)
                ty = lift*math.sin(math.pi*t)
            hx = 0.09 if side == "l" else -0.09
            hip = (hx, hip_y + body, 0.0)
            target = (hx, ankle_y + ty, tz)
            knee, ankle = two_bone_ik(hip, target, L2, L3, (0.0, 0.0, 1.0))
            thigh, shin, foot = "thigh_"+side, "shin_"+side, "foot_"+side
            d[thigh] = [round(c, 6) for c in aim(q_root, rig.rest[thigh][1], norm3(sub(knee, hip)))]
            q_thigh = qnorm(qmul(q_root, qmul(rig.rest[thigh][1], tuple(d[thigh]))))
            d[shin] = [round(c, 6) for c in aim(q_thigh, rig.rest[shin][1], norm3(sub(ankle, knee)))]
            q_shin = qnorm(qmul(q_thigh, qmul(rig.rest[shin][1], tuple(d[shin]))))
            # 脚掌：世界朝向钉在 rest 的世界朝向上（只跟 root 的偏航一起转），鞋底不翘
            want = rest_foot_world[side]
            d[foot] = [round(c, 6) for c in qnorm(qmul(qconj(qmul(q_shin, rig.rest[foot][1])), want))]
        keys.append({"f": f, "q": d, "t": [0.0, round(body, 5), round(speed*f, 5)]})
    return {"frames": n, "loop": True, "keys": keys}

def sub(a, b): return tuple(x-y for x, y in zip(a, b))
def norm3(v):
    n = math.sqrt(sum(c*c for c in v)) or 1.0
    return tuple(c/n for c in v)

def two_bone_ik(hip, ankle, l1, l2, bend_hint):
    """两骨 IK：返回 (膝, 踝)，在由 hip->ankle 与 bend_hint 张成的平面内。"""
    v = sub(ankle, hip)
    dist = max(1e-6, min(math.sqrt(sum(c*c for c in v)), (l1+l2)*0.999))
    dvec = norm3(v)
    # 余弦定理：髋角
    ca = (l1*l1 + dist*dist - l2*l2)/(2*l1*dist)
    ca = max(-1.0, min(1.0, ca))
    ang = math.acos(ca)
    # 平面法线 u = hint × dvec；曲面内垂直于 dvec 的弯曲方向 = dvec × u。
    # 先前的实现在这里用了法线本身当弯曲方向，于是膝盖会朝身体两侧弯（K95）。
    u = (bend_hint[1]*dvec[2]-bend_hint[2]*dvec[1],
         bend_hint[2]*dvec[0]-bend_hint[0]*dvec[2],
         bend_hint[0]*dvec[1]-bend_hint[1]*dvec[0])
    if math.sqrt(sum(c*c for c in u)) < 1e-6:
        u = (1.0, 0.0, 0.0)
    u = norm3(u)
    n = norm3((dvec[1]*u[2]-dvec[2]*u[1],
               dvec[2]*u[0]-dvec[0]*u[2],
               dvec[0]*u[1]-dvec[1]*u[0]))
    knee = tuple(hip[i] + l1*(math.cos(ang)*dvec[i] + math.sin(ang)*n[i]) for i in range(3))
    return knee, ankle

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--ledger", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    ledger = json.load(open(a.ledger))
    rig = Rig(ledger)
    clips = {
        "idle": clip_idle(rig),
        "wave": clip_wave(rig),
        "turn": clip_turn(rig),
        "walk": clip_walk(rig),
    }
    # planted：这一段的脚在支撑期应当钉在地上（转台转的是整个人，脚跟着转，不算滑）
    for _n, _c in clips.items():
        _c["planted"] = _n in ("walk",)
    # loop 片段补一帧 "第 n 帧" = 第 0 帧的姿态：播放时用 frame % n，取不到这一帧，
    # 但门禁要拿它证明"循环接得上"（walk 还有 root 前进量，所以 t 继续走一步）
    for _n, _c in clips.items():
        if not _c.get("loop"):
            continue
        _k0 = _c["keys"][0]
        _kl = _c["keys"][-1]
        _step = (tuple(_kl["t"][i] - _k0["t"][i] for i in range(3))
                 if _n != "walk" else (0.0, 0.0, _kl["t"][2] - _k0["t"][2]))
        _c["keys"].append({"f": _c["frames"], "q": _k0["q"],
                           "t": [round(_kl["t"][i] + (_step[i] if _n != "walk" else 0.0), 5) for i in range(3)]})
    doc = {
        "height": 1.024,
        "fps": 30,
        "bones": rig.order,
        "convention": "bone.quaternion = restQuat * delta ; t = root world offset",
        "clips": clips,
    }
    json.dump(doc, open(a.out, "w"), separators=(",", ":"))
    # 自检：rest FK 的脚/手位置必须落在网格里
    pose = rig.fk({})
    for b in ("foot_l", "foot_r", "hand_l", "hand_r", "head"):
        print(b, [round(c, 4) for c in pose[b][0]])
    print("clips", {k: v["frames"] for k, v in clips.items()})
    return 0

if __name__ == "__main__":
    sys.exit(main())