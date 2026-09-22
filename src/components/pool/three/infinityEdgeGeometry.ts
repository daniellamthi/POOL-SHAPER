import * as THREE from "three";
import type { InfinityEdgeDimensions, RectangleInfinityZone } from "@/lib/pool/infinity-edge";

/**
 * Geometry Pass D (Infinity, Rectangle-only first slice) -- pure builder
 * functions for the disappearing-lip / waterfall cascade / catch-basin
 * assembly on ONE selected rectangle side. Mirrors the plain-function,
 * no-React-state style of `poolGeometry.ts`/`poolConstruction.ts`: every
 * function here takes real-world (metre) inputs and returns a disposable
 * `THREE.BufferGeometry`, composed by `InfinityEdge.tsx` with the project's
 * `useDisposable` pattern.
 *
 * Coordinate contract: `zone` comes straight from `rectangleInfinityZones`
 * (infinity-edge.ts) -- `zone.start`/`zone.end` are the outline's own two
 * corner vertices for that side (CCW winding), `zone.normal` is the unit
 * outward normal, and `zone.length` is the side's real length. Every offset
 * below is expressed as `point + normal * distance` (outward) or along the
 * tangent (`end - start`), so this never assumes an axis-aligned side even
 * though the only zones that exist yet (Rectangle) happen to be axis-aligned.
 */

function addQuad(
  positions: number[],
  uvs: number[],
  a: THREE.Vector3,
  b: THREE.Vector3,
  c: THREE.Vector3,
  d: THREE.Vector3,
  uvScaleU: number,
  uvScaleV: number,
) {
  // a-b-c-d wound so the two triangles share the a/c diagonal; UVs derived
  // from the quad's own edge lengths so tiling stays proportional to its
  // real-world size instead of a fixed [0,1] stretch.
  const uLen = a.distanceTo(b) * uvScaleU;
  const vLen = a.distanceTo(d) * uvScaleV;
  const verts: Array<[THREE.Vector3, number, number]> = [
    [a, 0, 0],
    [b, uLen, 0],
    [c, uLen, vLen],
    [a, 0, 0],
    [c, uLen, vLen],
    [d, 0, vLen],
  ];
  for (const [p, u, v] of verts) {
    positions.push(p.x, p.y, p.z);
    uvs.push(u, v);
  }
}

function toV3(point: readonly [number, number], y: number): THREE.Vector3 {
  return new THREE.Vector3(point[0], y, point[1]);
}

function offsetPoint(
  point: readonly [number, number],
  normal: readonly [number, number],
  distance: number,
): readonly [number, number] {
  return [point[0] + normal[0] * distance, point[1] + normal[1] * distance];
}

function finishGeometry(positions: number[], uvs: number[]): THREE.BufferGeometry {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The disappearing lip itself: a thin slab from the pool's true edge
 * (`zone.points`, the same footprint normal coping would have started from)
 * out to `lipWidth`, flat at `lipTopY` -- just above the waterline, so the
 * main water body appears to run directly into it with no visible reveal,
 * and the water sheets over its outer edge into the cascade.
 *
 * Walks `zone.points`/`zone.pointNormals` one segment at a time rather than a
 * single inner-to-outer quad across `zone.start`/`zone.end` -- for
 * Rectangle/L-shape (`points.length === 2`, a single straight edge) this is
 * exactly one quad, byte-identical to before; for Organic's multi-point
 * curved arc it produces a real fan of quads that follows the true curve
 * (each segment offset along its OWN local normal), instead of a single flat
 * chord cutting straight across the bay -- the defect this pass's own
 * "curved lip must follow the curve smoothly" check exists to catch.
 */
export function createInfinityLipGeometry(
  zone: RectangleInfinityZone,
  dims: InfinityEdgeDimensions,
  lipTopY: number,
): THREE.BufferGeometry {
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let k = 0; k < zone.points.length - 1; k++) {
    const p0 = zone.points[k]!;
    const p1 = zone.points[k + 1]!;
    const n0 = zone.pointNormals[k] ?? zone.normal;
    const n1 = zone.pointNormals[k + 1] ?? zone.normal;
    const innerA = toV3(p0, lipTopY);
    const innerB = toV3(p1, lipTopY);
    const outerA = toV3(offsetPoint(p0, n0, dims.lipWidth), lipTopY);
    const outerB = toV3(offsetPoint(p1, n1, dims.lipWidth), lipTopY);
    addQuad(positions, uvs, innerA, innerB, outerB, outerA, 1, 1 / Math.max(dims.lipWidth, 1e-3));
  }
  return finishGeometry(positions, uvs);
}

/**
 * The vertical falling sheet: a double-sided plane just outboard of the lip
 * (starting at `lipWidth`, the lip's own outer/knife edge), spanning the
 * full side length and dropping `dropHeight`. Subdivided along its drop so
 * the reused water shader's ripple/refraction reads correctly instead of a
 * single flat quad.
 *
 * Follows `zone.points`/`zone.pointNormals` (each offset outward by
 * `lipWidth`, its own knife-edge polyline) rather than lerping a single
 * straight chord between `zone.start` and `zone.end` -- for Rectangle/
 * L-shape this is the same straight run subdivided by real length (byte-
 * identical geometry, just re-derived per-segment instead of via a single
 * `t`-lerp), and for Organic's curved arc the falling sheet's top edge
 * actually follows the curve instead of cutting a straight chord across it.
 * Each real outline segment gets its own length-proportional subdivision
 * (never fewer than 1) so a short trailing segment near the arc's ends never
 * gets an oversized, under-subdivided quad.
 */
export function createInfinityCascadeGeometry(
  zone: RectangleInfinityZone,
  dims: InfinityEdgeDimensions,
  lipTopY: number,
): THREE.BufferGeometry {
  const dropSegments = 6;
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let k = 0; k < zone.points.length - 1; k++) {
    const p0 = zone.points[k]!;
    const p1 = zone.points[k + 1]!;
    const n0 = zone.pointNormals[k] ?? zone.normal;
    const n1 = zone.pointNormals[k + 1] ?? zone.normal;
    const edge0 = offsetPoint(p0, n0, dims.lipWidth);
    const edge1 = offsetPoint(p1, n1, dims.lipWidth);
    const segmentLength = Math.hypot(edge1[0] - edge0[0], edge1[1] - edge0[1]);
    const lengthSegments = Math.max(1, Math.round(segmentLength / 0.4));
    const pointAtT = (t: number): readonly [number, number] => [
      THREE.MathUtils.lerp(edge0[0], edge1[0], t),
      THREE.MathUtils.lerp(edge0[1], edge1[1], t),
    ];
    for (let li = 0; li < lengthSegments; li++) {
      const p0t = pointAtT(li / lengthSegments);
      const p1t = pointAtT((li + 1) / lengthSegments);
      for (let di = 0; di < dropSegments; di++) {
        const y0 = lipTopY - (dims.dropHeight * di) / dropSegments;
        const y1 = lipTopY - (dims.dropHeight * (di + 1)) / dropSegments;
        const a = toV3(p0t, y0);
        const b = toV3(p1t, y0);
        const c = toV3(p1t, y1);
        const d = toV3(p0t, y1);
        addQuad(positions, uvs, a, b, c, d, 1, 1);
      }
    }
  }
  return finishGeometry(positions, uvs);
}

export interface InfinityCatchBasinGeometry {
  floor: THREE.BufferGeometry;
  outerWall: THREE.BufferGeometry;
  endWallStart: THREE.BufferGeometry;
  endWallEnd: THREE.BufferGeometry;
}

/**
 * The receiving trough outside the lip: floor + outer (far) wall + two end
 * walls closing the channel at both ends of the side's real length. Never
 * intersects the main basin -- its near edge starts exactly at `lipWidth`
 * (the lip's own outer edge, the same start the cascade falls from), and its
 * tangential extent matches `zone.start`/`zone.end` exactly, so its end
 * walls sit directly under the coping transition caps with no gap or overlap.
 *
 * Floor and outer wall walk `zone.points`/`zone.pointNormals` segment by
 * segment (each offset by its OWN local normal, exactly like the lip/
 * cascade above) rather than a single quad spanning `zone.start`/`zone.end`
 * directly -- for Rectangle/L-shape this is one quad, byte-identical to
 * before; for Organic it is what actually keeps the far (outer) wall a
 * constant `catchBasinWidth` OUTWARD of the near/lip edge at every point
 * along the curve. A single global normal applied uniformly to a curved
 * near edge would place the far edge too close on the inside of a curve
 * (risking the basin self-intersecting the lip) and too far on the outside
 * (opening a gap) -- offsetting per-point along each point's own true local
 * normal is what keeps the basin's width genuinely constant along the arc.
 * The two end walls only ever need the arc's two shoulders (its overall
 * `start`/`end` and their own local normals, i.e. `pointNormals[0]`/
 * `pointNormals[last]`), the same as before.
 */
export function createInfinityCatchBasinGeometry(
  zone: RectangleInfinityZone,
  dims: InfinityEdgeDimensions,
  lipTopY: number,
): InfinityCatchBasinGeometry {
  const basinTopY = lipTopY - dims.dropHeight;
  const basinFloorY = basinTopY - dims.catchBasinDepth;

  const floorPositions: number[] = [];
  const floorUvs: number[] = [];
  const outerPositions: number[] = [];
  const outerUvs: number[] = [];
  for (let k = 0; k < zone.points.length - 1; k++) {
    const p0 = zone.points[k]!;
    const p1 = zone.points[k + 1]!;
    const n0 = zone.pointNormals[k] ?? zone.normal;
    const n1 = zone.pointNormals[k + 1] ?? zone.normal;
    const near0 = offsetPoint(p0, n0, dims.lipWidth);
    const near1 = offsetPoint(p1, n1, dims.lipWidth);
    const far0 = offsetPoint(p0, n0, dims.lipWidth + dims.catchBasinWidth);
    const far1 = offsetPoint(p1, n1, dims.lipWidth + dims.catchBasinWidth);

    // Floor: horizontal quad at the basin's bottom for this segment.
    addQuad(
      floorPositions,
      floorUvs,
      toV3(near0, basinFloorY),
      toV3(near1, basinFloorY),
      toV3(far1, basinFloorY),
      toV3(far0, basinFloorY),
      1,
      1,
    );
    // Outer (far) wall: vertical, facing back toward the pool, for this segment.
    addQuad(
      outerPositions,
      outerUvs,
      toV3(far0, basinTopY),
      toV3(far1, basinTopY),
      toV3(far1, basinFloorY),
      toV3(far0, basinFloorY),
      1,
      1,
    );
  }
  const floor = finishGeometry(floorPositions, floorUvs);
  const outerWall = finishGeometry(outerPositions, outerUvs);

  // End walls: close the channel at each end (the arc's two shoulders),
  // spanning from the near (lip) edge to the far (outer) edge, full basin
  // height -- each using its OWN endpoint's local normal, not the zone's
  // aggregate average.
  const startNormal = zone.pointNormals[0] ?? zone.normal;
  const endNormal = zone.pointNormals[zone.pointNormals.length - 1] ?? zone.normal;
  const nearStart = offsetPoint(zone.start, startNormal, dims.lipWidth);
  const nearEnd = offsetPoint(zone.end, endNormal, dims.lipWidth);
  const farStart = offsetPoint(zone.start, startNormal, dims.lipWidth + dims.catchBasinWidth);
  const farEnd = offsetPoint(zone.end, endNormal, dims.lipWidth + dims.catchBasinWidth);

  const endWallStartPositions: number[] = [];
  const endWallStartUvs: number[] = [];
  addQuad(
    endWallStartPositions,
    endWallStartUvs,
    toV3(nearStart, basinTopY),
    toV3(farStart, basinTopY),
    toV3(farStart, basinFloorY),
    toV3(nearStart, basinFloorY),
    1,
    1,
  );
  const endWallStart = finishGeometry(endWallStartPositions, endWallStartUvs);

  const endWallEndPositions: number[] = [];
  const endWallEndUvs: number[] = [];
  addQuad(
    endWallEndPositions,
    endWallEndUvs,
    toV3(farEnd, basinTopY),
    toV3(nearEnd, basinTopY),
    toV3(nearEnd, basinFloorY),
    toV3(farEnd, basinFloorY),
    1,
    1,
  );
  const endWallEnd = finishGeometry(endWallEndPositions, endWallEndUvs);

  return { floor, outerWall, endWallStart, endWallEnd };
}

/**
 * Coping transition caps: a small vertical quad at each end of the lip run
 * (`zone.start` and `zone.end`), closing the height step between the
 * adjacent normal coping's top (`copingSurfaceY`) and the lower lip
 * (`lipTopY`). Sized to the wider of the lip or the normal coping's own
 * outer offset so it always fully covers the step with no sliver gap, and
 * positioned at the exact same inner/outer XZ the coping ring and lip share
 * at that corner vertex, so there is no floating slab and no visible seam.
 * Returns `null` when there is no real step to close (lip already flush
 * with the coping, e.g. a degenerate/zero coping thickness).
 */
export function createInfinityTransitionCapGeometry(
  zone: RectangleInfinityZone,
  dims: InfinityEdgeDimensions,
  lipTopY: number,
  copingSurfaceY: number,
  copingOuterOffsetDistance: number,
): { start: THREE.BufferGeometry | null; end: THREE.BufferGeometry | null } {
  const height = copingSurfaceY - lipTopY;
  if (!(height > 1e-4)) return { start: null, end: null };
  const outerDistance = Math.max(dims.lipWidth, copingOuterOffsetDistance);
  const build = (corner: readonly [number, number], normal: readonly [number, number]) => {
    const inner = corner;
    const outer = offsetPoint(corner, normal, outerDistance);
    const positions: number[] = [];
    const uvs: number[] = [];
    addQuad(
      positions,
      uvs,
      toV3(inner, copingSurfaceY),
      toV3(outer, copingSurfaceY),
      toV3(outer, lipTopY),
      toV3(inner, lipTopY),
      1,
      1,
    );
    return finishGeometry(positions, uvs);
  };
  const startNormal = zone.pointNormals[0] ?? zone.normal;
  const endNormal = zone.pointNormals[zone.pointNormals.length - 1] ?? zone.normal;
  return { start: build(zone.start, startNormal), end: build(zone.end, endNormal) };
}

/** Finiteness/no-NaN guard used both by the geometry audit script and by the
 * component itself in dev -- every position component of every built piece
 * must be a finite number, never NaN/Infinity, regardless of pool size. */
export function isGeometryFinite(geometry: THREE.BufferGeometry): boolean {
  const position = geometry.getAttribute("position");
  if (!position) return false;
  for (let i = 0; i < position.count; i++) {
    if (
      !Number.isFinite(position.getX(i)) ||
      !Number.isFinite(position.getY(i)) ||
      !Number.isFinite(position.getZ(i))
    ) {
      return false;
    }
  }
  return true;
}

/**
 * UV sanity guard for every piece built above (lip, cascade, catch-basin
 * floor/walls, transition caps): a real, non-degenerate `uv` attribute,
 * present for every vertex, entirely finite, and within a real-world metre
 * -scale sane range -- catches a missing/degenerate UV attribute (the
 * classic cause of black triangles or a material that can't sample its map
 * at all) as well as a UV blow-up (e.g. a near-zero-width piece dividing a
 * `uvScaleU`/`uvScaleV` by an unclamped near-zero dimension) the way a
 * finiteness-only check on `position` never would. The lip/cap materials
 * this module feeds (`InfinityEdge.tsx`) sample their stone finish
 * triplanar, in world space, so THEY don't depend on this attribute being
 * meaningful -- but the `uv` attribute is still built and shipped on every
 * piece (see `addQuad`/`finishGeometry`), and any future consumer that DOES
 * read it (or a regression that starts sampling it) deserves the same
 * "never silently degenerate" guarantee `isGeometryFinite` gives `position`.
 */
export function isUvAttributeSane(geometry: THREE.BufferGeometry): boolean {
  const uv = geometry.getAttribute("uv");
  const position = geometry.getAttribute("position");
  if (!uv || !position) return false;
  if (uv.count !== position.count) return false;
  let maxAbsValue = 0;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = uv.getY(i);
    if (!Number.isFinite(u) || !Number.isFinite(v)) return false;
    // Real-world metre-scale UVs (see `addQuad`): a value past this is a
    // sign generation blew up (e.g. a near-zero divisor), not a legitimate
    // tiling repeat for any pool this app can build.
    if (Math.abs(u) > 500 || Math.abs(v) > 500) return false;
    maxAbsValue = Math.max(maxAbsValue, Math.abs(u), Math.abs(v));
  }
  // A present-but-never-written (all-zero) UV attribute would pass every
  // check above -- this is what actually catches that degenerate case.
  return maxAbsValue > 1e-6;
}
