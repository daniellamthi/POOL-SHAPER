# Liner material realism — focused WIP checkpoint

Date: 2026-09-26. Branch: `feat/premium-infinity-waterline-v1`, HEAD unchanged: `a9846c3`.
Preview: http://127.0.0.1:49872/ . No commit, push, merge or deployment.

## Scope and observed result

Used the loaded **vb-orchestrator**, **pbr-texture-authoring**, **realtime-pbr-photorealism** and **realtime-performance-profiler** skills. They directed a single Sand sample calibration, correlated PBR map scale, and an A/B check without global lighting changes. No subagents or new packages.

The six existing finishes were inspected and selected in the dedicated liner view. Sand and Deep Sea initially had the least legible grain; Grey/Black already had stronger local detail. The concrete shared defect was that photo-derived normal/roughness/AO maps repeated at 0.08 m while their corresponding colour image repeated at 0.7 m. These maps now use the same metric module. The mosaic mapping is unchanged.

Sand Beach is the only individually retuned finish: fine grain recovered from the existing sample, broad photographic shading reduced, provisional image module 2.8 m, roughness 0.5 and metalness 0. The 1024-pixel calibrated colour texture replaces the 2048-pixel source for this material's 3D rendering; no extra texture sampler or new asset. Normal strength is locally calibrated to the low-amplitude derived map, without displacement. Colour-map vertical repeat now matches the partial tile used by normal/roughness on shallow walls. PVC stairs receive the same roughness/AO maps as the floor. No stair geometry changes.

**KEEP:** close-up Sand has a visible fine, matte grain rather than a nearly flat colour field. The difference is subtle in the general view and less readable at normal mobile size; this is not a claim of photographic quality. Colour and depth response still belong to the existing water pipeline. No obvious duplicate edges/ladder or grain scintillation appeared in the observed orbit/zoom checks; this is visual sampling, not exhaustive temporal artifact testing.

The existing `motion-sand-beach-179.png` was inspected. No measured manufacturer PBR scan or physical sample dimensions were available: **the material scale/relief is indicative, not a certified reproduction of a commercial product**. Dry selector images and commercial labels are unchanged. No manufacturer properties were invented.

## Real preview captures

Same 10 × 4.5 × 1.5 m rectangle, Infinity side 2, Sand, Travertino, inox ladder, daytime, existing green LED setting, guides off, same dedicated camera and render settings. Animated caustic instants differ; lighting/exposure/water settings do not. The temporary A/B gates restored pre-session Sand material/mapping, then were removed. Earlier measurements made during shared user navigation were discarded.

| View | Before | After |
| --- | --- | --- |
| Dedicated wall/floor | [Before](/private/tmp/liner-sand-before-final.png) | [After](/private/tmp/liner-sand-after-final.png) |
| General | [Before](/private/tmp/liner-general-before-final.png) | [After](/private/tmp/liner-general-after-final.png) |
| Emulated mobile 390×844 | [Before](/private/tmp/liner-mobile-before.png) | [After](/private/tmp/liner-mobile-after.png) |

Additional real screenshots: [desktop orbit/zoom](/private/tmp/liner-sand-orbit.png), [mobile orbit/zoom](/private/tmp/liner-mobile-orbit.png), [second dimension 8×3×1.5 m](/private/tmp/liner-sand-8x3.png), [straight stairs](/private/tmp/liner-stairs-straight.png), [corner stairs](/private/tmp/liner-stairs-corner.png).

Other selected finishes, fixed dedicated camera: [Deep Sea](/private/tmp/liner-deep-after.png), [Blue Sky](/private/tmp/liner-blue-after.png), [Arctic White](/private/tmp/liner-white-after.png), [Grey Rock](/private/tmp/liner-grey-after.png), [Black Stone](/private/tmp/liner-dark-after.png). Their individual colour, roughness and relief strength were not retuned; only the valid shared map alignment applies.

Mobile is viewport emulation, **not a physical phone**. Desktop viewport and original 10×4.5 m/inox selection restored after QA. No video captured. No Infinity or hydraulic matrix repeated.

## Comparable performance

Existing `[Pool3D performance]` RAF timing on the same machine/tab, static dedicated camera, canvas 540×827, DPR 2, `experience` quality, shadow map 4096, active water animation. Build/tests were not running during these samples. Seven successive approximately two-second aggregates per block. Excluded interaction/DPR-1 settling samples and all samples from the earlier shared navigation.

- Before: `13.40, 13.55, 13.73, 14.03, 13.38, 14.61, 14.60` ms; mean **13.90**, SD **0.49**, range **13.38–14.61**.
- After block 1: `13.44, 13.76, 14.40, 14.69, 14.28, 13.90, 13.73`; mean **14.03**, SD **0.41**.
- After block 2: `13.62, 13.38, 13.64, 13.41, 13.32, 13.61, 13.22`; mean **13.46**, SD **0.15**.
- Pooled after mean **13.74** ms, range **13.22–14.69**. Difference is within run variability: **no demonstrated speedup or meaningful steady-frame regression**.

This is RAF frame time, not isolated GPU execution time; no total draw-call claim from the last-pass renderer counter. Mobile interaction checked visually, not separately benchmarked. Sand calibration is CPU work when the material/source changes, not per-frame; that selection cost was not separately timed. No resolution/shadow/postprocess increase.

## Checks and explicit open failure

- `tsc --noEmit`: PASS.
- `scripts/liner-material-audit.ts` via local Rolldown bundle: PASS, six material contracts and four source mapping/lifecycle checks.
- `node scripts/water-transmission-audit.mjs`: PASS, 13 existing water/shadow source contracts. Runtime/visual checks performed separately as above.
- Vite client/SSR/Nitro build using local runner: PASS. Existing large-chunk, tsconfig-path plugin and code-splitting warnings remain. Build only, no deploy.
- `git diff --check`: PASS.
- General geometry audit **not rerun and not declared PASS**. Exact pre-existing caustic checks remain FAIL: mean **0.1345346488 > 0.08** and visibility preset **0.75 > 0.1**. Gradient **22 < 30** passes. [Exact assertion, cause and impact](./caustics-open-failure.md). No threshold or caustic code modified.
- Infinity film readability remains open; no film/rollover/flow-normal experiment. Approved scene, anti-copy water and existing WIP retained.

## Files changed in this pass only

- `src/lib/pool/materials.ts`: sample-specific calibration and material metadata.
- `src/components/pool/three/textures.ts`: bounded calibration of the existing Sand colour image.
- `src/components/pool/three/PoolModel.tsx`: aligned PBR mapping, partial wall tiles, owned texture disposal, stair material map consistency.
- `scripts/liner-material-audit.ts`: focused regression contracts.
- `docs/qa/caustics-open-failure.md` and this report.

All other dirty files were pre-existing WIP and were not reverted, staged or committed.
