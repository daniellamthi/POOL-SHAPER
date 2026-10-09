import { resolveComfortPlan, normalizeComfortFeatures, type ComfortPlan } from "./comfort-plan";
import { resolveAccessPlan } from "@/components/pool/three/PoolAccessModel";
import { accessMounting } from "./access-plan";
import { planSceneLighting, type SceneLightingPlan } from "./lighting-plan";
import { buildFloorProfile } from "./floor-profile";
import { buildOutline, computeMetrics, outlineBounds } from "./geometry";
import { getPoolVerticalLayout } from "./vertical-layout";
import { planSkimmers } from "./engineering";
import { infinityExclusion } from "./infinity-edge";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import type {
  HydromassageVariant,
  Outline,
  PoolConfig,
  PoolFeatureId,
  PoolShapeId,
  PoolType,
  PoolAccess,
} from "./types";

export type LayoutStatus = "VALID" | "AUTO_ADJUSTED" | "UNAVAILABLE";
export interface ResolvedPoolLayout {
  status: LayoutStatus;
  comfort: ComfortPlan;
  access: ReturnType<typeof resolveAccessPlan>;
  effectiveAccess: PoolAccess | null;
  /** Optional inox ladder added next to internal steps/comfort; null when not requested. */
  ladder: null | {
    plan: ReturnType<typeof resolveAccessPlan>;
    status: "VALID" | "REPOSITION" | "UNAVAILABLE";
  };
  lighting: SceneLightingPlan;
}
type LayoutInput = Parameters<typeof planSceneLighting>[0] & {
  stairMirrored?: boolean;
  shape: PoolShapeId;
  poolType: PoolType;
  features: ReadonlyArray<PoolFeatureId>;
  hydromassageVariant?: HydromassageVariant | undefined;
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
  // Sun shelf XOR hydromassage: one decision shared by UI, 3D, summary and persistence.
  const features = normalizeComfortFeatures(input.features);
  const wantsFlightZone = features.includes("sunShelf") || features.includes("hydromassage");
  const missingShelfLanding =
    wantsFlightZone && input.floorProfile.sloped && !input.floorProfile.shelfZone;
  const comfort = resolveComfortPlan({
    ...input,
    waterY: input.layout.waterY,
    enabled: missingShelfLanding
      ? features.filter((feature) => feature !== "sunShelf" && feature !== "hydromassage")
      : features,
  });
  if (missingShelfLanding) {
    const reason =
      "Profondità o spazio insufficienti per scala e pianerottolo regolari prima della pendenza.";
    if (features.includes("sunShelf")) comfort.availability.sunShelf = { available: false, reason };
    if (features.includes("hydromassage"))
      comfort.availability.hydromassage = { available: false, reason };
  }
  const integrated = comfort.elements.some(
    (element) => element.kind === "sunShelf" || element.kind === "hydromassage",
  );
  const ladderAsAddon = input.poolType !== "above-ground" && input.access === "internalSteps" && features.includes("inoxLadder");
  const effectiveAccess = (input.poolType === "above-ground" && input.access === "stainlessSteelLadder") ||
    (integrated && input.access === "internalSteps") ? null : input.access;
  const mounting = accessMounting(input.system, input.overflowType, input.layout);
  const resolve = (access: PoolAccess | null, reserved: ReadonlyArray<Outline>) => {
    const request = {
      ...input,
      access,
      topY: input.layout.copingY,
      obstacles: input.skimmers.positions,
      reservedFootprints: reserved,
      ...mounting,
      rectangularCorner: input.poolType === "above-ground",
    };
    const normal=resolveAccessPlan(request);
    if(input.poolType!=="above-ground" || !input.stairMirrored || access!=="internalSteps" || !normal.placement) return normal;
    const bounds=outlineBounds(input.outline),p=normal.placement,longX=bounds.spanX>=bounds.spanZ;
    return resolveAccessPlan({...request,mirrorAnchor:{
      x:longX?p.x:bounds.minX+bounds.maxX-p.x,
      z:longX?bounds.minZ+bounds.maxZ-p.z:p.z,
    }});
  };
  const comfortReserved = comfortFootprints(comfort);
  const access = resolve(effectiveAccess, comfortReserved);
  let ladder: ResolvedPoolLayout["ladder"] = null;
  if (ladderAsAddon) {
    const plan = resolve("stainlessSteelLadder", [
      ...comfortReserved,
      ...(access.placement ? [access.footprint] : []),
    ]);
    const free = resolve("stainlessSteelLadder", comfortReserved);
    const moved =
      !!plan.placement && !!free.placement &&
      (Math.abs(plan.placement.x - free.placement.x) > 1e-6 ||
        Math.abs(plan.placement.z - free.placement.z) > 1e-6);
    ladder = { plan, status: !plan.placement ? "UNAVAILABLE" : moved ? "REPOSITION" : "VALID" };
  }
  const lighting = planSceneLighting({
    ...input,
    resolvedAccess: access,
    resolvedLadder: ladder?.plan ?? null,
    comfort,
  });
  const unavailable =
    (features.includes("sunShelf") && !comfort.availability.sunShelf.available) ||
    (features.includes("hydromassage") &&
      !features.includes("sunShelf") &&
      !comfort.availability.hydromassage.available) ||
    (features.includes("integratedBench") &&
      !comfort.availability.integratedBench.available) ||
    (!!effectiveAccess && !access.placement) ||
    ladder?.status === "UNAVAILABLE";
  return {
    status: unavailable
      ? "UNAVAILABLE"
      : (integrated && input.access === "internalSteps") || comfort.adjusted || ladder?.status === "REPOSITION"
        ? "AUTO_ADJUSTED"
        : "VALID",
    comfort,
    access,
    effectiveAccess,
    ladder,
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
    sunShelf: config.features.includes("sunShelf") || config.features.includes("hydromassage"),
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
    hydromassageVariant: config.hydromassageVariant,
    access: config.poolAccess,
    stairType: config.internalStairType ?? "linear",
    stairMirrored: !!config.internalStairMirrored,
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
