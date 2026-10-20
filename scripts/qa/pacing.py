#!/usr/bin/env python3
"""How much of the picture is moving while the narration talks?

    python3 scripts/qa/pacing.py out/package/Hawk.mp4 --lines data/hawk/lines.json

An explainer can be correct and still be unwatchable: a card that stands still for ninety seconds
while the voice keeps going reads as a slide, not a film. This measures that directly instead of
arguing about it — sample the delivered mp4 at 5 fps in grayscale, take the mean absolute difference
between consecutive samples, and report per scene:

  meanDiff        average motion of the picture (0-255 scale; text-only cards sit around 0.1)
  staticRatio     share of samples where the picture barely changed (< 0.5)
  movedShare      share of samples where at least --moved of the pixels changed (a line being drawn
                  counts as moving; a card that stands still does not)
  longestStill    the longest run samples with no such movement, in seconds — the number to fix
  stillFrom       wall-clock time where that run starts, so the fix has a target frame

It reads the delivered file on purpose: the question is what a viewer sees, not what the code does.
"""
import argparse, json, subprocess, sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("video")
    ap.add_argument("--lines", required=True)
    ap.add_argument("--fps", type=int, default=5)
    ap.add_argument("--still", type=float, default=0.5, help="mean |diff| below this counts as still")
    ap.add_argument("--moved", type=float, default=0.004,
                    help="share of pixels that changed (>2/255); below this the frame is treated as still")
    ap.add_argument("--width", type=int, default=160)
    ap.add_argument("--height", type=int, default=90)
    args = ap.parse_args()

    try:
        import numpy as np
    except ImportError:
        sys.exit("pacing: needs numpy")

    W, H = args.width, args.height
    cmd = ["ffmpeg", "-v", "error", "-i", args.video, "-vf",
           f"fps={args.fps},scale={W}:{H},format=gray", "-f", "rawvideo", "-pix_fmt", "gray", "-"]
    raw = subprocess.run(cmd, capture_output=True)
    if raw.returncode != 0:
        sys.exit("pacing: ffmpeg failed: " + raw.stderr.decode()[:400])
    buf = np.frombuffer(raw.stdout, dtype=np.uint8)
    n = len(buf) // (W * H)
    frames = buf[: n * W * H].reshape(n, H, W).astype(np.float32)
    if n < 3:
        sys.exit("pacing: only %d samples" % n)
    pix = np.abs(np.diff(frames, axis=0))  # pix[i] = |frame i - frame i+1| per pixel
    diff = pix.mean(axis=(1, 2))
    # A slowly drawn line barely moves the frame mean but is plainly moving to an eye, and a card
    # that truly stands still moves nothing at all. Count pixels that changed at all, so the two
    # are not conflated: "still" means hardly any pixel moved, not "the average moved little".
    moved = (pix > 2).mean(axis=(1, 2))
    dt = 1.0 / args.fps

    meta = json.load(open(args.lines, encoding="utf-8"))
    scenes = meta.get("scenes") or []
    rows = []
    for s in scenes:
        a = int(s["start"] * args.fps)
        b = int((s["start"] + s["dur"]) * args.fps)
        seg = diff[max(0, a - 1): max(1, b - 1)]
        segMoved = moved[max(0, a - 1): max(1, b - 1)]
        if len(seg) == 0:
            continue
        still = segMoved < args.moved
        best = cur = 0
        bestStart = 0
        runStart = 0
        for k, v in enumerate(still):
            if v:
                if cur == 0:
                    runStart = k
                cur += 1
            else:
                cur = 0
            if cur > best:
                best = cur
                bestStart = runStart
        rows.append({
            "id": s.get("id"),
            "start": round(s["start"], 2),
            "dur": round(s["dur"], 2),
            "meanDiff": round(float(seg.mean()), 3),
            "movedShare": round(float((segMoved >= args.moved).mean()), 3),
            "staticRatio": round(float(still.mean()), 3),
            "longestStill": round(best * dt, 2),
            "stillFrom": round(s["start"] + bestStart * dt, 2),
        })
    rows.sort(key=lambda r: -r["longestStill"])
    print(json.dumps({"samples": n, "fps": args.fps, "stillThreshold": args.still,
                      "scenesByLongestStill": rows, "totalSamples": int(n)}, ensure_ascii=False))
    return 0

if __name__ == "__main__":
    sys.exit(main())
