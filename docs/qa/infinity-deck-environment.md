# Infinity / decking / environment visual pass

Branch: `feat/premium-infinity-waterline-v1`. Existing WIP preserved; no commit or push.

## Files touched in this pass

- `src/components/pool/three/InfinityEdge.tsx`: wet support and coherent receiver stone.
- `src/components/pool/three/infinityEdgeGeometry.ts`: low receiver returns, support closures, continuous metric cascade UVs.
- `src/components/pool/three/infinityLandscape.ts`: level deck with retaining faces, selected-side grading and distant terrain falloff.
- `src/components/pool/three/PoolScene.tsx`: separate limestone paving, terrain shading/extension, Infinity-only fog and removal of flat contact-shadow overlay.
- `src/components/pool/three/SkyDome.tsx`: restrained blue daytime sky palette; HDR lighting source unchanged.
- `src/lib/pool/infinity-edge.ts`: indicative receiver width 0.35 m, wall thickness 0.15 m; no dimensions inferred from photograph.
- `scripts/geometry-audit.ts`: regressions for low receiver returns, planar paving and full-run cascade UVs.

## Actual validation

- Baseline captured inline before editing: 10 × 4.5 × 1.2 m, Infinity side 3, guides off.
- Live preview: all four rectangle Infinity sides at 10 × 4.5 m; second size 6 × 3 m; manual orbit and close views.
- 390 × 844 mobile expanded view inspected. Viewport override then reset.
- Skimmer and visible Overflow rendered and inspected after the shared sky change.
- TypeScript, geometry audit (including 108 shape/dimension/system cases), production build and `git diff --check` pass.
- Browser error log empty at final inspection. No performance improvement claim: no before/after frame-time measurement was made.

## Screenshot artifacts

- Final overview: `/private/tmp/pool-infinity-overview-after.png`.
- Intermediate close views: `/private/tmp/pool-infinity-lip-detail.png`, `/private/tmp/pool-infinity-opposite-end.png`.
- Intermediate mobile view: `/private/tmp/pool-infinity-mobile-after.png`.
- Baseline was displayed inline, not persisted as a file. Do not claim a complete downloadable before/after set.

## Remaining limits

This is a geometric/material improvement, not a passed photographic-reference match. Water-sheet visibility and distant landscape realism still need visual refinement. Mobile expanded framing is a close-up rather than a full-pool fit. The new decking received rectangle visual QA; L/custom/organic geometry tests are not a substitute for visual QA of the new deck on those shapes. Photo Mode/Cycles were not retested in this pass. Existing build chunk-size warnings remain.
