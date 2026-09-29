/**
 * Single source of truth for floor-profile geometry (Geometry Pass A: flat vs
 * sloped floor). Every consumer that needs a floor elevation, a local water
 * depth, or the slope-aware metrics formulas -- rendering, metrics, stairs,
 * lighting, water, measurements -- reads it from here, never re-derives its
 * own copy.
 *
 * Scope: slope is offered for a rectangular, L-shaped or Organic, in-ground
 * pool (Geometry Pass B extends the rectangle-only Pass A scope to the L;
 * Geometry Pass C extends it again to Organic). All three have a real,
 * deterministic principal axis -- the outline's own longer bounding-box
 * span, exactly the rule `skimmerWall()` (walls.ts) already uses to decide
 * which wall the skimmer run sits on, so "the principal axis" means the same
 * thing everywhere it is asked: here, for the slope; in walls.ts, for the
 * skimmer/ladder run; and in lighting.ts (via `skimmerWall`), for which wall
 * the LED row faces. Custom (arbitrary-polygon) shapes have no single
 * deterministic "principal axis" to slope along without guessing, and
 * above-ground pools are shipped as constant-height modular kits, so both
 * are kept flat regardless of `dimensions.floorProfile` -- `buildFloorProfile`
 * normalises that itself rather than trusting every call site to remember
 * the restriction.
 */
import { GROUND_LEVEL } from "./vertical-layout";
import { outlineArea, outlineBounds, outlineCentroid, outlinePerimeter } from "./geometry";
import type { PoolVerticalLayout } from "./vertical-layout";
import type { Dimensions, Outline, PoolMetrics, PoolShapeId, PoolType } from "./types";
import { infinityExclusion, type InfinityEdgeParams } from "./infinity-edge";

/** Shared shelf/flight dimensions; metres, not a pool-size-specific offset. */
export function shelfStairDimensions(span: number, topY: number, floorY: number) {
  const tread = 0.3;
  const shelfRun = Math.min(2.2, Math.max(1.2, span * 0.2), span - 2.4);
  for (let rises = 2; rises <= 16; rises++) {
    const riser = (topY - floorY) / rises;
    const run = (rises - 1) * tread;
    const totalRun = Math.max(shelfRun, run + 1.5 * tread);
    if (riser >= 0.15 && riser <= 0.24 && totalRun + 2.4 <= span)
      return { rises, riser, run, totalRun, tread };
  }
  return null;
}

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
    (shape === "rectangle" || shape === "l-shape" || shape === "organic") &&
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
  readonly shelfZone?: { end: number; slopeStart: number; atMin: boolean; flight: NonNullable<ReturnType<typeof shelfStairDimensions>> };
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
  sunShelf?: boolean;
  infinityEdge?: InfinityEdgeParams | null | undefined;
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
    (shape === "rectangle" || shape === "l-shape" || shape === "organic") &&
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

  let shallowAtMin = !dimensions.slopeReversed;
  const exclusion = params.infinityEdge ? infinityExclusion(outline, params.infinityEdge, shape) : null;
  if (params.sunShelf && exclusion?.axis === axis)
    shallowAtMin = Math.abs(exclusion.coordinate - axisMax) < 0.08;
  const flight = params.sunShelf && shape === "rectangle" && Math.min(spanX, spanZ) >= 2.4
    ? shelfStairDimensions(span, verticalLayout.waterY - 0.22, shallowFloorY) : null;
  const end = (shallowAtMin ? axisMin : axisMax) + (shallowAtMin ? 1 : -1) * (flight?.totalRun ?? 0);
  // One tread-sized level landing AFTER the final riser; the ramp starts here.
  const slopeStart = end + (shallowAtMin ? 1 : -1) * (flight?.tread ?? 0);
  const shelfZone = flight ? { end, slopeStart, atMin: shallowAtMin, flight } : undefined;
  const centreOfOtherAxis =
    outline.reduce((sum, point) => sum + (axis === "x" ? point[1] : point[0]), 0) / outline.length;

  const floorYAt = (x: number, z: number): number => {
    const coordinate = axis === "x" ? x : z;
    const rampMin = shelfZone && shallowAtMin ? slopeStart : axisMin;
    const rampMax = shelfZone && !shallowAtMin ? slopeStart : axisMax;
    const t = Math.min(1, Math.max(0, (coordinate - rampMin) / (rampMax - rampMin)));
    const shallowFraction = shallowAtMin ? 1 - t : t;
    return deepFloorY + shallowFraction * elevationDrop;
  };
  const pointAt = (coordinate: number): readonly [number, number] =>
    axis === "x" ? [coordinate, centreOfOtherAxis] : [centreOfOtherAxis, coordinate];

  return {
    sloped: true,
    ...(shelfZone ? { shelfZone } : {}),
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
 * Real, exact metrics for a sloped basin of ANY outline -- rectangle,
 * L-shape or Organic alike -- not sampled/integrated at a fixed resolution,
 * because a single-axis linear ramp (`floorYAt` is an affine function of
 * whichever coordinate the slope runs along) admits closed-form integrals
 * over the true sampled polygon:
 *
 * - Floor surface: a planar ramp tilted only along `profile.axis` scales
 *   every plan-area element by the SAME factor `hypot(run, drop) / run`
 *   regardless of how the cross-width varies along the run (a rectangle's
 *   constant width, an L-shape's notch, or an Organic curve's varying
 *   waist are all fine) -- so `floorSurface = planArea * hypot(run, drop) /
 *   run` is exact, not an approximation, for any of them.
 * - Water volume: for any affine function f, the integral of f over a
 *   region equals f(centroid) * area -- a real identity, not a numerical
 *   shortcut. `floorYAt` is affine in the run coordinate, so the exact
 *   volume is `planArea * (waterY - floorYAt(centroid))`. This is the part
 *   the previous rectangle-only formula got wrong for a non-constant cross-
 *   width basin: it used the average of the two END depths, which is only
 *   the same as the centroid-weighted depth when the cross-width is
 *   constant along the run (true for a rectangle, false for an L-shape or
 *   Organic curve where more area sits toward one end).
 * - Wall surface: each straight outline edge has a wall whose height is
 *   also affine along that edge (a straight line between two points of an
 *   affine function), so edge_area = edge_length * average(height at the
 *   two endpoints), exactly -- summed over every real outline edge (not
 *   just two "end walls"), which is what makes this correct for an
 *   arbitrary polygon perimeter instead of only a two-long-wall rectangle.
 *
 * `computeMetrics` (geometry.ts) remains the flat/shape-generic path; this is
 * the slope-aware sibling, called only when `profile.sloped` is true. A
 * metric-convergence test (geometry-audit.ts) builds the Organic outline at
 * increasing sample resolutions and checks these values stabilise, since
 * this formula is exact FOR THE SAMPLED POLYGON -- it converges to the true
 * curved-basin values as the polygon approximates the curve more closely.
 */
export function computeSlopeMetrics(
  outline: Outline,
  profile: FloorProfileModel,
  waterY: number,
  wallTopY: number,
): PoolMetrics {
  if (profile.shelfZone) {
    const pieces = splitFloorOutline(outline, profile.axis, profile.shelfZone.slopeStart);
    const metrics = pieces.map(piece => {
      const area = outlineArea(piece);
      const [x, z] = outlineCentroid(piece);
      const levels = piece.map(([px,pz]) => profile.floorYAt(px,pz));
      const coords = piece.map(p => p[profile.axis === "x" ? 0 : 1]);
      const run = Math.max(...coords) - Math.min(...coords);
      return { area, volume: area * (waterY - profile.floorYAt(x,z)),
        surface: area * Math.hypot(run, Math.max(...levels)-Math.min(...levels)) / run };
    });
    const boundary = subdivideFloorBoundary(outline, profile);
    const wallSurface = boundary.reduce((sum,a,i) => {
      const b=boundary[(i+1)%boundary.length]!;
      return sum + Math.hypot(b[0]-a[0],b[1]-a[1]) *
        (wallTopY-(profile.floorYAt(...a)+profile.floorYAt(...b))/2);
    },0);
    const floorSurface=metrics.reduce((sum,m)=>sum+m.surface,0);
    return { waterSurface:outlineArea(outline), waterVolume:metrics.reduce((sum,m)=>sum+m.volume,0),
      floorSurface, wallSurface, internalSurface:floorSurface+wallSurface, perimeter:outlinePerimeter(outline) };
  }
  const waterSurface = outlineArea(outline);
  const perimeter = outlinePerimeter(outline);
  const runLength = Math.max(1e-6, profile.axisMax - profile.axisMin);

  // Ruled floor surface: exact regardless of cross-width variation (see
  // module docs above) -- one scale factor applied to the true plan area.
  const floorSurface = waterSurface * (Math.hypot(runLength, profile.elevationDrop) / runLength);

  // Exact volume via the affine-integral identity: f(centroid) * area.
  const [centroidX, centroidZ] = outlineCentroid(outline);
  const centroidFloorY = profile.floorYAt(centroidX, centroidZ);
  const waterVolume = waterSurface * (waterY - centroidFloorY);

  // Exact wall surface: sum every real edge's length x its average height
  // (both endpoints' local floor elevation), not just two end walls.
  let wallSurface = 0;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const edgeLength = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const heightA = wallTopY - profile.floorYAt(a[0], a[1]);
    const heightB = wallTopY - profile.floorYAt(b[0], b[1]);
    wallSurface += edgeLength * ((heightA + heightB) / 2);
  }

  return {
    waterVolume,
    waterSurface,
    floorSurface,
    wallSurface,
    internalSurface: floorSurface + wallSurface,
    perimeter,
  };
}

/** Clip at the actual profile hinge, so no triangle bridges two floor planes. */
export function splitFloorOutline(outline: Outline, axis: "x"|"z", cut: number): Outline[] {
  const k=axis==="x"?0:1;
  return [-1,1].map(sign => {
    const result: [number,number][]=[];
    outline.forEach((a,i)=>{
      const b=outline[(i+1)%outline.length]!;
      if(sign*(a[k]-cut)>=-1e-9) result.push([a[0],a[1]]);
      if((a[k]-cut)*(b[k]-cut)<-1e-12) {
        const t=(cut-a[k])/(b[k]-a[k]);
        result.push([a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])]);
      }
    });
    return result;
  }).filter(piece=>piece.length>=3);
}

export function subdivideFloorBoundary(outline: Outline, profile: FloorProfileModel): Outline {
  if(!profile.shelfZone) return outline;
  const cut=profile.shelfZone.slopeStart, k=profile.axis==="x"?0:1;
  return outline.flatMap((a,i)=>{
    const b=outline[(i+1)%outline.length]!;
    if((a[k]-cut)*(b[k]-cut)>=-1e-12) return [a];
    const t=(cut-a[k])/(b[k]-a[k]);
    return [a,[a[0]+t*(b[0]-a[0]),a[1]+t*(b[1]-a[1])] as [number,number]];
  });
}
