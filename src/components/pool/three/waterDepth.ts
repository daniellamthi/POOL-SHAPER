import * as THREE from "three";
import type { Outline } from "@/lib/pool/types";

/** Conservative metric distance to the actual water perimeter. Baked only
 * when the shape changes; one texture read bounds refraction for any outline. */
export function createShorelineField(outline: Outline, size = 128) {
  const points = outline;
  const minX = Math.min(...points.map(p => p[0]));
  const minZ = Math.min(...points.map(p => p[1]));
  const spanX = Math.max(...points.map(p => p[0])) - minX;
  const spanZ = Math.max(...points.map(p => p[1])) - minZ;
  const scale = Math.max(spanX, spanZ);
  const guard = Math.hypot(spanX, spanZ) / size;
  const data = new Uint8Array(size * size);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const px = minX + (x + 0.5) / size * spanX;
    const pz = minZ + (y + 0.5) / size * spanZ;
    let distance = Infinity, inside = false;
    for (let i = 0; i < points.length; i++) {
      const a = points[i]!, b = points[(i + 1) % points.length]!;
      const dx = b[0] - a[0], dz = b[1] - a[1];
      const t = THREE.MathUtils.clamp(((px - a[0]) * dx + (pz - a[1]) * dz) / Math.max(dx * dx + dz * dz, 1e-12), 0, 1);
      distance = Math.min(distance, Math.hypot(px - a[0] - t * dx, pz - a[1] - t * dz));
      if ((a[1] > pz) !== (b[1] > pz) && px < (b[0] - a[0]) * (pz - a[1]) / (b[1] - a[1]) + a[0]) inside = !inside;
    }
    data[y * size + x] = inside ? Math.floor(Math.max(0, distance - guard) / scale * 255) : 0;
  }
  const texture = new THREE.DataTexture(data, size, size, THREE.RedFormat);
  texture.minFilter = texture.magFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  return { texture, bounds: new THREE.Vector4(minX, minZ, spanX, spanZ), scale };
}
