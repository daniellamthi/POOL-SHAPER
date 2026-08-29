import type { FinishMaterial, LinerColor, MosaicFinishId } from "@/lib/pool/types";
import { MOSAIC_ASSETS } from "./mosaic-assets.generated";

const mosaicTextureUrl = (filename: string) => `/textures/mosaico/${encodeURIComponent(filename)}`;
export const MOSAIC_TEXTURE_MODULE_SIZE_METERS = 8 * 0.025;
export const PVC_TEXTURE_MODULE_SIZE_METERS = 0.7;

export interface InteriorTextureMetadata {
  /** Physical dimensions represented by one repeat. PVC values await catalogue calibration. */
  physicalWidth: number;
  physicalHeight: number;
  tileSize?: number;
  colorSpace: "srgb" | "linear";
  textureType: "base-color" | "normal" | "roughness" | "ao" | "bump";
  repeatStrategy: "world-space" | "surface-perimeter";
}

export interface InteriorMaterialMaps {
  baseColorMap: string;
  normalMap?: string;
  roughnessMap?: string;
  aoMap?: string;
  bumpMap?: string;
}

export interface MosaicFinishDefinition {
  id: MosaicFinishId;
  name: string;
  preview: string;
  texture: string;
  /** Physical width and height represented by one texture repeat, in metres. */
  tileSize: number;
  textureMetadata: InteriorTextureMetadata;
  maps: InteriorMaterialMaps;
  materialSettings: {
    roughness: number;
    metalness: number;
    clearcoat: number;
    clearcoatRoughness: number;
  };
}

export const MOSAIC_FINISHES: ReadonlyArray<MosaicFinishDefinition> = MOSAIC_ASSETS.map(
  ({ id, name, filename }) => ({
    id: id as MosaicFinishId,
    name,
    preview: mosaicTextureUrl(filename),
    texture: mosaicTextureUrl(filename),
    tileSize: MOSAIC_TEXTURE_MODULE_SIZE_METERS,
    textureMetadata: {
      physicalWidth: MOSAIC_TEXTURE_MODULE_SIZE_METERS,
      physicalHeight: MOSAIC_TEXTURE_MODULE_SIZE_METERS,
      tileSize: MOSAIC_TEXTURE_MODULE_SIZE_METERS,
      colorSpace: "srgb",
      textureType: "base-color",
      repeatStrategy: "world-space",
    },
    maps: { baseColorMap: mosaicTextureUrl(filename) },
    materialSettings: {
      roughness: 0.18,
      metalness: 0,
      clearcoat: 0.32,
      clearcoatRoughness: 0.16,
    },
  }),
);

const defaultMosaicTexture = MOSAIC_FINISHES[0]!.texture;
export const DEFAULT_MOSAIC_FINISH_ID = MOSAIC_FINISHES[0]!.id;

export const getMosaicFinish = (id: MosaicFinishId) =>
  MOSAIC_FINISHES.find((finish) => finish.id === id) ?? MOSAIC_FINISHES[0]!;

/**
 * Central replacement map for production textures. Replace an imported file
 * or point an individual colour to a new asset without touching the 3D scene.
 */
export const INTERIOR_TEXTURES: Readonly<
  Record<FinishMaterial, Readonly<Record<LinerColor, string>>>
> = {
  liner: {
    motionDeepSea603: "/textures/pvc-liner/motion-deep-sea-603.png",
    motionBlueSky602: "/textures/pvc-liner/motion-blue-sky-602.png",
    motionArcticWhite180: "/textures/pvc-liner/motion-arctic-white-180.png",
    motionSandBeach179: "/textures/pvc-liner/motion-sand-beach-179.png",
    motionGreyRock798: "/textures/pvc-liner/motion-grey-rock-798.png",
    motionBlackStone799: "/textures/pvc-liner/motion-black-stone-799.png",
  },
  mosaic: {
    motionDeepSea603: defaultMosaicTexture,
    motionBlueSky602: defaultMosaicTexture,
    motionArcticWhite180: defaultMosaicTexture,
    motionSandBeach179: defaultMosaicTexture,
    motionGreyRock798: defaultMosaicTexture,
    motionBlackStone799: defaultMosaicTexture,
  },
};

/** P0 metadata only: the 0.7 m PVC module preserves the current visual scale. */
export const INTERIOR_TEXTURE_METADATA: Readonly<Record<FinishMaterial, InteriorTextureMetadata>> =
  {
    liner: {
      physicalWidth: PVC_TEXTURE_MODULE_SIZE_METERS,
      physicalHeight: PVC_TEXTURE_MODULE_SIZE_METERS,
      colorSpace: "srgb",
      textureType: "base-color",
      repeatStrategy: "world-space",
    },
    mosaic: {
      physicalWidth: MOSAIC_TEXTURE_MODULE_SIZE_METERS,
      physicalHeight: MOSAIC_TEXTURE_MODULE_SIZE_METERS,
      tileSize: MOSAIC_TEXTURE_MODULE_SIZE_METERS,
      colorSpace: "srgb",
      textureType: "base-color",
      repeatStrategy: "world-space",
    },
  };

export const getInteriorTexture = (
  finish: FinishMaterial,
  color: LinerColor,
  mosaicFinish: MosaicFinishId,
) =>
  finish === "mosaic" ? getMosaicFinish(mosaicFinish).texture : INTERIOR_TEXTURES[finish][color];
