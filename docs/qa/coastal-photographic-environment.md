# Infinity photographic environment

Branch: feat/premium-infinity-waterline-v1. Existing WIP preserved. No commit, push or deployment.

## Asset and integration

Simon’s Town Rocks, Greg Zaal / Poly Haven, CC0: https://polyhaven.com/a/simons_town_rocks and https://polyhaven.com/license. Official unmodified 8K tonemapped JPEG (6,454,080 bytes) and 1K HDR (1,553,215 bytes), from the same 360° capture; published MD5 hashes verified. Detailed provenance lives in public/hdri/simons-town-rocks-LICENSE.md. No photographic pool or generated image is used.

The daylight Infinity scene replaces the procedural sea/headlands with a ground-projected spherical panorama. The existing near terrain keeps its vertices and grade; distant triangles beyond its transition apron are omitted and its locally neutral rocky finish blends into the projected ground. The pool, deck, receiver, liner, water shaders and stairs are unchanged. Background and HDR reflection orientation follow the selected Infinity side. The directional sun is aligned to the measured HDR hotspot (u=.6328125, v=.591796875), only in daytime Infinity. Existing initial camera is unchanged. Night Infinity retains the preceding procedural environment; other hydraulic systems retain their existing environment.

## Actual preview verification

Desktop 1038×934, canvas 540×827, DPR 2; rectangle 10×4.5×1.5 m, White liner, existing stairs and lights. Sides 4 and 2, initial framing, short and wider orbit, zoom. The panorama remains visible on both sides. Mobile emulation 390×844 (not a physical phone), expanded view and orbit. Temporary viewport override reset afterward. Near ground and deck retain positional parallax; distant photography cannot provide independent parallax for individual photographed rocks.

- Before, same pool and initial camera: /private/tmp/coastal-photo-before.png
- Final initial view: /private/tmp/coastal-photo-after.png
- Short orbit: /private/tmp/coastal-photo-orbit.png
- Opposite side: /private/tmp/coastal-photo-side2.png
- Mobile emulation: /private/tmp/coastal-photo-mobile.png

Visual result: photographic coast, sea detail and continuous horizon replace dominant synthetic walls. Clear improvement over the procedural composition, not a claim that the complete pool render matches a real photograph. The photographed sea is static. Background geometry approximates the distant capture; free orbit is supported, but close inspection of photographed foreground rocks is not equivalent to scanned 3D terrain. The pre-existing Infinity film readability limitation remains open.

## Performance: no FPS improvement claim

Temporary WebGL2 EXT_disjoint_timer_query_webgl2 instrumentation measured elapsed GPU work separately from RAF intervals, discarding disjoint samples. 180-frame warm-up, 180-frame sampling windows, same camera/viewport/DPR/configuration. Startup, transitions and build activity were excluded from the matched return comparison. Diagnostic instrumentation was removed.

| Warm scene | GPU mean ± within-window SD, ms | RAF mean ± within-window SD, ms |
|---|---|---|
| Candidate, fresh page, window 1 | 29.10 ± 9.10 | 36.30 ± 11.48 |
| Candidate, fresh page, window 2 | 26.60 ± 8.33 | 33.60 ± 11.30 |
| Original restored, fresh page, window 1 | 58.61 ± 16.18 | 66.10 ± 18.49 |
| Original restored, fresh page, window 2 | 43.48 ± 21.17 | 51.69 ± 24.34 |
| Original restored, fresh page, window 3 | 36.43 ± 12.79 | 45.44 ± 15.77 |

The wider session was unstable: original GPU windows ranged from roughly 10 to 38 ms before editing; candidate windows during iteration reached roughly 100 ms. The fresh-page comparison does not demonstrate an attributable regression from the final asset, but neither establishes a causal speedup or stable target frame rate. No inference that “more/fewer texture maps” caused those fluctuations. The far terrain is not rendered as a fullscreen transparent apron; its unused triangles are omitted, without reducing pool quality.

Loading, same local Vite server, three sequential HTTP trials (transfer only, not complete render): old 2K sky 0.703/0.087/0.079 s; new JPEG+HDR combined 1.121/0.185/0.286 s. Browser loader callbacks: JPEG first observed 2.502 s, cached reload 0.078 s; HDR 0.057/0.070 s. These are local/cache-dependent measurements, not production network estimates. GPU upload/first fully rendered frame is not included in the loader callback timing.

## Files and checks

Application: src/components/pool/three/PoolScene.tsx, DaylightEnvironment.tsx, coastalLayout.ts; new CoastalPhotoBackdrop.tsx. Two asset files plus license and this report. The unused 4K HDR trial was moved out of public assets to /private/tmp/coastal-photo-baseline/simons-town-rocks-4k-unused.hdr, recoverable.

TypeScript PASS; Vite production build PASS (existing chunk/tooling warnings); four-side photographic sun/panorama orientation check PASS; git diff --check PASS. No pool geometry, UI, configurator state or water-material changes. No permanent profiler or diagnostic hooks.
