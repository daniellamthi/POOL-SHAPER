# Controlled performance protocol — 2026-10-20

Status: NOT VERIFIED; collection awaits integrated candidate freeze and exclusive browser turn. October-19 evidence is historical context only. Isolated baseline is running at `http://127.0.0.1:3018/` (HTTP200), source identity in `performance-baseline-identity.json`.

## Comparison identity

Baseline must be isolated `0665d3b` plus exact pre-goal WIP backup `vPbgdc`, excluding `.env`/secrets; candidate is the same working source plus scoped final-QA changes. Preserve a manifest/hash of all compared source and assets. Run both in the same DEV mode because existing `DevelopmentRendererMetrics` is DEV-only. Do not rebuild, run a profiler, change rendering quality or edit source during collection.

Use one foreground browser tab/scene. Other scene tabs must be `about:blank`, not rendering in background. Same hardware/renderer, browser version, CSS viewport 1440×900, browser DPR and actual renderer DPR, quality preset, scene, panel state, focus, camera and fully warmed assets. Record all conditions; reject mismatched or hidden windows. Viewport-only mobile checks do not certify mobile hardware performance.

The common configuration must be valid on both versions. Coordinator-selected main fixture: local QA 8×4×1.5 m rectangular in-ground reinforced-concrete Skimmer, Sun Shelf at the same baseline default 3.035 m, same approved liner/coping/paving, daylight, review camera, voluntarily collapsed dock. Confirm exact rendered Shelf/accessory dimensions match after integration; baseline has no size-control UI. Use an already configured QA draft/reference through normal UI, preserve user draft, and make no save/share/backend mutation for performance work. Record exact visible configuration, relevant DOM camera attributes and matching screenshots. Candidate custom-size interactions have separate absolute timings; do not call that unmatched scenario a before/after pair.

## Three matched pairs

1. Warm baseline and candidate once. Record renderer/viewport/DPR/preset and settle all assets/camera; discard loading, HMR and transition windows.
2. Collect alternating A1/B1, A2/B2, A3/B3. After each navigation and settled view, discard at least the first telemetry window and keep three complete consecutive `[Pool3D performance]` windows (~2 s each). No simultaneous second scene.
3. Retain raw console payloads and a matching capture for each run. Require `visibility: visible`, identical `renderer`, `viewport`, `dpr`, `qualityPreset`, `shadowMapSize`, at least 15 frames/window and sampler budget within limit.
4. Per run report median of the three window medians; retain all p95s and report maximum window p95. Across three pairs report median run values and each paired delta. These are summaries of windows, never pooled per-frame percentiles.
5. Retain observed ranges for `calls`/`triangles`, resource counts and browser heap only if exposed. `gl.info` can expose an internal reflection pass: observed maxima are not full-frame totals, and low internal-pass counts are not an optimisation. GPU memory bytes/execution timing unavailable in current telemetry.

## Three interaction samples

Repeat the same ordinary UI sequence three times on each version, from the same warmed state: material A→B→A (same geometry/format), LED on→colour→off, detail A→detail B→review and rapid replacement before the 240 ms detail transition finishes. Record the actual accepted selected state/focus, any visible hitch and the following complete DEV window median/p95/calls/resources. Keep these transient windows separate from steady rendering samples.

Existing DEV telemetry does not timestamp individual input handling, DOM commit or 3D readiness. Thus these windows cannot be described as interaction latency. For action-to-selected-DOM timing, use only a bounded browser observation of the trusted action and first DOM state change, retain the clock/method and three raw samples, and label it DOM feedback rather than rendered-3D or GPU latency. If no reliable browser-native/event timing is available, interaction latency remains NOT VERIFIED; do not substitute tool round-trip duration. Same limitation applies to camera completion timing unless it is directly observed.

Report absolute responsiveness even if baseline is equally slow. A CPU/geometric saving alone does not imply an FPS gain. Any later source change affecting measured rendering/configuration invalidates relevant candidate samples and requires a scoped rerun.
