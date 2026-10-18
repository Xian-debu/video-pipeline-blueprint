
import argparse, subprocess, sys
import numpy as np

def frames(path, w=192, h=108):
    cmd = ["ffmpeg","-v","error","-i",path,"-vf",f"fps=30,scale={w}:{h}","-pix_fmt","gray","-f","rawvideo","-"]
    raw = subprocess.run(cmd, capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.uint8).reshape(-1,h,w).astype(np.float32)

def dip_scan(sig, max_span=40, min_depth=4.0):
    """Find blink-like dips: a local minimum that is >= min_depth below BOTH
    a preceding peak (within max_span) and a following peak (within max_span).
    A monotone fade-out that stays dark across a cut is NOT a blink; a dip that
    comes back up within max_span frames is."""
    out=[]
    n=len(sig)
    for i in range(n):
        left = sig[max(0,i-max_span):i+1].max()
        right = sig[i:min(n,i+max_span+1)].max()
        depth = min(left-sig[i], right-sig[i])
        if depth >= min_depth:
            out.append((i, float(depth), float(sig[i]), float(left), float(right)))
    # keep the deepest point of each contiguous run
    groups=[]
    for it in out:
        if groups and it[0]-groups[-1][-1][0] <= max_span:
            groups[-1].append(it)
        else:
            groups.append([it])
    return [max(g, key=lambda x: x[1]) for g in groups]

ap=argparse.ArgumentParser()
ap.add_argument("video")
ap.add_argument("--thresh", type=float, default=12.0, help="single-frame jump threshold")
ap.add_argument("--region", default="full", choices=["bg","full"])
ap.add_argument("--blink-depth", type=float, default=4.0)
ap.add_argument("--blink-span", type=int, default=40)
ap.add_argument("--cut-frames", default="",
                help="comma-separated frame indices where the film intentionally hard-cuts; "
                     "a jump or dip at such a frame is a cut, not a flicker, and is ignored")
a=ap.parse_args()
cuts=sorted({int(c) for c in a.cut_frames.split(",") if c.strip()})
fr=frames(a.video)
sig = fr[:, :20, :40].mean(axis=(1,2)) if a.region=="bg" else fr.mean(axis=(1,2))
d=np.abs(np.diff(sig))
mask=np.zeros(len(d), dtype=bool)
for c in cuts:
    for k in (c-2,c-1,c,c+1,c+2):
        if 0 <= k < len(d):
            mask[k]=True
bad=np.where((d>a.thresh) & ~mask)[0]
print(f"frames={len(fr)} mean={sig.mean():.2f} min={sig.min():.2f} max={sig.max():.2f}")
print(f"mean|d|={d.mean():.4f} p99={np.percentile(d,99):.4f} max={d.max():.2f} jump_thresh={a.thresh}"
      + (f" cuts={len(cuts)}" if cuts else ""))
rc=0
if len(bad):
    print("FAIL luma jumps:", [(int(i)+1, round(float(d[i]),1)) for i in bad][:20]); rc=1
blinks=dip_scan(sig, a.blink_span, a.blink_depth)
if cuts:
    # a dip that recovers across an intentional cut is the cut, not a blink
    blinks=[b for b in blinks if all(abs(b[0]-c) > a.blink_span for c in cuts)]
if blinks:
    print(f"FAIL blink dips (depth>={a.blink_depth} recovered within {a.blink_span}f):")
    for i,dep,val,l,r in blinks[:12]:
        print(f"  frame {i} ({i/30:.2f}s) depth={dep:.1f} val={val:.1f} peak_l={l:.1f} peak_r={r:.1f}")
    rc=1
if rc==0:
    print("PASS no luma jump and no blink dip")
sys.exit(rc)