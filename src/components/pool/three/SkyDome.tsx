import { useMemo } from "react";
import * as THREE from "three";
import type { Theme } from "@/lib/theme";

const SKY_PALETTE = {
  dark: { zenith: "#141a21", horizon: "#242a2f" },
  light: { zenith: "#bfd8ea", horizon: "#eef4f2" },
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
varying vec3 vDirection;
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

  gl_FragColor = vec4(outgoing, 1.0);
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
}

/**
 * A real piece of scene geometry (not a Lightformer-only offscreen capture)
 * so the planar water reflector actually has a photographic sky -- gradient
 * plus a soft sun glow matched to the scene's own key light -- to mirror,
 * instead of a flat fill colour. Fully procedural and local: no HDRI asset,
 * no remote request.
 */
export function SkyDome({
  theme,
  sunDirection,
  sunColor,
  sunVisibility,
  radius = 260,
}: SkyDomeProps) {
  const palette = SKY_PALETTE[theme];
  const uniforms = useMemo(
    () => ({
      zenithColor: { value: new THREE.Color(palette.zenith) },
      horizonColor: { value: new THREE.Color(palette.horizon) },
      sunDirection: { value: new THREE.Vector3(...sunDirection).normalize() },
      sunColor: { value: new THREE.Color(sunColor) },
      sunVisibility: { value: sunVisibility },
    }),
    // Rebuilt only when the palette identity (theme) changes; per-frame
    // colour/direction values are pushed via the effect below instead of
    // forcing a full material rebuild on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  );

  uniforms.sunDirection.value.set(...sunDirection).normalize();
  uniforms.sunColor.value.set(sunColor);
  uniforms.sunVisibility.value = sunVisibility;

  return (
    <mesh renderOrder={-1000} frustumCulled={false}>
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
