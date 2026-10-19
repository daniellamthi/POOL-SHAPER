import {
  BoxGeometry,
  BufferGeometry,
  CatmullRomCurve3,
  Float32BufferAttribute,
  TubeGeometry,
  Vector3,
} from "three";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";
import {
  SUN_SHELF_LOUNGER_MODEL as MODEL,
  DECK_CHAISE_MODEL as DECK,
} from "@/lib/pool/sun-shelf-model";

/** Original reference-matched representation of Esse (owner's Lympha photos).
 * Published outer dimensions; the curved profile, apertures and cushion are
 * illustrative, not manufacturer CAD or installation instructions. +Z = feet. */
const PROFILE = [
  [-0.925, 0.57],
  [-0.78, 0.505],
  [-0.53, 0.34],
  [-0.29, 0.16],
  [-0.08, 0.11],
  [0.12, 0.175],
  [0.29, 0.25],
  [0.45, 0.215],
  [0.68, 0.12],
  [0.925, 0.08],
] as const;
export function lymphaProfileHeight(z: number) {
  if (z >= PROFILE[PROFILE.length - 1]![0]) return PROFILE[PROFILE.length - 1]![1];
  const i = Math.max(
    0,
    Math.min(
      PROFILE.length - 2,
      PROFILE.findIndex((p, k) => k < PROFILE.length - 1 && z <= PROFILE[k + 1]![0]),
    ),
  );
  const a = PROFILE[i]!,
    b = PROFILE[i + 1]!,
    h = b[0] - a[0],
    t = Math.max(0, Math.min(1, (z - a[0]) / h));
  const slope = (k: number) =>
    (PROFILE[k + 1]![1] - PROFILE[k]![1]) / (PROFILE[k + 1]![0] - PROFILE[k]![0]);
  const tangent = (k: number) => {
    if (k === 0) return slope(0);
    if (k === PROFILE.length - 1) return slope(k - 1);
    const l = slope(k - 1),
      r = slope(k);
    return l * r <= 0 ? 0 : (2 * l * r) / (l + r);
  };
  return (
    (2 * t ** 3 - 3 * t * t + 1) * a[1] +
    (t ** 3 - 2 * t * t + t) * h * tangent(i) +
    (-2 * t ** 3 + 3 * t * t) * b[1] +
    (t ** 3 - t * t) * h * tangent(i + 1)
  );
}
const signedPower = (v: number, p: number) => Math.sign(v) * Math.abs(v) ** p;
const holes = [
  { start: -0.48, end: -0.395, half: 0.235 },
  { start: -0.235, end: -0.215, half: 0.014 },
];

/** Hollow rotational-moulded shell: real open end mouths, hand slot and drain.
 * Shared indexed mesh; no alpha masks, hidden solid slab or per-frame work. */
export function createLymphaShellGeometry(): BufferGeometry {
  const zs = [
    ...Array.from({ length: 41 }, (_, i) => -MODEL.length / 2 + (i * MODEL.length) / 40),
    ...holes.flatMap((h) => [h.start, h.end]),
  ].sort((a, b) => a - b);
  const angles = [
    ...Array.from({ length: 32 }, (_, i) => (i * Math.PI * 2) / 32),
    ...holes.flatMap((h) => {
      const a = Math.acos((h.half / (MODEL.width / 2)) ** 2);
      return [a, Math.PI - a, Math.PI + a, Math.PI * 2 - a];
    }),
  ].sort((a, b) => a - b);
  const positions: number[] = [],
    uvs: number[] = [],
    indices: number[] = [],
    edges = new Map<string, [number, number]>();
  const ring = angles.length,
    oneHull = zs.length * ring;
  for (const inner of [false, true])
    for (const z of zs)
      for (const theta of angles) {
        const top = lymphaProfileHeight(z),
          bottom = Math.max(0, top - (z < -0.29 ? 0.09 : z < 0.12 ? 0.11 : 0.08));
        const halfHeight = (top - bottom) / 2 - (inner ? 0.016 : 0),
          halfWidth = MODEL.width / 2 - (inner ? 0.016 : 0);
        positions.push(
          signedPower(Math.cos(theta), 0.5) * halfWidth,
          (top + bottom) / 2 + signedPower(Math.sin(theta), 0.55) * halfHeight,
          z,
        );
        uvs.push(theta / (Math.PI * 2), (z + MODEL.length / 2) / MODEL.length);
      }
  const edge = (a: number, b: number) => {
    const key = a < b ? `${a}:${b}` : `${b}:${a}`;
    if (edges.has(key)) edges.delete(key);
    else edges.set(key, [a, b]);
  };
  for (let j = 0; j < zs.length - 1; j++)
    for (let i = 0; i < ring; i++) {
      const z = (zs[j]! + zs[j + 1]!) / 2,
        theta = (angles[i]! + (angles[i + 1] ?? Math.PI * 2)) / 2;
      const x = Math.abs((signedPower(Math.cos(theta), 0.5) * MODEL.width) / 2);
      if (holes.some((h) => z > h.start && z < h.end && x < h.half - 1e-8)) continue;
      const a = j * ring + i,
        b = j * ring + ((i + 1) % ring),
        c = a + ring,
        d = b + ring;
      indices.push(
        a,
        b,
        c,
        b,
        d,
        c,
        a + oneHull,
        c + oneHull,
        b + oneHull,
        b + oneHull,
        c + oneHull,
        d + oneHull,
      );
      edge(a, b);
      edge(b, d);
      edge(d, c);
      edge(c, a);
    }
  // Close the material thickness at the end rims and actual openings, but
  // leave the hollow interior unobstructed. Angular indices are cyclic.
  for (const [a, b] of edges.values()) indices.push(b, a, a + oneHull, b, a + oneHull, b + oneHull);
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

export function createLymphaFrameGeometry() {
  const parts: BufferGeometry[] = [];
  for (const side of [-1, 1]) {
    const x = side * 0.285;
    const points = [
      new Vector3(x, lymphaProfileHeight(0.61) - 0.08 + DECK.shellLift, 0.61),
      new Vector3(x, 0.055, 0.72),
      new Vector3(x, 0.014, 0.64),
      new Vector3(x, 0.014, -0.53),
      new Vector3(x, 0.065, -0.64),
      new Vector3(x, lymphaProfileHeight(-0.58) - 0.09 + DECK.shellLift, -0.58),
    ];
    parts.push(
      new TubeGeometry(new CatmullRomCurve3(points, false, "centripetal"), 40, 0.014, 8, false),
    );
  }
  for (const z of [-0.58, 0.61]) {
    const y = lymphaProfileHeight(z) - (z < 0 ? 0.09 : 0.08) + DECK.shellLift;
    parts.push(
      new TubeGeometry(
        new CatmullRomCurve3([new Vector3(-0.285, y, z), new Vector3(0.285, y, z)]),
        1,
        0.014,
        8,
        false,
      ),
    );
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  const p = merged.getAttribute("position");
  for (let i = 0; i < p.count; i++) p.setY(i, Math.max(0, p.getY(i)));
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  return merged;
}

export function createLymphaCushionGeometry() {
  const parts: BufferGeometry[] = [];
  for (const [start, end, width, thickness, lift] of [
    [-0.88, -0.32, 0.6, 0.045, 0.027],
    [-0.3, 0.16, 0.6, 0.045, 0.027],
    [0.18, 0.86, 0.6, 0.045, 0.027],
    [-0.83, -0.58, 0.43, 0.065, 0.069],
  ]) {
    const length = end! - start!,
      mid = (end! + start!) / 2,
      r = 0.018,
      halfW = width! / 2,
      halfH = thickness! / 2;
    const g = new BoxGeometry(width!, thickness!, length, 6, 2, 24),
      p = g.getAttribute("position");
    for (let i = 0; i < p.count; i++) {
      const v = new Vector3().fromBufferAttribute(p, i),
        q = new Vector3(
          Math.max(-halfW + r, Math.min(halfW - r, v.x)),
          Math.max(-halfH + r, Math.min(halfH - r, v.y)),
          Math.max(-length / 2 + r, Math.min(length / 2 - r, v.z)),
        );
      v.sub(q).normalize().multiplyScalar(r).add(q);
      const z = v.z + mid;
      p.setXYZ(i, v.x, v.y + lymphaProfileHeight(z) + DECK.shellLift + lift!, z);
    }
    g.computeVertexNormals();
    parts.push(g);
  }
  const merged = mergeGeometries(parts)!;
  parts.forEach((g) => g.dispose());
  merged.computeBoundingBox();
  return merged;
}
