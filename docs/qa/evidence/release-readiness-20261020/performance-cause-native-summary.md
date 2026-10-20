# Native GL attribution — DEV only, 2026-10-20

Status: responsiveness / FRAMETIME gate remains **FAIL** despite the earlier matched steady medians around 8.3 ms. These measurements demonstrate candidate DEV stalls, not a production failure or a proven baseline-to-candidate regression.

Chrome, Apple M1 Pro / ANGLE Metal, 1440×900, visible QA origin; 8×4 Infinity/glass, Night, two blue wall LEDs. Exact raw logs: `performance-cause-native-stage1.json` and `performance-cause-native-final.json`. No shader/source/argument/return values or PII were captured.

| Action | Trusted click → second rAF | Program/shader log + program-parameter query time | New linked programs |
| --- | ---: | ---: | ---: |
| Wet presentation → dry system | 2698.3 ms | 2064.8 ms (76.5%) | 17 |
| Dry system → wet presentation | 4100.1 ms | 3866.3 ms (94.3%) | 28 |
| Micro ON, needed to prepare the requested OFF test | 6408.4 ms | 6267.1 ms (97.8%) | 37 |
| Micro OFF, immediately afterwards | 113.4 ms | No program queries in this window | 0 |

The micro ON query totals were `getProgramInfoLog` 2123.9 ms / 37 calls, `getShaderInfoLog` 2677.3 ms / 74, and `getProgramParameter` 1465.9 ms / 148. `compileShader` submission was 0 ms rounded; `linkProgram` submission was 1.1 ms. Buffer/texture submission, wrapped draw calls and uniform-location inspection did not account for the multi-second interval. These are synchronous JavaScript/native-call wall durations, not GPU execution times. The earlier slow micro OFF was not reproduced with this warmed two-light variant; it must not be reported as a new slow OFF reproduction.

Actual renderer capability, obtained through the app's public Three extension API: `KHR_parallel_shader_compile: true`. The single coordinator-authorized metadata-only `useEffect` in `DevelopmentRendererMetrics` caused HMR between wet/dry and micro sampling; sample IDs restart at 1 in the second stage. It did not change rendering or quality. No page JavaScript errors were reported.

## What is established, and what is not

The long wait is concentrated at native program/shader queries during first-use rendering, consistent with a driver/compiler synchronization boundary. The earlier separately timed DEV sampler audit (at most 1.8 ms) does not explain the seconds-long stall. Near-zero `linkProgram` call duration proves only that submission returned quickly, not that linking had completed.

Local Three source (`WebGLProgram.js:858–945`) calls `linkProgram`, then on first use calls program log and both shader logs **before** querying `LINK_STATUS`; afterward it constructs uniform and attribute caches. Therefore these costly calls occur after the **link request**, not after verified link completion. This probe deliberately does not record query arguments, program identities or per-call ordering; aggregate `getProgramParameter` totals cannot be separated into link status, uniform/attribute counts, or any other parameter. It cannot distinguish compiler work from driver / process synchronization inside those calls.

This does not establish that a release bundle disables shader diagnostics, that production shares these magnitudes, or that the change under review introduced them. The isolated baseline does not have identical native GL instrumentation; a matched cold regression comparison is **NOT VERIFIED**. No additional baseline run was improvised within the bounded probe.

## Narrow technical opinion — no implementation

Do not apply `renderer.debug.checkShaderErrors = false` as a fix on this evidence. It removes error visibility and the three log queries, but any unfinished compilation can move its wait to the subsequent uniform/attribute queries, first use, or draw. The current measurements identify a blocking boundary, not a demonstrated amount of removable work.

One future isolated diagnostic A/B is reasonable before committing to a larger readiness mechanism: identical fresh documents/configuration and instrumentation, shader-error checks default versus disabled **only in the isolated experimental copy**, one known cold wet transition each; compare total input→second-rAF and render wall time, not merely vanished log-query totals. Retain all GL aggregate categories, record whether waiting migrates, and reject the experiment as a fix if total blocking persists. This is a proposed experiment, not an approval to ship diagnostic suppression or a measured production optimization.

If blocking remains, actual KHR support makes asynchronous compilation a plausible next investigation. Local `compileAsync` calls ordinary `compile` then waits for each material's `program.isReady()` using KHR completion status (`WebGLRenderer.js:1487–1543`, `WebGLProgram.js:989–1003`). It is not a one-line proven application fix: normal rendering must not consume the same new programs before readiness, and main, reflection/light-count, shadow and transmission paths must be covered without changing geometry, material appearance or lighting. No existing complete raster preparation gate was found in the scoped source; see `performance-cause-existing-preparation.md`. Neither a multi-pass gate nor hidden lights / material lifetime changes were implemented.

## Method limits and handoff

Opt-in DEV wrapper covers only 14 selected GL methods, aggregates through second rAF, and adds clock overhead; timer quantization and unwrapped calls remain. Input timing is scheduling / DOM-feedback timing, not GPU or final 3D paint. CUA RPC timeouts are retained separately and are not latency measurements. There were setup actions as well as the two requested scenarios; their raw logs remain, but no new matrix or steady benchmark was run. No build, quality reduction, shader-error suppression or rendering fix was performed. QA tab was blanked/closed, viewport reset, and browser ownership transferred to E/root.
