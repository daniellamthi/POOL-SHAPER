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
STATUS: FIXED (AUTO-010 close-up validation passed this session).
VERIFICATION: `tsc --noEmit`, `test:geometry` 108/108, `lint`, `build`, Playwright smoke (default step, no console errors/black canvas), plus dedicated Liner/Mosaic close-up screenshots (`test-baselines/visual/liner-closeup.png`, `mosaic-closeup.png`) isolating the AO effect: subtle indirect darkening at Mosaic grout lines, subtle embossing-level variation on the grout-free Liner, no direct-light darkening, no artifacts.

## AUTO-011
CATEGORY: BUILD
SEVERITY: LOW
PROBLEM: `npm run preview` (`vite preview`) fails with a 500 error — "Cannot find module `dist/server/server.js`" — instead of serving the production build.
EVIDENCE: reproduced running `npx vite preview --host 127.0.0.1 --port <n>` after a clean `npm run build`; the app's actual build output goes to `.output/` via Nitro's `cloudflare-module` preset, but TanStack Start's `vite preview` plugin expects a `dist/server/server.js` layout instead. Found while building `scripts/visual-audit.mjs` (AUTO-009), which uses `vite dev` as a workaround.
REPRODUCTION: `npm run build && npm run preview`, then request the URL it prints.
EXPECTED BEHAVIOR: `npm run preview` serves the actual production build (or the script should be pointed at a working equivalent, e.g. `wrangler dev`/`nitro preview` for the `cloudflare-module` preset).
AFFECTED FILES: `vite.config.ts` / TanStack Start preview-plugin configuration (not yet root-caused further); `package.json` `preview` script.
RISK: Low — does not affect `dev` or `build`, only local preview of the production bundle.
STATUS: READY (not fixed this session — out of scope for AUTO-009; `scripts/visual-audit.mjs` uses `vite dev` instead, documented in its header comment).

## AUTO-012
CATEGORY: ACCESSIBILITY
SEVERITY: LOW
PROBLEM: `CameraRig` (`src/components/pool/three/PoolScene.tsx`) always animates camera-pose transitions over ~0.78-0.88s; it does not check `prefers-reduced-motion` at all (directive §53 requires it). `IntroVeil`'s own comment (`PoolConfigurator.tsx`) claims "the global reduced-motion rule in styles.css collapses every animation/transition duration to ~0", but that CSS rule only affects CSS transitions/animations (the veil itself), not this JS-driven Three.js camera lerp — a genuinely different mechanism the comment doesn't distinguish.
EVIDENCE: read `CameraRig`'s transition effect/`useFrame` (no `matchMedia`/`prefers-reduced-motion` reference anywhere in the file or in `src/lib/pool/camera.ts`); confirmed by observing every wizard-step camera move animate in this session's screenshots regardless of any reduced-motion emulation.
REPRODUCTION: enable OS/browser "reduce motion", change any wizard step that changes `cameraFocus` — the camera still flies instead of snapping instantly.
EXPECTED BEHAVIOR: when `prefers-reduced-motion: reduce` is active, `CameraRig` should set the camera to the goal pose immediately (duration ~0), consistent with `IntroVeil`'s intent for the rest of the app.
AFFECTED FILES: `src/components/pool/three/PoolScene.tsx` (`CameraRig`).
RISK: Low — additive accessibility check only, default (no-preference) behavior unchanged.
STATUS: FIXED — `CameraRig`'s pose effect now reads `window.matchMedia("(prefers-reduced-motion: reduce)")` and sets `duration.current = 0` when active, snapping to the goal pose on the next rendered frame instead of flying.
VERIFICATION: `tsc --noEmit` clean, `npm run test:geometry` 108/108 (camera pose math unchanged, only transition duration), `npm run lint` (86 problems, baseline unchanged). Visual: with `page.emulateMedia({ reducedMotion: "reduce" })`, the Interior Finish step's Liner close-up framing was reached in a 3s wait (vs. requiring ~45s without it in this sandbox's slow renderer, per `AUTO-009`/`AUTO-010`'s `settleCameraFlight`) — confirms the snap takes effect within a frame or two rather than the full eased flight.

## AUTO-013
CATEGORY: VISUAL
SEVERITY: LOW
PROBLEM: The `AUTO-009` harness's `landing-desktop` baseline (captured in a prior session's sandbox) shows a consistent ~1.07% pixel diff (`13,860`/1,296,000 px) against a fresh capture in this session's sandbox, reproduced identically across two independent re-runs here (1.070%, 1.069%) — i.e. deterministic *within* a given sandbox instance, but not stable *across* different sandbox instances/Chromium builds.
EVIDENCE: `landing-desktop.diff.png` shows the diff concentrated entirely along thin edges — coping/wall outlines, dimension-guide lines, the skimmer icon outline — with zero diff across filled regions (floor/wall/water colour matches exactly); consistent with a sub-pixel anti-aliasing/edge-rasterization difference between Chromium/SwiftShader builds across sandbox instances, not a content or colour regression. No product or test code affecting `landing-desktop`'s scene was touched this session.
REPRODUCTION: run `npm run test:visual` in a different sandbox instance than the one that last wrote `test-baselines/visual/landing-desktop.png`.
EXPECTED BEHAVIOR: none changed — this is a limitation of pixel-exact screenshot comparison across heterogeneous CI/sandbox environments, not a product defect. Documented so a future session doesn't mistake this specific, edge-only diff pattern for a real regression.
AFFECTED FILES: none (harness/environment characteristic, not a code path).
UPDATE (2026-09-06): hypothesis confirmed with a clean control case. In the same cross-sandbox run that showed `landing-desktop` at 13,861/1,296,000 px (1.070%, matching the 13,860 recorded above), `liner-closeup` compared **0/1,296,000 px (0.000%)** — pixel-exact against a baseline captured in a *different* sandbox. The distinguishing factor is edge density, not sandbox identity: `landing-desktop` is full of thin high-contrast geometry (dimension guides, coping outlines, text glyphs) while `liner-closeup` is a near-flat material surface. So the harness IS reliable cross-sandbox for exactly the close-up material references used for §103 material validation, and only edge-dense wide shots carry this noise floor. Practical rule: treat a non-zero diff on a close-up reference as a real regression; on `landing-desktop`, check the diff *pattern* is edge-only before dismissing it.
RISK: None to product code. Low risk to the harness's usefulness: a future *real* regression that also only touches edge pixels could be masked by this same pattern — if `landing-desktop` diff ratio or pattern changes noticeably from this session's recorded baseline (edge-only, ~1.07%), treat it as suspect and re-diff by content region rather than assuming environment noise again.
STATUS: READY (no fix planned — documented limitation; consider a higher `DIFF_THRESHOLD_RATIO` or a perceptual/edge-tolerant diff mode in a future `AUTO-009` iteration if this keeps causing false failures across sandboxes).

## AUTO-014
CATEGORY: RUNTIME
SEVERITY: LOW
PROBLEM: Every page load emitted a console 404. Root cause: `src/routes/__root.tsx` declared `{ rel: "icon", href: "/favicon.ico", type: "image/x-icon" }`, but `public/` ships `favicon.png` only — there is no `.ico` file. Result: a broken/generic browser-tab icon plus a failed request on every visit.
EVIDENCE: the 404 appeared in this session's Playwright smoke test and in every `npm run test:visual` run ("[warn] landing-desktop: 1 console error(s): Failed to load resource: the server responded with a status of 404"). Root-caused by diffing the assets referenced from `__root.tsx` against the contents of `public/` — no browser run needed.
EXPECTED BEHAVIOR: the declared icon resolves; no failed request; the real brand mark shows in the tab.
AFFECTED FILES: `src/routes/__root.tsx`.
RISK: Low — one link tag; PNG favicons are supported by every current browser.
STATUS: FIXED (pointed at `/favicon.png` with `type: "image/png"`).
VERIFICATION: `tsc --noEmit`, `test:geometry` 108/108, `lint` (baseline unchanged), `build` all clean; `npm run test:visual` no longer reports the console error (see AUTO-015 note).

## AUTO-015
CATEGORY: PERFORMANCE
SEVERITY: LOW
PROBLEM: `public/textures/pvc-liner/` shipped 7 superseded legacy liner textures (`antracite`, `azzurro-blu`, `azzurro-celeste`, `bianco`, `grigio`, `nero`, `verde-caraibi` — 12 MB total) alongside the 6 `motion-*` files the catalogue actually uses. Everything under `public/` is served/deployed verbatim, so this was 12 MB of dead payload.
EVIDENCE: each filename grepped across `src/` and `scripts/` returned 0 references (the single apparent `nero` hit was the substring inside "generously" in a code comment). `INTERIOR_TEXTURES.liner` references only the six `motion-*.png` assets.
EXPECTED BEHAVIOR: only catalogue assets ship.
AFFECTED FILES: `public/textures/pvc-liner/*` (7 files removed; `public/textures/` 61 MB -> 49 MB).
RISK: Low and fully reversible — files remain in git history (`git revert` or `git checkout <sha>^ -- <path>` restores them). No code path referenced them.
STATUS: FIXED.
VERIFICATION: `tsc --noEmit`, `test:geometry` 108/108, `lint` (baseline unchanged), `build` clean; visual audit confirms the liner still renders (assets removed were never referenced).

## AUTO-016
CATEGORY: MATERIAL
SEVERITY: N/A — INVESTIGATED, NO ACTION REQUIRED
PROBLEM (hypothesis under test): directive §28 / P2 item 13 anticipated that mosaic finishes would expose "obvious repeated modules" on large walls, requiring an anti-tiling implementation. On a 10 x 4.5 m pool the mosaic module (0.2 m) repeats ~145x along the wall perimeter and 50x across the floor, so the concern was well founded a priori.
EVIDENCE (measured, not assumed): both shipped mosaic artworks were tiled 4x4 offline from the real assets and inspected — `23DD3311...` (pale grey/white blend) and `3470EA07...` (teal). Both tile **seamlessly**: no seam, no discontinuity, no luminance step at module boundaries. Neither shows a detectable repeating tessera "constellation": the teal artwork's tesserae are near-uniform in colour (nothing distinctive to repeat), and the pale artwork's variation is too low-contrast to read as a pattern. Reproduce with the 4x4 tiling check described in `docs/AUTONOMOUS_DECISIONS.md`.
CONCLUSION: implementing stochastic/hex-grid anti-tiling would add real shader and GPU cost, and would put §28's own constraints at risk (pattern identity, grout-line continuity, wall/floor continuity), in exchange for no demonstrable visual gain on any currently shipped asset. Per §111 ("if unclear, do not implement") and §108 (no useless churn), NOT implemented.
RE-OPEN IF: a future mosaic asset ships with high-contrast or strongly non-uniform tesserae (a distinctive constellation, a blend/gradient artwork, or a directional pattern), or if the mosaic module size is reduced enough to raise the repeat count sharply. Re-run the 4x4 tiling check on the new asset before assuming a gap exists.
STATUS: CLOSED (verified, no defect).
