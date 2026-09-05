/**
 * Turns the live configurator's own state into a `PoolRenderConfig` --
 * nothing here re-implements pool math. Every derived number (outline,
 * vertical layout, resolved materials, camera pose) is produced by calling
 * the exact same functions the Three.js/R3F renderer calls, so the two
 * pipelines can never quietly disagree about where the water sits or what
 * the coping colour is.
 */
import { getPoolVerticalLayout } from "@/lib/pool/vertical-layout";
import { getCameraPose, type CameraIntent } from "@/lib/pool/camera";
import { resolveMaterials } from "@/lib/pool/materials";
import { COPING_WIDTH, EQUIPMENT, FINISHES, LINER_COLORS, POOL_FEATURES } from "@/lib/pool/config";
import { getMosaicFinish } from "@/configurator/materials/interior-textures";
import { POOL_BORDER_PRESET, WATER_VISUAL_PRESET } from "@/configurator/materials/visual-presets";
import { HDRI_BY_THEME } from "@/components/pool/three/PhotoModeRenderer";
import type { SkimmerPlan } from "@/lib/pool/engineering";
import type { Outline, PoolConfig } from "@/lib/pool/types";
import type { Theme } from "@/lib/theme";
import { DEFAULT_RENDER_OUTPUT_PRESET_ID, RENDER_OUTPUT_PRESETS } from "./outputPresets";
import type {
  PoolRenderAccessory,
  PoolRenderCameraPreset,
  PoolRenderConfig,
  PoolRenderOutputPresetId,
  PoolRenderStaircaseKind,
} from "./types";

export interface SerializePoolRenderConfigInput {
  config: PoolConfig;
  outline: Outline;
  skimmers: SkimmerPlan;
  theme: Theme;
}

export interface SerializePoolRenderConfigOptions {
  cameraPreset?: PoolRenderCameraPreset;
  outputPresetId?: PoolRenderOutputPresetId;
  /** Overrides the default aspect ratio (derived from the output preset) used to frame the camera. */
  viewportAspect?: number;
}

const CAMERA_PRESET_TO_INTENT: Record<PoolRenderCameraPreset, CameraIntent> = {
  hero: "review",
  overview: "overview",
  skimmer: "skimmer",
  overflow: "overflow",
  liner: "liner",
  mosaic: "mosaic",
};

const ENVIRONMENT_LABEL_BY_THEME: Record<Theme, "Sunny Day" | "Dusk"> = {
  light: "Sunny Day",
  dark: "Dusk",
};

function resolveStaircase(config: PoolConfig): {
  present: boolean;
  kind: PoolRenderStaircaseKind | null;
} {
  if (config.features.includes("externalStaircase")) return { present: true, kind: "external" };
  if (config.poolAccess === "internalSteps") return { present: true, kind: "internal-steps" };
  if (config.poolAccess === "stainlessSteelLadder")
    return { present: true, kind: "stainless-ladder" };
  return { present: false, kind: null };
}

function resolveAccessories(config: PoolConfig): ReadonlyArray<PoolRenderAccessory> {
  const features = config.features.map((id) => {
    const definition = POOL_FEATURES.find((feature) => feature.id === id);
    return { id, category: "feature" as const, title: definition?.title ?? id };
  });
  const equipment = config.equipment.map((id) => {
    const definition = EQUIPMENT.find((item) => item.id === id);
    return { id, category: "equipment" as const, title: definition?.title ?? id };
  });
  return [...features, ...equipment];
}

function resolveFinishDescriptor(
  config: PoolConfig,
  materials: ReturnType<typeof resolveMaterials>,
) {
  if (config.finish === "mosaic") {
    const mosaic = getMosaicFinish(config.mosaicFinish);
    const finishDefinition = FINISHES.find((item) => item.id === "mosaic");
    return {
      material: "mosaic" as const,
      colorId: mosaic.id,
      title: mosaic.name,
      baseColorHex: finishDefinition?.color ?? "#8fc4d2",
      textureUrl: mosaic.texture,
      roughness: materials.liner.roughness,
      metalness: materials.liner.metalness,
    };
  }
  const liner = LINER_COLORS.find((item) => item.id === config.linerColor) ?? LINER_COLORS[0]!;
  return {
    material: "liner" as const,
    colorId: liner.id,
    title: liner.title,
    baseColorHex: liner.hex,
    textureUrl: liner.texture,
    roughness: materials.liner.roughness,
    metalness: materials.liner.metalness,
  };
}

/**
 * Builds the canonical `PoolRenderConfig` for whatever the configurator is
 * showing right now. Pure function -- no DOM/React/Blender dependency -- so
 * it can be unit-tested and reused by both the "Generate Photorealistic
 * Render" button and any future automated golden-scene regeneration script.
 */
export function serializePoolRenderConfig(
  input: SerializePoolRenderConfigInput,
  options: SerializePoolRenderConfigOptions = {},
): PoolRenderConfig {
  const { config, outline, skimmers, theme } = input;
  const cameraPreset = options.cameraPreset ?? "hero";
  const outputPresetId = options.outputPresetId ?? DEFAULT_RENDER_OUTPUT_PRESET_ID;
  const outputPreset = RENDER_OUTPUT_PRESETS[outputPresetId];
  const viewportAspect = options.viewportAspect ?? outputPreset.width / outputPreset.height;

  const installation = config.poolType ?? "in-ground";
  const copingThickness = POOL_BORDER_PRESET.thickness;
  const layout = getPoolVerticalLayout({
    poolType: installation,
    system: config.system,
    overflowType: config.overflowType,
    depth: config.dimensions.depth,
    copingThickness,
  });

  const materials = resolveMaterials({
    finish: config.finish,
    linerColor: config.linerColor,
    mosaicFinish: config.mosaicFinish,
    skimmerFinish: config.skimmerFinish,
    skimmerType: config.skimmerType,
  });

  const cameraPose = getCameraPose({
    intent: CAMERA_PRESET_TO_INTENT[cameraPreset],
    outline,
    layout,
    depth: config.dimensions.depth,
    skimmers,
    viewportAspect,
    includeExternalStaircase: config.features.includes("externalStaircase"),
  });

  return {
    schemaVersion: 1,
    generatedAt: new Date().toISOString(),
    sourceProject: "pool-shape-shaper-main",
    shape: {
      kind: config.shape,
      outline,
    },
    dimensions: {
      length: config.dimensions.length,
      width: config.dimensions.width,
      depth: config.dimensions.depth,
      cornerRadius: config.dimensions.cornerRadius,
    },
    structure: {
      installation,
      system: config.system,
      overflowType: config.system === "overflow" ? config.overflowType : null,
    },
    verticalLayout: {
      groundY: layout.groundY,
      floorY: layout.floorY,
      wallTopY: layout.wallTopY,
      waterY: layout.waterY,
      copingY: layout.copingY,
      copingThickness,
      copingWidth: COPING_WIDTH,
    },
    finish: resolveFinishDescriptor(config, materials),
    coping: {
      colorHex: materials.coping.color,
      roughness: materials.coping.roughness,
      thickness: copingThickness,
      width: COPING_WIDTH,
    },
    water: {
      waterY: layout.waterY,
      ior: WATER_VISUAL_PRESET.ior,
      roughness: WATER_VISUAL_PRESET.roughness,
      transmission: WATER_VISUAL_PRESET.transmission,
      scatteringColor: WATER_VISUAL_PRESET.scatteringColor,
      absorption: WATER_VISUAL_PRESET.absorption,
      attenuationColorHex: WATER_VISUAL_PRESET.attenuationColor,
      attenuationDistance: WATER_VISUAL_PRESET.attenuationDistance,
    },
    staircase: resolveStaircase(config),
    accessories: resolveAccessories(config),
    camera: {
      preset: cameraPreset,
      position: cameraPose.position,
      target: cameraPose.target,
      verticalFovDeg: 35,
    },
    environment: {
      theme,
      label: ENVIRONMENT_LABEL_BY_THEME[theme],
      hdriUrl: HDRI_BY_THEME[theme],
    },
    outputPreset,
  };
}
