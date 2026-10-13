import type { Outline } from "./types";
import type { InfinityExclusion } from "./walls";

/** Interior clearance from the disappearing edge for every access footprint. */
export const INFINITY_ACCESS_CLEARANCE = 0.45;

export function oppositeInfinityCoordinate(outline: Outline, exclusion: InfinityExclusion) {
  const axis = exclusion.axis === "x" ? 0 : 1;
  const values = outline.map((point) => point[axis]);
  const min = Math.min(...values), max = Math.max(...values);
  return Math.abs(exclusion.coordinate - min) <= Math.abs(exclusion.coordinate - max)
    ? max
    : min;
}

function pointSegmentDistance(
  point: readonly [number, number],
  a: readonly [number, number],
  b: readonly [number, number],
) {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const lengthSquared = dx * dx + dz * dz;
  const t = lengthSquared > 0
    ? Math.max(0, Math.min(1, ((point[0] - a[0]) * dx + (point[1] - a[1]) * dz) / lengthSquared))
    : 0;
  return Math.hypot(point[0] - a[0] - t * dx, point[1] - a[1] - t * dz);
}

function segmentsIntersect(
  a: readonly [number, number], b: readonly [number, number],
  c: readonly [number, number], d: readonly [number, number],
) {
  const cross = (p: readonly [number, number], q: readonly [number, number], r: readonly [number, number]) =>
    (q[0] - p[0]) * (r[1] - p[1]) - (q[1] - p[1]) * (r[0] - p[0]);
  const abC = cross(a, b, c), abD = cross(a, b, d);
  const cdA = cross(c, d, a), cdB = cross(c, d, b);
  return abC * abD <= 0 && cdA * cdB <= 0 &&
    Math.max(Math.min(a[0], b[0]), Math.min(c[0], d[0])) <= Math.min(Math.max(a[0], b[0]), Math.max(c[0], d[0])) &&
    Math.max(Math.min(a[1], b[1]), Math.min(c[1], d[1])) <= Math.min(Math.max(a[1], b[1]), Math.max(c[1], d[1]));
}

/** Checks the whole polygon, including edges crossing a curved Infinity arc. */
export function clearOfInfinityEdge(
  outline: Outline,
  exclusion: InfinityExclusion | null,
  footprint: Outline,
): boolean {
  if (!exclusion || footprint.length === 0) return true;
  const infinityEdges = exclusion.edgeIndices?.length
    ? exclusion.edgeIndices.map((index) => [outline[index]!, outline[(index + 1) % outline.length]!] as const)
    : outline.map((a, index) => [a, outline[(index + 1) % outline.length]!] as const)
        .filter(([a, b]) => {
          const axis = exclusion.axis === "x" ? 0 : 1;
          return Math.abs(a[axis] - exclusion.coordinate) < 1e-6 &&
            Math.abs(b[axis] - exclusion.coordinate) < 1e-6;
        });
  for (const [a, b] of infinityEdges) {
    for (let index = 0; index < footprint.length; index++) {
      const c = footprint[index]!, d = footprint[(index + 1) % footprint.length]!;
      if (segmentsIntersect(a, b, c, d) ||
        pointSegmentDistance(a, c, d) < INFINITY_ACCESS_CLEARANCE - 1e-8 ||
        pointSegmentDistance(b, c, d) < INFINITY_ACCESS_CLEARANCE - 1e-8 ||
        pointSegmentDistance(c, a, b) < INFINITY_ACCESS_CLEARANCE - 1e-8 ||
        pointSegmentDistance(d, a, b) < INFINITY_ACCESS_CLEARANCE - 1e-8) return false;
    }
  }
  return true;
}
