import { resolveComfortPlan, type ComfortPlan } from "./comfort-plan";
import { resolveAccessPlan } from "@/components/pool/three/PoolAccessModel";
import { accessMounting } from "./access-plan";
import { planSceneLighting, type SceneLightingPlan } from "./lighting-plan";
import { buildFloorProfile } from "./floor-profile";
import { buildOutline, computeMetrics } from "./geometry";
import { getPoolVerticalLayout } from "./vertical-layout";
import { planSkimmers } from "./engineering";
import { infinityExclusion } from "./infinity-edge";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import type { PoolConfig, PoolFeatureId, PoolShapeId, PoolType, PoolAccess } from "./types";

export type LayoutStatus = "VALID" | "AUTO_ADJUSTED" | "UNAVAILABLE";
export interface ResolvedPoolLayout {
  status: LayoutStatus;
  comfort: ComfortPlan;
  access: ReturnType<typeof resolveAccessPlan>;
  effectiveAccess: PoolAccess | null;
  lighting: SceneLightingPlan;
}
type LayoutInput = Parameters<typeof planSceneLighting>[0] & {
  shape: PoolShapeId;
  poolType: PoolType;
  features: ReadonlyArray<PoolFeatureId>;
};

export function comfortFootprints(plan: ComfortPlan) {
  return plan.elements.flatMap((element) => [
    element.footprint,
    ...(element.steps ?? []).map((step) => step.footprint),
    ...(element.landing ? [element.landing.footprint] : []),
  ]);
}

/** User intent -> comfort -> access -> free wall surfaces -> luminaires.
 * No resolved state is persisted; all consumers derive the same deterministic plan. */
export function resolvePoolLayout(input: LayoutInput): ResolvedPoolLayout {
  const missingShelfLanding =
    input.features.includes("sunShelf") &&
    input.floorProfile.sloped &&
    !input.floorProfile.shelfZone;
  const comfort = resolveComfortPlan({
    ...input,
    waterY: input.layout.waterY,
    enabled: missingShelfLanding
      ? input.features.filter((feature) => feature !== "sunShelf")
      : input.features,
  });
  if (missingShelfLanding)
    comfort.availability.sunShelf = {
      available: false,
      reason:
        "Profondità o spazio insufficienti per scala e pianerottolo regolari prima della pendenza.",
    };
  const integrated = comfort.elements.some((element) => element.kind === "sunShelf");
  const effectiveAccess = integrated && input.access === "internalSteps" ? null : input.access;
  const access = resolveAccessPlan({
    ...input,
    access: effectiveAccess,
    topY: input.layout.copingY,
    obstacles: input.skimmers.positions,
    reservedFootprints: comfortFootprints(comfort),
    ...accessMounting(input.system, input.overflowType, input.layout),
  });
  const lighting = planSceneLighting({ ...input, resolvedAccess: access, comfort });
  const unavailable =
    (input.features.includes("sunShelf") && !comfort.availability.sunShelf.available) ||
    (input.features.includes("integratedBench") &&
      !comfort.availability.integratedBench.available) ||
    (!!effectiveAccess && !access.placement);
  return {
    status: unavailable
      ? "UNAVAILABLE"
      : (integrated && input.access === "internalSteps") || comfort.adjusted
        ? "AUTO_ADJUSTED"
        : "VALID",
    comfort,
    access,
    effectiveAccess,
    lighting,
  };
}

export function configuredPoolLayout(config: PoolConfig): ResolvedPoolLayout {
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const poolType = config.poolType ?? "in-ground";
  const layout = getPoolVerticalLayout({
    poolType,
    system: config.system,
    overflowType: config.overflowType,
    depth: config.dimensions.depth,
    copingThickness: POOL_BORDER_PRESET.thickness,
  });
  const floorProfile = buildFloorProfile({
    outline,
    shape: config.shape,
    poolType,
    dimensions: config.dimensions,
    verticalLayout: layout,
    sunShelf: config.features.includes("sunShelf"),
    infinityEdge: config.system === "infinity" ? config.infinityEdge : null,
  });
  return resolvePoolLayout({
    outline,
    poolType,
    layout,
    floorProfile,
    shape: config.shape,
    system: config.system,
    overflowType: config.overflowType,
    features: config.features,
    access: config.poolAccess,
    stairType: config.internalStairType ?? "linear",
    skimmers: planSkimmers(
      outline,
      computeMetrics(outline, config.dimensions.depth).waterSurface,
      config.system === "skimmer",
    ),
    infinityExcluded:
      config.system === "infinity" && config.infinityEdge
        ? infinityExclusion(outline, config.infinityEdge, config.shape)
        : null,
  });
}
