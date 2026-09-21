/**
 * Customer-facing Italian copy for the premium project summary. Kept
 * separate from `src/lib/pool/config.ts` on purpose -- those English
 * strings drive the wizard's own step UI and must stay untouched; this
 * file only translates canonical `PoolConfig` values into the language the
 * final summary is presented in.
 */
import type {
  InternalStairType,
  EquipmentId,
  LinerColor,
  PoolAccess,
  PoolFeatureId,
  PoolShapeId,
  PoolStructure,
  PoolType,
  OverflowType,
  SkimmerTypeId,
} from "@/lib/pool/types";

export const poolTypeLabel = (value: PoolType | null): string =>
  value === "above-ground" ? "Piscina fuori terra" : "Piscina interrata";

export const shapeLabel = (shape: PoolShapeId): string =>
  shape === "custom"
    ? "dalla forma personalizzata"
    : shape === "l-shape"
      ? "a L"
      : shape === "organic"
        ? "organica"
        : "rettangolare";

/** Short, customer-facing headline for the hydraulic system -- the
 * technical `skimmer`/`overflow` + `hiddenType` pair becomes one sentence. */
export function systemHeadline(system: "skimmer" | "overflow", overflowType: OverflowType): string {
  if (system === "skimmer") return "Skimmer — bordo classico";
  return overflowType === "visible" ? "Sfioro con griglia" : "Sfioro nascosto — acqua a filo";
}

/** A short, non-technical description of how the selected liner reads
 * underwater. Intentionally a fixed editorial mapping (not derived from the
 * shader's absorption/scattering constants) -- one sentence of atmosphere
 * copy per finish, not a colour-science summary. */
const WATER_CHARACTER_BY_LINER: Record<LinerColor, string> = {
  motionDeepSea603: "Acqua dai toni blu intenso",
  motionBlueSky602: "Acqua dalle tonalità azzurro cristallino",
  motionArcticWhite180: "Acqua dai riflessi turchese",
  motionSandBeach179: "Acqua dalle tonalità acquamarina",
  motionGreyRock798: "Acqua dai toni grigio-blu naturali",
  motionBlackStone799: "Acqua profonda e specchiante",
};

export const linerWaterCharacter = (color: LinerColor): string =>
  WATER_CHARACTER_BY_LINER[color] ?? "Il colore dell'acqua segue la tonalità scelta";

export const MOSAIC_WATER_CHARACTER =
  "Il colore dell'acqua rispecchierà la tonalità del mosaico selezionato";

export const POOL_ACCESS_LABEL: Record<PoolAccess, string> = {
  internalSteps: "Scala interna integrata",
  stainlessSteelLadder: "Scaletta in acciaio inox",
};

export const INTERNAL_STAIR_LABEL: Record<InternalStairType, string> = {
  linear: "Scala lineare",
  corner: "Scala ad angolo",
};

export const POOL_FEATURE_LABEL: Record<PoolFeatureId, string> = {
  ledLighting: "Illuminazione subacquea a LED",
  hydromassage: "Idromassaggio integrato",
  externalStaircase: "Scala esterna",
};

export const EQUIPMENT_LABEL: Record<EquipmentId, string> = {
  automaticCover: "Copertura automatica",
  heatPump: "Pompa di calore",
  saltElectrolysis: "Elettrolisi al sale",
  automaticDosing: "Dosaggio automatico cloro / pH",
};

/** Only surfaced inside the summary's "Scopri i dettagli tecnici" panel. */
export const STRUCTURE_LABEL: Record<PoolStructure, string> = {
  "reinforced-concrete": "Cemento armato",
  "modular-steel-panels": "Pannelli modulari in acciaio",
  "modular-steel-structure": "Struttura modulare in acciaio",
};

export const SKIMMER_TYPE_LABEL: Record<SkimmerTypeId, string> = {
  standard: "Standard",
  slim: "Slim / moderno",
  highWaterline: "Livello acqua alto",
  flush: "Filo parete",
};
