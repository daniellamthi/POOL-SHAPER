# Infinity containment — 2026-09-25

Branch: feat/premium-infinity-waterline-v1. Existing WIP preserved; no commit/push.

## Implemented in this pass

- One closed swept structural shell: crest, wet outer wall, receiver floor/underside, outer rim/wall and solid end returns.
- Shared construction/water elevations, 60 mm receiver freeboard, water inset 12 mm from ends, 3 mm film stand-off.
- Neutral gray structural material independent of liner color, wet roughness/tonality mask; existing physical water pipeline retained with an optional falling-film normal treatment.
- Real supporting-edge candidates for Custom outlines; capability checks use canonical candidates.
- Infinity-only lower camera and less intrusive fog/horizon color; existing limestone deck retained.

Files edited in this pass (other dirty files pre-existed):

- src/components/pool/three/InfinityEdge.tsx
- src/components/pool/three/infinityContainment.ts (new)
- src/components/pool/three/WaterSurfaceMaterial.tsx
- src/components/pool/three/PoolScene.tsx
- src/lib/pool/infinity-edge.ts
- src/lib/pool/camera.ts
- src/lib/pool/store.tsx
- src/lib/pool/project.ts
- src/configurator/steps/pool-system/PoolSystemStep.tsx
- scripts/infinity-containment-audit.ts (new)
- this report

## Checks actually performed

- TypeScript noEmit: PASS.
- Geometry audit: PASS (including existing landscape/stair regressions).
- New containment audit: PASS, 26 non-vacuous rectangle/L/organic/custom eligible-zone cases at two sizes; every positional structural edge paired, finite geometry, ordered elevations and inset horizontal receiver water.
- Project configuration round trip: PASS.
- Vite client/SSR/Nitro build: PASS, existing large-chunk warning. No deployment performed.
- git diff --check: PASS before report addition.
- Live interaction: rectangle 10×4.5×1.2 (sides 3/1 and earlier side 4); 6×3×1.2; Angolare selected real edge; default Custom selected curved supporting zone; Skimmer and visible Overflow close-ups.

## Real screenshots

- Before: /private/tmp/infinity-containment-before.png (side 4 close view).
- General after: /private/tmp/infinity-containment-general.png (side 3; not an exactly matched before/after camera).
- Raised view/channel: /private/tmp/infinity-containment-channel.png.
- Opposite edge: /private/tmp/infinity-containment-opposite.png.
- Second size: /private/tmp/infinity-containment-6x3.png.
- Angolare: /private/tmp/infinity-containment-angolare.png.
- Custom: /private/tmp/infinity-containment-custom.png.
- Regressions: /private/tmp/infinity-regression-skimmer.png and /private/tmp/infinity-regression-overflow.png.

## Performance and remaining limitations — NOT a photographic approval

Existing dev metrics sampled on the same browser/device: Infinity side 1 at 10×4.5, 46.6 FPS / 21.46 ms; Skimmer 6×3, 32.7 FPS / 30.59 ms. Configurations/cameras differ: these are observations, not an improvement comparison. Draw-call readings vary by render pass and are not treated as total-frame measurements.

Water/film still reads too weakly and uniformly relative to the reference photo. Console warnings report texture-unit pressure (16-unit device limit); no claim that this is definitively the sole cause. Photographic matching is NOT passed. Terrain remains visually simple. Custom closure is tested topologically, not a complete arbitrary-outline self-intersection proof. Mobile viewport command did not change the observed QA screenshot dimensions; mobile QA is NOT claimed. Exact matched before/after and underside camera coverage remain incomplete.

Preview remains http://127.0.0.1:49872/; dedicated QA tab retained. Original user tab was not used for later QA interactions.
