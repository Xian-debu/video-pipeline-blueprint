#!/usr/bin/env python3
"""Print luma statistics for a still (PNG/JPG) or a video frame.

The three_frame_lint gate answers "is the frame empty / is it full / is it stable".
It does not answer "is the frame blown out": a shot can pass coverage and still have
its subject clipped to 255, which is exactly how the backlash gears lost their shape.
This tool measures that, so a colour change can be argued with numbers instead of taste.

  python3 scripts/qa/frame_stats.py out/verify/gears_6600.png
  python3 scripts/qa/frame_stats.py film.mp4 --frame 6600

Reported per frame: mean, p1/p50/p99, the share of pixels at or above 250 (clipped
highlights) and at or below 8 (crushed blacks). Both shares are what a tone curve is
supposed to keep small; the target is < 0.5% clipped and < 2% crushed for a lit 3D shot.
"""
import argparse
import subprocess
import sys

import numpy as np


def luma(path: str, frame: int | None) -> np.ndarray:
    cmd = ["ffmpeg", "-v", "error"]
    if path.lower().endswith((".mp4", ".mov", ".mkv")):
        if frame is None:
            raise SystemExit("a video needs --frame=<n>")
        cmd += ["-i", path, "-vf", f"select=eq(n\\,{frame})", "-vframes", "1"]
    else:
        cmd += ["-i", path]
    cmd += ["-f", "rawvideo", "-pix_fmt", "gray", "-"]
    raw = subprocess.run(cmd, check=True, capture_output=True).stdout
    return np.frombuffer(raw, dtype=np.uint8)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("path")
    ap.add_argument("--frame", type=int, default=None)
    args = ap.parse_args()
    y = luma(args.path, args.frame)
    if y.size == 0:
        print("frame_stats: empty frame (wrong frame number?)", file=sys.stderr)
        return 2
    f = y.astype(np.float32)
    clipped = float((y >= 250).mean() * 100)
    crushed = float((y <= 8).mean() * 100)
    print(
        f"mean {f.mean():6.2f}  p1 {np.percentile(y,1):5.1f}  p50 {np.percentile(y,50):5.1f}"
        f"  p99 {np.percentile(y,99):5.1f}  max {y.max():3d}  clip>=250 {clipped:5.2f}%  crush<=8 {crushed:5.2f}%"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
