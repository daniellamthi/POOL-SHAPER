# Hero/PDF crop regression — offline verification

Confirmed cause: the former `cleanCapture` fit used the full portrait canvas, then `cropHero` removed its top/bottom to form a 297:150 landscape image. Fitting inside the canvas did not guarantee fitting inside the exported image. The new root-owned `projectBookHeroFrame` is now shared by clean-capture framing and physical-pixel source cropping; ordinary camera framing was not changed by this test work.

Exact C-style fixture: 8×4×1.5 m, above-ground Skimmer, internal corner access, long external stair with extended landing, 430×932 canvas. Actual export source rectangle is x0…430, y357.414…574.586. Former fit projects metric treads down to y589.880 (8 vertices below crop) and the stair/guard envelope to y594.050. Corrected fit projects treads to y553.609 and envelope to y556.227: zero points outside the actual exported area. The short-side fixture also reproduces the former failure and passes the correction.

New test files only: `scripts/hero-capture-framing-audit.ts` and `scripts/run-hero-capture-framing-audit.mjs`.

`node scripts/run-hero-capture-framing-audit.mjs --evidence=docs/qa/evidence/release-readiness-20261020/camera-hero-capture-framing.json`:

- PASS: 14,760 checks, 7,360 projection cases, 410,320 actual tread/landing vertices.
- 3,407 cases clip an external stair envelope or tread under the former full-canvas fit; zero cases clip under the shared export-frame fit. Minimum complete-subject margin after correction: 16.11 CSS px.
- Lengths 3–25 m and widths 2–12 m at every integer metre; depths 0.8/1.15/1.5 m; both valid stair sides; 1440×900, 1440×419, 390×844, 430×932 and 932×430. This samples the domain, not every 0.1 m slider tick. Forty-six size/depth/side combinations have no valid external-stair plan and are explicitly skipped, not counted as successful stair fixtures.
- Projects the complete configured overview subject, real metre-valued tread/landing corners and existing stair/guard envelope through the same local `setViewOffset` semantics as CameraRig. Shared crop homogeneity checked at DPR1/1.25/2/3.
- No browser, renderer-quality change, application source edit, or general build was performed by the regression test. Actual new PDF visual confirmation remains D/root's separate gate.

## Updated isolated task checkpoint

Created a new snapshot at `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/release-task-checkpoint-20261020-BjDT7l`; previous `...-Di1XXi` remains intact. Base 0665d3b, 853 tracked files, 30 task-only overlays (including new hero helper and both audit scripts), 40 manifest paths excluded from overlay. Package links/cache isolation and no `.env`/secret-copy checks retained.

Isolated rerun only: typecheck PASS; production client/SSR/Nitro build PASS; hero framing audit PASS. Prior range/DEV-helper source hashes unchanged, so those audits were not rerun. All original 39 pre-goal WIP file hashes match the preserved manifest before and after; guarded primary hashes and primary Git-status hash are unchanged. Isolated build changed no fingerprinted source.

Portable receipt: `performance-task-checkpoint-hero-verification.json` (source hashes, overlay/exclusion inventory and results only; no log/cache/secret contents). Source-tree SHA-256: `cb24a13ea372dfebf347102e6dc430e3304069206a01d13d9b647dc629da831b`.

This is a source/build/geometric-crop PASS, not live PDF, cloud, performance or overall release-readiness PASS.
