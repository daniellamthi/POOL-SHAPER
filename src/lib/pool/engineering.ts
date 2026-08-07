import { SQM_PER_SKIMMER } from "./config";
import { outlineBounds } from "./geometry";
import type { Outline } from "./types";

export interface SkimmerPlan {
  count: number;
  /** world positions on the water line, with an outward normal angle */
  positions: ReadonlyArray<{ x: number; z: number; rotation: number }>;
  spacing: number;
  cornerDistance: number;
}

/**
 * Industry standard: one skimmer every 25 m² of water surface.
 * Skimmers are distributed evenly along one long side, away from corners.
 */
export function planSkimmers(outline: Outline, waterSurface: number, enabled = true): SkimmerPlan {
  if (!enabled || outline.length < 3 || !Number.isFinite(waterSurface) || waterSurface <= 0) {
    return { count: 0, positions: [], spacing: 0, cornerDistance: 0 };
  }
  const count = Math.max(1, Math.ceil(waterSurface / SQM_PER_SKIMMER));
  const { minX, maxX, minZ, spanX, spanZ } = outlineBounds(outline);
  const positions: Array<{ x: number; z: number; rotation: number }> = [];
  const runAlongX = spanX >= spanZ;
  const runLength = runAlongX ? spanX : spanZ;
  for (let index = 0; index < count; index++) {
    const t = (index + 0.5) / count;
    const targetX = runAlongX ? minX + spanX * t : minX;
    const targetZ = runAlongX ? minZ : minZ + spanZ * t;
    const boundary = closestPointOnOutline(outline, targetX, targetZ);
    positions.push({
      x: boundary[0],
      z: boundary[1],
      rotation: runAlongX ? 0 : -Math.PI / 2,
    });
  }

  const spacing = runLength / count;
  return { count, positions, spacing, cornerDistance: spacing / 2 };
}

function closestPointOnOutline(
  outline: Outline,
  targetX: number,
  targetZ: number,
): readonly [number, number] {
  let closest: readonly [number, number] = outline[0]!;
  let closestDistance = Infinity;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!;
    const b = outline[(index + 1) % outline.length]!;
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    const projection =
      lengthSquared === 0
        ? 0
        : Math.max(0, Math.min(1, ((targetX - a[0]) * dx + (targetZ - a[1]) * dz) / lengthSquared));
    const point: readonly [number, number] = [a[0] + dx * projection, a[1] + dz * projection];
    const distance = Math.hypot(point[0] - targetX, point[1] - targetZ);
    if (distance < closestDistance) {
      closest = point;
      closestDistance = distance;
    }
  }
  return closest;
}
