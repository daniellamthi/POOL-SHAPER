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
import { outlineArea, outlineBounds, outlinePerimeter } from "./geometry";

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
 * makes self-intersection impossible by construction. */
const MAX_DIP_FRACTION = 0.34;
const MAX_BULGE_FRACTION = 0.12;
const DIP_ANGULAR_WIDTH = 0.62;
const BULGE_ANGULAR_WIDTH = 0.9;

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
  // 1 - MAX_DIP_FRACTION (0.66) is the worst case; never near zero.
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
        segmentsIntersect(outline[first]!, outline[firstNext]!, outline[second]!, outline[secondNext]!)
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

  // Binary-search curvature down (never up) until the resulting outline's
  // real area clears the guardrail floor. At curvature 0 the outline is a
  // pure ellipse of area pi * (length/2) * (width/2), which for the smallest
  // allowed length/width (4 x 3) is already ~9.4 m^2 -- comfortably above
  // `minArea` (4 m^2) -- so this loop only ever has real work to do if the
  // guardrail constants themselves are tightened later; it is a genuine
  // safety net, not a no-op.
  let low = 0;
  let high = requestedCurvature;
  const probe = (curvature: number) =>
    outlineArea(sampleAtCount({ length, width, curvature, mirror }, 48));
  if (probe(high) < ORGANIC_SHAPE_GUARDRAILS.minArea) {
    for (let iteration = 0; iteration < 20; iteration++) {
      const mid = (low + high) / 2;
      if (probe(mid) >= ORGANIC_SHAPE_GUARDRAILS.minArea) low = mid;
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
  if (validation.valid) return outline;
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
