# Coordinated realtime water lookdev — DISCARD

2026-09-27 · feat/premium-infinity-waterline-v1. One candidate only; no commits, push or deployment.

## Scope and outcome

The candidate combined world-space receiver transport with an HDRI-only water interface. It removed physical transmission for Infinity water only; Skimmer/Overflow were not changed. No new texture, sampler, render target, scene capture, screen-space refraction, geometry, camera, environment or UI was introduced. The existing Infinity film reused the same interface and its existing normal fields.

Receivers used the real waterline and world Y, Snell-limited view path, one common clear-water extinction coefficient rather than liner-specific tint, attenuated incoming direct light, restrained indirect scattering and desaturation, a slope-aware wall-foot contact term and a small variation from the existing caustic field. The caustic field and its transfer were not increased. The actual liner remained the albedo source.

**Visual gate failed:** Sand lost the useful aqua cue without gaining convincing volume. The pool reads as an empty basin, especially in the wall/floor view. Grey remains readable but is not clearly more photographic. The unchanged geometric wall/floor boundary remains hard. Material shading alone did not supply the missing apparent refraction/volume under these constraints. No second candidate or parameter iteration was attempted.

All application edits and the temporary fixed-time/profiling module were removed. WaterSurfaceMaterial.tsx, PoolModel.tsx and InfinityEdge.tsx compare byte-for-byte with their pre-session WIP copies. No test expectations were relaxed.

## Comparisons

Infinity rectangle 10 × 4.5 × 1.5 m, side 4, Sand, stainless ladder, day. Water and caustic time fixed to 24 seconds only during capture; animation restored on cleanup. General comparison uses the same summary camera, 1126 × 934 viewport, 1256 × 1654 drawing buffer (DPR 2), exposure 0.95. General pool camera position [15.6263977895, 7.5227988297, 6.4343990898], quaternion [-0.1874982203, 0.5420869195, 0.1255661940, 0.8094561878].

- [Original general](/private/tmp/lookdev-before-general.png) / [Candidate general](/private/tmp/lookdev-candidate-general.png).
- [Original Sand detail](/private/tmp/lookdev-original-sand-detail.png) / [Candidate Sand detail](/private/tmp/lookdev-candidate-sand-detail.png).
- [Original Grey detail](/private/tmp/lookdev-original-grey-detail.png) / [Candidate Grey detail](/private/tmp/lookdev-candidate-grey-detail.png).
- [Candidate orbit](/private/tmp/lookdev-candidate-orbit.png) / [Candidate mobile emulation 390 × 844](/private/tmp/lookdev-candidate-mobile.png).

Desktop general, Sand/Grey wall-floor detail, a manual orbit and mobile emulation were inspected. No obvious duplicated coping/ladder was visible in those captures, but this is not a complete anti-copy visual certification. Dedicated internal-stair, low-water, second-side, zoom and complete seven-view comparisons were not completed after the empty-basin gate failed. No claim of 5/7 views passing. No physical phone tested. Infinity sheet continuity and Skimmer/Overflow visual regression were not revalidated in this discarded candidate.

## Performance — limited to this general view

Temporary EXT_disjoint_timer_query_webgl2 queries enclosed top-level renderer.render calls (nested transmission included); separate calls were summed per RAF interval. Disjoint results were excluded. RAF deltas were separately recorded. 120 RAF intervals warm-up, then 10 consecutive windows of 30 frames. These are contiguous windows, not 10 separate reloads or independent device trials. Same camera matrices, viewport, DPR, exposure and frozen animation phase in the stored records. Compilation/loading not intentionally included in timed windows; no render-pass-specific isolation claim.

| Metric | Original | Candidate |
|---|---:|---:|
| GPU median of window medians | 3.784 ms | 1.435 ms |
| GPU window-median interval | 3.750–3.930 ms | 1.036–1.573 ms |
| GPU window MAD | 0.024 ms | 0.076 ms |
| GPU individual-frame interval | 3.449–6.080 ms | 0.672–3.419 ms |
| RAF median of window medians | 8.300 ms | 8.325 ms |
| RAF window-median interval | 8.200–8.450 ms | 8.300–8.650 ms |
| RAF window MAD | 0.050 ms | 0.025 ms |
| Peak linked-program sampler count | 12 | 12 |
| Renderer tracked textures | 25 | 24 |
| Summed draw calls/RAF median | 105 | 53 |
| Draw-call interval | 105–114 | 53–53 |

[Original raw samples](/private/tmp/lookdev-original-profile.json) · [Candidate raw samples](/private/tmp/lookdev-candidate-profile.json).

The lower GPU timer result does not rescue failed visual quality. RAF intervals overlap: no FPS improvement claimed. These measurements are not comparable with prior 86–91 ms detail-camera runs. Intermittent background-only screenshots after reload required Reframe in both states; no claim that this existing presentation issue was fixed, and this limits confidence in extrapolating the general-view timers. Mobile GPU cost was not measured. Texture counts describe renderer-tracked resources, not per-draw bound texture units.

## Final checks on restored WIP

- TypeScript noEmit: PASS.
- 13 water/shadow/anti-copy source contracts: PASS.
- Caustics audit: PASS, six liners; texture mean 0.065479, gradient maximum 20.
- Production build: PASS; existing chunk-size/plugin warnings remain.
- git diff --check: PASS.
- No shader/profiling/frozen-time code retained. Only this diagnosis and external screenshots/samples were retained.
