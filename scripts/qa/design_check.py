#!/usr/bin/env python3
"""Machine check of the design contract: data/design.spec.json.

Validated in the same spirit as the rest of the pipeline: every rule the contract states is
either a number this script compares, or it is a review item in docs/engineering-standards.md.
Exits non-zero with a specific message per violation; prints the measured contrast ratios so a
reviewer can see the evidence, not just "ok".

No third-party imports: runs in the same interpreter as the other QA scripts.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
SPEC_PATH = ROOT / "data" / "design.spec.json"
HEX_RE = re.compile(r"^#[0-9a-fA-F]{6}$")
DUTIES = ("static", "enter", "emphasize", "move", "exit")
USAGES = ("fill", "line")

errors = []
lines = []


def fail(msg):
    errors.append(msg)


def note(msg):
    lines.append(msg)


def _channel(v):
    v = v / 255.0
    return v / 12.92 if v <= 0.03928 else ((v + 0.055) / 1.055) ** 2.4


def luminance(hex_color):
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i:i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * _channel(r) + 0.7152 * _channel(g) + 0.0722 * _channel(b)


def contrast(a, b):
    la, lb = luminance(a), luminance(b)
    hi, lo = max(la, lb), min(la, lb)
    return (hi + 0.05) / (lo + 0.05)


def check_canvas(spec):
    canvas = spec.get("canvas") or {}
    for key in ("width", "height", "fps"):
        v = canvas.get(key)
        if not isinstance(v, int) or v <= 0:
            fail("canvas.%s must be a positive integer" % key)
    if canvas.get("width") == canvas.get("height"):
        fail("canvas must not be square (1920x1080 expected)")


def check_palette(spec, type_spec):
    families = (spec.get("palette") or {}).get("families") or {}
    if not families:
        fail("palette.families is empty")
        return
    min_readable = type_spec.get("minReadable", 0)
    for family_name, family in families.items():
        colors = family.get("colors") or {}
        roles = family.get("roles") or {}
        if len(colors) < 3:
            fail("%s: fewer than 3 colours declared" % family_name)
        for name, value in colors.items():
            if not isinstance(value, str) or not HEX_RE.match(value):
                fail("%s: colour %r is not #RRGGBB (%r)" % (family_name, name, value))
        used = set()
        for role_name, role in roles.items():
            refs = list(role.get("colors") or [])
            if role.get("color"):
                refs.append(role["color"])
            if not refs:
                fail("%s/%s: role has neither color nor colors" % (family_name, role_name))
                continue
            for ref in refs:
                used.add(ref)
                if ref not in colors:
                    fail("%s/%s: unknown colour %r" % (family_name, role_name, ref))
            if "alpha" in role:
                alpha = role["alpha"]
                if not isinstance(alpha, (int, float)) or not (0 < alpha <= 1):
                    fail("%s/%s: alpha must be within (0, 1] (got %r)" % (family_name, role_name, alpha))
                if role.get("usage") != "fill":
                    fail("%s/%s: alpha is only valid on a fill role (usage must be 'fill')" % (family_name, role_name))
                if role.get("on"):
                    fail("%s/%s: a fill role must not declare contrast targets" % (family_name, role_name))
            targets = role.get("on") or []
            if role.get("color") and not targets:
                if role.get("usage") not in USAGES:
                    fail("%s/%s: text role needs on[] targets or usage in %s" % (family_name, role_name, USAGES))
                continue
            worst = None
            for target in targets:
                if target not in colors:
                    fail("%s/%s: unknown on[] target %r" % (family_name, role_name, target))
                    continue
                r = contrast(colors[role["color"]], colors[target])
                if worst is None or r < worst[1]:
                    worst = (target, r)
            if worst is None:
                continue
            need = role.get("minContrast")
            if not isinstance(need, (int, float)):
                fail("%s/%s: declares on[] but no minContrast" % (family_name, role_name))
                continue
            status = "ok" if worst[1] + 1e-9 >= need else "FAIL"
            note("%-11s %-22s %s on %-8s = %5.2f  (need %.1f) %s"
                 % (family_name, role_name, role["color"], worst[0], worst[1], need, status))
            if status == "FAIL":
                fail("%s/%s: contrast %.2f on %s below %.1f"
                     % (family_name, role_name, worst[1], worst[0], need))
            min_size = role.get("minSize")
            if min_size is not None:
                if not isinstance(min_size, int) or min_size <= 0:
                    fail("%s/%s: minSize must be a positive integer" % (family_name, role_name))
                elif min_size < min_readable:
                    fail("%s/%s: minSize %d below legibility floor %d"
                         % (family_name, role_name, min_size, min_readable))
        missing = sorted(set(colors) - used)
        if missing:
            fail("%s: colours declared but unused by any role: %s" % (family_name, ", ".join(missing)))


def check_type(spec):
    t = spec.get("type") or {}
    scale = t.get("scale") or {}
    order = t.get("order") or []
    roles = t.get("roles") or {}
    if not scale:
        fail("type.scale is empty")
        return
    for name, size in scale.items():
        if not isinstance(size, int) or size <= 0:
            fail("type.scale.%s must be a positive integer" % name)
    sizes = [scale[n] for n in order if n in scale]
    if len(sizes) != len(order):
        fail("type.order references unknown scale names")
    if any(a <= b for a, b in zip(sizes, sizes[1:])):
        fail("type.order must be strictly decreasing, got %s" % sizes)
    floor = t.get("minReadable")
    if not isinstance(floor, int) or floor <= 0:
        fail("type.minReadable must be a positive integer")
    else:
        smallest = min(int(v) for v in scale.values())
        if smallest < floor:
            fail("type.scale has a size %d below minReadable %d" % (smallest, floor))
        if floor not in scale.values():
            fail("type.minReadable %d is not a scale value" % floor)
    for role_name, token in roles.items():
        if token not in scale:
            fail("type.roles.%s -> unknown token %r" % (role_name, token))
    unused = sorted(set(scale) - set(roles.values()))
    if unused:
        fail("type.scale tokens not used by any role: %s" % ", ".join(unused))
    leading = t.get("leading")
    if not isinstance(leading, (int, float)) or not (1.2 <= leading <= 2.0):
        fail("type.leading must be within [1.2, 2.0] (got %r)" % (leading,))


def check_spacing(spec):
    anchors = (spec.get("spacing") or {}).get("anchors") or {}
    required = ("grid", "gutter", "pageMargin", "safeArea", "blockGap", "cornerRadius")
    for key in required:
        v = anchors.get(key)
        if not isinstance(v, int) or v <= 0:
            fail("spacing.anchors.%s must be a positive integer" % key)
    if any(anchors.get(k) is None for k in required):
        return
    grid = anchors["grid"]
    for key in ("gutter", "pageMargin", "safeArea", "blockGap"):
        if anchors[key] % grid != 0:
            fail("spacing.anchors.%s (%d) is not a multiple of grid (%d)" % (key, anchors[key], grid))
    if not (anchors["pageMargin"] > anchors["safeArea"] >= anchors["gutter"]):
        fail("spacing anchors must satisfy pageMargin > safeArea >= gutter")


def check_motion(spec):
    m = spec.get("motion") or {}
    transition = m.get("transition") or {}
    if transition.get("kind") != "hard-cut":
        fail("motion.transition.kind must be 'hard-cut' (K1)")
    if transition.get("fadeFrames") != 0:
        fail("motion.transition.fadeFrames must be 0 for hard cuts")
    if not transition.get("why"):
        fail("motion.transition.why must record the reason for the rule")
    duties = m.get("duties") or {}
    for duty in DUTIES:
        d = duties.get(duty)
        if not d:
            fail("motion.duties.%s is missing" % duty)
            continue
        frames, max_frames = d.get("frames"), d.get("maxFrames")
        if not isinstance(frames, int) or frames < 0:
            fail("motion.duties.%s.frames must be a non-negative integer" % duty)
            continue
        if not isinstance(max_frames, int) or max_frames < frames:
            fail("motion.duties.%s.maxFrames must be an integer >= frames" % duty)
        if not d.get("meaning"):
            fail("motion.duties.%s.meaning must state when this duty applies" % duty)
        if duty == "static" and frames != 0:
            fail("motion.duties.static.frames must be 0")
    enter = duties.get("enter") or {}
    if isinstance(enter.get("frames"), int) and isinstance(m.get("staggerFrames"), int):
        if m["staggerFrames"] > enter["frames"]:
            fail("motion.staggerFrames exceeds the enter budget")
    ambient = m.get("ambient") or {}
    lo, hi = ambient.get("minSeconds"), ambient.get("maxSeconds")
    if not isinstance(lo, (int, float)) or not isinstance(hi, (int, float)) or lo < 6 or hi <= lo:
        fail("motion.ambient must be minSeconds >= 6 and maxSeconds > minSeconds")
    if isinstance(hi, (int, float)) and hi > 60:
        fail("motion.ambient.maxSeconds must stay <= 60")
    if not ambient.get("rule"):
        fail("motion.ambient.rule must state how scenes shorter than minSeconds behave")


def check_text(spec):
    caption = (spec.get("text") or {}).get("caption") or {}
    max_chars = caption.get("maxCharsPerLine")
    cps_min = caption.get("charsPerSecondMin")
    cps_max = caption.get("charsPerSecondMax")
    min_on = caption.get("minOnScreenSeconds")
    if not isinstance(max_chars, int) or not (20 <= max_chars <= 40):
        fail("text.caption.maxCharsPerLine must be an integer in [20, 40]")
    if not isinstance(cps_min, (int, float)) or not isinstance(cps_max, (int, float)):
        fail("text.caption charsPerSecondMin/Max must be numbers")
    elif not (1.0 <= cps_min < cps_max <= 8.0):
        fail("text.caption must satisfy 1.0 <= min < max <= 8.0")
    if not isinstance(min_on, (int, float)) or min_on <= 0:
        fail("text.caption.minOnScreenSeconds must be positive")
    if isinstance(min_on, (int, float)) and isinstance(max_chars, int) and isinstance(cps_max, (int, float)):
        if max_chars / cps_max < min_on:
            fail("a full caption line at max speed would stay on screen shorter than minOnScreenSeconds")


def main():
    if not SPEC_PATH.exists():
        print("FAIL design check: %s not found" % SPEC_PATH, file=sys.stderr)
        return 1
    try:
        spec = json.loads(SPEC_PATH.read_text(encoding="utf-8"))
    except json.JSONDecodeError as exc:
        print("FAIL design check: spec is not valid JSON: %s" % exc, file=sys.stderr)
        return 1
    if not isinstance(spec.get("version"), int):
        fail("version must be an integer")
    type_spec = spec.get("type") or {}
    check_canvas(spec)
    check_palette(spec, type_spec)
    check_type(spec)
    check_spacing(spec)
    check_motion(spec)
    check_text(spec)

    for line in lines:
        print(line)
    if errors:
        print("")
        for err in errors:
            print("FAIL " + err, file=sys.stderr)
        print("design check: FAIL (%d violation(s))" % len(errors), file=sys.stderr)
        return 1
    families = spec["palette"]["families"]
    print("design check: PASS - %d colour families, %d type roles, %d contrast targets, hard-cut motion"
          % (len(families),
             len(type_spec.get("roles") or {}),
             len(lines)))
    return 0


if __name__ == "__main__":
    sys.exit(main())