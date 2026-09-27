import * as THREE from "three";
import type { InfinityEdgeDimensions, RectangleInfinityZone } from "@/lib/pool/infinity-edge";
import { offsetOutline } from "@/lib/pool/geometry";
import type { Outline } from "@/lib/pool/types";

/** Construction and water share these elevations; the rim is above the receiver. */
export function infinityContainmentLevels(dims: InfinityEdgeDimensions, waterY: number) {
  const receiverY = waterY - dims.dropHeight;
  return { crestY: waterY - 0.006, receiverY, rimY: receiverY + 0.045,
    floorY: receiverY - dims.catchBasinDepth, baseY: receiverY - dims.catchBasinDepth - 0.08 };
}

/** Trim by arc length, not a bounding box: curved and custom boundaries retain their normals. */
export function insetInfinityWaterZone(zone: RectangleInfinityZone, inset: number): RectangleInfinityZone {
  const lengths = [0];
  for (let i = 1; i < zone.points.length; i++) lengths.push(lengths[i - 1]! + Math.hypot(zone.points[i]![0] - zone.points[i - 1]![0], zone.points[i]![1] - zone.points[i - 1]![1]));
  const total = lengths[lengths.length - 1]!;
  const margin = Math.min(inset, total * 0.1);
  const at = (distance: number) => {
    let i = 0;
    while (i < lengths.length - 2 && lengths[i + 1]! < distance) i++;
    const t = (distance - lengths[i]!) / (lengths[i + 1]! - lengths[i]!);
    const a = zone.points[i]!, b = zone.points[i + 1]!;
    const n = new THREE.Vector2(...zone.pointNormals[i]!).lerp(new THREE.Vector2(...zone.pointNormals[i + 1]!), t).normalize();
    return { p: [THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t)] as const, n: [n.x, n.y] as const };
  };
  const first = at(margin), last = at(total - margin);
  const points = [first.p], normals = [first.n];
  for (let i = 1; i < lengths.length - 1; i++) if (lengths[i]! > margin && lengths[i]! < total - margin) { points.push(zone.points[i]!); normals.push(zone.pointNormals[i]!); }
  points.push(last.p); normals.push(last.n);
  return { ...zone, start: first.p, end: last.p, points, pointNormals: normals, length: total - 2 * margin };
}

/** One closed swept section: crest, wet wall, real channel floor/underside,
 * outer wall/rim and solid end returns. No overlapping box primitives. */
export function createInfinityContainmentGeometry(
  zone: RectangleInfinityZone, dims: InfinityEdgeDimensions, waterY: number,
  returnWidth: number, copingY: number, outline?: Outline,
) {
  const levels = infinityContainmentLevels(dims, waterY);
  type Station = { point: readonly [number, number]; normal: readonly [number, number]; solid: boolean; terminal: boolean };
  const startN = zone.pointNormals[0]!, endN = zone.pointNormals[zone.pointNormals.length - 1]!;
  const stations: Station[] = [
    { point: [zone.start[0] + startN[1] * returnWidth, zone.start[1] - startN[0] * returnWidth], normal: startN, solid: true, terminal: true },
    { point: zone.start, normal: startN, solid: true, terminal: false },
    ...zone.points.map((point, i) => ({ point, normal: zone.pointNormals[i]!, solid: false, terminal: false })),
    { point: zone.end, normal: endN, solid: true, terminal: false },
    { point: [zone.end[0] - endN[1] * returnWidth, zone.end[1] + endN[0] * returnWidth], normal: endN, solid: true, terminal: true },
  ];
  if (outline) {
    const corners = offsetOutline(outline, returnWidth);
    const start = corners[zone.side]!, end = corners[(zone.side + zone.points.length - 1) % outline.length]!;
    const startReturn = [start[0] - startN[0] * returnWidth, start[1] - startN[1] * returnWidth] as const;
    const endReturn = [end[0] - endN[0] * returnWidth, end[1] - endN[1] * returnWidth] as const;
    // A smooth arc has no miter setback. Retain a real end-wall thickness
    // instead of collapsing its solid terminal section to a zero-length sweep.
    if (Math.hypot(startReturn[0] - zone.start[0], startReturn[1] - zone.start[1]) > 0.1) stations[0]!.point = startReturn;
    if (Math.hypot(endReturn[0] - zone.end[0], endReturn[1] - zone.end[1]) > 0.1) stations[stations.length - 1]!.point = endReturn;
  }
  const profile = (s: Station) => {
    // The return closes the channel in plan; it must not flare the wet wall
    // into a wedge or raise a little pier above the continuous spill crest.
    const lip = dims.lipWidth;
    const top = levels.crestY;
    const floor = s.solid ? levels.rimY : levels.floorY;
    // The independent receiver shell must not duplicate the liner wall at
    // offset zero. Its inner face sits within the wall build-up instead.
    const back = 0.004;
    return [[back, top], [lip, top], [lip, levels.rimY], [lip, floor],
      [dims.lipWidth + dims.catchBasinWidth, floor], [dims.lipWidth + dims.catchBasinWidth, levels.rimY],
      [dims.lipWidth + dims.catchBasinWidth + dims.wallThickness, levels.rimY],
      [dims.lipWidth + dims.catchBasinWidth + dims.wallThickness, levels.baseY], [back, levels.baseY]] as const;
  };
  const vertex = (s: Station, p: readonly [number, number]) => new THREE.Vector3(s.point[0] + s.normal[0] * p[0], p[1], s.point[1] + s.normal[1] * p[0]);
  const positions: number[] = [], uvs: number[] = [], wetRoles: number[] = [];
  const triangle = (a: THREE.Vector3, b: THREE.Vector3, c: THREE.Vector3, wetRole = 0) => {
    const normal = b.clone().sub(a).cross(c.clone().sub(a));
    if (normal.lengthSq() < 1e-16) return;
    const useX = Math.abs(normal.x) < Math.abs(normal.z);
    const horizontal = Math.abs(normal.y) > Math.max(Math.abs(normal.x), Math.abs(normal.z));
    for (const p of [a, b, c]) { positions.push(p.x, p.y, p.z); wetRoles.push(wetRole); uvs.push(horizontal ? p.x : useX ? p.x : p.z, horizontal ? p.z : p.y); }
  };
  for (let i = 0; i < stations.length - 1; i++) {
    const a = stations[i]!, b = stations[i + 1]!, pa = profile(a), pb = profile(b);
    for (let j = 0; j < pa.length; j++) {
      const k = (j + 1) % pa.length;
      const v0 = vertex(a, pa[j]!), v1 = vertex(b, pb[j]!), v2 = vertex(b, pb[k]!), v3 = vertex(a, pa[k]!);
      const wetRole = (j === 1 || j === 2) && !a.solid && !b.solid ? 1 : (j === 3 || j === 4) ? 2 : 0;
      triangle(v0, v1, v2, wetRole); triangle(v0, v2, v3, wetRole);
    }
  }
  for (const [s, reverse] of [[stations[0]!, false], [stations[stations.length - 1]!, true]] as const) {
    const points = profile(s).filter((p, i, all) => i === 0 || p[0] !== all[i - 1]![0] || p[1] !== all[i - 1]![1]);
    const triangles = THREE.ShapeUtils.triangulateShape(points.map(p => new THREE.Vector2(...p)), []);
    for (const [a, b, c] of triangles) {
      const v = [vertex(s, points[a!]!), vertex(s, points[b!]!), vertex(s, points[c!]!)];
      triangle(v[0]!, v[reverse ? 2 : 1]!, v[reverse ? 1 : 2]!);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("wetRole", new THREE.Float32BufferAttribute(wetRoles, 1));
  geometry.computeVertexNormals();
  return geometry;
}
