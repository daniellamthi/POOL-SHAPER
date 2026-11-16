# PDF A water-stage check — read-only

Conclusion: **no demonstrated dry-export defect**. Cover/page-6 imagery has very clear mosaic and weak water cues; that appearance alone cannot establish that the water mesh was absent. No browser, build, runtime instrumentation or application edits were performed.

Minimal source trace:

- `construction-presentation.ts`: `review`, `lighting`, `deck` and `technology` map to stage `water`, with `showWater=true`. `style` maps to dry `finish`; technical presentation is dry only when its technical flag is active.
- `PoolConfigurator.tsx:386`: construction follows the active wizard step; capture disables the technical flag via `technicalView && !cleanCapture`. `captureHero` / `captureDayNight` set clean framing, select review focus and switch only time of day. They do not explicitly freeze or override construction stage. That is not itself a demonstrated defect because the normal PDF control is in the summary of `PresentationTray`, reached at active step `review`.
- `ProjectDelivery.tsx:55–77`: the PDF action requests fresh day/night captures, chooses the appropriate image for the cover, then passes those image data URLs directly to `buildProjectBook`. The PDF writer places them; it does not render a second dry pool.
- `PoolScene.tsx:251–289`: `HeroCaptureListener` waits for idle/assets, renders the current scene/camera, then reads the canvas. No dry-mode switch exists in this capture path. `showWater` is passed through to `PoolModel`, whose water-surface mesh is conditional on that flag.
- `WaterSurfaceMaterial.tsx:592–615` and the selected premium water preset use a transmissive physical material (`transmission=1`, not an absent mesh). Sharp submerged mosaic is therefore compatible with water being active; source cannot establish whether the particular static image communicates water clearly enough.

Reload/viewer context: shared-project loading in `store.tsx:788–800` explicitly navigates to the final review step; `PoolConfigurator.tsx:459–463` selects summary. The viewer/no-edit-token branch in `ProjectDelivery` changes ownership labels/actions, not construction or water flags. Ordinary local-draft reload instead chooses the first incomplete step, which may legitimately be dry; it does not expose the normal review PDF panel until presentation is reached. No navigation-during-capture race or exact captured render-state trace was reproduced here, so neither is asserted as a bug.

Rendered source inspected: `pdf-a-page-1.png`, `pdf-a-page-6.png` from the supplied actual PDF A. No binary PDF modifications were made. A stronger claim that the actual PDF captured a dry mesh would require runtime capture-state evidence; it is not supported by this bounded source/image check.

Checkpoint receipt copied exactly, metadata only: `performance-task-checkpoint-verification.json`, SHA-256 `70f33687b74cedf6a6fb35c6f9c5986722b5d91cbf5a042588274e21e7a6389b`. It contains isolated verification results, source hashes and log paths; no log contents, caches, credentials or environment files were copied.
