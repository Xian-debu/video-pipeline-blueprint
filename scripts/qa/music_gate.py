#!/usr/bin/env python3
"""Music audibility gate.

The failure this catches is "the score exists, is mixed at a sane level on paper, and is
inaudible on the speakers people actually use". It happened: 70% of the bed's energy sat
below 250 Hz (bass + kick), so between narration lines a laptop speaker heard nothing and
the film felt unscored (docs/known-issues.md K14).

Two modes:

  --music <stem.wav>
      Stem check: the audible band (300 Hz - 16 kHz) must carry a real share of the score
      and must not sit far below the full-band level.

  --mix <mix.wav> --narration <narration.wav>
      Mix check: find the windows where nobody is speaking, and require the bed to be
      audible there (high-passed level), close enough to speech to register, and well
      enough below it not to mask.
"""
import argparse
import json
import subprocess
import sys
import tempfile
import os

import numpy as np

SR = 48000
WIN = 0.5


def decode(path, hp_hz=None):
    fd, raw = tempfile.mkstemp(suffix=".f32")
    os.close(fd)
    af = ["-af", f"highpass=f={hp_hz}"] if hp_hz else []
    cmd = ["ffmpeg", "-v", "error", "-y", "-i", path] + af + [
        "-ac", "1", "-ar", str(SR), "-f", "f32le", raw,
    ]
    subprocess.run(cmd, check=True)
    data = np.fromfile(raw, dtype="<f4")
    os.unlink(raw)
    return data


def rms_db(x):
    return 20 * np.log10(np.sqrt(np.mean(np.square(x), dtype=np.float64)) + 1e-12)


def windows(x):
    n = int(SR * WIN)
    k = len(x) // n
    if k == 0:
        raise SystemExit("music gate: signal shorter than one window")
    frames = x[: k * n].reshape(k, n)
    return 20 * np.log10(np.sqrt(np.mean(np.square(frames, dtype=np.float64), axis=1)) + 1e-12)


def failures(checks):
    bad = [c for c in checks if not c["ok"]]
    for c in checks:
        print(f"  {'PASS' if c['ok'] else 'FAIL'}  {c['name']:<42} {c['value']}  (want {c['want']})")
    return bad


def judge(full, hp):
    """Return (metrics, bad_checks) for a stem given its full-band and high-passed signal."""
    n = min(len(full), len(hp))
    full, hp = full[:n], hp[:n]
    e_full, e_hp = windows(full), windows(hp)
    seg = full[: min(len(full), SR * 20)]
    # power, not magnitude: |X| summed over 100k bins makes the noise floor look like
    # the signal (the first version did exactly that and reported 21% "audible"
    # for a fixture that is three pure tones). Energy share means power share.
    spec = np.abs(np.fft.rfft(seg * np.hanning(len(seg)))) ** 2
    freqs = np.fft.rfftfreq(len(seg), 1 / SR)
    total = spec.sum()
    audible = spec[(freqs >= 250) & (freqs < 4000)].sum() / total
    sub = spec[(freqs >= 20) & (freqs < 120)].sum() / total
    full_med = float(np.median(e_full))
    hp_med = float(np.median(e_hp))
    checks = [
        {"name": "full-band median level (dBFS)", "value": round(full_med, 2), "want": "-32..-18", "ok": -32 <= full_med <= -18},
        {"name": "audible band 250-4k share", "value": f"{audible*100:.0f}%", "want": ">= 50%", "ok": audible >= 0.50},
        {"name": "sub band 20-120 share", "value": f"{sub*100:.0f}%", "want": "<= 20%", "ok": sub <= 0.20},
        {"name": "high-passed vs full-band median", "value": f"{full_med - hp_med:.1f} dB", "want": "<= 7 dB", "ok": full_med - hp_med <= 7},
        {"name": "high-passed median level (dBFS)", "value": round(hp_med, 2), "want": "-34..-20", "ok": -34 <= hp_med <= -20},
    ]
    metrics = {"full_median_db": round(full_med, 2), "audible_median_db": round(hp_med, 2),
               "audible_share": round(audible, 3), "sub_share": round(sub, 3)}
    return metrics, checks, [c for c in checks if not c["ok"]]


def self_test():
    """A fixture that proves the gate still fires: one bed a small speaker can hear, one it cannot."""
    t = np.arange(int(SR * 6), dtype=np.float64) / SR
    rng = np.random.default_rng(7)
    good = 0.5 * (np.sin(2 * np.pi * 440 * t) + 0.6 * np.sin(2 * np.pi * 660 * t) + 0.4 * np.sin(2 * np.pi * 880 * t))
    good += 0.05 * rng.standard_normal(len(t))
    good *= (10 ** (-25 / 20)) / np.sqrt(np.mean(good ** 2))
    bad = np.sin(2 * np.pi * 70 * t) * (10 ** (-25 / 20)) / np.sqrt(0.5)

    # a one-pole high-pass at 300 Hz is enough to imitate a small speaker for the fixture
    def hp300(x):
        a = np.exp(-2 * np.pi * 300 / SR)
        y = np.zeros_like(x)
        prev_x = 0.0
        prev_y = 0.0
        for i in range(len(x)):
            prev_y = a * (prev_y + x[i] - prev_x)
            prev_x = x[i]
            y[i] = prev_y
        return y

    ok_metrics, _, ok_bad = judge(good, hp300(good))
    bad_metrics, bad_checks, bad_bad = judge(bad, hp300(bad))
    print("music gate self-test")
    print("  audible fixture:", "PASS" if not ok_bad else "UNEXPECTED FAIL", ok_metrics)
    print("  sub-only fixture:", "PASS (rejected as intended)" if bad_bad else "UNEXPECTED PASS", bad_metrics)
    for c in bad_bad:
        print(f"    rejected: {c['name']} {c['value']} (want {c['want']})")
    if ok_bad:
        print("  FAIL: the gate rejects a bed it should accept")
        return 1
    if not bad_bad:
        print("  FAIL: the gate accepts a sub-only bed")
        return 1
    print("  PASS: the gate fires on the defect it exists for")
    return 0


def stem_mode(path):
    metrics, checks, bad = judge(decode(path), decode(path, hp_hz=300))
    print(f"music gate (stem): {path}")
    failures(checks)
    print(json.dumps({"mode": "stem", "path": path, **metrics, "pass": not bad}, ensure_ascii=False))
    return 0 if not bad else 1


def mix_mode(mix_path, narration_path):
    mix = decode(mix_path)
    mix_hp = decode(mix_path, hp_hz=300)
    narr = decode(narration_path)
    n = min(len(mix), len(mix_hp), len(narr))
    mix, mix_hp, narr = mix[:n], mix_hp[:n], narr[:n]
    e_mix, e_hp, e_narr = windows(mix), windows(mix_hp), windows(narr)

    speech = e_narr > -45
    gap = e_narr < -55
    if speech.sum() < 3:
        raise SystemExit("music gate: narration has no speech windows")
    if gap.sum() < max(3, len(e_narr) * 0.03):
        raise SystemExit("music gate: narration has too few silent windows to judge the bed")

    speech_ref = float(np.median(e_mix[speech]))
    gap_full = float(np.median(e_mix[gap]))
    gap_hp = float(np.median(e_hp[gap]))
    # how much of the gap is the bed: compare the same band on both sides, and never
    # report a ratio against digital silence (a gap window can be exactly 0.0).
    narr_gap_hp = float(np.median(windows(decode(narration_path, hp_hz=300))[:n][gap]))
    bed = gap_hp - max(narr_gap_hp, -70.0)

    checks = [
        {"name": "speech median (dBFS)", "value": round(speech_ref, 2), "want": "-26..-12", "ok": -26 <= speech_ref <= -12},
        {"name": "silent windows available", "value": f"{gap.sum()} of {len(e_narr)}", "want": ">= 3", "ok": True},
        {"name": "bed contribution in gaps (dB)", "value": round(bed, 1), "want": ">= 12", "ok": bed >= 12},
        {"name": "bed audible band in gaps (dBFS)", "value": round(gap_hp, 2), "want": "-34..-20", "ok": -34 <= gap_hp <= -20},
        {"name": "bed vs speech (dB)", "value": round(gap_hp - speech_ref, 1), "want": "-18..-5", "ok": -18 <= gap_hp - speech_ref <= -5},
        {"name": "bed full-band in gaps (dBFS)", "value": round(gap_full, 2), "want": "<= speech -3", "ok": gap_full <= speech_ref - 3},
    ]
    print(f"music gate (mix): {mix_path}")
    print(f"  narration: {narration_path}")
    bad = failures(checks)
    print(json.dumps({"mode": "mix", "mix": mix_path, "narration": narration_path,
                      "speech_db": round(speech_ref, 2), "gap_full_db": round(gap_full, 2),
                      "gap_audible_db": round(gap_hp, 2), "bed_contribution_db": round(bed, 1),
                      "pass": not bad}, ensure_ascii=False))
    return 0 if not bad else 1


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--music")
    ap.add_argument("--mix")
    ap.add_argument("--narration")
    ap.add_argument("--self-test", action="store_true")
    a = ap.parse_args()
    if a.self_test:
        sys.exit(self_test())
    if a.music and not (a.mix or a.narration):
        sys.exit(stem_mode(a.music))
    if a.mix and a.narration:
        sys.exit(mix_mode(a.mix, a.narration))
    ap.error("use --music, or --mix with --narration")


if __name__ == "__main__":
    main()
