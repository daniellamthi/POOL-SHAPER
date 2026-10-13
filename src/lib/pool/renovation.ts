import type { PoolConfig, RenovationConfig, RenovationArea } from "./types";
import { FINISHES, LINER_COLORS, RENOVATION_STEPS } from "./config";
import { COPING_MATERIALS } from "./coping-materials";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";
import { allowedFinishesForStructure, structureSupportsPoolType } from "./structure-finish";
import { getCustomerValidation } from "./validation";
import { configuredAccessPlan } from "./access-plan";

export const renovationIncludes = (r: RenovationConfig, area: RenovationArea) =>
  r.areas.includes("complete") || r.areas.includes(area);

/** Catalogue has real textures but no commercial mosaic names. Never invent brands. */
export function renovationMosaicLabel(id: string) {
  const index = MOSAIC_FINISHES.findIndex(m => m.id === id);
  const item = MOSAIC_FINISHES[index];
  return item && !/^Mosaic [A-F0-9]{8}$/i.test(item.name) ? item.name
    : `Campione mosaico ${String(Math.max(0, index) + 1).padStart(2, "0")}`;
}
export const renovationLinerLabel = (name: string) => name.replace(/\s*\[\d+\]$/, "");

/** Reject malformed restored/server payloads, while retaining valid Build 2 snapshots. */
export function isRenovationConfig(value: unknown): value is RenovationConfig {
  if (!value || typeof value !== "object") return false;
  const r = value as RenovationConfig;
  const list = (v: unknown, allowed: readonly string[]) => Array.isArray(v) &&
    v.length <= allowed.length && new Set(v).size === v.length && v.every(id => allowed.includes(id));
  if (!list(r.areas, ["interiorFinish", "filtration", "coping", "structure", "equipment", "complete"]) ||
      !list(r.filtrationWorks, ["pump", "filter", "skimmers", "overflow"]) ||
      !list(r.structureIssues, ["leakage", "crack", "waterproofing", "generalRepair"]) ||
      !list(r.equipmentUpgrades, ["salt", "dosing", "heatPump", "automation"]) ||
      !["liner", "mosaic"].includes(r.currentFinish) ||
      ![null, true, false].includes(r.replaceCoping) || typeof r.copingMaterial !== "string" ||
      r.copingMaterial.length > 200) return false;
  if (r.existing !== undefined) {
    const e = r.existing;
    if (!e || typeof e !== "object" || Array.isArray(e)) return false;
    const valid = (v: unknown, allowed: readonly unknown[]) => v === undefined || allowed.includes(v);
    if (!valid(e.poolType, ["in-ground", "above-ground"]) ||
        !valid(e.structure, ["reinforced-concrete", "modular-steel-panels"]) ||
        !valid(e.system, ["skimmer", "overflow"]) || !valid(e.overflowType, ["visible", "hidden"]) ||
        !valid(e.finish, ["liner", "mosaic"]) || !valid(e.poolAccess, [null, "internalSteps", "stainlessSteelLadder"]) ||
        !valid(e.internalStairType, ["linear", "corner"]) ||
        !valid(e.linerColor, LINER_COLORS.map(c => c.id)) ||
        !valid(e.mosaicFinish, MOSAIC_FINISHES.map(c => c.id)) ||
        !valid(e.copingMaterial, COPING_MATERIALS.map(c => c.id))) return false;
    if (e.structure && e.poolType && !structureSupportsPoolType(e.structure, e.poolType)) return false;
    if (e.finish && e.structure && !allowedFinishesForStructure(e.structure).includes(e.finish)) return false;
  }
  return true;
}

export function cleanRenovation(r: RenovationConfig): RenovationConfig {
  return {
    ...r,
    ...(r.existing?.poolType === "above-ground" ? {
      currentFinish: "liner",
      existing: { ...r.existing, structure: "modular-steel-panels", finish: "liner",
        ...(r.existing.poolAccess === "stainlessSteelLadder" ? { poolAccess: null } : {}) },
    } : {}),
    filtrationWorks: renovationIncludes(r, "filtration") ? r.filtrationWorks.filter(id =>
      (r.existing?.system !== "overflow" || (id !== "skimmers" && id !== "overflow")) &&
      (id !== "skimmers" || !r.filtrationWorks.includes("overflow"))) : [],
    structureIssues: renovationIncludes(r, "structure") ? r.structureIssues : [],
    equipmentUpgrades: renovationIncludes(r, "equipment") ? r.equipmentUpgrades : [],
    replaceCoping: renovationIncludes(r, "coping") ? r.replaceCoping : null,
    copingMaterial: renovationIncludes(r, "coping") && r.replaceCoping === true ? r.copingMaterial : "",
  };
}

/** Existing architecture remains untouched: only configuration inputs change. */
export function renovationPreviewConfig(config: PoolConfig, r: RenovationConfig, before = false): PoolConfig {
  if (config.projectType !== "renovation" || !r.existing) return config;
  const e = r.existing;
  const finish = before || !renovationIncludes(r, "interiorFinish") ? e.finish ?? r.currentFinish : config.finish;
  const system = !before && renovationIncludes(r, "filtration") && r.filtrationWorks.includes("overflow")
    ? "overflow" : e.system ?? config.system;
  const { infinityEdge: _edge, ...base } = config;
  return {
    ...base,
    poolType: e.poolType ?? config.poolType,
    structure: e.structure ?? config.structure,
    finish: finish !== "none" && allowedFinishesForStructure(e.structure ?? config.structure).includes(finish) ? finish : "liner",
    linerColor: before || !renovationIncludes(r, "interiorFinish") ? e.linerColor ?? config.linerColor : config.linerColor,
    mosaicFinish: before || !renovationIncludes(r, "interiorFinish") ? e.mosaicFinish ?? config.mosaicFinish : config.mosaicFinish,
    system,
    overflowType: before || e.system === "overflow" ? e.overflowType ?? config.overflowType : config.overflowType,
    poolAccess: e.poolAccess !== undefined ? e.poolAccess : config.poolAccess,
    internalStairType: e.internalStairType ?? config.internalStairType ?? "linear",
    dimensions: e.poolType === "above-ground" ? { ...config.dimensions, floorProfile: "flat" } : config.dimensions,
    copingMaterial: !before && renovationIncludes(r, "coping") && r.replaceCoping &&
      COPING_MATERIALS.some(c => c.id === r.copingMaterial)
      ? r.copingMaterial as NonNullable<PoolConfig["copingMaterial"]> : e.copingMaterial ?? "travertine",
  };
}

export interface RenovationDecision { id: string; label: string }
export function renovationDecisions(stepId: string | undefined, r: RenovationConfig): RenovationDecision[] {
  if (stepId === "renovation-pool") return [
    { id: "shape", label: "Forma" }, { id: "plan", label: "Dimensioni" },
    { id: "structure", label: "Installazione e struttura" }, { id: "depth", label: "Profondità e fondo" },
    { id: "system", label: "Sistema esistente" }, { id: "finish", label: "Rivestimento esistente" },
    { id: "access", label: "Accesso esistente" },
  ];
  if (stepId === "renovation-details") return [
    ...(renovationIncludes(r, "interiorFinish") ? [{ id: "interiorFinish", label: "Nuovo rivestimento" }] : []),
    ...(renovationIncludes(r, "filtration") ? [{ id: "filtration", label: "Impianto" }] : []),
    ...(renovationIncludes(r, "coping") ? [{ id: "coping", label: "Bordo" }] : []),
    ...(renovationIncludes(r, "structure") ? [{ id: "structure", label: "Ripristini" }] : []),
    ...(renovationIncludes(r, "equipment") ? [{ id: "equipment", label: "Optional" }] : []),
  ];
  return [];
}

export function renovationDecisionComplete(stepId: string | undefined, tab: string, c: PoolConfig, r: RenovationConfig): boolean {
  const e = r.existing;
  if (stepId === "renovation-pool") {
    if (tab === "shape") return c.shapeSelected === true;
    if (tab === "structure") return !!e?.poolType && !!e.structure;
    if (tab === "system") return !!e?.system && (e.system !== "overflow" || !!e.overflowType);
    if (tab === "finish") return e?.finish === "liner" ? !!e.linerColor : e?.finish === "mosaic" && !!e.mosaicFinish;
    if (tab === "access") return e?.poolAccess !== undefined &&
      (e.poolAccess === null || !configuredAccessPlan(renovationPreviewConfig(c, r, true)).reason);
    return true;
  }
  if (stepId === "renovation-details") {
    if (tab === "coping") return r.replaceCoping !== null &&
      (!r.replaceCoping || COPING_MATERIALS.some(c => c.id === r.copingMaterial));
    if (tab === "interiorFinish") return FINISHES.some(f => f.id === c.finish) &&
      c.finish !== "none" && allowedFinishesForStructure(c.structure).includes(c.finish);
  }
  return true;
}

export function renovationStepComplete(index: number, c: PoolConfig, r: RenovationConfig): boolean {
  if (index === 0) return c.projectType === "renovation";
  if (index === 1) return r.areas.length > 0;
  if (index === 2 || index === 3) return renovationDecisions(RENOVATION_STEPS[index]?.id, r)
    .every(d => renovationDecisionComplete(RENOVATION_STEPS[index]?.id, d.id, c, r));
  if (index === 4) return getCustomerValidation(c.customer).valid;
  return true;
}

export function renovationMacroReachable(index: number, current: number, complete: (index: number) => boolean) {
  return index <= current || Array.from({ length: index }, (_, i) => i).every(complete);
}
