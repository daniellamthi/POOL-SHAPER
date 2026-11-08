import { Matrix4, Vector4, type Camera } from "three";
import type { Outline } from "@/lib/pool/types";

/** Bottom-up normalized image polygons for the actual horizontal water plane.
 * Clip in homogeneous camera space before dividing by w, including views
 * crossing the near plane. No camera, geometry or render state is changed. */
export function projectPhotoWaterPreservation(
  water: { outline: Outline; waterY: number },
  camera: Camera,
): [number, number][][] {
  const matrix = new Matrix4().multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
  let points = water.outline.map(([x, z]) =>
    new Vector4(x, water.waterY, z, 1).applyMatrix4(matrix),
  );
  const planes = [
    (p: Vector4) => p.w + p.x,
    (p: Vector4) => p.w - p.x,
    (p: Vector4) => p.w + p.y,
    (p: Vector4) => p.w - p.y,
    (p: Vector4) => p.w + p.z,
    (p: Vector4) => p.w - p.z,
  ];
  for (const distance of planes) {
    const clipped: Vector4[] = [];
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!,
        b = points[(i + 1) % points.length]!,
        da = distance(a),
        db = distance(b);
      if (da >= 0) clipped.push(a);
      if (da >= 0 !== db >= 0) clipped.push(a.clone().lerp(b, da / (da - db)));
    }
    points = clipped;
  }
  if (points.length < 3) return [];
  const polygon: [number, number][] = points.map((p) => [
    Math.max(0, Math.min(1, (p.x / p.w) * 0.5 + 0.5)),
    Math.max(0, Math.min(1, (p.y / p.w) * 0.5 + 0.5)),
  ]);
  return [polygon];
}
