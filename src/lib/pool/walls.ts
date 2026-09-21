import type { Outline } from "./types";

/**
 * Local radius of curvature (circumradius of the point and its immediate
 * neighbours) at one outline vertex -- large/Infinity on a straight run,
 * small at a tight bend. Dependency-free (no import from geometry.ts) to
 * keep this module's own "no external deps" contract.
 */
function localCurvatureRadius(outline: Outline, index: number): number {
  const previous = outline[(index - 1 + outline.length) % outline.length]!;
  const current = outline[index]!;
  const next = outline[(index + 1) % outline.length]!;
  const first = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
  const second = Math.hypot(next[0] - current[0], next[1] - current[1]);
  const opposite = Math.hypot(next[0] - previous[0], next[1] - previous[1]);
  const twiceArea = Math.abs(
    (current[0] - previous[0]) * (next[1] - previous[1]) -
      (current[1] - previous[1]) * (next[0] - previous[0]),
  );
  if (twiceArea <= 1e-9) return Infinity;
  return (first * second * opposite) / (2 * twiceArea);
}

/** A real architectural corner (rectangle, L-shape recess) turns sharply
 * over a single vertex -- a normal, expected place for two straight walls
 * to meet, never itself the kind of "excessively curved mounting zone" this
 * module steers away from. An Organic bay, by contrast, is a smooth,
 * continuously-curving run sampled at many closely-spaced points, each
 * turning only a little. Vertices past this turn-angle are treated as
 * architectural corners and excluded from the curvature comparison below,
 * so a perfectly ordinary L-shape/rectangle corner sitting inside the
 * sampling band never gets mistaken for a bay and never flips which side
 * is chosen. */
const CORNER_TURN_ANGLE = (25 * Math.PI) / 180;

function turnAngle(outline: Outline, index: number): number {
  const previous = outline[(index - 1 + outline.length) % outline.length]!;
  const current = outline[index]!;
  const next = outline[(index + 1) % outline.length]!;
  const inAngle = Math.atan2(current[1] - previous[1], current[0] - previous[0]);
  const outAngle = Math.atan2(next[1] - current[1], next[0] - current[0]);
  let delta = outAngle - inAngle;
  while (delta > Math.PI) delta -= Math.PI * 2;
  while (delta < -Math.PI) delta += Math.PI * 2;
  return Math.abs(delta);
}

/**
 * How tightly and gradually curved the outline is in the neighbourhood of
 * one side of the principal axis (vertices within `band` of that extreme
 * coordinate, excluding real architectural corners -- see
 * `CORNER_TURN_ANGLE`) -- the worst (smallest) local curvature radius among
 * them, or `Infinity` when no qualifying vertex falls in the band (a
 * degenerate/empty band, or a band that only contains corners, never
 * disqualifies a side that has no genuine smooth-curve concern).
 */
function worstCurvatureNear(
  outline: Outline,
  axisIndex: 0 | 1,
  extreme: number,
  band: number,
): number {
  let worst = Infinity;
  for (let index = 0; index < outline.length; index++) {
    if (Math.abs(outline[index]![axisIndex] - extreme) > band) continue;
    if (turnAngle(outline, index) > CORNER_TURN_ANGLE) continue;
    worst = Math.min(worst, localCurvatureRadius(outline, index));
  }
  return worst;
}

/**
 * Which wall the skimmer row runs along: the flattest side of the pool's
 * longer bounding-box axis, which is the rule `planSkimmers` distributes its
 * row by.
 *
 * For a rectangle or L-shape both sides of the axis are equally straight
 * (infinite curvature radius either way), so this keeps the original,
 * deterministic "low side" choice -- every pre-Organic geometry/lighting/
 * access test still gets the exact same wall it always did. Only when one
 * side is measurably more curved than the other (the Organic bay/waist,
 * which can sit on either the min or the max side depending on the mirror
 * toggle) does this actually steer away from it, onto the smoother far
 * side -- never a fixed "always min" assumption that a sharp bay could land
 * directly on.
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
  const spanX = maxX - minX;
  const spanZ = maxZ - minZ;
  const runsAlongX = spanX >= spanZ;
  const axis: "x" | "z" = runsAlongX ? "z" : "x";
  const axisIndex: 0 | 1 = runsAlongX ? 1 : 0;
  const [lowExtreme, highExtreme] = runsAlongX ? [minZ, maxZ] : [minX, maxX];
  // A band proportional to the cross-span: wide enough to sample the real
  // run a skimmer/ladder row would occupy along that side, narrow enough not
  // to bleed into the opposite side on a slender pool.
  const band = Math.max(0.5, (runsAlongX ? spanZ : spanX) * 0.15);
  const lowCurvature = worstCurvatureNear(outline, axisIndex, lowExtreme, band);
  const highCurvature = worstCurvatureNear(outline, axisIndex, highExtreme, band);
  // Ties (rectangle/L-shape: both Infinity) keep the original "low side"
  // default. Only switch to the high side when it is a real, measurable
  // improvement.
  const coordinate = highCurvature > lowCurvature ? highExtreme : lowExtreme;
  return { runsAlongX, axis, coordinate };
}
