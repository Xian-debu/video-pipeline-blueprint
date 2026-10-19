#!/usr/bin/env python3
"""Crop unannotated figure plates from the Hawk (SenSys '24) paper PDF.

Every crop is rendered with PyMuPDF using page.get_pixmap(dpi=..., annots=False),
so the user's Chinese highlights / ink annotations that live in the PDF's
annotation layer never reach the output.  Bounding boxes are in PDF points
(72 dpi, origin top-left) and were located by rendering the pages and looking
at them, then confirmed by looking at every crop.

Usage:
    /usr/bin/python3 scripts/assets/hawk_paper.py \
        --pdf "/path/to/Hawk.pdf" --out public/hawk --dpi 220

    # re-render a single plate
    /usr/bin/python3 scripts/assets/hawk_paper.py --only fig10

Output:
    <out>/<id>.png          one plate per id
    data/hawk/crops.json    metadata for every rendered plate (merged)
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import fitz  # PyMuPDF

REPO_ROOT = Path(__file__).resolve().parents[2]

# id -> (page number (1-based), bbox in PDF points, one-line description)
# bboxes are tight around the figure body only: no "Figure N:" caption, no
# adjacent body text, no page header/footer.
CROPS: dict[str, dict] = {
    "header": {
        "page": 1,
        "bbox": (75.67, 26.60, 561.42, 194.24),
        "shows": "论文首页题头：标题、五位作者、中科院计算所/国科大/大湾区大学三机构与联系邮箱（右上为 ACM 徽标）",
    },
    "fig8": {
        "page": 7,
        "bbox": (350.95, 80.55, 524.80, 177.82),
        "shows": "两版 Hawk 硬件原型照片：左侧实验室版采集板，右侧部署版（含电流互感器与采集板）",
    },
    "fig9": {
        "page": 8,
        "bbox": (60.76, 84.18, 286.98, 259.67),
        "shows": "两处野外部署平面图：左侧 103 m² 住宅户型，右侧 25 m² 办公区单元布局，星标为 Hawk 传感器位置",
    },
    "fig10": {
        "page": 8,
        "bbox": (339.49, 80.58, 534.95, 191.93),
        "shows": "同步误差 CDF：TSF 与本文策略在 <1 m / 13 m 下的累积概率曲线",
    },
    "fig3": {
        "page": 5,
        "bbox": (88.25, 84.18, 282.07, 155.60),
        "shows": "总电流 vs 差分电流：左图为背景电水壶下的总电流波形，右图为三组差分对得到的差分电流",
    },
    "fig13": {
        "page": 10,
        "bbox": (51.27, 80.91, 296.47, 238.40),
        "shows": "事件分布热图：电器×背景档位网格，每格上数为训练集事件数、下数为测试集事件数，颜色为占用率",
    },
    "fig16": {
        "page": 11,
        "bbox": (320.84, 83.53, 557.20, 205.02),
        "shows": "状态识别精度对比：MSDC/CALM/CNN/FFT-XGBoost 原始与稳态差分增强后的平均 F1 柱状图",
    },
    "fig7": {
        "page": 7,
        "bbox": (78.11, 83.85, 270.29, 151.67),
        "shows": "Hawk 数据采集硬件架构框图：电源、路由器/PC、DAQ 板（ESP32 + W5500 + ADC）与 AC-AC 传感器",
    },
}


def render(page: fitz.Page, bbox, dpi: int, annots: bool) -> fitz.Pixmap:
    return page.get_pixmap(dpi=dpi, clip=fitz.Rect(*bbox), annots=annots)


def intersecting_annots(page: fitz.Page, bbox) -> list[tuple[str, tuple[float, ...]]]:
    """User annotations whose rect intersects the crop, with type and rect.

    Recorded for the acceptance report.  The renders themselves always use
    annots=False, so none of these marks can appear in the output.
    """
    rect = fitz.Rect(*bbox)
    hits = []
    for annot in page.annots() or []:
        if annot.rect.intersects(rect):
            hits.append((annot.type[1], tuple(round(v, 1) for v in annot.rect)))
    return hits


def main() -> int:
    ap = argparse.ArgumentParser(description="Crop unannotated Hawk paper figures")
    ap.add_argument("--pdf", required=True, help="path to Hawk.pdf")
    ap.add_argument("--out", default=str(REPO_ROOT / "public" / "hawk"), help="output directory")
    ap.add_argument("--dpi", type=int, default=220, help="render dpi (200-220 recommended)")
    ap.add_argument("--only", default=None, help="render only this id")
    ap.add_argument(
        "--crops-json",
        default=str(REPO_ROOT / "data" / "hawk" / "crops.json"),
        help="metadata output path",
    )
    ap.add_argument(
        "--fail-on-annots",
        action="store_true",
        help="exit nonzero if a user annotation intersects any requested crop",
    )
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
            "shows": spec["shows"],
        }
        print(f"{crop_id:7s} p{page_no:<2d} {pix.width}x{pix.height}px  {dest}")

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
    crops_path.write_text(
        json.dumps(existing, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"metadata: {crops_path} ({len(existing)} entries)")

    if notes:
        print(f"annotations hidden: {len(notes)} crop(s) had user marks under the clip; all were excluded by annots=False")
    if failures:
        print("FAILED: " + "; ".join(failures), file=sys.stderr)
        return 2
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
