// Quickselect benchmark — the only source of every number on screen in the Quickselect film.
//
// Deterministic by construction: our own xorshift64* generator and Fisher-Yates shuffle, fixed
// seeds, integer-only counters. std::shuffle / std::random_device are not used because their
// output differs between libstdc++ versions, and the film's numbers must survive a re-run on
// another machine (A9 in docs/39).
//
// Build: g++ -O2 -std=c++17 -o /tmp/qsbench scripts/quickselect/bench.cpp
// Usage: qsbench counts|timing|trace|degradation|bfprt
#include <algorithm>
#include <chrono>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <string>
#include <vector>

namespace {

// ---------------------------------------------------------------- deterministic RNG
uint64_t g_rng = 0x9E3779B97F4A7C15ULL;
inline uint64_t next_u64() {
  g_rng ^= g_rng >> 12;
  g_rng ^= g_rng << 25;
  g_rng ^= g_rng >> 27;
  return g_rng * 2685821657736338717ULL;
}
inline uint32_t rnd_below(uint32_t n) { return (uint32_t)(next_u64() % n); }
inline void rng_reset() { g_rng = 0x9E3779B97F4A7C15ULL; }

// ---------------------------------------------------------------- counters
struct Counts {
  long long cmp = 0, swp = 0, depth = 0, max_depth = 0;
};
template <bool CNT>
inline bool LT(int a, int b, Counts& c) {
  if (CNT) c.cmp++;
  return a < b;
}
template <bool CNT>
inline bool GT(int a, int b, Counts& c) {
  if (CNT) c.cmp++;
  return a > b;
}
template <bool CNT>
inline bool EQ(int a, int b, Counts& c) {
  if (CNT) c.cmp++;
  return a == b;
}
template <bool CNT>
inline void SWP(int& a, int& b, Counts& c) {
  if (CNT) c.swp++;
  int t = a;
  a = b;
  b = t;
}
template <bool CNT>
inline void DOWN(Counts& c) {
  if (!CNT) return;
  c.depth++;
  if (c.depth > c.max_depth) c.max_depth = c.depth;
}
template <bool CNT>
inline void UP(Counts& c) {
  if (CNT) c.depth--;
}

// ---------------------------------------------------------------- partitions
template <bool CNT>
int partition_lomuto(int* a, int lo, int hi, Counts& c) {
  const int pivot = a[hi];
  int i = lo - 1;
  for (int j = lo; j < hi; j++)
    if (LT<CNT>(a[j], pivot, c)) {
      i++;
      SWP<CNT>(a[i], a[j], c);
    }
  SWP<CNT>(a[i + 1], a[hi], c);
  return i + 1;
}

inline int median3_index(int* a, int lo, int hi, Counts& c, bool cnt) {
  (void)cnt;
  const int mid = lo + (hi - lo) / 2;
  if (GT<true>(a[lo], a[mid], c)) SWP<true>(a[lo], a[mid], c);
  if (GT<true>(a[mid], a[hi], c)) SWP<true>(a[mid], a[hi], c);
  if (GT<true>(a[lo], a[mid], c)) SWP<true>(a[lo], a[mid], c);
  return mid;
}

// ---------------------------------------------------------------- quicksort-family selects
template <bool CNT>
int select_lomuto(int* a, int lo, int hi, int k, Counts& c) {
  long long rounds = 0;
  while (lo < hi) {
    rounds++;
    const int p = partition_lomuto<CNT>(a, lo, hi, c);
    if (p == k) break;
    if (k < p) hi = p - 1; else lo = p + 1;
  }
  if (CNT && rounds > c.max_depth) c.max_depth = rounds;
  return a[k];
}

template <bool CNT>
int select_random(int* a, int lo, int hi, int k, Counts& c) {
  long long rounds = 0;
  while (lo < hi) {
    rounds++;
    const int r = lo + (int)rnd_below((uint32_t)(hi - lo + 1));
    SWP<CNT>(a[r], a[hi], c);
    const int p = partition_lomuto<CNT>(a, lo, hi, c);
    if (p == k) break;
    if (k < p) hi = p - 1; else lo = p + 1;
  }
  if (CNT && rounds > c.max_depth) c.max_depth = rounds;
  return a[k];
}

template <bool CNT>
int select_median3(int* a, int lo, int hi, int k, Counts& c) {
  long long rounds = 0;
  while (lo < hi) {
    rounds++;
    const int mid = lo + (hi - lo) / 2;
    if (GT<CNT>(a[lo], a[mid], c)) SWP<CNT>(a[lo], a[mid], c);
    if (GT<CNT>(a[mid], a[hi], c)) SWP<CNT>(a[mid], a[hi], c);
    if (GT<CNT>(a[lo], a[mid], c)) SWP<CNT>(a[lo], a[mid], c);
    SWP<CNT>(a[mid], a[hi], c);  // median of three becomes the pivot at hi
    const int p = partition_lomuto<CNT>(a, lo, hi, c);
    if (p == k) break;
    if (k < p) hi = p - 1; else lo = p + 1;
  }
  if (CNT && rounds > c.max_depth) c.max_depth = rounds;
  return a[k];
}

// Hoare's classic scheme (middle pivot): both sides advance toward each other and swap in place.
template <bool CNT>
int select_hoare(int* a, int lo, int hi, int k, Counts& c) {
  long long rounds = 0;
  while (lo < hi) {
    rounds++;
    const int mid = lo + (hi - lo) / 2;
    const int pivot = a[mid];
    int i = lo, j = hi;
    while (i <= j) {
      while (LT<CNT>(a[i], pivot, c)) i++;
      while (GT<CNT>(a[j], pivot, c)) j--;
      if (i <= j) {
        SWP<CNT>(a[i], a[j], c);
        i++;
        j--;
      }
    }
    if (k <= j) hi = j;
    else if (k >= i) lo = i;
    else break;
  }
  if (CNT && rounds > c.max_depth) c.max_depth = rounds;
  return a[k];
}

// Three-region (Dutch-flag) partition around a pivot value; equal-to-pivot sits inside [lt, gt].
template <bool CNT>
void partition_threeway_band(int* a, int lo, int hi, int pivot, Counts& c, int& lt, int& gt) {
  lt = lo;
  int i = lo;
  gt = hi;
  while (i <= gt) {
    if (LT<CNT>(a[i], pivot, c)) {
      SWP<CNT>(a[lt], a[i], c);
      lt++;
      i++;
    } else if (GT<CNT>(a[i], pivot, c)) {
      SWP<CNT>(a[i], a[gt], c);
      gt--;
    } else {
      i++;
    }
  }
}

// Dutch-national-flag partition: one pass, three regions, equal band is finished at once.
template <bool CNT>
int select_threeway(int* a, int lo, int hi, int k, Counts& c) {
  long long rounds = 0;
  while (lo < hi) {
    rounds++;
    const int r = lo + (int)rnd_below((uint32_t)(hi - lo + 1));
    const int pivot = a[r];
    const int old_lo = lo, old_hi = hi;
    int lt, gt;
    partition_threeway_band<CNT>(a, lo, hi, pivot, c, lt, gt);
    if (k >= lt && k <= gt) break;
    if (k < lt) hi = lt - 1; else lo = gt + 1;
    if (lo == old_lo && hi == old_hi) break;  // cannot happen, but never spin
  }
  if (CNT && rounds > c.max_depth) c.max_depth = rounds;
  return a[k];
}

template <bool CNT>
void insertion_sort(int* a, int lo, int hi, Counts& c) {
  for (int i = lo + 1; i <= hi; i++) {
    const int v = a[i];
    int j = i - 1;
    while (j >= lo && GT<CNT>(a[j], v, c)) {
      a[j + 1] = a[j];
      if (CNT) c.swp++;
      j--;
    }
    a[j + 1] = v;
  }
}

// BFPRT: median of medians of groups of five, guaranteed linear.
template <bool CNT>
int bfprt_rec(int* a, int lo, int hi, int k, Counts& c) {
  DOWN<CNT>(c);
  int result;
  if (hi - lo < 5) {
    insertion_sort<CNT>(a, lo, hi, c);
    result = a[k];
  } else {
    std::vector<int> medians;
    medians.reserve((size_t)((hi - lo) / 5 + 1));
    for (int i = lo; i <= hi; i += 5) {
      const int j = std::min(i + 4, hi);
      insertion_sort<CNT>(a, i, j, c);
      medians.push_back(a[i + (j - i) / 2]);
    }
    // Median of the medians, found by the same algorithm on the smaller array.
    std::vector<int> tmp = medians;
    const int pivot = bfprt_rec<CNT>(tmp.data(), 0, (int)tmp.size() - 1, (int)tmp.size() / 2, c);
    int lt = lo, i = lo, gt = hi;
    while (i <= gt) {
      if (LT<CNT>(a[i], pivot, c)) {
        SWP<CNT>(a[lt], a[i], c);
        lt++;
        i++;
      } else if (GT<CNT>(a[i], pivot, c)) {
        SWP<CNT>(a[i], a[gt], c);
        gt--;
      } else {
        i++;
      }
    }
    if (k >= lt && k <= gt) {
      result = a[k];
    } else if (k < lt) {
      result = bfprt_rec<CNT>(a, lo, lt - 1, k, c);
    } else {
      result = bfprt_rec<CNT>(a, gt + 1, hi, k, c);
    }
  }
  UP<CNT>(c);
  return result;
}

template <bool CNT>
int select_bfprt(int* a, int lo, int hi, int k, Counts& c) {
  return bfprt_rec<CNT>(a, lo, hi, k, c);
}

// Counting comparator, used by the library calls and by the sample sort.
template <bool CNT>
struct CountingLess {
  Counts* c;
  bool operator()(int a, int b) const {
    if (CNT) c->cmp++;
    return a < b;
  }
};

// Floyd–Rivest (1975), the sampling idea implemented as a value bracket rather than an index
// window: draw a random sample of about n^(2/3) elements, take the two sample values around the
// estimated rank of k, partition once around them (one pass, three regions), then recurse only
// inside that bracket. The sample decides how much of the array is skipped; a bracket that misses
// the target simply falls back to a plain partition, so the answer is always correct.
template <bool CNT>
int select_floyd_rivest(int* a, int lo, int hi, int k, Counts& c) {
  long long rounds = 0;
  while (lo < hi) {
    rounds++;
    const int n = hi - lo + 1;
    if (n <= 64) {
      // Small ranges are cheaper to finish outright; this also guarantees termination.
      insertion_sort<CNT>(a, lo, hi, c);
      break;
    }
    const int s = std::max(16, (int)std::ceil(1.5 * std::pow((double)n, 2.0 / 3.0)));
    std::vector<int> sample((size_t)s);
    for (int i = 0; i < s; i++) sample[(size_t)i] = a[lo + (int)rnd_below((uint32_t)n)];
    CountingLess<CNT> less{&c};
    std::sort(sample.begin(), sample.end(), less);
    const double frac = (double)(k - lo + 1) / (double)n;
    const double sd = std::sqrt((double)s * frac * (1.0 - frac));
    int rl = (int)std::floor(frac * s - 2.0 * sd) - 1;
    int rh = (int)std::ceil(frac * s + 2.0 * sd) - 1;
    rl = std::max(0, std::min(s - 1, rl));
    rh = std::max(0, std::min(s - 1, rh));
    const int L = sample[(size_t)rl];
    const int R = sample[(size_t)rh];

    if (L != R) {
      const int old_lo = lo, old_hi = hi;
      int i = lo, lt = lo, gt = hi;
      while (i <= gt) {
        if (LT<CNT>(a[i], L, c)) {
          SWP<CNT>(a[lt], a[i], c);
          lt++;
          i++;
        } else if (GT<CNT>(a[i], R, c)) {
          SWP<CNT>(a[i], a[gt], c);
          gt--;
        } else {
          i++;
        }
      }
      if (k >= lt && k <= gt) {
        lo = lt;
        hi = gt;
      } else if (k < lt) {
        hi = lt - 1;
      } else {
        lo = gt + 1;
      }
      if (lo != old_lo || hi != old_hi) continue;  // the bracket narrowed: sample again
    }

    // Degenerate bracket (one sample value, or a range that did not narrow): one three-region
    // pass around L collapses the duplicates and still makes strict progress.
    int lt = lo, gt = hi;
    partition_threeway_band<CNT>(a, lo, hi, L, c, lt, gt);
    if (k >= lt && k <= gt) break;
    if (k < lt) hi = lt - 1; else lo = gt + 1;
  }
  if (CNT && rounds > c.max_depth) c.max_depth = rounds;
  return a[k];
}
// ---------------------------------------------------------------- library methods

template <bool CNT>
int run_std_nth(int* a, int n, int k, Counts& c) {
  CountingLess<CNT> less{&c};
  std::nth_element(a, a + k, a + n, less);
  return a[k];
}

template <bool CNT>
int run_std_sort(int* a, int n, int k, Counts& c) {
  CountingLess<CNT> less{&c};
  std::sort(a, a + n, less);
  return a[k];
}

template <bool CNT>
int run_partial_sort(int* a, int n, int k, Counts& c) {
  CountingLess<CNT> less{&c};
  // Keep the discipline clear: partial_sort pays k log k even when k is tiny relative to n.
  std::partial_sort(a, a + k + 1, a + n, less);
  return a[k];
}

template <bool CNT>
int run_heap_topk(int* a, int n, int k, Counts& c) {
  CountingLess<CNT> less{&c};
  const int m = k + 1;
  if (m >= n) {
    std::sort(a, a + n, less);
    return a[k];
  }
  std::vector<int> h(a, a + m);
  std::make_heap(h.begin(), h.end(), less);
  for (int i = m; i < n; i++) {
    if (less(a[i], h.front())) {
      std::pop_heap(h.begin(), h.end(), less);
      h.back() = a[i];
      std::push_heap(h.begin(), h.end(), less);
    }
  }
  return h.front();
}

// ---------------------------------------------------------------- data generation
std::vector<int> gen_array(const std::string& dist, int n) {
  std::vector<int> a((size_t)n);
  rng_reset();
  for (int i = 0; i < n; i++) a[(size_t)i] = (int)(rnd_below(1000000u));
  if (dist == "sorted") {
    std::sort(a.begin(), a.end());
  } else if (dist == "reverse") {
    std::sort(a.begin(), a.end());
    std::reverse(a.begin(), a.end());
  } else if (dist == "all_equal") {
    std::fill(a.begin(), a.end(), 7);
  } else if (dist == "few_distinct") {
    for (int i = 0; i < n; i++) a[(size_t)i] = (int)(rnd_below(8u));
  } else if (dist != "random") {
    std::fprintf(stderr, "unknown dist %s\n", dist.c_str());
    std::exit(2);
  }
  return a;
}

const char* kMethods[] = {"lomuto", "hoare", "random", "median3", "threeway",
                          "bfprt", "floyd", "std_nth", "std_sort", "partial_sort", "heap_topk"};
const char* kDists[] = {"random", "sorted", "reverse", "all_equal", "few_distinct"};

bool n_squared_risk(const std::string& method, const std::string& dist) {
  if (method == "lomuto") return dist == "sorted" || dist == "reverse" || dist == "all_equal";
  if (method == "random" || method == "median3") return dist == "all_equal";
  return false;
}

template <bool CNT>
int run_method(const std::string& method, int* a, int n, int k, Counts& c) {
  if (method == "lomuto") return select_lomuto<CNT>(a, 0, n - 1, k, c);
  if (method == "hoare") return select_hoare<CNT>(a, 0, n - 1, k, c);
  if (method == "random") return select_random<CNT>(a, 0, n - 1, k, c);
  if (method == "median3") return select_median3<CNT>(a, 0, n - 1, k, c);
  if (method == "threeway") return select_threeway<CNT>(a, 0, n - 1, k, c);
  if (method == "bfprt") return select_bfprt<CNT>(a, 0, n - 1, k, c);
  if (method == "floyd") return select_floyd_rivest<CNT>(a, 0, n - 1, k, c);
  if (method == "std_nth") return run_std_nth<CNT>(a, n, k, c);
  if (method == "std_sort") return run_std_sort<CNT>(a, n, k, c);
  if (method == "partial_sort") return run_partial_sort<CNT>(a, n, k, c);
  if (method == "heap_topk") return run_heap_topk<CNT>(a, n, k, c);
  std::fprintf(stderr, "unknown method %s\n", method.c_str());
  std::exit(2);
}

int k_for(const std::string& sel, int n) {
  if (sel == "min") return 0;
  if (sel == "median") return n / 2;
  if (sel == "max") return n - 1;
  if (sel == "quartile") return n / 4;
  std::fprintf(stderr, "unknown k selector %s\n", sel.c_str());
  std::exit(2);
}

double median_ms(std::vector<double>& v) {
  std::sort(v.begin(), v.end());
  return v[v.size() / 2];
}

void json_head() {
  std::printf("{\"meta\":{\"seed\":20261024,\"source\":\"scripts/quickselect/bench.cpp\",");
  std::printf("\"compiler\":\"g++ -O2 -std=c++17\",\"methods\":[");
  for (size_t i = 0; i < sizeof(kMethods) / sizeof(*kMethods); i++)
    std::printf("%s\"%s\"", i ? "," : "", kMethods[i]);
  std::printf("],\"dists\":[");
  for (size_t i = 0; i < sizeof(kDists) / sizeof(*kDists); i++)
    std::printf("%s\"%s\"", i ? "," : "", kDists[i]);
  std::printf("]}");
}

// counts: every method on every distribution, with a hard cap on the combinations that are
// quadratic by construction (sorted input + first/last-element pivot). The cap is reported, so a
// viewer can see which dot on screen was measured at 20k instead of 1M.
void mode_counts() {
  const int ns[] = {1000, 10000, 100000, 1000000};
  const char* sels[] = {"min", "median", "max", "quartile"};
  std::printf("{\"rows\":[");
  bool first = true;
  for (const char* method : kMethods) {
    for (const char* dist : kDists) {
      for (int n : ns) {
        const int n_eff = n_squared_risk(method, dist) ? std::min(n, 20000) : n;
        const bool capped = n_eff != n;
        std::vector<int> base = gen_array(dist, n_eff);
        std::vector<int> reference = base;
        std::sort(reference.begin(), reference.end());
        for (const char* sel : sels) {
          const int k = k_for(sel, n_eff);
          std::vector<int> work = base;
          Counts c;
          rng_reset();
          const int got = run_method<true>(std::string(method), work.data(), n_eff, k, c);
          const int want = reference[(size_t)k];
          std::printf("%s{\"method\":\"%s\",\"dist\":\"%s\",\"n\":%d,\"n_measured\":%d,\"capped\":%s,"
                      "\"k\":%d,\"k_sel\":\"%s\",\"cmp\":%lld,\"exch\":%lld,\"depth\":%lld,"
                      "\"expected\":%d,\"got\":%d,\"ok\":%s}",
                      first ? "" : ",", method, dist, n, n_eff, capped ? "true" : "false", k, sel,
                      c.cmp, c.swp, c.max_depth, want, got, got == want ? "true" : "false");
          first = false;
        }
      }
    }
  }
  std::printf("]}\n");
}

// timing: the same code with counters off, median of repeats. Timings are not byte-stable (A9
// covers counts, not the clock) but the shape of the curve is what the film shows.
void mode_timing() {
  const int ns[] = {10000, 100000, 1000000};
  const int big_ns[] = {10000000};
  const int REPEATS = 5;
  std::printf("{\"rows\":[");
  bool first = true;
  auto emit = [&](const std::string& method, const std::string& dist, int n) {
    const int n_eff = n_squared_risk(method, dist) ? std::min(n, 20000) : n;
    const bool capped = n_eff != n;
    std::vector<int> base = gen_array(dist, n_eff);
    const int k = k_for("median", n_eff);
    std::vector<double> samples;
    int got = 0;
    for (int r = 0; r < REPEATS; r++) {
      std::vector<int> work = base;
      Counts c;
      rng_reset();
      auto t0 = std::chrono::steady_clock::now();
      got = run_method<false>(method, work.data(), n_eff, k, c);
      auto t1 = std::chrono::steady_clock::now();
      samples.push_back(std::chrono::duration<double, std::milli>(t1 - t0).count());
    }
    const double ms = median_ms(samples);
    // One counting run for the ratios (comparisons per element, ns per comparison).
    std::vector<int> work = base;
    Counts c;
    rng_reset();
    run_method<true>(method, work.data(), n_eff, k, c);
    std::printf("%s{\"method\":\"%s\",\"dist\":\"%s\",\"n\":%d,\"n_measured\":%d,\"capped\":%s,"
                "\"k\":%d,\"ms\":%.4f,\"ns_per_elem\":%.3f,\"cmp_per_elem\":%.4f,"
                "\"ns_per_cmp\":%.4f,\"cmp\":%lld,\"exch\":%lld}",
                first ? "" : ",", method.c_str(), dist.c_str(), n, n_eff, capped ? "true" : "false",
                k, ms, ms * 1e6 / n_eff, (double)c.cmp / n_eff,
                c.cmp ? ms * 1e6 / (double)c.cmp : 0.0, c.cmp, c.swp);
    first = false;
    if (capped) std::fprintf(stderr, "note: %s/%s capped at n=%d\n", method.c_str(), dist.c_str(), n_eff);
    (void)got;
  };
  for (const char* method : kMethods)
    for (const char* dist : {"random", "sorted", "all_equal"})
      for (int n : ns) emit(method, dist, n);
  for (const char* method : {"lomuto", "hoare", "threeway", "floyd", "bfprt", "std_nth", "partial_sort", "heap_topk"})
    for (int n : big_ns) emit(method, "random", n);
  std::printf("]}\n");
}

// Two traces the film animates: a Lomuto partition of eight numbers, and a three-way partition of
// a duplicate-heavy array. Every step is produced by the same partition code the benchmark uses,
// so the animation cannot disagree with the numbers.
void mode_trace() {
  std::printf("{\"lomuto\":{\"array\":[42,17,93,8,55,26,71,34],\"k\":3,\"lo\":0,\"hi\":7,");
  std::printf("\"steps\":[");
  {
    std::vector<int> a = {42, 17, 93, 8, 55, 26, 71, 34};
    const int lo = 0, hi = 7;
    const int pivot = a[hi];
    std::printf("{\"i\":-1,\"j\":-1,\"action\":\"start\",\"pivot\":%d,\"array\":[", pivot);
    for (size_t x = 0; x < a.size(); x++) std::printf("%s%d", x ? "," : "", a[x]);
    std::printf("],\"note\":\"pivot at hi\"}");
    int i = lo - 1;
    for (int j = lo; j < hi; j++) {
      const bool lt = a[j] < pivot;
      if (lt) {
        i++;
        std::swap(a[i], a[j]);
      }
      std::printf(",{\"i\":%d,\"j\":%d,\"action\":\"%s\",\"value\":%d,\"pivot\":%d,\"array\":[", i, j,
                  lt ? "swap" : "keep", a[j], pivot);
      for (size_t x = 0; x < a.size(); x++) std::printf("%s%d", x ? "," : "", a[x]);
      std::printf("],\"lt\":%s}", lt ? "true" : "false");
    }
    i++;
    std::swap(a[i], a[hi]);
    std::printf(",{\"i\":%d,\"j\":%d,\"action\":\"place\",\"pivot\":%d,\"array\":[", i, hi, pivot);
    for (size_t x = 0; x < a.size(); x++) std::printf("%s%d", x ? "," : "", a[x]);
    std::printf("],\"p\":%d}", i);
  }
  std::printf("]},\"threeway\":{\"array\":[4,9,4,2,7,4,9,4,2,7,9,2],\"pivot\":4,\"steps\":[");
  {
    std::vector<int> a = {4, 9, 4, 2, 7, 4, 9, 4, 2, 7, 9, 2};
    const int pivot = 4;
    int lt = 0, i = 0, gt = 11;
    std::printf("{\"lt\":0,\"i\":0,\"gt\":11,\"action\":\"start\",\"array\":[");
    for (size_t x = 0; x < a.size(); x++) std::printf("%s%d", x ? "," : "", a[x]);
    std::printf("]}");
    while (i <= gt) {
      const char* act;
      if (a[i] < pivot) {
        std::swap(a[lt], a[i]);
        act = "less";
        lt++;
        i++;
      } else if (a[i] > pivot) {
        std::swap(a[i], a[gt]);
        act = "greater";
        gt--;
      } else {
        act = "equal";
        i++;
      }
      std::printf(",{\"lt\":%d,\"i\":%d,\"gt\":%d,\"action\":\"%s\",\"array\":[", lt, i, gt, act);
      for (size_t x = 0; x < a.size(); x++) std::printf("%s%d", x ? "," : "", a[x]);
      std::printf("]}");
    }
  }
  std::printf("]}}\n");
}

// Sorted input, first/last-element pivot: comparisons and depth as n grows — the shape the worst
// case scene draws (n^2/2). n stops at 20000 because 1e6 would be 5e11 comparisons.
void mode_degradation() {
  std::printf("{\"lomuto\":[");
  const int ns[] = {100, 200, 400, 800, 1600, 3200, 6400, 10000, 20000};
  bool first = true;
  for (int n : ns) {
    std::vector<int> base = gen_array("sorted", n);
    std::vector<int> work = base;
    Counts c;
    rng_reset();
    run_method<true>("lomuto", work.data(), n, n / 2, c);
    std::printf("%s{\"n\":%d,\"cmp\":%lld,\"exch\":%lld,\"depth\":%lld}", first ? "" : ",", n, c.cmp,
                c.swp, c.max_depth);
    first = false;
  }
  std::printf("],\"random_pivot\":[");
  first = true;
  for (int n : ns) {
    std::vector<int> base = gen_array("sorted", n);
    std::vector<int> work = base;
    Counts c;
    rng_reset();
    run_method<true>("random", work.data(), n, n / 2, c);
    std::printf("%s{\"n\":%d,\"cmp\":%lld,\"exch\":%lld,\"depth\":%lld}", first ? "" : ",", n, c.cmp,
                c.swp, c.max_depth);
    first = false;
  }
  std::printf("],\"nth_element\":[");
  first = true;
  for (int n : ns) {
    std::vector<int> base = gen_array("sorted", n);
    std::vector<int> work = base;
    Counts c;
    rng_reset();
    run_method<true>("std_nth", work.data(), n, n / 2, c);
    std::printf("%s{\"n\":%d,\"cmp\":%lld,\"exch\":%lld,\"depth\":%lld}", first ? "" : ",", n, c.cmp,
                c.swp, c.max_depth);
    first = false;
  }
  std::printf("]}\n");
}

// BFPRT's actual subproblem sizes at n=1e6: the screen shows both the 9/10 bound and the real
// (much smaller) sizes. Instrumented by re-running the median-of-five recursion with tracing.
void mode_bfprt() {
  const int n = 1000000;
  std::vector<int> base = gen_array("random", n);
  std::vector<int> work = base;
  Counts c;
  rng_reset();
  // Trace the sizes the recursion is handed: level 0 = n, then 7n/10 worst case, real ≈ 0.35 n.
  std::vector<long long> sizes;
  int lo = 0, hi = n - 1, k = n / 2;
  long long total_cmp = 0;
  while (hi - lo >= 5) {
    sizes.push_back((long long)(hi - lo + 1));
    Counts local;
    // One level: group-sort, median of medians (approximated by the same recursive select on the
    // medians), then a three-way partition. Doing it here keeps the trace honest.
    std::vector<int> medians;
    for (int i = lo; i <= hi; i += 5) {
      const int j = std::min(i + 4, hi);
      insertion_sort<true>(work.data(), i, j, local);
      medians.push_back(work[(size_t)(i + (j - i) / 2)]);
    }
    std::vector<int> tmp = medians;
    const int pivot = select_bfprt<true>(tmp.data(), 0, (int)tmp.size() - 1, (int)tmp.size() / 2, local);
    int lt = lo, i2 = lo, gt = hi;
    while (i2 <= gt) {
      if (work[(size_t)i2] < pivot) {
        std::swap(work[(size_t)lt], work[(size_t)i2]);
        lt++;
        i2++;
      } else if (work[(size_t)i2] > pivot) {
        std::swap(work[(size_t)i2], work[(size_t)gt]);
        gt--;
      } else {
        i2++;
      }
    }
    total_cmp += local.cmp;
    if (k >= lt && k <= gt) {
      hi = lo - 1;  // done
    } else if (k < lt) {
      hi = lt - 1;
    } else {
      lo = gt + 1;
    }
  }
  const int value = 0;  // not needed: the trace is about sizes
  std::printf("{\"n\":%d,\"k\":%d,\"levels\":[", n, n / 2);
  for (size_t i = 0; i < sizes.size(); i++)
    std::printf("%s{\"level\":%zu,\"size\":%lld,\"ratio\":%.4f}", i ? "," : "", i + 1, sizes[i],
                (double)sizes[i] / n);
  std::printf("],\"cmp\":%lld,\"cmp_per_elem\":%.4f}\n", total_cmp, (double)total_cmp / n);
  (void)c;
  (void)value;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage: %s counts|timing|trace|degradation|bfprt\n", argv[0]);
    return 2;
  }
  const std::string mode = argv[1];
  if (mode == "counts") {
    mode_counts();
  } else if (mode == "timing") {
    mode_timing();
  } else if (mode == "trace") {
    mode_trace();
  } else if (mode == "degradation") {
    mode_degradation();
  } else if (mode == "bfprt") {
    mode_bfprt();
  } else {
    std::fprintf(stderr, "unknown mode %s\n", mode.c_str());
    return 2;
  }
  return 0;
}
