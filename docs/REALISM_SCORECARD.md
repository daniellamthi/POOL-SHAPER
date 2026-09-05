# Realism scorecard

Scores /10, current best judgment against the finished-product standard in the
autonomous system prompt. Not re-derived from scratch each session — only
updated when a change plausibly moves one row; see docs/AUTONOMOUS_STATE.md
for what changed most recently.

| Area | Score | Why |
|---|---:|---|
| Geometry | 7 | Curve-aware basics exist; custom-shape offset/bevel robustness still on roadmap (#3–4). |
| Liner (PVC) | 7 | Real per-color photographed base colour + derived normal/roughness/AO from that same photo (this session added AO). No dedicated normal/roughness/AO photo set yet — still derived, not photographed. |
| Mosaic | 6 | Same derived normal/roughness/AO pipeline as liner; anti-tiling not yet addressed for large walls. |
| Coping | 6 | Procedural triplanar stone detail (normal+roughness); no AO yet. |
| Water | 8 | Extensively tuned physical water (see docs/P1-C_WATER_BASELINE.md): dual-scale normals, IOR-correct Fresnel, depth-based absorption/scattering, restrained caustics. |
| Skimmer | 6 | Dedicated component (Skimmers.tsx) with real proportions; not yet audited against section 17's full variant set. |
| Overflow | 6 | Working channel/edge geometry; not yet audited for custom-shape correctness. |
| Lighting | 6 | Calibrated showroom rig exists; day/night/golden-hour variants not yet built. |
| Camera | 6 | Deterministic per-step shot system exists (camera.ts); one known regression in the liner-intent shot on a specific rectangle size (see AUTONOMOUS_STATE.md). |
| Shadows | 6 | Standard cast/receive shadows in place; not specially profiled this session. |
| Reflections | 6 | Env map + planar water reflection; no SSR/premium tier yet. |
| Close-up quality | 6 | Derived-photo detail maps help; not validated with dedicated close-up QA shots. |
| UI integration | 7 | Minimal, existing step flow preserved; not restyled this session. |
| Mobile | Not verified | No device/profile pass this session. |
| Performance | Not verified | No profiling run this session (see PERFORMANCE_REPORT.md for last full pass). |
| Commercial polish | Not verified | Out of scope this session. |

Every score above pre-dates this session except Liner and Mosaic, which moved
from "no AO" to "derived AO from the real photo" — see AUTONOMOUS_STATE.md for
the concrete diff.
