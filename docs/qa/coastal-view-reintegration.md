# Infinity coastal view reintegration

Scope: current WIP, `feat/premium-infinity-waterline-v1`. No commit, push or deployment.

The previously discarded landscape was not restored. This pass adds an original four-draw environment: two asymmetric three-dimensional headlands, a low distant island and a separate sea surface. Camera and landscape use the selected edge's outward frame. Existing HDR illumination is retained; visible sky uses the existing procedural dome. The near terrain grade is preserved for 4.5 m beyond the selected edge, then descends below sea level. No pool water, containment, stairs or UI changes.

Application files: `PoolScene.tsx`, `DaylightEnvironment.tsx`, new `CoastalVista.tsx`, new `coastalLayout.ts` in `src/components/pool/three`.

Actual preview checks: rectangular 10 × 4.5 m and 8 × 3 m, depth 1.5 m, Infinity sides 2 and 4; panorama persists after side changes; orbit and zoom work. Final view restored to 10 × 4.5 m, side 4. Desktop only this pass. The original and final screenshots use the same pool configuration; camera intentionally changes because the initial coastal framing is part of this task. Guides are hidden in the final image.

- Before: `/private/tmp/coast-reintegrate-before.png`
- After: `/private/tmp/coast-reintegrate-after.png`
- Side 2: `/private/tmp/coast-reintegrate-side2.png`
- Smaller pool: `/private/tmp/coast-reintegrate-8x3.png`
- Smaller pool, side 4: `/private/tmp/coast-reintegrate-8x3-side4.png`
- Orbit: `/private/tmp/coast-reintegrate-orbit.png`

TypeScript, production build, git diff --check PASS. Existing Infinity containment audit PASS (26 closed shells, receiver/deck fascia and portrait framing checks). Targeted coastal finite position/normal/color and camera orientation checks PASS for two sizes and two sides. Build warnings about chunk sizes/tooling remain; no unrelated tooling changes.

Visual outcome: clear improvement in composition and environmental depth compared with the former uniform ground; not photographic parity. Rock surfaces remain synthetic, and the existing near-ground material remains visible in lateral views. No claim of improved Infinity film readability. No GPU/RAF measurements or mobile validation in this pass. Generated geometry and procedural materials are original; no external assets added.
