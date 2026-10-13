# Water ghosts / historical overflow — 2026-09-25

Branch `feat/premium-infinity-waterline-v1`, baseline HEAD `a9846c3`; all earlier WIP preserved. No commit, push, deploy or merge.

## A: verified cause and scoped fallback

Reference reproduced on rectangle 6 × 3 × 1.20 m, Infinity side 3, Blue Sky liner, inox ladder. At a low oblique camera the emerged rail and foreground coping appear displaced a second time. At a higher angle the distortion is much less apparent. The same geometry remains mounted once in PoolModel/PoolAccessModel.

Disabling only the planar mirror did not eliminate the bands in the initial check. Disabling only the main basin's screen-space transmission displacement removed the rail copy and displaced foreground coping in the controlled low-angle comparison. The opaque Three transmission buffer includes emerged geometry; the previous shoreline/path bound cannot identify an emerged rail pixel. No depth-aware submerged-only buffer exists in this path.

The local fallback sets raster `material.thickness = 0.0` only for the main basin transmission shader. It does not disable transmission, Fresnel, ripple normals, planar reflection, shadows, caustics or receiver-side underwater absorption. No opacity/color/geometry/camera workaround. Physical material depth remains unchanged for still renderers. Limitation: raster basin refraction displacement is deliberately absent, not physically solved. Infinity film/receiver materials are unchanged.

Comparable real screenshots:
- Before: `/private/tmp/ghost-low-before.png`
- After: `/private/tmp/ghost-low-after.png`
- Higher view / immersed inox treads: `/private/tmp/ghost-mobile-after.png` (despite filename this is DESKTOP; viewport override did not resize this QA tab)
- Straight stairs: `/private/tmp/ghost-straight-after.png`
- Corner stairs: `/private/tmp/ghost-corner-after.png`

Actual orbit drags and zoom were exercised; no orbit video recorded. Mobile QA is NOT verified: requested 390 × 844 override did not affect the QA screenshot, and was reset. Earlier comparison captures from the user tab were not used as definitive proof because its configuration changed during testing. A separate tab on the same server was used, no duplicate server.

## B: source evidence; clarification required, no invented variant

Fetched only the requested legacy ref, without switching checkout.

- `origin/legacy/10-step-configurator`: `43bcb5d52f236fa930bebb9a266839ad0005e4f3`; config STEPS indices 0–9. Selector `src/configurator/steps/pool-system/PoolSystemStep.tsx`; geometry `src/components/pool/three/PoolModel.tsx`; constants `src/lib/pool/config.ts`.
- `claude/pool-photorealism-autonomous`: `026a578dbc1117739d782c6d2c4bba5e3afa75ff`; same selector IDs `hidden` and `visible`.
- `hidden`: stone lip from outline to +55 mm, receiving slot to +105 mm, coping outside it; no grille. This implementation and selector are STILL PRESENT in current code and selectable in live Acqua > Piscina a sfioro > Sfioro nascosto. No reconnection necessary.
- `visible` at legacy 43bcb5d: 110 mm kerb, +75 mm raised top, 245 mm grille, total band 355 mm, channel depth 220 mm.
- `visible` at autonomous 026a578: grille directly from basin outline to +165 mm, no raised kerb, channel depth 190 mm.
- Current `visible` retains kerb/grille organization but has flush crest (rise 0), preserving the recent approved overflow WIP.

No evidence of a third named variant in either candidate selector. Clarify whether the user means the already selectable hidden stone/slot version or a separate historical visible section (raised legacy kerb vs earlier flush narrow grille). Do not arbitrarily reinstate an upstand or duplicate current hidden geometry. Historical side-by-side runtime and two-size B matrix NOT completed pending that choice.

## Checks

- TypeScript noEmit PASS.
- Vite client/SSR/Nitro build PASS (existing chunk-size/tsconfig-paths warnings).
- `node scripts/water-transmission-audit.mjs`: 8 shader contract checks PASS; not a substitute for GPU visual QA.
- git diff --check PASS.
- New application change only WaterSurfaceMaterial.tsx; added this report and water-transmission-audit.mjs. Earlier WIP not included in these task-local counts.
