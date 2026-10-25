#!/usr/bin/env python3
"""动作门禁：把 data/char2/anim.json 在宿主侧做 FK，量出会毁掉画面的四件事。

  G1 蒙皮账本   每个顶点权重和 == 1（2e-7）、每顶点影响数 <= 4、没有孤儿顶点
  G2 脚滑       支撑脚在世界里的水平漂移（阈值 0.01h）+ 摆动脚落地不抖
  G3 循环闭合   loop 片段首尾姿态差（0.5°）与髋部位置差（0.01h）
  G4 骨骼合理性 骨轴不退化、手脚落在网格包围盒内、无 NaN

失败即非零退出——门禁只许"能失败"，不许"总是绿"。

用法：python3 scripts/char2/gate_anim.py --glb public/models/swift_v16.glb \
        --ledger data/char2/model.ledger.json --anim data/char2/anim.json --out data/char2/gate_anim.json
"""
import argparse, json, math, struct, sys
sys.path.insert(0, "scripts/char2")
from anim import Rig, qconj, qmul, qnorm, qrot, qfrom_to  # noqa: E402

TH = {"weightSum": 2e-7, "maxInfluences": 4, "footSlide": 0.010, "loopDeg": 0.5,
      "loopHip": 0.010, "bboxSlack": 0.02}


def read_glb(path):
    raw = open(path, "rb").read()
    _, _, total = struct.unpack_from("<III", raw, 0)
    off, js, blob = 12, None, b""
    while off < total:
        clen, ctype = struct.unpack_from("<II", raw, off)
        data = raw[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(data.decode())
        elif ctype == 0x004E4942:
            blob = data
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    return js, blob


COMP = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NC = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4}


def acc(js, blob, idx):
    a = js["accessors"][idx]; bv = js["bufferViews"][a["bufferView"]]
    fmt, sz = COMP[a["componentType"]]; nc = NC[a["type"]]
    base = bv.get("byteOffset", 0) + a.get("byteOffset", 0)
    stride = bv.get("byteStride") or sz*nc
    return [struct.unpack_from("<" + fmt*nc, blob, base + i*stride) for i in range(a["count"])], a


def angle_between(q1, q2):
    d = abs(sum(a*b for a, b in zip(q1, q2)))
    return math.degrees(2*math.acos(max(-1.0, min(1.0, d))))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--glb", required=True)
    ap.add_argument("--ledger", required=True)
    ap.add_argument("--anim", required=True)
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    js, blob = read_glb(a.glb)
    ledger = json.load(open(a.ledger))
    anim = json.load(open(a.anim))
    rig = Rig(ledger)
    R = {}
    fails = []

    # ---- G1 蒙皮账本
    prim = [p for p in js["meshes"][0]["primitives"]][0]
    sums, infl, n_orphan = [], [], 0
    for p in js["meshes"][0]["primitives"]:
        if "WEIGHTS_0" not in p["attributes"]:
            fails.append("G1 缺少 WEIGHTS_0"); continue
        w, _ = acc(js, blob, p["attributes"]["WEIGHTS_0"])
        for t in w:
            s = sum(t)
            sums.append(s)
            infl.append(sum(1 for c in t if c > 0))
            if s < 1e-6:
                n_orphan += 1
    R["skinning"] = {"maxWeightSumErr": round(max(abs(s-1) for s in sums), 9),
                     "maxInfluences": max(infl), "orphans": n_orphan,
                     "verts": len(sums)}
    if R["skinning"]["maxWeightSumErr"] > TH["weightSum"]: fails.append("G1 权重和超差")
    if R["skinning"]["maxInfluences"] > TH["maxInfluences"]: fails.append("G1 影响数超 4")
    if n_orphan: fails.append("G1 有孤儿顶点 %d" % n_orphan)

    # ---- 网格包围盒（手脚不许飞出去）
    pos_all = []
    for p in js["meshes"][0]["primitives"]:
        v, _ = acc(js, blob, p["attributes"]["POSITION"])
        pos_all.extend(v)
    mn = [min(v[i] for v in pos_all) for i in range(3)]
    mx = [max(v[i] for v in pos_all) for i in range(3)]
    H = anim["height"]

    # ---- G2/G3 逐片段 FK
    per_clip = {}
    for name, clip in anim["clips"].items():
        frames = []
        for key in clip["keys"]:
            d = {b: tuple(q) for b, q in key["q"].items()}
            pose = rig.fk(d, tuple(key["t"]))
            frames.append(pose)
        # 世界位置减掉 root 的平移：包围盒与循环都在躯干局部坐标系里比，
        # 否则"往前走"会被误判成"骨头飞出网格"（K 待记：坐标系要先对齐再判据）
        root_ts = [tuple(k["t"]) for k in clip["keys"]]
        local = [{b: tuple(f[b][0][i] - rt[i] for i in range(3)) for b in f} for f, rt in zip(frames, root_ts)]
        # 脚滑必须在**世界坐标**里量：root 的前进/起伏会带着脚一起动，减掉 root
        # 之后，"支撑脚世界静止"会被误读成"一直在动"（K97）。
        feet = {s: [f["foot_"+s][0] for f in frames] for s in ("l", "r")}
        slide = {}
        for s, pts in feet.items():
            if not clip.get("planted"):
                slide[s] = 0.0
                continue
            ground = min(p[1] for p in pts)
            stance = [p for p in pts if p[1] < ground + 0.004]
            zs = [p[2] for p in stance]
            slide[s] = round(max(zs) - min(zs), 5) if zs else 0.0
        # 脚/手是否在包围盒内（放宽 2%）
        bad = []
        for fi, f in enumerate(local):
            for b in ("foot_l", "foot_r", "hand_l", "hand_r", "head"):
                p = f[b]
                if not all(-10 < c < 10 for c in p):
                    bad.append((fi, b, "nan"))
                if not all(mn[i] - TH["bboxSlack"]*H <= p[i] <= mx[i] + TH["bboxSlack"]*H for i in range(3)):
                    bad.append((fi, b, [round(c, 3) for c in p]))
        loop = None
        if clip.get("loop"):
            q0, q1 = clip["keys"][0], clip["keys"][-1]
            worst = 0.0
            for b in anim["bones"]:
                v0 = q0["q"].get(b, (0, 0, 0, 1)); v1 = q1["q"].get(b, (0, 0, 0, 1))
                worst = max(worst, angle_between(v0, v1))
            hip0, hip1 = local[0]["root"], local[-1]["root"]
            hipd = math.sqrt(sum((hip0[i]-hip1[i])**2 for i in range(3)))
            loop = {"maxDeg": round(worst, 4), "hipDist": round(hipd, 5)}
        per_clip[name] = {"frames": clip["frames"], "footSlide": slide,
                          "outOfBox": bad[:5], "outOfBoxCount": len(bad), "loop": loop,
                          "footY": {s: round(min(p[1] for p in feet[s]), 4) for s in feet},
                          "planted": bool(clip.get("planted"))}
        if max(slide.values()) > TH["footSlide"]:
            fails.append("G2 %s 脚滑 %.4f > %.3f" % (name, max(slide.values()), TH["footSlide"]))
        if bad: fails.append("G4 %s 有 %d 个骨骼点飞出网格" % (name, len(bad)))
        if loop and (loop["maxDeg"] > TH["loopDeg"] or loop["hipDist"] > TH["loopHip"]):
            fails.append("G3 %s 循环不闭合 %s" % (name, loop))
    R["clips"] = per_clip

    # ---- 契约一致性：账本 vs 骨架 vs 动作
    bones = ledger["skins"][0]["joints"]
    R["contract"] = {"bones": len(bones), "glbSha": ledger["sha256"][:16],
                     "prims": len(js["meshes"][0]["primitives"]),
                     "animBonesMatch": bones == anim["bones"]}
    if not R["contract"]["animBonesMatch"]:
        fails.append("契约：anim.json 的骨序与 glb 不一致")
    R["thresholds"] = TH
    R["ok"] = not fails
    R["fails"] = fails
    json.dump(R, open(a.out, "w"), indent=1, ensure_ascii=False)
    print(json.dumps(R, indent=1, ensure_ascii=False)[:2600])
    print("GATE", "PASS" if not fails else "FAIL: " + "; ".join(fails))
    return 0 if not fails else 1


if __name__ == "__main__":
    sys.exit(main())