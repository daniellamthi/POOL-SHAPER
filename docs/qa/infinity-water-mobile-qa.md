# Infinity water readability / mobile QA — 2026-09-25

Branch: `feat/premium-infinity-waterline-v1`. Intentional existing WIP preserved. No commit, push, merge or deployment. Preview: http://127.0.0.1:49872/.

Loaded skills: vb-orchestrator, realtime-water-rendering, realtime-performance-profiler, visual-reference-matching, hdri-reflection-environment. They guided narrow scope, shared resources, physically transparent film and evidence-based acceptance. No agents or installations used.

## Scope of this pass

- `WaterSurfaceMaterial.tsx`: shared renderer-scoped 256px ripple textures with reference-counted disposal; anisotropy capped at 4; analytic thin-film normals, no scrolling image, particles or fixed blue tint. Final lateral review exposed regular vertical highlights: reduced slope amplitude and increased spatial irregularity. Photographic approval is still pending.
- `InfinityEdge.tsx`: wet gray surface roughness/diffuse response only. No structural geometry/elevation changes.
- `PoolScene.tsx`: texture-free Infinity meadow shading, gentle distant terrain relief, stable terrain material key; development-only sampler/viewport diagnostics.
- `DaylightEnvironment.tsx`, `SkyDome.tsx`: optional restrained procedural outdoor sky variation for Infinity, without an added texture.
- `PoolModel.tsx`: avoid marking unloaded coping textures for GPU upload; appearance unchanged.
- `camera.ts`: portrait Infinity framing minimum aspect corrected from 0.6 to 0.2 after actual 390×844 clipping was observed; target and orientation unchanged.
- `scripts/infinity-containment-audit.ts`: portrait camera regression assertion added to the existing containment audit.

## Actual preview coverage

Desktop: rectangle 10×4.5×1.5 and 6×3×1.2, Infinity sides 1/3 across the sessions; Angolare 6×4×1.2 side 1; Custom 6×4 side 135; Skimmer, hidden overflow and visible overflow at 6×3. Gray receiver and end containment visible; no geometry rebuild. Angolare still exposes jagged deck/underside joins belonging to the preserved WIP; not approved as defect-free.

Mobile: Chrome viewport 390×844 on desktop hardware, rectangle 10×4.5, Infinity expanded, two sides, light/dark themes. Portrait end clipping corrected. No missing/black textures observed in those samples. Dark theme is not a verified evening-lighting preset. This is not a physical-phone benchmark or a complete shape×system×mobile matrix.

Chrome automation detached during the Custom orbit and could not reconnect; this does not establish an application crash. Final side orbit succeeded in the integrated preview. Integrated-browser viewport override reset succeeded; Chrome reset could not be confirmed after detachment. Some interaction delays occurred; full fluidity QA is NOT passed.

## Measurements

Samples from existing development frame-interval instrumentation, not GPU timer queries:

| Scene | Canvas / DPR | FPS | Mean frame interval |
|---|---|---:|---:|
| Desktop Infinity 6×3 | 628×827 / 2 | 75.8 | 13.19 ms |
| Desktop Skimmer 6×3 | 628×827 / 2 | 65.9 | 15.17 ms |
| Desktop Infinity 10×4.5 | 628×827 / 2 | 74.1 | 13.49 ms |
| Mobile Infinity expanded | 390×844 / 2 | 83.3 | 12.00 ms |
| Mobile Skimmer embedded | 364×386 / 2 | 128.2 | 7.80 ms |

Different framing/canvas sizes are not matched performance comparisons. No performance improvement or absence of regression claimed. Renderer draw-call counter was not used as a full-frame metric because reflection passes reset it.

Observed maximum active shader samplers: 11 against fragment limit 16 in the tested two-light setup. After upload guard, final Custom logs showed the existing Three.Clock deprecation but no new missing-image/texture-unit warnings. This does not prove every possible light/material combination is below the limit.

## Actual screenshots

- [Baseline 8×3](/private/tmp/infinity-water-final-before.png)
- [Mobile before portrait correction](/private/tmp/infinity-water-mobile.png)
- [Mobile after portrait correction](/private/tmp/infinity-water-mobile-after.png)
- [Opposite edge, dark theme](/private/tmp/infinity-water-mobile-night.png)
- [Water detail 10×4.5](/private/tmp/infinity-water-detail-after.png)
- [General 6×3](/private/tmp/infinity-water-6x3.png)
- [Visible overflow](/private/tmp/infinity-water-overflow-regression.png)
- [Angolare](/private/tmp/infinity-water-angolare.png)
- [Custom](/private/tmp/infinity-water-custom.png)
- [Final lateral view](/private/tmp/infinity-water-side-final.png)

Screenshot files reside in `/private/tmp/`; they are real preview captures, not generated images. The original desktop baseline and final desktop view were not captured at identical framing; only the mobile camera-fix pair supports a before/after framing comparison. Water detail captures predate the final slope-amplitude reduction; the final lateral view follows it.

## Acceptance status

Final rerun after the film-slope correction: typecheck PASS; geometry audit PASS; project configuration round-trip PASS; 26-case Infinity containment audit with portrait regression PASS; production build PASS; diff-check PASS. Existing build chunk-size warning remains.

Not fully accepted: water film still reads too regularly in the lateral view, landscape remains simplistic, evening preset and complete mobile matrix not verified, matched desktop before/after incomplete, interaction delays not isolated. Do not equate passing compilation/geometry checks with photographic or performance acceptance.
