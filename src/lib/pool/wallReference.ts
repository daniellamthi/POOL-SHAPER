import type { Outline } from "./types";

export interface WallReference {
  /** Midpoint of the chosen wall segment, in the pool's XZ plane. */
  point: readonly [number, number];
  /** Unit normal pointing into the basin. */
  inward: readonly [number, number];
  /** Unit normal pointing away from the basin. */
  outward: readonly [number, number];
  /** Unit vector running along the wall. */
  tangent: readonly [number, number];
  length: number;
}

const FALLBACK: WallReference = {
  point: [0, 0],
  inward: [0, -1],
  outward: [0, 1],
  tangent: [1, 0],
  length: 0,
};

/** Picks one straight wall segment of the outline -- the longest or the
 * shortest -- and returns its midpoint plus inward/outward/tangent unit
 * vectors. Shared by pool-access fixtures (internal stairs, external
 * ladder) that need to sit flush against a real wall instead of floating at
 * the outline centroid. */
export function getWallReference(outline: Outline, pick: "longest" | "shortest"): WallReference {
  if (outline.length < 2) return FALLBACK;
  const centre = outline.reduce(
    (sum, [x, z]) => [sum[0] + x / outline.length, sum[1] + z / outline.length] as const,
    [0, 0] as const,
  );
  let best: WallReference | null = null;
  for (let index = 0; index < outline.length; index++) {
    const start = outline[index]!;
    const end = outline[(index + 1) % outline.length]!;
    const dx = end[0] - start[0];
    const dz = end[1] - start[1];
    const length = Math.hypot(dx, dz);
    if (length < 1e-6) continue;
    const better = !best || (pick === "longest" ? length > best.length : length < best.length);
    if (!better) continue;
    const midpoint: readonly [number, number] = [(start[0] + end[0]) / 2, (start[1] + end[1]) / 2];
    const firstNormal: readonly [number, number] = [-dz / length, dx / length];
    const pointsOutward =
      firstNormal[0] * (midpoint[0] - centre[0]) + firstNormal[1] * (midpoint[1] - centre[1]) > 0;
    const outward = pointsOutward ? firstNormal : ([-firstNormal[0], -firstNormal[1]] as const);
    best = {
      point: midpoint,
      outward,
      inward: [-outward[0], -outward[1]],
      tangent: [dx / length, dz / length],
      length,
    };
  }
  return best ?? FALLBACK;
}
