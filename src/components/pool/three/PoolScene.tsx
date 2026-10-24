import { lazy, Suspense, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ShaderPreparation } from "./ShaderPreparation";
import { installDevelopmentInteractionTiming } from "@/lib/pool/development-interaction-timing";
import { installDevelopmentGlDiagnostic } from "@/lib/pool/development-gl-diagnostic";
import { OrbitControls, Line, useProgress } from "@react-three/drei";
import { OwnedContactShadows as ContactShadows } from "./OwnedContactShadows";
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
  PerspectiveCamera,
  SRGBColorSpace,
} from "three";
import type { DirectionalLight, HemisphereLight, SpotLight, Texture } from "three";
import { PoolModel } from "./PoolModel";
import { SunShelfLoungers } from "./SunShelfLoungers";
import { resolveSunShelfLoungers, SUN_SHELF_LOUNGER_MODEL } from "@/lib/pool/sun-shelf-loungers";
import { ArchitecturalOutline, ARCHITECTURAL_OUTLINE_NAME } from "./ArchitecturalOutline";
import { architecturalFrustum, centeredArchitecturalFrame } from "./architecturalPlan";
import { AutomaticCover } from "./AutomaticCover";
import type { CoverPlan } from "@/lib/pool/cover-plan";
import { StudioPaving, PavingMaterial } from "./StudioPaving";
import { createPavingOnSurface } from "./pavingGeometry";
import { pavingLayout, type PavingFormatId } from "@/lib/pool/presentation";
import { isReferenceFinish } from "@/lib/pool/reference-finishes";
import { studioDeckBand, studioDeckInnerOffset } from "./studioDeck";
import { DeckLoungers, planDeckFurniture, deckFurnitureCameraPoints } from "./DeckLoungers";
import { PoolLights } from "./PoolLights";
import { resolvePoolLayout } from "@/lib/pool/resolved-layout";
import { InfinityEdgePicker } from "./InfinityEdgePicker";
import { createInfinityDeck } from "./infinityLandscape";
import { excludeSubmergedDirectLights } from "./exteriorLightMask";
import { createCoastalTerrace, coastalPhotoRotation, coastalPhotoSun } from "./coastalLayout";
import { DaylightEnvironment, COASTAL_DAYLIGHT } from "./DaylightEnvironment";
import { copingOuterOffset, buildDeckCutoutOutline } from "./poolConstruction";
import { createLimestoneMaps, createTravertineMaps } from "./stoneTextures";
import { PoolMeasurements } from "./PoolMeasurements";
import { Skimmers } from "./Skimmers";
import { ExternalStaircase } from "./ExternalStaircase";
import { Pellicano } from "./Pellicano";
import { planPellicano } from "@/lib/pool/above-ground";
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
import { getCameraPose, contextualAccessCamera, sunShelfCameraSubject, accessCameraSubject, accessFlightCameraSubject, comfortCameraSubject, microLightCameraSubject, lightingCameraSubject, externalStairCameraSubject, pavingCameraSubject, coverCameraSubject, overviewCameraSubject, fitInfinityOverviewCamera, pellicanoCameraSubject, waterlineCameraSubject, infinityWaterlineCameraSubject, infinityDetailCameraSubject, infinityCopingCameraSubject, overflowCameraSubject, interiorFinishCameraSubject, componentCameraAspect, visibleCameraFrame, infinityNavigationLimits, cameraFrameFit, offsetCameraToFrame } from "@/lib/pool/camera";
import type { ResolvedPoolLayout } from "@/lib/pool/resolved-layout";
import type { SceneLightingPlan } from "@/lib/pool/lighting-plan";
import type { CameraIntent } from "@/lib/pool/camera";
import type { PoolLightPosition } from "@/lib/pool/lighting";
import type { HydromassageVariant, InternalStairType } from "@/lib/pool/types";
import {
  infinityExclusion,
  clampInfinityEdgeParams,
  clampInfinityEdgeDimensions,
  infinityZonesForOutline,
} from "@/lib/pool/infinity-edge";
import type { InfinityEdgeParams, RectangleInfinityZone } from "@/lib/pool/infinity-edge";
import { getPoolVerticalLayout } from "@/lib/pool/vertical-layout";
import type { PoolVerticalLayout } from "@/lib/pool/vertical-layout";
import type { PhotoModeQuality } from "./PhotoModeRenderer";
import { renderQualityState, RENDER_QUALITY_IDLE_DELAY } from "@/lib/pool/renderQualityState";
import { heroCaptureState } from "@/lib/project-delivery/heroCapture";
import { projectBookHeroFrame } from "@/lib/project-delivery/hero-frame";

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
  internalStairMirrored?: boolean;
  hydromassageVariant?: HydromassageVariant;
  poolAccess: PoolAccess | null;
  skimmers: SkimmerPlan;
  coverPlan: CoverPlan;
  /** Optional solar shower on the studio deck (equipment option). */
  solarShower?: boolean;
  /** Optional chaise longues on the studio deck (equipment option). */
  loungers?: boolean;
  /** Above-ground: exterior cladding finish. */
  exteriorPanelFinish?: import("@/lib/pool/above-ground").ExteriorPanelFinishId;
  externalStairSide?: import("@/lib/pool/above-ground").ExternalStairSide;
  externalStairPlatformExtended?: boolean;
  /** Above-ground: stainless water-blade spout (equipment option). */
  pellicano?: boolean;
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
  pavingFormat?: PavingFormatId | undefined;
  photoMode: boolean;
  /** Export framing ignores DOM panels without changing the configured pool. */
  cleanCapture?: boolean;
  sunShelfLoungerCount?: number;
  sunShelfLoungerColor?: import("@/lib/pool/sun-shelf-lounger-colors").SunShelfLoungerColorId;
  sunShelfRun?: number;
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
    const outlines = state.scene.getObjectByName(ARCHITECTURAL_OUTLINE_NAME);
    const outlinesVisible = outlines?.visible;
    if (outlines) outlines.visible = false;
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
      if (outlines) outlines.visible = outlinesVisible ?? true;
      gl.setPixelRatio(previousRatio);
    }
  });
  return null;
}

const HERO_CAPTURE_HEIGHT = 1100;
const HERO_SETTLE_MS = 1500;
/** Centre crop to the cover aspect, so the PDF never letterboxes. */
function cropHero(source: HTMLCanvasElement): string {
  const { width, height } = source;
  const frame = projectBookHeroFrame(width, height);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(frame.width);
  canvas.height = Math.round(frame.height);
  canvas
    .getContext("2d")
    ?.drawImage(
      source,
      frame.left,
      frame.top,
      frame.width,
      frame.height,
      0,
      0,
      canvas.width,
      canvas.height,
    );
  return canvas.toDataURL("image/jpeg", 0.9);
}

function DevelopmentRendererMetrics({ qaPaused }: { qaPaused: boolean }) {
  useEffect(installDevelopmentInteractionTiming, []);
  const gl = useThree((state) => state.gl);
  const getRoot = useThree((state) => state.get);
  // DEV-only pause for matched single-scene measurements in embedded tabs,
  // whose webviews can all report "visible" even behind another tab.
  const size = useThree(state => state.size);
  useLayoutEffect(() => {
    const state = getRoot();
    if (qaPaused) { state.setFrameloop("never"); state.internal.frames = 0; }
    console.debug("[Pool3D QA render pause]", qaPaused ? "paused" : "resumed");
  }, [qaPaused, size.width, size.height, getRoot]);
  // Include all passes (mirror, transmission, shadows and main draw), rather
  // than reporting whichever offscreen render happened to run last. DEV only.
  useEffect(() => {
    const previous = gl.info.autoReset;
    gl.info.autoReset = false;
    gl.info.reset();
    return () => { gl.info.autoReset = previous; gl.info.reset(); };
  }, [gl]);
  useEffect(() => installDevelopmentGlDiagnostic(gl.getContext()), [gl]);
  useEffect(() => { if (new URLSearchParams(window.location.search).get("qaGlDiagnostic") === "1") console.debug("[Pool3D GL capability]", JSON.stringify({ KHR_parallel_shader_compile: gl.extensions.has("KHR_parallel_shader_compile") })); }, [gl]);
  useEffect(() => {
    if (!new URLSearchParams(window.location.search).has("qaRenderDiagnostics")) return;
    const original = gl.render;
    let budget = 12;
    gl.render = function (...args) {
      const start = performance.now();
      try { return original.apply(this, args); }
      finally {
        const durationMs = performance.now() - start;
        if (durationMs > 40 && budget-- > 0) console.debug("[Pool3D render diagnostic]", JSON.stringify({
          durationMs: Number(durationMs.toFixed(2)), programs: gl.info.programs?.length,
        }));
      }
    };
    return () => { gl.render = original; };
  }, [gl]);
  const elapsed = useRef(0);
  const frames = useRef(0);
  const frameTimes = useRef<number[]>([]);
  const drawCalls = useRef<number[]>([]);
  const gpuTimes = useRef<number[]>([]);
  const gpuProbe = useMemo(() => {
    if (!new URLSearchParams(window.location.search).has("qaGpuTiming")) return null;
    const context = gl.getContext() as WebGL2RenderingContext;
    const extension = context.getExtension("EXT_disjoint_timer_query_webgl2");
    if (!extension) { console.debug("[Pool3D GPU timing] unavailable"); return null; }
    return { context, extension, pending: [] as WebGLQuery[], spare: [] as WebGLQuery[] };
  }, [gl]);
  useEffect(() => () => {
    if (gpuProbe) for (const query of [...gpuProbe.pending, ...gpuProbe.spare]) gpuProbe.context.deleteQuery(query);
  }, [gpuProbe]);
  useFrame((state) => {
    if (!gpuProbe) return;
    const {context, extension, pending, spare} = gpuProbe;
    while (pending.length && context.getQueryParameter(pending[0]!, context.QUERY_RESULT_AVAILABLE)) {
      const query = pending.shift()!;
      if (!context.getParameter(extension.GPU_DISJOINT_EXT)) gpuTimes.current.push(context.getQueryParameter(query, context.QUERY_RESULT) / 1e6);
      spare.push(query);
    }
    const query = spare.pop() ?? (pending.length < 4 ? context.createQuery() : null);
    if (query) context.beginQuery(extension.TIME_ELAPSED_EXT, query);
    try { gl.render(state.scene, state.camera); }
    finally { if (query) { context.endQuery(extension.TIME_ELAPSED_EXT); pending.push(query); } }
  }, gpuProbe ? 1 : 0);
  const inspectedPrograms = useRef(new Set<number>());
  const peakSamplers = useRef(0);
  const renderer = useMemo(() => {
    const context = gl.getContext();
    const debug = context.getExtension("WEBGL_debug_renderer_info");
    return debug ? String(context.getParameter(debug.UNMASKED_RENDERER_WEBGL)) : "unavailable";
  }, [gl]);

  useFrame((_, delta) => {
    drawCalls.current.push(gl.info.render.calls);
    const lastFrameTriangles = gl.info.render.triangles;
    gl.info.reset();
    elapsed.current += delta;
    frames.current += 1;
    frameTimes.current.push(delta * 1000);
    if (elapsed.current < 2) return;
    const frameTime = (elapsed.current / frames.current) * 1000;
    const sorted = frameTimes.current.sort((a, b) => a - b);
    const percentile = (p: number) => Number(sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))]!.toFixed(2));
    const context = gl.getContext() as WebGL2RenderingContext;
    const inspectionStarted = performance.now();
    let newlyInspected = 0;
    for (const program of gl.info.programs ?? []) {
      if (inspectedPrograms.current.has(program.id)) continue;
      inspectedPrograms.current.add(program.id);
      newlyInspected++;
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
    if (new URLSearchParams(window.location.search).has("qaRenderDiagnostics") && newlyInspected) console.debug("[Pool3D sampler diagnostic]", JSON.stringify({
      durationMs: Number((performance.now() - inspectionStarted).toFixed(2)), newlyInspected,
    }));
    console.debug(
      "[Pool3D performance]",
      JSON.stringify({
        fps: Number((1000 / frameTime).toFixed(1)),
        frameTimeMs: Number(frameTime.toFixed(2)),
        medianFrameTimeMs: percentile(0.5),
        p95FrameTimeMs: percentile(0.95),
        frameCount: sorted.length,
        renderer,
        visibility: document.visibilityState,
        calls: Math.round(drawCalls.current.reduce((sum, count) => sum + count, 0) / drawCalls.current.length),
        peakCalls: Math.max(...drawCalls.current),
        callScope: "full frame, all passes",
        triangles: lastFrameTriangles,
        geometries: gl.info.memory.geometries,
        textures: gl.info.memory.textures,
        dpr: gl.getPixelRatio(),
        viewport: [gl.domElement.clientWidth, gl.domElement.clientHeight],
        maxTextureUnits: gl.capabilities.maxTextures,
        peakProgramSamplers: peakSamplers.current,
        shadowMapSize: ACTIVE_RENDERING_QUALITY.shadowMapSize,
        qualityPreset: ACTIVE_RENDERING_QUALITY.id,
        planarReflection: ACTIVE_RENDERING_QUALITY.planarReflection.enabled,
        parallelShaderCompile: gl.extensions.has("KHR_parallel_shader_compile"),
        idle: renderQualityState.idle,
        camera: _.camera.position.toArray(),
        projection: _.camera.projectionMatrix.elements.slice(),
        buffer: [context.drawingBufferWidth, context.drawingBufferHeight],
        gpuTimeMs: gpuTimes.current.length ? (() => {
          const values = gpuTimes.current.sort((a,b)=>a-b);
          return {median: Number(values[Math.floor(values.length*.5)]!.toFixed(3)), p95:Number(values[Math.min(values.length-1,Math.floor(values.length*.95))]!.toFixed(3)), samples:values.length, scope:"main, transmission and shadows; mirror excluded"};
        })() : null,
      }),
    );
    elapsed.current = 0;
    frames.current = 0;
    frameTimes.current = [];
    drawCalls.current = [];
    gpuTimes.current = [];
  }, -100);
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
 * transition or viewport resize, never reallocating unchanged settled frames.
 */
function AdaptiveQuality() {
  const setDpr = useThree((state) => state.setDpr);
  const size = useThree((state) => state.size);
  const gl = useThree((state) => state.gl);
  const canvas = gl.domElement;
  // Fullscreen adds pixels, not geometry. Bound interactive supersampling;
  // Photo Mode and locked export cameras retain the original quality tier.
  const fullscreenCeiling = canvas.closest(".pool-fullscreen")
    ? Math.sqrt(2_560_000 / Math.max(1, size.width * size.height))
    : Infinity;
  const appliedDpr = useRef<number | null>(null);
  useEffect(() => () => setDpr(ACTIVE_RENDERING_QUALITY.dpr[1]), [setDpr]);

  useFrame(() => {
    const tier = renderQualityState.idle ? ACTIVE_RENDERING_QUALITY.dpr[1] : ACTIVE_RENDERING_QUALITY.dpr[0];
    const dpr = Math.min(tier, Math.max(0.85, fullscreenCeiling));
    // Canvas configuration can restore its device-DPR clamp on a parent
    // commit. Check the renderer as well as our last request, so switching
    // Day/Night cannot strand it at a stale resolution until the next orbit.
    if (dpr === appliedDpr.current && gl.getPixelRatio() === dpr) return;
    appliedDpr.current = dpr;
    setDpr(dpr);
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
  floorProfile,
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
  planBounds,
  compactPlan,
  premiumPlan,
  photoMode,
  cleanCapture,
  infinityZone,
  externalStairPlan,
  coverSubject,
  pellicanoPlacement,
  shelfLoungerEnvelope,
  deckFurnitureEnvelope,
}: {
  accessPlan: SceneLightingPlan["accessPlan"];
  resolvedLayout: ResolvedPoolLayout;
  floorProfile: FloorProfileModel;
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
  planBounds: Outline;
  compactPlan: boolean;
  premiumPlan: boolean;
  photoMode: boolean;
  cleanCapture: boolean;
  /** Geometry Pass D (Infinity): forwarded to `getCameraPose` for the
   * `"infinity"` intent. `null` on every pre-Infinity call is a no-op. */
  infinityZone: RectangleInfinityZone | null;
  externalStairPlan: ReturnType<typeof planExternalStaircase>;
  coverSubject: ReturnType<typeof coverCameraSubject>;
  pellicanoPlacement: ReturnType<typeof planPellicano>;
  shelfLoungerEnvelope: readonly import("@/lib/pool/camera").CameraPoint[];
  deckFurnitureEnvelope: readonly import("@/lib/pool/camera").CameraPoint[];
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
  const navigationLimits = useRef<ReturnType<typeof infinityNavigationLimits> | null>(null);
  // Tracks live OrbitControls dragging (pan/rotate/zoom), separately from
  // `flying` above which tracks this component's own scripted camera
  // transitions -- the stationary-quality mode (see AdaptiveQuality and
  // useWaterReflection) needs to stay in "moving" mode for either.
  const interacting = useRef(false);
  const idleElapsed = useRef(0);
  const editingPose = useRef<{ key: string; pose: import("@/lib/pool/camera").CameraPose } | null>(null);
  const planFit = useRef<{ key: string; width: number; height: number; centre: readonly [number,number] } | null>(null);
  const [, refreshVisibleFrame] = useState(0);
  const occluderRoot = canvas.closest(".pool-fullscreen") ?? document;
  // Layout identities must not depend on translated accessible labels.
  const occluderSelector = '[data-camera-occluder], [data-testid="construction-stage"], [data-technical-panel]';
  useLayoutEffect(() => {
    const observer = new ResizeObserver(() => refreshVisibleFrame(n => n + 1));
    occluderRoot.querySelectorAll(occluderSelector).forEach(element => observer.observe(element));
    return () => observer.disconnect();
  }, [occluderRoot, occluderSelector, focus, frameToken]);

  useEffect(() => {
    const control = controls.current;
    if (!control) return;
    const handleStart = () => {
      interacting.current = true;
      if (flying.current && navigationLimits.current) {
        // A manual interruption owns its current viewpoint; do not clamp it
        // to the unfinished destination's small Infinity orbit window.
        Object.assign(control, infinityZone ? infinityNavigationLimits({
          position: camera.position.toArray() as [number, number, number],
          target: control.target.toArray() as [number, number, number],
        }, true, layout.waterY) : navigationLimits.current);
      }
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
  }, [controls, camera, Boolean(infinityZone), layout.waterY]);

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

  const detail = ["access", "liner", "mosaic", "inox", "shelf", "hydromassage", "bench", "coping", "infinity",
    "paving", "exterior-panel", "external-stairs", "pellicano", "stair-lighting", "bench-lighting", "skimmer-detail", "overflow-hidden", "overflow-visible", "overflow-continuous", "features", "cover"].includes(focus);
  const coastalHero = !!infinityZone && ["review", "overview"].includes(focus);
  const opticalDetail = detail;
  const interiorSubject = useMemo(() => focus === "liner" || focus === "mosaic"
    ? interiorFinishCameraSubject(outline, layout, resolvedLayout, floorProfile, infinityZone) : null,
  [focus, outline, layout, resolvedLayout, floorProfile, infinityZone]);
  const wholeSubject = useMemo(() => overviewCameraSubject(outline, layout, {
    infinityZone,
    // The exterior stair is a substantial part of an above-ground product.
    // Look from its exposed side instead of hiding its flight behind the shell.
    exteriorDirection: externalStairPlan ? externalStairCameraSubject(externalStairPlan,layout).direction : undefined,
    outset: copingOuterOffset(infinityZone ? "infinity" : "skimmer", "hidden") + 0.15,
    // No invisible below-ground outside corners in the general fit. The rim
    // encloses all visible interior surfaces; above-ground walls reach grade.
    baseY: layout.groundY,
    entrance: resolvedLayout.access.placement,
    accessories: [
      ...(accessCameraSubject(resolvedLayout.access,layout,outline)?.points ?? []),
      ...(resolvedLayout.ladder ? accessCameraSubject(resolvedLayout.ladder.plan,layout,outline)?.points ?? [] : []),
      ...shelfLoungerEnvelope,
      ...deckFurnitureEnvelope,
      ...(externalStairPlan ? externalStairCameraSubject(externalStairPlan,layout).points : []),
      ...(coverSubject?.points ?? []),
      ...(pellicanoPlacement ? pellicanoCameraSubject(pellicanoPlacement,layout).points : []),
    ],
  }), [outline,layout,resolvedLayout,shelfLoungerEnvelope,deckFurnitureEnvelope,externalStairPlan,coverSubject,pellicanoPlacement,infinityZone]);
  const localFraming = (focus === "external-stairs" && !!externalStairPlan) || (focus === "cover" && !!coverSubject)
    || (focus === "bench-lighting" && resolvedLayout.comfort.elements.some(element => element.kind === "hydromassage"))
    || !!interiorSubject || focus === "waterline" || (focus === "infinity" && !!infinityZone)
    || coastalHero || (!infinityZone && ["paving", "review", "overview", "shelf", "access", "inox", "hydromassage", "bench"].includes(focus));
  const subjectAspect = useMemo(() => {
    if (focus === "top") {
      const b = outlineBounds(planBounds);
      return b.spanX / Math.max(0.01, b.spanZ);
    }
    const subject = interiorSubject ?? (focus === "shelf" ? sunShelfCameraSubject(resolvedLayout, layout, outline, shelfLoungerEnvelope)
      : focus === "access" ? accessFlightCameraSubject(resolvedLayout, layout, outline, shelfLoungerEnvelope)
      : focus === "inox" ? accessCameraSubject(resolvedLayout.ladder?.plan ?? resolvedLayout.access, layout, outline)
      : focus === "hydromassage" || focus === "bench" ? comfortCameraSubject(focus, resolvedLayout, layout, outline)
      : focus === "stair-lighting" || focus === "bench-lighting" ? microLightCameraSubject(focus, resolvedLayout, layout, outline)
      : focus === "features" ? lightingCameraSubject(outline, layout, ledRow)
      : focus === "external-stairs" && externalStairPlan ? externalStairCameraSubject(externalStairPlan, layout)
      : focus === "cover" ? coverSubject
      : focus === "paving" && !infinityZone ? pavingCameraSubject(outline, layout, skimmers)
      : (focus === "review" || focus === "overview") ? wholeSubject
      : focus === "waterline" ? (infinityZone ? infinityWaterlineCameraSubject(outline, infinityZone, layout) : waterlineCameraSubject(outline, layout, skimmers))
      : focus === "infinity" && infinityZone ? infinityDetailCameraSubject(outline, infinityZone, layout)
      : focus === "coping" && infinityZone ? infinityCopingCameraSubject(outline, infinityZone, layout)
      : focus === "overflow-hidden" || focus === "overflow-visible" || focus === "overflow-continuous" ? overflowCameraSubject(focus, outline, layout, skimmers)
      : null);
    return subject ? componentCameraAspect(subject.points, subject.direction) : undefined;
  }, [focus, resolvedLayout, layout, outline, shelfLoungerEnvelope, infinityZone, skimmers, ledRow, externalStairPlan, coverSubject, planBounds, compactPlan, interiorSubject, wholeSubject]);
  const summaryRect = detail && !infinityZone ? canvas.closest("main")?.querySelector('[data-config-summary]')?.getBoundingClientRect() : null;
  const visibleFrame = cleanCapture ? projectBookHeroFrame(viewportSize.width, viewportSize.height) : visibleCameraFrame(canvas.getBoundingClientRect(), [
    ...Array.from(occluderRoot.querySelectorAll(occluderSelector)).map(element => element.getBoundingClientRect()),
    ...(summaryRect ? [summaryRect] : []),
  ], subjectAspect);
  const visibleFrameKey = `${visibleFrame.left}:${visibleFrame.top}:${visibleFrame.width}:${visibleFrame.height}`;
  const fitFov = localFraming ? SCENE_VISUAL_PRESET.camera.fov
    : cameraFrameFit(SCENE_VISUAL_PRESET.camera.fov, viewportSize.height, visibleFrame).verticalFov;
  let pose = contextualAccessCamera(focus, resolvedLayout, layout, outline, fitFov, visibleFrame.width / Math.max(1,visibleFrame.height), infinityZone, shelfLoungerEnvelope) ?? (coastalHero && infinityZone
    ? fitInfinityOverviewCamera(wholeSubject, outline, SCENE_VISUAL_PRESET.camera.fov, visibleFrame.width / Math.max(1, visibleFrame.height))
    : getCameraPose({
      accessPlan,
      intent: focus,
      outline,
      layout,
      depth,
      skimmers,
      ledRow,
      verticalFov: fitFov,
      viewportAspect: visibleFrame.width / Math.max(1, visibleFrame.height),
      includeExternalStaircase,
      infinityZone,
      externalStairPlan,
      coverSubject,
      pellicanoPlacement,
      interiorSubject,
      overviewSubject: wholeSubject,
    }));
  const editKey = `${focus}:${viewportSize.width}:${viewportSize.height}:${visibleFrameKey}:${frameToken}`;
  if (focus === "depth") {
    if (editingPose.current?.key !== editKey) editingPose.current = { key: editKey, pose };
    pose = editingPose.current.pose;
  } else editingPose.current = null;
  if (focus === "top") {
    // Centre within a symmetric subset of the free rectangle, without
    // putting the plan under floating controls or a technical panel.
    const planFrame = centeredArchitecturalFrame(visibleFrame, viewportSize.width);
    planFit.current = { key: editKey, ...architecturalFrustum(planBounds, viewportSize.width, viewportSize.height, planFrame, compactPlan, premiumPlan) };
    const [x,z] = planFit.current.centre;
    pose = { position: [x, layout.copingY + 30, z], target: [x, layout.copingY, z] };
  } else planFit.current = null;
  if (focus !== "top" && !coastalHero && !opticalDetail && !localFraming) {
    pose = offsetCameraToFrame(pose, SCENE_VISUAL_PRESET.camera.fov, viewportSize.width, viewportSize.height, visibleFrame);
  }
  // Material changes can recreate plans without moving their geometry.
  // Only a different pose/intent or explicit reframe starts a new flight.
  const poseKey = JSON.stringify(pose);
  useLayoutEffect(() => {
    if (!(camera instanceof PerspectiveCamera) || !localFraming) return;
    // This inset projection owns its aspect; R3F's DPR resize otherwise
    // replaces it with the full canvas aspect after the camera has settled.
    const owned = camera as PerspectiveCamera & { manual?: boolean };
    const previous = owned.manual;
    owned.manual = true;
    return () => { if (previous === undefined) delete owned.manual; else owned.manual = previous; };
  }, [camera, localFraming]);
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
    if (camera instanceof PerspectiveCamera) {
      // clearViewOffset does not undo the inset's aspect. Restore the current
      // canvas ratio on handoff, even if no R3F resize/DPR event follows.
      if (!localFraming) camera.aspect = viewportSize.width / Math.max(1, viewportSize.height);
      if (localFraming) {
        // Keep the component's physical 34° lens close to the installation.
        // A full-canvas lens fitted into a tiny UI strip pushed it into fog.
        camera.setViewOffset(visibleFrame.width, visibleFrame.height,
          -visibleFrame.left, -visibleFrame.top, viewportSize.width, viewportSize.height);
      } else if (opticalDetail) {
        // Shift the lens inside the available UI frame, not the installation
        // viewpoint. Translating the eye/target moved it away from the real
        // selected surface and could lower the physical architectural eye line.
        camera.setViewOffset(viewportSize.width, viewportSize.height,
          viewportSize.width / 2 - (visibleFrame.left + visibleFrame.width / 2),
          viewportSize.height / 2 - (visibleFrame.top + visibleFrame.height / 2),
          viewportSize.width, viewportSize.height);
      } else camera.clearViewOffset();
    }
    goal.current.set(...pose.position);
    lookAt.current.set(...pose.target);
    startPosition.current.copy(camera.position);
    startTarget.current.copy(controls.current?.target ?? lookAt.current);
    const control = controls.current;
    const goalDistance = goal.current.distanceTo(lookAt.current);
    navigationLimits.current = infinityZone && focus !== "top" && focus !== "depth"
      ? infinityNavigationLimits(pose, detail, layout.waterY)
      : { minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minDistance: Math.min(2, goalDistance * 0.6), maxDistance: 160,
          minPolarAngle: focus === "top" ? Math.PI / 2 : 0,
          maxPolarAngle: focus === "top" ? Math.PI / 2 : Math.PI / 2.05 };
    // Drain old orbit inertia with open limits, retaining the actual start.
    // Applying the destination's restricted azimuth during a flight made
    // OrbitControls snap/clamp the interpolated path on every frame.
    if (control) {
      Object.assign(control, { minAzimuthAngle: -Infinity, maxAzimuthAngle: Infinity, minDistance: 0.05, maxDistance: Infinity,
        minPolarAngle: 0, maxPolarAngle: Math.PI });
      const damping = control.enableDamping;
      control.enableDamping = false;
      control.update();
      camera.position.copy(startPosition.current);
      control.target.copy(startTarget.current);
      control.update();
      control.enableDamping = damping;
    }
    renderQualityState.locked = cameraLocked;
    if (cameraLocked || focus === "top" || focus === "depth") {
      if (control) {
        const damping = control.enableDamping;
        control.enableDamping = false;
        Object.assign(control, navigationLimits.current);
        camera.position.copy(goal.current);
        control.target.copy(lookAt.current);
        control.update();
        control.enableDamping = damping;
      }
      camera.position.copy(goal.current);
      camera.lookAt(lookAt.current);
      camera.updateMatrixWorld(true);
      flying.current = false;
      renderQualityState.idle = true;
      return;
    }
    elapsed.current = 0;
    // AUTO-012 / directive §53: honour prefers-reduced-motion by snapping to
    // the goal pose on the next frame instead of flying the camera there.
    // (styles.css's global reduced-motion rule only collapses CSS
    // animations/transitions -- it doesn't reach this Three.js-driven lerp.)
    const reducedMotion = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
    const largeMove = startPosition.current.distanceTo(goal.current) > Math.max(2, radius * 0.65);
    duration.current = reducedMotion || (largeMove && !detail) ? 0 : 0.24;
    flying.current =
      startPosition.current.distanceToSquared(goal.current) > 1e-10 ||
      startTarget.current.distanceToSquared(lookAt.current) > 1e-10;
    if (!flying.current && control) Object.assign(control, navigationLimits.current);
  }, [
    cameraLocked,
    Boolean(infinityZone),
    camera,
    controls,
    frameToken,
    focus,
    poseKey,
    coastalHero,
    localFraming,
    opticalDetail,
    viewportSize.width,
    viewportSize.height,
    visibleFrame.left,
    visibleFrame.top,
    visibleFrame.width,
    visibleFrame.height,
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
        if (navigationLimits.current) Object.assign(control, navigationLimits.current);
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
  coastalMap,
  sceneTime,
  paving,
  pavingFormat,
}: {
  outline: Outline;
  size: number;
  theme: Theme;
  poolType: PoolType;
  system: SystemType;
  overflowType: OverflowType;
  waterY: number;
  coastalMap: Texture | null;
  sceneTime: SceneTimeOfDay;
  paving: import("@/lib/pool/presentation").PavingId;
  pavingFormat?: PavingFormatId | undefined;
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
  const terraceLayout = useMemo(() => pavingLayout(paving, pavingFormat), [paving, pavingFormat]);
  const { module: terraceModule, gap: terraceGap, thickness: terraceThickness, boards: terraceBoards } = terraceLayout;
  const terrace = useMemo(() => {
    if (!pavingGeometry) return null;
    const slabs = createPavingOnSurface(pavingGeometry, terraceModule, { gap: terraceGap, thickness: terraceThickness, boards: terraceBoards });
    const bed = pavingGeometry.clone();
    const p = bed.getAttribute("position");
    for (let i = 0; i < p.count; i++) if (Math.abs(p.getY(i)) < 1e-6) p.setY(i, -terraceThickness);
    bed.computeVertexNormals();
    return { slabs, bed };
  }, [pavingGeometry, terraceModule, terraceGap, terraceThickness, terraceBoards]);
  useEffect(() => () => { terrace?.slabs.dispose(); terrace?.bed.dispose(); }, [terrace]);
  const geometry = useMemo(() => {
    if (premiumInfinity && infinityZone) {
      return createCoastalTerrace(outline, infinityZone, copingOuterOffset(system, overflowType), waterY);
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
  }, [outline, size, poolType, system, overflowType, infinityZone, premiumInfinity, photographicCoast, waterY]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const stone = useMemo(() => premiumInfinity ? createLimestoneMaps() : createTravertineMaps(), [premiumInfinity]);
  useEffect(() => {
    const textures = Object.values(stone).filter((texture) => texture !== null);
    for (const texture of textures) {
      texture.repeat.set(premiumInfinity ? 0.5 : 2.5, premiumInfinity ? 0.5 : 2.5);
      texture.anisotropy = Math.min(8, maxAnisotropy);
      texture.needsUpdate = true;
    }
    return () => textures.forEach((texture) => texture.dispose());
  }, [stone, maxAnisotropy, premiumInfinity]);

  return (
    <group>
      {terrace ? (
        <>
        <mesh
          name="infinity-level-limestone-deck"
          geometry={terrace.bed}
          receiveShadow
          castShadow
        >
          <PavingMaterial key={paving} id={paving} waterY={waterY} joint />
        </mesh>
        <mesh name="infinity-paving-modules" geometry={terrace.slabs} receiveShadow castShadow>
          <PavingMaterial key={isReferenceFinish(paving) ? "reference" : paving} id={paving} waterY={waterY} />
        </mesh>
        </>
      ) : null}
      <mesh name="pool-studio-deck" geometry={geometry} position={[0, -0.002, 0]} receiveShadow>
        {premiumInfinity && infinityZone && coastalMap ? <meshStandardMaterial
          side={DoubleSide}
          color={sceneTime === "night" ? "#68655e" : "#c1b8a7"}
          map={stone.colorMap} normalMap={stone.normalMap} normalScale={[0.18,0.18]}
          roughnessMap={stone.roughnessMap} roughness={0.88} metalness={0}
        /> : <meshStandardMaterial
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
        />}
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
  internalStairMirrored = false,
  hydromassageVariant,
  poolAccess,
  skimmers,
  coverPlan,
  solarShower = false,
  loungers = false,
  exteriorPanelFinish,
  externalStairSide = "short",
  externalStairPlatformExtended = false,
  pellicano = false,
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
  pavingFormat,
  photoMode,
  cleanCapture = false,
  sunShelfLoungerCount,
  sunShelfLoungerColor = "white",
  sunShelfRun,
  photoModeQuality,
  onPhotoModeUnsupported,
}: SceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const renderer = useRef<import("three").WebGLRenderer | null>(null);
  const [preparingShaders, setPreparingShaders] = useState(false);
  const [qaRenderPaused, setQaRenderPaused] = useState(false);
  useEffect(() => {
    if (!import.meta.env.DEV) return;
    const toggle = (event: KeyboardEvent) => {
      if (!event.isTrusted || !event.altKey || !event.shiftKey || event.code !== "KeyP") return;
      event.preventDefault();
      setQaRenderPaused(paused => !paused);
    };
    window.addEventListener("keydown", toggle);
    return () => window.removeEventListener("keydown", toggle);
  }, []);
  const [coastalStatus, setCoastalStatus] = useState<"loading" | "ready" | "error">("loading");
  const [coastalMap, setCoastalMap] = useState<Texture | null>(null);
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

  // Depth silhouettes change with geometry, not with RGB, language or time
  // of day. Rebuilding a4K map on those uniform-only commits stalls toggles.
  // Asset readiness also invalidates so async-mounted casters are included.
  const assetsLoading=useProgress(state=>state.active);
  const shadowRevision=JSON.stringify([
    outline,shape,system,overflowType,poolType,length,width,depth,floorProfileSetting,
    shallowDepth,slopeReversed,features,poolAccess,internalStairType,internalStairMirrored,
    hydromassageVariant,sunShelfRun,sunShelfLoungerCount,infinityEdge,construction,
    solarShower,loungers,exteriorPanelFinish,externalStairSide,externalStairPlatformExtended,
    pellicano,coverPlan.geometry,coverPlan.extension,materials.skimmer.type,skimmers.positions,
    paving,pavingFormat,
  ]);
  useLayoutEffect(() => {
    if (sunLight.current) sunLight.current.shadow.needsUpdate = true;
  },[shadowRevision,assetsLoading]);

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
          ...(sunShelfRun !== undefined ? { sunShelfRun } : {}),
        },
        verticalLayout,
        sunShelf: features.includes("sunShelf") || features.includes("hydromassage"),
        twoLoungerShelf: features.includes("sunShelf"),
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
      sunShelfRun,
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
  const showSkimmers = construction?.showSystemComponents ?? true;
  const [skimmersPrepared, setSkimmersPrepared] = useState(system === "skimmer" && showSkimmers);
  useEffect(() => {
    if (system !== "skimmer") setSkimmersPrepared(false);
    else if (showSkimmers) setSkimmersPrepared(true);
  }, [system, showSkimmers]);
  const background = infinityStage && (focus !== "top" || photoMode)
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
        nominalWidth: width,
        sunShelfRun,
        infinityWallType: normalisedInfinityEdge?.wallType,
        system,
        overflowType,
        outline,
        layout: verticalLayout,
        skimmers: system === "skimmer" ? skimmers : { ...skimmers, positions: [] },
        access: poolAccess,
        stairType: internalStairType,
        stairMirrored: internalStairMirrored,
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
      width,
      sunShelfRun,
      normalisedInfinityEdge?.wallType,
      system,
      poolAccess,
      internalStairType,
      internalStairMirrored,
      floorProfile,
      infinityExcluded,
      overflowType,
    ],
  );

  const deckSize = useMemo(() => Math.max(40, radius * 14), [radius]);
  const shelfLoungerPlan = useMemo(() => resolveSunShelfLoungers({
    comfort: resolvedLayout.comfort, outline, waterY: verticalLayout.waterY,
    enabled: features.includes("sunShelfLoungers"), quantity: sunShelfLoungerCount, infinityExcluded,
    accessFootprints: [
      ...(resolvedLayout.access.placement ? [resolvedLayout.access.footprint] : []),
      ...(resolvedLayout.ladder?.plan.placement ? [resolvedLayout.ladder.plan.footprint] : []),
    ],
  }), [resolvedLayout, outline, verticalLayout.waterY, features, sunShelfLoungerCount, infinityExcluded]);
  const shelfLoungerEnvelope = useMemo(() => shelfLoungerPlan.placements.flatMap(placement =>
    placement.footprint.flatMap(([x, z]) => [placement.y, placement.y + SUN_SHELF_LOUNGER_MODEL.height]
      .map(y => [x, y, z] as const))), [shelfLoungerPlan]);
  const lighting = resolvedLayout.lighting;
  // Deck positions the furniture must keep clear of: the inox ladder (deck
  // anchored), the access placement itself and, above ground, both ends of
  // the external staircase.
  const externalStairs = poolType === "above-ground" && features.includes("externalStaircase");
  const coverSubject = useMemo(() => coverCameraSubject(coverPlan, verticalLayout, outline, copingOuterOffset(system, overflowType)),
    [coverPlan, verticalLayout, outline, system, overflowType]);
  const planBounds = useMemo(() => {
    const b = outlineBounds(outline);
    // Include the actual shell/coping envelope; Infinity's receiver projects
    // beyond it. No furniture/scenery can inflate this architectural fit.
    const margin = copingOuterOffset(system, overflowType) + (poolType === "above-ground" && showMeasurements ? infinityZone ? 0.5 : 0.05 : 0);
    const points: [number, number][] = [
      [b.minX-margin,b.minZ-margin], [b.maxX+margin,b.maxZ+margin],
    ];
    // Dimension lines sit 0.60 m from the basin, with 0.12 m ticks.
    // Include their true envelope once; labels receive pixel clearance in fit.
    if (poolType === "in-ground" && showMeasurements)
      points.push([b.minX-0.72,b.minZ-0.72], [b.maxX+0.72,b.maxZ+0.72]);
    if (!showMeasurements && infinityZone) {
      const d = clampInfinityEdgeDimensions(undefined), receiverOut = d.lipWidth + d.catchBasinWidth + d.wallThickness;
      infinityZone.points.forEach(([x, z], i) => {
        const normal = infinityZone.pointNormals[i]!;
        points.push([x + normal[0] * receiverOut, z + normal[1] * receiverOut]);
      });
    }
    if (!showMeasurements && coverPlan.geometry && coverSubject)
      points.push(...coverSubject.points.map(([x, , z]) => [x, z] as [number, number]));
    if (externalStairs) {
      const stairs = planExternalStaircase({ outline, side: externalStairSide,
        platformExtended: externalStairPlatformExtended, accessAnchor: lighting.accessPlan.placement,
        copingOffset: copingOuterOffset(system, overflowType), infinityExcluded,
        groundY: verticalLayout.groundY,
        topY: system === "overflow" ? verticalLayout.waterY-0.001 : verticalLayout.copingY });
      if (stairs) points.push(...stairs.footprint.map(p => [p[0], p[1]] as [number,number]));
    }
    return points;
  }, [outline, system, overflowType, infinityZone, poolType, externalStairs, externalStairSide,
    externalStairPlatformExtended, lighting.accessPlan.placement, infinityExcluded, verticalLayout, showMeasurements, coverPlan.geometry, coverSubject]);
  const planView = focus === "top" && !photoMode;
  const planRevision = JSON.stringify([outline, depth, features, resolvedLayout, system, overflowType,
    poolType, copingThickness, materials.coping.id, externalStairSide, externalStairPlatformExtended, construction]);
  const deckObstacles = useMemo(() => {
    const points: { x: number; z: number }[] = [
      resolvedLayout.ladder?.plan.placement,
      lighting.accessPlan.placement,
    ].filter((p): p is { x: number; z: number; rotation: number } => !!p);
    if (externalStairs) {
      const stairs = planExternalStaircase({
        side: externalStairSide,
        platformExtended: externalStairPlatformExtended,
        accessAnchor: lighting.accessPlan.placement,
        outline,
        copingOffset: copingOuterOffset(system, overflowType),
        infinityExcluded,
        groundY: verticalLayout.groundY,
        topY: system === "overflow" ? verticalLayout.waterY - 0.001 : verticalLayout.copingY,
      });
      if (stairs) {
        const run = stairs.landingDepth/2 + stairs.run;
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
    externalStairSide,
    externalStairPlatformExtended,
    outline,
    system,
    overflowType,
    infinityExcluded,
    verticalLayout,
  ]);
  // Pellicano on the short side farthest from every access point.
  const pellicanoPlacement = useMemo(
    () => (poolType === "above-ground" && pellicano ? planPellicano(outline, deckObstacles) : null),
    [poolType, pellicano, outline, deckObstacles],
  );
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
  const visibleDeckLoungers = loungers && (construction?.showLoungers ?? true);
  const deckFurniturePlan = useMemo(() => system !== "infinity" && (construction?.showEnvironment ?? true)
    ? planDeckFurniture(outline, studioDeckInnerOffset(poolType,system,overflowType),
      studioDeckBand(outline,true,visibleDeckLoungers),deckObstacles,{loungers:visibleDeckLoungers,shower:solarShower,coverHousing}) : null,
  [system,construction?.showEnvironment,outline,poolType,overflowType,deckObstacles,visibleDeckLoungers,solarShower,coverHousing]);
  const deckFurnitureEnvelope = useMemo(() => deckFurniturePlan ? deckFurnitureCameraPoints(deckFurniturePlan) : [], [deckFurniturePlan]);
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
    internalStairMirrored,
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
    materials.coping.id,
    paving,
    pavingFormat,
    exteriorPanelFinish,
    externalStairSide,
    externalStairPlatformExtended,
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
    <div className="relative h-full w-full">
    <Canvas
      frameloop={preparingShaders || (import.meta.env.DEV && qaRenderPaused) ? "never" : "always"}
      // PCFSoftShadowMap is deprecated in three.js: WebGLShadowMap silently
      // reassigns it to PCFShadowMap on the very first render anyway (same
      // algorithm, only the enum name changed), so setting it explicitly
      // here is a zero-behaviour-change fix for the console warning, not a
      // visual change.
      shadows={{ type: PCFShadowMap }}
      // AdaptiveQuality owns the live ratio. Feeding the original device
      // clamp back on every React commit resized it twice on Day/Night.
      dpr={cameraLocked ? ACTIVE_RENDERING_QUALITY.dpr[1] : renderer.current?.getPixelRatio() ?? ACTIVE_RENDERING_QUALITY.dpr}
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
        renderer.current = gl;
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
      {!photoMode ? <DaylightEnvironment theme={visualTheme} timeOfDay={sceneTime} sunDirection={sunPosition} outdoor={infinityStage} showBackdrop={!planView} coastalRotation={infinityZone ? coastalPhotoRotation(infinityZone) : 0} onCoastalStatus={setCoastalStatus} onCoastalMap={setCoastalMap} /> : null}

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
        shadow-intensity={planView ? 0.35 : 1}
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
      <Suspense fallback={null}>
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
          coastalMap={coastalMap}
          sceneTime={sceneTime}
          paving={paving ?? "gres"}
          pavingFormat={pavingFormat}
        />
      ) : (
          <StudioPaving
            outline={outline}
            poolType={poolType}
            system={system}
            overflowType={overflowType}
            paving={paving ?? "gres"}
            pavingFormat={pavingFormat}
            environment={construction?.showEnvironment ?? true}
            loungers={visibleDeckLoungers}
            furnitureRows={deckFurniturePlan?.rows}
            decking={construction?.showDecking ?? true}
            waterY={verticalLayout.waterY}
          />
      )}
      {/* Commit paving textures before the tracer snapshots the scene. */}
      {photoMode ? (
        <PhotoModeRenderer
          key={photoModeSceneKey}
          theme={theme}
          quality={photoModeQuality}
          onUnsupported={onPhotoModeUnsupported}
        />
      ) : null}
      </Suspense>
      {/* Presentation furniture on the studio deck: hidden in the raw
          construction stages and never part of the configuration. */}
      {system !== "infinity" && (construction?.showEnvironment ?? true) ? (
        <DeckLoungers
          outline={outline}
          innerOffset={studioDeckInnerOffset(poolType, system, overflowType)}
          band={studioDeckBand(outline, true, visibleDeckLoungers)}
          waterY={verticalLayout.waterY}
          avoid={deckObstacles}
          shower={solarShower}
          loungers={visibleDeckLoungers}
          coverHousing={coverHousing}
        />
      ) : null}

      <PoolModel
        {...(exteriorPanelFinish ? { exteriorPanelFinish } : {})}
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
        pavingThickness={pavingLayout(paving, pavingFormat).thickness}
        showWater={showWater}
        waterGeometryRevision={`${shadowRevision}|${assetsLoading}`}
        planView={planView}
        rawStructure={construction?.raw ? construction.structure ?? "REINFORCED_CONCRETE" : null}
        structureFamily={construction?.structure ?? null}
        showAccessories={construction?.showAccessories ?? true}
        night={dusk}
        ledColor={ledColor}
        ledIntensity={ledIntensity}
        {...(normalisedInfinityEdge ? { infinityEdge: normalisedInfinityEdge } : {})}
        infinityExcluded={infinityExcluded}
      />
      {features.includes("sunShelfLoungers") && (construction?.showAccessories ?? true) ? <SunShelfLoungers plan={shelfLoungerPlan} color={sunShelfLoungerColor} /> : null}
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
          side={externalStairSide}
          platformExtended={externalStairPlatformExtended}
          accessAnchor={lighting.accessPlan.placement}
          outline={outline}
          copingOffset={copingOuterOffset(system, overflowType)}
          infinityExcluded={infinityExcluded}
          groundY={verticalLayout.groundY}
          topY={system === "overflow" ? verticalLayout.waterY - 0.001 : verticalLayout.copingY}
          {...(exteriorPanelFinish ? { finish: exteriorPanelFinish } : {})}
          tread={{
            id: materials.coping.id,
            color: materials.coping.color,
            roughness: materials.coping.roughness,
            assetDir: "asset" in materials.coping ? materials.coping.asset.dir : null,
          }}
        />
      ) : null}

      {poolType === "above-ground" && pellicano && pellicanoPlacement && showWater && (construction?.showAccessories ?? true) ? (
        <Pellicano
          position={[pellicanoPlacement.x, pellicanoPlacement.z]}
          rotation={Math.atan2(pellicanoPlacement.inward[0], pellicanoPlacement.inward[1])}
          copingY={verticalLayout.copingY}
          waterY={verticalLayout.waterY}
        />
      ) : null}

      {planView ? <ArchitecturalOutline revision={planRevision} premium={poolType === "in-ground"} /> : null}

      {system === "skimmer" && (showSkimmers || skimmersPrepared) ? (
        <group visible={showSkimmers}>
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
        </group>
      ) : null}

      {/* Dimension guide lines: drei's <Line> is built on LineSegmentsGeometry,
          which uses an instanced/interleaved buffer under the hood -- one of
          the two geometry kinds the path tracer explicitly does not support.
          They are an editing overlay anyway, not part of a "photo". */}
      {showMeasurements && !photoMode ? (
        <PoolMeasurements
          architecturalPlan={planView && poolType === "in-ground"}
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
          key={`${shape}-${length}-${width}-${depth}-${system}-${overflowType}-${poolType}-${outlineSignature}-${solarShower}-${loungers}-${features.join(",")}-${Boolean(coverPlan.geometry)}`}
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

      {import.meta.env.DEV ? <DevelopmentRendererMetrics qaPaused={qaRenderPaused} /> : null}
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
        enablePan={!infinityStage}
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
        floorProfile={floorProfile}
        cameraLocked={cameraLocked}
        radius={radius}
        controls={controls}
        frameToken={frameToken}
        // Vedi piscina owns its whole-installation projection even while the
        // current construction stage shows the raw shell. Do not reroute it
        // to the structure editor's different optical fit.
        focus={focus}
        shape={shape}
        depth={depth}
        outline={outline}
        layout={verticalLayout}
        skimmers={skimmers}
        ledRow={lighting.plan.positions}
        photoMode={photoMode}
        cleanCapture={cleanCapture}
        infinityZone={infinityZone}
        // The exterior/staircase framing must never hijack the Step 05
        // Pool System camera -- that step's premium front view (both
        // skimmers, centred, from inside looking out) always wins.
        includeExternalStaircase={false}
        planBounds={planBounds}
        compactPlan={!showMeasurements}
        premiumPlan={poolType === "in-ground"}
        externalStairPlan={externalStairs ? planExternalStaircase({outline, side:externalStairSide,
          platformExtended:externalStairPlatformExtended, accessAnchor:lighting.accessPlan.placement,
          copingOffset:copingOuterOffset(system,overflowType), infinityExcluded,
          groundY:verticalLayout.groundY, topY:system==="overflow"?verticalLayout.waterY-.001:verticalLayout.copingY}) : null}
        coverSubject={coverSubject}
        pellicanoPlacement={pellicanoPlacement}
        shelfLoungerEnvelope={shelfLoungerEnvelope}
        deckFurnitureEnvelope={deckFurnitureEnvelope}
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

      <ShaderPreparation enabled={showWater && !photoMode && !qaRenderPaused} onPreparing={setPreparingShaders} signature={[
        sceneTime, features.join(","), lighting.plan.count,
        resolvedLayout.stairMicroSpots.length,
        resolvedLayout.comfort.elements.reduce((sum,element)=>sum+(element.spots?.length??0),0),
        construction?.showLighting, construction?.showAccessories, infinityStage,
        materials.surface.kind, materials.surface.textureUrl, materials.coping.id, paving,
      ].join("|")} />

      {/* Normal configuration is raster-only. Tracing is loaded and mounted
          exclusively in response to the user's explicit Photo Mode toggle. */}
    </Canvas>
    {infinityStage && !photoMode && coastalStatus !== "ready" ? (
      <div role="status" aria-live="polite" className="absolute inset-0 z-[2] flex items-center justify-center bg-viewport text-sm text-foreground/70">
        {coastalStatus === "error" ? "Panorama non disponibile. Seleziona nuovamente Infinity per riprovare." : "Preparazione panorama Infinity…"}
      </div>
    ) : null}
    </div>
  );
}
