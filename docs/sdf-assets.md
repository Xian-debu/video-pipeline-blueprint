# Generated assets (SDF / CSG)

The third way to get a prop into a scene, after *scanned* meshes (a real object, reconstructed)
and *modelled* ones (a human in Blender): **describe the shape as a function and let a program
extract the surface**.

Why it earns its place: the description is text (diffable, reviewable, reproducible to a hash),
booleans are exact instead of an artist's click, and the normals are the analytic gradient of the
field — smooth by construction, not by subdivision or by a smoothing pass over vertex soup.
`scripts/assets/sdf_props.mjs` is that program. It is pure Node, zero dependencies, ~600 lines.

## The three props

| Prop | Expression | Why it is interesting |
| --- | --- | --- |
| `prop_gear.glb` | cylinder − 4 lightening holes − axle hole, union 12 tooth boxes | a boolean *subtraction* removes interior surface no modelling step can leave behind |
| `prop_chip.glb` | rounded box + 12 pins − one straight slot | a mixed union/subtraction whose parts share one `smooth min` boundary |
| `prop_nut.glb` | 3 rotated hex prisms (union) − threaded bore | a shape that has no axis-aligned face at all — the worst case for a voxel extractor |

All three are watertight, closed, non-self-intersecting meshes with per-vertex normals. They are
small on purpose (1.5-2.3 units across) so they can sit in a lit scene at camera distance 8.

## Pipeline

```
SDF (JS function)  ->  sample on a grid  ->  surface nets  ->  Newton projection
                   ->  Taubin smoothing   ->  reproject onto the isosurface  ->  GLB
```

1. **Sample** the field at `(res+1)^3` grid corners inside a cube the prop declares itself
   (`half`, e.g. 1.25). No bounding-box scan: a scan misses thin features, the box ends up tight
   around the solid, and the extractor then *clips* the surface (measured: 872 boundary edges on
   the chip).
2. **Surface nets** (a dual isosurface method): one vertex per cell that the surface crosses,
   placed at the average of the edge crossings; one quad per grid edge that changes sign, joining
   the four cells around it. Watertightness is a property of the construction, not of a repair pass.
3. **Newton projection**: `p <- p - f(p) * grad f / |grad f|^2`, two iterations with the step
   clamped to 1.2 cells and a minimum gradient length of 0.2. Moves each vertex onto the real
   surface, which removes most of the half-cell corrugation. Topology (hence watertightness) is
   untouched.
4. **Taubin smoothing**: 6 alternating `lambda = 0.5` / `mu = -0.53` passes over the indexed
   neighbourhood. Alternating passes do not shrink the volume the way plain Laplacian smoothing
   does. It rounds cell-scale staircase on silhouettes.
5. **Reproject + normals**: after smoothing the vertices are pulled back onto the isosurface
   (0.6-cell clamp) and the normals are recomputed as the normalised field gradient.
6. **Write GLB**: one primitive, `POSITION` + `NORMAL` float32, `indices` uint32, JSON chunk padded
   with `0x20`, buffer views marked `ELEMENT_ARRAY_BUFFER` / `ARRAY_BUFFER`.

## Measured

Res 112, generator output on the reference machine (`npm run props`):

| Asset | Triangles | Volume (mesh) | Volume (Monte-Carlo) | ΔV | Watertight | Bytes |
| --- | --- | --- | --- | --- | --- | --- |
| `prop_gear.glb` | 61,088 | 0.5847 | 0.5871 | 0.42 % | yes | 1,466,808 |
| `prop_chip.glb` | 39,908 | 0.9109 | 0.9298 | 2.04 % | yes | 958,724 |
| `prop_nut.glb` | 50,128 | 0.8151 | 0.8284 | 1.61 % | yes | 1,203,956 |

Boundary edges and non-manifold edges are **0** for all three (checked inside the generator, and
again from the file by `model_lint.mjs --watertight`). The residual ΔV is the expected gap between
a polygonal approximation and the analytic volume; 2 % on the chip is the 12 thin pins.

Generation is deterministic — no `Math.random`, no clock: the same source produces the same bytes.

```
gear  sha256 57ec4bd056425241b355f068d671bed5090ccaed53e6cf28802a2c21d23b3431
chip  sha256 e3a84dbcf5afc3a1aef8cf2caa25386bbb1c7bcebc0d5eccf1028fa196c9d2ca
nut   sha256 e80ea5d20788f4ca326a27871fc95efc62cf05e26b6ded68832d92977df55a5c
```

## Gates

| Gate | Command | What it proves |
| --- | --- | --- |
| generator self-check | part of `npm run props` | the extracted mesh is watertight (every undirected edge used exactly twice, in opposite directions) and its volume agrees with a Monte-Carlo estimate |
| file gate | `npm run lint:props` | from the GLB alone: triangle budget, extent, `NORMAL` present, watertight |
| pixel gate | `node scripts/qa/still_lint.mjs` (`PropStage` at frames 45 and 110) | the props are actually in frame and the HUD does not collide |

The composition that consumes them is `PropStage` (`src/showcase/PropStage.tsx`, 5 s): three
props on a ground plane, camera orbiting 46°, all three loaded *before* the canvas mounts (see
`docs/known-issues.md` K20 — a model that arrives after mount is never drawn).

## Using the assets

`<Model source={gltf} fit="max" height={1.55} material="satin" color={PAL.accent} />`

`fit="max"` normalises the **longest** axis instead of the Y height. Gear and chip are flat: a
height fit scales a 0.38-tall gear to 2 units tall, i.e. 10 units wide, and it fills the frame.

Shadow tuning matters more than usual here: the props are 1.5 units across in a 2048 shadow map
whose camera spans ±9 units, so the default `1024` map and `bias` produced visible self-shadow
banding on flat faces. `StudioLights` takes `shadowSize`, `shadowBias` and `shadowNormalBias`;
`PropStage` passes `2048 / -0.0002 / 0.02`.

## Reproducing

```bash
npm run props          # writes public/models/prop_{gear,chip,nut}.glb at res 112
npm run lint:props     # GLB-level gate (watertight, normals, budget)
npx remotion still PropStage out/prop.png --frame=45
```

`node scripts/assets/sdf_props.mjs --list` prints the props. Single asset:
`--prop=gear --res=112 --out=…`, plus `--samples` for the Monte-Carlo volume check.

## Limits (read before adding a prop)

- **A feature thinner than one cell tears the mesh.** The quad for a sign-changing grid edge is
  only emitted if all four surrounding cells actually contain a vertex; a cell that is entirely
  outside a sub-cell-thick pin has none. The result is not "slightly rough", it is an open
  surface. Cell size is `2 * half / res`; keep the thinnest feature at >= 2 cells and use the
  reported `cell` value. At res 112 a 0.03-half-thickness pin (0.06 thick) is ~3 cells — fine;
  the same pin at res 64 is ~1 cell and the chip had 872 boundary edges.
- **Sharp edges get rounded at cell scale.** Surface nets has no edge representation: a 90° corner
  becomes a staircase of quads that Taubin rounds. Silhouettes are the honest limit of this
  method at res 112; if a prop's read depends on a crisp edge, raise `res` (cost: ~4x triangles per
  doubling, since the surface scales with res²) or model it.
- **Non-manifold edges appear when two different grid edges connect the same pair of cells** —
  again a thin-feature symptom, not a bug in the extractor. The generator fails (exit 1) instead of
  writing the file.
- **No UVs, no textures.** Material comes from the design tokens, like every other 3D asset here.
- **The generator is the source of truth.** Hand-editing a `.glb` puts the file and its description
  out of sync; re-run `npm run props` instead.
- **File size**: ~1 MB per prop at res 112 (float32 positions and normals). Budget for
  `public/models/` accordingly; the repository rule is 2 MB per file.
