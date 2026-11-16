# Actual rounded pool corners — 2026-10-24

Request: selecting the dedicated coping must visibly round the actual pool
corners, not merely soften the cross-sectional arris.

Implemented one canonical configured outline: the rectangular in-ground
Sfioro nascosto (`overflow/continuous`) with explicit `copingStyle=dedicated`
has four circular 20 cm plan corners, 16 segments per quarter. Actual water,
walls, coping, paving cutout, floor, comfort/access layout, metrics, cover and
Photo Spec consume this same outline. Bounds/nominal dimensions and elevations
are unchanged. All other configurations use their previous outline verbatim.
The existing 6 mm cross-sectional profile remains a separate control.

Evidence from integrated browser:
- `dedicated-real-rounded-top.jpg`: actual 10×4.5 m scene, dedicated coping,
  rounded water/shell/perimeter corners, existing stairs/shelf/bench retained.
- `flush-original-square-top.jpg`: same project with flush coping, original
  square opening retained.
- Dedicated → flush → dedicated exercised through real wizard controls;
  no cloud writes, emails or deployments performed.

Targeted checks PASS:
- `rounded-pool-corners-audit.mjs`: 1,079 checks; 6×3, 8×4, 12×5; circular
  radius, area, bounds, winding, nondegenerate edges; physical ray tests of
  actual water, wall and coping meshes; 215 non-target combinations unchanged.
- `sun-shelf-state-audit.mjs`: 530 production-reducer/serializer/summary tests;
  saved/shared/restored Photo Spec carries the actual 68-point rounded or
  four-point square outline; existing furniture/comfort selections retained.
- TypeScript `--noEmit` and `git diff --check` PASS.

No full build, broad audit, production action or GPU performance claim for this
targeted change. Existing WIP preserved; pre-edit backup outside the repository:
`pool-shaper-wip-backups/rounded-pool-corners-20261024-cm3Yx6`.
