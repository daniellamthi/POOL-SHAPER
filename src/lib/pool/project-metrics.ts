/**
 * Pure derivation of the basin's metrics from a configuration -- the one
 * computation the live configurator, the Premium Summary and the Project
 * Book PDF all use, so their numbers can never disagree.
 */
import { buildOutline, computeMetrics } from "./geometry";
import { buildFloorProfile, computeSlopeMetrics } from "./floor-profile";
import { getPoolVerticalLayout } from "./vertical-layout";
import { configuredComfortPlan } from "./comfort-plan";
import { planSkimmers } from "./engineering";
import type { Outline, PoolConfig } from "./types";

export function projectMetrics(config: PoolConfig, outline: Outline) {
  // `copingThickness` only ever feeds `copingY`, never floor/water/wall
  // elevations -- passing 0 here keeps metrics decoupled from the
  // configurator's material/visual-preset layer for a value they never read.
  const verticalLayout = getPoolVerticalLayout({
    poolType: config.poolType ?? "in-ground",
    system: config.system,
    overflowType: config.overflowType,
    depth: config.dimensions.depth,
    copingThickness: 0,
  });
  const floorProfile = buildFloorProfile({
    outline,
    shape: config.shape,
    poolType: config.poolType ?? "in-ground",
    dimensions: config.dimensions,
    verticalLayout,
    sunShelf: config.features.includes("sunShelf") || config.features.includes("hydromassage"),
    infinityEdge: config.system === "infinity" ? config.infinityEdge : null,
  });
  const baseMetrics = floorProfile.sloped
    ? computeSlopeMetrics(outline, floorProfile, verticalLayout.waterY, verticalLayout.wallTopY)
    : computeMetrics(outline, config.dimensions.depth);
  const comfort = configuredComfortPlan(config);
  return {
    ...baseMetrics,
    waterVolume: Math.max(0, baseMetrics.waterVolume - comfort.displacedVolume),
  };
}

export type ProjectMetrics = ReturnType<typeof projectMetrics>;

/** Outline, metrics and skimmer plan of a configuration, as the scene uses them. */
export function projectGeometry(config: PoolConfig) {
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const metrics = projectMetrics(config, outline);
  const skimmers = planSkimmers(outline, metrics.waterSurface, config.system === "skimmer");
  return { outline, metrics, skimmers };
}
