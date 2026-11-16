# Independent browser QA — 19 October 2026

Independent reviewer used a separate real Codex IAB tab, UI controls only, no source edits or cloud writes. Desktop 1440×900; 390×844 and 430×932 are viewport emulation, not physical mobile hardware. All normal captures used Presentazione → Scena, Day cards and wizard expanded throughout. No manual collapse was used to improve framing.

## Required shape/size matrix

Each cell below is a separate observed screenshot, named `after-independent-{size}-{shape}-{viewport}.jpg` in this folder. Every captured canvas was top/orthographic, verified through its exposed DOM data attributes. The complete basin, coping and curved treads remained visible, with no overlay collision, mesh diagonals, duplicate strokes or visibly broken curved contours.

| Size | Shape | 1440 | 390 | 430 |
|---|---|---|---|---|
| 6×3 | rect | PASS | PASS | PASS |
| 6×3 | L | PASS | PASS | PASS |
| 8×4 | rect | PASS | PASS | PASS |
| 8×4 | L | PASS | PASS | PASS |
| 12×5 | rect | PASS | PASS | PASS |
| 12×5 | L | PASS | PASS | PASS |

L was explicitly selected in Piscina → Forma, rather than inferred from stair shape. Actual configured recess values were preserved. Initial loaded local draft was Angolare despite the coordinator's cloud snapshot being rectangular; the discrepancy was reported and rectangular baselines were then explicitly configured, without saving to cloud.

Matched 8×4 rectangle before/after visual estimates: desktop basin width approximately 760→774 px; 390 width 219→295 px; 430 approximately 267→393 px. The mobile view menu no longer covers the upper-left coping. These are estimates from saved screenshots, not automated segmentation. Desktop is centred in usable free space, not forcibly at whole-canvas centre.

## Found defect and retest

With technical panel and Guides ON, then Dall’alto, 12×5 at 390 initially shrank to about 130 px wide and D/L labels overlapped (`after-independent-12x5-technical-top-390.jpg`). Reported immediately; coordinator corrected HUD-row reservation and D-label anchoring.

Retest evidence: `retest-independent-12x5-technical-top-{390,430}.jpg`, PASS. Basin approximately 193 px wide at 390 and 295 px at 430; D left, W right and L bottom are separate. Dropdown, view menu and wizard do not cover the pool. The 390 technical view remains necessarily smaller than the normal view because the open wizard, two HUD rows and labels consume the available height; no claim of equivalent size is made.

`retest-independent-6x3-guides-top-{390,430}.jpg`: PASS, all three labels separate in the ordinary materials view. `after-independent-12x5-technical-top-1440.jpg`: PASS, entire basin plus labels remains clear of the technical panel. The earlier `after-independent-6x3-technical-1440.jpg` is a perspective technical view, not evidence for orthographic framing.

## Comfort and material clarity

`after-comfort-straight-stairs-top-1440.jpg`: six straight tread boundaries visible. Curved treads are covered by the 18 normal matrix captures. `after-comfort-{sunshelf,hydro-A,hydro-B}-top-{1440,390,430}.jpg`: all nine cases PASS for visible distinction of shelf/steps/bench/partition boundaries, no wireframe triangles. These are 6×3 samples, not a claim of every comfort orientation.

## Names, images, IT/EN and state

Real UI confirms one Gres porcellanato / Porcelain stoneware parent with exactly four conditional choices: Grigio/Grey, Avorio/Ivory, Beige, Greige. Opening the parent did not itself replace the selected Ipè. Selecting a child applied the corresponding colour while keeping coping and paving independent. Child cards use colour names only; summary includes material plus colour. No numbered finish names were visible.

Ipè wood, Light travertine and Veined travertine match their corresponding supplied photographic swatches and distinct actual 3D surfaces. The gres colour differences are subtle under scene lighting; an initial suspicion of an unchanging grey shader was NOT reproduced: settled Beige is warmer and Ipè changes clearly to longitudinal brown/taupe boards. This is not a newly confirmed defect.

Evidence: `after-materials-gres-greige-{it,en}-1440.jpg`, `after-materials-paving-{avorio,grigio,beige,ipe,travertino-chiaro,travertino-venato}-1440.jpg`, `after-materials-travertines-en-1440.jpg`. IT→EN→IT preserved selected Greige coping, separate paving, 12×5 dimensions, camera-focus DOM value and expanded wizard. Full translated visible names, descriptions and swatch alt text were observed. `independent-language-state.json` records before/English visible state; `independent-dom-metrics.json` records exposed canvas/panel metrics.

## Limits and handoff

No source, backend, email, PDF, quote, RLS or cloud-persistence implementation or tests were performed by this reviewer; those gates cannot be inferred from these screenshots. No new shader errors were observed; existing `Texture marked for update but no image data found` warnings remain and are not labelled resolved. Two transient UI-tool timeouts recovered on a fresh state read; no repeatable application failure was attributed to them. No benchmark was collected by this reviewer. Tab was navigated to about:blank after evidence collection so only the coordinator's benchmark scene can be active.

## Isolated-source smoke on port 3005

Initial `vite preview` attempt failed with ERR_MODULE_NOT_FOUND for `dist/server/server.js`; evidence `production-smoke-3005-start-error.jpg`. Coordinator then served the isolated source snapshot in DEV mode. These browser observations are NOT production-build/browser validation.

On the corrected DEV server, explicitly verified 8×4 Rettangolare selected. Gres parent/four colours, Avorio → Ivory, Ipè and travertine names work; language retains material, dimensions and expanded panel. Evidence `isolated-source-smoke-3005-names-en-1440.jpg`, `isolated-source-smoke-3005-overview-1440.jpg`.

New release-snapshot discrepancy reported: top390 pool approximately x11–314 (centre162) although canvas width is390 and no technical panel is active. Left11/right76 margins are asymmetric, unlike working3003's x47–342 (centre195). Both Italian and English give the same geometry; language reset is not the cause. Full pool remains visible without clipping, but centred-framing gate is NOT yet PASS on this isolated snapshot. Evidence `isolated-source-smoke-3005-top-{it,en}-390.jpg`, exposed DOM metrics `isolated-source-smoke-dom.json`. No hidden React/store inspection. Tab returned to about:blank pending correction.

**Isolated-source retest after correction: PASS.** Coordinator included the missing top-only mobile-tools-row occluder dependency, without unrelated WIP. Direct browser retest 8×4 rectangle on3005 at390/430/1440, same Scene/Day panel expanded, now centres the mobile basin:390 x47–342,430 x18–411. Desktop fits within measured free area below the HUD. No controls cover coping, no clipping, stair curves continuous, no mesh triangles. Evidence `isolated-source-retest-3005-top-{390,430,1440}.jpg`; DOM orthographic/top recorded in updated `independent-dom-metrics.json`. English names and selected Ivory/Veined travertine remain correct. Earlier failed captures are preserved but superseded by these retests. Final tab again about:blank, no active reviewer scene.
