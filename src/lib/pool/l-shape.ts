/**
 * Canonical L-shape domain model (Geometry Pass B). Single source of truth
 * for the L-shaped outline and its derived metadata -- every subsystem
 * (floor, walls, water, coping, skimmer, access, lighting, metrics) consumes
 * the same `Outline` this module produces and the same corner classification,
 * never a second L-specific formula of its own.
 *
 * Canonical representation: an outer bounding rectangle with one rectangular
 * corner recess removed --
 *
 *   outer rectangle (totalLength x totalWidth) - corner recess = L outline
 *
 * -- which is both the simplest robust parameterisation and the one that
 * maps directly onto clear customer-facing controls (overall dimensions,
 * recess dimensions, which corner). The recess corner is stored internally
 * as one of four `LShapeOrientation` values; the UI never has to surface
 * compass-point naming, only a diagram.
 */
import type { Outline } from "./types";
import { outlineArea, outlineBounds, outlinePerimeter } from "./geometry";

export type LShapeOrientation = "sw" | "se" | "ne" | "nw";

export const L_SHAPE_ORIENTATIONS: readonly LShapeOrientation[] = ["sw", "se", "ne", "nw"];

export interface LShapeDimensions {
  /** Outer bounding rectangle span along X, metres. */
  totalLength: number;
  /** Outer bounding rectangle span along Z, metres. */
  totalWidth: number;
  /** Recess span along X, metres -- how far the missing corner rectangle
   * reaches in from the long (X) side it's cut from. */
  recessLength: number;
  /** Recess span along Z, metres. */
  recessWidth: number;
  /** Which outer corner the recess is cut from. */
  orientation: LShapeOrientation;
}

/** Guardrails: never let a leg thin out to a corridor, never let the recess
 * collapse to a sliver, never let overall dimensions leave the pool's
 * existing rectangle range. Mirrors the spirit of the rectangle's own
 * dimension clamps (see PoolShapeStep.tsx / config.ts) rather than
 * inventing a parallel policy. */
export const L_SHAPE_GUARDRAILS = {
  totalLength: { min: 5, max: 25 },
  totalWidth: { min: 4, max: 15 },
  /** The narrowest a remaining leg (on either axis) may ever be -- both the
   * straight leg opposite the recess and the "foot" leg beside it. Below
   * this a leg reads as a corridor, not a usable swimming lane. */
  minLegWidth: 2,
  /** The smallest the recess itself may be -- below this it's not a
   * legible L, just a rectangle with a notch. */
  minRecess: 1.5,
} as const;

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

/**
 * Normalise arbitrary (possibly partial, possibly out-of-range, possibly
 * NaN) input into a set of L-shape dimensions that can never produce a
 * zero-width leg, a self-intersecting outline, or a degenerate recess.
 * Every other function in this module assumes its `LShapeDimensions` input
 * already passed through here -- callers (the UI, persistence) must too.
 */
export function clampLShapeDimensions(
  input: { [K in keyof LShapeDimensions]?: LShapeDimensions[K] | undefined } | undefined,
): LShapeDimensions {
  const totalLength = clampNumber(
    input?.totalLength ?? 10,
    L_SHAPE_GUARDRAILS.totalLength.min,
    L_SHAPE_GUARDRAILS.totalLength.max,
    10,
  );
  const totalWidth = clampNumber(
    input?.totalWidth ?? 7,
    L_SHAPE_GUARDRAILS.totalWidth.min,
    L_SHAPE_GUARDRAILS.totalWidth.max,
    7,
  );
  // The recess can never eat so far into the rectangle that the leg it
  // leaves behind is thinner than minLegWidth on that axis.
  const maxRecessLength = Math.max(
    L_SHAPE_GUARDRAILS.minRecess,
    totalLength - L_SHAPE_GUARDRAILS.minLegWidth,
  );
  const maxRecessWidth = Math.max(
    L_SHAPE_GUARDRAILS.minRecess,
    totalWidth - L_SHAPE_GUARDRAILS.minLegWidth,
  );
  const recessLength = clampNumber(
    input?.recessLength ?? totalLength * 0.4,
    L_SHAPE_GUARDRAILS.minRecess,
    maxRecessLength,
    Math.min(maxRecessLength, totalLength * 0.4),
  );
  const recessWidth = clampNumber(
    input?.recessWidth ?? totalWidth * 0.4,
    L_SHAPE_GUARDRAILS.minRecess,
    maxRecessWidth,
    Math.min(maxRecessWidth, totalWidth * 0.4),
  );
  const orientation = L_SHAPE_ORIENTATIONS.includes(input?.orientation as LShapeOrientation)
    ? (input!.orientation as LShapeOrientation)
    : "se";
  return { totalLength, totalWidth, recessLength, recessWidth, orientation };
}

/**
 * The real-world (metre), CCW-wound, 6-vertex L outline. Matches the
 * winding convention `unitRectangle()` (geometry.ts) already uses --
 * positive shoelace sum -- so every generic outline consumer (offsetOutline,
 * skimmerWall, createSurfaceGeometry, floor-profile) sees the same
 * orientation it already expects from every other shape.
 *
 * Each of the four orientations is the outer rectangle's 4 corners with one
 * corner replaced by a 3-point inward step -- always exactly one reflex
 * (concave) vertex, at the inner corner of the L, and five ordinary convex
 * corners. Dimensions must already be `clampLShapeDimensions`-normalised;
 * this function does no further validation.
 */
export function buildLShapeOutline(dimensions: LShapeDimensions): Outline {
  const { totalLength: length, totalWidth: width, recessLength: rl, recessWidth: rw } = dimensions;
  const x0 = -length / 2;
  const x1 = length / 2;
  const z0 = -width / 2;
  const z1 = width / 2;
  const a: readonly [number, number] = [x0, z0];
  const b: readonly [number, number] = [x1, z0];
  const c: readonly [number, number] = [x1, z1];
  const d: readonly [number, number] = [x0, z1];
  switch (dimensions.orientation) {
    case "se":
      return [a, [x1 - rl, z0], [x1 - rl, z0 + rw], [x1, z0 + rw], c, d];
    case "sw":
      return [[x0, z0 + rw], [x0 + rl, z0 + rw], [x0 + rl, z0], b, c, d];
    case "ne":
      return [a, b, [x1, z1 - rw], [x1 - rl, z1 - rw], [x1 - rl, z1], d];
    case "nw":
      return [a, b, c, [x0 + rl, z1], [x0 + rl, z1 - rw], [x0, z1 - rw]];
  }
}

/** Per-vertex convex/reflex classification, generic over any simple,
 * consistently-wound polygon -- not L-specific, so `cornerStairPlan` and
 * anything else that must never treat the inner concave corner of an L (or
 * any future concave shape) as a normal convex pool corner can reuse this
 * instead of re-deriving the same cross-product test locally. Winding-aware:
 * works for either CW or CCW input. */
export function classifyOutlineCorners(outline: Outline): readonly boolean[] {
  if (outline.length < 3) return outline.map(() => true);
  let signedAreaSum = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, z1] = outline[i]!;
    const [x2, z2] = outline[(i + 1) % outline.length]!;
    signedAreaSum += x1 * z2 - x2 * z1;
  }
  const ccw = signedAreaSum >= 0;
  return outline.map((point, i) => {
    const previous = outline[(i - 1 + outline.length) % outline.length]!;
    const next = outline[(i + 1) % outline.length]!;
    const inX = point[0] - previous[0];
    const inZ = point[1] - previous[1];
    const outX = next[0] - point[0];
    const outZ = next[1] - point[1];
    const cross = inX * outZ - inZ * outX;
    return ccw ? cross >= -1e-9 : cross <= 1e-9;
  });
}

export interface LShapeOutlineInfo {
  outline: Outline;
  area: number;
  perimeter: number;
  centroid: readonly [number, number];
  bounds: ReturnType<typeof outlineBounds>;
  /** True for the one reflex vertex (the inner concave corner), same
   * indexing as `outline`. */
  convex: readonly boolean[];
  /** Index of the single concave vertex. */
  concaveIndex: number;
}

/** Convenience bundle of the outline plus every piece of derived metadata a
 * consumer is likely to need, computed once. Reuses the existing generic
 * `outlineArea`/`outlinePerimeter`/`outlineBounds` (geometry.ts) rather than
 * a parallel L-specific area/perimeter formula -- those already integrate
 * correctly over any simple polygon via the shoelace formula. */
export function buildLShapeOutlineInfo(dimensions: LShapeDimensions): LShapeOutlineInfo {
  const outline = buildLShapeOutline(dimensions);
  const bounds = outlineBounds(outline);
  const convex = classifyOutlineCorners(outline);
  const concaveIndex = convex.findIndex((isConvex) => !isConvex);
  const centroid = outline.reduce(
    (sum, [x, z]) => [sum[0] + x / outline.length, sum[1] + z / outline.length] as const,
    [0, 0] as readonly [number, number],
  );
  return {
    outline,
    area: outlineArea(outline),
    perimeter: outlinePerimeter(outline),
    centroid,
    bounds,
    convex,
    concaveIndex: concaveIndex < 0 ? 0 : concaveIndex,
  };
}
