import { resolveComfortPlan, normalizeComfortFeatures, type ComfortPlan } from "./comfort-plan";
import { ACCESS_DIMENSIONS, resolveAccessPlan } from "@/components/pool/three/PoolAccessModel";
import { accessMounting } from "./access-plan";
import { planSceneLighting, type SceneLightingPlan } from "./lighting-plan";
import { buildFloorProfile } from "./floor-profile";
import { computeMetrics, outlineBounds } from "./geometry";
import { configuredOutline } from "./configured-outline";
import { getPoolVerticalLayout } from "./vertical-layout";
import { planSkimmers } from "./engineering";
import { infinityExclusion } from "./infinity-edge";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { planStairMicroSpots, type StairMicroSpot } from "./stair-lighting";
import type {
  HydromassageVariant,
  Outline,
  PoolConfig,
  PoolFeatureId,
  PoolShapeId,
  PoolType,
  PoolAccess,
  InternalStairPosition,
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
  stairMicroSpots: ReadonlyArray<StairMicroSpot>;
}
type LayoutInput = Parameters<typeof planSceneLighting>[0] & {
  stairMirrored?: boolean;
  stairPosition?: InternalStairPosition | undefined;
  stairWidth?: number | undefined;
  shape: PoolShapeId;
  poolType: PoolType;
  features: ReadonlyArray<PoolFeatureId>;
  hydromassageVariant?: HydromassageVariant | undefined;
  infinityWallType?: "traditional" | "glass" | undefined;
  nominalWidth?: number;
  sunShelfRun?: number | undefined;
  integratedBenchStations?: number | undefined;
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
  const incompatibleHydro = input.access === "internalSteps" && input.stairType !== "corner" && features.includes("hydromassage");
  const separateCorner = input.poolType === "in-ground" && input.access === "internalSteps" && input.stairType === "corner";
  const comfort = resolveComfortPlan({
    ...input,
    stairWidth: separateCorner ? undefined : input.stairWidth,
    stairMirrored: separateCorner ? false : !!input.stairMirrored,
    separateShelfAccess: separateCorner,
    separateHydroAccess: separateCorner,
    waterY: input.layout.waterY,
    enabled: missingShelfLanding
      ? features.filter((feature) => feature !== "sunShelf" && feature !== "hydromassage")
      : incompatibleHydro ? features.filter(feature => feature !== "hydromassage") : features,
  });
  if (incompatibleHydro) {
    comfort.availability.hydromassage = { available: false, reason: "L’idromassaggio richiede la scala angolare. Scegli Angolare oppure abbina la rettilinea alla spiaggetta." };
  }
  if (missingShelfLanding) {
    const reason =
      "Profondità o spazio insufficienti per scala e pianerottolo regolari prima della pendenza.";
    if (features.includes("sunShelf")) comfort.availability.sunShelf = { available: false, reason };
    if (features.includes("hydromassage"))
      comfort.availability.hydromassage = { available: false, reason };
  }
  const integrated = comfort.elements.some(
    (element) => (element.kind === "sunShelf" || element.kind === "hydromassage") && !!element.steps?.length,
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
    // Keep the chosen head-wall corner while widening, rather than jumping to a different wall.
    const automatic = input.stairWidth !== undefined && access === "internalSteps" && input.stairType !== "corner"
      ? resolveAccessPlan({ ...request, stairWidth: undefined }) : null;
    const normal=resolveAccessPlan({ ...request, ...(automatic?.placement ? { stairWidthAnchor: automatic.footprint } : {}) });
    // On a shelf layout the fitting row adapts to the entrance, never the
    // reverse: derive the mirror anchor without the newly moved skimmers.
    const mirrorSource = input.stairMirrored && access === "internalSteps" && comfort.elements.some(element => element.kind === "sunShelf")
      ? resolveAccessPlan({ ...request, obstacles: [] }) : normal;
    if(input.stairPosition || !input.stairMirrored || access!=="internalSteps" || !mirrorSource.placement) return normal;
    const bounds=outlineBounds(input.outline),p=mirrorSource.placement,longX=bounds.spanX>=bounds.spanZ;
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
  const activeComfort = comfort.elements.find(element => element.kind === "sunShelf" || element.kind === "hydromassage");
  if (activeComfort && ((!!effectiveAccess && !access.placement) || ladder?.status === "UNAVAILABLE")) {
    const reason = access.reason ?? ladder?.plan.reason ?? "Accesso incompatibile con la zona comfort selezionata.";
    // Preserve requested data but never build a comfort zone that consumes the
    // only selected entrance. Re-resolve the unchanged access without that zone.
    // Removing both flight kinds guarantees this fallback cannot recurse again.
    const fallback = resolvePoolLayout({ ...input, features: features.filter(feature =>
      !["sunShelf", "hydromassage", "integratedBench", "sunShelfLoungers"].includes(feature)) });
    fallback.comfort.availability[activeComfort.kind] = { available: false, reason };
    return { ...fallback, status: "UNAVAILABLE" };
  }
  if (input.skimmers.reason && features.includes("sunShelf"))
    comfort.availability.sunShelf = { available: false, reason: input.skimmers.reason };
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
    stairMicroSpots: planStairMicroSpots(access, comfort, input.layout.copingY, input.floorProfile),
  };
}

/** Only actual, selected riser fittings may appear in commercial exports or night controls. */
export function configuredStairMicroSpots(config: PoolConfig): ReadonlyArray<StairMicroSpot> {
  return config.features.includes("stairLighting") ? configuredPoolLayout(config).stairMicroSpots : [];
}

export function configuredLayoutWithSkimmers(config: PoolConfig) {
  const outline = configuredOutline(config);
  const poolType = config.poolType ?? "in-ground";
  const layout = getPoolVerticalLayout({
    poolType,
    system: config.system,
    overflowType: config.overflowType,
    depth: config.dimensions.depth,
    copingThickness: POOL_BORDER_PRESET.thickness,
    copingStyle: config.copingStyle,
  });
  const floorProfile = buildFloorProfile({
    outline,
    shape: config.shape,
    poolType,
    dimensions: config.dimensions,
    verticalLayout: layout,
    sunShelf: config.features.includes("sunShelf") || config.features.includes("hydromassage"),
    twoLoungerShelf: config.features.includes("sunShelf"),
    infinityEdge: config.system === "infinity" ? config.infinityEdge : null,
  });
  const input: LayoutInput = {
    outline,
    poolType,
    layout,
    floorProfile,
    shape: config.shape,
    system: config.system,
    overflowType: config.overflowType,
    features: config.features,
    hydromassageVariant: config.hydromassageVariant,
    nominalWidth: config.dimensions.width,
    sunShelfRun: config.dimensions.sunShelfRun,
    integratedBenchStations: config.integratedBenchStations,
    infinityWallType: config.system === "infinity" ? config.infinityEdge?.wallType : undefined,
    access: config.poolAccess,
    stairType: config.internalStairType ?? "linear",
    stairWidth: config.internalStairWidth,
    stairMirrored: !!config.internalStairMirrored,
    stairPosition: config.internalStairPosition,
    skimmers: planSkimmers(
      outline,
      computeMetrics(outline, config.dimensions.depth).waterSurface,
      config.system === "skimmer",
    ),
    infinityExcluded:
      config.system === "infinity" && config.infinityEdge
        ? infinityExclusion(outline, config.infinityEdge, config.shape)
        : null,
  };
  if (config.system !== "skimmer" || !config.features.includes("sunShelf"))
    return { layout: resolvePoolLayout(input), skimmers: input.skimmers };
  // The entrance/platform owns its geometry. Place fittings after resolving it,
  // then use the same final row for access validation, lighting and the scene.
  const preliminary = resolvePoolLayout({ ...input, skimmers: { ...input.skimmers, positions: [] } });
  const shelf = preliminary.comfort.elements.find(element => element.kind === "sunShelf");
  if (!shelf || !preliminary.comfort.availability.sunShelf.available)
    return { layout: resolvePoolLayout(input), skimmers: input.skimmers };
  const bounds = outlineBounds(outline), platform = outlineBounds(shelf.footprint);
  const longX = bounds.spanX >= bounds.spanZ;
  const min = longX ? bounds.minX : bounds.minZ, max = longX ? bounds.maxX : bounds.maxZ;
  const nearMin = Math.abs((longX ? platform.minX : platform.minZ)-min) < Math.abs((longX ? platform.maxX : platform.maxZ)-max);
  const skimmers = planSkimmers(outline, computeMetrics(outline,config.dimensions.depth).waterSurface, true, null, {
    head: { axis: longX ? "x" : "z", coordinate: nearMin ? max : min },
    reserved: [...comfortFootprints(preliminary.comfort),
      ...(preliminary.access.placement ? [preliminary.access.footprint] : []),
      ...(preliminary.ladder?.plan.placement ? [preliminary.ladder.plan.footprint] : [])],
    clearance: ACCESS_DIMENSIONS.fittingClearance + 1e-5,
  });
  return { layout: resolvePoolLayout({ ...input, skimmers }), skimmers };
}

export function configuredPoolLayout(config: PoolConfig): ResolvedPoolLayout {
  return configuredLayoutWithSkimmers(config).layout;
}

export function configuredSkimmerPlan(config: PoolConfig) {
  return configuredLayoutWithSkimmers(config).skimmers;
}
