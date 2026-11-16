import type { PoolConfig } from "./types";
import { outlineBounds } from "./geometry";
import { configuredOutline } from "./configured-outline";
import { configuredPoolLayout } from "./resolved-layout";
import { normalizeComfortFeatures } from "./comfort-selection";
import { buildFloorProfile, shelfStairDimensions } from "./floor-profile";
import { getPoolVerticalLayout } from "./vertical-layout";
import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { SUN_SHELF_MIN_RUN, SUN_SHELF_WATER_DEPTH } from "./sun-shelf-model";

export type SunShelfRange =
  | { available: true; min: number; max: number; defaultRun: number; width: number; residualRun: number }
  | { available: false; reason: string };

/** A measure range, not an installation certification. The existing 2.4 m
 * residual swim-zone rule and real two-chaise/landing resolver are retained.
 * Probe the same full layout used by the renderer, never a surface-area proxy.
 * Does not change customer selections, buy furniture or resize the pool. */
export function configuredSunShelfRange(config: PoolConfig): SunShelfRange {
  const unavailable = (reason: string): SunShelfRange => ({ available: false, reason });
  if (config.poolType !== "in-ground") return unavailable("Disponibile per piscine interrate.");
  if (config.shape !== "rectangle") return unavailable("Disponibile per la forma rettangolare in questa versione.");
  const outline = configuredOutline(config);
  const bounds = outlineBounds(outline);
  const span = Math.max(bounds.spanX, bounds.spanZ);
  const vertical = getPoolVerticalLayout({ poolType: config.poolType, system: config.system,
    overflowType: config.overflowType, depth: config.dimensions.depth, copingThickness: POOL_BORDER_PRESET.thickness, copingStyle: config.copingStyle });
  const floorY = buildFloorProfile({ outline, shape: config.shape, poolType: config.poolType,
    dimensions: config.dimensions, verticalLayout: vertical }).shallowFloorY;
  const flight = shelfStairDimensions(span, vertical.waterY - SUN_SHELF_WATER_DEPTH, floorY, SUN_SHELF_MIN_RUN);
  if (!flight) return unavailable("Spazio o profondità insufficienti per spiaggetta, gradini e zona di nuoto residua.");
  const features = normalizeComfortFeatures([...config.features, "sunShelf"], "sunShelf");
  const at = (run: number) => {
    const layout = configuredPoolLayout({ ...config, features, dimensions: { ...config.dimensions, sunShelfRun: run } });
    const shelf = layout.comfort.elements.find(element => element.kind === "sunShelf");
    // Availability has already checked actual two-chaise footprints, their
    // connected rear passage, access and Infinity, including optional OFF.
    return layout.status !== "UNAVAILABLE" && shelf && layout.comfort.availability.sunShelf.available ? shelf : null;
  };
  const min = Math.ceil((flight.totalRun - 1e-7) * 1000) / 1000;
  const first = at(min);
  if (!first) {
    const proposal = configuredPoolLayout({ ...config, features, dimensions: { ...config.dimensions, sunShelfRun: min } });
    return unavailable(proposal.comfort.availability.sunShelf.reason ?? "Spazio insufficiente per due lettini e accesso libero.");
  }
  let lo = min, hi = span - 2.4;
  if (at(hi)) lo = hi;
  else {
    // Increasing the head-wall platform only consumes free longitudinal run.
    // A bounded millimetric search finds its first obstacle/access boundary;
    // it is numerical precision, not a new product/safety clearance.
    for (let i = 0; i < 24 && hi - lo > 0.0001; i++) {
      const mid = (lo + hi) / 2;
      if (at(mid)) lo = mid; else hi = mid;
    }
  }
  const max = Math.floor((lo + 1e-7) * 1000) / 1000;
  if (min > max) return unavailable("Il minimo utile non entra nello spazio disponibile.");
  return { available: true, min, max, defaultRun: min, width: first.width, residualRun: span - max };
}

export function sunShelfRunWithinRange(range: SunShelfRange, value: number): boolean {
  return range.available && Number.isFinite(value) && value >= range.min - 1e-7 && value <= range.max + 1e-7;
}
