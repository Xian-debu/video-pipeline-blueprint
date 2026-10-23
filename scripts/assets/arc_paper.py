#!/usr/bin/env python3
"""Crop unannotated figure plates from the ARC (FAST '03) paper PDF.

Every crop is rendered with PyMuPDF using page.get_pixmap(dpi=..., annots=False),
so any highlight / ink annotation a reader left in the PDF never reaches the
output.  A coarse yellow-pixel self check is printed for every plate and the
script can fail on it (--fail-on-yellow), because a highlighter mark that was
flattened into the page content stream would otherwise pass silently.

Usage:
    /usr/bin/python3 scripts/assets/arc_paper.py --pdf "/path/to/megiddo.pdf" --out public/arc --dpi 220

Output:
    <out>/<id>.png        one plate per id
    data/arc/crops.json   metadata for every rendered plate (merged)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import fitz  # PyMuPDF

REPO_ROOT = Path(__file__).resolve().parents[2]

# id -> (page number (1-based), bbox in PDF points, one-line description)
CROPS: dict[str, dict] = {
    "title": {
        "page": 2,
        "bbox": (50.00, 72.00, 562.00, 162.00),
        "shows": "论文首页题头：标题 ARC: A Self-Tuning, Low Overhead Replacement Cache、作者 Megiddo 与 Modha、IBM Almaden 研究中心与邮箱",
    },
    "cover": {
        "page": 1,
        "bbox": (122.40, 150.48, 489.60, 396.00),
        "shows": "FAST '03 论文集封面：Proceedings of FAST '03 / 2nd USENIX Conference on File and Storage Technologies, San Francisco, March 31–April 2, 2003",
    },
    "dbl_fig1": {
        "page": 7,
        "bbox": (302.90, 43.56, 605.88, 350.00),
        "shows": "Figure 1：DBL(2c) 的完整算法（两条 LRU 列表 L1/L2 的命中与缺失处理）",
    },
    "dbl_fig2": {
        "page": 7,
        "bbox": (302.90, 344.00, 605.88, 748.00),
        "shows": "Figure 2：DBL 的物理结构——L2 正序、L1 倒序画出的两条 LRU 列表，MRU/LRU 两端与 DBL 总宽 2c",
    },
    "pi_fig3": {
        "page": 8,
        "bbox": (52.02, 47.52, 263.16, 352.00),
        "shows": "Figure 3：Π(c) 类策略的通用结构——L1 切成 T1↑/B1↓、L2 切成 T2↑/B2↓，缓存里只放 T1∪T2",
    },
    "arc_fig4": {
        "page": 10,
        "bbox": (48.96, 67.32, 575.28, 576.00),
        "shows": "Figure 4：ARC(c) 完整算法——四种情形、p 的加/减规则、Case IV 的 A/B 分支与 REPLACE 子程序",
    },
    "p_fig7": {
        "page": 16,
        "bbox": (302.90, 39.60, 532.44, 272.00),
        "shows": "Figure 7：P4 负载下参数 p（List T1 的目标大小）随虚拟时间在 0 与 32768 之间来回摆动",
    },
    "table8": {
        "page": 15,
        "bbox": (306.00, 39.60, 532.44, 292.00),
        "shows": "Table VIII：23 条真实负载上 LRU / ARC / 离线最优 FRC 的命中率对照表",
    },
}

YELLOW = "arc yellow-pixel"


def render(page: fitz.Page, bbox, dpi: int, annots: bool) -> fitz.Pixmap:
    return page.get_pixmap(dpi=dpi, clip=fitz.Rect(*bbox), annots=annots)


def intersecting_annots(page: fitz.Page, bbox) -> list[tuple[str, tuple[float, ...]]]:
    rect = fitz.Rect(*bbox)
    hits = []
    for annot in page.annots() or []:
        if annot.rect.intersects(rect):
            hits.append((annot.type[1], tuple(round(v, 1) for v in annot.rect)))
    return hits


def yellow_fraction(pix: fitz.Pixmap) -> float:
    """Share of pixels that look like a highlighter mark."""
    samples = pix.samples
    n = pix.width * pix.height
    if not n:
        return 0.0
    step = max(1, pix.n)
    yellow = 0
    for i in range(0, len(samples), step * 7):
        r = samples[i]
        g = samples[i + 1] if step > 1 else r
        b = samples[i + 2] if step > 2 else r
        if r > 200 and g > 200 and b < 120:
            yellow += 1
    return yellow / max(1, n / 7.0)


def main() -> int:
    ap = argparse.ArgumentParser(description="Crop unannotated ARC paper figures")
    ap.add_argument("--pdf", required=True, help="path to the ARC paper PDF")
    ap.add_argument("--out", default=str(REPO_ROOT / "public" / "arc"), help="output directory")
    ap.add_argument("--dpi", type=int, default=220, help="render dpi (200-220 recommended)")
    ap.add_argument("--only", default=None, help="render only this id")
    ap.add_argument("--crops-json", default=str(REPO_ROOT / "data" / "arc" / "crops.json"), help="metadata output path")
    ap.add_argument("--fail-on-annots", action="store_true", help="exit nonzero if a user annotation intersects any requested crop")
    ap.add_argument("--fail-on-yellow", action="store_true", help="exit nonzero if a plate looks highlighted")
    args = ap.parse_args()

    pdf = Path(args.pdf)
    if not pdf.is_file():
        print(f"error: PDF not found: {pdf}", file=sys.stderr)
        return 1
    if args.only and args.only not in CROPS:
        print(f"error: unknown id {args.only!r}; choose from {', '.join(CROPS)}", file=sys.stderr)
        return 1

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    doc = fitz.open(str(pdf))
    selected = [args.only] if args.only else list(CROPS)
    meta: dict[str, dict] = {}
    failures: list[str] = []
    notes: list[str] = []

    for crop_id in selected:
        spec = CROPS[crop_id]
        page_no = spec["page"]
        bbox = spec["bbox"]
        if not 1 <= page_no <= doc.page_count:
            raise SystemExit(f"page {page_no} out of range for {crop_id}")

        page = doc[page_no - 1]
        hits = intersecting_annots(page, bbox)
        if hits:
            detail = ", ".join(f"{kind}@{rect}" for kind, rect in hits)
            note = f"{crop_id}: {len(hits)} user annot(s) intersect the region ({detail}); hidden via annots=False"
            notes.append(note)
            print("note: " + note, file=sys.stderr)
            if args.fail_on_annots:
                failures.append(note)

        pix = render(page, bbox, args.dpi, annots=False)
        dest = out_dir / f"{crop_id}.png"
        pix.save(str(dest))

        frac = yellow_fraction(pix)
        flag = ""
        if frac > 0.002:
            flag = f"  YELLOW {frac:.4f}"
            if args.fail_on_yellow:
                failures.append(f"{crop_id}: yellow pixel share {frac:.4f}")

        try:
            out_rel = out_dir.resolve().relative_to(REPO_ROOT).as_posix()
        except ValueError:
            out_rel = out_dir.name

        meta[crop_id] = {
            "file": f"{out_rel}/{crop_id}.png",
            "page": page_no,
            "bbox": [round(v, 2) for v in bbox],
            "width": pix.width,
            "height": pix.height,
            "dpi": args.dpi,
            "yellow": round(frac, 5),
            "shows": spec["shows"],
        }
        print(f"{crop_id:9s} p{page_no:<2d} {pix.width}x{pix.height}px  yellow={frac:.4f}{flag}  {dest}")

    doc.close()

    crops_path = Path(args.crops_json)
    crops_path.parent.mkdir(parents=True, exist_ok=True)
    existing: dict[str, dict] = {}
    if crops_path.is_file():
        try:
            existing = json.loads(crops_path.read_text(encoding="utf-8"))
        except json.JSONDecodeError:
            existing = {}
    existing.update(meta)
    crops_path.write_text(json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"metadata: {crops_path} ({len(existing)} entries)")

    if notes:
        print(f"annotations hidden: {len(notes)} crop(s) had user marks under the clip; all were excluded by annots=False")
    if failures:
        print("FAILED: " + "; ".join(failures), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())