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
Run a scoped audit of `src/configurator/materials/interior-textures.ts` /
`src/components/pool/three/textures.ts` against `docs/VISUAL_REALISM_MAP.md`
gap #1 ("Real per-color PBR texture sets") — confirm which liner/mosaic
colors still rely on the shared procedural normal/roughness derivation vs.
authored maps, and whether AO is present. This is priority 2 in the default
order and the geometry audit script is now available again as a regression
gate for any material/UV work that follows.

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
