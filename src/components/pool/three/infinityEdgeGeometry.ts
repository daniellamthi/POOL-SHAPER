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
 * (`zone.start`/`zone.end`, the same footprint normal coping would have
 * started from) out to `lipWidth`, flat at `lipTopY` -- just above the
 * waterline, so the main water body appears to run directly into it with no
 * visible reveal, and the water sheets over its outer edge into the cascade.
 */
export function createInfinityLipGeometry(
  zone: RectangleInfinityZone,
  dims: InfinityEdgeDimensions,
  lipTopY: number,
): THREE.BufferGeometry {
  const innerA = toV3(zone.start, lipTopY);
  const innerB = toV3(zone.end, lipTopY);
  const outerA = toV3(offsetPoint(zone.start, zone.normal, dims.lipWidth), lipTopY);
  const outerB = toV3(offsetPoint(zone.end, zone.normal, dims.lipWidth), lipTopY);
  const positions: number[] = [];
  const uvs: number[] = [];
  addQuad(positions, uvs, innerA, innerB, outerB, outerA, 1, 1 / Math.max(dims.lipWidth, 1e-3));
  return finishGeometry(positions, uvs);
}

/**
 * The vertical falling sheet: a double-sided plane just outboard of the lip
 * (starting at `lipWidth`, the lip's own outer/knife edge), spanning the
 * full side length and dropping `dropHeight`. Subdivided along its drop so
 * the reused water shader's ripple/refraction reads correctly instead of a
 * single flat quad.
 */
export function createInfinityCascadeGeometry(
  zone: RectangleInfinityZone,
  dims: InfinityEdgeDimensions,
  lipTopY: number,
): THREE.BufferGeometry {
  const dropSegments = 6;
  const lengthSegments = Math.max(1, Math.round(zone.length / 0.4));
  const positions: number[] = [];
  const uvs: number[] = [];
  const edgeStart = offsetPoint(zone.start, zone.normal, dims.lipWidth);
  const edgeEnd = offsetPoint(zone.end, zone.normal, dims.lipWidth);
  const pointAtT = (t: number): readonly [number, number] => [
    THREE.MathUtils.lerp(edgeStart[0], edgeEnd[0], t),
    THREE.MathUtils.lerp(edgeStart[1], edgeEnd[1], t),
  ];
  for (let li = 0; li < lengthSegments; li++) {
    const t0 = li / lengthSegments;
    const t1 = (li + 1) / lengthSegments;
    const p0 = pointAtT(t0);
    const p1 = pointAtT(t1);
    for (let di = 0; di < dropSegments; di++) {
      const y0 = lipTopY - (dims.dropHeight * di) / dropSegments;
      const y1 = lipTopY - (dims.dropHeight * (di + 1)) / dropSegments;
      const a = toV3(p0, y0);
      const b = toV3(p1, y0);
      const c = toV3(p1, y1);
      const d = toV3(p0, y1);
      addQuad(positions, uvs, a, b, c, d, 1, 1);
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
 */
export function createInfinityCatchBasinGeometry(
  zone: RectangleInfinityZone,
  dims: InfinityEdgeDimensions,
  lipTopY: number,
): InfinityCatchBasinGeometry {
  const basinTopY = lipTopY - dims.dropHeight;
  const basinFloorY = basinTopY - dims.catchBasinDepth;
  const nearStart = offsetPoint(zone.start, zone.normal, dims.lipWidth);
  const nearEnd = offsetPoint(zone.end, zone.normal, dims.lipWidth);
  const farStart = offsetPoint(zone.start, zone.normal, dims.lipWidth + dims.catchBasinWidth);
  const farEnd = offsetPoint(zone.end, zone.normal, dims.lipWidth + dims.catchBasinWidth);

  // Floor: horizontal quad at the basin's bottom.
  const floorPositions: number[] = [];
  const floorUvs: number[] = [];
  addQuad(
    floorPositions,
    floorUvs,
    toV3(nearStart, basinFloorY),
    toV3(nearEnd, basinFloorY),
    toV3(farEnd, basinFloorY),
    toV3(farStart, basinFloorY),
    1,
    1,
  );
  const floor = finishGeometry(floorPositions, floorUvs);

  // Outer (far) wall: vertical, facing back toward the pool.
  const outerPositions: number[] = [];
  const outerUvs: number[] = [];
  addQuad(
    outerPositions,
    outerUvs,
    toV3(farStart, basinTopY),
    toV3(farEnd, basinTopY),
    toV3(farEnd, basinFloorY),
    toV3(farStart, basinFloorY),
    1,
    1,
  );
  const outerWall = finishGeometry(outerPositions, outerUvs);

  // End walls: close the channel at each end, spanning from the near (lip)
  // edge to the far (outer) edge, full basin height.
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
  const build = (corner: readonly [number, number]) => {
    const inner = corner;
    const outer = offsetPoint(corner, zone.normal, outerDistance);
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
  return { start: build(zone.start), end: build(zone.end) };
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
