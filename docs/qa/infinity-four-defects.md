# Four-defect pass — 2026-09-25

Branch `feat/premium-infinity-waterline-v1`; previous WIP preserved. No commit, push or deployment. Existing preview reused: http://127.0.0.1:49872/.

## Changes

- `PoolScene.tsx`: terrain elevation is now evaluated at final stretched coordinates, not original coordinates. Removed undersampled distant sinusoidal relief that created horizon teeth and long folds. Near-pool grade function remains unchanged. Exterior deck and landscape exclude direct illumination from submerged spotlights.
- `InfinityEdge.tsx`: apply the same light-linking rule to the independent exterior containment material. Containment geometry and elevations unchanged.
- `exteriorLightMask.ts` (new): receiver-side exclusion based on the actual light's reconstructed world height. Keeps above-ground fixtures, sun and environment response. No extra shadow map, texture or draw pass. This is a raster approximation of the opaque shell's occlusion, not volumetric light transport.
- `WaterSurfaceMaterial.tsx`: falling-film normal scales/strength and roughness calibrated through multiple actual close-up captures. No tint, opacity trick, particles or additional texture resources. Main pool-water response unchanged in this pass.
- `scripts/exterior-light-mask-audit.ts` (new): shader insertion and unrolled-loop safety plus 12 camera/light-position classifications.

The water/PBR/GLSL skills guided resource reuse and scoped physical-material changes. No dependencies or agents added.

## Verification

Actual integrated-browser interaction: existing 12×3×1.5 m Infinity, close-up orbit, sides 1 and 3, desktop and 390×844 expanded mobile. Exterior blue spill is no longer visible in the inspected final views while underwater fixtures remain on. Distant jagged horizon removed; the local graded transition remains visible. No missing exterior materials in final captures. Mobile override reset afterward.

An initial shader compile error from variable redeclaration in Three.js's unrolled spotlight loop was caught in the browser and fixed by using an inline expression. Shader cache keys updated and preview reloaded; no post-fix errors returned in the subsequent filtered error-log check. Reload reset the wizard's presentation step; the original concrete structure was reselected, with 12×3 dimensions retained.

Final typecheck PASS; exterior light mask audit PASS; 26-case containment/deck/portrait audit PASS; production build PASS; git diff --check PASS. Existing build warnings remain. No performance benchmark run, and no performance gain claimed.

## Captures and limits

- [Baseline](/private/tmp/infinity-four-fixes-before.png)
- [Close-up during film calibration](/private/tmp/infinity-four-fixes-detail-final.png)
- [Final opposite-side desktop view](/private/tmp/infinity-four-fixes-opposite.png)
- [Final mobile view](/private/tmp/infinity-four-fixes-mobile.png)

Baseline and final cameras differ after reload/orbit; these are not pixel-matched comparisons. The close-up predates the last small roughness adjustment; desktop/mobile captures include final parameters. The film remains subtle in a wide view and the terrain is intentionally simple. Full photographic realism is not certified. No new full shape/system/color matrix or physical-phone test was performed in this narrow pass. Custom shader light linking is raster-specific; offline Cycles export parity was not tested or claimed.
