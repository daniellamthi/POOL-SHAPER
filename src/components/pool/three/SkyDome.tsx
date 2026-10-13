import { useMemo } from "react";
import * as THREE from "three";
import type { Theme } from "@/lib/theme";

const SKY_PALETTE = {
  dark: { zenith: "#141a21", horizon: "#242a2f" },
  light: { zenith: "#8dbbd9", horizon: "#aecfe3" },
} as const;

const VERTEX_SHADER = `
varying vec3 vDirection;
void main() {
  vDirection = normalize(position);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAGMENT_SHADER = `
uniform vec3 zenithColor;
uniform vec3 horizonColor;
uniform vec3 sunDirection;
uniform vec3 sunColor;
uniform float sunVisibility;
uniform sampler2D environmentMap;
uniform bool hasEnvironmentMap;
uniform float outdoor;
varying vec3 vDirection;
float skyNoise(vec2 p) {
  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  vec4 h = fract(sin(vec4(dot(i,vec2(127.1,311.7)),dot(i+vec2(1,0),vec2(127.1,311.7)),dot(i+vec2(0,1),vec2(127.1,311.7)),dot(i+vec2(1),vec2(127.1,311.7)))) * 43758.5453);
  return mix(mix(h.x,h.y,f.x),mix(h.z,h.w,f.x),f.y);
}
void main() {
  vec3 direction = normalize(vDirection);
  float elevation = clamp(direction.y, -1.0, 1.0);
  // Soft, photographic sky gradient: brighter near the horizon, deepening
  // toward the zenith -- not a stylised game skybox.
  float gradientT = pow(max(elevation, 0.0), 0.55);
  vec3 sky = mix(horizonColor, zenithColor, gradientT);
  sky = mix(sky, horizonColor, 0.22 * exp(-max(elevation, 0.0) * 3.0));

  float alignment = max(dot(direction, normalize(sunDirection)), 0.0);
  float sunDisc = pow(alignment, 900.0) * 1.4;
  float sunGlow = pow(alignment, 8.0) * 0.16;
  vec3 outgoing = sky + sunColor * (sunDisc + sunGlow) * sunVisibility;
  vec2 cloudPlane = direction.xz / max(0.18, direction.y + 0.22);
  float cloud = skyNoise(cloudPlane * 1.9) * 0.7 + skyNoise(cloudPlane * 4.7) * 0.3;
  float veil = smoothstep(0.55, 0.78, cloud) * smoothstep(0.02, 0.22, elevation) * outdoor;
  outgoing = mix(outgoing, horizonColor * 1.35, veil * 0.32);
  if (hasEnvironmentMap) {
    vec2 uv = vec2(atan(direction.z, direction.x) * 0.159154943 + 0.5, asin(clamp(direction.y, -1.0, 1.0)) * 0.318309886 + 0.5);
    outgoing = texture2D(environmentMap, uv).rgb;
  }

  gl_FragColor = vec4(outgoing, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

export interface SkyDomeProps {
  theme: Theme;
  /** World-space direction the key light travels from (same vector used to place the sun disc/glow). */
  sunDirection: readonly [number, number, number];
  sunColor: string;
  /** 0..1 -- fades the visible sun disc out for the dim night preset without touching the gradient. */
  sunVisibility: number;
  radius?: number;
  environmentMap?: THREE.Texture | null;
  reflectionOnly?: boolean;
  outdoor?: boolean;
}

/**
 * A real piece of scene geometry (not a Lightformer-only offscreen capture)
 * so the planar water reflector actually has a photographic sky -- gradient
 * plus a soft sun glow matched to the scene's own key light -- to mirror,
 * instead of a flat fill colour. A local photographic environment can be
 * restricted to the mirror camera, leaving the visible studio uncluttered.
 */
export function SkyDome({
  theme,
  sunDirection,
  sunColor,
  sunVisibility,
  radius = 260,
  environmentMap = null,
  reflectionOnly = false,
  outdoor = false,
}: SkyDomeProps) {
  const palette = outdoor && theme === "light"
    ? { zenith: "#70a9d0", horizon: "#cee0ec" }
    : SKY_PALETTE[theme];
  const uniforms = useMemo(
    () => ({
      zenithColor: { value: new THREE.Color(palette.zenith) },
      horizonColor: { value: new THREE.Color(palette.horizon) },
      sunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
      sunColor: { value: new THREE.Color(sunColor) },
      sunVisibility: { value: sunVisibility },
      environmentMap: { value: environmentMap },
      hasEnvironmentMap: { value: !!environmentMap },
      outdoor: { value: outdoor && theme === "light" ? 1 : 0 },
    }),
    // Rebuilt only when the palette identity (theme) changes; per-frame
    // colour/direction values are pushed via the effect below instead of
    // forcing a full material rebuild on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme, outdoor],
  );

  uniforms.sunDirection.value.set(...sunDirection).normalize();
  uniforms.sunColor.value.set(sunColor);
  uniforms.sunVisibility.value = sunVisibility;
  uniforms.environmentMap.value = environmentMap;
  uniforms.hasEnvironmentMap.value = !!environmentMap;
  uniforms.outdoor.value = outdoor && theme === "light" ? 1 : 0;

  return (
    <mesh
      renderOrder={reflectionOnly ? -999 : -1000}
      layers-mask={reflectionOnly ? 2 : 1}
      frustumCulled={false}
    >
      <sphereGeometry args={[radius, 32, 16]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={VERTEX_SHADER}
        fragmentShader={FRAGMENT_SHADER}
        side={THREE.BackSide}
        depthWrite={false}
        fog={false}
        toneMapped
      />
    </mesh>
  );
}
