# Geometry and comfort review — 2026-10-20

Read-only specialist B review. Source baseline: branch `feat/fullscreen-day-night-hidden-overflow`, HEAD `0665d3b44bb0d25319f273397dea14825ff5f64a`, existing WIP preserved. Only this report was authored by this reviewer. No browser access, app/test source edits, Git mutations, full build or full lint. Code checks below are not browser PASS.

## Findings and required integration

| ID | Requirement / scenario | Finding / cause | Smallest correction / acceptance | Status |
|---|---|---|---|---|
| G01 | Customer can select a usable Sun Shelf between actual minimum and maximum | No requested dimension or range control exists. `comfort-plan.ts:220,248` and `floor-profile.ts:31` derive one run from heuristics. `StepTrays.tsx:704` displays the resulting dimension only. At depth 1.50, both 8×4 and 12×5 produce run 3.035 m. | Add an optional requested run, one shared derived range/flight calculation, and a customer control with limits/reasons. Keep the existing 2.4 m residual criterion, tread/riser dimensions, approved shelf immersion and furniture envelopes. Preserve incompatible customer intent and require resolution before final documents. | FAIL — implementation required |
| G02 | At least two full loungers with a connected route even when furniture optional is OFF | Existing `resolveComfortPlan()` calls `resolveSunShelfLoungers()` without enabling the optional. It rejects shelf if capacity is below 2. Derived layout also protects selected access. No contradiction found in 31,104 scoped combinations. | Retain this gate when adding the run. Re-evaluate against the final complete comfort/access geometry, not merely area or bounding width. | PASS — source/probe only |
| G03 | Actual product envelope; no scale-to-fit | Source separates immersed Lyxo Esse LT302, 1.85×0.73×0.57 m, from Frame LT303, 1.85×0.73×0.77 m. Official manufacturer confirms both products. This distinction is intentional, not a shrunken version of the same product. | Preserve the current product distinction. If the intended submerged item is specifically the 0.77 m Frame, that is a different product choice and needs explicit supporting instruction; do not silently stretch the immersed shell. | PASS — current source/primary dimensions; owner product expectation must be reconciled |
| G04 | Supported shapes/orientations/Infinity | Comfort is explicitly limited to rectangular in-ground pools (`comfort-plan.ts:160`). L/Organic/custom and above-ground return a reason. The shelf follows the actual longer axis, either head wall, slope direction and Infinity exclusion. | Range must inherit current supported scope and true outline span. Unsupported shapes must remain explicitly unavailable, not gain approximate rectangle placement. | PASS — source/probe only |
| G05 | Hydro, benches and stairs remain valid without new arbitrary thresholds | Existing hydro is independent from the shelf enlargement and requires nominal width >3.00 m plus actual geometry fit. Existing owner criteria define seats/legroom and stair tread/riser. Existing selected entrance or ladder cannot be consumed: `resolved-layout.ts:117` omits incompatible comfort and retains requested data. | Do not route a longer shelf request into hydro flight geometry. Retest both hydro variants and selected corner/inox access after shared helper changes. | PASS — current targeted checks; integrated retest required |
| G06 | Small riser/under-seat micro-spots, coordinated color, independent optional; non-emissive jets | `planStairMicroSpots()` follows the real risers. Hydro spots are below seat top, one per actual seat face. `microSpotPresentation()` uses main LED calibrated color/dimmer but separate optional flags. `HydroJet()` uses steel + non-emissive dark material. | Preserve these source contracts; no shader/material change indicated by this review. | PASS — source and targeted geometry/optics checks only |
| G07 | Evidence reflects the tested current product | Historical `PARAMETRIC_COMFORT_CAMERA_20261019.md` and older customer report still describe Ledge 1.778×0.5842 m, 12×5 capacity 4 and old assertion/mesh counts. Current Lyxo result is capacity 3. Untracked `hydro-glass-corner-audit.ts` unconditionally requires a 6×3 hydro despite the approved width guard. | New readiness report must cite current results; retain historical evidence as historical. Correct stale test expectation if this WIP script is used, preserving the width guard. | FAIL — stale evidence/oracle, not demonstrated geometry regression |

## Existing documented design criteria

`sun-shelf-model.ts` labels these as the owner's preliminary layout criteria, not certified installation or regulatory clearances: 0.25 m edge inset, 0.24 m between chaises, 0.30 m access obstacle buffer, capacity ≥2, 0.90 m minimum stair access and 0.90 m connected rear passage. Shelf water depth is the existing approved 0.20 m. Shell inset is 0.035 m. This gives the current furniture-derived nominal minimum run 1.85 + 0.90 + 0.25 + 0.035 = 3.035 m, subject to a longer actual stair/landing run.

The existing residual-space criterion is 2.4 m (`comfort-plan.ts:250`, `floor-profile.ts:39`). It is a project criterion, not a newly asserted standard. A slope additionally reserves a 0.30 m level landing before its ramp; the range and display must distinguish the selected total run from the actual slope start. Maximum cannot be advertised as valid until actual access, obstacles and final two-chaise layout remain feasible throughout that requested range.

For flat 1.50 m baseline, simple preliminary run bounds would be 3.035…5.6 m on 8×4 and 3.035…9.6 m on 12×5, before actual compatibility checks. The 6×3 is unavailable because its transverse platform cannot fit two real chaises plus the separate stair route; increasing its run alone does not solve this. Identical furniture may legitimately yield the same lower bound for multiple pool lengths; deriving it is preferable to introducing arbitrary pool-size-dependent minima.

Primary product reference checked on 2026-10-20: [Lyxo Esse](https://lyxodesign.com/prod/esse/) lists LT302 185×73×57 cm and LT303 Frame 185×73×77 cm and describes filling with water as ballast for immersed use. [LT303 technical sheet](https://lyxodesign.com/wp-content/uploads/2024/10/LYXO_ESSE_LETTINO-303.pdf) independently confirms Frame 73/185/77 cm. The 0.20 m shelf setting here is the existing approved project setting, not a new manufacturer installation certification.

## Targeted executable baseline evidence

All commands executed locally against the existing working candidate; no network state was changed.

| Command / probe | Result |
|---|---|
| `node scripts/run-parametric-comfort-audit.mjs` | 264 checks PASS; 6×3 shelf unavailable flat/slope; 8×4 capacity 2; 12×5 capacity 3; incompatible requests survive resize/save/restore and final PDF/proposal guards reject them |
| `node scripts/sun-shelf-loungers-audit.mjs` | 1,152 checks PASS; actual shell 7,096 triangles; full footprints/support and access/Infinity checks |
| `node scripts/run-hydromassage-audit.mjs` | 36,153 checks PASS; 192 sizes ×2 variants built, 48 unavailable |
| `node scripts/run-stair-lighting-audit.mjs` | PASS; 496 configurations, 2,140 riser fittings; geometry/access/wall LED contracts preserved |
| `node scripts/run-micro-spot-realism-audit.mjs` | 5,441 checks PASS; 224 configurations; 420 actual footwell raycasts; day emission OFF, centered risers, 2 L/3 U fittings, independent optionals |
| Additional bounded in-memory source probe using the audit module's real exports | 31,104 derived configurations; zero exceptions and zero available/rendered shelves with unavailable two-chaise capacity when furniture optional OFF |

Additional probe axes: 6×3/8×4/12×5, swapped dimensions, 6×3.519/3.520/3.521; depths 1.1/1.5/2.4; 4 shapes; skimmer/overflow/all 4 Infinity sides; linear/corner; internal stairs/inox/no separate access; bench/add-on inox combinations; flat/slope. Scope was derived compatibility only, not renderer/browser validation. At flat depth 1.5, 6×3.519 was unavailable; 6×3.520 and 6×3.521 gave capacity 2. These are regression boundary examples, not a new universal commercial width rule.

## Candidate integration boundary tests

For every supported size and swapped axis, exercise derived min, max, min−0.001, min+0.001, max−0.001 and max+0.001 m; test at least two depths where stair rise count changes and both slope orientations. Test the furniture optional OFF and ON, quantities 1/2/capacity/capacity+1, bench, selected separate access and add-on inox. Check the four real Infinity sides and traditional/glass where supported; no furniture or passage crosses the exclusion. Verify both exact footprint placement and a connected clear route, not only area or cross width.

For 6×3, verify explicit unavailability rather than growing the pool, scaling the chaise or hiding the reason. For L/Organic/custom/above-ground, verify the existing unsupported explanation and retained customer request. For incompatible resize/shape/run changes, verify no ghost geometry, no deletion of independent optional intent, preserved save/reload/share copy, and blocked final PDF/proposal until resolved. Recheck both hydro variants to ensure the shelf request never enlarges their independent approved body.

Browser status: NOT VERIFIED by this specialist. Final integrated visual review must cover actual controls, IT/EN limits/reasons, full furniture support, stair/passage separation, deep residual pool, and Infinity exclusion from the requested desktop/mobile views. No current-source tests establish materials or visual photorealism against approved references.

## Integrated range candidate — independent recheck, 2026-10-20

The complete 210-line `1-POOL_SHAPER_FINAL_QA_GOAL.md` attachment was subsequently received and read. The coordinator added `Dimensions.sunShelfRun`, requested-run handling in the existing flight/floor/comfort pipeline, `sun-shelf-range.ts`, state/persistence/export handling, and the customer range control. No implementation file was changed by this reviewer.

This supersedes the initial G01 implementation finding: **PASS for the reviewed derived geometry/state candidate; browser interaction and visible explanatory text remain NOT VERIFIED by this specialist.** The range is now based on each actual outline, depth-dependent flight, retained residual criterion, and the complete selected access/bench/Infinity layout. Undefined legacy requests retain the existing 3.035 m layout; the separate hydro flight ignores the shelf run. Supported shape scope remains explicit.

Independently reran `node scripts/run-sun-shelf-range-audit.mjs`: 21,145 assertions PASS, 288 configurations, 980 actual rendered-plan samples. Local range-solver CPU median 0.325 ms / p95 0.926 ms in that run. These are CPU timings on the review machine, not frame-time/FPS or browser performance measurements.

An additional in-memory probe bundled and executed the real candidate exports, without adding an app/test source file. It covered 3,200 configurations and 39,040 actual requested-run samples, plus 30,720 explicit furniture-quantity checks. Cases included 6×3, 8×4, 12×5 and both swapped 8×4/12×5 axes; internal linear/corner stairs, separate inox and no selected separate access; bench/add-on inox combinations; skimmer/overflow; all four Infinity sides with traditional/glass; flat/slope and both slope directions. Depths 1.1/1.5/2.4 m rotated through these cases rather than forming a claimed exhaustive depth cross-product.

For every available interval, the probe tested 13 equally spaced actual geometry values including both endpoints, not just the range predicate. It additionally searched five points beyond a reduced advertised maximum and sampled up to nine candidate values when the range was unavailable. Results: **zero advertised-interval holes, zero valid-later examples after the advertised maximum, zero sampled false-unavailable cases, zero quantity-contract failures.** Of 3,200 configurations, 640 were explicitly unavailable. For quantities 1, 2, capacity and capacity+1, valid quantities rendered the exact count; an excessive requested count stayed unresolved and rendered no misleading partial order. Optional OFF continued to reserve capacity for two without purchasing furniture.

The binary-search monotonic assumption was therefore exercised against actual interior placements and selected dependent geometry; no violating case was found. This is bounded regression evidence, not a mathematical proof for every future component or every possible input. The assumption must be revisited if a future feature introduces placement that becomes feasible again as the head-wall reserved footprint grows.

One non-blocking raw-input consistency observation: an unnormalized direct object with deep depth 1.5 m, slope and `shallowDepth: 3` produces a 4.235 m range minimum while the renderer clamps the shallow depth and derives a legacy 3.035 m flight. This impossible shallow input is normalized by project restore and cannot be selected in the normal dimension UI. No customer-path geometry failure or change was warranted from that probe.

Candidate browser/3D controls, final integrated screenshot comparison, material realism and actual cloud paths remain assigned to the corresponding browser/data reviewers. Source-only assertions above do not replace those gates.

## Targeted restore boundary follow-up — 2026-10-20

**G08 — FAIL pending surgical correction:** `parseProjectConfiguration()` currently spreads `dimensions.sunShelfRun` through unchanged. Setter and lead-input checks do not protect restore/share: `canonicalSnapshot()` relies on this parser and `shareableProject()` explicitly whitelists the field. A saved string such as `"3.2"` can consequently become `AccessTray`'s requested value; `DimensionControl.tsx:40` calls `value.toFixed()`, which requires a number. Null/non-positive input likewise survives restore and contradicts the valid requested-run contract. JSON serialization maps NaN/Infinity to null; JSON numeric overflow can also parse as Infinity.

Required minimal parser guard: when the field is present, reject it unless `typeof value === "number" && Number.isFinite(value) && value > 0`. Do not add a pool-span or current geometry cap at this syntactic boundary: a valid finite positive request may exceed a subsequently resized pool and must remain explicitly unresolved, not disappear or clamp. Legacy absence must stay absent.

The camera/performance reviewer released the CPU freeze before the small runtime reproduction. An isolated in-memory bundle exercised the actual parser, `canonicalSnapshot()` and `shareableProject()` in 0.10 s; no browser or app/test source change was involved.

| Before-guard input | Parser / canonical save | Actual restored formatting call |
|---|---|---|
| Legacy absent | ACCEPT / ACCEPT; absence preserved | OK |
| Number 3.2 | ACCEPT / ACCEPT; value preserved | OK |
| Number 10 on an 8 m pool | ACCEPT / ACCEPT; unresolved positive intent preserved | OK |
| String `"3.2"`, boolean true, object `{}`, array `[]` | All ACCEPT / ACCEPT and preserved by sharing whitelist | All throw `TypeError: run.toFixed is not a function` |
| Null, 0, −1 | All ACCEPT / ACCEPT | Invalid requested dimension survives |
| Raw JSON numeric `1e309` | ACCEPT as Infinity / canonical save ACCEPT | Non-finite requested dimension survives initial parse; JSON reserialization converts it to null |

This verifies the malformed restore/save acceptance and the exact numeric-format operation used by the control. It is not a claim that a browser crash was independently exercised. The coordinator was notified before applying the guard; the identical 11-input after-guard verification is pending its integration signal.

### G08 corrected — independent after-guard verification

The coordinator integrated the finite-positive parser guard. Repeated the identical 11 inputs against a fresh in-memory bundle of the actual updated parser/service: **25 assertions PASS**, 0.043 s local execution. All eight malformed cases (string, null, boolean, zero, negative, object, array, JSON numeric overflow) now fail at the parser and produce the canonical service's `invalid_snapshot` error. Legacy absence, numeric 3.2 and finite positive 10 on an 8 m pool remain unchanged through parser, canonical snapshot and sharing whitelist. Thus incompatible numeric intent remains repairable after resizing without allowing malformed values into the numeric control.

**G08 final state: PASS — targeted parser/service regression.** Before evidence remains above. No browser behavior, backend write or unrelated snapshot field was exercised or changed by this specialist.
