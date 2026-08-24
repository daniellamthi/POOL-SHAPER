import type { AssetQuality, PremiumAssetDescriptor, PremiumAssetId } from "./types";

/**
 * Production asset registry. Descriptors are added only when a licensed local
 * GLB/GLTF exists under configurator/assets/models; the active renderer keeps
 * its stable procedural fallback for every missing descriptor.
 */
export const PREMIUM_ASSET_LIBRARY: Readonly<
  Partial<Record<PremiumAssetId, PremiumAssetDescriptor>>
> = {};

export function getPremiumAsset(id: PremiumAssetId): PremiumAssetDescriptor | undefined {
  return PREMIUM_ASSET_LIBRARY[id];
}

export function selectAssetLod(descriptor: PremiumAssetDescriptor, quality: AssetQuality) {
  const exact = descriptor.lods.find((lod) => lod.quality === quality);
  return exact ?? descriptor.lods.at(-1);
}

export function isLocalAssetUrl(url: string): boolean {
  return url.startsWith("/") && !url.startsWith("//");
}
