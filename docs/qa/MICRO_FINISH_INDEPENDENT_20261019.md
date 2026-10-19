# Independent customer replay — micro-spots and finish families

Date: 2026-10-19. Reviewer: independent QA subagent, not an implementer.

Method: actual Codex in-app browser on isolated `micro-finish-qa.localhost:3003`; all project changes through visible UI. No store injection, backend calls, emails, cloud submissions or customer project reset. Viewports are desktop 1440×900 and **emulated**, not physical mobile, 390×844 / 430×932. Production sources were not edited by this reviewer.

Screenshots: `evidence/micro-finish-20261019/`. Screenshots labelled integration are not baseline evidence. Vite hot updates sometimes rehydrated the unsaved project at Presentation; formal after-checks were made after code-freeze messages, not interpreted as navigation failures.

## Observations and retests

| Check | Independent runtime result | Evidence |
| --- | --- | --- |
| Desktop Gres family click | PASS: inner wizard scroll and focus land on all four readable tone cards; category expansion itself preserves old material | `desktop-gres-auto.jpg` |
| Desktop Travertino | PASS: two named, illustrated variants grouped under one category; selecting venato applies it and advances to paving format | `desktop-travertine-auto.jpg`, live pressed state and format heading |
| Mobile Gres initial candidate | FAIL found: lower two names behind footer at both 390 and 430 | `mobile390-gres-before-fix.jpg`, `mobile430-gres-before-fix.jpg` |
| Mobile Gres corrected candidate | PASS: all four names visible without additional manual scrolling, on both sizes | `mobile390-gres-after.jpg`, `mobile430-gres-after.jpg` |
| Mobile Travertino | PASS: chiaro/venato names, pictures and descriptions readable together | `mobile390-travertine-after.jpg`, `mobile430-travertine-auto.jpg` |
| Interior material guidance | PASS on 430: Mosaico focuses `Finitura mosaico`; returning to Liner/PVC focuses `Colore del liner`, Blue Sky 602 retained | `mobile430-mosaic-guide.jpg`, `mobile430-liner-guide.jpg` |
| Paving tone → format | PASS: selecting Avorio focuses format group; coping Greige remains; 8×4 dimensions, liner, corner stairs and RGB state preserved | actual DOM pressed states and heading `Formato · Gres porcellanato · Avorio` |
| Straight stair micro-spots | PASS: small centered riser fixtures; day fixtures not luminous, red/blue/white update actual scene | `desktop-straight-day.jpg`, `desktop-straight-red.jpg`, `desktop-straight-blue.jpg`, `desktop-straight-white-detail.jpg` |
| Corner stair micro-spots | PASS: curved risers retain six centered mini fixtures; red and blue visible with main fixtures OFF, no neon discs | `desktop-corner-red-micro-only.jpg`, `mobile390-corner-blue-detail.jpg` |
| Corner day and OFF | PASS on 430: day has discrete non-glowing fixtures, OFF removes lenses and illumination without changing risers | `mobile430-corner-day.jpg`, `mobile430-corner-off.jpg` |
| Independent switching | PASS: stair OFF preserves main LED ON; main LED OFF preserves stair ON and selected red/blue; bench control separately selectable | actual pressed states in LightTray |
| Bench A initial lighting | FAIL found: red lens cores render below seat but footwell remains dark; implementer asked to inspect beam target/range before visual PASS | `desktop-hydroA-red.jpg`, `mobile430-hydroA-red.jpg` |
| Bench A first correction retest | FAIL: floor-relative planner correction alone did not yield readable red footwell light in real browser; blue/red lens cores and ON/OFF work | `desktop-hydroA-blue-after.jpg`, `desktop-hydroA-blue-off-after.jpg`, `desktop-hydroA-red-after.jpg` |
| Bench B first correction retest | FAIL/insufficient visual evidence: optional detail camera too tight to show complete bench; manually reset/orbited full model, still no readable red footwell lighting | `desktop-hydroB-red-after.jpg`, `desktop-hydroB-red-manual-view.jpg` (initial manual wheel only; not a complete framing proof) |
| Bench transport correction | Functional PASS: red/blue footwell light becomes visible with main and stair LEDs OFF. First full-output candidate looked excessive in A close-up and was returned for calibration | `desktop-hydroB-red-final-overview.jpg`, `desktop-hydroB-blue-final-overview.jpg`, `desktop-hydroA-blue-final.jpg` (these precede final output calibration) |
| Bench A final calibrated output | PASS at default **60%**, not a lowered customer dimmer workaround: two small under-seat lenses and localized soft colored footwell light, liner detail retained | `desktop-hydroA-blue-calibrated.jpg`, `mobile390-hydroA-blue-calibrated.jpg`, `mobile430-hydroA-red-calibrated.jpg` |
| Bench B final calibrated output | PASS at 60%: localized red footwell light, no whole-pool flood, using normal manual orbit from existing overview to inspect whole B | `desktop-hydroB-red-calibrated.jpg` |
| Bench final Day/OFF | PASS: day has no emitted colored wash, OFF removes lens/light contribution independently | `mobile430-hydroA-day-calibrated.jpg`, `mobile430-hydroA-off-calibrated.jpg` |
| Final shared-output stair dependencies | PASS: corner and straight miniatures remain clearly smaller than main fixtures, with coherent red emission and limited tread light, 60% retained. Straight + B layout correctly uses five actual risers, not a hardcoded six | `desktop-corner-main-red-calibrated.jpg`, `desktop-straight-main-red-calibrated.jpg` |
| Bench LightTray summary | PASS after fix: footer now says `Notte · micro-spot panca` with only bench lighting selected | `desktop-hydroA-red-after.jpg` |
| Navigation retention | PASS: direct summary lists dimensions/liner/corner/hydro/materials; manual Indietro→Continua retains deliberately chosen Travertino chiaro coping and independent Avorio paving, panel remains expanded | real DOM pressed states and summary definitions |
| Hydro nozzles | No emitted glow observed in the initial A close-up; nozzles dark, distinct from under-seat lenses | `desktop-hydroA-red.jpg` |
| Runtime console | No error/warning entries after straight/corner/bench activation; occasional CDP action observation timeouts recovered with current-state check | captured `tab.dev.logs` returned `[]` |

## Final scope verdict

PASS for the requested independent runtime sampling after the three reproduced visual defects were corrected: mobile tone names occluded; bench floor illumination missing; newly enabled bench light too strong before final micro-only calibration. Original FAIL evidence has not been relabelled PASS.

Final live summary preserved 8×4×1.5, Skimmer Slim, Blue Sky 602, deliberate Travertino chiaro coping, independent Avorio paving/60×120, selected hydro B and light optional. Panel stayed open through ordinary navigation; its reduced state occurred only after explicit reviewer `Riduci`, and persisted until explicit reopening. Bench footer and project summary now identify bench lighting.

Nozzle isolation PASS: main-light-OFF bench A captures show dark nozzles, separate from emitting under-seat spots. With main red LEDs ON the metallic nozzle circumference reflects red (`desktop-straight-main-red-calibrated.jpg`, upper left); no emitted pool illumination is seen originating at those nozzles. A same-detail-camera retake with main LEDs OFF and stair micro-spots still ON (`desktop-straight-main-off-nozzle-reflection.jpg`) removes the red nozzle reflections while the true micro-spots and tread light remain red. This confirms colored material reflection rather than nozzle emission. Approved nozzle materials were not darkened to hide reflections.

Limits: B's dedicated micro-light camera is very tight; normal existing overview + manual orbit was used for its whole-footwell inspection. This review did not modify or certify that camera. No 14-finish, all-dimensions, cloud persistence, export, production-performance or physical-device audit is claimed. Red/blue/white were replayed during this task; final calibrated samples specifically cover red/blue, day/night, straight/corner, A/B, and independent switching. No new runtime error/warning entries were captured after the final straight retake.

Central typecheck/build/unit audit evidence belongs to the integrator report; this independent report does not claim those commands were run by this reviewer. No FPS or physical-device performance claim is made.
