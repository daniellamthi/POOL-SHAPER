import * as THREE from "three";

type StoneMaps = { colorMap: THREE.DataTexture; normalMap: THREE.DataTexture; roughnessMap: THREE.DataTexture };
const templates = new Map<number, StoneMaps>();

/** One 40cm piece of honed mineral stone. All PBR channels share the same
 * sediment and pore field; no lighting is baked into the albedo. */
export function createTravertineMaps(size = 512): StoneMaps {
  let maps = templates.get(size);
  if (!maps) {
    maps = buildTravertineMaps(size);
    templates.set(size, maps);
  }
  // CPU pixels are shared; each consumer owns sampling settings and disposal.
  return { colorMap: maps.colorMap.clone(), normalMap: maps.normalMap.clone(), roughnessMap: maps.roughnessMap.clone() };
}

function buildTravertineMaps(size: number): StoneMaps {
  const hash = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return n - Math.floor(n);
  };
  const noise = (u: number, v: number, cells: number) => {
    const x = u * cells, y = v * cells;
    const ix = Math.floor(x), iy = Math.floor(y);
    const fx = x - ix, fy = y - iy;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const h = (a: number, b: number) => hash((a + cells) % cells, (b + cells) % cells);
    return THREE.MathUtils.lerp(THREE.MathUtils.lerp(h(ix, iy), h(ix + 1, iy), sx),
      THREE.MathUtils.lerp(h(ix, iy + 1), h(ix + 1, iy + 1), sx), sy);
  };
  const height = new Float32Array(size * size);
  const color = new Uint8Array(size * size * 4);
  const rough = new Uint8Array(size * size * 4);
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const u = x / size, v = y / size;
    const sediment = noise(u, v, 5) * 0.5 + noise(u, v, 19) * 0.3 + noise(u, v, 47) * 0.2;
    const px = u * 92, py = v * 92;
    const ix = Math.floor(px), iy = Math.floor(py);
    const seed = hash(ix, iy);
    const dx = (px - ix - 0.25 - hash(ix + 37, iy) * 0.5) * 1.4;
    const dy = (py - iy - 0.25 - hash(ix, iy + 71) * 0.5) * 0.7;
    const pore = seed > 0.37 ? 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dy), 0.025, 0.09 + seed * 0.14) : 0;
    const grain = hash(x, y) - 0.5;
    height[y * size + x] = sediment * 0.04 + grain * 0.012 - pore * 0.23;
    const value = 0.91 + (sediment - 0.5) * 0.19 + grain * 0.028 - pore * 0.2;
    const o = (y * size + x) * 4;
    color[o] = value * 255;
    color[o + 1] = (value - pore * 0.018) * 255;
    color[o + 2] = (value - pore * 0.036) * 255;
    color[o + 3] = 255;
    const r = (0.81 + sediment * 0.1 + pore * 0.09) * 255;
    rough[o] = rough[o + 1] = rough[o + 2] = r;
    rough[o + 3] = 255;
  }
  const normal = new Uint8Array(size * size * 4);
  const h = (x: number, y: number) => height[((y + size) % size) * size + (x + size) % size]!;
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    const dx = (h(x - 1, y) - h(x + 1, y)) * 3.2;
    const dy = (h(x, y - 1) - h(x, y + 1)) * 3.2;
    const n = 1 / Math.hypot(dx, dy, 1), o = (y * size + x) * 4;
    normal[o] = (dx * n * 0.5 + 0.5) * 255;
    normal[o + 1] = (dy * n * 0.5 + 0.5) * 255;
    normal[o + 2] = (n * 0.5 + 0.5) * 255;
    normal[o + 3] = 255;
  }
  const texture = (data: Uint8Array, srgb = false) => {
    const map = new THREE.DataTexture(data, size, size);
    map.wrapS = map.wrapT = THREE.RepeatWrapping;
    map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    map.minFilter = THREE.LinearMipmapLinearFilter;
    map.magFilter = THREE.LinearFilter;
    map.generateMipmaps = true;
    map.needsUpdate = true;
    return map;
  };
  return { colorMap: texture(color, true), normalMap: texture(normal), roughnessMap: texture(rough) };
}
