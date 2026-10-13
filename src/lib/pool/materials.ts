import { FINISHES, LINER_COLORS, SKIMMER_FINISHES } from "./config";
import { COPING_MATERIALS } from "./coping-materials";
import {
  POOL_SURFACE_PRESET,
  WATER_VISUAL_PRESET,
  MATERIAL_MICRO_DETAIL_PRESET,
} from "@/configurator/materials/visual-presets";
import {
  getInteriorTexture,
  getMosaicFinish,
  INTERIOR_TEXTURE_METADATA,
  PVC_TEXTURE_MODULE_SIZE_METERS,
} from "@/configurator/materials/interior-textures";
import type { PoolConfig, SkimmerTypeId } from "./types";

export interface ResolvedMaterials {
  liner: { color: string; roughness: number; metalness: number };
  floor: { color: string; roughness: number };
  surface: {
    kind: PoolConfig["finish"];
    calibrateSample: boolean;
    textureUrl: string;
    maps: {
      baseColorMap: string;
      normalMap?: string;
      roughnessMap?: string;
      aoMap?: string;
      bumpMap?: string;
    };
    textureMetadata: (typeof INTERIOR_TEXTURE_METADATA)[keyof typeof INTERIOR_TEXTURE_METADATA];
    tileSize: number;
    bumpScale: number;
    microDetail: { moduleSize: number; normalStrength: number };
    wallClearcoat: number;
    wallClearcoatRoughness: number;
    floorClearcoat: number;
    floorClearcoatRoughness: number;
    underwaterAbsorption: readonly [number, number, number];
    underwaterScatteringColor: readonly [number, number, number];
    underwaterScatteringStrength: number;
    underwaterCausticStrength: number;
    underwaterScatteringOpticalPathScale: number;
    underwaterAbsorptionOpticalPathScale: number;
    underwaterMaxScatteringEnergy: number;
    underwaterScatteringContribution: number;
  };
  water: string;
  coping: (typeof COPING_MATERIALS)[number];
  skimmer: { color: string; roughness: number; metalness: number; type: SkimmerTypeId };
}

export function resolveMaterials(
  config: Pick<
    PoolConfig,
    "finish" | "linerColor" | "mosaicFinish" | "skimmerFinish" | "skimmerType" | "copingMaterial"
  >,
): ResolvedMaterials {
  // Visible-inox pools do not use these finish maps in the scene, but the
  // common water pipeline still requires a stable fallback descriptor.
  const surfaceFinish = config.finish === "mosaic" ? "mosaic" : "liner";
  const finish = FINISHES.find((item) => item.id === surfaceFinish) ?? FINISHES[0]!;
  const liner = LINER_COLORS.find((item) => item.id === config.linerColor) ?? LINER_COLORS[0]!;
  const skimmerFinish =
    SKIMMER_FINISHES.find((item) => item.id === config.skimmerFinish) ?? SKIMMER_FINISHES[0]!;
  const mosaic = getMosaicFinish(config.mosaicFinish);
  const textureUrl = getInteriorTexture(surfaceFinish, config.linerColor, config.mosaicFinish);
  // Indicative PVC calibration using the existing sample, not a measured scan.
  const sandSample = config.finish === "liner" && config.linerColor === "motionSandBeach179";
  const linerModule = sandSample ? PVC_TEXTURE_MODULE_SIZE_METERS * 4 : PVC_TEXTURE_MODULE_SIZE_METERS;
  return {
    liner: {
      color: "#ffffff",
      roughness: config.finish === "mosaic" ? mosaic.materialSettings.roughness : sandSample ? 0.5 : finish.roughness,
      metalness: config.finish === "mosaic" ? mosaic.materialSettings.metalness : sandSample ? 0 : finish.metalness,
    },
    floor: {
      color: "#ffffff",
      roughness: config.finish === "mosaic" ? mosaic.materialSettings.roughness : sandSample ? 0.5 : finish.roughness,
    },
    surface: {
      kind: config.finish,
      calibrateSample: sandSample,
      textureUrl,
      maps: {
        baseColorMap: textureUrl,
      },
      textureMetadata:
        config.finish === "mosaic" ? mosaic.textureMetadata : {
          ...INTERIOR_TEXTURE_METADATA.liner,
          physicalWidth: linerModule,
          physicalHeight: linerModule,
        },
      // The sample's very fine grain needs a millimetric reading, not an
      // unresolvable subpixel field. Provisional until a metric scan exists.
      tileSize: config.finish === "mosaic" ? mosaic.tileSize : linerModule,
      // Nudged up from 0.003: at that strength the liner read as a
      // perfectly flat plastic sheet under close, stationary cameras --
      // still a subtle membrane relief, not a heavily textured surface.
      bumpScale: config.finish === "mosaic" ? 0 : 0.0055,
      microDetail:
        config.finish === "mosaic"
          ? MATERIAL_MICRO_DETAIL_PRESET.mosaic
          : sandSample ? { ...MATERIAL_MICRO_DETAIL_PRESET.liner, normalStrength: 1.4 } : MATERIAL_MICRO_DETAIL_PRESET.liner,
      wallClearcoat:
        config.finish === "mosaic"
          ? mosaic.materialSettings.clearcoat
          : POOL_SURFACE_PRESET.linerClearcoat,
      wallClearcoatRoughness:
        config.finish === "mosaic"
          ? mosaic.materialSettings.clearcoatRoughness
          : POOL_SURFACE_PRESET.linerClearcoatRoughness,
      floorClearcoat:
        config.finish === "mosaic"
          ? mosaic.materialSettings.clearcoat
          : POOL_SURFACE_PRESET.floorClearcoat,
      floorClearcoatRoughness:
        config.finish === "mosaic" ? mosaic.materialSettings.clearcoatRoughness : 0.28,
      underwaterAbsorption:
        config.finish === "mosaic" ? WATER_VISUAL_PRESET.absorption : liner.underwater.absorption,
      underwaterScatteringColor:
        config.finish === "mosaic"
          ? WATER_VISUAL_PRESET.scatteringColor
          : liner.underwater.scatteringColor,
      underwaterScatteringStrength:
        config.finish === "mosaic"
          ? WATER_VISUAL_PRESET.scatteringStrength
          : liner.underwater.scatteringStrength,
      underwaterCausticStrength:
        config.finish === "mosaic"
          ? WATER_VISUAL_PRESET.caustics.strength
          : liner.underwater.causticStrength,
      underwaterScatteringOpticalPathScale:
        config.finish === "mosaic" ? 1.0 : liner.underwater.scatteringOpticalPathScale,
      underwaterAbsorptionOpticalPathScale:
        config.finish === "mosaic" ? 1.0 : liner.underwater.absorptionOpticalPathScale,
      underwaterMaxScatteringEnergy:
        config.finish === "mosaic"
          ? WATER_VISUAL_PRESET.maxScatteringEnergy
          : liner.underwater.maxScatteringEnergy,
      underwaterScatteringContribution:
        config.finish === "mosaic"
          ? WATER_VISUAL_PRESET.scatteringContribution
          : liner.underwater.scatteringContribution,
    },
    water: "#ffffff",
    coping:
      COPING_MATERIALS.find((item) => item.id === config.copingMaterial) ?? COPING_MATERIALS[2],
    skimmer: {
      color: skimmerFinish.hex,
      roughness: skimmerFinish.roughness,
      metalness: skimmerFinish.metalness,
      type: config.skimmerType,
    },
  };
}
