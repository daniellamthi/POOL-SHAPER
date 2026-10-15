# Real customer QA — working evidence

Branch: `feat/fullscreen-day-night-hidden-overflow`; starting HEAD `2afb0544d4f51fa243cc3962fa4931d4f76229f6`.
Existing WIP remains in place. No merge/deployment. Live target independently identified using the **Daniele 2** connector: `waetxxqdlsuanqescuye`, Configuratore piscine wellness.

Latest acceptance: **KEEP for the requested customer additions**, with the bounded evidence and exclusions below. Earlier missing-feature checkpoints remain as history, not current results. No physical-mobile certification, live email delivery or remote deployment is claimed.

| ID | Requirement / owner | Acceptance / evidence | Current result |
|---|---|---|---|
| C01 | Panel state / primary | 20 cross-phase Next/Back cycles, manual reduce/reopen at 1440/390/430 | PASS: `customer-navigation/before.json` reproduces collapse; `final.json` preserves expansion, size, configuration and explicit-toggle-only behavior, including Escape |
| C02 | Navigation state / primary | Snapshot before/after equals; stable expanded area across different card contents | PASS: navigation browser assertions |
| C03 | Independent implementation review / reviewer | Actual handler/fingerprint tests; no reliance on implementer claims | PASS: reviewer found stale viewer reference, delayed-reset and concurrent-save defects; all corrected and re-reviewed |
| C04 | Skimmer / primary browser | Blank-project journey, system detail visible, variants | PASS: `customer-journeys/layout-results.json` completed path, `customer-cameras/frozen-results.json` actual detail focus at all 3 viewports |
| C05 | Grille/hidden overflow / primary browser | Required subtype presented; valid independent selections and delivery | PASS: both blank journeys plus `customer-cloud/grille-1440/smoke.json` and `hidden-1440/smoke.json` |
| C06 | Infinity traditional/glass / primary browser | Original cameras, transparent containment, no lower floating liner; all four sides | PASS targeted geometry and four-side selection; both cloud smoke cases pass. Exterior support proof `infinity-only/support-final-glass-exterior.png`. Reverse diagnostic view can show distant headland, not an all-angle open-sea claim |
| C07 | Above-ground / primary browser | Panels/stairs/Pellicano, optional toggles, complete journey | PASS: `customer-journeys/above-retry-results.json` explicitly asserts above-ground; `customer-final/remaining-results.json` 15 actual desktop/mobile captures and ON/OFF assertions; cloud above case passes |
| C08 | Renovation liner/mosaic / primary browser | Actual renovation route, existing/proposed separation, validated contact stage | PASS: `customer-journeys/remaining-results.json` actual 6-phase renovation paths, both cloud smoke cases. Earlier wrong-route fixture is rejected, not counted |
| C09 | Access/comfort/materials / visual review | Stair variants, inox, shelf, hydro, coping/paving, liner/mosaic/inox | 60 current captures, 20 selections × 3 viewports: `customer-cameras/frozen-results.json`, no browser errors. Additional 15 above-ground captures; retained steel material evidence. Main views inspected directly; no claim of exhaustive all-size/all-finish visual certification |
| C10 | Day/night / visual review | LED/micro-spot ON/OFF, non-emissive jets | RGB/white actual captures at 3 viewports; state/hydro suites PASS; bench ON/OFF actual browser evidence `bench-results.json` |
| C11 | Save/reload/share/copy / primary | Actual browser + durable rows, identical normalized snapshot/identity | PASS all 10 cloud smoke cases, matrix below. Synthetic-memory tests kept separate |
| C12 | Owner draft/reload / primary | Newer local edits preserved at saved URL; real dirty marker maintained | PASS Skimmer desktop cloud browser |
| C13 | Delayed load/reset / primary | Late read response cannot overwrite new project | PASS Skimmer desktop real browser and independent source-callback test |
| C14 | Share/PDF identity / primary + reviewer | Edited owner is saved; edited viewer creates copy; PDF uses actual returned copy snapshot | Source-handler tests PASS; actual Skimmer cloud PDF/copy PASS |
| C15 | Quote/privacy / primary | Saved snapshot/ref equals durable lead; invalid form rejected; no real email | PASS all 10 cloud cases: lead rows match copy identity; provider_id null / EMAIL_NOT_CONFIGURED; invalid form rejected. Live email intentionally disabled |
| C16 | Concurrent save / reviewer | One pending write for Save/Share/PDF/quote; retry after both failure types | PASS independent actual-callback tests; Share disabled during write |
| C17 | Performance / primary | Real GPU, current matching configuration; no invasive profiler | PASS: retained controlled 8×4 evidence below plus current 12×5 additions comparison: 3 pairs, median 8.3 → 8.3 ms, 108 calls. Two immersed loungers add 4 calls, median unchanged; details in additions closeout |
| C18 | Automatic checks / primary | typecheck, build, geometry/state, persistence/export, diff | PASS current typecheck/build; geometry 108 cases, above-ground 16,681, hydro 46,209, camera 31,336, renovation 1,355; persistence/export/delivery local PASS |
| C19 | Evidence integrity / primary | Actual images and complete successful assertions required | Partial/interrupted runs and synthetic-memory results never counted as live PASS |
| C20 | Commit/push / primary | All mandatory gates pass; preserve other WIP and approved branch | Gate-ready: checks PASS, only the current feature branch may be committed/pushed. Exact resulting SHA and remote verification are recorded in Git/final delivery. No remote preview deployment requested in the additions scope |
| C21 | Independent browser replay / independent_browser_gate | Fresh real app, 5 families + emulated 390/430, requirement-by-requirement evidence | PASS bounded gate: earlier 51 successful checks retained; formerly missing IT/EN and immersed loungers implemented and directly rechecked. Own additions matrix below; no old BLOCKED evidence deleted |
| C22 | IT/EN / locale specialist + independent_browser_gate | Available English mode, no mixed labels/state reset on language change | PASS: 125 catalogue texts + 144 tray texts, 5 configurations / 10 localized PDFs; fresh English browser samples and focused residual rechecks; actual IT→EN→IT preserves state/camera |
| C23 | Sun Shelf loungers / geometry specialist + independent_browser_gate | Dedicated submerged loungers distinct from external chaise optional | PASS: actual 12×5 meshes/counts 1/2/4, ON/OFF, independent exterior chairs, dependent removal at 8×4, day/night immersion evidence |
| C24 | Product imagery / independent_browser_gate | Correct decoded pictures/vector illustrations and retained command icons | PASS for sampled controls ×7; not all catalogue photography/provenance certification |
| C25 | Default document language / primary + independent_browser_gate | Italian document lang/title/accessible H1; reload preserves draft | PASS: 4 focused independent rechecks, `independent-gate/language-recheck.json`; HTML lang/title/H1 Italian, identical draft/panel/navigation after reload |
| C26 | Bootstrap loading message / primary + independent_browser_gate | Italian loading text; no loader/layout behavior changes | PASS DOM recheck: `independent-gate/loader-recheck.json`, actual scene module delayed, Italian fallback present and old English absent. PNG limited by startup curtain; no claim that it visually proves the label |
| C27 | Lounger geometry / shelf_geometry | Published dimensional envelope/immersion; real shelf support, access/Infinity clearance; no scale-to-fit | PASS 1,437 geometry checks + actual browser fixed dimensions/support/water immersion |
| C28 | Lounger dependency/state / primary | OFF default; resize/removal only affects dependent optional; outside loungers independent | PASS 93 actual-reducer checks + independent resize/re-add browser evidence; stale removal notice corrected |
| C29 | Localized customer journey / locale_implementation | New/renovation phases, controls, errors, summary, form, PDF; preserve proper names/IDs | PASS catalogue/tray/PDF audit, new/renovation English browser samples, live English quote validation and seven-page exported PDF inspected |
| C30 | Language is not project data / primary + independent_browser_gate | IT→EN→IT preserves snapshot, dirty flag, panel, camera; preference survives refresh | PASS at 1440/390/430, camera/target deltas exactly zero, dirty and clean fixtures retained, separate locale storage; actual cloud copy snapshot also unchanged |
| C31 | Truthful product media / product_images | 10 mapped actual 3D captures, visible disclosure, responsive/lazy; no false exact-product photos | PASS 10/10 decoded mappings + independent visual inspection; explicit 3D-preview badge/alt/disclaimer and source manifest |
| C32 | Command icons / independent_browser_gate | Keep coherent phase/nav/day-night/camera/save status icons, not photographs | PASS actual captured controls, coherent SVG family/selected state preserved |
| C33 | New optional delivery / primary | Quantity survives real cloud Save/Reload/Share/Copy; localized PDF/quote snapshot matches | PASS source PW-MZJC-Z90GKA → copy/PDF/lead PW-3WBD-KRKQKX; durable rows and normalized snapshots match; no email sent |
| C34 | Current-candidate loading/performance / primary | Same machine/configuration, one scene, warmed assets; OFF vs ON incremental cost and image loading | PASS bounded desktop gate: 3 valid pairs, actual M1 Pro/Metal GPU, identical OFF resources, lazy images 0 initial requests / 3 on Access & comfort. No real-mobile or reliable VRAM-byte claim |
| C35 | Infinity regression / independent_browser_gate | Current coastal view, same camera/configuration on language change, visible rim/glass unobscured | PASS fresh 1440/430 captures + frustum/safe-frame evaluation; only these bounded approved views, not all orbit angles |

## Confirmed defects corrected

- Navigation previously set panel expansion from step completeness and reopened it on every subcategory. Expansion now belongs to the explicit user toggle; expanded option area has a stable viewport-bound height.
- Entering system details could retain a distant structural camera. Skimmer/overflow detail now receives its contextual view; approved Infinity routing is preserved.
- Share previously copied a stale saved link after edits; edited viewer snapshots also appeared clean. Fingerprint comparison now detects viewer edits; Share saves/creates a copy as appropriate.
- A saved URL could discard newer owner drafts, and loading/error could overwrite drafts with defaults. Restore respects an owner's matching dirty draft; autosave waits for successful initialization.
- Delayed shared-load responses after Reset could overwrite the new project. Revision invalidation now suppresses obsolete success/error callbacks and Reset clears the old reference.
- Concurrent Save/Share could create competing references. One in-flight promise now serializes the write.
- Quote and PDF could use an old Save Copy identity. Save returns the exact snapshot actually sent; quote and PDF consume that snapshot/reference.
- Infinity lower support end gaps are closed against the actual terrace/pool offset. Actual diagnostic capture: `infinity-only/support-final-glass-exterior.png`.
- Restoring a blank partial draft skipped the mandatory project-type screen. `firstIncompleteStepIndex` now returns the initial step until projectType is selected; corrected journeys assert their actual persisted route.
- Entering Paving retained the Coping camera. The non-Infinity subcategory now selects its actual contextual camera.
- The construction badge overlapped the header. Its offset now derives from the actual header height.
- PDF clean images previously used the wizard's narrow camera-safe strip, leaving the pool tiny and displaced in exported images. A temporary capture-only flag uses the full canvas and holds the same review camera for day/night; normal wizard framing is restored afterward. Actual regenerated seven-page PDF `customer-cloud/renovation-mosaic-1440/Project-Book-PW-G4WA-E4S2KD.pdf`; all 7 rendered pages inspected in `customer-pdf/final-renovation-*.png`.

## Actual cloud matrix

Every row completed Save → Reload → dirty-edit/reload → Share → fresh read-only → Save Copy → downloaded PDF → validated quote → durable database assertions → delayed-load Reset race. No email sent; synthetic QA records only.

| Case / viewport | Source reference | Copy / PDF / lead reference | Result |
|---|---|---|---|
| Skimmer / 1440 | PW-26XS-4PVZ96 | PW-8RQH-3DRCAY | PASS |
| Grille / 1440 | PW-Q3Y7-0ZNA4F | PW-QME9-231G4Q | PASS |
| Hidden / 1440 | PW-E2NF-90B346 | PW-8BRC-8ZW2H7 | PASS |
| Infinity / 1440 | PW-S4NV-FXNVCR | PW-SHM2-104RDR | PASS |
| Infinity glass / 1440 | PW-6BR9-T08FPH | PW-9G5E-VJY6G4 | PASS |
| Above-ground / 1440 | PW-Y95N-1RC0FY | PW-4X3X-K04FRQ | PASS |
| Renovation liner / 1440 | PW-7XKV-GTXVQ7 | PW-AC1M-1HMYP9 | PASS |
| Renovation mosaic / 1440 | PW-Y4AZ-4EBVCE | PW-G4WA-E4S2KD | PASS |
| Skimmer / 390 | PW-RMKK-VJ425F | PW-27M2-EB13F3 | PASS |
| Skimmer / 430 | PW-7YJW-9R9P56 | PW-VZQX-SREQH1 | PASS |

The live matrix does not mean all variants were tested live at all viewports; local visual/interaction coverage at 390/430 is recorded separately. Interrupted HMR/cold-start test runs are not counted. Optional removal assertions wait for the real debounced draft, not a fixed 700 ms delay.

## Final verification / remaining gate

- Final `npx tsc --noEmit`, production build and `git diff --check`: PASS. Build log `customer-final-build.log`.
- Focused rechecks after export framing change: fullscreen state, project-delivery and export-guard PASS. Project-delivery memory tests explicitly remain local-only; cloud evidence is the separate matrix above.
- Bench micro-spots actual ON/OFF retest PASS; `bench-results.json`. Final contextual captures: 60; additional above-ground captures: 15. Final seven-page renovation export visually inspected.
- No secrets detected in added tracked diff. Ignored local credentials and evidence not staged. No schema changes, emails, merge or deployment.
- Independent reviewer verified actual save/share/PDF/quote callback and race behavior. Final persisted screenshots were inspected by the primary agent; do not describe this as a second independent full browser replay.
- Performance measured on real Apple M1 Pro / ANGLE Metal. Same synthetic 8×4 configuration; baseline eed4157 uses the old canvas 2812×838, current uses 2023×1264. This is a same-day product comparison, not an equal-resolution GPU microbenchmark. Historical measurements cannot establish current acceptance. No unsupported shader/geometry/quality reductions made to force a PASS.
- Evidence: `customer-final/performance-results.json`, `performance-active-results.json`, `comparison-results.json`. Baseline server was started solely for this read-only comparison; original checkout remained clean.

**Checkpoint before residual closeout: FIX REQUIRED.** Functional fixes and real cloud paths were verified, while performance and independent final replay remained open. Subsequent controlled results below supersede this checkpoint; it is retained to preserve evidence history.

Evidence root: `docs/fullscreen-qa-evidence/` (local, ignored). Tests use synthetic customer details only. No credentials are included in this report.

## Residual-gates closeout — controlled verification

Scope: performance and independent browser replay only. Prior functional/cloud/build evidence is retained, not rerun or expanded into a fresh product audit.

Backup before verification: `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-sWK0s4/` contains a binary Git diff, full versions of 54 changed/new task files and a SHA-256 manifest. Credentials and ignored files excluded; secret scan passed. Original checkout/HEAD unchanged.

### Performance protocol (defined before results)

- Baseline: isolated detached checkout of current HEAD `2afb0544d4f51fa243cc3962fa4931d4f76229f6`, not the older `eed4157` reference. Candidate: second isolated checkout overlaid from the exact WIP backup manifest. Separate Vite caches; no server credentials copied.
- One headed Chrome scene at a time; the user's local preview tab temporarily navigated to `about:blank`, independent reviewer waits until benchmark completion. Same Chrome binary, desktop 1440×900, DPR 1, actual drawing buffer 1440×900, perspective camera `[11,7,10]`, target `[0,-0.5,0]`, FOV 34, aspect 1.6. Runtime camera/framebuffer normalization is test-only, not a product quality reduction.
- Same synthetic 8×4 Skimmer, travertine/liner, internal stairs, LED+stair-light options, daylight. Same navigation to Presentation, settle, fixed camera, asset warmup. Three short paired comparisons, alternating order for pair 2; 120 RAF intervals per sample. No screenshots/profilers during timing. Exact DPR/buffer/camera/visibility assertions guard comparability.
- Record median/p95 RAF time, draw calls, triangles, resource counts and actual renderer. Reliable VRAM bytes are unavailable in WebGL and are not invented. Desktop measurements do not establish real mobile performance.
- Working acceptance budget for this desktop gate: median ≤16.7 ms and p95 ≤33.3 ms, with no consistent candidate regression above max(10%, 2 ms). Large inconsistent pair-to-pair variation makes attribution inconclusive. A slow baseline alone does not pass the candidate.
- Classify A: repeatable candidate regression; B: repeatable shared baseline limit; C: unstable/inconclusive environment. Only three pairs, no indefinite retries. Output `residual-gates/performance-controlled.json`.

### Independent replay protocol

Separate sub-agent `independent_browser_gate`, not an implementer. Its own `scripts/independent-gate-replay.mjs` will drive the real app, collect fresh scene/DOM observations and screenshots at desktop 1440 and emulated mobile 390/430. POST requests are blocked. It samples five required pool families and maps requirements individually; prior screenshot counts are not substituted for coverage. Missing IT/EN or Sun Shelf-specific loungers must remain explicit missing requirements, not be relabelled PASS or implemented as new features in this verification-only scope.

### Controlled performance result: PASS (desktop only)

| Pair / execution order | Baseline median / p95 ms | Candidate median / p95 ms | Calls baseline / candidate |
|---|---|---|---|
| 1: baseline → candidate | 8.4 / 17.2 | 8.3 / 16.7 | 145 / 145 |
| 2: candidate → baseline | 8.3 / 9.1 | 8.3 / 9.3 | 145 / 145 |
| 3: baseline → candidate | 8.3 / 9.3 | 8.3 / 8.4 | 145 / 145 |

Actual renderer in all six samples: `ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)`. Same 42,870 triangles, 33 textures, 84 geometries; no context loss, camera drift or software renderer. All asserted DPR=1, 1440×900 draw buffer, visibility=visible. Browser: installed headed Google Chrome, same process/binary for both checkouts. Exact raw records: `residual-gates/performance-controlled.json`.

No repeatable candidate regression (A) or failing shared baseline limit (B) was observed under these matched conditions. The earlier unmatched/variable runs remain category C, inconclusive; they were not used to pass this gate. The first controlled harness attempt stopped on floating-point equality (7 vs 7.000000000000002), collected zero accepted samples and is preserved as `performance-harness-initial.json`. The corrected harness checks camera stability to 1e-9 and completed exactly three valid pairs. No application code, renderer rewrite or customer detail changes were required.

This closes the bounded desktop comparison, not arbitrary device certification. Reliable VRAM byte accounting and real iPhone/Android performance are not measurable through this desktop WebGL test. Mobile 390/430 replay is viewport emulation only. Both temporary comparison servers were stopped afterward; isolated checkouts and backup remain recoverable.

### Independent replay result: executed, complete gate NOT PASS

Separate reviewer used the app directly, not the prior report/screenshots. Seven fresh sequential headed-Chrome scenes: Skimmer, Sfioro, Infinity, Fuori Terra and Ristrutturazione at 1440×900; Skimmer at emulated 390×844; Infinity at emulated 430×932. **60 explicit checks: 51 PASS, 9 BLOCKED, 0 runtime FAIL/page errors, 0 POST attempts.** Reviewer closed Chrome on completion.

Own evidence: `independent-gate/MATRIX.md`, `independent-gate/results.json`; every ID maps to a new screenshot and actual DOM/scene state. This is a bounded independent sample, not a claim that each of the earlier 75 captures covers all requirements.

| Requirement mapping | Fresh reviewer evidence / outcome |
|---|---|
| Expanded panel across cross-phase Next/Back | `next-back-open` ×7 PASS; recorded headings before/next/back |
| Voluntary collapse/reopen | `explicit-collapse` ×7 PASS |
| Preserved system/subtabs | `system-subtabs` ×6 and `renovation-subtabs` ×1 PASS; Infinity side 2 and glass actually selected |
| Real material update | `material-live` / `renovation-material` ×7 PASS; before/after scene material fingerprints differ |
| Shelf vs external chaise optional | `sunshelf-external-optional` ×2 PASS; shelf remains as external chaise meshes mount/unmount |
| Dedicated submerged Sun Shelf loungers | `submerged-sunshelf-loungers` ×2 BLOCKED / MISSING; external chaise is not a substitute |
| Product pictures and command icons | `images-icons` ×7 PASS for sampled decoded textures/vector illustrations and phase icons |
| Relevant presentation cameras / clipping | `camera-presentation` ×7 PASS, basin inside frustum, no document overflow/context loss; reviewer directly inspected own seven presentations. Not all orbit angles/detail cameras certified anew |
| Recap and Save/Share/PDF access | `recap-delivery-access` ×7 PASS, enabled/disabled unsaved-project rules respected; no duplicate cloud transaction test |
| IT/EN without reset/mixed language | `it-en` ×7 BLOCKED / MISSING: no English mode or language switch; reset-on-language-change cannot be tested without that functionality |

The two missing capabilities are required by the closeout request and remain on the checklist. They were not introduced as new features in a verification-only task, nor silently waived to obtain PASS.

### Minimal defect correction after replay

The independent DOM observations also reproduced `html lang="en"` and English accessible H1/title on the Italian default route. `src/routes/__root.tsx` and `src/routes/index.tsx` were adjusted: lang=it, Italian title/description/H1. Originals are preserved in backup `before-language/src/routes/`. Restoring the owner's actual preview also reproduced the English initial loading message in `PoolViewport.tsx`; that one text node is now Italian. The initial 54-file backup already preserves its original version. No CSS, wizard state, geometry, materials, lighting or render-quality settings changed. Accessibility/React skills guided these limited text corrections; no broad Lighthouse or refactor was run.

The measured 3D scene, material, geometry, shader and camera modules remain byte-identical to the frozen performance candidate. The subsequent route metadata and loading-text changes alter no 3D rendering dependency/settings. Existing cloud/persistence/geometry evidence is reused on that basis; these unaffected gates are not rerun.

- Independent metadata/reload retest: **4/4 PASS**, own `language-recheck.json` and screenshot. HTML lang=it, Italian H1/title; exact draft preserved across reload, panel expanded, same heading and Next/Back behavior; zero page errors/POST. Original nine missing-feature BLOCKED records remain unchanged.
- Main preview restored after benchmark to the user's original 10×4.5 m grille/night configuration; no user draft replaced with a QA fixture.
- Independent loading-text retest: DOM PASS with actual scene module delayed; old English absent, zero POST/page errors. The single initial setup race is preserved as FAIL_TEST_SETUP, not counted as an application defect or successful check. One corrected retry succeeded; PNG remains behind the startup curtain and is not visual proof of the label. No further attempts.
- Final `npx tsc --noEmit`, production build, syntax checks for the three new QA scripts and `git diff --check`: PASS. Build log `residual-gates/final-build.log`. Text-only corrections introduce no hooks, layout, state or rendering logic changes; focused accessibility/React review found no new component-level issue.
- No new database writes or real emails in this closeout. All sampled delivery access was read-only/UI-only; existing live cloud evidence is retained distinctly.
- No commit/push or remote preview deployment because the two required capabilities remain missing. Local preview `http://127.0.0.1:3003/` serves the uncommitted candidate, **not** a deployed/release-ready SHA. Local/remote feature HEAD remains `2afb0544d4f51fa243cc3962fa4931d4f76229f6`.

**Historical status before the requested additions: FIX REQUIRED.** Controlled desktop performance was PASS; IT/EN and dedicated Sun Shelf loungers were absent. The owner subsequently requested their implementation; the following closeout supersedes this status without deleting the earlier evidence.

## Requested additions — implementation and final evidence

Pre-change backup: `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-SMl3YB`, 59 WIP files plus binary diff/SHA-256 manifest, secret scan PASS. Current branch and starting remote SHA were verified without checkout changes. No archive/main branch changes.

### Fixed-size immersed loungers (C23/C27/C28)

Original procedural resin-chaise illustration, not manufacturer CAD or a guaranteed supply model. The envelope is sourced from the [manufacturer specification](https://ledgeloungers.com/cdn/shop/files/LL-Spec-Sheet-Signature-Chaise.pdf?v=15147070456672585287): 1.778 × 0.5842 × 0.5588 m, immersion limit 0.2286 m. Actual configured shelf immersion is 0.22 m. Full object envelope is reserved conservatively; published smaller contact footprint is not used to assume unsupported overhang. Layout margins are configurator design clearances, not regulatory/manufacturer compliance claims.

- OFF by default, separate from exterior chaise, quantity derived from usable shelf/access/Infinity clearance. No object scaling or approved shelf enlargement. Existing 6×3 and 8×4 shelves cannot accommodate this full-envelope model; control explains unavailability. Existing 12×5 shelf permits 1–4 in the tested layout; other choices can reduce capacity.
- Mesh-count/envelope/ON/OFF/resize and live day/night support are independently observed. Chair base/platform Y −0.363 m, water −0.143 m, chair top +0.1958 m. Removing the shelf/incompatible space removes only its dependent options according to existing rules; exterior furniture remains.
- A reproduced stale removal warning after explicit re-add was fixed. State test failed before correction and passes afterward; independent one-path browser recheck also passes.
- Geometry/state scripts: `sun-shelf-loungers-audit.mjs` 1,437 checks; `sun-shelf-state-audit.mjs` 93. No migration, pricing or installation certification added.

### Language, media and independent customer replay (C01/C21/C22/C29–32/C35)

`pool-shaper.locale` is a presentation preference, outside project snapshots/reducer. Authored Italian/English translations cover the active catalogues, new/renovation workflow, controls, errors, summary, proposal and Project Book. Proper commercial names and IDs remain unchanged. Tests cover 125 catalogue values, 144 tray strings, 5 project families and 10 IT/EN PDFs; fingerprints unchanged.

The independent browser found residual Italian strings and a real camera defect: translated aria labels stopped matching framing occluders. Data attributes now identify the same layout elements independently of language. Recheck at 1440/390/430 gives exact zero camera/target deltas, identical configuration, dirty flag and panel state. Six residual strings and five further catalogue descriptions/names were corrected. Twenty actual Next/Back cycles (7/7/6) passed; explicit collapse remains the only collapse trigger. Default document/error/modal labels are localized as well.

Ten original actual-WebGL product captures replace only informative product illustrations. Each is explicitly disclosed as “Anteprima 3D” / “3D preview”, with finish/example disclaimer and provenance in `public/product-previews/`. No missing temporary photo was substituted with a generic/generated photograph. Submerged and dry loungers, integrated stair and inox ladder, hidden and grille overflow have distinct accurate images. Command/status icons remain. Independent mapping/decoding and visual review passed 10/10.

Evidence: `customer-additions/MATRIX.md`, preserved `results.json`, focused `recheck-results.json`; final `final-infinity-shelf/MATRIX.md`, `validated-results.json`, `shelf-notice-recheck.json` and real PNGs. The first locator expected “Sun shelf” instead of the actual Italian “Spiaggetta”; setup failures remain recorded, not counted as product defects. The final Infinity capture harness also preserves invalid ResourceTiming/deck-name proxy failures as test setup, with actual geometry, camera, coastal scene and manual visual evidence evaluated explicitly instead. No old failing records were erased.

### Real cloud, summary, PDF and quote (C33)

Only authorized project `waetxxqdlsuanqescuye` was accessed. New synthetic 12×5 case completed Save → Reload → genuine dirty edit/reload → Share → fresh read-only → Save Copy → English seven-page PDF → English form validation → Italian submitted quote. Source `PW-MZJC-Z90GKA`; copy/PDF/lead `PW-3WBD-KRKQKX`, project UUID `05291bd0-abd1-4080-9a18-130f911344b4`. Durable snapshots/identity/count 2 match, exterior furniture remains separate. Notification provider is null / `EMAIL_NOT_CONFIGURED`; no real email sent.

Downloaded PDF is 1,050,421 bytes, seven pages; all seven rendered and inspected. It lists two immersed loungers and four exterior chaise, correct identity and English labels; day/night images show the actual model. Evidence `customer-cloud/sunshelf-1440/smoke.json`, PDF, `book-en-1.png` … `book-en-7.png`, English validation and quote confirmation PNGs. A first test comparison sampled the debounced draft before Save Copy identity settled; that harness-only failure is preserved in `initial-harness-draft-delay.*`. Waiting for the actual copied identity retains the full exact snapshot assertion; subsequent complete run passed. Prior ten cloud paths remain retained, not rerun.

### Current performance and final checks (C17/C18/C34)

Exact pre-additions 59-file backup overlaid on an isolated detached HEAD; no credentials copied. Baseline port 3012, candidate 3003. Same headed Chrome, 1440×900/DPR1/framebuffer, 12×5 Skimmer + Sun Shelf, daylight, fixed camera/target/FOV, collapsed presentation, warmed assets. One scene active; original IAB preview unloaded during timing. Three bounded alternating valid pairs, 120 RAF intervals each, no profiler/HMR or simultaneous test/build work. Source hashes before/after match. A first potentially contaminated run is explicitly excluded as `supersededRun`, not acceptance evidence.

| Metric | Baseline | Candidate |
|---|---|---|
| Median frame time, all 3 pairs | 8.3 ms | 8.3 ms |
| Median of pair p95 | 9.3 ms | 9.2 ms |
| Calls / triangles / textures / geometries (loungers OFF) | 108 / 53,116 / 27 / 67 | 108 / 53,116 / 27 / 67 |
| Navigation → canvas, median of measured loads | 1,520 ms | 1,475 ms |

Two loungers ON: one descriptive OFF/ON pair, 8.3 ms median unchanged, p95 9.2 → 9.3 ms; +4 calls / +12,336 rendered triangles / +1 shared geometry / no new textures. Initial phase requests zero product previews; opening Access/Comfort requests three. Loading timings are observed canvas visibility, **not** LCP/TTI or guaranteed visual readiness. Actual renderer `ANGLE (Apple, ANGLE Metal Renderer: Apple M1 Pro, Unspecified Version)`; reliable VRAM bytes unavailable. Desktop hardware only; 390/430 are viewport emulation. JSON `customer-additions-performance.json`. Baseline server stopped afterward; backup/checkouts retained.

Final typecheck, production build, project-config, persistence, export-guard, project-delivery (local tests), 31,336 camera assertions, geometry, new lounger/state/localization/media tests and diff-check PASS. Current cloud proof is separate, not inferred from local tests. Post-benchmark corrections affect only stale notice text and modal accessibility wording, not the measured 3D scene/render settings. No new heavy libraries, backend migrations, real email, merge or deploy.

**Final requested gate: KEEP.** No known uncompleted in-scope requirement. Exclusions: physical-mobile hardware/VRAM measurement, live email delivery (explicitly deferred), exact manufacturer supply/installation approval, and exhaustive all-angle/all-device certification. Local preview remains the current feature candidate; no remote preview/deployed SHA is claimed. Final commit/push must preserve all pertinent WIP and verify the same feature branch on origin.
