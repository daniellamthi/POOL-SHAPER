import type { Outline, OverflowType, PoolType, SystemType } from "@/lib/pool/types";
import { offsetOutline, outlineBounds } from "@/lib/pool/geometry";
import { copingOuterOffset } from "./poolConstruction";
import { DECK_CHAISE_MODEL, DECK_CHAISE_LAYOUT } from "@/lib/pool/sun-shelf-model";

/** Width of the paved band around the basin, metres. Scales gently with the
 * pool so a 6 m basin is not swallowed by its own terrace while a 12 m one
 * still reads as a real deck rather than a kerb (was a fixed 1.2 m). */
export function studioDeckBand(outline: Outline, environment = true, loungers = false) {
  // Early configuration steps keep the compact 1.2 m presentation band.
  if (!environment) return 1.2;
  const bounds = outlineBounds(outline);
  const base = Math.min(3.6, Math.max(2.6, Math.hypot(bounds.spanX, bounds.spanZ) * 0.3));
  return loungers ? Math.max(base, DECK_CHAISE_LAYOUT.walkway + DECK_CHAISE_MODEL.length + DECK_CHAISE_LAYOUT.rearMargin) : base;
}

export type DeckFurnitureSide = { readonly rotation: number };
/** Extra terrace behind the actual chaise row(s), not a larger ring on all
 * sides. Presentation space, not a certified installation clearance. */
export const LOUNGER_SIDE_EXTENSION = 0.8;
export function studioDeckOutline(inner: Outline, band: number, rows: readonly DeckFurnitureSide[] = []): Outline {
  const outer = offsetOutline(inner, band);
  if (!rows.length) return outer;
  const bounds = outlineBounds(outer);
  const cx = (bounds.minX + bounds.maxX) / 2, cz = (bounds.minZ + bounds.maxZ) / 2;
  let left = 0, right = 0, front = 0, back = 0;
  for (const row of rows) {
    const nx = -Math.sin(row.rotation), nz = -Math.cos(row.rotation);
    if (nx < -0.5) left = LOUNGER_SIDE_EXTENSION;
    if (nx > 0.5) right = LOUNGER_SIDE_EXTENSION;
    if (nz < -0.5) front = LOUNGER_SIDE_EXTENSION;
    if (nz > 0.5) back = LOUNGER_SIDE_EXTENSION;
  }
  // A monotone, piecewise-linear expansion preserves rectangular corners and
  // curved outlines without adding a spike at a single extreme vertex. Only
  // the outer terrace changes: metric paving modules are recut, never scaled.
  return outer.map(([x, z]) => [
    x + (x >= cx ? right : -left) * Math.abs(x - cx) / Math.max(bounds.spanX / 2, 1e-8),
    z + (z >= cz ? back : -front) * Math.abs(z - cz) / Math.max(bounds.spanZ / 2, 1e-8),
  ]);
}

/** Distance from the water edge to the first slab: the coping, or the
 * above-ground shell's standoff. Shared with the deck furniture. */
export function studioDeckInnerOffset(
  poolType: PoolType,
  system: SystemType,
  overflowType: OverflowType,
  copingStyle?: import("@/lib/pool/coping-style").CopingStyle | undefined,
) {
  return poolType === "in-ground" ? copingOuterOffset(system, overflowType, copingStyle) : 0.17;
}
