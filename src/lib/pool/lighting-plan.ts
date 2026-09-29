import { resolveAccessPlan } from "@/components/pool/three/PoolAccessModel";
import { accessMounting } from "./access-plan";
import { planPoolLighting, type LightingExclusion, type PoolLightingPlan } from "./lighting";
import type {
  InternalStairType,
  Outline,
  PoolAccess,
  PoolConfig,
  SystemType,
  OverflowType,
} from "./types";
import type { SkimmerPlan } from "./engineering";
import { planSkimmers } from "./engineering";
import type { InfinityExclusion } from "./walls";
import { getPoolVerticalLayout, type PoolVerticalLayout } from "./vertical-layout";
import { buildFloorProfile, type FloorProfileModel } from "./floor-profile";
import { buildOutline, computeMetrics } from "./geometry";
import { infinityExclusion } from "./infinity-edge";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
export interface SceneLightingPlan {
  accessPlan: ReturnType<typeof resolveAccessPlan>;
  plan: PoolLightingPlan;
  shadowIndex: number;
  convexQuad: boolean;
}

/**
 * The single source of truth for where the luminaires end up.
 *
 * Hoisted out of the component so the camera can be aimed at the row that is
 * actually built. `planPoolLighting` falls through to the second-longest wall
 * whenever skimmers or the access steps obstruct the first, so anything that
 * re-derives the wall independently -- as the lighting-step camera used to --
 * can end up framing the opposite side of the basin, with the fixtures behind
 * the viewer.
 */
export function planSceneLighting({
  outline,
  layout,
  skimmers,
  access,
  stairType = "linear",
  floorProfile,
  infinityExcluded = null,
  system,
  overflowType,
}: {
  outline: Outline;
  layout: PoolVerticalLayout;
  skimmers: SkimmerPlan;
  access: PoolAccess | null;
  stairType?: InternalStairType;
  /** Geometry Pass A follow-up: threaded through to `cornerStairPlan`/
   * `accessPlacement` so the LED exclusion footprint always matches wherever
   * the stairs actually ended up (possibly the shallow end on a sloped
   * floor) rather than a stale, unbiased placement. */
  floorProfile: FloorProfileModel;
  system: SystemType;
  overflowType: OverflowType;
  /** Geometry Pass D (Infinity): keeps the LED row, and the access exclusion
   * footprint it's derived from, off the selected side. `null` (every
   * pre-Infinity call) is a complete no-op. */
  infinityExcluded?: InfinityExclusion | null;
}): SceneLightingPlan {
  const exclusions: LightingExclusion[] = skimmers.positions.map((p) => ({
    kind: "skimmer",
    x: p.x,
    z: p.z,
    radius: 0.65,
  }));
  const accessPlan = resolveAccessPlan({
    outline,
    access,
    stairType,
    floorProfile,
    topY: layout.copingY,
    infinityExcluded,
    obstacles: skimmers.positions,
    ...accessMounting(system, overflowType, layout),
  });
  const accessPoint = accessPlan.placement;
  if (accessPoint)
    exclusions.push({ kind: "access", polygon: accessPlan.footprint, clearance: 0.2 });
  const plan = planPoolLighting({
    outline,
    waterY: layout.waterY,
    floorY: layout.floorY,
    ...(floorProfile ? { floorYAt: floorProfile.floorYAt } : {}),
    exclusions,
    infinityExcluded,
  });
  // In a convex rectangle the basin walls cannot occlude one another. Keep
  // the dominant access shadow; distant fill lights are intentionally soft.
  // Non-rectangular outlines retain full occlusion for re-entrant corners.
  let shadowIndex = -1,
    nearest = Infinity;
  if (accessPoint)
    plan.positions.forEach((p, i) => {
      const distance = Math.hypot(p.x - accessPoint.x, p.z - accessPoint.z);
      if (distance < nearest) {
        nearest = distance;
        shadowIndex = i;
      }
    });
  const turns = outline.map((a, i) => {
    const b = outline[(i + 1) % outline.length]!,
      c = outline[(i + 2) % outline.length]!;
    return (b[0] - a[0]) * (c[1] - b[1]) - (b[1] - a[1]) * (c[0] - b[0]);
  });
  const convexQuad =
    outline.length === 4 && (turns.every((v) => v > 0) || turns.every((v) => v < 0));
  return { plan, shadowIndex, convexQuad, accessPlan };
}

/** UI, summary and commercial export use the exact same obstacles/elevations as the 3D scene. */
export function configuredLightingPlan(config: PoolConfig) {
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
  const skimmers = planSkimmers(
    outline,
    computeMetrics(outline, config.dimensions.depth).waterSurface,
    config.system === "skimmer",
  );
  return planSceneLighting({
    system: config.system,
    overflowType: config.overflowType,
    outline,
    layout,
    floorProfile,
    skimmers,
    access: config.poolAccess,
    stairType: config.internalStairType ?? "linear",
    infinityExcluded:
      config.system === "infinity" && config.infinityEdge
        ? infinityExclusion(outline, config.infinityEdge, config.shape)
        : null,
  }).plan;
}
