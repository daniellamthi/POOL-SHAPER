import { useEffect, useMemo, type ReactNode } from "react";
import * as THREE from "three";
import type { InternalStairType, Outline, PoolAccess } from "@/lib/pool/types";
import { skimmerWall } from "@/lib/pool/walls.ts";
import type { InfinityExclusion } from "@/lib/pool/walls.ts";
import { mergedWallChords } from "@/lib/pool/lighting";
import type { FloorProfileModel } from "@/lib/pool/floor-profile";

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
  const onInfinityWall = (a: readonly [number, number], b: readonly [number, number]) =>
    infinityAxisIndex !== null &&
    infinityExcluded !== null &&
    Math.abs(a[infinityAxisIndex] - infinityExcluded.coordinate) < wallProximity &&
    Math.abs(b[infinityAxisIndex] - infinityExcluded.coordinate) < wallProximity;
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
      }))
      .filter(({ a, b }) => !onInfinityWall(a, b))
      .sort((first, second) => {
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
        const sign = inside(x - tz * 0.05, z + tx * 0.05) ? 1 : -1;
        const nx = -tz * sign,
          nz = tx * sign;
        let clear = true;
        for (let d = 0.05; d <= run + 0.05; d += 0.1) {
          for (const w of [-width / 2, 0, width / 2]) {
            if (!inside(x + nx * d + nz * w, z + nz * d - nx * w)) clear = false;
          }
        }
        if (clear) return { x, z, rotation: Math.atan2(nx, nz) };
      }
    }
  }
  return null;
}

/** Treads and risers shared by both internal staircases, so switching variant
 *  changes the shape of the flight and never how steep it is. */
export function internalStairFlight(floorY: number, topY: number) {
  const riseCount = Math.max(3, Math.ceil((topY - floorY) / 0.25));
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
 * Proportioned to the basin, then bounded to a real swimming-pool tread
 * depth (~28-35 cm). The 28 cm floor is a target, not a hard minimum: on a
 * pool too small to hold it without the flight swallowing the corner, the
 * floor backs off just far enough to keep the outer reach inside the same
 * safe proportion of the basin that `cornerStairPlan`'s clearance search
 * has to respect, so the stair shrinks with the pool instead of growing
 * past it. Shared by `cornerStairPlan` and `recomputeCornerHeight` (Geometry
 * Pass A: the corner's tread count and radii depend on the LOCAL floor
 * under it, only known once the corner's position itself is resolved).
 */
function cornerStairRadii(
  shortSpan: number,
  steps: number,
): { radii: readonly number[]; outerRadius: number } {
  const outer = THREE.MathUtils.clamp(shortSpan * 0.4, 1.1, 1.85);
  const safeOuterReach = shortSpan * 0.45;
  const maxSafeTread = steps > 1 ? Math.max(0.22, (safeOuterReach - 0.42) / (steps - 1)) : 0.35;
  const treadFloor = Math.min(0.28, maxSafeTread);
  const tread = THREE.MathUtils.clamp((outer - 0.5) / Math.max(1, steps - 1), treadFloor, 0.35);
  const firstRadius = Math.max(0.42, outer - tread * (steps - 1));
  const radii = Array.from({ length: steps }, (_, i) => firstRadius + i * tread);
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
 * The outer radius is taken from the basin's short span, so the flight keeps
 * its proportions from a plunge pool up to a long lane pool instead of
 * swallowing a small one.
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
): CornerStairPlan | null {
  if (outline.length < 3) return null;
  const skimmers = skimmerWall(outline, infinityExcluded);
  const infinityAxisIndex = infinityExcluded ? (infinityExcluded.axis === "x" ? 0 : 1) : null;
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
  // Two-tier comparison: a shallow-end corner always beats a deep one
  // (bestTier 0 < 1); within the same tier, the existing "closest to the
  // straight-flight placement" distance tiebreak is unchanged.
  let bestTier = Infinity;
  let bestDistance = Infinity;
  for (let i = 0; i < outline.length; i++) {
    const point = outline[i]!;
    const previous = outline[(i - 1 + outline.length) % outline.length]!;
    const next = outline[(i + 1) % outline.length]!;
    const first = normalise(next[0] - point[0], next[1] - point[1]);
    const second = normalise(previous[0] - point[0], previous[1] - point[1]);
    if (!first || !second) continue;
    // Square corners only: a radial flight cannot sit in a swept one.
    if (Math.abs(first[0] * second[0] + first[1] * second[1]) > 0.08) continue;
    if (Math.abs(point[axis] - skimmers.coordinate) > 1e-6) continue;
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
    const distance = straight ? Math.hypot(point[0] - straight.x, point[1] - straight.z) : i;
    const tier = isShallowCorner(point) ? 0 : 1;
    if (tier > bestTier || (tier === bestTier && distance >= bestDistance)) continue;
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

/**
 * Every corner tread's cap is a fan of triangles converging on the flight's
 * own vertical axis (the pie-slice centre). Three.js has no explicit tangent
 * for that fan, so a tangent-space normal map falls back to a per-fragment
 * derivative reconstruction -- and directly at a fan's centre, adjacent
 * wedges disagree wildly about which way "u" points, so the reconstructed
 * tangent (and the bump lighting built on it) swings hard between them. The
 * cap itself is flat (its vertex normal is a constant straight up), so the
 * physically correct tangent there is ALSO constant -- there is no real
 * discontinuity to reconstruct. This only ever shows up on the innermost
 * tread: every other tread's own fan centre sits at radius 0, which is
 * always hidden under the next-smaller, taller cylinder nested in front of
 * it, so only the smallest tread ever exposes its own centre to the camera.
 */
function flattenCapTangent(geometry: THREE.CylinderGeometry): THREE.CylinderGeometry {
  geometry.computeTangents();
  const normal = geometry.getAttribute("normal");
  const tangent = geometry.getAttribute("tangent");
  for (let i = 0; i < normal.count; i++) {
    // Top cap only: its vertex normal points straight up. The curved side
    // wall and the bottom cap (never seen, but left untouched for safety)
    // keep the tangents computeTangents() derived for them, which are
    // correct there -- their normals genuinely vary or are already uniform
    // without a fan singularity.
    if (normal.getY(i) > 0.999) tangent.setXYZW(i, 1, 0, 0, 1);
  }
  tangent.needsUpdate = true;
  return geometry;
}

/** Plan dimensions for the straight flight, shared by the mesh and by anything
 *  that has to keep fittings clear of it. */
export function linearStairDimensions(floorY: number, topY: number) {
  const { riseCount, rise, steps } = internalStairFlight(floorY, topY);
  const tread = 0.3;
  return { riseCount, rise, steps, tread, width: 1.15, run: steps * tread };
}

export function PoolAccessModel({
  outline,
  access,
  stairType = "linear",
  floorProfile,
  topY,
  children,
  infinityExcluded = null,
}: {
  outline: Outline;
  access: PoolAccess | null;
  stairType?: InternalStairType;
  floorProfile: FloorProfileModel;
  topY: number;
  children: ReactNode;
  /** Geometry Pass D (Infinity): forwarded, unchanged, to
   * `accessPlacement`/`cornerStairPlan` -- `null` on every call site that
   * hasn't opted into Infinity is a complete no-op. */
  infinityExcluded?: InfinityExclusion | null;
}) {
  // Sizing/search phase: uses the GLOBAL (deep) floor, exactly as every
  // pool did before Geometry Pass A -- byte-identical when flat, and a
  // conservative (longer, safely clearance-tested) estimate for slope,
  // corrected below once the actual anchor point -- and so the real local
  // floor under it -- is known.
  const globalFloorY = floorProfile.deepFloorY;
  const flight = linearStairDimensions(globalFloorY, topY);
  const run = access === "internalSteps" ? flight.run : 0.55;
  const width = access === "internalSteps" ? flight.width : 0.62;
  const cornerStairs = access === "internalSteps" && stairType === "corner";
  const rawCorner = useMemo(
    () =>
      cornerStairs
        ? cornerStairPlan(outline, globalFloorY, topY, floorProfile, infinityExcluded)
        : null,
    [cornerStairs, outline, globalFloorY, topY, floorProfile, infinityExcluded],
  );
  const placement = useMemo(
    () => accessPlacement(outline, run, width, access, floorProfile, infinityExcluded),
    [outline, run, width, access, floorProfile, infinityExcluded],
  );
  // The real, local floor under wherever the search above actually landed --
  // identical to `globalFloorY` when flat, so every step below is a no-op
  // change for the flat case.
  const corner = useMemo(() => {
    if (!rawCorner) return null;
    if (!floorProfile.sloped) return rawCorner;
    const localFloorY = floorProfile.floorYAt(rawCorner.x, rawCorner.z);
    return recomputeCornerHeight(rawCorner, outline, localFloorY, topY);
  }, [rawCorner, floorProfile, outline, topY]);
  const localFloorY =
    placement && floorProfile.sloped
      ? floorProfile.floorYAt(placement.x, placement.z)
      : globalFloorY;
  const localFlight =
    placement && floorProfile.sloped ? linearStairDimensions(localFloorY, topY) : flight;
  const { riseCount, rise, tread } = localFlight;
  const rail = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(0, 0, -0.36),
          new THREE.Vector3(0, 0.62, -0.36),
          new THREE.Vector3(0, 0.76, -0.15),
          new THREE.Vector3(0, 0.62, 0.26),
          new THREE.Vector3(0, 0.12, 0.32),
          new THREE.Vector3(0, -Math.min(1.15, topY - localFloorY - 0.15), 0.32),
        ],
        false,
        "centripetal",
      ),
    [topY, localFloorY],
  );
  // Built once per plan, not per render: computeTangents() walks every
  // triangle, and doing that on every frame would be wasted work for
  // geometry that only changes when the basin or the flight does.
  const cornerTreadGeometries = useMemo(() => {
    if (!corner) return [];
    return corner.radii.map((radius, i) => {
      // Innermost tread is the highest: the flight descends as it fans out,
      // so the nested solids read as one stepped quarter-round.
      const height = (corner.radii.length - i) * corner.rise;
      const geometry = new THREE.CylinderGeometry(
        radius,
        radius,
        height,
        Math.max(14, Math.round(radius * 20)),
        1,
        false,
        0,
        Math.PI / 2,
      );
      // Only the innermost tread ever exposes its own fan centre to the
      // camera (see flattenCapTangent) -- skip the extra work everywhere
      // else, since nothing there is visibly wrong.
      return i === 0 ? flattenCapTangent(geometry) : geometry;
    });
  }, [corner]);
  useEffect(
    () => () => cornerTreadGeometries.forEach((geometry) => geometry.dispose()),
    [cornerTreadGeometries],
  );

  if (!access) return null;
  if (cornerStairs && corner) {
    const cornerFloorY = floorProfile.floorYAt(corner.x, corner.z);
    return (
      <group
        name="pool-access-internalSteps-corner"
        position={[corner.x, 0, corner.z]}
        rotation={[0, corner.rotation, 0]}
      >
        {cornerTreadGeometries.map((geometry, i) => (
          <mesh
            key={i}
            position={[0, cornerFloorY + ((corner.radii.length - i) * corner.rise) / 2, 0]}
            renderOrder={corner.radii.length - i}
            geometry={geometry}
            castShadow
            // The innermost tread's cap is the one fan whose own centre is
            // never hidden under a taller neighbour (see flattenCapTangent),
            // and that same singular point is where a shadow map's depth
            // precision is thinnest across this mesh: under the pool LED's
            // grazing spotlight it self-shadowed a hairline crease radiating
            // from that centre, on this tread only. It still casts its own
            // shadow onto the tread below; it just cannot flatten under it.
            receiveShadow={i !== 0}
          >
            {children}
          </mesh>
        ))}
      </group>
    );
  }
  if (!placement) return null;
  return (
    <group
      name={`pool-access-${access}`}
      position={[placement.x, 0, placement.z]}
      rotation={[0, placement.rotation, 0]}
    >
      {access === "internalSteps" ? (
        Array.from({ length: riseCount - 1 }, (_, i) => {
          const height = (riseCount - 1 - i) * rise;
          return (
            <mesh
              key={i}
              position={[0, localFloorY + height / 2, (i + 0.5) * tread]}
              castShadow
              receiveShadow
            >
              <boxGeometry args={[width, height, tread + 0.002]} />
              {children}
            </mesh>
          );
        })
      ) : (
        <group position={[0, topY, 0]}>
          {[-0.25, 0.25].map((x) => (
            <group key={x} position={[x, 0, 0]}>
              <mesh castShadow>
                <tubeGeometry args={[rail, 40, 0.021, 12, false]} />
                <meshStandardMaterial color="#e5e8e9" metalness={1} roughness={0.2} />
              </mesh>
              <mesh position={[0, 0.012, -0.36]}>
                <cylinderGeometry args={[0.06, 0.06, 0.024, 24]} />
                <meshStandardMaterial color="#d5dadd" metalness={1} roughness={0.24} />
              </mesh>
            </group>
          ))}
          {[0.3, 0.58, 0.86]
            .filter((d) => d < topY - localFloorY - 0.12)
            .map((d) => (
              <mesh key={d} position={[0, -d, 0.32]} castShadow>
                <boxGeometry args={[0.5, 0.035, 0.13]} />
                <meshStandardMaterial color="#bbc3c6" metalness={0.9} roughness={0.32} />
              </mesh>
            ))}
        </group>
      )}
    </group>
  );
}
