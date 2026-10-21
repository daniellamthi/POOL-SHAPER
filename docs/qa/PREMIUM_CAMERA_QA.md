# Premium contextual camera QA — 2026-10-13

## Active live-camera correction — 2026-10-15

This section supersedes the historical Infinity camera protection below, not its
geometry/material constraints. Branch `feat/fullscreen-day-night-hidden-overflow`;
baseline local/remote `b40924f7d1f6e61d79c5f586ec007dc3a33bf2de`.
Only cameras, camera routing and their tests may change. Product-photo WIP is
excluded. No backend, new server, environment, geometry or material work.

WIP backup: `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-S6gMSm`
(21 files; secret scan PASS). Existing server PID 15282 on port 3003 has this
workspace as its actual cwd. Evidence folder:
`docs/fullscreen-qa-evidence/premium-live-cameras/` (local, outside Git).

Owners: A = camera engineer (sole production-camera editor), B = independent
browser reviewer, C = camera regression tests, O = primary/integration.
The reviewer's CUA surface cannot access the owner's tab. B exercises the same
server in a separate integrated-browser surface while the root preview remains
visible. This is not storage/profile isolation: after a source reload the root
localhost QA tab adopted the last localhost reviewer draft. The original owner
draft at 127.0.0.1 is kept on that distinct origin and was not used for QA.
After the owner changed the localhost draft during review, B moved to
`http://camera-qa.localhost:3003/`: the same existing server answered on the
first attempt, with a distinct origin and fresh empty draft. No server, DNS or
configuration was changed. Further F replay rebuilds its 8×4 fixture through
the UI on that origin; it is not claimed to retain the previous Project ID.
Both localhost and 127.0.0.1 owner drafts are now left untouched by B.

| ID | Requirement / owner | Acceptance and required evidence | Current status |
|---|---|---|---|
| PC01 | Live preview / O | Same server/workspace, visible integrated tab; draft/WIP preserved | PASS: same server/workspace and visible QA tab8; untouched owner localhost tab4 retained alongside it, original127.0.0.1 draft not used for QA. QA origin camera-qa.localhost, same port3003; WIP backups below. Visible-UI baseline is not a full browser-storage backup |
| PC02 | Sun Shelf / A+B | Oblique raised detail; whole shelf, descent, steps, selected loungers/support and rim visible; not plan/whole-pool panorama | Bounded runtime PASS on final C: 12×5 Infinity side 2, four permitted loungers, 1440/390/430. Shelf/steps/loungers legible without overlap; 390 remains compact in the approved open-panel UI |
| PC03 | Infinity front / A+B | Outward side, near-frontal three-quarter; crest, cascade face, receiver and some interior; traditional/glass distinguishable | Z bounded framing PASS: root actual6×3 side3 traditional/glass1440/390/430, B independently inspected all6 images. Lower physical eye and local terminal/crest/receiver readable, glass distinguishable. FIX REQUIRED overall: coastal support wall remains obvious; overflow film NOT VISUALLY VERIFIED. Not independent browser replay |
| PC04 | Infinity sides / C+B | All four supported sides, sizes 6×3/8×4/12×5, unchanged configuration and geometry | Current Z root runtime covers side3/6×3 both walls3vp; side1/8×4 glass430; side2/8×4 glass390; side4/12×5 traditional1440. B image review confirms bounded framing, with local inox overlap on side2 disclosed. Distributed samples, not full side×size×wall×viewport coverage. Geometry unchanged; no film/landscape PASS |
| PC05 | Internal stairs / A+B+C | Linear/L and all valid orientations; treads, risers and entry visible, including Infinity | F standalone straight PASS1440/390/430 and corner390; H Hydro flights and I Sun Shelf Accesso samples retained. N above-ground L Standard/Speculare both PASS1440/390/430, all6treads/risers visible. These are the two actual orientation choices offered; in-ground Steel quarter-circle offers no orientation control, so four invented runtime orientations are not claimed |
| PC06 | Inox ladder / A+B | Whole fitting, rails and coping junction visible in allowed configurations | N valid in-ground6×3 Skimmer PASS1440/430: whole fitting/rails/rungs/standoffs/coping mounts visible; F8×4 Infinity390 retained. Distributed compatible samples, not every type×size cross-product |
| PC07 | Hydromassage / A+B | Both variants: seat/back, footwell, steps and jets; not rear wall | Bounded PASS for A/B selection detail at 390 (F), 430/1440 (G). G has E's BlackStone/Prun/Travertino selections, but Accesso legitimately renders dry construction surfaces, not the applied final finish; no material realism PASS inferred |
| PC08 | Skimmer / A+B | Selected fitting and waterline legible; model differences recognizable | Dry system I fitting samples retained. Q wet1440 below-terrain FAIL retained as before. R primary-operator wet6×3 Slim/BlackStone/corner+inox/Day1440/390/430 bounded PASS: fitting, rim and water visible, no underside. Independent direct R replay unavailable; not renamed independent PASS |
| PC09 | Overflow / A+B | Separate oblique grille/channel and hidden slot/rim detail | PASS camera framing on D: both types, 12×5, 1440/390/430; actual selected central strip clear of UI. No hydraulic/hidden-channel certification |
| PC10 | Coping and paving / A+B | Real material/edge thickness or slab format/joints visible; no distant overview | Infinity coping E retained; O non-Infinity Travertino PASS1440/390/430. Q Infinity paving extra1440/390 bounded PASS, actual patch/joints readable; earlier G430 is a distributed sample. Not every finish/perimeter audited |
| PC11 | Interior finishes / A+B | Liner/mosaic/inox wall-floor junction in unobscured frame | W camera-only after-selected mosaic23DD3311 real1440/390/430 and SandBeach liner1440/390 bounded framing PASS: wall/floor junction and texture readable, clear of UI. B image critique agrees390. Before31.97m/fit4.54°/fog retained; after3.18m/local34°/fog0 on exact fixture. No texture alteration, physical-scale/PBR or fourteen-finish audit inferred; occupied/short-edge fallback and other shapes not certified |
| PC12 | Above-ground / A+B | Panels three-quarter; stair run/landing/platform; Pellicano profile/discharge; selected cover raised view | I WPC panel patch PASS1440/390/430. K external long/short and Pellicano PASS all three viewports. L valid in-ground cover PASS390 at0/50/100 and OFF/ON;430/1440 at0/100, whole area/housing visible. Cover correctly unavailable above-ground. These are bounded camera visibility checks, not new product/technical certifications |
| PC13 | Lighting / A+B+C | Main lamps from short end; separate riser/bench micro-spot detail; no lighting state mutations | F/G RGB and Q corner samples retained. HydroA U unchanged. AB HydroB front micro-spot macro Day bounded PASS1440/390/430: ring/centre/riser recognizable, UI clear; all3 fixtures remain in model and full bench in distinct Hydromassage camera. Night FAIL visual quality: large existing halo dominates and riser is dark. Not a quantity failure; no lamp/material edit or blanket bench PASS. Explicit owner permission requested for separate halo correction |
| PC14 | Overview / A+B+C | Whole basin and configured accessories with clean margins | Q exact P430 after-pair and390/1440 bounded PASS: entire basin/rim/inox recognizable, SaveSharePDF controls accessible. Requested cover is UNAVAILABLE with inox, no phantom roller. Wrong first430 Scena filename explicitly excluded from exact Summary comparison. No new cloud/export execution |
| PC15 | Technical view / C+B | Existing orthographic top and outlines preserved | M independent runtime PASS: exact L6×3 Skimmer fixture at1440/390/430, whole coping and corner6 treads readable without UI clipping. Additional Guide ON430, cover housing1440, Infinity4 glass receiver390 and above-ground long stair430 samples PASS. I/L small-view failures retained below as before evidence; no geometry/contour change |
| PC16 | Interaction / A+B+C | Brief interruptible transition; reduced motion respected; manual orbit not fought; no wizard collapse, dirty-state or selection reset | G/L runtime samples and root native settled orbit retained. P1440 camera-menu→paving and390 two navigation cycles preserve panel/choices. P430 one blank paving capture was not reproduced in two exact replays, retained as isolated/intermittent, not called fixed. Separate actual projection-aspect leak on local→review demonstrated without resize; not attributed as the blank's cause. Reduced-motion preference=false; true runtime NOT VERIFIED, owner action requested; no fake video/timing claim |
| PC17 | Viewports / B+C | 1440×900; 390×844 and 430×932 emulation; real object/UI visibility, no clipping | PENDING; no physical-mobile claim |
| PC18 | Independent review / B | Reviewer actually operates same app, not implementer reports only | B directly reviewed through Q. Its IAB session disappeared before R; one fresh IAB creation also failed, no Chrome pivot. Root UI fallback explicitly disclosed and permitted by task, but R is not a direct independent runtime PASS |
| PC19 | Targeted checks / C+O | Camera/state tests, typecheck, production build and diff-check on frozen final source | AB frozen source typecheck, production build(build-AB.log),9,797 unique targeted assertions and diff-check PASS:7,739 initial plus2,058 non-Infinity dependency. Z/earlier counts retained historically, not added. Mathematical PASS not promoted to visual PASS |
| PC20 | Delivery / O | Before/after same configuration, screenshot matrix, pertinent commit/push only after visual and functional PASS | PENDING; no merge/deploy |

No historical PASS below is automatically counted as current candidate coverage.

### First live block: Sun Shelf

- Root integrated preview, unchanged 12×5 Infinity / two shelf loungers:
  `before-shelf-12x5.jpg` and `after-shelf-12x5.jpg`; actual panel viewport
  1111×931, not mislabelled as the 1440 test. The new ~40° oblique composition
  exposes the shelf surface, steps and lounger support rather than a ~58° view.
- Independent reviewer genuinely exercised the app in a separate IAB session:
  same 10×4.5 Skimmer / three loungers / day configuration at 1280×720 before
  and after, plus 1440×900, 390×844 and 430×932. Evidence:
  `before-shelf-reviewer.jpg`, `after-shelf-reviewer-{1280,1440,390,430}.jpg`.
- Real failure: mobile tools overlaid the steps. The existing full mobile
  tools wrapper is now measured as a camera occluder (one data attribute;
  no design/layout change). Retest: `after-shelf-toolbar-fixed-{390,430}.jpg`.
  The 430 sample is clear. At 390, the ~110×65 px shelf is still too small:
  removing overlap alone is **not** counted as premium PASS.
- Actual DOM geometry is saved in `shelf-toolbar-{390,430}-rects.json`.
  The maximum-area free rectangle favours a shallow strip. An object-aspect
  framing correction now chooses the free rectangle best fitting the projected
  real shelf envelope. Default framing for other intents is unchanged.
  `after-shelf-framing-fixed-{390,430}.jpg` and complete
  `shelf-framing-{390,430}-rects.json` include the construction-stage badge.
  B observed all three loungers and every step without overlap at both sizes.
  The 390 subject is about 146×90 px, versus 110×65 after the first fix: this is
  bounded legibility evidence, not physical-mobile or whole-product certification.
- Targeted offline results: Sun Shelf 8,148 assertions / 108 cases; stairs
  2,813 / 168 cases; snapshot isolation 50 / 16 focus requests. These establish
  geometric containment/state isolation only, not visibility or animation QA.

### Second live block: front Infinity detail

- `before-infinity-detail-12x5.jpg` and `after-infinity-detail-12x5.jpg`
  use the same root configuration, side and system phase. `infinity` now routes
  to an outward, restrained three-quarter (~23°) detail; `review`/`overview`
  retain the existing coastal whole-pool composition. Selecting a wall variant
  now requests the same dedicated Infinity detail. Merely revisiting the side
  tab still retains `review` until a side is clicked: routing correction pending.
- `after-infinity-wet-traditional-12x5.jpg`: real Presentation + manual
  “Bordo Infinity” control, not a camera override in test code. Water is shown
  only in the phases that already allow it. The existing coastal site's tall
  support face is now visible in the foreground. It is not changed or masked.
- Source diagnosis, independently reproduced: UI centring physically translates
  both the eye and target. On 12×5 portrait, target Y falls from about −0.40 m
  to −7.16 m; the eye remains above ground/water. This is **not** a claim that
  the camera is underground. Reusing optical view offset, without moving the
  real eye/target, is the next camera-only correction under review.
- New offline Infinity gate: 1,874 assertions / 72 cases (three sizes, four
  sides, two walls, three viewports); shape clearance: 12,082 / 144 cases
  including four L orientations and six organic fixtures. Existing detail
  access audit: 48 cases. No visual PASS is inferred from these numbers.
- A3 now reuses optical view offset for the Infinity detail. Independent
  browser retest: full crest/face/interior and no clipping/UI overlap at
  390/430 (side 2 traditional); glass distinguishable at 1440 (side 2).
  Files `after-infinity-optical-reviewer-{390,430}-side2-traditional.jpg`
  and `after-infinity-optical-reviewer-1440-side2-glass.jpg`.
  Root live panel: `after-infinity-optical-traditional-12x5.jpg`.
  The physical target now remains on the actual assembly. This does not fix
  the tall coastal support face or rigid sea/terrain junction: context quality
  remains **FIX REQUIRED**, not reclassified as PASS by the camera tests.
- Thirteen intermediate front-view reviewer captures are diagnostic evidence,
  not final coverage. Repeated captures on the known-defective intermediate
  were stopped; final side/viewport coverage remains to be completed.

### Final offline candidate C

PC19 / regression owner C, frozen camera candidate on 2026-10-15. Commands
actually executed:

- `node scripts/run-premium-camera-regression.mjs all` — PASS, **39,030
  assertions**: physical Infinity/front/UI fit, Sun Shelf and actual loungers,
  stair orientations/mirrors, snapshot isolation, contextual routing, separate
  RGB/riser/bench views, L/Organic camera clearance and animation-state checks.
- `node scripts/run-premium-camera-regression.mjs motion` — PASS, **68
  assertions already included in the 39,030 above**, not additional coverage.
  Executes the production frame callback, retarget setup and manual-start
  handler with lightweight camera/control state: 240 ms detail duration,
  reduced-motion zero duration, latest-target interruption from the current
  pose, timer reset, unrestricted interpolation followed by destination-limit
  restoration, manual cancellation/current-pose limits and Photo Mode freeze.
- `node scripts/run-contextual-camera-audit.mjs` — PASS, **31,771 assertions**.
  Obsolete forced-Infinity-snap expectations were replaced with the required
  interruptible/reduced-motion contract; physical geometry/UI fit guards remain.
- `node scripts/run-premium-camera-regression.mjs detail-existing` — PASS,
  48 existing access-camera fits; this is separate from assertion totals.
- `npx tsc --noEmit --pretty false` — PASS.
- `git diff --check -- scripts/contextual-camera-audit.ts` and
  `git diff --no-index --check /dev/null` for each of the two new camera-test
  files — PASS, no whitespace diagnostics. The no-index difference exit status
  is expected for new files and is not treated as a whitespace failure.

The two assertion suites total **70,801**, with no second addition of the
68-motion subset or the shape-clearance subset. Mobile frame fixtures are
actual browser-captured 390/430 viewport geometry, not physical-device tests.
These offline tests do **not** establish browser frame pacing, real pointer
events, visible object/material legibility or premium visual quality. Browser
replay and its independent final verdict remain **PENDING**. Production-build
and integrated final-gate ownership remain with O; C claims no browser/build,
commit, push or deployment PASS here.
Specific coverage gaps: the Infinity **coping-material detail** and the
Skimmer/grille/hidden-overflow **system details** currently have routing/motion
checks, not projections of their actual fitting/edge geometry into the UI
frame. The coastal whole-pool coping-fit assertions test a different pose and
must not be used to certify those detail views.

### Final offline candidate D

The subsequent browser findings added targeted red-to-green regressions for
Infinity coping, hidden/grille overflow and the overly distant full-edge
Infinity detail. The exact pre-D camera source was preserved locally as
`camera-c-before-d-20261015.ts` (SHA-256
`1c56f4fc5c345605ff129681c2ba40be1a9e63ce900f4684ecb8543cf0b43420`).
Running the `coping`, `overflow` and `infinity` sections with `--candidate-c`
reproduced respectively an actual coping-surface projection outside the frame,
a frontal rather than oblique overflow view and a target centred on the whole
edge instead of the required local terminal construction. An initial coping
oracle station in a genuine slab joint was corrected by bounded, at most
12 mm along-run probing of the same real mesh; it was not counted as an app bug.

Final frozen-D commands actually executed:

- `node scripts/run-premium-camera-regression.mjs all` — PASS, **40,554
  assertions**. Includes 36 actual-mesh coping cases, 18 metric slot/grille
  cases, 72 traditional/glass Infinity cases, the retained shelf/access/state/
  lighting gates and the same 68 animation-state assertions. Coping samples
  intersect the actual slab above and below using the shared 55 mm preset;
  overflow uses the existing section dimensions, not invented product sizes.
- `node scripts/run-contextual-camera-audit.mjs` — PASS, **31,771 assertions**,
  including unchanged whole-pool coastal overview/review coping containment.
- `node scripts/run-premium-camera-regression.mjs shape-clearance` — PASS,
  **11,572 assertions / 144 L/Organic cases already included in the 40,554**,
  not an additional total. Original default-FOV and viewport camera-outside-
  bounding-box/above-ground invariants remain intact, including Organic 20×14
  at maximum curvature. Only the projected detail ROI changed as directed.
- `npx tsc --noEmit --pretty false` — PASS; targeted tracked/new-file
  whitespace checks — PASS, no diagnostics.

The D assertion-suite total is **72,325**, not the older C total plus these
figures. The owner's revised detail requirement explicitly supersedes the
assumption that an Infinity close-up must contain the entire edge: the oracle
now follows a real parameter-derived terminal segment (canonical 3.4 m), its
closure, crest, cascade/receiver and nearby interior. No whole-pool overview
test or collision-clearance proof was removed to make this pass. The original
unchanged access-only audit was not needlessly repeated for D.

These close the previously recorded **offline** coping/overflow coverage gaps
for rectangular samples; generic L/Organic coping-patch projection is not yet
certified by the 36 coping cases. Skimmer was not changed. Real readability of
the narrow slot/grille, coastal context, perceived camera pacing and the
independent browser verdict remain **PENDING**, not PASS from this subsection.
C performed no browser interaction, production-source change, build, commit,
push or deployment.

### Final offline candidate E — Infinity coping eye direction

E changes only the coping-detail eye direction to the exterior deck side;
the real slab subject, dimensions and optical framing are unchanged.
`node scripts/run-premium-camera-regression.mjs coping` passed **1,044
assertions / 36 cases** (6×3, 8×4, 12×5; four Infinity sides; desktop 1440 and
emulated 390/430 UI frames). Actual slab top and underside remain in frame.
`npx tsc --noEmit --pretty false` and targeted whitespace checks passed.
The frozen-D suites above were not needlessly repeated for this one-line change.

The coping projection oracle does not prove occlusion against selected
loungers. An attempted four-lounger fixture was not retained or counted as
PASS: B subsequently confirmed that the tested UI Lato 3 permits and selects
**three** loungers; four belonged to the earlier Lato 2 selection. Independent
real-browser evidence and its final verdict belong to B, not this offline
subsection. No geometry, optional quantity, production source or browser state
was changed by C.

### Final offline candidate F — actual access, comfort and light subjects

Before F, the exact E camera source was preserved locally as
`camera-e-before-f-20261015.ts`, SHA-256
`59bd2e83ece56bfde2b8520c322b7a072170b00ae82ecfc4c238f172e911f6bc`.
Running the `stairs`, `ladder`, `hydro` and `lighting-micro` sections with
`--candidate-e` reproduced respectively 56.31°, 53.47°, 52.64° and 51.34°
high views against the agreed lower oblique-detail contract. These are
geometry/pose negatives, not a substituted browser-quality verdict.

One final targeted run on frozen F executed:

- `node scripts/run-premium-camera-regression.mjs stairs` — PASS,
  **188,777 assertions / 204 cases**, with actual tread heights, exposed
  risers and rim contact only at the arrival; real corner sectors retain
  the renderer's 48 divisions and all supported orientations/mirrors.
- `node scripts/run-premium-camera-regression.mjs ladder` — PASS,
  **103,320 assertions / 54 cases**. Samples lie on actual inox tube
  vertices, flanges, wall pads, treads and their inserts, transformed by the
  selected placement, never a fictitious full-height footprint cuboid.
- `node scripts/run-premium-camera-regression.mjs hydro` — PASS,
  **20,592 assertions / 108 cases**, including both variants' real tiers,
  flight, landing and nozzle faces at their individual elevations.
- `node scripts/run-premium-camera-regression.mjs lighting` — PASS,
  **14,886 assertions / 378 cases**. Main RGB retains the actual basin,
  rim/floor and installed fixture faces from the short side and all seven
  supported colour-state checks. Stair micro-detail covers every installed
  fitting on three consecutive central real riser levels, including the
  standalone straight/corner branches; bench-detail covers all real
  under-seat fittings. Access still covers the entire stair, and camera
  evaluation leaves every selected light in the canonical configuration.
- `node scripts/run-contextual-camera-audit.mjs` — PASS,
  **31,771 assertions**; existing full-pool coastal overview/review and
  configuration/state checks remain intact.
- `node scripts/run-premium-camera-regression.mjs detail-existing` — PASS,
  **48 access cases**, with liner/mosaic checks unchanged. The old oracle
  first failed `rectangle/linear/0.45: clipped footprint`: it demanded
  coping height over every low-tread corner, i.e. empty space rather than
  construction. With explicit root approval, only that audit's access oracle
  was replaced by independent renderer-derived tread/riser/rail samples
  and the real outline argument. All 48 cases and the original .95 clipping
  tolerance remain; no case was skipped or camera widened for the old volume.
- `npx tsc --noEmit --pretty false` — PASS; targeted tracked/new-file
  whitespace checks — PASS, no diagnostics.

The four F regression sections contain **327,575 assertions**; with the
legacy contextual suite, **359,346** were executed in this targeted pass.
The 48 historical access cases are reported separately, not added as an
invented assertion count. These numbers supersede neither the historical
C/D totals nor the browser evidence. Larger counts primarily reflect true
curved/tube vertex sampling, not additional customer workflows. Samples cover
6×3, 8×4, 12×5, all four Infinity sides and 1440/390/430 frames; the existing
stair matrix also retains 10×4.5 and above-ground mirrors. The captured
390 access occluders match the versioned mobile UI fixture. Mobile means
viewport emulation, not physical-device certification.

Unchanged D/E branches were not needlessly re-audited. F's real-browser
readability, occlusion, context and perceived motion remain for the independent
reviewer. C performed no browser operation, production-source change, full
build, commit, push or deployment.

### Subsequent F runtime investigation — corner clipping false positive

B initially reported a left-canvas clip on the isolated origin for 8×4 Infinity,
UI Lato 3, flat 1.50 m, steel, glass, six corner treads and optional inox.
The new actual DOM capture has header bottom116 and menu/badge top132,
rather than bottom127/top143. Exact pre-G camera/scene sources were preserved
as `camera-f-before-g-20261015.ts` / `PoolScene-f-before-g-20261015.tsx`, hashes
`eee17fb046216b7e9f9ba30922dcc26db13dfe310929158c99767f5d953a00d8` /
`e26e444f5cbece40dec2cbf3021c3c83569f7162095bc16f480e41315e34f23b`.

`node scripts/run-premium-camera-regression.mjs corner-captured --candidate-f`
executes that real UI fixture and passes **1,676 offline assertions**: the
nominal six-tread construction projects to x15.65–158.66 / y192.83–324.23
inside frame x0–172.92 / y176–365.52; its generated goal also lies inside
the final Infinity orbit limits. A header-only change did **not** reproduce
the initially alleged defect. This nominal oracle was not used to overrule
the independent visual finding; B was asked to trace the actual six treads
again. No wider envelope or looser tolerance was used to hide the discrepancy.

After B captured the public DEV camera diagnostic after one Reframe, the same
command was extended to construct the **actual six `stairSolid` meshes**,
including their floor-following bases and renderer parent transform. A real
`THREE.PerspectiveCamera` was initialized from the captured eye/target/up,
FOV34, aspect390/844, zoom1 and exact view offset108.5390625/151.2421875;
`THREE.Vector3.project` was applied to all **6,408 renderer vertices**, not an
envelope or hand-written perspective formula. The **14,492-assert run**
(including the previous nominal checks, not added to them) passed, with actual
mesh bounds x15.6547–158.6621 / y202.1112–324.2289.

B then independently traced all six curved tread edges in the same screenshot
and withdrew the clipping FAIL: all six are complete, the largest tread's
leftmost edge is about17 px, and the volume reaching x0 is adjacent wall/floor,
not a cut tread. This was a **false-positive object identification**, not a
camera fix. The real Three projection supports that visual reassessment; it
does not replace it. No G camera patch, case removal or tolerance relaxation
was made. A removed the temporary DEV diagnostics and verified both production
source hashes exactly match the frozen F copies recorded above.
The 14,492 diagnostic assertions are forensic support, **not additional customer
workflow coverage** and not added to the F targeted gate totals above.

### F micro-detail investigation — geometry versus underwater readability

`node scripts/run-premium-camera-regression.mjs micro-captured --candidate-f`
passed **82 targeted diagnostic assertions** for the real 8×4 Hydro B flight
with the newer 390 UI capture. Effective standalone access is null, so the
oracle independently derives the three central complete risers/treads from
Hydro B's actual landing/steps, not the saved corner-access plan. Six physical
spots remain installed. Selected levels are −0.540375/−0.753625/−0.966875 m;
their complete context projects to x20.63–148.13 / y223.51–327.75. This does not
certify refracted wet-material readability. B subsequently confirmed all three
central risers are complete in the Day image; the alleged clipping was not
demonstrated. Night BlackStone/red still has **NOT VISUALLY VERIFIED** recess/
face readability, a distinct visual gate rather than a proved camera clip.
No geometry, shader, material or camera was changed for this investigation.
The 82 diagnostic assertions are not extra customer workflow coverage.

### Final offline candidate G — opening main LED colour from micro preview

The exact pre-G `PoolConfigurator.tsx` was preserved as
`PoolConfigurator-f-before-g-20261015.tsx`, SHA-256
`0c8be67658336b97a3b6ce93a19da3492517a56254e2d408bb4229774c6ab453`.
`node scripts/run-premium-camera-regression.mjs lighting-entry --candidate-f`
reproduced the real state failure: the later Night-preview commit changed the
actual viewport focus back from `features` to `stair-lighting` without another
colour selection. `node scripts/run-premium-camera-regression.mjs lighting-entry`
then passed **80 assertions** on G across Skimmer/Overflow/Infinity and prior
stair/bench micro-preview focus.

This test parses and executes the actual component effect callbacks, their
dependency arrays in declaration order with `Object.is` scheduling, the
actual LightTray tab-change and Night effect callbacks, the actual reducer and
the actual viewport focus expression. It is not a regex-presence assertion.
Both Night dispatches occur; entering Colour immediately requests `features`
and retains it after the second commit, without changing the already-night
configuration, project ID, wizard position, selected products or independent
light states. The existing saved-snapshot dirty predicate stays false. After
main RGB focus is established, further colours retain its stable request,
do not reframe, and preserve a deliberately selected manual inspection.

`npx tsc --noEmit --pretty false` passed after the test additions; targeted
tracked/new-file whitespace checks produced no diagnostics. No unchanged
geometry suite or backend audit was repeated. These 80 state/effect assertions
are a targeted G gate, not additional browser customer paths. Real tab-entry
and colour-comparison browser replay remains pending with B at this point.

### Final offline candidate H — Access with an integrated Hydro flight

B found a genuine G routing gap: Hydro A/B removes the standalone access plan,
so selecting Access returned no component pose and fell through to the pool
overview. Exact G `camera.ts` / `PoolScene.tsx` were preserved as
`camera-g-before-h-20261015.ts` / `PoolScene-g-before-h-20261015.tsx`; their hashes
remain respectively the frozen F hashes `eee17fb0…a00d8` / `e26e444f…4f23b` above.
`node scripts/run-premium-camera-regression.mjs integrated-access --candidate-g`
reproduces the null component pose with actual `effectiveAccess=null` and no
standalone placement; no invented internal plan is supplied to make it pass.

`node scripts/run-premium-camera-regression.mjs integrated-access` passes
**8,357 assertions / 108 cases** on frozen H: Hydro A/B, 6×3/8×4/12×5,
Skimmer/Overflow/all four Infinity sides, 1440/390/430. The independent oracle
uses every actual landing/tread surface and front riser at its own elevation;
the target must lie on that flight rather than the pool centre, with an oblique
view and unchanged selected hydro/inox/configuration. It also executes the
actual CameraRig subject-aspect callback to prove that optical framing uses
the integrated flight, and confirms standalone linear/corner subjects are
delegated unchanged. This is geometry/dataflow coverage, not browser PASS.

Typecheck and targeted tracked/new-file whitespace checks passed after these
test additions. The unchanged F geometry suites and G colour-entry suite were
not repeated: H does not edit `PoolConfigurator.tsx`. The 8,357 assertions are
this targeted H run, not extra customer journeys or a replacement for B's
remaining real Access/Hydro replay. No production source or browser state was
changed by C.

### Final offline candidate I — Access with Sun Shelf and real loungers

B confirmed the corresponding H Access fallback with Sun Shelf. Exact H
sources were preserved as `camera-h-before-i-20261015.ts` (SHA-256
`e4767423b49f61d054e2cf1ec5309ee136a36ef41640f5cd43f63f3138c66228`)
and `PoolScene-h-before-i-20261015.tsx` (SHA-256
`e4395aa3d8f36c6d4b47ddf489aa8f4662c564c320ee20988cac4aa80de03ee6`).
`node scripts/run-premium-camera-regression.mjs shelf-access --candidate-h`
reproduces Access's missing subject aspect (`undefined`) while the dedicated
Shelf subject has a valid aspect. No standalone placement is invented.

`node scripts/run-premium-camera-regression.mjs shelf-access` passed
**21,421 assertions / 174 cases** on I. It enumerates OFF and **every quantity
actually permitted** by the existing fixed-size lounger planner, for
6×3/8×4/12×5, Skimmer/Overflow/all four Infinity sides and 1440/390/430.
The actual CameraRig aspect callback receives the real selected-furniture
envelope for both Access and Shelf; the two poses must be exactly equal.
All actual shelf/flight levels and selected-lounger envelopes remain in frame,
with canonical quantities and configuration unchanged. The preserved H
resolver is also executed on non-shelf inputs to prove standalone and Hydro
A/B subjects remain exactly equivalent, not rebuilt by this fix.

Typecheck and tracked/new-file whitespace checks passed after these test
additions. Unchanged G colour-entry and other F/H geometry suites were not
needlessly repeated. These 174 cases are targeted offline geometry/dataflow
coverage; independent real-browser Access/Shelf confirmation remains separate.
C changed no production geometry, camera, renderer or browser state.

Independent I runtime evidence is now available in `independent-review-I.json`:
18 aggregate rows map actual options to individual viewport captures, not an
18-screenshot coverage claim. B exercised the app through the UI on the isolated
QA origin, with no cloud save, quote, email or backend writes. All 34 I artifacts
were copied to the evidence folder and byte-compared with their external
originals: zero mismatches. Root preserved another secret-free WIP backup at
`/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-GHfsOd`
(32 files, baseline unchanged).

- Access/Shelf after I: `I-access-shelf-no-loungers-8x4-1440.jpg` and
  `I-access-shelf-2loungers-8x4-{390,430}.jpg` show the complete selected
  shelf, actual flight and permitted furniture. Mobile remains compact.
- Distributed Infinity side samples: `I-infinity-side1-traditional-6x3-430.jpg`,
  `I-infinity-side2-glass-6x3-390.jpg`, `I-infinity-side4-glass-6x3-1440.jpg`.
  Existing grey site support and unverified water film are not waived.
- Technical top: `I-top-6x3-{1440,390,430}.jpg`; projection is orthographic.
  At390 the approximately85×45px basin is too small for technical details.
- Skimmer high/Slim, Sand Beach liner, inox interior, representative mosaic
  and WPC panel patch have per-viewport files and bounded conclusions in JSON.
  These are camera/application checks, not new material or hydraulic audits.
- External stair: `I-external-stairs-short-6x3-430.jpg` and
  `I-external-stairs-long-6x3-1440.jpg` show the actual run/landing/guard.
  Both `I-external-stairs-long-6x3-390.jpg` and its separate diagnostic capture
  are entirely blank. `I-external-stairs-long-390-diagnostic-rects.json`
  records the real canvas/UI rectangles, external-stairs focus and perspective
  projection. No summary panel is present. No reframe or camera override was
  used to hide this failure. Cause/fix/retest remain required.

### Candidate J — external stair disappears into distance fog

The I long-stair mobile blank is reproducible, not a missing model or a
summary-panel collision. C executed the actual staircase planner and real mesh
enclosure with B's captured390 UI: the former390×109.52px free strip drives a
65.74m eye-to-target distance. Actual stair vertices have camera-space depth
64.68–68.11m, while the unchanged scene fog starts at20.12m and ends at67.08m.
The selected component is geometrically in the frustum but almost completely
dissolves into the background. Merely adding subject aspect still leaves the
eye about46m away and is not accepted as a fix.

J shares the existing external-stair subject between the pose and UI-aspect
selection. Only this intent fits with the existing34° lens in the available
frame, then uses an optical inset projection with matching frame aspect.
This keeps the physical eye near the staircase instead of fitting a reduced
full-canvas field of view from far away. No fog, material, model, platform,
quantity or technical configuration is changed. The other camera intents
retain their existing lens path. I camera/Scene sources are preserved as
`camera-i-before-j-20261015.ts` / `PoolScene-i-before-j-20261015.tsx`.

J targeted regression: `external-fog --candidate-i` reproduces the red fog
failure, then `external-stairs` passes8,592 assertions /18 cases
(three sizes ×two sides ×three viewports). It executes the actual Rig aspect,
local-lens and optical-offset callbacks, projects real enclosure vertices and
guard envelope inside the selected UI frame and checks all those vertices
against the unchanged fogNear. For6×3 long-side390 the actual view-depth range
becomes14.34–17.77m, ahead of fogNear20.12m. The local lens stays34°;22 other
intents retain their previous non-local route. The construction badge fixture
is a conservative earlier rectangle at top132, not mislabelled as a newly
complete DOM capture. B must capture the complete actual selector on replay.

Production build J PASS (`build-J.log`), typecheck/diff-check PASS. The affected
production motion-callback suite also remains PASS (68 assertions /12 cases).
Independent replay of the exact failed fixture is pending; no visual PASS is
inferred from these automated results.

Independent J replay (`independent-review-J.json`) rejects a visual PASS:
`J-external-stairs-long-6x3-390.jpg` is no longer blank, but the real landing
continues beyond the left frame and the flight's lower end overlaps the tools.
`J-external-stairs-long-390-dom.json` now includes the actual construction badge
and all camera occluders. No430/1440 continuation was counted after this FAIL.

A temporary DEV-only DOM diagnostic, not a production feature, captures the
settled real camera (`J-runtime-long390.json`): eye/target equal the intended
pose and flying=false, but actual aspect is390/844=.462085 while the optical
inset requires172.921875/189.515625=.912441. The installed R3F `updateCamera`
resets perspective aspect on size **or DPR** changes; the existing adaptive
quality changes DPR at movement/idle. Thus the isolated projection test missed
a real lifecycle override. No tolerance is relaxed and no model is resized.
K will scope manual projection ownership to this existing inset camera,
restoring the previous property when it exits. Diagnostics must be removed and
the exact failed fixture replayed before visual PASS.

K production source now implements only that scoped ownership effect. It
restores the prior `manual` value/property absence on exit; other camera
intents remain R3F-managed. No adaptive-quality, fog or geometry change.
All temporary diagnostic code is removed, and the root integrated preview
actually reports `data-camera-diagnostic=null` while retaining Infinity focus.
Production build K PASS (`build-K.log`), typecheck/diff-check PASS. The red
`external-lifecycle --scene-j --mobile-repro` executes exact J and the installed
R3F update/subscriber, reproducing aspect.462085 instead of.912441 after DPR,
matching B's real DOM diagnostic. Current K `external-lifecycle` passes58,712
assertions /18 cases, including real vertices, UI/frustum/fog, DPR→idle→size,
restoration of absent/false/true manual values,22 other intents left intact,
continued renderer resizing and unchanged eye/configuration/dirty predicate.
`external-stairs` separately passes8,592 base assertions already included in
that lifecycle count: they are not added twice. Motion remains68 PASS, giving
58,780 pertinent nonduplicated assertions. These remain offline causal and
regression results; independent exact-fixture replay is still required.

Root's apparent tight Infinity crop was also checked rather than guessed:
`J-runtime-root-infinity1111.json` records the actual1111×931 Night camera,
eye/target matching the intended pose and a coherent full-canvas aspect/view
offset. The selected3.4m end detail is distinct from the surrounding basin
continuing outside a detail shot. No new Infinity defect or fix is claimed
solely from the cropped surrounding context in the root screenshot.

Independent K replay now confirms the external-stair correction with all six
real captures `K-external-stairs-{long,short}-6x3-{1440,390,430}.jpg`.
The selected run, landing and guard are complete; long390 no longer disappears,
clips the platform left or hides its lower treads behind the tools. Extra pool
context may continue outside a detail frame. Root directly inspected the390
long-side image. The diagnostic attribute is null in B's replay as well.
`independent-review-K.json` records these bounded visibility conclusions and
the three-viewpoint Pellicano results, not blanket luxury certification.

K's next real failure is the valid in-ground cover camera: both
`K-cover-slider0-6x3-390.jpg` and `K-cover-slider100-6x3-390.jpg` are blank,
with cover/perspective focus confirmed by `K-cover-390-dom.json`. The desktop
file `K-cover-closed-6x3-1440.jpg` was named imprecisely: the UI actually shows
**0% closed**, not a closed cover. Its original filename is retained and this
metadata correction is explicit. Above-ground correctly offers no ordinary
cover, requiring a dedicated project; that compatibility rule is unchanged.
No430 cover, Top baseline or extra1111 Infinity replay was counted after the
cover FAIL. Camera-only diagnosis/fix/replay remain required.

### Candidate L — cover camera, without changing the cover

C's actual K CoverPlan/renderer diagnostic proves the390 failure for both
0% and100% closed: the old generic pool+paving+floor envelope and world-space
UI translation put the target at[9.16,−12.73,5.09] and the eye at
[84.77,62.88,47.09]. Real housing/mat samples have camera-space depth
111.86–117.33m, beyond unchanged fogFar67.08m (100% background colour).
The camera pose is the same at both slider ends; this is not a missing cover,
cover-height or material defect.

L frames the actual cover opening, real coping and the actual housing only
when CoverPlan.geometry exists. OFF keeps the real opening/rim and invents
no roller. The full supported deployment area makes0/50/100% comparisons
share a pose. It reuses K's existing local34° optical inset/manual ownership,
without changing fog, CoverPlan, renderer, dimensions, elevation or controls.
The sole routing adjustment preserves the current COVER request during its
position/extension edits; a fresh equipment ON/OFF decision still requests
focus after manual orbit. COVER was deliberately not added to the global
same-focus stability list. Targeted regression and independent replay remain
required before any cover visual PASS.

L targeted results: `cover --candidate-k --mobile-repro` reproduces the old
fogNear failure; `cover-state --candidate-k` reproduces revision4 instead of3
on slider edit. Current `cover` passes999,011 assertions /108 state-cases:
three sizes ×Skimmer/hidden/grille overflow ×three viewports ×OFF/0/50/100%.
It derives actual housing boxes/lamella constants from the existing renderer,
checks real slat/bar/roller vertices, rim/travel and the actual Rig projection
through installed R3F DPR/resize/cleanup. `cover-state` passes31 checks:
slider edits preserve the view request while legitimately modifying the saved
configuration; fresh equipment toggles still refocus. No roller is invented OFF.

Dependencies retained: `external-lifecycle`58,712 assertions /18 cases
(including its8,592 base checks, not counted twice) and motion68. Pertinent
nonduplicated total1,057,822 is vertex/lifecycle assertion coverage, **not**
customer journeys or visual proof. The actual390 cover DOM is used;430 has an
independent header fixture and desktop a deterministic envelope, both requiring
browser confirmation. Typecheck, production build L (`build-L.log`) and
tracked/new-script diff-check PASS. All files are now frozen for B's replay.

Independent L replay (`independent-review-L.json`) now verifies the same K
6×3 in-ground fixture:390 at100→0→50→100% has a complete cover area/housing,
stable view and no UI overlap; OFF removes slats **and housing**, ON retains
100% deployment and refocuses without collapsing the panel or losing choices.
`L-cover{0,50,100}-6x3-390.jpg`, `L-cover-off-6x3-390.jpg` and
`L-cover{0,100}-6x3-{430,1440}.jpg` are actual captures. Diagnostic is null.
The three before-Top captures and full UI/technical fixture are preserved in
`L-before-top-skimmer-6x3-{1440,390,430}.jpg` and
`L-before-top-skimmer-fixture-dom.json`. At390 the basin is still about99×55px;
that confirmed framing defect remains open for the next isolated correction.

Root, with source/tests/report frozen, also used the documented native drag
in the actual user-facing integrated tab: [650,350]→[730,350], Infinity8×4 /
Hydro B / Black Stone / red Night at the actual1111×931 panel size. The camera
visibly rotates and stays there after idle; before/after/settled captures are
`L-root-orbit-{before,after,settled}-1111.jpg`. Visible technical selections,
Night and open wizard panel remain unchanged in AX/screenshots. This proves
post-transition manual ownership for that sample, not a frame-time benchmark,
in-flight interruption recording, physical-mobile test or independent B gesture.

### Candidate M — technical Top framing only

The fresh L before/after fixture is explicitly preserved in
`L-before-top-skimmer-fixture-dom.json`, not reconstructed from old screenshots.
Guide OFF M uses actual coping, selected Infinity receiver, external stair and
active cover-housing bounds, and chooses UI-free space by the plan's aspect.
It removes duplicate metric padding and derives a6–12px safety margin from the
shorter frame side. Guide ON retains the old bounds, frame selection and exact
numeric frustum. Orthographic projection/up, construction edges, dimensions,
Photo Mode and all other subject cameras are unchanged. Only PoolScene and
the camera-frustum function in architecturalPlan changed; no geometry/material.

`top --candidate-l` reproduces the red pixel-gain requirement; current `top`
passes190,537 assertions /216 cases across three sizes, Skimmer, both overflow
types with cover OFF/ON, four Infinity sides, above-ground long/short stairs,
Guides ON/OFF and three viewports. Actual construction points stay within the
orthographic frame; old Guide ON results match exactly, architecturalEdges AST
hash is unchanged, and23 other subject-aspect branches remain identical.
For the nominal **inner6×3 rectangle**, computed pixel bounds change:
39088.75×44.37→196.76×98.38;430156.67×78.33→235.44×117.72;
1440401.19×200.60→671.72×335.86. B's approximate before measurements include
the visible perimeter and must not be mistaken for these inner-rectangle values.
There is no invented premium pixel threshold; real visual acceptance is recorded below.

Default `all` also passes1,599,141 camera assertions with a filesystem guard
rejecting reads of ignored evidence/backup paths. That total **includes** the
Top count, not extra coverage to sum. Minimal verified historical AST/oracle
fixtures are versioned for fresh-checkout portability; the one former ignored-H
dependency in shelf-access was replaced with its exact extracted oracle, without
changing its174 cases /21,421 checks. Historical full-source flags remain local
diagnostics. Typecheck, production build M (`build-M.log`) and tracked/new-file
diff-check PASS. No browser PASS is inferred from those checks.

B subsequently operated the actual app independently, with the exact L fixture
and no Riquadra, producing `M-after-top-skimmer-6x3-{1440,390,430}.jpg` and
`M-after-top-skimmer-fixture-dom.json`. Orthographic projection, complete coping
and all six actual corner-tread contours are visible and unobscured at all three
viewports. At390 the visible perimeter is approximately218×120px versus L99×55;
this is a visual reviewer observation, not the computed inner-rectangle metric.
Additional actual captures show readable Guide ON dimensions430, complete active
cover housing1440, Infinity side4 glass receiver390, and above-ground external
long flight/platform430. Root directly inspected the390 after capture. These
bounded PASS rows and remaining requirements are in `independent-review-M.json`.
Mobile means DPR1 viewport emulation, not physical-device performance. PC16 and
the remaining camera matrix are not closed by this Top result.

### Independent N — remaining orientations, ladder and paving

Source remains M; N is an evidence prefix, not another implementation.
B operated both actual above-ground L choices, Standard and Speculare, on all
three viewports. All six real treads/risers and junctions remain visible; the
surrounding pool/external staircase may continue outside this local detail.
The in-ground Steel quarter-circle UI has no orientation control. Neither four
runtime buttons nor four tested corners are invented to satisfy a checklist.
The N inox samples fill the missing1440/430 viewports in a valid6×3 in-ground
Skimmer configuration; rails, rungs, lower standoffs and coping mounts are whole.

Opening Pavimentazione alone correctly retargets the camera at1440, where the
selected Travertino60×120 patch and joints are readable. The same fixture at390
has a visible, unobscured but washed-out/distant patch: joint/format detail is
**NOT VISUALLY VERIFIED**. Root inspected `N-paving-travertine-6x3-390.jpg`;
`N-paving-390-dom.json` confirms focus=paving/perspective and the actual UI frame.
This is not upgraded to PASS from the focus label, nor diagnosed as a shader bug.
Precise files and coverage are in `independent-review-N.json`. The new persistent
pre-fix backup `residual-gates-20261015-nj8U2F` preserves35 files at unchanged
HEADb40924f; secret scan PASS. No backend or unrelated photo WIP was altered.

### Candidate O — non-Infinity paving camera, causal diagnosis

C reproduced the actual N390 DOM and M source before authorizing a fix.
The existing real3×1.8m patch is already inside the2.6m deck band: no paving
geometry or material fault is inferred. Focus=paving, detail=true but local=false,
subjectAspect undefined; the UI-free frame is[0,176,390,109.515625]. The effective
FOV4.543574° places the eye37.95387m from target[0,0,-2.85]. Actual patch depths
37.07615–38.83158m cross the unchanged fog range20.12461–67.08204m, with computed
29.687–34.967% fog blend. The projected patch127×90px is not clipped. Unlike J,
reapplying the actual R3F canvas aspect produces an identical matrix here.

This demonstrates a distance/framing cause, not a texture/shader conclusion.
The authorized minimal fix is to reuse K/L's local framing only for non-Infinity
paving, with identical actual patch bounds for pose/aspect. Infinity, panel,
cover and scene geometry/material/fog must remain unchanged. Implementation,
targeted tests and an exact-fixture independent before/after are still pending;
no O PASS is claimed from the diagnosis. The N1440 and older G430 images have
different fixtures/metadata and are not misrepresented as a controlled numerical
comparison with N390.

O now reuses that existing local pipeline and extracts the identical paving
subject for shared pose/aspect calculations; the scene and camera helper are
the only two production files changed from M. C independently reproduced red
with `paving --candidate-m --mobile-repro`, then current `paving` passes8,966
assertions /54 compatible size×structure×water-system×viewport combinations.
Actual N390 target stays[0,0,-2.85], eye becomes[1.62851,4.73748,-5.81092],
distance5.81918m; all patch depths4.94146–6.69689m lie before unchanged fogNear.
Frame238.09×169.52, actual R3F idle/DPR/resize/manual cleanup and configuration
invariance are checked. Thirty-six Infinity direction cases and panel poses
remain protected. No texture/visual PASS is inferred.

Pertinent O dependencies also PASS: external lifecycle18cases/58,712assertions,
routing283, actual motion callbacks68, Top216cases/190,537. The pertinent total
258,566 is numerical assertions, not customer journeys or extra historical
coverage. Current default paving tests use tracked minimal historical AST plus
current sources, not ignored evidence files. Typecheck and diff-check PASS;
root production build O passes in `build-O.log`.

B subsequently captured `O-after-paving-6x3-{390,430,1440}.jpg` and
`O-after-paving-dom.json` from the actual app. The exact N390 fixture/panel is
preserved: longitudinal/transverse joints and selected module are now visibly
distinguishable and the actual patch is the subject, clear of UI. Root directly
inspected both390 images. This is bounded visual camera PASS, not an audit of
all finishes or the entire paving perimeter. The430/1440 after samples are not
presented as identical before/after fixtures from older campaigns. Geometry,
materials and fog were not altered to obtain the result. PC16, remaining light
detail and the separately documented Infinity environment limits remain open.

### Independent P — interaction and newly confirmed Overview defect

O remains the frozen source candidate; P is runtime evidence only.
At1440 the actual Overview/Access/Top→paving menu path returns to the selected
paving detail. Two Esterno→Optional→Indietro cycles at390 preserve the open panel,
Travertino60×120 and actual view. A430 paving return capture was blank, but two
limited exact replays both show the correct paving scene. The original image,
trace and both new attempts are retained in `independent-review-P-partial.json`;
it remains isolated/intermittent/non-reproduced, not a fabricated fix or PASS.
Cover was already ON in the first observed Optional summary; because N did not
record that prior field, no camera-induced cover mutation is asserted.

A distinct PC14 failure is reproduced twice at430: same6×3 in-ground Steel,
SkimmerSlim, corner6+inox, Sand/Prun/Travertino, Day, cover100. Presentation Summary
and explicit Overview both leave the actual basin/accessories almost invisible
in fog. Root inspected `P-overview-cover-inox-skimmer-6x3-430-repro.jpg`;
`P-summary-overview-430-blank-dom.json` records focus=review/perspective, unchanged
visible configuration and intact Save/Share/PDF controls. Those controls alone
are not a scene PASS. `independent-review-P-summary.json` retains both FAIL rows.

C separately executed actual O projection/ownership callbacks in memory:
local→review without a resize/DPR event retains aspect1.25087855 at430 instead
of canvas0.46137339, with view.disabled and manual correctly restored. Projection
m00 is2.614844 instead of7.089383. The same leak occurs at390/1440; actual R3F
resize corrects it. This is a numerical projection fault, not proof of the cause
of the intermittent paving blank, which re-enters local projection correctly.
No speculative source fix has yet been made. The persistent O backup is
`residual-gates-20261015-1QSxvN`,36files, HEADb40924f, secretScanPASS.

PC13 remaining light details, extra Infinity paving viewports and wet Skimmer
waterline remain explicitly pending after the reproduced Overview failure.
Reduced-motion is still false in the real browser; true runtime awaits the
precise temporary owner action requested. No OS settings were changed silently.

### Candidate Q — non-Infinity Overview and projection handoff

C reproduced the exact P430 Review pose: eye-target64.94936m, actual coping/shell
depth61.21575–68.65878m versus fog20.12461–67.08204m, producing95.708–100% fog even
with correct canvas aspect. The old WORLD UI shift lowers targetY to−8.74283m.
The separate stale aspect reduces projected width139.23→51.35px but does not
cause the fog. Requested cover100 is UNAVAILABLE because inox is selected;
the actual resolver has geometry=null, not a cover roller to invent in bounds.

Q changes only camera.ts and PoolScene. It shares the **identical existing**
whole-pool overview envelope/direction with free-frame aspect selection and
reuses local34/inset/manual for non-Infinity Review/Overview, without WORLD shift.
The old fit1.05/min-radius/target algorithm remains intact. Nonlocal projection
explicitly restores the current canvas aspect before projection setup, rather
than relying on a later R3F resize/DPR event. Infinity poses, scene, geometry,
materials, fog and UI are not changed. Independent regression and exact P430
browser after-pair are pending; the isolated paving blank is not called fixed.

Q regressions reproduce two separate O reds: Overview430 actual fog, and actual
local→nonlocal projection exit without resize/DPR. Current overview passes108
cases/1,250,936 assertions on real renderer-positioned coping/shell, inox, valid
cover and above-ground Long/Short stairs. At P430 eye-target distance is15.793m,
real geometry depths12.0595–19.3150m lie before unchanged fogNear20.1246m.
The test oracle retains all8 original envelope corners for frustum checks, but
correctly applies fog tests to real geometry, not an imaginary corner1.6m outside
the pool and1.5m below the lawn. No fog threshold/tolerance or real vertex was
relaxed. Projection exit passes92 checks; full-canvas Photo Mode and Infinity
coastal projection/crop match O exactly. Paving54/8,966, external18/58,712,
Top216/190,537, motion68 and routing283 dependencies pass. These numerical counts
are not summed with prior campaigns as customer coverage. Typecheck and root
production build Q (`build-Q.log`) PASS. Actual browser after-pair remains open.

B's completed replay is `independent-review-Q.json` (eight grouped rows).
Exact P430→`Q-after-exact-summary-overview-skimmer-inox-6x3-430.jpg` and
`Q-summary-overview-skimmer-inox-6x3-{390,1440}.jpg` show the real whole basin,
rim and inox, clear of UI; root directly inspected390. The first
`Q-after-summary-overview-skimmer-inox-6x3-430.jpg` was actually Scena after HMR,
and is explicitly **excluded** from the same-fixture Summary after-pair.
Paving→Summary→Paving1440 returns to the actual close detail without a blank.
Top+inox430 shows the actual rails clear of the dock; the separate root1080
context observation is not represented as an identical fixture/reproduction.
Infinity paving1440/390 patches and joints are readable. Corner Night430 has
readable central risers/spot recesses with BlackStone/Red; HydroA bench under
the same finish/light remains NOT VISUALLY VERIFIED, without speculative cause.
These bounded results do not close the remaining gates.

The integrated owner-facing tab remains open. On the latest root observation
it shows8×4 hidden overflow/Day at Finiture; root selected only Dall’alto and did
not restore the earlier Infinity/Night draft over the current visible choices.
`Q-root-integrated-current-top.jpg` is a fresh actual capture, not a rebuilt
image. Its contextual inox projection near the lower dock merits a bounded Top
check with the reviewer; this is not yet a qualified new clipping FAIL.

### Candidate R — true wet Linea d’acqua

Q's actual Presentation→Linea d’acqua1440 capture is a reproduced camera FAIL,
not a dry hydraulic-phase sample. `Q-skimmer-presentation-waterline-6x3-1440.jpg`
shows the underside of decking and outer black wall. The DOM confirms waterline/
perspective on the6×3 Skimmer Slim, BlackStone, corner+inox, Day fixture. C measures
RAW eyeY0.707/targetY−0.293; WORLD UI shift−1.23734m produces eyeY−0.53034 and
targetY−1.53034, below terrain/floor. Actual depth6.54–13m is before fogNear;
this is not fog, material or Q's already-corrected aspect leakage.

R reuses the existing internal hydraulic camera for non-Infinity waterline,
with the same real wall/water span driving local lens/aspect and no WORLD shift.
Infinity waterline remains unchanged. Geometry/material/UI/backend are untouched.
Independent checks and the exact wet after-pair are pending, not PASS from source.
Pre-R backup `residual-gates-20261015-9cAH9a` preserves37files at HEADb40924f,
secretScanPASS; both source hashes were verified identical to frozen Q before R.

Verification continued on2026-10-16. C reproduced Q's below-ground red, then
R passes108 compatible size×viewport×structure×hydraulic cases/19,840assertions.
Exact1440 eyeY0.337/targetY−0.113 stays inside the basin, above terrain, with actual
fitting/slot/grille points in frame and rays not crossing the opposite opaque
wall. Infinity waterline and other24 intents remain protected. Pertinent
projection-exit92, one Overview case25,406, motion68 and routing283 also pass:
45,689 numerical checks, not customer journeys. Final typecheck/diff-check PASS;
root production build R passes in `build-R.log`. No wet visual PASS is inferred;
all files are frozen before B's exact Q fixture after-pair.

B's browser session then disappeared. Its one inventory/fresh IAB attempt could
not reconnect; no draft was changed and no Chrome fallback was used. Root's
existing IAB2 still worked, so the explicitly permitted primary-operator UI
fallback was disclosed to the owner. It uses tab7 on the isolated
`camera-qa.localhost` origin; owner drafts on localhost/127.0.0.1 remain untouched.
The observed draft is6×3 Steel/Skimmer Slim/BlackStone/Prun/Travertino60×120,
corner stairs+inox, Day, requested cover unavailable with inox. Actual wet
Presentation→Linea d’acqua captures `R-root-waterline-skimmer-6x3-{1440,390,430}.jpg`
show the fitting, rim and water, with no below-deck view or selected-fitting
clipping. Bounded primary-operator visual PASS, not independent direct replay.
Public DOM evidence: `R-root-waterline-after-dom.json`; mobile is emulation.

One additional real UI sample switched only the QA draft to Infinity, default
Lato3 traditional, then Presentation→Linea d’acqua1440. This exposes another
legacy preset FAIL: exterior decking occludes most of the basin. Evidence
`R-root-infinity-waterline-6x3-1440.jpg`, public DOM and exact occluder rectangles
in `R-root-infinity-waterline-{dom,rects-1440}.json`. The separately selected
approved Bordo Infinity pose remains unchanged (`R-root-infinity-approved-front-wet-6x3-1440.jpg`).
Only the defective waterline preset is under causal diagnosis, not geometry,
materials, coastal scenery or the approved front Infinity camera. Backup before
any further source edit: `residual-gates-20261015-kH2PUq`,38files, secretScanPASS.

### Candidate S — Infinity waterline only

C reproduced RED on the frozen R source with the exact public UI rectangles:
post-WORLD eyeY−0.387843861, targetY−1.387843861; the ray crosses the opaque +X
wall atY−1.081907559. The raw pose looks from +X regardless of the selected
Infinity side. Both causes are preserved in the portable S fixture; no exact
measurement is inferred from the older Skimmer UI sample.

S changes only this preset in `camera.ts`/`PoolScene.tsx`: a metric midpoint and
local inward normal of the actual selected Infinity arc, its2.2–3.4m bounded
crest/water span, and local34° lens/inset/aspect framing instead of WORLD shift.
It reuses the existing hydraulic detail pose. Exact1440 eye[0,0.4795,0.12624],
target[0,0.0295,1.42]. No geometry/material/scenery/UI/backend change.
The approved Bordo Infinity/coping functions and coastal/projection ownership
paths remain identical to R, verified by the targeted source/AST protections.

Root operated the real frozen S app: `S-root-infinity-waterline-6x3-{1440,390,430}.jpg`
plus `S-root-infinity-waterline-after-dom.json`. These are the same6×3 Lato3
traditional/BlackStone/Prun/corner+inox/Day QA draft as the real R before image,
not a new 8×4 or a generated picture. Crest and sea replace the exterior-deck
occlusion; bounded primary-operator orientation PASS on desktop and emulated
mobiles. Independent B inspected the actual R/S desktop images with view_image:
agrees no underdeck/opaque-wall occlusion; notes low BlackStone/water contrast
and absent lateral closures in the crop. This is independent image criticism,
NOT independent direct browser replay, exact-level verification or proof of a
realistic overflow film. Those limits and PC03's coastal support issue remain.

S tests:7,808 assertions/72 size×side×wall×viewport cases, non-Infinity R
dependency19,840/108 and projection-exit92:27,740 pertinent assertions PASS.
The tested subject is the actual crest/lip and central adjacent water slice;
the whole water plane is intentionally outside this detail frame, not a relaxed
clipping tolerance. Typecheck/diff-check PASS; root production build PASS,
`build-S.log` (no deployment). All source and tests are frozen for this runtime
check. No commit/push while the other mandatory visual limits remain open.

### T — remaining Hydro A bench-lighting view

Continuation16 October: source/branch still S at HEADb40924f. Root used the real
QA draft only: switched back to Skimmer, selected Hydro A, entered Finiture then
Continua→Illuminazione. Main LED remained Red60%, stair spots ON, bench ON,
BlackStone799,6×3 Steel/corner+inox/Prun/Travertino60×120. Macro navigation did
not remove those valid selections. Actual UI reports1 main lamp and5 riser spots;
no extra lamps are inferred. Bench OFF→ON preserves main/stair selections and
routes to public canvas focus `bench-lighting`.

`T-root-hydro-A-bench-{OFF,ON}-blackstone-red-night-6x3-430.jpg` and paired
`T-root-hydro-A-bench-ON-blackstone-day-6x3-430.jpg` are real browser captures;
`T-root-bench-day-dom.json` records exact public UI/occluder rectangles. Both
root and independent B image criticism cannot identify both under-seat fittings
clearly in either Day or Night. This is not declared PASS from checkbox state.
B has no direct browser session; this continuation remains root-operated.

C's narrow readonly ray test uses the renderer's actual
`shelfStairGeometry(hydro,floor)`, not a replacement bounding box. Both actual
spot faces are front-facing (dot0.4874/0.7183), and previous fog0 is retained.
The ray towards spot0 lens[-2.5445,−0.713,0.4925] hits the divider top at
[-2.114455,−0.243,−0.117905],16.0256m before the lens at16.9079m. Spot1 has
no opaque hit. This demonstrates a camera-side divider occlusion, not missing
geometry, emissive nozzles or an assumed shader defect. A/C are correcting only
the bench-lighting view after portable RED; geometry/material/light states stay
unchanged. Pre-edit S backup `residual-gates-20261015-DYbQ7H`,40files,
secretScanPASS. No final visual or source PASS yet.

Primary native orbit feasibility proof (not an automatic-preset PASS):
`T-manual-orbit-raised-{day,night}-hydro-A-430.jpg` shows both actual under-seat
ports inside the footwell. Day→Night retains the manual view and valid lights.
B independently inspected these images and can distinguish the two ports from
back-wall nozzles and stair spots. Exact orbit angles are not read from hidden
state or invented from the drag; these pictures only prove a feasible view.

T's first automatic correction used the real back-seat head normal and a slope
derived from frontWall height/lower lens rim. All5 lens rays were free in108
bounded cases (11,870 assertions); the pertinent lighting/stair dependency
passed12,042, with typecheck/diff-check PASS. The inherited20–45° constant is
retained for stairs; bench slope is tested against real wall/lens geometry,
not a widened arbitrary angle tolerance. Those checks do NOT certify premium
visibility: C reports a lateral port dot0.02955 (almost edge-on).

Root explicitly reselected bench OFF→ON after the source freeze so the manual
orbit is not confused with the automatic preset. Actual
`T-after-auto-bench-A-blackstone-{day,red-night}-430.jpg` shows an edge-on sliver
instead of a recognizable second under-seat fitting. **T automatic visual FAIL**;
no production build or delivery PASS is claimed from the green numerical tests.
The next correction is limited to the actual free-footwell/under-seat view;
lights, bench geometry and other camera categories stay unchanged. T WIP backed
up before that correction: `residual-gates-20261015-nbcJoZ`,42files,
secretScanPASS. No commit/push.

Test precision clarification: the actual glass lens isØ23.8mm; housing/bezel is
Ø35mm. T's5 ray samples used the actual glass lens; its height derivation used
the lowerØ35mm rim conservatively. U additionally checks5 rays at the housing's
own real front plane0.004m, retaining the lens rays at0.0055m (10 per fixture),
so an outer-bezel obstruction cannot be hidden by testing only the smaller lens.
The first U in-memory candidate fails that stronger exact-ray check at8×4 A1440:
housing point meets an opaque top at[-2.499566,−0.243,0.976902],4.13754m before
the fixture at5.03352m. No U source was applied or called PASS; the parallel-head
approximation omits the finite target→individual fixture offset. A/C are deriving
clearance using the actual ray/footprint intersections, not trying arbitrary
camera angles or weakening the test. The good6×3 A430 rays do not override that
8×4 counterexample.

### Candidate U — actual risers, local lens and finite clearance

The first finite solve retained an excessively distant optical plan eye. One
unchanged12×5 Infinity A/390 diagnostic measured fitFOV4.5436° versus render34°,
eyeXZ[8.3415,0.00437] outside real footwell x[−5.55,−3.95], distance16.465m.
The front-wall crossingλ0.061108 forced eyeY8.928m. This proves artificial
optical standoff, not an intrinsic impossibility of viewing the bench.

U reuses the existing local34°/inset/manual architecture for bench-lighting only.
Its subject uses real riser strips around existing spot-spacing modules and the
seat lip, not whole seat tops/tub geometry. A keeps its former mean-normal
azimuth; B uses its back-seat head axis. A bench-only finite solve holds the plan
eye and target fixed, derives the minimum Y from actual fixture→opaque-footprint
entryλ, then respects the exact perspective/frustum intervals and existing
Infinity navigation limits. No angle grid or trial constants, geometry,
materials, light states, backend or wizard change. Source hashes:
camera9ecedbf677b0e0ddfccb4e90bf7a88059fa6b6e4e0da28ff480a441fbc2f2ed4,
Scene176c3d2c8b6d5434f31fa748242282f17c09e94791dcb0b30e6066451134d978.

Actual-source tests PASS: bench20,811/108 with both lens/bezel rays,
lighting/stair dependency12,150/324 and projection-exit92 =33,053 pertinent
assertions. Typecheck/diff-check PASS. This is not a visual or physical-product
certification. No U production build is claimed before resolving its visual
counterexample.

Root reselected bench OFF→ON after the source freeze. The six real automatic
captures `U-auto-bench-A-blackstone-{day,red-night}-6x3-{1440,390,430}.jpg` show
both under-seat ports and their vertical faces, no selected-port/UI clipping.
This is the same6×3 Skimmer/BlackStone/Red60/HydroA/corner+inox configuration as
the T before pair, not the manual orbit. Independent B inspected all six images:
bounded A visibility PASS, not direct browser replay. Night stays naturally dark;
no new material/nozzle/photometric realism PASS is inferred.

Root then selected Infinity UI Lato3 traditional and HydroB through the actual
wizard, keeping6×3, BlackStone, mainRed60 and independent stair/bench flags.
UI correctly adapts to6 riser spots and still1 main lamp. At390 the real
`U-auto-bench-B-infinity-side3-blackstone-red-night-6x3-390-settled.jpg` and
paired Day capture do not make all three under-seat fixtures recognizable.
Independent image criticism agrees that the three actual under-seat fittings
are not all identifiable. The earlier association of a second warm point with
a bench fitting was withdrawn after geometric ID mapping; no two-fixture
visibility PASS is inferred. **B visual gate remains FAIL.** The first
non-settled Night capture (checkbox paint lag) is retained but excluded from
visual certification; the settled screenshot and public DOM confirm benchON/
`bench-lighting`, not a checkbox-only assertion.

The corresponding source fixture reports dot0.09997/minor lens0.323px despite
clear rays. A narrow B-only diagnosis also finds part of its ROI strip is not
an exposed riser: z0.1925–0.385 lies under the inner side seat. Fit is dominated
by a real seat-lip point horizontally, not the tub-floor corner. Merely deleting
the floor or increasing pitch is not accepted as a causal fix. A remains frozen
and verified; B correction is pending. Backup of U source/WIP before that work:
`residual-gates-20261015-vquiP2`,42files, secretScanPASS.

Fixture identity clarification: U's geometric pre-refraction projections at390
are head bench0=(100.12,229.15), outer bench1=(29.34,272.60), inner
bench2=(117.60,272.60). Warm reflections elsewhere in the screenshot are not
certified bench fixtures; larger wall rings are hydromassage nozzles. A single
in-memory B-only exposed-face clip recentres the true target but leaves the
side lenses at0.535px minor diameter: useful ROI correction, not visual PASS
and not applied to production. U remains frozen pending a geometric view from
the actual footwell opening; no angle grid, material or geometry workaround.

### Candidate V — B bench camera from the real opening

Backup `residual-gates-20261015-8C4gom` preserves U and all42 pertinent/WIP
files, secretScanPASS. V changes only camera.ts: B's exposed riser strips exclude
portions occupied by adjacent seats; the plan eye is the actual footwell opening
midpoint, with the existing above-water navigation clearance. FOV is derived
from every real lip/floor/fitting point and the existing framing margin, not
clamped or selected from an angle grid. Critical390 FOV53.2275°, eye
[-1.05,.421914,.7175], target[-2.025,-.7005,.7175]. A's U subject/pose and
finite-clearance algorithm remain exact. Scene source is unchanged.

Actual-source `bench-lighting --critical-b`:192 assertions/one case PASS,
including30 real bezel/lens rays, ROI/frustum/Orbit, A equality and actual
53→34→53 projection handoff. Projection-exit92, typecheck and diff-check PASS.
These284 assertions are not customer journeys or visual certification. No108
sweep or current production-build PASS is claimed. Camera SHA256
40c70ffee94df334a5af568bf307e9293e44f3737d36e454ffaa8f7f54993125.

Root automatic OFF→ON followed by Day/Night at1440/390/430 produced
`V-auto-bench-B-infinity-side3-blackstone-{day,red-night}-6x3-{1440,390,430}.jpg`.
Same real6×3/InfinityLato3/BlackStone/Red60/corner+inox fixture as U. All three
under-seat locations are now identifiable in Day context without UI clipping.
Independent image review of390 explicitly does NOT certify premium body/recess
detail: the lateral fittings remain thin marks (computed minor lens .966px).
Night shows three warm signals but dark risers. This is a bounded positioning
improvement, not a closed PC13 gate, nor an independent direct-browser replay.

### Candidate W/W2 — interior material camera and entry routing

Actual V-source before, same Concrete6×3/flat1.50/SkimmerSlim/SunShelf with
corner stair+inox, Day/Mosaic23DD3311: `W-before-mosaic-23DD3311-concrete-skimmer-shelf-6x3-{1440,390,430}.jpg`.
Exact390 DOM is `W-before-material-dom-390.json`. The real camera was31.971m
away, fitting4.5436° into a34° renderer; shell samples had9.8–20% fog and the
whole pool crossed the unobscured band. This is a demonstrated camera defect,
not a texture/material diagnosis.

W reuses the local34° lens/inset and a shared pose/aspect subject: an exposed
real wall edge, ≤1.25m along it, .8m of wall and .75m of real floor, with
floorProfile.floorYAt quotes and existing access/comfort/ladder exclusions.
Those are framing extents, not invented product dimensions. Occupied or
too-short edges return null and keep the previous fallback; those cases are
NOT certified as premium material views. No geometry/material changes.
Backup before W: `residual-gates-20261015-xmTvT8`,43files, secretScanPASS.
The exact390 diagnostic finds9 real subject vertices/rays clear of the actual
SunShelf mesh, eye inside/free, distance3.184m, true34° projection and fog0.

Actual after selection at1440/390/430:
`W-after-selected-mosaic-23DD3311-concrete-skimmer-shelf-6x3-{1440,390,430}.jpg`.
Wall/floor junction and tile/joint pattern are now readable outside the UI.
B's independent image critique agrees390 for framing/application, not PBR,
physical tessera scale,14 finishes or a direct browser replay. Liner dependency
captures `W-after-liner-{blackstone,sandbeach}-concrete-skimmer-shelf-6x3-1440.jpg`
and SandBeach390 retain the same real junction. The first `W-after-mosaic-…390`
WITHOUT `selected` is explicitly EXCLUDED: it captured review restored after
development HMR, not the selected material camera. It remains as raw evidence.

Root then reproduced a separate entry bug WITHOUT reloading: Presentation
review→Finiture retained focus review despite the selected finish. Before:
`W-style-return-from-presentation-390.jpg`. W2 changes only the existing JSX
fallback for style/interior to contextual INTERIOR_FINISH; manual inspection
and explicit focus retain priority. No new effects or config/store mutation.
Real replay now gives review→liner with SandBeach retained, and review→mosaic
with23DD3311 retained, panel open, no product reselection required:
`W2-style-return-{liner-sandbeach,mosaic}-390.jpg`.
Backup before W2: `residual-gates-20261015-7PsS3y`,43files, secretScanPASS.

Frozen W2 source SHA256: camera917e2641370199960b5d0e49c8f3d80b5223dfcfce6440a449f6084245deec99;
Scenea42727e0270db765c378fb647c7412204a1385b7247a525d857436fa9a3d6cf8;
PoolConfiguratorc91dd7e94f8ef90183bded2c704189fbaaec3ddae9893180b9550506e4b7688c.
Production build completed exit0 in `build-W2.log`; no commit/push while
remaining visual/interaction gates are open.

Persistent final W/W2 checks, one relevant run each:
`node scripts/run-premium-camera-regression.mjs interior-finish`770/12poses;
`material-entry`91/6flows; `bench-lighting --critical-b`192/one case;
`projection-exit`92; `lighting-entry`80. Total1,225 unique assertions PASS,
not added to earlier U/V totals. Final W2 `npx tsc --noEmit --pretty false`
and diff-check PASS. Tests/oracles are preserved in the existing camera runner
and `premium-camera-interior-v.ts`; no parallel camera system.
Material poses cover three Skimmer/SunShelf sizes×three viewports plus valid
8×4 Infinity side2×three viewports. The390 DOM is actual W;1440/430 UI envelopes
are versioned fixtures, not new independent browser measurements. Ray checks
use the real comfort mesh and fitting/eye bounds, not wet/PBR certification.

The browser viewport override was reset after testing. Actual same-server
integrated QA tab remains visible and deliverable at
`http://camera-qa.localhost:3003/`, alongside the untouched owner origins.
`W2-live-integrated-material-current.jpg` captures the live normal1280×720
panel, not a mock or a separate deployed copy. PC03 environment/film, PC13 B
lateral premium detail and PC16 true reduced-motion runtime remain open.

### X investigation — B interior camera, not the panoramic height guard

Previous goal turn made actual W/W2 code/runtime progress. Current HEAD and
read-only remote branch verification both remain b40924f7d1f6e61d79c5f586ec007dc3a33bf2de;
no checkout or push. WIP backup before X is `residual-gates-20261015-6DaZ5S`,
44files, secretScanPASS.

A/C confirm a causal constraint: B's eye and Orbit reused water+.4m intended
for the panorama, although its real opening is inside the basin. One in-memory
attempt using real nearClip(.1)+bezelRadius(.0175) above water required
FOV62.2791°, so it was rejected, not clamped or declared PASS. No rays were
claimed for that rejected attempt.

One constrained solve retains every true lip/floor/fitting point, eyeXZ and
target; it raises the minimum physically clear eye to actually fit a60° lens,
using the existing finite-ray/quadratic-interval method, not an angle grid.
Critical390 result: eyeY.202728m, requiredFOV59.999967°,30 real rays clear and
218 assertions/one case geometric PASS. B's explicit near+bezel guard admits
that pose; all other contexts keep their .4m guard. Lateral lenses still
measure only1.105px minor axis: no premium visual PASS follows from the solve.
X was implemented in only camera.ts/Scene and frozen, then actually replayed
OFF→ON at390×844 with public canvas focus bench-lighting. Exact same Steel
6×3/InfinityLato3/BlackStone/Red60/corner+inox configuration as V, Day/Night:
`X-auto-bench-B-infinity-side3-blackstone-{day,red-night}-6x3-390.jpg`.
B independently inspected those captures: three positions are identifiable,
but lateral hardware/recesses and riser detail remain insufficiently legible;
the problem is not an expectation of three front-facing circles. **No premium
PASS.** No further poses or material/geometry workarounds were attempted.

The complete X experiment is preserved in WIP backup
`residual-gates-20261015-kvwQ1q`,44files, secretScanPASS. A then removed ONLY
its X hunks with apply_patch, not restore/reset or whole-file overwrite.
Production hashes match W2 EXACTLY (917e264/a42727e/c91dd7e), diff-check PASS;
the matching W2 build/typecheck/1,225 targeted checks remain applicable without
rerunning unchanged suites. No commit/push.

Browser verification correction: at the start of X replay the old QA tab7
remained1280×720 despite a viewport request; no image from that state is
labelled mobile. Rebinding did not correct it. One fresh same-browser tab8 on
the SAME QA origin restored actual viewport control, and hydrated the same
project selections. Root verified390×844 by DOM before X captures. The old
agent-created duplicate7 was closed after8 preserved its QA draft; owner
localhost tabs were not closed or edited. This is no server/port change.

Two precise owner actions were requested asynchronously: authorization to
temporarily toggle macOS ReduceMotion then restore it for the true runtime
gate (the IAB exposes only viewport/visibility capabilities), and whether B's
micro-light view may prioritize one real recess/its riser while the existing
Hydromassage camera retains whole-bench context. Neither action is assumed
authorized or completed. The original all-view/premium goal remains open.

### Candidate Y — Infinity physical standoff, not assumed scenery-only

Root rechecked the actual wet Presentation/BordoInfinity at6×3/Lato3/traditional
on current W2,390×844. Before: `W2-final-infinity-traditional-side3-6x3-390.jpg`
and its actual DOM JSON;1440/430 before captures have `Y-before-…` names.
Independent diagnosis finds frame[0,176,390,109.516], preferredAspect2.21512,
fit4.5436°/render34°, eye11.588m high/30.666m from the target. Infinity has NO
distance fog: this is a real physical-framing problem, not a fog diagnosis.

Y changes only the existing localFraming route for focus infinity with a zone.
The same72 real points, local3.145m end segment, target, margin and23.01° axis
then place the eye1.639m high/5.216m away, with the existing Orbit guard valid.
No model, backdrop, material, side or overview change. Backup before Y:
`residual-gates-20261015-eKH13L`,44files, secretScanPASS. Camera.ts and
PoolConfigurator remain exact W2; Scene hash3ce3be1f8ea316605061f4dc8e4da0f1d19e883ca2afc429bcb56d00bbe81abf.

Real after captures `Y-after-infinity-traditional-side3-6x3-{1440,390,430}.jpg`
confirm the lower/human-height perspective. Independent390 image criticism
also confirms an unresolved drawback: edge/receiver are smaller in the free
band, the interior is compressed, grey support/terrain remain dominant and the
water film is not recognizable. PASS lower eye only, NOT premium composition.
The next permitted camera-only correction concerns the length of the local
end-detail subject, not dropping its real hydraulic section or masking mesh
defects. No scenery defect is assumed irreparable before checking composition.

### Candidate Z — actual local Infinity terminal, lower physical camera

WIP before Z preserved in `residual-gates-20261015-91AMis`,44files,
secretScanPASS. Z changes only the existing Infinity camera subject's along-edge
span to min(totalArc,dropHeight+catchBasinDepth+innerDepth):1.85m on the actual
6×3 fixture,2m where the supported across dimension permits. The same real
terminal, all72 section/padding points, vertical levels, inward context and
23.01269° view axis remain; no model, water, backdrop or materials were edited.
Y's existing local34°/optical-frame/manual-controls path is retained.

Exact390 fixture calculation: subjectAspect1.71646 chooses actual UI-free
frame[151.914,116,238.086,169.516]; eye[-3.662135,1.434388,5.402528],
target[-2.235,-.4005,1.325],distance4.69359m. All true subject points fit and
existing Orbit limits remain valid. Projected ROI is176×107px versus Y145×69;
these numbers establish framing, not water-film or material quality.

Root actually selected the options and existing BordoInfinity control in wet
Presentation, with sources frozen. Viewport sizes and public canvas focus were
verified by DOM; no private React state or injected camera override was used.
Same6×3/Lato3/Steel/BlackStone/HydroB/corner+inox/Prun/Travertino/Day pair:
`Z-after-infinity-{traditional,glass}-side3-6x3-{1440,390,430}.jpg`.
Before pairs remain `Y-before-…{1440,430}` and
`W2-final-infinity-traditional-side3-6x3-390.jpg` with their unchanged config.
Exact actual UI rectangles are `Z-infinity-{1440,430}-dom.json`;390's same
public layout is in the W2 before DOM. No emulated viewport is called a real
mobile device.

Additional actual UI samples, deliberately distributed rather than exhaustive:
`Z-after-infinity-glass-side1-8x4-430.jpg`,
`Z-after-infinity-glass-side2-8x4-390.jpg`,
`Z-after-infinity-traditional-side4-12x5-1440.jpg`.
Dimension/side changes were made through real wizard controls; panel, finish,
HydroB, lighting and valid access selections remained present. No cloud mutation,
save/export campaign or new backend QA was performed.

B independently inspected all9 captures, not the live browser: bounded framing
PASS on the selected terminal/crest/receiver and interior at each sampled size.
The continued side outside the detail is intentional; whole-basin/inox framing
is not falsely required here. At side2/390 the real inox overlaps a small local
piece of glass/crest, without hiding the terminal/receiver; this is disclosed,
not removed from the scene. Traditional solid and transparent wall are visibly
different in the matched side3 pairs. B's browser remains unavailable; this is
the task-permitted root UI fallback plus independent image critique, never
renamed independent direct browser replay.

Remaining visual limits: the large pre-existing grey support face still dominates
the context; film actually exceeding the crest and exact water-to-crest level
remain NOT VISUALLY VERIFIED. Camera-only framing does not certify or correct
water/geometry/landscape defects. PC13 HydroB recess detail and PC16 actual
ReduceMotion=true runtime remain open as documented in X. No global premium
PASS, commit/push, merge or deployment is claimed.

Z source SHA256: camera.ts `3dbde29f93b9b230743333d20b317770071e957d50d4082e02e16983ba255e30`;
PoolScene.tsx `3ce3be1f8ea316605061f4dc8e4da0f1d19e883ca2afc429bcb56d00bbe81abf`;
PoolConfigurator.tsx unchanged W2 `c91dd7e94f8ef90183bded2c704189fbaaec3ddae9893180b9550506e4b7688c`.
Root `npx tsc --noEmit --pretty false`, `npm run build` and `git diff --check`
actually returned0 on frozen Z; full local build log `build-Z.log` is evidence,
not a deploy. C's test-only integration actually ran these unique targeted modes
through `node scripts/run-premium-camera-regression.mjs`:

- `infinity-local`:5,738 assertions/36 poses, real1440/390/430 DOM rectangles,
  independently reconstructed72-point hydraulic section/terminal/padding.
- `infinity`:2,666/72 traditional/glass variants, no case removed.
- `interior-finish`:770/12 poses; `material-entry`:91/6 flows.
- `bench-lighting --critical-b`:192/1; `projection-exit`:92.

Total9,549 assertions PASS, not summed with historical runs. C also reran
typecheck/diff-check on final test integration. The old3–4m detail-span and
optical-only expectations were explicitly updated for the requested local
Infinity subject, retaining near/far and2% frustum tolerance; whole-scene and
other algorithms remain protected. Portable oracle fixture
`scripts/fixtures/premium-camera-infinity-y.ts` verifies the reconstructed Y
baseline hash while normalizing only the intentionally changed span line.
No default-all/backend audit, geometry/material edit or visual PASS from math.
Normal viewport restored; `Z-live-integrated-infinity-current.jpg` records the
live QA preview. Tab8 and the untouched owner localhost draft remain deliverables
on the same port3003. Opening the panel through the app tool returned queued;
no foreground claim is inferred from that response alone.

### AA/AB — real bench micro-spot macro, not a new product or whole-bench view

Previous goal turn made real Z code/runtime/test progress. This turn preserves
that Infinity work and product-photo WIP. Before AA backup:
`residual-gates-20261015-uvwjgZ`,45files,secretScanPASS. Before AB:
`residual-gates-20261015-WwxmIx`,45files,secretScanPASS, including complete AA.

Re-reading the authoritative task independently by C resolves a self-imposed
constraint: it asks for micro-spot detail of the relevant riser/bench, NOT all
three opposed fittings in one image. The separate Idromassaggio camera must
still show the whole bench/footwell/steps. The earlier optional question about
prioritizing a fixture does not authorize a new feature and is not treated as
an owner reply; this camera-only macro is already within the original brief.
All3 actual35mm bench fixtures of the critical6×3 remain in the render plan
(12×5 resolves8, also all preserved;3 is not a universal quantity). The camera's temporary
copy with only the head fitting selects finite-clearance rays, not render data.
HydroA subject/pose/clearance kernel remain exactly U.

AA uses the actual head-riser's exposed interval, with real seat lip and floor.
Critical390 geometry:133 assertions/one case, all10 hardware and12 context rays
clear, eye[-1.464219,.421729,.58875],34° lens, defaultInfinity+.4m guard and
Orbit valid. Hardware projects only5.45×7.42px. Actual AA same6×3/Lato3/Steel/
BlackStone/Prun/Travertino/HydroB/corner+inox/Red60/Day-Night captures:
`AA-before-bench-B-{day,red-night}-6x3-390.jpg` and
`AA-after-bench-B-{day,red-night}-6x3-{1440,390,430}.jpg`.
B image review: bounded framing PASS, body distinguishable Day1440 but still
soft at390/430; Night context/recess not verified. The scene was also captured
after a long stationary period (`AA-settled-bench-B-red-night-6x3-1440.jpg`):
the dark context/halo is not dismissed as an in-flight screenshot.

One further deterministic AB optical derivation, no angle/pose search, keeps
the identical physical AA eye and all hardware rays. Actual detail ROI uses
head±spotBelowSeat(.12m), clipped to the real exposed riser and real top-lip
strip; no floor plane is invented at a different height. Its10 points bound
x[-2.70,-2.55],y[-.6905,-.4505],z[.385,.6125] on the critical fixture.
Target[-2.625,-.5705,.49875]; derived verticalFOV13.044143° is a tele-macro,
not a wide-angle compromise or an enlarged fitting. Existing pose.fov support
is reused; no Scene/UI/geometry/material change. Critical calculation131
assertions/one case passes: hardware14.52×19.73px, glass9.88×13.43px,
10 hardware+10 real-context rays clear, near.1 and default Orbit/height guard
valid. These optical calculations are NOT visual PASS evidence.

Root then actually selected the existing bench toggle OFF→ON and Day/Night in
the integrated browser, with sources frozen. Public DOM verifies correct sizes
and focus=bench-lighting; no private state/pose override. Actual AB images:
`AB-after-bench-B-{day,red-night}-6x3-{1440,390,430}.jpg`.
B independently inspected all6: Day macro bounded PASS at all three viewports,
ring and centre distinguishable on the real vertical riser below the seat lip,
clear of panel/tools. This is not proof of a complete technical recess detail
or of the other two fittings from the macro. Night **FAIL visual quality**:
a large flat luminous ellipse dominates and the riser/context remain dark.
No further camera tuning is attempted for that same Night defect.

Pertinent separate source evidence, read only: `PoolComfortModel.tsx` HydroSpot
renders the35mm bezel and a23.8mm lens; Night adds an additive circle at
z=.006 with radius=d*2.4,opacity=.16, while lens emission is2.2. Its diameter is
therefore4.8 times the hardware's, independently of camera magnification.
Images prove the halo appearance, not that this is its exclusive rendering
cause. Correcting the halo mesh/material is OUTSIDE the strict camera-only
authorization. One precise async owner permission request was sent; no reply
or permission is assumed and that source remains untouched
(SHA2561dd077a0a7a2584e2e6cce461db65884d5ecb43bcb9482772c6ad9e292f0b42e).

Actual exit checks: `AB-exit-macro-main-led-red-1440.jpg` has focus=features,
the single actual6×3 main lamp and unchanged red60% selection visible, no sticky
macro lens. `AB-exit-macro-full-hydromassage-B-day-1440.jpg` has
focus=hydromassage, whole bench/footwell/flight above the open panel, no residual
tele-macro. Night geometry view is retained separately, not called readable
Day evidence. The constructor phase legitimately renders dry/raw surfaces.
No shade, LED colour, accessory, panel-open state or render geometry was changed
by camera selection; deliberate QA Day/Night/optional actions are disclosed.

AB source hash camera.ts
`0be558af91dcd0a314462ac3570d86b5cf95a4d6f03fb99f1bb0d1f9f33492dd`;
Scene remains Z3ce3be1 and Configurator W2c91dd7. Root actual production build
returned0 (`build-AB.log`) and diff-check PASS. C's final test-only integration:

- `node scripts/run-premium-camera-regression.mjs bench-lighting --macro-b`:
  7,567 assertions/36 B Infinity poses(3sizes×4sides×3viewports).
- Same runner `lighting-entry`:80; `projection-exit`:92.
- Total7,739 unique assertions PASS; `npx tsc --noEmit --pretty false`,
  tracked diff-check and whitespace checks of both new fixture files PASS.

The oracle in `scripts/fixtures/premium-camera-bench-ab.ts` independently
reconstructs the real seat/tub-floor edge and AA12 physical-fit points plus
macro10 optical points. All resolved fittings remain in the model; head bezel/
lens rays, near.1 and margins are retained. A U, other camera algorithms Z,
Scene and Configurator are byte-protected. Derived lenses12.704–13.806° and
minimum projected diameters are diagnostics, never premium pixel thresholds.
The actual430 public DOM was captured in Lighting with focus features; its
unchanged panel/tool geometry, not its focus, is the fixture. No test removal,
default-all campaign or reuse of Z counts as an AB rerun.

One pertinent extra runtime dependency: Skimmer uses the non-Infinity camera
height/Orbit path. Root actually switched that system through the UI, retaining
HydroB/BlackStone/Red60/corner+inox.6×3/430 Day/Night captures:
`AB-skimmer-bench-B-{day,red-night}-6x3-430.jpg` and exact public DOM
`AB-skimmer-bench-B-430-dom.json`. B independently inspected both: Day body/
riser/lip bounded PASS, target free of UI; same flat Night halo FAIL. Legitimate
system adaptation changes the UI stair-spot count from6 to5; it is not a camera
mutation or a new geometry edit. C actually ran the supplementary mode
`node scripts/run-premium-camera-regression.mjs bench-lighting --macro-b-skimmer`:
2,058 assertions/9 poses(3sizes×3viewports) PASS. The preceding36 Infinity poses,
lighting-entry and projection-exit were NOT rerun or double-counted. The actual
default non-Infinity Rig/Orbit path, near.1, clear hardware/context rays and eye
inside the real footwell above its floor were verified. Critical6×3 eyeY−.137241
is5.76mm above actual waterY−.143, not under exterior ground or through a seat.
Derived14.667–16.279° and projected fitting diameters are diagnostics, not image
acceptance. Actual430 DOM matches the portable fixture exactly. Final typecheck,
diff-check and new-file whitespace checks PASS; production hashes unchanged.
Current AB total9,797 UNIQUE assertions, including45 bench poses, without adding
historical Z or read-only qualification counts.

Root normal viewport reset, Day restored and the live
Skimmer macro retained as `AB-live-integrated-bench-day-current.jpg`; owner draft
still untouched on localhost. No physical-mobile or independent direct-browser
claim; current B is image critique of root's UI actions.

No commit/push while mandatory Night/Infinity-film/reduced-motion runtime gates
remain open; no merge/deploy/backend work. All safe work for this bounded block
is implemented and verified; no more camera-pose searches are queued. The owner
action for actual ReduceMotion=true runtime has remained outstanding through
W/W2, X/Y/Z and AA/AB goal turns, with no suitable IAB emulation capability.
The newly proven Night halo additionally needs explicit scope expansion, and
Infinity's exposed support/film limitations are not concealed or assigned PASS.
The goal cannot be called complete under current evidence/authority. Delivery
stays on hold pending precise owner direction, not a fabricated successful wait.

### F integration and visible preview

- A changed camera subjects only: real individual stair elevations and inox
  fittings; actual hydro tiers/seat/footwell/jets; three central riser levels
  for micro-spot detail, all under-seat bench spots, and the real basin/installed
  lamps for the short-end RGB composition. The complete flight remains in the
  Access view. No lamp, tread, seat, optional or material was changed or removed.
- Root `npm run build` on frozen F passed (client, SSR and Nitro), recorded in
  `build-F.log`. This is local compilation, not deployment verification.
- User-facing integrated tab 4 stays visible on the same localhost server.
  Actual root 1111×931 captures: `F-main-led-red-root-8x4.jpg`,
  `F-bench-microspots-OFF-root-8x4.jpg`,
  `F-bench-microspots-ON-root-8x4.jpg`. These do not substitute for B's
  independent 1440/390/430 replay. The owner later changed Day/main LED state;
  root captured `F-live-integrated-preview-day.jpg` without overriding it.
- Final pre-review WIP backup:
  `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-KBDH1v`
  (32 files; baseline HEAD unchanged; secret scan PASS).
- B's first F replay: `F-isolated-stairs-straight-infinity-8x4-{390,430,1440}.jpg`
  shows the whole linear flight, distinct treads/risers and no clipping or UI
  overlay. A rapid Corner → Straight selection ended on the correct subject.
  This fresh 8×4 Infinity side 3/glass fixture uses default unfinished surfaces,
  not the earlier BlackStone/Prun selections; it is not a same-material before/
  after comparison. Other variants and orientations remain separate requirements.
- F independent partial matrix: `independent-review-F-partial.json`. Inox at
  390 is a bounded PASS (`F-isolated-inox-ladder-infinity-8x4-390.jpg`). B first
  identified a corner-stair clip in `F-isolated-corner-reproduced-8x4-390.jpg`.
  Root contested that identification using the six distinct visible tread arcs;
  B independently re-examined the original image and withdrew the FAIL: all six
  treads are complete, with the outer endpoint around x17. The geometry reaching
  canvas x0 is adjacent wall/floor, not a tread. This is a corrected reviewer
  false positive, not a bug resolved by changing framing or widening a tolerance.
  The exact DOM rectangles (header bottom 116, not the older 127 fixture) are in
  `F-isolated-corner-8x4-390-rects.json`. A's temporary DEV pose diagnostics
  were removed; both production files returned to their exact preserved F hashes.
  B now resumes hydro/lights; this interruption adds no new customer-flow coverage.
- Next independent F block at 390: `F-isolated-hydro-{A,B}-infinity-8x4-390.jpg`
  gives complete oblique hydro geometry on unfinished surfaces; jets remain
  small. `F-isolated-main-led-{white,red}-infinity-8x4-390.jpg` uses BlackStone:
  both installed lamps are visible and changing the colour really changes the
  water. The roughly 150×145 px basin is still qualified for premium composition.
  These bounded results do not close the full viewport/material matrix.
- B initially flagged `F-isolated-stair-spots-infinity-8x4-390.jpg` for
  apparent riser/tread clipping on the left and insufficient legibility.
  It was **not** failed merely because a sixth lamp lies outside a three-central-
  level detail. The matching `-rects.json` records the actual 390 UI.
  Fixture: 8×4 Steel, flat 1.5 m, Infinity side 3/glass, Hydro B, saved corner
  access plus inox, BlackStone, red RGB 60%, stair spots on, night. B stopped
  before bench detail. A/C verified that the real Hydro B flight is used, not
  the stored corner-access variant. In a single same-draft Day → Night replay
  (`diagnostic-F-micro-same-draft-{day,night}-390.jpg`), B independently
  identified the three complete central riser/tread faces in Day and withdrew
  the clipping finding. The nominal spot positions also match the screenshot.
  Night BlackStone plus the red wash leaves recess/face readability NOT
  VISUALLY VERIFIED; it is not relabelled as a solved camera bug. No source fix,
  zoom-out, material, shader, lighting or geometry change was applied.
- F's next lighting samples: `F-bench-spots-B-{on,off}-8x4-390.jpg`,
  `F-bench-spots-B-on-8x4-1440.jpg` and `F-stair-spots-B-on-8x4-1440.jpg`.
  B directly switched the bench optional: two under-seat spots appear/disappear;
  selected red main lamps and stair spots remain. Recess legibility on dark wet
  surfaces retains the above limitation. Main `blue/cyan/green/orange` at 1440
  each have `F-main-led-{colour}-8x4-1440.jpg`: both installed lamps, basin and
  real colour change visible from the short end, with the same camera pose.
  Violet was selected in the UI (#AA00FF) but **not yet captured**, so no visual
  violet PASS is claimed.
- Confirmed routing failure: `F-main-led-red-8x4-1440.jpg` actually shows
  `stair-lighting` after merely entering the Colore LED tab; it must NOT be
  counted as a main-light-camera capture. Clicking Blue immediately selects
  `features`. A owns the minimal tab-focus correction; no camera fit/material
  change is justified by this routing failure. WIP backup before that edit:
  `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-pqOMFd`
  (32 files, secret scan PASS, same HEAD).
- B also observed an unexpected return to Presentation with technical choices
  intact while root had edited this QA Markdown, not production source. A dev
  reload is possible but not proven; it is not recorded as an application reset.
  All workspace writes, including report/test edits, are now frozen during B's
  browser sequences, not just production-camera source.
- G integration: only the colour-tab camera override effect in PoolConfigurator
  changes (+7/−2 lines from F). It follows the later micro-focus revision caused
  by the existing Night preview; unchanged LIGHTING focus identity on subsequent
  colour edits retains the manual/colour-comparison pose. No LightTray, product
  photography, stored configuration, lighting value or geometry change.
  Root production build passed (`build-G.log`); C's separate section records the
  actual red-F/green-G effect/state test, typecheck and diff-check. F camera and
  PoolScene hashes remain exact. Source HEAD and fresh remote `git ls-remote`
  both remain `b40924f7d1f6e61d79c5f586ec007dc3a33bf2de`, with WIP uncommitted.
- Independent G matrix: `independent-review-G.json`, 16 specifically scoped
  rows, plus its JPEGs copied into the canonical local evidence folder only
  after B returned control. Subsequent live artifacts are written outside the
  watched workspace at `pool-shaper-wip-backups/camera-review-G` and copied back
  between batches, preventing evidence writes from confounding live QA.
  G's colour-tab fix passed at all three viewport sizes without selecting a new
  colour, preserving the before-F red 60% state. Violet is now genuinely captured
  in `G-color-tab-no-color-choice-violet-1440.jpg`; white at 430 is in
  `G-main-led-white-8x4-430.jpg`. All seven available colours have real samples
  across the campaign, **not** every colour at every viewport.
- Additional bounded G results: `G-stair-spots-B-on-8x4-430.jpg` shows the three
  relevant risers/spots with white 60%; `G-bench-spots-B-on-8x4-430.jpg` shows
  the two under-seat fittings. This does not erase the BlackStone/red limitation.
  `G-paving-travertine-8x4-430.jpg` shows actual paving format and joints.
  `G-hydro-{A,B}-dark-match-8x4-{430,1440}.jpg` shows complete A/B details with
  E's technical material selections; the phase correctly renders dry construction.
- New confirmed camera defect: `G-access-dark-match-hydro-B-8x4-430.jpg` shows
  a distant whole-pool overview when the user explicitly selects Accesso with
  Hydro B active (public intent `access`). The layout intentionally has no
  standalone access plan because the actual flight belongs to Hydro. Camera
  lookup currently misses that flight and falls back to the pool. A owns H's
  camera-only actual-flight subject correction; hydro selection details remain
  separate and already bounded PASS. WIP backup before H:
  `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-3hBe2I`
  (32 files, secret scan PASS, unchanged HEAD).
- H integration: `accessFlightCameraSubject` returns the unchanged standalone
  subject when present, otherwise derives Hydro A/B's rendered landing, treads,
  exposed risers and real rim contact. Fit and free-frame aspect use the same
  subject. The separate hydro, inox, micro-light and G colour-tab behaviours are
  untouched. Root reviewed the bounded camera/CameraRig change and production
  build passed (`build-H.log`). C's red-G/green-H evidence is recorded below;
  independent runtime PASS remains required. The analogous Accesso route with
  Sun Shelf replacing standalone access still needs actual coverage, not inference
  from the Hydro-only regression.
- B replayed H with the same technical fixture: actual integrated Hydro B flight
  now PASS at 430, A at 390/1440 (`H-access-hydro-B-8x4-430.jpg`,
  `H-access-hydro-A-8x4-{390,1440}.jpg`). New Sun Shelf Accesso FAIL was then
  directly confirmed in `H-access-with-shelf-8x4-1440.jpg`. The genuine dedicated
  comparison is `H-dedicated-shelf-reselected-8x4-1440.jpg`, obtained after a real
  option change; the same-selected-option image did not retarget and is excluded.
  `independent-review-H.json` records the five scoped rows. All seven H artifacts
  were byte-compared after copying into the canonical local folder: zero mismatches.
- I integration is a minimal reuse, not a separate camera system: Accesso with
  a selected Sun Shelf now requests the exact existing Shelf subject, including
  the same actual selected-lounger envelope in both fit and free-frame aspect.
  Standalone and Hydro H outputs remain identical. Root production build passed
  (`build-I.log`); C records red-H/green-I and typecheck/diff below. Runtime replay
  remains mandatory. Backup before I:
  `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-BSmI9f`
  (32 files, secret scan PASS, unchanged HEAD).

### Frozen camera candidate C and remaining runtime work

- Infinity detail routing now remains distinct from whole-pool review, including
  revisiting the side tab. Main RGB uses the short end; stair and bench micro-spots
  have distinct intents derived from their actual existing geometry. Material
  colour comparison retains the same focus request. These are implemented/offline
  tested, not yet a blanket browser PASS for all categories.
- UI centring now uses optical view offset for all detail cameras. Real eye and
  target remain on the actual assembly. Infinity transitions use the same 240 ms
  interruptible path; orbit limits are restored after flight/manual interruption.
  Pacing, manual operation and reduced-motion browser replay remain separate gates.
- Root final C screenshot: `after-shelf-final-optical-12x5.jpg` (same 12×5 Infinity,
  two loungers, actual integrated viewport 1111×931, open panel). Independent final
  captures: `final-shelf-reviewer-{1440,390,430}-12x5-4loungers.jpg` (12×5 Infinity
  side 2, four UI-permitted loungers, day, Comfort phase). Neither is mislabelled
  as a physical mobile device test.
- `npm run build` completed successfully on frozen C (client, SSR and Nitro).
  Existing large-chunk and tsconfig-path plugin notices remain warnings; no deploy
  was executed. `git diff --check` is clean. Product-photo WIP remains excluded.
- Post-C recovery backup:
  `/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/residual-gates-20261015-6eVtAE`
  (31 files, secret scan PASS, same baseline HEAD).
- Current offline blind spots are explicitly retained: fixed legacy Infinity
  coping distance and capped system-detail distance have no real-subject/UI
  projection test yet. Browser evidence must establish a defect before correction.
  PC05–PC18/PC20 are not closed by the first two live blocks.

### Independent findings on frozen C → targeted block D

- B and root independently inspected `final-coping-infinity-reviewer-390.jpg`:
  selected Prun coping is only a diagonal strip above a large dark wall. Its
  useful surface/edge junction is not recognizable. This confirms the fixed-pose
  blind spot rather than merely hypothesizing it from source.
- `final-hidden-overflow-reviewer-390.jpg` shows an almost frontal wall and a
  thin line, not a readable oblique slot/rim junction.
  `final-grille-overflow-reviewer-390.jpg` shows a recognizable grille but its
  upper band is partly under the view menu/structure badge; wall dominates.
  Actual layout rectangles are in the matching `-rects.json` files.
- `final-skimmer-slim-reviewer-390.jpg` is a bounded PASS: complete recognizable
  opening, no UI overlap. Its camera branch is to be preserved.
- B performed one manual zoom diagnostic in the wet Presentation phase:
  `diagnostic-infinity-water-manual-zoom-1440.jpg`. The crest and face are visible,
  but the falling sheet is still **NOT VISUALLY VERIFIED**. Read-only source
  diagnosis finds an outward-facing, DoubleSide, highly transmissive 3 mm film,
  not a backface omission; this does not prove visual acceptability. No water
  material/shader or geometry change is authorized by this camera-only task.
- Independent composition finding: fitting the entire 12 m edge makes the
  selected face only about 20–30 px high on mobile. The brief calls for a real
  detail of crest/face/receiver and some basin, not the whole selected side.
  D may frame a continuous real segment near its actual end closure. This is a
  camera-subject correction, not CSS crop or an environment fix; whole-project
  coverage remains required in review/overview. The coastal support defect stays
  recorded separately and is not excused by a closer view.
- B returned browser control before D source changes. No source edits occurred
  during the reviewed C sequence. D regression tests must first reproduce the
  confirmed defects; no PASS is carried over blindly from C.

### Block D implementation and live owner preview

- Only camera subject/fit logic and its existing CameraRig frame selection changed:
  Infinity frames the real terminal segment (about 3.4 m in the rectangle sample)
  plus closure/receiver and some basin. Review/overview still frame the whole pool.
  Coping uses the actual inner/squared outer ring beside that closure. Overflow
  uses the existing real grille/hidden section with a raised oblique view. The
  Skimmer branch is unchanged. No slab, water, environment or product changed.
- Root actually operated the same visible integrated app after D:
  `after-infinity-detail-D-root-12x5.jpg` and
  `after-coping-infinity-D-root-12x5.jpg`, 1111×931, same 12×5 Infinity/Prun/
  two shelf loungers, open panel. The local construction is more readable;
  the support-wall context issue and unproven film visibility remain recorded.
- C reproduced red tests against the preserved exact C source, then green on D:
  old Infinity target was far from the terminal detail; old overflow was frontal;
  an actual coping-slab probe projected to x≈1710 outside a 1440 canvas. D:
  coping 1,044 assertions/36 cases; overflow 558/18; Infinity 2,666/72 PASS.
  The coping oracle samples the real slab geometry and its actual thickness,
  not a fictitious whole-scene box. This does not replace browser visibility.
- Production build on D PASS (client/SSR/Nitro); no deployment. B now has sole
  browser control on the frozen D source; A is not editing during that replay.

### Independent D replay → E physical-occlusion correction

- `independent-review-D.json` records 13 real D captures: six bounded overflow
  framing PASS, three coping FAIL due to the three selected loungers, three
  traditional Infinity framing PASS and one desktop glass framing/distinction
  PASS. Water-film and environment quality are explicitly not passed.
- D correctly fit the real coping, but looked from inside the basin through the
  selected loungers. E changes exactly one camera direction to the outside of
  the same coping patch. No optional was hidden, moved or resized; all subject
  coordinates/materials/geometry remain identical.
- B retested E with all three side-3-compatible loungers still selected:
  `E-coping-infinity-12x5-{1440,390,430}.jpg`. Prun surface, joints, thickness and
  closure are clear of the loungers and UI in all three viewports: camera PASS.
  Root live preview `after-coping-infinity-E-root-12x5-3loungers.jpg` shows the
  same reviewer configuration after localhost draft rehydration; it is not
  mislabelled as the earlier root concrete/Sand Beach/two-lounger fixture.
- E production build PASS, log `build-E.log`; no deployment. The remaining
  categories are now being exercised by B on the frozen source. No source edits
  occur during that sequence.
- Fixture correction after B revisited the actual quantity control: side 2
  allowed four loungers in C shelf captures; changing to side 3 reduces the
  permitted/selected quantity to three. D/E coping captures show those three,
  not four. The earlier four-lounger description was stale QA metadata, not
  evidence of a camera removing furniture. JSON descriptions and the root E
  filename were corrected; the real screenshots were not altered.

---

> Historical checkpoint. The later owner-directed environment removal and final
> cleanup are tracked in `FINAL_CONFIGURATOR_QA.md`. The Photo Mode section below
> records the former WIP, not a feature remaining in the customer flow.

Branch `claude/pool-shaper-build2-project-delivery`; baseline `31b72d6`.
All Build 4 and unrelated WIP preserved. No backend, geometry or material changes
in this candidate. Infinity poses/routing protected.

## Runtime evidence

Local folder outside Git:
`/Users/danielelamthi/Documents/Codex/2026-09-14/rendi-la-immagine-1-piu-relistica-4/premium-camera-evidence`.
Each prefix below has `-1440`, `-390`, `-430` captures. Viewports:
1440×900, 390×844, 430×932. Clipping refers to the selected element, not the
surrounding basin intentionally outside detail framing. Superseded early resize
captures are not certified; use the final prefixes listed here.

| Selection | Activated camera | Visible object | Object clipping | 1440 / 390 / 430 | Evidence prefix / extension |
|---|---|---|---|---|---|
| C01 Skimmer | skimmer-detail | Fitting/waterline | None | PASS / PASS / PASS | skimmer.png |
| C02 Grille overflow | overflow-visible | Grille/channel/rim | None | PASS / PASS / PASS | overflow-grille.png |
| C03 Hidden overflow | overflow-hidden | Slot/rim | None | PASS / PASS / PASS | overflow-hidden.png |
| C04 Straight stairs | access | Whole stair and treads | None | PASS / PASS / PASS | stairs-linear-final.jpg |
| C05 Corner stairs | access | Whole stair and treads | None | PASS / PASS / PASS | stairs-corner-final.jpg |
| C06 Inox access | inox | Complete ladder | None | PASS / PASS / PASS | inox-access.jpg |
| C07 Sun Shelf | shelf | Shelf/descent; toolbar close to lowest tread on mobile | None | PASS / PASS / PASS | sun-shelf-final.jpg |
| C08 Hydro A | hydromassage | Seats/partition/jets/access | None | PASS / PASS / PASS | hydromassage-a.jpg |
| C09 Hydro B | hydromassage | Seats/jets/access | None | PASS / PASS / PASS | hydromassage-b.jpg |
| C10 Coping | coping | Local thickness/texture/joints | None | PASS / PASS / PASS | coping-fixed.jpg |
| C11 Paving/format | paving | 30×60 patch/joints | None | PASS / PASS / PASS | paving-format.jpg |
| C12 Liner | liner | Blue Sky surface | None | PASS / PASS / PASS | liner.jpg |
| C13 Mosaic | mosaic | Selected tesserae | None | PASS / PASS / PASS | mosaic.jpg |
| C14 Visible inox | liner | Interior surface; existing material unchanged | None | PASS / PASS / PASS | visible-inox.jpg |
| C15 Exterior panels | exterior-panel | Finish/seams | None | PASS / PASS / PASS | exterior-panels.jpg |
| C16 External stairs long | external-stairs | Run/extended platform/guard | None | PASS / PASS / PASS | external-stairs-long.jpg |
| C17 External stairs short | external-stairs | Run/landing/guard | None | PASS / PASS / PASS | external-stairs-short.jpg |
| C18 Pellicano | pellicano | Body/water sheet | None | PASS / PASS / PASS | pellicano.jpg |
| C19 Main LEDs night | features | Two desktop fixtures; primary mobile fixture | None | PASS / PASS / PASS | main-led-night.jpg |
| C20 Micro-spots night | stair-lighting | Six hydro stair points, main LED off | None | PASS / PASS / PASS | micro-spots-night-fixed.jpg |
| C20b Corner micro-spots | stair-lighting | Eleven points, main LED off | None | PASS / PASS / PASS | corner-micro-spots-night.jpg |
| C21 Infinity regression | access / hydromassage | Existing 12×5 access/comfort compositions | No new clipping; existing mobile toolbar overlaps lower basin | PASS / PASS / PASS (regression only) | infinity-access-regression; infinity-comfort-regression (.jpg) |

## Fixes

Before: `before-skimmer-1440.png` documents the whole-pool rule replacing detail
with review. Format, panels, external stairs and Pellicano also lacked dedicated
action mappings. Non-Infinity selections now retain detail intent; presentation
keeps whole-pool framing. Actual component envelopes and available UI frame drive
camera fitting. Detail transition: 0.24 s, except reduced motion. Existing Infinity
snap behavior remains. No substitute geometry.

## Tests

- Current WIP: typecheck PASS; **31,264 camera checks PASS**;
  **1,451 hybrid-photo checks PASS**; production build PASS; diff-check PASS.
- Isolated staged candidate excluding unrelated WIP:
  `/private/tmp/pool-camera-stage.FkMtDL`: typecheck PASS;
  **30,368 camera checks PASS**; production build PASS.
  Different counts reflect additional points in unstaged comfort geometry.
- Existing Infinity assertions retained; micro-spot routing regression added.
  Non-Infinity whole-pool expectations changed to the requested detail behavior.
- No skipped tests counted as PASS. Existing Vite warnings remain.
- Browser evidence uses the WIP runtime. The isolated candidate has automated
  verification, not a second browser audit.

## C22 — Photo Mode, separate Build 4 WIP

Observed at all three viewports:

- Skimmer 8×4 Outdoor: `photo-skimmer-hero`, `photo-skimmer-raised`,
  `photo-skimmer-waterline`.
- Infinity 12×5: `photo-infinity-hero`, `photo-infinity-raised`,
  `photo-infinity-waterline`. Original geometry unchanged.
- Above-ground 8×4: before `photo-aboveground-hero`; after
  `photo-aboveground-hero-fixed`, `photo-aboveground-raised`,
  `photo-aboveground-waterline-fixed`. Local target/height correction reveals
  the basin above the rail. Two-line correction remains in Build 4 WIP
  `src/lib/pool/hybrid-photo.ts`, outside the independent wizard-camera candidate.
- Indoor Hero: `photo-indoor-hero` at all viewports. Additional raised/waterline
  observations at 430: `photo-indoor-raised-430.jpg`,
  `photo-indoor-waterline-430.jpg`. This is not a full Indoor matrix PASS.

**Photo Mode visual gate: FIX REQUIRED.** Visible background/deck joins, flat
presentation and weak low-angle mobile compositions remain Build 4 work.
No environment/material/geometry changes were made to conceal them.
Download, performance and photorealism are not newly certified by camera tests.
No Build 4 closeout is claimed.

## Delivery boundary

Wizard-camera candidate verified independently. Other WIP and local Photo Mode
correction remain on disk. No merge, deployment or backend action.

Overall delivery: **FIX REQUIRED**. Commit/push deliberately not executed because
the complete visual gate, including Photo Mode, is not PASS. The four-file staged
camera candidate remains available without discarding any unstaged changes.

## Owner-requested geometry correction — 2026-10-17

Separate, newly authorized scope; does not close the preceding camera/Photo Mode gate.

| ID | Correction | Targeted evidence | Status |
| --- | --- | --- | --- |
| HG-01 | Only a Hydro seat touching the Infinity **glass** wall is removed; seats form an L on solid faces. Released strip receives the real tub floor; removed-side jets/spots are not left floating. Traditional and non-adjacent configurations unchanged. | `node scripts/run-hydro-glass-corner-audit.mjs`: 12 adjacent glass-side L plans across A/B, 6×3/8×4/12×5, four Infinity sides; actual generated mesh heights and tier coverage checked. | Functional PASS; visual evidence pending final capture. |
| HG-02 | Respect selected existing quarter-round internal access with Hydro, rather than silently replacing it with the integrated straight flight. Reuse existing collision/clearance planner; expose existing shape choice with Hydro. | Same audit: 24 available radial flights, 24 explicit insufficient-space rejections (no straight fallback), optional inox, micro-spots and configuration round-trip. | Functional PASS; final visual capture pending. |
| HG-03 | Omit illustrative steel panel joints on interior walls/floor/access/comfort only. Preserve exterior raw-panel maps and all finished material parameters. | Same audit checks interior map boundary and unchanged exterior joint value. | Functional PASS; final visual capture pending. |

Targeted audit: **724 checks PASS**. Existing hydromassage regression:
**46,209 checks PASS**, 240 sizes × 2 variants, zero unavailable linear/traditional cases.
`npx tsc --noEmit --pretty false`: PASS. `git diff --check`: PASS.
No full repository audit/build rerun for this limited task.

Runtime: existing integrated `camera-qa.localhost:3003` draft (10×4.5, steel,
glass side 3, Hydro B, corner, inox) retained. A dry close-up showed the L and
continuous interior steel; final overall screenshot is not yet certified.
The tab subsequently stalled during panorama loading/CDP screenshot capture;
one explicit reload attempted. No camera, panorama, light, backend or customer
data changes were made to conceal the issue. No matched before/after pair claimed.

Pre-change WIP backup: `pool-shaper-wip-backups/residual-gates-20261015-yioSUN`
(46 files, secret scan PASS). No commit/push, merge or deployment.
