import { Matrix4, Vector3, type BufferGeometry } from "three";
import type { Outline } from "@/lib/pool/types";

export type PlanPoint = [number, number, number];

/** Upper-face boundaries, not a wireframe. Weld position seams (UVs/normals
 * split vertices), cancel coplanar triangulation and keep real level changes.
 * World Y is retained so opaque higher solids correctly occlude lower edges. */
export function architecturalEdges(geometry: BufferGeometry, matrix = new Matrix4()): PlanPoint[] {
  const positions = geometry.getAttribute("position");
  if (!positions) return [];
  const index = geometry.index;
  const edges = new Map<string, { a: Vector3; b: Vector3; normals: Vector3[] }>();
  const key = (v: Vector3) => [v.x, v.y, v.z].map(n => Math.round(n * 100000)).join(",");
  const count = index?.count ?? positions.count;
  for (let i = 0; i < count; i += 3) {
    const vertices = [0, 1, 2].map(j => new Vector3().fromBufferAttribute(positions, index ? index.getX(i + j) : i + j).applyMatrix4(matrix));
    const [a, b, c] = vertices as [Vector3, Vector3, Vector3];
    const normal = b.clone().sub(a).cross(c.clone().sub(a)).normalize();
    if (normal.y < 0.65) continue; // no undersides, vertical risers or tiny bevel facets
    vertices.forEach((start, j) => {
      const end = vertices[(j + 1) % 3]!;
      const id = [key(start), key(end)].sort().join("|");
      const edge = edges.get(id);
      if (edge) edge.normals.push(normal);
      else edges.set(id, { a: start, b: end, normals: [normal] });
    });
  }
  return [...edges.values()].filter(edge =>
    edge.normals.length === 1 || edge.normals.some(n => n.dot(edge.normals[0]!) < 0.999),
  ).flatMap(({ a, b }) => [
    [a.x, a.y + 0.006, a.z] as PlanPoint,
    [b.x, b.y + 0.006, b.z] as PlanPoint,
  ]);
}

/** Fit actual construction bounds into the unobscured viewport, in metres.
 * A minimum pixel margin keeps small/mobile pools legible without clipping. */
export function architecturalFrustum(outline: Outline, width: number, height: number,
  frame: { left: number; top: number; width: number; height: number }) {
  const xs = outline.map(p => p[0]), zs = outline.map(p => p[1]);
  const minX = Math.min(...xs), maxX = Math.max(...xs), minZ = Math.min(...zs), maxZ = Math.max(...zs);
  const margin = Math.min(36, Math.max(18, frame.width * 0.06));
  const scale = Math.max((maxX - minX + 0.5) / Math.max(1, frame.width - 2 * margin),
    (maxZ - minZ + 0.5) / Math.max(1, frame.height - 2 * margin));
  return { width: width * scale, height: height * scale,
    centre: [(minX + maxX) / 2 - (frame.left + frame.width / 2 - width / 2) * scale,
      (minZ + maxZ) / 2 - (frame.top + frame.height / 2 - height / 2) * scale] as const };
}
