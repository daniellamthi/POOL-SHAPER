import * as THREE from "three";
import { toCreasedNormals, mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import { splitFloorOutline, type FloorProfileModel } from "@/lib/pool/floor-profile";
import type { WallOpening } from "./poolConstruction";
import { offsetOutline } from "../../../lib/pool/geometry";
import type { Outline } from "../../../lib/pool/types";

/**
 * Maximum edge length, metres, of every submerged basin receiver.
 *
 * The flat-water lens (`flatWaterProjection.ts`) refracts each VERTEX of a
 * submerged mesh; the rasteriser then interpolates linearly between them.
 * The refraction is strongly non-linear, so a wall drawn as one quad per
 * side (coping to floor, corner to corner) is shown far from where its own
 * points actually refract, while small, densely-vertexed fittings mounted on
 * it (LED luminaires, skimmer frames) refract correctly -- they appear to
 * float off the wall. Tessellating the receivers keeps the wall, floor and
 * fittings in one consistent optical position. World geometry is unchanged.
 */
export const UNDERWATER_LENS_SEGMENT = 0.25;

/** Same polygon, with collinear points inserted so no edge exceeds `maxSegment`. */
export function densifyOutline(outline: Outline, maxSegment: number): Outline {
  if (!(maxSegment > 0) || outline.length < 2) return outline;
  const result: Array<readonly [number, number]> = [];
  for (let index = 0; index < outline.length; index++) {
    const a = outline[index]!;
    const b = outline[(index + 1) % outline.length]!;
    result.push(a);
    const steps = Math.ceil(Math.hypot(b[0] - a[0], b[1] - a[1]) / maxSegment);
    for (let step = 1; step < steps; step++) {
      const t = step / steps;
      result.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
    }
  }
  return result;
}

/** Sutherland-Hodgman clip of a (possibly concave) polygon to an axis-aligned cell. */
function clipToCell(
  polygon: ReadonlyArray<readonly [number, number]>,
  minX: number,
  maxX: number,
  minY: number,
  maxY: number,
): Array<readonly [number, number]> {
  const edges: Array<[0 | 1, number, 1 | -1]> = [
    [0, minX, 1],
    [0, maxX, -1],
    [1, minY, 1],
    [1, maxY, -1],
  ];
  let current: Array<readonly [number, number]> = [...polygon];
  for (const [axis, limit, sign] of edges) {
    if (current.length === 0) break;
    const input = current;
    current = [];
    const inside = (p: readonly [number, number]) => (p[axis] - limit) * sign >= 0;
    for (let index = 0; index < input.length; index++) {
      const a = input[index]!;
      const b = input[(index + 1) % input.length]!;
      const aIn = inside(a);
      const bIn = inside(b);
      if (aIn) current.push(a);
      if (aIn !== bIn) {
        const t = (limit - a[axis]) / (b[axis] - a[axis]);
        const point: [number, number] = [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
        point[axis] = limit;
        current.push(point);
      }
    }
  }
  return current;
}

/** The outline's flat surface triangulated cell by cell, so no triangle is
 * wider than `cell` (see `UNDERWATER_LENS_SEGMENT`). Same orientation, UVs
 * and footprint as the single-shape triangulation. */
function createTessellatedSurfaceGeometry(outline: Outline, cell: number): THREE.BufferGeometry {
  const polygon = outline.map(([x, z]) => [x, -z] as const);
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (const [x, y] of polygon) {
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
    minY = Math.min(minY, y); maxY = Math.max(maxY, y);
  }
  const columns = Math.max(1, Math.ceil((maxX - minX) / cell));
  const rows = Math.max(1, Math.ceil((maxY - minY) / cell));
  const positions: number[] = [];
  const uvs: number[] = [];
  for (let column = 0; column < columns; column++) {
    const x0 = minX + ((maxX - minX) * column) / columns;
    const x1 = column === columns - 1 ? maxX : minX + ((maxX - minX) * (column + 1)) / columns;
    for (let row = 0; row < rows; row++) {
      const y0 = minY + ((maxY - minY) * row) / rows;
      const y1 = row === rows - 1 ? maxY : minY + ((maxY - minY) * (row + 1)) / rows;
      const piece = clipToCell(polygon, x0, x1, y0, y1);
      if (piece.length < 3) continue;
      const contour = piece.map(([x, y]) => new THREE.Vector2(x, y));
      for (const triangle of THREE.ShapeUtils.triangulateShape(contour, [])) {
        let [a, b, c] = triangle.map((i) => contour[i]!) as [THREE.Vector2, THREE.Vector2, THREE.Vector2];
        const area = (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
        if (Math.abs(area) < 1e-12) continue;
        if (area < 0) [b, c] = [c, b];
        for (const vertex of [a, b, c]) {
          positions.push(vertex.x, vertex.y, 0);
          uvs.push(vertex.x, vertex.y);
        }
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/** Flat, horizontal (XZ) surface filling the outline. `cell`, when given
 * (holes are not supported with it), bounds every triangle's extent for the
 * underwater lens; omitted, the single-shape triangulation is unchanged. */
export function createSurfaceGeometry(outline: Outline, hole?: Outline, cell?: number): THREE.BufferGeometry {
  if (cell && cell > 0 && !hole) return createTessellatedSurfaceGeometry(outline, cell);
  const shape = new THREE.Shape(outline.map(([x, z]) => new THREE.Vector2(x, -z)));
  if (hole) {
    shape.holes.push(new THREE.Path(hole.map(([x, z]) => new THREE.Vector2(x, -z))));
  }
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * The same flat XZ triangulation as `createSurfaceGeometry`, with each
 * vertex's world Y then displaced to `floorYAt(x, z)` -- X, Z and UVs are
 * untouched, so plan-view texel density (and tile count) stays exactly what
 * flat mode already uses; only the true, physically real elevation changes.
 * A single-axis linear ramp is a genuinely flat (non-curved) inclined plane,
 * so `computeVertexNormals()` on the displaced mesh yields the exact,
 * uniform tilted normal -- no faceting, no extra tessellation needed.
 * Positioned at world origin (unlike the flat mesh, which is raised via
 * `position={[0, floorY, 0]}`): every vertex already carries its absolute
 * world Y.
 */
export function createSlopedFloorGeometry(
  outline: Outline,
  floorYAt: (x: number, z: number) => number,
  profile?: FloorProfileModel,
  cell?: number,
): THREE.BufferGeometry {
  if(profile?.shelfZone) {
    const parts=splitFloorOutline(outline,profile.axis,profile.shelfZone.slopeStart)
      .map(piece=>createSlopedFloorGeometry(piece,floorYAt,undefined,cell));
    const result=mergeGeometries(parts);
    parts.forEach(part=>part.dispose());
    return result;
  }
  const geometry = createSurfaceGeometry(outline, undefined, cell);
  const position = geometry.getAttribute("position") as THREE.BufferAttribute;
  for (let i = 0; i < position.count; i++) {
    position.setY(i, floorYAt(position.getX(i), position.getZ(i)));
  }
  position.needsUpdate = true;
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Constant-correspondence horizontal ring. Inner and outer outlines must come
 * from the same sampled master outline, so every segment is joined locally
 * instead of allowing a generic polygon triangulator to bridge the opening.
 */
export function createRingGeometry(
  inner: Outline,
  outer: Outline,
  perimeterUvs = false,
  /** Geometry Pass D (Infinity): skip the side starting at this vertex index
   * (Rectangle only -- the caller derives it from `RectangleInfinityZone.side`),
   * leaving an open gap there instead of a closed ring. `null`/`undefined`
   * (every pre-Infinity call site) is byte-identical to before. */
  excludeSide: number | ReadonlySet<number> | null = null,
): THREE.BufferGeometry {
  if (inner.length !== outer.length || inner.length < 3) {
    throw new Error("Ring outlines must have the same vertex count");
  }
  const positions = new Float32Array(inner.length * 6 * 3);
  const uvs = new Float32Array(inner.length * 6 * 2);
  let positionOffset = 0;
  let uvOffset = 0;

  for (let index = 0; index < inner.length; index++) {
    if (typeof excludeSide === "number" ? index === excludeSide : excludeSide?.has(index)) continue;
    const innerA = inner[index]!;
    const innerB = inner[(index + 1) % inner.length]!;
    const outerA = outer[index]!;
    const outerB = outer[(index + 1) % outer.length]!;
    const innerU = index / inner.length;
    const outerU = (index + 1) / inner.length;
    const triangles = [
      [innerA, innerU, 0],
      [outerB, outerU, 1],
      [outerA, innerU, 1],
      [innerA, innerU, 0],
      [innerB, outerU, 0],
      [outerB, outerU, 1],
    ] as const;
    for (const [[x, z], perimeterU, acrossU] of triangles) {
      positions[positionOffset++] = x;
      positions[positionOffset++] = 0;
      positions[positionOffset++] = z;
      uvs[uvOffset++] = perimeterUvs ? perimeterU : x;
      uvs[uvOffset++] = perimeterUvs ? acrossU : z;
    }
  }

  // Trimmed to what was actually written: an excluded side leaves the
  // pre-sized buffers short of the full ring, and the untouched tail must
  // never be submitted as a degenerate zero-position triangle.
  const trimmedPositions = excludeSide === null ? positions : positions.subarray(0, positionOffset);
  const trimmedUvs = excludeSide === null ? uvs : uvs.subarray(0, uvOffset);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(trimmedPositions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(trimmedUvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** Horizontal ring with a small, true-radius bevel along both top edges. */
export function createBeveledRingGeometry(
  inner: Outline,
  outer: Outline,
  radius: number,
  segments = 3,
): THREE.BufferGeometry {
  if (inner.length !== outer.length || inner.length < 3) {
    throw new Error("Ring outlines must have the same vertex count");
  }

  const safeRadius = Math.max(0.0001, radius);
  const safeSegments = Math.max(1, Math.floor(segments));
  const positions: number[] = [];
  const uvs: number[] = [];

  const appendBand = (first: Outline, firstY: number, second: Outline, secondY: number) => {
    for (let index = 0; index < first.length; index++) {
      const firstA = first[index]!;
      const firstB = first[(index + 1) % first.length]!;
      const secondA = second[index]!;
      const secondB = second[(index + 1) % second.length]!;
      const triangles = [
        [firstA, firstY],
        [secondB, secondY],
        [secondA, secondY],
        [firstA, firstY],
        [firstB, firstY],
        [secondB, secondY],
      ] as const;
      for (const [[x, z], y] of triangles) {
        positions.push(x, y, z);
        uvs.push(x, z);
      }
    }
  };

  let previousInner = inner;
  let previousInnerY = -safeRadius;
  for (let step = 1; step <= safeSegments; step++) {
    const angle = (step / safeSegments) * (Math.PI / 2);
    const currentInner = offsetOutline(inner, safeRadius * (1 - Math.cos(angle)));
    const currentY = -safeRadius + safeRadius * Math.sin(angle);
    appendBand(previousInner, previousInnerY, currentInner, currentY);
    previousInner = currentInner;
    previousInnerY = currentY;
  }

  const outerTop = offsetOutline(outer, -safeRadius);
  appendBand(previousInner, 0, outerTop, 0);

  let previousOuter = outerTop;
  let previousOuterY = 0;
  for (let step = 1; step <= safeSegments; step++) {
    const angle = (step / safeSegments) * (Math.PI / 2);
    const currentOuter = offsetOutline(outer, -safeRadius * (1 - Math.sin(angle)));
    const currentY = -safeRadius * (1 - Math.cos(angle));
    appendBand(previousOuter, previousOuterY, currentOuter, currentY);
    previousOuter = currentOuter;
    previousOuterY = currentY;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  return toCreasedNormals(geometry, Math.PI / 3);
}

/** Vertical wall band between y = top and y = bottom following the outline. */
export function createWallGeometry(outline: Outline, top: number, bottom: number) {
  const count = outline.length;
  const positions = new Float32Array(count * 6 * 3);
  const uvs = new Float32Array(count * 6 * 2);

  let perimeter = 0;
  const distances: number[] = [0];
  for (let i = 0; i < count; i++) {
    const [x1, z1] = outline[i]!;
    const [x2, z2] = outline[(i + 1) % count]!;
    perimeter += Math.hypot(x2 - x1, z2 - z1);
    distances.push(perimeter);
  }

  let p = 0;
  let u = 0;
  for (let i = 0; i < count; i++) {
    const [x1, z1] = outline[i]!;
    const [x2, z2] = outline[(i + 1) % count]!;
    const u1 = distances[i]! / perimeter;
    const u2 = distances[i + 1]! / perimeter;

    const quad: ReadonlyArray<readonly [number, number, number, number, number]> = [
      [x1, top, z1, u1, 1],
      [x1, bottom, z1, u1, 0],
      [x2, bottom, z2, u2, 0],
      [x1, top, z1, u1, 1],
      [x2, bottom, z2, u2, 0],
      [x2, top, z2, u2, 1],
    ];

    for (const [px, py, pz, pu, pv] of quad) {
      positions[p++] = px;
      positions[p++] = py;
      positions[p++] = pz;
      uvs[u++] = pu;
      uvs[u++] = pv;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/**
 * Interior wall with a millimetric wall/floor cove. The authoritative outline
 * remains the wall's top/vertical boundary; only the final radius turns inward.
 * Invalid concave offsets fall back to the original sharp wall deterministically.
 *
 * `bottom` is either the usual constant (flat floor -- every call site below
 * that passes a plain number gets byte-for-byte the same geometry as before)
 * or a `(x, z) => number` function for a sloped floor, evaluated per vertex.
 * UV V and the cove's radius-safety margin are still measured against a
 * single global reference height (the deepest/tallest point the wall ever
 * reaches) rather than a locally-varying one: that keeps physical texture
 * density constant everywhere, so a shorter, shallower run of wall simply
 * shows a shorter slice of the same tile instead of a squashed one.
 */
export function createInteriorWallGeometry(
  sourceOutline: Outline,
  top: number,
  bottom: number | ((x: number, z: number) => number),
  radius = 0.005,
  segments = 2,
  openings: readonly WallOpening[] = [],
  /** Underwater lens tessellation (see `UNDERWATER_LENS_SEGMENT`): densify
   * the runs and split the straight band exactly at the waterline and into
   * rows no taller than `maxSegment`. Omitted, the geometry is unchanged. */
  lens: { waterY: number; maxSegment: number } | null = null,
): THREE.BufferGeometry {
  const outline = lens ? densifyOutline(sourceOutline, lens.maxSegment) : sourceOutline;
  const bottomAt = typeof bottom === "function" ? bottom : () => bottom;
  const bottomSamples = outline.map(([x, z]) => bottomAt(x, z));
  // Deepest point: the fixed reference `height`/UV scale is measured against.
  const referenceBottom = Math.min(...bottomSamples);
  // Shallowest point: what actually bounds how large the cove radius may
  // safely be everywhere along the wall.
  const shallowestBottom = Math.max(...bottomSamples);
  const height = top - referenceBottom;
  const minHeight = top - shallowestBottom;
  const safeRadius = Math.min(Math.max(radius, 0), 0.008, minHeight * 0.05);
  const safeSegments = Math.min(3, Math.max(2, Math.floor(segments)));
  const flatFallback = () => createWallGeometry(outline, top, referenceBottom);
  if (outline.length < 3 || !Number.isFinite(height) || minHeight <= 0 || safeRadius < 0.003) {
    return flatFallback();
  }

  const perimeterDistances = [0];
  let perimeter = 0;
  for (let index = 0; index < outline.length; index++) {
    const current = outline[index]!;
    const next = outline[(index + 1) % outline.length]!;
    perimeter += Math.hypot(next[0] - current[0], next[1] - current[1]);
    perimeterDistances.push(perimeter);
  }
  if (!Number.isFinite(perimeter) || perimeter <= 1e-6) {
    return flatFallback();
  }

  // Each layer is a fixed vertical offset from the LOCAL floor at whatever
  // (x, z) a given vertex sits at (the top layer is the one exception: it is
  // always the constant wall-top elevation, never floor-relative).
  type Layer = {
    outline: Outline;
    offsetFromBottom: number | null;
    /** Explicit elevation of an intermediate straight (lens) row. */
    yAt?: (x: number, z: number) => number;
  };
  const straightRows: Layer[] = [];
  if (lens) {
    const lowerAt = (x: number, z: number) => bottomAt(x, z) + safeRadius;
    const hasWaterRow = lens.waterY < top - 1e-4;
    // Exactly at the waterline wherever it crosses the straight band, so the
    // dry (unrefracted) and submerged (refracted) parts meet on a vertex row.
    const startAt = (x: number, z: number) => {
      if (!hasWaterRow) return top;
      const lower = lowerAt(x, z);
      return lens.waterY > lower + 1e-3 ? lens.waterY : (top + lower) / 2;
    };
    if (hasWaterRow) straightRows.push({ outline, offsetFromBottom: null, yAt: startAt });
    const submergedHeight = Math.min(top, lens.waterY) - (referenceBottom + safeRadius);
    const rows = Math.max(1, Math.ceil(submergedHeight / lens.maxSegment));
    for (let row = 1; row < rows; row++) {
      straightRows.push({
        outline,
        offsetFromBottom: null,
        yAt: (x, z) => THREE.MathUtils.lerp(startAt(x, z), lowerAt(x, z), row / rows),
      });
    }
  }
  const straightBands = 1 + straightRows.length;
  const layers: Layer[] = [
    { outline, offsetFromBottom: null },
    ...straightRows,
    { outline, offsetFromBottom: safeRadius },
  ];
  for (let step = 1; step <= safeSegments; step++) {
    const angle = (step / safeSegments) * (Math.PI / 2);
    const inset = safeRadius * (1 - Math.cos(angle));
    const insetOutline = offsetOutline(outline, -inset);
    if (
      insetOutline.length !== outline.length ||
      insetOutline.some((point) => !point.every(Number.isFinite))
    ) {
      return flatFallback();
    }
    layers.push({ outline: insetOutline, offsetFromBottom: safeRadius * (1 - Math.sin(angle)) });
  }
  const layerY = (layer: Layer, x: number, z: number): number =>
    layer.yAt
      ? layer.yAt(x, z)
      : layer.offsetFromBottom === null ? top : bottomAt(x, z) + layer.offsetFromBottom;

  const positions: number[] = [];
  const uvs: number[] = [];
  for (let layer = 0; layer < layers.length - 1; layer++) {
    const upper = layers[layer]!;
    const lower = layers[layer + 1]!;
    for (let index = 0; index < outline.length; index++) {
      const next = (index + 1) % outline.length;
      const upperA = upper.outline[index]!;
      const upperB = upper.outline[next]!;
      const lowerA = lower.outline[index]!;
      const lowerB = lower.outline[next]!;
      const upperAY = layerY(upper, upperA[0], upperA[1]);
      const upperBY = layerY(upper, upperB[0], upperB[1]);
      const lowerAY = layerY(lower, lowerA[0], lowerA[1]);
      const lowerBY = layerY(lower, lowerB[0], lowerB[1]);
      const u1 = perimeterDistances[index]! / perimeter;
      const u2 = perimeterDistances[index + 1]! / perimeter;
      const upperAV = (upperAY - referenceBottom) / height;
      const upperBV = (upperBY - referenceBottom) / height;
      const lowerAV = (lowerAY - referenceBottom) / height;
      const lowerBV = (lowerBY - referenceBottom) / height;
      // Only the straight vertical band intersects the skimmers. Split it
      // at the aperture boundaries; retain physical holes in raster and shadows.
      if (layer < straightBands && openings.length) {
        const dx = upperB[0] - upperA[0];
        const dz = upperB[1] - upperA[1];
        const holes = openings.flatMap((opening) => {
          const c = Math.cos(opening.rotation);
          const s = Math.sin(opening.rotation);
          const ax = upperA[0] - opening.x;
          const az = upperA[1] - opening.z;
          const bx = upperB[0] - opening.x;
          const bz = upperB[1] - opening.z;
          const localA = ax * c - az * s;
          const localB = bx * c - bz * s;
          // Reject other walls; permit the small chord error of curved outlines.
          if (
            Math.min(Math.abs(ax * s + az * c), Math.abs(bx * s + bz * c)) > 0.035 ||
            Math.abs(localB - localA) < 1e-8
          )
            return [];
          const t0 = (-opening.width / 2 - localA) / (localB - localA);
          const t1 = (opening.width / 2 - localA) / (localB - localA);
          const a = Math.max(0, Math.min(t0, t1));
          const b = Math.min(1, Math.max(t0, t1));
          return b > a ? [{ a, b, top: opening.top, bottom: opening.bottom }] : [];
        });
        const cuts = [...new Set([0, 1, ...holes.flatMap((h) => [h.a, h.b])])].sort(
          (a, b) => a - b,
        );
        // The opening itself is always narrow relative to the whole wall run,
        // so the local floor barely moves across it -- interpolating the
        // upper/lower Y at each cut's own midpoint (rather than reusing a
        // single value across the whole opening) is exact for a constant-Y
        // wall and a close approximation for a gently sloped one.
        const append = (a: number, b: number, upper: (t:number)=>number, lower: (t:number)=>number) => {
          if (upper((a+b)/2) - lower((a+b)/2) < 1e-8) return;
          for (const [t, y] of [
            [a, upper(a)],
            [a, lower(a)],
            [b, lower(b)],
            [a, upper(a)],
            [b, lower(b)],
            [b, upper(b)],
          ]) {
            positions.push(upperA[0] + dx * t!, y!, upperA[1] + dz * t!);
            uvs.push(THREE.MathUtils.lerp(u1, u2, t!), (y! - referenceBottom) / height);
          }
        };
        for (let i = 0; i < cuts.length - 1; i++) {
          const a = cuts[i]!;
          const b = cuts[i + 1]!;
          const mid = (a + b) / 2;
          const upperAt = (t:number) => THREE.MathUtils.lerp(upperAY, upperBY, t);
          const lowerAt = (t:number) => THREE.MathUtils.lerp(lowerAY, lowerBY, t);
          const hole = holes.find((h) => mid >= h.a && mid <= h.b);
          if (hole) {
            // Clamped to this band, which with lens rows may lie wholly
            // above, below or inside the aperture.
            append(a, b, upperAt, t=>Math.max(lowerAt(t), Math.min(upperAt(t), hole.top)));
            append(a, b, t=>Math.min(upperAt(t), Math.max(lowerAt(t), hole.bottom)), lowerAt);
          } else append(a, b, upperAt, lowerAt);
        }
        continue;
      }
      const triangles = [
        [upperA, upperAY, u1, upperAV],
        [lowerA, lowerAY, u1, lowerAV],
        [lowerB, lowerBY, u2, lowerBV],
        [upperA, upperAY, u1, upperAV],
        [lowerB, lowerBY, u2, lowerBV],
        [upperB, upperBY, u2, upperBV],
      ] as const;
      for (const [[x, z], y, u, v] of triangles) {
        positions.push(x, y, z);
        uvs.push(u, v);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  // Aperture tessellation is variable; geometric normals with crease-aware
  // smoothing preserve the cove and sharp architectural corners.
  if (openings.length) return toCreasedNormals(geometry, Math.PI / 3);

  // Smooth only across the tiny vertical-to-horizontal radius. Each outline
  // segment keeps its own normal set, so true wall corners remain planar/hard.
  const computedNormals = geometry.getAttribute("normal");
  const smoothedNormals = new Float32Array(computedNormals.count * 3);
  const bandCount = layers.length - 1;
  const faceNormals = Array.from({ length: bandCount }, (_, band) =>
    Array.from({ length: outline.length }, (_, index) => {
      const vertex = (band * outline.length + index) * 6;
      return new THREE.Vector3(
        computedNormals.getX(vertex),
        computedNormals.getY(vertex),
        computedNormals.getZ(vertex),
      );
    }),
  );
  const writeNormal = (vertex: number, normal: THREE.Vector3) => {
    smoothedNormals[vertex * 3] = normal.x;
    smoothedNormals[vertex * 3 + 1] = normal.y;
    smoothedNormals[vertex * 3 + 2] = normal.z;
  };
  const radialNormal = (band: number, index: number, boundary: "upper" | "lower") => {
    const face = faceNormals[band]![index]!;
    const neighbourBand = boundary === "upper" ? band - 1 : band + 1;
    if (neighbourBand < 0 || neighbourBand >= bandCount) return face;
    return face.clone().add(faceNormals[neighbourBand]![index]!).normalize();
  };
  const smoothNearTangentCorner = (normal: THREE.Vector3, neighbour: THREE.Vector3) =>
    normal.dot(neighbour) > 0.94 ? normal.clone().add(neighbour).normalize() : normal;
  for (let band = 0; band < bandCount; band++) {
    for (let index = 0; index < outline.length; index++) {
      const previous = (index - 1 + outline.length) % outline.length;
      const next = (index + 1) % outline.length;
      const upper = radialNormal(band, index, "upper");
      const lower = radialNormal(band, index, "lower");
      const upperA = smoothNearTangentCorner(upper, radialNormal(band, previous, "upper"));
      const upperB = smoothNearTangentCorner(upper, radialNormal(band, next, "upper"));
      const lowerA = smoothNearTangentCorner(lower, radialNormal(band, previous, "lower"));
      const lowerB = smoothNearTangentCorner(lower, radialNormal(band, next, "lower"));
      const vertex = (band * outline.length + index) * 6;
      writeNormal(vertex, upperA);
      writeNormal(vertex + 1, lowerA);
      writeNormal(vertex + 2, lowerB);
      writeNormal(vertex + 3, upperA);
      writeNormal(vertex + 4, lowerB);
      writeNormal(vertex + 5, upperB);
    }
  }
  geometry.setAttribute("normal", new THREE.BufferAttribute(smoothedNormals, 3));
  return geometry;
}

/** Closed line loop used for measurement guides. */
export function outlineToPoints(outline: Outline, y: number): THREE.Vector3[] {
  const points = outline.map(([x, z]) => new THREE.Vector3(x, y, z));
  if (points[0]) points.push(points[0].clone());
  return points;
}
