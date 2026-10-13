# Infinity film readability — targeted diagnosis, 25 September 2026

Branch `feat/premium-infinity-waterline-v1`; existing WIP and anti-ghost correction preserved. No retained application changes, commit, push or deployment. Skills loaded: vb-orchestrator, realtime-water-rendering, visual-reference-matching, shader-glsl. No new agents or installations.

## Evidence and scope

The live scene on port 49872 now used 10 × 4.5 × 1.5 m, mosaic, straight internal stairs and red LEDs, unlike the previous report's grey liner/1.2 m scene. Measurements below compare only this session's identical configuration, camera, canvas and DPR, not the earlier report. Background, lighting, UI and pool-water rendering were not redesigned.

Temporary diagnostics on `infinity-attached-film`:

1. Opaque magenta, ordinary depth test: the full film is visible, attached in front of the wall, reaching the receiver. This rules out wholesale occlusion in the tested view. [Depth test image](/private/tmp/infinity-diagnostic-film-depth.png).
2. Normal material: consistent planar normals, no visible triangle discontinuities. [Normals](/private/tmp/infinity-diagnostic-normals.png).
3. White metal, roughness 0.03: the reflected environment on the vertical face is nearly uniform blue-grey. The environment reflection is present, but supplies little spatial contrast in that orientation. [Reflection diagnostic](/private/tmp/infinity-diagnostic-reflection.png).

Source inspection agrees: the film is 3 mm outboard of the structural face; crest and cascade meet at the same offset and elevation; cascade bottom meets receiver elevation. Depth testing is enabled, depth writing disabled on the water, order 2. No geometric change was justified by these observations.

## Minimal optical experiment — rejected

Replaced only the falling film's screen-space transmission with a thin Fresnel-weighted specular composite over the actual wall. Existing geometry, normals, roughness, basin shader and environment were unchanged. This tests whether wall resampling is the dominant loss of readability, rather than repeating the previous normal-strength/roughness adjustment.

Same-camera images: [original material](/private/tmp/infinity-film-optical-before.png), [experimental composite](/private/tmp/infinity-film-optical-trial.png). No convincing gain in flowing-water readability. Orbit/zoom also did not establish a benefit. Experiment fully removed; original material restored. All temporary diagnostic materials removed.

The observations narrow the limitation to insufficient optical variation on the vertical interface, rather than hidden geometry or a missing channel. They do NOT prove a unique global lighting defect. The nearly uniform reflected field plus weak flowing-normal cues leaves the underlying stone dominant. A next alternative to validate is a dedicated metric falling-film slope/flow field and orientation-correct local reflection response, with continuity at the crest/receiver—not opacity, emission, exaggerated thickness or changes to the basin refraction. That alternative is not implemented or claimed validated here.

## QA

- Live desktop: Infinity sides 2 and 3, 10 × 4.5 and 8 × 4.5 m; depth 1.5 m. Restored 10 m afterward.
- [8 m / side 3](/private/tmp/infinity-diagnosis-8m.png), [8 m / side 2](/private/tmp/infinity-diagnosis-8m-side2.png).
- Real preview in **emulated 390 × 844 viewport**, not a physical phone: orbit and zoom worked, whole front and collection remained visible. [Mobile screenshot](/private/tmp/infinity-diagnosis-mobile.png). Viewport override reset.
- Video not available through the exposed browser tools; screenshots are not presented as video proof.
- Performance, fixed frontal side-2 view, canvas 548 × 891, DPR 2, experience preset: original 9.18/9.18/9.18 ms; experiment 9.70/9.54/9.67 ms (mean 9.64). About 5% slower in this short sample, not a statistically controlled GPU benchmark. Samples during DPR 1 transitions excluded. Since the experiment was discarded, no delivered performance improvement/regression is claimed.
- No shader errors in the captured console.

## Technical checks

- TypeScript: PASS.
- 13 water/shadow source contracts: PASS.
- Targeted Infinity containment audit: PASS, 26 closed shells plus deck-fascia and portrait-framing checks.
- Client/SSR production build: PASS, existing chunk-size and tsconfig-paths warnings.
- git diff --check: PASS.
- Broader geometry audit: **FAIL**, `caustic field must remain sparse and low-energy`. Caustic code/test was not changed in this session; do not report this suite as passing or silently weaken its assertion.

Outcome: diagnostic cause narrowed, mobile QA completed, visual goal **not achieved**. Only this report is retained from the session.
