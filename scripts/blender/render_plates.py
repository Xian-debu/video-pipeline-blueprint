#!/usr/bin/env python3
"""Render a .glb into a deterministic PNG plate sequence with Blender's CLI.

The pipeline's contract is that every pixel is decided by a number, so this
script takes a frame range and writes one plate per frame; nothing else is
allowed to vary between runs (fixed seed, fixed sampling, Standard view
transform, no motion blur, no time-of-day light, camera derived from the frame
number). It also writes report.json next to the plates: engine, device,
samples, per-frame seconds, and the sha256 of every plate, so a plate set is an
immutable, checkable artifact instead of "whatever Blender produced today".

Usage (through scripts/blender/render_plates.sh):

    blender -b --factory-startup -noaudio --python render_plates.py -- \
        --glb public/models/nailong_v3_15k.glb --out /tmp/plates \
        --engine cycles --samples 64 --start 0 --end 89 \
        --azimuth -26 26 --radius 7.6 --height 2.3 --alpha
"""

import argparse
import hashlib
import json
import math
import os
import sys
import time

import bpy
from mathutils import Vector

# --------------------------------------------------------------------------- #
# arguments
# --------------------------------------------------------------------------- #


def parse_args():
    argv = sys.argv
    argv = argv[argv.index("--") + 1:] if "--" in argv else []
    p = argparse.ArgumentParser(prog="render_plates.py")
    p.add_argument("--glb", required=True, help="path to the .glb to render")
    p.add_argument("--out", required=True, help="output directory for plates + report.json")
    p.add_argument("--engine", default="cycles", choices=["cycles", "eevee", "workbench"])
    p.add_argument("--device", default="GPU", choices=["GPU", "CPU"], help="cycles compute device")
    p.add_argument("--samples", type=int, default=64)
    p.add_argument("--width", type=int, default=1920)
    p.add_argument("--height", type=int, default=1080)
    p.add_argument("--start", type=int, default=0)
    p.add_argument("--end", type=int, default=89, help="inclusive")
    p.add_argument("--fps", type=int, default=30)
    p.add_argument("--height-units", type=float, default=2.0, help="normalised model height")
    # Defaults reproduce the committed demo set: close enough that the model fills the
    # right column, and a mid-tone material so the shading survives the key light.
    p.add_argument("--radius", type=float, nargs=2, default=[4.8, 4.8])
    p.add_argument("--height-cam", dest="cam_height", type=float, nargs=2, default=[2.2, 2.9])
    p.add_argument("--azimuth", type=float, nargs=2, default=[30.0, -30.0], help="degrees, start end")
    p.add_argument("--target-z", type=float, default=0.9)
    p.add_argument("--key-power", type=float, default=1100.0, help="key light watts")
    p.add_argument("--fill-power", type=float, default=380.0, help="fill light watts")
    p.add_argument("--rim-power", type=float, default=720.0, help="rim light watts")
    p.add_argument("--fov", type=float, default=50.0, help="vertical field of view, degrees")
    p.add_argument("--material", default="matte", choices=["matte", "satin", "metal", "glow"])
    p.add_argument("--color", default="#b9b3a8", help="sRGB hex for the model")
    p.add_argument("--ground", default="shadow", choices=["none", "shadow", "solid"])
    p.add_argument("--alpha", action="store_true", help="transparent film (RGBA plates)")
    p.add_argument("--probe", action="store_true", help="report capability JSON and exit")
    p.add_argument("--denoise", dest="denoise", action="store_true", default=True)
    p.add_argument("--no-denoise", dest="denoise", action="store_false")
    return p.parse_args(argv)


# --------------------------------------------------------------------------- #
# helpers
# --------------------------------------------------------------------------- #


def log(msg):
    print("[plates] %s" % msg, flush=True)


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def hex_to_linear_rgba(value):
    v = value.strip().lstrip("#")
    if len(v) == 3:
        v = "".join(ch * 2 for ch in v)
    if len(v) != 6:
        raise SystemExit("bad colour %r (want #rrggbb)" % value)
    rgb = [srgb_to_linear(int(v[i:i + 2], 16) / 255.0) for i in (0, 2, 4)]
    return (rgb[0], rgb[1], rgb[2], 1.0)


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as fh:
        for chunk in iter(lambda: fh.read(1 << 20), b""):
            h.update(chunk)
    return h.hexdigest()


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.frame_start = 0
    scene.render.use_motion_blur = False
    return scene


def ensure_cycles():
    """--factory-startup leaves the Cycles addon disabled, so the engine enum only
    lists EEVEE. Enable it explicitly: a renderer that silently falls back to
    software EEVEE is worse than one that refuses to start."""
    try:
        bpy.ops.preferences.addon_enable(module="cycles")
    except Exception as exc:
        log("could not enable the cycles addon: %s: %s" % (type(exc).__name__, exc))
    return cycle_engines()


def cycle_engines():
    try:
        prop = bpy.types.RenderSettings.bl_rna.properties["engine"]
        return [item.identifier for item in prop.enum_items]
    except Exception:
        return []


def resolve_engine(scene, name):
    """Engines registered by an addon (Cycles) do not show up in the RNA enum, so
    probe by *assignment*: the enum lies, the setter does not."""
    candidates = {
        "cycles": ("CYCLES",),
        "workbench": ("BLENDER_WORKBENCH",),
        "eevee": ("BLENDER_EEVEE_NEXT", "BLENDER_EEVEE"),
    }[name]
    failures = []
    for ident in candidates:
        try:
            scene.render.engine = ident
        except TypeError as exc:
            failures.append("%s: %s" % (ident, exc))
            continue
        return ident
    log("no engine accepted for %r (%s)" % (name, "; ".join(failures)))
    return None


def gpu_report():
    try:
        import gpu

        return {
            "vendor": gpu.platform.vendor_get(),
            "renderer": gpu.platform.renderer_get(),
            "version": gpu.platform.version_get(),
        }
    except Exception as exc:  # no GPU context in this build/session
        return {"error": "%s: %s" % (type(exc).__name__, exc)}


def set_cycles_device(device):
    prefs = bpy.context.preferences.addons["cycles"].preferences
    wanted = "OPTIX" if device == "GPU" else "NONE"
    info = {"compute_device_type": None, "devices": []}
    if device == "GPU":
        for backend in ("OPTIX", "CUDA", "HIP", "ONEAPI", "METAL"):
            try:
                prefs.compute_device_type = backend
            except TypeError:
                continue
            prefs.get_devices()
            named = [d for d in prefs.devices if d.type == backend]
            if named:
                wanted = backend
                break
    prefs.compute_device_type = wanted
    prefs.get_devices()
    for d in prefs.devices:
        d.use = wanted != "NONE" and d.type == wanted
        info["devices"].append({"name": d.name, "type": d.type, "use": d.use})
    bpy.context.scene.cycles.device = "GPU" if wanted != "NONE" else "CPU"
    info["compute_device_type"] = wanted
    info["scene_device"] = bpy.context.scene.cycles.device
    return info


# --------------------------------------------------------------------------- #
# scene
# --------------------------------------------------------------------------- #


def import_glb(path):
    before = set(bpy.data.objects)
    bpy.ops.import_scene.gltf(filepath=path)
    imported = [ob for ob in bpy.data.objects if ob not in before]
    meshes = [ob for ob in imported if ob.type == "MESH"]
    if not meshes:
        raise SystemExit("no mesh in %s" % path)
    return imported, meshes


def world_bbox(meshes):
    lo = Vector((math.inf, math.inf, math.inf))
    hi = Vector((-math.inf, -math.inf, -math.inf))
    for ob in meshes:
        mw = ob.matrix_world
        for corner in ob.bound_box:
            p = mw @ Vector(corner)
            lo = Vector((min(lo[i], p[i]) for i in range(3)))
            hi = Vector((max(hi[i], p[i]) for i in range(3)))
    return lo, hi


def normalise(imported, meshes, target_height):
    lo, hi = world_bbox(meshes)
    size = hi - lo
    span = max(size.z, 1e-6)
    s = target_height / span
    centre = ((lo.x + hi.x) / 2.0, (lo.y + hi.y) / 2.0)
    pivot = bpy.data.objects.new("asset_pivot", None)
    bpy.context.scene.collection.objects.link(pivot)
    for ob in imported:
        if ob.parent is None:
            ob.parent = pivot
            ob.matrix_parent_inverse = pivot.matrix_world.inverted()
    pivot.scale = (s, s, s)
    pivot.location = (-centre[0] * s, -centre[1] * s, -lo.z * s)
    bpy.context.view_layer.update()
    return {"scale": s, "source_extent": [size.x, size.y, size.z]}


def make_material(preset, color_hex):
    colour = hex_to_linear_rgba(color_hex)
    mat = bpy.data.materials.new(name="plate_%s" % preset)
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    table = {
        "matte": {"Roughness": 0.88, "Metallic": 0.0, "Specular IOR Level": 0.2},
        "satin": {"Roughness": 0.42, "Metallic": 0.18, "Specular IOR Level": 0.5},
        "metal": {"Roughness": 0.22, "Metallic": 0.95, "Specular IOR Level": 0.5},
        "glow": {"Roughness": 0.6, "Metallic": 0.0, "Specular IOR Level": 0.5},
    }[preset]
    for key, value in table.items():
        if key in bsdf.inputs:
            bsdf.inputs[key].default_value = value
    bsdf.inputs["Base Color"].default_value = colour
    if preset == "glow":
        if "Emission Color" in bsdf.inputs:
            bsdf.inputs["Emission Color"].default_value = colour
        if "Emission Strength" in bsdf.inputs:
            bsdf.inputs["Emission Strength"].default_value = 0.55
    return mat


def shade(meshes, preset, color_hex):
    mat = make_material(preset, color_hex)
    for ob in meshes:
        ob.data.materials.clear()
        ob.data.materials.append(mat)
        ob.data.shade_smooth()


def add_ground(mode, alpha):
    """A shadow catcher (Cycles) or a plain plane: only useful without alpha."""
    if mode == "none":
        return None
    mesh = bpy.data.meshes.new("ground")
    mesh.from_pydata(
        [(-40, -40, 0), (40, -40, 0), (40, 40, 0), (-40, 40, 0)],
        [],
        [(0, 1, 2, 3)],
    )
    mesh.update()
    ob = bpy.data.objects.new("ground", mesh)
    bpy.context.scene.collection.objects.link(ob)
    mat = bpy.data.materials.new("ground")
    mat.use_nodes = True
    bsdf = mat.node_tree.nodes["Principled BSDF"]
    bsdf.inputs["Base Color"].default_value = hex_to_linear_rgba("#0b1014")
    bsdf.inputs["Roughness"].default_value = 0.96
    ob.data.materials.append(mat)
    if mode == "shadow":
        for attr, value in (("is_shadow_catcher", True),):
            try:
                setattr(ob, attr, value)
            except Exception:
                try:
                    ob.cycles.is_shadow_catcher = value
                except Exception:
                    log("shadow catcher unavailable; using a solid ground")
    return ob


def add_area_light(name, location, energy, size, colour=(1.0, 1.0, 1.0), aim=(0, 0, 0.9)):
    data = bpy.data.lights.new(name, type="AREA")
    data.shape = "RECTANGLE"
    data.size = size
    data.size_y = size * 0.6
    data.energy = energy
    data.color = colour
    ob = bpy.data.objects.new(name, data)
    ob.location = location
    direction = Vector(aim) - Vector(location)
    ob.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()
    bpy.context.scene.collection.objects.link(ob)
    return ob


def add_lights(scene, key=1400.0, fill=420.0, rim=900.0):
    """Three-point studio setup in the design tokens' spirit: soft key, cool fill, rim.

    The powers are flags because a white matte material at close range clips the key
    highlight long before the picture is wrong; the fix is a number, not a new scene.
    """
    world = bpy.data.worlds.new("plate_world")
    world.use_nodes = True
    bg = world.node_tree.nodes["Background"]
    bg.inputs["Color"].default_value = (0.045, 0.055, 0.065, 1.0)
    bg.inputs["Strength"].default_value = 1.0
    scene.world = world
    add_area_light("key", (4.2, -5.4, 6.2), key, 5.0, (1.0, 0.97, 0.93))
    add_area_light("fill", (-5.6, -3.2, 2.6), fill, 6.0, (0.80, 0.90, 1.0))
    add_area_light("rim", (-1.6, 6.4, 4.4), rim, 4.0, (0.72, 1.0, 0.92))


def add_camera(scene, fov_deg, width, height):
    cam_data = bpy.data.cameras.new("plate_cam")
    cam_data.sensor_fit = "VERTICAL"
    cam_data.sensor_height = 24.0
    cam_data.lens = (cam_data.sensor_height / 2.0) / math.tan(math.radians(fov_deg) / 2.0)
    cam = bpy.data.objects.new("plate_cam", cam_data)
    scene.collection.objects.link(cam)
    scene.camera = cam
    return cam


def place_camera(cam, radius, height, azimuth_deg, target_z):
    a = math.radians(azimuth_deg)
    cam.location = (math.cos(a) * radius, math.sin(a) * radius, height)
    direction = Vector((0.0, 0.0, target_z)) - Vector(cam.location)
    cam.rotation_euler = direction.to_track_quat("-Z", "Y").to_euler()


def setup_render(scene, engine, samples, width, height, alpha, denoise):
    render = scene.render
    render.engine = engine
    render.resolution_x = width
    render.resolution_y = height
    render.resolution_percentage = 100
    render.fps = 30
    render.film_transparent = alpha
    render.image_settings.file_format = "PNG"
    render.image_settings.color_mode = "RGBA" if alpha else "RGB"
    render.image_settings.color_depth = "8"
    render.image_settings.compression = 15
    scene.view_settings.view_transform = "Standard"
    scene.view_settings.look = "None"
    scene.view_settings.exposure = 0.0
    scene.view_settings.gamma = 1.0
    if engine == "CYCLES":
        cycles = scene.cycles
        cycles.samples = samples
        cycles.preview_samples = samples
        cycles.use_animated_seed = False
        cycles.seed = 0
        for attr in ("use_motion_blur",):
            if hasattr(cycles, attr):
                setattr(cycles, attr, False)
        cycles.use_denoising = bool(denoise)
        if denoise:
            try:
                cycles.denoiser = "OPENIMAGEDENOISE"
            except Exception:
                pass
        cycles.max_bounces = 6
        cycles.diffuse_bounces = 2
        cycles.glossy_bounces = 2
        cycles.transmission_bounces = 2
        cycles.transparent_max_bounces = 4
        cycles.caustics_reflective = False
        cycles.caustics_refractive = False
    else:
        eevee = getattr(scene, "eevee", None)
        if eevee is not None and hasattr(eevee, "taa_render_samples"):
            eevee.taa_render_samples = min(samples, 64)
        if hasattr(render, "use_motion_blur"):
            render.use_motion_blur = False


# --------------------------------------------------------------------------- #
# main
# --------------------------------------------------------------------------- #


def main():
    args = parse_args()
    scene = reset_scene()
    ensure_cycles()
    engine = resolve_engine(scene, args.engine)
    if engine is None:
        print(json.dumps({
            "ok": False,
            "error": "engine %r unavailable" % args.engine,
            "available": cycle_engines(),
        }))
        return 2

    device_info = None
    if engine == "CYCLES":
        device_info = set_cycles_device(args.device)

    if args.probe:
        # A probe has to exercise the same things a real render does (camera,
        # lights, something to hit), otherwise "rendered nothing" passes for a pass.
        bpy.ops.mesh.primitive_cube_add(size=1.0, location=(0, 0, 0.5))
        add_lights(scene, args.key_power, args.fill_power, args.rim_power)
        probe_cam = add_camera(scene, args.fov, 64, 64)
        place_camera(probe_cam, 3.2, 1.6, -30.0, 0.5)
        setup_render(scene, engine, 4, 64, 64, True, args.denoise)
        probe_path = os.path.join(args.out, "probe.png")
        os.makedirs(args.out, exist_ok=True)
        scene.render.filepath = probe_path
        started = time.time()
        try:
            bpy.ops.render.render(write_still=True)
            ok = os.path.exists(probe_path)
        except Exception as exc:
            ok = False
            print(json.dumps({"ok": False, "error": "%s: %s" % (type(exc).__name__, exc)}))
            return 3
        print(json.dumps({
            "ok": ok,
            "engine": engine,
            "available_engines": cycle_engines(),
            "device": device_info,
            "gpu": gpu_report(),
            "blender": bpy.app.version_string,
            "seconds": round(time.time() - started, 2),
        }, indent=2))
        return 0

    if not os.path.exists(args.glb):
        raise SystemExit("glb not found: %s" % args.glb)
    os.makedirs(args.out, exist_ok=True)

    imported, meshes = import_glb(args.glb)
    tris = 0
    verts = 0
    for ob in meshes:
        ob.data.calc_loop_triangles()
        tris += len(ob.data.loop_triangles)
        verts += len(ob.data.vertices)
    norm = normalise(imported, meshes, args.height_units)
    shade(meshes, args.material, args.color)
    add_ground(args.ground, args.alpha)
    add_lights(scene, args.key_power, args.fill_power, args.rim_power)
    cam = add_camera(scene, args.fov, args.width, args.height)
    setup_render(scene, engine, args.samples, args.width, args.height, args.alpha, args.denoise)

    count = args.end - args.start + 1
    if count <= 0:
        raise SystemExit("empty frame range: %d..%d" % (args.start, args.end))

    plates = []
    per_frame = []
    started_all = time.time()
    for index, frame in enumerate(range(args.start, args.end + 1)):
        t = index / (count - 1) if count > 1 else 0.0
        radius = args.radius[0] + (args.radius[1] - args.radius[0]) * t
        cam_height = args.cam_height[0] + (args.cam_height[1] - args.cam_height[0]) * t
        azimuth = args.azimuth[0] + (args.azimuth[1] - args.azimuth[0]) * t
        place_camera(cam, radius, cam_height, azimuth, args.target_z)
        scene.frame_set(frame)
        path = os.path.join(args.out, "plate_%04d.png" % frame)
        scene.render.filepath = path
        started = time.time()
        bpy.ops.render.render(write_still=True)
        elapsed = time.time() - started
        per_frame.append(round(elapsed, 3))
        plates.append({
            "frame": frame,
            "file": os.path.basename(path),
            "bytes": os.path.getsize(path),
            "sha256": sha256_file(path),
        })
        log("frame %d/%d  %.2fs  %s" % (index + 1, count, elapsed, os.path.basename(path)))

    total = time.time() - started_all
    report = {
        "blender": bpy.app.version_string,
        "engine": engine,
        "device": device_info,
        "gpu": gpu_report(),
        "resolution": [args.width, args.height],
        "samples": args.samples,
        "alpha": args.alpha,
        "denoise": args.denoise,
        "material": {"preset": args.material, "color": args.color},
        "ground": args.ground,
        "model": {
            "path": os.path.relpath(args.glb, os.getcwd()) if not os.path.isabs(args.glb) else args.glb,
            "bytes": os.path.getsize(args.glb),
            "sha256": sha256_file(args.glb),
            "triangles": tris,
            "vertices": verts,
            "normalised": norm,
        },
        "camera": {
            "radius": args.radius,
            "height": args.cam_height,
            "azimuth_deg": args.azimuth,
            "target_z": args.target_z,
            "fov_vertical": args.fov,
        },
        "lights": {"key_w": args.key_power, "fill_w": args.fill_power, "rim_w": args.rim_power},
        "frames": {"start": args.start, "end": args.end, "count": count, "fps": args.fps},
        "timing": {
            "total_s": round(total, 3),
            "per_frame_s": per_frame,
            "mean_s": round(sum(per_frame) / len(per_frame), 3),
            "median_s": round(sorted(per_frame)[len(per_frame) // 2], 3),
        },
        "plates": plates,
    }
    with open(os.path.join(args.out, "report.json"), "w") as fh:
        json.dump(report, fh, indent=2)
        fh.write("\n")
    log("%d plate(s) in %.1fs (mean %.2fs/frame) -> %s"
        % (count, total, report["timing"]["mean_s"], args.out))
    return 0


if __name__ == "__main__":
    sys.exit(main())
