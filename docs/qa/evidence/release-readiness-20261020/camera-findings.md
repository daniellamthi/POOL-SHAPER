# Camera and technical view — 2026-10-20

Scope: C01–C04 only. Source inspected read-only at branch `feat/fullscreen-day-night-hidden-overflow`, HEAD `0665d3b`, with pre-existing WIP preserved. No browser access, application edits, commit or backend operation performed in this inspection block.

| ID | Expected | Current evidence | Status |
| --- | --- | --- | --- |
| C01 | Whole pool centred in UI-free area; size/viewport/panel aware | `CameraRig` uses measured `[data-camera-occluder]` bounds and actual overview/accessory envelope. Historical `overview` harness aborts on missing `interiorSubject` scope before checking current framing. Current browser verification pending. | NOT VERIFIED |
| C02 | Readable Shelf, Infinity, stairs, skimmer and material details | Current Shelf geometry/projection test PASS, 9,662 assertions /108 fixtures. Subject includes actual shelf, steps, landing and selected loungers. Historical `infinity-local` test rejects obsolete whole-scene SHA before assertions. Browser checks of all listed subjects remain pending. | NOT VERIFIED |
| C03 | LED short-side camera; short transitions; latest selection wins; manual input respected | `lighting-main` PASS 2,862 assertions /54 fixtures; `motion` PASS 68 assertions /12 fixtures. Current production code runs 240 ms detail transitions, snaps large overview moves/reduced motion, retargets from current eye and cancels on manual input. Browser animation check pending. | NOT VERIFIED |
| C04 | Faithful orthographic plan, semantic boundaries, readable dimensions/export | Current `premium-plan-outline` PASS 3,481; `architectural-plan` PASS 383. Historical camera `top` SHA assumes pre-October-19 boundary extraction. Current visual/actual export checks pending. | NOT VERIFIED |

## Reproducible commands

- `node scripts/run-premium-camera-regression.mjs shelf` — PASS, 9,662 assertions /108 fixtures.
- `node scripts/run-premium-camera-regression.mjs lighting-main` — PASS, 2,862 /54.
- `node scripts/run-premium-camera-regression.mjs motion` — PASS, 68 /12.
- `node scripts/run-premium-camera-regression.mjs infinity` — PASS, 2,666 /72.
- `node scripts/run-premium-camera-regression.mjs stairs` — PASS, 188,777 /204; actual rotations −180/−90/0/90/180°.
- `node scripts/run-premium-camera-regression.mjs overflow` — PASS, 558 /18.
- `node scripts/run-premium-plan-outline-audit.mjs` — PASS, 3,481.
- `node scripts/run-architectural-plan-audit.mjs` — PASS, 383.
- `node scripts/run-premium-camera-regression.mjs overview` — FAIL in test evaluator: `ReferenceError: interiorSubject is not defined`; test scope at `scripts/premium-camera-regression.ts:946` does not include current `interiorSubject`/`wholeSubject` inputs used by extracted `subjectAspect`.
- `node scripts/run-premium-camera-regression.mjs infinity-local` — FAIL before runtime camera assertions: historic full `PoolScene.tsx` SHA expected `3ce3be1f…`, current `7d4e8d00…`; this is not evidence of a camera defect.
- `node scripts/run-premium-camera-regression.mjs top` — FAIL before current framing assertions: historical `architecturalEdges` SHA expected `4ec7665b…`, current `34aff6d2…`; current approved semantic-outline tests above pass.
- `node scripts/run-premium-camera-regression.mjs interior-finish` — FAIL before current material-camera assertions: historic W camera-algorithm SHA expected `61795f89…`, current `368f984a…`; this fixture predates later approved camera changes and cannot establish a current product regression.

No visual PASS is inferred from geometry assertions or historical screenshots. The new Sun Shelf sizing candidate must rerun affected Shelf/access/camera and browser checks after integration. Mobile browser viewports, when tested, are emulation unless physical hardware is explicitly recorded.

## Current integrated browser block

Actual Chrome on separate local QA origin `release-perf.localhost:3003`; no backend writes or user draft edits.25 unique current PNG captures and26 raw observation records in `camera-browser-evidence.json` (the first390technical attempt retained an open menu; final same-name PNG is the clean retest). Camera focus/projection were read only from public canvas DOM data attributes, never private Three/R3F state.

- C01 scoped visual PASS: fresh `Vedi la piscina`/review full-pool Skimmer+Shelf at1440×900 and390×844/430×932; collapsed mobile framing is complete and substantially larger.430expanded dock leaves a short scene band and smaller complete pool; it does not show a cropped detail. Infinity/glass fresh full-pool review at1440 and390 also complete. Source of the earlier corner-only review suspicion was not reproduced after explicit `Vedi piscina`. Above-ground fresh mobile and Infinity430general remain NOT VERIFIED by this specialist.
- C02 scoped visual PASS: Shelf minimum3.035m and maximum5.6m in8×4, two actual dedicated loungers, stairs and access envelope, at1440/390/430. Selected Shelf is oblique from above, complete; surrounding basin may be cropped in detail as intended. Infinity traditional+glass each four sides at1440: nearly frontal from overflow with readable receiving edge/end; a long overflow may extend beyond a local detail frame. Other standalone stair/skimmer/material-camera combinations are not newly claimed by this browser block.
- C03 scoped visual PASS: actual LED view is from short side, white→blue selected state commits; six discrete riser micro-spots show coordinated blue lighting in the chosen Shelf stair detail, selected independently. Static captures and current motion regression support short retargeting; a full rapid-animation video/manual-interruption browser test is NOT VERIFIED here. Long input scheduling stalls in these DEV transitions are separately recorded, with cause under investigation.
- C04 scoped visual PASS: current Infinity/Shelf orthographic top with guides at390/430; public metadata confirms `orthographic`/`top`,8×4 and depth1.5 labels distinct, semantic edges without visible triangle diagonals. Current screenshots do not establish animation shimmer, all technical components or an actual newly exported PDF. Existing383 local framing/export checks remain separate.

Capture families: `camera-shelf-{min,max}-two-loungers-{1440,390,430}.png`, `camera-general-shelf-*.png`, `camera-infinity-{traditional,glass}-side{1,2,3,4}-1440.png`, `camera-infinity-glass-general-{1440,390}.png`, `camera-technical-infinity-{390,430}.png`, `camera-led-*.png`, `camera-micro-spots-infinity-1440.png`.

All viewport mobile checks are desktop emulation, no physical mobile device. Browser returned to `about:blank` and viewport override reset for coordinated handoff. Source was read-only for this specialist; coordinator owns parser fixes and DEV instrumentation.
