# Autonomous state

## CURRENT OBJECTIVE
Progressively elevate Pool Architect 3D toward ultra-premium, physically
credible realism (materials, water, geometry, camera, UX) without breaking
the existing configurator flow. See `docs/IMPROVEMENT_ROADMAP.md` and
`docs/VISUAL_REALISM_MAP.md` for prior analysis (written before several of
its own recommendations were already implemented — treat both as partially
stale; re-verify claims against code before trusting them).

## CURRENT TASK
None in progress. Last session closed out cleanly after the fixes below
(AUTO-001, AUTO-004).

## NEXT TASK (READY)
Re-run a fresh audit against `docs/IMPROVEMENT_ROADMAP.md` item list — several
items (curve-aware offsets, per-photo derived normal/roughness maps,
triplanar procedural stone/panel detail, dual-scale water ripple normals)
are already implemented in `src/lib/pool/geometry.ts` and
`src/components/pool/three/textures.ts`. The roadmap doc predates that work.
Before picking the next task from it, verify each remaining line item still
reflects a real gap (grep the relevant file first) rather than trusting the
doc. Highest-confidence remaining gaps as of this session:
- `INTERIOR_TEXTURES.liner` (`src/configurator/materials/interior-textures.ts`)
  ships only a base-color PNG per liner color; normal/roughness/AO are
  synthesized at runtime from that photo via `getDerivedDetailMaps`
  (`src/components/pool/three/textures.ts`). This works but is a derived
  approximation, not authored PBR maps — acceptable, not urgent.
- No automated visual regression harness exists yet (Section 29 of the
  autonomous brief / roadmap item 1: "reference screenshots"). The `run`
  skill + Playwright/Chromium are available in this environment and could
  capture the deterministic camera poses the geometry audit already proves
  are stable (72 poses across 108 cases) as PNG baselines.
- Quality-tier / adaptive-DPR system (`docs/PERFORMANCE_REPORT.md` items
  2-4) has not been independently re-verified this session.

## BLOCKED TASKS
None currently blocked.

## LAST GOOD COMMIT
See `git log -1` on `claude/zen-cannon-0akmda`. This session's commit fixes
a broken geometry-audit invariant (see KNOWN REGRESSIONS below, now FIXED).

## KNOWN REGRESSIONS
- FIXED this session: `ACTIVE_RENDERING_QUALITY` in `src/configurator/3d/
  scene/visual-preset.ts` was hardcoded to the highest ("experience")
  rendering tier for every visitor (a debug leftover comment admitted as
  much), making the lighter "configuration" tier the preset system already
  defines dead code and leaving mobile/low-power devices with no real
  quality scaling. Replaced with a conservative device heuristic (coarse
  pointer OR narrow viewport OR <=4 cores OR <=4GB `deviceMemory` ->
  configuration; otherwise experience), evaluated once at module import in
  the same browser-only lazy chunk — no consumer files changed. Verified
  with a Playwright smoke test at 1440x900 and 390x844 (touch) viewports:
  pool renders correctly, no console errors, no black canvas at either
  size. See `docs/AUTONOMOUS_BACKLOG.md` AUTO-004.
- FIXED this session: `scripts/geometry-audit.ts` asserted that the
  Interior-Finish (liner/mosaic) camera target exactly equalled the
  Skimmer-master camera target on both horizontal axes. That invariant is
  mathematically impossible for the current (correct, by-design) camera
  model — the interior-finish camera targets a point ON the reference wall,
  not the pool's bounding-box centre, so only the *tangential* (along-the-
  wall) coordinate can match. `npm run test:geometry` threw on the very
  first case (`rectangle-10x4.5/in-ground`) and — because the script
  `assert`s and halts on first failure — every case after it had never
  actually been exercised. Same commit also loosened the Mosaic-vs-Liner
  camera check: a prior commit intentionally gave Liner a pulled-back
  framing distinct from Mosaic's tight swatch view (`isLiner` in
  `src/lib/pool/camera.ts`), which made positions legitimately differ while
  targets still match — the test required full position equality and would
  have failed next. Fixed by asserting the true invariants (tangential
  target alignment + frontal view direction for Liner; target-only equality
  for Mosaic). `npm run test:geometry` now passes: 108 shape/dimension/
  system cases, 6 custom-shape offset cases, 12 guardrail regressions, 72
  camera poses, 24 clamped drag steps. No production camera code changed —
  `src/lib/pool/camera.ts` is untouched; only the test's assertions were
  wrong.
- No other regressions currently known. `npx tsc --noEmit`, `npm run
  lint` (82 pre-existing formatting errors/8 warnings, unrelated to this
  session's diff, confirmed present on HEAD before this session's change
  too) and `npm run build` all succeed.

## CURRENT REALISM SCORE
Not independently re-scored this session — see `docs/REALISM_SCORECARD.md`
for the last recorded pass and its caveats. A real re-score needs visual
screenshots (Playwright/Chromium is available via the `run` skill) rather
than code reading alone.

## CURRENT PERFORMANCE STATUS
Unchanged from `docs/PERFORMANCE_REPORT.md`; not re-profiled this session
(no runtime/GPU work was touched).
