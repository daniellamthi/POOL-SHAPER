# Autonomous backlog

Format: ID / problem / evidence / expected gain / risk / files / acceptance / status.

## AB-001 — Camera regression on Interior Finish shot (rectangle-10x4.5)
- Problem: liner-intent camera pose no longer matches the Skimmer master's
  target on this specific rectangle size.
- Evidence: `npm run test:geometry` throws
  `rectangle-10x4.5/in-ground: Interior Finish changed the reference wall target`.
  Confirmed pre-existing (reproduces with this session's changes stashed out).
- Expected gain: restores a green geometry audit; prevents a visibly wrong
  camera cut when a customer opens the Interior Finish step on this size.
- Risk: medium — camera.ts is shared by every step's shot.
- Files: `src/lib/pool/camera.ts`, `scripts/geometry-audit.ts` (read-only, it's
  the check).
- Acceptance: `npm run test:geometry` passes for all cases; liner-intent
  target stays within the existing 1e-10 tolerance of the Skimmer master.
- Status: READY

## AB-002 — Coping/panel AO
- Problem: triplanar stone/panel detail (`createTriplanarDetailMaps`) has
  normal+roughness but no AO, unlike the interior liner/mosaic path after
  AB-000 (this session).
- Expected gain: closer, more grounded coping close-ups (section 17 goal).
- Risk: medium-high — coping/panel use a custom `onBeforeCompile` triplanar
  shader (see PoolModel.tsx `configureCopingTriplanar`), not plain material
  props, so wiring AO means editing that GLSL, not just adding a prop.
- Files: `src/components/pool/three/textures.ts`, `src/components/pool/three/PoolModel.tsx`.
- Acceptance: coping/panel AO visible only in occluded pores/pitting; no
  darkening of direct-lit faces; build + typecheck stay clean.
- Status: READY

## AB-003 — Mosaic anti-tiling
- Problem: mosaic finishes repeat one photographed tile 1:1 in world space
  across large walls; large pools may show an obvious repeating pattern.
- Expected gain: section 10's "prevent obvious repetition" goal.
- Risk: medium — needs a tiling-break technique (e.g. per-repeat rotation/hash
  offset) that doesn't break the existing derived normal/roughness/AO cache
  keyed by source image.
- Files: `src/components/pool/three/PoolModel.tsx`, `src/components/pool/three/textures.ts`.
- Acceptance: visually distinct large-wall render with no regression on small
  pools; no new seams at UV wrap boundaries.
- Status: READY

## AB-000 — Interior liner/mosaic AO — COMPLETE (this session)
- Problem: `InteriorMaterialMaps` declared `aoMap` but nothing produced or
  consumed one; wall/floor PBR was missing ambient occlusion entirely.
- Files: `src/components/pool/three/textures.ts`, `src/components/pool/three/PoolModel.tsx`.
- Acceptance met: real AO derived from each photo's own grout/seam edges
  (falls back to a subtle procedural map when no photo data exists yet);
  `aoMap`/`aoMapIntensity` wired on interior wall+floor materials; indirect
  light only. `tsc --noEmit`, targeted `eslint`, and `npm run build` all pass.
- Status: COMPLETE
