# Infinity geometric cleanup

Branch feat/premium-infinity-waterline-v1; existing WIP preserved. No commit/push/deploy.

## Changes

- `src/components/pool/three/infinityContainment.ts`: constant crest width and elevation through terminal returns, removing the previous flared/raised terminal profiles; retain closed channel ends. Receiver freeboard 45 mm and slab 80 mm. Back face separated 4 mm from the coincident liner plane, inside the structural build-up.
- `src/lib/pool/infinity-edge.ts`: shared crest width 150 → 120 mm; receiver depth 350 → 250 mm. Clear channel width remains 350 mm, outer wall 150 mm. Indicative visualization proportions, not certified construction design.
- `scripts/infinity-containment-audit.ts`: add assertions against raised terminal piers and oversized receiver front.

No separate duplicate decorative rail mesh was found. The existing assembly is already a single closed shell; its profile was refined rather than deleting functional containment. Water shader, stairs, camera, lights, UI, terrain and decking code are unchanged.

## Actual verification

Preview: rectangle 10 × 4.5 × 1.2 m, sides 1/3, manual oblique inspection; second size 6 × 3 × 1.2 m, side 3. Guides hidden. General before/after use the same automatic side-1 camera; detail/orbit images are supplemental, not exact matched-camera proof.

![Before](/private/tmp/infinity-clean-before.png)
![After](/private/tmp/infinity-clean-after.png)
![Both ends](/private/tmp/infinity-clean-ends.png)
![Oblique side](/private/tmp/infinity-clean-side.png)
![Opposite edge](/private/tmp/infinity-clean-opposite.png)
![Second size](/private/tmp/infinity-clean-6x3.png)

Typecheck/build/diff-check PASS. 26 closed shells across rectangle/L/custom/organic and two sizes PASS, including receiver elevations and end closure. Existing build warnings about bundle sizes/tsconfig paths remain.

## Visual limitations

Improvement is restrained, not a photographic-quality claim. The front receiver is lower (530 → 375 mm overall), but its horizontal rim is still readable; the water film remains subtle. The adjoining deck-to-terrain end silhouettes are still angular, particularly on the small pool, and were not hidden or altered. No new photo was attached to this request, so exact reference-angle matching could not be verified. Dedicated isolated close-ups of each end were not captured; both ends are visible in the oblique screenshot.
