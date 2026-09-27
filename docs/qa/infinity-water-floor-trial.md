# Infinity water/floor — controlled trial

Scope: `feat/premium-infinity-waterline-v1`, current WIP after `infinity-pbr-integration.md`. No changes to approved coastal daylight, panorama, inox, limestone, camera, geometry or caustics. VB Orchestrator used the realtime-water-rendering and realtime-performance-profiler skills; one read-only reviewer evaluated the real screenshots.

## Cost isolation

Temporary WebGL2 `EXT_disjoint_timer_query_webgl2` instrumentation wrapped top-level renderer calls separately: main view (including its internal transmission capture) and planar reflection. GPU queries were non-nested, asynchronous, with disjoint results excluded. RAF delta was recorded separately. Camera changes or drawing-buffer/DPR changes reset the warm-up. Each stage used 120 warm-up frames, 120 measured frames, then drained pending queries. No build/test process ran during measurement.

Rectangle 10 × 4.5 × 1.5 m, Infinity side 4, White liner, existing Comfort detail camera `[-3.8, 4.4458176, -4.3358578]`, canvas 540 × 827 CSS pixels, drawing buffer 1080 × 1654, DPR 2, desktop viewport 1038 × 934, daylight/exposure unchanged. Assets loaded. Animated water remains active. Values are window mean ± per-frame standard deviation, not confidence intervals.

| Stage | GPU total ms | Main GPU ms | Reflection GPU ms/frame | RAF ms |
|---|---:|---:|---:|---:|
| Baseline 1 | 90.94 ± 28.09 | 79.11 ± 21.57 | 11.83 ± 10.19 | 87.98 ± 23.73 |
| Reflection skipped | 62.34 ± 25.74 | 62.34 ± 25.74 | 0 | 69.15 ± 28.61 |
| Baseline 2 | 86.17 ± 25.79 | 76.05 ± 20.40 | 10.12 ± 8.80 | 85.71 ± 22.38 |
| Water transmission disabled | 43.39 ± 14.08 | 37.79 ± 8.06 | 5.59 ± 8.39 | 44.71 ± 9.64 |
| Baseline 3 | 87.97 ± 14.62 | 78.84 ± 11.93 | 9.13 ± 5.84 | 85.72 ± 12.60 |
| Caustic sampling bypassed | 87.45 ± 18.86 | 76.89 ± 14.65 | 10.56 ± 8.38 | 84.06 ± 16.27 |
| Baseline 4 | 89.56 ± 25.78 | 76.48 ± 19.44 | 13.08 ± 9.20 | 84.41 ± 21.01 |

Transmission is the strongest isolated cost: diagnostic draw submissions fall from about 70–71 to 36/frame. This includes removal of the opaque transmission capture and the water transmission shader, not just refraction arithmetic. It is not a viable visual fix: the diagnostic water becomes opaque. Planar reflection also has measurable cost. Bypassing the six caustic texture samples does not establish a significant gain amid this variance. No global quality/DPR reduction was used. Earlier 62–78 ms measurements used a different enclosing timer; do not subtract them from these per-render-call sums or claim a regression has been certified absent.

Raw isolation data: `/private/tmp/water-floor-profile-isolation.json`.

## Single visual trial

The existing underwater receiver varies its absorption coefficient, path multiplier and additive colored scattering with the chosen liner. Sand therefore gets stronger red absorption than Grey independently of their albedo. A single Infinity-only trial reused the existing common water absorption preset with unit path multiplier and no additive colored scattering; all liner textures/normals, caustic transfer, water normals, Fresnel/reflection and undisplaced anti-copy transmission were preserved. This is a rendering hypothesis, not a claim that the existing coefficients are measured physical water properties.

Decision: **DISCARD**. Sand shifts toward yellow/olive, but the floor still reads as a flat dry surface and Grey gains no obvious fluid depth. The read-only visual reviewer independently recommended DISCARD. The transient Sand general capture after hot reload was replaced by a fresh-load, settled capture: reflection is present, but the general-view benefit remains insufficient. No accepted “after” is claimed.

Three warm candidate windows in the identical White detail setup above (fresh load):

| Window | GPU total ms | RAF ms |
|---|---:|---:|
| Candidate 1 | 73.66 ± 29.53 | 72.17 ± 27.62 |
| Candidate 2 | 76.54 ± 25.82 | 76.16 ± 24.99 |
| Candidate 3 | 72.97 ± 32.22 | 78.35 ± 37.91 |

Dispersion overlaps the baseline substantially. These samples do not justify a speedup claim or certify absence of a small regression. There are no added draw calls/maps/passes in the candidate; performance did not rescue its failed visual acceptance. Raw candidate data: `/private/tmp/water-floor-profile-candidate.json`.

## Actual visual checks and images

Same existing Acqua general camera and Stile detail camera, unchanged daylight/exposure, 10 × 4.5 × 1.5 m, side 4, Sand and Grey. Animation was not phase-locked: use these pairs for material/depth reading, not for per-pixel caustic comparison.

| View | Before | Discarded trial |
|---|---|---|
| Sand general | [Before](/private/tmp/water-floor-sand-general-before.png) | [Trial](/private/tmp/water-floor-sand-general-trial.png) |
| Sand detail | [Before](/private/tmp/water-floor-sand-detail-before.png) | [Trial](/private/tmp/water-floor-sand-detail-trial.png) |
| Grey general | [Before](/private/tmp/water-floor-grey-general-before.png) | [Trial](/private/tmp/water-floor-grey-general-trial.png) |
| Grey detail | [Before](/private/tmp/water-floor-grey-detail-before.png) | [Trial](/private/tmp/water-floor-grey-detail-trial.png) |

Additional actual interactions/captures: [orbit](/private/tmp/water-floor-orbit-trial.png), [zoom](/private/tmp/water-floor-zoom-trial.png), [8 × 3 m](/private/tmp/water-floor-8x3-trial.png), [8 × 3 m side 2](/private/tmp/water-floor-8x3-side2-trial.png), [mobile 390 × 844](/private/tmp/water-floor-mobile-trial.png), [mobile orbit](/private/tmp/water-floor-mobile-orbit-trial.png). Mobile is desktop-browser viewport emulation, not a phone or mobile GPU benchmark. No obvious new ghost-copy artifact in the inspected views; this is not an exhaustive proof for every orbit.

## Delivery and checks

Only this report is retained from the session. `PoolModel.tsx` and `WaterSurfaceMaterial.tsx` were restored byte-for-byte to the session-start WIP copies; temporary `WaterCostProbe.ts` and all diagnostic imports/uniforms were removed. No previous WIP reverted. Configuration returned to 10 × 4.5 m, side 4. No commit, push or deploy.

TypeScript `tsc --noEmit` PASS; 13 water/shadow contracts PASS; six-liner/material mapping checks PASS; caustic texture/distribution/motion/receiver audit PASS; exterior light-mask audit PASS; Vite client/SSR/Nitro build PASS (existing chunk/tooling warnings); diff-check PASS. No test thresholds changed. These passes do not establish photographic quality.

Remaining limitation: the anti-copy fallback deliberately keeps transmitted pixels undisplaced, so underwater contours retain the projected geometry of the opaque view; a flat floor also has nearly uniform optical depth. Shared absorption alone cannot produce the missing refraction. A next bounded technical experiment would need a depth-/submersion-aware transmission capture that rejects dry foreground geometry and reuses/replaces the current expensive capture, rather than adding another full-resolution pass. It is not implemented or claimed solved here. Infinity falling-film limitations remain unchanged.
