import type { WebGLProgramParametersWithUniforms } from "three";

/** Shared stainless-steel constants and the metal-only IBL boost (see
 * StainlessSteelMaterial.tsx for why the boost exists). Kept out of the
 * component file so React fast refresh stays component-only. */
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
