# Deck Marrone and automatic-cover elevation

2026-10-13 — surgical fix, existing branch `feat/fullscreen-day-night-hidden-overflow`.

- PASS: brown coping has one solid per built side (four on rectangles, three with one Infinity side excluded). Other finishes retain byte-identical geometry in three recorded baselines.
- PASS: original colour/roughness/normal assets remain unchanged. Joint-free grain is sampled inside the original photographed plank, with metric texel density and the existing side orientation. Exterior paving is unchanged.
- PASS: six geometry cases and 210 thickness/closure rays; original bounds and thickness within 1 µm.
- PASS: cover slats and leading bar top derive from the actual coping/grille world bounding box. In real Skimmer fixtures, rim = 0.055000001 m and slat top = 0.055000000 m (previously −0.112 m). Dimensions, roller, materials and deployment logic remain unchanged.
- PASS: headed Chrome on Apple M1 Pro, desktop 1440×900, 6×3 / 8×4 / 12×5, nine before and nine final after screenshots. Close-up grain, corners and open/closed cover inspected; no runtime/shader errors. Closed slat counts 85 / 114 / 171; open count zero.
- PASS: `node scripts/brown-deck-cover-audit.mjs`, typecheck, production build and diff-check.

Local screenshots and raw measurements: ignored `docs/fullscreen-qa-evidence/brown-cover/{before,after}-*`, including `before-results.json` and `after-results.json`. Tests use isolated local fixtures and block POST requests; no backend writes or email.

Preexisting fullscreen/hidden-overflow WIP is preserved and excluded from this fix's commit. No merge or deployment.
