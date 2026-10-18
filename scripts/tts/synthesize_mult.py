#!/usr/bin/env python3
"""Synthesize the multiplication film's narration, one wav per script line.

Input is the JSON dumped from the film script by scripts/qa/dump_script.mjs, so
the text spoken is literally the caption text (no second copy to drift).

It writes public/voice/mult/lNNN.wav plus data/mult/voice.json, whose keys are
"scene#index" and whose values are the *measured* clip length in seconds. The
film script reads that file and lays out its scenes from real speech.

Usage (inside the TTS venv):
  python3 scripts/tts/synthesize_mult.py \
    --indextts ../pkg/index-tts \
    --model-dir ../shared/models/IndexTTS-2 \
    --ref-audio ../pkg/index-tts/examples/voice_03.wav [--limit 1]
"""
import argparse
import json
import os
import pathlib
import sys
import time


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines", default="data/mult/lines.json")
    ap.add_argument("--out", default="public/voice/mult")
    ap.add_argument("--voice-json", default="data/mult/voice.json")
    ap.add_argument("--indextts", required=True)
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--cfg", default=None)
    ap.add_argument("--ref-audio", required=True)
    ap.add_argument("--limit", type=int, default=0, help="only synthesize the first N lines")
    ap.add_argument("--fp16", action="store_true")
    a = ap.parse_args()

    lines = json.loads(pathlib.Path(a.lines).read_text(encoding="utf-8"))["lines"]
    if a.limit:
        lines = lines[: a.limit]
    if not lines:
        return print("no lines in %s" % a.lines) or 1

    sys.path.insert(0, os.path.abspath(a.indextts))
    from indextts.infer_v2 import IndexTTS2

    out_dir = pathlib.Path(a.out)
    out_dir.mkdir(parents=True, exist_ok=True)

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

    voice = {}
    vpath = pathlib.Path(a.voice_json)
    if vpath.exists():
        try:
            voice = json.loads(vpath.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            voice = {}

    total = 0.0
    for i, line in enumerate(lines):
        key = "%s#%d" % (line["scene"], line["index"])
        path = out_dir / ("l%03d.wav" % i)
        if path.exists() and path.stat().st_size > 1000:
            print("skip %d (exists)" % i, flush=True)
        else:
            t1 = time.time()
            tts.infer(spk_audio_prompt=a.ref_audio, text=line["speech"], output_path=str(path), verbose=False)
            print("tts %d in %.1fs  %s" % (i, time.time() - t1, line["speech"][:24]), flush=True)
        info = sf.info(str(path))
        length = info.frames / float(info.samplerate)
        voice[key] = round(length, 3)
        total += length
        # 边合成边落盘：中途打断也不用从头再来。
        if i % 5 == 0 or i == len(lines) - 1:
            vpath.write_text(json.dumps(voice, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")

    vpath.write_text(json.dumps(voice, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print("wrote %s (%d clips, %.1fs of speech)" % (vpath, len(voice), total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
