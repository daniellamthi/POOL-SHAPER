import { ShaderChunk, type WebGLProgramParametersWithUniforms } from "three";

export const MOSAIC_SAMPLING_REVISION = "tessera-atlas-v1";
export const MOSAIC_TESSERA_PITCH = 0.025;

/** One deterministic choice per real tessera, never a rotated/mirrored sheet.
 * All four existing PBR maps sample the same photographed source tile. The
 * original UV metric and tangent direction remain unchanged. */
const HEADER = `
uniform float poolMosaicCells;
vec2 poolMosaicHash(vec2 cell) {
  return fract(sin(vec2(dot(cell, vec2(127.1, 311.7)),
    dot(cell, vec2(269.5, 183.3)))) * 43758.5453);
}
vec2 poolMosaicUv(vec2 uv) {
  vec2 grid = uv * poolMosaicCells;
  vec2 sourceCell = floor(poolMosaicHash(floor(grid)) * poolMosaicCells);
  return (sourceCell + fract(grid)) / poolMosaicCells;
}
`;

export function configureMosaicSampling(shader: WebGLProgramParametersWithUniforms, sheetSize: number) {
  const cells = Math.round(sheetSize / MOSAIC_TESSERA_PITCH);
  if (cells !== 8 && cells !== 9) throw new Error("Unsupported photographed mosaic grid");
  shader.uniforms["poolMosaicCells"] = { value: cells };
  shader.fragmentShader = shader.fragmentShader.replace("#include <common>", `#include <common>\n${HEADER}`);
  for (const [chunk, sampler, uv] of [
    ["map_fragment", "map", "vMapUv"],
    ["normal_fragment_maps", "normalMap", "vNormalMapUv"],
    ["roughnessmap_fragment", "roughnessMap", "vRoughnessMapUv"],
    ["aomap_fragment", "aoMap", "vAoMapUv"],
  ] as const) {
    let source = ShaderChunk[chunk].replaceAll(
      `texture2D( ${sampler}, ${uv} )`,
      // Explicit derivatives prevent atlas jumps selecting a blurry sheet mip.
      `textureGrad( ${sampler}, poolMosaicSampleUv, poolMosaicDx, poolMosaicDy )`,
    );
    if (chunk === "map_fragment") source = `
      // One tile lookup per fragment, shared by the four existing PBR samples.
      vec2 poolMosaicSampleUv = poolMosaicUv(vMapUv);
      vec2 poolMosaicDx = dFdx(vMapUv), poolMosaicDy = dFdy(vMapUv);
    ` + source;
    shader.fragmentShader = shader.fragmentShader.replace(`#include <${chunk}>`, source);
  }
}

/** CPU mirror for repeatability, metric and source-identity regression tests. */
export function mosaicSourceCell(x: number, y: number, cells: number): readonly [number, number] {
  const hash = (a: number, b: number) => {
    const value = Math.sin(x * a + y * b) * 43758.5453;
    return value - Math.floor(value);
  };
  return [Math.floor(hash(127.1, 311.7) * cells), Math.floor(hash(269.5, 183.3) * cells)];
}
