import { useCallback, useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { WATER_VISUAL_PRESET } from "@/configurator/materials/visual-presets";
import { ACTIVE_RENDERING_QUALITY } from "@/configurator/3d/scene/visual-preset";
import { photoModeState } from "@/lib/pool/photoModeState";
import { renderQualityState } from "@/lib/pool/renderQualityState";
import { createRippleNormalMap } from "./textures";
import { createShorelineField } from "./waterDepth";
import type { Outline } from "@/lib/pool/types";

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
// Incommensurate capillary waves in physical surface coordinates. Analytic
// slopes avoid 8-bit normal-map banding and repeated highlight grids at grazing angles.
float waveTime = waterLargeOffset.x * 110.0;
vec2 p = centeredNormalUv;
vec2 calmSlope = vec2(1.7, 0.8) * 0.0026 * cos(dot(p, vec2(1.7, 0.8)) - waveTime * 0.73)
  + vec2(-0.7, 2.1) * 0.0018 * cos(dot(p, vec2(-0.7, 2.1)) + waveTime * 0.57)
  + vec2(3.6, -1.2) * 0.0008 * cos(dot(p, vec2(3.6, -1.2)) - waveTime * 1.13)
  + vec2(5.2, 3.7) * 0.0003 * cos(dot(p, vec2(5.2, 3.7)) + waveTime * 0.91);
vec2 combinedSlope = calmSlope + largeRipple.xy * waterLargeStrength + microRipple.xy * waterMicroStrength;
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
  vec2 mirrorUv = vWaterMirrorCoord.xy / vWaterMirrorCoord.w;
  // The reflected scene bends with the same wave normal as the refraction.
  mirrorUv += combinedSlope * 0.015;
  vec3 mirrorColor = texture2D(waterReflectionTexture, clamp(mirrorUv, 0.001, 0.999)).rgb;
  // Transmission already contains (1-F). Replace only the indirect specular
  // lobe, retaining transmitted radiance and the sun's direct highlight.
  outgoingLight += (mirrorColor * mirrorFresnel - reflectedLight.indirectSpecular) * waterAboveWaterline;
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
 * Identifies meshes using this file's own water material (via the marker
 * baked into its `customProgramCacheKey`, below) so the mirror pass can hide
 * them -- see the note in the render loop for why that's required, not just
 * an optimization.
 */
function isWaterSurfaceMesh(object: THREE.Object3D): object is THREE.Mesh {
  if (!(object instanceof THREE.Mesh) || Array.isArray(object.material)) return false;
  const key = (object.material as THREE.Material & { customProgramCacheKey?: () => string })
    .customProgramCacheKey;
  return (
    typeof key === "function" && key.call(object.material).includes("dual-normal-physical-water")
  );
}

/**
 * Renders the scene from a camera mirrored across the horizontal water
 * plane into a small render target, and derives the projective texture
 * matrix a fragment needs to sample it correctly per-pixel (the same
 * technique three.js's own Reflector/Water examples use, adapted for a
 * plane that is always horizontal here). Experience-tier only -- doubles
 * scene draw calls for the parts visible above the waterline, so
 * Configuration keeps today's exact cost and output.
 */
function useWaterReflection(waterLevel: number, enabled: boolean) {
  const { gl, scene, camera } = useThree();

  const target = useMemo(() => {
    if (!REFLECTION_ENABLED || !enabled) return null;
    const renderTarget = new THREE.WebGLRenderTarget(REFLECTION_RESOLUTION, REFLECTION_RESOLUTION, {
      minFilter: THREE.LinearFilter,
      magFilter: THREE.LinearFilter,
      generateMipmaps: false,
      type: THREE.HalfFloatType,
    });
    return renderTarget;
  }, [enabled]);
  useEffect(() => () => target?.dispose(), [target]);

  const mirrorCamera = useMemo(
    () => (REFLECTION_ENABLED && enabled ? new THREE.PerspectiveCamera() : null),
    [enabled],
  );
  const textureMatrix = useRef(new THREE.Matrix4());
  const aboveWaterline = useRef({ value: 1 }).current;
  const frame = useRef(0);
  const clipping = useMemo(
    () => ({ plane: new THREE.Plane(), vector: new THREE.Vector4(), q: new THREE.Vector4() }),
    [],
  );

  useFrame(() => {
    if (!target || !mirrorCamera || !(camera instanceof THREE.PerspectiveCamera)) return;
    mirrorCamera.name = "pool-water-reflection";
    mirrorCamera.layers.enable(1);
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

    // Every other frame while the camera is moving: calm water reflections
    // change slowly enough that one frame of staleness is invisible there,
    // and it halves the extra cost exactly when responsiveness matters most.
    // Once the camera has settled (see renderQualityState/CameraRig), render
    // every frame instead -- the mirror capture itself doesn't accumulate,
    // so this only removes up-to-one-frame staleness from the reflection,
    // for a steadier, less swimmy image with no extra GPU cost while moving.
    frame.current += 1;
    if (!renderQualityState.idle && frame.current > 1 && frame.current % 2 !== 0) return;
    if (aboveWaterline.value === 0) return;

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

    // Oblique near plane clips submerged geometry out of the reflected image.
    // This is the horizontal-water specialization of Three's Reflector camera.
    clipping.plane.normal.set(0, 1, 0);
    clipping.plane.constant = -waterLevel;
    clipping.plane.applyMatrix4(mirrorCamera.matrixWorldInverse);
    clipping.vector.set(
      clipping.plane.normal.x,
      clipping.plane.normal.y,
      clipping.plane.normal.z,
      clipping.plane.constant,
    );
    const projection = mirrorCamera.projectionMatrix.elements;
    clipping.q.set(
      (Math.sign(clipping.vector.x) + projection[8]!) / projection[0]!,
      (Math.sign(clipping.vector.y) + projection[9]!) / projection[5]!,
      -1,
      (1 + projection[10]!) / projection[14]!,
    );
    clipping.vector.multiplyScalar(2 / clipping.vector.dot(clipping.q));
    projection[2] = clipping.vector.x;
    projection[6] = clipping.vector.y;
    projection[10] = clipping.vector.z + 1 - 0.001;
    projection[14] = clipping.vector.w;

    const basin = scene.getObjectByName("pool-basin");
    const wasVisible = basin?.visible ?? true;
    if (basin) basin.visible = false;

    // Every water mesh (main basin + skimmer tongue) samples this very
    // render target as `waterReflectionTexture`. Left visible, the mirror
    // pass would render a water mesh into `target` while that mesh's own
    // shader samples `target.texture` in the same draw call -- a
    // framebuffer/texture feedback loop (WebGL flags it as
    // GL_INVALID_OPERATION and the sampled result is undefined per spec).
    // Hidden here for the one pass that would otherwise create the loop;
    // restored immediately after.
    const hiddenWater: THREE.Object3D[] = [];
    scene.traverse((object) => {
      // Keep sky/environment reflection, but omit the presentation deck and
      // every dry edge/border finish from this pass: mirrored right next to
      // the real thing, their reflected strips double the pool outline and
      // make the actual border harder to read. Covers the skimmer coping
      // (pool-perimeter-finish), the studio deck, the physical skimmer
      // housings (pool-skimmers), the hidden-overflow stone lip
      // (overflow-edge-without-grille) and the visible-overflow grille
      // (overflow-grille) -- whichever of these is this system's actual
      // border. Also excludes the baked ContactShadows plane
      // (pool-contact-shadows): its blurred shadow blob sits right at deck
      // level and, uncaught, mirrors into the water as a smeared dark streak
      // exactly where the coping/waterline read needed to be cleanest. The
      // main scene and all interaction remain unchanged.
      if (
        object.visible &&
        (isWaterSurfaceMesh(object) ||
          object.name === "pool-perimeter-finish" ||
          object.name === "pool-studio-deck" ||
          object.name === "pool-skimmers" ||
          object.name === "overflow-edge-without-grille" ||
          object.name === "overflow-grille" ||
          object.name === "pool-contact-shadows")
      ) {
        object.visible = false;
        hiddenWater.push(object);
      }
    });

    const previousTarget = gl.getRenderTarget();
    const shadowAutoUpdate = gl.shadowMap.autoUpdate;
    const xrEnabled = gl.xr.enabled;
    try {
      gl.shadowMap.autoUpdate = false;
      gl.xr.enabled = false;
      gl.setRenderTarget(target);
      gl.clear();
      gl.render(scene, mirrorCamera);
    } finally {
      gl.setRenderTarget(previousTarget);
      gl.shadowMap.autoUpdate = shadowAutoUpdate;
      gl.xr.enabled = xrEnabled;
      if (basin) basin.visible = wasVisible;
      for (const object of hiddenWater) object.visible = true;
    }
  });

  return { texture: target?.texture ?? null, textureMatrix, aboveWaterline };
}

/** Shared physical water surface used by the pool and skimmer tongue. */
export function WaterSurfaceMaterial({
  waterLevel = 0,
  reflections = true,
  depth = 0.13,
  outline,
}: {
  waterLevel?: number;
  reflections?: boolean;
  depth?: number;
  outline?: Outline;
}) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const largeNormal = useMemo(() => createRippleNormalMap("broad"), []);
  const microNormal = useMemo(() => createRippleNormalMap("micro"), []);
  const shaders = useRef<WaterShader[]>([]);
  const reflection = useWaterReflection(waterLevel, reflections);
  const shoreline = useMemo(() => outline ? createShorelineField(outline) : null, [outline]);
  useEffect(() => () => shoreline?.texture.dispose(), [shoreline]);
  useEffect(() => {
    if (!shoreline) return;
    // Shape edits reuse the compiled program: update its live uniforms before
    // the next frame instead of retaining a disposed previous distance field.
    for (const shader of shaders.current) {
      const textureUniform = shader.uniforms["waterShoreline"];
      const boundsUniform = shader.uniforms["waterShoreBounds"];
      const scaleUniform = shader.uniforms["waterShoreScale"];
      if (!textureUniform || !boundsUniform || !scaleUniform) continue;
      textureUniform.value = shoreline.texture;
      boundsUniform.value = shoreline.bounds;
      scaleUniform.value = shoreline.scale;
    }
  }, [shoreline]);

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
      if (shoreline) {
        shader.uniforms["waterShoreline"] = { value: shoreline.texture };
        shader.uniforms["waterShoreBounds"] = { value: shoreline.bounds };
        shader.uniforms["waterShoreScale"] = { value: shoreline.scale };
      }
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
      if (shoreline) fragmentHeader += `
uniform sampler2D waterShoreline;
uniform vec4 waterShoreBounds;
uniform float waterShoreScale;`;
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
      if (shoreline) {
        const boundedTransmission = THREE.ShaderChunk.transmission_fragment.replace(
          "vec4 transmitted = getIBLVolumeRefraction(", `
          vec2 shoreUv = (pos.xz - waterShoreBounds.xy) / waterShoreBounds.zw;
          float shoreDistance = texture2D(waterShoreline, shoreUv).r * waterShoreScale;
          vec3 submergedRay = refract(-v, n, 1.0 / material.ior);
          float floorPath = thickness / max(abs(submergedRay.y), 0.1);
          float wallPath = shoreDistance / max(length(submergedRay.xz), 0.05);
          // A floor hit can project behind dry foreground coping in the
          // opaque framebuffer. Bound the projected sample as well as the
          // world ray, analytically, without a second scene render/raymarch.
          float cameraHeight = max(cameraPosition.y - pos.y, 0.01);
          vec2 projectedDirection = cameraHeight * submergedRay.xz + submergedRay.y * (pos.xz - cameraPosition.xz);
          float screenPath = shoreDistance * cameraHeight / max(length(projectedDirection) + shoreDistance * submergedRay.y, 0.0001);
          // Screen-space refraction cannot recover foreground-occluded basin
          // pixels. Limit displacement; full-depth absorption still comes
          // from the actual submerged surfaces, not this optical proxy.
          material.thickness = min(0.28, min(floorPath, min(wallPath, screenPath)));
          vec4 transmitted = getIBLVolumeRefraction(`,
        );
        shader.fragmentShader = shader.fragmentShader.replace("#include <transmission_fragment>", boundedTransmission);
      }
      if (!shaders.current.includes(shader)) shaders.current.push(shader);
    },
    [microNormal, reflection.texture, reflection.textureMatrix, reflection.aboveWaterline, shoreline],
  );

  useFrame(({ clock }) => {
    const time = clock.getElapsedTime();
    for (const shader of shaders.current) {
      // Slowed vs. the original bake: a calmer, more architectural drift --
      // still alive, not the "game water" scroll speed the raw values read as.
      shader.uniforms.waterLargeOffset?.value.set(time * 0.0013, time * 0.0007);
      shader.uniforms.waterMicroOffset?.value.set(-time * 0.0035, time * 0.0026);
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
      // Metric floor depth, conservatively bounded by the actual perimeter
      // in the shader so dry coping cannot leak into the refracted basin.
      thickness={outline ? depth : Math.min(depth, 0.22)}
      ior={WATER_VISUAL_PRESET.ior}
      clearcoat={WATER_VISUAL_PRESET.clearcoat}
      clearcoatRoughness={WATER_VISUAL_PRESET.clearcoatRoughness}
      attenuationColor="#ffffff"
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
        `p1c-dual-normal-physical-water-v6-${WATER_DEBUG_MODE}-${REFLECTION_ENABLED && reflections ? 1 : 0}-${outline ? 1 : 0}`
      }
    />
  );
}
