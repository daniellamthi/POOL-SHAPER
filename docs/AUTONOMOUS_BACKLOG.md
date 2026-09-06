# Autonomous Backlog

Format: ID / problem / evidence / expected gain / risk / files / acceptance criteria / status.

## AUTO-008 — Liner PBR completeness
- Problem: `INTERIOR_TEXTURE_METADATA` liner entries currently declare base-color (+ derived normal/roughness/AO, per `AUTO-002`-era work now ported) sourced procedurally from the photographed base map; no manufacturer-authored normal/roughness/AO/height maps exist yet.
- Evidence: not yet re-verified this session (see `docs/POOL_ARCHITECT_MASTER_AUDIT.md` — fresh material-truth audit is P2/§116, deferred).
- Expected gain: closer parity with target ARCHVIZ quality bar for close-up liner shots.
- Risk: Medium — requires visual evidence (before/after) and correct physical texture scale; do not tune by eye.
- Files (suspects): `src/components/pool/three/textures.ts`, `src/lib/pool/materials.ts` (or current equivalent), `docs/ASSET_PRODUCTION_SPEC.md`.
- Acceptance: no obvious repetition, no UV break, correct color space, close-up validation.
- Status: BLOCKED — owner input required, not engineering. Re-scoped after verifying the code: the *engineering* half is already done and shipping. `getDerivedDetailMaps()` derives real normal, roughness **and** AO from each finish's own photographed base map (AO added via `AUTO-007`, close-up-verified in `AUTO-010`), with procedural micro-detail as fallback. `textureType: "base-color"` in `INTERIOR_TEXTURE_METADATA` correctly describes the *source asset*, not a rendering deficiency — so this item's original framing ("base-color only") overstated the gap. What actually remains is sourcing manufacturer-authored normal/roughness/AO/height maps, which needs catalogue selection and licence clearance — an owner decision per §96, recorded in `docs/OWNER_INPUT_REQUIRED.md`. Per §26, do not swap the working derived pipeline for authored maps until such assets exist *and* a before/after shows meaningful gain.
- Related, also owner-gated: `PVC_TEXTURE_MODULE_SIZE_METERS` is 0.7 m and explicitly provisional ("awaits catalogue calibration"). Per §25 it must not be tuned by eye — it needs a real manufacturer print-repeat figure.

## AUTO-009 — Deterministic visual-regression infrastructure
- Problem: no deterministic screenshot/baseline harness exists yet (P1, directive §115), so rendering changes (e.g. `AUTO-010`) can only be smoke-tested ad hoc.
- Evidence: this session's dev-server smoke test required manually wiring a globally-installed Playwright (not a project dependency) and a one-off script; no reusable reference-configuration set exists.
- Expected gain: objective before/after comparison for all future visual work; directly unblocks confident material/lighting iteration.
- Risk: Low (additive tooling only).
- Files: `scripts/visual-audit.mjs` (new), `test-baselines/visual/*.png` (new, committed baselines), `package.json` (`test:visual` / `test:visual:update` scripts), `playwright`/`pixelmatch`/`pngjs` added as devDependencies.
- Acceptance: deterministic camera/config/viewport/quality reference set per §63; runnable via an `npm run` script.
- Status: IN_PROGRESS — harness proven deterministic within a given sandbox instance (re-run diff ratios match to the third decimal); 3 of the ~15+ reference configurations from directive §63 now exist (`landing-desktop`, `liner-closeup`, `mosaic-closeup` — the latter two added this session for `AUTO-010`, reached via `navigateToInteriorFinish()`'s wizard-click helpers). Remaining reference configs (coping/skimmer/overflow close-ups, custom shape, mobile viewport, etc.) are follow-up work, not blocking further use of the harness for newly-changed files (add a reference alongside the change that touches it). Cross-sandbox pixel-exact comparison has a known limitation — see `AUTO-013`.
- Follow-up: consider a dev-only test hook (e.g. a window-exposed state-dispatch function, gated out of production builds) to reach deep wizard states without brittle UI click sequences — evaluate cost/benefit before implementing, per LC-18 (don't build speculative infrastructure). Not needed for `AUTO-010`: real wizard clicks (dispatched via `page.evaluate` in-page rather than Playwright's mouse simulation, which this sandbox's software-rendering GPU stalls make time out — see script header comment) worked fine.

## AUTO-010 — Interior AO close-up visual verification
- Status: COMPLETE. Dedicated Liner and Mosaic close-up screenshots (`test-baselines/visual/liner-closeup.png`, `mosaic-closeup.png`) confirm the ported interior AO (`70f0d0c`) is subtle, artifact-free, and indirect-light-only on both finishes — no direct-light darkening, no black patches, no UV break. Ledger entry for `70f0d0c` upgraded IN_PROGRESS → RECOVERED in `docs/POOL_ARCHITECT_MASTER_AUDIT.md`; `docs/AUTONOMOUS_ISSUES.md` AUTO-007 upgraded IN_PROGRESS → FIXED. Consolidation is now LC-13A-complete (no items left VALIDATION-PENDING).

## AUTO-017 — Mosaic anti-tiling (directive §28 / P2 item 13)
- Problem: anticipated "obvious repeated modules" on large mosaic walls (~145 repeats along a 10 x 4.5 m pool's wall perimeter).
- Evidence: both shipped mosaic assets tiled 4x4 offline and inspected — seamless, no detectable repeating tessera constellation on either (teal artwork's tesserae are near-uniform; pale artwork is too low-contrast to read as a pattern).
- Decision: NOT implemented — real shader/GPU cost and risk to §28's own constraints (pattern identity, grout continuity, wall/floor continuity) for no demonstrable gain. See `docs/AUTONOMOUS_DECISIONS.md` D-001 and `AUTO-016`.
- Status: CLOSED (verified, no defect). Re-open only if a high-contrast / non-uniform mosaic asset ships — re-run the 4x4 tiling check first.

## Priority order reference
See `docs/IMPROVEMENT_ROADMAP.md` and the master directive's default priority order (P0 repository trust → P1 visual safety → P2 material truth → …). `AUTO-010` closes the last P0/P1 consolidation gap. Next: continue expanding `AUTO-009`'s reference set opportunistically, then `AUTO-008` (liner PBR completeness, P2/§116 fresh material-truth audit).
