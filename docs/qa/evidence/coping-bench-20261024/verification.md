# Coping and integrated bench — targeted verification, 2026-10-24

Candidate: local WIP on `feat/fullscreen-day-night-hidden-overflow`, based on
`e27fe46903811b7b0f91f33259847115bb08f5ae`. No commit, push or deployment performed.
Existing unrelated WIP preserved; pre-edit backup is in the private local
`pool-shaper-wip-backups/coping-bench-20261024-HGgeP1` folder.

| Requirement | Implementation / verification | Evidence |
|---|---|---|
| Two photographed coping choices | Owner-supplied references, dedicated or flush; real geometry changes, not only labels | `coping-choices-desktop.jpg`, `coping-choices-390.jpg`, `coping-choices-430.jpg` |
| Rounded dedicated coping; no open rear fissure | Rounded water-facing nose, small rear arris, supported bedding junction; physical ray checks | `dedicated-junction-final.jpg`; coping audits |
| Continuous paving option | Paving modules reach basin; shared material, module grid and elevation; no separate coping mesh | `flush-junction-final.jpg`; state audit |
| Opposite bench wall | Compared to actual pinned legacy layout, with access/shelf exclusions | `coping-bench-selection-audit.mjs`, 80 cases |
| Bench supported to floor | Closed geometry follows flat/sloped real floor; physical ray 25 mm above floor intersects bench | Same 80 cases; `bench-four-stations-430.jpg` |
| Existing hydromassage seat elevation | Shared 0.45 m water-to-seat datum | Bench and hydromassage audits |
| Customer-selectable stations | 1–4, limited by actual available run; resized incompatible request retained with confirmation | `bench-control-430.jpg`; state audit |
| Back and calf jets | Two back and two calf jets per station, symmetric; non-emissive existing nozzle material | `bench-four-stations-430.jpg`; bench audit |
| State and output | Actual local reload retained selection; IT/EN browser summary showed 3 stations / 12 jets and chosen coping; serializers/share whitelist/PDF summary checked offline | State audit, 401 checks |
| Integrated browser only | Both coping selections and bench quantity exercised on current hidden-overflow configuration; no console errors in final check | Screenshots above |

Targeted results: coping-soft-edges audit PASS (22 cases plus 24 Infinity square-end cases);
coping-bench-selection audit PASS (80 cases plus concealed-overflow elevations/junctions);
hydromassage audit PASS (36,451 checks); sun-shelf-state audit PASS (401 checks);
brown-deck-cover audit PASS; TypeScript `--noEmit` PASS; `git diff --check` PASS.

Desktop checked in integrated browser; mobile 390×844 and 430×932 are viewport
emulation, not physical smartphone performance tests. Final viewport restored.
The current project remains 10×4.5 m, hidden overflow, existing finishes and
furniture selections; three bench stations restored after testing one and four.

Dimensional reference: [Waterway Omni Storm jets](https://waterwayplastics.com/product/omni-storm-jets/),
[manufacturer catalogue](https://waterwayplastics.com/wp-content/uploads/006501.0424.pdf),
2.32-inch face = 58.928 mm. The 0.60 m station allowance, 0.22 m pair spacing and
four jets/station are presentation-design choices, not universally mandated
standard dimensions. No hydraulic certification is claimed. Supplier design must
validate actual flows, pumps, suction safety and installation. The scope of
[UNI EN 16713-2](https://webstore.uni.com/uni-en-16713-2-2016) concerns domestic-pool
circulation equipment, not a universal fixed jet count.

Not rerun / not claimed: full production build, live cloud Save/Share, actual PDF
download, email delivery, hydraulic validation or performance benchmark. Existing
release/performance gates remain separate and open. Older `bench-nozzles.jpg`
predates the selectable-station layout and is not evidence for the final jet count.
