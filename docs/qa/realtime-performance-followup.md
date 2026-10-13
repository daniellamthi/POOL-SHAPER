# Realtime performance follow-up — 25 September 2026

Branch: `feat/premium-infinity-waterline-v1`. Existing WIP preserved; no commit, push or deployment.

## Kept changes

- `src/components/pool/three/WaterSurfaceMaterial.tsx`: stationary planar reflection capture capped at 15 Hz; ripple animation still updates every frame. Camera/projection changes, target resize and water elevation changes invalidate the capture. Moving-camera cadence and reflection resolution are unchanged.
- `src/components/pool/three/PoolScene.tsx`: reuse the sun's 4096 px shadow map between React configuration commits; invalidate on every scene commit. No reduction in shadow resolution, DPR or material quality.
- `scripts/water-transmission-audit.mjs`: 13 source contracts, including the anti-ghost transmission fallback and new capture/shadow invalidation guards. These are not substitutes for visual tests.

Skills actually loaded: vb-orchestrator, realtime-performance-profiler, realtime-water-rendering, shader-glsl. No installation or new subagent.

## Measurement

Same machine/IAB, experience preset, DPR 2, canvas 548 × 891. Rectangular Infinity 10 × 4.5 × 1.2 m, side 3, Grey Rock, inox ladder, cyan LEDs at 100%. Existing R3F frame-delta logger; not GPU timer queries or interaction latency.

- Before: five settled windows at 11.79, 11.69, 11.81, 11.84, 11.81 ms/frame (mean 11.788).
- First complete cold-loaded optimized scene: 10.55, 10.57, 10.45, 10.64 ms/frame (mean 10.5525).
- Final complete scene: 11.44, 11.40, 11.37, 11.45 ms/frame (mean 11.415), approximately 87–88 FPS.
- Observed improvement varies from about 3% to 10%; do not present the best window as a guaranteed gain. This does not establish recovery of the historical 13.55 → 15.56 ms regression, measured under different conditions.
- Discarded ~8.2 ms samples from an incomplete scene after hot reload. Draw-call samples alternate between mirror and main render passes; they are not total frame draw calls.

## Visual QA and limits

Orbit and zoom exercised. Side 1/3 selection exercised; changed geometry/shadows visible. Skimmer at 8 × 4.5 m inspected after cold load; restored 10 × 4.5 m and Infinity side 3 afterward. No geometry, hidden-overflow or stairs changes in this pass. Anti-ghost source guard retained; exhaustive visual certification is not claimed.

A stronger/faster film normal and lower roughness were compared at the same camera. No convincing visible improvement: that experiment was discarded and the previous film values retained. Infinity's film remains weak and the overall scene remains CG, not photographic.

The preview underwent reload/state/layout changes during QA, including an incomplete scene that recovered after cold reload. Cause was not established in this scoped pass. The requested 390 × 844 override did not affect the QA tab (screenshot stayed desktop); override reset. Mobile is NOT verified this pass. No video available.

## Real screenshots

- [Initial overview](/private/tmp/infinity-flow-before.png)
- [Final complete overview](/private/tmp/infinity-performance-final.png) — same pool configuration; panel scroll differs.
- [Side 1](/private/tmp/infinity-performance-side1.png)
- [Skimmer 8 m, complete scene](/private/tmp/infinity-performance-skimmer-8m.png)
- Film experiment, identical framing: [previous parameters](/private/tmp/infinity-film-qa-before.png), [rejected experimental parameters](/private/tmp/infinity-film-qa-after.png). These demonstrate insufficient improvement, not a delivered enhancement.

## Checks

13 targeted source contracts PASS; TypeScript PASS; production client/SSR build PASS; git diff --check PASS. Existing bundle-size and tsconfig-paths plugin warnings remain. No console errors in the final QA tab capture. Visual result and mobile acceptance remain incomplete.
