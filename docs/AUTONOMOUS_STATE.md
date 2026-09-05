# Autonomous state

CURRENT OBJECTIVE
Elevate Pool Architect 3D toward ultra-premium archviz realism while preserving
the existing configurator flow and product logic (see docs/IMPROVEMENT_ROADMAP.md
and docs/VISUAL_REALISM_MAP.md for the standing priority order).

CURRENT TASK
COMPLETE — Interior liner/mosaic AO (ambient occlusion): extended
`getDerivedDetailMaps` (src/components/pool/three/textures.ts) to derive a real
aoMap from each photographed liner/mosaic texture's own grout/seam edges (same
Sobel pass already used for normal/roughness), added a matching subtle
procedural fallback (`createMaterialMicroAoMap`) for sources with no photo data,
and wired `aoMap`/`aoMapIntensity` onto the interior wall + floor
`meshPhysicalMaterial`s in PoolModel.tsx. Indirect-light-only, so it never
darkens base colour or direct lighting. Verified: `tsc --noEmit` clean,
`eslint` clean on touched files, production build succeeds.

NEXT TASK (READY)
Investigate the failing geometry-audit case
`rectangle-10x4.5/in-ground: Interior Finish changed the reference wall target`
in `scripts/geometry-audit.ts` (camera pose for the "liner" intent no longer
matches the Skimmer master target on this pool size). Root-cause in
`src/lib/pool/camera.ts` / `getCameraPose`, fix, and confirm
`npm run test:geometry` passes clean end-to-end.

Other READY candidates (priority order, see docs/IMPROVEMENT_ROADMAP.md):
- Extend AO derivation to coping/panel triplanar detail (`createTriplanarDetailMaps`)
  now that the interior AO plumbing exists — needs triplanar GLSL AO sampling,
  higher risk than the interior pass, do after the camera regression above.
- Mosaic anti-tiling: current mosaic finishes reuse one photographed tile
  1:1 with world-space repeat; large walls may show visible repetition.
- Audit overflow/skimmer geometry against docs/POOL_COMPONENTS.md for any
  remaining approximate (non-curve-aware) offsets on Custom Shape pools.

BLOCKED TASKS
None currently. (No network-dependent asset work has been attempted this
session — all texture/material work stays procedural/derived from existing
local photos per docs/ASSET_PRODUCTION_SPEC.md.)

LAST GOOD COMMIT
See `git log -1` on `claude/zen-cannon-voutw6` after this session's commits
("Derive interior AO from photographed liner/mosaic detail" and the
package-lock.json sync commit before it).

KNOWN REGRESSIONS
- `npm run test:geometry` fails on `rectangle-10x4.5/in-ground` with
  "Interior Finish changed the reference wall target" — pre-existing on the
  branch before this session (confirmed via `git stash`), not caused by the
  AO change above. See NEXT TASK.
- `eslint src/components/pool/three/PoolModel.tsx` reports one pre-existing
  prettier formatting error (long `console.warn` line ~line 80), unrelated to
  this session's edits; left as-is to avoid unrelated churn in this commit.

CURRENT REALISM SCORE
See docs/REALISM_SCORECARD.md (created this session).

CURRENT PERFORMANCE STATUS
Not re-profiled this session (no renderer/runtime-cost change — the new AO
maps reuse the existing derived-detail cache and texture-clone path already
used for normal/roughness, adding one more 512×512 canvas texture per unique
liner/mosaic photo, generated once and cached). See docs/PERFORMANCE_REPORT.md
for the last full profile.
