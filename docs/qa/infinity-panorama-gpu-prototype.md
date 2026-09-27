# Infinity panorama: controlled attempt — DISCARD

2026-09-26 · feat/premium-infinity-waterline-v1. No commit, push or deploy.

## Scope and preservation
Loaded VB Orchestrator, realtime-performance-profiler, realtime-pbr-photorealism, visual-reference-matching, threejs-shaders and threejs-geometry. Used the previously supplied real Infinity photograph ending `2c8e3caf-fb94-41cf-8cb8-ff25fe614c02.png`; no new photograph was attached to this request.
All application edits from this attempt were removed. PoolScene.tsx and infinityLandscape.ts compare byte-for-byte with the copies taken at the beginning of this attempt. Sand, corrected caustics, anti-ghosting, stairs and water systems were not edited.

## Measurement method and historical claim
The earlier 9.27 → 32.89 ms figures measured requestAnimationFrame intervals, not isolated GPU execution. They do not establish that three 1K maps caused a 23.62 ms GPU regression.
Temporary instrumentation used EXT_disjoint_timer_query_webgl2 (disjoint results discarded), renderer CPU submission timing, renderer-wide draw/triangle counts, pass counts and texture-upload counts. Device: ANGLE Metal Apple M1 Pro. Desktop viewport 1038×934, canvas 540×827, DPR 2; 90 warm-up frames followed by 180-frame windows. All figures below are mean ± sample standard deviation, milliseconds. Instrumentation was removed after the trial.

Fixed front view, 10×4.5×1.5 m, Deep Sea, daylight, Infinity side 3:

| Ablation | RAF interval | GPU elapsed | Uploads after warm-up |
|---|---:|---:|---:|
| Original terrain | 33.333 ± 0.530 | 11.342 ± 2.208 | 0 |
| Brown Mud full shader | 33.338 ± 1.130 | 10.330 ± 1.821 | 0 |
| Same without normal map | 33.353 ± 0.876 | 11.309 ± 2.344 | 0 |
| Single sample per map | 33.335 ± 0.673 | 11.095 ± 2.099 | 0 |
| Reflection pass disabled | 33.331 ± 1.092 | 11.385 ± 1.586 | 0 |
| Terrain hidden | 33.333 ± 2.134 | 8.402 ± 2.753 | 0 |

The original scene already exhibited ~33 ms RAF cadence before instrumentation. The map trial added no draw calls or continuous uploads. Removing terrain reduced submitted triangles from ~167k to ~23k; it participates in the main/transmission rendering, while the existing reflection exclusions already omit it. This identifies terrain raster workload as a contributor, not the historical 23.62 ms jump. Normal-map, sample-count and reflection ablations do not show a reproducible improvement beyond the observed variability. No universal texture-cost conclusion is justified.

## One panoramic prototype
Original procedural art, no downloaded panorama or new licensed runtime asset: five low distant relief masses and coherent baked vertex-color macrovariation on the existing terrain; near-pool elevations protected. No new draw calls, map resolutions or lighting changes. Brown Mud (Poly Haven / Rob Tuytel, CC0) was temporarily restored only to reproduce its profiling case and removed from runtime again; original source files remain archived.
The prototype softened the flat horizon but remained an indistinct, smoothed surface rather than a credible architectural landscape. It fails the requested obvious visual benefit. Decision: DISCARD; no landscape code retained.

## Same-camera A/B/A, panorama view
Camera position [-10.9995863579, 4.4303585697, -21.8838059555], quaternion [0.0206368126, 0.9704550718, 0.0898112132, -0.2229910797]. Configuration, light, viewport and DPR unchanged.

| State | RAF interval | GPU elapsed |
|---|---:|---:|
| Original A, stable window 1 | 9.943 ± 0.947 | 7.610 ± 0.755 |
| Original A, stable window 2 | 9.870 ± 0.839 | 7.613 ± 0.673 |
| Prototype B, stabilized window | 86.739 ± 31.272 | 72.198 ± 26.072 |
| Original A restored, no uploads | 59.387 ± 22.295 | 51.378 ± 17.933 |

The restored original did not recover its initial timing. This invalidates attribution of the entire B regression to the prototype; changing system/GPU conditions remain unresolved. No claimed performance gain or sustainable budget. Compilation/upload windows excluded. Reflection pass frequency also varies with elapsed frame time. Precise cause of the historical jump remains unproven; further profiling requires a stable, repeatable A/B/A session before optimization decisions.

## Actual visual evidence and checks
- [Original panorama](/private/tmp/infinity-panorama-before.png)
- [Rejected panorama, same camera](/private/tmp/infinity-panorama-after.png)
- [Restored WIP, mobile emulation 390×844 after orbit/zoom](/private/tmp/infinity-panorama-restored-mobile.png)
- Desktop baseline and prototype inspected. Free orbit used to reach the decking panorama; mobile orbit/zoom checked on the restored WIP, not on an accepted prototype.
- The full two-dimension/two-side prototype matrix was NOT completed: the sample failed its initial visual acceptance and was discarded. Do not interpret restored-WIP checks as prototype approval.
- TypeScript --noEmit PASS; infinity-containment-audit PASS (26 closed shells, receiver containment, deck fascia and portrait framing); build PASS; git diff --check PASS. Build retains existing large-chunk/plugin warnings.
- No video captured. Viewport override removed. Preview remains at http://127.0.0.1:49872/.

## Next necessary work, not implemented
An art-directed low-poly terrain patch with authored large-scale landform/scrub distribution and coherent baked material variation is needed, not more uniform procedural noise. It must be calibrated against the reference from multiple viewpoints and profiled in a stable GPU session. Infinity falling-water readability remains open and untouched.
