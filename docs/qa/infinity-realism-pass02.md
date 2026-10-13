# Infinity realism pass 02 — DISCARD

One controlled experiment; no commit, push, merge or deploy.
Skills applied: vb-orchestrator and realtime-water-rendering. No subagents.

## Experiment and decision

The verified structural geometry was not changed. Tested a single water-only ribbon joining the horizontal crest to the attached vertical film through a 3 mm rounded turn, with continuous metric flow UVs and normals. Reused the existing falling-film material; no global lighting, main-water shader, environment or UI changes.

The optical turn remained too small/subtle at ordinary viewing distance. Neither the normal desktop view nor the mobile view made descending water immediately recognizable. This does not establish a structural defect or prove that a different shader would succeed. DISCARD: the experiment was removed, with no application changes retained from this pass.

`InfinityEdge.tsx` restored to its exact pre-experiment SHA256:
`4e5e44bb5c772cf6d512f2a3c8d0aa8d85c01a00a6a42c56dc1193af19190e95`.
The session-only `infinityFlowRibbon.ts` was deleted. Existing WIP and anti-copy protection preserved.

## Real preview evidence

Existing preview: http://127.0.0.1:49872/ . Rectangle, Sand Beach liner, inox ladder, same lighting.
Desktop comparison: 10 × 4.5 × 1.5 m, side 2, same automatic camera, 1038 × 934 viewport, 540 × 827 canvas, DPR 2.

- [Before](/private/tmp/infinity-pass02-before.png)
- [During experiment, same view](/private/tmp/infinity-pass02-after.png)
- [Closer orbit/zoom](/private/tmp/infinity-pass02-close.png)
- [8 × 4.5 m, side 3](/private/tmp/infinity-pass02-8m-side3.png)
- [8 × 4.5 m, side 2](/private/tmp/infinity-pass02-8m-side2.png)
- [Mobile emulated 390 × 844, side 3, orbit/zoom](/private/tmp/infinity-pass02-mobile.png)

Desktop sides 2/3 and lengths 10/8 m inspected. Orbit/zoom and emulated mobile inspected, not a physical phone. No obvious new duplicate-edge artifacts observed. Mobile readability still insufficient. No video captured. Desktop viewport override reset and length restored to 10 m.

## Performance and checks

Comparable baseline samples: 8.71, 8.80, 8.76, 8.60, 8.79 ms/frame; mean 8.732.
After samples at the restored comparison view: 9.92, 20.75, 20.69, 12.04, 10.03 ms/frame. High variance prevents isolating the experiment's cost; +0.30 ms budget NOT verified. Earlier samples overlapping typecheck excluded. Do not attribute all variation to the ribbon or claim a performance improvement. Main-pass draw calls observed 104 → 102; not a whole-frame draw-call total.

Typecheck and 13 targeted water/shadow source contracts PASS both during the experiment and after removal. Final build and git diff --check PASS. Build retains chunk-size and tsconfig-path warnings. No general geometry audit repeated. Technical passes are not proof of visual success.

One possible next alternative, NOT implemented: a small flow-normal atlas derived from thin-film simulation, advected continuously across crest and face, to provide spatially coherent moving specular cues without screen-space refraction copies. Requires a separate controlled visual/performance test.
