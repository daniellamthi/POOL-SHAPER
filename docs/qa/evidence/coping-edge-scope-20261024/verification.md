# Coping scope and edge profile — 2026-10-24

Local candidate on `feat/fullscreen-day-night-hidden-overflow`, based on
`e27fe46903811b7b0f91f33259847115bb08f5ae`. Existing WIP preserved; backup:
`pool-shaper-wip-backups/coping-corners-20261024-jckcn9` (outside repository).

User clarified that rounded means the cross-sectional coping arris, NOT plan corners.

| Requirement | Actual implementation and evidence |
|---|---|
| Two supplied photos only on Sfioro nascosto | Shared system guard: in-ground overflow/continuous only. Actual integrated-browser selection verified. |
| Normal Skimmer coping | Dormant flush property ignored; normal independent material/elevation restored. `skimmer-square-desktop.jpg`, `skimmer-square-390.jpg`, `skimmer-rounded-430.jpg`. |
| Square / rounded icons on Skimmer and Sfioro nascosto only | Same guard in UI and reducer. 36 installation/system/overflow combinations checked. `hidden-rounded-430.jpg`. |
| Real selected profile | Square with minimal 1.8 mm eased arris or circular 6 mm roundover. Dedicated slabs and actual integrated paving perimeter tessellated, not shader-only. Ray tests at 6×3, 8×4, 12×5. |
| No basin/water/plan-corner change | Only coping/paving upper-edge geometry changes. Existing Infinity end-cap and non-selected finish checks pass. |
| State/output | Optional canonical `copingEdge`, enum validation, share whitelist, IT/EN summary/PDF model, quote validation, Photo Spec. Save/reload/share tested offline through production serializers. |

Checks: sun-shelf-state audit **522 PASS**; coping-soft-edges **22 cases PASS** plus
selected-profile rays and **24 Infinity cases PASS**; coping-bench-selection **80
cases PASS**; brown-deck-cover **PASS**; TypeScript `--noEmit` **PASS**;
`git diff --check` **PASS**. No full build or live cloud actions run for this narrow change.

Independent read-only geometry review: rectangle, L and curved outlines had finite
vertices/normals, unchanged projected slab area, module counts and grid origins.
Profiles remain in existing merged meshes/materials; no added draw calls or per-frame
geometry. This is not a GPU performance benchmark; the earlier performance gate stays open.

Visual checks used the integrated browser only. 390×844 and 430×932 are emulated
viewports, not physical mobile devices. Desktop viewport restored. Final project:
10×4.5 m, Sfioro nascosto, dedicated Travertino coping, rounded edge, Mosaico 9 and
Night as selected by the user. Existing stairs, shelf, furniture and bench retained.

The radius is a visualization/design choice, not a structural or installation
certification. No main/archive changes, deployment or backend operations performed.
Changes remain in the existing overlapping WIP; no unrelated work staged or pushed.
