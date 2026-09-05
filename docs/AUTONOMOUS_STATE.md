# Autonomous state

CURRENT OBJECTIVE
Elevate Pool Architect 3D toward ultra-premium realism/commercial quality while preserving the existing configurator flow (see `docs/IMPROVEMENT_ROADMAP.md` priority order).

CURRENT TASK
Automatic rendering quality tier (mobile/low-power devices no longer forced onto the "experience" tier — see `src/configurator/3d/scene/visual-preset.ts`). COMPLETE this iteration.

NEXT TASK
Investigate geometry-audit failure: `rectangle-10x4.5/in-ground: Interior Finish changed the reference wall target` (pre-existing, not caused by the quality-tier change — reproduced on `4cddd3f` before any edits). Root-cause in `scripts/run-geometry-audit.mjs` / `src/lib/pool/geometry.ts` / `src/lib/pool/materials.ts`.

BLOCKED TASKS
- None new this iteration. (Prior roadmap items #3/#4 — curve-aware coping/overflow offsets, PoolModel edge profile/UV/tangent rework — remain High difficulty/risk; not started, no blocker recorded yet, just not yet attempted.)

LAST GOOD COMMIT
See `git log -1` on `claude/zen-cannon-w0go78` after this iteration's commit. Build (`npm run build`) and typecheck (`npx tsc --noEmit`) both clean at that commit. `npm run test:geometry` FAILS at that commit (pre-existing regression, see NEXT TASK) — this is a known, tracked issue, not a new one.

KNOWN REGRESSIONS
- `npm run test:geometry` fails: "rectangle-10x4.5/in-ground: Interior Finish changed the reference wall target". Confirmed pre-existing (reproduces on parent commit `4cddd3f` with no changes applied). Not yet root-caused.

CURRENT REALISM SCORE
Not yet formally scored — `docs/REALISM_SCORECARD.md` does not exist yet. Water (planar reflection, dual-frequency normals, physical transmission/IOR) and lighting are visibly the most mature areas from code inspection; liner/mosaic PBR completeness (normal/roughness/AO maps) and curve-aware coping offsets are the most visibly behind the target spec. Score this properly in a future iteration once a visual QA pass is run (needs a headless render or manual screenshots — no browser screenshot harness was run this iteration to conserve tokens).

CURRENT PERFORMANCE STATUS
`ACTIVE_RENDERING_QUALITY` was previously hardcoded to `"experience"` (4K shadow maps, postprocessing, planar water reflection) for every device including mobile. Now resolved automatically at module load from `matchMedia("(pointer: coarse)")`, viewport width, and `navigator.hardwareConcurrency`, falling back to `"configuration"` on low-power devices. No runtime/reactive re-evaluation (resolved once per page load) — a deeper adaptive-DPR/frame-time-driven system (roadmap item 9, spec section 28) is future work if this heuristic proves insufficient.
