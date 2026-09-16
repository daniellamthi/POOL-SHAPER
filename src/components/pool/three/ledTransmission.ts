import { ShaderChunk, type WebGLProgramParametersWithUniforms } from "three";
import { LED_OPTICS } from "@/lib/pool/led-optics";
export const LED_TRANSPORT_CACHE_KEY = `led-transport-v2-${LED_OPTICS.nearField}-${LED_OPTICS.absorption.join("-")}`;

/** Only the LED incident-light path is changed. Albedo/BRDF, sun, environment,
 * existing caustics and receiver-to-camera water optics remain untouched. */
export function applyLedTransmission(shader: WebGLProgramParametersWithUniforms) {
  const original = "light.color *= getDistanceAttenuation( lightDistance, spotLight.distance, spotLight.decay );";
  const ledTransport = `
    // View-space light origin -> world-space. All LED origins are submerged;
    // the studio auxiliary spot is above water and takes the unchanged branch.
    vec3 ledSourceWorld = cameraPosition + (vec4(spotLight.position, 0.0) * viewMatrix).xyz;
    if (ledSourceWorld.y < waterLevel - 0.2) {
      float ledDistance = sqrt(lightDistance * lightDistance + ${LED_OPTICS.nearField ** 2});
      light.color *= getDistanceAttenuation(ledDistance, spotLight.distance, spotLight.decay);
      light.color *= exp(-vec3(${LED_OPTICS.absorption.join(",")}) * lightDistance);
      // A submerged luminaire cannot directly illuminate the dry wall band.
      light.color *= 1.0 - smoothstep(waterLevel - 0.015, waterLevel, vCausticWorldPosition.y);
    } else {
      ${original}
    }
  `;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_pars_begin>", ShaderChunk.lights_pars_begin.replace(original, ledTransport),
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
