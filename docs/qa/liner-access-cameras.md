# Liner and access detail cameras

Branch: feat/premium-infinity-waterline-v1. Existing WIP preserved; no commit, push, deploy or merge.

## Scoped changes

- `src/components/pool/PoolConfigurator.tsx`: access camera intent, manual orbit for style/access, retain water in the material view so the waterline remains visible. Dry selector samples unchanged.
- `src/lib/pool/camera.ts`: oblique liner wall/floor framing on a real non-Infinity boundary; access framing from the canonical plan footprint and elevations; portrait fit.
- `src/lib/pool/lighting-plan.ts`: expose the already computed access plan to the camera, without changing placement or lighting.
- `src/components/pool/three/PoolScene.tsx`: reuse CameraRig; user interaction cancels flight, changed pose replaces rather than queues transitions; identical poses do not reframe on material changes; reserve space for the visible summary panel.
- `scripts/detail-camera-audit.ts`: 48 projected access fits across rectangle/L/custom, two sizes and three aspect ratios; stable liner/mosaic pose.

## Actual preview checks

- Rectangle 12 x 3 and 6 x 3, depth 1.5; Angolare with 6 x 3 input dimensions (canonical planner owns clamping), Infinity retained. All three access choices inspected on desktop.
- Six liner selections visibly change material without moving the camera. Grain remains subtle, particularly Sand/Deep Sea; no texture/shader redesign was performed.
- Manual orbit verified; navigation into/out of detail verified. Rapid-click queue prevention and interruption are implemented in the existing controller; no timed automated interaction benchmark claimed.
- Mobile 390 x 844: expanded liner and inox detail inspected; viewport override reset. Desktop checked at 1126 and 1479 px width; summary obstruction corrected.
- No Infinity regression matrix repeated. A patterned artifact on the Infinity inner face was visible from an earlier material view on Angolare; its geometry/material was deliberately not changed in this camera-only pass. The liner view now targets a lined boundary instead of the Infinity lip.

## Real screenshots

![Liner](/private/tmp/pool-camera-liner.png)
![Curved stairs](/private/tmp/pool-camera-corner.png)
![Straight stairs](/private/tmp/pool-camera-linear.png)
![Steel ladder](/private/tmp/pool-camera-inox.png)
![Mobile liner](/private/tmp/pool-camera-liner-mobile.png)
![Mobile ladder](/private/tmp/pool-camera-mobile.png)

Targeted camera audit, TypeScript, build and diff-check passed. Existing bundle-size/tsconfig-path warnings remain. No performance improvement is claimed.
