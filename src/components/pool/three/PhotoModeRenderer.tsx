import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import * as THREE from "three";
import { HDRLoader } from "three/examples/jsm/loaders/HDRLoader.js";
import { WebGLPathTracer, GradientEquirectTexture } from "three-gpu-pathtracer";
import { photoModeState } from "@/lib/pool/photoModeState";
import { WATER_VISUAL_PRESET } from "@/configurator/materials/visual-presets";
import { createDualRippleNormalMap } from "./textures";
import type { Theme } from "@/lib/theme";

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
 */
const HDRI_BY_THEME: Record<Theme, string> = {
  light: "/hdri/qwantani-noon-puresky-2k.hdr",
  dark: "/hdri/qwantani-dusk-puresky-2k.hdr",
};

/** Objects the path tracer cannot or should not trace -- see docs/PHOTO_MODE.md. */
const PHOTO_MODE_EXCLUDED_NAMES = new Set(["contact-ao-decal"]);

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
// Tiling for the baked dual-ripple normal map on the traced water. Non-integer
// on purpose (avoids a repeat count that lines the pattern up with the
// basin's own bilateral symmetry, which is what makes a tiled texture read as
// an obvious repeat rather than "acqua viva"); ~6 tiles across the basin
// keeps individual ripples a plausible size against real pool photo
// references without shrinking into visible-grid noise.
const PHOTO_MODE_WATER_NORMAL_REPEAT = 6.35;
// Slightly damped vs. the raw baked slopes: a static bake (no scroll/blend
// like the raster shader's animated dual-normal) reads as a repetitive
// stipple once the path tracer's specular has fully converged if driven at
// full strength -- this keeps the break-up visible without that "hammered
// metal" look.
const PHOTO_MODE_WATER_NORMAL_SCALE = 0.6;

function createPhotoModeWaterMaterial(normalMap: THREE.Texture): THREE.MeshPhysicalMaterial {
  const [r, g, b] = WATER_VISUAL_PRESET.scatteringColor;
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(r, g, b),
    transparent: false,
    opacity: 1,
    metalness: 0,
    roughness: 0.045,
    transmission: 0.92,
    thickness: 0.6,
    ior: WATER_VISUAL_PRESET.ior,
    attenuationColor: new THREE.Color(WATER_VISUAL_PRESET.attenuationColor),
    attenuationDistance: WATER_VISUAL_PRESET.attenuationDistance,
    clearcoat: WATER_VISUAL_PRESET.clearcoat,
    clearcoatRoughness: WATER_VISUAL_PRESET.clearcoatRoughness,
    specularIntensity: 1,
    specularColor: new THREE.Color(WATER_VISUAL_PRESET.specularColor),
    normalMap,
    normalScale: new THREE.Vector2(PHOTO_MODE_WATER_NORMAL_SCALE, PHOTO_MODE_WATER_NORMAL_SCALE),
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
 * synchronously, in the same task as the `renderSample()` call that just
 * drew it: the Canvas is created with `preserveDrawingBuffer: false` (see
 * PoolScene.tsx) for the live raster's sake, so once this task yields back
 * to the browser the drawing buffer is no longer guaranteed to still hold
 * this content. Called from inside `useFrame`, right after `renderSample()`,
 * satisfies that.
 */
function exportCurrentFrame(gl: THREE.WebGLRenderer): void {
  let dataUrl: string;
  try {
    dataUrl = gl.domElement.toDataURL("image/png");
  } catch (error) {
    console.error("[PhotoMode] failed to read the canvas for export", error);
    return;
  }
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = `piscina-wellness-photo-${Date.now()}.png`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
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
}: {
  theme: Theme;
  quality: PhotoModeQuality;
  onUnsupported: () => void;
}) {
  const { gl, scene, camera } = useThree();
  const tracerRef = useRef<WebGLPathTracer | null>(null);
  const lastCameraMatrix = useRef(new THREE.Matrix4());
  const lastHandledExportId = useRef(0);

  useEffect(() => {
    const previousEnvironment = scene.environment;
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
    let hdriTexture: THREE.Texture | null = null;
    let cancelled = false;
    const waterNormalMap = createDualRippleNormalMap(
      WATER_VISUAL_PRESET.normals.large.strength,
      WATER_VISUAL_PRESET.normals.micro.strength,
    );
    waterNormalMap.repeat.set(PHOTO_MODE_WATER_NORMAL_REPEAT, PHOTO_MODE_WATER_NORMAL_REPEAT);

    const teardown = () => {
      for (const restore of restoreVisibility) restore();
      for (const { mesh, original, override } of waterOverrides) {
        mesh.material = original;
        override.dispose();
      }
      waterNormalMap.dispose();
      scene.environment = previousEnvironment;
      scene.background = previousBackground;
      scene.backgroundBlurriness = previousBackgroundBlurriness;
      gradient.dispose();
      hdriTexture?.dispose();
    };

    let tracer: WebGLPathTracer;
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
            const override = createPhotoModeWaterMaterial(waterNormalMap);
            object.material = override;
            waterOverrides.push({ mesh: object, original: material, override });
          }
        }
      });

      tracer = new WebGLPathTracer(gl);
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
      tracer.setScene(scene, camera);
    } catch (error) {
      console.error("[PhotoMode] path tracer failed to initialize", error);
      teardown();
      onUnsupported();
      return;
    }

    tracerRef.current = tracer;
    lastCameraMatrix.current.copy(camera.matrixWorld);
    // Sync to whatever export click may already have happened in a
    // previous mount -- otherwise a stale, already-handled id would look
    // "new" to this fresh instance and fire an export on its very first
    // frame.
    lastHandledExportId.current = photoModeState.exportRequestId;

    photoModeState.active = true;
    photoModeState.samples = 0;

    // Fire-and-forget: the gradient set above is already a complete,
    // correct environment, so a slow or failed HDRI load never leaves
    // Photo Mode without lighting -- it just keeps the placeholder sky.
    new HDRLoader().load(
      HDRI_BY_THEME[theme],
      (texture) => {
        if (cancelled) {
          texture.dispose();
          return;
        }
        texture.mapping = THREE.EquirectangularReflectionMapping;
        hdriTexture = texture;
        scene.environment = texture;
        scene.background = texture;
        tracer.updateEnvironment();
      },
      undefined,
      (error) => {
        console.warn("[PhotoMode] HDRI failed to load, keeping the gradient sky instead", error);
      },
    );

    return () => {
      cancelled = true;
      photoModeState.active = false;
      photoModeState.samples = 0;
      tracer.dispose();
      tracerRef.current = null;
      teardown();
    };
    // Intentionally re-runs only when this component remounts (driven by the
    // caller's `key`) or the theme changes -- not on every render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gl, scene, theme, quality]);

  useFrame(() => {
    const tracer = tracerRef.current;
    if (!tracer) return;

    if (!camera.matrixWorld.equals(lastCameraMatrix.current)) {
      lastCameraMatrix.current.copy(camera.matrixWorld);
      tracer.updateCamera();
      tracer.reset();
      console.log("[photomode-debug] reset fired at sample", tracer.samples, Date.now());
    }

    tracer.renderSample();
    photoModeState.samples = tracer.samples;

    if (photoModeState.exportRequestId !== lastHandledExportId.current) {
      lastHandledExportId.current = photoModeState.exportRequestId;
      exportCurrentFrame(gl);
    }
  }, 1);

  return null;
}
