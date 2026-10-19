# Parametric comfort, guided decisions and cameras — 2026-10-19

Candidate starts at `67173e4d74fe6dcc32791f58f70c36e381503d1c` on
`feat/fullscreen-day-night-hidden-overflow`. Existing WIP is preserved in
`pool-shaper-wip-backups/residual-gates-20261015-ufaHGO` (52 files; credential
scan PASS). No reset, checkout, backend migration, merge or deployment.

This matrix adds the current requirements; it does not replace earlier QA.
PASS requires the specific final evidence, not a previous task's screenshots.

| ID | Responsible / initial state | Required change / acceptance | Targeted test | Final evidence / status |
|---|---|---|---|---|
| C01 | Coordinator + camera reviewer: overview omitted exterior envelopes | Whole installation in actual free rectangle | 222 metric projections + five real browser project paths | PASS — captures 06/27/32–39/49; 1440/390/430 |
| C02 | Coordinator: Vedi reduced panel and kept detail | Separate whole-pool focus from explicit Riduci | Navigation/state + actual browser | PASS — 06/16/17/49; raw-shell route fixed |
| C03 | Camera reviewer | Preserve meaningful component details and Infinity detail | Contextual regression + actual browser | PASS — Shelf 18–20; Infinity 37; hydro 40–43; access/inox 44–48 |
| N01 | Coordinator: combined access groups | Ordered pertinent optional decisions before macrostep | Decision model + browser forward/back | PASS — stairs → inox → comfort → Shelf options; AB stairs → external |
| N02 | Coordinator: no next-choice guidance | Translated cue, contained scroll only on new decision | DOM/scroll/IT-EN and resize | PASS — cue in 46/47; active tab remains visible on resize |
| N03 | Coordinator | Panel stays open until explicit Riduci; no Back/language loss | Reducer + actual browser | PASS — 16/17; IT→EN→IT retained quantity/tab/camera intent |
| H01 | Comfort reviewer: 6×3 incorrectly offered hydro | Width ≤3 unavailable, wider pools still geometrically checked | 273 compatibility checks + 720-layout independent probe | PASS — 01b, resize 10; explicit reasons, no purchasable invalid variant |
| H02 | Coordinator | Keep both approved hydro geometries/tiers | 36,153 geometric checks + actual close-ups | PASS — 40–43; no seat/backrest/jet/spot dimension changes |
| S01 | Comfort reviewer: Shelf could not fit chaises | Two full catalogue chaises plus real route | Actual geometry flat/slope/access/Infinity | PASS — 6×3 unavailable; 8×4 two; 12×5 four; 18–20 |
| S02 | Coordinator | No resizing/clamping to fit; explicit quantities and margins | 1,473 geometry + 93 state checks, actual browser | PASS — 1.778×0.5842 m model, 25 cm edges/24 cm between/90 cm passage |
| D01 | Coordinator: shape/normalisation deleted requests | Retain intent, omit impossible geometry, resolve before confirmation | Resize/shape→restore and malformed-count tests | PASS — 10/11/12; quantity 4 restored, no ghost Shelf |
| D02 | Coordinator | Consistent summary/save/share/PDF/proposal, no migration | Local guards + real cloud UI and actual PDF | PASS — canonical rows and copy checked; seven-page downloaded PDF; form opened, no real send |
| V01 | Independent browser reviewer | Actual app interaction, isolated QA origins | Eight customer cases + before/after captures | PASS — evidence below; 390/430 are emulated viewports, not real phones |
| Q01 | Coordinator | Required targeted automated checks and scoped candidate | Isolated source build/typecheck, affected audits, diff/secret scan | PASS — results below; three stale broader oracles explicitly not counted |
| P01 | Coordinator | Retain porcelain parent/four colours and unrelated WIP | Scoped diff and original IDs/images | PASS — already delivered in `67173e4`; no additional material change |

## Sources and design limits

Existing catalogue reference: [Ledge Lounger Signature Chaise](https://ledgeloungers.com/products/signature-chaise),
70×23 in (1.778×0.5842 m), intended water depth up to 9 in (0.2286 m).
Existing model is an original procedural representation, not manufacturer CAD.
Movement margins and hydro commercial width cutoff are POOL-SHAPER preliminary
layout criteria supplied by the owner, not structural or regulatory certification.

## Implementation checkpoint (not final closure)

Remote branch was read-only verified at `67173e4d74fe6dcc32791f58f70c36e381503d1c`.
A second complete WIP backup is `residual-gates-20261015-e3TEsP`, 77 files,
credential scan PASS. No code outside the requirement paths has been discarded.

- H01/S01/D01: nominal width guard, separate legacy hydro flight and new shelf
  run; at least two full 1.778×0.5842 m chaises; 25 cm lateral/front margins,
  24 cm between chaises, explicit 90 cm transverse rear passage connected to
  the actual 1.2 m stair/landing strip. The landing itself has at least 90 cm
  longitudinal room. Standard shelf run is 2.963 m, not an automatic pool resize.
  6×3 unavailable; 8×4 capacity 2; 12×5 capacity 4, flat and sloped.
- Independent code review found the initial gate missed an impossible final
  corner stair/ladder. Fixed by evaluating the complete resolved layout and
  omitting the incompatible comfort zone. Data stays requested, with explicit
  resolution before final PDF/proposal. Invalid numeric quantities are still
  syntactically normalised; valid quantities exceeding capacity are not capped.
- C01/C02: separate Vedi/Riduci; whole-installation envelope includes actual
  access, cover, external stair, Pellicano and selected furniture. A real
  browser failure on raw-shell Vedi was traced to rerouting to the structure
  camera. Removed that reroute. The general view now looks across the basin
  towards the entrance instead of hiding the treads behind their own wall.
- N01/N02: explicit internal-stair → inox → comfort → shelf-option decisions
  (above-ground internal → external). Next/Back share that order. Scroll is
  contained to the option pane/tab strip and keyed to decision identity,
  never repeated just for a finish change.
- D02: unresolved intent survives parse/save; summary lists the request and
  reason; final PDF and proposal validation fail closed. No schema migration,
  real notification or email transmission.

### Verification completed on the working candidate

| Check | Evidence / result |
|---|---|
| Parametric comfort, access, resize/restore, malformed quantity, local PDF/proposal guard | `node scripts/run-parametric-comfort-audit.mjs` — 273 assertions PASS |
| Metric camera projection and decision traversal | Same runner `camera` — 91,371 assertions, 222 projections, 20 **model-level** forward/back cycles PASS; not a browser-cycle claim |
| Hydro geometry | `run-hydromassage-audit.mjs` — 36,153 checks PASS; both existing variants preserved |
| Lounger geometry / actual model envelope | `sun-shelf-loungers-audit.mjs` — 1,473 checks PASS, mesh 3,084 triangles unchanged |
| Lounger state / share / IT-EN summary | `sun-shelf-state-audit.mjs` — 93 checks PASS, offline |
| Component layout | `run-component-layout-audit.mjs` — 157,018 checks PASS |
| Contextual cameras | `run-contextual-camera-audit.mjs` — 27,479 checks PASS; dedicated detail intentionally frames three middle risers, not every fitting |
| Existing access/material detail cameras | `run-premium-camera-regression.mjs detail-existing` — 48 access fits PASS |
| Shelf / hydro detail regressions | Same runner `shelf` / `hydro` — 9,950 / 14,460 assertions PASS |
| Canonical project configuration / persistence | Existing targeted runners PASS; corruption/quota warnings are intentional negative fixtures |
| Project delivery / PDF / quote | Existing runner PASS **local memory only**, zero mismatches; live browser save evidence still pending |
| Lead pipeline | Existing validation/formatting runner PASS **local**, no real send |
| Renovation | Existing runner — 1,355 checks PASS |
| Export guard | Existing runner PASS |
| Typecheck / production build / diff-check | PASS on working candidate; exact delivery snapshot verification still pending |

Three broader/older checks were also attempted and are **not counted as PASS**:

1. General `run-geometry-audit.mjs` stops at the pre-existing literal
   `COPING_MATERIALS.length === 7` (already in HEAD), incompatible with the
   previously delivered reference-finish catalogue. No material catalogue was
   changed for this goal; targeted comfort/placement geometry checks above pass.
2. `run-final-cleanup-state-audit.mjs` expects a catalogue without the already
   delivered `sunShelfLoungers` ID. Its stale complete-catalogue oracle is not
   replaced by silently deleting the option.
3. Legacy WIP `infinity-local` compares the hash of the entire old Rig/scene
   against its earlier freeze. It fails after the requested general framing
   changes. The new camera audit instead exercises 36 actual Infinity detail
   projections plus 36 corrected coastal whole-pool projections; actual browser
   Infinity regression remains mandatory.

### Real browser evidence so far

Independent BEFORE, six native JPEG captures:
`pool-shaper-wip-backups/comfort-independent-20261019/`.
The reviewer directly reproduced 6×3 hydro incorrectly offered, Shelf offered
without even one chaise, Vedi collapsing while retaining a cropped detail.

Independent AFTER is in progress in a fresh IAB session, isolated origin
`comfort-after.localhost:3003` (no user project reset). Desktop has verified
6×3 unavailability with reasons, guided stair/inox/comfort traversal, and 8×4
two-chaise Shelf with actual rear passage. General-camera corrections are
being retested, followed by mobile, Infinity and live Save/Reload/Share/Copy/PDF.
No full visual gate or cloud PASS is claimed at this checkpoint.

The main user preview remains on its own `camera-qa.localhost:3003` project;
its configuration was not changed for QA. All mobile evidence is viewport
emulation on this Mac, not physical mobile hardware.

## Subsequent verified corrections and evidence

- Real mobile resize initially exposed a cropped Shelf detail. Non-Infinity
  access/Shelf/hydro cameras now own the same metric inset projection used by
  their fit, including DPR/resize. The active tab is revealed on resize too.
  Independent retest: `15`, `18`–`20`, at 390×844 and 430×932.
- Infinity general view was still a nearly flat waterline composition.
  **Only review/overview** now fits the complete installation at three-quarter
  elevation looking seawards. Its lens adapts within the existing 6.5 m site
  apron. The approved overflow-face detail, scenery and geometry are unchanged.
  Independent retest: `34`–`37`; 36 metric general and 36 detail projections.
- Above-ground general camera originally hid the external flight behind the
  shell. It now observes the actual exposed staircase side; envelope and
  geometry unchanged. Independent retest: `38`/`39`, desktop/mobile.
- Actual downloaded PDF exposed a separate centre-crop in paired Day/Night
  boxes. The PDF now contains the complete captured image, not a crop.
  `Project-Book-PW-4VAM-NWKH90.pdf`: seven actual pages, page 6 rendered and
  visually inspected after the change; full same pool/chaises/steps both times.
- Read-only canonical cloud confirmation in **waetxxqdlsuanqescuye**:
  `PW-4VAM-NWKH90` and its independent copy `PW-5X7B-BRTDWR`, snapshot version 1,
  identical 8×4 technical configurations, Shelf+loungers retained (automatic
  capacity 2), different project identities. UI reload showed Saved, share
  was read-only without edit credentials, copy remained editable.
- Actual proposal form opened (`05-quote-form-no-send.jpg`); no real submission
  or email. Invalid comfort is rejected by local client/PDF/server-schema
  checks; valid inputs accepted by the local pipeline. Not a live lead/email
  delivery claim.
- Independent read-only code probe: 720 sampled layouts, zero unavailable
  actual entrances without an issue and zero offered Shelves below capacity 2.
  8×4: landing 1.728×1.2 m, rear route 0.9×3.93 m, 2 full chaises.
  12×5: same landing, route 0.9×4.93 m, 4 full chaises.
- Exact isolated source candidate `84f5a6af79d601ba39500102cd759805a8855247`
  (QA-only object, **not a delivered feature commit**): typecheck, production
  build, 91,371 camera assertions/222 projections and diff-check PASS. No
  credentials were copied. Vite's preview wrapper looked for a missing
  `dist/server/server.js` under the Cloudflare preset; a separate-cache local
  Vite dev smoke verified the same source instead. This is not a production
  deployment. Existing chunk-size/deprecation warnings remain.

All numbered native screenshots above are in the persistent local directory
`/Users/danielelamthi/Documents/Codex/pool-shaper-wip-backups/comfort-after-20261019/`.
Full before evidence is in the adjacent `comfort-independent-20261019/`.
The one-line existing tier-aware `PoolComfortModel` fix is a required dependency
of the retained glass-hydro tiers. Unrelated material/product-photo WIP remains
excluded from this scoped delivery and is preserved byte-for-byte.

### Final closure evidence

The fresh independent IAB reviewer used the product directly, not only these
reports: 6×3 unavailable comfort; 8×4 two chaises; 12×5 four; L-shape retained
unavailable request; width 5→3→5 restoration; Infinity selected sides and whole
view; cloud save/reopen/share/copy/summary/PDF; Skimmer/Overflow/above-ground/
renovation overview; guided Back/Continue; voluntary panel reduction; IT/EN.
Fresh access, inox and both hydro variants were captured after the inset fix
(`40`–`48`). A misleading Shelf-dimension caption under hydro was restricted
to an actually selected Shelf; no geometry or camera change.

Representative native before/after screenshots and the rendered actual PDF
page are committed in [evidence/comfort-20261019](evidence/comfort-20261019/).
The complete independent JPEG set remains in the persistent backup directory
above. Earlier unchanged material/LED detail coverage remains in the existing
camera QA evidence; it is not falsely presented as a newly repeated browser
test. No physical-phone or production-email validation is claimed.

Required scope is verified. Commit/push is allowed only after final source
snapshot/secret/diff verification. Preserve unrelated local WIP; do not claim
the entire checkout is clean. No main merge, deployment or database migration.
