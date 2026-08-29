import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WATER_VISUAL_PRESET } from "@/configurator/materials/visual-presets";
import { ACTIVE_RENDERING_QUALITY } from "@/configurator/3d/scene/visual-preset";
import { photoModeState } from "@/lib/pool/photoModeState";
import { createRippleNormalMap } from "./textures";

interface WaterShader extends THREE.WebGLProgramParametersWithUniforms {
  uniforms: THREE.WebGLProgramParametersWithUniforms["uniforms"] & {
    waterLargeOffset?: { value: THREE.Vector2 };
    waterMicroOffset?: { value: THREE.Vector2 };
    waterLargeScale?: { value: number };
    waterMicroScale?: { value: number };
    waterLargeStrength?: { value: number };
    waterMicroStrength?: { value: number };
    waterLargeRotation?: { value: number };
    waterMicroRotation?: { value: number };
    waterMicroNormalMap?: { value: THREE.Texture };
    waterDebugMode?: { value: number };
    waterReflectionTexture?: { value: THREE.Texture | null };
    waterTextureMatrix?: { value: THREE.Matrix4 };
    waterAboveWaterline?: { value: number };
  };
}

const DUAL_NORMAL_FRAGMENT = `
float largeCos = cos(waterLargeRotation);
float largeSin = sin(waterLargeRotation);
float microCos = cos(waterMicroRotation);
float microSin = sin(waterMicroRotation);
mat2 largeRotation = mat2(largeCos, -largeSin, largeSin, largeCos);
mat2 microRotation = mat2(microCos, -microSin, microSin, microCos);
vec2 centeredNormalUv = vNormalMapUv - 0.5;
vec3 largeRipple = texture2D(
  normalMap,
  largeRotation * centeredNormalUv * waterLargeScale + 0.5 + waterLargeOffset
).xyz * 2.0 - 1.0;
vec3 microRipple = texture2D(
  waterMicroNormalMap,
  microRotation * centeredNormalUv * waterMicroScale + 0.5 + waterMicroOffset
).xyz * 2.0 - 1.0;
vec2 combinedSlope =
  largeRipple.xy * waterLargeStrength +
  microRipple.xy * waterMicroStrength;
vec3 waterNormal = normalize(vec3(combinedSlope, 1.0));
normal = normalize(tbn * waterNormal);
`;

/**
 * Real, camera-relative mirror reflection of the actual surrounding scene
 * (sky, coping, deck), weighted by the same IOR-derived Fresnel term that
 * already drives the physical specular response. Replaces relying solely on
 * a static procedural cubemap for the reflective term -- the cubemap has no
 * parallax and cannot show the specific geometry standing at the water's
 * edge, which is the single biggest visual "CG tell" in still water shots.
 */
const REFLECTION_FRAGMENT = `
if (waterDebugMode == 1) {
  outgoingLight = normal * 0.5 + 0.5;
} else if (waterDebugMode == 2) {
  float debugFresnel = 0.02033 + 0.97967 * pow(
    1.0 - saturate(dot(normal, normalize(vViewPosition))),
    5.0
  );
  outgoingLight = vec3(debugFresnel);
} else if (waterDebugMode == 3) {
  outgoingLight = texture2DProj(waterReflectionTexture, vWaterMirrorCoord).rgb;
} else {
  float mirrorFresnel = 0.02033 + 0.97967 * pow(
    1.0 - saturate(dot(normal, normalize(vViewPosition))),
    5.0
  );
  // Below the fallback margin the mirror camera has crossed to the wrong
  // side of the water plane and the capture is no longer a valid reflection
  // (it starts showing the basin instead of sky/coping) -- fade back to the
  // material's own IBL response, which is already sitting in outgoingLight,
  // instead of a visibly wrong image.
  mirrorFresnel *= waterAboveWaterline;
  vec3 mirrorColor = texture2DProj(waterReflectionTexture, vWaterMirrorCoord).rgb;
  outgoingLight = mix(outgoingLight, mirrorColor, mirrorFresnel);
}
#include <opaque_fragment>
`;

const DEBUG_FRAGMENT = `
if (waterDebugMode == 1) {
  outgoingLight = normal * 0.5 + 0.5;
} else if (waterDebugMode == 2) {
  float debugFresnel = 0.02033 + 0.97967 * pow(
    1.0 - saturate(dot(normal, normalize(vViewPosition))),
    5.0
  );
  outgoingLight = vec3(debugFresnel);
}
#include <opaque_fragment>
`;

const debugModeName = import.meta.env.DEV ? import.meta.env["VITE_WATER_DEBUG"] : undefined;
const WATER_DEBUG_MODE =
  debugModeName === "normals"
    ? 1
    : debugModeName === "fresnel"
      ? 2
      : debugModeName === "mirror"
        ? 3
        : 0;
const REFLECTION_ENABLED = ACTIVE_RENDERING_QUALITY.planarReflection.enabled;
const REFLECTION_RESOLUTION = ACTIVE_RENDERING_QUALITY.planarReflection.resolution;
// Structural safety margin, not a look/tuning knob: below this height above
// the water plane the mirror camera has crossed to the wrong side of it
// (see the fade below), roughly matching the coping's own thickness.
const REFLECTION_FALLBACK_MARGIN = 0.22;

const scratchForward = new THREE.Vector3();
const scratchTargetPoint = new THREE.Vector3();
const scratchMirroredTarget = new THREE.Vector3();

/**
 * Renders the scene from a camera mirrored across the horizontal water
 * plane into a small render target, and derives the projective texture
 * matrix a fragment needs to sample it correctly per-pixel (the same
 * technique three.js's own Reflector/Water examples use, adapted for a
 * plane that is always horizontal here). Experience-tier only -- doubles
 * scene draw calls for the parts visible above the waterline, so
 * Configuration keeps today's exact cost and output.
 */
function useWaterReflection(waterLevel: number) {
  const { gl, scene, camera } = useThree();

  const target = useMemo(() => {
    if (!REFLECTION_ENABLED) return null;
    const renderTarget = new THREE.WebGLRenderTarget(REFLECTION_RESOLUTION, REFLECTION_RESOLUTION, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
    });
    return renderTarget;
  }, []);
  useEffect(() => () => target?.dispose(), [target]);

  const mirrorCamera = useMemo(
    () => (REFLECTION_ENABLED ? new THREE.PerspectiveCamera() : null),
    [],
  );
  const textureMatrix = useRef(new THREE.Matrix4());
  const aboveWaterline = useRef({ value: 1 }).current;
  const frame = useRef(0);

  useFrame(() => {
    if (!target || !mirrorCamera || !(camera instanceof THREE.PerspectiveCamera)) return;
    // Photo Mode ignores this material's onBeforeCompile entirely (the path
    // tracer reads plain material properties, never the patched WebGL
    // program), so the mirror-camera render this hook drives would just be
    // extra GPU work feeding a uniform nothing reads.
    if (photoModeState.active) return;

    // Tracks camera height every frame regardless of the render throttle
    // below, so the fallback fade stays smooth even on skipped frames.
    aboveWaterline.value = THREE.MathUtils.smoothstep(
      camera.position.y,
      waterLevel,
      waterLevel + REFLECTION_FALLBACK_MARGIN,
    );

    // Every other frame: calm water reflections change slowly enough that
    // one frame of staleness is invisible, and it halves the extra cost.
    frame.current += 1;
    if (frame.current % 2 !== 0) return;

    mirrorCamera.position.set(
      camera.position.x,
      2 * waterLevel - camera.position.y,
      camera.position.z,
    );
    mirrorCamera.up.set(camera.up.x, -camera.up.y, camera.up.z);
    camera.getWorldDirection(scratchForward);
    scratchTargetPoint.copy(camera.position).add(scratchForward);
    scratchMirroredTarget.set(
      scratchTargetPoint.x,
      2 * waterLevel - scratchTargetPoint.y,
      scratchTargetPoint.z,
    );
    mirrorCamera.lookAt(scratchMirroredTarget);
    mirrorCamera.fov = camera.fov;
    mirrorCamera.aspect = camera.aspect;
    mirrorCamera.near = camera.near;
    mirrorCamera.far = camera.far;
    mirrorCamera.updateProjectionMatrix();
    mirrorCamera.updateMatrixWorld(true);

    textureMatrix.current
      .set(0.5, 0.0, 0.0, 0.5, 0.0, 0.5, 0.0, 0.5, 0.0, 0.0, 0.5, 0.5, 0.0, 0.0, 0.0, 1.0)
      .multiply(mirrorCamera.projectionMatrix)
      .multiply(mirrorCamera.matrixWorldInverse);

    const basin = scene.getObjectByName("pool-basin");
    const wasVisible = basin?.visible ?? true;
    if (basin) basin.visible = false;
    const previousTarget = gl.getRenderTarget();
    gl.setRenderTarget(target);
    gl.clear();
    gl.render(scene, mirrorCamera);
    gl.setRenderTarget(previousTarget);
    if (basin) basin.visible = wasVisible;
  });

  return { texture: target?.texture ?? null, textureMatrix, aboveWaterline };
}

/** Shared physical water surface used by the pool and skimmer tongue. */
export function WaterSurfaceMaterial({ waterLevel = 0 }: { waterLevel?: number }) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const largeNormal = useMemo(() => createRippleNormalMap("broad"), []);
  const microNormal = useMemo(() => createRippleNormalMap("micro"), []);
  const shaders = useRef<WaterShader[]>([]);
  const reflection = useWaterReflection(waterLevel);

  useEffect(() => {
    for (const texture of [largeNormal, microNormal]) {
      texture.anisotropy = Math.min(8, maxAnisotropy);
      texture.needsUpdate = true;
    }
    return () => {
      largeNormal.dispose();
      microNormal.dispose();
    };
  }, [largeNormal, microNormal, maxAnisotropy]);

  const configureWaterSurface = useCallback(
    (shader: WaterShader) => {
      shader.uniforms.waterLargeOffset = { value: new THREE.Vector2() };
      shader.uniforms.waterMicroOffset = { value: new THREE.Vector2() };
      shader.uniforms.waterLargeScale = { value: WATER_VISUAL_PRESET.normals.large.scale };
      shader.uniforms.waterMicroScale = { value: WATER_VISUAL_PRESET.normals.micro.scale };
      shader.uniforms.waterLargeStrength = { value: WATER_VISUAL_PRESET.normals.large.strength };
      shader.uniforms.waterMicroStrength = { value: WATER_VISUAL_PRESET.normals.micro.strength };
      shader.uniforms.waterLargeRotation = { value: WATER_VISUAL_PRESET.normals.large.rotation };
      shader.uniforms.waterMicroRotation = { value: WATER_VISUAL_PRESET.normals.micro.rotation };
      shader.uniforms.waterMicroNormalMap = { value: microNormal };
      shader.uniforms.waterDebugMode = { value: WATER_DEBUG_MODE };
      let fragmentHeader = `#include <common>
uniform vec2 waterLargeOffset;
uniform vec2 waterMicroOffset;
uniform float waterLargeScale;
uniform float waterMicroScale;
uniform float waterLargeStrength;
uniform float waterMicroStrength;
uniform float waterLargeRotation;
uniform float waterMicroRotation;
uniform int waterDebugMode;
uniform sampler2D waterMicroNormalMap;`;
      let vertexHeader = "#include <common>";
      let vertexBody = "#include <worldpos_vertex>";
      let finalFragment = DEBUG_FRAGMENT;

      if (REFLECTION_ENABLED && reflection.texture) {
        shader.uniforms.waterReflectionTexture = { value: reflection.texture };
        shader.uniforms.waterTextureMatrix = { value: reflection.textureMatrix.current };
        shader.uniforms.waterAboveWaterline = reflection.aboveWaterline;
        fragmentHeader += `
uniform sampler2D waterReflectionTexture;
uniform float waterAboveWaterline;
varying vec4 vWaterMirrorCoord;`;
        vertexHeader = `#include <common>
uniform mat4 waterTextureMatrix;
varying vec4 vWaterMirrorCoord;`;
        vertexBody = `#include <worldpos_vertex>
vWaterMirrorCoord = waterTextureMatrix * modelMatrix * vec4(transformed, 1.0);`;
        finalFragment = REFLECTION_FRAGMENT;
      }

      shader.vertexShader = shader.vertexShader
        .replace("#include <common>", vertexHeader)
        .replace("#include <worldpos_vertex>", vertexBody);
      shader.fragmentShader = shader.fragmentShader
        .replace("#include <common>", fragmentHeader)
        .replace("#include <normal_fragment_maps>", DUAL_NORMAL_FRAGMENT)
        .replace("#include <opaque_fragment>", finalFragment);
      if (!shaders.current.includes(shader)) shaders.current.push(shader);
    },
    [microNormal, reflection.texture, reflection.textureMatrix, reflection.aboveWaterline],
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    for (const shader of shaders.current) {
      shader.uniforms.waterLargeOffset?.value.set(time * 0.004, time * 0.0022);
      shader.uniforms.waterMicroOffset?.value.set(-time * 0.011, time * 0.008);
    }
  });

  return (
    <meshPhysicalMaterial
      color={WATER_VISUAL_PRESET.surfaceColor}
      transparent
      opacity={WATER_VISUAL_PRESET.opacity}
      roughness={debugModeName === "specular" ? 0.035 : WATER_VISUAL_PRESET.roughness}
      metalness={WATER_VISUAL_PRESET.metalness}
      transmission={WATER_VISUAL_PRESET.transmission}
      thickness={WATER_VISUAL_PRESET.thickness}
      ior={WATER_VISUAL_PRESET.ior}
      clearcoat={WATER_VISUAL_PRESET.clearcoat}
      clearcoatRoughness={WATER_VISUAL_PRESET.clearcoatRoughness}
      attenuationColor={WATER_VISUAL_PRESET.attenuationColor}
      attenuationDistance={WATER_VISUAL_PRESET.attenuationDistance}
      envMapIntensity={
        debugModeName === "specular" ? 0 : WATER_VISUAL_PRESET.environmentIntensity.day
      }
      specularIntensity={WATER_VISUAL_PRESET.specularIntensity}
      specularColor={WATER_VISUAL_PRESET.specularColor}
      normalMap={largeNormal}
      normalScale={[1, 1]}
      depthWrite={false}
      depthTest
      forceSinglePass
      side={THREE.DoubleSide}
      onBeforeCompile={configureWaterSurface}
      customProgramCacheKey={() =>
        `p1c-dual-normal-physical-water-v3-${WATER_DEBUG_MODE}-${REFLECTION_ENABLED ? 1 : 0}`
      }
    />
  );
}
