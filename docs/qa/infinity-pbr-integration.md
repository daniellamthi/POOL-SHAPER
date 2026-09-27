# Infinity PBR integration — partial visual improvement

Branch: feat/premium-infinity-waterline-v1. Original WIP preserved; no commit, push or deploy.

## Diagnosis and retained changes

Only two application files changed in this session: `src/components/pool/three/DaylightEnvironment.tsx` and `src/components/pool/three/PoolScene.tsx`.

The coastal HDR inherited the studio environment intensity 0.24 while the direct sun stayed at 3.2. The near-white, fully metallic ladder (metalness 1, roughness .22/.24) therefore had very weak broad environment reflections despite bright diffuse surroundings. No defective rail normals or geometry were found. Infinity daytime now uses environment .85, sun 1.8 and hemisphere .12, at unchanged exposure .95, sun direction and panorama. The existing dusk interpolation consumes the same scoped daylight values; other systems and night keep their existing settings. Values are visual calibration for this capture, not universal physical standards.

Infinity's existing limestone deck normal map gains .30 instead of .12. No new maps, geometry, joints, assets or render passes. The coping geometry and materials themselves are unchanged. Stone gain is subtle; do not describe it as a complete stone-material overhaul.

An amplitude increase for the existing Infinity basin ripples made the fine repeated pattern more apparent without a convincing general-view benefit. That experiment was removed. WaterSurfaceMaterial.tsx is byte-identical to the session-start backup, including undisplaced transmission against ghost copies. No film/rollover experiment. Liner, Sand calibration, corrected caustics, stairs and Infinity containment remain unchanged.

## Visual result and evidence

VB Orchestrator routed realtime-PBR, water, architectural-lighting and performance skills. One read-only material/screenshot specialist checked the same evidence and confirmed only a modest gain, strongest on the rails. No new skills or dependencies.

General before/after: same rectangle 10 × 4.5 × 1.5 m, White liner, Travertino coping, side 4, camera, exposure and 1038 × 934 desktop viewport (canvas 540 × 827, DPR 2 when settled). Light balance is deliberately the independent variable. Animation continues: these are actual screenshots, not exact phase-locked caustic comparisons.

- Before: /private/tmp/infinity-pbr-before.png
- After: /private/tmp/infinity-pbr-after.png
- Ladder/coping detail before: /private/tmp/infinity-pbr-ladder-before.png
- Ladder/coping detail after: /private/tmp/infinity-pbr-ladder-after.png
- Ladder orbit and zoom: /private/tmp/infinity-pbr-ladder-orbit.png and /private/tmp/infinity-pbr-ladder-zoom.png
- Side 2 and orbit: /private/tmp/infinity-pbr-side2.png and /private/tmp/infinity-pbr-orbit.png
- Sand / Deep Blue selection checks: /private/tmp/infinity-pbr-sand.png and /private/tmp/infinity-pbr-deep-blue.png (during the subsequently discarded ripple trial; not evidence for the final water shader).
- Mobile 390 × 844 emulation, not a real phone: /private/tmp/infinity-pbr-mobile.png and /private/tmp/infinity-pbr-mobile-orbit.png

Rails read more silver-grey with clearer metallic highlights in the general and close views; rubber tread inserts intentionally remain dark. Wall/floor glare is slightly moderated but their smooth CG appearance persists. The overall pool does NOT yet match photographic sea quality. The panoramic sea is static; the previously documented far-field parallax and Infinity-film limitations remain open. No claim of complete acceptance of all requested defects.

Actual interactions: White → Sand → Deep Blue → White; sides 4 and 2; general/detail views; rail orbit/zoom; mobile expanded view and orbit. Reframe and selected-side panorama remain available. Temporary HMR states during probe removal were not used as final evidence.

## Performance

Temporary WebGL2 EXT_disjoint_timer_query_webgl2 around frame rendering, disjoint samples excluded, separate RAF intervals. Warm scene; windows of 180 frames after at least 120 initial warm-up frames. Same detail camera `[-3.8, 4.445817604, -4.335857783]`, quaternion `[0, .95171801, .30697366, 0]`, canvas 540 × 827, DPR 2, configuration and exposure. Transition windows and DPR 1 windows excluded. No builds/tests ran during these comparison windows. Instrumentation removed.

| Stable window | GPU mean ± SD ms | RAF mean ± SD ms |
|---|---:|---:|
| Original 10:52:27 UTC | 61.99 ± 16.68 | 69.97 ± 18.84 |
| Original 10:52:41 | 65.97 ± 20.93 | 74.83 ± 26.92 |
| Original 10:52:53 | 61.95 ± 23.22 | 69.35 ± 26.62 |
| Candidate 10:53:48 | 63.14 ± 21.54 | 76.52 ± 42.12 |
| Candidate 10:54:04 | 78.27 ± 17.11 | 88.54 ± 18.55 |
| Candidate 10:54:17 | 63.78 ± 18.88 | 71.23 ± 20.73 |

There is a slower candidate window, with large overlapping variance. These measurements neither prove a speedup nor certify stable performance; a regression cannot be ruled out. They must not be numerically compared with the previous report's 26–29 ms general-view samples as if camera/session conditions were identical. General-view samples in this session also varied substantially. Retained changes add no draw calls, maps, shadow passes or shader samples; this is a code-cost observation, not a substitute for performance measurement. Raw data: /private/tmp/infinity-pbr-all-metrics.json. No FPS improvement claimed.

## Checks

TypeScript `tsc --noEmit` PASS; production Vite client/SSR/Nitro build PASS (existing chunk/tooling warnings); 13 water/shadow contracts PASS; six-liner material/mapping/lifecycle audit PASS; corrected caustic texture/distribution/motion/receiver audit PASS; exterior light mask and 12 light/camera classification checks PASS. No thresholds or tests weakened. Git diff-check PASS. Tests do not establish photographic quality.
