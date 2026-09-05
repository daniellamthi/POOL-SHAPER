# Autonomous backlog

Statuses: READY, IN_PROGRESS, BLOCKED, COMPLETE.

## AUTO-001
- Problem: `scripts/geometry-audit.ts` asserted a camera-target invariant
  that is mathematically impossible for the current (correct) interior-
  finish camera model, so the geometry audit threw on the first case and
  had never run to completion.
- Evidence: `npm run test:geometry` failed with `rectangle-10x4.5/in-ground:
  Interior Finish changed the reference wall target` before this session's
  fix.
- Expected gain: restores a real, working regression safety net across 108
  shape/dimension/system cases and 72 camera poses; prevents future camera
  changes from silently shipping broken framing.
- Risk: low (test-only change; no production camera code touched).
- Files: `scripts/geometry-audit.ts`.
- Acceptance criteria: `npm run test:geometry` passes; `npx tsc --noEmit`,
  `npm run lint` (no new errors vs. baseline), `npm run build` all succeed.
- Status: COMPLETE.

## AUTO-002
- Problem: `docs/IMPROVEMENT_ROADMAP.md` and `docs/VISUAL_REALISM_MAP.md`
  describe several gaps (curve-aware offsets, per-color PBR derivation,
  water optics) that appear to already be implemented in code, based on
  this session's spot check of `src/lib/pool/geometry.ts` (real polygon
  offset with miter joins + loop cleanup) and `src/components/pool/three/
  textures.ts` (photo-derived normal/roughness, triplanar procedural stone/
  panel maps, dual-scale ripple normals).
- Evidence: read `offsetOutline`/`rawOffsetOutline`/`removeOffsetLoops` in
  `geometry.ts:307-390` and `getDerivedDetailMaps`/
  `createTriplanarDetailMaps` in `textures.ts`.
- Expected gain: prevents future sessions from re-implementing (churning)
  work that already exists, and redirects effort to genuine gaps.
- Risk: none (audit only).
- Files: `docs/IMPROVEMENT_ROADMAP.md`, `docs/VISUAL_REALISM_MAP.md`.
- Acceptance criteria: roadmap docs updated to reflect actual implementation
  status per item, with real remaining gaps re-prioritized.
- Status: READY.

## AUTO-003
- Problem: no automated visual-regression harness exists (deterministic
  screenshots per camera intent / material / pool shape) despite the
  camera system now being numerically proven stable (AUTO-001).
- Evidence: `docs/VISUAL_REALISM_MAP.md` roadmap item 1 ("Establish visual
  reference shots and automated screenshots") still unaddressed; no
  screenshot script found under `scripts/`.
- Expected gain: catches texture/UV/material regressions that numeric
  geometry checks cannot (per Section 29 of the product brief: broken UVs,
  texture stretching, z-fighting, wrong waterline, black materials, etc.).
- Risk: medium complexity (needs a running dev server + Playwright
  automation of the 3D canvas — timing/readiness matters for WebGL canvases).
- Files: new `scripts/visual-audit.mjs` (or similar), reusing the `run`
  skill's launch patterns; Playwright/Chromium already available in this
  environment.
- Acceptance criteria: script produces PNG screenshots for at minimum the
  reference-view list in product brief Section 29 (rectangle/skimmer,
  rectangle/overflow, custom pool, each liner color, mosaic, coping
  close-up, skimmer variants, overflow close-up, water close-up); committed
  as baseline images or compared against a stored baseline.
- Status: READY.

## AUTO-004
- Problem: `ACTIVE_RENDERING_QUALITY` (`src/configurator/3d/scene/
  visual-preset.ts`) — the single source of truth for DPR, shadow-map size,
  postprocessing, planar reflections and anisotropy across `PoolScene.tsx`,
  `PoolModel.tsx` and `WaterSurfaceMaterial.tsx` — was hardcoded to the
  `experience` (highest, desktop-class) tier for every visitor, with a
  comment admitting it was "Temporarily set to Experience for live visual
  verification in the browser." The lighter `configuration` tier the preset
  system already defines was dead code: nothing ever selected it. This
  directly contradicts product-brief Section 24 (mobile is first-class,
  "quality automatically scales") and Section 28 (automatic quality tier).
- Evidence: `grep -rn ACTIVE_RENDERING_QUALITY src` showed only the
  hardcoded module export; no `isMobile`/`matchMedia`/GPU-tier signal fed
  into it anywhere in the 3D scene path.
- Expected gain: real mobile/low-power-device FPS improvement (lighter
  shadow maps, no forced 2x DPR, no planar reflection/postprocessing) with
  zero desktop visual change, since desktop still resolves to `experience`.
- Risk: low — single-file change, no consumer files touched, preset
  *values* untouched (only which preset gets selected).
- Files: `src/configurator/3d/scene/visual-preset.ts`.
- Acceptance criteria: `npx tsc --noEmit`, `npm run lint` (no new errors),
  `npm run build`, `npm run test:geometry` all pass; manual smoke test
  (Playwright + the pre-installed Chromium, since `chromium-cli` isn't
  available in this environment) confirms the 3D pool renders correctly at
  both a 1440x900 desktop viewport and a 390x844 touch/mobile viewport with
  no console errors and no black canvas.
- Status: COMPLETE.
