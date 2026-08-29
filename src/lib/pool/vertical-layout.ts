import { FREEBOARD } from "./config";
import { OVERFLOW_GEOMETRY } from "./config";
import type { OverflowType, PoolType, SystemType } from "./types";

export const GROUND_LEVEL = 0;
export const ABOVE_GROUND_STRUCTURE_THICKNESS = 0.16;

export interface PoolVerticalLayout {
  groundY: number;
  floorY: number;
  wallTopY: number;
  waterY: number;
  copingY: number;
}

/** Single source of truth for every vertical pool elevation, in metres. */
export function getPoolVerticalLayout({
  poolType,
  system,
  overflowType = "hidden",
  depth,
  copingThickness,
}: {
  poolType: PoolType;
  system: SystemType;
  overflowType?: OverflowType;
  depth: number;
  copingThickness: number;
}): PoolVerticalLayout {
  const safeDepth = Number.isFinite(depth) ? Math.max(0.01, depth) : 0.01;
  const wallTopY = poolType === "above-ground" ? GROUND_LEVEL + safeDepth : GROUND_LEVEL;
  const floorY = poolType === "above-ground" ? GROUND_LEVEL : GROUND_LEVEL - safeDepth;
  const waterY =
    system === "skimmer"
      ? wallTopY - FREEBOARD
      : overflowType === "visible"
        ? wallTopY +
          OVERFLOW_GEOMETRY.visibleGrateTopOffset +
          OVERFLOW_GEOMETRY.visibleWaterAboveLip
        : wallTopY - OVERFLOW_GEOMETRY.hiddenWaterTopClearance;

  return {
    groundY: GROUND_LEVEL,
    floorY,
    wallTopY,
    waterY,
    copingY: wallTopY + copingThickness,
  };
}
