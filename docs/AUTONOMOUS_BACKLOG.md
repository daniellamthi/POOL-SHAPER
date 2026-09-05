# Autonomous backlog

Format: ID, problem, evidence, expected gain, risk, files, acceptance
criteria, status.

## AUTO-001 — Geometry/camera audit script asserted a stale invariant

- Problem: `npm run test:geometry` failed unconditionally on every run.
- Evidence: `getInteriorFinishCamera` in `src/lib/pool/camera.ts` was
  intentionally refactored to give the Liner camera a pulled-back framing and
  the Mosaic camera a tighter one (see the function's own doc comment), but
  `scripts/geometry-audit.ts` still asserted the old invariant: Liner's
  target had to equal the Skimmer master's target exactly, and Mosaic's pose
  had to equal Liner's pose exactly. Both are false by design now.
- Expected gain: Restores the only automated regression gate for pool
  geometry and camera framing, which every later geometry/camera/material
  task depends on per the low-consumption operating rules.
- Risk: Low — test-only change, no production rendering code touched.
- Files: `scripts/geometry-audit.ts`.
- Acceptance criteria: `npm run test:geometry` passes; the new assertions
  still catch a real regression (target leaving the wall plane, losing wall
  centring, losing frontal alignment, or Mosaic no longer being tighter than
  Liner).
- Status: COMPLETE.

## AUTO-002 — Liner/mosaic full per-color PBR map audit

- Problem: `docs/VISUAL_REALISM_MAP.md` gap #1 flags that liner colors may
  still be missing authored normal/roughness/AO maps and rely only on the
  shared procedural derivation in `three/textures.ts`.
- Evidence: `src/configurator/materials/interior-textures.ts` only declares
  `baseColorMap` for every liner entry; no `normalMap`/`roughnessMap`/`aoMap`
  keys are populated per color.
- Expected gain: Confirms whether real gain exists here or whether the
  procedural derivation already satisfies the PBR mission section (8), so
  effort isn't spent re-deriving what already works.
- Risk: Low (audit-only) until a concrete change is proposed.
- Files: `src/configurator/materials/interior-textures.ts`,
  `src/components/pool/three/textures.ts`.
- Acceptance criteria: A clear recommendation recorded in
  `docs/AUTONOMOUS_STATE.md`/`docs/AUTONOMOUS_DECISIONS.md` on whether
  authored maps are worth sourcing vs. keeping the procedural approach.
- Status: READY.
