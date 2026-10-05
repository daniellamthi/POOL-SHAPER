import { StainlessSteelMaterial } from "./StainlessSteelMaterial";
import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import type { InternalStairType, Outline, PoolAccess } from "@/lib/pool/types";
import { skimmerWall } from "@/lib/pool/walls.ts";
import type { InfinityExclusion } from "@/lib/pool/walls.ts";
import { mergedWallChords } from "@/lib/pool/lighting";
import type { FloorProfileModel } from "@/lib/pool/floor-profile";
import { clearOfInfinityEdge, oppositeInfinityCoordinate } from "@/lib/pool/infinity-access";

/** Metres. Internal design criteria, not certified regulatory limits. */
export const ACCESS_DIMENSIONS = {
  maxRise: 0.25,
  minRise: 0.15,
  tread: 0.3,
  minWidth: 0.8,
  maxWidth: 1.15,
  cornerFirstRadius: 0.45,
  landingTolerance: 0.005,
  landingClearance: 0.3,
  fittingClearance: 0.32,
  ladderPitch: 0.28,
  ladderFloorClearance: 0.18,
  ladderMaxTreads: 5,
  ladderWidth: 0.5,
  ladderRun: 0.55,
  ladderTubeRadius: 0.021,
  ladderFootDrop: 0.1,
  ladderFootPad: 0.035,
} as const;
type AccessPosition = { x: number; z: number; rotation: number };

/** Real wall intersections for the two lower ladder returns, in local coordinates. */
export function ladderWallContacts(outline: Outline, placement: AccessPosition) {
  const c = Math.cos(placement.rotation),
    s = Math.sin(placement.rotation);
  const local = outline.map(
    ([x, z]) =>
      [
        c * (x - placement.x) - s * (z - placement.z),
        s * (x - placement.x) + c * (z - placement.z),
      ] as const,
  );
  return [-ACCESS_DIMENSIONS.ladderWidth / 2, ACCESS_DIMENSIONS.ladderWidth / 2].map((x) => {
    const hits = local.flatMap((a, i) => {
      const b = local[(i + 1) % local.length]!;
      if (Math.abs(b[0] - a[0]) < 1e-8) return [];
      const t = (x - a[0]) / (b[0] - a[0]);
      if (t < 0 || t > 1) return [];
      const z = a[1] + t * (b[1] - a[1]);
      return z <= 0.05 ? [z] : [];
    });
    return { x, z: hits.length ? Math.max(...hits) : NaN };
  });
}

/** Same SL-style return as the reference, with a monotone lower bend. */
export function ladderRailCurve(anchorOffset: number, lastDepth: number, wallZ: number) {
  const bottomY = -lastDepth - ACCESS_DIMENSIONS.ladderFootDrop;
  const path = new THREE.CurvePath<THREE.Vector3>();
  path.add(
    new THREE.CatmullRomCurve3(
      [
        new THREE.Vector3(0, 0, -anchorOffset),
        new THREE.Vector3(0, 0.62, -anchorOffset),
        new THREE.Vector3(0, 0.76, 0),
        new THREE.Vector3(0, 0.62, 0.26),
        new THREE.Vector3(0, 0.12, 0.32),
        new THREE.Vector3(0, -lastDepth, 0.32),
      ],
      false,
      "centripetal",
    ),
  );
  path.add(
    new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, -lastDepth, 0.32),
      new THREE.Vector3(0, bottomY, 0.32),
      new THREE.Vector3(0, bottomY, 0.22),
    ),
  );
  path.add(
    new THREE.LineCurve3(
      new THREE.Vector3(0, bottomY, 0.22),
      new THREE.Vector3(0, bottomY, wallZ + ACCESS_DIMENSIONS.ladderFootPad),
    ),
  );
  return path;
}

/**
 * Select a wall with enough clear interior space for the entire access
 * footprint, then place the access on it the way that access type is actually
 * installed:
 *
 * - Internal steps are entered from a SHORT wall and pushed hard into the
 *   corner, so one flank of the flight lands against the long wall the way a
 *   built staircase does. Centred on the end wall it read as a free-standing
 *   object dropped into the basin, with an unusable slot of water behind each
 *   side.
 * - The stainless ladder is a deck-mounted grab rail: it belongs on a LONG
 *   wall, hard against the far corner, and never on the wall carrying the
 *   skimmer run -- which is exactly where the shared "longest wall, 22% along"
 *   default used to put it.
 *
 * `floorProfile` (Geometry Pass A follow-up): on a sloped floor, internal
 * steps additionally prefer whichever short wall sits at the SHALLOW end --
 * physically intuitive, safer, and the only end a customer would expect to
 * wade in from. This is a secondary sort key, applied only among walls that
 * already satisfy every existing constraint (length, clearance, basin
 * containment): the shallow wall wins the tie only when it is itself a
 * valid placement, and the search falls through to the next-best wall
 * exactly as it always has otherwise. Never applied to the ladder, whose
 * placement philosophy is unrelated to the floor profile. The preference
 * reads live off the canonical `FloorProfileModel` (never a cached wall
 * index), so reversing the slope re-derives it automatically.
 * With Infinity, the opposite wall takes priority; a lateral wall is used
 * only when the opposite one cannot fit a clear access footprint.
 */
export function accessPlacement(
  outline: Outline,
  run: number,
  width: number,
  access: PoolAccess | null = null,
  floorProfile?: FloorProfileModel,
  /** Geometry Pass D (Infinity): the selected side is never a valid
   * ladder/steps wall. `null` (every pre-Infinity call) is a no-op. */
  infinityExcluded: InfinityExclusion | null = null,
  accept?: (placement: AccessPosition) => boolean,
) {
  const inside = (x: number, z: number) => {
    let hit = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[i]!,
        b = outline[j]!;
      if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
        hit = !hit;
    }
    return hit;
  };
  const skimmers = skimmerWall(outline);
  // "On the skimmer/shallow wall" is a neighbourhood test, not exact-endpoint
  // equality: a rectangle/L-shape wall really does sit at a single constant
  // coordinate end to end (equality was always true there), but a curved
  // (Organic) outline only ever touches that exact extreme at one point --
  // exact equality would silently never match either endpoint of a real
  // merged run along that side, so the exclusion/preference would quietly
  // stop doing anything the moment the outline stopped being polygonal.
  const wallProximity = 0.3;
  const onSkimmerWall = (a: readonly [number, number], b: readonly [number, number]) => {
    const index = skimmers.axis === "x" ? 0 : 1;
    return (
      Math.abs(a[index] - skimmers.coordinate) < wallProximity &&
      Math.abs(b[index] - skimmers.coordinate) < wallProximity
    );
  };
  const shortWallAccess = access === "internalSteps";
  // Steps sit flush against the return wall; the ladder keeps a hand's width
  // of coping either side of its rails.
  const edgeMargin = shortWallAccess ? 0.02 : 0.1;
  // Which end of the chosen wall the steps are pushed into: the corner shared
  // with the skimmer run, which puts them at the opposite end of the basin
  // from the stainless ladder instead of crowding it.
  const atSkimmerEnd = (point: readonly [number, number]) =>
    Math.abs(point[skimmers.axis === "x" ? 0 : 1] - skimmers.coordinate) < wallProximity;
  const preferShallow = shortWallAccess && floorProfile?.sloped === true;
  const shallowAxisIndex = floorProfile?.axis === "x" ? 0 : 1;
  const shallowCoordinate = floorProfile
    ? floorProfile.shallowAtMin
      ? floorProfile.axisMin
      : floorProfile.axisMax
    : 0;
  const onShallowWall = (a: readonly [number, number], b: readonly [number, number]) =>
    Math.abs(a[shallowAxisIndex] - shallowCoordinate) < wallProximity &&
    Math.abs(b[shallowAxisIndex] - shallowCoordinate) < wallProximity;
  const infinityAxisIndex = infinityExcluded ? (infinityExcluded.axis === "x" ? 0 : 1) : null;
  const oppositeCoordinate = infinityExcluded
    ? oppositeInfinityCoordinate(outline, infinityExcluded)
    : null;
  const oppositeBand = oppositeCoordinate === null || !infinityExcluded
    ? wallProximity
    : Math.max(wallProximity, Math.abs(oppositeCoordinate - infinityExcluded.coordinate) * 0.12);
  const onInfinityWall = (a: readonly [number, number], b: readonly [number, number]) =>
    infinityAxisIndex !== null &&
    infinityExcluded !== null &&
    Math.abs(a[infinityAxisIndex] - infinityExcluded.coordinate) < wallProximity &&
    Math.abs(b[infinityAxisIndex] - infinityExcluded.coordinate) < wallProximity;
  const onOppositeWall = (a: readonly [number, number], b: readonly [number, number]) =>
    infinityAxisIndex !== null && oppositeCoordinate !== null &&
    Math.abs(a[infinityAxisIndex] - oppositeCoordinate) < oppositeBand &&
    Math.abs(b[infinityAxisIndex] - oppositeCoordinate) < oppositeBand;
  const lateralWall = (a: readonly [number, number], b: readonly [number, number], length: number) =>
    infinityAxisIndex !== null &&
    Math.abs(b[infinityAxisIndex] - a[infinityAxisIndex]) >= length * 0.5;
  // Candidate walls come from merged wall CHORDS, not raw per-vertex edges:
  // for a rectangle/L-shape (a handful of true corners) the very first,
  // tightest tolerance is already a no-op -- byte-identical to the old raw
  // edges, so every pre-Organic placement is unchanged. For a densely
  // sampled curve outline (Organic, ~15-25cm point spacing) every raw edge
  // is only a few centimetres long -- far short of any real stair/ladder
  // footprint -- so without merging, this search always failed and silently
  // rendered no access at all. Escalating tolerances (same ladder
  // `mergedWallChords` already climbs for LED placement) collapses the
  // curve's low-curvature runs into real, placeable candidate walls instead.
  const mergeTolerances = [0.06, 0.15, 0.3, 0.6, 1.0];
  for (const tolerance of mergeTolerances) {
    const edges = mergedWallChords(outline, tolerance)
      .map(({ a, b, length }) => ({
        a,
        b,
        length,
        skimmerWall: onSkimmerWall(a, b),
        shallowWall: preferShallow && onShallowWall(a, b),
        oppositeWall: onOppositeWall(a, b),
      }))
      .filter(({ a, b, length }) =>
        !onInfinityWall(a, b) &&
        (!infinityExcluded || onOppositeWall(a, b) || lateralWall(a, b, length)))
      .sort((first, second) => {
        if (first.oppositeWall !== second.oppositeWall)
          return first.oppositeWall ? -1 : 1;
        // The ladder shares its wall with nothing: push the skimmer run's
        // wall to the back of the queue before length is even considered.
        if (!shortWallAccess && first.skimmerWall !== second.skimmerWall) {
          return first.skimmerWall ? 1 : -1;
        }
        // Sloped internal steps: the shallow-end wall wins the tie ahead of
        // pure length, but only among walls the rest of this function will
        // still validate independently -- an invalid shallow wall simply
        // fails the clearance search below and the next-sorted wall is tried.
        if (preferShallow && first.shallowWall !== second.shallowWall) {
          return first.shallowWall ? -1 : 1;
        }
        return shortWallAccess ? first.length - second.length : second.length - first.length;
      });
    for (const { a, b, length } of edges) {
      if (length < width + 0.2) continue;
      const tx = (b[0] - a[0]) / length,
        tz = (b[1] - a[1]) / length;
      // Hard into one corner for both, then the other corner, then centred
      // only as a last resort when an obstruction leaves nowhere else.
      const cornerFirst = shortWallAccess ? atSkimmerEnd(a) : false;
      const fractions = shortWallAccess
        ? cornerFirst
          ? [0, 1, 0.5]
          : [1, 0, 0.5]
        : [0.88, 0.12, 0.5];
      for (const fraction of fractions) {
        const along = THREE.MathUtils.clamp(
          length * fraction,
          width / 2 + edgeMargin,
          length - width / 2 - edgeMargin,
        );
        const x = a[0] + tx * along,
          z = a[1] + tz * along;
        // Curved Infinity zones cannot be represented by a single axis coordinate.
        const overlapsInfinity = infinityExcluded?.edgeIndices?.some((index) => {
          const p = outline[index]!,
            q = outline[(index + 1) % outline.length]!;
          const dx = q[0] - p[0],
            dz = q[1] - p[1];
          const t = Math.max(
            0,
            Math.min(1, ((x - p[0]) * dx + (z - p[1]) * dz) / (dx * dx + dz * dz)),
          );
          return Math.hypot(x - p[0] - t * dx, z - p[1] - t * dz) < width / 2 + 0.15;
        });
        if (overlapsInfinity) continue;
        const sign = inside(x - tz * 0.05, z + tx * 0.05) ? 1 : -1;
        const nx = -tz * sign,
          nz = tx * sign;
        let clear = true;
        for (
          let d = 0.05;
          d <= run + (shortWallAccess ? ACCESS_DIMENSIONS.landingClearance : 0.05);
          d += 0.1
        ) {
          for (let w = -width / 2; w <= width / 2 + 1e-6; w += width / 8) {
            if (!inside(x + nx * d + nz * w, z + nz * d - nx * w)) clear = false;
          }
        }
        const candidate = { x, z, rotation: Math.atan2(nx, nz) };
        if (clear && (!accept || accept(candidate))) return candidate;
      }
    }
  }
  return null;
}

/** Treads and risers shared by both internal staircases, so switching variant
 *  changes the shape of the flight and never how steep it is. */
export function internalStairFlight(floorY: number, topY: number) {
  const riseCount = Math.max(3, Math.ceil((topY - floorY) / ACCESS_DIMENSIONS.maxRise));
  return { riseCount, rise: (topY - floorY) / riseCount, steps: riseCount - 1 };
}

export interface CornerStairPlan {
  /** The corner vertex itself: every tread is concentric about this point. */
  x: number;
  z: number;
  /** Yaw that sweeps the quarter from one wall round to the other. */
  rotation: number;
  /** Outer radius of each tread, innermost (highest) first. */
  radii: readonly number[];
  rise: number;
  /** Axis-aligned footprint, for anything that must keep clear of the flight. */
  footprint: Outline;
}

/**
 * Fixed, usable radial pitch. Depth determines the tread count; the basin
 * determines availability, never a compressed version of the same flight.
 */
function cornerStairRadii(
  shortSpan: number,
  steps: number,
): { radii: readonly number[]; outerRadius: number } {
  // Never squeeze usable treads to force a fit. The boundary search rejects
  // a flight that cannot accommodate this real radial walking path.
  const radii = Array.from(
    { length: steps },
    (_, i) => ACCESS_DIMENSIONS.cornerFirstRadius + i * ACCESS_DIMENSIONS.tread,
  );
  return { radii, outerRadius: radii[radii.length - 1]! };
}

/**
 * A radial corner staircase: quarter-round treads growing outward from the
 * corner as they descend, the way a Roman corner flight is actually built.
 *
 * Not a straight flight with its nose rounded off -- every tread is concentric
 * about the corner vertex, so the two flanks land flat against the two walls
 * and the nosings fan out into the basin.
 *
 * The outer radius follows the riser count at constant tread depth.
 * Reject corners without enough basin space and a clear bottom landing.
 *
 * `floorProfile` (Geometry Pass A follow-up): among the (at most two) valid
 * corners on the skimmer wall, prefer whichever sits at the shallow end --
 * same reasoning and same live canonical-model read as `accessPlacement`'s
 * shallow-wall preference. Geometric validity (square corner, full outer
 * radius clear on both flanks and the diagonal) is checked first and is
 * never relaxed for this preference; a shallow corner that fails validity
 * is simply not a candidate, and the deep one is used instead.
 */
export function cornerStairPlan(
  outline: Outline,
  floorY: number,
  topY: number,
  floorProfile?: FloorProfileModel,
  /** Geometry Pass D (Infinity): a corner touching the selected side is
   * never a valid flight anchor. `null` (every pre-Infinity call) is a
   * no-op. */
  infinityExcluded: InfinityExclusion | null = null,
  accept?: (footprint: Outline) => boolean,
): CornerStairPlan | null {
  if (outline.length < 3) return null;
  const skimmers = skimmerWall(outline, infinityExcluded);
  const infinityAxisIndex = infinityExcluded ? (infinityExcluded.axis === "x" ? 0 : 1) : null;
  const oppositeCoordinate = infinityExcluded
    ? oppositeInfinityCoordinate(outline, infinityExcluded)
    : null;
  const axis = skimmers.axis === "x" ? 0 : 1;
  const centre: readonly [number, number] = [
    outline.reduce((sum, [x]) => sum + x, 0) / outline.length,
    outline.reduce((sum, [, z]) => sum + z, 0) / outline.length,
  ];
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const [x, z] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const shortSpan = Math.min(maxX - minX, maxZ - minZ);
  const { rise, steps } = internalStairFlight(floorY, topY);
  const { radii, outerRadius } = cornerStairRadii(shortSpan, steps);

  // The corner is the one the straight flight is pushed into, so switching
  // variant swaps the shape of the staircase without also moving it to the
  // other end of the pool.
  type Flank = readonly [number, number];
  const flight = linearStairDimensions(floorY, topY);
  const straight = accessPlacement(
    outline,
    flight.run,
    flight.width,
    "internalSteps",
    floorProfile,
    infinityExcluded,
  );
  const preferShallow = floorProfile?.sloped === true;
  const shallowAxisIndex = floorProfile?.axis === "x" ? 0 : 1;
  const shallowCoordinate = floorProfile
    ? floorProfile.shallowAtMin
      ? floorProfile.axisMin
      : floorProfile.axisMax
    : 0;
  const isShallowCorner = (point: Flank) =>
    preferShallow && Math.abs(point[shallowAxisIndex] - shallowCoordinate) < 1e-6;
  let best: { point: Flank; into: readonly [Flank, Flank] } | null = null;
  // An opposite-side corner wins first. Among corners in that tier, keep the
  // shallow-end preference and then the straight-flight distance tiebreak.
  let bestTier = Infinity;
  let bestOppositeTier = Infinity;
  let bestDistance = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const point = outline[i]!;
    if (
      infinityExcluded?.edgeIndices?.some((edge) => edge === i || (edge + 1) % outline.length === i)
    )
      continue;
    const previous = outline[(i - 1 + outline.length) % outline.length]!;
    const next = outline[(i + 1) % outline.length]!;
    const first = normalise(next[0] - point[0], next[1] - point[1]);
    const second = normalise(previous[0] - point[0], previous[1] - point[1]);
    if (!first || !second) continue;
    // Square corners only: a radial flight cannot sit in a swept one.
    if (Math.abs(first[0] * second[0] + first[1] * second[1]) > 0.001) continue;
    // Geometry Pass D (Infinity): reject a corner where either flank runs
    // along the excluded side -- the flight would land one flat flank
    // against the disappearing edge, which has no wall there to seat against.
    if (
      infinityAxisIndex !== null &&
      infinityExcluded !== null &&
      Math.abs(point[infinityAxisIndex] - infinityExcluded.coordinate) < 1e-6 &&
      (Math.abs(previous[infinityAxisIndex] - infinityExcluded.coordinate) < 1e-6 ||
        Math.abs(next[infinityAxisIndex] - infinityExcluded.coordinate) < 1e-6)
    )
      continue;
    // Both flanks, and the diagonal between them, must have basin behind them
    // for the full outer radius. Each probe is nudged off the wall it runs
    // along: a point sampled exactly on the boundary is neither in nor out,
    // and would silently disqualify a perfectly good corner.
    const reach = (along: Flank, off: Flank, distance: number) =>
      insideOutline(
        outline,
        point[0] + along[0] * distance + off[0] * 0.08,
        point[1] + along[1] * distance + off[1] * 0.08,
      );
    const diagonal = normalise(first[0] + second[0], first[1] + second[1]);
    if (
      !reach(first, second, outerRadius * 0.96) ||
      !reach(second, first, outerRadius * 0.96) ||
      !diagonal ||
      !reach(diagonal, diagonal, outerRadius * 0.96)
    )
      continue;
    const towardsCentre =
      (centre[0] - point[0]) * (first[0] + second[0]) +
      (centre[1] - point[1]) * (first[1] + second[1]);
    if (towardsCentre <= 0) continue;
    const footprint: Outline = [
      point,
      [point[0] + first[0] * outerRadius, point[1] + first[1] * outerRadius],
      [
        point[0] + (first[0] + second[0]) * outerRadius,
        point[1] + (first[1] + second[1]) * outerRadius,
      ],
      [point[0] + second[0] * outerRadius, point[1] + second[1] * outerRadius],
    ];
    let contained = true;
    // Include the exact outer arc and its clear bottom landing: a 10 cm
    // interior sampling pitch alone can miss the last few centimetres.
    for (let j = 1; j < 64; j++) {
      const angle = ((j / 64) * Math.PI) / 2;
      const r = outerRadius + ACCESS_DIMENSIONS.landingClearance;
      if (
        !insideOutline(
          outline,
          point[0] + r * (first[0] * Math.cos(angle) + second[0] * Math.sin(angle)),
          point[1] + r * (first[1] * Math.cos(angle) + second[1] * Math.sin(angle)),
        )
      )
        contained = false;
    }
    for (let angle = 0.02; angle < Math.PI / 2; angle += 0.06)
      for (let r = 0.1; r <= outerRadius + 0.01; r += 0.1)
        if (
          !insideOutline(
            outline,
            point[0] + r * (first[0] * Math.cos(angle) + second[0] * Math.sin(angle)),
            point[1] + r * (first[1] * Math.cos(angle) + second[1] * Math.sin(angle)),
          )
        )
          contained = false;
    if (!contained || (accept && !accept(footprint))) continue;
    const distance = straight ? Math.hypot(point[0] - straight.x, point[1] - straight.z) : i;
    const tier = isShallowCorner(point) ? 0 : 1;
    const oppositeTier = infinityAxisIndex !== null && oppositeCoordinate !== null &&
      Math.abs(point[infinityAxisIndex] - oppositeCoordinate) < 1e-6 &&
      (Math.abs(previous[infinityAxisIndex] - oppositeCoordinate) < 1e-6 ||
        Math.abs(next[infinityAxisIndex] - oppositeCoordinate) < 1e-6) ? 0 : 1;
    if (oppositeTier > bestOppositeTier ||
      (oppositeTier === bestOppositeTier &&
        (tier > bestTier || (tier === bestTier && distance >= bestDistance)))) continue;
    bestOppositeTier = oppositeTier;
    bestTier = tier;
    bestDistance = distance;
    best = { point, into: [first, second] as const };
  }
  if (!best) return null;

  // Three's cylinder sweeps from local +Z towards local +X, so the yaw that
  // puts the first flank on +Z is only correct when the second flank lands on
  // +X; otherwise the two are the other way round.
  const [alpha, beta] = best.into;
  const yawFor = (direction: Flank) => Math.atan2(direction[0], direction[1]);
  let rotation = yawFor(alpha);
  if (Math.cos(rotation) * beta[0] - Math.sin(rotation) * beta[1] < 0.9) rotation = yawFor(beta);
  const [u, v] = Math.abs(yawFor(alpha) - rotation) < 1e-9 ? [alpha, beta] : [beta, alpha];
  // Seat the arc a few millimetres behind the corner so the two flat flanks
  // finish inside the wall instead of coplanar with it.
  const inset = 0.014;
  const x = best.point[0] - (u[0] + v[0]) * inset;
  const z = best.point[1] - (u[1] + v[1]) * inset;
  const corner = best.point;
  const footprint: Outline = [
    [corner[0], corner[1]],
    [corner[0] + u[0] * outerRadius, corner[1] + u[1] * outerRadius],
    [corner[0] + (u[0] + v[0]) * outerRadius, corner[1] + (u[1] + v[1]) * outerRadius],
    [corner[0] + v[0] * outerRadius, corner[1] + v[1] * outerRadius],
  ];
  return { x, z, rotation, radii, rise, footprint };
}

/**
 * Geometry Pass A: `cornerStairPlan`'s tread count/radii are sized from
 * whatever `floorY` it was called with, but the corner it lands on isn't
 * known until the search above finishes -- so on a sloped floor, its rise
 * and radii are still sized against the GLOBAL (deep) floor even when the
 * chosen corner actually sits at the shallow end. This rebuilds `radii`
 * and `rise` for the real, LOCAL floor under that corner, keeping the same
 * position/rotation/footprint (which never depended on floorY beyond a
 * radius that's provably unaffected by a few centimetres of local
 * shallow-end proportion). Treads then terminate exactly at the true local
 * floor -- never floating above it, never sinking below it. */
export function recomputeCornerHeight(
  corner: CornerStairPlan,
  outline: Outline,
  localFloorY: number,
  topY: number,
): CornerStairPlan {
  let minX = Infinity,
    maxX = -Infinity,
    minZ = Infinity,
    maxZ = -Infinity;
  for (const [x, z] of outline) {
    minX = Math.min(minX, x);
    maxX = Math.max(maxX, x);
    minZ = Math.min(minZ, z);
    maxZ = Math.max(maxZ, z);
  }
  const shortSpan = Math.min(maxX - minX, maxZ - minZ);
  const { rise, steps } = internalStairFlight(localFloorY, topY);
  const { radii } = cornerStairRadii(shortSpan, steps);
  return { ...corner, radii, rise };
}

function normalise(x: number, z: number): readonly [number, number] | null {
  const length = Math.hypot(x, z);
  return length < 1e-6 ? null : [x / length, z / length];
}

function insideOutline(outline: Outline, x: number, z: number) {
  let hit = false;
  for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
    const a = outline[i]!,
      b = outline[j]!;
    if (a[1] > z !== b[1] > z && x < ((b[0] - a[0]) * (z - a[1])) / (b[1] - a[1]) + a[0])
      hit = !hit;
  }
  return hit;
}

/** Plan dimensions for the straight flight, shared by the mesh and by anything
 *  that has to keep fittings clear of it. */
export function linearStairDimensions(floorY: number, topY: number) {
  const { riseCount, rise, steps } = internalStairFlight(floorY, topY);
  const tread = ACCESS_DIMENSIONS.tread;
  return { riseCount, rise, steps, tread, width: ACCESS_DIMENSIONS.maxWidth, run: steps * tread };
}

export function resolveAccessPlan({
  outline,
  access,
  stairType = "linear",
  floorProfile,
  topY,
  infinityExcluded = null,
  obstacles = [],
  reservedFootprints = [],
  ladderAnchorOffset = 0.2,
  ladderAnchorY = topY,
  ladderDeckAvailable = true,
}: {
  outline: Outline;
  access: PoolAccess | null;
  stairType?: InternalStairType;
  floorProfile: FloorProfileModel;
  topY: number;
  infinityExcluded?: InfinityExclusion | null;
  obstacles?: ReadonlyArray<{ x: number; z: number }>;
  reservedFootprints?: ReadonlyArray<Outline>;
  ladderAnchorOffset?: number;
  ladderAnchorY?: number;
  ladderDeckAvailable?: boolean;
}) {
  const empty = {
    placement: null as AccessPosition | null,
    corner: null as CornerStairPlan | null,
    riseCount: 0,
    steps: 0,
    rise: 0,
    tread: ACCESS_DIMENSIONS.tread as number,
    width: 0,
    run: 0,
    footprint: [] as Outline,
    ladderDepths: [] as number[],
    ladderAnchorOffset,
    ladderAnchorY,
    reason: "Spazio insufficiente per pedate e alzate regolari, senza interferenze.",
  };
  if (!access) return empty;
  const clearOfFittings = (polygon: Outline) =>
    clearOfInfinityEdge(outline, infinityExcluded, polygon) &&
    // Comfort footprints are axis-aligned rectangles. A conservative bounding
    // clearance also protects curved access nosings and ladder rails.
    !reservedFootprints.some(reserved => {
      const bounds = (points: Outline) => ({
        minX: Math.min(...points.map(p => p[0])), maxX: Math.max(...points.map(p => p[0])),
        minZ: Math.min(...points.map(p => p[1])), maxZ: Math.max(...points.map(p => p[1])),
      });
      const a = bounds(polygon), b = bounds(reserved), gap = 0.2;
      return a.maxX + gap > b.minX && a.minX - gap < b.maxX
        && a.maxZ + gap > b.minZ && a.minZ - gap < b.maxZ;
    }) &&
    !obstacles.some((p) => {
      if (insideOutline(polygon, p.x, p.z)) return true;
      return polygon.some((a, i) => {
        const b = polygon[(i + 1) % polygon.length]!;
        const dx = b[0] - a[0],
          dz = b[1] - a[1];
        const t = THREE.MathUtils.clamp(
          ((p.x - a[0]) * dx + (p.z - a[1]) * dz) / (dx * dx + dz * dz),
          0,
          1,
        );
        return (
          Math.hypot(p.x - a[0] - t * dx, p.z - a[1] - t * dz) < ACCESS_DIMENSIONS.fittingClearance
        );
      });
    });
  const footprintAt = (p: AccessPosition, width: number, run: number): Outline =>
    [
      [-width / 2, 0],
      [width / 2, 0],
      [width / 2, run],
      [-width / 2, run],
    ].map(
      ([x, z]) =>
        [
          p.x + Math.cos(p.rotation) * x! + Math.sin(p.rotation) * z!,
          p.z - Math.sin(p.rotation) * x! + Math.cos(p.rotation) * z!,
        ] as const,
    );
  if (access === "internalSteps" && stairType === "corner") {
    // A horizontal curved last nosing cannot meet a sloping plane with a
    // constant final rise. Do not silently substitute another staircase.
    if (floorProfile.sloped)
      return {
        ...empty,
        reason:
          "Scala angolare non disponibile sul fondo inclinato: il raccordo curvo richiede un pianerottolo piano.",
      };
    const corner = cornerStairPlan(
      outline,
      floorProfile.deepFloorY,
      topY,
      floorProfile,
      infinityExcluded,
      clearOfFittings,
    );
    if (!corner)
      return {
        ...empty,
        reason: "Nessun angolo retto libero con spazio sufficiente per i gradini curvi.",
      };
    return {
      ...empty,
      corner,
      placement: corner,
      steps: corner.radii.length,
      riseCount: corner.radii.length + 1,
      rise: corner.rise,
      width: corner.radii.at(-1)!,
      run: corner.radii.at(-1)!,
      footprint: corner.footprint,
      reason: "",
    };
  }
  const boundsX = outline.map((p) => p[0]),
    boundsZ = outline.map((p) => p[1]);
  const shortSpan = Math.min(
    Math.max(...boundsX) - Math.min(...boundsX),
    Math.max(...boundsZ) - Math.min(...boundsZ),
  );
  const width =
    access === "internalSteps"
      ? THREE.MathUtils.clamp(
          shortSpan * 0.32,
          ACCESS_DIMENSIONS.minWidth,
          ACCESS_DIMENSIONS.maxWidth,
        )
      : 0.62;
  if (access === "stainlessSteelLadder") {
    if (!ladderDeckAvailable)
      return { ...empty, reason: "Serve un piano esterno portante oltre il canale di sfioro." };
    let depths: number[] = [];
    const placement = accessPlacement(
      outline,
      ACCESS_DIMENSIONS.ladderRun,
      width,
      access,
      floorProfile,
      infinityExcluded,
      (p) => {
        const footprint = footprintAt(p, width, ACCESS_DIMENSIONS.ladderRun);
        const shelfZone = floorProfile.shelfZone;
        if (shelfZone && footprint.some(point => {
          const coordinate = point[floorProfile.axis === "x" ? 0 : 1];
          return shelfZone.atMin ? coordinate < shelfZone.slopeStart + 0.3 : coordinate > shelfZone.slopeStart - 0.3;
        })) return false;
        if (!clearOfFittings(footprint)) return false;
        const contacts = ladderWallContacts(outline, p);
        if (contacts.some((contact) => !Number.isFinite(contact.z))) return false;
        const c = Math.cos(p.rotation),
          s = Math.sin(p.rotation);
        const contactFloors = contacts.map(({ x, z }) =>
          floorProfile.floorYAt(p.x + c * x + s * z, p.z - s * x + c * z),
        );
        const floorY = Math.max(
          ...contactFloors,
          ...footprint.map(([x, z]) => floorProfile.floorYAt(x, z)),
        );
        depths = Array.from(
          { length: ACCESS_DIMENSIONS.ladderMaxTreads },
          (_, i) => (i + 1) * ACCESS_DIMENSIONS.ladderPitch,
        ).filter((d) => d <= ladderAnchorY - floorY - ACCESS_DIMENSIONS.ladderFloorClearance);
        // Both flange discs must be wholly outside the actual basin.
        const nx = Math.sin(p.rotation),
          nz = Math.cos(p.rotation);
        for (const w of [-0.25, 0.25])
          for (let a = 0; a < Math.PI * 2; a += Math.PI / 4) {
            const x = p.x - nx * ladderAnchorOffset + nz * w + Math.cos(a) * 0.06;
            const z = p.z - nz * ladderAnchorOffset - nx * w + Math.sin(a) * 0.06;
            if (insideOutline(outline, x, z)) return false;
          }
        return depths.length >= 2;
      },
    );
    return placement
      ? {
          ...empty,
          placement,
          width,
          run: ACCESS_DIMENSIONS.ladderRun,
          footprint: footprintAt(placement, width, ACCESS_DIMENSIONS.ladderRun),
          ladderDepths: depths,
          steps: depths.length,
          tread: ACCESS_DIMENSIONS.ladderPitch,
          reason: "",
        }
      : empty;
  }
  const estimate = Math.ceil((topY - floorProfile.shallowFloorY) / ACCESS_DIMENSIONS.maxRise);
  const counts = Array.from({ length: 8 }, (_, i) => i + 3).sort(
    (a, b) => Math.abs(a - estimate) - Math.abs(b - estimate),
  );
  for (const riseCount of counts) {
    const steps = riseCount - 1,
      run = steps * ACCESS_DIMENSIONS.tread;
    let rise = 0;
    const placement = accessPlacement(
      outline,
      run,
      width,
      access,
      floorProfile,
      infinityExcluded,
      (p) => {
        const footprint = footprintAt(p, width, run);
        if (!clearOfFittings(footprint)) return false;
        const ends = footprint.slice(2).map(([x, z]) => floorProfile.floorYAt(x, z));
        if (Math.abs(ends[0]! - ends[1]!) > ACCESS_DIMENSIONS.landingTolerance) return false;
        rise = (topY - (ends[0]! + ends[1]!) / 2) / riseCount;
        if (rise < ACCESS_DIMENSIONS.minRise || rise > ACCESS_DIMENSIONS.maxRise) return false;
        return Array.from({ length: steps }, (_, i) => {
          const treadTop = topY - (i + 1) * rise;
          return [-width / 2, 0, width / 2].every((x) =>
            [i * ACCESS_DIMENSIONS.tread, (i + 1) * ACCESS_DIMENSIONS.tread].every(
              (z) =>
                treadTop >
                floorProfile.floorYAt(
                  p.x + Math.cos(p.rotation) * x + Math.sin(p.rotation) * z,
                  p.z - Math.sin(p.rotation) * x + Math.cos(p.rotation) * z,
                ) +
                  0.02,
            ),
          );
        }).every(Boolean);
      },
    );
    if (placement)
      return {
        ...empty,
        placement,
        riseCount,
        steps,
        rise,
        width,
        run,
        footprint: footprintAt(placement, width, run),
        reason: "",
      };
  }
  return empty;
}

/** Close the curved-wall pocket behind the first tread without moving the flight. */
export function stairBackfillOutline(
  outline: Outline,
  placement: { x: number; z: number; rotation: number },
  width: number,
): Outline {
  const c = Math.cos(placement.rotation),
    s = Math.sin(placement.rotation);
  let polygon = outline.map(
    ([x, z]) =>
      [
        c * (x - placement.x) - s * (z - placement.z),
        s * (x - placement.x) + c * (z - placement.z),
      ] as const,
  );
  // Intersect the real basin with the shallow strip behind the chord. This
  // fills only basin space; it cannot protrude through the curved wall.
  for (const [axis, limit, direction] of [
    [0, -width / 2, 1],
    [0, width / 2, -1],
    [1, -0.3, 1],
    [1, 0.001, -1],
  ] as const) {
    const result: (readonly [number, number])[] = [];
    for (let i = 0; i < polygon.length; i++) {
      const a = polygon[i]!,
        b = polygon[(i + 1) % polygon.length]!;
      const da = (a[axis] - limit) * direction,
        db = (b[axis] - limit) * direction;
      if (da >= 0) result.push(a);
      if (da >= 0 !== db >= 0) {
        const t = da / (da - db);
        result.push([a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])]);
      }
    }
    polygon = result;
  }
  return polygon.some((p) => p[1] < -0.002) ? polygon : [];
}

/** Closed stair segment with horizontal walking surface and a floor-following base.
 * Metric UVs retain the liner's real-world scale on both risers and treads. */
export function stairSolid(
  points: Outline,
  treadY: number,
  placement: AccessPosition,
  floor: FloorProfileModel,
) {
  const shape = new THREE.Shape(points.map(([x, z]) => new THREE.Vector2(x, -z)));
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: 1, bevelEnabled: false, steps: 1 });
  geometry.rotateX(-Math.PI / 2);
  const position = geometry.getAttribute("position");
  const c = Math.cos(placement.rotation),
    s = Math.sin(placement.rotation);
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      z = position.getZ(i);
    const floorY = floor.floorYAt(placement.x + c * x + s * z, placement.z - s * x + c * z);
    position.setY(i, position.getY(i) > 0.5 ? treadY : floorY);
  }
  geometry.computeVertexNormals();
  const normal = geometry.getAttribute("normal"),
    uv = geometry.getAttribute("uv");
  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i),
      y = position.getY(i),
      z = position.getZ(i);
    uv.setXY(
      i,
      Math.abs(normal.getY(i)) > 0.9 ? x : Math.abs(normal.getX(i)) > 0.5 ? z : x,
      Math.abs(normal.getY(i)) > 0.9 ? z : y,
    );
  }
  geometry.computeBoundingSphere();
  return geometry;
}

export function PoolAccessModel({
  resolvedPlan,
  outline,
  access,
  stairType = "linear",
  floorProfile,
  topY,
  children,
  infinityExcluded = null,
  obstacles = [],
  ladderAnchorOffset = 0.2,
  ladderAnchorY = topY,
  ladderDeckAvailable = true,
}: {
  resolvedPlan?: ReturnType<typeof resolveAccessPlan>;
  outline: Outline;
  access: PoolAccess | null;
  stairType?: InternalStairType;
  floorProfile: FloorProfileModel;
  topY: number;
  children: ReactNode;
  infinityExcluded?: InfinityExclusion | null;
  obstacles?: ReadonlyArray<{ x: number; z: number }>;
  ladderAnchorOffset?: number;
  ladderAnchorY?: number;
  ladderDeckAvailable?: boolean;
}) {
  const plan = useMemo(
    () =>
      resolvedPlan ?? resolveAccessPlan({
        outline,
        access,
        stairType,
        floorProfile,
        topY,
        infinityExcluded,
        obstacles,
        ladderAnchorOffset,
        ladderAnchorY,
        ladderDeckAvailable,
      }),
    [
      resolvedPlan,
      outline,
      access,
      stairType,
      floorProfile,
      topY,
      infinityExcluded,
      obstacles,
      ladderAnchorOffset,
      ladderAnchorY,
      ladderDeckAvailable,
    ],
  );
  const geometries = useMemo(() => {
    if (!plan.placement || access !== "internalSteps") return [];
    const { placement, corner, width, steps, tread, rise } = plan;
    const result: THREE.BufferGeometry[] = [];
    if (corner) {
      // Disjoint annular sectors: no stacked/overlapping full cylinders.
      corner.radii.forEach((radius, i) => {
        const inner = i ? corner.radii[i - 1]! : 0;
        const points: [number, number][] = [];
        for (let j = 0; j <= 48; j++) {
          const a = ((j / 48) * Math.PI) / 2;
          points.push([radius * Math.sin(a), radius * Math.cos(a)]);
        }
        if (inner)
          for (let j = 48; j >= 0; j--) {
            const a = ((j / 48) * Math.PI) / 2;
            points.push([inner * Math.sin(a), inner * Math.cos(a)]);
          }
        else points.push([0, 0]);
        result.push(stairSolid(points, topY - (i + 1) * rise, placement, floorProfile));
      });
    } else {
      for (let i = 0; i < steps; i++)
        result.push(
          stairSolid(
            [
              [-width / 2, i * tread],
              [width / 2, i * tread],
              [width / 2, (i + 1) * tread],
              [-width / 2, (i + 1) * tread],
            ],
            topY - (i + 1) * rise,
            placement,
            floorProfile,
          ),
        );
      const backfill = stairBackfillOutline(outline, placement, width);
      if (backfill.length >= 3)
        result.push(stairSolid(backfill, topY - rise, placement, floorProfile));
    }
    return result;
  }, [plan, access, outline, floorProfile, topY]);
  useEffect(() => () => geometries.forEach((g) => g.dispose()), [geometries]);
  const rails = useMemo(
    () =>
      plan.placement && access === "stainlessSteelLadder"
        ? ladderWallContacts(outline, plan.placement).map((contact) => ({
            ...contact,
            curve: ladderRailCurve(ladderAnchorOffset, plan.ladderDepths.at(-1) ?? 0.56, contact.z),
          }))
        : [],
    [outline, access, plan.placement, ladderAnchorOffset, plan.ladderDepths],
  );
  if (!access || !plan.placement || plan.reason) return null;
  return (
    <group
      name={`pool-access-${access}-${stairType}`}
      position={[plan.placement.x, 0, plan.placement.z]}
      rotation={[0, plan.placement.rotation, 0]}
    >
      {access === "internalSteps" ? (
        geometries.map((geometry, i) => (
          <mesh key={i} geometry={geometry} castShadow receiveShadow>
            {children}
          </mesh>
        ))
      ) : (
        <group position={[0, ladderAnchorY, 0]}>
          {rails.map(({ x, z, curve }) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh castShadow>
                <tubeGeometry args={[curve, 64, ACCESS_DIMENSIONS.ladderTubeRadius, 12, false]} />
                <StainlessSteelMaterial finish="polished" />
              </mesh>
              <mesh position={[0, 0.012, -ladderAnchorOffset]}>
                <cylinderGeometry args={[0.06, 0.06, 0.024, 24]} />
                <StainlessSteelMaterial finish="satin" />
              </mesh>
              <mesh
                position={[
                  0,
                  -(plan.ladderDepths.at(-1) ?? 0.56) - ACCESS_DIMENSIONS.ladderFootDrop,
                  z + ACCESS_DIMENSIONS.ladderFootPad / 2,
                ]}
                rotation={[Math.PI / 2, 0, 0]}
              >
                <cylinderGeometry args={[0.034, 0.034, ACCESS_DIMENSIONS.ladderFootPad, 16]} />
                <meshStandardMaterial color="#373c3e" roughness={0.88} />
              </mesh>
            </group>
          ))}
          {plan.ladderDepths.map((d) => (
            <group key={d} position={[0, -d, 0.32]}>
              <mesh castShadow>
                <boxGeometry args={[ACCESS_DIMENSIONS.ladderWidth, 0.035, 0.13]} />
                <StainlessSteelMaterial finish="brushed" />
              </mesh>
              <mesh position={[0, 0.019, 0]}>
                <boxGeometry args={[0.4, 0.004, 0.105]} />
                <meshStandardMaterial color="#444a4c" roughness={0.85} />
              </mesh>
            </group>
          ))}
        </group>
      )}
    </group>
  );
}
