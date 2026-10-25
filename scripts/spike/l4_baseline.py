"""L4 审美量的基线：镜头内运动率 / 最长静帧段。

不依赖场景切分：逐帧算全局平均绝对差（缩到 160x90 灰度），1 s 一格统计"静"的秒数。
静阈值 1.2/255：字幕换行会带来很小的差，贴片整段不动时几乎为 0。
"""
import subprocess, sys, struct

W, H = 160, 90
THRESH = 1.2
YPP = 4  # gray8 每像素 1 字节，YPP 留着以便改 rgb

def frames(path):
    p = subprocess.Popen(
        ["ffmpeg", "-v", "error", "-i", path, "-vf", f"scale={W}:{H},format=gray",
         "-f", "rawvideo", "-"], stdout=subprocess.PIPE)
    n = W * H
    while True:
        b = p.stdout.read(n)
        if not b or len(b) < n:
            break
        yield b
    p.stdout.close(); p.wait()

def main(path, fps=30):
    prev = None
    diffs = []
    for f in frames(path):
        if prev is not None:
            s = 0
            for i in range(0, len(f), 7):  # 抽样加速
                s += abs(f[i] - prev[i])
            diffs.append(s / (len(f) / 7))
        prev = f
    if not diffs:
        print("no frames"); return 1
    n = len(diffs)
    motion = [d > THRESH for d in diffs]
    mr = sum(motion) / n
    # 最长静段
    best = cur = 0
    for m in motion:
        if not m:
            cur += 1
            best = max(best, cur)
        else:
            cur = 0
    # 每秒静/动
    per_sec = []
    for s in range(0, n, fps):
        seg = motion[s:s + fps]
        if seg:
            per_sec.append(sum(seg) / len(seg))
    print(f"file={path}")
    print(f"frames={n} dur={n/fps:.2f}s motionRate={mr*100:.1f}% staticFrames={sum(1 for m in motion if not m)}")
    print(f"longestStatic={best} frames = {best/fps:.2f}s")
    print(f"perSecMotion min={min(per_sec)*100:.0f}% median={sorted(per_sec)[len(per_sec)//2]*100:.0f}% max={max(per_sec)*100:.0f}%")
    print(f"seconds with <20% motion: {sum(1 for x in per_sec if x < 0.2)}/{len(per_sec)}")
    return 0

if __name__ == "__main__":
    sys.exit(main(sys.argv[1]))
