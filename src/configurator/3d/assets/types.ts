import type { Material } from "three";

export type PremiumAssetId =
  "skimmer" | "overflowChannel" | "overflowGrid" | "drain" | "inlet" | "underwaterLight";

export type AssetQuality = "preview" | "standard" | "premium";

export interface AssetLod {
  quality: AssetQuality;
  url: string;
  /** Maximum recommended camera distance in metres. */
  maxDistance: number;
}

export interface AssetTransform {
  scale: readonly [number, number, number];
  rotation: readonly [number, number, number];
  position: readonly [number, number, number];
}

export interface PremiumAssetDescriptor {
  id: PremiumAssetId;
  label: string;
  /** Local URLs only. Remote assets are intentionally rejected by policy. */
  lods: ReadonlyArray<AssetLod>;
  transform: AssetTransform;
  variantNames: ReadonlyArray<string>;
  materialSlots: ReadonlyArray<string>;
  metadata: Readonly<Record<string, string | number | boolean>>;
}

export type MaterialOverride = Readonly<Record<string, Material>>;
