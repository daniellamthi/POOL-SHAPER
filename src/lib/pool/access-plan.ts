import { resolveAccessPlan } from "@/components/pool/three/PoolAccessModel";
import { copingOuterOffset } from "@/components/pool/three/poolConstruction";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { buildOutline, computeMetrics } from "./geometry";
import { buildFloorProfile } from "./floor-profile";
import { getPoolVerticalLayout, type PoolVerticalLayout } from "./vertical-layout";
import { planSkimmers } from "./engineering";
import { infinityExclusion } from "./infinity-edge";
import type { PoolConfig, SystemType, OverflowType } from "./types";

/** Flanges sit on coping, or beyond an overflow channel on the ground deck. */
export function accessMounting(
  system: SystemType,
  overflow: OverflowType,
  layout: PoolVerticalLayout,
) {
  const beyondChannel = system === "overflow";
  return {
    ladderAnchorOffset: beyondChannel ? copingOuterOffset(system, overflow) + 0.12 : 0.2,
    ladderAnchorY: beyondChannel ? layout.groundY : layout.copingY,
    ladderDeckAvailable: !beyondChannel || layout.wallTopY <= layout.groundY + 0.01,
  };
}

/** Same plan for selector, validation and 3D. No extra saved selection state. */
export function configuredAccessPlan(config: PoolConfig) {
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const layout = getPoolVerticalLayout({
    poolType: config.poolType ?? "in-ground",
    system: config.system,
    overflowType: config.overflowType,
    depth: config.dimensions.depth,
    copingThickness: POOL_BORDER_PRESET.thickness,
  });
  const floorProfile = buildFloorProfile({
    outline,
    shape: config.shape,
    poolType: config.poolType ?? "in-ground",
    dimensions: config.dimensions,
    verticalLayout: layout,
    sunShelf: config.features.includes("sunShelf"),
    infinityEdge: config.system === "infinity" ? config.infinityEdge : null,
  });
  return resolveAccessPlan({
    outline,
    access: config.poolAccess,
    stairType: config.internalStairType ?? "linear",
    floorProfile,
    topY: layout.copingY,
    obstacles: planSkimmers(
      outline,
      computeMetrics(outline, config.dimensions.depth).waterSurface,
      config.system === "skimmer",
    ).positions,
    infinityExcluded:
      config.system === "infinity" && config.infinityEdge
        ? infinityExclusion(outline, config.infinityEdge, config.shape)
        : null,
    ...accessMounting(config.system, config.overflowType, layout),
  });
}
