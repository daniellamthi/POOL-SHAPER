# Architectural top view — 2026-10-12

Base: `d4ea8ed751e21f7e89fc069db9c2d3b3b6efb7f4`, branch `claude/pool-shaper-build2-project-delivery`.

## Scope and result

- PASS: existing Dall’alto uses perpendicular orthographic projection and fits the real shell/coping/external-access envelope into the unobscured viewport.
- PASS: construction contours are extracted from actual transformed upper mesh faces. Coplanar triangle diagonals and underside edges are discarded; opaque geometry occludes lower contours.
- PASS: stairs, shelf, hydromassage open/closed, coping and overflow/Infinity boundaries remain legible with selected materials. Real grille bars are retained without outlining each tiny bar (which created a dark band on mobile).
- PASS: top-only shadow/reflection reduction; other camera intents and geometry are unchanged.
- PASS: Photo Mode excludes the overlay; actual hero/export capture temporarily hides it and restores its previous visibility.
- No save schema, backend, material catalogue or geometry changes. Pre-existing WIP is excluded from this commit. PoolModel WIP was checked byte-for-byte after reversing only this task’s annotations/prop.

## Runtime evidence

Real browser captures inspected in sibling directory `../top-view-evidence/` (local evidence, not committed). QA fixture rendered the production PoolScene, not a static illustration. Temporary fixture/server removed after testing; normal preview remains on port 3001.

| Case | Evidence | Result |
| --- | --- | --- |
| Same 8×4 Skimmer / Sand Beach / straight stairs before and after, 1440×900 | `comparison-before-8x4-1440.jpg`, `comparison-after-8x4-1440.jpg` | PASS |
| 6×3 above-ground, mirrored straight stairs and external staircase | `6x3-aboveground-straight-mirrored.jpg` | PASS |
| 8×4 Sun Shelf, integrated steps | `8x4-shelf.jpg` | PASS |
| 8×4 Infinity hydromassage A/B | `8x4-infinity-hydro-open.jpg`, `8x4-infinity-hydro-closed.jpg` | PASS |
| 12×5 visible overflow, dark liner, corner stairs | `12x5-overflow-dark-1440.jpg`, `12x5-overflow-dark-430.jpg` | PASS |
| Supported L shape, dark liner | `12x5-l-shape-dark-430.jpg` | PASS |
| Actual wizard, 12×5 Infinity, night, desktop | `after-infinity-1440.jpg` | PASS |
| Actual wizard, 390×844 and 430×932 | `wizard-infinity-top-390.jpg`, `wizard-infinity-top-430.jpg` | PASS |
| Real hero capture without technical contours | `actual-export-no-outlines.jpg` | PASS |

## Automated verification

Exact staged snapshot (excluding all previous WIP), independently checked in a temporary directory:

- `npx tsc --noEmit`: PASS.
- `npm run build`: PASS (existing chunk-size warning).
- `node scripts/run-architectural-plan-audit.mjs`: PASS, 358 checks (metric projection, 6×3/8×4/12×5, rectangle/L shape, desktop/mobile margins, real comfort solids and export guards).
- `node scripts/run-contextual-camera-audit.mjs`: PASS, 30,061 checks.
- `node scripts/run-persistence-audit.mjs`: PASS.
- `node scripts/run-export-guard-audit.mjs`: PASS.
- `git diff --cached --check`: PASS.

Working candidate with preserved WIP also passed typecheck/build, 362 architectural checks and 30,957 contextual-camera checks. Counts differ because the existing WIP adds comfort geometry.

Known unrelated failure: the older general `test:geometry` suite stops on `invalid pool features` (stale catalogue expectation). The identical failure was reproduced in an untouched snapshot of the base commit. It is NOT counted as PASS and no assertion was weakened. The targeted geometry/camera gates for this change pass.

No live backend/email/production verification was performed or required for this rendering-only change. No merge or deployment.
