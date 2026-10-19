import { ShaderChunk, Vector3, type WebGLProgramParametersWithUniforms } from "three";
import { LED_OPTICS } from "@/lib/pool/led-optics";
import { MICRO_SPOT_OPTICS } from "@/lib/pool/micro-spot-optics";
export const MAX_MICRO_SPOT_SOURCES = 64;
export const LED_TRANSPORT_CACHE_KEY = `led-transport-v4-micro-${MICRO_SPOT_OPTICS.nearField}-${MAX_MICRO_SPOT_SOURCES}-${LED_OPTICS.nearField}-${LED_OPTICS.absorption.join("-")}-${LED_OPTICS.irradianceKnee}`;

export interface MicroSpotTransportUniforms {
  origins: { value: Vector3[] };
  count: { value: number };
}
type MicroSource = { x: number; y: number; z: number; dir: readonly [number, number] };

/** One bounded array per pool/material family, not a global light registry. */
export function createMicroSpotTransport(): MicroSpotTransportUniforms {
  return { origins: { value: Array.from({ length: MAX_MICRO_SPOT_SOURCES }, () => new Vector3()) }, count: { value: 0 } };
}

/** Update stable vectors on configuration changes; no frame-loop allocations.
 * A guard fails loudly instead of silently leaving valid fittings unlinked. */
export function updateMicroSpotTransport(uniforms: MicroSpotTransportUniforms, sources: ReadonlyArray<MicroSource>) {
  if (sources.length > MAX_MICRO_SPOT_SOURCES) throw new RangeError("Micro-spot transport source budget exceeded");
  uniforms.count.value = sources.length;
  const offset = MICRO_SPOT_OPTICS.lensCenter + MICRO_SPOT_OPTICS.emitterEpsilon;
  sources.forEach((spot, i) => uniforms.origins.value[i]!.set(spot.x + spot.dir[0] * offset, spot.y, spot.z + spot.dir[1] * offset));
}

/** Only the LED incident-light path is changed. Albedo/BRDF, sun, environment,
 * existing caustics and receiver-to-camera water optics remain untouched. */
export function applyLedTransmission(shader: WebGLProgramParametersWithUniforms, microSpots?: MicroSpotTransportUniforms) {
  if (microSpots) {
    shader.uniforms["poolMicroSpotOrigins"] = microSpots.origins;
    shader.uniforms["poolMicroSpotCount"] = microSpots.count;
  }
  const original = "light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );";
  const ledTransport = `
    // View-space light origin -> world-space. All LED origins are submerged;
    // the studio auxiliary spot is above water and takes the unchanged branch.
    vec3 ledSourceWorld = cameraPosition + (vec4(spotLight.position, 0.0) * viewMatrix).xyz;
    if (ledSourceWorld.y < waterLevel - 0.2) {
      float ledDistance = sqrt(lightDistance * lightDistance + ${LED_OPTICS.nearField ** 2});
      ${microSpots ? `
      // Explicit emitter identity: never infer a micro from range, colour or
      // decay, because a legitimate main flood may also have a short throw.
      // The uniform loop stops at the actual count (normally2–12), not64.
      for (int microIndex = 0; microIndex < ${MAX_MICRO_SPOT_SOURCES}; microIndex++) {
        if (microIndex >= poolMicroSpotCount) break;
        vec3 sourceDelta = ledSourceWorld - poolMicroSpotOrigins[microIndex];
        if (dot(sourceDelta, sourceDelta) < 0.000001) {
          ledDistance = sqrt(lightDistance * lightDistance + ${MICRO_SPOT_OPTICS.nearField ** 2});
          break;
        }
      }` : ""}
      light.color *= getDistanceAttenuation(ledDistance, spotLight.distance, spotLight.decay);
      light.color *= exp(-vec3(${LED_OPTICS.absorption.join(",")}) * lightDistance);
      // Luminance soft knee: keeps the lamp's hue on the lit liner instead of
      // letting the near field clip to white (see LED_OPTICS.irradianceKnee).
      light.color /= 1.0 + dot(light.color, vec3(0.2126, 0.7152, 0.0722)) * ${LED_OPTICS.irradianceKnee.toFixed(3)};
      // A submerged luminaire cannot directly illuminate the dry wall band.
      light.color *= 1.0 - smoothstep(waterLevel - 0.015, waterLevel, vCausticWorldPosition.y);
    } else {
      ${original}
    }
  `;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_pars_begin>", `${microSpots ? `uniform vec3 poolMicroSpotOrigins[${MAX_MICRO_SPOT_SOURCES}];\nuniform int poolMicroSpotCount;\n` : ""}${ShaderChunk.lights_pars_begin.replace(original, ledTransport)}`,
  );
  // Cached 512px LED maps already provide a soft footprint in the wide beam.
  // One hardware-filtered lookup (4 taps) preserves stair occlusion without
  // the studio sun's five-sample Vogel filter on every submerged light.
  shader.fragmentShader = shader.fragmentShader.replace("#include <shadowmap_pars_fragment>", `
    #include <shadowmap_pars_fragment>
    #if defined(USE_SHADOWMAP) && defined(SHADOWMAP_TYPE_PCF) && NUM_SPOT_LIGHT_SHADOWS > 0
    float poolLedShadow(vec3 source, sampler2DShadow map, vec2 mapSize, float intensity, float bias, float radius, vec4 coord) {
      vec3 sourceWorld = cameraPosition + (vec4(source, 0.0) * viewMatrix).xyz;
      if (sourceWorld.y >= waterLevel - 0.2) return getShadow(map, mapSize, intensity, bias, radius, coord);
      coord.xyz /= coord.w;
      coord.z += bias;
      bool insideMap = coord.x >= 0.0 && coord.x <= 1.0 && coord.y >= 0.0 && coord.y <= 1.0 && coord.z <= 1.0;
      return insideMap ? mix(1.0, texture(map, coord.xyz), intensity) : 1.0;
    }
    #endif
  `);
  const shadowCall = "getShadow( spotShadowMap[ i ], spotLightShadow.shadowMapSize, spotLightShadow.shadowIntensity, spotLightShadow.shadowBias, spotLightShadow.shadowRadius, vSpotLightCoord[ i ] )";
  const shadowLine = `directLight.color *= ( directLight.visible && receiveShadow ) ? ${shadowCall} : 1.0;`;
  const fastLine = shadowLine.replace(shadowCall, shadowCall.replace("getShadow(", "poolLedShadow( spotLight.position,"));
  shader.fragmentShader = shader.fragmentShader.replace("#include <lights_fragment_begin>", ShaderChunk.lights_fragment_begin.replace(shadowLine, `
    #if defined(SHADOWMAP_TYPE_PCF)
      ${fastLine}
    #else
      ${shadowLine}
    #endif
  `));
}
