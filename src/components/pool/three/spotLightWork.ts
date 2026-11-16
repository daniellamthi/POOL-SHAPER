import { ShaderChunk } from "three";

/** A light outside its range or behind both surface normals contributes zero.
 * Reject it before attenuation/absorption, then skip its projector/shadow/BRDF.
 * Restrict the guard to spots; sun, environment and other lights are intact. */
export function skipInactiveSpotLighting(chunk = ShaderChunk.lights_fragment_begin): string {
  const start = chunk.indexOf("#if ( NUM_SPOT_LIGHTS > 0 )");
  const end = chunk.indexOf("#if ( NUM_DIR_LIGHTS > 0 )", start);
  const spot = chunk.slice(start, end)
    .replace("SpotLight spotLight;", "SpotLight spotLight;\nvec3 poolToSpot;\nfloat poolSpotDistanceSquared;")
    .replace("spotLight = spotLights[ i ];", `$&
poolToSpot = spotLight.position - geometryPosition;
poolSpotDistanceSquared = dot(poolToSpot, poolToSpot);
if (any(greaterThan(spotLight.color, vec3(0.0)))
  && (spotLight.distance <= 0.0 || poolSpotDistanceSquared < spotLight.distance * spotLight.distance)
  && (dot(geometryNormal, poolToSpot) > 0.0 || dot(geometryClearcoatNormal, poolToSpot) > 0.0)) {`)
    .replace(/getSpotLightInfo\([^;]+;/, "$&\nif (directLight.visible) {")
    .replace("RE_Direct( directLight, geometryPosition, geometryNormal, geometryViewDir, geometryClearcoatNormal, material, reflectedLight );", "$&\n}\n}");
  return chunk.slice(0, start) + spot + chunk.slice(end);
}
