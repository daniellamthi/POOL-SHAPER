import { Vector2, Vector3, type Matrix3 } from "three";

type Point = readonly [number, number];
interface FieldInput {
  outline: readonly Point[];
  waterY: number;
  floorY: number;
  /** World direction from the water toward the directional sun. */
  toSun: readonly [number, number, number];
  ior: number;
  resolution?: number;
  /** Read the same world-space normal as the photographic water interface. */
  sampleNormal?: (x: number, z: number, out: Vector3) => void;
}

/** One-time, single-interface Snell transport to a horizontal receiving floor.
 * Each surface cell launches a fixed horizontal share of incident sunlight;
 * Fresnel reflection and rays intercepted by the finite basin are accounted
 * separately. No colour tint, procedural caustic pattern or added light.
 * Surface displacement, multiple scattering and wall caustics are not solved.
 * The flat reference uses exactly the same opening/receiver and sunlight. */
export function bakeRefractedSunField(input: FieldInput) {
  const { outline, waterY, floorY, ior, sampleNormal } = input;
  const resolution = input.resolution ?? 256;
  const sun = new Vector3(...input.toSun);
  if (!Number.isFinite(waterY) || !Number.isFinite(floorY) || floorY >= waterY ||
      !Number.isFinite(ior) || ior <= 1 || ior > 3 || !Number.isInteger(resolution) ||
      resolution < 16 || resolution > 512 || outline.length < 3 || outline.length > 256 ||
      outline.some(p => !Number.isFinite(p[0]) || !Number.isFinite(p[1])) ||
      !Number.isFinite(sun.lengthSq()) || sun.lengthSq() < 1e-12 || sun.y <= 0) return null;
  const area = outline.reduce((sum, p, i) => {
    const q = outline[(i + 1) % outline.length]!;
    return sum + p[0] * q[1] - q[0] * p[1];
  }, 0);
  if (Math.abs(area) < 1e-8) return null;
  const minX = Math.min(...outline.map(p => p[0])), maxX = Math.max(...outline.map(p => p[0]));
  const minZ = Math.min(...outline.map(p => p[1])), maxZ = Math.max(...outline.map(p => p[1]));
  const cellX = (maxX - minX) / resolution, cellZ = (maxZ - minZ) / resolution;
  if (cellX <= 0 || cellZ <= 0) return null;
  sun.normalize();
  const incident = sun.clone().negate(), normal = new Vector3(), transmitted = new Vector3();
  const eta = 1 / ior, cellArea = cellX * cellZ, launchFlux = cellArea * sun.y;
  const inside = (x: number, z: number) => {
    let result = false;
    for (let i = 0, j = outline.length - 1; i < outline.length; j = i++) {
      const a = outline[i]!, b = outline[j]!;
      if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) result = !result;
    }
    return result;
  };
  let turn = 0, convex = true;
  for (let i = 0; i < outline.length; i++) {
    const a = outline[i]!, b = outline[(i + 1) % outline.length]!, c = outline[(i + 2) % outline.length]!;
    const cross = (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
    if (Math.abs(cross) > 1e-10) { if (turn && Math.sign(cross) !== turn) convex = false; turn = Math.sign(cross); }
  }
  const crossesWall = (x: number, z: number, fx: number, fz: number) => {
    if (convex) return false; // An inside→inside segment stays inside a convex basin.
    const dx = fx - x, dz = fz - z;
    for (let i = 0; i < outline.length; i++) {
      const a = outline[i]!, b = outline[(i + 1) % outline.length]!;
      const ex = b[0] - a[0], ez = b[1] - a[1], determinant = dx * ez - dz * ex;
      if (Math.abs(determinant) < 1e-12) continue;
      const t = ((a[0] - x) * ez - (a[1] - z) * ex) / determinant;
      const u = ((a[0] - x) * dz - (a[1] - z) * dx) / determinant;
      if (t > 1e-8 && t < 1 - 1e-8 && u >= 0 && u <= 1) return true;
    }
    return false;
  };
  const sources: number[] = [];
  const receiverMask = new Uint8Array(resolution * resolution);
  for (let z = 0; z < resolution; z++) for (let x = 0; x < resolution; x++) {
    const sx = minX + (x + 0.5) * cellX, sz = minZ + (z + 0.5) * cellZ;
    if (inside(sx, sz)) { sources.push(sx, sz); receiverMask[z * resolution + x] = 1; }
  }
  const transport = (flat: boolean) => {
    const density = new Float32Array(resolution * resolution);
    let launchedFlux = 0, floorFlux = 0, wallFlux = 0, reflectedFlux = 0, rejectedFlux = 0;
    for (let i = 0; i < sources.length; i += 2) {
      const sx = sources[i]!, sz = sources[i + 1]!;
      launchedFlux += launchFlux;
      normal.set(0, 1, 0);
      if (!flat && sampleNormal) sampleNormal(sx, sz, normal);
      if (!Number.isFinite(normal.lengthSq()) || normal.lengthSq() < 1e-12 || normal.y <= 0) { rejectedFlux += launchFlux; continue; }
      normal.normalize();
      const cosI = Math.min(1, -incident.dot(normal));
      if (cosI <= 0) { rejectedFlux += launchFlux; continue; }
      const cosT = Math.sqrt(Math.max(0, 1 - eta * eta * (1 - cosI * cosI)));
      const rs = (cosI - ior * cosT) / (cosI + ior * cosT);
      const rp = (cosT - ior * cosI) / (cosT + ior * cosI);
      const reflection = (rs * rs + rp * rp) * 0.5;
      reflectedFlux += launchFlux * reflection;
      const flux = launchFlux * (1 - reflection);
      transmitted.copy(incident).multiplyScalar(eta).addScaledVector(normal, eta * cosI - cosT);
      if (transmitted.y >= -1e-8) { rejectedFlux += flux; continue; }
      const distance = (floorY - waterY) / transmitted.y;
      const fx = sx + transmitted.x * distance, fz = sz + transmitted.z * distance;
      if (!inside(fx, fz) || crossesWall(sx, sz, fx, fz)) { wallFlux += flux; continue; }
      floorFlux += flux;
      const px = (fx - minX) / cellX - 0.5, pz = (fz - minZ) / cellZ - 0.5;
      const ix = Math.floor(px), iz = Math.floor(pz), tx = px - ix, tz = pz - iz;
      for (let dz = 0; dz <= 1; dz++) for (let dx = 0; dx <= 1; dx++) {
        const x = Math.max(0, Math.min(resolution - 1, ix + dx)), z = Math.max(0, Math.min(resolution - 1, iz + dz));
        const weight = (dx ? tx : 1 - tx) * (dz ? tz : 1 - tz);
        density[z * resolution + x]! += flux * weight / cellArea;
      }
    }
    return { density, launchedFlux, floorFlux, wallFlux, reflectedFlux, rejectedFlux };
  };
  return { bounds: [minX, minZ, maxX, maxZ] as const, resolution, receiverMask, flat: transport(true), refracted: transport(false) };
}


/** Match the water surface's metric UV=(x,-z), texture matrix/flip and real
 * +X/-Z tangent frame. Periodic bilinear sampling matches its repeated map.
 * Snapshot transform/scale; borrow immutable 8-bit bitmap pixels. */
export function createPhotoWaterNormalSampler(
  image: { data: ArrayLike<number>; width: number; height: number },
  transform: Matrix3,
  flipY: boolean,
  scale: Vector2,
) {
  const { data, width, height } = image;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1 || data.length !== width * height * 4)
    throw new Error("Invalid photographic water-normal bitmap");
  const matrix = transform.clone(), uv = new Vector2(), scaleX = scale.x, scaleY = scale.y;
  return (x: number, z: number, out: Vector3) => {
    uv.set(x, -z).applyMatrix3(matrix);
    const px = uv.x * width - 0.5, py = (flipY ? 1 - uv.y : uv.y) * height - 0.5;
    const ix = Math.floor(px), iy = Math.floor(py), tx = px - ix, ty = py - iy;
    let r = 0, g = 0, b = 0;
    for (let dy = 0; dy <= 1; dy++) for (let dx = 0; dx <= 1; dx++) {
      const sx = ((ix + dx) % width + width) % width, sy = ((iy + dy) % height + height) % height;
      const offset = (sy * width + sx) * 4, weight = (dx ? tx : 1 - tx) * (dy ? ty : 1 - ty);
      r += data[offset]! * weight; g += data[offset + 1]! * weight; b += data[offset + 2]! * weight;
    }
    out.set((r * 2 / 255 - 1) * scaleX, b * 2 / 255 - 1, -(g * 2 / 255 - 1) * scaleY).normalize();
  };
}

/** Bound focused HDR peaks without a global brightness lift. Redistribute
 * clipped peaks over the supported receiving region while preserving its
 * transported flux. Cells with unreliable flat-reference coverage stay neutral.
 * A field whose flux cannot be represented safely is not activated. */
export function normaliseRefractedSunGain(field: NonNullable<ReturnType<typeof bakeRefractedSunField>>) {
  const count = field.resolution ** 2, ratios = new Float32Array(count), supported = new Uint8Array(count);
  let maxFlat = 0, target = 0;
  for (const value of field.flat.density) maxFlat = Math.max(maxFlat, value);
  if (!(maxFlat > 0)) return null;
  for (let i = 0; i < count; i++) {
    const flat = field.flat.density[i]!, value = field.refracted.density[i]!;
    if (!field.receiverMask[i] || flat < maxFlat * 0.4) continue;
    supported[i] = 1; ratios[i] = value / flat; target += value;
  }
  const fluxAt = (scale: number) => {
    let sum = 0;
    for (let i = 0; i < count; i++) if (supported[i]) sum += field.flat.density[i]! * Math.min(4, ratios[i]! * scale);
    return sum;
  };
  let lo = 0, hi = 1;
  while (fluxAt(hi) < target && hi < 1048576) hi *= 2;
  if (fluxAt(hi) + 1e-6 < target) return null;
  for (let i = 0; i < 32; i++) {
    const middle = (lo + hi) * 0.5;
    if (fluxAt(middle) < target) lo = middle; else hi = middle;
  }
  const data = new Float32Array(count * 4);
  let actual = 0, minGain = Infinity, maxGain = 0;
  for (let i = 0; i < count; i++) {
    const gain = supported[i] ? Math.min(4, ratios[i]! * hi) : 1;
    data[i * 4] = gain; data[i * 4 + 1] = supported[i]!; data[i * 4 + 3] = 1;
    if (supported[i]) { actual += field.flat.density[i]! * data[i * 4]!; minGain = Math.min(minGain, gain); maxGain = Math.max(maxGain, gain); }
  }
  const cellArea = (field.bounds[2] - field.bounds[0]) * (field.bounds[3] - field.bounds[1]) / count;
  return { data, minGain, maxGain, targetFlux: target * cellArea, encodedFlux: actual * cellArea };
}
