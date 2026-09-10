import * as THREE from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import type { Outline, SkimmerTypeId } from "@/lib/pool/types";

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
    drop: 0.09,
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
  const parts = sampleRing(inner, outer, 0.022).map((sample) => {
    const across = sample.outer.clone().sub(sample.inner);
    const geometry = new THREE.ExtrudeGeometry(profile, {
      depth: across.length(),
      bevelEnabled: false,
      steps: 1,
    });
    geometry.translate(0, 0, -across.length() / 2);
    geometry.rotateY(Math.atan2(across.x, across.z));
    const center = sample.inner.clone().add(sample.outer).multiplyScalar(0.5);
    geometry.translate(center.x, 0, center.z);
    return geometry;
  });
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
