# Infinity basin capture — controlled trial

Date: 2026-09-26  
Branch: `feat/premium-infinity-waterline-v1`  
Decision: **DISCARD**

## Scope and diagnosed risk

The current Three.js physical-transmission path samples the renderer's global opaque transmission buffer. Dry coping and the stainless handrail are therefore present in the source image; a displaced lookup can show them a second time below the water surface. The existing anti-copy patch avoids that failure by forcing zero transmission displacement, but also removes useful contour bending.

The trial proved that isolation is technically possible without rendering emerged geometry: a half-resolution floating-point color target plus depth texture rendered only `pool-basin` descendants, hid every water surface, and clipped fragments above the waterline. Refraction was restricted to depth discontinuities, with silhouette rejection and a shoreline guard. The final corrected prototype showed no duplicated ladder, coping, or emerged geometry in fixed detail and orbit views.

## Controlled comparison

Configuration: Infinity, 10 × 4.5 × 1.5 m, side 4, Motion Sand Beach [179], DPR 2, exposure 0.95, frozen water instant 24, identical fixed cameras for each paired view. The final general pair is captured after the same `Reframe`; the detail and inox pairs use their dedicated cameras; the orbit pair uses the same drag vector.

- General original: [/private/tmp/basin-capture-general-original-final.png](/private/tmp/basin-capture-general-original-final.png)
- General candidate: [/private/tmp/basin-capture-general-candidate-final.png](/private/tmp/basin-capture-general-candidate-final.png)
- Wall/floor original: [/private/tmp/decision-sand-detail-original.png](/private/tmp/decision-sand-detail-original.png)
- Wall/floor candidate: [/private/tmp/basin-capture-sand-detail-candidate2.png](/private/tmp/basin-capture-sand-detail-candidate2.png)
- Inox original: [/private/tmp/decision-sand-inox-original.png](/private/tmp/decision-sand-inox-original.png)
- Inox candidate: [/private/tmp/basin-capture-inox-candidate2.png](/private/tmp/basin-capture-inox-candidate2.png)
- Orbit original: [/private/tmp/basin-capture-orbit-original.png](/private/tmp/basin-capture-orbit-original.png)
- Orbit candidate: [/private/tmp/basin-capture-orbit-candidate2.png](/private/tmp/basin-capture-orbit-candidate2.png)

The general image is nearly unchanged. In the closer wall/floor and orbit views, contour displacement is too weak to create believable depth while the opaque single-pass composition makes the surface read flatter and, around the ladder, closer to an empty basin. That fails the visual gate despite eliminating ghost copies.

## Performance

WebGL2 `EXT_disjoint_timer_query_webgl2`; 120-frame warm-up and 120 measured frames per window; three windows; same camera stamp and 1256 × 1654 drawing buffer. Candidate GPU window medians: 6.42 / 15.40 / 13.60 ms (median-of-windows 13.60; range 6.42–15.40). Candidate RAF medians: 13.8 / 20.9 / 16.0 ms (median 16.0; range 13.8–20.9). Original-return GPU medians: 7.22 / 19.47 / 18.65 ms (median 18.65; range 7.22–19.47). Original-return RAF medians: 20.8 / 25.6 / 24.6 ms (median 24.6; range 20.8–25.6). The large stage drift prevents assigning a reliable exact improvement. Candidate capture cost itself was intermittent; per-frame mean was 0.18–0.92 ms. Raw samples: [/private/tmp/basin-capture-profile-candidate.json](/private/tmp/basin-capture-profile-candidate.json), [/private/tmp/basin-capture-profile-original-return.json](/private/tmp/basin-capture-profile-original-return.json).

## Result and restoration

**DISCARD.** A useful next prototype would require a dedicated receiver buffer containing raw liner albedo/normal and linear eye-space depth, followed by one depth-path absorption/refraction evaluation. Capturing the already shaded underwater receivers and compositing them at the surface cannot add enough physical information without flattening the water. That is beyond this controlled trial.

The prototype and temporary profiler were removed. `WaterSurfaceMaterial.tsx`, `PoolModel.tsx`, and `water-transmission-audit.mjs` compare byte-for-byte with the session-entry backup; the temporary probe file is absent. TypeScript PASS; 13 water/anti-copy contracts PASS; caustics six-liner distribution/motion/receiver audit PASS; production build PASS; `git diff --check` PASS. No commit, push, or deploy.
