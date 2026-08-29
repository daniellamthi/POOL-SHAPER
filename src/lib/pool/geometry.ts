import type {
  ControlPoint,
  Dimensions,
  Outline,
  OverflowType,
  PoolMetrics,
  PoolShapeId,
  SystemType,
} from "./types";
import { COPING_WIDTH, CURVE_SAMPLES, OVERFLOW_GEOMETRY } from "./config";

export const POOL_SHAPE_GUARDRAILS = {
  minimumPreferredRadius: 0.9,
  minimumHardRadius: 0.75,
  minimumNeckWidth: 1.5,
  dragSamples: 256,
  finalSamples: 256,
} as const;

export interface PoolShapeValidation {
  valid: boolean;
  selfIntersection: boolean;
  minimumRadius: number;
  minimumNeckWidth: number;
  copingOffsetValid: boolean;
  polygonValid: boolean;
  reason?: string;
}

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
  dimensions: Dimensions,
): ControlPoint {
  return constrainControlPoints(points, index, requested, dimensions)[index] ?? requested;
}

/**
 * Clamp a drag to the closest constructible shape. Immediate neighbours move
 * by a small fraction of the same delta, keeping the edit local and smooth.
 */
export function constrainControlPoints(
  points: ReadonlyArray<ControlPoint>,
  index: number,
  requested: ControlPoint,
  dimensions: Dimensions,
): ReadonlyArray<ControlPoint> {
  const previous = points[index];
  if (!previous) return points;
  const delta: ControlPoint = [requested[0] - previous[0], requested[1] - previous[1]];
  const neighbourInfluence = 0.1;
  const candidate = points.map((point, pointIndex) => {
    if (pointIndex === index) return requested;
    const cyclicDistance = Math.min(
      Math.abs(pointIndex - index),
      points.length - Math.abs(pointIndex - index),
    );
    return cyclicDistance === 1
      ? ([
          point[0] + delta[0] * neighbourInfluence,
          point[1] + delta[1] * neighbourInfluence,
        ] as const)
      : point;
  });
  if (validatePoolShape(buildOutline("custom", dimensions, candidate), candidate).valid) {
    return candidate;
  }
  let low = 0;
  let high = 1;
  for (let iteration = 0; iteration < 16; iteration++) {
    const amount = (low + high) / 2;
    const trialPoints = points.map((point, pointIndex) => {
      if (pointIndex === index) {
        return [previous[0] + delta[0] * amount, previous[1] + delta[1] * amount] as const;
      }
      const cyclicDistance = Math.min(
        Math.abs(pointIndex - index),
        points.length - Math.abs(pointIndex - index),
      );
      return cyclicDistance === 1
        ? ([
            point[0] + delta[0] * neighbourInfluence * amount,
            point[1] + delta[1] * neighbourInfluence * amount,
          ] as const)
        : point;
    });
    if (validatePoolShape(buildOutline("custom", dimensions, trialPoints), trialPoints).valid) {
      low = amount;
    } else high = amount;
  }
  return points.map((point, pointIndex) => {
    if (pointIndex === index) {
      return [previous[0] + delta[0] * low, previous[1] + delta[1] * low] as const;
    }
    const cyclicDistance = Math.min(
      Math.abs(pointIndex - index),
      points.length - Math.abs(pointIndex - index),
    );
    return cyclicDistance === 1
      ? ([
          point[0] + delta[0] * neighbourInfluence * low,
          point[1] + delta[1] * neighbourInfluence * low,
        ] as const)
      : point;
  });
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

const signedArea = (outline: Outline) => {
  let sum = 0;
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!;
    const b = outline[(index + 1) % outline.length]!;
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum / 2;
};

const cross2 = (a: ControlPoint, b: ControlPoint) => a[0] * b[1] - a[1] * b[0];

function lineIntersection(
  firstPoint: ControlPoint,
  firstDirection: ControlPoint,
  secondPoint: ControlPoint,
  secondDirection: ControlPoint,
): ControlPoint | null {
  const denominator = cross2(firstDirection, secondDirection);
  if (Math.abs(denominator) < 1e-9) return null;
  const delta: ControlPoint = [secondPoint[0] - firstPoint[0], secondPoint[1] - firstPoint[1]];
  const amount = cross2(delta, secondDirection) / denominator;
  return [firstPoint[0] + firstDirection[0] * amount, firstPoint[1] + firstDirection[1] * amount];
}

function segmentIntersectionPoint(
  a: ControlPoint,
  b: ControlPoint,
  c: ControlPoint,
  d: ControlPoint,
): ControlPoint | null {
  const firstDirection: ControlPoint = [b[0] - a[0], b[1] - a[1]];
  const secondDirection: ControlPoint = [d[0] - c[0], d[1] - c[1]];
  const denominator = cross2(firstDirection, secondDirection);
  if (Math.abs(denominator) < 1e-9) return null;
  const delta: ControlPoint = [c[0] - a[0], c[1] - a[1]];
  const firstAmount = cross2(delta, secondDirection) / denominator;
  const secondAmount = cross2(delta, firstDirection) / denominator;
  const epsilon = 1e-7;
  if (
    firstAmount <= epsilon ||
    firstAmount >= 1 - epsilon ||
    secondAmount <= epsilon ||
    secondAmount >= 1 - epsilon
  ) {
    return null;
  }
  return [a[0] + firstDirection[0] * firstAmount, a[1] + firstDirection[1] * firstAmount];
}

/** Remove loops created when an outward offset closes a narrow concavity. */
function removeOffsetLoops(points: Outline): Outline {
  let cleaned: Outline = [...points];
  for (let pass = 0; pass < points.length && cleaned.length >= 3; pass++) {
    let repaired = false;
    for (let first = 0; first < cleaned.length && !repaired; first++) {
      const firstNext = (first + 1) % cleaned.length;
      for (let second = first + 2; second < cleaned.length; second++) {
        const secondNext = (second + 1) % cleaned.length;
        if (first === secondNext || firstNext === second) continue;
        const intersection = segmentIntersectionPoint(
          cleaned[first]!,
          cleaned[firstNext]!,
          cleaned[second]!,
          cleaned[secondNext]!,
        );
        if (!intersection) continue;
        const firstCandidate: Outline = [
          ...cleaned.slice(0, first + 1),
          intersection,
          ...cleaned.slice(second + 1),
        ];
        const secondCandidate: Outline = [intersection, ...cleaned.slice(first + 1, second + 1)];
        cleaned =
          outlineArea(firstCandidate) >= outlineArea(secondCandidate)
            ? firstCandidate
            : secondCandidate;
        repaired = true;
        break;
      }
    }
    if (!repaired) break;
  }
  return cleaned;
}

/**
 * Offset a closed outline by an exact world-space distance in metres. Each
 * edge is translated along its outward unit normal and adjacent translated
 * lines are intersected, so concave shapes retain a constant-width coping.
 */
export function offsetOutline(outline: Outline, distance: number): Outline {
  const result = rawOffsetOutline(outline, distance);
  const cleaned = removeOffsetLoops(result);
  return signedArea(cleaned) * signedArea(outline) < 0 ? [...cleaned].reverse() : cleaned;
}

/** One authoritative horizontal water footprint for each hydraulic system. */
export function buildWaterOutline(
  outline: Outline,
  system: SystemType,
  overflowType: OverflowType,
): Outline {
  if (system === "skimmer") return outline;
  const offset =
    overflowType === "visible"
      ? OVERFLOW_GEOMETRY.waterEdgeOffset + OVERFLOW_GEOMETRY.visibleWaterFilmWidth
      : OVERFLOW_GEOMETRY.hiddenChannelOffset - OVERFLOW_GEOMETRY.hiddenWaterChannelClearance;
  return offsetOutline(outline, offset);
}

function rawOffsetOutline(outline: Outline, distance: number): Outline {
  if (outline.length < 3 || Math.abs(distance) < 1e-12) return [...outline];
  const winding = signedArea(outline) >= 0 ? 1 : -1;
  const result: ControlPoint[] = [];

  for (let index = 0; index < outline.length; index++) {
    const previous = outline[(index - 1 + outline.length) % outline.length]!;
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    const previousDelta: ControlPoint = [current[0] - previous[0], current[1] - previous[1]];
    const nextDelta: ControlPoint = [next[0] - current[0], next[1] - current[1]];
    const previousLength = Math.hypot(...previousDelta);
    const nextLength = Math.hypot(...nextDelta);
    if (previousLength < 1e-9 || nextLength < 1e-9) continue;
    const previousDirection: ControlPoint = [
      previousDelta[0] / previousLength,
      previousDelta[1] / previousLength,
    ];
    const nextDirection: ControlPoint = [nextDelta[0] / nextLength, nextDelta[1] / nextLength];
    const previousNormal: ControlPoint = [
      winding * previousDirection[1],
      -winding * previousDirection[0],
    ];
    const nextNormal: ControlPoint = [winding * nextDirection[1], -winding * nextDirection[0]];
    const previousShifted: ControlPoint = [
      current[0] + previousNormal[0] * distance,
      current[1] + previousNormal[1] * distance,
    ];
    const nextShifted: ControlPoint = [
      current[0] + nextNormal[0] * distance,
      current[1] + nextNormal[1] * distance,
    ];
    const intersection = lineIntersection(
      previousShifted,
      previousDirection,
      nextShifted,
      nextDirection,
    );
    if (intersection && intersection.every(Number.isFinite)) result.push(intersection);
    else {
      const averageNormal: ControlPoint = [
        previousNormal[0] + nextNormal[0],
        previousNormal[1] + nextNormal[1],
      ];
      const normalLength = Math.hypot(...averageNormal) || 1;
      result.push([
        current[0] + (averageNormal[0] / normalLength) * distance,
        current[1] + (averageNormal[1] / normalLength) * distance,
      ]);
    }
  }

  return signedArea(result) * signedArea(outline) < 0 ? [...result].reverse() : result;
}

function outlineHasSelfIntersections(outline: Outline): boolean {
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

function pointSegmentDistance(point: ControlPoint, start: ControlPoint, end: ControlPoint): number {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const lengthSquared = dx * dx + dy * dy;
  const amount =
    lengthSquared === 0
      ? 0
      : Math.max(
          0,
          Math.min(1, ((point[0] - start[0]) * dx + (point[1] - start[1]) * dy) / lengthSquared),
        );
  return Math.hypot(point[0] - start[0] - dx * amount, point[1] - start[1] - dy * amount);
}

function segmentDistance(a: ControlPoint, b: ControlPoint, c: ControlPoint, d: ControlPoint) {
  if (segmentsIntersect(a, b, c, d)) return 0;
  return Math.min(
    pointSegmentDistance(a, c, d),
    pointSegmentDistance(b, c, d),
    pointSegmentDistance(c, a, b),
    pointSegmentDistance(d, a, b),
  );
}

function minimumCurvatureRadius(outline: Outline): number {
  let minimum = Infinity;
  for (let index = 0; index < outline.length; index++) {
    const previous = outline[(index - 1 + outline.length) % outline.length]!;
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    const first = Math.hypot(current[0] - previous[0], current[1] - previous[1]);
    const second = Math.hypot(next[0] - current[0], next[1] - current[1]);
    const opposite = Math.hypot(next[0] - previous[0], next[1] - previous[1]);
    const twiceArea = Math.abs(orientation(previous, current, next));
    if (twiceArea > 1e-9)
      minimum = Math.min(minimum, (first * second * opposite) / (2 * twiceArea));
  }
  return minimum;
}

function minimumNonAdjacentDistance(outline: Outline): number {
  let minimum = Infinity;
  // Portions closer than 18% of the closed perimeter belong to the same local
  // bend and must not be mistaken for opposing sides of a narrow neck.
  const adjacencyWindow = Math.max(6, Math.ceil(outline.length * 0.18));
  for (let first = 0; first < outline.length; first++) {
    const firstNext = (first + 1) % outline.length;
    for (let second = first + 1; second < outline.length; second++) {
      const cyclicDistance = Math.min(second - first, outline.length - (second - first));
      if (cyclicDistance <= adjacencyWindow) continue;
      minimum = Math.min(
        minimum,
        segmentDistance(
          outline[first]!,
          outline[firstNext]!,
          outline[second]!,
          outline[(second + 1) % outline.length]!,
        ),
      );
    }
  }
  return minimum;
}

function contoursIntersect(first: Outline, second: Outline): boolean {
  for (let firstIndex = 0; firstIndex < first.length; firstIndex++) {
    for (let secondIndex = 0; secondIndex < second.length; secondIndex++) {
      if (
        segmentsIntersect(
          first[firstIndex]!,
          first[(firstIndex + 1) % first.length]!,
          second[secondIndex]!,
          second[(secondIndex + 1) % second.length]!,
        )
      ) {
        return true;
      }
    }
  }
  return false;
}

/** Single source of truth for deciding whether a custom pool is constructible. */
export function validatePoolShape(
  outline: Outline,
  controlPoints?: ReadonlyArray<ControlPoint>,
): PoolShapeValidation {
  const polygonValid =
    (controlPoints === undefined || isValidControlPolygon(controlPoints)) &&
    outline.length >= 4 &&
    outline.every(([x, y]) => Number.isFinite(x) && Number.isFinite(y)) &&
    outlineArea(outline) > 0.5;
  const selfIntersection = !polygonValid || outlineHasSelfIntersections(outline);
  const minimumRadius = polygonValid ? minimumCurvatureRadius(outline) : 0;
  const minimumNeckWidth = polygonValid ? minimumNonAdjacentDistance(outline) : 0;
  const rawCoping = polygonValid ? rawOffsetOutline(outline, COPING_WIDTH) : [];
  const copingOffsetValid =
    polygonValid &&
    rawCoping.length >= 4 &&
    !outlineHasSelfIntersections(rawCoping) &&
    !contoursIntersect(outline, rawCoping) &&
    outlineArea(rawCoping) > outlineArea(outline) &&
    rawCoping.every((point) =>
      outline.some(
        (start, index) =>
          Math.abs(
            pointSegmentDistance(point, start, outline[(index + 1) % outline.length]!) -
              COPING_WIDTH,
          ) < 0.025,
      ),
    );
  const reason = !polygonValid
    ? "polygon"
    : selfIntersection
      ? "self-intersection"
      : minimumRadius < POOL_SHAPE_GUARDRAILS.minimumHardRadius
        ? "curvature"
        : minimumNeckWidth < POOL_SHAPE_GUARDRAILS.minimumNeckWidth
          ? "neck-width"
          : !copingOffsetValid
            ? "coping-offset"
            : undefined;
  const validation: PoolShapeValidation = {
    valid: reason === undefined,
    selfIntersection,
    minimumRadius,
    minimumNeckWidth,
    copingOffsetValid,
    polygonValid,
  };
  return reason ? { ...validation, reason } : validation;
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
