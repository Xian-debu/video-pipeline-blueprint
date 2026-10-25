"""L4b: 每秒 mean|Δ| 统计（不二值化）。

L4（scripts/spike/l4_baseline.py）用的是 1.2/255 的二值阈值，标定自高运动量样片（奶龙 66%）；
对"连续缓慢运镜"这种风格，逐帧差只有 0.02 量级，会被整体判成静止。这里改成带宽度的量：
每个 1 秒窗的 mean|Δ| 中位数、以及"真冻结"（<0.001）的秒数。
"""
import subprocess, sys, struct

W, H = 160, 90

def frames(path):
    p = subprocess.Popen(["ffmpeg","-v","error","-i",path,"-vf",f"scale={W}:{H},format=gray",
                          "-f","rawvideo","-"], stdout=subprocess.PIPE)
    n = W*H
    while True:
        b = p.stdout.read(n)
        if not b or len(b) < n:
            break
        yield b
    p.stdout.close(); p.wait()

def main(path, fps=30):
    prev=None; diffs=[]
    for f in frames(path):
        if prev is not None:
            s=0
            for i in range(0,len(f),7):
                s += abs(f[i]-prev[i])
            diffs.append(s/(len(f)/7))
        prev=f
    n=len(diffs)
    per=[]
    for i in range(0,n,fps):
        w=diffs[i:i+fps]
        per.append(sum(w)/len(w))
    per.sort()
    frozen=[d for d in diffs if d < 0.001]
    visible=[d for d in diffs if d >= 0.005]
    print(f"file={path}")
    print(f"frames={n} meanDelta={sum(diffs)/n:.4f} medianDelta={per[len(per)//2]:.4f}")
    print(f"p10={per[len(per)//10]:.4f} p90={per[int(len(per)*0.9)]:.4f} max={per[-1]:.4f}")
    print(f"frozenFrames(<0.001)={len(frozen)} ({100*len(frozen)/n:.1f}%)")
    print(f"visibleFrames(>=0.005)={len(visible)} ({100*len(visible)/n:.1f}%)")
    print(f"secondsWithMeanBelow0.005={sum(1 for v in per if v<0.005)}/{len(per)}")
    # 最长"真冻结"连续段
    best=cur=0
    for d in diffs:
        if d < 0.001: cur+=1; best=max(best,cur)
        else: cur=0
    print(f"longestFrozen={best} frames = {best/fps:.2f}s")
    return 0

if __name__=="__main__":
    sys.exit(main(sys.argv[1], int(sys.argv[2]) if len(sys.argv)>2 else 30))
