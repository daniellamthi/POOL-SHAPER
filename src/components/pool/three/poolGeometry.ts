import * as THREE from "three";
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

/** Closed line loop used for measurement guides. */
export function outlineToPoints(outline: Outline, y: number): THREE.Vector3[] {
  const points = outline.map(([x, z]) => new THREE.Vector3(x, y, z));
  if (points[0]) points.push(points[0].clone());
  return points;
}
