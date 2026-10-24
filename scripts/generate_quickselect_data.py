#!/usr/bin/env python3
"""Generate every number the Quickselect film shows.

One C++ benchmark (scripts/quickselect/bench.cpp) is the single source of truth; this script
compiles it with a fixed command line, runs each mode, and writes deterministic JSON into
data/quickselect/. Nothing here is authored by hand — if a number is on screen, it is in one of
these files, and the file is not committed (docs/39 §4).

Determinism: the benchmark's RNG and shuffle are its own, so counts/traces/degradation/bfprt are
byte-stable across runs on one machine (A9). timing.json is measured with the clock and therefore
is only stable in shape, not bytes; that is stated in its meta block.

    python3 scripts/generate_quickselect_data.py
"""
import json
import os
import subprocess
import sys
import tempfile

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SRC = os.path.join(ROOT, "scripts", "quickselect", "bench.cpp")
OUT = os.path.join(ROOT, "data", "quickselect")
CXX = os.environ.get("CXX", "g++")
CXXFLAGS = ["-O2", "-std=c++17"]

MODES = ["counts", "timing", "trace", "degradation", "bfprt"]


def build(exe):
    cmd = [CXX, *CXXFLAGS, "-o", exe, SRC]
    print("build:", " ".join(cmd))
    subprocess.run(cmd, check=True)


def run(exe, mode):
    print("run:", mode)
    res = subprocess.run([exe, mode], check=True, capture_output=True, text=True)
    if res.stderr.strip():
        for line in res.stderr.strip().splitlines()[:8]:
            print("  " + line)
    return json.loads(res.stdout)


def dump(path, obj):
    text = json.dumps(obj, ensure_ascii=False, indent=1, sort_keys=True) + "\n"
    tmp = path + ".tmp"
    with open(tmp, "w", encoding="utf-8") as fh:
        fh.write(text)
    os.replace(tmp, path)
    print("wrote", os.path.relpath(path, ROOT), str(len(text)), "B")


def main():
    os.makedirs(OUT, exist_ok=True)
    with tempfile.TemporaryDirectory() as tmp:
        exe = os.path.join(tmp, "qsbench")
        build(exe)
        counts = run(exe, "counts")
        timing = run(exe, "timing")
        trace = run(exe, "trace")
        degradation = run(exe, "degradation")
        bfprt = run(exe, "bfprt")

    dump(os.path.join(OUT, "bench.json"), {
        "meta": {
            "source": "scripts/quickselect/bench.cpp",
            "compile": " ".join([CXX, *CXXFLAGS]),
            "note": "deterministic: own xorshift64* + Fisher-Yates, fixed seed 20261024",
            "rows": len(counts["rows"]),
        },
        "rows": counts["rows"],
    })
    dump(os.path.join(OUT, "timing.json"), {
        "meta": {
            "source": "scripts/quickselect/bench.cpp",
            "compile": " ".join([CXX, *CXXFLAGS]),
            "note": "clock-based, median of repeats; stable in shape, not in bytes",
            "rows": len(timing["rows"]),
        },
        "rows": timing["rows"],
    })
    dump(os.path.join(OUT, "trace.json"), trace)
    dump(os.path.join(OUT, "degradation.json"), degradation)
    dump(os.path.join(OUT, "bfprt.json"), bfprt)

    bad = [r for r in counts["rows"] if not r["ok"]]
    if bad:
        print("FAIL: %d row(s) returned the wrong k-th element" % len(bad))
        for r in bad[:5]:
            print("  ", r)
        sys.exit(1)
    print("counts: %d rows, all k-th elements correct" % len(counts["rows"]))
    print("timing: %d rows" % len(timing["rows"]))


if __name__ == "__main__":
    main()
