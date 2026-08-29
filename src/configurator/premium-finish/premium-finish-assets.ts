import { LINER_COLORS } from "@/lib/pool/config";
import type { FinishMaterial, LinerColor, PoolType, SystemType } from "@/lib/pool/types";

export type PremiumFinishType = "pvc" | "mosaic";
export type PremiumPoolFamily = "inground" | "above-ground";
export type PremiumPoolSystem = "skimmer" | "overflow";

export interface PremiumFinishAsset {
  id: string;
  finishType: PremiumFinishType;
  finishId: LinerColor;
  commercialName: string;
  code: string;
  dryTexture: string;
  family: PremiumPoolFamily;
  system: PremiumPoolSystem;
  sources: {
    avif: { mobile: string; desktop: string };
    webp: { mobile: string; desktop: string };
  };
  fallbackAsset: "3d";
  alt: string;
  focalPoint: { x: number; y: number };
  preloadPriority: "selected" | "deferred";
}

export interface PremiumFinishConfig {
  poolType: PoolType | null;
  system: SystemType;
  finish: FinishMaterial;
  linerColor: LinerColor;
}

const LINER_FILE_STEMS: Record<LinerColor, { stem: string; code: string }> = {
  motionDeepSea603: { stem: "motion-deep-sea-603", code: "603" },
  motionBlueSky602: { stem: "motion-blue-sky-602", code: "602" },
  motionArcticWhite180: { stem: "motion-arctic-white-180", code: "180" },
  motionSandBeach179: { stem: "motion-sand-beach-179", code: "179" },
  motionGreyRock798: { stem: "motion-grey-rock-798", code: "798" },
  motionBlackStone799: { stem: "motion-black-stone-799", code: "799" },
};

const poolFamily = (poolType: PoolType | null): PremiumPoolFamily =>
  poolType === "above-ground" ? "above-ground" : "inground";

const poolSystem = (system: SystemType): PremiumPoolSystem =>
  system === "overflow" ? "overflow" : "skimmer";

function createAsset(
  family: PremiumPoolFamily,
  system: PremiumPoolSystem,
  linerColor: LinerColor,
): PremiumFinishAsset {
  const liner = LINER_COLORS.find((item) => item.id === linerColor) ?? LINER_COLORS[0]!;
  const { stem, code } = LINER_FILE_STEMS[linerColor];
  const root = `/premium-finishes/${family}/${system}`;
  const familyLabel = family === "above-ground" ? "fuori terra" : "interrata";
  const systemLabel = system === "overflow" ? "a sfioro" : "Skimmer";

  return {
    id: `${family}-${system}-${linerColor}`,
    finishType: "pvc",
    finishId: linerColor,
    commercialName: liner.title,
    code,
    dryTexture: liner.texture,
    family,
    system,
    sources: {
      avif: { mobile: `${root}/${stem}-960.avif`, desktop: `${root}/${stem}-1920.avif` },
      webp: { mobile: `${root}/${stem}-960.webp`, desktop: `${root}/${stem}-1920.webp` },
    },
    fallbackAsset: "3d",
    alt: `Piscina ${familyLabel} ${systemLabel} con rivestimento ${liner.title}`,
    focalPoint: { x: 50, y: 50 },
    preloadPriority: "deferred",
  };
}

export function resolvePremiumFinishAsset(config: PremiumFinishConfig): PremiumFinishAsset | null {
  if (config.finish !== "liner") return null;
  return {
    ...createAsset(poolFamily(config.poolType), poolSystem(config.system), config.linerColor),
    preloadPriority: "selected",
  };
}

export function resolvePremiumFinishFamilyAssets(
  config: PremiumFinishConfig,
): PremiumFinishAsset[] {
  if (config.finish !== "liner") return [];
  const family = poolFamily(config.poolType);
  const system = poolSystem(config.system);
  return LINER_COLORS.map((liner) => createAsset(family, system, liner.id));
}
