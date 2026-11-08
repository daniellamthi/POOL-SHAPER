import type { WebGLProgramParametersWithUniforms } from "three";

/** These scanned atlases store black RGB outside a separate alpha mask.
 * Filtering mixes black and covered texels, darkening the mip colour.
 * Recover the covered colour in linear light; fully covered texels are
 * unchanged. Bounded values avoid bright outliers at nearly empty texels.
 */
export function correctCatalogueFoliageCoverage(shader: WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <alphatest_fragment>",
    `#include <alphatest_fragment>
    #if defined(USE_MAP) && defined(USE_ALPHAMAP)
      diffuseColor.rgb = clamp(diffuseColor.rgb / max(diffuseColor.a, 0.05), vec3(0.0), vec3(1.0));
    #endif`,
  );
}
