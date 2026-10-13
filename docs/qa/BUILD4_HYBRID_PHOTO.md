# Build 4 — final closeout attempt (2026-10-12)

**FIX REQUIRED — visual gate not passed; no commit/push. All WIP retained.**
This section supersedes older results below. Branch remains
`claude/pool-shaper-build2-project-delivery`, verified HEAD
`31b72d6ec94f2a626eddd0c87e0014f920a05584`.

Implemented this continuation, limited to photo presentation:
- Fixed camera fitting for sparse, opposite-corner runtime bounds; fit the full
  envelope including above-ground access. Lower controlled photographic poses.
- Restored AgX tone mapping for raster photos without the post-processing composer.
- Reduced photo-only paving apron; normal wizard paving/materials unchanged.
- Corrected the outdoor shadow receiver: submerged LED fixtures no longer cast
  a black rectangular shadow footprint across dry photographic grass.
- Indoor metric stone mapping, glazing, lightweight ceiling/relaxation set,
  window/cove lighting and room-only reflection environment. Licensed pool-free
  Simons Town panorama beyond glazing replaces the unsuitable vertical lawn plate.
- Photo-only coastal ground relief projection and controlled lateral camera offset;
  default wizard coastal projection/geometry untouched.
- Preview DPR capped at 1.5 (actual tested DPR 1); requested PNG resolution independent.
  Suspended-tab intervals excluded from settled-frame sampling.

## Current verification

| Gate | Result | Evidence |
|---|---|---|
| Outdoor | FAIL visual | Black footprint removed, but pool/paving still reads as a composite over grass; single plate does not convincingly match all camera elevations |
| Indoor | FAIL visual | No second pool image; room/window/lighting improved, but set remains visibly CG and lighting/contact insufficiently photographic |
| Infinity | FAIL visual | Geometry unchanged; photo projection improved, but deck/rock transition remains evident at frame margins |
| PNG | PASS tested desktop flow | Generated and downloaded `pool-shaper-outdoor-villa-hero-day (1).png`, 1920×708, no wizard overlay; previous Infinity 1920×778 download retained |
| Configuration fidelity | PASS source guard; partial runtime | Same Skimmer A, Infinity B and above-ground C shared snapshots; original-vs-photo captures retained. No project writes or geometry edits this continuation. Full visual matrix not certified |
| Desktop/mobile | PARTIAL | Real 1440×900, 390×844, 430×932 screenshots; no complete all-environment/all-view visual PASS |
| Typecheck | PASS | `npx tsc --noEmit` after correcting uniform index access |
| Build | PASS | `npm run build`, existing chunk-size/plugin warnings only; no deployment |
| Hybrid audit | PASS | 1,451 checks including sparse-bounds, tone mapping, preview budget, dry shadow guards |
| Photo foundation audit | PASS | 3,782 checks; no weakened geometry or access expectations |
| Diff check | PASS | `git diff --check` |
| Performance | PARTIAL measured | Table below; not equivalent-resolution benchmark, no GPU time/memory certification |
| Commit/push | NOT RUN | Required visual gate remains failed |

Actual settled development-browser samples (not benchmark averages):

| Context | Frame ms | DPR | Canvas pixels before DPR | Textures/geometries |
|---|---:|---:|---|---|
| Normal Skimmer A baseline | 15.58–16.17 | 2 | 1406×419 | 32 / 80 |
| Outdoor A before preview cap | 28.83–32.32 | 2 | 1382×576 | 33 / 80 |
| Outdoor A after preview cap | 10.07–11.02 | 1 | 1382×576 | 31 / 79 |
| Indoor A night mobile390 | 11.66 | 1 | 348×261 | 36 / 103 |
| Infinity B day desktop | 12.72 | 1 | 1382×510 | 28 / 59 |
| Indoor C day mobile430 | 8.12 | 1 | 388×291 | 37 / 149 |

Infinity dev counter reported 102 calls; Indoor C reported 289. These counters
can describe different render passes and are **not total multi-pass draw-call
comparisons**. No quantified GPU memory estimate. Lazy environment chunk 254.65 kB
uncompressed / 106.68 kB gzip. One photo scene per dialog, no concurrent wizard canvas.

Evidence directory: `../build4-photo-evidence/`:
- `closeout-skimmer-original.png` (before, normal studio)
- `closeout-outdoor-skimmer-desktop-final.png`
- `closeout-outdoor-skimmer-390.png`
- `closeout-indoor-skimmer-desktop-final.png`
- `closeout-indoor-skimmer-night-390.png`
- `closeout-infinity-desktop.png`
- `closeout-aboveground-original.png`
- `closeout-aboveground-outdoor-desktop.png`
- `closeout-aboveground-indoor-desktop.png`
- `closeout-aboveground-indoor-night-430.png`

Files named `closeout-indoor-skimmer-desktop.png` and
`closeout-outdoor-skimmer-desktop.png` are **intermediate candidates**, not final
evidence. The normal studio reference already exhibits the restrained water
appearance; the approved water shader was inspected but not changed.

Remaining work is visual integration, not backend credentials: calibrated outdoor
ground/plate projection for all three views, less generic indoor set/contact light,
and clean Infinity apron/rock joins. These cannot honestly be counted PASS based
on the successful unit/build checks. No new backend or geometry changes authorized
or performed. Server restarted on 127.0.0.1:3001 after session interruption.

---

# Historical — visual completion continuation (2026-10-12)

**Current status: FIX REQUIRED. Implemented locally, not committed or pushed.**
Remote branch rechecked: `31b72d6ec94f2a626eddd0c87e0014f920a05584`.
All pre-existing geometry/material WIP retained. No backend, deployment or archive changes.

## Current implementation and evidence (supersedes the historical section below)

- Outdoor photo licensed from Max Vakhtbovych / Pexels; no pre-existing pool.
  Provenance in `public/photo-environments/LICENSE.md`. Aspect-preserving crop.
  Day-only control explicitly disabled at night; no fake nocturnal photograph.
- Indoor lightweight stone/wood set, instanced ceiling slats and area lights.
  Neither supplied reference photograph is used as a backplate.
- Explicit environment switches remount the photo-only scene; owned photographs,
  stone clones and instanced geometry are disposed on unmount. No photo environment
  fetches during normal configuration. Default scene behavior is unchanged.
- Fixed initial prototype defects: floating billboard, terrain across basin,
  exposed buried shell, stale Infinity loading mask in other environments.
  Photo ground depth-occluder/shadow receiver preserves the original basin geometry.
- Blob PNG download replaces the data-URL link that timed out in the browser.
  **Native download verified** at
  `/Users/danielelamthi/Downloads/pool-shaper-panorama-infinity-hero-day.png`;
  opened and visually inspected, 1920×778, no interface overlay.
- Mobile photo preview uses a compact 4:3 viewport rather than stretching the room
  vertically. Corrected mobile menu: it now calls the actual Photo Mode toggle,
  not the old preparation action. Added a regression assertion.
- Photo Audit compatibility fixed by checking actual hydro entry treads/landing
  against the excluded Infinity edge. The enlarged hydro basin itself may meet
  the spill edge; standalone and Sun Shelf entries must still remain clear.
  No geometry or access-safety rule was weakened.

| Gate | Current result | Evidence / remaining work |
|---|---|---|
| Outdoor Villa | FAIL final visual gate | Real licensed photo integrated; perspective, scale/contact and three-view calibration still not convincingly photographic |
| Indoor Wellness | FAIL final visual gate | Working lightweight room and Day/Night; room remains too plain/CG-like relative to references |
| Panorama Infinity | FAIL final visual gate | Original geometry preserved; scene join/frontal composition still needs refinement |
| Capture/download | PASS tested flow | Actual PNG generated, downloaded through the visible link and inspected |
| Fidelity | PASS source guard + partial runtime | No project writes; Skimmer 8×4, Infinity 12×5, above-ground with stairs/Pellicano observed; not a complete all-options pixel comparison |
| Mobile | PASS limited smoke, full matrix incomplete | Actual 390/430 captures listed below; old menu defect fixed; not every environment/view/system combination certified |
| Typecheck/build | PASS | `npx tsc --noEmit`, `npm run build`; existing bundle/plugin warnings, no deployment |
| Photo foundation | PASS | 3,782 checks on current WIP after compatibility correction |
| Hybrid camera/source audit | PASS | Final rerun: 1,413 checks including mobile-entry assertion |
| Project configuration | PASS | Existing targeted project-config audit passed this continuation |
| Diff check | PASS | `git diff --check` |
| Performance | MEASURED, NOT a full PASS | Samples below; no GPU-memory instrumentation or matched baseline |
| Project Book integration | NOT COMPLETED | Existing PDF unchanged; photo download is separate |

Runtime observations, dev browser DPR2 (not comparable benchmark averages):
- Infinity day desktop: 17.7 ms/frame, 107 final draw calls, 28 textures, 59 geometries, 171 frames.
- Above-ground Indoor night 430: 23.4 ms/frame, 267 calls, 37 textures, 139 geometries, 129 frames.
- Above-ground Indoor day desktop: 36.4 ms/frame, 267 calls, 38 textures, 136 geometries, 83 frames.
Background tabs, shader compilation and viewport changes can affect these samples.
No GPU time/memory or global leak-free claim. The ceiling uses instancing; final
environment chunk is lazy (~251 kB uncompressed, includes area-light lookup data).

Real captures in `../build4-photo-evidence/`:
- `outdoor-desktop-candidate.png` — intermediate Outdoor composition, not an approved render.
- `infinity-desktop-latest.png` — current panorama and successful capture controls.
- `infinity-mobile390-final-smoke.png` — real 390×844 entry from the corrected mobile menu, dialog and ready capture button verified.
- `skimmer-outdoor-mobile390.png` — earlier tall preview, before compact mobile correction.
- `skimmer-indoor-mobile390-current.png` — corrected compact mobile view.
- `aboveground-outdoor-mobile430.png` — optional staircase/Pellicano retained.
- `aboveground-indoor-night-mobile430.png` — night + actual renderer metrics.
- `aboveground-indoor-desktop.png` — daylight + actual renderer metrics.

Additional scoped files: `HybridEnvironment.tsx`, `DaylightEnvironment.tsx`
(optional photo-only background suppression), `StudioPaving.tsx` (optional
photo-only depth/shadow ground), `photo-foundation-audit.ts`, licensed photo asset.
The user-facing configuration geometry, catalogs and normal camera paths are not changed.

**Release gate remains closed: no commit/push until visual quality and full matrix pass.**

Final rerun after mobile-menu correction: typecheck, production build, 1,413
hybrid checks and diff-check PASS. Photo foundation 3,782 checks and project-config
already passed on this candidate; the menu-only correction does not alter their inputs.

---

## Historical first candidate (before this continuation)

Status: **FIX REQUIRED — not a release, no commit/push**.
Base: `31b72d6ec94f2a626eddd0c87e0014f920a05584`, branch
`claude/pool-shaper-build2-project-delivery`. Pre-existing WIP retained.

## Implemented locally

- Lazy photo dialog only in final Presentation. Replaces the normal Canvas rather
  than keeping two scenes mounted. Reuses the configured PoolScene; no generated pool.
- Raster capture preserves the existing material/shader/cover path rather than the
  legacy path tracer's material substitutions. Configuration is read-only and an
  exact serialized canonical-snapshot guard prevents capture if it changes.
- Three locked camera choices; local Day/Night preview where lighting exists;
  1280/1920/2560-pixel requested width, GPU dimension cap, PNG output without DOM UI.
- Existing Simons Town background only. Villa/Wellness explicitly unavailable;
  there is no fake clickable environment or invented photograph.

## Asset gate

Both supplied Indoor images contain an existing pool. One is a single 1200×800
alpine spa image (also the earlier art-direction master), the other a 1000×1250
stone/wood spa image. They are art-direction references, not empty panoramic plates
or three calibrated views. No Outdoor Villa image was supplied.
No AI generation, paid API, discarded indoor prototype, backend or geometry changes
were used for this candidate.

## Evidence and gates

Evidence folder outside the repository: `../build4-photo-evidence/`.

| Requirement | Result | Evidence / limitation |
|---|---|---|
| Outdoor Villa | BLOCKED | Missing suitable authorized photographic asset set |
| Indoor Wellness | BLOCKED | References contain pool; empty/calibrated environment views missing |
| Panorama Infinity | FAIL visual quality gate | Real scene loads; Hero remains frontal, transition/portrait composition not final premium quality |
| Photo PNG generation | PASS partial | `infinity-day-export.png`, generated raster 1920×778 inspected, no UI overlay |
| Browser download completion | BLOCKED verification | Link clicked; browser download-event capture timed out. PNG bytes recovered from the actual generated download link; not counted as a successful native download |
| Three curated cameras | FAIL full gate | Hero/Raised observed. Initial waterline exposed terrain; corrected near-rim placement and observed at 390. All views/systems not fully calibrated |
| Canonical fidelity | PASS source guard; incomplete visual matrix | Same scene props, original raster materials, no config writes; unchanged source summary after closing/reloading. Full A/B/C visual comparison pending |
| Desktop 1440 | PASS dialog smoke only | `infinity-night-desktop.png`, `infinity-day-raised-desktop.png`; no full environment PASS |
| Mobile 390/430 | PASS dialog smoke only | `infinity-hero-mobile390.png`, `infinity-waterline-mobile390-after.png`, `infinity-hero-mobile430.png`; viewport reset after QA |
| Day/Night | PASS switching smoke | Local preview changes; project remained Night on exit/reload. Not a new calibrated nocturnal photographic plate |
| Environment switching/disposal | BLOCKED full gate | Only existing panorama asset available; no multi-environment runtime comparison |
| Project Book integration | NOT COMPLETED | Existing PDF flow untouched; new image is not wired to Project Book |
| Skimmer 8×4 / Above-ground visual matrix | NOT COMPLETED | Studio bound-fitting unit coverage is not a substitute for these visual tests |
| Performance | MEASURED, gate NOT PASSED | See observations below; no before/after matched baseline or memory-leak proof |
| Typecheck | PASS | `npx tsc --noEmit` |
| Production build | PASS | `npm run build`; existing chunk-size/plugin warnings, no deployment |
| Hybrid targeted audit | PASS | 494 checks; 6×3/8×4/12×5, ground/raised footprints, 3 aspects and 3 studio poses, immutable inputs and source guards |
| Project configuration | PASS | `npm run test:project-config` |
| Existing Photo foundation audit | FAIL on pre-existing WIP | Hydro anchor is now on Infinity edge in existing local geometry changes. Same audit passes 3,782 checks in preserved HEAD snapshot `/private/tmp/pool-top-index-WZwhQe`. Test/geometry not weakened or changed by this task |
| Diff check | PASS | `git diff --check` |

Runtime observations (IAB, same 12×5 Infinity project, DPR2, development build):
night sample 12.7 ms/frame, 102 final-render draw calls, 27 textures, 62 geometries,
236 sampled frames; day sample 23.6 ms/frame, 102 calls, 28 textures, 59 geometries,
128 frames; mobile390 sample 8.3 ms/frame, 102 calls, 28 textures, 59 geometries,
364 frames. These are separate short CPU/RAF observations, not benchmark averages,
GPU timings, all-pass draw-call totals or evidence of a performance improvement.
GPU memory/time unavailable. No global performance PASS.

## Files in this candidate

`PoolConfigurator.tsx`, `PoolViewport.tsx`, `three/PoolScene.tsx`,
`HybridPhotoStudio.tsx`, `three/HybridPhotoController.tsx`, `lib/pool/hybrid-photo.ts`,
`scripts/hybrid-photo-audit.ts`, `scripts/run-hybrid-photo-audit.mjs`, this report.
All other dirty files predate this work and remain out of scope.

Next gate: obtain usable authorized Outdoor/Indoor environment plates (or agree
explicitly on a background-editing workflow), complete calibrated views/visual
matrix, resolve the pre-existing Photo Spec/geometry expectation separately,
verify native download and matched performance before committing this candidate.
