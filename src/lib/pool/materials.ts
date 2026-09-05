import { FINISHES, LINER_COLORS, SKIMMER_FINISHES } from "./config";
import {
  POOL_BORDER_PRESET,
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
import type { PoolConfig } from "./types";

export interface ResolvedMaterials {
  liner: { color: string; roughness: number; metalness: number };
  floor: { color: string; roughness: number };
  surface: {
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
  coping: { color: string; roughness: number };
  skimmer: { color: string; roughness: number };
}

export function resolveMaterials(
  config: Pick<PoolConfig, "finish" | "linerColor" | "mosaicFinish" | "skimmerFinish">,
): ResolvedMaterials {
  const finish = FINISHES.find((item) => item.id === config.finish) ?? FINISHES[0]!;
  const liner = LINER_COLORS.find((item) => item.id === config.linerColor) ?? LINER_COLORS[0]!;
  const skimmerFinish =
    SKIMMER_FINISHES.find((item) => item.id === config.skimmerFinish) ?? SKIMMER_FINISHES[0]!;
  const mosaic = getMosaicFinish(config.mosaicFinish);
  const textureUrl = getInteriorTexture(config.finish, config.linerColor, config.mosaicFinish);
  return {
    liner: {
      color: "#ffffff",
      roughness: config.finish === "mosaic" ? mosaic.materialSettings.roughness : finish.roughness,
      metalness: config.finish === "mosaic" ? mosaic.materialSettings.metalness : finish.metalness,
    },
    floor: {
      color: "#ffffff",
      roughness: config.finish === "mosaic" ? mosaic.materialSettings.roughness : finish.roughness,
    },
    surface: {
      textureUrl,
      maps: {
        baseColorMap: textureUrl,
      },
      textureMetadata:
        config.finish === "mosaic" ? mosaic.textureMetadata : INTERIOR_TEXTURE_METADATA.liner,
      tileSize: config.finish === "mosaic" ? mosaic.tileSize : PVC_TEXTURE_MODULE_SIZE_METERS,
      bumpScale: config.finish === "mosaic" ? 0 : 0.003,
      microDetail:
        config.finish === "mosaic"
          ? MATERIAL_MICRO_DETAIL_PRESET.mosaic
          : MATERIAL_MICRO_DETAIL_PRESET.liner,
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
    coping: { color: POOL_BORDER_PRESET.color, roughness: POOL_BORDER_PRESET.roughness },
    skimmer: { color: skimmerFinish.hex, roughness: skimmerFinish.roughness },
  };
}
