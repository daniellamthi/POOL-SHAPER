import * as THREE from "three";
import { offsetOutline } from "../../../lib/pool/geometry";
import type { Outline } from "../../../lib/pool/types";

/** Flat, horizontal (XZ) surface filling the outline. */
export function createSurfaceGeometry(outline: Outline, hole?: Outline): THREE.BufferGeometry {
  const shape = new THREE.Shape(outline.map(([x, y]) => new THREE.Vector2(x, y)));
  if (hole) {
    shape.holes.push(new THREE.Path(hole.map(([x, y]) => new THREE.Vector2(x, y))));
  }
  const geometry = new THREE.ShapeGeometry(shape);
  geometry.rotateX(-Math.PI / 2);
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
): THREE.BufferGeometry {
  if (inner.length !== outer.length || inner.length < 3) {
    throw new Error("Ring outlines must have the same vertex count");
  }
  const positions = new Float32Array(inner.length * 6 * 3);
  const uvs = new Float32Array(inner.length * 6 * 2);
  let positionOffset = 0;
  let uvOffset = 0;

  for (let index = 0; index < inner.length; index++) {
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

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.BufferAttribute(uvs, 2));
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
    const currentOuter = offsetOutline(outer, -safeRadius * Math.cos(angle));
    const currentY = -safeRadius * Math.sin(angle);
    appendBand(previousOuter, previousOuterY, currentOuter, currentY);
    previousOuter = currentOuter;
    previousOuterY = currentY;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();

  return geometry;
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
 */
export function createInteriorWallGeometry(
  outline: Outline,
  top: number,
  bottom: number,
  radius = 0.005,
  segments = 2,
): THREE.BufferGeometry {
  const height = top - bottom;
  const safeRadius = Math.min(Math.max(radius, 0), 0.008, height * 0.05);
  const safeSegments = Math.min(3, Math.max(2, Math.floor(segments)));
  if (outline.length < 3 || !Number.isFinite(height) || height <= 0 || safeRadius < 0.003) {
    return createWallGeometry(outline, top, bottom);
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
    return createWallGeometry(outline, top, bottom);
  }

  const layers: Array<{ outline: Outline; y: number }> = [
    { outline, y: top },
    { outline, y: bottom + safeRadius },
  ];
  for (let step = 1; step <= safeSegments; step++) {
    const angle = (step / safeSegments) * (Math.PI / 2);
    const inset = safeRadius * (1 - Math.cos(angle));
    const insetOutline = offsetOutline(outline, -inset);
    if (
      insetOutline.length !== outline.length ||
      insetOutline.some((point) => !point.every(Number.isFinite))
    ) {
      return createWallGeometry(outline, top, bottom);
    }
    layers.push({ outline: insetOutline, y: bottom + safeRadius * (1 - Math.sin(angle)) });
  }

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
      const u1 = perimeterDistances[index]! / perimeter;
      const u2 = perimeterDistances[index + 1]! / perimeter;
      const upperV = (upper.y - bottom) / height;
      const lowerV = (lower.y - bottom) / height;
      const triangles = [
        [upperA, upper.y, u1, upperV],
        [lowerA, lower.y, u1, lowerV],
        [lowerB, lower.y, u2, lowerV],
        [upperA, upper.y, u1, upperV],
        [lowerB, lower.y, u2, lowerV],
        [upperB, upper.y, u2, upperV],
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
