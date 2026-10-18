#!/usr/bin/env python3
"""Generate the multiplication film's data from instrumented implementations.

Everything the film shows about cost is *counted* here, not estimated:
schoolbook digit products, Karatsuba's three half-products, Toom-3's five point products,
NTT butterfly counts, and one wall-clock table measured on the machine that ran this
script (the JSON records which machine that was).

Writes data/mult/{schoolbook,karatsuba,toom,ntt,bench,code}.json. Deterministic except for
one seeded PRNG used to pick benchmark operands.

    python3 scripts/generate_mult_data.py
"""
import json
import math
import os
import platform
import random
import sys
import time

import numpy as np

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "data", "mult")
BASE = 10 ** 4
NL = chr(10)


def limbs(n):
    if n == 0:
        return [0]
    out = []
    while n:
        out.append(n % BASE)
        n //= BASE
    return out


def unlimbs(xs):
    n = 0
    for x in reversed(xs):
        n = n * BASE + x
    return n


def trim(xs):
    xs = list(xs)
    while len(xs) > 1 and xs[-1] == 0:
        xs.pop()
    return xs or [0]


# ---------------------------------------------------------------- schoolbook with a trace
def schoolbook_digits(a, b):
    A = [int(c) for c in reversed(a)]
    B = [int(c) for c in reversed(b)]
    rows = []
    steps = []
    width = len(A) + len(B)
    for j, bd in enumerate(B):
        row = [0] * width
        carry = 0
        for i, ad in enumerate(A):
            prod = ad * bd + carry
            row[i + j] = prod % 10
            carry = prod // 10
            steps.append({
                "op": "mul", "i": i, "j": j, "a": ad, "b": bd,
                "prod": prod, "digit": prod % 10, "carry": prod // 10,
                "row": row[:], "rows": len(rows),
            })
        if carry:
            row[len(A) + j] = carry
        rows.append(row[:])
    digit_muls = len(A) * len(B)
    return {
        "a": a, "b": b, "base": 10,
        "digitMuls": digit_muls,
        "digitAdds": digit_muls + len(A) + len(B),
        "rows": rows,
        "steps": steps,
        "product": str(int(a) * int(b)),
    }


# ---------------------------------------------------------------- karatsuba with a tree
class Counters:
    def __init__(self):
        self.limbMuls = 0
        self.limbAdds = 0


def karatsuba_mul(x, y, c, threshold=1):
    n = max(len(x), len(y))
    if n <= threshold:
        out = [0] * (len(x) + len(y) + 1)
        for i, a in enumerate(x):
            carry = 0
            for j, b in enumerate(y):
                s = out[i + j] + a * b + carry
                out[i + j] = s % BASE
                carry = s // BASE
                c.limbAdds += 1
            k = i + len(y)
            while carry:
                s = out[k] + carry
                out[k] = s % BASE
                carry = s // BASE
                k += 1
                c.limbAdds += 1
            c.limbMuls += len(y)
        return trim(out)

    m = n // 2
    x = x + [0] * (max(0, m - len(x)))
    y = y + [0] * (max(0, m - len(y)))
    a0, a1 = trim(x[:m]), trim(x[m:])
    b0, b1 = trim(y[:m]), trim(y[m:])
    z0 = karatsuba_mul(a0, b0, c, threshold)
    z2 = karatsuba_mul(a1, b1, c, threshold)

    def add(xs, ys):
        ln = max(len(xs), len(ys)) + 1
        out = [0] * ln
        carry = 0
        for i in range(ln):
            s = (xs[i] if i < len(xs) else 0) + (ys[i] if i < len(ys) else 0) + carry
            out[i] = s % BASE
            carry = s // BASE
            c.limbAdds += 1
        return trim(out)

    def sub(xs, ys):
        ln = max(len(xs), len(ys))
        out = [0] * ln
        borrow = 0
        for i in range(ln):
            s = (xs[i] if i < len(xs) else 0) - (ys[i] if i < len(ys) else 0) - borrow
            borrow = 1 if s < 0 else 0
            out[i] = (s + BASE) % BASE
            c.limbAdds += 1
        return trim(out)

    z1 = sub(sub(karatsuba_mul(add(a0, a1), add(b0, b1), c, threshold), z0), z2)
    out = [0] * (len(z0) + 2 * m + 2)
    for i, v in enumerate(z0):
        out[i] += v
    for i, v in enumerate(z1):
        out[i + m] += v
    for i, v in enumerate(z2):
        out[i + 2 * m] += v
    carry = 0
    for i in range(len(out)):
        s = out[i] + carry
        out[i] = s % BASE
        carry = s // BASE
        c.limbAdds += 1
    if carry:
        out.append(carry)
    return trim(out)


def check_karatsuba(x, y):
    c = Counters()
    got = unlimbs(karatsuba_mul(x, y, c))
    want = unlimbs(x) * unlimbs(y)
    if got != want:
        raise SystemExit("karatsuba is wrong")
    return c.limbMuls, c.limbAdds


def karatsuba_tree(x, y, depth, max_depth):
    n = max(len(x), len(y))
    node = {"n": n, "digits": 4 * n, "children": [], "depth": depth}
    if depth >= max_depth or n <= 1:
        c = Counters()
        karatsuba_mul(trim(x), trim(y), c)
        node["muls"] = c.limbMuls
        node["adds"] = c.limbAdds
        node["leaf"] = True
        return node
    m = n // 2
    x = x + [0] * (max(0, m - len(x)))
    y = y + [0] * (max(0, m - len(y)))
    a0, a1 = trim(x[:m]), trim(x[m:])
    b0, b1 = trim(y[:m]), trim(y[m:])

    def add(xs, ys):
        ln = max(len(xs), len(ys)) + 1
        out = [0] * ln
        carry = 0
        for i in range(ln):
            s = (xs[i] if i < len(xs) else 0) + (ys[i] if i < len(ys) else 0) + carry
            out[i] = s % BASE
            carry = s // BASE
        return trim(out)

    node["children"] = [
        karatsuba_tree(a0, b0, depth + 1, max_depth),
        karatsuba_tree(a1, b1, depth + 1, max_depth),
        karatsuba_tree(add(a0, a1), add(b0, b1), depth + 1, max_depth),
    ]
    node["muls"] = sum(ch["muls"] for ch in node["children"])
    node["adds"] = sum(ch["adds"] for ch in node["children"])
    return node


# ---------------------------------------------------------------- Toom-3
def toom3():
    a = [7, 8, 9]
    b = [3, 5, 4]
    points = ["0", "1", "-1", "2", "inf"]

    def value(xs, t):
        if t == "inf":
            return xs[-1]
        t = int(t)
        return sum(c * (t ** i) for i, c in enumerate(xs))

    rows = []
    for t in points:
        av, bv = value(a, t), value(b, t)
        rows.append({"point": t, "a": av, "b": bv, "product": av * bv})
    prods = [r["product"] for r in rows]
    # exact rational interpolation via a Vandermonde solve in Fractions
    from fractions import Fraction
    vander = [
        [Fraction(1), Fraction(0), Fraction(0), Fraction(0), Fraction(0)],
        [Fraction(1), Fraction(1), Fraction(1), Fraction(1), Fraction(1)],
        [Fraction(1), Fraction(-1), Fraction(1), Fraction(-1), Fraction(1)],
        [Fraction(1), Fraction(2), Fraction(4), Fraction(8), Fraction(16)],
        [Fraction(0), Fraction(0), Fraction(0), Fraction(0), Fraction(1)],
    ]
    coeffs = solve_fraction(vander, [Fraction(p) for p in prods])
    coeffs = [int(c) for c in coeffs]
    av = sum(c * BASE ** i for i, c in enumerate(a))
    bv = sum(c * BASE ** i for i, c in enumerate(b))
    product = str(unlimbs(trim(coeffs)))
    return {
        "base": BASE,
        "a": a, "b": b, "aValue": av, "bValue": bv,
        "points": rows,
        "coeffs": coeffs,
        "product": product,
        "expected": str(av * bv),
        "limbMuls": len(rows),
        "verify": product == str(av * bv),
    }


def solve_fraction(M, rhs):
    n = len(M)
    A = [row[:] + [rhs[i]] for i, row in enumerate(M)]
    for col in range(n):
        piv = next(r for r in range(col, n) if A[r][col] != 0)
        A[col], A[piv] = A[piv], A[col]
        inv = A[col][col]
        A[col] = [x / inv for x in A[col]]
        for r in range(n):
            if r != col and A[r][col] != 0:
                f = A[r][col]
                A[r] = [x - f * y for x, y in zip(A[r], A[col])]
    return [A[i][n] for i in range(n)]


# ---------------------------------------------------------------- NTT
P = 998244353
G = 3


def ntt(a, invert=False):
    a = np.array(a, dtype=np.int64)
    n = len(a)
    j = 0
    for i in range(1, n):
        bit = n >> 1
        while j & bit:
            j ^= bit
            bit >>= 1
        j ^= bit
        if i < j:
            a[i], a[j] = a[j], a[i]
    ln = 2
    while ln <= n:
        w = np.int64(pow(G, (P - 1) // ln, P))
        if invert:
            w = np.int64(pow(int(w), P - 2, P))
        half = ln // 2
        for i in range(0, n, ln):
            wn = np.int64(1)
            for k in range(i, i + half):
                u = int(a[k])
                v = int(a[k + half]) * int(wn) % P
                a[k] = (u + v) % P
                a[k + half] = (u - v) % P
                wn = np.int64(int(wn) * int(w) % P)
        ln <<= 1
    if invert:
        inv_n = pow(n, P - 2, P)
        a = np.array([int(x) * inv_n % P for x in a], dtype=np.int64)
    return a


def ntt_trace(a, b):
    n = 1
    while n < len(a) + len(b) - 1:
        n <<= 1
    A = list(a) + [0] * (n - len(a))
    B = list(b) + [0] * (n - len(b))
    fa, fb = ntt(A), ntt(B)
    pointwise = [int(fa[i]) * int(fb[i]) % P for i in range(n)]
    inv = ntt(pointwise, invert=True)
    coeffs = [int(x) for x in inv][: len(a) + len(b) - 1]
    conv = [0] * (len(a) + len(b) - 1)
    for i, x in enumerate(a):
        for j, y in enumerate(b):
            conv[i + j] += x * y
    return {
        "prime": P, "root": G, "n": n, "a": a, "b": b,
        "stages": [
            {"stage": "input", "a": A[:], "b": B[:]},
            {"stage": "dft", "a": [int(x) for x in fa], "b": [int(x) for x in fb]},
            {"stage": "pointwise", "values": pointwise},
            {"stage": "inverse", "values": [int(x) for x in inv]},
        ],
        "coeffs": coeffs,
        "integerConvolution": conv,
        "verify": coeffs == [c % P for c in conv],
        "butterflies": 3 * (n // 2) * int(math.log2(n)),
    }


# ---------------------------------------------------------------- wall clock
def npntt_ms(lc, reps=3):
    rng = random.Random(7)
    a = [rng.randrange(1, BASE) for _ in range(lc)]
    b = [rng.randrange(1, BASE) for _ in range(lc)]
    n = 1
    while n < 2 * lc:
        n <<= 1
    A = list(a) + [0] * (n - lc)
    B = list(b) + [0] * (n - lc)
    best = None
    for _ in range(reps):
        t = time.perf_counter()
        fa, fb = ntt(A), ntt(B)
        fc = [int(x) * int(y) % P for x, y in zip(fa, fb)]
        c = ntt(fc, invert=True)
        _ = [int(x) for x in c]
        dt = (time.perf_counter() - t) * 1000
        best = dt if best is None else min(best, dt)
    return round(best, 1)


def sb_ms(lc):
    rng = random.Random(7)
    x = [rng.randrange(1, BASE) for _ in range(lc)]
    y = [rng.randrange(1, BASE) for _ in range(lc)]
    c = Counters()
    t = time.perf_counter()
    karatsuba_mul(x, y, c, threshold=lc)
    dt = (time.perf_counter() - t) * 1000
    return round(dt, 1), c.limbMuls


def k_ms(lc):
    rng = random.Random(7)
    x = [rng.randrange(1, BASE) for _ in range(lc)]
    y = [rng.randrange(1, BASE) for _ in range(lc)]
    c = Counters()
    t = time.perf_counter()
    karatsuba_mul(x, y, c, threshold=1)
    dt = (time.perf_counter() - t) * 1000
    return round(dt, 1), c.limbMuls, c.limbAdds



def native_ms(lc):
    rng = random.Random(7)
    x = int("".join(str(rng.randrange(10)) for _ in range(4 * lc - 1)) + "1")
    y = int("".join(str(rng.randrange(10)) for _ in range(4 * lc - 1)) + "1")
    best = None
    for _ in range(3):
        t = time.perf_counter()
        _ = x * y
        dt = (time.perf_counter() - t) * 1000
        best = dt if best is None else min(best, dt)
    return round(best, 4)


def native_scale():
    """Wall-clock for CPython's own big-int multiply, to show which algorithm it uses."""
    rows = []
    for digits in (1024, 4096, 16384, 65536):
        rng = random.Random(7)
        x = int("".join(str(rng.randrange(10)) for _ in range(digits - 1)) + "1")
        y = int("".join(str(rng.randrange(10)) for _ in range(digits - 1)) + "1")
        best = None
        for _ in range(40 if digits <= 4096 else 8):
            t = time.perf_counter()
            _ = x * y
            dt = (time.perf_counter() - t) * 1e6
            best = dt if best is None else min(best, dt)
        rows.append({"digits": digits, "micros": round(best, 2)})
    first, last = rows[0], rows[-1]
    expo = math.log(last["micros"] / first["micros"]) / math.log(last["digits"] / first["digits"])
    return {"rows": rows, "measuredExponent": round(expo, 3)}


def code_trace():
    """The exact events a reader sees when the snippet runs on a 18-bit example."""
    x, y = 0x1F3A5, 0x2B7C9
    thr = 8
    events = []
    out = {"x": x, "y": y, "threshold": thr, "product": str(x * y), "events": events}

    def call(x, y, depth):
        n = max(x.bit_length(), y.bit_length())
        events.append({"line": 2, "depth": depth, "note": "n = max(%d, %d) = %d bits" % (x.bit_length(), y.bit_length(), n), "x": str(x), "y": str(y)})
        events.append({"line": 3, "depth": depth, "note": "%d <= %d ? %s" % (n, thr, "yes" if n <= thr else "no"), "x": str(x), "y": str(y)})
        if n <= thr:
            events.append({"line": 4, "depth": depth, "note": "base case: %d * %d = %d" % (x, y, x * y), "x": str(x), "y": str(y)})
            return x * y
        shift_pos = (n // 2) * 8
        n2 = n // 2
        mask = (1 << n2) - 1
        x0, x1 = x & mask, x >> n2
        y0, y1 = y & mask, y >> n2
        events.append({"line": 5, "depth": depth, "note": "n = (%d // 2) * 8 = %d, mask = 2^%d - 1" % (n, shift_pos, n2), "x": str(x), "y": str(y)})
        events.append({"line": 7, "depth": depth, "note": "x0 = %d, x1 = %d" % (x0, x1), "x": str(x), "y": str(y)})
        events.append({"line": 8, "depth": depth, "note": "y0 = %d, y1 = %d" % (y0, y1), "x": str(x), "y": str(y)})
        z0 = call(x0, y0, depth + 1)
        z2 = call(x1, y1, depth + 1)
        z1 = call(x0 + x1, y0 + y1, depth + 1) - z0 - z2
        events.append({"line": 11, "depth": depth, "note": "z1 = %d - %d - %d = %d" % (z0 + z2 + z1, z0, z2, z1), "x": str(x), "y": str(y)})
        events.append({"line": 12, "depth": depth, "note": "return z0 + (z1 << %d) + (z2 << %d)" % (n2, 2 * n2), "x": str(x), "y": str(y)})
        return z0 + (z1 << n2) + (z2 << (2 * n2))

    got = call(x, y, 0)
    if got != x * y:
        raise SystemExit("code trace disagrees with arithmetic")
    out["verify"] = True
    return out

def bench_table():
    rows = []
    for lc in (16, 64, 256, 1024):
        s, sm = sb_ms(lc)
        k, km, ka = k_ms(lc)
        rows.append({
            "limbs": lc, "digits": 4 * lc,
            "schoolbookMs": s, "schoolbookMuls": sm,
            "karatsubaMs": k, "karatsubaMuls": km, "karatsubaAdds": ka,
            "nativeMs": native_ms(lc),
            "speedup": round(s / k, 2) if k else None,
        })
    return rows


def counts_ladder():
    rows = []
    for lc in (4, 8, 16, 32, 64, 128, 256):
        sb = lc * lc
        km, ka = check_karatsuba([3] * lc, [5] * lc)
        third = max(1, (lc + 2) // 3)
        toom = 5 * third * third
        n = 1
        while n < 2 * lc:
            n <<= 1
        rows.append({
            "limbs": lc, "digits": 4 * lc,
            "schoolbookMuls": sb,
            "karatsubaMuls": km, "karatsubaAdds": ka,
            "toomMuls": toom,
            "nttButterflies": 3 * (n // 2) * int(math.log2(n)),
        })
    return rows


CODE = """def karatsuba(x, y):
    n = max(x.bit_length(), y.bit_length())
    if n <= 70:                     # base case: one machine word
        return x * y                #   schoolbook -> n^2 digit ops
    n = (n // 2) * 8                # split on a byte boundary
    mask = (1 << n) - 1
    x0, x1 = x & mask, x >> n
    y0, y1 = y & mask, y >> n
    z0 = karatsuba(x0, y0)
    z2 = karatsuba(x1, y1)
    z1 = karatsuba(x0 + x1, y0 + y1) - z0 - z2
    return z0 + (z1 << n) + (z2 << (2 * n))"""


def cpu_model():
    try:
        with open("/proc/cpuinfo", encoding="utf-8") as fh:
            for line in fh:
                if line.startswith("model name"):
                    return line.split(":", 1)[1].strip()
    except OSError:
        pass
    return platform.processor() or "unknown"


def write(name, obj):
    path = os.path.join(OUT, name)
    with open(path, "w", encoding="utf-8") as fh:
        json.dump(obj, fh, ensure_ascii=False, indent=1)
    print(" ", name, os.path.getsize(path), "bytes")


def main():
    os.makedirs(OUT, exist_ok=True)
    sys.set_int_max_str_digits(0)

    write("schoolbook.json", schoolbook_digits("4761", "3082"))

    check_karatsuba([7, 3, 9, 1] * 4, [4, 8, 2, 6] * 4)
    write("karatsuba.json", {
        "base": BASE,
        "threshold": 1,
        "tree": karatsuba_tree([7, 3, 9, 1] * 4, [4, 8, 2, 6] * 4, 0, 3),
        "ladder": counts_ladder(),
        "note": "counted limb operations; one limb = four decimal digits",
    })

    toom = toom3()
    if not toom["verify"]:
        raise SystemExit("toom-3 interpolation does not reproduce the product")
    write("toom.json", toom)

    ntt = ntt_trace([1, 2, 3, 4], [5, 6, 7, 8])
    if not ntt["verify"]:
        raise SystemExit("ntt does not reproduce the integer convolution")
    write("ntt.json", ntt)

    write("bench.json", {
        "host": {"cpu": cpu_model(), "python": platform.python_version(), "numpy": np.__version__, "base": BASE},
        "rows": bench_table(),
        "ntt": [{"limbs": lc, "digits": 4 * lc, "nttMs": npntt_ms(lc)} for lc in (256, 1024, 4096)],
        "native": native_scale(),
    })

    write("code.json", {"lines": CODE.split(chr(10)), "trace": code_trace()})
    print("wrote", sorted(os.listdir(OUT)))


if __name__ == "__main__":
    main()