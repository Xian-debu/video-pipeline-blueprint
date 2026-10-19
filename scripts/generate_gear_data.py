#!/usr/bin/env python3
"""Derive every number the gears film shows, from data/gears/params.json.

The rule from the first two films holds here too: nothing on screen is typed by
hand. This script is the only place a ratio, a centre distance or a contact
ratio is computed, so a change in tooth counts propagates to the picture and to
the gate that re-derives the same numbers (scripts/qa/geometry_check.mjs).

  python3 scripts/generate_gear_data.py
"""
import json
import math
import pathlib
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "gears" / "params.json"
OUT = ROOT / "data" / "gears"


def write(name, payload):
    p = OUT / name
    p.write_text(json.dumps(payload, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("wrote", p.relative_to(ROOT), len(json.dumps(payload)))


def involute(rb, t):
    return (rb * (math.cos(t) + t * math.sin(t)), rb * (math.sin(t) - t * math.cos(t)))


def main() -> int:
    params = json.loads(SRC.read_text(encoding="utf-8"))
    alpha = math.radians(params["pressureAngleDeg"])
    ca, cb = params["pairs"]["a"], params["pairs"]["b"]

    def spur(m, z):
        r = m * z / 2.0
        return {
            "z": z,
            "module": m,
            "pitchRadius": r,
            "baseRadius": r * math.cos(alpha),
            "addendumRadius": r + m,
            "dedendumRadius": r - 1.25 * m,
            "pitchDiameter": 2 * r,
        }

    def contact_ratio(g1, g2, centre):
        num = (math.sqrt(g1["addendumRadius"] ** 2 - g1["baseRadius"] ** 2)
               + math.sqrt(g2["addendumRadius"] ** 2 - g2["baseRadius"] ** 2)
               - centre * math.sin(alpha))
        den = math.pi * g1["module"] * math.cos(alpha)
        return num / den

    g1, g2 = spur(ca["module"], ca["z1"]), spur(ca["module"], ca["z2"])
    centre = g1["pitchRadius"] + g2["pitchRadius"]
    ratio = ca["z2"] / ca["z1"]

    # (1) meshing pair: the geometry the 3D scene builds from
    geometry = {
        "source": "data/gears/params.json",
        "pressureAngleDeg": params["pressureAngleDeg"],
        "pairA": {
            "label": ca["label"],
            "module": ca["module"],
            "faceWidth": ca["faceWidth"],
            "pinion": g1,
            "wheel": g2,
            "centreDistance": centre,
            "ratio": ratio,
            "ratioInverse": 1.0 / ratio,
            "contactRatio": contact_ratio(g1, g2, centre),
            "basePitch": math.pi * ca["module"] * math.cos(alpha),
            "toothCountTotal": ca["z1"] + ca["z2"],
        },
    }
    write("geometry.json", geometry)

    # (2) the anti-climax of every gear: rotation is just a ratio
    ratio_trace = []
    for turn in range(0, 5):
        angle1 = 2 * math.pi * turn
        ratio_trace.append({
            "pinionTurns": turn,
            "pinionDeg": 360 * turn,
            "wheelDeg": -360 * turn / ratio,
            "teethPassed": g1["z"] * turn,
        })
    write("ratio.json", {
        "source": "data/gears/params.json",
        "z1": g1["z"], "z2": g2["z"], "ratio": ratio,
        "omega1TimesZ1": g1["z"], "omega2TimesZ2": g2["z"] * ratio,
        "rows": ratio_trace,
    })

    # (3) involute trace: the curve the film draws point by point
    rb = g1["baseRadius"]
    tmax = math.sqrt((g1["addendumRadius"] / rb) ** 2 - 1.0)
    samples = []
    for i in range(49):
        t = tmax * i / 48.0
        x, y = involute(rb, t)
        samples.append({"t": t, "x": x, "y": y, "r": math.hypot(x, y)})
    # tangent at the base circle is radial, i.e. the involute starts perpendicular
    # to the base circle: dy/dx at t=0 is 0 for the x-axis parameterisation used here.
    write("involute.json", {
        "source": "data/gears/params.json",
        "baseRadius": rb,
        "addendumRadius": g1["addendumRadius"],
        "tMax": tmax,
        "pointCount": len(samples),
        "samples": samples,
        "identity": "r(t) = rb * sqrt(1 + t^2)",
    })

    # (4) torque: power is conserved, torque is not
    omega1 = 30.0            # rad/s at the pinion, a declared example speed
    power = 1000.0           # W, declared example
    torque1 = power / omega1
    torque2 = torque1 * ratio
    write("torque.json", {
        "source": "data/gears/params.json",
        "powerW": power,
        "omega1RadPerSec": omega1,
        "torque1Nm": torque1,
        "torque2Nm": torque2,
        "torqueRatio": ratio,
        "speedRatio": 1.0 / ratio,
        "check": "torque1 * omega1 == torque2 * omega2 == power",
    })

    # (5) planetary: the Willis equation, three modes
    zs, zp, zr = cb["zSun"], cb["zPlanet"], cb["zRing"]
    planet_ok = (zr == zs + 2 * zp)
    ring_fixed = 1.0 + zr / zs                 # sun in, carrier out, ring fixed
    carrier_fixed = -zr / zs                   # sun in, ring out, carrier fixed
    sun_fixed = zr / (zs + zr)                 # carrier in, ring out, sun fixed
    modes = [
        {"mode": "ring fixed", "in": "sun", "out": "carrier", "ratio": ring_fixed,
         "formula": "i = 1 + zr/zs"},
        {"mode": "carrier fixed", "in": "sun", "out": "ring", "ratio": carrier_fixed,
         "formula": "i = -zr/zs"},
        {"mode": "sun fixed", "in": "carrier", "out": "ring", "ratio": sun_fixed,
         "formula": "i = zr/(zs+zr)"},
    ]
    # numeric states that satisfy (ns - nc)/(nr - nc) = -zr/zs, generated from the
    # equation itself: pick the carrier and the ring, solve for the sun.
    k = -zr / zs
    kk = -zr / zs
    states = []
    for nc, nr in ((150.0, 0.0), (150.0, -120.0), (0.0, 240.0), (-75.0, 300.0)):
        ns = nc + k * (nr - nc)
        states.append({"nSun": ns, "nCarrier": nc, "nRing": nr,
                       "willis": (ns - nc) / (nr - nc) if nr != nc else None})
    write("planetary.json", {
        "source": "data/gears/params.json",
        "zSun": zs, "zPlanet": zp, "zRing": zr, "planets": cb["planets"],
        "condition": "zr == zs + 2*zp",
        "conditionHolds": planet_ok,
        "willis": "(ns - nc) / (nr - nc) = -zr/zs",
        "ratioToZsun": -zr / zs,
        "modes": modes,
        "states": states,
    })

    # (6) backlash: a clearance in mm becomes an angle error in degrees
    rows = []
    for clearance_mm in (0.02, 0.05, 0.10, 0.20):
        err = math.degrees(math.atan(clearance_mm / g1["pitchRadius"]))
        rows.append({"clearanceMm": clearance_mm, "pitchRadius": g1["pitchRadius"],
                     "angularErrorDeg": err, "arcSeconds": err * 3600})
    write("backlash.json", {"source": "data/gears/params.json", "rows": rows,
                            "identity": "angular error (rad) = clearance / pitch radius"})

    # (7) the development arc, with every number marked as definition or typical
    h = params["history"]
    write("history.json", {
        "source": "data/gears/params.json",
        "clockRatio": h["clock"]["ratio"],
        "clockNote": h["clock"]["note"],
        "watchRatio": h["watch"]["ratio"],
        "watchNote": h["watch"]["note"],
        "windRatioMin": h["windTurbine"]["ratioMin"],
        "windRatioMax": h["windTurbine"]["ratioMax"],
        "windNote": h["windTurbine"]["note"],
        "kindLegend": {"definition": "由定义得出，可自行验算", "typical": "行业典型值，非本机实测"},
        "items": [
            {"era": "古代", "label": "水车 · 磨盘", "kind": "geometry",
             "text": "同一根轴上，木齿只负责传力；速比由齿数决定"},
            {"era": "1656", "label": "摆钟", "kind": "definition",
             "text": "分针 : 时针 = 12 : 1，速比第一次被写进图纸"},
            {"era": "1900s", "label": "行星减速", "kind": "geometry",
             "text": "同一套齿，三种工况给三个速比"},
            {"era": "今天", "label": "风电齿轮箱", "kind": "typical",
             "text": "大速比、大扭矩，仍然只是齿数之比"},
        ],
    })

    print("contact ratio %.3f, ratio %.3f, centre %.1f, planetary ok=%s" % (
        contact_ratio(g1, g2, centre), ratio, centre, planet_ok))
    if not planet_ok:
        return 1
    if contact_ratio(g1, g2, centre) < 1.0:
        print("FAIL: contact ratio below 1, the pair does not mesh continuously", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())