#!/usr/bin/env python3
"""Synthesize the Hawk film's narration, one wav per script line.

Input is the JSON dumped from the film script by scripts/qa/dump_script.mjs, so
the text spoken is literally the caption text (no second copy to drift).

Clips are keyed by a hash of the spoken text: editing one line re-synthesizes
that line only, and an unchanged line keeps its measured duration. Writes:

  public/voice/hawk/<idx>_<hash>.wav   one clip per line
  data/hawk/clips.json                 key -> {file, hash}
  data/hawk/voice.json                 key -> measured clip length in seconds

The film script reads voice.json and lays its scenes out from real speech.

Usage (inside the TTS venv, from the package root):
  python3 scripts/tts/synthesize_hawk.py \
    --indextts /opt/aigen/video2/pkg/index-tts \
    --model-dir /opt/aigen/video2/shared/models/IndexTTS-2 \
    --ref-audio /opt/aigen/video2/pkg/index-tts/examples/voice_03.wav [--limit 2]
"""
import argparse
import hashlib
import json
import os
import pathlib
import sys
import time


def read_json(path, default):
    p = pathlib.Path(path)
    if not p.exists():
        return default
    try:
        return json.loads(p.read_text(encoding="utf-8"))
    except json.JSONDecodeError:
        return default


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines", default="data/hawk/lines.json")
    ap.add_argument("--out", default="public/voice/hawk")
    ap.add_argument("--voice-json", default="data/hawk/voice.json")
    ap.add_argument("--clips-json", default="data/hawk/clips.json")
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

    voice = read_json(a.voice_json, {})
    clips = read_json(a.clips_json, {})

    total = 0.0
    fresh = 0
    for i, line in enumerate(lines):
        key = "%s#%d" % (line["scene"], line["index"])
        text = line["speech"]
        digest = hashlib.sha1(text.encode("utf-8")).hexdigest()[:8]
        name = "l%03d_%s.wav" % (i, digest)
        path = out_dir / name
        prev = clips.get(key) or {}
        reuse = (
            prev.get("hash") == digest
            and path.exists()
            and (out_dir / prev.get("file", "")).exists()
            and float(prev.get("bytes", 0)) > 1000
        )
        if not reuse:
            t1 = time.time()
            tts.infer(spk_audio_prompt=a.ref_audio, text=text, output_path=str(path), verbose=False)
            fresh += 1
            print("tts %d in %.1fs  %s" % (i, time.time() - t1, text[:24]), flush=True)
        info = sf.info(str(path))
        length = info.frames / float(info.samplerate)
        voice[key] = round(length, 3)
        clips[key] = {"file": name, "hash": digest, "bytes": path.stat().st_size, "chars": len(text)}
        total += length
        # 边合成边落盘：中途打断也不用从头再来。
        if i % 3 == 0 or i == len(lines) - 1:
            pathlib.Path(a.voice_json).write_text(
                json.dumps(voice, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
            pathlib.Path(a.clips_json).write_text(
                json.dumps(clips, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")

    pathlib.Path(a.voice_json).write_text(json.dumps(voice, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    pathlib.Path(a.clips_json).write_text(json.dumps(clips, ensure_ascii=False, indent=1, sort_keys=True) + "\n", encoding="utf-8")
    print("wrote %s (clips=%d, fresh=%d, %.1fs of speech)" % (a.voice_json, len(clips), fresh, total))
    return 0


if __name__ == "__main__":
    sys.exit(main())
