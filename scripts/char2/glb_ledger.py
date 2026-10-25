#!/usr/bin/env python3
"""GLB 账本：不渲染、不 import three，只把 glb 里"有什么"写成 JSON，作为运行时的契约。

为什么需要：运行时（three）与建模（Blender）之间只有一个交换物——GLB。若运行时的假设
（有几个 primitive、骨骼叫什么、有没有顶点色/蒙皮）与文件不符，画面会错但门禁看不出来。
所以先把文件读一遍，把事实落成 data/char2/model.ledger.json，再由 gate 对账。

用法：python3 scripts/char2/glb_ledger.py public/models/swift_v16.glb --out data/char2/model.ledger.json
"""
import argparse, hashlib, json, struct, sys

COMP = {5120: ("b", 1), 5121: ("B", 1), 5122: ("h", 2), 5123: ("H", 2), 5125: ("I", 4), 5126: ("f", 4)}
NCOMP = {"SCALAR": 1, "VEC2": 2, "VEC3": 3, "VEC4": 4, "MAT4": 16}


def read_glb(path):
    raw = open(path, "rb").read()
    magic, ver, total = struct.unpack_from("<III", raw, 0)
    assert magic == 0x46546C67, "not a glb"
    off = 12
    js = None
    bin_chunk = b""
    while off < total:
        clen, ctype = struct.unpack_from("<II", raw, off)
        data = raw[off + 8: off + 8 + clen]
        if ctype == 0x4E4F534A:
            js = json.loads(data.decode("utf-8"))
        elif ctype == 0x004E4942:
            bin_chunk = data
        off += 8 + clen + ((4 - clen % 4) % 4 if clen % 4 else 0)
    return js, bin_chunk, raw


def accessor_count(js, idx):
    a = js["accessors"][idx]
    return a["count"], a["type"], a.get("componentType"), a.get("min"), a.get("max")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("glb")
    ap.add_argument("--out", required=True)
    a = ap.parse_args()
    js, blob, raw = read_glb(a.glb)
    prims = []
    for mi, mesh in enumerate(js.get("meshes", [])):
        for p in mesh["primitives"]:
            attrs = {}
            for k, v in p["attributes"].items():
                cnt, typ, ct, mn, mx = accessor_count(js, v)
                attrs[k] = {"count": cnt, "type": typ, "component": ct, "min": mn, "max": mx}
            idxc = js["accessors"][p["indices"]]["count"] if "indices" in p else None
            mat = js["materials"][p["material"]]["name"] if "material" in p else None
            base = None
            if "material" in p:
                m = js["materials"][p["material"]]
                pbr = m.get("pbrMetallicRoughness", {})
                base = [round(x, 4) for x in pbr.get("baseColorFactor", [1, 1, 1, 1])]
                base = base[:3]
            prims.append({
                "mesh": mesh.get("name", "mesh%d" % mi),
                "material": mat,
                "baseColor": base,
                "attributes": attrs,
                "indices": idxc,
                "tris": (idxc // 3) if idxc else None,
            })
    skins = []
    for s in js.get("skins", []):
        skins.append({"name": s.get("name"), "joints": [js["nodes"][j].get("name") for j in s["joints"]]})
    nodes = [{"i": i, "name": n.get("name"), "children": n.get("children"),
              "mesh": n.get("mesh"), "skin": n.get("skin"),
              "t": [round(x, 5) for x in n.get("translation", [0, 0, 0])],
              "r": [round(x, 5) for x in n.get("rotation", [0, 0, 0, 1])],
              "s": [round(x, 5) for x in n.get("scale", [1, 1, 1])]} for i, n in enumerate(js.get("nodes", []))]
    total_v = sum(p["attributes"].get("POSITION", {}).get("count", 0) for p in prims)
    total_t = sum(p["tris"] or 0 for p in prims)
    has = lambda k: any(k in p["attributes"] for p in prims)
    ledger = {
        "glb": a.glb,
        "bytes": len(raw),
        "sha256": hashlib.sha256(raw).hexdigest(),
        "generator": js.get("asset", {}).get("generator"),
        "verts": total_v,
        "tris": total_t,
        "primitives": prims,
        "skins": skins,
        "nodes": nodes,
        "has": {
            "color0": has("COLOR_0"),
            "joints": has("JOINTS_0"),
            "weights": has("WEIGHTS_0"),
            "normals": has("NORMAL"),
            "uv": has("TEXCOORD_0"),
        },
    }
    with open(a.out, "w") as f:
        json.dump(ledger, f, indent=1, sort_keys=False)
    print(json.dumps({k: ledger[k] for k in ("bytes", "verts", "tris", "has")}, indent=1))
    print("prims:", [p["material"] for p in prims])
    print("skin joints:", len(skins[0]["joints"]) if skins else 0)
    print("bones:", skins[0]["joints"] if skins else [])
    return 0


if __name__ == "__main__":
    sys.exit(main())
