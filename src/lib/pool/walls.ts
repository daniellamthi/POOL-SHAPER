import type { Outline } from "./types";

/**
 * Which wall the skimmer row runs along: the low side of the pool's longer
 * axis, which is the rule `planSkimmers` distributes its row by.
 *
 * Lives in its own dependency-free module -- and is imported with an explicit
 * .ts extension -- so both the skimmer plan and
 * anything that must stay clear of that run -- the stainless ladder above all
 * -- are driven by one rule rather than by two that can drift apart.
 */
export function skimmerWall(outline: Outline): {
  runsAlongX: boolean;
  axis: "x" | "z";
  coordinate: number;
} {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const [x, z] of outline) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (z < minZ) minZ = z;
    if (z > maxZ) maxZ = z;
  }
  const runsAlongX = maxX - minX >= maxZ - minZ;
  return runsAlongX
    ? { runsAlongX, axis: "z", coordinate: minZ }
    : { runsAlongX, axis: "x", coordinate: minX };
}
