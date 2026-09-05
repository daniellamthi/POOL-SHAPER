# Realism scorecard

Scores are out of 10. This is the first time this file has been created, so
there is no prior score to diff against -- treat these as a code-inspection
baseline, not a rendered visual-QA pass (no browser/dev-server session was
run this session; see `docs/AUTONOMOUS_STATE.md` for why). Re-score with an
actual render whenever one becomes possible, and do not inflate.

| Area | Score | Basis |
|---|---:|---|
| Geometry | 7 | Curve-aware camera/skimmer logic and vertical layout are unit-tested and now pass (`npm run test:geometry`, 72 camera poses); true parallel-offset for custom shapes not yet confirmed (roadmap #3). |
| Liner | 6 | Real per-color underwater absorption/scattering tuning (`config.ts`) and derived normal+roughness from the base photo (`getDerivedDetailMaps`); no AO map yet (AB-002). |
| Mosaic | 6 | Same derived normal+roughness pipeline as Liner; anti-tiling not yet audited (AB-004). |
| Coping | 6 | Triplanar procedural stone detail (`createTriplanarDetailMaps`) already wired with normal+roughness. |
| Water | 7 | P1-C dual-scale normal/Fresnel pass documented in `docs/P1-C_WATER_BASELINE.md`; not re-verified visually this session. |
| Skimmer | not scored | Not audited this session. |
| Overflow | not scored | Not audited this session. |
| Lighting | not scored | Not audited this session. |
| Camera | 7 | Deterministic per-intent poses now correctly regression-tested end to end (previously silently broken -- see AUTONOMOUS_DECISIONS.md). |
| Shadows | not scored | Not audited this session. |
| Reflections | not scored | Not audited this session. |
| Close-up quality | not scored | No render captured this session. |
| UI integration | not scored | Not audited this session. |
| Mobile | not scored | Not audited this session. |
| Performance | not scored | No profiling run this session; see `docs/PERFORMANCE_REPORT.md` for the last recorded figures. |
| Commercial polish | not scored | Not audited this session. |

## What moved this session
- Camera: from **broken test coverage** (a real regression test failing on
  its very first case, silently, for at least two prior checkpoints) to
  **fully passing** -- no rendered behavior changed, only the test's
  invariant was corrected to match the intentional Liner/Mosaic framing
  design. This is a credibility/trust fix, not a visual one.
