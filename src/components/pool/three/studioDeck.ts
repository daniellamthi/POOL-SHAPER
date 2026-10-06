import type { Outline, OverflowType, PoolType, SystemType } from "@/lib/pool/types";
import { outlineBounds } from "@/lib/pool/geometry";
import { copingOuterOffset } from "./poolConstruction";

/** Width of the paved band around the basin, metres. Scales gently with the
 * pool so a 6 m basin is not swallowed by its own terrace while a 12 m one
 * still reads as a real deck rather than a kerb (was a fixed 1.2 m). */
export function studioDeckBand(outline: Outline, environment = true) {
  // Early configuration steps keep the compact 1.2 m presentation band.
  if (!environment) return 1.2;
  const bounds = outlineBounds(outline);
  return Math.min(3.6, Math.max(2.6, Math.hypot(bounds.spanX, bounds.spanZ) * 0.3));
}

/** Distance from the water edge to the first slab: the coping, or the
 * above-ground shell's standoff. Shared with the deck furniture. */
export function studioDeckInnerOffset(
  poolType: PoolType,
  system: SystemType,
  overflowType: OverflowType,
) {
  return poolType === "in-ground" ? copingOuterOffset(system, overflowType) : 0.17;
}
