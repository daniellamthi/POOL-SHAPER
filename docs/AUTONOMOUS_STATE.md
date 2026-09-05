# Autonomous state

CURRENT OBJECTIVE
Elevate Pool Architect 3D toward ultra-premium archviz-grade realism while
preserving the existing configurator flow (per POOL_ARCHITECT_3D autonomous
mission). Default priority order lives in `docs/IMPROVEMENT_ROADMAP.md`.

CURRENT TASK
None in progress. Last session repaired the automated geometry/camera audit
(`npm run test:geometry`), which had been silently broken since the previous
checkpoint commit and was not caught because dependency install failed in
that environment.

NEXT TASK
Priority #2 from `docs/IMPROVEMENT_ROADMAP.md`: upgrade the interior texture
registry (`src/configurator/materials/interior-textures.ts`) toward full
per-color PBR sets (normal/roughness/AO), per
`docs/VISUAL_REALISM_MAP.md` highest-value gap #1. Only base-color maps
exist today per liner color; normal/roughness are currently a single shared
neutral micro-detail map applied globally (see `PoolModel.tsx`
`materialMicroNormal`/`materialMicroRoughness`), not per-liner-color detail.
Real photographed PBR texture sets are not available locally and can't be
fetched (see BLOCKED below) -- next step should extend the existing
procedural canvas-texture approach (`three/textures.ts`) with an
AO-equivalent or per-color embossing variation rather than waiting on assets.

BLOCKED TASKS
- Fetching real photographed PVC-liner/mosaic/coping PBR texture sets
  (normal/roughness/AO maps) from any external asset source: this sandbox's
  egress policy denies the project's private npm/asset mirror
  (europe-west1-npm.pkg.dev, 403) and no other asset source is configured.
  Public `registry.npmjs.org` IS reachable, so `npm install` (not `bun
  install`) works for JS dependencies -- this only blocks non-npm binary
  asset downloads. Continue with procedural/generated textures until an
  owner supplies real asset URLs or an allowed asset host.

LAST GOOD COMMIT
See `git log -1` on `claude/zen-cannon-srr1xc`. This session's commit fixes
two stale assertions in `scripts/geometry-audit.ts` (Interior Finish target
drift check, Mosaic-vs-Liner pose check) that no longer matched intentional
camera behavior introduced in the immediately preceding checkpoint commit
(wall-relative interior-finish target, and the Liner/Mosaic framing-distance
split), plus one pre-existing prettier nit in `src/lib/pool/camera.ts`.

KNOWN REGRESSIONS
None currently known after the audit fix. `npm run test:geometry` passes:
108 shape/dimension/system cases, 6 custom-shape offset cases, 12 guardrail
regressions, 72 camera poses, 24 clamped drag steps.

CURRENT REALISM SCORE
Not yet formally scored this session -- see `docs/VISUAL_REALISM_MAP.md` for
the per-file impact ranking used as a proxy. `docs/REALISM_SCORECARD.md`
(mission-required per-dimension /10 scorecard) does not exist yet; create it
alongside the next material/geometry task rather than as a standalone
churn-only edit.

CURRENT PERFORMANCE STATUS
See `docs/PERFORMANCE_REPORT.md` (last authored during a previous session,
not re-profiled this run -- no renderer changes were made this session).

## Environment notes for future sessions

- `node_modules/` is not committed and is NOT reliably restorable via
  `bun install` in this sandbox (private registry mirror is denied by
  egress policy). Use `npm install` instead (reads the public
  `registry.npmjs.org`, uses `package-lock.json`). Do NOT commit any diff to
  `package-lock.json` produced this way unless it reflects a real,
  intentional dependency change -- local npm-version metadata churn (e.g.
  `libc` fields) is noise and should be reverted with `git checkout --
  package-lock.json` before committing.
- Once installed, `npx tsc --noEmit -p tsconfig.json`, `npm run
  test:geometry`, `npx eslint <files>`, and `npm run build` all work and
  should be used as the standard low-cost validation loop before any commit
  that touches rendering/geometry/camera code.
