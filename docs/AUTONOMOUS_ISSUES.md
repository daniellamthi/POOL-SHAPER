# Autonomous Issue Registry

## AUTO-001
CATEGORY: INSTALL
SEVERITY: HIGH
PROBLEM: `npm ci` failed with `ERR_MODULE_NOT_FOUND` / lockfile-drift error: `package-lock.json` was missing the `node_modules/nitro/node_modules/lru-cache` entry that `npm install` resolves for the `nitro` dependency tree.
EVIDENCE: `npm ci` failed on a clean checkout of `4cddd3f` with "Missing: lru-cache@11.5.2 from lock file". Confirmed the only genuine missing entry (other diff from a full `npm install` was npm-version `libc` metadata noise from local npm 10.9.7, deliberately not committed).
REPRODUCTION: fresh clone/`npm ci` at `4cddd3f`.
EXPECTED BEHAVIOR: `npm ci` succeeds on a clean checkout.
AFFECTED FILES: `package-lock.json`.
RISK: Low (additive lockfile entry only).
STATUS: FIXED.
VERIFICATION: `rm -rf node_modules && npm ci` succeeds; `npm run build` clean.

## AUTO-002
CATEGORY: GEOMETRY
SEVERITY: MEDIUM
PROBLEM: `npm run test:geometry` failed on `rectangle-10x4.5/in-ground` ("Interior Finish changed the reference wall target"). Root cause: `getInteriorFinishCamera` (`src/lib/pool/camera.ts`) intentionally targets a point ON the reference wall for Liner/Mosaic (close, perpendicular material view) instead of the pool's bounds centre, and gives Mosaic a tighter distance than Liner — but `scripts/geometry-audit.ts` still asserted the old "target equals bounds centre" / "Mosaic pose exactly equals Liner pose" invariants.
EVIDENCE: Reproduced on `4cddd3f` before any edits. Same root cause independently identified and fixed on 5 historical `zen-cannon-*` branches (0akmda, 46nie6, srr1xc, w0go78, xkrtvq) — ported the `w0go78` (`9267fc4`) version verbatim onto this branch.
REPRODUCTION: `npm run test:geometry` at `4cddd3f`.
EXPECTED BEHAVIOR: audit invariants match the intentional camera design — Liner's target lies on the reference wall (tangentially centred like the master view); Mosaic shares Liner's target only, not its distance.
AFFECTED FILES: `scripts/geometry-audit.ts` only — no product code changed.
RISK: Low (test-only change; verified against intentional, unmodified camera behavior).
STATUS: FIXED.
VERIFICATION: `npm run test:geometry` passes all 108 cases; `npx tsc --noEmit`, `npm run lint` (baseline unchanged), `npm run build` all clean.

## AUTO-003
CATEGORY: RESILIENCE
SEVERITY: LOW
PROBLEM: `npm run lint` reports 90 pre-existing problems (82 `prettier/prettier` formatting errors concentrated in a couple of files, plus a `react-refresh/only-export-components` warning in `src/lib/theme.tsx`). Confirmed identical before/after this session's changes (baseline, not a regression).
EVIDENCE: `git stash` back to `4cddd3f` → `npm run lint` reports the same 90 problems.
EXPECTED BEHAVIOR: canonical lint baseline should trend toward zero; low-value formatting noise should not block higher-value work.
AFFECTED FILES: not yet identified precisely (see lint output; largely one file with an 45+ line prettier-indentation block, plus `src/lib/pool/camera.ts:183` and `src/lib/theme.tsx:40`).
RISK: Low — cosmetic only, 82/90 are auto-fixable with `--fix`.
STATUS: READY (low priority; not blocking roadmap work per LC-24 error triage — batch-fix opportunistically). UPDATE: count is now 86/78 after AUTO-005/consolidation ports — `d9535f6`'s own `--fix` reflow of `Skimmers.tsx` incidentally cleared 4 of the 82 prettier errors; not a regression.

## AUTO-005
CATEGORY: PERFORMANCE
SEVERITY: LOW
PROBLEM: `ACTIVE_RENDERING_QUALITY` was hardcoded to the "experience" (highest, desktop-class) tier for every visitor regardless of device capability, per a leftover "temporarily set for live visual verification" comment — 4K shadow maps, 2x DPR, planar reflections and postprocessing shipped to mobile/low-power devices unconditionally.
EVIDENCE: two independent historical branches (`zen-cannon-0akmda` `cbe2b2b`, `zen-cannon-w0go78` `a86d4a5`) found and fixed this identically; reproduced on canonical (`grep ACTIVE_RENDERING_QUALITY` showed `.experience` hardcoded, unconditional).
REPRODUCTION: read `src/configurator/3d/scene/visual-preset.ts` before this fix.
EXPECTED BEHAVIOR: capable desktops keep "experience"; touch/small-viewport/low-core/low-memory devices resolve to the lighter "configuration" tier automatically.
AFFECTED FILES: `src/configurator/3d/scene/visual-preset.ts`.
RISK: Low — same exported constant, no downstream API change; only which preset is selected.
STATUS: FIXED (ported `cbe2b2b`, the more evidenced of the two independent implementations — see `docs/POOL_ARCHITECT_MASTER_AUDIT.md` conflict-resolution notes).
VERIFICATION: `tsc --noEmit`, `test:geometry` 108/108, `lint` (baseline unchanged), `build`, Playwright smoke (1440×900, no console errors, no black canvas).

## AUTO-006
CATEGORY: PERFORMANCE
SEVERITY: LOW
PROBLEM: (a) `createMaterialMicroNormalMap`/`createMaterialMicroRoughnessMap`/`createContactAOGradientMap` regenerated an identical per-pixel canvas at every independent mount site (PoolScene, Skimmers, PoolModel, ExternalStaircase); (b) the skimmer frame material (identical color/roughness/normal+roughness maps at every position) was rebuilt via a JSX helper called at 8 spots inside `SkimmerAssembly`, so R3F allocated a fresh `MeshPhysicalMaterial` per skimmer position.
EVIDENCE: `zen-cannon-6rp4js` commits `eca3e91` and `d9535f6`; reproduced by reading `src/components/pool/three/textures.ts` and `Skimmers.tsx` before the fix.
EXPECTED BEHAVIOR: one cached template canvas per size (cloned per call site, so per-instance repeat/anisotropy/dispose still work) and one memoized skimmer frame material shared via `<primitive attach="material">`; visual output unchanged.
AFFECTED FILES: `src/components/pool/three/textures.ts`, `src/components/pool/three/Skimmers.tsx`.
RISK: Low — purely additive caching/sharing, properties were already identical across instances.
STATUS: FIXED (ported `eca3e91` and `d9535f6` verbatim).
VERIFICATION: `tsc --noEmit`, `test:geometry` 108/108, `lint` (problem count dropped 90→86, from the patch's own `--fix` reflow — not a regression), `build`.

## AUTO-007
CATEGORY: MATERIAL
SEVERITY: LOW
PROBLEM: Interior wall/floor liner/mosaic finishes had derived normal/roughness detail (from the existing Sobel-edge pipeline over each finish's own photographed texture) but no ambient-occlusion term — grout joints/print seams received no extra indirect-light darkening.
EVIDENCE: `zen-cannon-voutw6` commit `70f0d0c`, extending the existing `getDerivedDetailMaps` pipeline in `textures.ts`.
EXPECTED BEHAVIOR: an `aoMap` derived from the same Sobel signal (plus a `createMaterialMicroAoMap` procedural fallback for finishes without usable photo data), wired onto the interior wall/floor `MeshPhysicalMaterial`s' `aoMap`/`aoMapIntensity`. Three.js applies `aoMap` only to indirect diffuse/specular — direct lighting and base colour untouched.
AFFECTED FILES: `src/components/pool/three/textures.ts`, `src/components/pool/three/PoolModel.tsx`.
RISK: Low — indirect-light-only, reuses an already-shipped derivation technique and the existing `cloneDataTexture` repeat/anisotropy path.
STATUS: IN_PROGRESS (code ported verbatim, applied cleanly on top of AUTO-006's `textures.ts` changes; not FIXED/VERIFIED — the §103 material-change close-up validation below is outstanding).
VERIFICATION: `tsc --noEmit`, `test:geometry` 108/108, `lint`, `build`, Playwright smoke (default step, no console errors/black canvas). NOT YET DONE: a dedicated Liner/Mosaic close-up screenshot isolating the AO effect — tracked as `AUTO-010` in `docs/AUTONOMOUS_BACKLOG.md` (deterministic visual-regression infra doesn't exist yet to do this cheaply).
