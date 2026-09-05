# Autonomous state

CURRENT OBJECTIVE
Elevate Pool Architect 3D toward ultra-premium realism/commercial quality while preserving the existing configurator flow (see `docs/IMPROVEMENT_ROADMAP.md` priority order).

CURRENT TASK
Fixed two outdated geometry-audit assertions in `scripts/geometry-audit.ts` (Liner/Mosaic camera invariants) that no longer matched the intentional camera framing added in `camera.ts`'s `getInteriorFinishCamera`. COMPLETE this iteration. `npm run test:geometry` now passes all 108 cases again.

NEXT TASK
No open regression. Resume the default roadmap order (see `docs/IMPROVEMENT_ROADMAP.md`): liner PBR completeness (normal/roughness/AO maps — `INTERIOR_TEXTURE_METADATA` currently declares base-color only), then curve-aware coping/overflow offsets.

BLOCKED TASKS
- None. (Prior roadmap items #3/#4 — curve-aware coping/overflow offsets, PoolModel edge profile/UV/tangent rework — remain High difficulty/risk; not started, no blocker recorded, just not yet attempted.)

LAST GOOD COMMIT
See `git log -1` on `claude/zen-cannon-w0go78` after this iteration's commits. `npm run build`, `npx tsc --noEmit`, `npx eslint`, and `npm run test:geometry` all clean at that commit.

KNOWN REGRESSIONS
- None currently tracked.

CURRENT REALISM SCORE
Not yet formally scored — `docs/REALISM_SCORECARD.md` does not exist yet. Water (planar reflection, dual-frequency normals, physical transmission/IOR) and lighting are visibly the most mature areas from code inspection; liner/mosaic PBR completeness (normal/roughness/AO maps) and curve-aware coping offsets are the most visibly behind the target spec. Score this properly in a future iteration once a visual QA pass is run (needs a headless render or manual screenshots — no browser screenshot harness was run this iteration to conserve tokens).

CURRENT PERFORMANCE STATUS
`ACTIVE_RENDERING_QUALITY` was previously hardcoded to `"experience"` (4K shadow maps, postprocessing, planar water reflection) for every device including mobile. Now resolved automatically at module load from `matchMedia("(pointer: coarse)")`, viewport width, and `navigator.hardwareConcurrency`, falling back to `"configuration"` on low-power devices. No runtime/reactive re-evaluation (resolved once per page load) — a deeper adaptive-DPR/frame-time-driven system (roadmap item 9, spec section 28) is future work if this heuristic proves insufficient.
