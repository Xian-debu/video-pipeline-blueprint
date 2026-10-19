# Blender plates: offline renders the pipeline can consume

Blender is an **optional** leg. The daily chain (`npm run make`) never calls it, and a fresh
checkout renders fine without it: `PlateStage` is the only consumer, and `verify.sh` skips the plate
step when `public/plates/showcase` is absent.

It exists for the one thing a real-time canvas is bad at: **final-quality** lighting, soft shadows
and glossy material response that take longer than 1/30 s to compute. The plate is baked once,
checked into a report, and then composited in Remotion like any other image — the difference is that
the image is a photo, not a drawing.

Where the 3D work sits, in one line each:

| Leg | What it is | Where |
| --- | --- | --- |
| Scene layer | Three.js/R3F composited inside the frame | `src/showcase/ThreeStage.tsx`, `src/design/three/` ([docs/3d.md](3d.md)) |
| Plates | Blender renders a numbered PNG set offline; Remotion shows it | `src/showcase/PlateStage.tsx`, this document |
| Asset workbench | optional GUI use of Blender to author `.glb` | not automated, not a dependency |

## Install

Pinned: **Blender 5.2.2 LTS** (build `2026-09-15`, hash `d13f752e3b9c`), unpacked at
`/opt/aigen/video2/env/blender/`. `scripts/blender/render_plates.sh` finds it via `$BLENDER`, then
that path, then `command -v blender`; if none is found it exits 2 and points here.

```sh
curl -fsSLO https://download.blender.org/release/Blender5.2/blender-5.2.2-linux-x64.tar.xz
sha256sum blender-5.2.2-linux-x64.tar.xz   # 84098912789dc450e95697c4184fb8a90acbe5111c2ba4aede3fecb57806a168
tar xf blender-5.2.2-linux-x64.tar.xz -C /opt/aigen/video2/env/
mv /opt/aigen/video2/env/blender-5.2.2-linux-x64 /opt/aigen/video2/env/blender
```

No GUI, no display server, no `apt` packages. If a single `curl` stalls at a few dozen MB (it did
here: 383,295,504 B, connection frozen at 92.8 MB), fetch it in 16 MiB ranges in parallel, verify each
range's length, concatenate, then verify the whole file's sha256. Mirrors (TUNA, aliyun) did not carry
5.2 at the time; `pip install bpy` only offers a `cp313` wheel, so it is not a drop-in for a
different Python.

## The contract

A plate set is a **directory plus a manifest**, and the manifest is the contract:

```
public/plates/showcase/
  plate_0000.png … plate_0089.png
  report.json
```

`report.json` records the blender version, engine, device, resolution, samples, alpha/denoise,
material preset and colour, camera sweep, model path/bytes/sha256/triangles, per-frame timings, and
for every plate its file name, byte size and sha256. `scripts/qa/plate_lint.mjs` compares the
manifest against the files, so a stale or hand-edited plate cannot pass:

- required fields present and typed; `engine` one of `CYCLES`, `BLENDER_EEVEE`, `BLENDER_EEVEE_NEXT`, `BLENDER_WORKBENCH`; `samples > 0`; `timing.mean_s > 0`
- contiguous frames: `frames.count == plates.length == end - start + 1`, and `plates[i].frame == start + i`
- every PNG exists, and its **byte size and sha256 match the report**
- `PLATE_STAGE_FRAMES` in `src/showcase/PlateStage.tsx` equals `frames.count` (a plate set and its consumer cannot drift apart)
- `model.sha256` equals the repo's `.glb`, when that file is present

Plates are **not committed** (`.gitignore`: `public/plates/`). They are reproducible artifacts
described by their manifest: same `.glb` sha, same numbers, same pixels. The report also means the
composition can *display* what it is showing — engine, samples, seconds per frame, model hash.

## Rendering

```sh
npm run plates -- --glb public/models/nailong_v3_15k.glb --alpha --samples 64
```

The scene is **code, not a `.blend` file** (`scripts/blender/render_plates.py`): the `.glb` is
imported, normalised to `--height-units` with the bounding box floored at z=0, smoothed, given a
Principled material from a preset table, lit by the same three-point rig the real-time layer uses
(key at `(4.2, -5.4, 6.2)`, fill at `(-5.6, -3.2, 2.6)`, rim at `(-1.6, 6.4, 4.4)`, world
`(0.045, 0.055, 0.065)`),
and shot by a camera that moves linearly across the frame range. Every parameter is a CLI flag, so a
plate set is a command, not a scene someone hand-tweaked.

| Flag | Default | Meaning |
| --- | --- | --- |
| `--glb` | required | model to render |
| `--out` | `public/plates/showcase` | plate directory (must be the one `plate_lint` reads) |
| `--engine` | `cycles` | `cycles`, `eevee`, `workbench` (see the engine note below) |
| `--device` | `GPU` | `GPU` (OptiX/CUDA/HIP/oneAPI/Metal, first that works) or `CPU` |
| `--samples` | `64` | Cycles samples; `--probe` forces 4 |
| `--width` `--height` | `1920` `1080` | plate resolution |
| `--start` `--end` `--fps` | `0` `89` `30` | frame range and fps; `PlateStage` renders at the same fps |
| `--height-units` | `2.0` | target height in scene units (matches the 3D layer's normalisation) |
| `--radius` `--height-cam` `--azimuth` | `4.8 4.8` `2.2 2.9` `30 -30` | camera sweep: `from to`, interpolated linearly over the range, azimuth in degrees |
| `--target-z` | `0.9` | look-at height |
| `--fov` | `50` | vertical field of view, degrees |
| `--material` `--color` | `matte` `#b9b3a8` | preset (`matte`/`satin`/`metal`/`glow`) and sRGB hex |
| `--key-power` `--fill-power` `--rim-power` | `1100` `380` `720` | light watts; a white matte at close range clips the key highlight, so the colour is usually the knob to turn first |
| `--ground` | `shadow` | `none`, `shadow` (shadow catcher) or `solid` |
| `--alpha` | off | transparent film, RGBA PNG |
| `--denoise` / `--no-denoise` | on | OpenImageDenoise |

`--probe` renders one 64×64 frame of a test cube after setting up camera, lights and shadows, and
prints JSON (engine, device list, renderer, seconds). Use it first on a new machine: it is the check
that "the GPU is actually being used" and "the engine is not silently software".

**Material and light are one decision.** A near-white material (`#e8e4dc`) under the original
`1400 W` key clips the top of this model to pure white at `--radius 4.8`: the silhouette survives,
the form does not. A mid tone (`#b9b3a8`) with a `1100 W` key keeps the gradient that describes the
shape while the plate still reads bright against a dark frame. That is why those are the defaults.

## What it costs (measured here)

RTX 5070 Laptop, Cycles CUDA, denoise on, shadow catcher, alpha, this asset (14,532 tris).
Three frames per row; median reported.

| Resolution | Samples | Mean s/frame | Median s/frame | 90 frames |
| --- | --- | --- | --- | --- |
| 1920×1080 | 16 | 5.59 | 5.56 | ≈ 8.3 min |
| 1920×1080 | 32 | 6.17 | 6.10 | ≈ 9.2 min |
| 1920×1080 | 64 | 7.16 | 7.13 | ≈ 10.7 min |
| 1280×720 | 64 | 3.37 | 3.36 | ≈ 5.0 min |

Two conclusions worth keeping:

- **Samples are cheap, resolution is not.** 4× the samples costs 28 % more time; a quarter of the
  pixels costs half. The fixed cost (scene sync, denoise, PNG) dominates at this resolution.
- **A plate set is an afternoon, not a render farm.** 90 frames at final quality is ~11 minutes; it
  never belongs in the per-edit loop, which is exactly why plates are a separate, cached artifact.

## The engine note (read before choosing EEVEE)

`blender -b` has no display. What that means here, measured on this machine:

- **EEVEE renders, but on the software rasteriser.** The probe reports
  `renderer: "llvmpipe (LLVM 20.1.2, 256 bits)", vendor: "Mesa"` and logs
  `libEGL warning: failed to get driver name for fd -1`, `MESA: error: ZINK: failed to choose pdev`,
  `EGL Error (0x3009): EGL_BAD_MATCH`. A 64×64, 4-sample probe took **8.82 s**. That is not a GPU
  path; it is Mesa drawing on the CPU.
- **Cycles works without EGL** because it talks to CUDA directly. Same probe: **0.43 s**, device
  `CUDA`, `NVIDIA GeForce RTX 5070 Laptop GPU`.
- **OptiX failed to initialise** (`OptiX initialization failed with error code 7804`) and HIP has no
  library here, so the device resolver falls through to CUDA. That is the intended behaviour, not a
  bug: `--device GPU` means "the fastest backend that loads", never "OptiX or nothing".
- **The engine enum lies.** Under `--factory-startup` the Cycles addon is loaded but
  `bpy.types.RenderSettings.bl_rna.properties["engine"].enum_items` lists only `BLENDER_EEVEE`;
  `addon_utils.enable("cycles")` succeeds and the enum still does not change. So `resolve_engine()`
  probes by **assignment** (`scene.render.engine = "CYCLES"` in a `try`, `TypeError` = unavailable).
  A gate that trusted the enum would have concluded Cycles does not exist.
- In 5.2 the EEVEE identifier is `BLENDER_EEVEE` (5.x dropped `_NEXT`), so both are accepted.

Net: **use Cycles for plates.** EEVEE in background mode is a CI trap — it looks like it renders,
and then you pay software-rendering prices per frame.

## Consuming a plate set

`PlateStage` (`src/showcase/PlateStage.tsx`) is a normal frame-driven composition:

1. `fetch(staticFile("plates/showcase/report.json"))` inside `delayRender` — the manifest must arrive
   before the first frame, otherwise the composition would guess.
2. frame `n` shows `plate_(start+n)`, as an `<Img>` with `objectFit: contain` in a `left: 34 %`
   column; the 2D layer keeps the left third for text, exactly like the 3D shot C.
3. the panel prints what the artifact *is*: engine, samples, mean seconds per frame, model sha256
   prefix. A plate is evidence, so the frame states its provenance.
4. a missing set is loud: HTTP 404 logs *render the plates first: `npm run plates`*, and a frame
   outside the range throws rather than freezing on the last plate.

Because the images are stills composited per frame, everything the rest of the pipeline relies on
still holds: no clock, no network at render time, deterministic output.

## Gates

| Gate | Checks |
| --- | --- |
| `npm run lint:plates` (`scripts/qa/plate_lint.mjs`) | manifest integrity, frame continuity, PNG bytes+sha256, consumer duration, model hash |
| `npm run lint:stills` | plate frames are in the still set (composition renders without throwing) |
| `bash scripts/verify.sh` | step `2.8/6` runs `plate_lint` when `public/plates/showcase` exists, and prints why it skipped when it does not |

`plate_lint` deliberately does **not** judge the picture. It cannot tell a beautiful sweep from an
ugly one; that stays a human still review, same as every other composition.

## Known limits

- **The camera can move; nothing else can.** The plate is a still sequence — no object animation, no
  shape keys, no cloth. Animated geometry belongs in the real-time layer (or a future frame-range
  render).
- **Re-rendering is all-or-nothing.** There is no resumable partial render; changing one number
  re-renders the set. At ~11 min for 90 frames that is acceptable and was chosen over cache
  invalidation logic.
- **Plates are not in git.** They are reproducible from the command in the report; a clone without
  Blender simply has no `PlateStage` visuals.
- **The plate is not colour-managed against the DOM.** `view_transform = "Standard"` is deliberate:
  the plate should land in the frame looking like the still you reviewed, not like a filmic tone map
  applied to half the frame.
- **Ground shadows and alpha have to agree.** With `--alpha` and `--ground shadow` the catcher
  contributes shadow density, not a visible floor; a `solid` ground plus alpha gives you a floating
  lit floor with transparent corners, which is rarely what you want.
