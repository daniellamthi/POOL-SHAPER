import * as THREE from "three";
import { TessellateModifier } from "three/addons/modifiers/TessellateModifier.js";
import { mergeVertices } from "three/addons/utils/BufferGeometryUtils.js";
import type { Outline } from "@/lib/pool/types";
import { clampInfinityEdgeDimensions, type RectangleInfinityZone } from "@/lib/pool/infinity-edge";
import { offsetOutline } from "@/lib/pool/geometry";
import { createSurfaceGeometry, createRingGeometry } from "./poolGeometry";

const smooth = (a: number, b: number, x: number) => THREE.MathUtils.smoothstep(x, a, b);

/** Level, supported paving on the usable sides. It must not drape over the grade. */
export function createInfinityDeck(
  outline: Outline,
  zone: RectangleInfinityZone,
  innerOffset: number,
) {
  const inner = offsetOutline(outline, innerOffset);
  const outer = [...offsetOutline(outline, 2)];
  const excluded = new Set(
    zone.points.slice(0, -1).map((_, i) => (zone.side + i) % outline.length),
  );
  for (const [index, normal, point] of [
    [zone.side, zone.pointNormals[0]!, zone.start],
    [
      (zone.side + zone.points.length - 1) % outline.length,
      zone.pointNormals[zone.pointNormals.length - 1]!,
      zone.end,
    ],
  ] as const) {
    const p = outer[index]!;
    const excess = (p[0] - point[0]) * normal[0] + (p[1] - point[1]) * normal[1] - innerOffset;
    outer[index] = [p[0] - normal[0] * excess, p[1] - normal[1] * excess];
  }
  const top = createRingGeometry(inner, outer, false, excluded);
  const positions = Array.from(top.getAttribute("position").array);
  const uvs = Array.from(top.getAttribute("uv").array);
  top.dispose();
  const wall = (a: readonly [number, number], b: readonly [number, number], endReturn = false) => {
    const dims = clampInfinityEdgeDimensions(undefined);
    const bottom = endReturn ? -(dims.dropHeight + dims.catchBasinDepth + 0.1) : -0.08;
    // The grade is curved near the end returns. A single endpoint-to-endpoint
    // bottom chord cuts through it, exposing triangular gaps during orbit.
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const segments = Math.max(1, Math.ceil(length / 0.25));
    for (let i = 0; i < segments; i++) {
      const start = i / segments, end = (i + 1) / segments;
      const p: readonly [number, number] = [THREE.MathUtils.lerp(a[0], b[0], start), THREE.MathUtils.lerp(a[1], b[1], start)];
      const q: readonly [number, number] = [THREE.MathUtils.lerp(a[0], b[0], end), THREE.MathUtils.lerp(a[1], b[1], end)];
      const py = Math.min(bottom, infinityGroundHeight(outline, zone, p[0], p[1]) - 0.06);
      const qy = Math.min(bottom, infinityGroundHeight(outline, zone, q[0], q[1]) - 0.06);
      for (const [point, y, u] of [[p, 0, start], [q, qy, end], [q, 0, end], [p, 0, start], [p, py, start], [q, qy, end]] as const) {
        positions.push(point[0], y, point[1]);
        uvs.push(u * length, y);
      }
    }
  };
  for (let i = 0; i < outline.length; i++)
    if (!excluded.has(i)) wall(outer[i]!, outer[(i + 1) % outline.length]!);
  wall(inner[zone.side]!, outer[zone.side]!, true);
  const end = (zone.side + zone.points.length - 1) % outline.length;
  wall(outer[end]!, inner[end]!, true);
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
  geometry.computeVertexNormals();
  return geometry;
}

/** A continuous local grade, not a global half-plane cut through another arm. */
export function infinityGroundHeight(
  outline: Outline,
  zone: RectangleInfinityZone,
  x: number,
  z: number,
) {
  let nearest = Infinity,
    outward = 0,
    endDistance = 0;
  for (let i = 0; i < zone.points.length - 1; i++) {
    const a = zone.points[i]!,
      b = zone.points[i + 1]!;
    const dx = b[0] - a[0],
      dz = b[1] - a[1],
      len2 = dx * dx + dz * dz;
    const raw = ((x - a[0]) * dx + (z - a[1]) * dz) / len2;
    const t = THREE.MathUtils.clamp(raw, 0, 1);
    const px = x - a[0] - t * dx,
      pz = z - a[1] - t * dz;
    const distance = Math.hypot(px, pz);
    if (distance < nearest) {
      nearest = distance;
      const na = zone.pointNormals[i]!,
        nb = zone.pointNormals[i + 1]!;
      const nx = THREE.MathUtils.lerp(na[0], nb[0], t),
        nz = THREE.MathUtils.lerp(na[1], nb[1], t);
      outward = (px * nx + pz * nz) / Math.hypot(nx, nz);
      endDistance = Math.max(0, -raw, raw - 1) * Math.sqrt(len2);
    }
  }
  let otherWallDistance = Infinity;
  const selected = new Set(
    zone.points.slice(0, -1).map((_, i) => (zone.side + i) % outline.length),
  );
  for (let i = 0; i < outline.length; i++) {
    if (selected.has(i)) continue;
    const a = outline[i]!,
      b = outline[(i + 1) % outline.length]!;
    const dx = b[0] - a[0],
      dz = b[1] - a[1];
    const t = THREE.MathUtils.clamp(
      ((x - a[0]) * dx + (z - a[1]) * dz) / (dx * dx + dz * dz),
      0,
      1,
    );
    otherWallDistance = Math.min(
      otherWallDistance,
      Math.hypot(x - a[0] - t * dx, z - a[1] - t * dz),
    );
  }
  const dims = clampInfinityEdgeDimensions(undefined);
  const lowerGrade = dims.dropHeight + dims.catchBasinDepth + 0.08;
  const influence =
    smooth(0.05, 0.32, outward) *
    (1 - smooth(0, 2.5 + Math.max(0, outward), endDistance)) *
    smooth(-0.3, -0.05, otherWallDistance - nearest);
  const localGrade = -influence * (lowerGrade + 0.8 * smooth(1, 14, outward));
  return THREE.MathUtils.lerp(
    localGrade,
    -1.8,
    smooth(5, 12, Math.min(nearest, otherWallDistance)),
  );
}

/** One watertight ground sheet: shared vertices, one basin opening, no sunken box. */
export function createInfinityLandscape(
  outline: Outline,
  zone: RectangleInfinityZone,
  size: number,
  offset: number,
) {
  const half = size / 2;
  const base = createSurfaceGeometry(
    [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ],
    offsetOutline(outline, offset),
  );
  // Construction-time only. No frame-time terrain work and no added draw calls.
  const split = new TessellateModifier(0.7, 24).modify(base);
  base.dispose();
  const geometry = mergeVertices(split);
  split.dispose();
  const p = geometry.getAttribute("position");
  const colors = new Float32Array(p.count * 3);
  const stone = new THREE.Color("#f0ece2"),
    earth = new THREE.Color("#a8ad98"),
    color = new THREE.Color();
  for (let i = 0; i < p.count; i++) {
    const y = infinityGroundHeight(outline, zone, p.getX(i), p.getZ(i));
    p.setY(i, y);
    color.copy(stone).lerp(earth, smooth(0.25, 1, -y));
    color.toArray(colors, i * 3);
  }
  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  return geometry;
}
