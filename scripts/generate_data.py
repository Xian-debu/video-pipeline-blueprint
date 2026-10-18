
"""生成快速排序教学视频所需的全部真实数据（trace / stats / 递归树）。
运行：python3 scripts/generate_data.py  ->  data/lecture/*.json
不依赖第三方库。
"""
import json, os, random, sys, time
sys.setrecursionlimit(20000)

HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.dirname(HERE)
# 每部片子的数据只写进自己的目录：data/<film>/。共享的只有 design.spec.json 与
# type-exceptions.json，它们描述的是风格契约，不属于任何一部片子。
DATA = os.path.join(ROOT, "data", "lecture")

class Counter:
    __slots__ = ("cmp", "swap", "recursion")
    def __init__(self):
        self.cmp = 0
        self.swap = 0
        self.recursion = 0

# ---------------- Lomuto ----------------
def lomuto(a, lo, hi, c):
    pivot = a[hi]
    i = lo - 1
    for j in range(lo, hi):
        c.cmp += 1
        if a[j] <= pivot:
            i += 1
            if i != j:
                a[i], a[j] = a[j], a[i]
                c.swap += 1
    if i + 1 != hi:
        a[i + 1], a[hi] = a[hi], a[i + 1]
        c.swap += 1
    return i + 1

def quicksort_lomuto(a, lo, hi, c):
    if lo < hi:
        p = lomuto(a, lo, hi, c)
        quicksort_lomuto(a, lo, p - 1, c)
        quicksort_lomuto(a, p + 1, hi, c)

# ---------------- Hoare ----------------
def hoare_partition(a, lo, hi, c):
    pivot = a[lo]
    i, j = lo - 1, hi + 1
    while True:
        i += 1
        while True:
            c.cmp += 1
            if a[i] < pivot:
                i += 1
            else:
                break
        j -= 1
        while True:
            c.cmp += 1
            if a[j] > pivot:
                j -= 1
            else:
                break
        if i >= j:
            return j
        a[i], a[j] = a[j], a[i]
        c.swap += 1

def quicksort_hoare(a, lo, hi, c):
    if lo < hi:
        p = hoare_partition(a, lo, hi, c)
        quicksort_hoare(a, lo, p, c)
        quicksort_hoare(a, p + 1, hi, c)

# ---------------- randomized Lomuto ----------------
def quicksort_rand(a, lo, hi, c, rng):
    if lo < hi:
        k = rng.randrange(lo, hi + 1)
        a[k], a[hi] = a[hi], a[k]
        p = lomuto(a, lo, hi, c)
        quicksort_rand(a, lo, p - 1, c, rng)
        quicksort_rand(a, p + 1, hi, c, rng)

# ---------------- 三路划分（Dutch flag） ----------------
def quicksort_3way(a, lo, hi, c):
    if lo >= hi:
        return
    pivot = a[lo]
    lt, gt, i = lo, hi, lo
    while i <= gt:
        c.cmp += 1
        if a[i] < pivot:
            a[lt], a[i] = a[i], a[lt]
            c.swap += 1
            lt += 1
            i += 1
        elif a[i] > pivot:
            a[i], a[gt] = a[gt], a[i]
            c.swap += 1
            gt -= 1
        else:
            i += 1
    quicksort_3way(a, lo, lt - 1, c)
    quicksort_3way(a, gt + 1, hi, c)

# ---------------- 混合：阈值插入排序 + 三数取中 ----------------
def insertion(a, lo, hi, c):
    for i in range(lo + 1, hi + 1):
        key = a[i]
        j = i - 1
        while j >= lo:
            c.cmp += 1
            if a[j] > key:
                a[j + 1] = a[j]
                c.swap += 1
                j -= 1
            else:
                break
        a[j + 1] = key

def median3(a, lo, hi, c):
    mid = (lo + hi) // 2
    c.cmp += 2
    if a[mid] < a[lo]:
        a[mid], a[lo] = a[lo], a[mid]
    if a[hi] < a[lo]:
        a[hi], a[lo] = a[lo], a[hi]
    if a[hi] < a[mid]:
        a[hi], a[mid] = a[mid], a[hi]
    return mid

def quicksort_hybrid(a, lo, hi, c, threshold=16):
    while hi - lo > threshold:
        m = median3(a, lo, hi, c)
        a[m], a[hi] = a[hi], a[m]
        p = lomuto(a, lo, hi, c)
        # 尾递归消除：先递归较小的一侧
        if p - lo < hi - p:
            quicksort_hybrid(a, lo, p - 1, c, threshold)
            lo = p + 1
        else:
            quicksort_hybrid(a, p + 1, hi, c, threshold)
            hi = p - 1
    insertion(a, lo, hi, c)

# ---------------- 统计 ----------------
def run(fn, arr, **kw):
    a = list(arr)
    c = Counter()
    t0 = time.perf_counter()
    fn(a, 0, len(a) - 1, c, **kw)
    dt = (time.perf_counter() - t0) * 1000
    ok = a == sorted(arr)
    return {"cmp": c.cmp, "swap": c.swap, "ms": round(dt, 2), "sorted": ok}

def main():
    os.makedirs(DATA, exist_ok=True)
    N = 1000
    rng42 = random.Random(42)
    patterns = {
        "random": [rng42.randrange(1, 10 * N) for _ in range(N)],
        "sorted": list(range(N)),
        "reversed": list(range(N, 0, -1)),
        "all_equal": [7] * N,
    }
    variants = {
        "lomuto": (quicksort_lomuto, {}),
        "hoare": (quicksort_hoare, {}),
        "random": (quicksort_rand, {"rng": random.Random(7)}),
        "three_way": (quicksort_3way, {}),
        "hybrid_mo3": (quicksort_hybrid, {"threshold": 16}),
    }
    stats = {"n": N, "results": {}}
    for pname, arr in patterns.items():
        stats["results"][pname] = {}
        for vname, (fn, kw) in variants.items():
            stats["results"][pname][vname] = run(fn, arr, **kw)
    # 最坏情况计数验证：有序数组 + Lomuto = n(n-1)/2
    stats["theory"] = {"worst_cmp": N * (N - 1) // 2,
                       "avg_upper_2nlnn": round(2 * N * __import__("math").log(N), 1)}

    with open(os.path.join(DATA, "stats.json"), "w") as f:
        json.dump(stats, f, ensure_ascii=False, indent=1)

    # ---- 小数组逐步 trace（Lomuto，全部递归层） ----
    trace_arr = [7, 2, 1, 6, 8, 5, 3, 4]
    steps = []
    nodes = []

    def snap(a):
        return list(a)

    def rec_trace(a, lo, hi, depth, parent):
        if lo >= hi:
            if lo == hi:
                steps.append({"op": "leaf", "lo": lo, "hi": hi, "depth": depth,
                              "array": snap(a), "key": a[lo], "parent": parent})
            return
        nodes.append({"lo": lo, "hi": hi, "depth": depth, "size": hi - lo + 1,
                      "pivot_value": a[hi], "parent": parent, "id": f"{lo}-{hi}"})
        steps.append({"op": "enter", "lo": lo, "hi": hi, "depth": depth,
                      "array": snap(a), "pivot": a[hi], "parent": parent})
        pivot = a[hi]
        i = lo - 1
        for j in range(lo, hi):
            steps.append({"op": "compare", "lo": lo, "hi": hi, "depth": depth,
                          "i": i, "j": j, "pivot": pivot, "array": snap(a),
                          "cmp_value": a[j], "le": a[j] <= pivot})
            if a[j] <= pivot:
                i += 1
                if i != j:
                    a[i], a[j] = a[j], a[i]
                    steps.append({"op": "swap", "lo": lo, "hi": hi, "depth": depth,
                                  "i": i, "j": j, "pivot": pivot, "array": snap(a)})
        if i + 1 != hi:
            a[i + 1], a[hi] = a[hi], a[i + 1]
            steps.append({"op": "place", "lo": lo, "hi": hi, "depth": depth,
                          "p": i + 1, "pivot": pivot, "array": snap(a)})
        p = i + 1
        nodes[-1]["pivot_index"] = p
        steps.append({"op": "done", "lo": lo, "hi": hi, "depth": depth, "p": p,
                      "array": snap(a), "pivot": pivot})
        rec_trace(a, lo, p - 1, depth + 1, f"{lo}-{hi}")
        rec_trace(a, p + 1, hi, depth + 1, f"{lo}-{hi}")

    work = list(trace_arr)
    rec_trace(work, 0, len(work) - 1, 0, None)
    with open(os.path.join(DATA, "trace.json"), "w") as f:
        json.dump({"initial": trace_arr, "steps": steps, "nodes": nodes,
                   "sorted": sorted(trace_arr)}, f, ensure_ascii=False, indent=1)

    # ---- 代码清单（用于逐行高亮） ----
    code = [
        "def quicksort(a, lo, hi):",
        "    if lo < hi:",
        "        p = partition(a, lo, hi)",
        "        quicksort(a, lo, p - 1)",
        "        quicksort(a, p + 1, hi)",
        "",
        "def partition(a, lo, hi):",
        "    pivot = a[hi]",
        "    i = lo - 1",
        "    for j in range(lo, hi):",
        "        if a[j] <= pivot:",
        "            i += 1",
        "            a[i], a[j] = a[j], a[i]",
        "    a[i + 1], a[hi] = a[hi], a[i + 1]",
        "    return i + 1",
    ]
    with open(os.path.join(DATA, "code_lomuto.json"), "w") as f:
        json.dump({"lines": code}, f, ensure_ascii=False, indent=1)

    print(json.dumps(stats["results"]["random"], ensure_ascii=False))
    print("steps:", len(steps), "nodes:", len(nodes))

if __name__ == "__main__":
    main()
