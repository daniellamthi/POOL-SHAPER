import * as THREE from "three";

export type StoneMaps = {
  colorMap: THREE.Texture;
  normalMap: THREE.Texture;
  /** Null when the scanned set ships no roughness map. The material then
   * falls back to its scalar `roughness`, which three.js applies directly
   * (USE_ROUGHNESSMAP stays undefined). Deriving a roughness map from an
   * unrelated channel -- e.g. a specular map -- would fabricate PBR data,
   * so it is deliberately not done. */
  roughnessMap: THREE.Texture | null;
};

/**
 * Real scanned PBR maps for a coping finish, loaded from `public/textures/coping/<id>/`.
 *
 * Preferred over the procedural bakes below: those synthesise plausible noise
 * but carry no authentic pore/sediment/grain morphology, so they read as CG at
 * close range. A finish only falls back to a procedural bake when no scanned
 * asset has been sourced for it yet (see `asset` in coping-materials.ts).
 *
 * Colour space matters: BaseColor is authored in sRGB, while Normal/Roughness
 * are linear data and must NOT be gamma-decoded.
 */
export function loadCopingTextureMaps(dir: string, hasRoughnessMap = true): StoneMaps {
  const loader = new THREE.TextureLoader();
  const load = (name: string, srgb: boolean) => {
    const texture = loader.load(`${dir}/${name}.png`);
    texture.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
    texture.minFilter = THREE.LinearMipmapLinearFilter;
    texture.magFilter = THREE.LinearFilter;
    texture.generateMipmaps = true;
    return texture;
  };
  return {
    colorMap: load("basecolor", true),
    normalMap: load("normal", false),
    roughnessMap: hasRoughnessMap ? load("roughness", false) : null,
  };
}

function hash(x: number, y: number) {
  const n = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return n - Math.floor(n);
}

function valueNoise(u: number, v: number, cells: number) {
  const x = u * cells,
    y = v * cells;
  const ix = Math.floor(x),
    iy = Math.floor(y);
  const fx = x - ix,
    fy = y - iy;
  const sx = fx * fx * (3 - 2 * fx),
    sy = fy * fy * (3 - 2 * fy);
  const h = (a: number, b: number) => hash((a + cells) % cells, (b + cells) % cells);
  return THREE.MathUtils.lerp(
    THREE.MathUtils.lerp(h(ix, iy), h(ix + 1, iy), sx),
    THREE.MathUtils.lerp(h(ix, iy + 1), h(ix + 1, iy + 1), sx),
    sy,
  );
}

/** Height field -> tangent-space normal map, shared by every stone variant so
 * the bump response stays consistent regardless of how each height field was
 * synthesized. `strength` is a pre-multiplier baked into the map itself (kept
 * small here -- the real per-material restraint lives in `normalStrength` /
 * `normalScale` applied where the material is used). */
function heightToNormal(height: Float32Array, size: number, strength: number): Uint8Array {
  const normal = new Uint8Array(size * size * 4);
  const h = (x: number, y: number) => height[((y + size) % size) * size + ((x + size) % size)]!;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++) {
      const dx = (h(x - 1, y) - h(x + 1, y)) * strength;
      const dy = (h(x, y - 1) - h(x, y + 1)) * strength;
      const n = 1 / Math.hypot(dx, dy, 1),
        o = (y * size + x) * 4;
      normal[o] = (dx * n * 0.5 + 0.5) * 255;
      normal[o + 1] = (dy * n * 0.5 + 0.5) * 255;
      normal[o + 2] = (n * 0.5 + 0.5) * 255;
      normal[o + 3] = 255;
    }
  return normal;
}

function makeTexture(data: Uint8Array, size: number, srgb: boolean): THREE.DataTexture {
  const map = new THREE.DataTexture(data, size, size);
  map.wrapS = map.wrapT = THREE.RepeatWrapping;
  map.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
  map.minFilter = THREE.LinearMipmapLinearFilter;
  map.magFilter = THREE.LinearFilter;
  map.generateMipmaps = true;
  map.needsUpdate = true;
  return map;
}

/** Per-variant CPU bake, cached by size like `templates` -- built once, then
 * cloned per consumer so each owns its own sampling settings and disposal. */
function memoizedTemplate(
  cache: Map<number, StoneMaps>,
  size: number,
  build: () => StoneMaps,
): StoneMaps {
  let maps = cache.get(size);
  if (!maps) {
    maps = build();
    cache.set(size, maps);
  }
  return {
    colorMap: maps.colorMap.clone(),
    normalMap: maps.normalMap.clone(),
    // Procedural bakes always produce all three channels.
    roughnessMap: maps.roughnessMap!.clone(),
  };
}

const travertineCache = new Map<number, StoneMaps>();

/** Travertino Chiaro -- warm ivory honed travertine: directional sediment
 * banding plus sparse, slightly elongated pores (never covering the whole
 * surface). All PBR channels share the same sediment/pore field; no lighting
 * is baked into the albedo. */
export function createTravertineMaps(size = 512): StoneMaps {
  return memoizedTemplate(travertineCache, size, () => {
    const height = new Float32Array(size * size);
    const color = new Uint8Array(size * size * 4);
    const rough = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        const sediment =
          valueNoise(u, v, 5) * 0.5 + valueNoise(u, v, 19) * 0.3 + valueNoise(u, v, 47) * 0.2;
        // Soft directional bands running along u -- the "elongated linear
        // sedimentation" travertine reads by, not present in the other stones.
        const band =
          Math.sin(u * 26 + valueNoise(u, v, 3) * 3.5) * 0.06 +
          Math.sin(u * 61 - valueNoise(u, v, 7) * 2.0) * 0.025;
        const px = u * 92,
          py = v * 92;
        const ix = Math.floor(px),
          iy = Math.floor(py);
        const seed = hash(ix, iy);
        const dx = (px - ix - 0.25 - hash(ix + 37, iy) * 0.5) * 1.8;
        const dy = (py - iy - 0.25 - hash(ix, iy + 71) * 0.5) * 0.55;
        const pore =
          seed > 0.4
            ? 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dy), 0.025, 0.08 + seed * 0.12)
            : 0;
        const grain = hash(x, y) - 0.5;
        height[y * size + x] = (sediment + band) * 0.04 + grain * 0.012 - pore * 0.23;
        const value = 0.91 + (sediment - 0.5) * 0.16 + band * 0.5 + grain * 0.026 - pore * 0.2;
        const o = (y * size + x) * 4;
        color[o] = value * 255;
        color[o + 1] = (value - pore * 0.018) * 255;
        color[o + 2] = (value - pore * 0.036) * 255;
        color[o + 3] = 255;
        const r = (0.81 + sediment * 0.1 + pore * 0.09) * 255;
        rough[o] = rough[o + 1] = rough[o + 2] = r;
        rough[o + 3] = 255;
      }
    const normal = heightToNormal(height, size, 3.2);
    return {
      colorMap: makeTexture(color, size, true),
      normalMap: makeTexture(normal, size, false),
      roughnessMap: makeTexture(rough, size, false),
    };
  });
}

const limestoneCache = new Map<number, StoneMaps>();

/** Limestone Ivory -- clean, homogeneous sedimentary limestone: fine grain
 * and soft low-frequency clouding only, deliberately with no linear veins
 * and far fewer/smaller pores than Travertino so the two stay unmistakably
 * different at a glance. */
export function createLimestoneMaps(size = 512): StoneMaps {
  return memoizedTemplate(limestoneCache, size, () => {
    const height = new Float32Array(size * size);
    const color = new Uint8Array(size * size * 4);
    const rough = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        // Broad, isotropic cloudy variation -- no directionality, no bands.
        const cloud =
          valueNoise(u, v, 4) * 0.55 + valueNoise(u, v, 11) * 0.3 + valueNoise(u, v, 29) * 0.15;
        const fineGrain = hash(x, y) - 0.5;
        // Occasional tiny fossil-like flecks: much sparser and smaller than
        // Travertino's pores, and never dug in as deep.
        const px = u * 140,
          py = v * 140;
        const ix = Math.floor(px),
          iy = Math.floor(py);
        const seed = hash(ix + 11, iy + 5);
        const dx = px - ix - 0.5 - (hash(ix + 3, iy) - 0.5) * 0.4;
        const dy = py - iy - 0.5 - (hash(ix, iy + 9) - 0.5) * 0.4;
        const fleck =
          seed > 0.85 ? 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dy), 0.02, 0.06) : 0;
        height[y * size + x] = cloud * 0.018 + fineGrain * 0.006 - fleck * 0.05;
        const value = 0.92 + (cloud - 0.5) * 0.09 + fineGrain * 0.016 - fleck * 0.05;
        const o = (y * size + x) * 4;
        color[o] = value * 255;
        color[o + 1] = (value - fleck * 0.006) * 255;
        color[o + 2] = (value - fleck * 0.014) * 255;
        color[o + 3] = 255;
        const r = (0.85 + cloud * 0.07 + fleck * 0.05) * 255;
        rough[o] = rough[o + 1] = rough[o + 2] = r;
        rough[o + 3] = 255;
      }
    const normal = heightToNormal(height, size, 3.6);
    return {
      colorMap: makeTexture(color, size, true),
      normalMap: makeTexture(normal, size, false),
      roughnessMap: makeTexture(rough, size, false),
    };
  });
}

const prunCache = new Map<number, StoneMaps>();

/** Reference-selected grey Prun finish: compact grain and pale mineral inclusions. */
export function createPrunMaps(size = 512): StoneMaps {
  return memoizedTemplate(prunCache, size, () => {
    const height = new Float32Array(size * size);
    const color = new Uint8Array(size * size * 4);
    const rough = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        const sediment =
          valueNoise(u, v, 7) * 0.45 + valueNoise(u, v, 23) * 0.35 + valueNoise(u, v, 59) * 0.2;
        // Fine horizontal stratification -- thin, dense sedimentary layering
        // rather than Travertino's broad flowing bands.
        const strata = Math.sin(v * 74 + valueNoise(u, v, 6) * 1.5) * 0.02;
        const fineGrain = hash(x, y) - 0.5;
        const px = u * 48,
          py = v * 48;
        const ix = Math.floor(px),
          iy = Math.floor(py);
        const seed = hash(ix + 5, iy + 13);
        const dx = px - ix - 0.5 - (hash(ix + 2, iy) - 0.5) * 0.45;
        const dy = py - iy - 0.5 - (hash(ix, iy + 4) - 0.5) * 0.45;
        const pore =
          seed > 0.55
            ? 1 - THREE.MathUtils.smoothstep(Math.hypot(dx, dy), 0.02, 0.055 + seed * 0.05)
            : 0;
        // Sparse, very low-opacity dusty-rose mineral inclusion -- a warm
        // undertone hint, never a pink cast.
        const warmSpot = valueNoise(u * 0.7, v * 0.7, 13) > 0.72 ? valueNoise(u, v, 31) : 0;
        height[y * size + x] = (sediment + strata) * 0.03 + fineGrain * 0.008 - pore * 0.16;
        const inclusion =
          seed > 0.64 ? 1 - THREE.MathUtils.smoothstep(Math.hypot(dx * 0.8, dy), 0.1, 0.29) : 0;
        const value =
          0.78 +
          (sediment - 0.5) * 0.22 +
          strata * 0.6 +
          fineGrain * 0.055 -
          pore * 0.1 +
          inclusion * 0.2;
        const o = (y * size + x) * 4;
        color[o] = (value + warmSpot * 0.03) * 255;
        color[o + 1] = (value - pore * 0.012 + warmSpot * 0.006) * 255;
        color[o + 2] = (value - pore * 0.03 - warmSpot * 0.01) * 255;
        color[o + 3] = 255;
        const r = (0.83 + sediment * 0.08 + pore * 0.07) * 255;
        rough[o] = rough[o + 1] = rough[o + 2] = r;
        rough[o + 3] = 255;
      }
    const normal = heightToNormal(height, size, 3.4);
    return {
      colorMap: makeTexture(color, size, true),
      normalMap: makeTexture(normal, size, false),
      roughnessMap: makeTexture(rough, size, false),
    };
  });
}

const anthraciteCache = new Map<number, StoneMaps>();

/** Beige porcelain (legacy factory name retained for compatibility): broad, very
 * low-contrast clouding and near-imperceptible grain, deliberately with no
 * pores and no directional structure so it reads as refined porcelain
 * rather than a porous natural stone. */
export function createAnthraciteMaps(size = 512): StoneMaps {
  return memoizedTemplate(anthraciteCache, size, () => {
    const height = new Float32Array(size * size);
    const color = new Uint8Array(size * size * 4);
    const rough = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        const cloud = valueNoise(u, v, 3) * 0.6 + valueNoise(u, v, 8) * 0.4;
        const fineGrain = hash(x, y) - 0.5;
        height[y * size + x] = cloud * 0.01 + fineGrain * 0.003;
        const value = 0.86 + (cloud - 0.5) * 0.06 + fineGrain * 0.01;
        const o = (y * size + x) * 4;
        color[o] = value * 255;
        color[o + 1] = value * 255;
        color[o + 2] = (value + 0.004) * 255; // whisper-cool neutral undertone
        color[o + 3] = 255;
        const r = (0.78 + cloud * 0.05) * 255;
        rough[o] = rough[o + 1] = rough[o + 2] = r;
        rough[o + 3] = 255;
      }
    const normal = heightToNormal(height, size, 4.2);
    return {
      colorMap: makeTexture(color, size, true),
      normalMap: makeTexture(normal, size, false),
      roughnessMap: makeTexture(rough, size, false),
    };
  });
}

const slateCache = new Map<number, StoneMaps>();

/** Ardesia -- dark stratified slate: thin, regular cleavage-plane banding
 * (not travertine's flowing sediment) plus sparse hairline fractures where
 * two plates meet. Low value range and a cool blue-grey undertone keep it
 * unmistakably darker than every other finish; low pore count and a compact
 * grain keep it "refined stone", not craggy rubble. */
export function createSlateMaps(size = 512): StoneMaps {
  return memoizedTemplate(slateCache, size, () => {
    const height = new Float32Array(size * size);
    const color = new Uint8Array(size * size * 4);
    const rough = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        const cloud =
          valueNoise(u, v, 6) * 0.5 + valueNoise(u, v, 17) * 0.3 + valueNoise(u, v, 41) * 0.2;
        // Thin, regular cleavage strata -- much tighter and more even than
        // Prun's sedimentary layering, the defining slate structure.
        const strata =
          Math.sin(v * 130 + valueNoise(u, v, 5) * 0.8) * 0.018 +
          Math.sin(v * 331 - valueNoise(u, v, 9) * 0.5) * 0.008;
        const fineGrain = hash(x, y) - 0.5;
        // Sparse hairline fractures along a cleavage plane, not round pores.
        const px = u * 30,
          py = v * 30;
        const ix = Math.floor(px),
          iy = Math.floor(py);
        const seed = hash(ix + 21, iy + 4);
        const fracture =
          seed > 0.88 ? 1 - THREE.MathUtils.smoothstep(Math.abs(py - iy - 0.5), 0, 0.05) : 0;
        height[y * size + x] = (cloud * 0.02 + strata) * 1.4 + fineGrain * 0.006 - fracture * 0.035;
        const value =
          0.34 + (cloud - 0.5) * 0.1 + strata * 1.6 + fineGrain * 0.02 - fracture * 0.05;
        const o = (y * size + x) * 4;
        color[o] = (value - 0.01) * 255;
        color[o + 1] = value * 255;
        color[o + 2] = (value + 0.015) * 255; // cool blue-grey undertone
        color[o + 3] = 255;
        const r = (0.76 + cloud * 0.06 + fracture * 0.06) * 255;
        rough[o] = rough[o + 1] = rough[o + 2] = r;
        rough[o + 3] = 255;
      }
    const normal = heightToNormal(height, size, 3.0);
    return {
      colorMap: makeTexture(color, size, true),
      normalMap: makeTexture(normal, size, false),
      roughnessMap: makeTexture(rough, size, false),
    };
  });
}

const deckWoodCache = new Map<number, StoneMaps>();

/** Deck Marrone -- warm brown outdoor plank decking. `moduleSize` is tuned
 * to one board's real width, so the baked board-edge seam and directional
 * grain both tile at true scale rather than an arbitrary repeat. Grain runs
 * along v (the board's length) with sparse growth-ring arcs and knots; two
 * faint seams near the top/bottom of the tile read as the gap between
 * boards when triplanar-tiled. */
export function createWoodDeckMaps(size = 512): StoneMaps {
  return memoizedTemplate(deckWoodCache, size, () => {
    const height = new Float32Array(size * size);
    const color = new Uint8Array(size * size * 4);
    const rough = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        // Fine parallel grain lines running along the board's length (v).
        const grain =
          Math.sin(v * 90 + valueNoise(u * 0.3, v, 4) * 6) * 0.045 +
          Math.sin(v * 210 - valueNoise(u * 0.3, v, 9) * 4) * 0.02;
        const tone = valueNoise(u, v * 0.35, 5) * 0.6 + valueNoise(u, v * 0.35, 13) * 0.4;
        const fineGrain = hash(x, y) - 0.5;
        // Sparse growth-ring arcs (knots), never covering more than a speck.
        const px = u * 26,
          py = v * 9;
        const ix = Math.floor(px),
          iy = Math.floor(py);
        const seed = hash(ix + 41, iy + 6);
        const dx = px - ix - 0.5 - (hash(ix + 2, iy) - 0.5) * 0.4;
        const dy = py - iy - 0.5 - (hash(ix, iy + 6) - 0.5) * 0.4;
        const knot =
          seed > 0.93 ? 1 - THREE.MathUtils.smoothstep(Math.hypot(dx * 2.2, dy), 0.03, 0.12) : 0;
        // Board-edge seam: a shallow, dark channel at the very top/bottom of
        // the tile -- the gap between adjacent boards once tiled.
        const seam = Math.max(0, 1 - Math.min(v, 1 - v) * size * 0.05);
        height[y * size + x] =
          grain * 0.5 + tone * 0.015 + fineGrain * 0.01 - knot * 0.05 - seam * 0.05;
        const value =
          0.5 + (tone - 0.5) * 0.24 + grain * 1.1 + fineGrain * 0.03 - knot * 0.16 - seam * 0.22;
        const o = (y * size + x) * 4;
        color[o] = (value + 0.22) * 255;
        color[o + 1] = (value + 0.09) * 255;
        color[o + 2] = (value - 0.02) * 255;
        color[o + 3] = 255;
        const r = (0.58 + tone * 0.1 + Math.abs(grain) * 0.5 + seam * 0.1) * 255;
        rough[o] = rough[o + 1] = rough[o + 2] = r;
        rough[o + 3] = 255;
      }
    const normal = heightToNormal(height, size, 2.4);
    return {
      colorMap: makeTexture(color, size, true),
      normalMap: makeTexture(normal, size, false),
      roughnessMap: makeTexture(rough, size, false),
    };
  });
}

const wpcCache = new Map<number, StoneMaps>();

/** WPC -- wood-plastic composite decking. Reuses the deck's directional
 * board grammar (grain direction + board-edge seam) but with tighter, far
 * more regular ridges and no knots/tone drift -- the manufactured
 * uniformity that visually distinguishes a composite board from real wood. */
export function createWPCMaps(size = 512): StoneMaps {
  return memoizedTemplate(wpcCache, size, () => {
    const height = new Float32Array(size * size);
    const color = new Uint8Array(size * size * 4);
    const rough = new Uint8Array(size * size * 4);
    for (let y = 0; y < size; y++)
      for (let x = 0; x < size; x++) {
        const u = x / size,
          v = y / size;
        // Regular, low-amplitude embossed ridges -- a manufactured grain,
        // not a natural one: fixed frequency, minimal randomised offset.
        const ridge = Math.sin(v * 150) * 0.03 + Math.sin(v * 340 + 0.6) * 0.012;
        const speckle = hash(x, y) - 0.5;
        const seam = Math.max(0, 1 - Math.min(v, 1 - v) * size * 0.045);
        height[y * size + x] = ridge * 0.5 + speckle * 0.005 - seam * 0.04;
        const value = 0.42 + ridge * 0.9 + speckle * 0.015 - seam * 0.18;
        const o = (y * size + x) * 4;
        color[o] = (value + 0.06) * 255;
        color[o + 1] = (value + 0.02) * 255;
        color[o + 2] = value * 255;
        color[o + 3] = 255;
        const r = (0.52 + Math.abs(ridge) * 0.4 + seam * 0.08) * 255;
        rough[o] = rough[o + 1] = rough[o + 2] = r;
        rough[o + 3] = 255;
      }
    const normal = heightToNormal(height, size, 2.2);
    return {
      colorMap: makeTexture(color, size, true),
      normalMap: makeTexture(normal, size, false),
      roughnessMap: makeTexture(rough, size, false),
    };
  });
}
