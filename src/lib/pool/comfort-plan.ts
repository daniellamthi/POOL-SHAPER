import { configuredAccessPlan } from "./access-plan";
import { buildFloorProfile } from "./floor-profile";
import { buildOutline, outlineBounds } from "./geometry";
import { infinityExclusion } from "./infinity-edge";
import type { FloorProfileModel } from "./floor-profile";
import type { Outline, PoolConfig, PoolFeatureId, PoolShapeId, PoolType, SystemType } from "./types";
import type { InfinityExclusion } from "./walls";
import { getPoolVerticalLayout } from "./vertical-layout";

export type ComfortKind = "sunShelf" | "integratedBench";

export interface ComfortElementPlan {
  kind: ComfortKind;
  footprint: Outline;
  topY: number;
  waterDepth: number;
  width: number;
  run: number;
}

export interface ComfortPlan {
  elements: ReadonlyArray<ComfortElementPlan>;
  availability: Record<ComfortKind, { available: boolean; reason?: string }>;
  displacedVolume: number;
}

const CLEARANCE = 0.3;
const EDGE_INSET = 0.035;

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };

function rectOutline(rect: Rect): Outline {
  return [
    [rect.minX, rect.minZ],
    [rect.maxX, rect.minZ],
    [rect.maxX, rect.maxZ],
    [rect.minX, rect.maxZ],
  ];
}

function boundsOf(outline: Outline): Rect {
  const b = outlineBounds(outline);
  return { minX: b.minX, maxX: b.maxX, minZ: b.minZ, maxZ: b.maxZ };
}

function expanded(rect: Rect, amount: number): Rect {
  return {
    minX: rect.minX - amount,
    maxX: rect.maxX + amount,
    minZ: rect.minZ - amount,
    maxZ: rect.maxZ + amount,
  };
}

function overlaps(a: Rect, b: Rect) {
  return !(
    a.maxX <= b.minX ||
    a.minX >= b.maxX ||
    a.maxZ <= b.minZ ||
    a.minZ >= b.maxZ
  );
}

function excludedWall(
  exclusion: InfinityExclusion | null,
  axis: "x" | "z",
  coordinate: number,
) {
  return !!exclusion && exclusion.axis === axis && Math.abs(exclusion.coordinate - coordinate) < 0.08;
}

function elementVolume(element: ComfortElementPlan, floor: FloorProfileModel) {
  const rect = boundsOf(element.footprint);
  const x = (rect.minX + rect.maxX) / 2;
  const z = (rect.minZ + rect.maxZ) / 2;
  return Math.max(0, (rect.maxX - rect.minX) * (rect.maxZ - rect.minZ) * (element.topY - floor.floorYAt(x, z)));
}

/** One deterministic plan drives selectors, geometry and hydraulic volume. */
export function resolveComfortPlan({
  outline,
  shape,
  poolType,
  system,
  floorProfile,
  waterY,
  enabled,
  accessFootprint = [],
  infinityExcluded = null,
}: {
  outline: Outline;
  shape: PoolShapeId;
  poolType: PoolType;
  system: SystemType;
  floorProfile: FloorProfileModel;
  waterY: number;
  enabled: ReadonlyArray<PoolFeatureId>;
  accessFootprint?: Outline;
  infinityExcluded?: InfinityExclusion | null;
}): ComfortPlan {
  const unsupported =
    poolType !== "in-ground"
      ? "Disponibile per piscine interrate."
      : shape !== "rectangle"
        ? "Disponibile per la forma rettangolare in questa versione."
        : null;
  const unavailable = {
    sunShelf: { available: false, ...(unsupported ? { reason: unsupported } : {}) },
    integratedBench: { available: false, ...(unsupported ? { reason: unsupported } : {}) },
  } satisfies ComfortPlan["availability"];
  if (unsupported) return { elements: [], availability: unavailable, displacedVolume: 0 };

  const bounds = boundsOf(outline);
  const spanX = bounds.maxX - bounds.minX;
  const spanZ = bounds.maxZ - bounds.minZ;
  const longX = spanX >= spanZ;
  const shortSpan = longX ? spanZ : spanX;
  const longSpan = longX ? spanX : spanZ;
  if (shortSpan < 2.4 || longSpan < 4.8) {
    const reason = "Spazio insufficiente per mantenere passaggi e proporzioni reali.";
    return {
      elements: [],
      availability: {
        sunShelf: { available: false, reason },
        integratedBench: { available: false, reason },
      },
      displacedVolume: 0,
    };
  }

  const accessRect = accessFootprint.length >= 3 ? expanded(boundsOf(accessFootprint), CLEARANCE) : null;
  const selectedRects: Rect[] = [];
  const elements: ComfortElementPlan[] = [];
  const availability: ComfortPlan["availability"] = {
    sunShelf: { available: true },
    integratedBench: { available: true },
  };
  const valid = (rect: Rect, wallAxis: "x" | "z", wallCoordinate: number) =>
    !excludedWall(infinityExcluded, wallAxis, wallCoordinate) &&
    (!accessRect || !overlaps(expanded(rect, CLEARANCE), accessRect)) &&
    !selectedRects.some((other) => overlaps(expanded(rect, 0.15), other));

  const shelfRun = Math.min(2.2, Math.max(1.2, longSpan * 0.2), longSpan - 2.4);
  const shelfCandidates: Array<{ rect: Rect; axis: "x" | "z"; coordinate: number }> = longX
    ? [
        { rect: { minX: bounds.minX + EDGE_INSET, maxX: bounds.minX + shelfRun, minZ: bounds.minZ + EDGE_INSET, maxZ: bounds.maxZ - EDGE_INSET }, axis: "x", coordinate: bounds.minX },
        { rect: { minX: bounds.maxX - shelfRun, maxX: bounds.maxX - EDGE_INSET, minZ: bounds.minZ + EDGE_INSET, maxZ: bounds.maxZ - EDGE_INSET }, axis: "x", coordinate: bounds.maxX },
      ]
    : [
        { rect: { minX: bounds.minX + EDGE_INSET, maxX: bounds.maxX - EDGE_INSET, minZ: bounds.minZ + EDGE_INSET, maxZ: bounds.minZ + shelfRun }, axis: "z", coordinate: bounds.minZ },
        { rect: { minX: bounds.minX + EDGE_INSET, maxX: bounds.maxX - EDGE_INSET, minZ: bounds.maxZ - shelfRun, maxZ: bounds.maxZ - EDGE_INSET }, axis: "z", coordinate: bounds.maxZ },
      ];
  const shelf = shelfCandidates.find((candidate) => valid(candidate.rect, candidate.axis, candidate.coordinate));
  if (!shelf) availability.sunShelf = { available: false, reason: "Nessuna testata libera da scala, accessi o bordo Infinity." };
  else if (enabled.includes("sunShelf")) {
    const rect = shelf.rect;
    const element: ComfortElementPlan = {
      kind: "sunShelf",
      footprint: rectOutline(rect),
      topY: waterY - 0.22,
      waterDepth: 0.22,
      width: longX ? rect.maxZ - rect.minZ : rect.maxX - rect.minX,
      run: shelfRun,
    };
    elements.push(element);
    selectedRects.push(rect);
  }

  const benchLength = Math.min(3, Math.max(1.5, longSpan * 0.36));
  const half = benchLength / 2;
  const benchProjection = 0.5;
  const benchCandidates: Array<{ rect: Rect; axis: "x" | "z"; coordinate: number }> = longX
    ? [
        { rect: { minX: -half, maxX: half, minZ: bounds.minZ + EDGE_INSET, maxZ: bounds.minZ + EDGE_INSET + benchProjection }, axis: "z", coordinate: bounds.minZ },
        { rect: { minX: -half, maxX: half, minZ: bounds.maxZ - EDGE_INSET - benchProjection, maxZ: bounds.maxZ - EDGE_INSET }, axis: "z", coordinate: bounds.maxZ },
      ]
    : [
        { rect: { minX: bounds.minX + EDGE_INSET, maxX: bounds.minX + EDGE_INSET + benchProjection, minZ: -half, maxZ: half }, axis: "x", coordinate: bounds.minX },
        { rect: { minX: bounds.maxX - EDGE_INSET - benchProjection, maxX: bounds.maxX - EDGE_INSET, minZ: -half, maxZ: half }, axis: "x", coordinate: bounds.maxX },
      ];
  const bench = benchCandidates.find((candidate) => valid(candidate.rect, candidate.axis, candidate.coordinate));
  if (!bench) availability.integratedBench = { available: false, reason: "Nessuna parete lunga libera da scala, solarium o bordo Infinity." };
  else if (enabled.includes("integratedBench")) {
    const rect = bench.rect;
    const element: ComfortElementPlan = {
      kind: "integratedBench",
      footprint: rectOutline(rect),
      topY: waterY - 0.48,
      waterDepth: 0.48,
      width: benchProjection,
      run: benchLength,
    };
    elements.push(element);
    selectedRects.push(rect);
  }

  // `system` is intentionally consumed here: all three pool systems share
  // this same plan; only their wall exclusion differs.
  void system;
  return {
    elements,
    availability,
    displacedVolume: elements.reduce((sum, element) => sum + elementVolume(element, floorProfile), 0),
  };
}

export function configuredComfortPlan(config: PoolConfig): ComfortPlan {
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const layout = getPoolVerticalLayout({
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
    verticalLayout: layout,
  });
  const access = configuredAccessPlan(config);
  return resolveComfortPlan({
    outline,
    shape: config.shape,
    poolType: config.poolType ?? "in-ground",
    system: config.system,
    floorProfile,
    waterY: layout.waterY,
    enabled: config.features,
    accessFootprint: access.footprint,
    infinityExcluded:
      config.system === "infinity" && config.infinityEdge
        ? infinityExclusion(outline, config.infinityEdge, config.shape)
        : null,
  });
}
