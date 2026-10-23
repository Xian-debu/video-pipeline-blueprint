#!/usr/bin/env python3
"""Derived data for the ARC explainer.

The simulator below is a literal transcription of Figure 4 of
Megiddo & Modha, "ARC: A Self-Tuning, Low Overhead Replacement Cache"
(FAST '03, pp. 115-130): same four cases, same ADAPTATION deltas, same REPLACE
predicate.  Everything the film draws about p(t), |T1|, |T2|, case mix and
hit ratio on *synthetic* workloads comes from this file, so the numbers on
screen can be re-derived with: python3 scripts/generate_arc_data.py

Fixed seed, no wall clock, values rounded to 3 decimals -> byte identical
output on every run (checked by scripts/qa/derive_data.mjs --check).
"""
import json
import os
import random
from collections import OrderedDict

SEED = 7
REQUESTS = 120000
PAGES = 4000
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "data", "arc", "sim.json")


def gen_main_trace(seed=SEED, n=REQUESTS, pages=PAGES):
    """Synthetic workload whose locality character changes over time.

    Phases of 6000 requests rotate between three regimes:
      recency   - a 200 page working set is reused heavily (LRU friendly)
      frequency - skewed zipf over all 4000 pages (LFU friendly)
      scan      - fresh sequential pages that nobody will touch again
    No real trace is available to us, so the film labels every number derived
    from this file as SYNTHETIC; the paper numbers live in eval.json instead.
    """
    rnd = random.Random(seed)
    out = []
    phase = 0
    while len(out) < n:
        kind = ("recency", "frequency", "scan")[phase % 3]
        if kind == "recency":
            ws = [rnd.randrange(pages) for _ in range(200)]
            for _ in range(6000):
                out.append(rnd.choice(ws))
        elif kind == "frequency":
            weights = [1.0 / (i + 1) ** 0.9 for i in range(300)]
            for _ in range(6000):
                out.append(rnd.choices(range(300), weights=weights)[0])
        else:
            base = 100000 + phase * 7000
            for i in range(6000):
                out.append(base + i)
        phase += 1
    return out[:n]


class ARC:
    """Figure 4 (ARC(c)) verbatim.  T1/T2 cached, B1/B2 ghost directories."""

    name = "arc"

    def __init__(self, c, adapt=True, fixed_p=None):
        self.c = c
        self.p = 0.0 if fixed_p is None else float(fixed_p)
        self.adapt = adapt
        self.t1, self.t2, self.b1, self.b2 = OrderedDict(), OrderedDict(), OrderedDict(), OrderedDict()
        self.cases = {"I": 0, "II": 0, "III": 0, "IV": 0}
        self.hits = 0

    # --- helpers -------------------------------------------------------
    def _evict(self, d):
        k = next(iter(d))
        del d[k]
        return k

    def replace(self, x):
        if self.t1 and (len(self.t1) > self.p or (x in self.b2 and len(self.t1) == self.p)):
            self.b1[self._evict(self.t1)] = True          # demote T1 LRU to B1 MRU
        elif self.t2:
            self.b2[self._evict(self.t2)] = True          # demote T2 LRU to B2 MRU
        elif self.t1:
            # Degenerate corner of Figure 4: |T1| == p == c, T2 empty, so the
            # else-branch has nothing to evict.  Evicting from T1 keeps the
            # cache at c pages; the paper never exercises this state.
            self.b1[self._evict(self.t1)] = True

    def request(self, x):
        c = self.c
        if x in self.t1:
            del self.t1[x]
            self.t2[x] = True
            self.cases["I"] += 1
            self.hits += 1
            return True
        if x in self.t2:
            self.t2.move_to_end(x)
            self.cases["I"] += 1
            self.hits += 1
            return True
        if x in self.b1:                                   # Case II: recency was starved
            d1 = 1.0 if len(self.b1) >= len(self.b2) else len(self.b2) / len(self.b1)
            if self.adapt:
                self.p = min(self.p + d1, float(c))
            self.replace(x)
            del self.b1[x]
            self.t2[x] = True
            self.cases["II"] += 1
            return False
        if x in self.b2:                                   # Case III: frequency was starved
            d2 = 1.0 if len(self.b2) >= len(self.b1) else len(self.b1) / len(self.b2)
            if self.adapt:
                self.p = max(self.p - d2, 0.0)
            self.replace(x)
            del self.b2[x]
            self.t2[x] = True
            self.cases["III"] += 1
            return False
        # Case IV: a page that is nowhere in the directory (Figure 4, Case IV)
        if len(self.t1) + len(self.b1) == c:               # Case A: L1 is exactly c pages
            if len(self.t1) < c:                           # B1 non-empty: drop its LRU ghost
                if self.b1:
                    self._evict(self.b1)
                self.replace(x)
            else:                                          # B1 empty: drop the LRU page of T1
                self._evict(self.t1)                       # (and remove it from the cache)
        else:                                              # Case B: L1 has fewer than c pages
            if len(self.t1) + len(self.t2) + len(self.b1) + len(self.b2) >= c:
                if len(self.t1) + len(self.t2) + len(self.b1) + len(self.b2) == 2 * c:
                    if self.b2:
                        self._evict(self.b2)
                self.replace(x)
        self.t1[x] = True                                  # fetch x, MRU of T1
        self.cases["IV"] += 1
        return False

    def stats(self):
        return {
            "p": self.p,
            "t1": len(self.t1), "t2": len(self.t2),
            "b1": len(self.b1), "b2": len(self.b2),
            "cached": len(self.t1) + len(self.t2),
        }


class LRU:
    name = "lru"

    def __init__(self, c):
        self.c = c
        self.d = OrderedDict()
        self.hits = 0

    def request(self, x):
        if x in self.d:
            self.d.move_to_end(x)
            self.hits += 1
            return True
        if len(self.d) >= self.c:
            self._evict(self.d)
        self.d[x] = True
        return False

    @staticmethod
    def _evict(d):
        del d[next(iter(d))]


def run(trace, policy):
    for x in trace:
        policy.request(x)
    return policy


def r3(v):
    return round(float(v), 3)


def main():
    trace = gen_main_trace()
    c_choices = [16, 32, 64, 128, 256, 512, 1024]

    sweep = {"cachePages": c_choices, "lru": [], "arc": [], "frc": {}}
    for c in c_choices:
        lru = run(trace, LRU(c))
        arc = run(trace, ARC(c))
        sweep["lru"].append(r3(100.0 * lru.hits / len(trace)))
        sweep["arc"].append(r3(100.0 * arc.hits / len(trace)))
        for label, frac in (("p0", 0.0), ("p25", 0.25), ("p50", 0.5), ("p75", 0.75), ("p100", 1.0)):
            frc = run(trace, ARC(c, adapt=False, fixed_p=c * frac))
            sweep["frc"].setdefault(label, []).append(r3(100.0 * frc.hits / len(trace)))

    # p(t) walk at c = 256, one sample every 50 requests
    c = 256
    walk = ARC(c)
    every = 50
    pvals, t1s, t2s = [], [], []
    for i, x in enumerate(trace):
        walk.request(x)
        if (i + 1) % every == 0:
            pvals.append(r3(walk.p))
            t1s.append(len(walk.t1))
            t2s.append(len(walk.t2))

    # case mix at c = 256: which of the four branches fired how often
    mix = ARC(256)
    run(trace, mix)
    total = sum(mix.cases.values())

    # scan experiment: skewed working set -> one long sequential scan -> same working set.
    # This is the phenomenon Section III.D describes: one-time sequential pages must
    # pass through without flushing pages that have temporal locality.
    rnd = random.Random(13)
    w = [1.0 / (i + 1) ** 0.8 for i in range(3000)]
    pre = rnd.choices(range(3000), weights=w, k=6000)
    scan = [90000 + i for i in range(3000)]
    post = rnd.choices(range(3000), weights=w, k=4000)
    seq = pre + scan + post
    c_scan = 128
    a = ARC(c_scan)
    step = 300
    scan_rows = []
    for i, x in enumerate(seq):
        ah = a.request(x)
        if (i + 1) % step == 0:
            scan_rows.append({"at": i + 1, "hit": 1 if ah else 0,
                              "p": r3(a.p), "t1": len(a.t1), "t2": len(a.t2)})
    # windowed hit ratio per 300 requests, ARC and LRU on the same stream
    ratios = []
    a2, l2 = ARC(c_scan), LRU(c_scan)
    win = {"aw": 0, "lw": 0, "n": 0}
    t2_at_scan_end = None
    for i, x in enumerate(seq):
        win["aw"] += 1 if a2.request(x) else 0
        win["lw"] += 1 if l2.request(x) else 0
        win["n"] += 1
        if i + 1 == len(pre) + len(scan):
            t2_at_scan_end = len(a2.t2)
        if win["n"] == step:
            ratios.append({"at": i + 1, "arc": r3(100.0 * win["aw"] / win["n"]),
                           "lru": r3(100.0 * win["lw"] / win["n"]), "p": r3(a2.p)})
            win = {"aw": 0, "lw": 0, "n": 0}
    # phase hit ratios, policies warmed on the prefix first
    def phase_ratio(arr, start, which):
        pa, pl = ARC(c_scan), LRU(c_scan)
        for x in seq[:start]:
            pa.request(x)
            pl.request(x)
        ha = hl = 0
        for x in arr:
            ha += 1 if pa.request(x) else 0
            hl += 1 if pl.request(x) else 0
        return {"arc": r3(100.0 * ha / len(arr)), "lru": r3(100.0 * hl / len(arr))}
    post100 = phase_ratio(post[:100], len(pre) + len(scan), "post")
    arc_pre = phase_ratio(pre, 0, "pre")

    # a short per-request tape for the request-flow animation (c = 8, hand fed)
    tape_pages = [3, 5, 3, 7, 5, 9, 3, 11, 5, 3, 13, 7, 3, 5, 15, 3, 5, 7, 3, 17,
                  3, 5, 19, 3, 5, 7, 21, 3, 23, 5, 3, 7]
    tape = ARC(8)
    tape_rows = []
    for x in tape_pages:
        hit = tape.request(x)
        st = tape.stats()
        tape_rows.append({"page": x, "hit": 1 if hit else 0, **{k: st[k] for k in ("p", "t1", "t2", "b1", "b2")}})

    # invariants asserted by the paper (Section III); fail loudly, never silently
    inv = ARC(64)
    for i, x in enumerate(trace[:20000]):
        inv.request(x)
        assert 0 < len(inv.t1) + len(inv.b1) + len(inv.t2) + len(inv.b2) <= 2 * inv.c, i
        assert len(inv.t1) + len(inv.b1) <= inv.c, i
        assert len(inv.t1) + len(inv.t2) <= inv.c, i
    assert 0.0 <= walk.p <= 256.0

    data = {
        "source": "synthetic",
        "note": "Simulator transcribing Figure 4 of the FAST '03 ARC paper. Not the authors' traces.",
        "seed": SEED,
        "requests": len(trace),
        "pages": PAGES,
        "cacheSizes": c_choices,
        "sweep": sweep,
        "walk": {"c": 256, "every": every, "p": pvals, "t1": t1s, "t2": t2s,
                 "pMin": r3(min(pvals)), "pMax": r3(max(pvals))},
        "caseMix": {k: mix.cases[k] for k in ("I", "II", "III", "IV")},
        "caseMixTotal": total,
        "caseMixPct": {k: r3(100.0 * mix.cases[k] / total) for k in ("I", "II", "III", "IV")},
        "scan": {"c": c_scan, "pre": len(pre), "scan": len(scan), "post": len(post),
                 "post100": post100, "preRatio": arc_pre, "t2AtScanEnd": t2_at_scan_end,
                 "rows": scan_rows, "ratios": ratios},
        "tape": {"c": 8, "rows": tape_rows},
    }
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    with open(OUT, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False, indent=1, sort_keys=True)
        f.write("\n")
    print("wrote", OUT)
    print("sweep arc", sweep["arc"])
    print("sweep lru", sweep["lru"])
    print("caseMixPct", data["caseMixPct"])
    print("walk p range", data["walk"]["pMin"], data["walk"]["pMax"])
    print("scan ratios", [(r["at"], r["arc"], r["lru"]) for r in ratios[8:22]])


if __name__ == "__main__":
    main()
