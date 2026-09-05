# Autonomous backlog

Format: ID / problem / evidence / expected gain / risk / files / acceptance criteria / status.

## AUTO-001 — Automatic rendering quality tier
- Problem: `ACTIVE_RENDERING_QUALITY` was hardcoded to `"experience"` for every device.
- Evidence: `src/configurator/3d/scene/visual-preset.ts` (comment: "Temporarily set to Experience for live visual verification").
- Expected gain: protects mobile/low-power FPS budget (spec section 27: mobile >=30 FPS) without touching desktop quality.
- Risk: low — same exported constant, no downstream API change.
- Files: `src/configurator/3d/scene/visual-preset.ts`.
- Acceptance: typecheck/lint/build clean; desktop (no coarse pointer, >=5 cores, wide viewport) still resolves to `experience`; mobile/touch/narrow/low-core resolves to `configuration`.
- Status: COMPLETE.

## AUTO-002 — Geometry audit regression: "Interior Finish changed the reference wall target"
- Problem: `npm run test:geometry` fails on `rectangle-10x4.5/in-ground` when interior finish changes; wall reference target shifts.
- Evidence: reproduces on parent commit `4cddd3f` (pre-existing, not introduced by AUTO-001).
- Expected gain: restores the 108-case geometry audit to green; likely indicates a real wall/geometry coupling bug tied to `INTERIOR_TEXTURE_METADATA`/material scale changes touching geometry it shouldn't.
- Risk: unknown until root-caused (High per roadmap difficulty for wall/UV work).
- Files (suspects): `scripts/run-geometry-audit.mjs`, `src/lib/pool/geometry.ts`, `src/lib/pool/materials.ts`, `src/components/pool/three/poolGeometry.ts`.
- Acceptance: `npm run test:geometry` passes; no visual/dimension regression elsewhere.
- Status: READY (next task).

## Priority order reference
See `docs/IMPROVEMENT_ROADMAP.md` for the full 15-item priority list and file targets. Default order for future iterations when no urgent regression exists: geometry-audit fix (AUTO-002) > liner PBR completeness (normal/roughness/AO maps, currently base-color only) > curve-aware coping/overflow offsets > camera system calibration > mosaic anti-tiling > premium photo mode polish.
