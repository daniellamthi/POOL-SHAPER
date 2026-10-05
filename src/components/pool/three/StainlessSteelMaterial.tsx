import * as THREE from "three";
import type { WebGLProgramParametersWithUniforms } from "three";

/**
 * One shared stainless-steel (AISI 316) material for every visible inox part:
 * ladder, external staircase rails, luminaire trims, cover roller housing,
 * hydro-jet bezels. Before this each part carried its own flat
 * `meshStandardMaterial` with `metalness: 1`, which reads as grey plastic in
 * this scene for one reason that is easy to miss: three.js overrides a
 * material's `envMapIntensity` with `scene.environmentIntensity` whenever the
 * material has no envMap of its own (WebGLRenderer.setProgram), and the
 * studio runs its IBL at 0.24 so the liner/water calibration holds. A metal
 * has no diffuse term -- it is *only* its environment reflection -- so at
 * 0.24 every steel part was a quarter-brightness mirror of a dim room.
 *
 * `boostMetalEnvironment` lifts the specular IBL radiance for the metal only
 * (relative to whatever the scene is doing, so dusk still dims it and the
 * coastal HDR is capped), and the finish adds a brushed roughness/normal
 * micro-structure plus anisotropic highlights so it reads as drawn steel
 * rather than a perfect chrome ball. Non-metal materials are untouched.
 */
export type StainlessFinish = "satin" | "brushed" | "polished";

export const STAINLESS_STEEL = {
  /** Specular colour of stainless steel: F0 ≈ 0.56-0.60 linear, i.e. a cool
   * light grey in sRGB -- never white, which is what makes chrome look fake. */
  color: "#c9cdd0",
  finishes: {
    satin: { roughness: 0.3, anisotropy: 0.55 },
    brushed: { roughness: 0.38, anisotropy: 0.8 },
    polished: { roughness: 0.14, anisotropy: 0.3 },
  },
  /** Relative gain on the scene environment radiance for metal, and the
   * absolute ceiling it can never exceed (coastal HDR already runs at 0.85). */
  ibl: { gain: 7, maxIntensity: 1.9 },
  normalScale: 0.08,
} as const;

export const STAINLESS_IBL_CACHE_KEY = `stainless-ibl-v1-${STAINLESS_STEEL.ibl.gain}-${STAINLESS_STEEL.ibl.maxIntensity}`;

/** Multiplies only the environment specular radiance of a physical material.
 * Injected right after the IBL lookup, so the sun, LEDs, shadows and the
 * diffuse/irradiance terms stay exactly as the scene calibrates them. */
export function boostMetalEnvironment(
  shader: WebGLProgramParametersWithUniforms,
  gain: number = STAINLESS_STEEL.ibl.gain,
  maxIntensity: number = STAINLESS_STEEL.ibl.maxIntensity,
) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_fragment_maps>",
    `#include <lights_fragment_maps>
    #if defined( USE_ENVMAP ) && defined( RE_IndirectSpecular )
      radiance *= min( ${gain.toFixed(3)}, ${maxIntensity.toFixed(3)} / max( envMapIntensity, 1e-4 ) );
    #endif`,
  );
}

const MAP_SIZE = 256;
let brushedMaps: { roughness: THREE.DataTexture; normal: THREE.DataTexture } | null = null;

/** Drawn-steel micro-structure: fine streaks along U with a per-row roughness
 * drift. One 256px pair shared by every inox part for the renderer's lifetime
 * (~0.5 MiB with mipmaps); never regenerated per instance or per frame. */
function getBrushedMaps() {
  if (brushedMaps) return brushedMaps;
  const roughness = new Uint8Array(MAP_SIZE * MAP_SIZE * 4);
  const normal = new Uint8Array(MAP_SIZE * MAP_SIZE * 4);
  const hash = (v: number) => {
    const n = Math.sin(v * 127.1 + 19.13) * 43758.5453;
    return n - Math.floor(n);
  };
  const rows = new Float32Array(MAP_SIZE);
  for (let y = 0; y < MAP_SIZE; y++) {
    rows[y] = (hash(y) - 0.5) * 0.9 + (hash(y * 3.7) - 0.5) * 0.4;
  }
  for (let y = 0; y < MAP_SIZE; y++) {
    const above = rows[(y + MAP_SIZE - 1) % MAP_SIZE]!;
    const below = rows[(y + 1) % MAP_SIZE]!;
    const slope = (above - below) * 0.35;
    const length = Math.hypot(slope, 1);
    for (let x = 0; x < MAP_SIZE; x++) {
      const i = (y * MAP_SIZE + x) * 4;
      const grain = hash(x * 0.37 + y * 91.7) - 0.5;
      // Roughness factor around 0.9: streaks between 0.78 and 1.0.
      const value = Math.round(
        THREE.MathUtils.clamp(0.9 + rows[y]! * 0.11 + grain * 0.05, 0, 1) * 255,
      );
      roughness[i] = roughness[i + 1] = roughness[i + 2] = value;
      roughness[i + 3] = 255;
      normal[i] = 128;
      normal[i + 1] = Math.round(((slope / length) * 0.5 + 0.5) * 255);
      normal[i + 2] = Math.round(((1 / length) * 0.5 + 0.5) * 255);
      normal[i + 3] = 255;
    }
  }
  const texture = (data: Uint8Array) => {
    const t = new THREE.DataTexture(data, MAP_SIZE, MAP_SIZE);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.minFilter = THREE.LinearMipmapLinearFilter;
    t.magFilter = THREE.LinearFilter;
    t.generateMipmaps = true;
    t.anisotropy = 4;
    t.needsUpdate = true;
    return t;
  };
  brushedMaps = { roughness: texture(roughness), normal: texture(normal) };
  return brushedMaps;
}

export function StainlessSteelMaterial({
  finish = "satin",
  color = STAINLESS_STEEL.color,
  brushRotation = 0,
  side = THREE.FrontSide,
}: {
  finish?: StainlessFinish;
  color?: string;
  /** Brush direction in tangent space, radians. 0 follows the geometry's U. */
  brushRotation?: number;
  side?: THREE.Side;
}) {
  const maps = getBrushedMaps();
  const preset = STAINLESS_STEEL.finishes[finish];
  return (
    <meshPhysicalMaterial
      name={`stainless-${finish}`}
      color={color}
      metalness={1}
      roughness={preset.roughness}
      roughnessMap={maps.roughness}
      normalMap={maps.normal}
      normalScale={[STAINLESS_STEEL.normalScale, STAINLESS_STEEL.normalScale]}
      anisotropy={preset.anisotropy}
      anisotropyRotation={brushRotation}
      ior={2.5}
      side={side}
      onBeforeCompile={(shader) => boostMetalEnvironment(shader)}
      customProgramCacheKey={() => STAINLESS_IBL_CACHE_KEY}
    />
  );
}
