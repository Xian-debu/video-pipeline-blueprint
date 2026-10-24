#!/usr/bin/env python3
"""把渲染账本裁成可以进 git 的清单。

public/plates/char/report.json 是 Blender 那一次跑出来的完整账（含每一张贴片的
sha256 与耗时，几十 KB，产出目录不进 git）；影片要的只是「有哪些贴片、多少个、
多大、多少顶点、几根骨头」。这份清单写进 data/char/plates.json，跟模型参数一起提交，
于是：typecheck / 门禁 / 组件的数字校验在没有贴片机器的干净克隆里也能跑，
只有真正渲染时才需要 public/plates/char/*.png。

骨头的坐标来自 scripts/char/bones.py（唯一来源），导成 data/char/bones.json 供
骨架场画示意图。

用法：
  python3 scripts/char/manifest.py --report public/plates/char/report.json --out data/char
"""
import argparse
import json
import os
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)

from bones import BONES  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--report", default="public/plates/char/report.json")
    ap.add_argument("--out", default="data/char")
    ap.add_argument("--params", default="data/char/params.json")
    a = ap.parse_args()

    rep = json.load(open(a.report))
    frames = rep["frames"]
    if not frames:
        raise SystemExit("report has no frames: " + a.report)

    jobs = {}
    for f in frames:
        jobs[f["job"]] = jobs.get(f["job"], 0) + 1

    plates = {
        "source": a.report,
        "res": rep["res"],
        "samples": rep["samples"],
        # 参数表的完整内容（不只是路径）：影片要读 version / segs / build_steps 这些值
        "params": json.load(open(a.params)),
        "params_sha256": rep["params_sha256"],
        "parts": rep["parts"],
        "bones": rep["bones"],
        "glb": rep.get("glb"),
        "seconds": rep["seconds"],
        "count": len(frames),
        "jobs": jobs,
        "plates": [
            {"name": f["name"], "job": f["job"],
             "seconds": None if f.get("seconds") is None else round(f["seconds"], 2),
             "sha256": f["sha256"]}
            for f in frames
        ],
    }
    os.makedirs(a.out, exist_ok=True)
    with open(os.path.join(a.out, "plates.json"), "w") as fh:
        json.dump(plates, fh, indent=1, ensure_ascii=False)

    bone_rows = [
        {"name": n, "head": list(h), "tail": list(t), "parent": p} for n, h, t, p in BONES
    ]
    with open(os.path.join(a.out, "bones.json"), "w") as fh:
        json.dump({"unit": "model (figure height = 1, z up)", "bones": bone_rows}, fh, indent=1, ensure_ascii=False)

    secs = [f["seconds"] for f in frames if f.get("seconds") is not None] or [0.0]
    print("MANIFEST", json.dumps({
        "plates": len(frames), "jobs": jobs, "bones": len(BONES),
        "verts": rep["parts"]["verts"], "faces": rep["parts"]["faces"],
        "median_seconds": round(sorted(secs)[len(secs) // 2], 2),
        "total_minutes": round(rep["seconds"] / 60, 1),
    }, ensure_ascii=False))


if __name__ == "__main__":
    main()
