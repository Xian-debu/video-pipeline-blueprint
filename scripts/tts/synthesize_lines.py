#!/usr/bin/env python3
"""Synthesize an arbitrary dumped line list with IndexTTS-2.

Unlike synthesize.py (which parses a literal LINES array), this reads the JSON
produced by scripts/qa/dump_script.mjs. Keys are "scene#index", so re-running
after adding a scene only synthesizes the new lines.

  python3 scripts/tts/synthesize_lines.py \
    --lines data/godson1/lines.json \
    --out-dir public/voice/godson1 \
    --voice-json data/godson1/voice.json \
    --indextts ../pkg/index-tts --model-dir ../shared/models/IndexTTS-2 \
    --ref-audio ../pkg/index-tts/examples/voice_03.wav --fp16
"""
import argparse
import json
import os
import pathlib
import sys
import time


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--lines", required=True)
    ap.add_argument("--out-dir", required=True)
    ap.add_argument("--voice-json", required=True)
    ap.add_argument("--clips-json", default=None)
    ap.add_argument("--indextts", required=True)
    ap.add_argument("--model-dir", required=True)
    ap.add_argument("--cfg", default=None)
    ap.add_argument("--ref-audio", required=True)
    ap.add_argument("--limit", type=int, default=0)
    ap.add_argument("--fp16", action="store_true")
    a = ap.parse_args()

    doc = json.loads(pathlib.Path(a.lines).read_text(encoding="utf-8"))
    lines = doc["lines"]
    if a.limit:
        lines = lines[: a.limit]
    if not lines:
        print("no lines in %s" % a.lines)
        return 1

    out_dir = pathlib.Path(a.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)
    voice_path = pathlib.Path(a.voice_json)
    voice_path.parent.mkdir(parents=True, exist_ok=True)
    clips_path = pathlib.Path(a.clips_json) if a.clips_json else voice_path.with_name("clips.json")

    sys.path.insert(0, os.path.abspath(a.indextts))
    from indextts.infer_v2 import IndexTTS2

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
    clips = {}
    for i, line in enumerate(lines):
        key = "%s#%d" % (line["scene"], line["index"])
        name = "%03d_%s_%d.wav" % (i, line["scene"], line["index"])
        path = out_dir / name
        if path.exists() and path.stat().st_size > 1000:
            print("skip %s" % key, flush=True)
        else:
            t1 = time.time()
            tts.infer(spk_audio_prompt=a.ref_audio, text=line["speech"], output_path=str(path), verbose=False)
            print("tts %s in %.1fs" % (key, time.time() - t1), flush=True)
        info = sf.info(str(path))
        seconds = info.frames / float(info.samplerate)
        voice[key] = round(seconds, 3)
        clips[key] = {"file": name, "len": round(seconds, 3)}

    voice_path.write_text(json.dumps(voice, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    clips_path.write_text(json.dumps(clips, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")
    print("wrote %s and %s (%d clips, %.1fs speech)" % (voice_path, clips_path, len(lines), sum(voice.values())))
    return 0


if __name__ == "__main__":
    sys.exit(main())
