# Fullscreen luxury UI / Day–Night / hidden overflow

Repository: daniellamthi/POOL-SHAPER. Base: remote main fetched at `52c076e4a19fa46e6f1832f7b937d214b0fe4849`. Dedicated branch: `feat/fullscreen-day-night-hidden-overflow`.

Isolated worktree: `/Users/danielelamthi/Documents/Codex/pool-shaper-fullscreen-20261013`. Existing feature WIP and photorealism archive were left untouched. Preview: `http://127.0.0.1:3003/`.

| ID | Requirement | Evidence / acceptance | State |
|---|---|---|---|
| UI01 | Full-width/full-height live 3D; one Canvas | Real desktop/mobile screenshots, canvas covers viewport | PASS |
| UI02 | Compact bottom dock; temporary collapsible options; back/continue always accessible | Day/night open/closed actual UI, Escape/focus and scrolling checks | PASS |
| UI03 | All seven phases and subcategories; selections survive back/next | Actual browser navigation trail and canonical local draft | PASS |
| UI04 | White day / anthracite night, legible controls and brand | Actual captures; contrast checks; night logo correction | PASS |
| UI05 | Global time changes scene without resetting camera/materials/features | Paired real camera/projection measurements and state test | PASS |
| UI06 | Optional LEDs only; hydro nozzles nonemissive | Existing jet materials inspected; stair gate preserved; independent bench opt-in added and ON/OFF exercised | PASS |
| UI07 | Header/dock/toolbar safe area; top technical projection preserved | Real DOM overlays, projected bounds; camera audit | PASS |
| UI08 | Infinity photographic preset/scenario unchanged | Original coastal pose/FOV functions unchanged; projection-only UI fit, actual desktop/portrait captures | PASS |
| UI09 | Hidden intake under full coping; no visible grille/skimmer | Recovered historical section, 48 cases / 1,824 perimeter raycasts and real capture | PASS |
| UI10 | Visible grille remains available and updates scene | Actual wizard selection and grille capture | PASS |
| UI11 | Above-ground, stairs, comfort, materials, RGB controls | Actual selection/capture matrix, geometry tests | PASS |
| UI12 | Desktop1440 / mobile390×844 and430×932 | Actual screenshots, no document horizontal overflow, visible-toast control test | PASS |
| UI13 | Persistence and exports, legacy defaults | Local suites and bench-only/dormant-choice snapshot/summary test | PASS (local) |
| UI14 | Save/Reload/Share/Copy and quote submission in live backend | External-write QA rejected by automatic approval review under the explicit NO backend/Supabase constraint; no writes performed | BLOCKED |
| UI15 | PDF generator / download | Local synthetic snapshot, external POSTs blocked; seven pages rendered and visually inspected; live identity linkage depends on UI14 | PASS (local) |
| UI16 | No significant additional rendering cost | Real Apple M1 Pro before/after; 145 calls both, final median RAF9.1→8.7ms /p9517.4→17.2ms | PASS (measured desktop) |
| UI17 | Typecheck/build/geometry/camera/persistence/export/diff | Final typecheck/production build/diff after optimization PASS; targeted suites and actual browser matrix PASS, external-write E2E separately blocked | PASS (local/browser) |
| UI18 | Mandatory reference-image comparison | Received text attachment only; layout implemented against its written hierarchy, no image supplied in this request | BLOCKED |
| UI19 | Commit/push/new PR to main, no merge/deploy | Only after all mandatory gates pass; no release operation performed | BLOCKED by UI14/UI18 |

## Implementation and verification

- Dock reuses existing wizard logic and choice components. It hides the options pane without discarding its state. ResizeObserver uses real overlay dimensions; toolbar and restoration notifications stay above the dock.
- Global Day/Night preserves the current semantic camera request. Contextual RGB and micro-spot previews still select night. Night without selected lights does not create extra lights.
- Bench lighting is independently opt-in and OFF for legacy projects without the flag. A dormant choice is retained when the parent comfort changes; it does not render or appear as active work without hydromassage. No bench geometry changed. The lighting summary includes the selected bench-only option.
- Historical hidden-overflow recovery is confined to coping/collector section geometry. No obsolete whole files or unrelated previous WIP were imported.
- Typecheck, production build, geometry suite, 31,336 camera checks, persistence, export guard, local project-delivery, 48 hidden-overflow cases/1,824 raycasts, fullscreen-state tests and diff-check passed before the final pixel-budget adjustment. Local project-delivery uses memory fixtures and is not evidence of cloud persistence.
- Initial actual hardware comparison: identical145draw calls /42,870triangles /33textures /84geometries. Baseline restricted viewer1406×419: median RAF9.8ms /p9517.9ms. Fullscreen1440×900 before optimization:17.4ms /26.2ms. These are scheduling intervals on Apple M1 Pro ANGLE Metal, not GPU frame times or software-emulation FPS. This initial run was superseded by the bounded-pixel measurement below.

## Final measured result

Fullscreen interactive supersampling now has a 2.56-million-pixel backbuffer budget. Baseline DPR2, buffer2812×838; candidate DPR1.4054567, buffer2023×1264 (2,557,072pixels). Both145calls/42,870triangles/33textures/84geometries, no context loss. Final median RAF9.1→8.7ms, p9517.4→17.2ms on real Apple M1 Pro Metal. This establishes bounded measured desktop overhead; it is not a GPU timer or physical-phone benchmark.

Photo Mode and locked cameras retain their original quality tier. Existing hero capture has its own higher-resolution single-frame render; it was not changed. Actual local PDF images are1760×889. The local downloaded PDF has seven A4 landscape pages; all seven rendered pages were inspected with readable text, intact page numbering and day/night images. Its deliberately local QA identity/link is not a real cloud project.

Actual UI evidence covers twelve day/night × dock open/closed × viewport1440/390/430 combinations, all seven phases and their real decision path, back/next, skimmer/grille/hidden/Infinity, internal stairs, liner/mosaic, RGB red/blue, above-ground WPC and bench lights OFF/ON/OFF. No browser JavaScript errors in completed retests. Active restoration toast was verified not to intercept dock controls after the placement correction. Night logo and viewer-toolbar occlusion defects were corrected and recaptured.

Final source status:26 changed/new implementation, test and report files; local credentials and screenshots are ignored. Remote main remains52c076e and archive0152062; original feature WIP retains55 changed/untracked files, unchanged. New branch has no new commit/push while mandatory gates UI14 and UI18 remain open. The visible-overflow choice is explicitly labelled `Sfioro a griglia`, preceding `Sfioro nascosto`, with the existing stored IDs preserved.

## Authorization blocker

Automatic approval review rejected synthetic project/lead writes, citing the current explicit NO backend/Supabase constraint. It also rejected reading a prior fixture reference not directly identified by the human in this request. No attempt was made to bypass either rejection. UI/form validation and local fixture tests continue independently.

Owner action needed for UI14: explicitly authorize creating isolated synthetic QA projects and one synthetic quote in the existing POOL-SHAPER backend `waetxxqdlsuanqescuye`, without schema changes or real email. For UI18, provide the layout reference image mentioned in the request.

Evidence resides in ignored `docs/fullscreen-qa-evidence/`; failed preliminary automation attempts remain distinguishable from successful retests. `layout-results.json`, `variants-results.json`, `performance-results.json`, `toast-results.json`, `delivery-surface-results.json` and `local-pdf-results.json` record the bounded results. Screenshots/temporary captures are excluded from the implementation commit.

## Prepared pull-request description (not published)

Title: `feat: add fullscreen pool configurator with day and night controls`

The configured pool occupies the full viewport with a compact collapsible bottom dock, persistent phase navigation and unified Day/Night UI. Cameras fit the actual UI-free area, hidden overflow uses its recovered concealed intake/collector, and bench lights require an independent optional selection. Existing Infinity photographic presets and backend architecture are preserved.

Validation: production build/typecheck, geometry/camera/state/persistence/export tests, independent browser desktop/mobile captures and measured desktop rendering overhead. Before commit/push/PR publication, complete the explicitly blocked synthetic cloud roundtrip/quote gate and compare against the owner-supplied layout reference. No merge or deployment is authorized.
