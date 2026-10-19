import type { ComfortPlan } from "./comfort-plan";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { buildOutline } from "./geometry";
import { infinityExclusion } from "./infinity-edge";
import { clearOfInfinityEdge } from "./infinity-access";
import { configuredPoolLayout } from "./resolved-layout";
import type { Outline, PoolConfig } from "./types";
import { getPoolVerticalLayout } from "./vertical-layout";
import type { InfinityExclusion } from "./walls";

import { SUN_SHELF_LOUNGER_MODEL, SUN_SHELF_LOUNGER_LAYOUT } from "./sun-shelf-model";
export { SUN_SHELF_LOUNGER_MODEL, SUN_SHELF_LOUNGER_LAYOUT } from "./sun-shelf-model";

export interface SunShelfLoungerPlacement {
  x: number;
  y: number;
  z: number;
  /** Local +Z is the foot end, facing the main swimming area. */
  rotation: number;
  footprint: Outline;
}

export interface SunShelfLoungerPlan {
  available: boolean;
  enabled: boolean;
  capacity: number;
  count: number;
  adjusted: boolean;
  reason?: string;
  placements: ReadonlyArray<SunShelfLoungerPlacement>;
  /** Clear, connected transverse route from the actual stair landing. */
  passage?: Outline;
}

type Rect = { minX: number; maxX: number; minZ: number; maxZ: number };
const EPSILON = 1e-7;

function bounds(points: Outline): Rect {
  return {
    minX: Math.min(...points.map(([x]) => x)),
    maxX: Math.max(...points.map(([x]) => x)),
    minZ: Math.min(...points.map(([, z]) => z)),
    maxZ: Math.max(...points.map(([, z]) => z)),
  };
}

function rectangle(rect: Rect): Outline {
  return [
    [rect.minX, rect.minZ],
    [rect.maxX, rect.minZ],
    [rect.maxX, rect.maxZ],
    [rect.minX, rect.maxZ],
  ];
}

function inset(rect: Rect, margin: number): Rect {
  return {
    minX: rect.minX + margin,
    maxX: rect.maxX - margin,
    minZ: rect.minZ + margin,
    maxZ: rect.maxZ - margin,
  };
}

function isRectangle(points: Outline, rect: Rect): boolean {
  if (points.length !== 4 || points.some((point) => point.some((value) => !Number.isFinite(value))))
    return false;
  return rectangle(rect).every(([x, z]) =>
    points.some(([px, pz]) => Math.abs(px - x) < EPSILON && Math.abs(pz - z) < EPSILON),
  );
}

/** Pure derived layout shared by controls, renderer and exports. Never persists
 * placements or scales furniture to fit a changed pool dimension. */
export function resolveSunShelfLoungers({
  comfort,
  outline,
  waterY,
  enabled = false,
  quantity,
  accessFootprints = [],
  infinityExcluded = null,
}: {
  comfort: ComfortPlan;
  outline: Outline;
  waterY: number;
  enabled?: boolean;
  quantity?: number | undefined;
  accessFootprints?: ReadonlyArray<Outline>;
  infinityExcluded?: InfinityExclusion | null;
}): SunShelfLoungerPlan {
  const unavailable = (reason: string): SunShelfLoungerPlan => ({
    available: false,
    enabled: false,
    capacity: 0,
    count: 0,
    adjusted: false,
    reason,
    placements: [],
  });
  const shelf = comfort.elements.find((element) => element.kind === "sunShelf");
  if (!shelf) return unavailable("Richiede una Sun Shelf disponibile.");
  if (
    !Number.isFinite(waterY) ||
    !Number.isFinite(shelf.topY) ||
    waterY - shelf.topY <= 0 ||
    waterY - shelf.topY > SUN_SHELF_LOUNGER_MODEL.maxWaterDepth + EPSILON
  ) {
    return unavailable(
      "Questo lettino immerso richiede una piattaforma piana con acqua fino a 22,86 cm.",
    );
  }
  const shelfBounds = bounds(shelf.footprint);
  if (
    !isRectangle(shelf.footprint, shelfBounds) ||
    outline.length < 3 ||
    outline.some((point) => point.some((value) => !Number.isFinite(value)))
  ) {
    return unavailable("Piattaforma rettangolare regolare necessaria per verificare gli ingombri.");
  }
  const pool = bounds(outline);
  const alongX = pool.maxX - pool.minX >= pool.maxZ - pool.minZ;
  const atMin = alongX
    ? shelfBounds.minX + shelfBounds.maxX < pool.minX + pool.maxX
    : shelfBounds.minZ + shelfBounds.maxZ < pool.minZ + pool.maxZ;
  const rotation = alongX ? (atMin ? Math.PI / 2 : -Math.PI / 2) : atMin ? 0 : Math.PI;
  const landing = shelf.landing && bounds(shelf.landing.footprint);
  const passageWidth = landing && (alongX ? landing.maxZ - landing.minZ : landing.maxX - landing.minX);
  const landingRun = landing && (alongX ? landing.maxX - landing.minX : landing.maxZ - landing.minZ);
  if (!passageWidth || !landingRun || passageWidth < SUN_SHELF_LOUNGER_LAYOUT.minimumAccessWidth - EPSILON || landingRun < SUN_SHELF_LOUNGER_LAYOUT.backPassage - EPSILON)
    return unavailable("Passaggio di accesso alla spiaggetta insufficiente: richiesti almeno 90 cm liberi.");
  const obstacles = [
    ...(shelf.steps ?? []).map((step) => step.footprint),
    ...(shelf.landing ? [shelf.landing.footprint] : []),
    ...comfort.elements
      .filter((element) => element !== shelf)
      .flatMap((element) => [
        element.footprint,
        ...(element.steps ?? []).map((step) => step.footprint),
        ...(element.landing ? [element.landing.footprint] : []),
      ]),
    ...accessFootprints,
  ]
    .filter((footprint) => footprint.length >= 3)
    .map((footprint) => inset(bounds(footprint), -SUN_SHELF_LOUNGER_LAYOUT.accessBuffer));
  const safe = inset(shelfBounds, SUN_SHELF_LOUNGER_LAYOUT.edgeInset);
  // Reserve a true transverse route behind the chaises, connected to the
  // full landing. A wide stair alone does not establish a usable shelf path.
  if (alongX) {
    if (atMin) safe.minX = shelfBounds.minX + SUN_SHELF_LOUNGER_LAYOUT.backPassage;
    else safe.maxX = shelfBounds.maxX - SUN_SHELF_LOUNGER_LAYOUT.backPassage;
  } else if (atMin) safe.minZ = shelfBounds.minZ + SUN_SHELF_LOUNGER_LAYOUT.backPassage;
  else safe.maxZ = shelfBounds.maxZ - SUN_SHELF_LOUNGER_LAYOUT.backPassage;
  const route = {
    minX: Math.min(shelfBounds.minX,landing!.minX), maxX: Math.max(shelfBounds.maxX,landing!.maxX),
    minZ: Math.min(shelfBounds.minZ,landing!.minZ), maxZ: Math.max(shelfBounds.maxZ,landing!.maxZ),
  };
  if (alongX) {
    if(atMin) route.maxX=route.minX+SUN_SHELF_LOUNGER_LAYOUT.backPassage;
    else route.minX=route.maxX-SUN_SHELF_LOUNGER_LAYOUT.backPassage;
  } else if(atMin) route.maxZ=route.minZ+SUN_SHELF_LOUNGER_LAYOUT.backPassage;
  else route.minZ=route.maxZ-SUN_SHELF_LOUNGER_LAYOUT.backPassage;
  const { length, width } = SUN_SHELF_LOUNGER_MODEL;
  const { between } = SUN_SHELF_LOUNGER_LAYOUT;
  const start = alongX ? safe.minX : safe.minZ,
    end = alongX ? safe.maxX : safe.maxZ;
  const alongStart = atMin ? start : end - length,
    alongEnd = alongStart + length;
  // Project every obstacle intersecting the full chaise run into the transverse
  // axis. Adjacent treads must not fragment an otherwise continuous free row.
  let free: Array<readonly [number, number]> =
    end - start >= length - EPSILON
      ? [[alongX ? safe.minZ : safe.minX, alongX ? safe.maxZ : safe.maxX]]
      : [];
  for (const obstacle of obstacles) {
    const oStart = alongX ? obstacle.minX : obstacle.minZ,
      oEnd = alongX ? obstacle.maxX : obstacle.maxZ;
    if (oStart >= alongEnd - EPSILON || oEnd <= alongStart + EPSILON) continue;
    const cStart = alongX ? obstacle.minZ : obstacle.minX,
      cEnd = alongX ? obstacle.maxZ : obstacle.maxX;
    free = free.flatMap(([a, b]): Array<readonly [number, number]> => {
      if (cStart >= b - EPSILON || cEnd <= a + EPSILON) return [[a, b]];
      const remaining: Array<readonly [number, number]> = [
        [a, Math.max(a, cStart)],
        [Math.min(b, cEnd), b],
      ];
      return remaining.filter(([lo, hi]) => hi - lo > EPSILON);
    });
  }
  const candidates: SunShelfLoungerPlacement[] = [];
  for (const [crossStart, crossEnd] of free) {
    const count = Math.floor((crossEnd - crossStart + between + EPSILON) / (width + between));
    const occupiedWidth = count * width + Math.max(0, count - 1) * between;
    const first = (crossStart + crossEnd - occupiedWidth + width) / 2;
    const along = (alongStart + alongEnd) / 2;
    for (let index = 0; index < count; index++) {
      const cross = first + index * (width + between);
      const x = alongX ? along : cross,
        z = alongX ? cross : along;
      const footprint = rectangle({
        minX: x - (alongX ? length : width) / 2,
        maxX: x + (alongX ? length : width) / 2,
        minZ: z - (alongX ? width : length) / 2,
        maxZ: z + (alongX ? width : length) / 2,
      });
      if (clearOfInfinityEdge(outline, infinityExcluded, footprint)) {
        candidates.push({ x, y: shelf.topY, z, rotation, footprint });
      }
    }
  }
  if (candidates.length < SUN_SHELF_LOUNGER_LAYOUT.minimumCapacity)
    return unavailable(
      "Spazio insufficiente per due lettini da 178 × 59 cm con margini di 25 cm e accesso libero.",
    );
  // Select central positions first when the requested count is below capacity.
  candidates.sort((a, b) => {
    const center = alongX
      ? (shelfBounds.minZ + shelfBounds.maxZ) / 2
      : (shelfBounds.minX + shelfBounds.maxX) / 2;
    return (
      Math.abs((alongX ? a.z : a.x) - center) - Math.abs((alongX ? b.z : b.x) - center) ||
      a.x - b.x ||
      a.z - b.z
    );
  });
  const requested =
    quantity !== undefined && Number.isFinite(quantity)
      ? Math.max(1, Math.trunc(quantity))
      : candidates.length;
  const adjusted = enabled && requested > candidates.length;
  // Keep requested quantity in configuration, never render a misleading partial order.
  const count = enabled && !adjusted ? requested : 0;
  return {
    available: true,
    enabled: count > 0,
    capacity: candidates.length,
    count,
    adjusted,
    ...(adjusted ? { reason: "Quantità lettini non compatibile con lo spazio attuale. Riduci la quantità o ripristina le dimensioni." } : {}),
    placements: candidates.slice(0, count),
    passage: rectangle(route),
  };
}

type SunShelfLoungerConfig = PoolConfig & { sunShelfLoungerCount?: number };

/** Reconstruct from the same comfort/access geometry used by the pool scene. */
export function configuredSunShelfLoungers(config: SunShelfLoungerConfig): SunShelfLoungerPlan {
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const resolved = configuredPoolLayout(config);
  const layout = getPoolVerticalLayout({
    poolType: config.poolType ?? "in-ground",
    system: config.system,
    overflowType: config.overflowType,
    depth: config.dimensions.depth,
    copingThickness: POOL_BORDER_PRESET.thickness,
  });
  return resolveSunShelfLoungers({
    comfort: resolved.comfort,
    outline,
    waterY: layout.waterY,
    enabled: config.features.some((feature) => (feature as string) === "sunShelfLoungers"),
    quantity: config.sunShelfLoungerCount,
    accessFootprints: [
      ...(resolved.access.placement ? [resolved.access.footprint] : []),
      ...(resolved.ladder?.plan.placement ? [resolved.ladder.plan.footprint] : []),
    ],
    infinityExcluded:
      config.system === "infinity" && config.infinityEdge
        ? infinityExclusion(outline, config.infinityEdge, config.shape)
        : null,
  });
}

/** Explicit shelf removal deletes its dependent option. Geometry changes keep
 * intent and quantity; derived plans and compatibility issues gate use. */
export function normalizeSunShelfLoungers<T extends SunShelfLoungerConfig>(config: T): T {
  const selected = config.features.some((feature) => (feature as string) === "sunShelfLoungers");
  if (!selected || !config.features.includes("sunShelf")) {
    if (!selected && config.sunShelfLoungerCount === undefined) return config;
    const next = {
      ...config,
      features: config.features.filter((feature) => (feature as string) !== "sunShelfLoungers"),
    };
    delete next.sunShelfLoungerCount;
    return next;
  }
  if (config.sunShelfLoungerCount !== undefined) {
    const count = Number.isFinite(config.sunShelfLoungerCount) ? Math.max(1,Math.trunc(config.sunShelfLoungerCount)) : undefined;
    if (count !== config.sunShelfLoungerCount) {
      const next={...config};
      if(count === undefined) delete next.sunShelfLoungerCount;
      else next.sunShelfLoungerCount=count;
      return next;
    }
  }
  return config;
}
