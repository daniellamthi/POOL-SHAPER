import type { PoolConfig } from "./types";
import { configuredPoolLayout } from "./resolved-layout";
import { configuredOutline } from "./configured-outline";
import { outlineBounds } from "./geometry";

export type InternalStairWidthRange =
  | { available: true; min: number; max: number; defaultWidth: number }
  | { available: false; reason: string };

const automaticConfig = (config: PoolConfig): PoolConfig => {
  const { internalStairWidth: _width, ...automatic } = config;
  return automatic;
};
const integratedFlight = (layout: ReturnType<typeof configuredPoolLayout>) =>
  layout.comfort.elements.find(element => (element.kind === "sunShelf" || element.kind === "hydromassage") && !!element.steps?.length);

/** Same real footprints, fittings, Infinity exclusions and comfort clearances as the scene. */
export function internalStairWidthFits(config: PoolConfig, width: number): boolean {
  if (!Number.isFinite(width) || width < 0.8 || width > 100) return false;
  const automatic = configuredPoolLayout(automaticConfig(config));
  const integrated = integratedFlight(automatic);
  if (!integrated && (config.poolAccess !== "internalSteps" || config.internalStairType === "corner" || !automatic.access.placement)) return false;
  const candidate = configuredPoolLayout({ ...config, internalStairWidth: width });
  if (candidate.status === "UNAVAILABLE") return false;
  return integrated
    ? !!candidate.comfort.elements.find(element => element.kind === integrated.kind && !!element.steps?.length)
    : !!candidate.access.placement && Math.abs(candidate.access.width - width) < 1e-7;
}

/** Range is calculated only when pool geometry/options change, never on every slider tick. */
export function configuredInternalStairWidthRange(config: PoolConfig): InternalStairWidthRange {
  const automatic = automaticConfig(config);
  const plan = configuredPoolLayout(automatic);
  const integrated = integratedFlight(plan);
  if (!integrated && config.internalStairType === "corner") return { available: false,
    reason: config.features.includes("hydromassage")
      ? "La scala angolare mantiene pedate e raggi costruttivi fissi. Usa SX e DX per scegliere il lato."
      : "La scala angolare mantiene pedate e raggi costruttivi fissi. Scegli Rettilinea per regolare la larghezza." };
  if (!integrated && (config.poolAccess !== "internalSteps" || !plan.access.placement)) return { available: false,
    reason: "Seleziona una scala rettilinea compatibile per regolarne la larghezza." };
  const bounds = outlineBounds(configuredOutline(automatic));
  const span = Math.min(bounds.spanX, bounds.spanZ);
  const defaultWidth = integrated ? Math.min(1.2, span - 1.2) : plan.access.width;
  if (!internalStairWidthFits(automatic, defaultWidth)) return { available: false,
    reason: "La scala non è compatibile con lo spazio attuale. Modifica la piscina o ripristina la larghezza automatica." };
  // Search outwards from the known valid automatic flight. A fixed wall/corner
  // prevents the solver from jumping to a different end as its width increases.
  let lo = defaultWidth, hi = Math.max(defaultWidth, span - 0.2);
  if (internalStairWidthFits(automatic, hi)) lo = hi;
  else for (let i = 0; i < 16 && hi - lo > 0.001; i++) {
    const mid = (lo + hi) / 2;
    if (internalStairWidthFits(automatic, mid)) lo = mid; else hi = mid;
  }
  const max = Math.floor((lo + 1e-7) * 100) / 100;
  // A narrower shelf access may violate its existing 90 cm passage criterion.
  let min = 0.8;
  while (min < defaultWidth - 0.001 && !internalStairWidthFits(automatic, min)) min = Math.round((min + 0.05) * 100) / 100;
  min = Math.min(defaultWidth, min);
  return { available: true, min, max: Math.max(max, defaultWidth), defaultWidth };
}
