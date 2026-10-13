import type { Outline } from "./types";
import { skimmerWall } from "./walls.ts";
import {
  boundaryRuns,
  sampleWall,
  signedWaterArea,
  pointInBasin,
  type WallRun,
} from "./boundary-placement.ts";
import type { InfinityExclusion } from "./walls.ts";

/** Per-vertex convex/reflex classification, generic over any simple,
 * consistently-wound polygon. Deliberately a local copy of the identical
 * check in `l-shape.ts` (`classifyOutlineCorners`), not an import of it:
 * `l-shape.ts` sits in a bundler-only circular import chain with
 * `geometry.ts`/`config.ts` (fine under Vite/rolldown, unresolvable by
 * Node's native ESM loader), and this module must stay loadable directly by
 * `test-pool-lighting.mjs`. Winding-aware: works for either CW or CCW input. */
function hasReflexCorner(outline: Outline): boolean {
  if (outline.length < 4) return false;
  let signedAreaSum = 0;
  for (let i = 0; i < outline.length; i++) {
    const [x1, z1] = outline[i]!;
    const [x2, z2] = outline[(i + 1) % outline.length]!;
    signedAreaSum += x1 * z2 - x2 * z1;
  }
  const ccw = signedAreaSum >= 0;
  return outline.some((point, i) => {
    const previous = outline[(i - 1 + outline.length) % outline.length]!;
    const next = outline[(i + 1) % outline.length]!;
    const inX = point[0] - previous[0];
    const inZ = point[1] - previous[1];
    const outX = next[0] - point[0];
    const outZ = next[1] - point[1];
    const cross = inX * outZ - inZ * outX;
    return ccw ? cross < -1e-9 : cross > 1e-9;
  });
}

/**
 * Merge consecutive outline edges into longer "logical" wall chords while
 * every point between the chord's endpoints stays within `tolerance` of the
 * straight line between them. For a rectangle/L-shape outline (only ever a
 * handful of true corner vertices) this is a no-op -- the very first
 * candidate chord already deviates past `tolerance` at the next real corner,
 * so the result is byte-identical to the raw per-vertex edges every existing
 * lighting test asserts against. For a densely-sampled curve outline (the
 * Organic shape, ~15-25cm point spacing) it collapses the low-curvature runs
 * of the curve into real, placeable candidate walls instead of leaving every
 * edge a few centimetres long and unconditionally rejected by the
 * `cornerClearance`-based length filter below -- exactly the "arc-length
 * distribution along candidate curve segments instead of assuming straight
 * polygon walls" the Organic shape needs, without a parallel
 * Organic-specific formula: the merged chord's own endpoints are always real
 * outline vertices, so every downstream containment/exclusion check still
 * runs against the true curve, only the candidate wall's tangent/normal is
 * approximated locally.
 */
export function mergedWallChords(
  outline: Outline,
  tolerance = 0.06,
): ReadonlyArray<{ a: readonly [number, number]; b: readonly [number, number]; length: number }> {
  const n = outline.length;
  if (n < 3) return [];
  const pointLineDistance = (
    p: readonly [number, number],
    a: readonly [number, number],
    b: readonly [number, number],
  ) => {
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const lengthSquared = dx * dx + dz * dz;
    if (lengthSquared < 1e-12) return Math.hypot(p[0] - a[0], p[1] - a[1]);
    const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / lengthSquared));
    return Math.hypot(p[0] - (a[0] + dx * t), p[1] - (a[1] + dz * t));
  };
  const chords: Array<{
    a: readonly [number, number];
    b: readonly [number, number];
    length: number;
  }> = [];
  let startIndex = 0;
  let consumed = 0;
  while (consumed < n) {
    let bestSteps = 1;
    for (let steps = 2; steps <= n - consumed; steps++) {
      const endIndex = (startIndex + steps) % n;
      const start = outline[startIndex]!;
      const end = outline[endIndex]!;
      let withinTolerance = true;
      for (let k = 1; k < steps; k++) {
        const point = outline[(startIndex + k) % n]!;
        if (pointLineDistance(point, start, end) > tolerance) {
          withinTolerance = false;
          break;
        }
      }
      if (!withinTolerance) break;
      bestSteps = steps;
    }
    const endIndex = (startIndex + bestSteps) % n;
    const a = outline[startIndex]!;
    const b = outline[endIndex]!;
    chords.push({ a, b, length: Math.hypot(b[0] - a[0], b[1] - a[1]) });
    startIndex = endIndex;
    consumed += bestSteps;
  }
  return chords;
}

/** Lighting DESIGN defaults, not a statutory light count or a compliance check. */
export const POOL_LIGHTING_DESIGN = {
  targetIlluminance: 45,
  utilization: 0.65,
  maintenance: 0.85,
  referenceDepth: 1.5,
  depthAllowance: 0.2,
  maxSpacing: 4,
  minCount: 2,
  maxRenderedCount: 8,
  submergence: 0.6,
  floorClearance: 0.2,
  cornerClearance: 0.6,
  fixtureRadius: 0.08,
} as const;

export const POOL_LUMINAIRE = {
  diameter: POOL_LIGHTING_DESIGN.fixtureRadius * 2,
  // Generic preview product, not a certified or selected commercial SKU.
  lumens: 1500,
  trim: "steel" as "steel" | "white",
  installation: "fixed-immersed",
  requiredIngressProtection: "IP68; verify declared continuous-immersion conditions",
  supplyAssumption: "12 V AC SELV; transformer and installation to be designed separately",
  certification: "Pool-use certification and installation instructions must be verified",
  complianceVerified: false,
  // Reference for product-class assumptions, not an endorsement of this generic model:
  // https://www.astralpool.com/en/en/pool-lighting/led-lighting/lumiplus-essential/par56-lamps.html
  // https://webstore.iec.ch/en/publication/90423 (IEC 60598-2-18:2022 test report scope)
} as const;

export type LightingExclusion =
  | { kind: "skimmer" | "inlet"; x: number; z: number; radius: number }
  | { kind: "access"; polygon: Outline; clearance: number };

export interface PoolLightPosition {
  x: number;
  y: number;
  z: number;
  rotation: number;
  throwDistance: number;
}
export interface PoolLightingPlan {
  count: number;
  requestedCount: number;
  surfaceArea: number;
  coveragePerFixture: number;
  submergence: number;
  positions: PoolLightPosition[];
  warnings: string[];
}

export function insideLightingOutline(x: number, z: number, outline: Outline): boolean {
  let inside = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!,
      b = outline[j]!;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside;
  }
  return inside;
}

function segmentDistance(x: number, z: number, a: readonly number[], b: readonly number[]) {
  const dx = b[0]! - a[0]!,
    dz = b[1]! - a[1]!;
  const t = Math.max(
    0,
    Math.min(1, ((x - a[0]!) * dx + (z - a[1]!) * dz) / (dx * dx + dz * dz || 1)),
  );
  return Math.hypot(x - a[0]! - dx * t, z - a[1]! - dz * t);
}

export function clearsLightingExclusions(
  x: number,
  z: number,
  exclusions: readonly LightingExclusion[],
  radius: number = POOL_LIGHTING_DESIGN.fixtureRadius,
): boolean {
  return exclusions.every((exclusion) => {
    if (exclusion.kind !== "access")
      return Math.hypot(x - exclusion.x, z - exclusion.z) > exclusion.radius + radius;
    if (insideLightingOutline(x, z, exclusion.polygon)) return false;
    return exclusion.polygon.every(
      (a, i) =>
        segmentDistance(x, z, a, exclusion.polygon[(i + 1) % exclusion.polygon.length]!) >
        exclusion.clearance + radius,
    );
  });
}

/** One symmetric row on a clear long wall. Never force a fixture into an obstacle. */
export function planPoolLighting({
  outline,
  waterY,
  floorY,
  floorYAt = () => floorY,
  lumenOutput = POOL_LUMINAIRE.lumens,
  exclusions = [],
  design = POOL_LIGHTING_DESIGN,
  infinityExcluded = null,
}: {
  outline: Outline;
  waterY: number;
  floorY: number;
  floorYAt?: (x: number, z: number) => number;
  lumenOutput?: number;
  exclusions?: readonly LightingExclusion[];
  design?: { [K in keyof typeof POOL_LIGHTING_DESIGN]: number };
  infinityExcluded?: InfinityExclusion | null;
}): PoolLightingPlan {
  const area = Math.abs(signedWaterArea(outline));
  const depthFactor =
    1 + design.depthAllowance * Math.max(0, waterY - floorY - design.referenceDepth);
  // Provisional generic 1500 lm simulation, NOT the LumiPlus Flexi 2750 lm.
  // Lumen method assumptions: 45 lx, utilisation .65, maintenance .85.
  const coveragePerFixture =
    (lumenOutput * design.utilization * design.maintenance) /
    (design.targetIlluminance * depthFactor);
  const requestedCount =
    Number.isFinite(area / coveragePerFixture) && coveragePerFixture > 0
      ? Math.ceil(area / coveragePerFixture)
      : 0;
  const result: PoolLightingPlan = {
    count: 0,
    requestedCount,
    surfaceArea: area,
    submergence: design.submergence,
    coveragePerFixture,
    positions: [],
    warnings: [],
  };
  if (
    outline.length < 3 ||
    !outline.every((p) => p.every(Number.isFinite)) ||
    !Number.isFinite(waterY) ||
    !Number.isFinite(floorY) ||
    requestedCount < 1
  ) {
    result.warnings.push("Invalid pool or provisional luminaire data");
    return result;
  }
  const count = Math.min(requestedCount, design.maxRenderedCount);
  if (count < requestedCount)
    result.warnings.push("Preview fixture budget reached; specialist layout required");
  const skimmers = skimmerWall(outline, infinityExcluded);
  const axis = skimmers.axis === "x" ? 0 : 1;
  const runs = boundaryRuns(outline, infinityExcluded)
    .filter((r) => r.length > 2 * design.cornerClearance)
    .sort(
      (a, b) =>
        b.length - a.length ||
        Math.abs(b.points[0]![axis] - skimmers.coordinate) -
          Math.abs(a.points[0]![axis] - skimmers.coordinate),
    );
  const fixture = (run: WallRun, station: number): PoolLightPosition | null => {
    const p = sampleWall(run, station);
    if (!clearsLightingExclusions(p.x, p.z, exclusions, design.fixtureRadius)) return null;
    if (
      ![-design.fixtureRadius, 0, design.fixtureRadius].every((t) =>
        pointInBasin(p.x + p.nx * 0.06 + p.tx * t, p.z + p.nz * 0.06 + p.tz * t, outline),
      )
    )
      return null;
    const localFloor = Math.max(
      ...[-design.fixtureRadius, 0, design.fixtureRadius].map((t) =>
        floorYAt(p.x + p.nx * 0.04 + p.tx * t, p.z + p.nz * 0.04 + p.tz * t),
      ),
    );
    const immersion = Math.min(
      design.submergence,
      waterY - localFloor - design.floorClearance - design.fixtureRadius,
    );
    if (immersion < design.fixtureRadius + 0.08) return null;
    let throwDistance = 0.1;
    while (
      throwDistance < 40 &&
      pointInBasin(p.x + p.nx * (throwDistance + 0.1), p.z + p.nz * (throwDistance + 0.1), outline)
    )
      throwDistance += 0.1;
    if (throwDistance < 0.6) return null;
    return {
      x: p.x,
      z: p.z,
      y: waterY - immersion,
      rotation: Math.atan2(p.nx, p.nz),
      throwDistance,
    };
  };
  const row = (run: WallRun, n: number): PoolLightPosition[] | null => {
    if (!n) return [];
    for (const contraction of [1, 0.9, 0.8, 0.7]) {
      const span =
        Math.min((run.length * (n - 1)) / n, run.length - 2 * design.cornerClearance) * contraction;
      if (n > 1 && span / (n - 1) < 2 * design.fixtureRadius + 0.35) continue;
      const points = Array.from({ length: n }, (_, i) =>
        fixture(run, run.length / 2 + (n === 1 ? 0 : span * (i / (n - 1) - 0.5))),
      );
      if (points.every((p) => p !== null)) return points as PoolLightPosition[];
    }
    // Allocate across available wall stations, not a centred row with missing
    // fixtures. Sampling is configuration-time only, at a conservative 5 cm.
    const stations: PoolLightPosition[] = [];
    for (let s = design.cornerClearance; s <= run.length - design.cornerClearance; s += 0.05) {
      const p = fixture(run, s);
      if (p) stations.push(p);
    }
    if (stations.length >= n) {
      const points = Array.from({length:n}, (_,i) => stations[Math.min(stations.length-1,
        Math.floor(stations.length*(i+0.5)/n))]!);
      if (points.every((p,i) => points.slice(0,i).every(q =>
        Math.hypot(p.x-q.x,p.z-q.z) >= 2*design.fixtureRadius+0.35))) return points;
    }
    return null;
  };
  for (const primary of runs) {
    if (hasReflexCorner(outline) && count > 1) {
      const centre = sampleWall(primary, primary.length / 2);
      // Allocate the SAME total between separated wall zones; never append extra LEDs.
      const alternatives = runs
        .filter((r) => r !== primary)
        .sort((a, b) => {
          const pa = sampleWall(a, a.length / 2),
            pb = sampleWall(b, b.length / 2);
          return (
            Math.hypot(pb.x - centre.x, pb.z - centre.z) -
            Math.hypot(pa.x - centre.x, pa.z - centre.z)
          );
        });
      for (const secondary of alternatives) {
        const secondaryCount = Math.max(
          1,
          Math.min(
            count - 1,
            Math.round((count * secondary.length) / (primary.length + secondary.length)),
          ),
        );
        const a = row(primary, count - secondaryCount),
          b = row(secondary, secondaryCount);
        if (a && b && a.every((p) => b.every((q) => Math.hypot(p.x - q.x, p.z - q.z) > 0.8))) {
          result.positions = [...a, ...b];
          result.count = result.positions.length;
          return result;
        }
      }
    }
    const points = row(primary, count);
    if (points) {
      result.positions = points;
      result.count = points.length;
      return result;
    }
  }
  // Obstructed/curved basins: fill available real-boundary stations without shrinking fittings.
  for (const run of runs) {
    const slots = Math.max(1, Math.floor((run.length - 2 * design.cornerClearance) / 1.2) + 1);
    for (let i = 0; i < slots && result.positions.length < count; i++) {
      const p = fixture(run, (run.length * (i + 0.5)) / slots);
      if (p && result.positions.every((q) => Math.hypot(p.x - q.x, p.z - q.z) >= 1.2))
        result.positions.push(p);
    }
  }
  result.count = result.positions.length;
  if (result.count < count)
    result.warnings.push("Insufficient collision-free wall length; specialist layout required");
  return result;
}
