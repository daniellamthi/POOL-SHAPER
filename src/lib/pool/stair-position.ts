import { mergedWallChords } from "./lighting";
import type { InternalStairPosition, Outline } from "./types";

export function isInternalStairPosition(value: unknown): value is InternalStairPosition {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const p = value as InternalStairPosition;
  return [p.x, p.z].every(v => typeof v === "number" && Number.isFinite(v) && Math.abs(v) <= 200);
}

/** Select the nearest actual wall BEFORE checking its clearance. An obstructed
 * wall never silently substitutes an unrelated side of the basin. */
export function nearestStairWall(outline: Outline, point: InternalStairPosition, width = 0) {
  if (!isInternalStairPosition(point)) return null;
  const walls = mergedWallChords(outline, .06).map(wall => {
    const { a, b, length } = wall;
    const tx = (b[0] - a[0]) / length, tz = (b[1] - a[1]) / length;
    const along = Math.max(0, Math.min(length, (point.x-a[0])*tx + (point.z-a[1])*tz));
    return { ...wall, tx, tz, along, distance: Math.hypot(point.x-a[0]-along*tx, point.z-a[1]-along*tz) };
  }).filter(wall => wall.length > 1e-6).sort((a,b) => a.distance-b.distance);
  const wall = walls[0];
  if (!wall || wall.length < width + .2) return null;
  const along = Math.max(width/2+.02, Math.min(wall.length-width/2-.02, wall.along));
  return { ...wall, along, x: wall.a[0]+wall.tx*along, z: wall.a[1]+wall.tz*along };
}
