# Autonomous decisions

## 2026-09-05 — Fix the stale test, don't revert the camera design

`scripts/geometry-audit.ts` asserted that the Liner camera's target must
equal the Skimmer master's target exactly, and that the Mosaic camera's pose
must equal the Liner camera's pose exactly. Both are contradicted by
`getInteriorFinishCamera`'s own doc comment in `src/lib/pool/camera.ts`,
which explicitly describes Liner as pulled back/architectural and Mosaic as a
tight material swatch — a deliberate, already-shipped improvement.

Decision: treat the intentional camera design as correct and the test as
stale, rather than reverting the camera behavior to satisfy the old test.
Rewrote the assertions to encode the real invariants (wall-plane target,
wall-centred alignment, frontal direction, Mosaic tighter than Liner).

Rationale: reverting a deliberate, documented UX improvement to satisfy an
outdated test would be regressing product quality to chase a green check for
its own sake — the opposite of the stated mission. The new assertions still
provide a meaningful regression gate.
