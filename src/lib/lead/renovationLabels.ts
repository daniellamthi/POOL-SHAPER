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
  interiorFinish: "Interior Finish",
  filtration: "Pool Filtration System",
  coping: "Pool Edge / Coping",
  structure: "Pool Structure",
  equipment: "Pool Equipment Upgrade",
  complete: "Complete Pool Renovation",
};

export const FILTRATION_WORK_LABEL: Record<FiltrationWork, string> = {
  pump: "Replace Pump",
  filter: "Replace Filter",
  skimmers: "Replace Skimmers",
  overflow: "Convert to Overflow Edge Pool",
};

export const STRUCTURE_ISSUE_LABEL: Record<StructureIssue, string> = {
  leakage: "Water leakage",
  crack: "Structural crack",
  waterproofing: "Waterproofing problem",
  generalRepair: "General structural repair",
};

export const EQUIPMENT_UPGRADE_LABEL: Record<EquipmentUpgrade, string> = {
  salt: "Salt chlorination",
  dosing: "Automatic dosing",
  heatPump: "Heat pump",
  automation: "Automation / Smart Control",
};
