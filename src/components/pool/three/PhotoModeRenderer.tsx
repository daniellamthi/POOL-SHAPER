import { useEffect, useMemo, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { WebGLPathTracer, GradientEquirectTexture } from "three-gpu-pathtracer";
import { getPhotoMaterialRevision, photoModeState, PHOTO_MODE_EXPORT_READY_SAMPLES } from "@/lib/pool/photoModeState";
import { WATER_VISUAL_PRESET } from "@/configurator/materials/visual-presets";
import { createDualRippleNormalMap } from "./textures";
import type { Theme } from "@/lib/theme";
import { installPhotoOutputFilter } from "./photoOutputFilter";
import { installPhotoHDRExport } from "./photoHDRExport";
import { installPhotoLedTransport } from "./photoLedTransport";
import { installPhotoWaterMedium, preparePhotoWaterMedium, type PhotoWaterMedium } from "./photoWaterMedium";
import { projectPhotoWaterPreservation } from "./photoWaterPreservation";
import { ownPhotoTracerResources } from "./photoTracerResources";
import { createPhotoCamera } from "./photoCamera";
import { renderPhotoRasterFallback } from "./photoRasterFallback";
import { createPhotoBvhWorker } from "./photoBvhWorker";
import { watchPhotoContext } from "./photoContextGuard";
import { installRefractedSun, prepareRefractedSun } from "./photoRefractedSun";
import { CATALOGUE_GARDEN } from "@/lib/pool/catalogue-garden";

// Intentionally the same two tones as SkyDome's palette (see SkyDome.tsx):
// Photo Mode's environment should read as a continuation of the live view's
// backdrop, not a different-looking "photo studio", even though the path
// tracer needs its own equirectangular texture rather than SkyDome's mesh.
// Used as the instant-available background while the real HDRI (below)
// loads, and as the permanent fallback if it never does.
const GRADIENT_PALETTE = {
  dark: { zenith: "#141a21", horizon: "#242a2f" },
  light: { zenith: "#bfd8ea", horizon: "#eef4f2" },
} as const;

/**
 * Real sky lighting, replacing the flat two-tone gradient above wherever it
 * loads successfully. Both are Poly Haven "Pure Sky" HDRIs (CC0, no
 * attribution required -- see public/hdri/CREDITS.md): sky-only captures
 * with no ground/horizon objects baked in, chosen specifically so they
 * don't introduce foreign geometry into the pool's reflections. One per
 * theme, matching the same light/dark split as the gradient fallback.
 *
 * Exported so the Blender/Cycles render pipeline (see
 * src/lib/render-pipeline/serialize.ts) points at this exact same file
 * instead of hard-coding a second copy of this mapping that could drift.
 */
export const HDRI_BY_THEME: Record<Theme, string> = {
  light: "/hdri/qwantani-noon-puresky-2k.hdr",
  dark: "/hdri/qwantani-dusk-puresky-2k.hdr",
};

/**
 * Objects the path tracer cannot or should not trace -- see
 * docs/PHOTO_MODE.md.
 *
 * `led-beam-scatter` (PoolLights.tsx's underwater-LED beam volume) is a
 * `THREE.ShaderMaterial` with its colour driven entirely by a `beamColor`
 * uniform -- it has no `.color` property at all. three-gpu-pathtracer's
 * `StaticGeometryGenerator` collects the material off of every visible Mesh
 * unconditionally (it doesn't special-case ShaderMaterial), and
 * `MaterialsTexture.updateFrom` then reads `material.color.r` on every
 * material it's handed with no guard, which throws
 * "Cannot read properties of undefined (reading 'r')" the moment any LED
 * fixture is powered (default: whenever the water is shown) -- reproduced
 * with the Organic shape's default LED-lit preset, but not shape-specific;
 * any shape with lit underwater LEDs hits the same crash. The beam is a
 * raster-only volumetric-scatter trick anyway (see its own comments), not a
 * real light-transporting surface the path tracer could usefully trace, so
 * it's excluded the same way `contact-ao-decal` is: hidden only for the
 * traced scene, restored for the live view.
 */
// Additive raster glow is an opaque occluder to the tracer: its disc sits
// 0.2 mm in front of the spotlight. Retain the real emissive lens and light.
const PHOTO_MODE_EXCLUDED_NAMES = new Set(["contact-ao-decal", "led-beam-scatter", "led-core-glow"]);

/**
 * Marker baked into WaterSurfaceMaterial's `customProgramCacheKey` (see
 * WaterSurfaceMaterial.tsx) -- used here purely as an identity check so this
 * file can find every water mesh (main basin + skimmer tongue) without the
 * two call sites needing to agree on an object `name`.
 */
const WATER_PROGRAM_CACHE_KEY_MARKER = "dual-normal-physical-water";

function isWaterSurfaceMaterial(material: THREE.Material): boolean {
  const key = (material as THREE.Material & { customProgramCacheKey?: () => string })
    .customProgramCacheKey;
  return typeof key === "function" && key.call(material).includes(WATER_PROGRAM_CACHE_KEY_MARKER);
}

/**
 * WaterSurfaceMaterial's `meshPhysicalMaterial` is authored for the raster
 * pipeline, where `onBeforeCompile` throws away the standard alpha output
 * and replaces it with a custom mirror-reflection fragment (see
 * WaterSurfaceMaterial.tsx). The path tracer never runs that hook -- per
 * three-gpu-pathtracer's own design it reads the plain material properties
 * into its own uber-shader -- so it sees the raw combination `transparent:
 * true, opacity: 0.12`. That combination is a raster-only "blend the shaded
 * water at 12% over the background" trick; three-gpu-pathtracer's
 * `getSurfaceRecord` (get_surface_record_function.glsl.js) instead reads any
 * `transparent` material as a stochastic pass-through and skips the surface
 * entirely whenever `albedo.a < rand()`, i.e. with probability `1 - opacity`
 * -- about 88% of the time here. The water isn't dim, it is being hit on
 * roughly one sample in eight and otherwise treated as if it weren't there,
 * which is exactly why the accumulated image reads as bare (sand-coloured)
 * pool floor. This override gives Photo Mode its own fully-opaque stand-in
 * (opacity 1, so every sample actually interacts with it) that leans on
 * physical transmission instead of alpha blending for the "see-through"
 * look. It is only ever swapped onto the traced scene graph below, and is
 * restored to the original raster material on cleanup -- the live view
 * never sees it.
 */
// Pool surface UVs are metres, not normalized 0..1. Six repeats per metre
// averaged the ripples away. This yields about six tiles along a 10 m pool.
const PHOTO_MODE_WATER_NORMAL_REPEAT = 0.635;
const PHOTO_MODE_WATER_NORMAL_SCALE = 0.6;
// Preserve readable slopes before the 8-bit bake: live shader weights applied
// directly to pixel finite differences otherwise quantize to almost flat 127/128.
const PHOTO_MODE_RIPPLE_BAKE_GAIN = 30;

function createPhotoModeWaterMaterial(normalMap: THREE.Texture, indoor = false, pureTransmission = false): THREE.MeshPhysicalMaterial {
  const normalStrength = PHOTO_MODE_WATER_NORMAL_SCALE * (indoor ? .3 : 1);
  return new THREE.MeshPhysicalMaterial({
    // Clear interface: basin colour and volume attenuation provide the tint.
    color: new THREE.Color(1, 1, 1),
    transparent: false,
    opacity: 1,
    metalness: 0,
    roughness: 0.045,
    // The bounded Night medium owns extinction; clear water has no diffuse
    // white surface lobe. Keep the prior interface in all other contexts.
    transmission: pureTransmission ? 1 : 0.92,
    thickness: 0.6,
    ior: WATER_VISUAL_PRESET.ior,
    attenuationColor: new THREE.Color(WATER_VISUAL_PRESET.attenuationColor),
    attenuationDistance: WATER_VISUAL_PRESET.attenuationDistance,
    clearcoat: WATER_VISUAL_PRESET.clearcoat,
    clearcoatRoughness: WATER_VISUAL_PRESET.clearcoatRoughness,
    specularIntensity: 1,
    specularColor: new THREE.Color(WATER_VISUAL_PRESET.specularColor),
    normalMap,
    normalScale: new THREE.Vector2(normalStrength, normalStrength),
    side: THREE.DoubleSide,
  });
}

/**
 * Simple, manual quality knobs -- see docs/PHOTO_MODE.md for the measured
 * before/after numbers behind the "standard" values. No hardware
 * auto-detection: `standard` is the default for everyone, `high` is an
 * explicit opt-in for someone willing to trade convergence speed for the
 * library's own out-of-the-box fidelity.
 */
export const PHOTO_MODE_QUALITY_PRESETS = {
  standard: { bounces: 6, transmissiveBounces: 6, renderScale: 0.85 },
  high: { bounces: 10, transmissiveBounces: 10, renderScale: 1 },
} as const;

export type PhotoModeQuality = keyof typeof PHOTO_MODE_QUALITY_PRESETS;

/**
 * Saves the exact frame currently on screen as a PNG, client-side only (a
 * temporary `<a download>` + object click -- no server involved). Must run
 * in the same task as the `renderSample()` call that just
 * drew it: the Canvas is created with `preserveDrawingBuffer: false` (see
 * PoolScene.tsx) for the live raster's sake, so once this task yields back
 * to the browser the drawing buffer is no longer guaranteed to still hold
 * this content. Called from inside `useFrame`, right after `renderSample()`,
 * satisfies that.
 */
function exportCurrentFrame(gl: THREE.WebGLRenderer, current: () => boolean): void {
  if (gl.getContext().isContextLost() || !current()) return;
  try {
    // toBlob snapshots the canvas when called, before this frame yields.
    // A blob URL also avoids large data-URL downloads being dropped by hosts.
    gl.domElement.toBlob((blob) => {
      if (!blob || gl.getContext().isContextLost() || !current()) return;
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `piscina-wellness-photo-${Date.now()}.png`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    }, "image/png");
  } catch (error) {
    console.error("[PhotoMode] failed to read the canvas for export", error);
  }
}

/**
 * Mounts only while Photo Mode is active. Takes over the Canvas's render
 * loop (positive useFrame priority disables react-three-fiber's own
 * automatic render -- see the note on the reflection hook in
 * WaterSurfaceMaterial.tsx for the same pattern) and progressively refines a
 * single path-traced frame instead of the usual per-frame raster pass.
 *
 * Give this a `key` that changes whenever the traced scene's geometry,
 * materials, or `quality` meaningfully change (see PoolScene's
 * `photoModeSceneKey`): a full remount is the simplest correct way to
 * re-seed `WebGLPathTracer`, since `setScene` is documented as "relatively
 * expensive" and the pool configurator does not change its own
 * shape/materials every frame.
 *
 * `onUnsupported` is called -- at most once, synchronously from the setup
 * effect -- if the device can't run the path tracer at all (no WebGL2, or
 * `WebGLPathTracer` throws during setup on some driver/extension quirk).
 * The scene graph is left exactly as it was found and nothing here ever
 * throws back out: the caller is expected to flip Photo Mode back off and
 * show its own message, so the live configurator is never at risk of
 * inheriting a crash from a feature it isn't even using.
 */
export function PhotoModeRenderer({
  theme,
  quality,
  onUnsupported,
  onContextRestored,
  environmentUrl,
  environmentRotation = 0,
  indoor = false,
  filterOutput = false,
  denoiseExport = indoor,
  ledTransportWaterY,
  waterMedium,
  photoSubject,
  portraitPitch = 0,
  refractedSun = false,
}: {
  photoSubject?: readonly (readonly [number, number, number])[] | undefined;
  portraitPitch?: number;
  refractedSun?: boolean;
  indoor?: boolean;
  filterOutput?: boolean;
  denoiseExport?: boolean;
  ledTransportWaterY?: number | undefined;
  waterMedium?: PhotoWaterMedium | undefined;
  environmentUrl?: string | undefined;
  environmentRotation?: number | undefined;
  theme: Theme;
  quality: PhotoModeQuality;
  onUnsupported: () => void;
  onContextRestored: () => void;
}) {
  const { gl, scene, camera } = useThree();
  const photoFrame = useMemo(() => createPhotoCamera(camera, photoSubject, portraitPitch), [camera, photoSubject, portraitPitch]);
  const tracerRef = useRef<WebGLPathTracer | null>(null);
  const buildWorkerRef = useRef<ReturnType<typeof createPhotoBvhWorker> | null>(null);
  const lastCameraMatrix = useRef(new THREE.Matrix4());
  const lastProjectionMatrix = useRef(new THREE.Matrix4());
  const lastHandledExportId = useRef(0);
  const lastMaterialRevision = useRef(0);
  const hdrExportRef = useRef<ReturnType<typeof installPhotoHDRExport> | null>(null);
  const lastBufferSize = useRef(new THREE.Vector2());
  const bufferSize = useRef(new THREE.Vector2());
  const contextWatch = useRef<ReturnType<typeof watchPhotoContext> | null>(null);
  const lastRestoreRequestId = useRef(photoModeState.contextRestoreRequestId);

  useEffect(() => {
    const watch = watchPhotoContext(gl, () => {
      buildWorkerRef.current?.dispose();
      buildWorkerRef.current = null;
      hdrExportRef.current?.reset();
      tracerRef.current = null;
      photoModeState.contextLost = true;
      photoModeState.samples = 0;
      photoModeState.preparing = false;
      lastHandledExportId.current = photoModeState.exportRequestId;
    }, () => {
      // The restored GL context needs a fresh tracer, not its pre-loss FBOs
      // and accumulation. Keep the selected scene/configuration in place.
      tracerRef.current = null;
      photoModeState.contextLost = false;
      onContextRestored();
    });
    contextWatch.current = watch;
    return () => {
      watch.dispose();
      if (contextWatch.current === watch) {
        contextWatch.current = null;
        photoModeState.contextLost = false;
      }
    };
  }, [gl, onContextRestored]);

  useEffect(() => {
    if (gl.getContext().isContextLost()) return;
    const previousEnvironment = scene.environment;
    const previousEnvironmentRotation = scene.environmentRotation.clone();
    const previousBackgroundRotation = scene.backgroundRotation.clone();
    scene.environmentRotation.set(0,environmentRotation,0);
    scene.backgroundRotation.set(0,environmentRotation,0);
    const previousBackground = scene.background;
    const previousBackgroundBlurriness = scene.backgroundBlurriness;

    const palette = GRADIENT_PALETTE[theme];
    const gradient = new GradientEquirectTexture(512);
    gradient.topColor.set(palette.zenith);
    gradient.bottomColor.set(palette.horizon);
    gradient.exponent = 1.4;
    gradient.update();
    scene.environment = gradient;
    scene.background = gradient;
    scene.backgroundBlurriness = 0;

    const restoreVisibility: Array<() => void> = [];
    const waterOverrides: Array<{
      mesh: THREE.Mesh;
      original: THREE.Material;
      override: THREE.MeshPhysicalMaterial;
    }> = [];
    const geometryOverrides: Array<{ mesh: THREE.Mesh; original: THREE.BufferGeometry; override: THREE.BufferGeometry }> = [];
    const pavingOverrides: Array<{ mesh: THREE.Mesh; original: THREE.Material; override: THREE.MeshStandardMaterial; maps: THREE.Texture[] }> = [];
    let hdriTexture: THREE.Texture | null = null;
    let cancelled = false;
    let disposeOutputFilter: (() => void) | undefined;
    let filteredFrame: THREE.WebGLRenderTarget | null = null;
    let disposeLedTransport: (() => void) | undefined;
    let disposeWaterMedium: (() => void) | undefined;
    let disposeRefractedSun: (() => void) | undefined;
    const preparedWaterMedium = preparePhotoWaterMedium(waterMedium);
    let ownedSunDiagnostic: string | undefined;
    const recordSunDiagnostic = (detail: Record<string, unknown>) => {
      if (!import.meta.env.DEV) return;
      ownedSunDiagnostic = JSON.stringify(detail);
      gl.domElement.dataset["photoRefractedSun"] = ownedSunDiagnostic;
    };
    restoreVisibility.push(() => {
      if (ownedSunDiagnostic && gl.domElement.dataset["photoRefractedSun"] === ownedSunDiagnostic)
        delete gl.domElement.dataset["photoRefractedSun"];
    });
    const waterNormalMap = createDualRippleNormalMap(
      WATER_VISUAL_PRESET.normals.large.strength * PHOTO_MODE_RIPPLE_BAKE_GAIN,
      WATER_VISUAL_PRESET.normals.micro.strength * PHOTO_MODE_RIPPLE_BAKE_GAIN,
    );
    waterNormalMap.repeat.set(PHOTO_MODE_WATER_NORMAL_REPEAT, PHOTO_MODE_WATER_NORMAL_REPEAT);

    const teardown = () => {
      hdrExportRef.current?.dispose();
      hdrExportRef.current = null;
      disposeOutputFilter?.();
      disposeRefractedSun?.();
      disposeWaterMedium?.();
      disposeLedTransport?.();
      for (const restore of restoreVisibility) restore();
      for (const { mesh, original, override } of waterOverrides) {
        mesh.material = original;
        override.dispose();
      }
      for (const { mesh, original, override, maps } of [...pavingOverrides].reverse()) {
        mesh.material = original;
        override.dispose();
        maps.forEach(map => map.dispose());
      }
      for (const { mesh, original, override } of geometryOverrides) {
        mesh.geometry = original; override.dispose();
      }
      waterNormalMap.dispose();
      // The returning live environment mounts in a layout effect before this
      // passive cleanup. Restore only values still owned by Photo Mode.
      if (scene.environment === gradient || (hdriTexture && scene.environment === hdriTexture)) {
        scene.environment = previousEnvironment;
        scene.environmentRotation.copy(previousEnvironmentRotation);
      }
      if (scene.background === gradient || (hdriTexture && scene.background === hdriTexture)) {
        scene.backgroundRotation.copy(previousBackgroundRotation);
        scene.background = previousBackground;
        scene.backgroundBlurriness = previousBackgroundBlurriness;
      }
      gradient.dispose();
      hdriTexture?.dispose();
    };

    let tracer: WebGLPathTracer | null = null;
    let tracerResources: ReturnType<typeof ownPhotoTracerResources> | null = null;
    let bvhWorker: ReturnType<typeof createPhotoBvhWorker> | null = null;
    let released = false;
    const releaseTracer = () => {
      if (released) return;
      released = true;
      bvhWorker?.dispose();
      if (buildWorkerRef.current === bvhWorker) buildWorkerRef.current = null;
      if (tracerResources) void tracerResources.dispose(teardown);
      else { teardown(); tracer?.dispose(); }
    };
    const initialize = async () => {
    try {
      // three-gpu-pathtracer relies on WebGL2-only features (float render
      // targets, texture arrays for the BVH/material data). Checking this
      // up front turns "device can't run it" into one clean, expected
      // branch instead of waiting for a constructor/setScene throw.
      if (!gl.capabilities.isWebGL2) {
        throw new Error("WebGL2 is not available on this device/browser.");
      }

      scene.traverse((object) => {
        if (PHOTO_MODE_EXCLUDED_NAMES.has(object.name) && object.visible) {
          object.visible = false;
          restoreVisibility.push(() => {
            object.visible = true;
          });
        }

        if (object instanceof THREE.Mesh && !Array.isArray(object.material)) {
          const material = object.material as THREE.Material;
          if (isWaterSurfaceMaterial(material)) {
            const override = createPhotoModeWaterMaterial(waterNormalMap, indoor, !!preparedWaterMedium && theme === "dark");
            // This bounded medium owns absorption on both view and light paths.
            // Keep the interface clear so its legacy back-face term is not counted twice.
            if (preparedWaterMedium) override.attenuationColor.setRGB(1, 1, 1);
            object.material = override;
            waterOverrides.push({ mesh: object, original: material, override });
          } else if (material.customProgramCacheKey().startsWith("studio-paving-v3-gres-")) {
            const original = material as THREE.MeshStandardMaterial;
            const override = original.clone();
            const maps: THREE.Texture[] = [];
            for (const key of ["map", "normalMap", "roughnessMap"] as const) {
              const source = original[key];
              if (!source?.image) continue;
              // Bake the exact mineral-field sampling used by samplePavingGres:
              // path tracing reads material properties, never onBeforeCompile.
              const input = document.createElement("canvas");
              const image = source.image as HTMLImageElement;
              input.width = image.width; input.height = image.height;
              const ctx = input.getContext("2d")!;
              ctx.drawImage(image, 0, 0);
              const pixels = ctx.getImageData(0, 0, input.width, input.height).data;
              const canvas = document.createElement("canvas");
              canvas.width = canvas.height = 256;
              const out = canvas.getContext("2d")!;
              const result = out.createImageData(256, 256);
              for (let y = 0; y < 256; y++) for (let x = 0; x < 256; x++) {
                const u = (x + .5) / 256, v = (y + .5) / 256;
                const sx = Math.floor((.41 + Math.min(u, 1-u) * .28) * input.width);
                const sy = Math.floor((1 - (.36 + Math.min(v, 1-v) * .32)) * input.height);
                const i = (sy * input.width + sx) * 4, j = (y * 256 + x) * 4;
                for (let c = 0; c < 3; c++) {
                  let value = pixels[i+c]! / 255;
                  if (key === "map") {
                    const linear = THREE.ColorManagement.colorSpaceToWorking(new THREE.Color(value,value,value), THREE.SRGBColorSpace).r;
                    value = THREE.ColorManagement.workingToColorSpace(new THREE.Color([.38,.36,.32][c]! * .78 + linear * .22,0,0), THREE.SRGBColorSpace).r;
                  } else if (key === "normalMap" && ((c === 0 && u >= .5) || (c === 1 && v >= .5))) value = 1-value;
                  result.data[j+c] = Math.round(value * 255);
                }
                result.data[j+3] = 255;
              }
              out.putImageData(result,0,0);
              const baked = new THREE.CanvasTexture(canvas);
              baked.flipY = false;
              baked.colorSpace = source.colorSpace;
              baked.wrapS = baked.wrapT = THREE.RepeatWrapping;
              baked.repeat.set(source.repeat.x / .28, source.repeat.y / .32);
              override[key] = baked; maps.push(baked);
            }
            object.material = override;
            pavingOverrides.push({ mesh: object, original, override, maps });
          }
        }
      });

      tracer = new WebGLPathTracer(gl);
      tracerResources = ownPhotoTracerResources(tracer);
      tracer.rasterizeSceneCallback = (scene, photoCamera) => renderPhotoRasterFallback(gl, scene, camera, photoCamera);
      const preset = PHOTO_MODE_QUALITY_PRESETS[quality];
      // three-gpu-pathtracer defaults `bounces`/`transmissiveBounces` to 10
      // and `renderScale` to 1 -- sized for scenes with stacked
      // glass/mirrors at full resolution. This scene has one transmissive
      // layer (water) over diffuse walls/floor under a flat sky, so
      // "standard" trims both for measurably less GPU work per sample with
      // no visible energy loss (see docs/PHOTO_MODE.md for the measured
      // numbers); "high" keeps the library's own defaults.
      tracer.bounces = preset.bounces;
      tracer.transmissiveBounces = preset.transmissiveBounces;
      tracer.renderScale = preset.renderScale;
      // Shows a fast 25%-resolution preview (already built into the
      // library, just never turned on here) while the full-resolution
      // accumulation catches up, instead of a blank/frozen canvas on first
      // mount or after a reset -- purely perceptual, it never changes the
      // converged image.
      tracer.dynamicLowRes = true;
      // The installed path tracer's mixed RGB/RGBA merge branch copies in
      // the wrong direction. Normalize cloned attributes; never mutate live
      // geometry or drop its per-module colour variation.
      scene.traverseVisible(object => {
        if (!(object instanceof THREE.Mesh)) return;
        const color = object.geometry.getAttribute("color");
        if (!color || color.itemSize !== 3) return;
        const original = object.geometry;
        const override = original.clone();
        const rgba = new Float32Array(color.count * 4);
        for (let i = 0; i < color.count; i++) {
          rgba.set([color.getX(i), color.getY(i), color.getZ(i), 1], i * 4);
        }
        override.setAttribute("color", new THREE.BufferAttribute(rgba, 4));
        object.geometry = override;
        geometryOverrides.push({mesh:object,original,override});
      });
      gl.getDrawingBufferSize(bufferSize.current);
      photoFrame.sync(camera, bufferSize.current);
      if (import.meta.env.DEV) console.debug("[PhotoMode camera frame]", JSON.stringify({
        sourceProjection: camera.projectionMatrix.toArray(),
        projection: photoFrame.camera.projectionMatrix.toArray(),
        world: photoFrame.camera.matrixWorld.toArray(),
        buffer: bufferSize.current.toArray(),
      }));
      // Keep the full SAH tree and scene; only its CPU build moves off the UI.
      bvhWorker = createPhotoBvhWorker();
      buildWorkerRef.current = bvhWorker;
      tracer.setBVHWorker(bvhWorker);
      photoModeState.active = true;
      photoModeState.preparing = true;
      photoModeState.samples = 0;
      // A map may finish loading while the BVH worker runs. Retain this
      // earlier revision so the first frame catches up after the scene upload.
      const materialRevision = getPhotoMaterialRevision(scene);
      await tracer.setSceneAsync(scene, photoFrame.camera);
      bvhWorker.dispose();
      if (buildWorkerRef.current === bvhWorker) buildWorkerRef.current = null;
      if (cancelled || gl.getContext().isContextLost()) { releaseTracer(); return; }
      lastMaterialRevision.current = materialRevision;
      if (ledTransportWaterY !== undefined) disposeLedTransport = installPhotoLedTransport(tracer, scene, ledTransportWaterY, gl, !!preparedWaterMedium);
      if (preparedWaterMedium && waterOverrides.length) disposeWaterMedium = installPhotoWaterMedium(tracer, preparedWaterMedium);
      const sunDiagnostic = { requested: refractedSun, medium: !!preparedWaterMedium, interfaces: waterOverrides.length, environmentUrl, environmentRotation, waterY: waterMedium?.waterY, floorY: waterMedium?.bottomY };
      recordSunDiagnostic({ ...sunDiagnostic, snapshot: false });
      if (refractedSun && preparedWaterMedium && waterMedium && waterOverrides.length) {
        const interfaceMaterial = waterOverrides[0]!.override;
        const angle = environmentRotation - CATALOGUE_GARDEN.rotation;
        const [sx, sy, sz] = CATALOGUE_GARDEN.sun;
        const sunDirection: [number, number, number] = [Math.cos(angle) * sx + Math.sin(angle) * sz, sy, -Math.sin(angle) * sx + Math.cos(angle) * sz];
        const snapshot = environmentUrl === CATALOGUE_GARDEN.url ? prepareRefractedSun(scene, waterMedium, waterNormalMap, interfaceMaterial.normalScale, interfaceMaterial.ior, sunDirection) : null;
        if (snapshot) {
          disposeRefractedSun = installRefractedSun(tracer, scene, gl, snapshot);
          recordSunDiagnostic({ ...sunDiagnostic, snapshot: true, environmentSun: snapshot.environmentSun, sun: snapshot.toSun, bakeMs: snapshot.bakeMs, range: [snapshot.gain.minGain, snapshot.gain.maxGain], targetFlux: snapshot.gain.targetFlux, encodedFlux: snapshot.gain.encodedFlux });
          if (import.meta.env.DEV) console.debug("[PhotoMode refracted sun]", JSON.stringify({
            resolution: snapshot.field.resolution, bakeMs: snapshot.bakeMs,
            sun: snapshot.toSun, range: [snapshot.gain.minGain, snapshot.gain.maxGain],
            targetFlux: snapshot.gain.targetFlux, encodedFlux: snapshot.gain.encodedFlux,
          }));
        }
      }
      const stockOutput = tracer.renderToCanvasCallback;
      if (filterOutput) disposeOutputFilter = installPhotoOutputFilter(tracer, waterMedium ? target => { filteredFrame = target; } : undefined);
      if (denoiseExport && filterOutput) hdrExportRef.current = installPhotoHDRExport(
        tracer, stockOutput, preparing => { photoModeState.preparing = preparing; },
        undefined, waterMedium ? () => {
          const polygons = projectPhotoWaterPreservation(waterMedium, photoFrame.camera);
          if (import.meta.env.DEV) console.debug("[PhotoMode water preservation]", JSON.stringify({ polygons }));
          return polygons;
        } : undefined,
        waterMedium ? () => filteredFrame : undefined,
      );
    } catch (error) {
      releaseTracer();
      if (cancelled || gl.getContext().isContextLost()) return;
      photoModeState.preparing = false;
      console.error("[PhotoMode] path tracer failed to initialize", error);
      onUnsupported();
      return;
    }

    photoModeState.preparing = false;
    tracerRef.current = tracer;
    lastCameraMatrix.current.copy(camera.matrixWorld);
    lastProjectionMatrix.current.copy(camera.projectionMatrix);
    gl.getDrawingBufferSize(lastBufferSize.current);
    // Sync to whatever export click may already have happened in a
    // previous mount -- otherwise a stale, already-handled id would look
    // "new" to this fresh instance and fire an export on its very first
    // frame.
    lastHandledExportId.current = photoModeState.exportRequestId;

    photoModeState.active = true;
    photoModeState.samples = 0;

    const readyTracer = tracer;
    // Fire-and-forget: the gradient set above is already a complete,
    // correct environment, so a slow or failed HDRI load never leaves
    // Photo Mode without lighting -- it just keeps the placeholder sky.
    // Dusk HDRI is brighter than the live Night sky. Indoor and bounded
    // Patio Night keep the existing photographic gradient with the live
    // Night palette; actual fixtures still provide the lighting and bounces.
    if (!(theme === "dark" && (indoor || (!!preparedWaterMedium && ledTransportWaterY !== undefined)))) new HDRLoader().load(
      environmentUrl ?? HDRI_BY_THEME[theme],
      (texture) => {
        if (cancelled || gl.getContext().isContextLost()) {
          texture.dispose();
          return;
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        hdriTexture = texture;
        scene.environment = texture;
        scene.background = texture;
        hdrExportRef.current?.reset();
        readyTracer.updateEnvironment();
      },
      undefined,
      (error) => {
        console.warn("[PhotoMode] HDRI failed to load, keeping the gradient sky instead", error);
      },
    );

    };
    void initialize();

    return () => {
      cancelled = true;
      photoModeState.active = false;
      photoModeState.samples = 0;
      photoModeState.preparing = false;
      releaseTracer();
      tracerRef.current = null;
    };
    // Intentionally re-runs only when this component remounts (driven by the
    // caller's `key`) or the theme changes -- not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, theme, quality, environmentUrl, environmentRotation, indoor, filterOutput, denoiseExport, ledTransportWaterY, waterMedium, photoFrame, refractedSun]);

  useFrame(() => {
    if (lastRestoreRequestId.current !== photoModeState.contextRestoreRequestId) {
      lastRestoreRequestId.current = photoModeState.contextRestoreRequestId;
      contextWatch.current?.requestRestore();
    }
    if (gl.getContext().isContextLost() || contextWatch.current?.isLost()) {
      photoModeState.contextLost = true;
      photoModeState.samples = 0;
      return;
    }
    const tracer = tracerRef.current;
    if (!tracer) return;

    const materialRevision = getPhotoMaterialRevision(scene);
    if (materialRevision !== lastMaterialRevision.current) {
      hdrExportRef.current?.reset();
      tracer.updateMaterials();
      lastMaterialRevision.current = materialRevision;
      photoModeState.samples = 0;
      lastHandledExportId.current = photoModeState.exportRequestId;
    }

    gl.getDrawingBufferSize(bufferSize.current);
    const sizeChanged = !bufferSize.current.equals(lastBufferSize.current);
    if (!camera.matrixWorld.equals(lastCameraMatrix.current) ||
        !camera.projectionMatrix.equals(lastProjectionMatrix.current) || sizeChanged) {
      const opticalChange = photoFrame.sync(camera, bufferSize.current);
      lastCameraMatrix.current.copy(camera.matrixWorld);
      lastProjectionMatrix.current.copy(camera.projectionMatrix);
      lastBufferSize.current.copy(bufferSize.current);
      if (opticalChange || sizeChanged) {
        hdrExportRef.current?.reset();
        tracer.updateCamera();
        tracer.reset();
      }
    }

    let exportFrame = false;
    if (photoModeState.exportRequestId !== lastHandledExportId.current) {
      lastHandledExportId.current = photoModeState.exportRequestId;
      if (tracer.samples >= PHOTO_MODE_EXPORT_READY_SAMPLES) {
        if (hdrExportRef.current) hdrExportRef.current.request();
        else exportFrame = true;
      }
    }
    // The copied frame stays on screen while the worker owns the GPU work.
    // Camera/size invalidation above remains active and cancels stale exports.
    if (hdrExportRef.current?.working) return;
    tracer.renderSample();
    photoModeState.samples = tracer.samples;
    if (exportFrame || hdrExportRef.current?.consumeExport()) {
      const watch = contextWatch.current;
      if (watch) {
        const stamp = watch.stamp();
        exportCurrentFrame(gl, () => watch.valid(stamp) && getPhotoMaterialRevision(scene) === materialRevision);
      }
    }
  }, 1);

  return null;
}
