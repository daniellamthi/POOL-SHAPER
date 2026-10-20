# Customer UX runtime QA — 2026-10-20

Specialist A. Application source is read-only. Starting branch `feat/fullscreen-day-night-hidden-overflow`, HEAD `0665d3b`; existing WIP preserved. Dedicated origin: `http://release-ux.localhost:3003/`. No backend/save/quote submissions authorized for this specialist.

## Environment and ownership

Initial preview unavailable, subsequently started by root. Visible IAB creation and parent IAB binding are unavailable in subagent chat. With coordinator authorization, actual Chrome tab `651928317`, session `🧪 Pool QA`, was used. Parent kept its integrated preview open separately. No existing user tabs/drafts operated. These are **Chrome runtime proofs, not IAB proofs**.

Desktop override 1440×900. Mobile is **viewport emulation only** at 390×844 and 430×932, not a real device, mobile UA or touch/DPR equivalence. Root declared a source quiet window before final stable above-ground, renovation and shelf checks. A prior HMR/remount interruption was excluded and the affected above-ground route replayed from phase 1.

**Browser handed back to root:** own Chrome tab at `about:blank`; viewport override reset. No further browser ownership retained. Full secondary goal attachment read.

## Coverage matrix

PASS applies only to the stated actual runtime scenario, not all combinations or publication readiness. [Detailed control results](ux-controls-and-coverage.json) and [navigation phase log](ux-route-navigation.json) retain scope and limitations.

| ID | Scenario / required coverage | Status | Runtime evidence |
|---|---|---|---|
| UX-01 | New in-ground Skimmer, seven phases | PASS | Concrete rectangle 8×4, high-waterline/satin, stairs, shelf/2 loungers, mosaic, deck, lighting. All presentation decisions reached. [review](ux-skimmer-review-1440.jpg) |
| UX-02 | New in-ground grille overflow, seven phases | PASS | Retained 8×4; coping correctly omitted, paving traversed. [scene](ux-overflow-visible-1440.jpg), phase log |
| UX-03 | New in-ground hidden overflow, seven phases | PASS | Coping/paving traversed. [scene](ux-overflow-hidden-1440.jpg), phase log |
| UX-04 | New in-ground Infinity, seven phases and edge selector | PASS | Four side buttons actually selected; traditional/glass toggled, glass full route completed. Separate full traditional-wall replay not performed. [scene](ux-infinity-glass-1440.jpg), [review](ux-infinity-review.txt) |
| UX-05 | Above-ground, seven phases | PASS | Stable full Skimmer 6×3; grille and hidden 8×4 each replayed phase 1–7. Internal straight/corner and mirror, external short/long, four panel finishes, Pellicano. Infinity absent as unsupported. [Skimmer](ux-above-ground-stable-full-1440.jpg), [grille](ux-above-ground-overflow-visible-1440.jpg), [hidden](ux-above-ground-overflow-hidden-1440.jpg) |
| UX-06 | Renovation supported installations and subcategories | PASS | Actual UI has **six phases**. In-ground full scope 12×5 L shape; seven existing and five proposed subcategories traversed. Above-ground full six-phase replay. Existing Skimmer/visible/hidden selected; existing Skimmer→proposed hidden route completed. No renovation Infinity. [in-ground](ux-renovation-full-review-1440.jpg), [above-ground](ux-renovation-above-ground-review-1440.jpg) |
| UX-07 | Shape / dimensions / depth | PASS | 6×3, 8×4, 12×5. Rectangle/L/custom modes; actual custom point drag changed area 38.27→38.28 m² and reset used. Four L orientations selected. Depth 0.8 accepted, 1.55→1.5; slope/invert/flat exercised. Not every global bound/custom outline. [drag](ux-custom-shape-drag-1440.jpg), control results |
| UX-08 | System / model / subtype / Infinity side | PASS | Slim/high-waterline/satin; both overflow types; all four Infinity sides and both wall variants. Actual pressed states recorded. |
| UX-09 | Internal/inox/comfort/shelf/external access | PASS | Stairs and inox on/off; hydro A/B/none; shelf, loungers and bench on/off; quantity 2. External short/long and on/off. Geometry combinations belong to separate QA. |
| UX-10 | Interior / above-ground exterior panels | PASS | Nine mosaic cards selected before label fix; fixed labels retested in both flows. Above-ground only liner/stainless interiors; four panel finishes selected. Six liner colors clicked, final Blue Sky restored; intermediate color proof not retained. [fixed new-pool](ux-new-pool-mosaic-fixed-1440.jpg), [fixed renovation](ux-mosaic-labels-fixed-1440.jpg) |
| UX-11 | Lighting / color / independent optional | PASS | Stair spots on with main lights off; then main LED, Blue, 75%, retained in review. Italian slider label corrected to `Tonalità LED`. [night](ux-led-night-1440.jpg), [fixed label](ux-led-label-fixed-it-1440.jpg) |
| UX-12 | Coping / paving decisions | PASS | Prun coping, porcelain Greige, 60×60 retained in review. Grille still traverses paving. Every material variant not visually validated. |
| UX-13 | Outdoor / water / heat optionality | PASS | Cover, exterior chaise, shower, salt, dosing, heat each on/off; traversed with none. Above-ground Pellicano on/off; cover unavailable reason shown. |
| UX-14 | Scene / summary / request UI | PASS | All three new-pool decisions and renovation review reached. Synthetic QA contacts local to own origin only. No Save/share/PDF/proposal submission clicked. |
| UX-15 | Twenty real Continue/Back cycles, panel retained | PASS | Every system→model→system cycle returned same rendered selection/heading; panel expanded on every Next/Back. Mobile also passed. Voluntary collapse persisted through navigation. [20 cycles](ux-20-navigation-cycles.json) |
| UX-16 | IT→EN→IT, selections retained and complete translation | NOT VERIFIED | Rendered body/review translation and roundtrip text equality PASS in both flows. Specialist metadata reads remained IT, but root subsequently obtained correct EN from stable raw DOM: discrepancy is not a confirmed app defect. Canonical storage not exposed by CUA scope. [new-pool](ux-locale-review-comparison.json), [renovation](ux-renovation-locale-comparison.json), [English](ux-renovation-english-1440.jpg) |
| UX-17 | Product photos / icons / accessible names | NOT VERIFIED | Labelled coherent command/orientation icons observed. Inox photo qualified indicative; Prun sample qualified photographic. Models, both overflows, shelf, external stair and Pellicano explicitly lack approved photos/rights. No false real-photo claim observed. Full asset availability/rights remain unverified. [placeholders](ux-skimmer-missing-photo-1440.jpg) |
| UX-18 | Desktop 1440×900 | PASS | Actual Chrome screenshots and usable seven-phase/header/dock navigation. Framing/realism belongs to separate QA. |
| UX-19 | Mobile 390×844 / 430×932 | PASS | Viewport emulation only, above-ground day scene/open summary; Next/Back and voluntary collapse tested. [390 day](ux-mobile-emulated-390x844-day.jpg), [430 day](ux-mobile-emulated-430x932-day.jpg) |
| UX-20 | Shelf range, two-lounger explanation, conflict handling | PASS | **UI scope only.** 6×3 unavailable with two 185×73/margins/access reason; 8×4 range 3.035–5.6; 12×5 range 3.035–9.6, width 3.73, 20 cm water, design caveat. Resize preserves incompatible shelf with clear alert; resolving None retains independent heat pump. Geometry/source conformity separate. [6×3](ux-shelf-unavailable-6x3-1440.jpg), [12×5](ux-shelf-range-12x5-1440.jpg), [conflict](ux-shelf-incompatible-resize-1440.jpg), [heat retained](ux-independent-heat-retained-1440.jpg) |

## Reproduced defects and retests

- **UX-RUNTIME-01, corrected/retested:** fresh load failed `dimensions is not defined`, `PoolScene.tsx?t=1792498657255:1082:3`; `Riprova` repeated it. [before](ux-runtime-dimensions-error-1440.jpg). Root corrected in-flight props; reload and complete routes subsequently functioned. [after](ux-skimmer-review-1440.jpg).
- **UX-LABEL-01, corrected/retested:** new-pool cards/review exposed `Mosaic DD99152F` style codes. [before](ux-mosaic-technical-labels-1440.jpg). Root customer-label correction verified as `Mosaico 1–9` and summary `Mosaico 5`; canonical IDs/assets untouched by specialist. [after](ux-new-pool-mosaic-fixed-1440.jpg).
- **UX-LABEL-02, Italian corrected/retested:** slider accessible name `LED hue` in Italian now `Tonalità LED`. Final English label remains for independent retest.
- **UX-LANG-01, NOT VERIFIED discrepancy; no fix recommended without reproduction:** English body/nav, but specialist `playwright.domSnapshot()`, a later role-heading read and `tab.title()` still returned Italian global h1/title after a separate screenshot. These were not raw `document.title`/h1 DOM evaluations, and no additional customer action followed the language switch. Root subsequently reproduced initially stale AX metadata but obtained correct EN title/h1/lang from stable raw DOM. That evidence prevents treating this as a confirmed app defect. Root owns final metadata gate.

Exact shelf boundary observations at 12×5: `9.6`→`9.6`; `9.7`→`9.6`; `3.0`→previous `9.6`; exact minimum `3.035`→`3.035`. Below-min input is rejected/restored, not clamped to minimum. No impossible value persisted. [inputs](ux-shelf-boundary-inputs.json).

Several entering-lighting/night or day/night transitions caused a 3-second CUA CDP deadline; later fresh DOM succeeded, with some prior actions committed. This is latency evidence, not FPS/p95 measurement or a proven shader cause. Source HMR and multiple open scenes prevent clean attribution; separate performance benchmark required.

## Read-only offline checks, distinct from browser proof

`node scripts/test-fullscreen-state.mjs`: PASS. Legacy/default-off, bench summary, dormant option retention, night mode and camera intent; no browser/backend calls.

Cleanup suite initially failed its feature catalog because expected array omitted existing `sunShelfLoungers`. After coordinator updated the expectation, **unmodified** `scripts/final-cleanup-state-audit.ts` was bundled/executed in memory with unused cloud loader stubbed: **53 checks PASS**. Canonical four-system/above-ground review→start→dimension→review configs, identity, renovation state, WPC independence and restoration verified. An earlier diagnostic amended only the expected array in memory and also passed all 53; no checks dropped. No temporary source file written.

## Explicit missing coverage

Canonical persisted browser snapshot and saved-baseline dirty flag across language/navigation/camera not observable here (`localStorage` absent in CUA read-only DOM evaluation). Rendered review comparison is narrower. Data specialist/root must supply saved-state comparison.

No real mobile hardware, all-combinations claim, complete visual validation of all materials/shape/structure pairs, every internal stair orientation/global dimension bound/custom outline, or uploaded plan. Upload mode inspected only. Separate full traditional Infinity-wall replay not performed. Cloud persistence/share privacy/export/live commercial submission/backend retries/asset rights/public runtime readiness remain separate requirements.

No application source edits, backend mutations or commits by this specialist. No publication approval inferred.
