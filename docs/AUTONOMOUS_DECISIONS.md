# Autonomous decisions log

Ordinary engineering decisions made without owner input (all reversible, all
preserving existing behavior — see docs/AUTONOMOUS_STATE.md §41 authority).

## D-001 — AO derivation strategy for interior finishes
Chose to derive AO from the same Sobel edge signal already computed for the
photographed liner/mosaic normal/roughness maps (`getDerivedDetailMaps`),
rather than downloading or requesting new photographed AO texture sets.
Reason: no network asset pipeline is authorized for this session, and the
edge signal already correlates real grout/seam geometry with occlusion —
deriving from it keeps the identity of each photographed finish intact
(section 8's requirement) without inventing an unrelated pattern. A fallback
procedural AO map (`createMaterialMicroAoMap`) covers any finish without a
usable photo, matching the existing normal/roughness fallback pattern.

## D-002 — Left the pre-existing geometry-audit failure unfixed this pass
`npm run test:geometry` was already failing before this session's changes
(confirmed via `git stash`). Fixing it touches `src/lib/pool/camera.ts`, a
shared file with no relation to the AO work in progress. Per the "no
disproportionate scope in one atomic change" guidance, logged it as AB-001
instead of bundling an unrelated camera fix into this commit.

## D-003 — Did not extend AO to coping/panel triplanar materials in this pass
Coping/panel detail is sampled through a custom `onBeforeCompile` triplanar
GLSL patch, not plain material props like the interior wall/floor path. Wiring
AO there is materially higher risk (hand-written shader edits) than the
interior pass and deserves its own isolated change/test cycle — logged as
AB-002 rather than expanding this commit's risk surface.
