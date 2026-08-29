# Photo Mode (path-traced still preview)

`PhotoModeRenderer.tsx` mounts `three-gpu-pathtracer`'s `WebGLPathTracer` in
place of the Canvas's normal raster loop while Photo Mode is active, and
progressively refines a single still frame of the *same* R3F scene graph the
live view already builds. Two things fall out of reusing that scene graph
as-is, and both bit us:

## Objects excluded from the traced scene

`PHOTO_MODE_EXCLUDED_NAMES` hides objects the tracer cannot render correctly:
today that's `contact-ao-decal` (a screen-space AO trick with no meaning to
a real light transport simulation). `PoolMeasurements` and `SkyDome` are
never added to the traced scene in the first place -- the former is DOM/HTML
overlay content outside the R3F tree, the latter is swapped for the tracer's
own `GradientEquirectTexture` environment (see the top of the effect) so the
background reads as a continuation of the live view's sky rather than a
flat mesh with no real illumination.

**Water is never on this exclusion list.** It is traced.

## Why the water used to render as bare (sand-coloured) pool floor

`WaterSurfaceMaterial`'s `meshPhysicalMaterial` is authored for the raster
pipeline: `onBeforeCompile` throws away the standard alpha/lighting output
and substitutes a custom mirror-reflection fragment (real-time reflection
render target, dual animated normal maps, IOR Fresnel). The path tracer
never runs `onBeforeCompile` -- by three-gpu-pathtracer's own design it reads
the *plain* material properties into its own uber-shader -- so in Photo Mode
it sees the raw combination the live shader was tuned around:
`transparent: true, opacity: 0.12, transmission: 0.92` (see
`docs/P1-C_WATER_BASELINE.md`, "Clean optical-base correction").

`transparent: true` + `opacity < 1` is a raster-only "blend the shaded pixel
at 12% over the background" trick. Read literally by the tracer, it hits a
different code path entirely. In
`node_modules/three-gpu-pathtracer/src/materials/pathtracing/glsl/get_surface_record_function.glsl.js`:

```glsl
// possibly skip this sample if it's transparent, alpha test is enabled, or we hit the wrong material side
...
|| material.transparent && ! useAlphaTest && albedo.a < rand( 3 )
) {
    return SKIP_SURFACE;
}
```

For any `transparent` material without `alphaTest`, the tracer treats
`opacity` as the probability that a given sample even interacts with the
surface -- otherwise the ray is skipped completely, as if the mesh weren't
there. At `opacity: 0.12` that's a ~88% skip rate. The water wasn't dim, it
was being hit on roughly one sample in eight, with the other seven eighths
of the accumulated image showing the pool floor straight through it -- which
is exactly the "vasca color sabbia" symptom.

### Fix

`PhotoModeRenderer.tsx` identifies every water mesh in the traced scene (main
basin + the skimmer tongue, both built from `WaterSurfaceMaterial`, matched
by the tag baked into its `customProgramCacheKey`) and swaps in a
Photo-Mode-only `MeshPhysicalMaterial`: `opacity: 1, transparent: false`, so
every sample interacts with the surface, with the "see-through" look carried
entirely by physical `transmission` (0.92) and `ior` (1.333, same as the live
material) instead of alpha blending. The override is created and applied
*after* the exclusion pass and *before* `tracer.setScene()`, and the original
raster material is restored the moment Photo Mode's `useEffect` cleans up --
the live view's material, and its `onBeforeCompile` reflection/ripple shader,
are never touched.

## Samples counter showing decimals

`WebGLPathTracer#samples` increments by `1 / totalTiles` per rendered tile
(`PathTracingRenderer.js`; tiling defaults to 3x3, so 9 tiles/sample) and is
only rounded once every tile in the current sample has been drawn. Reading
that mid-sweep is a legitimate "how far into this sample are we" progress
value -- the bug was the "Refining… N samples" overlay
(`PhotoModeStatus` in `PoolViewport.tsx`) displaying it raw instead of
flooring to the last fully-completed sample. Fixed with `Math.floor()` at
the point the overlay reads `photoModeState.samples`.

## Convergence speed

Checked against the library's own defaults, with the camera locked (no
mid-refine resets):

- `bounces` / `transmissiveBounces` default to **10** each -- sized for
  scenes with stacked glass/mirrors. This scene has one transmissive layer
  (water) over diffuse walls/floor under a flat sky; **6** bounces is enough
  for a path to cross the water, hit the floor, and pick up one indirect
  bounce with no visible difference, for measurably less GPU work per
  sample. Applied in `PhotoModeRenderer.tsx`.
- `dynamicLowRes` (a built-in 25%-resolution fallback preview shown while
  the full-resolution accumulation catches up) defaulted to **off** and was
  never turned on. It doesn't change the converged image, only what's shown
  before `minSamples` is reached (camera-lock mount, or after a reset) --
  turned on.
- `renderScale` defaults to **1** (full internal resolution, tied to the
  live Canvas's `dpr`, which the "experience" quality preset allows up to
  `2` -- i.e. up to 4x the pixel count of `dpr: 1` on a retina display).
  Left untouched here: lowering it trades sharpness for speed, which needs a
  product call, not just a bug fix. It's the next lever to pull if
  convergence still isn't fast enough after the bounce-count change.
- Measured with `scripts/photo-mode-verification/pw-water-check.mjs` /
  `pw-water-longrun.mjs`, headless,
  software-rendered (SwiftShader -- there is no GPU in this environment, so
  these are relative-only numbers, not representative of real hardware; a
  real GPU commonly does tens to hundreds of samples/second for a scene this
  size, where this ran at roughly one sample/second), 1440x900 canvas at
  `dpr:1`, camera locked from mount, default pool config:
  - Before (`bounces: 10`, `dynamicLowRes: false`): steady-state ~1.41
    s/sample (~0.71 samples/s) once past shader-compile warm-up.
  - After (`bounces: 6`, `transmissiveBounces: 6`, `dynamicLowRes: true`):
    steady-state ~0.76-0.88 s/sample (~1.2-1.3 samples/s) -- roughly
    **60-85% more samples per second**, same scene, same camera.
  - Noise: the image was still visibly grainy at 31 samples (t=91s), read as
    essentially clean by ~190 samples (t=220s), and fully clean but for two
    residual single-pixel fireflies (expected unfiltered-MC behaviour, not a
    bug) at 503 samples (t=450s) -- all measured post-tuning, on the
    SwiftShader baseline above.
