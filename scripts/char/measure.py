"""Measure the three-view reference sheet: one command, one file.

    python3 scripts/char/measure.py --image public/char/reference.png \
        --out data/char/ref_views.json

This is the only input to the model: scripts/char/gen.py reads ref_views.json and turns the
front/side silhouettes into a lofted body whose rings match them by construction. That is why
the numbers here are not allowed to drift — the gate (scripts/char/check.py) compares the
render against the same profile, so a change in this file silently moves the target.

Method (deliberately dumb: no learning, no thresholds that need tuning):
  foreground   chroma > 14 and luminance < 250 (white paper, saturated yellow figure; the grey
               shadow under the feet is low chroma, so it drops out)
  views        three fixed boxes, found once by column occupancy and then frozen — a measurement
               script that re-segments on every run is not a measurement (K70)
  profile      128 heights top to bottom; per row the left/right extent of the figure,
               normalised by figure height in pixels (so 1.0 == one figure height)
  crotch       first row where the silhouette splits into two runs more than 10 px apart
  cream patch  low-chroma interior above luminance 200, as a fraction of the figure area
"""
import argparse
import json
from collections import deque

import numpy as np
from PIL import Image

# Fixed view boxes in the 832x624 sheet (x0, x1, y0, y1).
VIEWS = {
    "front": (28, 313, 94, 565),
    "side": (328, 513, 94, 566),
    "back": (526, 805, 94, 563),
}


def foreground(path):
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float32)
    chroma = a.max(2) - a.min(2)
    lum = a.mean(2)
    return a, (chroma > 14) & (lum < 250)


def runs_of(row):
    xs = np.where(row)[0]
    if len(xs) == 0:
        return []
    out = []
    s = p = xs[0]
    for x in xs[1:]:
        if x - p > 2:
            out.append((s, p))
            s = x
        p = x
    out.append((s, p))
    return out


def interior_mask(fg):
    """Everything the border cannot reach without crossing the figure."""
    bg = np.zeros_like(fg)
    dq = deque()
    h, w = fg.shape
    for x in range(w):
        for y in (0, h - 1):
            if not fg[y, x] and not bg[y, x]:
                bg[y, x] = 1
                dq.append((y, x))
    for y in range(h):
        for x in (0, w - 1):
            if not fg[y, x] and not bg[y, x]:
                bg[y, x] = 1
                dq.append((y, x))
    while dq:
        y, x = dq.popleft()
        for dy, dx in ((1, 0), (-1, 0), (0, 1), (0, -1)):
            ny, nx = y + dy, x + dx
            if 0 <= ny < h and 0 <= nx < w and not fg[ny, nx] and not bg[ny, nx]:
                bg[ny, nx] = 1
                dq.append((ny, nx))
    return bg == 0


def measure_view(a, fg, box):
    x0, x1, y0, y1 = box
    hh = y1 - y0 + 1
    m = fg[y0:y1 + 1, x0:x1 + 1]
    rows = [runs_of(m[yy]) for yy in range(hh)]

    crotch = None
    for yy in range(hh):
        r0 = rows[yy]
        if r0 and len(r0) >= 2 and (r0[1][0] - r0[0][1]) > 10:
            crotch = yy
            break

    cx = (x1 - x0) / 2
    prof = []
    for i in range(128):
        yy = min(hh - 1, int((i + 0.5) * hh / 128))
        r0 = rows[yy]
        if not r0:
            prof.append([None, None])
            continue
        prof.append([round((r0[0][0] - cx) / hh, 4), round((r0[-1][1] - cx) / hh, 4)])

    sub = a[y0:y1 + 1, x0:x1 + 1]
    inner = interior_mask(m)
    chroma = sub.max(2) - sub.min(2)
    cream = inner & (chroma < 26) & (sub.mean(2) > 200)
    cream_info = None
    if cream.sum() > 200:
        ys, xs = np.where(cream)
        cream_info = {
            "bbox_rel": [round(float(xs.min()) / hh, 4), round(float(ys.min()) / hh, 4),
                         round(float(xs.max()) / hh, 4), round(float(ys.max()) / hh, 4)],
            "area_frac": round(float(cream.sum()) / float(inner.sum()), 4),
            "rgb": [round(float(v), 1) for v in np.median(sub[cream], 0)],
        }

    return {
        "bbox": [x0, y0, x1, y1],
        "h": hh,
        "prof128": prof,
        "crotch_rel": round(crotch / hh, 4) if crotch else None,
        "cream": cream_info,
    }


def main():
    ap = argparse.ArgumentParser(description="measure the three-view reference sheet")
    ap.add_argument("--image", default="public/char/reference.png")
    ap.add_argument("--out", default="data/char/ref_views.json")
    args = ap.parse_args()

    a, fg = foreground(args.image)
    out = {}
    for name, box in VIEWS.items():
        out[name] = measure_view(a, fg, box)

    with open(args.out, "w") as fh:
        json.dump(out, fh, indent=1)

    for name, v in out.items():
        c = v["cream"]
        print(name, "h", v["h"], "crotch", v["crotch_rel"],
              "cream_area", c["area_frac"] if c else None,
              "w_over_h", round(v["prof128"][64][1] - v["prof128"][64][0], 4))


if __name__ == "__main__":
    main()
