# Autonomous Backlog

Format: ID / problem / evidence / expected gain / risk / files / acceptance criteria / status.

## AUTO-008 — Liner PBR completeness
- Problem: `INTERIOR_TEXTURE_METADATA` liner entries currently declare base-color (+ derived normal/roughness/AO, per `AUTO-002`-era work now ported) sourced procedurally from the photographed base map; no manufacturer-authored normal/roughness/AO/height maps exist yet.
- Evidence: not yet re-verified this session (see `docs/POOL_ARCHITECT_MASTER_AUDIT.md` — fresh material-truth audit is P2/§116, deferred).
- Expected gain: closer parity with target ARCHVIZ quality bar for close-up liner shots.
- Risk: Medium — requires visual evidence (before/after) and correct physical texture scale; do not tune by eye.
- Files (suspects): `src/components/pool/three/textures.ts`, `src/lib/pool/materials.ts` (or current equivalent), `docs/ASSET_PRODUCTION_SPEC.md`.
- Acceptance: no obvious repetition, no UV break, correct color space, close-up validation.
- Status: READY.

## AUTO-009 — Deterministic visual-regression infrastructure
- Problem: no deterministic screenshot/baseline harness exists yet (P1, directive §115), so rendering changes (e.g. `AUTO-010`) can only be smoke-tested ad hoc.
- Evidence: this session's dev-server smoke test required manually wiring a globally-installed Playwright (not a project dependency) and a one-off script; no reusable reference-configuration set exists.
- Expected gain: objective before/after comparison for all future visual work; directly unblocks confident material/lighting iteration.
- Risk: Low (additive tooling only).
- Files (suspects): new `scripts/visual-audit.mjs` or similar, `package.json`.
- Acceptance: deterministic camera/config/viewport/quality reference set per §63; runnable via an `npm run` script.
- Status: READY — recommended next P1 task once P0 is stable.

## AUTO-010 — Interior AO close-up visual verification
- Problem: `70f0d0c`'s interior AO (ported this session) was verified by code review + typecheck/lint/build/geometry-audit + one default-step Playwright smoke shot, but not by a dedicated Liner/Mosaic close-up screenshot comparing indirect-light darkening at grout/seam lines.
- Evidence: see `docs/POOL_ARCHITECT_MASTER_AUDIT.md` consolidation ledger entry for `70f0d0c`.
- Expected gain: closes the residual verification gap noted in the ledger; confirms "mathematically sensible, visually subtle, artifact-free" per directive §27.
- Risk: Low — `aoMap` only affects indirect diffuse/specular in three.js; worst case is a subtle, reversible visual change.
- Files: `src/components/pool/three/textures.ts`, `src/components/pool/three/PoolModel.tsx`.
- Acceptance: a Liner and a Mosaic close-up screenshot show plausible, subtle AO at grout/seam lines with no direct-light darkening or artifacts.
- Status: READY.

## Priority order reference
See `docs/IMPROVEMENT_ROADMAP.md` and the master directive's default priority order (P0 repository trust → P1 visual safety → P2 material truth → …). Current default next task: `AUTO-009` (visual-regression infra) unlocks confident iteration on `AUTO-008`/`AUTO-010`.
