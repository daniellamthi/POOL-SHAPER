# Autonomous state

## CURRENT OBJECTIVE
Elevate Pool Architect 3D toward ultra-premium archviz-grade realism while
preserving the existing configurator flow, geometry logic and working
features (see IMPROVEMENT_ROADMAP.md / VISUAL_REALISM_MAP.md for the
prioritized file-level plan).

## CURRENT TASK
None in progress. Last completed: fixed two stale invariants in the camera
regression test (`scripts/geometry-audit.ts`) that no longer matched the
intentional Liner/Mosaic close-up framing added to `src/lib/pool/camera.ts`
(`getInteriorFinishCamera`). `npm run test:geometry` was failing on the very
first case (`rectangle-10x4.5`) and had been silently red -- production
camera behavior was correct and untouched; only the test assertions were
wrong. See AUTONOMOUS_DECISIONS.md for the full rationale.

## NEXT TASK
Resume at roadmap priority #2 (`docs/IMPROVEMENT_ROADMAP.md`): liner/mosaic
interior finishes already get procedurally *derived* normal + roughness maps
from their base-colour photos (`getDerivedDetailMaps` in
`src/components/pool/three/textures.ts`), but no AO map is derived or wired
into `PoolModel.tsx`'s wall/floor materials (`InteriorMaterialMaps.aoMap` is
declared but never populated). Adding it needs either a `uv2` channel on the
interior geometry (three.js's built-in `aoMap` reads `uv2`, not the primary
`uv`) or a custom `onBeforeCompile` sampling `aoMap` at `vUv` -- confirm
which the existing wall/floor geometry already has before choosing an
approach.

## BLOCKED TASKS
- None currently open. (Package registry access was blocked on first attempt
  this session -- `bun install` / `npm install` against the private
  `*-npm.pkg.dev` mirror returned 403 -- but installing directly against
  `https://registry.npmjs.org/` succeeded, since that host is in this
  session's no_proxy allowlist. Not a standing blocker; record it here only
  if a future session hits the private mirror again with no public-registry
  fallback available.)

## LAST GOOD COMMIT
See `git log -1` on `claude/zen-cannon-46nie6` at the time this file was
last updated. `npm run test:geometry`, `npx tsc --noEmit` and
`npx eslint <touched files>` were all clean before pushing.

## KNOWN REGRESSIONS
- None introduced this session.
- Pre-existing, untouched: `npm run lint` reports ~82 prettier findings
  across files this session did not touch (e.g. `src/lib/theme.tsx` and
  others) -- not addressed here per the no-useless-churn rule; worth a
  dedicated formatting pass later since it is currently masking real lint
  signal in `npm run lint` output.

## CURRENT REALISM SCORE
See `docs/REALISM_SCORECARD.md`.

## CURRENT PERFORMANCE STATUS
Not measured this session (no browser/runtime profiling was run). See
`docs/PERFORMANCE_REPORT.md` for the last recorded baseline.
