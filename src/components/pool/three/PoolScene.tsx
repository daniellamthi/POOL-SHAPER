import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, ContactShadows, Line, useProgress } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import {
  Vector3,
  Vector2,
  AgXToneMapping,
  Color,
  DoubleSide,
  MathUtils,
  NoToneMapping,
  PCFShadowMap,
  OrthographicCamera,
  SRGBColorSpace,
} from "three";
import type { DirectionalLight, HemisphereLight, SpotLight } from "three";
import { PoolModel } from "./PoolModel";
import { AutomaticCover } from "./AutomaticCover";
import type { CoverPlan } from "@/lib/pool/cover-plan";
import { StudioPaving } from "./StudioPaving";
import { studioDeckBand, studioDeckInnerOffset } from "./studioDeck";
import { DeckLoungers } from "./DeckLoungers";
import { PoolLights } from "./PoolLights";
import { resolvePoolLayout } from "@/lib/pool/resolved-layout";
import { InfinityEdgePicker } from "./InfinityEdgePicker";
import { createInfinityLandscape, createInfinityDeck, infinityGroundHeight } from "./infinityLandscape";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import { coastalCamera, coastalGrade, coastalPhotoRotation, coastalPhotoSun } from "./coastalLayout";
import { DaylightEnvironment, COASTAL_DAYLIGHT } from "./DaylightEnvironment";
import { copingOuterOffset, buildDeckCutoutOutline } from "./poolConstruction";
import { createLimestoneMaps, createTravertineMaps } from "./stoneTextures";
import { PoolMeasurements } from "./PoolMeasurements";
import { Skimmers } from "./Skimmers";
import { ExternalStaircase } from "./ExternalStaircase";
import { planExternalStaircase } from "./externalStaircasePlan";
import { createSurfaceGeometry } from "./poolGeometry";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import type { ResolvedMaterials } from "@/lib/pool/materials";
import type {
  FloorProfile,
  Outline,
  OverflowType,
  PoolFeatureId,
  PoolAccess,
  PoolShapeId,
  PoolType,
  SystemType,
} from "@/lib/pool/types";
import { buildFloorProfile } from "@/lib/pool/floor-profile";
import type { FloorProfileModel } from "@/lib/pool/floor-profile";
import type { Theme } from "@/lib/theme";
import {
  ACTIVE_RENDERING_QUALITY,
  SCENE_VISUAL_PRESET,
} from "@/configurator/3d/scene/visual-preset";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { outlineBounds } from "@/lib/pool/geometry";
import { getCameraPose, dimensionFrustum, contextualAccessCamera } from "@/lib/pool/camera";
import type { ResolvedPoolLayout } from "@/lib/pool/resolved-layout";
import type { SceneLightingPlan } from "@/lib/pool/lighting-plan";
import type { CameraIntent } from "@/lib/pool/camera";
import type { PoolLightPosition } from "@/lib/pool/lighting";
import type { HydromassageVariant, InternalStairType } from "@/lib/pool/types";
import {
  infinityExclusion,
  clampInfinityEdgeParams,
  infinityZonesForOutline,
} from "@/lib/pool/infinity-edge";
import type { InfinityEdgeParams, RectangleInfinityZone } from "@/lib/pool/infinity-edge";
import { getPoolVerticalLayout } from "@/lib/pool/vertical-layout";
import type { PoolVerticalLayout } from "@/lib/pool/vertical-layout";
import type { PhotoModeQuality } from "./PhotoModeRenderer";
import { renderQualityState, RENDER_QUALITY_IDLE_DELAY } from "@/lib/pool/renderQualityState";
import { heroCaptureState } from "@/lib/project-delivery/heroCapture";

export type { PhotoModeQuality };

// Split into its own chunk: only fetched when Experience quality is active,
// so Configuration (today's default) never downloads the postprocessing lib.
const PremiumPostFX = lazy(() => import("./PremiumPostFX"));
// Same reasoning: three-gpu-pathtracer is a substantial library that only
// Photo Mode needs, so the live configurator never pays for it.
const PhotoModeRenderer = lazy(() =>
  import("./PhotoModeRenderer").then((module) => ({ default: module.PhotoModeRenderer })),
);

export type SceneFocus = CameraIntent;
export type SceneTimeOfDay = "day" | "night";

export interface SceneProps {
  construction?: import("@/lib/pool/construction-presentation").ConstructionPresentation;
  outline: Outline;
  shape: PoolShapeId;
  system: SystemType;
  overflowType: OverflowType;
  poolType: PoolType;
  materials: ResolvedMaterials;
  features: ReadonlyArray<PoolFeatureId>;
  ledColor?: string;
  /** 0..1 dimmer, already resolved: the scene never guesses a default. */
  ledIntensity: number;
  /** Which internal staircase is built; resolved upstream. */
  internalStairType: InternalStairType;
  hydromassageVariant?: HydromassageVariant;
  poolAccess: PoolAccess | null;
  skimmers: SkimmerPlan;
  coverPlan: CoverPlan;
  /** Optional solar shower on the studio deck (equipment option). */
  solarShower?: boolean;
  technicalView: boolean;
  /** Geometry Pass D (Infinity, Rectangle-only first slice). Only meaningful
   * while `system === "infinity"`; absent/undefined renders and excludes
   * exactly as before Infinity existed. */
  infinityEdge?: InfinityEdgeParams;
  onSelectInfinitySide?: ((side: number) => void) | undefined;
  length: number;
  width: number;
  depth: number;
  /** Geometry pass A. Absent/"flat" renders and measures exactly as before
   * this pass -- only selectable for a rectangle, in-ground pool (see
   * `buildFloorProfile`, floor-profile.ts). */
  floorProfile?: FloorProfile | undefined;
  shallowDepth?: number | undefined;
  slopeReversed?: boolean | undefined;
  showMeasurements: boolean;
  frameToken: number;
  focus: SceneFocus;
  cameraLocked: boolean;
  showWater: boolean;
  theme: Theme;
  sceneTime: SceneTimeOfDay;
  paving?: import("@/lib/pool/presentation").PavingId;
  photoMode: boolean;
  photoModeQuality: PhotoModeQuality;
  onPhotoModeUnsupported: () => void;
}

const PALETTE = {
  dark: {
    background: SCENE_VISUAL_PRESET.backgrounds.dark,
    guide: SCENE_VISUAL_PRESET.guides.dark,
    contact: SCENE_VISUAL_PRESET.contactShadow.dark,
  },
  light: {
    background: SCENE_VISUAL_PRESET.backgrounds.light,
    guide: SCENE_VISUAL_PRESET.guides.light,
    contact: SCENE_VISUAL_PRESET.contactShadow.light,
  },
} as const;

/**
 * Crossfades the whole scene between daylight and blue hour.
 *
 * Underwater LEDs are invisible under a midday sun -- in a real pool exactly
 * as in this scene -- so the configurator drops to dusk while the customer is
 * on the lighting step and restores daylight on the way out. Driven off the
 * existing `focus` value, so no new state has to be plumbed through.
 *
 * Exposure, background, fog and the three scene lights are interpolated per
 * frame rather than switched, so the change reads as the sun going down and
 * not as a mode toggle.
 */
function SceneMood({
  dusk,
  baseBackground,
  baseExposure,
  baseEnvironment,
  coastalDaylight = false,
  sky,
  sun,
  auxiliary,
}: {
  dusk: boolean;
  baseBackground: string;
  baseExposure: number;
  baseEnvironment: number;
  coastalDaylight?: boolean;
  sky: React.RefObject<HemisphereLight | null>;
  sun: React.RefObject<DirectionalLight | null>;
  auxiliary: React.RefObject<SpotLight | null>;
}) {
  const blend = useRef(dusk ? 1 : 0);
  const dayColor = useMemo(() => new Color(baseBackground), [baseBackground]);
  const duskColor = useMemo(() => new Color(SCENE_VISUAL_PRESET.dusk.background), []);
  const scratch = useMemo(() => new Color(), []);
  const baseSky = useRef(0);
  const baseSun = useRef(0);
  const baseAux = useRef(0);

  useFrame(({ gl, scene }, delta) => {
    if (baseSky.current === 0 && sky.current) baseSky.current = sky.current.intensity;
    if (baseSun.current === 0 && sun.current) baseSun.current = sun.current.intensity;
    if (baseAux.current === 0 && auxiliary.current) baseAux.current = auxiliary.current.intensity;

    const target = dusk ? 1 : 0;
    const step = delta / SCENE_VISUAL_PRESET.dusk.transitionSeconds;
    blend.current =
      blend.current < target
        ? Math.min(target, blend.current + step)
        : Math.max(target, blend.current - step);
    const t = blend.current;
    const preset = SCENE_VISUAL_PRESET.dusk;

    gl.toneMappingExposure = MathUtils.lerp(baseExposure, preset.exposure, t);
    scene.environmentIntensity = MathUtils.lerp(baseEnvironment, preset.environment, t);
    scratch.copy(dayColor).lerp(duskColor, t);
    if (scene.background instanceof Color) scene.background.copy(scratch);
    if (scene.fog) scene.fog.color.copy(scratch);
    if (sky.current)
      sky.current.intensity = MathUtils.lerp(coastalDaylight ? COASTAL_DAYLIGHT.sky : baseSky.current, preset.skyIntensity, t);
    if (sun.current)
      sun.current.intensity = MathUtils.lerp(coastalDaylight ? COASTAL_DAYLIGHT.sun : baseSun.current, preset.sunIntensity, t);
    if (auxiliary.current) {
      auxiliary.current.intensity = MathUtils.lerp(baseAux.current, preset.auxiliaryIntensity, t);
    }
  });
  return null;
}

/** Answers `requestHeroCapture`: once the camera has settled, reads the
 * canvas right after R3F's next draw. The canvas is created with
 * `preserveDrawingBuffer: false`, so the read must happen in the same
 * animation frame as that draw: a rAF queued from inside `useFrame` runs
 * after R3F's own loop callback (which requested its next frame first). */
function HeroCaptureListener() {
  const gl = useThree((state) => state.gl);
  const settledSince = useRef<number | null>(null);
  useFrame((state) => {
    const pending = heroCaptureState.pending;
    // Wait for a settled frame with every texture (e.g. the coastal
    // panorama, loaded asynchronously) in place, not just the first idle one.
    if (!pending || !renderQualityState.idle || useProgress.getState().active) {
      settledSince.current = null;
      return;
    }
    const now = performance.now();
    settledSince.current ??= now;
    if (now - settledSince.current < HERO_SETTLE_MS) return;
    settledSince.current = null;
    heroCaptureState.pending = null;
    // Render the settled frame ourselves and read it back in the same task:
    // with preserveDrawingBuffer off, a later read can return an offscreen
    // pre-pass instead of the composed scene. A higher pixel ratio for this
    // one frame gives the Project Book a print-worthy cover.
    const previousRatio = gl.getPixelRatio();
    const height = gl.domElement.clientHeight || 1;
    try {
      gl.setPixelRatio(Math.min(3, Math.max(previousRatio, HERO_CAPTURE_HEIGHT / height)));
      gl.setRenderTarget(null);
      gl.render(state.scene, state.camera);
      pending(cropHero(gl.domElement));
    } catch (error) {
      console.error("[hero] canvas capture failed", error);
      pending(null);
    } finally {
      gl.setPixelRatio(previousRatio);
    }
  });
  return null;
}

const HERO_CAPTURE_HEIGHT = 1100;
const HERO_SETTLE_MS = 1500;
/** Project Book cover box (297 x 150 mm). */
const HERO_ASPECT = 297 / 150;

/** Centre crop to the cover aspect, so the PDF never letterboxes. */
function cropHero(source: HTMLCanvasElement): string {
  const { width, height } = source;
  const cropW = Math.min(width, Math.round(height * HERO_ASPECT));
  const cropH = Math.min(height, Math.round(cropW / HERO_ASPECT));
  const canvas = document.createElement("canvas");
  canvas.width = cropW;
  canvas.height = cropH;
  canvas
    .getContext("2d")
    ?.drawImage(
      source,
      (width - cropW) / 2,
      (height - cropH) / 2,
      cropW,
      cropH,
      0,
      0,
      cropW,
      cropH,
    );
  return canvas.toDataURL("image/jpeg", 0.9);
}

function DevelopmentRendererMetrics() {
  const gl = useThree((state) => state.gl);
  const elapsed = useRef(0);
  const frames = useRef(0);
  const inspectedPrograms = useRef(new Set<number>());
  const peakSamplers = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    frames.current += 1;
    if (elapsed.current < 2) return;
    const frameTime = (elapsed.current / frames.current) * 1000;
    const context = gl.getContext() as WebGL2RenderingContext;
    for (const program of gl.info.programs ?? []) {
      if (inspectedPrograms.current.has(program.id)) continue;
      inspectedPrograms.current.add(program.id);
      const samplers: string[] = [];
      const handle = program.program as WebGLProgram;
      const count = context.getProgramParameter(handle, context.ACTIVE_UNIFORMS) as number;
      for (let i = 0; i < count; i++) {
        const uniform = context.getActiveUniform(handle, i);
        if (uniform && (uniform.type === context.SAMPLER_2D || uniform.type === context.SAMPLER_CUBE || uniform.type === context.SAMPLER_2D_SHADOW))
          for (let n = 0; n < uniform.size; n++) samplers.push(`${uniform.name}:${n}`);
      }
      if (samplers.length > peakSamplers.current) {
        peakSamplers.current = samplers.length;
        console.debug("[Pool3D sampler budget]", JSON.stringify({ count: samplers.length, limit: gl.capabilities.maxTextures, samplers }));
      }
    }
    console.debug(
      "[Pool3D performance]",
      JSON.stringify({
        fps: Number((1000 / frameTime).toFixed(1)),
        frameTimeMs: Number(frameTime.toFixed(2)),
        calls: gl.info.render.calls,
        triangles: gl.info.render.triangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        dpr: gl.getPixelRatio(),
        viewport: [gl.domElement.clientWidth, gl.domElement.clientHeight],
        maxTextureUnits: gl.capabilities.maxTextures,
        peakProgramSamplers: peakSamplers.current,
        shadowMapSize: ACTIVE_RENDERING_QUALITY.shadowMapSize,
        qualityPreset: ACTIVE_RENDERING_QUALITY.id,
      }),
    );
    elapsed.current = 0;
    frames.current = 0;
  });
  return null;
}

/**
 * The stationary-quality half of the moving/idle split: once `CameraRig`
 * marks the camera settled (`renderQualityState.idle`), raise the
 * renderer's pixel ratio to the active quality tier's ceiling for real
 * supersampling -- sharper edges, less shimmer on thin geometry (grille
 * bars, coping joints) -- and drop it back to the tier's responsive floor
 * the instant movement resumes. `setDpr` is react-three-fiber's own API for
 * this (the same one its `dpr` array prop uses internally), so this never
 * fights the initial dpr clamp; it only ever runs on the moving/idle
 * transition edge, not every frame, so it costs nothing while settled.
 */
function AdaptiveQuality() {
  const setDpr = useThree((state) => state.setDpr);
  const wasIdle = useRef(false);

  useFrame(() => {
    if (renderQualityState.idle === wasIdle.current) return;
    wasIdle.current = renderQualityState.idle;
    setDpr(wasIdle.current ? ACTIVE_RENDERING_QUALITY.dpr[1] : ACTIVE_RENDERING_QUALITY.dpr[0]);
  });

  return null;
}

/** Smoothly restores a stable product view when dimensions or framing change. */
function PlanCamera({ enabled }: { enabled: boolean }) {
  const set = useThree(s => s.set);
  const get = useThree(s => s.get);
  const plan = useMemo(() => new OrthographicCamera(-10,10,10,-10,0.1,1000), []);
  useLayoutEffect(() => {
    if (!enabled) return;
    const previous = get().camera;
    (plan as OrthographicCamera & { manual: boolean }).manual = true;
    plan.up.set(0,0,-1);
    set({ camera: plan });
    return () => { set({ camera: previous }); };
  }, [enabled, get, set, plan]);
  return null;
}

function CameraRig({
  accessPlan,
  resolvedLayout,
  cameraLocked,
  radius,
  controls,
  frameToken,
  focus,
  shape,
  depth,
  outline,
  layout,
  skimmers,
  ledRow,
  includeExternalStaircase,
  photoMode,
  infinityZone,
}: {
  accessPlan: SceneLightingPlan["accessPlan"];
  resolvedLayout: ResolvedPoolLayout;
  cameraLocked: boolean;
  radius: number;
  controls: React.RefObject<OrbitControlsImpl | null>;
  frameToken: number;
  focus: SceneFocus;
  shape: PoolShapeId;
  depth: number;
  outline: Outline;
  layout: PoolVerticalLayout;
  skimmers: SkimmerPlan;
  ledRow: readonly PoolLightPosition[];
  includeExternalStaircase: boolean;
  photoMode: boolean;
  /** Geometry Pass D (Infinity): forwarded to `getCameraPose` for the
   * `"infinity"` intent. `null` on every pre-Infinity call is a no-op. */
  infinityZone: RectangleInfinityZone | null;
}) {
  const camera = useThree((state) => state.camera);
  const viewportSize = useThree((state) => state.size);
  const canvas = useThree((state) => state.gl.domElement);
  const goal = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  const startPosition = useRef(new Vector3());
  const startTarget = useRef(new Vector3());
  const elapsed = useRef(0);
  const duration = useRef(1.15);
  const flying = useRef(false);
  // Tracks live OrbitControls dragging (pan/rotate/zoom), separately from
  // `flying` above which tracks this component's own scripted camera
  // transitions -- the stationary-quality mode (see AdaptiveQuality and
  // useWaterReflection) needs to stay in "moving" mode for either.
  const interacting = useRef(false);
  const idleElapsed = useRef(0);
  const editingPose = useRef<{ key: string; pose: import("@/lib/pool/camera").CameraPose } | null>(null);
  const planFit = useRef<{ key: string; width: number; height: number; centre: readonly [number,number] } | null>(null);

  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const handleStart = () => {
      interacting.current = true;
      flying.current = false;
    };
    const handleEnd = () => {
      interacting.current = false;
    };
    control.addEventListener("start", handleStart);
    control.addEventListener("end", handleEnd);
    return () => {
      control.removeEventListener("start", handleStart);
      control.removeEventListener("end", handleEnd);
    };
  }, [controls, camera]);

  // Stationary-quality bookkeeping, independent of the flight-animation
  // useFrame below: runs every frame (not just mid-flight) so it can notice
  // once the camera has been still -- no scripted flight, no user drag, and
  // not Photo Mode's own separate progressive accumulation -- for
  // RENDER_QUALITY_IDLE_DELAY seconds, and flips back to "moving" the
  // instant either resumes.
  useFrame((_, delta) => {
    if (cameraLocked) {
      renderQualityState.idle = true;
      return;
    }
    const moving = flying.current || interacting.current || photoMode;
    if (moving) {
      idleElapsed.current = 0;
      if (renderQualityState.idle) renderQualityState.idle = false;
      return;
    }
    idleElapsed.current += delta;
    if (!renderQualityState.idle && idleElapsed.current >= RENDER_QUALITY_IDLE_DELAY) {
      renderQualityState.idle = true;
    }
  });

  const detail = ["access", "liner", "mosaic", "inox", "shelf", "hydromassage", "bench", "coping"].includes(focus);
  const summaryRect = detail ? canvas.closest("main")?.querySelector('[aria-label="Riepilogo configurazione"]')?.getBoundingClientRect() : null;
  const reservedRight = summaryRect?.width ? summaryRect.width + 48 : 0;
  let pose = contextualAccessCamera(focus, resolvedLayout, layout, outline, SCENE_VISUAL_PRESET.camera.fov, (viewportSize.width - reservedRight) / Math.max(1,viewportSize.height)) ?? (["infinity", "review", "overview"].includes(focus) && infinityZone
    ? coastalCamera(outline, infinityZone, layout.waterY, viewportSize.width / Math.max(1, viewportSize.height), SCENE_VISUAL_PRESET.camera.fov)
    : getCameraPose({
      accessPlan,
      intent: focus,
      outline,
      layout,
      depth,
      skimmers,
      ledRow,
      verticalFov: SCENE_VISUAL_PRESET.camera.fov,
      viewportAspect: (viewportSize.width - reservedRight) / Math.max(1, viewportSize.height),
      includeExternalStaircase,
      infinityZone,
    }));
  const editKey = `${focus}:${viewportSize.width}:${viewportSize.height}:${frameToken}`;
  if (focus === "depth") {
    if (editingPose.current?.key !== editKey) editingPose.current = { key: editKey, pose };
    pose = editingPose.current.pose;
  } else editingPose.current = null;
  if (focus === "top") {
    const next = dimensionFrustum(outline, viewportSize.width / Math.max(1, viewportSize.height));
    if (planFit.current?.key !== editKey) planFit.current = { key: editKey, ...next };
    // Keep world scale while editing; expand only when geometry would clip.
    const bounds = outlineBounds(outline);
    if (bounds.spanX + 2.2 > planFit.current.width || bounds.spanZ + 2.2 > planFit.current.height)
      planFit.current = { key: editKey, ...next };
    const [x,z] = planFit.current.centre;
    pose = { position: [x, layout.copingY + 30, z], target: [x, layout.copingY, z] };
  } else planFit.current = null;
  if (reservedRight) {
    const eye = new Vector3(...pose.position), target = new Vector3(...pose.target);
    const right = target.clone().sub(eye).cross(new Vector3(0, 1, 0)).normalize();
    const offset = eye.distanceTo(target) * Math.tan(SCENE_VISUAL_PRESET.camera.fov * Math.PI / 360) * reservedRight / viewportSize.height;
    right.multiplyScalar(offset);
    pose.position = eye.add(right).toArray() as [number, number, number];
    pose.target = target.add(right).toArray() as [number, number, number];
  }
  // Material changes can recreate plans without moving their geometry.
  // Only a different pose/intent or explicit reframe starts a new flight.
  const poseKey = JSON.stringify(pose);
  useLayoutEffect(() => {
    canvas.dataset["cameraProjection"] = camera instanceof OrthographicCamera ? "orthographic" : "perspective";
    canvas.dataset["cameraFocus"] = focus;
    if (camera instanceof OrthographicCamera && planFit.current) {
      const fit = planFit.current;
      camera.left = -fit.width/2; camera.right = fit.width/2;
      camera.top = fit.height/2; camera.bottom = -fit.height/2;
      camera.zoom = 1;
      camera.updateProjectionMatrix();
    }
    if ("fov" in camera) {
      camera.fov = "fov" in pose ? Number(pose.fov) : SCENE_VISUAL_PRESET.camera.fov;
      camera.updateProjectionMatrix();
    }
    goal.current.set(...pose.position);
    lookAt.current.set(...pose.target);
    startPosition.current.copy(camera.position);
    startTarget.current.copy(controls.current?.target ?? lookAt.current);
    // Drain any orbit inertia without changing the visible starting pose.
    const control = controls.current;
    renderQualityState.locked = cameraLocked;
    if (cameraLocked || infinityZone || focus === "top" || focus === "depth") {
      if (control) {
        const damping = control.enableDamping;
        control.enableDamping = false;
        control.update();
        control.target.copy(lookAt.current);
        control.enableDamping = damping;
      }
      camera.position.copy(goal.current);
      camera.lookAt(lookAt.current);
      camera.updateMatrixWorld(true);
      flying.current = false;
      renderQualityState.idle = true;
      return;
    }
    if (control && cameraLocked) {
      const damping = control.enableDamping;
      control.enableDamping = false;
      control.update();
      camera.position.copy(startPosition.current);
      control.target.copy(startTarget.current);
      control.update();
      control.enableDamping = damping;
    }
    elapsed.current = 0;
    // AUTO-012 / directive §53: honour prefers-reduced-motion by snapping to
    // the goal pose on the next frame instead of flying the camera there.
    // (styles.css's global reduced-motion rule only collapses CSS
    // animations/transitions -- it doesn't reach this Three.js-driven lerp.)
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const largeMove = startPosition.current.distanceTo(goal.current) > Math.max(2, radius * 0.65);
    duration.current = reducedMotion || largeMove ? 0 : 0.24;
    flying.current =
      startPosition.current.distanceToSquared(goal.current) > 1e-10 ||
      startTarget.current.distanceToSquared(lookAt.current) > 1e-10;
  }, [
    cameraLocked,
    Boolean(infinityZone),
    camera,
    controls,
    frameToken,
    focus,
    poseKey,
    planFit.current?.width,
    planFit.current?.height,
  ]);

  useFrame((_, delta) => {
    if (!flying.current) return;
    // Photo Mode needs a perfectly static camera to accumulate path-traced
    // samples correctly (see PhotoModeRenderer) -- freeze mid-flight rather
    // than let this animation keep moving the camera underneath it. The
    // pending flight resumes once Photo Mode is switched off.
    if (photoMode) return;
    elapsed.current = Math.min(duration.current, elapsed.current + Math.min(delta, 0.05));
    const progress = duration.current === 0 ? 1 : elapsed.current / duration.current;
    const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    camera.position.lerpVectors(startPosition.current, goal.current, eased);
    // A restrained vertical arc keeps the movement cinematic without changing
    // the final framing or introducing automotive-style camera theatrics.
    camera.position.y += Math.sin(progress * Math.PI) * Math.min(0.14, radius * 0.012);
    const control = controls.current;
    if (control) {
      control.target.lerpVectors(startTarget.current, lookAt.current, eased);
      control.update();
    }
    if (progress >= 1) {
      camera.position.copy(goal.current);
      if (control) {
        control.target.copy(lookAt.current);
        control.update();
      }
      flying.current = false;
    }
  });

  return null;
}

/** Neutral showroom floor with a real opening for the basin. */
function StudioFloor({
  outline,
  size,
  theme,
  poolType,
  system,
  overflowType,
  infinityZone,
  waterY,
}: {
  outline: Outline;
  size: number;
  theme: Theme;
  poolType: PoolType;
  system: SystemType;
  overflowType: OverflowType;
  waterY: number;
  /** Geometry Pass D (Infinity): the selected Rectangle side's zone, so the
   * deck's own cutout can widen on that one side to clear the catch basin.
   * `null` (every pre-Infinity call, and Infinity with no side chosen yet)
   * keeps the plain uniform-offset cutout, byte-identical to before. */
  infinityZone?: RectangleInfinityZone | null;
}) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const premiumInfinity = poolType === "in-ground" && system === "infinity" && !!infinityZone;
  const photographicCoast = premiumInfinity;
  const pavingGeometry = useMemo(
    () =>
      premiumInfinity && infinityZone
        ? createInfinityDeck(outline, infinityZone, copingOuterOffset(system, overflowType))
        : null,
    [premiumInfinity, infinityZone, outline, system, overflowType],
  );
  useEffect(() => () => pavingGeometry?.dispose(), [pavingGeometry]);
  const geometry = useMemo(() => {
    if (premiumInfinity && infinityZone) {
      const landscape = createInfinityLandscape(
        outline,
        infinityZone,
        size,
        copingOuterOffset(system, overflowType),
      );
      // Extend only the distant landscape: retain near-pool tessellation and
      // topology, without a dense 400 m terrain or a visible showroom edge.
      const bounds = outlineBounds(outline);
      const p = landscape.getAttribute("position");
      const uv = landscape.getAttribute("uv");
      const near = Math.max(bounds.spanX, bounds.spanZ) / 2 + 12;
      for (let i = 0; i < p.count; i++) {
        const extend = (v: number) => {
          const beyond = Math.max(0, Math.abs(v) - near);
          // Continuous first derivative avoids a hard normal crease where
          // the near terrain starts stretching toward the distant horizon.
          return Math.sign(v) * (Math.abs(v) + 80 * beyond * beyond / (beyond + 4));
        };
        p.setX(i, extend(p.getX(i)));
        p.setZ(i, extend(p.getZ(i)));
        // Broad distant relief only: the surveyed near-pool grade and deck
        // junctions remain byte-identical. No extra terrain meshes/textures.
        const distance = Math.hypot(p.getX(i), p.getZ(i));
        const relief = MathUtils.smoothstep(distance, near + 8, near + 55);
        // Evaluate the grade at its final position, not the pre-stretch
        // coordinates (which dragged near slopes across hundreds of metres).
        // A gentle distant fall avoids undersampled sinusoidal ridge teeth.
        p.setY(i, infinityGroundHeight(outline, infinityZone, p.getX(i), p.getZ(i)) - relief * distance * 0.006);
        uv.setXY(i, p.getX(i), p.getZ(i));
      }
      coastalGrade(landscape, infinityZone);
      // Only the immediate site stays geometric; the photographic coast owns
      // the far field. Retain a full triangle apron around the fade boundary.
      const index=landscape.getIndex(), kept:number[]=[];
      if(index && photographicCoast) {
        for(let i=0;i<index.count;i+=3) {
          const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)];
          if(ids.some(id=>p.getX(id)>bounds.minX-7 && p.getX(id)<bounds.maxX+7 && p.getZ(id)>bounds.minZ-7 && p.getZ(id)<bounds.maxZ+7)) kept.push(...ids);
        }
        landscape.setIndex(kept);
      }
      landscape.computeVertexNormals();
      landscape.computeBoundingSphere();
      return landscape;
    }
    const half = size / 2;
    const outer: Outline = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ];
    const baseOffset = copingOuterOffset(system, overflowType);
    const inner =
      poolType === "in-ground"
        ? buildDeckCutoutOutline(
            outline,
            baseOffset,
            system === "infinity" ? (infinityZone ?? null) : null,
          )
        : undefined;
    return createSurfaceGeometry(outer, inner);
  }, [outline, size, poolType, system, overflowType, infinityZone, premiumInfinity, photographicCoast]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const stone = useMemo(() => premiumInfinity ? createLimestoneMaps() : createTravertineMaps(), [premiumInfinity]);
  useEffect(() => {
    const textures = Object.values(stone).filter((texture) => texture !== null);
    for (const texture of textures) {
      texture.repeat.set(2.5, 2.5);
      texture.anisotropy = Math.min(8, maxAnisotropy);
      texture.needsUpdate = true;
    }
    return () => textures.forEach((texture) => texture.dispose());
  }, [stone, maxAnisotropy]);

  return (
    <group>
      {pavingGeometry ? (
        <mesh
          name="infinity-level-limestone-deck"
          geometry={pavingGeometry}
          receiveShadow
          castShadow
        >
          <meshStandardMaterial
            side={DoubleSide}
            color="#f0eade"
            map={stone.colorMap}
            normalMap={stone.normalMap}
            normalScale={[0.3, 0.3]}
            roughnessMap={stone.roughnessMap}
            roughness={0.72}
            metalness={0}
            onBeforeCompile={(shader) => {
              excludeSubmergedDirectLights(shader, waterY);
              shader.fragmentShader = shader.fragmentShader.replace(
                "#include <map_fragment>",
                `
              #include <map_fragment>
              vec2 slabs = vMapUv / vec2(3.0, 1.5);
              vec2 edge = min(fract(slabs), 1.0 - fract(slabs));
              vec2 joint = smoothstep(vec2(0.0015), vec2(0.0015) + fwidth(slabs), edge);
              float variation = fract(sin(dot(floor(slabs), vec2(127.1,311.7))) * 43758.5453);
              diffuseColor.rgb *= mix(0.8, 0.98 + variation * 0.025, min(joint.x, joint.y));
            `,
              );
            }}
            customProgramCacheKey={() => `level-limestone-120x60-v3-${waterY}`}
          />
        </mesh>
      ) : null}
      <mesh name="pool-studio-deck" geometry={geometry} position={[0, -0.002, 0]} receiveShadow>
        <meshStandardMaterial
          key={
            premiumInfinity
              ? `coastal-photo-near-${theme}`
              : "studio"
          }
          color={
            premiumInfinity
              ? theme === "dark"
                ? "#7a7b75"
                : "#ffffff"
              : theme === "dark"
                ? "#151617"
                : "#d8d6d1"
          }
          vertexColors={false}
          transparent={photographicCoast}
          depthWrite={!photographicCoast}
          map={premiumInfinity ? null : stone.colorMap}
          roughness={0.86}
          normalMap={premiumInfinity ? null : stone.normalMap}
          normalScale={premiumInfinity ? [0, 0] : [0.28, 0.28]}
          roughnessMap={premiumInfinity ? null : stone.roughnessMap}
          metalness={0}
          onBeforeCompile={(shader) => {
            if (premiumInfinity) {
              excludeSubmergedDirectLights(shader, waterY);
              const bounds = outlineBounds(outline);
              shader.uniforms["deckMin"] = { value: new Vector2(bounds.minX,bounds.minZ) };
              shader.uniforms["deckMax"] = { value: new Vector2(bounds.maxX,bounds.maxZ) };
              shader.vertexShader =
                "varying float vGrade; varying vec2 vGroundPlan;\n" + shader.vertexShader;
              shader.vertexShader = shader.vertexShader.replace(
                "#include <begin_vertex>",
                "#include <begin_vertex>\n vGrade = position.y; vGroundPlan = position.xz;",
              );
              shader.fragmentShader =
                `varying float vGrade; varying vec2 vGroundPlan; uniform vec2 deckMin; uniform vec2 deckMax;
                float meadowHash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
                float meadowNoise(vec2 p) {
                  vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
                  return mix(mix(meadowHash(i), meadowHash(i + vec2(1,0)), f.x), mix(meadowHash(i + vec2(0,1)), meadowHash(i + vec2(1)), f.x), f.y);
                }\n` +
                shader.fragmentShader;
              shader.fragmentShader = shader.fragmentShader.replace("#include <color_fragment>", `
                #include <color_fragment>
                vec2 outside = max(max(deckMin-vGroundPlan,vGroundPlan-deckMax),vec2(0.0));
                ${photographicCoast ? "if(length(outside)>6.0) discard;" : ""}
                float broad = 0.65 * meadowNoise(vGroundPlan * 0.23) + 0.35 * meadowNoise(vGroundPlan * 0.71);
                float detail = meadowNoise(vGroundPlan * 32.0);
                float nearDetail = 1.0 - smoothstep(0.015, 0.1, max(fwidth(vGroundPlan.x), fwidth(vGroundPlan.y)));
                ${photographicCoast ? `
                  vec3 coastGround = mix(vec3(0.17,0.155,0.12),vec3(0.28,0.26,0.21),broad);
                  diffuseColor.rgb *= coastGround * (1.0 + (detail - 0.5) * 0.4 * nearDetail);
                  diffuseColor.a *= 1.0-smoothstep(3.2,6.0,length(outside));
                ` : `
                  vec3 grass = mix(vec3(0.085,0.12,0.057),vec3(0.14,0.17,0.09),broad);
                  diffuseColor.rgb *= grass * (1.0 + (detail - 0.5) * 0.65 * nearDetail);
                `}
              `);
              return;
            }
            const bounds = outlineBounds(outline);
            shader.uniforms["deckMin"] = { value: new Vector2(bounds.minX, bounds.minZ) };
            shader.uniforms["deckMax"] = { value: new Vector2(bounds.maxX, bounds.maxZ) };
            shader.fragmentShader = shader.fragmentShader.replace(
              "#include <map_fragment>",
              `
            #include <map_fragment>
            vec2 slabCoord = vMapUv / ${premiumInfinity ? "vec2(3.0, 1.5)" : "3.0"};
            vec2 toJoint = min(fract(slabCoord), 1.0 - fract(slabCoord));
            vec2 aa = fwidth(slabCoord);
            vec2 grout = smoothstep(vec2(0.001), vec2(0.001) + aa, toJoint);
            float slabSeed = fract(sin(dot(floor(slabCoord), vec2(127.1, 311.7))) * 43758.5453);
            ${
              premiumInfinity
                ? `
              vec2 outsideDeck = max(max(deckMin - vGroundPlan, vGroundPlan - deckMax), 0.0);
              float paving = 0.0;
              float groundVariation = 0.65 * meadowNoise(vGroundPlan * 0.14) + 0.35 * meadowNoise(vGroundPlan * 0.53);
              float grain = fract(sin(dot(floor(vGroundPlan * 95.0), vec2(12.9898, 78.233))) * 43758.5453);
              float grainVisibility = 1.0 - smoothstep(0.01, 0.05, max(fwidth(vGroundPlan.x), fwidth(vGroundPlan.y)));
              vec3 meadow = mix(vec3(0.09, 0.15, 0.045), vec3(0.18, 0.23, 0.085), groundVariation) * (1.0 + (grain - 0.5) * 0.35 * grainVisibility);
              diffuseColor.rgb = mix(meadow, diffuseColor.rgb, paving);
              diffuseColor.rgb *= mix(1.0, mix(0.78, 0.98 + slabSeed * 0.02, min(grout.x, grout.y)), paving);
            `
                : "diffuseColor.rgb *= mix(0.73, 0.97 + slabSeed * 0.045, min(grout.x, grout.y));"
            }
          `,
            );
          }}
          customProgramCacheKey={() =>
            premiumInfinity ? `coastal-photo-near-v3-${theme}-${waterY}` : "architectural-stone-paving-v1"
          }
        />
      </mesh>
    </group>
  );
}

export default function PoolScene({
  outline,
  shape,
  system,
  overflowType,
  poolType,
  materials,
  construction,
  features,
  ledColor = "#ffffff",
  ledIntensity,
  internalStairType,
  hydromassageVariant,
  poolAccess,
  skimmers,
  coverPlan,
  solarShower = false,
  technicalView,
  infinityEdge,
  onSelectInfinitySide,
  length,
  width,
  depth,
  floorProfile: floorProfileSetting = "flat",
  shallowDepth,
  slopeReversed = false,
  showMeasurements,
  frameToken,
  focus,
  cameraLocked,
  showWater,
  theme,
  sceneTime,
  paving,
  photoMode,
  photoModeQuality,
  onPhotoModeUnsupported,
}: SceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const radius = Math.hypot(length, width) / 2;
  const visualTheme: Theme =
    sceneTime === "night" ? "dark" : "light";
  const palette = PALETTE[visualTheme];
  const copingThickness = POOL_BORDER_PRESET.thickness;
  // The lighting step drops the scene to blue hour so the LEDs are visible.
  const dusk = sceneTime === "night";
  const skyLight = useRef<HemisphereLight | null>(null);
  const sunLight = useRef<DirectionalLight | null>(null);
  const auxiliaryLight = useRef<SpotLight | null>(null);

  // Pool geometry and the sun are static between configuration commits.
  // Orbit/ripples do not change their shadow silhouette. Invalidate after
  // each React commit (including dimensions/access/system changes), rather
  // than rebuilding the same 4K shadow map every animation frame.
  useLayoutEffect(() => {
    if (sunLight.current) sunLight.current.shadow.needsUpdate = true;
  });

  const verticalLayout = useMemo(
    () => getPoolVerticalLayout({ poolType, system, overflowType, depth, copingThickness }),
    [poolType, system, overflowType, depth, copingThickness],
  );

  // Single source of truth for every floor elevation -- rendering, stairs,
  // lighting and measurements all read the same model (see floor-profile.ts).
  const floorProfile: FloorProfileModel = useMemo(
    () =>
      buildFloorProfile({
        outline,
        shape,
        poolType,
        dimensions: {
          length,
          width,
          depth,
          cornerRadius: 0,
          floorProfile: floorProfileSetting,
          ...(shallowDepth !== undefined ? { shallowDepth } : {}),
          ...(slopeReversed !== undefined ? { slopeReversed } : {}),
        },
        verticalLayout,
        sunShelf: features.includes("sunShelf") || features.includes("hydromassage"),
        infinityEdge: system === "infinity" ? infinityEdge : null,
      }),
    [
      outline,
      shape,
      poolType,
      length,
      width,
      depth,
      floorProfileSetting,
      shallowDepth,
      slopeReversed,
      verticalLayout,
      features,
      system,
      infinityEdge,
    ],
  );

  // Geometry Pass D (Infinity): a plain axis/coordinate pair, not re-derived
  // per consumer -- the single source of truth for which side to keep every
  // skimmer/ladder/LED placement off is `infinity-edge.ts`'s own zone
  // lookup, always run through `clampInfinityEdgeParams` first the same way
  // `project.ts` normalises it, so malformed/legacy data can never produce a
  // bogus exclusion.
  const normalisedInfinityEdge = useMemo(
    () => (system === "infinity" ? clampInfinityEdgeParams(infinityEdge) : null),
    [system, infinityEdge],
  );
  const infinityExcluded = useMemo(
    () =>
      normalisedInfinityEdge ? infinityExclusion(outline, normalisedInfinityEdge, shape) : null,
    [outline, normalisedInfinityEdge, shape],
  );
  // Camera-only: the selected side's zone, for the "infinity" pose. `null`
  // (Infinity off, no side chosen yet, or an outline that currently has no
  // valid candidate zone for that side) makes `getCameraPose` fall back to
  // the plain overview rather than a bogus/degenerate framing.
  const infinityZone: RectangleInfinityZone | null = useMemo(() => {
    if (!normalisedInfinityEdge || normalisedInfinityEdge.side === null) return null;
    const zones = infinityZonesForOutline(outline, shape);
    return zones.find((zone) => zone.side === normalisedInfinityEdge.side) ?? null;
  }, [outline, shape, normalisedInfinityEdge]);

  // Infinity's coastal stage exists only once its side is chosen: before
  // that the pool sits in the same studio context as every other system,
  // never a vast empty tiled plane with a stray panorama.
  const infinityStage = system === "infinity" && !!infinityZone;
  const background = infinityStage
    ? sceneTime === "night"
      ? "#101b28"
      : "#cee0ec"
    : palette.background;

  // Computed once here so the luminaires and the camera that frames them are
  // driven by the same row.
  const resolvedLayout = useMemo(
    () =>
      resolvePoolLayout({
        shape,
        poolType,
        features,
        hydromassageVariant,
        system,
        overflowType,
        outline,
        layout: verticalLayout,
        skimmers: system === "skimmer" ? skimmers : { ...skimmers, positions: [] },
        access: poolAccess,
        stairType: internalStairType,
        floorProfile,
        infinityExcluded,
      }),
    [
      outline,
      verticalLayout,
      skimmers,
      shape,
      poolType,
      features,
      hydromassageVariant,
      system,
      poolAccess,
      internalStairType,
      floorProfile,
      infinityExcluded,
      overflowType,
    ],
  );

  const deckSize = useMemo(() => Math.max(40, radius * 14), [radius]);
  const lighting = resolvedLayout.lighting;
  // Deck positions the furniture must keep clear of: the inox ladder (deck
  // anchored), the access placement itself and, above ground, both ends of
  // the external staircase.
  const externalStairs = poolType === "above-ground" && features.includes("externalStaircase");
  const deckObstacles = useMemo(() => {
    const points: { x: number; z: number }[] = [
      resolvedLayout.ladder?.plan.placement,
      lighting.accessPlan.placement,
    ].filter((p): p is { x: number; z: number; rotation: number } => !!p);
    if (externalStairs) {
      const stairs = planExternalStaircase({
        outline,
        copingOffset: copingOuterOffset(system, overflowType),
        infinityExcluded,
        groundY: verticalLayout.groundY,
        topY: system === "overflow" ? verticalLayout.waterY - 0.001 : verticalLayout.copingY,
      });
      if (stairs) {
        const run = stairs.stepCount * stairs.treadDepth;
        points.push(
          { x: stairs.x, z: stairs.z },
          {
            x: stairs.x + Math.sin(stairs.rotation) * run,
            z: stairs.z + Math.cos(stairs.rotation) * run,
          },
        );
      }
    }
    return points;
  }, [
    resolvedLayout.ladder,
    lighting.accessPlan,
    externalStairs,
    outline,
    system,
    overflowType,
    infinityExcluded,
    verticalLayout,
  ]);
  // The automatic-cover roller sits on the deck at one short end.
  const coverHousing = useMemo(
    () =>
      coverPlan.geometry
        ? {
            x: coverPlan.geometry.housingX,
            z: (coverPlan.geometry.footprint.minZ + coverPlan.geometry.footprint.maxZ) / 2,
            halfSpan:
              (coverPlan.geometry.footprint.maxZ - coverPlan.geometry.footprint.minZ) / 2 + 0.15,
          }
        : null,
    [coverPlan.geometry],
  );
  const sceneBounds = useMemo(() => outlineBounds(outline), [outline]);
  const shadowExtent =
    Math.max(sceneBounds.spanX, sceneBounds.spanZ) / 2 +
    SCENE_VISUAL_PRESET.lighting.sun.frustumMargin;
  const outlineSignature = useMemo(
    () => outline.map(([x, z]) => `${x.toFixed(4)},${z.toFixed(4)}`).join(";"),
    [outline],
  );
  const sunPosition: [number, number, number] = system === "infinity" && infinityZone
    ? coastalPhotoSun(infinityZone,radius*4+25)
    : [radius * 2 + 6, radius * 2.4 + 12, radius + 6];
  // Remount PhotoModeRenderer (fresh WebGLPathTracer + setScene) whenever the
  // traced geometry or materials could have changed -- setScene is the
  // documented "relatively expensive" call, so a clean re-init on real scene
  // changes is simpler and safer than trying to patch the tracer in place.
  const photoModeSceneKey = [
    outlineSignature,
    normalisedInfinityEdge?.enabled,
    normalisedInfinityEdge?.side,
    internalStairType,
    floorProfileSetting,
    shallowDepth,
    slopeReversed,
    system,
    overflowType,
    poolType,
    depth,
    showWater,
    construction?.stage,
    construction?.structure,
    materials.surface.textureUrl,
    materials.coping.color,
    materials.skimmer.color,
    materials.skimmer.type,
    visualTheme,
    sceneTime,
    features.join(","),
    hydromassageVariant,
    ledColor,
    ledIntensity,
    poolAccess,
    photoModeQuality,
  ].join("|");

  return (
    <Canvas
      // PCFSoftShadowMap is deprecated in three.js: WebGLShadowMap silently
      // reassigns it to PCFShadowMap on the very first render anyway (same
      // algorithm, only the enum name changed), so setting it explicitly
      // here is a zero-behaviour-change fix for the console warning, not a
      // visual change.
      shadows={{ type: PCFShadowMap }}
      dpr={cameraLocked ? ACTIVE_RENDERING_QUALITY.dpr[1] : ACTIVE_RENDERING_QUALITY.dpr}
      gl={{
        antialias: ACTIVE_RENDERING_QUALITY.antialias,
        // Retaining every WebGL back buffer causes sustained GPU-memory growth
        // in WebKit. Screenshots are not part of the current workflow, so the
        // renderer can safely release each frame after presentation.
        preserveDrawingBuffer: false,
        // Apply AgX exactly once, with no bloom/contrast pass. If a quality
        // preset opts into a composer again, its output owns tone mapping.
        toneMapping: ACTIVE_RENDERING_QUALITY.postProcessing.enabled
          ? NoToneMapping
          : AgXToneMapping,
        toneMappingExposure: SCENE_VISUAL_PRESET.exposure[visualTheme],
      }}
      onCreated={({ gl }) => {
        gl.outputColorSpace = SRGBColorSpace;
      }}
      camera={{
        fov: SCENE_VISUAL_PRESET.camera.fov,
        near: SCENE_VISUAL_PRESET.camera.near,
        far: SCENE_VISUAL_PRESET.camera.far,
        position: [12, 9, 14],
      }}
    >
      <color attach="background" args={[background]} />
      {system !== "infinity" ? <fog
        attach="fog"
        args={[
          background,
          radius * 6,
          radius * 20,
        ]}
      /> : null}

      {/* Real scene geometry standing in for a local HDRI: gives the planar
          water reflector (and the main view) a photographic sky gradient
          and sun glow to mirror, instead of a flat fill colour. Excluded in
          Photo Mode: it's a custom ShaderMaterial, which the path tracer
          cannot read anyway, and PhotoModeRenderer supplies its own
          equirectangular gradient environment instead. */}
      {!photoMode ? <DaylightEnvironment theme={visualTheme} timeOfDay={sceneTime} sunDirection={sunPosition} outdoor={infinityStage} coastalRotation={infinityZone ? coastalPhotoRotation(infinityZone) : 0} /> : null}

      <SceneMood
        dusk={dusk}
        baseBackground={background}
        baseExposure={SCENE_VISUAL_PRESET.exposure[visualTheme]}
        baseEnvironment={system === "infinity" ? COASTAL_DAYLIGHT.environment : SCENE_VISUAL_PRESET.environment[visualTheme]}
        coastalDaylight={system === "infinity"}
        sky={skyLight}
        sun={sunLight}
        auxiliary={auxiliaryLight}
      />

      <hemisphereLight
        ref={skyLight}
        intensity={SCENE_VISUAL_PRESET.lighting.sky.intensity[visualTheme]}
        color={SCENE_VISUAL_PRESET.lighting.sky.color}
        groundColor={SCENE_VISUAL_PRESET.lighting.sky.groundColor[visualTheme]}
      />
      <directionalLight
        ref={sunLight}
        position={sunPosition}
        intensity={SCENE_VISUAL_PRESET.lighting.sun.intensity[visualTheme]}
        color={SCENE_VISUAL_PRESET.lighting.sun.color}
        castShadow
        shadow-autoUpdate={false}
        // Canvas mounts asynchronously: the parent's layout effect can run
        // before this light exists. Allocate its cached shadow on first draw.
        shadow-needsUpdate
        shadow-bias={SCENE_VISUAL_PRESET.lighting.sun.bias}
        shadow-normalBias={SCENE_VISUAL_PRESET.lighting.sun.normalBias}
        shadow-mapSize={[
          ACTIVE_RENDERING_QUALITY.shadowMapSize,
          ACTIVE_RENDERING_QUALITY.shadowMapSize,
        ]}
        shadow-radius={SCENE_VISUAL_PRESET.lighting.sun.radius}
        shadow-camera-left={-shadowExtent}
        shadow-camera-right={shadowExtent}
        shadow-camera-top={shadowExtent}
        shadow-camera-bottom={-shadowExtent}
        shadow-camera-near={0.5}
        shadow-camera-far={Math.max(36, radius * 7)}
      />
      <spotLight
        ref={auxiliaryLight}
        position={[-radius * 1.4, radius * 1.6 + 5, -radius * 0.8]}
        intensity={SCENE_VISUAL_PRESET.lighting.auxiliary.intensity[visualTheme]}
        angle={0.65}
        penumbra={0.9}
        decay={2}
        distance={radius * 8}
        color={SCENE_VISUAL_PRESET.lighting.auxiliary.color[visualTheme]}
      />
      {infinityStage ? (
        <StudioFloor
          outline={outline}
          size={deckSize}
          theme={visualTheme}
          poolType={poolType}
          system={system}
          overflowType={overflowType}
          infinityZone={infinityZone}
          waterY={verticalLayout.waterY}
        />
      ) : (
        <Suspense fallback={null}>
          <StudioPaving
            outline={outline}
            poolType={poolType}
            system={system}
            overflowType={overflowType}
            paving={paving ?? "gres"}
            environment={construction?.showEnvironment ?? true}
            decking={construction?.showDecking ?? true}
            waterY={verticalLayout.waterY}
          />
        </Suspense>
      )}
      {/* Presentation furniture on the studio deck: hidden in the raw
          construction stages and never part of the configuration. */}
      {system !== "infinity" && (construction?.showEnvironment ?? true) ? (
        <DeckLoungers
          outline={outline}
          innerOffset={studioDeckInnerOffset(poolType, system, overflowType)}
          band={studioDeckBand(outline, true)}
          waterY={verticalLayout.waterY}
          avoid={deckObstacles}
          shower={solarShower}
          coverHousing={coverHousing}
        />
      ) : null}

      <PoolModel
        resolvedLayout={resolvedLayout}
        features={features}
        poolAccess={poolAccess}
        internalStairType={internalStairType}
        skimmers={skimmers}
        shape={shape}
        outline={outline}
        depth={depth}
        floorProfile={floorProfile}
        materials={materials}
        system={system}
        overflowType={overflowType}
        poolType={poolType}
        copingThickness={copingThickness}
        showWater={showWater}
        rawStructure={construction?.raw ? construction.structure ?? "REINFORCED_CONCRETE" : null}
        structureFamily={construction?.structure ?? null}
        showAccessories={construction?.showAccessories ?? true}
        night={dusk}
        {...(normalisedInfinityEdge ? { infinityEdge: normalisedInfinityEdge } : {})}
        infinityExcluded={infinityExcluded}
      />
      {coverPlan.geometry && !photoMode && (construction?.showWater ?? true) ? <AutomaticCover plan={coverPlan} /> : null}
      {technicalView && !photoMode && system === "skimmer" ? skimmers.positions.map((point, index) => (
        <mesh key={`technical-skimmer-${index}`} name="technical-skimmer-marker" position={[point.x, verticalLayout.waterY + 0.075, point.z]}>
          <sphereGeometry args={[0.055, 10, 8]} />
          <meshBasicMaterial color="#d9ba77" />
        </mesh>
      )) : null}
      {technicalView && !photoMode && infinityZone ? <Line
        name="technical-infinity-edge"
        points={infinityZone.points.map(([x, z]) => [x, verticalLayout.waterY + 0.035, z])}
        color="#d9ba77" lineWidth={2}
      /> : null}
      {technicalView && !photoMode && system === "overflow" ? <Line
        name="technical-overflow-perimeter"
        points={[...outline, outline[0]!].map(([x, z]) => [x, verticalLayout.waterY + 0.035, z])}
        color="#d9ba77" lineWidth={2}
      /> : null}

      {system === "infinity" && !photoMode && onSelectInfinitySide ? (
        <InfinityEdgePicker
          outline={outline}
          shape={shape}
          selectedSide={normalisedInfinityEdge?.side ?? null}
          y={verticalLayout.copingY + 0.035}
          onSelect={onSelectInfinitySide}
        />
      ) : null}
      {features.includes("ledLighting") && (construction?.showLighting ?? true) ? (
        <PoolLights
          lighting={lighting}
          layout={verticalLayout}
          floorProfile={floorProfile}
          showWater={showWater}
          ledColor={ledColor}
          ledIntensity={ledIntensity}
          presentation={dusk ? "night" : "day"}
        />
      ) : null}

      {poolType === "above-ground" && features.includes("externalStaircase") && (construction?.showAccessories ?? true) ? (
        <ExternalStaircase
          outline={outline}
          copingOffset={copingOuterOffset(system, overflowType)}
          infinityExcluded={infinityExcluded}
          groundY={verticalLayout.groundY}
          topY={system === "overflow" ? verticalLayout.waterY - 0.001 : verticalLayout.copingY}
        />
      ) : null}

      {system === "skimmer" && (construction?.showSystemComponents ?? true) ? (
        <Skimmers
          showWater={showWater}
          plan={skimmers}
          copingThickness={copingThickness}
          wallTopY={verticalLayout.wallTopY}
          color={materials.skimmer.color}
          roughness={materials.skimmer.roughness}
          metalness={materials.skimmer.metalness}
          variant={materials.skimmer.type}
          poolType={poolType}
        />
      ) : null}

      {/* Dimension guide lines: drei's <Line> is built on LineSegmentsGeometry,
          which uses an instanced/interleaved buffer under the hood -- one of
          the two geometry kinds the path tracer explicitly does not support.
          They are an editing overlay anyway, not part of a "photo". */}
      {showMeasurements && !photoMode ? (
        <PoolMeasurements
          outline={outline}
          length={length}
          width={width}
          depth={depth}
          floorY={verticalLayout.floorY}
          wallTopY={verticalLayout.wallTopY}
          color={palette.guide}
          shallowDepth={
            floorProfile.sloped ? verticalLayout.groundY - floorProfile.shallowFloorY : undefined
          }
        />
      ) : null}

      {ACTIVE_RENDERING_QUALITY.contactShadows.enabled && system !== "infinity" ? (
        <ContactShadows
          name="pool-contact-shadows"
          key={`${shape}-${length}-${width}-${depth}-${system}-${overflowType}-${poolType}-${outlineSignature}-${solarShower}-${features.join(",")}-${Boolean(coverPlan.geometry)}`}
          position={[
            0,
            // In-ground: just above the paving (y = 0), the surface that
            // actually receives it. It used to sit at -0.295, under the
            // opaque deck, where it could never be seen. Over the open basin
            // nothing casts, so the plane stays transparent there.
            poolType === "above-ground" ? verticalLayout.groundY + 0.002 : 0.004,
            0,
          ]}
          opacity={palette.contact}
          scale={radius * 9}
          blur={SCENE_VISUAL_PRESET.contactShadow.blur}
          far={14}
          resolution={ACTIVE_RENDERING_QUALITY.contactShadows.resolution}
          // The studio and pool transform are static; bake the contact shadow
          // once instead of allocating a 1024px shadow render target every frame.
          frames={ACTIVE_RENDERING_QUALITY.contactShadows.frames}
        />
      ) : null}

      {import.meta.env.DEV ? <DevelopmentRendererMetrics /> : null}
      {!photoMode ? <HeroCaptureListener /> : null}
      {!photoMode && !cameraLocked ? <AdaptiveQuality /> : null}

      <PlanCamera enabled={focus === "top"} />
      <OrbitControls
        ref={controls}
        makeDefault
        // Path-traced accumulation needs a perfectly static camera (see
        // PhotoModeRenderer): drei's OrbitControls only calls its own
        // .update() -- the call that applies damping's residual rotation --
        // while `enabled` is true, so disabling it here doesn't just ignore
        // new drag input, it stops the camera from drifting at all while
        // explicit Photo Mode or a locked presentation view is active.
        enabled={!photoMode && !cameraLocked}
        enablePan
        enableZoom
        enableRotate={focus !== "top"}
        enableDamping={!cameraLocked && !photoMode}
        dampingFactor={0.06}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        panSpeed={0.6}
        minDistance={2}
        maxDistance={160}
        minPolarAngle={focus === "top" ? Math.PI / 2 : 0}
        maxPolarAngle={focus === "top" ? Math.PI / 2 : Math.PI / 2.05}
      />
      <CameraRig
        accessPlan={lighting.accessPlan}
        resolvedLayout={resolvedLayout}
        cameraLocked={cameraLocked}
        radius={radius}
        controls={controls}
        frameToken={frameToken}
        focus={construction?.raw && (focus === "overview" || focus === "review") ? "structure" : infinityZone && focus === "overview" ? "infinity" : focus}
        shape={shape}
        depth={depth}
        outline={outline}
        layout={verticalLayout}
        skimmers={skimmers}
        ledRow={lighting.plan.positions}
        photoMode={photoMode}
        infinityZone={infinityZone}
        // The exterior/staircase framing must never hijack the Step 05
        // Pool System camera -- that step's premium front view (both
        // skimmers, centred, from inside looking out) always wins.
        includeExternalStaircase={false}
      />

      {/* Premium post pass -- only ever mounts (and only ever fetches its
          chunk) when the active quality tier opts in (Experience);
          Configuration keeps today's exact output and bundle untouched.
          Skipped in Photo Mode: EffectComposer takes over the render loop
          with its own render-priority mechanism, which would fight with
          PhotoModeRenderer's for who owns the final canvas draw. */}
      {ACTIVE_RENDERING_QUALITY.postProcessing.enabled && !photoMode ? (
        <Suspense fallback={null}>
          <PremiumPostFX />
        </Suspense>
      ) : null}

      {/* Normal configuration is raster-only. Tracing is loaded and mounted
          exclusively in response to the user's explicit Photo Mode toggle. */}
      {photoMode ? (
        <Suspense fallback={null}>
          <PhotoModeRenderer
            key={photoModeSceneKey}
            theme={theme}
            quality={photoModeQuality}
            onUnsupported={onPhotoModeUnsupported}
          />
        </Suspense>
      ) : null}
    </Canvas>
  );
}
