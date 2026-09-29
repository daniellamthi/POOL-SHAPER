import { configuredPoolLayout } from "./resolved-layout";
import { splitFloorOutline } from "./floor-profile";
import { outlineBounds, outlineArea, outlineCentroid } from "./geometry";
import type { FloorProfileModel } from "./floor-profile";
import type { Outline, PoolConfig, PoolFeatureId, PoolShapeId, PoolType, SystemType } from "./types";
import type { InfinityExclusion } from "./walls";

export type ComfortKind = "sunShelf" | "integratedBench";

export interface ComfortElementPlan {
  kind: ComfortKind;
  footprint: Outline;
  topY: number;
  waterDepth: number;
  width: number;
  run: number;
  /** Consecutive, non-overlapping treads, starting exactly at the shelf edge. */
  steps?: ReadonlyArray<{ footprint: Outline; topY: number }>;
  riser?: number;
  landing?: { footprint: Outline; topY: number };
}

export interface ComfortPlan {
  adjusted?: boolean;
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
  if(floor.shelfZone) return splitFloorOutline(element.footprint,floor.axis,floor.shelfZone.slopeStart)
    .reduce((sum,piece)=>{
      const [x,z]=outlineCentroid(piece);
      return sum+outlineArea(piece)*Math.max(0,element.topY-floor.floorYAt(x,z));
    },0);
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
  const stairWidth = Math.min(1.2, shortSpan - 1.2);
  const withSteps = (candidate: typeof shelfCandidates[number]) => {
    const positive = candidate.coordinate === (longX ? bounds.minX : bounds.minZ);
    const zone = floorProfile.shelfZone;
    if (zone && positive !== zone.atMin) return null;
    const direction = positive ? 1 : -1;
    const crossMin = longX ? candidate.rect.minZ : candidate.rect.minX;
    const crossMax = longX ? candidate.rect.maxZ : candidate.rect.maxX;
    const stairAtMin = !excludedWall(infinityExcluded, longX ? "z" : "x", longX ? bounds.minZ : bounds.minX);
    const center = stairAtMin ? crossMin + stairWidth / 2 : crossMax - stairWidth / 2;
    const topY = waterY - 0.22;
    // Solve against the floor at the actual landing, including its slope.
    for (let rises = 2; rises <= 16; rises++) {
      if (zone && rises !== zone.flight.rises) continue;
      const run = (rises - 1) * 0.3;
      const totalRun = zone?.flight.totalRun ?? Math.max(shelfRun, run + 0.45);
      if (totalRun + 2.4 > longSpan) continue;
      const end = candidate.coordinate + direction * totalRun;
      const start = end - direction * run;
      const floorY = longX ? floorProfile.floorYAt(end, center) : floorProfile.floorYAt(center, end);
      const riser = (topY - floorY) / rises;
      if (riser < 0.15 || riser > 0.24) continue;
      const steps = Array.from({ length: rises - 1 }, (_, index) => {
        const a = start + direction * index * 0.3;
        const b = start + direction * (index + 1) * 0.3;
        return {
          footprint: rectOutline(longX
            ? { minX: Math.min(a, b), maxX: Math.max(a, b), minZ: center - stairWidth / 2, maxZ: center + stairWidth / 2 }
            : { minX: center - stairWidth / 2, maxX: center + stairWidth / 2, minZ: Math.min(a, b), maxZ: Math.max(a, b) }),
          topY: topY - (index + 1) * riser,
        };
      });
      if (steps.some(step => step.footprint.some(([x,z]) => step.topY <= floorProfile.floorYAt(x,z) + 0.01))) continue;
      const flight = boundsOf(steps.flatMap(step => [...step.footprint]));
      if (!valid(flight, candidate.axis, candidate.coordinate)) continue;
      const back = candidate.coordinate + direction * EDGE_INSET;
      const whole = longX
        ? { ...candidate.rect, minX: Math.min(back,end), maxX: Math.max(back,end) }
        : { ...candidate.rect, minZ: Math.min(back,end), maxZ: Math.max(back,end) };
      if (!valid(whole, candidate.axis, candidate.coordinate)) continue;
      const rect = longX
        ? { ...whole, minZ: stairAtMin ? flight.maxZ : whole.minZ, maxZ: stairAtMin ? whole.maxZ : flight.minZ }
        : { ...whole, minX: stairAtMin ? flight.maxX : whole.minX, maxX: stairAtMin ? whole.maxX : flight.minX };
      const landing = { topY, footprint: rectOutline(longX
        ? { minX: Math.min(back,start), maxX: Math.max(back,start), minZ: flight.minZ, maxZ: flight.maxZ }
        : { minX: flight.minX, maxX: flight.maxX, minZ: Math.min(back,start), maxZ: Math.max(back,start) }) };
      return { ...candidate, rect, steps, riser, flight, landing, totalRun };
    }
    return null;
  };
  const shelf = shelfCandidates
    .filter(candidate => valid(candidate.rect, candidate.axis, candidate.coordinate))
    .map(withSteps).find(candidate => candidate !== null);
  if (!shelf) availability.sunShelf = { available: false, reason: "Nessuna testata libera da scala, accessi o bordo Infinity." };
  else if (enabled.includes("sunShelf")) {
    const rect = shelf.rect;
    const element: ComfortElementPlan = {
      kind: "sunShelf",
      footprint: rectOutline(rect),
      topY: waterY - 0.22,
      waterDepth: 0.22,
      width: longX ? rect.maxZ - rect.minZ : rect.maxX - rect.minX,
      run: shelf.totalRun,
      steps: shelf.steps,
      riser: shelf.riser,
      landing: shelf.landing,
    };
    elements.push(element);
    selectedRects.push(rect);
    selectedRects.push(shelf.flight);
    selectedRects.push(boundsOf(shelf.landing.footprint));
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
  // Preserve the centred design where it fits. Otherwise shorten within seating
  // limits, then move along the same real wall; never overlap the shelf flight.
  const benchOptions = [...benchCandidates];
  for (const length of [benchLength, Math.min(benchLength, 2), 1.5]) {
    const low = (longX ? bounds.minX : bounds.minZ) + EDGE_INSET + length / 2;
    const high = (longX ? bounds.maxX : bounds.maxZ) - EDGE_INSET - length / 2;
    for (const fraction of [0.5, 0.75, 0.25, 1, 0]) {
      const centre = low + (high - low) * fraction;
      for (const candidate of benchCandidates) benchOptions.push({ ...candidate,
        rect: longX ? { ...candidate.rect, minX: centre-length/2, maxX: centre+length/2 }
          : { ...candidate.rect, minZ: centre-length/2, maxZ: centre+length/2 } });
    }
  }
  const bench = benchOptions.find((candidate) => valid(candidate.rect, candidate.axis, candidate.coordinate));
  if (!bench) availability.integratedBench = { available: false, reason: "Nessuna parete lunga libera da scala, solarium o bordo Infinity." };
  else if (enabled.includes("integratedBench")) {
    const rect = bench.rect;
    const element: ComfortElementPlan = {
      kind: "integratedBench",
      footprint: rectOutline(rect),
      topY: waterY - 0.48,
      waterDepth: 0.48,
      width: benchProjection,
      run: longX ? rect.maxX - rect.minX : rect.maxZ - rect.minZ,
    };
    elements.push(element);
    selectedRects.push(rect);
  }

  // `system` is intentionally consumed here: all three pool systems share
  // this same plan; only their wall exclusion differs.
  void system;
  return {
    adjusted: !!bench && enabled.includes("integratedBench") && !benchCandidates.includes(bench),
    elements,
    availability,
    displacedVolume: elements.reduce((sum, element) => sum + elementVolume(element, floorProfile) +
      [...(element.steps ?? []), ...(element.landing ? [element.landing] : [])].reduce((volume, step) => volume + elementVolume({ ...element, ...step }, floorProfile), 0), 0),
  };
}

export function configuredComfortPlan(config: PoolConfig): ComfortPlan {
  return configuredPoolLayout(config).comfort;
}
