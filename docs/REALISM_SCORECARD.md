# Realism scorecard

No category below is scored yet. Scoring visual/material/lighting realism
from reading shader and material code alone would be a guess, not a
measurement — the operating charter explicitly says not to inflate scores,
and a number with no visual evidence behind it is exactly that. See
`docs/AUTONOMOUS_BACKLOG.md` AUTO-003: once a Playwright-based screenshot
harness exists for the deterministic camera poses the geometry audit
already proves are stable, this file should be filled in from those
screenshots and updated on every change that touches a scored file.

| Category | Score /10 | Basis |
|---|---:|---|
| Geometry | — | Numerically verified (offsets, camera poses, dimensions) via `npm run test:geometry`; not visually scored. |
| Liner | — | Not visually scored. |
| Mosaic | — | Not visually scored. |
| Coping | — | Not visually scored. |
| Water | — | Not visually scored. |
| Skimmer | — | Not visually scored. |
| Overflow | — | Not visually scored. |
| Lighting | — | Not visually scored. |
| Camera | — | Framing invariants numerically verified (72 poses); composition not visually scored. |
| Shadows | — | Not visually scored. |
| Reflections | — | Not visually scored. |
| Close-up quality | — | Not visually scored. |
| UI integration | — | Not visually scored. |
| Mobile | — | Not tested this session. |
| Performance | — | See `docs/PERFORMANCE_REPORT.md`; not re-profiled this session. |
| Commercial polish | — | Not assessed this session. |
