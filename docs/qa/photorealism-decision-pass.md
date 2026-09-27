# Infinity photorealism decision pass — DISCARD

## Scope and decision

Branch `feat/premium-infinity-waterline-v1`; current WIP preserved. Exactly three specialists contributed: realtime water, GPU performance, architectural PBR review. Coordinator alone edited application files and controlled the in-app preview; GPU specialist analyzed captured timer data because that agent could not access the IAB. No commit, push or deployment.

One candidate only: Infinity basin, crest, attached film and receiver use HDR specular radiance weighted once by dielectric Fresnel through alpha compositing, with transmission and planar reflection captures disabled. Existing normal fields, submerged absorption, caustics, geometry and global lighting remain unchanged. CPU metalness stays zero; shader-local unit reflectance obtains the unweighted specular radiance before Fresnel compositing. No scene-color lookup means no displaced foreground copies. This is an approximate display-space compositing technique, not full physical transmission.

**DISCARD:** actual general and close-up comparisons fail the visual gate. The pale sky reflection is reduced and the far wall becomes dark/sharp; the pool reads more like an empty basin. Sand/Grey remain distinguishable and the ladder retains its metallic highlight and single silhouette, but the water–floor relationship does not improve. An independent PBR reviewer inspected all four image pairs and reached the same verdict. No extra parameter variants were attempted.

## Evidence, identical conditions

Infinity rectangle 10 × 4.5 m, depth 1.5 m, side 4, Sand (and Grey for liner detail), day, exposure 0.95, viewport 1038 × 934, canvas 540 × 827 CSS / 1080 × 1654 physical, DPR 2. Animation phase fixed at 24 for water and caustics. Existing camera presets used; no camera source edits. Sidebar scroll differs in some pairs, but canvas framing is unchanged. Immediate deck is the approved limestone material; configured coping remained Travertino, unchanged.

| View | Original | Rejected candidate |
|---|---|---|
| General Sand | ![Original general](photorealism-decision-pass/decision-sand-general-original.png) | ![Candidate general](photorealism-decision-pass/decision-sand-general-candidate.png) |
| Sand floor/wall | ![Original Sand detail](photorealism-decision-pass/decision-sand-detail-original.png) | ![Candidate Sand detail](photorealism-decision-pass/decision-sand-detail-candidate.png) |
| Grey floor/wall | ![Original Grey detail](photorealism-decision-pass/decision-grey-detail-original.png) | ![Candidate Grey detail](photorealism-decision-pass/decision-grey-detail-candidate.png) |
| Inox | ![Original inox](photorealism-decision-pass/decision-sand-inox-original.png) | ![Candidate inox](photorealism-decision-pass/decision-sand-inox-candidate.png) |

Candidate interaction evidence: [orbit/zoom](photorealism-decision-pass/decision-candidate-orbit.png), [side 2](photorealism-decision-pass/decision-candidate-side2.png), [8 × 3 m side 2](photorealism-decision-pass/decision-candidate-8x3-side2.png), [mobile emulated 390 × 844](photorealism-decision-pass/decision-candidate-mobile.png), [mobile orbit](photorealism-decision-pass/decision-candidate-mobile-orbit.png). No real phone test. Movement was checked separately with animation unfrozen; no displaced ladder/coping copies observed, but empty-basin appearance persists. No performance claim from interaction screenshots.

Quick non-Infinity checks: [Skimmer](photorealism-decision-pass/decision-skimmer-check.png), [Visible Overflow](photorealism-decision-pass/decision-overflow-check.png). These are smoke checks, not a full geometry matrix. Candidate was explicitly Infinity-only.

## Profiling

WebGL2 `EXT_disjoint_timer_query_webgl2`, nonnested queries around each top-level render; main + secondary render time summed per RAF. Disjoint frames rejected. 120 warm-up frames then 120 measured frames/window; shader changes warmed and pending queries drained. Camera matrix, canvas, DPR and exposure identical across windows. Phase 24. No build/test jobs during measurement. RAF is callback interval, not GPU time. Secondary renders here are the existing planar reflection; dedicated post-processing is disabled by the current scene quality settings.

| Window | GPU median ms [P25–P75] | RAF median ms |
|---|---|---|
| Original 1 | 30.27 [24.74–36.66] | 33.10 |
| Original 2 | 44.21 [38.73–50.54] | 51.60 |
| Original 3 | 71.01 [60.08–84.43] | 76.30 |
| Original 4 | 60.40 [55.89–65.06] | 68.60 |
| Original 5 | 59.18 [48.83–86.91] | 58.30 |
| Candidate 1 | 10.37 [9.89–11.15] | 14.00 |
| Candidate 2 | 25.80 [19.43–31.11] | 31.50 |
| Candidate 3 | 9.41 [9.18–9.97] | 12.90 |
| Original return 1 | 58.16 [50.49–73.27] | 58.50 |
| Original return 2 | 41.90 [35.95–66.81] | 43.30 |
| Original return 3 | 43.20 [37.70–60.63] | 44.10 |

Median of window medians: original 59.18 GPU / 58.30 RAF, candidate 10.37 GPU / 14.00 RAF. Large temporal drift prevents a reliable fixed percentage or FPS promise. Structural reduction verified: 34 calls/frame candidate versus 67–71 original; candidate secondary reflection time zero. Historical 86–91 ms was not reused as a paired baseline.

One-element isolation with original: no transmission 25.34 [21.35–27.47] ms, 34–38 calls versus surrounding baseline 44.21/71.01. This supports removal of the capture+transmission shader cost, not separate quantification of refraction alone. No planar reflection 44.84 ms, no caustics 62.12 ms, no environment 101.05 ms: drift prevents causal cost claims for these interventions. Original reflection direct timer means ranged 1.06–6.53 ms/frame, including frames without a capture. No asset-loading cost inferred from these steady-state IBL tests.

Raw samples: [original/isolation](photorealism-decision-pass/decision-profile-original.json), [candidate](photorealism-decision-pass/decision-profile-candidate.json).

[Return-to-original bracket](photorealism-decision-pass/decision-profile-return.json): three further windows at identical settings confirm original cost rises again. Candidate medians and IQR are below all return windows; removing transmission and reflection passes produces a clear reduction in this test, but strong device variability still precludes a fixed percentage or universal FPS promise. The faster candidate fails the independent aesthetic gate.

## Precise technical limit and next decision

Current anti-copy fallback zeroes raster optical thickness before whole-scene refraction sampling; this avoids displaced emerged objects, but removes contour bending. The single-pass candidate eliminates that expensive capture yet cannot reconstruct the submerged spatial relationship: alpha + HDR reflections leave hard floor/wall outlines intact. Changing hue/ripple amplitude cannot supply the missing information.

Next single scoped decision: a separate **basin-only color + linear-depth capture**, replacing (not adding to) whole-scene transmission, with bounded depth-aware refraction and rejection at coping/ladder discontinuities. Use reconstructed water-to-surface path for absorption and controlled HDR Fresnel. This needs its own visual and GPU gates; it is not implemented in this pass. The Infinity falling-film readability remains open and was not retuned.

## Final state

Candidate and temporary profiling/freezing hooks removed. `WaterSurfaceMaterial.tsx`, `PoolModel.tsx`, `InfinityEdge.tsx` and unchanged `water-transmission-audit.mjs` compare byte-for-byte identical to session-start copies. No application code retained from this pass. Only this report and its evidence directory are new deliverables. Prior WIP was not reset, stashed or discarded.

Final checks PASS: TypeScript `tsc --noEmit`; 13 water/shadow source contracts; six liner contracts plus four mapping/lifecycle checks; caustics texture/distribution/motion and six-liner receiver contracts; exterior-light-mask injection and 12 classifications; Vite client/SSR/Nitro build; `git diff --check`. Existing chunk-size and tsconfig-plugin warnings remain, no deployment command run. Technical PASS does not change aesthetic DISCARD. Preview remains the original approved WIP at `http://127.0.0.1:49872/`.
