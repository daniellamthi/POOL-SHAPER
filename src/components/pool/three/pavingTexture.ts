import { ShaderChunk, type WebGLProgramParametersWithUniforms } from "three";

/** Existing deck scan: this strip lies inside a single board, away from
 * photographed seams and fixings. Isotropic metric UVs preserve grain scale;
 * mirrored sampling keeps long boards continuous without adding fake joints. */
export const WOOD_GRAIN_SCALE = 0.057 / 0.14;
/** The existing concrete-effect scan contains formwork lines. Sample its
 * uninterrupted mineral field instead: joints come exclusively from the mesh. */
export function samplePavingGres(shader: WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = `
    vec2 pavingGresUv(vec2 p) {
      vec2 q = mod(p, vec2(0.28, 0.32));
      return vec2(0.41, 0.36) + min(q, vec2(0.28, 0.32) - q);
    }
  ` + shader.fragmentShader;
  for (const [chunk, varying] of [
    ["map_fragment", "vMapUv"], ["roughnessmap_fragment", "vRoughnessMapUv"],
    ["normal_fragment_maps", "vNormalMapUv"],
  ] as const) {
    let source = ShaderChunk[chunk].replaceAll(varying, `pavingGresUv(${varying})`);
    if (chunk === "map_fragment") source += "\n diffuseColor.rgb = mix(vec3(0.38, 0.36, 0.32), diffuseColor.rgb, 0.22);";
    if (chunk === "normal_fragment_maps") source = source.replace("mapN.xy *= normalScale;",
      "mapN.xy *= vec2(mod(vNormalMapUv.x, 0.28) < 0.14 ? 1.0 : -1.0, mod(vNormalMapUv.y, 0.32) < 0.16 ? 1.0 : -1.0); mapN.xy *= normalScale;");
    shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, source);
  }
}
export function samplePavingWood(shader: WebGLProgramParametersWithUniforms) {
  shader.fragmentShader = `
    vec2 pavingWoodUv(vec2 p) {
      // Pixel columns144..286 stay inside one photographed board. The old
      //128..307 strip included end joints in colour, normal and roughness.
      float u = mod(p.x, 0.5546875);
      return vec2(0.28125 + min(u, 0.5546875 - u), 0.008 + clamp(p.y, 0.0, 0.057));
    }
  ` + shader.fragmentShader;
  for (const [chunk, varying] of [
    ["map_fragment", "vMapUv"],
    ["roughnessmap_fragment", "vRoughnessMapUv"],
    ["normal_fragment_maps", "vNormalMapUv"],
  ] as const) {
    let source = ShaderChunk[chunk].replaceAll(varying, `pavingWoodUv(${varying})`);
    if (chunk === "normal_fragment_maps") source = source.replace(
      "mapN.xy *= normalScale;",
      "mapN.x *= mod(vNormalMapUv.x, 0.5546875) < 0.27734375 ? 1.0 : -1.0; mapN.xy *= normalScale;",
    );
    shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, source);
  }
}
