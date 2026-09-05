# Autonomous state

CURRENT OBJECTIVE
Elevate Pool Architect 3D toward archviz-grade realism and commercial polish
while preserving the existing configurator flow (see docs/IMPROVEMENT_ROADMAP.md
and docs/VISUAL_REALISM_MAP.md for the standing priority order).

CURRENT TASK
Complete: shared/cached procedural CanvasTexture templates (micro-normal,
micro-roughness, contact-AO gradient) instead of regenerating identical
per-pixel canvases at every mount site. See "Safe optimization order" item 4
in docs/PERFORMANCE_REPORT.md.

NEXT TASK
Pick up docs/PERFORMANCE_REPORT.md "Safe optimization order" item 2: share
skimmer geometries/materials across `Skimmers.tsx` instances (currently
re-declared JSX/geometry per skimmer instead of instanced/shared). After
that, item 3 (adaptive DPR/quality tier) and item 5 (Context selectors, only
with regression tests first).

BLOCKED TASKS
- None currently blocking unrelated work. See KNOWN REGRESSIONS below for an
  existing (pre-this-session) failure that should be root-caused when a
  geometry-focused task is next picked up.

LAST GOOD COMMIT
(update after each commit in this file)

KNOWN REGRESSIONS
- `npm run test:geometry` fails on a clean checkout (baseline commit
  4cddd3f, verified via `git stash` before this session's change) with:
  `Error: rectangle-10x4.5/in-ground: Interior Finish changed the reference
  wall target`. Pre-existing, not caused by this session. Needs a
  geometry/interior-finish coupling investigation in
  `src/lib/pool/geometry.ts` / `scripts/run-geometry-audit.mjs`.
- `npm ci` fails on a fresh clone against the committed `package-lock.json`
  (missing `lru-cache@11.5.2` from the lock file) -- `npm install`
  regenerates a lockfile that diffs only in npm-version-specific metadata
  (`libc` fields), which was intentionally NOT committed this session to
  avoid unrelated churn. Worth a real `npm install && review diff` pass in
  a dedicated dependency-hygiene task.

CURRENT REALISM SCORE
See docs/REALISM_SCORECARD.md once established; not yet created this
session (no prior scorecard file existed in the repo). Qualitative note:
liner/mosaic PBR (per-color underwater absorption/scattering, Sobel-derived
normal+roughness from photographed base color, triplanar procedural
coping/panel detail) is already substantially implemented -- more mature
than docs/IMPROVEMENT_ROADMAP.md item 2 implies. Re-audit before assuming
gaps there.

CURRENT PERFORMANCE STATUS
Typecheck (`tsc --noEmit`), lint (`eslint`) and production build
(`npm run build`) all pass on this session's change. Geometry audit has the
pre-existing failure above (present before this session's change too).
