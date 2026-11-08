import * as THREE from "three";

/** Aerated moving water at the Infinity wall and its receiving channel.
 * Uses physical diffuse/transmission under the scene lights; no emission,
 * extra sampler, mesh, or render pass. UVs are metres along/across the flow. */
export function configureInfinityFlowAppearance(
  shader: THREE.WebGLProgramParametersWithUniforms,
  receiver: boolean,
) {
  shader.uniforms["infinityFlowTime"] = { value: 0 };
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <common>",
    `#include <common>
uniform float infinityFlowTime;
float infinityFlowHash(vec2 p) {
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
}
float infinityFlowNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  return mix(mix(infinityFlowHash(i), infinityFlowHash(i + vec2(1.0, 0.0)), f.x),
    mix(infinityFlowHash(i + vec2(0.0, 1.0)), infinityFlowHash(i + vec2(1.0)), f.x), f.y);
}`,
  );
  const coverage = receiver
    ? `
// Localized aeration at impact; it fades before the outer channel rim.
float impact = 1.0 - smoothstep(0.025, 0.17, vNormalMapUv.y);
float agitation = infinityFlowNoise(vec2(vNormalMapUv.x * 24.0, vNormalMapUv.y * 38.0 - infinityFlowTime * 1.7));
float infinityAeration = impact * (0.35 + 0.5 * agitation);
`
    : `
// Unequal scales produce broken rivulets travelling DOWN the wall.
float travel = vNormalMapUv.y - infinityFlowTime * 0.75;
float streaks = infinityFlowNoise(vec2(vNormalMapUv.x * 16.0, travel * 3.3));
float droplets = infinityFlowNoise(vec2(vNormalMapUv.x * 43.0, travel * 9.1));
float infinityAeration = 0.12 + 0.5 * smoothstep(0.35, 0.82, streaks * 0.7 + droplets * 0.3);
`;
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <lights_physical_fragment>",
    `${coverage}
diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.88, 0.96, 1.0), infinityAeration);
roughnessFactor = mix(roughnessFactor, 0.3, infinityAeration);
#include <lights_physical_fragment>`,
  );
  shader.fragmentShader = shader.fragmentShader.replace(
    "#include <transmission_fragment>",
    THREE.ShaderChunk.transmission_fragment.replace(
      "material.transmission = transmission;",
      "material.transmission = transmission * (1.0 - infinityAeration);",
    ),
  );
}
