# Autonomous backlog

Work items follow `docs/PERFORMANCE_REPORT.md` "Safe optimization order" and
`docs/IMPROVEMENT_ROADMAP.md`, re-prioritized against what's actually
implemented (see docs/AUTONOMOUS_STATE.md note: liner/mosaic PBR and
underwater color-per-liner are already substantially built).

## PERF-1: Memoize procedural micro-detail CanvasTextures

- Problem: `createMaterialMicroNormalMap`, `createMaterialMicroRoughnessMap`,
  `createContactAOGradientMap` each ran a fresh per-pixel canvas generation
  on every independent call site (PoolScene studio floor, Skimmers, PoolModel
  fallback micro-detail, ExternalStaircase contact shadow) even though the
  output is identical for a given `size`.
- Evidence: `docs/PERFORMANCE_REPORT.md` "Procedural textures" cost row +
  "Safe optimization order" item 4; grep showed 3 independent call sites for
  the normal/roughness pair, 2 for the AO gradient.
- Expected gain: removes redundant CPU (per-pixel trig/gradient loops) work
  on mount; each call site still gets its own `Texture` instance (via
  `.clone()` off a cached template) so `repeat`/`anisotropy` mutation and
  `dispose()` stay per-instance and safe.
- Risk: low -- pure functions of `size` only, no shared mutable state read
  back by callers.
- Files: `src/components/pool/three/textures.ts`.
- Acceptance criteria: typecheck clean, lint clean, `npm run build` succeeds,
  no call-site API change (same exported function signatures), visual output
  unchanged (same generation code, only deduplicated).
- Status: COMPLETE.

## PERF-2: Share skimmer geometry/materials

- Problem: `Skimmers.tsx` likely re-declares geometry/material JSX per
  skimmer instance rather than sharing/instancing.
- Evidence: `docs/PERFORMANCE_REPORT.md` "Safe optimization order" item 2 and
  "Skimmers" cost row ("no shared instancing").
- Expected gain: fewer geometry/material allocations and draw calls at
  higher skimmer counts.
- Risk: medium -- must preserve per-skimmer color/finish/position/rotation.
- Files: `src/components/pool/three/Skimmers.tsx`.
- Status: READY (next task).

## GEO-1: Root-cause geometry audit failure

- Problem: `npm run test:geometry` fails on a clean checkout with
  "Interior Finish changed the reference wall target" for
  `rectangle-10x4.5/in-ground`.
- Evidence: reproduced on baseline commit 4cddd3f via `git stash`, before
  any change this session.
- Expected gain: restores a working regression safety net for geometry
  changes (currently unusable as a gate).
- Risk: unknown until root-caused -- could be a real geometry/material
  coupling bug or a stale audit fixture.
- Files: `src/lib/pool/geometry.ts`, `scripts/run-geometry-audit.mjs`.
- Status: BLOCKED (recorded reason above; not investigated this session --
  picked lower-risk PERF-1 first per continuous-progress priority).

## DEP-1: Lockfile drift

- Problem: `npm ci` fails against the committed `package-lock.json`
  (missing `lru-cache@11.5.2`).
- Evidence: reproduced this session installing dependencies for
  verification.
- Expected gain: CI/deploy environments using `npm ci` would currently fail
  from a clean clone.
- Risk: low to fix (regenerate lockfile), but the regenerated diff also
  carries npm-version-specific metadata noise (`libc` fields) that should be
  reviewed/isolated rather than committed incidentally.
- Files: `package-lock.json`.
- Status: READY (needs a dedicated pass with the right npm version to avoid
  unrelated metadata churn).
