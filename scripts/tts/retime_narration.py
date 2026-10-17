#!/usr/bin/env python3
"""Re-time narration against the lecture's scene budget and build the narration track.

Measuring beats guessing: each synthesized clip reports its real length, and this
script distributes that length across the scene it belongs to. Scenes grow when the
speech no longer fits, then both the SCENES durations and the LINES offsets in
src/lecture/script.ts are rewritten so picture, subtitles and voice stay in sync.

Usage:
  python3 scripts/tts/retime_narration.py --voice-json data/voice.json
"""
import argparse
import json
import pathlib
import re
import subprocess
import tempfile

import numpy as np
import soundfile as sf

SCENE_RE = re.compile(r'\{ id: "([a-z_]+)", dur: ([0-9.]+),')
LINES_RE = re.compile(r"export const LINES[^=]*=\s*\[.*?\n\];", re.S)


def scene_durations(script: str):
    return [(m.group(1), float(m.group(2))) for m in SCENE_RE.finditer(script)]


def load_audio(path: str, target_sr: int) -> np.ndarray:
    data, sr = sf.read(path, dtype="float32")
    if data.ndim > 1:
        data = data.mean(axis=1)
    if sr == target_sr:
        return data
    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
        raw = tmp.name
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", path, "-ar", str(target_sr), "-ac", "1", raw], check=True)
    data, _ = sf.read(raw, dtype="float32")
    return data


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", default="src/lecture/script.ts")
    ap.add_argument("--voice-json", default="data/voice.json")
    ap.add_argument("--out", default="public/voice/narration.wav")
    ap.add_argument("--sample-rate", type=int, default=48000)
    ap.add_argument("--fps", type=int, default=30)
    ap.add_argument("--lead", type=float, default=0.55, help="silence before the first sentence of a scene")
    ap.add_argument("--tail", type=float, default=0.35, help="silence after the last sentence of a scene")
    ap.add_argument("--min-gap", type=float, default=0.30)
    ap.add_argument("--max-gap", type=float, default=1.20)
    ap.add_argument("--peak", type=float, default=0.72, help="peak normalisation target (linear)")
    a = ap.parse_args()

    script_path = pathlib.Path(a.script)
    script = script_path.read_text(encoding="utf-8")
    clips = json.loads(pathlib.Path(a.voice_json).read_text(encoding="utf-8"))
    if not clips:
        return print("no clips in %s" % a.voice_json) or 1

    scenes = scene_durations(script)
    # Narration offsets were authored against the *original* scene durations, so the
    # grouping must use those boundaries, not the newly computed ones.
    groups = {sid: [] for sid, _ in scenes}
    bounds, cursor = [], 0.0
    for sid, dur in scenes:
        bounds.append((sid, cursor, cursor + dur))
        cursor += dur
    for clip in clips:
        hit = next((sid for sid, lo, hi in bounds if lo - 0.05 <= clip["start"] < hi - 0.05), None)
        if hit is None:
            return print("clip at %.2fs falls outside every scene" % clip["start"]) or 1
        groups[hit].append(clip)

    durations, cursor = {}, 0.0
    for sid, dur in scenes:
        group = groups[sid]
        speech = sum(c["len"] for c in group)
        gaps = max(0, len(group) - 1)
        need = a.lead + a.tail + speech + gaps * a.min_gap
        fixed = max(dur, need)
        if fixed > dur:
            print("grow scene %s: %.2fs -> %.2fs" % (sid, dur, fixed))
        durations[sid] = round(fixed, 2)

    starts, cursor = {}, 0.0
    for sid, _ in scenes:
        starts[sid] = cursor
        cursor += durations[sid]
    total = cursor

    for sid, dur in scenes:
        group = groups[sid]
        if not group:
            continue
        span = durations[sid]
        speech = sum(c["len"] for c in group)
        gaps = max(0, len(group) - 1)
        gap = (span - a.lead - a.tail - speech) / gaps if gaps else 0.0
        gap = max(a.min_gap, min(a.max_gap, gap))
        t = starts[sid] + a.lead
        for clip in group:
            clip["t0"] = round(t, 3)
            t += clip["len"] + gap
        if group[-1]["t0"] + group[-1]["len"] > starts[sid] + span:
            print("WARN %s: speech overruns its scene by %.2fs" % (sid, group[-1]["t0"] + group[-1]["len"] - starts[sid] - span))

    sr = a.sample_rate
    buf = np.zeros(int(round(total * sr)) + sr, dtype=np.float32)
    for clip in clips:
        data = load_audio(clip["file"], sr)
        i0 = int(round(clip["t0"] * sr))
        buf[i0 : i0 + len(data)] += data
    peak = float(np.abs(buf).max()) or 1.0
    buf = buf / peak * a.peak
    out = pathlib.Path(a.out)
    out.parent.mkdir(parents=True, exist_ok=True)
    sf.write(str(out), buf[: int(round(total * sr))], sr, subtype="PCM_16")

    for sid, dur in scenes:
        script = re.sub(r'(\{ id: "%s", dur: )([0-9.]+)' % sid, lambda m: m.group(1) + str(durations[sid]), script)
    body = ["export const LINES: Line[] = ["]
    for sid, _ in scenes:
        if not groups[sid]:
            continue
        body.append("")
        for clip in groups[sid]:
            body.append('  { start: %.2f, dur: %.2f, speech: "%s" },' % (clip["t0"], clip["len"], clip["speech"]))
    body.append("];")
    script = LINES_RE.sub("\n".join(body), script, count=1)
    script_path.write_text(script, encoding="utf-8")
    pathlib.Path(a.voice_json).write_text(json.dumps(clips, ensure_ascii=False, indent=1), encoding="utf-8")

    print("total %.2fs (%d frames @ %d fps), peak gain %.3f" % (total, int(round(total * a.fps)), a.fps, peak))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
