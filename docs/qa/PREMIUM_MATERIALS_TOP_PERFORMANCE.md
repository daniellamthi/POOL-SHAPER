# Premium materials, architectural plan and performance — 2026-10-19

Candidate: `feat/fullscreen-day-night-hidden-overflow`, starting HEAD
`b40924f7d1f6e61d79c5f586ec007dc3a33bf2de` (origin verified equal).
Existing WIP remains part of the candidate, not a clean historical baseline.
Pre-change backup: `pool-shaper-wip-backups/residual-gates-20261015-qbqN7t`
(53 files, credential scan PASS). No reset, checkout, merge or deployment.

## Requirements and evidence

Statuses remain NOT VERIFIED until the stated evidence exists. Automated
coverage does not imply visual approval or physical-product certification.

| ID | Owner | Requirement / acceptance | Verification | Final evidence / status |
| --- | --- | --- | --- | --- |
| M01 | Materials/root | Eight supplied references available independently as coping and paving for compatible in-ground pools | Catalog + actual selector/3D for each | PASS — 16 desktop selections and all eight paired mobile selections on both requested viewports; 72 system/size/reference contract scenarios |
| M02 | Materials | Identity and colour retained; no invented commercial name or measured PBR channels | Reference comparison + provenance | PASS for qualitative identity in sampled views. Owner requested provisional Finitura 1–8 / Finish 1–8; no commercial identity or measured PBR certification claimed |
| M03 | Materials/root | Metric UV, undistorted veins, deterministic non-mirrored variation | Texture/geometry tests + close-ups | PASS — metric/source projection audit and independent settled close-ups; no measured product specification claimed |
| M04 | Root | Modular stone slabs and longitudinal Ipè boards, fine joints | Geometry dimensions + browser | PASS — 66 actual module-geometry cases and visible longitudinal boards / fine joints |
| M05 | Root | Coping/paving independent; format change preserves material | Reducer/config tests + browser | PASS — actual independent controls plus configuration/persistence contracts |
| T01 | Plan | Perpendicular orthographic automatic framing | Projection tests + desktop/mobile | PASS — orthographic DOM evidence, centred overflow regression and Infinity 1440/390/430 retest |
| T02 | Plan | Primary/secondary continuous antialiased construction contours, no mesh diagonals, doubled lines or flicker | T-junction/dedup tests + runtime | Geometry/centering PASS. Fine-pixel JPEG attribution inconclusive; owner explicitly confirmed actual on-screen “Contorni continui” on 19 October. No speculative rasterization patch applied |
| T03 | Plan | Individual straight/radial treads, shelf, bench/hydro, overflow/grille/Infinity readable from actual geometry | Actual geometry matrix + screenshots | PASS — 3,393 plan checks and targeted actual stair/shelf/hydro A/B/hidden/grille/traditional/glass captures; owner real-display line confirmation |
| T04 | Plan/root | Water/materials/config retained; contours absent in photographic exports | Config comparison + Photo Mode | PASS — no pool vertices/state changed, actual PDF photographs omit contours; plan-only backdrop does not remove IBL or change perspective/Photo Mode |
| P01 | Performance | Three bounded before/after runs, same renderer/configuration/camera, warmed assets | Median/p95 frame time, calls, renderer, interactions | PASS scoped to three matched desktop pairs below: no consistent regression in the unchanged configuration. New Ipè absolute desktop samples recorded; unmatched DPR/mobile-hardware comparisons are explicitly excluded |
| P02 | Performance/root | Fix only demonstrated reload/rebuild/transition/resource causes; no chosen-detail reduction | Measurement + targeted regression | PASS scoped — material-only switches 8 unnecessary paving rebuilds → 0; finite shared photo cache and owned clone disposal; same chosen geometry/detail |
| I01 | Root/reviewer | New finishes actually applied; Continue/Back/panel and selections persist | Browser paths + state tests | PASS — actual finish selections, 20 real navigation cycles; no panel or selection reset |
| I02 | Root/reviewer | Save/Reload/Share, summary/PDF/quote contain finish and format | Serialization/export + browser | Cloud Save Copy/Reload/Share/readonly and actual seven-page PDF PASS for Finish 6; all references covered by local delivery contracts. Browser quote required-field validation PASS; no real quote/email submitted |
| I03 | Root/reviewer | Italian/English labels and language switch preserve technical state | Translation/state + browser | PASS — independent navigation replay plus saved Finish 6 IT→EN→IT stays Saved, with numbered names and unchanged configuration |
| I04 | Root | Old projects valid and all liner code/appearance unchanged | Source guard + resolved-material comparison + visual | PASS — 48 exact approved liner descriptor comparisons, unchanged liner resolver block, old cloud project reopens; material shader edits scoped to new references |
| I05 | Root | Above-ground unchanged; reference choices unavailable there | Catalog/config/render guards + regression | PASS — exact legacy catalog/config/material guards and invalid-reference fallback; above-ground geometry retained |
| Q01 | Independent reviewer | Actual browser review of all 8 finishes and plan, Infinity unchanged | Desktop1440×900; mobile390×844/430×932 (emulated) | PASS for documented representative views — all eight actual selections on all three viewports; targeted Infinity top/perspective restoration retest; limits below remain explicit |
| Q02 | Root | Typecheck, production build, geometry/material/plan/persistence/export and diff checks | Commands + results | PASS — typecheck/build, 2,358 material + 5,054 integration; final operational plan 3,396 / isolated scoped plan 3,387 plus 362 architecture checks; diff-check; earlier project-config/persistence/export-guard passed |
| Q03 | Root | Screenshots before/after at matching size/camera; visible integrated preview | Real captures + paths | PASS — matched paired performance captures, top before/after and settled material close-ups; latest numeric catalogue visible in integrated preview |
| D01 | Root | Commit/push only after mandatory gates pass; source/remote SHA verified | Git output, no merge/deploy | PASS — implementation 2fa838cdcf66c3451b2684b0b7a98d304fb6238c pushed to the same feature branch; local/remote SHA equal. Earlier WIP retained locally; no merge or manual deploy |

## Scope protections

No backend/Supabase changes, liner edits, above-ground redesign, new environments,
or pool/comfort/access geometry changes. New finish physical dimensions describe
the visualization unless a source explicitly documents a supplied product size.

## Evidence checkpoint — 19 October 2026

Evidence directory (outside Git, no credentials):
`/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/goal-20261018/`.

- M01/M05: independent actual UI retest selected all eight finishes as coping
  and paving, 16 settled captures `independent-final/final-{coping,paving}-{1..8}-1440.png`.
  Actual selection and independent controls verified; these are **not** an
  eight-finish colour-fidelity approval. The earlier rapid 16 captures were
  superseded because they sometimes captured the previous paint.
- M02/M03/M04: original JPEG checksums retained, no generated colour/normal
  scans or mirrored sampler. Metric modules, longitudinal boards and crop
  safety covered by the targeted audits. Ipè source sampling was first too
  pale and included a photographed seam; safe photographic board selection
  was corrected. The latest representative board is from the same original
  photograph, not recoloured. PBR calibration is still under visual review.
- T02/T03: the outline extractor incorrectly discarded valid very thin
  triangles on curved treads. Corrected the squared-normal degeneracy
  threshold, without changing pool/stair vertices or water. Audit now covers
  all six complete arcs in four orientations: 3,390 checks PASS, plus 362
  existing architectural checks. Independent 430 viewport retest confirms
  continuous arcs; desktop construction-phase rendering remains to recheck.
- T01: the reviewer reproduced desktop horizontal offsets (Skimmer +77 px;
  overflow approximately −167 px) despite an actual 1440-pixel canvas.
  Subject aspect alone did not fix this. The latest top-only camera change
  centres the measured free width on the canvas while retaining vertical
  clearance. Independent retest now PASS for the reproduced overflow case:
  `final-centered-top-grille-1440.png`, x178…1263, centre720 on canvas1440;
  `final-centered-top-grille-430.png`, whole pool and continuous curves visible.
  Other top configurations retain their outstanding coverage. No
  Hero/Infinity/detail camera preset was changed by this goal.
- I01/I03: independent reviewer ran 20 actual Continue/Back cycles (10 desktop,
  five 390, five 430) and IT→EN→IT without selection, format or panel-state
  reset: `independent/navigation-cycles.json`. Mobile sizes are emulated,
  not real-phone hardware. Source HMR reloads during implementation are
  excluded from customer-navigation claims.
- I02/I04/I05: local integration audit PASS: 72 size/system/reference scenarios,
  198 MemoryProjectStore save/share/copy/quote-validation cases, 16 real
  seven-page PDFs using explicitly synthetic fixture images, 48 exact approved
  liner descriptor comparisons, 66 actual module-geometry cases; 5,054 checks.
  Above-ground legacy catalogues/configuration/material descriptors compared
  exactly with b40924f. **These are local contracts, not live cloud evidence.**
  Actual browser save/share/PDF/quote for the new finishes is still pending.
- Q02: typecheck, production build, material audit, integration audit,
  architectural audit, project-config, persistence, export-guard and diff-check
  passed before the latest matte-Ipè adjustment. Rerun affected checks after
  visual freeze. The material audit changed from 3,574 to 2,334 checks because
  the safely sampled card rectangle is now smaller; this is not deleted
  requirement coverage. Existing unrelated historical whole-scene hash tests
  are not represented as passing by this report.
- Q03: actual integrated preview remains available on port 3003. Screenshots
  supplied by the browser are JPEG bytes even where an older capture filename
  ends in `.png`; new captures use `.jpg`. No screenshot count is substituted
  for requirement coverage.
- D01: no commit or push: mandatory visual and remaining integration gates
  are still open. All WIP preserved; no merge, deployment or backend change.

## Controlled performance comparison

Baseline: isolated detached b40924f checkout overlaid with the exact pre-goal
53-file WIP backup `qbqN7t`; only identical DEV measurement instrumentation
added. Candidate checkout was never reset or replaced. Separate servers
3004/3003; same integrated browser/tab, 1440×900, DPR 1, actual Apple M1 Pro
ANGLE Metal renderer. The independent reviewer navigated its test tab to
`about:blank` before measurement. No build/profiler ran during collection.

Both load the identical read-only `PW-M53F-P7KM28` cloud project: 8×4 Skimmer,
Sand Beach liner, Prun coping, Gres 60×120, daylight, review camera, voluntarily
collapsed panel. No save or cloud mutation was performed.

| Pair | Baseline median ms | Candidate median ms | Baseline p95 ms | Candidate p95 ms |
| --- | ---: | ---: | ---: | ---: |
| 1 | 14.7 | 14.8 | 17.0 | 18.5 |
| 2 | 15.0 | 15.0 | 18.6 | 18.1 |
| 3 | 15.2 | 15.2 | 19.2 | 18.8 |

Each result uses the final three recorded two-second windows per run: median
of window medians and maximum window p95, **not pooled raw-frame percentiles**.
Normal-pass calls remain 137, triangles 45,462; occasional 6-call reflection
pass demonstrates why `gl.info` is not a full-frame draw-call sum. Candidate
geometry count 80 vs baseline 81; textures 32 vs baseline 34–35. GPU memory
bytes are unavailable. Small timing differences do not establish an FPS gain;
no consistent regression is shown for this exact legacy configuration.
Raw logs, viewport proof, matching captures and selection method are in
`paired-*.json/.jpg` and `paired-performance-summary.json`.

Separately, the same three equal-format material selections previously caused
eight recorded paving rebuilds (3,648 vertices, 2.3–3.9 ms each, including
StrictMode/transition replay). After using stable geometric dependencies,
the same sequence causes zero rebuilds: `paving-material-rebuild-before.json`
and `paving-material-rebuild-after.json`. No chosen detail was reduced.

## Diagnostic experiments — not release settings

The following negative probes were removed, not shipped as cosmetic fixes:
constant-colour material, unlit material, zero specular, zero environment,
fog disabled, raw diffuse output, fixed texel and custom Neutral tone mapping.
Their screenshots document source/sampler/lighting separation only. They do
not prove final realism. Original global tone mapping, lights, fog, liner and
above-ground materials are preserved. The latest Ipè uses only a real warmer
board crop plus scoped matte-PBR calibration; independent visual acceptance
is still required for each remaining material/system combination.

### Ipè latest visual correction

The single pale board sampled initially was not representative of the whole
photograph. The latest shared sampler selects four **actual different boards
from the same original JPEG**, using the existing neutral per-module vertex
shade as deterministic identity. No geometry, UV attribute, additional texture,
draw call, mirroring, source-pixel tint or random rotation was added. All four
overlapping windows within one module use the same selected photographed board.
Three small extra projection matrices are used only by Ipè; the seven stone
references retain their single source projection. Photographic lighting
calibration and matte roughness/specular settings are scoped to Ipè, not
claimed as measured supplier data.

Independent actual browser retest: `ipe-four-board-{coping,paving,hero}-1440.png`
and hero390/430. Reviewer confirms visible deterministic board variation,
plausible muted brown/taupe/ash identity, matte response, no previous uniform
gray/plastic appearance or obvious mirrored/checkerboard repetition. **PASS
for this tested 8×4 configuration and these three viewports**, not physical
product certification or a substitute for the remaining system/size coverage.
Shader compiled without runtime errors. Initial-load warnings about textures
marked for update before image data remain recorded, not hidden as a PASS.

## Final targeted browser evidence

- All eight finishes were additionally selected as independent coping and paving
  in both mobile viewport emulations: `independent-final/paired-finish-{1..8}-{390,430}.png`
  and `mobile-paired-states.json`. These older `.png` names contain native JPEG
  bytes and are not lossless evidence.
- Controlled dry/wet top comparisons at the same 390×844 framing show that the
  apparent one-pixel stippling is not specific to water. JPEG compression does
  not establish a GPU raster defect. Native Codex-app screenshot access is
  unavailable through the configured computer-use surface. The owner directly
  confirmed **“Contorni continui”** on the actual screen. That is owner visual
  confirmation, not a relabelled independent lossless screenshot.
- Actual browser Save Copy created `PW-1N71-EXE8FK`; Reload returned **Salvato**,
  not a false dirty indicator. A read-only REST query against only
  `waetxxqdlsuanqescuye.supabase.co` confirmed one persisted row with
  `copingMaterial=reference-ipe`, `paving=reference-ipe`,
  `pavingFormat=wood-140x2400`. No secret is in this report.
- Share copied the public-only URL. A fresh reviewer used the alternate local
  origin `127.0.0.1:3003` to avoid the owner's same-origin edit token and verified
  **Progetto condiviso / Sola lettura / Salva una copia**, Finish 6 on both surfaces,
  and the board format. Evidence: `finish6-shared-readonly.jpg` and
  `finish6-shared-materials.jpg` in the independent evidence directory.
- The actual downloaded Project Book has seven A4 landscape pages, matching
  Project ID, Finish 6 names and board dimensions; page 6 contains actual matching
  Day/Night browser captures. All seven pages were rendered and visually inspected.
  Evidence: `projectbook-reference6-{1..7}.png`; original QA PDF is outside Git in
  the local Downloads folder. No outline overlay contaminates its photographs.
- Opening the quote form and submitting it empty produced the expected Italian
  required-field/privacy/timing errors. No customer data or real email was sent.
  Quote snapshot coverage remains explicitly the existing local server contract
  tests, not a claim of new live lead submission.
- Supplemental new-Ipè/legacy-wood frame logs are preserved but **not treated as
  a matched comparison**: automatic DPR differed (1 vs 1.405). They do not replace
  or inflate the three controlled baseline/candidate pairs above. No mobile
  hardware or GPU-memory-byte measurement is claimed.
- The final plan-only backdrop change was independently tested at 1440×900 and
  emulated 390×844 / 430×932. Top projection remains orthographic, entire basin
  and channel stay visible, Finish 8 coping / Finish 7 paving remain selected,
  and the coastal backdrop returns on perspective views. No geometry, environment
  light map, approved Infinity camera preset or Photo Mode was replaced.
  Evidence: `independent-final/infinity-backdrop-retest.md` and
  `infinity-{top-neutral,perspective-preserved}-{1440,390,430}.jpg`.

## Scoped delivery candidate and preserved earlier WIP

The operational checkout contains older camera/product-photo/hydromassage WIP
which is not silently bundled into this goal's commit. A separate detached
clone `/private/tmp/pool-shaper-goal-candidate-Dc6BUY` applies only the goal patch
to verified b40924f. It contains 41 goal files, including the eight original
reference JPEGs and provenance. The one necessary earlier camera dependency is
ported minimally: optional preferred aspect and rectangle scoring (five added,
two removed lines), with three concrete helper regression assertions. Existing
perspective consumers retain the original default behaviour. No earlier camera
preset, hydromassage, steel, external-pool geometry or product-photo WIP is lost
or included implicitly.

Isolated scoped snapshot: typecheck and production build PASS; material 2,358,
integration 5,054, architectural outline 3,387 and existing architecture 362
checks PASS; diff-check and staged credential-pattern scan PASS. The operational
WIP outline audit has 3,396 checks after the same three helper assertions; its
different existing geometry produces a different dynamic assertion count.
Neither count is a skipped-test proxy.

Coordinator actual IAB smoke of that exact isolated snapshot on port 3005:
cloud shared Finish 6 opens read-only, both surfaces and board format retained;
top projection is orthographic and centred at actual 1440×900; changing paving
alone to Finish 8 preserves Finish 6 coping and switches to 60×120 modules;
430×932 top fits the entire pool. No runtime shader errors in the queried log.
Files: `isolated-goal-top-finish6-1440.jpg`,
`isolated-goal-top-finish8-1440.jpg`, `isolated-goal-top-finish8-430.jpg`.
This additional smoke is coordinator verification, not falsely labelled
independent replay. The separate independent reviews above remain attributed
to their actual tested operational-WIP snapshot. The temporary QA tab was
closed and the main integrated preview restored, with no live quote or email.

Delivery integrity: the 39 source/asset index blobs (excluding the evolving QA
report and equivalent-comment audit file) matched the independently built
isolated snapshot exactly before commit. The final backup `m1iUMt` credential
scan passed; all 86 backed-up working files retained the same SHA-256 after
commit, except this intentionally updated report. The prior WIP remains
uncommitted and visible in `git status`, not falsely described as a clean
worktree or silently included in the published feature.

During startup of the isolated development server, dependency reoptimization
logged an initial `Invalid hook call` diagnostic before its automatic reload.
The subsequent settled browser smoke and queried runtime error log were clean;
the separate production build passed. This is recorded as a transient QA
startup observation, not erased or represented as warning-free operation.
Both temporary benchmark/isolated servers were stopped after QA; the original
3003 preview remains running. No production deployment was requested or run;
external hosting auto-deployment state was not inspected or changed.
