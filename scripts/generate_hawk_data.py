#!/usr/bin/env python3
"""Generate the two data files the Hawk lecture video reads.

Everything here is deterministic: fixed seeds, no network, no wall-clock input.
Two blocks are produced:

  data/hawk/gray.json  -- a real 4-bit balanced Gray code (found by backtracking),
                          the grouped-Gray-code example (n=18, m=6), and the
                          numbers Hawk (SenSys'24) reports in Section 3.1.
  data/hawk/wave.json  -- a *synthetic* 4 s aggregate-power waveform with a 40 W
                          humidifier switching under a 1500 W kettle, plus the
                          paper's Section 4.1 SINR example, a 30-cycle vote and a
                          small DFT over the differential series.

Provenance discipline: every number is either copied from the paper (with the
section noted) or computed here. Nothing is tuned to look good.

    python3 scripts/generate_hawk_data.py
"""
import json
import math
import os
import random
import sys
from collections import Counter

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT_DIR = os.path.join(ROOT, "data", "hawk")

GRAY_SEED = 20241019
WAVE_SEED = 20241020

# --------------------------------------------------------------------------
# Output A: gray.json
# --------------------------------------------------------------------------


def find_balanced_gray(bits=4):
    """Backtracking search for a cyclic balanced Gray code over 2**bits states.

    Constraints: every adjacent pair (including last->first) differs in exactly
    one bit, and every bit flips 2**bits / bits times. Returns the state list.
    """
    n = 1 << bits
    target = n // bits
    adj = []
    for s in range(n):
        adj.append([t for t in range(n) if t != s and ((s ^ t) & ((s ^ t) - 1)) == 0])

    path = [0]
    used = [False] * n
    used[0] = True
    flips = [0] * bits

    def dfs():
        depth = len(path)
        if depth == n:
            close = path[-1] ^ path[0]
            if close & (close - 1):  # more than one bit differs from the start
                return False
            # The closing edge has not been counted in `flips` yet.
            close_bit = close.bit_length() - 1
            if flips[close_bit] + 1 != target:
                return False
            return all(f == target for b, f in enumerate(flips) if b != close_bit)
        # Edges still available include the closing edge last->first.
        remaining = n - depth + 1
        for b in range(bits):
            need = target - flips[b]
            if need < 0 or need > remaining:
                return False
        last = path[-1]
        # Try less-used bits first; deterministic order.
        for nxt in adj[last]:
            if used[nxt]:
                continue
            bit = (last ^ nxt).bit_length() - 1
            if flips[bit] >= target:
                continue
            used[nxt] = True
            path.append(nxt)
            flips[bit] += 1
            if dfs():
                return True
            flips[bit] -= 1
            path.pop()
            used[nxt] = False
        return False

    if not dfs():
        raise RuntimeError("no balanced 4-bit Gray code found")
    return path


def build_schedule(n_groups, rounds, active_per_round, seed):
    """12 rounds x 2 active groups, deterministic pseudo-random, equal counts."""
    rng = random.Random(seed)
    total_slots = rounds * active_per_round
    if total_slots % n_groups:
        raise ValueError("cannot balance groups over the requested rounds")
    flat = [g for g in range(n_groups) for _ in range(total_slots // n_groups)]
    for _ in range(2000):
        rng.shuffle(flat)
        pairs = [flat[2 * i:2 * i + 2] for i in range(rounds)]
        if all(p[0] != p[1] for p in pairs):
            round_list = [{"round": i + 1, "active": sorted(p)} for i, p in enumerate(pairs)]
            counts = Counter(g for p in pairs for g in p)
            if all(counts[g] == total_slots // n_groups for g in range(n_groups)):
                return round_list, counts
    raise RuntimeError("could not build a balanced activation schedule")


def write_gray():
    states = find_balanced_gray(4)
    state_str = [format(s, "0{}b".format(4)) for s in states]
    flips = [0, 0, 0, 0]
    for i, s in enumerate(states):
        t = states[(i + 1) % len(states)]
        b = (s ^ t).bit_length() - 1
        flips[b] += 1

    n, m = 18, 6
    per_group = n // m
    ungrouped = 2 ** n
    events_grouped = m * (2 ** per_group)
    ratio = ungrouped / events_grouped
    schedule, counts = build_schedule(m, 12, 2, GRAY_SEED)

    paper = {
        "trainRounds": 30,
        "trainEvents": 2880,
        "trainStates": 2584,
        "valRounds": 18,
        "valEvents": 2112,
        "valStates": 1962,
        "overlapPct": 17,
    }
    sources = {
        "trainRounds": "SenSys'24 Hawk, Sec. 3.1 (Algorithm 1 is run for 30 rounds)",
        "trainEvents": "SenSys'24 Hawk, Sec. 3.1 (yields 2880 events)",
        "trainStates": "SenSys'24 Hawk, Sec. 3.1 (and 2584 unique states)",
        "valRounds": "SenSys'24 Hawk, Sec. 3.1 (validation: 18 rounds)",
        "valEvents": "SenSys'24 Hawk, Sec. 3.1 (2112 events)",
        "valStates": "SenSys'24 Hawk, Sec. 3.1 (1962 unique states)",
        "overlapPct": "SenSys'24 Hawk, Sec. 3.1 (overlap between training and test less than 17%)",
    }

    doc = {
        "meta": {
            "title": "Hawk: grouped randomized balanced Gray code",
            "paper": "Hawk: An Efficient NALM System for Accurate Low-Power Appliance Recognition, SenSys'24",
            "generatedBy": "scripts/generate_hawk_data.py",
            "computed": [
                "code4.states (backtracking search, fixed order)",
                "code4.flipsPerBit (counted from states)",
                "grouped.stateUngrouped = 2**18",
                "grouped.eventsPerRoundGrouped = 6 * 2**3",
                "grouped.ratio = 2**18 / (6 * 2**3)",
                "grouped.schedule.rounds (seeded PRNG, seed 20241019, balanced to 4 activations/group)",
            ],
            "paperValues": sorted(paper),
            "notes": [
                "The paper's train/val counts are reported results; they are copied, not re-derived.",
                "The n=18,m=6 example is a simplified illustration: 30 rounds x 48 events/round = 1440, which does not equal the paper's 2880 trainEvents. Do not present the two as the same measurement.",
                "code4 is a genuine balanced 4-bit Gray code found by exhaustive backtracking; it is cyclic and every bit flips 4 times.",
            ],
        },
        "code4": {
            "states": state_str,
            "flipsPerBit": flips,
            "singleFlip": True,
            "cyclic": True,
            "balanced": True,
            "bits": 4,
            "stateCount": 16,
            "flipsPerBitTarget": 4,
        },
        "grouped": {
            "n": n,
            "m": m,
            "perGroup": per_group,
            "stateUngrouped": ungrouped,
            "eventsPerRoundGrouped": events_grouped,
            "ratio": round(ratio, 6),
            "ratioExpression": "262144/48",
            "schedule": {
                "rounds": schedule,
                "roundsCount": len(schedule),
                "activePerRound": 2,
                "activationsPerGroup": {str(k): v for k, v in sorted(counts.items())},
                "seed": GRAY_SEED,
            },
        },
        "paper": paper,
        "paperSources": sources,
    }

    # ---------------- assertions ----------------
    checks = []
    checks.append(("code4: 16 states", len(states) == 16))
    checks.append(("code4: 16 unique states", len(set(tuple(s) for s in state_str)) == 16))
    checks.append(("code4: all 4-bit strings", all(len(s) == 4 and set(s) <= {"0", "1"} for s in state_str)))
    hd = [bin(states[i] ^ states[(i + 1) % 16]).count("1") for i in range(16)]
    checks.append(("code4: every adjacent pair (incl. wrap) differs in 1 bit", all(d == 1 for d in hd)))
    checks.append(("code4: every bit flips exactly 4 times", flips == [4, 4, 4, 4]))
    checks.append(("code4: flips sum to 16 transitions", sum(flips) == 16))
    checks.append(("grouped: 2**18 == 262144", ungrouped == 262144))
    checks.append(("grouped: 6 * 2**3 == 48", events_grouped == 48))
    checks.append(("grouped: ratio == 262144/48", abs(ratio - 262144 / 48) < 1e-12))
    checks.append(("grouped: 12 rounds", len(schedule) == 12))
    checks.append(("grouped: every round activates exactly 2 distinct groups",
                   all(len(r["active"]) == 2 and r["active"][0] != r["active"][1] for r in schedule)))
    checks.append(("grouped: each of 6 groups activated 4 times",
                   all(counts[g] == 4 for g in range(6))))
    checks.append(("paper: 30 rounds / 2880 events / 2584 states copied",
                   (paper["trainRounds"], paper["trainEvents"], paper["trainStates"]) == (30, 2880, 2584)))
    checks.append(("paper: 18 rounds / 2112 events / 1962 states copied",
                   (paper["valRounds"], paper["valEvents"], paper["valStates"]) == (18, 2112, 1962)))
    checks.append(("paper: overlap 17% copied", paper["overlapPct"] == 17))

    path = os.path.join(OUT_DIR, "gray.json")
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return path, checks, states, flips, ratio


# --------------------------------------------------------------------------
# Output B: wave.json (synthetic)
# --------------------------------------------------------------------------

CYCLE_S = 0.02          # 50 Hz mains: one cycle is 20 ms
FS_HZ = 16000           # samples per second (not stored; used for the sampling check)
SAMPLES_PER_CYCLE = int(FS_HZ * CYCLE_S)
DURATION_S = 4.0
CYCLES = int(round(DURATION_S / CYCLE_S))  # 200
RAMP_CYCLES = 4         # switch transient length used by the cartoon waveform
DIFF_CYCLES = 30        # paper Sec. 4.3: steady-state differential from a 30-cycle buffer
VOTE_WINDOW = 30        # paper Sec. 4.1.2 / Fig. 6: vote within a 30-cycle window
VOTE_THRESHOLD = 12     # paper Fig. 6: "VoteHum >= 12"

BASE_NOISE_W = 10.0
NOISE_SWING_W = 10.0

HUMIDIFIER_W = 40.0
KETTLE_W = 1500.0


def appliance_power(cycle, on_cycle, off_cycle, watts):
    """Power in this cycle with a RAMP_CYCLES linear switching transient."""
    if cycle >= on_cycle and (off_cycle is None or cycle < off_cycle):
        if cycle < on_cycle + RAMP_CYCLES:
            return watts * (cycle - on_cycle + 1) / RAMP_CYCLES
        return watts
    if off_cycle is not None and cycle >= off_cycle:
        if cycle < off_cycle + RAMP_CYCLES:
            return watts * (RAMP_CYCLES - (cycle - off_cycle)) / RAMP_CYCLES
        return 0.0
    return 0.0


# Illustrative current-shape model: fundamental plus odd harmonics. These
# ratios are a modelling choice for the synthetic load, not paper measurements.
HARMONIC_PROFILE = [(1, 1.0), (3, 0.08), (5, 0.04), (7, 0.02), (9, 0.01)]


def build_harmonic_current(cycles=10):
    """One steady-state 50 Hz current waveform, 16 kHz, normalised fundamental.

    The stored series has one RMS value per 20 ms cycle (a 50 Hz envelope, whose
    Nyquist is 25 Hz), so it cannot carry 50 Hz harmonics. The harmonic feature
    is therefore computed on a within-cycle waveform for the same 10 stable
    cycles, sampling at the meter's 16 kHz rate.
    """
    n = SAMPLES_PER_CYCLE * cycles
    xs = []
    for i in range(n):
        t = i / FS_HZ
        v = 0.0
        for h, amp in HARMONIC_PROFILE:
            v += amp * math.sin(2.0 * math.pi * 50.0 * h * t)
        xs.append(v)
    return xs


def dft_harmonics(xs, fs, fundamental_hz, count=10):
    """DFT at exact 50 Hz harmonic bins, normalised to peak amplitude (2/N).

    A pure sine of amplitude A yields |X| == A at its bin.
    """
    n = len(xs)
    out = []
    for k in range(1, count + 1):
        freq = k * fundamental_hz
        bin_pos = freq * n / fs
        if abs(bin_pos - round(bin_pos)) > 1e-9:
            raise ValueError("harmonic does not fall on an exact DFT bin")
        b = int(round(bin_pos))
        re = 0.0
        im = 0.0
        for i, x in enumerate(xs):
            ang = -2.0 * math.pi * b * i / n
            re += x * math.cos(ang)
            im += x * math.sin(ang)
        re = 2.0 * re / n
        im = 2.0 * im / n
        out.append({
            "k": k,
            "freqHz": round(freq, 3),
            "re": round(re, 6),
            "im": round(im, 6),
            "mag": round(math.hypot(re, im), 6),
        })
    return out


def write_wave():
    rng_noise = random.Random(WAVE_SEED)
    rng_vote = random.Random(WAVE_SEED + 1)

    hum_on = int(round(1.0 / CYCLE_S))   # cycle 50
    hum_off = int(round(2.6 / CYCLE_S))  # cycle 130
    kettle_on = int(round(0.4 / CYCLE_S))  # cycle 20

    noise = [BASE_NOISE_W + rng_noise.uniform(-NOISE_SWING_W, NOISE_SWING_W) for _ in range(CYCLES)]
    total = []
    for c in range(CYCLES):
        p = noise[c]
        p += appliance_power(c, hum_on, hum_off, HUMIDIFIER_W)
        p += appliance_power(c, kettle_on, None, KETTLE_W)
        total.append(p)

    # 30-cycle difference; first 30 cycles have no predecessor.
    diff = [None if c < DIFF_CYCLES else total[c] - total[c - DIFF_CYCLES] for c in range(CYCLES)]

    # Measurements (mean over plateaus; the noise is zero-mean-ish but bounded).
    hum_total_before = sum(total[c] for c in range(40, hum_on)) / (hum_on - 40)
    hum_total_after = sum(total[c] for c in range(hum_on + RAMP_CYCLES + 1, hum_off)) / (hum_off - hum_on - RAMP_CYCLES - 1)
    kettle_total_before = sum(total[c] for c in range(0, kettle_on)) / kettle_on
    kettle_total_after = sum(total[c] for c in range(kettle_on + 8, hum_on)) / (hum_on - kettle_on - 8)

    def mean_range(arr, lo, hi):
        vals = [v for v in arr[lo:hi] if v is not None]
        return sum(vals) / len(vals)

    # diff[c] = total[c] - total[c-30], so a step stays in the differential
    # series for exactly 30 cycles: kettle on (cycle 20) shows at 30..49,
    # humidifier on (cycle 50) at 50..79, humidifier off (cycle 130) at 130..159.
    d_baseline = mean_range(diff, 100, 120)  # steady state between the ON and OFF steps
    d_kettle = mean_range(diff, 30, 50)      # kettle-only step
    d_hum = mean_range(diff, 54, 80)         # humidifier-only step (kettle already on)

    hum_total_step = hum_total_after - hum_total_before
    kettle_total_step = kettle_total_after - kettle_total_before
    hum_diff_step = d_hum - d_baseline
    kettle_diff_step = d_kettle - d_baseline

    # Windowed vote for "humidifier turned on": 30 classifier outputs, then majority.
    votes = ["humidifier"] * 20 + ["idle"] * 6 + ["noise"] * 4
    rng_vote.shuffle(votes)
    counts = Counter(votes)
    decided = max(sorted(counts), key=lambda k: counts[k])

    # Harmonic feature over the same 10 stable cycles (60-69) after the
    # humidifier settles, using a 16 kHz within-cycle differential current:
    # the OFF current is ~0, so the differential current is the ON waveform.
    harmonics = dft_harmonics(build_harmonic_current(10), FS_HZ, 1.0 / CYCLE_S, 10)

    doc = {
        "meta": {
            "title": "Hawk: steady-state differential current and windowed voting",
            "paper": "Hawk: An Efficient NALM System for Accurate Low-Power Appliance Recognition, SenSys'24",
            "generatedBy": "scripts/generate_hawk_data.py",
            "synthetic": True,
            "disclaimer": "这是按论文数值复现的示意波形，不是实测数据",
            "syntheticNote": "The waveform is constructed from the paper's example appliances and power values; it is not a measurement or a digitised replay of any figure.",
            "seed": WAVE_SEED,
            "quantities": {
                "power": "W (watt)",
                "time": "s (second)",
                "cycles": "count of 20 ms mains cycles",
            },
            "syntheticAssumptions": [
                "One cycle = 20 ms (50 Hz), 200 cycles = 4.0 s; total power is stored per cycle, not raw ADC samples.",
                "Background load is 10 W +/- 10 W, re-drawn once per cycle from a seeded PRNG (uniform).",
                "Switch transients are modelled as a 4-cycle linear ramp; this is a cartoon, not a physical motor/thermal model.",
                "The differential series uses a 30-cycle lag (paper Sec. 4.3), so each step appears 0.6 s after the actual switch.",
                "The harmonic feature is computed on a 16 kHz within-cycle current waveform, not on the per-cycle RMS series: a 50 Hz envelope (one sample per cycle) has a 25 Hz Nyquist limit and cannot represent 50 Hz harmonics.",
                "The current-shape model is fundamental + 3rd/5th/7th/9th at 8/4/2/1% of the fundamental; that profile is a modelling choice, not a paper measurement.",
            ],
            "computed": [
                "series.t, series.total, series.diff",
                "measurements.*",
                "sinr.*.ratio and sinr.gainDb from the paper's four raw numbers",
                "vote.counts and vote.decided",
                "features.harmonics (DFT at exact 50 Hz harmonic bins of a 16 kHz within-cycle current, 10 stable cycles)",
            ],
            "paperValues": [
                "sinr.direct: 41/1480 (Sec. 4.1.1)",
                "sinr.diff: 39/60 = 39/(40+20) (Sec. 4.1.1)",
                "window.cycles = 30, transientCycles = 4, vote.threshold = 12 (Sec. 4.1.2 / Sec. 4.3)",
            ],
        },
        "config": {
            "durationS": DURATION_S,
            "cycleS": CYCLE_S,
            "frequencyHz": 1.0 / CYCLE_S,
            "sampleRateHz": FS_HZ,
            "samplesPerCycle": SAMPLES_PER_CYCLE,
            "cycles": CYCLES,
            "pointsStored": CYCLES,
            "pointSampling": "one point per mains cycle (uniform)",
            "diffLagCycles": DIFF_CYCLES,
            "rampCycles": RAMP_CYCLES,
        },
        "series": {
            "t": [round(c * CYCLE_S, 3) for c in range(CYCLES)],
            "total": [round(v, 3) for v in total],
            "diff": [None if v is None else round(v, 3) for v in diff],
        },
        "events": [
            {"t": round(kettle_on * CYCLE_S, 3), "appliance": "kettle", "on": True, "watts": KETTLE_W},
            {"t": round(hum_on * CYCLE_S, 3), "appliance": "humidifier", "on": True, "watts": HUMIDIFIER_W},
            {"t": round(hum_off * CYCLE_S, 3), "appliance": "humidifier", "on": False, "watts": HUMIDIFIER_W},
        ],
        "sinr": {
            "direct": {
                "target": 41,
                "others": 1480,
                "ratio": round(41 / 1480, 8),
                "ratioExpression": "41/1480",
                "source": "paper Sec. 4.1.1: humidifier's maximum SINR from total current",
            },
            "diff": {
                "target": 39,
                "other": 60,
                "ratio": round(39 / 60, 8),
                "ratioExpression": "39/60 = 39/(40+20)",
                "source": "paper Sec. 4.1.1: minimum SINR for the humidifier switching event after differential current",
            },
            "gainDb": round(20 * math.log10((39 / 60) / (41 / 1480)), 4),
            "gainFormula": "20*log10((39/60)/(41/1480))",
        },
        "vote": {
            "windowCycles": VOTE_WINDOW,
            "threshold": VOTE_THRESHOLD,
            "votes": votes,
            "counts": {k: counts[k] for k in sorted(counts)},
            "decided": decided,
            "source": "paper Sec. 4.1.2 / Fig. 6: report an event when the vote count >= threshold (e.g. 12 for humidifier turn-on)",
        },
        "window": {
            "cycles": VOTE_WINDOW,
            "transientCycles": RAMP_CYCLES,
            "note": "Differential pairs skip the 4-cycle switching transient, so a 30-cycle window keeps about (30 - 4) = 26 usable cycles; the vote threshold is 12 (paper Sec. 4.1.2).",
        },
        "features": {
            "unit": "normalised current peak amplitude (fundamental peak = 1.0)",
            "cycles": 10,
            "sampleRateHz": FS_HZ,
            "fundamentalHz": 50.0,
            "sourceSeriesCycles": [60, 69],
            "basis": "DFT at the exact 50 Hz harmonic bins of a 16 kHz within-cycle differential-current waveform for the 10 stable cycles 60-69 (the stored series is per-cycle RMS and cannot represent 50 Hz harmonics).",
            "waveformModel": {
                "fundamentalPeak": 1.0,
                "harmonicRmsRatios": {str(h): a for h, a in HARMONIC_PROFILE},
                "note": "Illustrative load shape; the ratios are a modelling choice, not measured data.",
            },
            "harmonics": harmonics,
            "note": "This is a synthetic feature extraction, not the paper's measured intra-cycle FFT.",
        },
        "measurements": {
            "humidifierTotalStepW": round(hum_total_step, 3),
            "kettleTotalStepW": round(kettle_total_step, 3),
            "humidifierDiffStepW": round(hum_diff_step, 3),
            "kettleDiffStepW": round(kettle_diff_step, 3),
            "humidifierToKettleTotalStepRatio": round(abs(hum_total_step) / abs(kettle_total_step), 4),
            "note": "Steps measured as mean difference between plateaus, so background noise contributes a small residual.",
        },
    }

    # ---------------- assertions ----------------
    checks = []
    checks.append(("wave: 200 cycles at 20 ms == 4.0 s", CYCLES == 200 and abs(CYCLES * CYCLE_S - DURATION_S) < 1e-9))
    checks.append(("wave: 16000 Hz x 0.02 s == 320 samples/cycle", SAMPLES_PER_CYCLE == 320))
    checks.append(("wave: series t/total/diff all 200 points", len(doc["series"]["t"]) == len(doc["series"]["total"]) == len(doc["series"]["diff"]) == 200))
    checks.append(("wave: points in 200..400", 200 <= len(doc["series"]["t"]) <= 400))
    checks.append(("wave: t starts at 0.0 and ends at 3.98", doc["series"]["t"][0] == 0.0 and abs(doc["series"]["t"][-1] - 3.98) < 1e-9))
    checks.append(("wave: 30-cycle diff warm-up is null", all(v is None for v in doc["series"]["diff"][:30]) and all(v is not None for v in doc["series"]["diff"][30:])))
    checks.append(("wave: humidifier total step about 40 W (|err| < 8)", abs(hum_total_step - 40.0) < 8.0))
    checks.append(("wave: kettle total step about 1500 W (|err| < 15)", abs(kettle_total_step - 1500.0) < 15.0))
    checks.append(("wave: humidifier diff step about 40 W (|err| < 8)", abs(hum_diff_step - 40.0) < 8.0))
    checks.append(("wave: kettle diff step about 1500 W (|err| < 15)", abs(kettle_diff_step - 1500.0) < 15.0))
    checks.append(("wave: 40 W step is < 10% of the 1500 W step in total", abs(hum_total_step) < 0.1 * abs(kettle_total_step)))
    checks.append(("wave: sinr direct ratio == 41/1480", abs(doc["sinr"]["direct"]["ratio"] - 41 / 1480) < 1e-8))
    checks.append(("wave: sinr diff ratio == 39/60", abs(doc["sinr"]["diff"]["ratio"] - 39 / 60) < 1e-8))
    checks.append(("wave: differential gain > 20 dB", doc["sinr"]["gainDb"] > 20.0))
    checks.append(("wave: vote window has 30 votes", len(votes) == 30 and sum(counts.values()) == 30))
    checks.append(("wave: decided == humidifier", decided == "humidifier"))
    checks.append(("wave: humidifier votes >= threshold 12", counts["humidifier"] >= VOTE_THRESHOLD))
    checks.append(("wave: 10 harmonics, k=1..10", len(harmonics) == 10 and [h["k"] for h in harmonics] == list(range(1, 11))))
    checks.append(("wave: harmonic frequencies 50..500 Hz", harmonics[0]["freqHz"] == 50.0 and harmonics[-1]["freqHz"] == 500.0))
    checks.append(("wave: fundamental is the largest harmonic", max(harmonics, key=lambda h: h["mag"])["k"] == 1))
    even = [h for h in harmonics if h["k"] % 2 == 0]
    checks.append(("wave: even harmonics ~0 (symmetric load)", all(h["mag"] < 1e-6 for h in even)))
    checks.append(("wave: 3rd/5th ratios match the model (8%/4%)",
                   abs(harmonics[2]["mag"] / harmonics[0]["mag"] - 0.08) < 1e-6
                   and abs(harmonics[4]["mag"] / harmonics[0]["mag"] - 0.04) < 1e-6))

    path = os.path.join(OUT_DIR, "wave.json")
    os.makedirs(OUT_DIR, exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(doc, fh, indent=2, ensure_ascii=False)
        fh.write("\n")
    return path, checks, {
        "hum_total_step": hum_total_step,
        "kettle_total_step": kettle_total_step,
        "hum_diff_step": hum_diff_step,
        "kettle_diff_step": kettle_diff_step,
        "ratio": abs(hum_total_step) / abs(kettle_total_step),
    }, doc


def main():
    gray_path, gray_checks, states, flips, ratio = write_gray()
    wave_path, wave_checks, m, wave_doc = write_wave()

    all_checks = gray_checks + wave_checks
    failures = [name for name, ok in all_checks if not ok]

    print("Hawk data generation")
    print("====================")
    print("gray.json :", gray_path)
    print("wave.json :", wave_path)
    print()
    print("4-bit balanced Gray code found by backtracking:")
    print("  states      :", " ".join(format(s, "04b") for s in states))
    print("  flipsPerBit :", flips, " (target [4, 4, 4, 4])")
    print()
    print("Grouped example (n=18, m=6, 3 per group):")
    print("  2**18                  =", 2 ** 18)
    print("  6 * 2**3               =", 6 * 2 ** 3)
    print("  ratio 262144/48        =", round(ratio, 6))
    print()
    print("Synthetic waveform checks (40 W humidifier under a 1500 W kettle):")
    print("  humidifier step in total :", round(m["hum_total_step"], 3), "W")
    print("  kettle     step in total :", round(m["kettle_total_step"], 3), "W")
    print("  humidifier step in diff  :", round(m["hum_diff_step"], 3), "W")
    print("  kettle     step in diff  :", round(m["kettle_diff_step"], 3), "W")
    print("  ratio (hum/kettle, total):", round(m["ratio"], 4))
    print("  => the 40 W event is buried in total but ~40 W in the differential series")
    print()
    print("Vote:", dict(wave_doc["vote"]["counts"]), "-> decided:", wave_doc["vote"]["decided"],
          "(threshold", wave_doc["vote"]["threshold"], ")")
    print("SINR gain:", wave_doc["sinr"]["gainDb"], "dB")
    print()
    print("Assertions")
    print("----------")
    for name, ok in all_checks:
        print(("PASS  " if ok else "FAIL  ") + name)
    print()
    print("{}/{} assertions passed".format(len(all_checks) - len(failures), len(all_checks)))
    if failures:
        print("FAILED:", failures, file=sys.stderr)
        return 1
    print("OK: deterministic data written; exit 0")
    return 0


if __name__ == "__main__":
    sys.exit(main())
