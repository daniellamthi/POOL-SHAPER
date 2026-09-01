# Blender/Cycles photorealistic render pipeline

Separate render pipeline for the pool configurator. The live app
(Three.js/R3F, including Photo Mode's own in-browser path tracer -- see
`docs/PHOTO_MODE.md`) stays exactly as it is; this is an *additional*,
on-demand path for a fully offline, physically-based Cycles render, driven
by the same configuration.

## Status: architecture and scripts only -- **not yet run against real Cycles**

Blender is not installed in the environment this was built in (`which
blender` finds nothing). Everything below has been verified as far as it can
be without Blender:

- `config_loader.py` has no `bpy` dependency. Its self-test actually runs:
  `python3 config_loader.py` loads and validates
  `fixtures/golden_scene.json` and prints a summary; a second check (not
  wired into any file, run ad hoc during development) confirmed it correctly
  *rejects* an incomplete document instead of silently accepting it.
- `camera_builder.py`'s pure-math half (`compute_look_at_matrix`,
  `compute_focal_length_mm`) also has no `bpy` dependency and its self-test
  (`python3 camera_builder.py`) actually runs.
- `geometry_builder.py`, `material_builder.py`, `water_builder.py`,
  `scene_builder.py`, and the `bpy`-dependent half of `camera_builder.py`
  all import `bpy` and raise a clear `RuntimeError` if imported outside
  Blender. They have been syntax-checked (`python3 -m py_compile`) but
  **never executed** -- there has been no Cycles render, no screenshot, no
  confirmation the generated mesh/materials/camera actually produce a
  correct image. Treat their geometry/node-graph logic as reviewed-but-
  unverified code, not proven.

## The one source of truth

Nothing in this pipeline re-derives pool geometry/material rules from
scratch. The app's own "Generate Photorealistic Render" button (see
`src/components/pool/PoolViewport.tsx`) calls
`serializePoolRenderConfig()` (`src/lib/render-pipeline/serialize.ts`), which
calls the *exact same functions* the live Three.js renderer uses --
`buildOutline`, `getPoolVerticalLayout`, `resolveMaterials`, `getCameraPose`
-- and packages their output as a `PoolRenderConfig` JSON document, validated
against `src/lib/render-pipeline/schema.ts` (Zod) before it ever reaches
Blender. `config_loader.py` re-validates the same document on the Python
side (hand-kept in sync with the Zod schema -- there is no shared codegen).

Blender never sees the app's internal `PoolConfig`/React state, only this
JSON. If the pool config changes shape, update `PoolRenderConfig`
(`src/lib/render-pipeline/types.ts`), its Zod schema, `config_loader.py`'s
validators, and whichever builder(s) consume the new field -- in that order.

## Layout

| File | Depends on `bpy`? | Role |
|---|---|---|
| `config_loader.py` | No | Load + validate the JSON, resolve site-relative asset URLs against `--assets-root`. |
| `geometry_builder.py` | Yes | Floor/walls/coping/water meshes from `shape.outline` + `verticalLayout`. |
| `material_builder.py` | Yes | Principled BSDF materials for the liner/mosaic finish and the coping stone. |
| `water_builder.py` | Yes | Principled BSDF + Volume Absorption water material from `water`. |
| `camera_builder.py` | Half/half | `compute_look_at_matrix`/`compute_focal_length_mm` are pure math; `create_camera` builds the actual Blender camera object from them. |
| `scene_builder.py` | Yes | Orchestrates the above, sets up the HDRI world background and Cycles render settings. |
| `pool_render.py` | Yes (entry point) | CLI: parses `--config`/`--assets-root`/`--out`/`--width`/`--height`/`--samples`, calls `scene_builder.build_scene`, renders, writes the PNG. |
| `fixtures/golden_scene.json` | -- | The first benchmark scene (see below). |

## Running a render (once Blender is installed)

From the app's project root (`pool-shape-shaper-main/`), with a config JSON
either exported from the app's "Generate Photorealistic Render" button or the
bundled Golden Scene fixture:

```bash
blender --background --factory-startup --python rendering/blender/pool_render.py -- \
  --config rendering/blender/fixtures/golden_scene.json \
  --assets-root public \
  --out /tmp/golden-scene.png \
  --width 1920 --height 1080 --samples 256
```

`--assets-root public` is what makes `finish.textureUrl` /
`environment.hdriUrl` (site-relative paths like
`/textures/pvc-liner/motion-sand-beach-179.png`) resolve to real files --
point it at this project's `public/` directory (both are already committed:
the liner textures and the two Photo Mode HDRIs).

## The Golden Scene

The first target, exactly as specified: **Rectangle, 8 × 4 m, depth 1.50 m,
in-ground, skimmer, Motion Sand Beach [179], Hero Camera, Sunny Day.**
`fixtures/golden_scene.json` is a hand-built (not live-exported -- there is
no browser/Blender in this environment to export or render it) example of
exactly what `serializePoolRenderConfig()` would produce for that
configuration; every number in it (outline vertices, `verticalLayout`,
camera `position`/`target`) was computed with the same formulas as
`getPoolVerticalLayout()` / `getCameraPose()`, not guessed. It has been
validated against both the Zod schema (Node, via
`node --experimental-strip-types`) and `config_loader.py` (plain `python3`).

Once Blender is available, this is the first thing to actually render, and
the reference image to eyeball for "does this look like the app's Photo
Mode/HDRI look, translated to a real path tracer" before generalising to
custom shapes, above-ground pools, overflow systems, mosaic finishes,
staircases, and accessories.

## What's next (explicitly out of scope for this pass)

Per the brief ("non implementare subito tutte le combinazioni"), only the
Golden Scene's own combination is built out:

- **Custom (non-rectangle) shapes**: `geometry_builder.py`'s outline-based
  meshing already works for any closed polygon, but `_offset_outline_2d`'s
  averaged-normal coping offset is only exact for a convex rectangle: a
  concave custom outline will need a proper polygon-offset (the same
  problem `offsetOutline()` solves on the TS side) before the coping ring
  looks right.
- **Above-ground pools**: `verticalLayout` already carries the right numbers
  for this case (see `getPoolVerticalLayout`), but the above-ground
  structure's outer panel/cladding geometry (see `PoolModel.tsx`'s "panel"
  mesh) has no Blender-side equivalent yet -- only the basin.
- **Overflow systems**: `structure.overflowType` is exported and validated,
  but `geometry_builder.py` only builds a skimmer-style coping/waterline; the
  visible/hidden overflow channel geometry (see `PoolModel.tsx`'s overflow
  branch) isn't built.
- **Mosaic finish**: `material_builder.py` already reads `finish.textureUrl`
  generically, so a mosaic config should mostly work, but it hasn't been
  exercised (no mosaic PNG loaded, no tiling/repeat scale applied -- the live
  app tiles by `tileSize`, this pipeline doesn't set UV scale at all yet).
- **Staircase / accessories**: exported as metadata (`staircase.present`,
  `staircase.kind`, `accessories[]`) but not modelled -- no external
  staircase mesh, no LED/hydromassage geometry. `geometry_builder.py`'s
  module docstring flags these as the extension points.
- **Non-"hero" camera presets**: `overview`/`skimmer`/`overflow`/`liner`/
  `mosaic` all round-trip through the schema and `getCameraPose()` already
  (the serializer accepts a `cameraPreset` option), just not exercised by
  the Golden Scene or wired into the UI button (which always requests
  `"hero"` for now).

## What's needed to run the first real Cycles render

1. Install Blender (4.x recommended; the Principled BSDF input names above
   handle both the 4.x `"Transmission Weight"`/`"Coat Weight"` and the 3.x
   `"Transmission"`/`"Clearcoat"` naming).
2. Run the command in "Running a render" above against
   `fixtures/golden_scene.json`.
3. Look at the actual output. Expect to need at least one iteration on
   `water_builder.py`'s volume-absorption density/tint mapping and
   `material_builder.py`'s bump strength -- both are principled first
   guesses, not values measured against a real render the way
   `docs/PHOTO_MODE.md`'s path-tracer numbers were.
