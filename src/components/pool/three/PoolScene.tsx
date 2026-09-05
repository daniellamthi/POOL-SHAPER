import { lazy, Suspense, useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3, ACESFilmicToneMapping, NoToneMapping, PCFShadowMap, SRGBColorSpace } from "three";
import { PoolModel } from "./PoolModel";
import { SkyDome } from "./SkyDome";
import { createMaterialMicroNormalMap, createMaterialMicroRoughnessMap } from "./textures";
import { PoolMeasurements } from "./PoolMeasurements";
import { Skimmers } from "./Skimmers";
import { ExternalStaircase } from "./ExternalStaircase";
import { createSurfaceGeometry } from "./poolGeometry";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import type { ResolvedMaterials } from "@/lib/pool/materials";
import type {
  Outline,
  OverflowType,
  PoolFeatureId,
  PoolShapeId,
  PoolType,
  SystemType,
} from "@/lib/pool/types";
import type { Theme } from "@/lib/theme";
import {
  ACTIVE_RENDERING_QUALITY,
  SCENE_VISUAL_PRESET,
} from "@/configurator/3d/scene/visual-preset";
import {
  MATERIAL_MICRO_DETAIL_PRESET,
  POOL_BORDER_PRESET,
} from "@/configurator/materials/visual-presets";
import { COPING_WIDTH } from "@/lib/pool/config";
import { offsetOutline, outlineBounds } from "@/lib/pool/geometry";
import { getCameraPose } from "@/lib/pool/camera";
import type { CameraIntent } from "@/lib/pool/camera";
import { getPoolVerticalLayout } from "@/lib/pool/vertical-layout";
import type { PoolVerticalLayout } from "@/lib/pool/vertical-layout";
import type { PhotoModeQuality } from "./PhotoModeRenderer";

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

export interface SceneProps {
  outline: Outline;
  shape: PoolShapeId;
  system: SystemType;
  overflowType: OverflowType;
  poolType: PoolType;
  materials: ResolvedMaterials;
  features: ReadonlyArray<PoolFeatureId>;
  skimmers: SkimmerPlan;
  length: number;
  width: number;
  depth: number;
  showMeasurements: boolean;
  frameToken: number;
  focus: SceneFocus;
  showWater: boolean;
  theme: Theme;
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

function DevelopmentRendererMetrics() {
  const gl = useThree((state) => state.gl);
  const elapsed = useRef(0);
  const frames = useRef(0);

  useFrame((_, delta) => {
    elapsed.current += delta;
    frames.current += 1;
    if (elapsed.current < 2) return;
    const frameTime = (elapsed.current / frames.current) * 1000;
    console.debug("[Pool3D performance]", {
      fps: Number((1000 / frameTime).toFixed(1)),
      frameTimeMs: Number(frameTime.toFixed(2)),
      calls: gl.info.render.calls,
      triangles: gl.info.render.triangles,
      geometries: gl.info.memory.geometries,
      textures: gl.info.memory.textures,
      dpr: gl.getPixelRatio(),
      shadowMapSize: ACTIVE_RENDERING_QUALITY.shadowMapSize,
      qualityPreset: ACTIVE_RENDERING_QUALITY.id,
    });
    elapsed.current = 0;
    frames.current = 0;
  });
  return null;
}

/** Smoothly restores a stable product view when dimensions or framing change. */
function CameraRig({
  radius,
  controls,
  frameToken,
  focus,
  shape,
  depth,
  outline,
  layout,
  skimmers,
  includeExternalStaircase,
  photoMode,
}: {
  radius: number;
  controls: React.RefObject<OrbitControlsImpl | null>;
  frameToken: number;
  focus: SceneFocus;
  shape: PoolShapeId;
  depth: number;
  outline: Outline;
  layout: PoolVerticalLayout;
  skimmers: SkimmerPlan;
  includeExternalStaircase: boolean;
  photoMode: boolean;
}) {
  const camera = useThree((state) => state.camera);
  const viewportSize = useThree((state) => state.size);
  const goal = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  const startPosition = useRef(new Vector3());
  const startTarget = useRef(new Vector3());
  const elapsed = useRef(0);
  const duration = useRef(1.15);
  const flying = useRef(false);

  useEffect(() => {
    const pose = getCameraPose({
      intent: focus,
      outline,
      layout,
      depth,
      skimmers,
      verticalFov: SCENE_VISUAL_PRESET.camera.fov,
      viewportAspect: viewportSize.width / Math.max(1, viewportSize.height),
      includeExternalStaircase,
    });
    goal.current.set(...pose.position);
    lookAt.current.set(...pose.target);
    startPosition.current.copy(camera.position);
    startTarget.current.copy(controls.current?.target ?? lookAt.current);
    elapsed.current = 0;
    duration.current = focus === "overview" || focus === "review" ? 0.88 : 0.78;
    flying.current =
      startPosition.current.distanceToSquared(goal.current) > 1e-10 ||
      startTarget.current.distanceToSquared(lookAt.current) > 1e-10;
  }, [
    camera,
    controls,
    frameToken,
    focus,
    shape,
    depth,
    outline,
    layout,
    skimmers,
    includeExternalStaircase,
    viewportSize.width,
    viewportSize.height,
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
}: {
  outline: Outline;
  size: number;
  theme: Theme;
  poolType: PoolType;
}) {
  const maxAnisotropy = useThree((state) => state.gl.capabilities.getMaxAnisotropy());
  const geometry = useMemo(() => {
    const half = size / 2;
    const outer: Outline = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ];
    return createSurfaceGeometry(
      outer,
      poolType === "in-ground" ? offsetOutline(outline, COPING_WIDTH) : undefined,
    );
  }, [outline, size, poolType]);

  useEffect(() => () => geometry.dispose(), [geometry]);
  const [normalMap, roughnessMap] = useMemo(() => {
    const normal = createMaterialMicroNormalMap();
    const roughness = createMaterialMicroRoughnessMap();
    const repeat = 1 / MATERIAL_MICRO_DETAIL_PRESET.studioFloor.moduleSize;
    for (const texture of [normal, roughness]) {
      texture.repeat.set(repeat, repeat);
      texture.anisotropy = Math.min(ACTIVE_RENDERING_QUALITY.textureAnisotropy, maxAnisotropy);
      texture.needsUpdate = true;
    }
    return [normal, roughness];
  }, [maxAnisotropy]);
  useEffect(
    () => () => {
      normalMap.dispose();
      roughnessMap.dispose();
    },
    [normalMap, roughnessMap],
  );

  return (
    <mesh geometry={geometry} position={[0, -0.002, 0]} receiveShadow>
      <meshStandardMaterial
        color={theme === "dark" ? "#151617" : "#d8d6d1"}
        roughness={0.94}
        normalMap={normalMap}
        normalScale={[
          MATERIAL_MICRO_DETAIL_PRESET.studioFloor.normalStrength,
          MATERIAL_MICRO_DETAIL_PRESET.studioFloor.normalStrength,
        ]}
        roughnessMap={roughnessMap}
        metalness={0}
      />
    </mesh>
  );
}

export default function PoolScene({
  outline,
  shape,
  system,
  overflowType,
  poolType,
  materials,
  features,
  skimmers,
  length,
  width,
  depth,
  showMeasurements,
  frameToken,
  focus,
  showWater,
  theme,
  photoMode,
  photoModeQuality,
  onPhotoModeUnsupported,
}: SceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const radius = Math.hypot(length, width) / 2;
  const palette = PALETTE[theme];
  const background = palette.background;
  const copingThickness = POOL_BORDER_PRESET.thickness;
  const verticalLayout = useMemo(
    () => getPoolVerticalLayout({ poolType, system, overflowType, depth, copingThickness }),
    [poolType, system, overflowType, depth, copingThickness],
  );

  const deckSize = useMemo(() => Math.max(40, radius * 14), [radius]);
  const sceneBounds = useMemo(() => outlineBounds(outline), [outline]);
  const shadowExtent =
    Math.max(sceneBounds.spanX, sceneBounds.spanZ) / 2 +
    SCENE_VISUAL_PRESET.lighting.sun.frustumMargin;
  const outlineSignature = useMemo(
    () => outline.map(([x, z]) => `${x.toFixed(4)},${z.toFixed(4)}`).join(";"),
    [outline],
  );
  const sunPosition: [number, number, number] = [radius * 2 + 6, radius * 2.4 + 12, radius + 6];
  // Remount PhotoModeRenderer (fresh WebGLPathTracer + setScene) whenever the
  // traced geometry or materials could have changed -- setScene is the
  // documented "relatively expensive" call, so a clean re-init on real scene
  // changes is simpler and safer than trying to patch the tracer in place.
  const photoModeSceneKey = [
    outlineSignature,
    system,
    overflowType,
    poolType,
    depth,
    showWater,
    materials.surface.textureUrl,
    materials.coping.color,
    features.join(","),
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
      dpr={ACTIVE_RENDERING_QUALITY.dpr}
      gl={{
        antialias: ACTIVE_RENDERING_QUALITY.antialias,
        // Retaining every WebGL back buffer causes sustained GPU-memory growth
        // in WebKit. Screenshots are not part of the current workflow, so the
        // renderer can safely release each frame after presentation.
        preserveDrawingBuffer: false,
        // Single ACES source of truth: three.js bakes toneMapping into every
        // material's own fragment shader, so it already runs once per pixel
        // inside the EffectComposer's own scene render pass. When the post
        // pass supplies its own <ToneMapping> effect (Experience tier) the
        // renderer must render linear/HDR instead, or ACES gets applied
        // twice. Configuration (no post pass) keeps the renderer doing ACES
        // directly, exactly as before.
        toneMapping: ACTIVE_RENDERING_QUALITY.postProcessing.enabled
          ? NoToneMapping
          : ACESFilmicToneMapping,
        toneMappingExposure: SCENE_VISUAL_PRESET.exposure[theme],
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
      <fog attach="fog" args={[background, radius * 6, radius * 20]} />

      {/* Real scene geometry standing in for a local HDRI: gives the planar
          water reflector (and the main view) a photographic sky gradient
          and sun glow to mirror, instead of a flat fill colour. Excluded in
          Photo Mode: it's a custom ShaderMaterial, which the path tracer
          cannot read anyway, and PhotoModeRenderer supplies its own
          equirectangular gradient environment instead. */}
      {!photoMode ? (
        <SkyDome
          theme={theme}
          sunDirection={sunPosition}
          sunColor={SCENE_VISUAL_PRESET.lighting.sun.color}
          sunVisibility={theme === "dark" ? 0.35 : 1}
        />
      ) : null}

      <hemisphereLight
        intensity={SCENE_VISUAL_PRESET.lighting.sky.intensity[theme]}
        color={SCENE_VISUAL_PRESET.lighting.sky.color}
        groundColor={SCENE_VISUAL_PRESET.lighting.sky.groundColor[theme]}
      />
      <directionalLight
        position={sunPosition}
        intensity={SCENE_VISUAL_PRESET.lighting.sun.intensity[theme]}
        color={SCENE_VISUAL_PRESET.lighting.sun.color}
        castShadow
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
        position={[-radius * 1.4, radius * 1.6 + 5, -radius * 0.8]}
        intensity={SCENE_VISUAL_PRESET.lighting.auxiliary.intensity[theme]}
        angle={0.65}
        penumbra={0.9}
        decay={2}
        distance={radius * 8}
        color={SCENE_VISUAL_PRESET.lighting.auxiliary.color[theme]}
      />
      {/* Local procedural reflections: no remote HDR request can reject and
          escape through the application-level React error boundary. */}
      <Environment
        resolution={ACTIVE_RENDERING_QUALITY.environmentResolution}
        environmentIntensity={SCENE_VISUAL_PRESET.environment[theme]}
      >
        <Lightformer
          form="rect"
          intensity={theme === "dark" ? 2.1 : 1.45}
          color={theme === "dark" ? "#dfe8ed" : "#eef6fb"}
          position={[0, 11, -5]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[24, 18, 1]}
        />
        <Lightformer
          form="rect"
          intensity={theme === "dark" ? 1.05 : 0.78}
          color="#e5d8c7"
          position={[-14, 4, 5]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[12, 7, 1]}
        />
        <Lightformer
          form="rect"
          intensity={theme === "dark" ? 0.72 : 0.52}
          color="#dce8ec"
          position={[12, 3, -7]}
          rotation={[0, -Math.PI / 3, 0]}
          scale={[10, 5, 1]}
        />
        {/* Extra angular coverage so PBR/water reflections read as more than a
            couple of flat rectangles: a low soft rim from the opposite side
            and a faint warm ground bounce underneath. */}
        <Lightformer
          form="rect"
          intensity={theme === "dark" ? 0.58 : 0.4}
          color={theme === "dark" ? "#c9d6e0" : "#fdf8ee"}
          position={[-10, 2.4, -9]}
          rotation={[0, Math.PI / 4, 0]}
          scale={[9, 5, 1]}
        />
        <Lightformer
          form="ring"
          intensity={theme === "dark" ? 0.3 : 0.22}
          color="#e8ddc9"
          position={[0, -1.5, 0]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[16, 16, 1]}
        />
      </Environment>

      <StudioFloor outline={outline} size={deckSize} theme={theme} poolType={poolType} />

      <PoolModel
        outline={outline}
        depth={depth}
        materials={materials}
        system={system}
        overflowType={overflowType}
        poolType={poolType}
        copingThickness={copingThickness}
        showWater={showWater}
      />

      {poolType === "above-ground" && features.includes("externalStaircase") ? (
        <ExternalStaircase
          outline={outline}
          groundY={verticalLayout.groundY}
          topY={verticalLayout.copingY}
        />
      ) : null}

      {system === "skimmer" ? (
        <Skimmers
          plan={skimmers}
          copingThickness={copingThickness}
          wallTopY={verticalLayout.wallTopY}
          color={materials.skimmer.color}
          roughness={materials.skimmer.roughness}
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
        />
      ) : null}

      {ACTIVE_RENDERING_QUALITY.contactShadows.enabled ? (
        <ContactShadows
          key={`${shape}-${length}-${width}-${depth}-${system}-${overflowType}-${poolType}-${outlineSignature}`}
          position={[
            0,
            poolType === "above-ground" ? verticalLayout.groundY + 0.002 : -0.35 + copingThickness,
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

      <OrbitControls
        ref={controls}
        makeDefault
        // Path-traced accumulation needs a perfectly static camera (see
        // PhotoModeRenderer): drei's OrbitControls only calls its own
        // .update() -- the call that applies damping's residual rotation --
        // while `enabled` is true, so disabling it here doesn't just ignore
        // new drag input, it stops the camera from drifting at all while
        // Photo Mode is active.
        enabled={!photoMode}
        enablePan
        enableZoom
        enableRotate
        enableDamping
        dampingFactor={0.06}
        rotateSpeed={0.55}
        zoomSpeed={0.7}
        panSpeed={0.6}
        minDistance={2}
        maxDistance={160}
        maxPolarAngle={Math.PI / 2.05}
      />
      <CameraRig
        radius={radius}
        controls={controls}
        frameToken={frameToken}
        focus={focus}
        shape={shape}
        depth={depth}
        outline={outline}
        layout={verticalLayout}
        skimmers={skimmers}
        photoMode={photoMode}
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

      {/* Photo Mode: takes over the render loop entirely (see
          PhotoModeRenderer's positive useFrame priority) to progressively
          accumulate a path-traced frame instead of the usual raster pass.
          Keyed so a structural change to the pool remounts it with a fresh
          WebGLPathTracer rather than trying to patch one in place. */}
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
