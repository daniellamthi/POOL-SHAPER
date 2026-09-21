import * as THREE from "three";
import { mergeGeometries, toCreasedNormals } from "three/addons/utils/BufferGeometryUtils.js";
import type { Outline, OverflowType, SkimmerTypeId, SystemType } from "@/lib/pool/types";
import { offsetOutline } from "@/lib/pool/geometry";
import { OVERFLOW_GEOMETRY } from "@/lib/pool/config";
import { clampInfinityEdgeDimensions } from "@/lib/pool/infinity-edge";
import type { RectangleInfinityZone } from "@/lib/pool/infinity-edge";

/** Architectural presentation only; never changes basin dimensions or quotation logic. */
export function copingOuterOffset(system: SystemType, overflow: OverflowType) {
  // The deck meets the grille directly: no separate masonry border.
  if (system === "overflow" && overflow === "visible")
    return OVERFLOW_GEOMETRY.visibleChannelOuterOffset;
  return 0.32 + (system === "overflow" ? OVERFLOW_GEOMETRY.hiddenChannelOffset : 0);
}

/**
 * Geometry Pass D (Infinity): the deck's own cutout normally clears the pool
 * by a uniform `copingOuterOffset` on every side -- fine everywhere except
 * the Infinity side, whose real assembly (lip + catch basin, out to
 * `lipWidth + catchBasinWidth + wallThickness`) reaches well past that
 * uniform offset. Left uniform, the deck's own opaque floor plane simply
 * covers the outer half of the catch basin, hiding its far wall/floor/end
 * walls under solid deck with no visible drop or basin at all -- not a
 * camera problem, a real occlusion bug. Steps just that one side's cutout
 * edge out to clear the assembly, inserting two extra vertices so the other
 * 3 sides and every corner stay exactly the plain uniform offset (a single
 * rectangular notch, not a diagonal/mitred re-offset of the whole outline).
 * `zone` `null` (every pre-Infinity call, or Infinity with no side chosen
 * yet) returns the plain uniform-offset outline, byte-identical to before.
 */
export function buildDeckCutoutOutline(
  outline: Outline,
  baseOffset: number,
  zone: RectangleInfinityZone | null,
): Outline {
  const base = offsetOutline(outline, baseOffset);
  if (!zone || base.length !== outline.length) return base;
  const dims = clampInfinityEdgeDimensions(undefined);
  const reach = dims.lipWidth + dims.catchBasinWidth + dims.wallThickness;
  const extra = reach - baseOffset;
  if (!(extra > 1e-6)) return base;
  const n = base.length;
  const i = zone.side;
  const j = (i + 1) % n;
  const pushOut = (p: readonly [number, number]): [number, number] => [
    p[0] + zone.normal[0] * extra,
    p[1] + zone.normal[1] * extra,
  ];
  const result: Array<readonly [number, number]> = [];
  for (let k = 0; k < n; k++) {
    result.push(base[k]!);
    if (k === i) result.push(pushOut(base[i]!), pushOut(base[j]!));
  }
  return result;
}

/** Metres; shared by the wall apertures and the manufactured face assemblies. */
export const SKIMMER_PROFILES = {
  standard: {
    width: 0.468,
    height: 0.25,
    bar: 0.044,
    depth: 0.035,
    drop: 0.16,
    center: 0.023,
    radius: 0.005,
  },
  slim: {
    width: 0.46,
    height: 0.22,
    bar: 0.026,
    depth: 0.018,
    drop: 0.16,
    center: 0.019,
    radius: 0.003,
  },
  highWaterline: {
    width: 0.46,
    height: 0.14,
    bar: 0.028,
    depth: 0.03,
    drop: 0.13,
    center: 0.012,
    radius: 0.004,
  },
  flush: {
    width: 0.46,
    height: 0.2,
    bar: 0.014,
    depth: 0.008,
    drop: 0.15,
    center: 0.017,
    radius: 0.0015,
  },
} satisfies Record<SkimmerTypeId, object>;

/** Individually eased, full-thickness slabs, including real mitres at hard corners.
 * All slabs share one geometry/material draw; colour variation is per slab. */
export function createCopingSlabGeometry(
  inner: Outline,
  outer: Outline,
  thickness: number,
  /** Geometry Pass D (Infinity): the coping SECTION to omit entirely (Rectangle
   * only -- for a 4-vertex rectangle each section between corners corresponds
   * exactly 1:1 to `RectangleInfinityZone.side`). The remaining sections keep
   * their own mitred end faces untouched, so the horseshoe this leaves has
   * clean vertical end caps at both open ends with no extra geometry needed.
   * `null`/`undefined` (every pre-Infinity call site) is byte-identical to
   * before. */
  excludeSection: number | null = null,
) {
  if (inner.length !== outer.length || inner.length < 3)
    throw new Error("Mismatched coping outlines");
  const distances = [0];
  for (let i = 0; i < inner.length; i++) {
    const a = inner[i]!;
    const b = inner[(i + 1) % inner.length]!;
    distances.push(distances[i]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  const total = distances[inner.length]!;
  const corners = [0];
  for (let i = 1; i < inner.length; i++) {
    const a = inner[i - 1]!,
      b = inner[i]!,
      c = inner[(i + 1) % inner.length]!;
    const u = new THREE.Vector2(b[0] - a[0], b[1] - a[1]).normalize();
    const v = new THREE.Vector2(c[0] - b[0], c[1] - b[1]).normalize();
    if (u.dot(v) < 0.94) corners.push(distances[i]!);
  }
  corners.push(total);
  const pointAt = (ring: Outline, d: number): [number, number] => {
    let i = 0;
    while (i < inner.length - 1 && distances[i + 1]! < d - 1e-8) i++;
    const t = THREE.MathUtils.clamp(
      (d - distances[i]!) / Math.max(1e-8, distances[i + 1]! - distances[i]!),
      0,
      1,
    );
    const a = ring[i]!,
      b = ring[(i + 1) % ring.length]!;
    return [THREE.MathUtils.lerp(a[0], b[0], t), THREE.MathUtils.lerp(a[1], b[1], t)];
  };
  const parts: THREE.BufferGeometry[] = [];
  for (let section = 0; section < corners.length - 1; section++) {
    if (excludeSection !== null && section === excludeSection) continue;
    const start = corners[section]!,
      length = corners[section + 1]! - start;
    const count = Math.max(1, Math.round(length / 0.62));
    for (let slab = 0; slab < count; slab++) {
      const from = start + (length * slab) / count,
        to = start + (length * (slab + 1)) / count;
      const stations = [from, ...distances.filter((d) => d > from + 1e-5 && d < to - 1e-5), to];
      const polygon: Outline = [
        ...stations.map((d) => pointAt(inner, d)),
        ...[...stations].reverse().map((d) => pointAt(outer, d)),
      ];
      // 3mm recessed grout + 3mm eased arris. Insetting before extrusion
      // keeps the final stone inside its surveyed perimeter.
      const inset = offsetOutline(polygon, -0.0045);
      const shape = new THREE.Shape(inset.map(([x, z]) => new THREE.Vector2(x, -z)));
      const raw = new THREE.ExtrudeGeometry(shape, {
        depth: thickness - 0.006,
        bevelEnabled: true,
        bevelSize: 0.003,
        bevelThickness: 0.003,
        bevelSegments: 3,
        steps: 1,
        curveSegments: 1,
      });
      raw.rotateX(-Math.PI / 2);
      raw.translate(0, -thickness + 0.003, 0);
      const geometry = toCreasedNormals(raw, Math.PI / 3);
      if (geometry !== raw) raw.dispose();
      // Keep the honed face planar. Averaging its corner normals with the
      // arris makes the entire slab look inflated, not just its 3mm bevel.
      const positions = geometry.getAttribute("position");
      const normals = geometry.getAttribute("normal");
      for (let i = 0; i < positions.count; i++) {
        if (Math.abs(positions.getY(i)) < 1e-6) normals.setXYZ(i, 0, 1, 0);
      }
      const shade = 0.94 + (((Math.sin(parts.length * 127.1 + 19.7) * 43758.5453) % 1) + 1) * 0.045;
      const colors = new Float32Array(geometry.getAttribute("position").count * 3).fill(shade);
      geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
      parts.push(geometry);
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((p) => p.dispose());
  return merged;
}

export interface WallOpening {
  x: number;
  z: number;
  rotation: number;
  width: number;
  top: number;
  bottom: number;
}

/** Sample matching ring boundaries by physical perimeter, independent of tessellation. */
export function sampleRing(inner: Outline, outer: Outline, pitch: number) {
  const lengths = inner.map((p, i) => {
    const q = inner[(i + 1) % inner.length]!;
    return Math.hypot(q[0] - p[0], q[1] - p[1]);
  });
  const total = lengths.reduce((a, b) => a + b, 0);
  const count = Math.max(1, Math.ceil(total / pitch));
  const samples: Array<{ inner: THREE.Vector3; outer: THREE.Vector3; tangent: THREE.Vector3 }> = [];
  let segment = 0;
  let start = 0;
  for (let i = 0; i < count; i++) {
    const distance = ((i + 0.5) * total) / count;
    while (segment < lengths.length - 1 && distance > start + lengths[segment]!) {
      start += lengths[segment++]!;
    }
    const t = (distance - start) / Math.max(lengths[segment]!, 1e-8);
    const next = (segment + 1) % inner.length;
    const a = inner[segment]!;
    const b = inner[next]!;
    const c = outer[segment]!;
    const d = outer[next]!;
    samples.push({
      inner: new THREE.Vector3(
        THREE.MathUtils.lerp(a[0], b[0], t),
        0,
        THREE.MathUtils.lerp(a[1], b[1], t),
      ),
      outer: new THREE.Vector3(
        THREE.MathUtils.lerp(c[0], d[0], t),
        0,
        THREE.MathUtils.lerp(c[1], d[1], t),
      ),
      tangent: new THREE.Vector3(b[0] - a[0], 0, b[1] - a[1]).normalize(),
    });
  }
  return samples;
}

/** One merged draw call, with actual open gaps and rounded load-bearing ribs. */
export function createGrateGeometry(inner: Outline, outer: Outline) {
  const profile = new THREE.Shape([
    new THREE.Vector2(-0.0045, 0),
    new THREE.Vector2(0.0045, 0),
    new THREE.Vector2(0.006, -0.0015),
    new THREE.Vector2(0.006, -0.0175),
    new THREE.Vector2(0.0045, -0.019),
    new THREE.Vector2(-0.0045, -0.019),
    new THREE.Vector2(-0.006, -0.0175),
    new THREE.Vector2(-0.006, -0.0015),
  ]);
  const parts: THREE.BufferGeometry[] = [];
  for (let i = 0; i < inner.length; i++) {
    const next = (i + 1) % inner.length;
    const a = new THREE.Vector2(...inner[i]!);
    const b = new THREE.Vector2(...inner[next]!);
    const tangent = b.clone().sub(a).normalize();
    const normal = new THREE.Vector2(tangent.y, -tangent.x);
    // Slice each mitred channel bay perpendicular to its inner edge. Extending
    // stations to the outer corners covers the corner patches without fanning
    // straight-run ribs or overlapping the adjacent mitred bay.
    const bay = [inner[i]!, inner[next]!, outer[next]!, outer[i]!].map((point) => {
      const relative = new THREE.Vector2(...point).sub(a);
      return new THREE.Vector2(relative.dot(tangent), relative.dot(normal));
    });
    const start = Math.min(...bay.map((point) => point.x));
    const end = Math.max(...bay.map((point) => point.x));
    const count = Math.max(1, Math.ceil((end - start) / 0.022));
    for (let rib = 0; rib < count; rib++) {
      const station = start + ((rib + 0.5) * (end - start)) / count;
      const intersections: number[] = [];
      for (let edge = 0; edge < bay.length; edge++) {
        const p = bay[edge]!,
          q = bay[(edge + 1) % bay.length]!;
        if (Math.abs(q.x - p.x) < 1e-8) continue;
        const t = (station - p.x) / (q.x - p.x);
        if (t >= 0 && t <= 1) intersections.push(THREE.MathUtils.lerp(p.y, q.y, t));
      }
      if (intersections.length < 2) continue;
      const from = Math.min(...intersections) + 0.001;
      const to = Math.max(...intersections) - 0.001;
      if (to - from < 0.002) continue;
      const geometry = new THREE.ExtrudeGeometry(profile, {
        depth: to - from,
        bevelEnabled: false,
        steps: 1,
      });
      geometry.rotateY(Math.atan2(normal.x, normal.y));
      const origin = a.clone().addScaledVector(tangent, station).addScaledVector(normal, from);
      geometry.translate(origin.x, 0, origin.y);
      parts.push(geometry);
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return merged;
}

/** Fine grout joints traverse the top and both fascias, giving slabs a real scale. */
export function createCopingJointGeometry(inner: Outline, outer: Outline, thickness: number) {
  const parts: THREE.BufferGeometry[] = [];
  for (const sample of sampleRing(inner, outer, 0.62)) {
    const across = sample.outer.clone().sub(sample.inner);
    const angle = Math.atan2(across.x, across.z);
    const center = sample.inner.clone().add(sample.outer).multiplyScalar(0.5);
    const top = new THREE.BoxGeometry(0.0025, 0.0008, across.length() - 0.012);
    top.rotateY(angle);
    top.translate(center.x, 0.0002, center.z);
    parts.push(top);
    for (const edge of [sample.inner, sample.outer]) {
      const fascia = new THREE.BoxGeometry(0.0025, Math.max(0.003, thickness - 0.012), 0.001);
      fascia.rotateY(angle);
      fascia.translate(edge.x, -thickness / 2 - 0.003, edge.z);
      parts.push(fascia);
    }
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((part) => part.dispose());
  return merged;
}
