# Autonomous decisions log

Record of normal engineering/product decisions made without owner
confirmation, per the autonomous operating charter (reversible, measurable,
preserves existing behavior).

## 2026-09-05 — Fix the test, not the camera
`scripts/geometry-audit.ts` demanded that the Interior-Finish (liner/mosaic)
camera target exactly equal the Skimmer-master target on both X and Z. That
is provably impossible for the current camera design: the interior-finish
camera is a *close wall view* (`getInteriorFinishCamera` in
`src/lib/pool/camera.ts`) whose target deliberately sits on the reference
wall's own plane, not the pool's bounding-box centre the master camera
targets. Two ways to make the test pass existed: (a) change the test to
assert the real invariant (same tangential/along-the-wall centring, same
frontal viewing direction), or (b) change the camera so the interior-finish
target equals the bounding-box centre outright, which would defeat the
documented purpose of a close, perpendicular wall view for material
close-ups. Chose (a): it preserves current, working, intentional camera
behavior (explicitly required by the operating charter) and only corrects a
wrong test assertion. No owner input needed — reversible, verified by the
full audit suite passing (108/6/12/72/24), no visual behavior changed.

## 2026-09-05 — Did not rewrite the improvement-roadmap docs this session
`docs/IMPROVEMENT_ROADMAP.md` and `docs/VISUAL_REALISM_MAP.md` list several
items that a first-pass code read suggests are already implemented. Rather
than editing those docs from a shallow read (risking recording something as
"done" that isn't fully verified visually), logged the discrepancy as
AUTO-002 in the backlog for a session with room to verify each item
properly (ideally against real screenshots, once AUTO-003 exists).
