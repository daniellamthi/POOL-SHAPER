import { ShaderChunk, type WebGLProgramParametersWithUniforms } from "three";
import { skipInactiveSpotLighting } from "./spotLightWork";

/** Receiver-side light linking for dry exterior architecture. Submerged
 * luminaires cannot shine directly through an opaque pool shell. This keeps
 * sunlight/above-ground fixtures and IBL, without extra shadow render passes. */
export function excludeSubmergedDirectLights(shader: WebGLProgramParametersWithUniforms, waterY: number) {
  shader.uniforms["exteriorWaterY"] = { value: waterY };
  shader.fragmentShader = "uniform float exteriorWaterY;\n" + shader.fragmentShader;
  // Reject the entire submerged-light path before attenuation, projector,
  // shadow lookup and BRDF evaluation. Multiplying its final colour by zero
  // produced the same image but still shaded every dry terrace/grass pixel
  // with every stair and bench spot, especially expensive in night mode.
  const start = ShaderChunk.lights_fragment_begin.indexOf("#if ( NUM_SPOT_LIGHTS > 0 )");
  const end = ShaderChunk.lights_fragment_begin.indexOf("#if ( NUM_DIR_LIGHTS > 0 )", start);
  const spotChunk = ShaderChunk.lights_fragment_begin.slice(start, end)
    .replace("getSpotLightInfo( spotLight, geometryPosition, directLight );", `
      if ((transpose(mat3(viewMatrix)) * spotLight.position + cameraPosition).y >= exteriorWaterY) {
        getSpotLightInfo( spotLight, geometryPosition, directLight );`)
    .replace("RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );", `
        RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );
      }`);
  // Area emitters are exclusively the recessed perimeter strips. The pool
  // shell shields the dry terrace; do not light it through the opaque wall.
  const areaCall = "RE_Direct_RectArea( rectAreaLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );";
  const chunk = (ShaderChunk.lights_fragment_begin.slice(0, start) + spotChunk + ShaderChunk.lights_fragment_begin.slice(end))
    .replace(areaCall, "/* Recessed perimeter emitter: dry receiver is shielded by the pool shell. */");
  shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_begin>", skipInactiveSpotLighting(chunk));
}
