import type { PoolConfig, PoolStructure } from "./types";

export type StructureFamily = "STEEL_PANELS" | "REINFORCED_CONCRETE" | "VISIBLE_STAINLESS_STEEL";
export function structureFamily(structure: PoolStructure | null): StructureFamily | null {
  if (structure === null) return null;
  if (structure === "reinforced-concrete") return "REINFORCED_CONCRETE";
  return structure === "visible-stainless-steel" ? "VISIBLE_STAINLESS_STEEL" : "STEEL_PANELS";
}

export interface ConstructionPresentation {
  stage: "structure" | "system" | "access" | "finish" | "water";
  raw: boolean;
  structure: StructureFamily | null;
  showWater: boolean;
  showSystemComponents: boolean;
  showAccessories: boolean;
  showLighting: boolean;
  /** Late-stage poolside context (wide terrace, lawn, loungers, optional
   * solar shower). Never shown while the customer is still choosing the
   * structure, system, access or finish. */
  showEnvironment: boolean;
  /** Coping-level paving around the basin: from Bordo e decking on. */
  showDecking: boolean;
  label: string | null;
}

/** A presentation of the canonical configuration, not another saved pool.
 * Back/Next recompute this without clearing previously selected options. */
export function constructionPresentation(
  config: Pick<PoolConfig, "projectType" | "structure">,
  stepId?: string,
  technicalView = false,
): ConstructionPresentation {
  const structure = structureFamily(config.structure);
  if (technicalView && config.projectType === "new") {
    return {
      stage: "structure",
      raw: true,
      structure,
      showWater: false,
      showSystemComponents: true,
      showAccessories: false,
      showLighting: false,
      showEnvironment: false,
      showDecking: false,
      label: structure === "STEEL_PANELS"
        ? "Vista tecnica · pannelli strutturali in acciaio"
        : structure === "VISIBLE_STAINLESS_STEEL"
          ? "Vista tecnica · vasca inox a vista"
          : structure === "REINFORCED_CONCRETE"
            ? "Vista tecnica · vasca strutturale in CLS"
            : "Vista tecnica · scegli la struttura",
    };
  }
  const stage =
    config.projectType !== "new"
      ? "water"
      : stepId === "system"
        ? "system"
        : stepId === "access"
          ? "access"
          : stepId === "style"
            ? "finish"
            : ["lighting", "deck", "technology", "review"].includes(stepId ?? "")
              ? "water"
              : "structure";
  const raw = stage !== "finish" && stage !== "water";
  return {
    stage, raw, structure, showWater: stage === "water",
    showSystemComponents: stage !== "structure",
    showAccessories: stage === "access" || stage === "finish" || stage === "water",
    showLighting: stage === "water",
    // Progressive reveal: decking first appears at Bordo e decking, the
    // lifestyle context (wide terrace, lawn, loungers, shower) only with the
    // exterior optionals and the final presentation.
    showDecking:
      config.projectType === "renovation" ||
      ["deck", "technology", "review"].includes(stepId ?? ""),
    showEnvironment:
      config.projectType === "new" && ["technology", "review"].includes(stepId ?? ""),
    label: raw
      ? structure === "STEEL_PANELS"
        ? "Struttura · Pannelli in acciaio"
        : structure === "VISIBLE_STAINLESS_STEEL"
          ? "Struttura · Acciaio inox a vista"
          : structure === "REINFORCED_CONCRETE"
            ? "Struttura · Cemento armato"
            : "Scegli la struttura"
      : stage === "finish"
        ? structure === "VISIBLE_STAINLESS_STEEL"
          ? "Finitura · vasca inox a vista"
          : "Rivestimento · vasca asciutta"
        : null,
  };
}
