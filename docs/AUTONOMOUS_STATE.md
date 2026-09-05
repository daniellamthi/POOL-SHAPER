# Autonomous state

CURRENT OBJECTIVE
Elevate Pool Architect 3D toward ultra-premium archviz-grade realism while
preserving the existing configurator flow and product logic (see
`docs/IMPROVEMENT_ROADMAP.md` and `docs/VISUAL_REALISM_MAP.md` for the
standing analysis this work continues from).

CURRENT TASK
Complete. Fixed `scripts/geometry-audit.ts` (`npm run test:geometry`), which
was failing on every run: the Interior Finish (liner/mosaic) camera
invariants were written for a pre-refactor camera model and no longer matched
the intentional "liner pulled back / mosaic tight" composition already
implemented in `src/lib/pool/camera.ts` (`getInteriorFinishCamera`). The
assertions now check the real invariants (target stays on the reference wall
plane, centred on it like the Skimmer master, frontal view direction, and
Mosaic strictly tighter than Liner) instead of exact-equality checks that
could never pass under the current design.

NEXT TASK
AUTO-002 (liner/mosaic PBR map audit) is complete — see
`docs/AUTONOMOUS_BACKLOG.md`; the procedural per-photo normal/roughness
derivation already satisfies mission section 8, no source change needed.
Move to default-priority item 5: audit UV/tangent/material-scale correctness
in `src/components/pool/three/poolGeometry.ts` (winding, seam continuity
between wall/floor at corners, whether tangents are provided for
`meshPhysicalMaterial`'s normal maps) using `docs/IMPROVEMENT_ROADMAP.md`
item 4 ("Refine PoolModel edge profiles/UV/tangents") as the starting
reference. `npm run test:geometry` is the regression gate for any change
here.

BLOCKED TASKS
None currently recorded.

LAST GOOD COMMIT
(see `git log -1` on this branch after this state file's commit)

KNOWN REGRESSIONS
None known after the fix above. `npm run test:geometry`, `npx tsc --noEmit`,
`npx eslint`, and `npm run build` are all green as of this pass.

CURRENT REALISM SCORE
See `docs/VISUAL_REALISM_MAP.md` (not yet superseded by a dedicated
`docs/REALISM_SCORECARD.md` — creating that scorecard from a real visual pass
is a good candidate NEXT TASK once material/UV work above is audited).

CURRENT PERFORMANCE STATUS
Not independently re-measured this pass; see `docs/PERFORMANCE_REPORT.md` for
the last recorded baseline. No renderer/runtime code was touched.
