# Coastal Infinity environment trial — DISCARD

2026-09-26 · feat/premium-infinity-waterline-v1. No commit/push/deploy.

## Reference and scope
Reference actually visible: user attachment `codex-clipboard-c9ceb594-40fa-4435-a3b1-b4050c8162b9.png`: low Infinity foreground, open sea, unequal rocky coastal masses and distant islands. Furniture was not copied. Loaded VB Orchestrator, realtime PBR, photographic camera matching, visual reference matching, performance profiling, geometry and shader skills. No installation, outside project access or subagent.

## Implemented and evaluated, then removed
One original, procedural 3D coastal scene: two intermediate promontories, two distant islands, separate sea surface and a coastal grade transition on the existing terrain. No downloaded assets or new third-party license requirements. Geometries were static and disposed on unmount; no new shadow-casting lights or reflection render targets. A side-relative initial camera kept the crest in the lower third and allowed normal orbit/zoom. The first six metres beyond the selected edge retained the original terrain height; the basin, liner, stairs, receiving structure and pool-water pipeline were untouched.

This was a scene-composition trial, not a photograph backdrop. Camera and environmental orientation both followed the selected Infinity side. However, the authored heightfields did not produce credible rock morphology: masses remained rounded/soft with patterned bands, islands crowded the open horizon, water was too uniform, and near-coast contacts appeared angular during movement. The architectural premium target was NOT met. The prototype was discarded, including its camera. No false approved “after”.

## Real preview evidence
- [Original initial camera](/private/tmp/coast-original-camera.png)
- [Original environment at the comparison camera, captured on return to A](/private/tmp/coast-baseline-return.png)
- [Rejected coastal candidate at the same camera](/private/tmp/coast-after-matched.png)
- [Orbit / closer view](/private/tmp/coast-orbit-detail.png)
- [10×4.5 m, side 3](/private/tmp/coast-side3.png)
- [8×3 m, side 3](/private/tmp/coast-8x3-side3.png)
- [8×3 m, side 2, mobile emulation 390×844](/private/tmp/coast-mobile-390.png)
- [Mobile orbit / zoom](/private/tmp/coast-mobile-orbit.png)

Comparison camera for side 2: position [-13.7661943997, 2.7304894032, 0], quaternion [-0.0135445464, -0.7069770472, -0.0135445464, 0.7069770472]. Same 10×4.5×1.5 m pool, selected liner, exposure, light, canvas 540×827 and DPR 2. UI scroll position can differ; camera and pool do not. The early before screenshot had incomplete visible scenery during update and is not used as evidence of an improvement. The restored-A capture provides the valid visual comparison.

## Verification actually performed
Desktop: 10×4.5 and 8×3 m; sides 2 and 3; orbit and zoom; deck/terrain contact inspected. Dimensions 8 and 3 verified from live input values. Mobile: emulated 390×844, expanded pool view, side 2 and orbit/zoom; not a physical phone. Coastal perspective moved in 3D but material/contact quality failed acceptance. No claim of photorealism or regression-free retained implementation.

## Performance — distinguish GPU from RAF
Temporary WebGL2 EXT_disjoint_timer_query instrumentation measured elapsed GPU work; disjoint results discarded. RAF measured separately. Warm-up 120 frames; subsequent windows of 180 frames. Mean ± sample SD in milliseconds. DPR and pose logged with each window. The profiler was removed afterward.

| State at matching pose | RAF interval | GPU elapsed |
|---|---:|---:|
| Original A, window 1 | 36.79 ± 15.14 | 26.64 ± 4.69 |
| Original A, window 2 | 37.20 ± 9.89 | 28.66 ± 7.53 |
| Candidate B, stationary window 1 | 70.65 ± 28.06 | 61.08 ± 25.28 |
| Candidate B, stationary window 2 | 77.67 ± 35.75 | 66.70 ± 20.65 |
| Original A restored, later window | 70.51 ± 4.56 | 62.01 ± 2.86 |

The returned original did not recover the initial timing. User interaction was detected and stopped before the final visual inspections; changing resource conditions also affect this sequence. The last restored-A interval overlapped local technical checks and therefore cannot establish a controlled GPU regression. The candidate cannot be certified within a sustainable budget, and no causal attribution or performance improvement is claimed. Historical 11.34±2.21 / 10.33±1.82 GPU values and 32.89 RAF were not reused as today's baseline.

## Preservation and technical checks
PoolScene.tsx restored byte-for-byte to the snapshot taken at this turn's start; camera.ts unchanged (byte comparison). Temporary CoastalEnvironment.tsx and CoastProbe.tsx removed from runtime; copies retained only in `/private/tmp/pool-coast-discarded/`. No production asset added. Only this QA document remains from the attempt. Existing WIP, Sand, corrected caustics, anti-ghosting, Infinity containment and hidden overflow preserved.

TypeScript PASS on the candidate and restored WIP; restored-state build PASS (existing plugin/chunk-size warnings). Infinity containment audit PASS: 26 closed shells, receiver freeboard/floor/base/water, decking fascia and portrait framing. Diff-check PASS. Preview HTTP 200 and original 3D scene visually confirmed after reload and asset warm-up. Original camera restored, 10×4.5 m / side 2. Viewport emulation reset. Runtime emitted texture-unit limit warnings during reload; no new shader error was reported after reload. This remains an observation, not a demonstrated explanation of the performance variability.

## Remaining requirement
A deliberately sculpted coastal rock set with controlled silhouette, fractures and coherent baked PBR detail is needed; the smooth procedural heightfield used here is insufficient. Pool Infinity film readability remains open and was not modified. No further variant implemented.
