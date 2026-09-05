# Autonomous backlog

Work item format: ID, problem, evidence, expected gain, risk, files,
acceptance criteria, status.

## AUTO-001

- Problem: The automated geometry/camera audit (`npm run test:geometry`)
  was failing on its first case, silently, since the previous checkpoint
  commit introduced wall-relative Interior Finish framing and a Liner/Mosaic
  distance split without updating the two assertions that encoded the old
  (now-incorrect) invariants.
- Evidence: `rectangle-10x4.5/in-ground: Interior Finish changed the
  reference wall target` and, after that fix, `Mosaic camera differs from
  PVC/Liner`, both thrown on a clean install.
- Expected gain: Restores a working automated regression gate for all
  future camera/geometry work; without it every future change is unverified.
- Risk: Low -- corrected the test assertions to check the actual intended
  invariant (tangential/along-wall alignment, shared look-at target) rather
  than changing production camera behavior.
- Files: `scripts/geometry-audit.ts`, `src/lib/pool/camera.ts` (one
  pre-existing prettier nit only).
- Acceptance criteria: `npm run test:geometry` passes; `npx tsc --noEmit`
  clean; `npx eslint` clean on touched files.
- Status: COMPLETE

## AUTO-002

- Problem: Interior liner/mosaic materials only carry base-color maps per
  color (`src/configurator/materials/interior-textures.ts`); normal/
  roughness/AO are a single shared neutral micro-detail map applied
  globally, not per-color PBR detail. This is the #1 highest-value realism
  gap per `docs/VISUAL_REALISM_MAP.md`.
- Evidence: `INTERIOR_TEXTURES` only defines `baseColorMap`; `PoolModel.tsx`
  binds `materialMicroNormal`/`materialMicroRoughness` (one shared
  `createMaterialMicroNormalMap()`/`createMaterialMicroRoughnessMap()` call)
  regardless of liner color or finish.
- Expected gain: Believable per-liner-color surface variation (embossing,
  roughness) without relying on unavailable photographed asset sets.
- Risk: Medium -- touches the material binding path used by every pool
  render; needs before/after screenshot comparison and perf check
  (extra canvas textures generated per color).
- Files: `src/configurator/materials/interior-textures.ts`,
  `src/components/pool/three/textures.ts`, `src/components/pool/three/
  PoolModel.tsx`.
- Acceptance criteria: no visual regression on existing colors, no new
  texture-memory growth beyond one extra small canvas per active color, FPS
  budget in `docs/PERFORMANCE_REPORT.md` still met.
- Status: READY (next task, see `docs/AUTONOMOUS_STATE.md`)

## AUTO-003

- Problem: Real photographed PBR texture sets (normal/roughness/AO) for
  PVC liner, mosaic and coping finishes are not present in the repo and
  cannot be fetched from any external source in this sandbox.
- Evidence: this session's npm registry probe -- the project's private
  asset/package mirror (`europe-west1-npm.pkg.dev`) returns 403 under this
  session's egress policy; no other asset host is configured anywhere in
  the repo.
- Expected gain: n/a until unblocked.
- Risk: n/a.
- Files: n/a.
- Acceptance criteria: an owner supplies real asset URLs, or the egress
  policy allowlists an asset host, or licensed textures are added directly
  to `public/textures/`.
- Status: BLOCKED (external dependency; do not retry same host repeatedly --
  re-check only if an owner reports the policy changed)
