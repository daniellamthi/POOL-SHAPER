import * as THREE from "three";
import { boostMetalEnvironment } from "./metalEnvironment";

export type RawShellKind = "steel" | "concrete" | "stainless";
// Indicative construction finish, not a manufacturer's scan or structural spec.
// The existing visual panel convention is 0.9 m. No bolts/rebar are invented.
export const RAW_PANEL_MODULE_METRES = 0.9;
const SIZE = 512;
const cache = new Map<RawShellKind, { color: THREE.DataTexture; normal: THREE.DataTexture; roughness: THREE.DataTexture }>();

function structuralMaps(kind: RawShellKind) {
  const existing = cache.get(kind);
  if (existing) return existing;
  const color = new Uint8Array(SIZE * SIZE * 4);
  const normal = new Uint8Array(color.length);
  const roughness = new Uint8Array(color.length);
  const heights = new Float32Array(SIZE * SIZE);
  const noise = (x: number, y: number) => {
    const n = Math.sin(x * 127.1 + y * 311.7 + 19.13) * 43758.5453;
    return n - Math.floor(n);
  };
  const field = (u: number, v: number, cells: number) => {
    const x = u * cells, y = v * cells, ix = Math.floor(x), iy = Math.floor(y);
    const smooth = (t: number) => t * t * (3 - 2 * t);
    const tx = smooth(x - ix), ty = smooth(y - iy);
    const sample = (dx: number, dy: number) => noise((ix + dx) % cells, (iy + dy) % cells);
    return (sample(0, 0) * (1 - tx) + sample(1, 0) * tx) * (1 - ty)
      + (sample(0, 1) * (1 - tx) + sample(1, 1) * tx) * ty;
  };
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const n = noise(x, y), u = x / SIZE, v = y / SIZE;
    const cloud = (field(u, v, 7) * 0.65 + field(u, v, 23) * 0.35 - 0.5) * 2;
    const joint = kind === "steel" && (x < 3 || x >= SIZE - 3);
    const pore = kind === "concrete" && n > 0.987 ? 0.22 : 0;
    const brush = kind === "stainless" ? (Math.sin(y * 2.73) + Math.sin(y * 8.17)) * 0.0035 : 0;
    heights[y * SIZE + x] = joint ? -0.7 : n * 0.025 + cloud * 0.025 - pore + brush;
    // Stainless: a mid satin grey (AISI 316 brushed), not near-white chrome.
    const base = kind === "steel" ? 181 : kind === "stainless" ? 150 : 146;
    const value = joint ? 82 : base + cloud * (kind === "stainless" ? 2 : 5)
      + (n - 0.5) * (kind === "stainless" ? 5 : 14) - pore * 58;
    const i = (y * SIZE + x) * 4;
    color[i] = value;
    // Stainless is a neutral, very slightly warm grey: upward faces already
    // pick up the blue sky, so a cool base read as artificially blue.
    if (kind === "stainless") color[i] = value + 2;
    color[i + 1] = value + (kind === "steel" ? 5 : kind === "stainless" ? 1 : 0);
    color[i + 2] = value + (kind === "steel" ? 8 : kind === "stainless" ? -3 : -3);
    color[i + 3] = 255;
    const roughnessBase = kind === "steel" ? 170 : kind === "stainless" ? 166 : 229;
    roughness[i] = roughness[i + 1] = roughness[i + 2] = roughnessBase + cloud * 7;
    roughness[i + 3] = 255;
  }
  const height = (x: number, y: number) => heights[((y + SIZE) % SIZE) * SIZE + (x + SIZE) % SIZE]!;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const dx = (height(x - 1, y) - height(x + 1, y)) * 0.65;
    const dy = (height(x, y - 1) - height(x, y + 1)) * 0.65;
    const length = Math.hypot(dx, dy, 1), i = (y * SIZE + x) * 4;
    normal[i] = (dx / length * 0.5 + 0.5) * 255;
    normal[i + 1] = (dy / length * 0.5 + 0.5) * 255;
    normal[i + 2] = (1 / length * 0.5 + 0.5) * 255; normal[i + 3] = 255;
  }
  const texture = (data: Uint8Array, srgb = false) => {
    const t = new THREE.DataTexture(data, SIZE, SIZE);
    t.colorSpace = srgb ? THREE.SRGBColorSpace : THREE.NoColorSpace;
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter; t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true; t.needsUpdate = true;
    return t;
  };
  const maps = { color: texture(color, true), normal: texture(normal), roughness: texture(roughness) };
  // Two bounded, shared templates for the lifetime of the renderer; never
  // regenerated on resize, selection or per frame (~8 MiB including mipmaps).
  cache.set(kind, maps);
  return maps;
}

/** Material only. Existing floor/shell/comfort geometries remain identical. */
export function RawShellMaterial({
  kind = "concrete",
  wallSize,
  underwater,
}: {
  kind?: RawShellKind;
  wallSize?: readonly [number, number];
  /** Wet stainless basin: the pool's own underwater shader patch (absorption,
   * scattering, caustics) plus a cache key for it. */
  underwater?: { configure: (shader: THREE.WebGLProgramParametersWithUniforms) => void; key: string } | undefined;
}) {
  const maps = structuralMaps(kind);
  const module = kind === "steel" ? RAW_PANEL_MODULE_METRES : 1;
  const scale = wallSize ? [wallSize[0] / module, wallSize[1] / module] : [1 / module, 1 / module];
  const stainless = kind === "stainless";
  return (
    <meshPhysicalMaterial
      name={`raw-${kind}`}
      color="#ffffff"
      map={maps.color}
      normalMap={maps.normal}
      normalScale={stainless ? [0.12, 0.12] : [0.5, 0.5]}
      roughnessMap={maps.roughness}
      // Satin: ~0.5 effective roughness after the map -- soft, controlled highlights;
      // upward faces (floor, treads, shelf) must not mirror the sky into white.
      roughness={kind === "concrete" ? 1 : stainless ? 0.84 : 0.62}
      // A small diffuse share keeps brushed stainless reading grey from every
      // side; pure metal turned walls facing away from the sun into a dark
      // mirror of the ground.
      metalness={kind === "concrete" ? 0 : stainless ? 0.85 : 0.76}
      anisotropy={stainless ? 0.45 : 0}
      envMapIntensity={kind === "concrete" ? 0.72 : stainless ? 0.95 : 1.2}
      side={THREE.DoubleSide}
      onBeforeCompile={(shader) => {
        // Bare metal reads only its environment: lift the IBL radiance for the
        // steel shells (see StainlessSteelMaterial), never for concrete.
        if (kind !== "concrete")
          boostMetalEnvironment(shader, stainless ? 3 : 4, stainless ? 0.95 : 1.1);
        // Brushed stainless reads as a neutral grey: keep the reflections'
        // brightness but drain most of their colour, so the sky does not
        // tint the floor blue and the sand does not turn walls brown.
        if (stainless)
          shader.fragmentShader = shader.fragmentShader.replace(
            "#include <lights_fragment_maps>",
            `#include <lights_fragment_maps>
            #if defined( RE_IndirectSpecular )
              radiance = mix( radiance, vec3( dot( radiance, vec3( 0.2126, 0.7152, 0.0722 ) ) ), 0.7 );
              // Real-time IBL cannot see the basin reflecting itself: at grazing
              // angles walls and floor mirrored the dark ground instead of the
              // lit stainless around them. Keep a floor tied to the light the
              // surface actually receives.
              radiance = max( radiance, vec3( dot( iblIrradiance, vec3( 0.2126, 0.7152, 0.0722 ) ) ) * 0.55 );
            #endif`,
          );
        shader.vertexShader = shader.vertexShader.replace(
          "#include <uv_vertex>",
          `
        #include <uv_vertex>
        vMapUv *= vec2(${scale[0]}, ${scale[1]});
        vNormalMapUv *= vec2(${scale[0]}, ${scale[1]});
        vRoughnessMapUv *= vec2(${scale[0]}, ${scale[1]});
      `,
        );
        underwater?.configure(shader);
      }}
      customProgramCacheKey={() => `raw-shell-v9-${kind}-${scale.join("-")}-${underwater?.key ?? "dry"}`}
    />
  );
}
