/**
 * Renovation-flow label lookups for the commercial email (P6B). Mirrors
 * the same option labels `RenovationSteps.tsx` already shows the
 * customer in `RenovationReviewStep` -- kept here as its own small,
 * read-only copy (rather than exporting RenovationSteps.tsx's private
 * consts) so this file has no dependency on wizard-step UI internals.
 */
import type {
  EquipmentUpgrade,
  FiltrationWork,
  RenovationArea,
  StructureIssue,
} from "@/lib/pool/types";

export const RENOVATION_AREA_LABEL: Record<RenovationArea, string> = {
  interiorFinish: "Rivestimento interno",
  filtration: "Impianto di filtrazione",
  coping: "Bordo piscina",
  structure: "Ripristini della struttura",
  equipment: "Optional impianto",
  complete: "Ristrutturazione completa",
};

export const FILTRATION_WORK_LABEL: Record<FiltrationWork, string> = {
  pump: "Sostituzione pompa",
  filter: "Sostituzione filtro",
  skimmers: "Sostituzione skimmer",
  overflow: "Conversione a sfioro",
};

export const STRUCTURE_ISSUE_LABEL: Record<StructureIssue, string> = {
  leakage: "Perdite d’acqua",
  crack: "Fessurazioni",
  waterproofing: "Impermeabilizzazione",
  generalRepair: "Ripristino generale",
};

export const EQUIPMENT_UPGRADE_LABEL: Record<EquipmentUpgrade, string> = {
  salt: "Clorazione a sale",
  dosing: "Dosaggio automatico",
  heatPump: "Pompa di calore",
  automation: "Automazione e controllo",
};
