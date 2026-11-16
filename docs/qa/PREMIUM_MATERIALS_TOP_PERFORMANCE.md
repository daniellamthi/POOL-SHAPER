# Premium materials, architectural plan and performance — 2026-10-19

## Current materials upgrade goal — reopened from f7fe5a2

The sections below this matrix describe earlier completed work, not evidence
that the newly requested upgrade is complete. Current candidate starts at
`f7fe5a28f582d21c4fb65fa4e023c7a90a2317c8`, local/origin equal. Backup:
`pool-shaper-wip-backups/residual-gates-20261015-TYK6hV` (39 WIP files, no secrets).
Scope: materials/finish UX/architectural outlines/performance only. Liner,
backend/Supabase, approved pool solids, environments and cameras are protected.

| ID | Responsible | Requirement / acceptance | Current finding / planned verification | Current gate |
|---|---|---|---|---|
| U01 | PBR specialist/root | Coping and paving: correct material identity, real metric scale, consistent grain/joints, no plastic or duplicated-slab appearance | Paired before/after and independent close-up/overview day/night, existing module contracts. Qualitative visual acceptance, not certified measured PBR properties | PASS |
| U02 | PBR specialist/root | All selectable Gres/travertine/limestone/Prun/stone finishes | Four Gres/two travertine/reference families plus limestone/Prun/slate/Istria selected in actual browser; final baked-v3 slate/Prun coping+paving and Prun overview day/night retested independently, original source photographs retained | PASS |
| U03 | PBR specialist/root | WPC/decking/Ipè and applicable above-ground panels | WPC longitudinal grain/matte response, continuous Ipè and independent paving; wood crop removes photographed cross-joints without rescaling. All four panels selected; 430 WPC night checked | PASS |
| U04 | Root | Every current mosaic: no identical mirrored sheet, natural tessera variation, same pitch across floor/wall/stairs/comfort | Nine existing originals each selected independently: dry floor/wall close-up, filled overview and night; 73,764 metric/sampling checks, no new photos or tint. Unlit night-wall colour fidelity is not claimed | PASS |
| U05 | UX specialist | Family action scrolls only the relevant wizard scrollport, clear Gres4/travertine2 variants, wood/WPC distinction | Actual1440/390/430 replay: family disclosure is not material selection, internal focus/scroll, format selection, Back and IT/EN preserve state; 618 checks. Six flow captures in premium-finishes-top-20261019 | PASS |
| U06 | Top-view specialist | Crisp semantic coping/basin/accessory/tread boundaries, no rough bevel wireframes or export contamination | Actual coping bevel duplicates removed only in plan extraction: 776→152 segments at8×4; unchanged solids/curved stairs/cameras/export masking. Paired top-before/after.jpg; 383 architectural +3,481 premium-plan checks | PASS |
| U07 | Performance specialist/root | No significant regression, responsive material changes, efficient loading and no needless reconstruction | Three matched main pairs: median8.5→8.5ms/p95 10.2→10.3ms. Final three slate-v3 pairs: median8.2→8.5ms/p95 10.1→9.5ms; unchanged full-pass calls/geometry. Rejected runtime v1/v2 regressions remain recorded, not shipped. Ten actual mosaic reselections per checkout show stable resources | PASS — scoped desktop hardware |
| U08 | Independent customer reviewer | Real integrated-browser close-up/overview/top, materials, day/night, responsive desktop1440/mobile390/430 emulated | Separate reviewer actually operated the app, reproduced slate FAIL, retested corrections; all9 mosaics/13 paving night families/four panels and390/430 Back/family replay. Detailed coverage artifact below | PASS |
| U09 | Root | Typecheck/build/targeted material/UX/plan/performance tests and diff/credential checks | Final working candidate typecheck/build/material/Prun/mosaic/reference integration/UX/plan/diff PASS; isolated exact staged source typecheck/build PASS without unrelated WIP or secrets. Credential guard PASS | PASS |
| U10 | Root | Task-only commit/push on current feature branch only after all mandatory PASS | Implementation9c95470259f40bd704b4981ac857024b9777b8b1 pushed; exact local/remote feature SHA verified.147 task files only, pre-goal WIP retained. This receipt adds documentation only | PASS |

New goal evidence is recorded in this section as work progresses; no historical
PASS is automatically promoted to the current candidate's visual acceptance.

### New implementation evidence (current goal only)

- Materials: retained all original pixels/metric coverage. WPC authored
  roughness mean .540→.855; legacy travertine's almost-black roughness map
  receives an explicit dry-honed calibration (.746 mean), not a measured
  supplier certification. Mineral reference overlap is narrower to retain
  source detail; approved continuous Ipè sampling is unchanged.
- Real independent FAIL: Ardesia showed recognisable identical vein bands on
  neighbouring slabs. Runtime translated-window v1 and its zero-weight v2
  optimisation failed three paired performance runs each (+11% and +18%
  median frame time respectively). Both implementations were removed, not
  hidden by a camera or by reducing chosen geometry.
- Final baked-mineral-v3 uses a reproducible offline periodic atlas from the
  original Ardesia albedo/normal and owner-supplied Prun photograph. Integer
  pixel translations, coherent maps, linear/sRGB-correct overlap, no rotation,
  reflection, hue change or invented relief. Twice the image coverage and UV
  multiplier .5 preserve the original texels per metre. Runtime uses the
  original PBR sampling cost: no added hash, branch, gradients or texture reads.
  Provenance, original/derived SHA, rights and authoring command are in
  `public/textures/coping/derived-mineral-v3/`. Original photographs are unchanged.
  Three PNGs total2,643,326 bytes; additional mipmapped RGBA estimate per
  independently uploaded map set is3.89MiB Ardesia /3.05MiB Prun, **not measured
  VRAM**. Coping/paving instances may each upload a set. This modest bounded
  memory/asset trade-off replaces the failed runtime shader cost.
- Loading: finite catalogue images share decoded Sources; owned texture
  disposal remains isolated. Mosaic reselects reuse photo-derived detail
  maps instead of baking from new Source UUIDs. The unit loader exercise
  records15→3 load calls for five reselections, **not** measured network or
  customer latency. Runtime resource/performance evidence remains separate.
- Wood: source-pixel inspection confirmed that the old photographed strip
  included cross-joints in albedo, normal and roughness at columns130–133 and
  300–304. The corrected common crop uses144–286, still inside one source
  board; crosswise coverage and .057/.14 metric grain density are unchanged.
  No source image, module dimensions, mesh or board placement was replaced.
  Shader family identities/revisions are explicit to avoid stale programs.
- Current automated results after final bake freeze: typecheck and production
  build PASS; material PBR580,877 plus original-Prun identity/metric audit;
  mosaic73,764 source-cell/metric checks /81 resize cases /nine originals;
  paving39,348,023 checks /999 geometry-contract cases; reference
  integration5,077 (local MemoryProjectStore/synthetic PDF fixtures, not cloud);
  reference samplers2,374; finish UX618; architectural383; premium plan3,481.
  Existing Vite chunk-size/plugin warnings remain non-blocking and unchanged.
- Root paired captures: mosaic, WPC, Gres Avorio, legacy travertine and top
  `*-before.jpg` / `*-after.jpg`, same1440×900 8×4 Skimmer/corner stair/day.
  The liner is Blue Sky except the mosaic pair; no liner implementation changed.
- Preservation check:38 of39 pre-goal WIP files remain byte-identical; only
  shared PoolModel has new task hunks. Its four existing `seamlessSteel` props
  remain local and must not be included in the materials commit.

### Current controlled performance and final visual evidence

`evidence/materials-upgrade-20261019/performance.json` contains24 bounded runs:
three alternating baseline/candidate pairs for the main configuration, three
for rejected Ardesia-v1, three for rejected Ardesia-v2, and three for final-v3.
Baseline is an isolated f7fe5a2 archive plus the exact pre-goal39-file WIP,
candidate is the current preserved workspace. Same integrated browser, Apple
M1 Pro / ANGLE Metal, viewport1440×900, DPR1.4054567, buffer2023×1264,
12×5 Skimmer, day, same options/camera, warmed assets; one QA scene active and
no CPU build/profiler during measurement. Source fingerprints remained stable.
Only the literal focused-control marker is ignored in supplemental DOM identity;
raw DOM and its hashes are retained. Technical configuration is not normalised.

| Accepted comparison | Median baseline→candidate ms | p95 baseline→candidate ms | Observed dominant pass baseline/candidate |
|---|---:|---:|---|
| Main, three paired runs |8.5→8.5|10.2→10.3|118calls /47,068triangles,72geometries /26textures unchanged |
| Ardesia baked-v3, three paired runs |8.2→8.5|10.1→9.5|118calls /51,996triangles,72geometries /25textures unchanged |

Aggregation is the median of run medians/window p95s, **not a pooled p95**.
Final Ardesia median is+0.3ms (~3.7%), not a claimed FPS gain; tail timing
improves and no significant regression is shown in the bounded tested scene.
`gl.info` sometimes reports a four-call internal pass: it is never presented
as a draw-call reduction. Ten actual mosaic reselections per checkout show
median window-p95 11.5→11.4ms, maximum window-p95 12.8→12.4ms, stable67geometry
and20texture full-pass counts. This is not a per-interaction latency or network
benchmark. Actual GPU execution time/VRAM are unavailable;390/430 are viewport
emulations, not physical-phone performance. No theoretical FPS is promised.

Independent final-v3 visual samples (not the superseded v1/v2 images):
`performance-ardesia-v3-{coping,paving}-close.jpg`,
`performance-prun-v3-{coping,paving}-close.jpg` and
`performance-prun-v3-review-{day,night}.jpg`. Actual coping/paving changes,
source grain, joints and continuity were inspected. No shader/texture errors;
only the pre-existing THREE.Clock deprecation warning. The flat ground visible
beyond the terrace in the close paving preset was checked against the baseline
and is pre-existing; no protected camera/environment edit was made to mask it.

All other independent material/UX/top samples and their limits are mapped in
`evidence/materials-upgrade-20261019/independent-customer-coverage.md`.
Photorealism acceptance is qualitative for the documented views; it does not
certify product specifications or every material×system×viewport cross-product.

Final release verification: the exact staged source was exported into a fresh
isolated directory (`materials-release-verified-index-Y9Onx6`) and passed
`npx tsc --noEmit` and `npm run build` without copying `.env` or unrelated WIP.
Credential scan and staged diff-check PASS. The pre-existing38 other WIP files
are byte-identical to the39-file backup; four pre-existing PoolModel props
remain in the working tree only. A further full184-file safety backup exists
outside Git at `pool-shaper-wip-backups/residual-gates-20261015-6PwPJS`.
`final-integrated-preview.jpg` shows the actual final local candidate open in
the integrated browser at `http://materials-qa.localhost:3003/`; this is a
working local preview, not a deployment. Temporary QA viewport override reset.

Delivery receipt: implementation commit
`9c95470259f40bd704b4981ac857024b9777b8b1`, pushed to the existing
`feat/fullscreen-day-night-hidden-overflow`; `git ls-remote --heads` returned
the identical SHA.147 task files comprise12 application files,9 test/authoring
scripts,5 derived-asset/provenance files,1 report and120 evidence files.
No backend/liner/camera/environment code, main/archive branch, merge or manual
deployment was changed. The unrelated working tree deliberately remains dirty.

### Earlier work (historical evidence, not the current upgrade gate)

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

## Final premium names and architectural plan — 2026-10-19

Separate follow-up to the completed gates above; no earlier checklist is removed.
Starting branch `feat/fullscreen-day-night-hidden-overflow`, local/remote
`b3036dcdf8a252058f324b160bcb3dc0c2052982` verified. Before-edit WIP backup:
`pool-shaper-wip-backups/residual-gates-20261015-Y130kW`; intermediate backup
`residual-gates-20261015-B4LlYb`, both credential scans PASS. Existing unrelated
camera, hydromassage, product-photo and other WIP stays outside this delivery.

Owner resolved the identity question: image 1 represents **Gres porcellanato**;
images 2–5 are its **Grigio, Avorio, Beige, Greige** variants. Images 6–8 are
**Legno Ipè, Travertino chiaro, Travertino venato**. No manufacturer, commercial
collection, measured PBR values or certified supply dimensions are inferred.

| ID | Owner / initial defect → targeted change | Test / acceptance | Final evidence / status |
|---|---|---|---|
| F01 | Material/UX review + coordinator: provisional numbered names → verified names | Exact ID→IT/EN title→source-image oracle, original image hashes unchanged | 8 mappings, `reference-finishes-audit`; PASS |
| F02 | Same: five apparent porcelain products → one parent + four variants | Opening parent changes disclosure only; four colours apply their original IDs; legacy generic IDs never auto-converted | Independent real IAB IT/EN captures; PASS |
| F03 | Coordinator: naming across coping/paving and existing/proposed renovation selectors | Shared family component; independent coping/paving; readable summary/PDF/quote names | 72 configurations, 198 local storage contracts, 16 PDF fixtures; PASS (local, not new cloud/email verification) |
| F04 | Material reviewer: Italian image alt/tooltip in EN → translated attributes | IT→EN→IT preserves selection, image and camera; exact full summary names | Independent EN image attributes and visible four-colour group; PASS |
| T01 | Camera reviewer + coordinator: forced canvas-centre ignored HUD → actual free-rectangle centre | Perpendicular orthographic projection, equal metric scale, actual construction bounds; 3 sizes × rectangle/L × 3 viewports | Independent 18-case matrix and projection assertions; PASS |
| T02 | Same: mobile tools occupied an extra band → top-only shared HUD row | Wizard remains expanded, all commands retained, no menu/pool/dock clipping | 8×4 width ≈219→295 px at 390, ≈760→774 px at 1440; PASS |
| T03 | Same: equal line hierarchy → 1.3 px primary / 1 px secondary with AA | Actual semantic mesh boundaries, no triangle diagonals or duplicate strokes; four outline calls unchanged | Real screenshots + targeted architectural tests; PASS |
| T04 | Coordinator: stacked metre/pixel padding → actual guide envelope + label clearance | Ticks at 0.60+0.12 m included once; finite responsive fit without stretching | 48 new framing cases / 432 assertions + actual complete mobile HUD-row regression; PASS |
| T05 | Independent QA found mobile technical+Guides overlap → dedicated top HUD rows and left-side depth tag | 12×5 technical top 390/430: D/W/L separate; no dropdown/control/dock collision | Retest screenshots below; PASS |
| P01 | Coordinator: preserve approved texture/geometry/liner/above-ground | Original 8 image hashes and material parameters unchanged; above-ground bypasses new UI/framing/stroke/label flags | 48 liner + 66 paving-geometry cases, approved legacy catalogues; PASS |
| P02 | Coordinator: no new render cost | Same 8×4 rect, Ipè coping / veined-travertine paving, Day, top, open Scena dock, warm assets, one active scene, 1440×900/DPR1 | Three existing app-telemetry windows before/after; PASS for this desktop comparison, not mobile hardware |
| V01 | Independent QA, not implementation self-review | Actual IAB, 1440×900 and emulated 390×844/430×932, curves/stairs/comfort/controls readable; state stable | [Independent review](evidence/premium-finishes-top-20261019/independent-review.md), 18 normal cases + 9 comfort cases + straight stairs and guide/technical retests; PASS |
| D02 | Coordinator: scoped delivery without bundling old WIP | Separate temporary index/snapshot, typecheck/build/material/integration/plan tests/diff-check and credential scan | Verification and delivery integrity recorded below |

### Real browser before/after

Evidence directory: [premium-finishes-top-20261019](evidence/premium-finishes-top-20261019/).
Representative native browser JPEGs (not lossless pixel-level AA certification):

- [1440 before](evidence/premium-finishes-top-20261019/before-independent-8x4-rect-1440.jpg) / [after](evidence/premium-finishes-top-20261019/after-independent-8x4-rect-1440.jpg).
- [390 before](evidence/premium-finishes-top-20261019/before-independent-8x4-rect-390.jpg) / [after](evidence/premium-finishes-top-20261019/after-independent-8x4-rect-390.jpg).
- [430 before](evidence/premium-finishes-top-20261019/before-independent-8x4-rect-430.jpg) / [after](evidence/premium-finishes-top-20261019/after-independent-8x4-rect-430.jpg).
- Gres parent/four variants: [IT](evidence/premium-finishes-top-20261019/after-materials-gres-greige-it-1440.jpg) / [EN](evidence/premium-finishes-top-20261019/after-materials-gres-greige-en-1440.jpg).
- Corrected technical+Guides: [390](evidence/premium-finishes-top-20261019/retest-independent-12x5-technical-top-390.jpg) / [430](evidence/premium-finishes-top-20261019/retest-independent-12x5-technical-top-430.jpg).

The full 18-case after matrix and extra material/comfort captures are preserved
locally in `pool-shaper-wip-backups/goal-20261019-final-premium/`. Mobile is
viewport emulation on the Mac, not physical iPhone testing. At 390 with both
technical controls and Guides, the 12×5 plan is necessarily smaller than the
ordinary uncluttered top view; no controls or wizard were removed to hide this.

### Bounded desktop performance comparison

Existing two-second renderer telemetry, no injected profiler or application
state access. Three consecutive warm windows per version; one scene only.
Renderer: **ANGLE Metal / Apple M1 Pro**, actual GPU, 1440×900, DPR1,
Experience tier, same selected configuration and Day/open dock/top state.

| Metric | Before | After |
|---|---|---|
| Median frame time (ms), 3 windows | 8.2 / 8.3 / 8.3 | 8.2 / 8.3 / 8.2 |
| p95 (ms), 3 windows | 9.9 / 9.6 / 9.9 | 9.5 / 9.4 / 9.3 |
| Draw calls / triangles | 139 / 66,814 | 139 / 66,814 |
| Geometry resources | 83 | 83 |

Raw [before](evidence/premium-finishes-top-20261019/before-plan-performance.json)
and [after](evidence/premium-finishes-top-20261019/after-plan-performance.json)
logs are authoritative for their individual window values. HMR texture count
30→31 is recorded, not interpreted as allocated GPU bytes or a cold-load
memory comparison. WebGL does not expose reliable allocated VRAM here. No
new shader, texture asset, geometric detail reduction or renderer rewrite was
introduced. Later changes only affect translated DOM attributes and the
technical+Guides path, not this measured ordinary top path.

### Verification scope and preserved work

The independent Material/UX reviewer checked only the touched taxonomy/UI:
no functional mapping defect found; its confirmed English alt/tooltip finding
was corrected and independently retested. React checks use the existing card
system, a module-level family list, primitive effect dependency and local
disclosure state; no renderer/store subscriptions or new library were added.

Targeted verification PASS: TypeScript, production build, 2,374 photographic
reference assertions, 5,076 configuration/persistence/export assertions and
3,829 architectural assertions in the operational WIP. The isolated scoped
snapshot also passes typecheck, production build, 2,374 / 5,076 / 3,820 checks;
the nine existing dynamic-geometry assertions differ because earlier unrelated
geometry WIP is intentionally not included. Neither count means skipped tests.
The 16 generated PDF fixtures exercise names/configuration locally, not a new
live quote/email/cloud backend check. Build warnings about existing >500 kB
chunks and redundant tsconfig-paths plugin are recorded, not resolved by an
unrequested refactor.

Scoped snapshot: `/private/tmp/pool-premium-candidate-20261019`. A temporary
Git index applies only the goal delta to b3036dc; two overlapping top-view
functions are ported minimally rather than copying the earlier camera WIP.
The exact-source smoke caught one required dependency: HEAD marked only the
mobile Expand/More controls, not the whole row including Reframe. The scoped
patch now reserves the whole row only for in-ground top view, with a concrete
390px HUD regression test; other camera/above-ground behaviours are unchanged.
No source checkout/reset, branch/archive mutation, backend change, merge or
deployment is performed. Browser verification of this exact scoped source is
recorded in the final delivery note below.

Local preview tooling observation: the inherited `vite preview` adapter expects
`dist/server/server.js`, while this project's Nitro build emits `.output/`.
That command did not serve the app and is not claimed as a successful production
runtime test. The source smoke uses an isolated Vite development server/cache
on 3005; the production compilation is separately verified. The approved main
preview on 3003 is not replaced, and no hosting/deployment readiness is inferred.

### Final independent source-smoke and delivery gate

The reviewer directly retested the **exact isolated source**, after the
whole-mobile-row dependency fix: [390](evidence/premium-finishes-top-20261019/isolated-source-retest-3005-top-390.jpg),
[430](evidence/premium-finishes-top-20261019/isolated-source-retest-3005-top-430.jpg),
[1440](evidence/premium-finishes-top-20261019/isolated-source-retest-3005-top-1440.jpg).
8×4 rectangle again spans approximately x47–342 at 390 and x18–411 at 430,
correctly centred, complete and clear of controls. Desktop actual free-space
framing also passes. Wizard remains open; Ivory/Veined travertine and translated
names remain selected. The earlier off-centre isolated capture is retained in
the local review history, not counted as PASS.

All F01–F04 / T01–T05 / P01–P02 / V01 / D02 gates now PASS within their stated
scope. Seventeen staged code/test blobs match the separately built/tested
snapshot exactly. Staged credential-pattern and diff-check scans PASS.
Forty-eight unrelated pre-existing WIP files are SHA-256-identical to the
initial backup; overlapping WIP remains in the operational files and backup,
not silently bundled into the goal commit. The feature branch alone is the
delivery target; no merge, archive change, Supabase mutation, email or deploy.
Commit/push SHA and remote verification are supplied in the final handoff.
