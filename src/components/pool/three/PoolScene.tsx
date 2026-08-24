import { useEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { OrbitControls, Environment, Lightformer, ContactShadows } from "@react-three/drei";
import type { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { Vector3, ACESFilmicToneMapping, PCFSoftShadowMap } from "three";
import { PoolModel } from "./PoolModel";
import { PoolMeasurements } from "./PoolMeasurements";
import { Skimmers } from "./Skimmers";
import { createSurfaceGeometry } from "./poolGeometry";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import type { ResolvedMaterials } from "@/lib/pool/materials";
import type { Outline, PoolShapeId, SystemType } from "@/lib/pool/types";
import type { Theme } from "@/lib/theme";
import { SCENE_VISUAL_PRESET } from "@/configurator/3d/scene/visual-preset";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { COPING_WIDTH } from "@/lib/pool/config";
import { offsetOutline } from "@/lib/pool/geometry";

export type SceneFocus = "overview" | "skimmer" | "overflow" | "interior" | "review";

export interface SceneProps {
  outline: Outline;
  shape: PoolShapeId;
  system: SystemType;
  materials: ResolvedMaterials;
  skimmers: SkimmerPlan;
  length: number;
  width: number;
  depth: number;
  showMeasurements: boolean;
  frameToken: number;
  focus: SceneFocus;
  showWater: boolean;
  theme: Theme;
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

/** Smoothly restores a stable product view when dimensions or framing change. */
function CameraRig({
  radius,
  controls,
  frameToken,
  focus,
  shape,
  depth,
  width,
  skimmers,
}: {
  radius: number;
  controls: React.RefObject<OrbitControlsImpl | null>;
  frameToken: number;
  focus: SceneFocus;
  shape: PoolShapeId;
  depth: number;
  width: number;
  skimmers: SkimmerPlan;
}) {
  const camera = useThree((state) => state.camera);
  const goal = useRef(new Vector3());
  const lookAt = useRef(new Vector3());
  const startPosition = useRef(new Vector3());
  const startTarget = useRef(new Vector3());
  const elapsed = useRef(0);
  const duration = useRef(1.15);
  const flying = useRef(false);
  const systemDetail = useRef({ x: 0, z: -width / 2, rotation: 0 });

  useEffect(() => {
    const overviewDistance = Math.max(6, radius * SCENE_VISUAL_PRESET.camera.defaultDistanceFactor);

    const selectedSkimmer = skimmers.positions[Math.floor(skimmers.positions.length / 2)];
    if (selectedSkimmer) systemDetail.current = selectedSkimmer;

    if (focus === "skimmer" || focus === "overflow") {
      const detail = systemDetail.current;
      const distance = Math.min(4, Math.max(2.25, radius * 0.42));
      lookAt.current.set(detail.x, -0.1, detail.z);
      goal.current.set(
        detail.x - Math.sin(detail.rotation) * distance + 0.32,
        0.78,
        detail.z + Math.cos(detail.rotation) * distance + 0.18,
      );
    } else if (focus === "interior") {
      goal.current.set(0, -depth * 0.28, Math.min(width * 0.15, 1.1));
      lookAt.current.set(0, -depth * 0.82, -Math.min(width * 0.45, 2.6));
    } else {
      const elevation = focus === "review" ? 0.88 : 0.72;
      goal.current.set(0.92, elevation, 1.08).normalize().multiplyScalar(overviewDistance);
      lookAt.current.set(0, -0.08, 0);
    }
    startPosition.current.copy(camera.position);
    startTarget.current.copy(controls.current?.target ?? lookAt.current);
    elapsed.current = 0;
    duration.current = focus === "skimmer" || focus === "overflow" ? 1.35 : 1.15;
    flying.current = true;
  }, [camera, controls, radius, frameToken, focus, shape, depth, width, skimmers]);

  useFrame((_, delta) => {
    if (!flying.current) return;
    elapsed.current = Math.min(duration.current, elapsed.current + Math.min(delta, 0.05));
    const progress = duration.current === 0 ? 1 : elapsed.current / duration.current;
    const eased = progress * progress * progress * (progress * (progress * 6 - 15) + 10);
    camera.position.lerpVectors(startPosition.current, goal.current, eased);
    // A restrained vertical arc keeps the movement cinematic without changing
    // the final framing or introducing automotive-style camera theatrics.
    camera.position.y += Math.sin(progress * Math.PI) * Math.min(0.22, radius * 0.018);
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
function StudioFloor({ outline, size, theme }: { outline: Outline; size: number; theme: Theme }) {
  const geometry = useMemo(() => {
    const half = size / 2;
    const outer: Outline = [
      [-half, -half],
      [half, -half],
      [half, half],
      [-half, half],
    ];
    return createSurfaceGeometry(outer, offsetOutline(outline, COPING_WIDTH));
  }, [outline, size]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry} position={[0, -0.002, 0]} receiveShadow>
      <meshStandardMaterial
        color={theme === "dark" ? "#151617" : "#d8d6d1"}
        roughness={0.94}
        metalness={0}
      />
    </mesh>
  );
}

export default function PoolScene({
  outline,
  shape,
  system,
  materials,
  skimmers,
  length,
  width,
  depth,
  showMeasurements,
  frameToken,
  focus,
  showWater,
  theme,
}: SceneProps) {
  const controls = useRef<OrbitControlsImpl | null>(null);
  const radius = Math.hypot(length, width) / 2;
  const palette = PALETTE[theme];
  const background = palette.background;
  const copingThickness = POOL_BORDER_PRESET.thickness;

  const deckSize = useMemo(() => Math.max(40, radius * 14), [radius]);
  const dayIntensity = theme === "dark" ? 0.28 : 0.62;

  return (
    <Canvas
      shadows={{ type: PCFSoftShadowMap }}
      dpr={[1, SCENE_VISUAL_PRESET.renderer.maxDpr]}
      gl={{
        antialias: true,
        // Retaining every WebGL back buffer causes sustained GPU-memory growth
        // in WebKit. Screenshots are not part of the current workflow, so the
        // renderer can safely release each frame after presentation.
        preserveDrawingBuffer: false,
        toneMapping: ACESFilmicToneMapping,
        toneMappingExposure: SCENE_VISUAL_PRESET.exposure[theme],
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

      <hemisphereLight intensity={dayIntensity} color="#ffffff" groundColor="#1a1b1c" />
      <directionalLight
        position={[radius * 2 + 6, radius * 2.4 + 12, radius + 6]}
        intensity={theme === "dark" ? 1.12 : 1.58}
        castShadow
        shadow-bias={-0.0005}
        shadow-mapSize={[1024, 1024]}
        shadow-radius={3.5}
        shadow-camera-left={-Math.max(16, radius * 2.2)}
        shadow-camera-right={Math.max(16, radius * 2.2)}
        shadow-camera-top={Math.max(16, radius * 2.2)}
        shadow-camera-bottom={-Math.max(16, radius * 2.2)}
      />
      <spotLight
        position={[-radius * 1.4, radius * 1.6 + 5, -radius * 0.8]}
        intensity={theme === "dark" ? 10.5 : 7.2}
        angle={0.65}
        penumbra={0.9}
        decay={2}
        distance={radius * 8}
        color={theme === "dark" ? "#d9dde0" : "#fffaf2"}
      />
      {/* Local procedural reflections: no remote HDR request can reject and
          escape through the application-level React error boundary. */}
      <Environment resolution={128} environmentIntensity={SCENE_VISUAL_PRESET.environment[theme]}>
        <Lightformer
          form="rect"
          intensity={theme === "dark" ? 2.8 : 1.7}
          color={theme === "dark" ? "#d9e0e2" : "#ffffff"}
          position={[0, 8, -10]}
          rotation={[Math.PI / 2, 0, 0]}
          scale={[14, 14, 1]}
        />
        <Lightformer
          form="rect"
          intensity={theme === "dark" ? 1.4 : 1}
          color="#d7cfc3"
          position={[-10, 3, 4]}
          rotation={[0, Math.PI / 2, 0]}
          scale={[8, 5, 1]}
        />
        <Lightformer
          form="ring"
          intensity={theme === "dark" ? 1.1 : 0.72}
          color={theme === "dark" ? "#aab7b9" : "#f4eee5"}
          position={[8, 1.5, 8]}
          rotation={[0, -Math.PI / 4, 0]}
          scale={[4, 4, 1]}
        />
      </Environment>

      <StudioFloor outline={outline} size={deckSize} theme={theme} />

      <PoolModel
        outline={outline}
        depth={depth}
        materials={materials}
        system={system}
        copingThickness={copingThickness}
        showWater={showWater}
      />

      {system === "skimmer" ? <Skimmers plan={skimmers} copingThickness={copingThickness} /> : null}

      {showMeasurements ? (
        <PoolMeasurements
          outline={outline}
          length={length}
          width={width}
          depth={depth}
          color={palette.guide}
        />
      ) : null}

      <ContactShadows
        key={`${shape}-${length}-${width}-${depth}-${system}`}
        position={[0, -0.35 + copingThickness, 0]}
        opacity={palette.contact}
        scale={radius * 9}
        blur={SCENE_VISUAL_PRESET.contactShadow.blur}
        far={14}
        resolution={512}
        // The studio and pool transform are static; bake the contact shadow
        // once instead of allocating a 1024px shadow render target every frame.
        frames={1}
      />

      <OrbitControls
        ref={controls}
        makeDefault
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
        width={width}
        skimmers={skimmers}
      />
    </Canvas>
  );
}
