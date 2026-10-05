import { POOL_BORDER_PRESET } from "@/configurator/materials/visual-presets";
import { copingOuterOffset } from "@/components/pool/three/poolConstruction";
import { buildOutline, outlineBounds } from "./geometry";
import { planSkimmers } from "./engineering";
import { configuredPoolLayout } from "./resolved-layout";
import { getPoolVerticalLayout } from "./vertical-layout";
import type { PoolConfig } from "./types";

/** A product-fit decision, not a claim about motor, anchorage or safety compliance. */
export interface CoverPlan {
  status: "VALID" | "AUTO_ADJUSTED" | "UNAVAILABLE";
  reason: string | null;
  enabled: boolean;
  position: "open" | "closed";
  /** Progressive deployment of the slat mat, 0 = open .. 1 = closed. Scene
   * only: `position` stays the quoted state and `geometry` never carries it. */
  extension: number;
  footprint: { minX: number; maxX: number; minZ: number; maxZ: number };
  waterY: number;
  housingSide: "minX" | "maxX";
  housingX: number;
  housingY: number;
  slatRun: number;
  geometry: null | {
    footprint: CoverPlan["footprint"];
    waterY: number;
    housingSide: CoverPlan["housingSide"];
    housingX: number;
    housingY: number;
    slatRun: number;
  };
}

/** Clamp a stored slider value; anything else falls back to the two-state position. */
export function normalisedCoverExtension(value: unknown, position: "open" | "closed"): number {
  return typeof value === "number" && Number.isFinite(value)
    ? Math.min(1, Math.max(0, value))
    : position === "closed" ? 1 : 0;
}

/** Resolves the requested cover against the actual basin, without changing the saved quote. */
export function resolveAutomaticCover(config: PoolConfig): CoverPlan {
  const enabled = config.equipment.includes("automaticCover");
  const position = enabled && config.coverPosition === "closed" ? "closed" : "open";
  const extension = enabled ? normalisedCoverExtension(config.coverExtension, position) : 0;
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const bounds = outlineBounds(outline);
  const footprint = { minX: bounds.minX, maxX: bounds.maxX, minZ: bounds.minZ, maxZ: bounds.maxZ };
  const poolType = config.poolType ?? "in-ground";
  const elevations = getPoolVerticalLayout({
    poolType,
    system: config.system,
    overflowType: config.overflowType,
    depth: config.dimensions.depth,
    copingThickness: POOL_BORDER_PRESET.thickness,
  });
  const waterY = elevations.waterY;
  const housingY = elevations.copingY + 0.115;
  let housingSide: "minX" | "maxX" = "minX";
  let adjusted = false;
  const slatRun = Math.max(0, bounds.spanX - 0.06);
  let reason: string | null = null;
  if (config.shape !== "rectangle") reason = "Copertura disponibile solo per vasche rettangolari in questa versione.";
  else if (poolType !== "in-ground") reason = "Il fissaggio fuori terra richiede un progetto dedicato.";
  else if (config.system === "infinity") reason = "Il supporto sul bordo Infinity richiede verifica tecnica.";
  else if (config.poolAccess === "stainlessSteelLadder" || config.features.includes("inoxLadder"))
    reason = "La scala inox emersa interferisce con la corsa della copertura.";
  else if (bounds.spanX < bounds.spanZ)
    reason = "La vasca è orientata sull'asse non supportato da questo rullo.";
  else if (bounds.spanX < 5.5 || bounds.spanZ < 2.5)
    reason = "Luce libera insufficiente per questo modello di copertura.";
  if (enabled && !reason) {
    const skimmers = config.system === "skimmer"
      ? planSkimmers(outline, bounds.spanX * bounds.spanZ, true).positions
      : [];
    const comfort = configuredPoolLayout(config).comfort.elements
      .filter((element) => element.kind === "sunShelf" || element.kind === "hydromassage");
    const conflict = (side: "minX" | "maxX") => {
      const edgeX = side === "minX" ? bounds.minX : bounds.maxX;
      return skimmers.some((point) => Math.abs(point.x - edgeX) < 0.36) ||
        comfort.some((element) => {
          const b = outlineBounds(element.footprint);
          return Math.abs((side === "minX" ? b.minX : b.maxX) - edgeX) < 0.08;
        });
    };
    if (conflict("minX")) {
      if (conflict("maxX")) reason = "Nessuna testata libera per il rullo, tra accessi e componenti tecnici.";
      else { housingSide = "maxX"; adjusted = true; }
    }
  }
  const housingX = housingSide === "minX"
    ? bounds.minX - copingOuterOffset(config.system, config.overflowType) - 0.2
    : bounds.maxX + copingOuterOffset(config.system, config.overflowType) + 0.2;
  const geometry = enabled && !reason
    ? { footprint, waterY, housingSide, housingX, housingY, slatRun }
    : null;
  return {
    status: reason ? "UNAVAILABLE" : adjusted ? "AUTO_ADJUSTED" : "VALID",
    reason: adjusted ? "Rullo spostato sulla testata libera da accesso e componenti." : reason,
    enabled, position, extension, footprint, waterY, housingSide, housingX, housingY, slatRun, geometry,
  };
}
