#!/usr/bin/env python3
"""Batch-synthesize the narration track from the lecture script.

Every { start, dur, speech } line in src/lecture/script.ts becomes one wav
(public/voice/lNN.wav) plus a measured length in data/voice.json. Re-running
skips clips that already exist, so an interrupted run resumes cheaply.

Usage (inside the TTS venv):
  python3 scripts/tts/synthesize.py \
    --indextts ../pkg/index-tts \
    --model-dir ../shared/models/IndexTTS-2 \
    --ref-audio ../pkg/index-tts/examples/voice_03.wav

Smoke test a single sentence first:
  python3 scripts/tts/synthesize.py ... --limit 1
"""
import argparse
import json
import os
import pathlib
import re
import sys
import time

LINE_RE = re.compile(r'\{\s*start:\s*([0-9.]+),\s*dur:\s*([0-9.]+),\s*speech:\s*"([^"]+)"\s*\}')


def parse_lines(script_path: pathlib.Path):
    text = script_path.read_text(encoding="utf-8")
    block = re.search(r"export const LINES[^=]*=\s*\[(.*?)\n\];", text, re.S)
    body = block.group(1) if block else text
    return [
        {"start": float(m.group(1)), "dur": float(m.group(2)), "speech": m.group(3)}
        for m in LINE_RE.finditer(body)
    ]


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--script", default="src/lecture/script.ts")
    ap.add_argument("--out", default="public/voice")
    ap.add_argument("--voice-json", default="data/voice.json")
    ap.add_argument("--indextts", required=True, help="path to the index-tts checkout")
    ap.add_argument("--model-dir", required=True, help="IndexTTS-2 checkpoint directory")
    ap.add_argument("--cfg", default=None, help="defaults to <model-dir>/config.yaml")
    ap.add_argument("--ref-audio", required=True, help="speaker prompt wav (5-10 s)")
    ap.add_argument("--limit", type=int, default=0, help="only synthesize the first N lines")
    ap.add_argument("--fp16", action="store_true", help="half precision (needs ~8 GB VRAM)")
    a = ap.parse_args()

    sys.path.insert(0, os.path.abspath(a.indextts))
    from indextts.infer_v2 import IndexTTS2

    script_path = pathlib.Path(a.script)
    out_dir = pathlib.Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    lines = parse_lines(script_path)
    if a.limit:
        lines = lines[: a.limit]
    if not lines:
        return print("no narration lines found in %s" % script_path) or 1
    print("parsed %d lines" % len(lines), flush=True)

    t0 = time.time()
    tts = IndexTTS2(
        cfg_path=a.cfg or os.path.join(a.model_dir, "config.yaml"),
        model_dir=a.model_dir,
        use_fp16=a.fp16,
        use_cuda_kernel=False,
        use_deepspeed=False,
    )
    print("model loaded in %.1fs" % (time.time() - t0), flush=True)

    import soundfile as sf

    records = []
    for i, line in enumerate(lines):
        path = out_dir / ("l%02d.wav" % i)
        if path.exists() and path.stat().st_size > 1000:
            print("skip %d (exists)" % i, flush=True)
        else:
            t1 = time.time()
            tts.infer(spk_audio_prompt=a.ref_audio, text=line["speech"], output_path=str(path), verbose=False)
            print("tts %d in %.1fs" % (i, time.time() - t1), flush=True)
        info = sf.info(str(path))
        records.append({**line, "file": os.path.relpath(str(path)), "len": info.frames / float(info.samplerate)})

    pathlib.Path(a.voice_json).write_text(json.dumps(records, ensure_ascii=False, indent=1), encoding="utf-8")
    total = sum(r["len"] for r in records)
    print("wrote %s (%d clips, %.1fs of speech)" % (a.voice_json, len(records), total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
