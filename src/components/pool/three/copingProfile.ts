import * as THREE from "three";
import type { Outline } from "@/lib/pool/types";

export const copingNoseRadius = (thickness: number) => Math.min(.014, thickness * .3);

/** Rounded stone nose, with narrow joints: perimeter and joint radii are
 * independent, so a softer border does not open centimetre-wide slab gaps. */
export function copingProfile(polygon: Outline, stations: number, thickness: number, noseRadius?: number) {
  const count = polygon.length;
  const area = polygon.reduce((sum, p, i) => {
    const q = polygon[(i + 1) % count]!;
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  const sign = area > 0 ? 1 : -1;
  const radius = noseRadius ?? copingNoseRadius(thickness);
  const edges = polygon.map((p, i) => {
    const q = polygon[(i + 1) % count]!;
    const length = Math.hypot(q[0] - p[0], q[1] - p[1]);
    return {
      x: -(q[1] - p[1]) / length * sign,
      z: (q[0] - p[0]) / length * sign,
      // Only the water-facing edge has the broad rounded nose. The rear
      // arris meets the paving with a narrow joint, without a deep groove.
      radius: i < stations - 1 ? radius : .0018,
    };
  });
  const ring = (easing: number, y: number, lower = false) => polygon.map((p, i) => {
    const a = edges[(i + count - 1) % count]!, b = edges[i]!;
    const da = .0004 + (lower ? Math.min(.0018, a.radius) : a.radius) * easing;
    const db = .0004 + (lower ? Math.min(.0018, b.radius) : b.radius) * easing;
    const determinant = a.x * b.z - a.z * b.x;
    const dx = Math.abs(determinant) < 1e-8 ? b.x * db : (da * b.z - a.z * db) / determinant;
    const dz = Math.abs(determinant) < 1e-8 ? b.z * db : (a.x * db - da * b.x) / determinant;
    const localRadius = Math.max(a.radius, b.radius);
    return new THREE.Vector3(p[0] + dx, lower ? y : y * localRadius / radius, p[1] + dz);
  });
  const rings: THREE.Vector3[][] = [];
  const bottom = -thickness + .0012;
  const segments = 6;
  // Quarter-circle nose: horizontal top tangent, vertical fascia tangent.
  for (let i = 0; i <= segments; i++) {
    const angle = i / segments * Math.PI / 2;
    rings.push(ring(1 - Math.sin(angle), -radius + radius * Math.cos(angle)));
  }
  for (let i = segments; i >= 0; i--) {
    const angle = i / segments * Math.PI / 2;
    // The underside is bedded flat: rounding it like the upper nose left
    // an open-looking recess at the paving junction.
    rings.push(ring(1 - Math.sin(angle), bottom + .0018 - .0018 * Math.cos(angle), true));
  }
  const vertices: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3) => vertices.push(...a.toArray(), ...b.toArray(), ...c.toArray());
  for (let r = 0; r < rings.length - 1; r++) for (let i = 0; i < count; i++) {
    const j = (i + 1) % count;
    const a = rings[r]![i]!, b = rings[r]![j]!, c = rings[r + 1]![j]!, d = rings[r + 1]![i]!;
    if (sign > 0) { triangle(a, b, c); triangle(a, c, d); }
    else { triangle(a, c, b); triangle(a, d, c); }
  }
  for (const [r, up] of [[0, true], [rings.length - 1, false]] as const) {
    const cap = rings[r]!;
    for (const face of THREE.ShapeUtils.triangulateShape(cap.map(p => new THREE.Vector2(p.x, p.z)), [])) {
      const a = cap[face[0]!]!, b = cap[face[1]!]!, c = cap[face[2]!]!;
      const normalY = b.clone().sub(a).cross(c.clone().sub(a)).y;
      if ((normalY > 0) === up) triangle(a, b, c); else triangle(a, c, b);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  const uv: number[] = [];
  for (let i = 0; i < vertices.length; i += 3) uv.push(vertices[i]!, vertices[i + 2]!);
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geometry.computeVertexNormals();
  return geometry;
}
