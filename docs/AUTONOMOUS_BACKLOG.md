# Autonomous backlog

Status values: READY, IN_PROGRESS, BLOCKED, COMPLETE.
Ordered by `docs/IMPROVEMENT_ROADMAP.md` priority; re-prioritize on evidence.

## AB-001 -- Camera regression test asserted an impossible invariant
- problem: `npm run test:geometry` failed on its first case.
- evidence: see `docs/AUTONOMOUS_DECISIONS.md` (2026-09-05 entry).
- expected gain: restores a working, trustworthy geometry/camera regression
  suite -- a prerequisite for every other item below.
- risk: none (test-only change; verified no production behavior changed).
- files: `scripts/geometry-audit.ts`.
- acceptance criteria: `npm run test:geometry` passes; `npx tsc --noEmit`
  clean; no change to `src/lib/pool/camera.ts`.
- status: COMPLETE

## AB-002 -- Derive an AO map for Liner/Mosaic interior surfaces
- problem: `InteriorMaterialMaps.aoMap` (`src/configurator/materials/
  interior-textures.ts`) is declared but never populated or consumed;
  `getDerivedDetailMaps` (`src/components/pool/three/textures.ts`) only
  returns `normalMap`/`roughnessMap`. Spec asks for a full baseColor +
  normal + roughness + AO set per finish.
- evidence: grep confirms no `aoMap` prop reaches `PoolModel.tsx`'s wall/
  floor `<meshPhysicalMaterial>` (only `normalMap`/`roughnessMap` at
  `PoolModel.tsx:682-711`); `DerivedDetailMaps` interface has no `aoMap`
  field.
- expected gain: completes the PBR map set for the interior surface that
  gets the most screen time (walls/floor), closing roadmap priority #2/#3.
- risk: three.js's built-in `aoMap` chunk samples `uv2`, not the primary
  `uv` the other maps use -- must confirm the wall/floor `BufferGeometry`
  already carries `uv2` (or clone `uv` into it) before wiring the prop, or
  use an `onBeforeCompile` override sampling at `vUv` instead. Getting this
  wrong either silently no-ops the AO or throws a console warning.
- files: `src/components/pool/three/textures.ts`,
  `src/configurator/materials/interior-textures.ts`,
  `src/lib/pool/materials.ts`, `src/components/pool/three/PoolModel.tsx`,
  `src/components/pool/three/poolGeometry.ts` (uv2 check).
- acceptance criteria: AO visibly darkens grout/seam cavities on Mosaic and
  liner welds without darkening flat tile/panel faces; no console warnings;
  `npx tsc --noEmit` and `npm run test:geometry` stay clean.
- status: READY

## AB-003 -- Fix the ~82 pre-existing `npm run lint` (prettier) findings
- problem: `npm run lint` currently reports ~82 prettier errors across
  files this session did not touch, which masks real lint signal on future
  diffs.
- evidence: baseline `npm run lint` run this session, before any edits.
- expected gain: restores lint as a usable signal for future autonomous
  passes; near-zero visual/behavioral risk (formatting only).
- risk: low, but touches many files -- do as its own atomic commit with
  `npm run format` (prettier --write) and a follow-up diff review, not
  bundled with feature work.
- files: TBD (whatever `npm run lint` currently flags).
- acceptance criteria: `npm run lint` clean; `npx tsc --noEmit` clean; no
  behavior change (formatting-only diff).
- status: READY

## AB-004 -- Mosaic anti-tiling
- problem: spec priority calls out preventing obvious mosaic repetition;
  not yet audited whether `MOSAIC_FINISHES` / its UV tiling in
  `PoolModel.tsx` already varies rotation/offset per repeat.
- evidence: not yet gathered this session.
- expected gain: TBD pending audit.
- risk: TBD.
- files: `src/components/pool/three/PoolModel.tsx`,
  `src/configurator/materials/interior-textures.ts`.
- acceptance criteria: TBD.
- status: READY (needs an audit pass before it can be scoped further)
