/**
 * Single source of truth for floor-profile geometry (Geometry Pass A: flat vs
 * sloped floor). Every consumer that needs a floor elevation, a local water
 * depth, or the slope-aware metrics formulas -- rendering, metrics, stairs,
 * lighting, water, measurements -- reads it from here, never re-derives its
 * own copy.
 *
 * Scope: slope is offered for a rectangular or L-shaped, in-ground pool
 * (Geometry Pass B extends the rectangle-only Pass A scope to the L, since
 * both have a real, deterministic principal axis). Custom (arbitrary-polygon)
 * shapes have no single deterministic "principal axis" to slope along
 * without guessing, and above-ground pools are shipped as constant-height
 * modular kits, so both are kept flat regardless of `dimensions.floorProfile`
 * -- `buildFloorProfile` normalises that itself rather than trusting every
 * call site to remember the restriction.
 */
import { GROUND_LEVEL } from "./vertical-layout";
import { outlineArea, outlineBounds, outlinePerimeter } from "./geometry";
import type { PoolVerticalLayout } from "./vertical-layout";
import type { Dimensions, Outline, PoolMetrics, PoolShapeId, PoolType } from "./types";

/** Minimum shallow/deep elevation difference for a slope to be meaningful --
 * guards against a near-zero-gradient "slope" that is really just numerical
 * noise (no NaN, no zero-difference slope). */
export const MIN_SLOPE_DIFFERENCE = 0.2;

/** A depth this small leaves no room for a `MIN_SLOPE_DIFFERENCE` shallow end
 * without going under the absolute minimum pool depth -- slope is not
 * offerable at all below this. */
export function slopeEligibleForDepth(depth: number, minDepth: number): boolean {
  return Number.isFinite(depth) && depth - MIN_SLOPE_DIFFERENCE >= minDepth;
}

/** Whether a summary display (LiveSummary, ProjectSummary) should show a
 * shallow→deep depth range instead of a single depth. The single source of
 * truth for this decision -- both call sites previously carried their own
 * copy of this exact condition, which meant Geometry Pass B's rectangle
 * -only -> rectangle-or-L-shape widening had to be remembered and applied
 * twice. Mirrors `buildFloorProfile`'s own eligibility rule (rectangle or
 * L-shape, in-ground, real slope data) rather than re-deriving it. */
export function isSlopedFloorDisplay(
  shape: PoolShapeId,
  poolType: PoolType | null,
  dimensions: Pick<Dimensions, "floorProfile" | "shallowDepth" | "depth">,
): boolean {
  return (
    (shape === "rectangle" || shape === "l-shape") &&
    poolType === "in-ground" &&
    dimensions.floorProfile === "slope" &&
    Number.isFinite(dimensions.shallowDepth) &&
    dimensions.shallowDepth! < dimensions.depth
  );
}

/** Clamp a requested shallow depth into the range that keeps the slope real:
 * never below the absolute minimum pool depth, never within
 * `MIN_SLOPE_DIFFERENCE` of the deep depth. */
export function clampShallowDepth(shallowDepth: number, depth: number, minDepth: number): number {
  const maxAllowed = depth - MIN_SLOPE_DIFFERENCE;
  if (!Number.isFinite(shallowDepth)) return Math.max(minDepth, Math.min(maxAllowed, depth * 0.8));
  return Math.min(maxAllowed, Math.max(minDepth, shallowDepth));
}

/** A sensible initial shallow depth when the customer first switches to
 * "Fondo in pendenza" -- not a blind constant, derived from and clamped to
 * the pool's own deep depth. ~20% shallower than the deep end reads as a
 * real, moderate slope across the whole supported depth range. */
export function suggestShallowDepth(depth: number, minDepth: number): number {
  return clampShallowDepth(depth * 0.8, depth, minDepth);
}

export interface FloorProfileModel {
  /** False for flat, for any shape other than rectangle, or for above-ground
   * pools -- every one of those renders and measures exactly as before. */
  readonly sloped: boolean;
  /** World Y of the deep (or, when flat, the only) floor -- identical to
   * `PoolVerticalLayout.floorY`. */
  readonly deepFloorY: number;
  /** World Y of the shallow floor. Equal to `deepFloorY` when flat. */
  readonly shallowFloorY: number;
  /** `shallowFloorY - deepFloorY`, always >= 0; 0 when flat. */
  readonly elevationDrop: number;
  /** Which world axis the slope runs along -- always the outline's longer
   * span (the "principal longitudinal axis"), matching the convention
   * `skimmerWall()` already uses; not assumed to be X just because the
   * dimension is labelled "length". */
  readonly axis: "x" | "z";
  /** True when the shallow end is at the outline's minimum coordinate along
   * `axis`. */
  readonly shallowAtMin: boolean;
  readonly axisMin: number;
  readonly axisMax: number;
  /** Centre point of the shallow-end wall, world XZ. */
  readonly shallowPoint: readonly [number, number];
  /** Centre point of the deep-end wall, world XZ. */
  readonly deepPoint: readonly [number, number];
  /** World floor Y at a given world (x, z). Flat: returns `deepFloorY`
   * everywhere. */
  floorYAt(x: number, z: number): number;
  /** Local water-column depth (`waterY - floorYAt(x, z)`) at a given point. */
  depthAt(x: number, z: number, waterY: number): number;
}

function flatModel(deepFloorY: number): FloorProfileModel {
  return {
    sloped: false,
    deepFloorY,
    shallowFloorY: deepFloorY,
    elevationDrop: 0,
    axis: "x",
    shallowAtMin: true,
    axisMin: 0,
    axisMax: 0,
    shallowPoint: [0, 0],
    deepPoint: [0, 0],
    floorYAt: () => deepFloorY,
    depthAt: (_x, _z, waterY) => waterY - deepFloorY,
  };
}

export function buildFloorProfile(params: {
  outline: Outline;
  shape: PoolShapeId;
  poolType: PoolType;
  dimensions: Dimensions;
  verticalLayout: PoolVerticalLayout;
}): FloorProfileModel {
  const { outline, shape, poolType, dimensions, verticalLayout } = params;
  const deepFloorY = verticalLayout.floorY;
  // Everything below this point is already shape-agnostic -- it only reads
  // the outline's own bounds (outlineBounds) and works out a single planar
  // ramp along whichever axis is longer, so an L-shape gets exactly the
  // "one planar slope across the whole basin, along its principal
  // longitudinal axis" the L-shape spec calls for with no extra formula of
  // its own. Custom (arbitrary-polygon) shapes are excluded: they have no
  // single deterministic principal axis a customer would recognise.
  const eligible =
    dimensions.floorProfile === "slope" &&
    (shape === "rectangle" || shape === "l-shape") &&
    poolType === "in-ground" &&
    Number.isFinite(dimensions.shallowDepth) &&
    outline.length >= 4;
  if (!eligible) return flatModel(deepFloorY);

  const { minX, maxX, minZ, maxZ, spanX, spanZ } = outlineBounds(outline);
  const axis: "x" | "z" = spanX >= spanZ ? "x" : "z";
  const axisMin = axis === "x" ? minX : minZ;
  const axisMax = axis === "x" ? maxX : maxZ;
  const span = axisMax - axisMin;
  if (!Number.isFinite(axisMin) || !Number.isFinite(axisMax) || span < 1e-6) {
    return flatModel(deepFloorY);
  }

  const depth = Math.max(0.01, dimensions.depth);
  // Re-derive with the same safety clamp `getPoolVerticalLayout` itself
  // applies -- a value that slipped past UI/persistence normalisation must
  // still never produce an inverted or zero-difference slope here.
  const shallowDepth = clampShallowDepth(
    Number.isFinite(dimensions.shallowDepth) ? dimensions.shallowDepth! : depth,
    depth,
    0.01,
  );
  const shallowFloorY = GROUND_LEVEL - shallowDepth;
  const elevationDrop = shallowFloorY - deepFloorY;
  if (!(elevationDrop > 0)) return flatModel(deepFloorY);

  const shallowAtMin = !dimensions.slopeReversed;
  const centreOfOtherAxis =
    outline.reduce((sum, point) => sum + (axis === "x" ? point[1] : point[0]), 0) / outline.length;

  const floorYAt = (x: number, z: number): number => {
    const coordinate = axis === "x" ? x : z;
    const t = Math.min(1, Math.max(0, (coordinate - axisMin) / span));
    const shallowFraction = shallowAtMin ? 1 - t : t;
    return deepFloorY + shallowFraction * elevationDrop;
  };
  const pointAt = (coordinate: number): readonly [number, number] =>
    axis === "x" ? [coordinate, centreOfOtherAxis] : [centreOfOtherAxis, coordinate];

  return {
    sloped: true,
    deepFloorY,
    shallowFloorY,
    elevationDrop,
    axis,
    shallowAtMin,
    axisMin,
    axisMax,
    shallowPoint: pointAt(shallowAtMin ? axisMin : axisMax),
    deepPoint: pointAt(shallowAtMin ? axisMax : axisMin),
    floorYAt,
    depthAt: (x, z, waterY) => waterY - floorYAt(x, z),
  };
}

/**
 * Real, closed-form metrics for a sloped rectangular basin -- exact, not
 * sampled/integrated, because a single-axis linear ramp under a horizontal
 * water plane and horizontal-width side walls is exactly the ruled ramp
 * surface + trapezoidal-prism volume these formulas describe.
 *
 * `computeMetrics` (geometry.ts) remains the flat/shape-generic path; this is
 * the slope-aware sibling, called only when `profile.sloped` is true.
 */
export function computeSlopeMetrics(
  outline: Outline,
  profile: FloorProfileModel,
  waterY: number,
  wallTopY: number,
): PoolMetrics {
  const runLength = profile.axisMax - profile.axisMin;
  const waterSurface = outlineArea(outline);
  const crossWidth = waterSurface / Math.max(1e-6, runLength);
  const perimeter = outlinePerimeter(outline);

  // Ruled surface: a rectangle tilted about its cross axis has exactly the
  // same cross width and a hypotenuse run of sqrt(runLength^2 + drop^2).
  const floorSurface = crossWidth * Math.hypot(runLength, profile.elevationDrop);

  // Trapezoidal cross-section (constant width) integrated along the length:
  // exactly the footprint area times the average of the two end depths.
  const shallowDepthColumn = waterY - profile.shallowFloorY;
  const deepDepthColumn = waterY - profile.deepFloorY;
  const waterVolume = waterSurface * (shallowDepthColumn + deepDepthColumn) * 0.5;

  // Two end walls (each the plan width tall) + two side walls whose height
  // varies linearly end to end -- their area is exactly width x average
  // height, so the whole perimeter collapses to perimeter/2 x (h1 + h2).
  const shallowWallHeight = wallTopY - profile.shallowFloorY;
  const deepWallHeight = wallTopY - profile.deepFloorY;
  const wallSurface = (perimeter / 2) * (shallowWallHeight + deepWallHeight);

  return {
    waterVolume,
    waterSurface,
    floorSurface,
    wallSurface,
    internalSurface: floorSurface + wallSurface,
    perimeter,
  };
}
