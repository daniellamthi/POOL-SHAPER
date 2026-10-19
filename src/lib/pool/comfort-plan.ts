import { normalizeComfortFeatures } from "./comfort-selection";
export { normalizeComfortFeatures, activeFlightKind } from "./comfort-selection";
import { configuredPoolLayout } from "./resolved-layout";
import { splitFloorOutline } from "./floor-profile";
import { outlineBounds, outlineArea, outlineCentroid } from "./geometry";
import type { FloorProfileModel } from "./floor-profile";
import type { HydromassageVariant, Outline, PoolConfig, PoolFeatureId, PoolShapeId, PoolType, SystemType } from "./types";
import type { InfinityExclusion } from "./walls";
import { clearOfInfinityEdge, INFINITY_ACCESS_CLEARANCE } from "./infinity-access";
import { infinityCrestY } from "./infinity-edge";
import { SUN_SHELF_MIN_RUN, SUN_SHELF_LOUNGER_LAYOUT, SUN_SHELF_WATER_DEPTH } from "./sun-shelf-model";
import { resolveSunShelfLoungers } from "./sun-shelf-loungers";

export type ComfortKind = "sunShelf" | "integratedBench" | "hydromassage";

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
  /** Hydromassage only: non-overlapping levels that tile `footprint`. */
  tiers?: ReadonlyArray<{ footprint: Outline; topY: number; role: HydroTierRole }>;
  /** Hydromassage only: nozzle faces; `dir` is the unit outward normal in plan. */
  jets?: ReadonlyArray<{ x: number; y: number; z: number; dir: readonly [number, number] }>;
  /** Hydromassage only: LED micro-spots set into the seat's front vertical
   * face, under the seat edge; `dir` is the unit outward normal in plan. */
  spots?: ReadonlyArray<{ x: number; y: number; z: number; dir: readonly [number, number] }>;
}

export type HydroTierRole = "divider" | "frontWall" | "sideReturn" | "backSeat" | "sideSeat" | "innerSideSeat" | "tubFloor";

/** Real in-pool spa dimensions (metres), read from the reference: a sunken
 * tub beside the straight flight, a divider wall towards the stairs and, in the
 * closed variant, a front wall. The open variant adds the opposite short seat,
 * forming a U while leaving the volume visually open to the main pool. */
export const HYDRO_DIMENSIONS = {
  partitionThickness: 0.2,
  lipThickness: 0.15,
  /** One shared top for divider and front wall: no step where they meet. */
  wallWaterDepth: 0.1,
  benchDepth: 0.45,
  seatWaterDepth: 0.45,
  tubWaterDepth: 0.95,
  minInteriorWidth: 1.2,
  minLegroom: 0.5,
  minSeatHeight: 0.35,
  jetSpacing: 0.5,
  jetAboveSeat: 0.22,
  jetDiameter: 0.06,
  /** LED micro-spots in the seat front face, this far below the seat edge. */
  spotBelowSeat: 0.12,
  spotSpacing: 0.6,
  spotDiameter: 0.035,
  /** Solids run this far into the wall so no seam can open at the tile line. */
  wallOverlap: 0.01,
} as const;

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
  infinityWallType = "traditional",
  hydromassageVariant = "closed",
  separateHydroAccess = false,
  nominalWidth,
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
  infinityWallType?: "traditional" | "glass" | undefined;
  hydromassageVariant?: HydromassageVariant | undefined;
  /** A selected radial flight is resolved separately against the spa body. */
  separateHydroAccess?: boolean;
  /** Commercial width, independent of outline rotation/principal axis. */
  nominalWidth?: number;
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
    hydromassage: { available: false, ...(unsupported ? { reason: unsupported } : {}) },
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
        hydromassage: { available: false, reason },
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
    hydromassage: { available: true },
  };
  const wantsShelf = enabled.includes("sunShelf");
  const wantsHydro = enabled.includes("hydromassage") && !wantsShelf;
  const crossAxis = longX ? "z" : "x";
  const crossMin = longX ? bounds.minZ : bounds.minX;
  const crossMax = longX ? bounds.maxZ : bounds.maxX;
  // A head-wall fallback beside an Infinity long side must leave an interior
  // buffer for the entire shelf/tub, including the hydro wall overlap.
  const infinityAtCrossMin = excludedWall(infinityExcluded, crossAxis, crossMin);
  const infinityAtCrossMax = excludedWall(infinityExcluded, crossAxis, crossMax);
  const safeCrossMin = infinityAtCrossMin
    ? crossMin + INFINITY_ACCESS_CLEARANCE + HYDRO_DIMENSIONS.wallOverlap
    : crossMin + EDGE_INSET;
  const safeCrossMax = infinityAtCrossMax
    ? crossMax - INFINITY_ACCESS_CLEARANCE - HYDRO_DIMENSIONS.wallOverlap
    : crossMax - EDGE_INSET;
  const valid = (rect: Rect, wallAxis: "x" | "z", wallCoordinate: number) =>
    !excludedWall(infinityExcluded, wallAxis, wallCoordinate) &&
    (!accessRect || !overlaps(expanded(rect, CLEARANCE), accessRect)) &&
    !selectedRects.some((other) => overlaps(expanded(rect, 0.15), other));

  const shelfRun = Math.min(2.2, Math.max(1.2, longSpan * 0.2), longSpan - 2.4);
  const shelfCandidates: Array<{ rect: Rect; axis: "x" | "z"; coordinate: number }> = longX
    ? [
        { rect: { minX: bounds.minX + EDGE_INSET, maxX: bounds.minX + shelfRun, minZ: safeCrossMin, maxZ: safeCrossMax }, axis: "x", coordinate: bounds.minX },
        { rect: { minX: bounds.maxX - shelfRun, maxX: bounds.maxX - EDGE_INSET, minZ: safeCrossMin, maxZ: safeCrossMax }, axis: "x", coordinate: bounds.maxX },
      ]
    : [
        { rect: { minX: safeCrossMin, maxX: safeCrossMax, minZ: bounds.minZ + EDGE_INSET, maxZ: bounds.minZ + shelfRun }, axis: "z", coordinate: bounds.minZ },
        { rect: { minX: safeCrossMin, maxX: safeCrossMax, minZ: bounds.maxZ - shelfRun, maxZ: bounds.maxZ - EDGE_INSET }, axis: "z", coordinate: bounds.maxZ },
      ];
  const stairWidth = Math.min(1.2, shortSpan - 1.2);
  const withSteps = (candidate: typeof shelfCandidates[number], minimumRun: number) => {
    if ((infinityAtCrossMin || infinityAtCrossMax) && safeCrossMax - safeCrossMin < stairWidth + 1.2)
      return null;
    const positive = candidate.coordinate === (longX ? bounds.minX : bounds.minZ);
    const zone = floorProfile.shelfZone;
    if (zone && positive !== zone.atMin) return null;
    const direction = positive ? 1 : -1;
    const crossMin = longX ? candidate.rect.minZ : candidate.rect.minX;
    const crossMax = longX ? candidate.rect.maxZ : candidate.rect.maxX;
    const stairAtMin = !excludedWall(infinityExcluded, longX ? "z" : "x", longX ? bounds.minZ : bounds.minX);
    const center = stairAtMin ? crossMin + stairWidth / 2 : crossMax - stairWidth / 2;
    const topY = waterY - (minimumRun ? SUN_SHELF_WATER_DEPTH : 0.22);
    // Solve against the floor at the actual landing, including its slope.
    for (let rises = 2; rises <= 16; rises++) {
      if (zone && rises !== zone.flight.rises) continue;
      const run = (rises - 1) * 0.3;
      const landingRun = minimumRun ? SUN_SHELF_LOUNGER_LAYOUT.backPassage + EDGE_INSET : 0.45;
      const totalRun = zone?.flight.totalRun ?? Math.max(shelfRun, minimumRun, run + landingRun);
      if (totalRun < minimumRun - 1e-7) continue;
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
      if (!valid(flight, candidate.axis, candidate.coordinate) ||
        !clearOfInfinityEdge(outline, infinityExcluded, rectOutline(flight))) continue;
      const back = candidate.coordinate + direction * EDGE_INSET;
      const whole = longX
        ? { ...candidate.rect, minX: Math.min(back,end), maxX: Math.max(back,end) }
        : { ...candidate.rect, minZ: Math.min(back,end), maxZ: Math.max(back,end) };
      if (!valid(whole, candidate.axis, candidate.coordinate) ||
        !clearOfInfinityEdge(outline, infinityExcluded, rectOutline(whole))) continue;
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
  const flightCandidate = (minimumRun: number) => shelfCandidates
    .filter(candidate => valid(candidate.rect, candidate.axis, candidate.coordinate) &&
      clearOfInfinityEdge(outline, infinityExcluded, rectOutline(candidate.rect)))
    .map(candidate => withSteps(candidate, minimumRun)).find(candidate => candidate !== null);
  const shelf = flightCandidate(SUN_SHELF_MIN_RUN);
  if (!shelf) availability.sunShelf = { available: false, reason: "Nessuna testata libera da scala, accessi o bordo Infinity." };
  else {
    const rect = shelf.rect;
    // Join the Infinity shelf and flight to the shell, not an inset floating block.
    // The excluded overflow edge keeps its existing safety clearance.
    const joinShell = (points: Outline): Outline => system !== "infinity" ? points : points.map(([x, z]) => {
      const snap = (v: number, min: number, max: number) =>
        Math.abs(v - (min + EDGE_INSET)) < 1e-6 ? min
          : Math.abs(v - (max - EDGE_INSET)) < 1e-6 ? max : v;
      return [snap(x, bounds.minX, bounds.maxX), snap(z, bounds.minZ, bounds.maxZ)] as const;
    });
    const element: ComfortElementPlan = {
      kind: "sunShelf",
      footprint: joinShell(rectOutline(rect)),
      topY: waterY - SUN_SHELF_WATER_DEPTH,
      waterDepth: SUN_SHELF_WATER_DEPTH,
      width: longX ? rect.maxZ - rect.minZ : rect.maxX - rect.minX,
      run: shelf.totalRun,
      steps: shelf.steps.map(step => ({ ...step, footprint: joinShell(step.footprint) })),
      riser: shelf.riser,
      landing: { ...shelf.landing, footprint: joinShell(shelf.landing.footprint) },
    };
    const loungers = resolveSunShelfLoungers({
      comfort: { elements: [element], availability, displacedVolume: 0 },
      outline, waterY, infinityExcluded,
      accessFootprints: accessFootprint.length >= 3 ? [accessFootprint] : [],
    });
    if (!loungers.available) availability.sunShelf = { available: false, reason: loungers.reason ?? "Non disponibile per questa configurazione." };
    else if (wantsShelf) {
      elements.push(element);
      selectedRects.push(rect);
      selectedRects.push(shelf.flight);
      selectedRects.push(boundsOf(shelf.landing.footprint));
    }
  }

  {
  // Independent candidate: never grow an approved hydro body for the shelf rule.
  const shelf = flightCandidate(0);
  if ((nominalWidth ?? shortSpan) <= 3)
    availability.hydromassage = { available: false, reason: "L’idromassaggio integrato richiede una larghezza nominale superiore a 3,00 m e spazio utile compatibile." };
  else if (!shelf) availability.hydromassage = { available: false, reason: "Nessuna testata libera per scala rettilinea e vasca idromassaggio." };
  else {
    const H = HYDRO_DIMENSIONS;
    const direction = shelf.coordinate === (longX ? bounds.minX : bounds.minZ) ? 1 : -1;
    const flightMin = longX ? shelf.flight.minZ : shelf.flight.minX;
    const flightMax = longX ? shelf.flight.maxZ : shelf.flight.maxX;
    const wallMin = longX ? bounds.minZ : bounds.minX;
    const wallMax = longX ? bounds.maxZ : bounds.maxX;
    // The tub takes the free side of the head wall; `outer` is its long wall.
    const flightAtMin = Math.abs(flightMin - (wallMin + EDGE_INSET)) < 1e-6;
    const side = flightAtMin ? 1 : -1;
    const partition0 = flightAtMin ? flightMax : flightMin;
    const inner = partition0 + side * H.partitionThickness;
    const outerPoolWall = flightAtMin ? wallMax : wallMin;
    const outerIsInfinity = excludedWall(infinityExcluded, crossAxis, outerPoolWall);
    // The tub meets the Infinity shell's inner face. That existing spill wall
    // is its shared backrest: do not build a second parallel wall inside it.
    // The flight retains the original safe candidate and is never relocated.
    const outerWall = outerPoolWall;
    const outer = outerWall + (outerIsInfinity ? 0 : side * H.wallOverlap);
    const end = shelf.totalRun;
    const lip = end - H.lipThickness;
    // Local frame: `a` metres from the head wall, `c` across the head wall.
    const box = (a0: number, a1: number, c0: number, c1: number): Rect => {
      const p = shelf.coordinate + direction * a0, q = shelf.coordinate + direction * a1;
      return longX
        ? { minX: Math.min(p, q), maxX: Math.max(p, q), minZ: Math.min(c0, c1), maxZ: Math.max(c0, c1) }
        : { minX: Math.min(c0, c1), maxX: Math.max(c0, c1), minZ: Math.min(p, q), maxZ: Math.max(p, q) };
    };
    const back = -H.wallOverlap;
    const seatBack = outerWall;
    const benchInner = seatBack - side * H.benchDepth;
    const interiorWidth = Math.abs(seatBack - inner);
    const seatTop = waterY - H.seatWaterDepth;
    const whole = box(back, end, partition0, outer);
    const corners = rectOutline(whole);
    const floorUnder = Math.max(...corners.map(([x, z]) => floorProfile.floorYAt(x, z)));
    const tubFloor = waterY - H.tubWaterDepth;
    const raisedFloor = tubFloor > floorUnder + 0.05;
    if (!outerIsInfinity && !clearOfInfinityEdge(outline, infinityExcluded, rectOutline(whole)))
      availability.hydromassage = { available: false, reason: "Spazio insufficiente per tenere la vasca lontana dal bordo Infinity." };
    else if (interiorWidth < H.minInteriorWidth || lip - H.benchDepth < H.minLegroom)
      availability.hydromassage = { available: false, reason: "Spazio insufficiente per vasca, panca e scala rettilinea con misure ergonomiche." };
    else if (seatTop - Math.max(floorUnder, tubFloor) < H.minSeatHeight)
      availability.hydromassage = { available: false, reason: "Profondità insufficiente per una seduta sommersa reale." };
    else if (wantsHydro) {
      // The variant only switches the front wall; seat, floor and jets run to
      // the tub's front edge, which is the wall's inner face when it exists.
      const frontWall = hydromassageVariant === "closed";
      const front = frontWall ? lip : end;
      const innerBenchEdge = inner + side * H.benchDepth;
      const clearGlassSide = outerIsInfinity && infinityWallType === "glass";
      const outerSeat = !clearGlassSide;
      const innerSeat = !frontWall || clearGlassSide;
      const tubInner = innerSeat ? innerBenchEdge : inner;
      const tubOuter = outerSeat ? benchInner : seatBack;
      // Match the actual lowered spill crest, never the surrounding coping
      // or the first tread. Seat, jet and micro-spot elevations are unchanged.
      const wallTop = system === "infinity" ? infinityCrestY(waterY) : waterY - H.wallWaterDepth;
      const tiers: Array<{ footprint: Outline; topY: number; role: HydroTierRole }> = [
        { role: "divider", footprint: rectOutline(box(back, end, partition0, inner)), topY: wallTop },
        ...(frontWall
          ? [{ role: "frontWall" as const, footprint: rectOutline(box(lip, end, inner, outerIsInfinity ? seatBack : outer)), topY: wallTop }]
          : []),
        { role: "backSeat", footprint: rectOutline(box(back, H.benchDepth, inner, outerIsInfinity ? seatBack : outer)), topY: seatTop },
        ...(outerSeat
          ? [{ role: "sideSeat" as const, footprint: rectOutline(box(H.benchDepth, front, benchInner, outerIsInfinity ? seatBack : outer)), topY: seatTop }]
          : []),
        ...(innerSeat
          ? [{ role: "innerSideSeat" as const, footprint: rectOutline(box(H.benchDepth, front, inner, innerBenchEdge)), topY: seatTop }]
          : []),
        ...(raisedFloor
          ? [{ role: "tubFloor" as const, footprint: rectOutline(box(H.benchDepth, front, tubInner, tubOuter)), topY: tubFloor }]
          : []),
      ];
      // The flight shares the head and long walls: close those seams too.
      const toWalls = (outline: Outline): Outline => outline.map(([x, z]) => {
        const snap = (v: number, min: number, max: number) =>
          Math.abs(v - (min + EDGE_INSET)) < 1e-6 ? min - H.wallOverlap
            : Math.abs(v - (max - EDGE_INSET)) < 1e-6 ? max + H.wallOverlap : v;
        return [snap(x, bounds.minX, bounds.maxX), snap(z, bounds.minZ, bounds.maxZ)] as const;
      });
      const jetY = Math.min(seatTop + H.jetAboveSeat, wallTop - H.jetDiameter / 2 - 0.01);
      const spaced = (from: number, to: number) => {
        const count = Math.max(1, Math.floor(Math.abs(to - from) / H.jetSpacing) + 1);
        const step = count > 1 ? (to - from) / (count - 1) : 0;
        return Array.from({ length: count }, (_, i) => (count > 1 ? from + i * step : (from + to) / 2));
      };
      const point = (a: number, c: number) => (longX ? { x: shelf.coordinate + direction * a, z: c } : { x: c, z: shelf.coordinate + direction * a });
      const headDir = (longX ? [direction, 0] : [0, direction]) as readonly [number, number];
      const sideDir = (longX ? [0, -side] : [-side, 0]) as readonly [number, number];
      const innerSideDir = (longX ? [0, side] : [side, 0]) as readonly [number, number];
      // A glass spill wall stays clear: the L uses the two solid faces only.
      const headStart = clearGlassSide ? innerBenchEdge : inner;
      const headEnd = clearGlassSide ? seatBack : benchInner;
      const jets = [
        ...spaced(headStart + side * 0.3, headEnd - side * 0.25).map((c) => ({ ...point(0, c), y: jetY, dir: headDir })),
        ...(outerSeat ? spaced(H.benchDepth + 0.3, front - 0.25).map((a) => ({ ...point(a, seatBack), y: jetY, dir: sideDir })) : []),
        ...(innerSeat
          ? spaced(H.benchDepth + 0.3, front - 0.25).map((a) => ({ ...point(a, inner), y: jetY, dir: innerSideDir }))
          : []),
      ];
      // Micro-spots light the tub from the seat's front face: below the seat
      // edge, facing the legroom, never in the backrest beside the jets.
      const spotY = seatTop - H.spotBelowSeat;
      // One miniature fitting at the centre of each actual seat face: two
      // for the L and three for the U, never a repeated row of decorative dots.
      const spotsAlong = (from: number, to: number) => [(from + to) / 2];
      const backFrontDir = (longX ? [direction, 0] : [0, direction]) as readonly [number, number];
      const spots = [
        ...spotsAlong(headStart + side * 0.25, headEnd - side * 0.25).map((c) => ({
          ...point(H.benchDepth, c),
          y: spotY,
          dir: backFrontDir,
        })),
        ...(outerSeat ? spotsAlong(H.benchDepth + 0.25, front - 0.25).map((a) => ({
          ...point(a, benchInner),
          y: spotY,
          dir: sideDir,
        })) : []),
        ...(innerSeat
          ? spotsAlong(H.benchDepth + 0.25, front - 0.25).map((a) => ({
              ...point(a, innerBenchEdge),
              y: spotY,
              dir: innerSideDir,
            }))
          : []),
      ];
      elements.push({
        kind: "hydromassage",
        footprint: rectOutline(whole),
        topY: wallTop,
        waterDepth: H.seatWaterDepth,
        width: interiorWidth,
        run: end,
        ...(!separateHydroAccess ? {
          steps: shelf.steps.map((step) => ({ ...step, footprint: toWalls(step.footprint) })),
          riser: shelf.riser,
          landing: { ...shelf.landing, footprint: toWalls(shelf.landing.footprint) },
        } : {}),
        tiers,
        jets,
        spots,
      });
      selectedRects.push(whole, shelf.flight, boundsOf(shelf.landing.footprint));
    }
  }

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
    displacedVolume: elements.reduce((sum, element) =>
      sum + (element.tiers ?? [element]).reduce((v, tier) => v + elementVolume({ ...element, ...tier }, floorProfile), 0) +
      [...(element.steps ?? []), ...(element.landing ? [element.landing] : [])].reduce((volume, step) => volume + elementVolume({ ...element, ...step }, floorProfile), 0), 0),
  };
}

export function configuredComfortPlan(config: PoolConfig): ComfortPlan {
  return configuredPoolLayout(config).comfort;
}
