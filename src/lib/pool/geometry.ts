import type { ControlPoint, Dimensions, Outline, PoolMetrics, PoolShapeId } from "./types";
import { CURVE_SAMPLES } from "./config";

/**
 * Normalised outline generators. Every generator returns points inside the
 * [-0.5, 0.5] unit square so that scaling by length/width keeps the geometry
 * perfectly proportional for any dimension combination.
 */
const unitRectangle = (): Outline => [
  [-0.5, -0.5],
  [0.5, -0.5],
  [0.5, 0.5],
  [-0.5, 0.5],
];

/**
 * Corner-cutting subdivision converges to a smooth C1 closed curve and stays
 * inside the control polygon, avoiding the overshoot of interpolating splines.
 */
function smoothClosedPolygon(points: ReadonlyArray<ControlPoint>): Outline {
  let current: Outline = points;
  while (current.length < CURVE_SAMPLES) {
    const next: Array<readonly [number, number]> = [];
    for (let index = 0; index < current.length; index++) {
      const a = current[index]!;
      const b = current[(index + 1) % current.length]!;
      next.push(
        [a[0] * 0.75 + b[0] * 0.25, a[1] * 0.75 + b[1] * 0.25],
        [a[0] * 0.25 + b[0] * 0.75, a[1] * 0.25 + b[1] * 0.75],
      );
    }
    current = next;
  }
  return normalise(current);
}

/** Smooth closed curve constrained by the user's valid control polygon. */
export const unitFromControlPoints = (
  controlPoints: ReadonlyArray<ControlPoint>,
  _tension = 0.5,
): Outline => {
  if (!isValidControlPolygon(controlPoints)) return unitRectangle();
  return smoothClosedPolygon(controlPoints);
};

const orientation = (a: ControlPoint, b: ControlPoint, c: ControlPoint) =>
  (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);

function segmentsIntersect(a: ControlPoint, b: ControlPoint, c: ControlPoint, d: ControlPoint) {
  const epsilon = 1e-8;
  const abC = orientation(a, b, c);
  const abD = orientation(a, b, d);
  const cdA = orientation(c, d, a);
  const cdB = orientation(c, d, b);
  const onSegment = (start: ControlPoint, end: ControlPoint, point: ControlPoint) =>
    point[0] >= Math.min(start[0], end[0]) - epsilon &&
    point[0] <= Math.max(start[0], end[0]) + epsilon &&
    point[1] >= Math.min(start[1], end[1]) - epsilon &&
    point[1] <= Math.max(start[1], end[1]) + epsilon;
  if (abC * abD < -epsilon && cdA * cdB < -epsilon) return true;
  return (
    (Math.abs(abC) <= epsilon && onSegment(a, b, c)) ||
    (Math.abs(abD) <= epsilon && onSegment(a, b, d)) ||
    (Math.abs(cdA) <= epsilon && onSegment(c, d, a)) ||
    (Math.abs(cdB) <= epsilon && onSegment(c, d, b))
  );
}

export function isValidControlPolygon(points: ReadonlyArray<ControlPoint>): boolean {
  if (points.length < 3 || points.some(([x, y]) => !Number.isFinite(x) || !Number.isFinite(y))) {
    return false;
  }
  if (outlineArea(points) < 0.02) return false;
  for (let i = 0; i < points.length; i++) {
    const a = points[i]!;
    const b = points[(i + 1) % points.length]!;
    if (Math.hypot(b[0] - a[0], b[1] - a[1]) < 0.035) return false;
    for (let j = i + 1; j < points.length; j++) {
      if (j === i || j === i + 1 || (i === 0 && j === points.length - 1)) continue;
      if (segmentsIntersect(a, b, points[j]!, points[(j + 1) % points.length]!)) return false;
    }
  }
  return true;
}

export function constrainControlPoint(
  points: ReadonlyArray<ControlPoint>,
  index: number,
  requested: ControlPoint,
): ControlPoint {
  const previous = points[index];
  if (!previous) return requested;
  const candidate = points.map((point, pointIndex) => (pointIndex === index ? requested : point));
  if (isValidControlPolygon(candidate)) return requested;
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 16; iteration++) {
    const amount = (low + high) / 2;
    const trial: ControlPoint = [
      previous[0] + (requested[0] - previous[0]) * amount,
      previous[1] + (requested[1] - previous[1]) * amount,
    ];
    const trialPoints = points.map((point, pointIndex) => (pointIndex === index ? trial : point));
    if (isValidControlPolygon(trialPoints)) low = amount;
    else high = amount;
  }
  return [
    previous[0] + (requested[0] - previous[0]) * low,
    previous[1] + (requested[1] - previous[1]) * low,
  ];
}

/** Rescale any point cloud so its bounding box is exactly the unit square. */
function normalise(points: ReadonlyArray<readonly [number, number]>): Outline {
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (const [x, y] of points) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minY = Math.min(minY, y);
    maxY = Math.max(maxY, y);
  }
  const spanX = maxX - minX || 1;
  const spanY = maxY - minY || 1;
  const cx = (minX + maxX) / 2;
  const cy = (minY + maxY) / 2;
  return points.map(([x, y]) => [(x - cx) / spanX, (y - cy) / spanY] as const);
}

/** Build the real-world outline (metres) for a shape + dimensions pair. */
export function buildOutline(
  shape: PoolShapeId,
  dimensions: Dimensions,
  controlPoints: ReadonlyArray<ControlPoint>,
): Outline {
  const unit = shape === "rectangle" ? unitRectangle() : unitFromControlPoints(controlPoints);
  const length = Number.isFinite(dimensions.length) ? Math.max(0.01, dimensions.length) : 1;
  const width = Number.isFinite(dimensions.width) ? Math.max(0.01, dimensions.width) : 1;
  return unit.map(([x, y]) => [x * length, y * width] as const);
}

/** Signed-area (shoelace) magnitude in square metres. */
export function outlineArea(outline: Outline): number {
  let sum = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, y1] = outline[i]!;
    const [x2, y2] = outline[(i + 1) % outline.length]!;
    sum += x1 * y2 - x2 * y1;
  }
  return Math.abs(sum) / 2;
}

export function outlinePerimeter(outline: Outline): number {
  let total = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, y1] = outline[i]!;
    const [x2, y2] = outline[(i + 1) % outline.length]!;
    total += Math.hypot(x2 - x1, y2 - y1);
  }
  return total;
}

export function outlineBounds(outline: Outline) {
  let minX = Infinity;
  let maxX = -Infinity;
  let minZ = Infinity;
  let maxZ = -Infinity;
  for (const [x, z] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  return { minX, maxX, minZ, maxZ, spanX: maxX - minX, spanZ: maxZ - minZ };
}

/**
 * Expand an outline outwards by roughly `distance` metres. Uses per-axis
 * scaling from the centroid, which preserves valid concave silhouettes.
 */
export function offsetOutline(outline: Outline, distance: number): Outline {
  const { minX, maxX, minZ, maxZ, spanX, spanZ } = outlineBounds(outline);
  const cx = (minX + maxX) / 2;
  const cz = (minZ + maxZ) / 2;
  const sx = (spanX + distance * 2) / (spanX || 1);
  const sz = (spanZ + distance * 2) / (spanZ || 1);
  return outline.map(([x, z]) => [cx + (x - cx) * sx, cz + (z - cz) * sz] as const);
}

/** Interpolated point at a normalised distance (0..1) along the outline. */
export function pointAtPerimeter(outline: Outline, t: number): readonly [number, number] {
  const total = outlinePerimeter(outline);
  let target = (((t % 1) + 1) % 1) * total;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!;
    const b = outline[(i + 1) % outline.length]!;
    const seg = Math.hypot(b[0] - a[0], b[1] - a[1]);
    if (target <= seg) {
      const k = seg === 0 ? 0 : target / seg;
      return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k];
    }
    target -= seg;
  }
  return outline[0]!;
}

/** All derived quantities for the current basin. */
export function computeMetrics(outline: Outline, depth: number): PoolMetrics {
  const safeDepth = Number.isFinite(depth) ? Math.max(0, depth) : 0;
  const floorSurface = outlineArea(outline);
  const perimeter = outlinePerimeter(outline);
  const wallSurface = perimeter * safeDepth;
  return {
    floorSurface,
    waterSurface: floorSurface,
    perimeter,
    wallSurface,
    internalSurface: floorSurface + wallSurface,
    waterVolume: floorSurface * safeDepth,
  };
}
