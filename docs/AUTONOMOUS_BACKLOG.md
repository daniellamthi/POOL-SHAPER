# Autonomous backlog

Format: ID / problem / evidence / expected gain / risk / files / acceptance criteria / status.

## AUTO-001 — Automatic rendering quality tier
- Problem: `ACTIVE_RENDERING_QUALITY` was hardcoded to `"experience"` for every device.
- Evidence: `src/configurator/3d/scene/visual-preset.ts` (comment: "Temporarily set to Experience for live visual verification").
- Expected gain: protects mobile/low-power FPS budget (spec section 27: mobile >=30 FPS) without touching desktop quality.
- Risk: low — same exported constant, no downstream API change.
- Files: `src/configurator/3d/scene/visual-preset.ts`.
- Acceptance: typecheck/lint/build clean; desktop (no coarse pointer, >=5 cores, wide viewport) still resolves to `experience`; mobile/touch/narrow/low-core resolves to `configuration`.
- Status: COMPLETE.

## AUTO-002 — Geometry audit regression: stale Liner/Mosaic camera assertions
- Problem: `npm run test:geometry` failed on `rectangle-10x4.5/in-ground` ("Interior Finish changed the reference wall target", then "Mosaic camera differs from PVC/Liner"). Root cause: an earlier checkpoint (`4cddd3f`) intentionally changed `getInteriorFinishCamera` in `src/lib/pool/camera.ts` so Liner/Mosaic target a point ON the reference wall (close, perpendicular material view) instead of the pool's bounds centre, and gave Mosaic a tighter distance than Liner — but the two audit assertions were never updated and still expected the old "target equals bounds centre" / "Mosaic pose exactly equals Liner pose" invariants.
- Evidence: reproduced by hand with a standalone repro script (rolldown-bundling `camera.ts` + `geometry.ts` directly) confirming: (a) Liner's target legitimately sits on the wall (same inward coordinate as the reference skimmer), not at the bounds centre; (b) Liner and Mosaic share the exact same target but intentionally different camera position/distance.
- Fix: replaced both assertions in `scripts/geometry-audit.ts` with invariants that match the intentional design: Liner's target must lie on the reference wall (zero offset along the reference skimmer's inward axis) and stay tangentially centred like the master view; Mosaic must share Liner's target only (not position).
- Files: `scripts/geometry-audit.ts` only — no product code (`camera.ts`) touched, since the camera behavior itself is correct and intentional.
- Acceptance: `npm run test:geometry` passes (108 cases); typecheck/lint/build clean.
- Status: COMPLETE.

## Priority order reference
See `docs/IMPROVEMENT_ROADMAP.md` for the full 15-item priority list and file targets. Default order for future iterations when no urgent regression exists: liner PBR completeness (normal/roughness/AO maps, currently base-color only) > curve-aware coping/overflow offsets > camera system calibration > mosaic anti-tiling > premium photo mode polish.
