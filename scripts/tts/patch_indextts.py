#!/usr/bin/env python3
"""Patch IndexTTS-2 so it can save wav files on torchaudio >= 2.9.

torchaudio 2.9 delegates IO to TorchCodec; when no compatible TorchCodec is
installed, save_pcm_wav() raises OSError. We keep torchaudio's path as the
primary and fall back to soundfile.

Usage: python3 scripts/tts/patch_indextts.py --indextts ../pkg/index-tts
"""
import argparse
import pathlib
import sys

OLD = '''    wav = wav.detach().to(device="cpu", dtype=torch.float32) / PCM16_MAX
    wav = wav.clamp_(-1.0, 1.0)
    encoding_args = {"encoding": "PCM_S", "bits_per_sample": 16} if _torchaudio_honors_wav_encoding_args() else {}
    torchaudio.save(path, wav, sampling_rate, **encoding_args)'''

NEW = '''    wav = wav.detach().to(device="cpu", dtype=torch.float32) / PCM16_MAX
    wav = wav.clamp_(-1.0, 1.0)
    encoding_args = {"encoding": "PCM_S", "bits_per_sample": 16} if _torchaudio_honors_wav_encoding_args() else {}
    try:
        torchaudio.save(path, wav, sampling_rate, **encoding_args)
    except Exception as exc:  # torchaudio>=2.9 needs TorchCodec; fall back to soundfile
        import soundfile as sf
        arr = wav.numpy()
        sf.write(path, arr.T if arr.ndim > 1 else arr, int(sampling_rate), subtype="PCM_16")
        print("[save_pcm_wav] torchaudio failed (%s); wrote via soundfile" % type(exc).__name__, flush=True)'''


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--indextts", required=True, help="path to the index-tts checkout")
    ap.add_argument("--check", action="store_true", help="only verify whether the patch is applied")
    a = ap.parse_args()
    target = pathlib.Path(a.indextts) / "indextts" / "utils" / "common.py"
    if not target.is_file():
        return print("not found: %s" % target) or 1
    src = target.read_text(encoding="utf-8")
    if NEW in src:
        print("already patched: %s" % target)
        return 0
    if a.check:
        return print("not patched: %s" % target) or 1
    if OLD not in src:
        return print("unexpected torchaudio.save block; patch by hand: %s" % target) or 1
    target.write_text(src.replace(OLD, NEW), encoding="utf-8")
    print("patched: %s" % target)
    return 0


if __name__ == "__main__":
    sys.exit(main())
