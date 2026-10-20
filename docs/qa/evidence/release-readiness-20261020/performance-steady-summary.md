# Controlled steady rendering — 2026-10-20

PASS within this one-scene desktop comparison: no consistent frame-time regression. No FPS improvement or mobile-hardware claim.

Actual foreground Chrome, Apple M1 Pro ANGLE Metal, 1440×900/DPR1, Experience preset/4096 shadow map. One owned active scene; coordinator IAB preview remained open in background, an uncontrolled residual load common to both versions. CPU tests/builds paused during collection. A1/B1/A2/B2/A3/B3, three complete warmed existing DEV windows per run, at least243 actual R3F frame samples/window. No profiler, manual camera-state access or quality change.

Exact common visible configuration: local QA new 8×4×1.5 m rectangular in-ground reinforced-concrete Skimmer/Slim; Sun Shelf default3.035m, no purchased loungers/other equipment; Sand Beach179 liner, Travertine coping, Gres60×120 paving; Day, review perspective, voluntarily collapsed dock. Exact recorded DOM SHA256 is identical for all6runs: `947399ade554b9a0682c4f5117c4fbc6297cdba6987e2450ccc693aa69f99c8d`; canvas DOM camera metadata/size also identical. Real matching screenshots show same full-pool framing, not a substituted camera.

| Pair | Baseline median ms | Candidate median ms | Baseline max window p95 ms | Candidate max window p95 ms |
| --- | ---: | ---: | ---: | ---: |
| 1 | 8.2 | 8.3 | 9.2 | 10.9 |
| 2 | 8.3 | 8.3 | 9.0 | 9.0 |
| 3 | 8.3 | 8.2 | 9.2 | 9.2 |

Per-run median is median of three window medians; p95 is maximum of three window p95s, not pooled raw frames. Median run values8.3ms each; median run max-window-p95 values9.2ms each. Observed dominant pass79calls/35,558triangles in both. Some baseline samples report internal reflection pass4calls/3,088triangles; these are not full-frame totals or optimisation evidence.

Resources: pair1both55geometries/36textures; pair2both53/29; pair3baseline53/29, candidate52/27. Cache/garbage-collection lifetime is uncontrolled; these counts do not establish GPU allocated memory or a memory saving. Browser heap/GPU timing/VRAM bytes unavailable. Browser-safe evaluate exposes neither `performance` nor `PerformanceObserver`; exact per-input latency remains separate from these windows.

Baseline identity: `performance-baseline-identity.json`; isolated Vite package links and private `.vite` cache avoid shared optimiser collisions, application source unchanged. Candidate hashes captured immediately after collection in `performance-candidate-steady-source.sha256`, before parser guard/input instrumentation work. The shared original dependency-cache attempt produced React hook errors and was excluded, then fixed using isolated tooling only. No existing user drafts/tabs modified: candidate used separate `release-perf.localhost:3003` origin.

Raw18window payloads, exact DOM snapshots and camera metadata: `performance-steady-raw.json`. Captures: `performance-{baseline,candidate}-pair{1,2,3}.png`. Later rendering/configuration changes require scoped remeasurement; parser-only error guards do not alter the valid measured configuration.
