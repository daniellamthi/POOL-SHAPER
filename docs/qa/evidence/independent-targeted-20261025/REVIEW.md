# Independent bounded browser review — 2026-10-25

Reviewer: `/root/release_independent_qa`, not an implementer of the candidate.
Application: current WIP served by integration owner, `http://release-review.localhost:3003/`, Chrome.
Viewports: desktop 1440×900, emulated mobile 390×844 and 430×932. Not physical-phone performance.

No repository source changes. No Save/Share/PDF/quote or backend actions. Separate origin, fresh local-only fixture. Owner's integrated browser tab/draft untouched. Both reviewer-created tabs were closed, viewport reset.

## U08 — scoped scroll checks

- Dimension input 10→12, then completed fixture 12→11: panel remained at top0, window scroll0. No typing/scroll loop observed.
- Desktop already-visible White swatch: panel99.5→99.5.
- Selecting porcelain Ivory deliberately progressed/focused the size section. Format30×60 then retained the chosen shade/material.
- Mobile native-index and Playwright clicks caused tool-associated scroll movements. These are **not counted as application defects**: direct-pointer retest on the already-visible Aqua swatch preserved panel67→67 and identical44px element rectangle. `scroll-retest.json` and `coordinate-retest.json` retain both observations rather than hiding the uncertain result.
- PASS for these sampled interactions; not proof of every input/family/optional.

## U09 — completed-fixture UI preservation

Fixture before: reinforced-concrete in-ground rectangular12×4.5m, depth1.5m, hidden overflow, straight internal stairs, shelf3.035m/water10cm,3white shelf loungers, integrated bench2seats/8jets, Blue Sky602liner, flush porcelainIvorycoping/paving30×60cm, Day.

Changed only length12→11 using the real dimension field. Browser Summary DOM before/after (`06` versus `07`) differs only in displayed length and derived volume60→53m³. Every other displayed technical/optional value above remains unchanged. Panel stayed expanded.

On emulated430 subsequently changed only bench seats2→3; summary shows3seats/12jets while the3Aquamarineloungers, shelf10cm, dimensions, finish and other values remain. This additional change is recorded separately from the desktop comparison.

PASS for UI-rendered preservation. No hidden canonical store object was read, so this receipt alone does **not** close a requirement specifically demanding a full canonical snapshot diff.

## U10 — touched surfaces only

Actual IT→EN→IT checked shelf/lounger colours, quantity, bench and its seats/jets; current coping/flush-paving controls, porcelain family/shade/size and Summary checked in both languages across the specified sizes. No incorrect-language sentence reproduced on these sampled current surfaces. Commercial names/codes left intact. Selected colour, quantities, bench, expanded panel and fixture preserved.

PASS sampled current surfaces, not exhaustive whole-app/PDF/error-copy coverage or cloud dirty-state comparison. No cloud project was saved.

## Console and evidence

Only captured warning: existing `THREE.Clock` deprecation; no captured runtime errors.16actual screenshots with paired DOMs where applicable, actions.json and two scroll retest JSONs in this directory. No performance measurement attempted with simultaneous owner/reviewer3Dscenes.

Confirmed defects requiring correction from this bounded replay: none.
