import * as THREE from "three";

/** Separable, wrap-around box blur (sliding-window sum, O(size²) total) --
 * used to extract the low-frequency component of a photographed texture so
 * it can be subtracted back out before deriving bump/roughness detail. */
function boxBlurWrapped(src: Float32Array, size: number, radius: number): Float32Array {
  const windowSize = radius * 2 + 1;
  const horizontal = new Float32Array(size * size);
  const out = new Float32Array(size * size);

  for (let y = 0; y < size; y++) {
    const row = y * size;
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += src[row + ((k + size) % size)]!;
    for (let x = 0; x < size; x++) {
      horizontal[row + x] = sum / windowSize;
      sum += src[row + ((x + radius + 1) % size)]! - src[row + ((x - radius + size) % size)]!;
    }
  }

  for (let x = 0; x < size; x++) {
    let sum = 0;
    for (let k = -radius; k <= radius; k++) sum += horizontal[((k + size) % size) * size + x]!;
    for (let y = 0; y < size; y++) {
      out[y * size + x] = sum / windowSize;
      sum +=
        horizontal[((y + radius + 1) % size) * size + x]! -
        horizontal[((y - radius + size) % size) * size + x]!;
    }
  }

  return out;
}

/**
 * Generic once-per-size memoization for the parameterless procedural maps
 * below: several unrelated components (studio floor, skimmers, PoolModel's
 * fallback micro-detail, staircase contact shadow) each call these factories
 * independently on mount, and every call re-runs the same per-pixel trig/
 * gradient loop over identical output. The expensive canvas is built once
 * per `size` and kept as a template; each call site still gets its own
 * `Texture` instance (via `.clone()`) so it can freely set `repeat`/
 * `anisotropy` and `dispose()` without affecting any other consumer -- only
 * the redundant CPU generation is removed.
 */
function memoizedTemplate(
  cache: Map<number, THREE.Texture>,
  size: number,
  build: () => THREE.Texture,
): THREE.Texture {
  let template = cache.get(size);
  if (!template) {
    template = build();
    cache.set(size, template);
  }
  return template.clone();
}

const microNormalTemplateCache = new Map<number, THREE.Texture>();

/** Neutral, seamless micro-normal used only to break perfectly flat highlights. */
export function createMaterialMicroNormalMap(size = 256): THREE.Texture {
  return memoizedTemplate(microNormalTemplateCache, size, () => buildMaterialMicroNormalMap(size));
}

function buildMaterialMicroNormalMap(size: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(size, size);
  const height = (x: number, y: number) => {
    const u = (((x + size) % size) / size) * Math.PI * 2;
    const v = (((y + size) % size) / size) * Math.PI * 2;
    return (
      Math.sin(u * 5 + Math.sin(v * 3) * 0.45) * 0.42 +
      Math.sin(v * 7 - Math.cos(u * 4) * 0.38) * 0.34 +
      Math.sin((u + v) * 11) * 0.14 +
      Math.sin((u - v) * 13) * 0.1
    );
  };
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = (height(x + 1, y) - height(x - 1, y)) * 0.22;
      const dy = (height(x, y + 1) - height(x, y - 1)) * 0.22;
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      const offset = (y * size + x) * 4;
      image.data[offset] = (-dx * inverseLength * 0.5 + 0.5) * 255;
      image.data[offset + 1] = (-dy * inverseLength * 0.5 + 0.5) * 255;
      image.data[offset + 2] = (inverseLength * 0.5 + 0.5) * 255;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

const microRoughnessTemplateCache = new Map<number, THREE.Texture>();

/** High-valued roughness modulation: subtle variation without darkening base colour. */
export function createMaterialMicroRoughnessMap(size = 256): THREE.Texture {
  return memoizedTemplate(microRoughnessTemplateCache, size, () =>
    buildMaterialMicroRoughnessMap(size),
  );
}

function buildMaterialMicroRoughnessMap(size: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const image = context.createImageData(size, size);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const u = (x / size) * Math.PI * 2;
      const v = (y / size) * Math.PI * 2;
      const variation =
        Math.sin(u * 5 + v * 3) * 0.45 +
        Math.sin(v * 7 - u * 2) * 0.32 +
        Math.sin((u + v) * 11) * 0.23;
      const value = Math.round(238 + variation * 9);
      const offset = (y * size + x) * 4;
      image.data[offset] = value;
      image.data[offset + 1] = value;
      image.data[offset + 2] = value;
      image.data[offset + 3] = 255;
    }
  }
  context.putImageData(image, 0, 0);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  return texture;
}

/** Height field shared by both ripple layers -- broad, slow swells vs. tight, fast chop. */
function rippleHeight(layer: "broad" | "micro", x: number, y: number, size: number): number {
  const u = (x / size) * Math.PI * 2;
  const v = (y / size) * Math.PI * 2;
  if (layer === "broad") {
    return (
      Math.sin(u * 2 + Math.sin(v * 2) * 0.42) * 0.5 +
      Math.sin(v * 3 - Math.cos(u * 2) * 0.35) * 0.32
    );
  }
  return (
    Math.sin(u * 7 + v * 5 + Math.sin(v * 3) * 0.28) * 0.2 +
    Math.sin(u * 11 - v * 9 - Math.cos(u * 4) * 0.22) * 0.14
  );
}

/** One seamless layer of the calm dual-scale pool-water normal field. */
export function createRippleNormalMap(
  layer: "broad" | "micro" = "broad",
  size = 256,
): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  const height = (x: number, y: number) => rippleHeight(layer, x, y, size);

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height((x + 1) % size, y) - height((x - 1 + size) % size, y);
      const dy = height(x, (y + 1) % size) - height(x, (y - 1 + size) % size);
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      image.data[i] = (-dx * inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 1] = (-dy * inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 2] = (inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

/**
 * Single-texture bake of the same broad+micro ripple combination the raster
 * WaterSurfaceMaterial blends live in its fragment shader (see
 * DUAL_NORMAL_FRAGMENT in WaterSurfaceMaterial.tsx). Photo Mode's path-traced
 * water material has no equivalent per-pixel shader hook to do that blend at
 * render time -- three-gpu-pathtracer reads one plain `normalMap` per
 * material -- so this pre-combines both scales' slopes, weighted the same
 * way, into one map. Without it Photo Mode's water has no normal map at all
 * and reads as a perfectly flat mirror; this is what stands in for the
 * raster dual-normal look there.
 */
export function createDualRippleNormalMap(
  largeStrength: number,
  microStrength: number,
  size = 512,
): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  const slopeAt = (layer: "broad" | "micro", x: number, y: number) => {
    const h = (px: number, py: number) => rippleHeight(layer, px, py, size);
    return [
      h((x + 1) % size, y) - h((x - 1 + size) % size, y),
      h(x, (y + 1) % size) - h(x, (y - 1 + size) % size),
    ] as const;
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const [broadDx, broadDy] = slopeAt("broad", x, y);
      const [microDx, microDy] = slopeAt("micro", x, y);
      const dx = broadDx * largeStrength + microDx * microStrength;
      const dy = broadDy * largeStrength + microDy * microStrength;
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      const i = (y * size + x) * 4;
      image.data[i] = (-dx * inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 1] = (-dy * inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 2] = (inverseLength * 0.5 + 0.5) * 255;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  return texture;
}

export interface DerivedDetailMaps {
  normalMap: THREE.Texture;
  roughnessMap: THREE.Texture;
}

const derivedDetailCache = new Map<string, DerivedDetailMaps>();

/**
 * Derives a real normal + micro-roughness pair from an already-loaded
 * base-colour photo (a liner or mosaic finish), instead of layering the same
 * generic synthetic noise field under every material. Printed grout lines,
 * grain and joints become physically-correlated bump and roughness, so
 * different finishes (sand grain vs. glossy deep-sea vs. mosaic joints) read
 * as distinct materials rather than one shared bump pattern in disguise.
 * Cached per source image so switching back to a previously-seen finish is
 * instant.
 */
export function getDerivedDetailMaps(colorTexture: THREE.Texture): DerivedDetailMaps | null {
  const image = colorTexture.image as
    HTMLImageElement | HTMLCanvasElement | ImageBitmap | undefined;
  if (!image || !image.width || !image.height) return null;

  const cacheKey = colorTexture.source?.uuid ?? colorTexture.uuid;
  const cached = derivedDetailCache.get(cacheKey);
  if (cached) return cached;

  // Downsampled working resolution: plenty of definition once tiled and
  // mipmapped, without the cost of processing the full photo per pixel.
  const size = 512;
  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = size;
  sourceCanvas.height = size;
  const sourceCtx = sourceCanvas.getContext("2d");
  if (!sourceCtx) return null;
  sourceCtx.drawImage(image, 0, 0, size, size);
  const { data } = sourceCtx.getImageData(0, 0, size, size);

  const luminance = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) {
    const o = i * 4;
    luminance[i] = (data[o]! * 0.2126 + data[o + 1]! * 0.7152 + data[o + 2]! * 0.0722) / 255;
  }
  // The source photo's own soft studio lighting/vignette is a broad,
  // slow luminance gradient -- turned directly into surface relief it reads
  // as cloudy/blotchy patches once tiled. Subtracting a blurred (low-
  // frequency) estimate leaves only genuine high-frequency detail (grout
  // joints, print grain) for the Sobel pass below to pick up.
  const lowFrequency = boxBlurWrapped(luminance, size, 24);
  const detail = new Float32Array(size * size);
  for (let i = 0; i < size * size; i++) detail[i] = luminance[i]! - lowFrequency[i]! + 0.5;
  const at = (x: number, y: number) => detail[((y + size) % size) * size + ((x + size) % size)]!;

  const normalImage = new Uint8ClampedArray(size * size * 4);
  const roughnessImage = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      // Sobel gradient of the real photographed pattern: grout joints and
      // print seams become genuine surface relief instead of an unrelated
      // hash field.
      const gx =
        at(x + 1, y - 1) +
        2 * at(x + 1, y) +
        at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x - 1, y) + at(x - 1, y + 1));
      const gy =
        at(x - 1, y + 1) +
        2 * at(x, y + 1) +
        at(x + 1, y + 1) -
        (at(x - 1, y - 1) + 2 * at(x, y - 1) + at(x + 1, y - 1));
      const dx = gx * 1.4;
      const dy = gy * 1.4;
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;
      normalImage[o] = (-dx * inverseLength * 0.5 + 0.5) * 255;
      normalImage[o + 1] = (-dy * inverseLength * 0.5 + 0.5) * 255;
      normalImage[o + 2] = (inverseLength * 0.5 + 0.5) * 255;
      normalImage[o + 3] = 255;

      // Grout/seam edges scatter light slightly more than flat tile faces;
      // kept close to neutral (matches the previous ~238±9 magnitude) so it
      // modulates roughness without ever darkening the base colour.
      const edge = Math.min(1, Math.hypot(gx, gy));
      roughnessImage[o] =
        roughnessImage[o + 1] =
        roughnessImage[o + 2] =
          Math.round(230 + edge * 25);
      roughnessImage[o + 3] = 255;
    }
  }

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  normalCanvas.getContext("2d")!.putImageData(new ImageData(normalImage, size, size), 0, 0);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.generateMipmaps = true;
  normalMap.needsUpdate = true;

  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = size;
  roughnessCanvas.height = size;
  roughnessCanvas.getContext("2d")!.putImageData(new ImageData(roughnessImage, size, size), 0, 0);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  roughnessMap.magFilter = THREE.LinearFilter;
  roughnessMap.generateMipmaps = true;
  roughnessMap.needsUpdate = true;

  const result: DerivedDetailMaps = { normalMap, roughnessMap };
  derivedDetailCache.set(cacheKey, result);
  return result;
}

/** Deterministic 2D hash in [0, 1); shared by every procedural generator below. */
function hash2D(x: number, y: number): number {
  const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123;
  return value - Math.floor(value);
}

/**
 * Cellular (Worley) distance field, tiled seamlessly across `cellsPerTile`
 * feature cells per axis: neighbour lookups wrap the *hash* index (so the
 * jittered feature points repeat exactly at the tile boundary) while the
 * distance itself is measured in unwrapped space, which is the standard
 * technique for a repeatable Worley texture. `u`/`v` are expected in [0, 1).
 */
function tileableWorley(u: number, v: number, cellsPerTile: number): number {
  const px = u * cellsPerTile;
  const py = v * cellsPerTile;
  const cx = Math.floor(px);
  const cy = Math.floor(py);
  let minDistance = 10;
  for (let oy = -1; oy <= 1; oy++) {
    for (let ox = -1; ox <= 1; ox++) {
      const wrappedX = (((cx + ox) % cellsPerTile) + cellsPerTile) % cellsPerTile;
      const wrappedY = (((cy + oy) % cellsPerTile) + cellsPerTile) % cellsPerTile;
      const jitterX = hash2D(wrappedX, wrappedY);
      const jitterY = hash2D(wrappedY, wrappedX + 71.3);
      const featureX = cx + ox + jitterX;
      const featureY = cy + oy + jitterY;
      const distance = Math.hypot(px - featureX, py - featureY);
      if (distance < minDistance) minDistance = distance;
    }
  }
  return minDistance / cellsPerTile;
}

/**
 * Multi-octave, domain-warped height field for a cast/poured mineral surface
 * (coping, concrete, natural stone): broad waviness from a few warped sine
 * octaves plus a tileable Worley pass punched in as small pores and pitting,
 * so close-up trim reads as a real cast material instead of a flat tint.
 * `u`/`v` are angular (radians, one full period per texture repeat), matching
 * every other procedural map in this module -- guaranteeing a seamless tile
 * without needing 4D/toroidal noise.
 */
function stoneHeightField(u: number, v: number): number {
  const warpX = Math.sin(v * 3 + Math.cos(u * 2) * 0.6) * 0.5;
  const warpY = Math.cos(u * 4 - Math.sin(v * 3) * 0.55) * 0.5;
  const fbm =
    Math.sin((u + warpX) * 3 + Math.sin(v * 2) * 0.6) * 0.34 +
    Math.sin((v + warpY) * 5 - Math.cos(u * 3) * 0.5) * 0.26 +
    Math.sin((u - v) * 8 + warpX * 2) * 0.18 +
    Math.sin((u + v) * 13 - warpY * 2) * 0.12 +
    Math.sin(u * 21 + v * 17) * 0.06;
  const pit = tileableWorley(u / (Math.PI * 2), v / (Math.PI * 2), 10);
  const pitting = Math.max(0, 1 - pit * 3.4);
  return fbm * 0.55 - pitting * 0.55;
}

/**
 * Height field for a manufactured composite/steel above-ground panel: much
 * flatter than stone (it is a factory product, not a cast material), with a
 * faint fBm waviness and a very subtle brushed/rolled streak along the
 * vertical axis instead of pitting.
 */
function panelHeightField(u: number, v: number): number {
  const fbm =
    Math.sin(u * 6 + Math.sin(v * 2) * 0.3) * 0.14 +
    Math.sin(v * 9 - Math.cos(u * 3) * 0.25) * 0.1 +
    Math.sin((u + v) * 15) * 0.05;
  const brushed = Math.sin(v * 60) * 0.03;
  return fbm * 0.5 + brushed;
}

const architecturalDetailCache = new Map<string, DerivedDetailMaps>();

/**
 * Procedural normal + roughness pair for a material family with no
 * photographed source (coping stone, above-ground panels): a richer
 * multi-octave/Worley height field than the single-frequency sine noise it
 * replaces, Sobel-derived into a real tangent-space normal exactly like
 * `getDerivedDetailMaps`, with roughness pushed up inside pores/pitting.
 * These are still meant to be *sampled triplanar* by the caller (see
 * `PoolModel`'s coping/panel materials) rather than through the mesh's own
 * UVs, so the seamless tiling here is what actually prevents a visible grid.
 */
export function createTriplanarDetailMaps(kind: "stone" | "panel", size = 512): DerivedDetailMaps {
  const cached = architecturalDetailCache.get(kind);
  if (cached) return cached;

  const heightField = kind === "stone" ? stoneHeightField : panelHeightField;
  const height = (x: number, y: number) => {
    const u = (((x + size) % size) / size) * Math.PI * 2;
    const v = (((y + size) % size) / size) * Math.PI * 2;
    return heightField(u, v);
  };

  const normalImage = new Uint8ClampedArray(size * size * 4);
  const roughnessImage = new Uint8ClampedArray(size * size * 4);
  const roughnessBase = kind === "stone" ? 232 : 246;
  const roughnessGain = kind === "stone" ? 30 : 10;
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const dx = height(x + 1, y) - height(x - 1, y);
      const dy = height(x, y + 1) - height(x, y - 1);
      const inverseLength = 1 / Math.hypot(dx, dy, 1);
      const o = (y * size + x) * 4;
      normalImage[o] = (-dx * inverseLength * 0.5 + 0.5) * 255;
      normalImage[o + 1] = (-dy * inverseLength * 0.5 + 0.5) * 255;
      normalImage[o + 2] = (inverseLength * 0.5 + 0.5) * 255;
      normalImage[o + 3] = 255;

      const edge = Math.min(1, Math.hypot(dx, dy) * 2.2);
      const value = Math.round(roughnessBase + edge * roughnessGain);
      roughnessImage[o] = value;
      roughnessImage[o + 1] = value;
      roughnessImage[o + 2] = value;
      roughnessImage[o + 3] = 255;
    }
  }

  const normalCanvas = document.createElement("canvas");
  normalCanvas.width = size;
  normalCanvas.height = size;
  normalCanvas.getContext("2d")!.putImageData(new ImageData(normalImage, size, size), 0, 0);
  const normalMap = new THREE.CanvasTexture(normalCanvas);
  normalMap.wrapS = THREE.RepeatWrapping;
  normalMap.wrapT = THREE.RepeatWrapping;
  normalMap.colorSpace = THREE.NoColorSpace;
  normalMap.minFilter = THREE.LinearMipmapLinearFilter;
  normalMap.magFilter = THREE.LinearFilter;
  normalMap.generateMipmaps = true;
  normalMap.needsUpdate = true;

  const roughnessCanvas = document.createElement("canvas");
  roughnessCanvas.width = size;
  roughnessCanvas.height = size;
  roughnessCanvas.getContext("2d")!.putImageData(new ImageData(roughnessImage, size, size), 0, 0);
  const roughnessMap = new THREE.CanvasTexture(roughnessCanvas);
  roughnessMap.wrapS = THREE.RepeatWrapping;
  roughnessMap.wrapT = THREE.RepeatWrapping;
  roughnessMap.colorSpace = THREE.NoColorSpace;
  roughnessMap.minFilter = THREE.LinearMipmapLinearFilter;
  roughnessMap.magFilter = THREE.LinearFilter;
  roughnessMap.generateMipmaps = true;
  roughnessMap.needsUpdate = true;

  const result: DerivedDetailMaps = { normalMap, roughnessMap };
  architecturalDetailCache.set(kind, result);
  return result;
}

/**
 * Soft radial dark falloff (black, alpha only) used as a cheap, geometry-free
 * contact shadow: a small alpha-blended decal at a fitting's real seam
 * (skimmer-to-wall, staircase-to-ground) grounds it convincingly without any
 * post-processing dependency, so it reads identically in Configuration and
 * Experience. Deliberately gentle -- a soft gradient, not a hard dark ring.
 */
const contactAOTemplateCache = new Map<number, THREE.Texture>();

export function createContactAOGradientMap(size = 128): THREE.Texture {
  return memoizedTemplate(contactAOTemplateCache, size, () => buildContactAOGradientMap(size));
}

function buildContactAOGradientMap(size: number): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  const gradient = context.createRadialGradient(
    size / 2,
    size / 2,
    0,
    size / 2,
    size / 2,
    size / 2,
  );
  gradient.addColorStop(0, "rgba(10,12,12,0.4)");
  gradient.addColorStop(0.55, "rgba(10,12,12,0.18)");
  gradient.addColorStop(1, "rgba(10,12,12,0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/**
 * Seamless fine-grain mineral surface used by the coping. The map is created
 * locally so the close-up keeps its material definition without relying on a
 * remote texture or increasing the downloadable asset set.
 */
export function createStoneDetailMap(size = 256): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const image = ctx.createImageData(size, size);

  const hash = (x: number, y: number) => {
    const value = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
    return value - Math.floor(value);
  };

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const coarse = hash(Math.floor(x / 5), Math.floor(y / 5));
      const fine = hash(x, y);
      const vein = Math.sin((x + y * 0.73) * 0.045) * 0.5 + 0.5;
      const value = Math.round(105 + coarse * 68 + fine * 54 + vein * 20);
      const i = (y * size + x) * 4;
      image.data[i] = value;
      image.data[i + 1] = value;
      image.data[i + 2] = value;
      image.data[i + 3] = 255;
    }
  }
  ctx.putImageData(image, 0, 0);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(5, 5);
  texture.colorSpace = THREE.NoColorSpace;
  return texture;
}

/** Repeating slatted drainage detail for the exposed overflow grating. */
export function createDrainageGrateMap(size = 256): THREE.Texture {
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const context = canvas.getContext("2d")!;
  context.fillStyle = "#b8bbb8";
  context.fillRect(0, 0, size, size);
  context.fillStyle = "#303535";
  context.fillRect(0, 0, Math.max(3, size * 0.12), size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}
