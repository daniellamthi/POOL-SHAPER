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

## PERF-2: Share skimmer frame material

- Problem: `Skimmers.tsx` textures (normal/roughness/AO) were already
  shared per `Skimmers` instance, but the frame `<meshPhysicalMaterial>`
  was declared via a JSX-returning helper called at 8 spots inside
  `SkimmerAssembly`, so React/R3F constructed a fresh material object at
  each of those 8 spots for *every* skimmer position (`positions.length * 8`
  material allocations) even though `color`/`roughness`/maps are identical
  across the whole plan.
- Evidence: `docs/PERFORMANCE_REPORT.md` "Safe optimization order" item 2 and
  "Skimmers" cost row ("no shared instancing").
- Expected gain: fewer material allocations/GC churn; no visual change
  (same material properties everywhere).
- Risk: low -- verified single call site (`PoolScene.tsx`) unchanged props;
  R3F supports one material object attached to many meshes.
- Files: `src/components/pool/three/Skimmers.tsx`.
- Acceptance criteria: typecheck clean, lint clean (prettier auto-fix
  applied for the resulting JSX reflow), `npm run build` succeeds, no
  `Skimmers` prop-API change.
- Status: COMPLETE. (Geometry sharing across skimmer instances -- e.g. the
  ~14 meshes per assembly repeated per position -- is a separate, higher-
  effort follow-up not done here; residential skimmer counts are low enough
  that the report rates it "Low" severity.)

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
