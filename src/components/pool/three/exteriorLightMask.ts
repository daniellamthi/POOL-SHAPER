import { ShaderChunk, type WebGLProgramParametersWithUniforms } from "three";

/** Receiver-side light linking for dry exterior architecture. Submerged
 * luminaires cannot shine directly through an opaque pool shell. This keeps
 * sunlight/above-ground fixtures and IBL, without extra shadow render passes. */
export function excludeSubmergedDirectLights(shader: WebGLProgramParametersWithUniforms, waterY: number) {
  shader.uniforms["exteriorWaterY"] = { value: waterY };
  shader.fragmentShader = "uniform float exteriorWaterY;\n" + shader.fragmentShader;
  const direct = "getSpotLightInfo( spotLight, geometryPosition, directLight );";
  const chunk = ShaderChunk.lights_fragment_begin.replace(direct, `${direct}
    directLight.color *= step(exteriorWaterY, (transpose(mat3(viewMatrix)) * spotLight.position + cameraPosition).y);
  `);
  shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_begin>", chunk);
}
