#!/usr/bin/env python3
"""Lay the synthesized clips onto one narration track, at the film's own timing.

Offsets come from the dumped film script; clip files come from clips.json, so
the subtitle you see is the clip you hear, and a re-synthesized line cannot
silently drift out of sync.

  python3 scripts/tts/build_char_narration.py --lines data/char2/lines.json \
      --clips public/voice/char --out public/voice/char2_narration.wav
"""
import argparse
import json
import pathlib
import subprocess
import sys
import tempfile

import numpy as np
import soundfile as sf


def load_audio(path, target_sr):
    data, sr = sf.read(path, dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr == target_sr:
        return data
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        raw = tmp.name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(path), "-ar", str(target_sr), "-ac", "1", raw], check=True)
    data, _ = sf.read(raw, dtype="float32")
    return data


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines", default="data/char2/lines.json")
    ap.add_argument("--clips-json", default="data/char2/clips.json")
    ap.add_argument("--clips", default="public/voice/char2")
    ap.add_argument("--out", default="public/voice/char2_narration.wav")
    ap.add_argument("--sample-rate", type=int, default=48000)
    ap.add_argument("--peak", type=float, default=0.72)
    a = ap.parse_args()

    doc = json.loads(pathlib.Path(a.lines).read_text(encoding="utf-8"))
    lines = doc["lines"]
    total = doc["totalSec"]
    clips = json.loads(pathlib.Path(a.clips_json).read_text(encoding="utf-8"))
    sr = a.sample_rate
    buf = np.zeros(int(round(total * sr)) + sr, dtype=np.float32)

    missing = [l for l in lines if not clips.get("%s#%d" % (l["scene"], l["index"]), {}).get("file")]
    if missing:
        return print("missing clips for %d lines (first: %s)" % (len(missing), missing[0])) or 1

    missed = 0
    for line in lines:
        key = "%s#%d" % (line["scene"], line["index"])
        path = pathlib.Path(a.clips) / clips[key]["file"]
        data = load_audio(path, sr)
        i0 = int(round(line["start"] * sr))
        end = i0 + len(data)
        want = int(round((line["start"] + line["dur"]) * sr))
        if end > want:
            missed += 1
            print("overrun %s: %.2fs speech into %.2fs slot" % (key, len(data) / sr, line["dur"]))
        buf[i0:end] += data

    peak = float(np.abs(buf).max()) or 1.0
    buf = buf / peak * a.peak
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out), buf[: int(round(total * sr))], sr, subtype="PCM_16")
    print("wrote %s  %.2fs  %d clips  %d overruns" % (out, total, len(lines), missed))
    return 0


if __name__ == "__main__":
    sys.exit(main())
