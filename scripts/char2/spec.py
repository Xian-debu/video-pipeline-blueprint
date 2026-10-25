#!/usr/bin/env python3
"""片子的规格书（spec）：把"这次要做什么、用什么资产、按什么判据"写成一份可对账的 JSON。

为什么需要这一层：渲染端（TS）只该读数字，不该猜数字。参考图的哈希、模型的哈希、
骨骼数、四段动作的帧数、五种颜色、肚皮斑块的几何参数、门禁阈值，全部来自这里的
一份 spec；任何一个源文件被换掉，--verify 都会报出来。

    python3 scripts/char2/spec.py --write        # 生成 data/char2/spec.json
    python3 scripts/char2/spec.py --verify       # 对账（make 的第 3.x 阶段跑它）

--verify 检查的是"一致性"，不是"好看"：文件哈希、顶点/三角/骨数、动作帧数、
门禁是否通过、阈值是否被偷偷放宽。返回非零 = 有人改了源却没重跑。
"""
import argparse, hashlib, json, os, sys

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
P = lambda *a: os.path.join(ROOT, *a)


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for chunk in iter(lambda: f.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def build():
    params = json.load(open(P("data/char/params.json")))
    ledger = json.load(open(P("data/char2/model.ledger.json")))
    anim = json.load(open(P("data/char2/anim.json")))
    gate = json.load(open(P("data/char2/gate_anim.json")))
    ref = P("public/char/reference.png")
    with open(ref, "rb") as f:
        head = f.read(33)
    # PNG 头：宽高在第 16..24 字节
    w = int.from_bytes(head[16:20], "big"); h = int.from_bytes(head[20:24], "big")
    return {
        "id": "char2",
        "subject": "SwiftYellow —— 黄色梨形吉祥物（与第七部同一角色，换一条管线重做）",
        "reference": {
            "path": "public/char/reference.png",
            "sha256": sha256(ref),
            "size": [w, h],
            "note": "任务书点名的是 E:\\Strata-data\\models\\swift-IQ2_XS\\视图.png；与仓库里这张解码后逐像素相同",
        },
        "model": {
            "glb": "public/models/swift_v25.glb",
            "sha256": ledger["sha256"],
            "bytes": ledger["bytes"],
            "verts": ledger["verts"],
            "tris": ledger["tris"],
            "bones": len(ledger["skins"][0]["joints"]),
            "boneOrder": ledger["skins"][0]["joints"],
            "primitives": [p["material"] for p in ledger["primitives"]],
            "authoredBy": "scripts/char/gen.py（Blender 5.2.2，本次只当离线资产作者，不参与成片渲染）",
        },
        "clips": {
            "fps": anim["fps"],
            "list": {k: {"frames": v["frames"], "loop": bool(v.get("loop")), "planted": bool(v.get("planted"))}
                     for k, v in anim["clips"].items()},
        },
        "palette": {
            "yellow": params["col_yellow"],
            "cream": params["col_cream"],
            "tan": params["col_tan"],
            "grey": params["col_grey"],
            "eye": params["col_eye"],
            "variants": params["col_variants"],
        },
        "patch": {"t": params["patch"]["t"], "rx": params["patch"]["rx"], "rz": params["patch"]["rz"],
                  "how": "rest-space position 上的解析遮罩（不是贴图，也不是几何贴片；K88 的解法）"},
        "gates": {
            "anim": gate["thresholds"],
            "animPass": gate["ok"],
            "silhouette": {"iou": {"front": 0.850, "side": 0.820, "back": 0.860},
                           "aspectErr": 0.030, "rmse": 0.025, "deltaE": 6.0},
            "motion": {"motionRate": 0.80, "cameraMoves": 6, "breathing": 2, "maxSceneSeconds": 60},
        },
        "pipeline": {
            "render": "three.js 实时（@remotion/three，逐帧确定性，dpr=1）",
            "asset": "Blender 离线生成 GLB（可复现：脚本 + 参数 + 哈希）",
            "voice": "IndexTTS-2（gen24；实测时长决定时间轴）",
        },
    }


def verify(spec):
    fails = []
    def need(cond, msg):
        if not cond:
            fails.append(msg)
    need(sha256(P(spec["reference"]["path"])) == spec["reference"]["sha256"], "参考图被换了，spec 没更新")
    need(sha256(P(spec["model"]["glb"])) == spec["model"]["sha256"], "glb 被换了，spec 没更新")
    ledger = json.load(open(P("data/char2/model.ledger.json")))
    need(ledger["sha256"] == spec["model"]["sha256"], "ledger 与 spec 的 glb 哈希不一致（账本过期）")
    need(ledger["verts"] == spec["model"]["verts"] and ledger["tris"] == spec["model"]["tris"], "顶点/三角数与账本不一致")
    need(ledger["skins"][0]["joints"] == spec["model"]["boneOrder"], "骨序与账本不一致")
    anim = json.load(open(P("data/char2/anim.json")))
    for k, v in spec["clips"]["list"].items():
        need(k in anim["clips"] and anim["clips"][k]["frames"] == v["frames"], "动作 %s 帧数与 spec 不一致" % k)
    gate = json.load(open(P("data/char2/gate_anim.json")))
    need(gate["ok"] == spec["gates"]["animPass"], "动作门禁状态与 spec 不一致（重跑 gate_anim.py）")
    need(gate["thresholds"] == spec["gates"]["anim"], "门禁阈值被改宽或改窄，spec 没同步")
    need(spec["gates"]["animPass"], "动作门禁没有通过")
    return fails


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--write", action="store_true")
    ap.add_argument("--verify", action="store_true")
    a = ap.parse_args()
    if a.write:
        spec = build()
        json.dump(spec, open(P("data/char2/spec.json"), "w"), indent=1, ensure_ascii=False)
        print("SPEC written data/char2/spec.json  keys=%d" % len(spec))
        return 0
    spec = json.load(open(P("data/char2/spec.json")))
    fails = verify(spec)
    if fails:
        print("SPEC FAIL")
        for f in fails:
            print(" -", f)
        return 1
    print("SPEC OK ref=%s model=%s verts=%d tris=%d bones=%d clips=%s" % (
        spec["reference"]["sha256"][:8], spec["model"]["sha256"][:8], spec["model"]["verts"],
        spec["model"]["tris"], spec["model"]["bones"], list(spec["clips"]["list"])))
    return 0


if __name__ == "__main__":
    sys.exit(main())
