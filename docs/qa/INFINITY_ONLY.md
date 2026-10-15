# Infinity-only verification — 2026-10-13

Branch: `feat/fullscreen-day-night-hidden-overflow`; base `2afb0544d4f51fa243cc3962fa4931d4f76229f6`.
Existing fullscreen WIP and previous continuous Brown Deck/flush cover changes are preserved.

## Evidence

- PASS: front Infinity composition shows open sea, without photographed foreground rocks. Actual browser captures: `docs/fullscreen-qa-evidence/infinity-only/final-sea-1440-traditional.png` and `final-sea-390-traditional.png`.
- PASS: traditional/glass selection and all four side selections persist in local drafts (`final-check.json`). These are local fixture tests, not cloud persistence tests; backend POST requests were blocked.
- PASS: `node scripts/infinity-only-audit.mjs`: 12 size/side cases, physical glass thickness, containment triangle conservation, crest/water elevations, local serialization.
- PASS: `npx tsc --noEmit`, `npm run build`, `git diff --check` after the final type correction.
- Glass represents the existing containment thickness, not a certified structural specification. The water film extends 6 mm over the crest.
- Source and CC0 license: `public/hdri/infinity-white-cliff-LICENSE.md`. Only sky/open-water sectors are used ahead of the pool.

## Follow-up — 2026-10-15

The lower lateral support/receiver gap identified in `final-check-glass-exterior.png` is corrected: endpoint returns meet the actual outer offset and the support face remains visible from the exterior. Actual after evidence: `support-final-glass-exterior.png`. Traditional and glass cloud Save/Reload/Share/Copy/PDF/quote subsequently passed; see `CUSTOMER_QA_20261015.md`. Reverse diagnostic angles still show the source's distant headland; this is not an all-angle sea-only panorama.

No merge/deployment or backend/schema changes. Commit/push remains conditional on the final customer QA gate, including performance; see the current report. Do not declare the full gate KEEP from automatic tests alone.
