import { ShaderChunk, type WebGLProgramParametersWithUniforms } from "three";

/** Material-local fast path for the zero-contribution back of area emitters.
 * Preserve the stock texture samples before branching, including their implicit
 * derivatives and min/mag filtering. Only skip the subsequent zero BRDF work. */
export function skipBackFacingPlantAreaLights(shader: WebGLProgramParametersWithUniforms): boolean {
  const include = "#include <lights_physical_pars_fragment>";
  const once = (text: string, value: string) => text.includes(value) && text.indexOf(value) === text.lastIndexOf(value);
  if (!once(shader.fragmentShader, include)) return false;
  const chunk = ShaderChunk.lights_physical_pars_fragment;
  const signature = "void RE_Direct_RectArea_Physical(";
  if (typeof chunk !== "string" || !once(chunk, signature)) return false;
  const match = chunk.match(/void RE_Direct_RectArea_Physical\([\s\S]*?\n\t}\n/);
  if (!match) return false;
  const original = match[0];
  const clearcoatLines = [
    "vec3 Ncc = geometryClearcoatNormal;",
    "vec2 uvClearcoat = LTC_Uv( Ncc, viewDir, material.clearcoatRoughness );",
    "vec4 t1Clearcoat = texture2D( ltc_1, uvClearcoat );",
    "vec4 t2Clearcoat = texture2D( ltc_2, uvClearcoat );",
  ];
  const anchor = "mat3 mInv = mat3(";
  const baseSamples = ["vec4 t1 = texture2D( ltc_1, uv );", "vec4 t2 = texture2D( ltc_2, uv );"];
  if (!once(original, anchor) || clearcoatLines.some(line => !once(original, line)) ||
      baseSamples.some(line => !once(original, line) || original.indexOf(line) > original.indexOf(anchor))) return false;
  const body = clearcoatLines.reduce((text, line) => text.replace(line, ""), original).replace(anchor, `
    #ifdef USE_CLEARCOAT
      ${clearcoatLines.join("\n")}
    #endif
    // Same plane and strict boundary test as stock LTC_Evaluate.
    vec3 plantAreaV1 = rectCoords[1] - rectCoords[0];
    vec3 plantAreaV2 = rectCoords[3] - rectCoords[0];
    if (dot(cross(plantAreaV1, plantAreaV2), position - rectCoords[0]) < 0.0) return;
    ${anchor}`);
  shader.fragmentShader = shader.fragmentShader.replace(include, chunk.replace(original, body));
  return true;
}
