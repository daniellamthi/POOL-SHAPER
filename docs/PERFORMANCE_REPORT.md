# Performance report

## Current strengths

- Scene is client-only and lazy-loaded; WebGL is excluded from SSR and initial route chunk.
- `PoolViewport` is memoized.
- Provider memoizes outline, metrics, skimmer plan and Context value.
- Configurator memoizes resolved materials and stabilizes local callbacks.
- Geometry is memoized and explicitly disposed.
- Cloned/procedural textures are explicitly disposed.
- DPR is capped at 1.5; `preserveDrawingBuffer` is false.
- Contact shadows render one frame; environment is local at resolution 128.
- Camera stops interpolation at thresholds.
- Color/accessory changes do not rebuild domain geometry.
- Geometry audit covers 108 shape/dimension/system cases.

## Costs and bottlenecks

| Area | Cost/risk | Severity |
|---|---|---:|
| Three client chunk | ~1 MB minified before gzip; dominant lazy chunk | Medium |
| Context granularity | Every consumer receives one broad value and rerenders on any state change | Medium |
| Custom outline | ≥128 points means many wall triangles/ring triangulations | Low-medium |
| Texture cloning | Floor/wall clones recreated when perimeter/depth/tile source changes | Low |
| Procedural textures | Three 256² maps generated synchronously on mount | Low |
| Skimmers | Repeated geometries/material JSX; no shared instancing | Low at residential counts |
| Transparent water | Transmission and overdraw increase GPU work | Medium on integrated GPUs |
| Shadows | 1024 directional map plus physical materials | Medium |
| DoubleSide | Walls/rings render both sides | Medium but avoids winding artifacts |
| Shape offset | Bounding-box radial scale is cheap but not true constant offset | Visual correctness risk |

## Re-render analysis

Reducer immutability is correct. Broad Context means a customer keystroke also rerenders viewport ancestors; memoization prevents some deeper work, but object props like config-derived arrays can still reach R3F. Splitting state selectors would reduce CPU churn, but is a refactor and should follow profiling.

## Recommended measurements

Use React Profiler for step/customer updates; R3F `performance`/browser GPU timeline for transmission and shadows; track geometries/textures/program counts via renderer info; test device pixel ratios 1 and 1.5; compare Rectangle versus 128-point Custom.

## Safe optimization order

1. Add performance telemetry and budgets.
2. Share skimmer geometries/materials.
3. Add adaptive DPR/quality tier.
4. Cache generated CanvasTextures at module/provider level.
5. Consider Context selectors only with regression tests.
6. Add optional higher visual tier rather than raising baseline GPU cost.
