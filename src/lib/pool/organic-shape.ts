/**
 * Canonical Organic (kidney / freeform) shape domain model (Geometry Pass C).
 * Mirrors the architecture `l-shape.ts` established for the L-shape: a single
 * source of truth for the outline and its safety guardrails, consumed by
 * every generic outline-driven subsystem (geometry.ts, walls.ts,
 * floor-profile.ts, camera.ts, lighting.ts) exactly the way any other shape
 * is, never a parallel formula duplicated elsewhere.
 *
 * This is deliberately NOT the generic "Custom" draw-your-own-polygon
 * workflow: there are no editable control points a customer drags. It is a
 * genuine procedural shape with three customer-facing controls -- overall
 * length, overall width, and a single 0..1 "character" (how pronounced the
 * organic bay/waist is) plus a mirror flag for which side the bay sits on.
 *
 * Construction: a smooth, deterministic, closed polar curve
 *
 *   r(theta) = 1 - dip(theta) + bulge(theta)
 *
 * around an ellipse with semi-axes length/2 (X) and width/2 (Z) -- a Gaussian
 * "dip" carves the concave bay on one side (the kidney's waist) and a smaller
 * compensating "bulge" fills out the opposite side, the way a real kidney
 * silhouette reads: one pinched flank, one fuller one. No randomness/noise is
 * ever used -- the same params always produce the exact same outline.
 *
 * Because it is a strictly polar function of theta with r(theta) > 0
 * everywhere (enforced by the guardrails below), the resulting outline is
 * *always* a simple (non-self-intersecting), star-shaped-about-the-centroid
 * closed curve by construction -- self-intersection is checked anyway
 * (`outlineSelfIntersects`) as a defensive, real safety net, not decoration.
 */
import type { Outline } from "./types";
import { offsetOutline, outlineArea, outlineBounds, outlinePerimeter } from "./geometry";

export interface OrganicShapeParams {
  /** Overall bounding span along X, metres. */
  length: number;
  /** Overall bounding span along Z, metres. */
  width: number;
  /** 0 = a smooth ellipse (no organic character), 1 = the most pronounced
   * kidney waist the guardrails allow. */
  curvature: number;
  /** Flips which side (±Z) the organic bay sits on. */
  mirror: boolean;
}

export const ORGANIC_SHAPE_GUARDRAILS = {
  length: { min: 4, max: 20 },
  width: { min: 3, max: 14 },
  curvature: { min: 0, max: 1 },
  /** Target arc-length spacing between sampled points, metres -- the "15-25cm
   * resolution" the outline is sampled at. */
  targetResolution: 0.2,
  /** Never sample so sparsely the curve reads as faceted. */
  minPoints: 28,
  /** Hard cap so a very large organic pool never produces an unbounded point
   * count for downstream geometry (offsetOutline, createSurfaceGeometry). */
  maxPoints: 160,
  /** Below this, the basin reads as degenerate regardless of length/width. */
  minArea: 4,
} as const;

function clampNumber(value: number, min: number, max: number, fallback: number): number {
  if (!Number.isFinite(value)) return fallback;
  return Math.min(max, Math.max(min, value));
}

function angularDelta(a: number, b: number): number {
  let d = (a - b) % (Math.PI * 2);
  if (d > Math.PI) d -= Math.PI * 2;
  if (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/** Bay depth / opposite-side fullness as fractions of the base radius, at
 * curvature === 1. Kept well inside (0, 1) so `radiusAt` can never reach or
 * cross zero for any curvature in [0, 1] -- the structural guarantee that
 * makes self-intersection impossible by construction.
 *
 * These were originally 0.34 / 0.12 with wide (0.62 / 0.9 rad) Gaussians --
 * mathematically a real dip, but so shallow and so spread out relative to
 * the base ellipse that it rendered as visually indistinguishable from a
 * plain oval at both the default curvature (0.5) and near the max (0.95):
 * area only moved ~2% across the whole range, and a symmetric bulge that
 * grew in lockstep with the dip actively clawed most of that area back at
 * high curvature.
 *
 * A first pass over-corrected to a very narrow (0.35 rad), very deep (72%)
 * Gaussian: visually dramatic, but its local radius of curvature at the
 * bottom of the bay got tight enough that `offsetOutline` (geometry.ts),
 * used for every real outward offset a customer actually sees (coping,
 * hidden/visible overflow channels -- up to ~0.425 m outward), would
 * self-intersect and get pruned by `removeOffsetLoops`, throwing
 * `createCopingSlabGeometry`'s "Mismatched coping outlines" guard. Widened
 * back out (still much deeper/narrower than the original) to a combination
 * verified, by direct probe against the real `offsetOutline`, to never
 * shrink the point count for any real outward offset up to 0.45 m across
 * the full guardrail range of length/width/curvature/mirror -- see the
 * `copingSafeAtOffset` guardrail below, which also catches the rare
 * remaining extreme-aspect-ratio edge case by shrinking curvature exactly
 * the way the area-floor guardrail already does. At curvature=1 the bay
 * still cuts the local radius by 55% (a dramatic waist); the safety
 * boundary only constrains the CONCAVE (dip) side -- an outward offset of a
 * convex bulge never self-intersects -- so the opposite side's bulge is
 * free to be both narrower and deeper (25%) than the dip's own angular
 * width without touching coping-safety at all. That asymmetry (a wide,
 * gentle waist against a narrower, fuller far side) is what makes the
 * silhouette actually read as a kidney/bean rather than a lopsided oval:
 * verified visually (Playwright screenshots at curvature 0.5 and 1) as well
 * as by the area-divergence and bay/opposite-side notch-depth assertions
 * below. 1 - MAX_DIP_FRACTION (0.45) is `radiusAt`'s own worst case --
 * still comfortably clear of zero. */
const MAX_DIP_FRACTION = 0.55;
const MAX_BULGE_FRACTION = 0.25;
const DIP_ANGULAR_WIDTH = 1.3;
const BULGE_ANGULAR_WIDTH = 0.8;

/** The largest real outward offset any consumer of an organic outline ever
 * applies -- see `copingOuterOffset` (poolConstruction.ts: 0.32 m skimmer,
 * 0.32 + `OVERFLOW_GEOMETRY.hiddenChannelOffset` (0.105 m) = 0.425 m hidden
 * overflow) and `OVERFLOW_GEOMETRY.visibleChannelOuterOffset` (0.355 m) --
 * rounded up for margin. Used only by the `copingSafeAtOffset` guardrail
 * below; not itself a rendering constant. */
const MAX_REAL_OUTWARD_OFFSET = 0.45;

function radiusAt(theta: number, curvature: number, mirror: boolean): number {
  const bayCentre = mirror ? -Math.PI / 2 : Math.PI / 2;
  const dipDelta = angularDelta(theta, bayCentre);
  const dip =
    MAX_DIP_FRACTION *
    curvature *
    Math.exp(-(dipDelta * dipDelta) / (2 * DIP_ANGULAR_WIDTH * DIP_ANGULAR_WIDTH));
  const bulgeDelta = angularDelta(theta, bayCentre + Math.PI);
  const bulge =
    MAX_BULGE_FRACTION *
    curvature *
    Math.exp(-(bulgeDelta * bulgeDelta) / (2 * BULGE_ANGULAR_WIDTH * BULGE_ANGULAR_WIDTH));
  // 1 - MAX_DIP_FRACTION (0.45) is the worst case; never near zero.
  return 1 - dip + bulge;
}

/**
 * Sample the same deterministic polar curve at an explicit point count,
 * bypassing `buildOrganicShapeOutline`'s own adaptive arc-length resolution.
 * Exported only for the metric-convergence test (geometry-audit.ts), which
 * needs to sample the exact same curve at several different resolutions to
 * prove `computeSlopeMetrics` (floor-profile.ts) is a real integral over the
 * sampled polygon -- not a length x width shortcut that would stay flat
 * regardless of resolution. `params` must already be
 * `clampOrganicShapeParams`-normalised, same contract as every other
 * function in this module.
 */
export function sampleOrganicOutlineAtCount(params: OrganicShapeParams, count: number): Outline {
  return sampleAtCount(params, count);
}

function sampleAtCount(params: OrganicShapeParams, count: number): Outline {
  const rx = params.length / 2;
  const rz = params.width / 2;
  const points: Array<readonly [number, number]> = [];
  for (let i = 0; i < count; i++) {
    const theta = (i / count) * Math.PI * 2;
    const r = radiusAt(theta, params.curvature, params.mirror);
    points.push([Math.cos(theta) * rx * r, Math.sin(theta) * rz * r]);
  }
  return points;
}

/** Local, dependency-free segment-intersection test -- deliberately not
 * imported from geometry.ts's internal (unexported) equivalent, mirroring
 * why `lighting.ts` keeps its own local copy of `l-shape.ts`'s corner test:
 * this module must stay safe to reach from either the bundler graph or a
 * Node-native script without relying on internals another module doesn't
 * export. */
function orientation2(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
): number {
  return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
}

function segmentsIntersect(
  a: readonly [number, number],
  b: readonly [number, number],
  c: readonly [number, number],
  d: readonly [number, number],
): boolean {
  const epsilon = 1e-9;
  const abC = orientation2(a, b, c);
  const abD = orientation2(a, b, d);
  const cdA = orientation2(c, d, a);
  const cdB = orientation2(c, d, b);
  return abC * abD < -epsilon && cdA * cdB < -epsilon;
}

/** True if the outline is not a simple polygon. Real, exercised safety net
 * (see module docs) -- not merely decorative -- called by
 * `buildOrganicShapeOutline` on every build, and independently by the audit
 * scripts. Only checks non-adjacent edge pairs, same convention as
 * geometry.ts's own equivalent. */
export function outlineSelfIntersects(outline: Outline): boolean {
  for (let first = 0; first < outline.length; first++) {
    const firstNext = (first + 1) % outline.length;
    for (let second = first + 2; second < outline.length; second++) {
      const secondNext = (second + 1) % outline.length;
      if (first === secondNext || firstNext === second) continue;
      if (
        segmentsIntersect(
          outline[first]!,
          outline[firstNext]!,
          outline[second]!,
          outline[secondNext]!,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/** CCW-positive shoelace winding check -- true when the outline winds the
 * same way `unitRectangle()`/`buildLShapeOutline()` already do (geometry.ts),
 * so every generic outline consumer sees one consistent convention. */
export function outlineWindsCcw(outline: Outline): boolean {
  let sum = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, z1] = outline[i]!;
    const [x2, z2] = outline[(i + 1) % outline.length]!;
    sum += x1 * z2 - x2 * z1;
  }
  return sum >= 0;
}

export interface OrganicOutlineValidation {
  valid: boolean;
  selfIntersecting: boolean;
  ccw: boolean;
  area: number;
}

export function validateOrganicOutline(outline: Outline): OrganicOutlineValidation {
  const selfIntersecting = outlineSelfIntersects(outline);
  const ccw = outlineWindsCcw(outline);
  const area = outlineArea(outline);
  return {
    valid: !selfIntersecting && ccw && area >= ORGANIC_SHAPE_GUARDRAILS.minArea,
    selfIntersecting,
    ccw,
    area,
  };
}

/**
 * Normalise arbitrary (possibly partial, out-of-range, or NaN) input into
 * safe organic-shape params, mirroring `clampLShapeDimensions`'s contract:
 * every other function in this module assumes its input already passed
 * through here. Curvature is additionally reduced (never increased) if the
 * requested value would leave the basin below the minimum real area for the
 * requested length/width -- the same "shrink until safe" guardrail spirit
 * `clampLShapeDimensions` uses for its recess.
 */
export function clampOrganicShapeParams(
  input: { [K in keyof OrganicShapeParams]?: OrganicShapeParams[K] | undefined } | undefined,
): OrganicShapeParams {
  const length = clampNumber(
    input?.length ?? 10,
    ORGANIC_SHAPE_GUARDRAILS.length.min,
    ORGANIC_SHAPE_GUARDRAILS.length.max,
    10,
  );
  const width = clampNumber(
    input?.width ?? 6,
    ORGANIC_SHAPE_GUARDRAILS.width.min,
    ORGANIC_SHAPE_GUARDRAILS.width.max,
    6,
  );
  const requestedCurvature = clampNumber(
    input?.curvature ?? 0.5,
    ORGANIC_SHAPE_GUARDRAILS.curvature.min,
    ORGANIC_SHAPE_GUARDRAILS.curvature.max,
    0.5,
  );
  const mirror = input?.mirror === true;

  // Binary-search curvature down (never up) until the resulting outline is
  // safe on BOTH counts: (a) real area clears the guardrail floor, and (b)
  // every real outward offset a customer's pool actually gets (coping,
  // overflow channels -- see `MAX_REAL_OUTWARD_OFFSET`) stays a simple
  // polygon with the same point count, never triggering `offsetOutline`'s
  // self-intersection cleanup (`removeOffsetLoops`), which would otherwise
  // reach `createCopingSlabGeometry`'s "Mismatched coping outlines" guard.
  // At curvature 0 the outline is a pure ellipse of area
  // pi * (length/2) * (width/2), which for the smallest allowed length/width
  // (4 x 3) is already ~9.4 m^2 -- comfortably above `minArea` (4 m^2) -- and
  // a plain ellipse's offset never self-intersects, so this loop only ever
  // has real work to do for a genuinely tight combination of length, width,
  // curvature and offset; it is a real safety net, not a no-op (verified: it
  // engages for the smallest allowed length paired with the largest allowed
  // width at curvature 1).
  const copingSafeAtOffset = (outline: Outline) => {
    const offset = offsetOutline(outline, MAX_REAL_OUTWARD_OFFSET);
    return offset.length === outline.length;
  };
  let low = 0;
  let high = requestedCurvature;
  const probe = (curvature: number) => {
    const outline = sampleAtCount({ length, width, curvature, mirror }, 128);
    return outlineArea(outline) >= ORGANIC_SHAPE_GUARDRAILS.minArea && copingSafeAtOffset(outline);
  };
  if (!probe(high)) {
    for (let iteration = 0; iteration < 20; iteration++) {
      const mid = (low + high) / 2;
      if (probe(mid)) low = mid;
      else high = mid;
    }
    return { length, width, curvature: low, mirror };
  }
  return { length, width, curvature: requestedCurvature, mirror };
}

/**
 * The real-world (metre), CCW-wound outline: a deterministic, bounded-length
 * sample of the smooth closed curve described in the module docs. Params
 * must already be `clampOrganicShapeParams`-normalised; this function
 * defensively re-derives a safe curvature via `validateOrganicOutline`
 * anyway (falling back toward a plain ellipse, never throwing and never
 * producing a self-intersecting or degenerate outline) so a caller that
 * skipped normalisation can still never reach broken geometry downstream.
 */
export function buildOrganicShapeOutline(params: OrganicShapeParams): Outline {
  const safe = clampOrganicShapeParams(params);
  const coarse = sampleAtCount(safe, 128);
  const perimeter = outlinePerimeter(coarse);
  const targetCount = Math.min(
    ORGANIC_SHAPE_GUARDRAILS.maxPoints,
    Math.max(
      ORGANIC_SHAPE_GUARDRAILS.minPoints,
      Math.round(perimeter / ORGANIC_SHAPE_GUARDRAILS.targetResolution),
    ),
  );
  const outline = sampleAtCount(safe, targetCount);
  const validation = validateOrganicOutline(outline);
  // `clampOrganicShapeParams` already verified coping-safety at a fixed
  // 128-point sample; re-check it here too at the outline's own adaptive
  // `targetCount` (28-160, arc-length driven), since that can differ from
  // 128 and a mismatch would otherwise only surface downstream as
  // `createCopingSlabGeometry`'s "Mismatched coping outlines" throw.
  const offset = offsetOutline(outline, MAX_REAL_OUTWARD_OFFSET);
  const copingSafe = offset.length === outline.length;
  if (validation.valid && copingSafe) return outline;
  // Structurally should be unreachable (see module docs), but never trust a
  // curve into downstream geometry without checking: fall back to the
  // provably-safe curvature-0 ellipse at the same length/width.
  return sampleAtCount({ ...safe, curvature: 0 }, targetCount);
}

export interface OrganicShapeOutlineInfo {
  outline: Outline;
  area: number;
  perimeter: number;
  centroid: readonly [number, number];
  bounds: ReturnType<typeof outlineBounds>;
}

export function buildOrganicShapeOutlineInfo(params: OrganicShapeParams): OrganicShapeOutlineInfo {
  const outline = buildOrganicShapeOutline(params);
  const centroid = outline.reduce(
    (sum, [x, z]) => [sum[0] + x / outline.length, sum[1] + z / outline.length] as const,
    [0, 0] as readonly [number, number],
  );
  return {
    outline,
    area: outlineArea(outline),
    perimeter: outlinePerimeter(outline),
    centroid,
    bounds: outlineBounds(outline),
  };
}
