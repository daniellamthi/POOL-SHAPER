# Skimmer corners and wizard follow-up options — 2026-10-24

Current feature branch and all pre-existing WIP preserved. Backup outside repo:
`pool-shaper-wip-backups/skimmer-wizard-guidance-20261024-HeTzfO`.

| Requirement | Implementation / evidence |
|---|---|
| No duplicate Retto/Arrotondato on overflow | `supportsCopingEdge` now Skimmer-only; hidden overflow keeps its two photographed choices. Real browser: `mobile430-overflow-two-photos.jpg`. Dormant Skimmer edge choice cannot change overflow. |
| Skimmer icons change the actual model | Square restores original outline; rounded uses 20 cm plan fillets. `skimmer-square-real-top.jpg` / `skimmer-rounded-real-top.jpg`. Rectangles round all four corners; L shapes round five outer corners and preserve the original inside recess. Intrinsically curved/custom shapes do not show these controls. |
| Follow-up options visible after a choice | Shared dock capture handles choice cards, pressed buttons and radios in all wizard phases. Newly disclosed child groups win; otherwise reveal the next separate group, not sibling alternatives. No automatic selection, tab advance or collapse. |
| Existing guided variants win | Explicit family/finish/stair requests claim priority; stale delayed requests are cancelled after another user action. Gres and Travertino retain their original selected material until a variant is actually chosen. |
| Other options cue retained | Existing cue and bounded dock scrolling retained. Day/night, tabs, sliders and page/3D viewport are not automatic-scroll targets. |
| State/navigation | Actual exterior Continue/Back cycle preserved Skimmer Rounded, Travertino, Gres60×120, white liner and hydromassage A; panel remained expanded. Temporary cover activation restored OFF; original Skimmer restored after overflow check. |

Measured real-browser dock scroll (pixels, same viewport within each comparison):
- Desktop corner → coping material: 0 → 281.5; target top559.4 within dock547.5–826.5.
- Travertino → variants: 281.5 →459.5; variant top559.7.
- Gres variants at390 px: target top343.5 within dock331.4–668.
- Liner → colours at390 px: 0→267; colour group top343.6.
- Skimmer model → finish at390 px: 0→374; finish top343.2.
- Hidden-overflow photograph → material at430 px: 0→386; material top396.0 within dock384.2–756.
- Cover ON → opening slider at430 px: 0→158; entire slider group587.9–682.0 visible.
- Page `scrollY` remained0 in every recorded comparison. Desktop/mobile screenshots in this folder are real integrated-browser captures; 390/430 are emulation, not physical device tests.

Targeted checks PASS: wizard-guidance37 actual-helper mock-DOM checks;
finish-guidance618 checks; rounded-pool-corners3663 checks (actual mesh rays,
rectangle sizes6×3/8×4/12×5, four L orientations, unchanged non-targets);
sun-shelf-state515 production-reducer/serialization/summary checks; TypeScript
`--noEmit`; `git diff --check`.

Browser samples cover parent/variant, model/finish, liner/colour, corner/material,
photograph/material and optional/slider paths. This is not an exhaustive replay
of every catalogue combination. No full build, backend/cloud writes, email,
merge or deployment. Existing broader release/performance gates are not closed
by this targeted verification. Changes remain in the overlapping local WIP.
