import { exteriorPanelFinishTitle } from "@/lib/pool/above-ground";
import {
  EQUIPMENT,
  FINISHES,
  LINER_COLORS,
  POOL_SHAPES,
  CUSTOMER_STRUCTURES,
  customerStructureOf,
  POOL_TYPES,
  SKIMMER_TYPES,
  STEP_GROUPS,
  STEPS,
} from "@/lib/pool/config";
import { COPING_MATERIALS } from "@/lib/pool/coping-materials";
import { PAVING, pavingId } from "@/lib/pool/presentation";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";
import { isVisibleStainlessStructure } from "@/lib/pool/structure-finish";
import type { PoolConfig } from "@/lib/pool/types";

/** One numbered entry of the primary navigation (a group of internal steps). */
export interface MacroStep {
  id: string;
  label: string;
  /** Internal step indices (into STEPS) that belong to this macro step. */
  indices: number[];
  complete: boolean;
  reachable: boolean;
  /** One-line value under the phase name: the chosen value once the phase
   * is complete, "In corso" while it is current, empty ahead. */
  value?: string;
}

/** Customer-facing title and one-line explanation per internal step. */
export const STEP_COPY: Record<string, { title: string; subtitle: string }> = {
  project: {
    title: "Tipo di progetto",
    subtitle: "Una nuova piscina o la ristrutturazione di una esistente.",
  },
  "pool-type": { title: "Installazione", subtitle: "Interrata nel terreno o fuori terra." },
  structure: {
    title: "Struttura",
    subtitle: "Il sistema costruttivo della vasca. Vedi la struttura grezza nel 3D.",
  },
  "shape-dimensions": {
    title: "Forma e dimensioni",
    subtitle:
      "Pianta vista dall’alto per lunghezza e larghezza, vista in sezione per la profondità.",
  },
  system: {
    title: "Sistema piscina",
    subtitle: "Come l’acqua viene filtrata: decide il livello dell’acqua rispetto al bordo.",
  },
  access: {
    title: "Accesso e comfort",
    subtitle: "Come si entra in acqua e le zone relax integrate.",
  },
  style: { title: "Rivestimento", subtitle: "Il materiale interno che dà colore all’acqua." },
  lighting: {
    title: "Acqua e luci",
    subtitle: "I fari subacquei e il loro colore, con un’anteprima notturna per valutarli.",
  },
  deck: {
    title: "Bordo e decking",
    subtitle: "Il bordo della vasca e la pavimentazione attorno: qui compare l’esterno.",
  },
  technology: {
    title: "Optional esterni",
    subtitle: "Copertura, doccia solare e tecnologia dell’impianto.",
  },
  review: {
    title: "Presentazione",
    subtitle: "La tua piscina finita: scena, riepilogo e richiesta di proposta.",
  },
};

/** A step with no real decision for this configuration would be skipped by
 * navigation. None today: the finish step always offers a choice (steel:
 * "Acciaio a vista" or "Liner"; concrete: "Liner" or "Mosaico"). */
export function isStepSkipped(_stepId: string | undefined, _config: PoolConfig) {
  return false;
}

export function buildMacros(
  config: PoolConfig,
  current: number,
  isStepComplete: (index: number) => boolean,
): MacroStep[] {
  // Every earlier required step must be complete before a later one opens.
  let firstIncomplete = STEPS.length;
  for (let index = 0; index < STEPS.length; index++) {
    if (!isStepComplete(index)) {
      firstIncomplete = index;
      break;
    }
  }
  return STEP_GROUPS.map((group) => {
    const indices = group.stepIds
      .map((id) => STEPS.findIndex((step) => step.id === id))
      .filter((index) => index >= 0);
    const first = indices[0] ?? 0;
    const complete = indices.every((index) => index < current && isStepComplete(index));
    return {
      id: group.id,
      label: group.label,
      indices,
      complete,
      reachable: first <= Math.max(current, firstIncomplete),
      value: indices.includes(current)
        ? "In corso"
        : complete
          ? describePhase(group.id, config)
          : "",
    };
  });
}

/** The completed value shown under a phase name in the header. */
function describePhase(groupId: string, config: PoolConfig): string {
  if (groupId === "piscina") {
    const d = config.dimensions;
    const structure = CUSTOMER_STRUCTURES.find(
      (s) => s.id === customerStructureOf(config.structure),
    )?.title;
    const size = `${d.length.toFixed(1).replace(".", ",")} × ${d.width.toFixed(1).replace(".", ",")} m`;
    return structure ? `${structure} · ${size}` : size;
  }
  const stepId = (
    {
      sistema: "system",
      accesso: "access",
      finiture: "style",
      esterno: "deck",
      optional: "technology",
    } as Record<string, string>
  )[groupId];
  return stepId ? describeSelection(stepId, config) : "";
}

const title = <T extends { id: string; title: string }>(list: ReadonlyArray<T>, id: unknown) =>
  list.find((item) => item.id === id)?.title;

/** The current choice of a step in one short line, shown in the tray. */
export function describeSelection(stepId: string | undefined, config: PoolConfig): string {
  const d = config.dimensions;
  switch (stepId) {
    case "project":
      return config.projectType === "renovation"
        ? "Ristrutturazione"
        : config.projectType === "new"
          ? "Nuova piscina"
          : "Da scegliere";
    case "pool-type":
      return title(POOL_TYPES, config.poolType) ?? "Da scegliere";
    case "structure":
      return (
        CUSTOMER_STRUCTURES.find((s) => s.id === customerStructureOf(config.structure))?.title ??
        "Da scegliere"
      );
    case "shape-dimensions":
      return config.shapeSelected
        ? `${title(POOL_SHAPES, config.shape) ?? ""} · ${d.length.toFixed(2)} × ${d.width.toFixed(2)} m · prof. ${d.depth.toFixed(2)} m`
        : "Scegli la forma";
    case "system":
      return config.system === "skimmer"
        ? `Skimmer · ${title(SKIMMER_TYPES, config.skimmerType) ?? ""}`
        : config.system === "overflow"
          ? `Sfioro ${config.overflowType === "hidden" ? "nascosto" : "a vista"}`
          : config.infinityEdge?.enabled
            ? "Infinity · lato scelto"
            : "Infinity · scegli il lato";
    case "access": {
      const parts = [
        config.poolAccess === "internalSteps"
          ? "Scala interna"
          : config.poolAccess === "stainlessSteelLadder"
            ? "Scaletta inox"
            : config.poolType === "above-ground"
              ? "Scala interna disattivata"
              : "Accesso da scegliere",
      ];
      if (config.poolType === "above-ground" && config.features.includes("externalStaircase"))
        parts.push("Scala esterna");
      if (config.features.includes("sunShelf")) parts.push("Sun shelf");
      else if (config.features.includes("hydromassage"))
        parts.push(config.hydromassageVariant === "open" ? "Idromassaggio B" : "Idromassaggio A");
      if (config.features.includes("integratedBench")) parts.push("Panca");
      return parts.join(" · ");
    }
    case "style":
      if (config.poolType === "above-ground") {
        const interior = isVisibleStainlessStructure(config.structure)
          ? "Acciaio a vista"
          : `Liner ${(title(LINER_COLORS, config.linerColor) ?? "").replace("Motion ", "")}`;
        return `${interior} · pannelli ${exteriorPanelFinishTitle(config).toLowerCase()}`;
      }
      if (isVisibleStainlessStructure(config.structure)) return "Acciaio a vista · inox satinato";
      return config.finish === "mosaic"
        ? `Mosaico · ${MOSAIC_FINISHES.find((m) => m.id === config.mosaicFinish)?.name ?? ""}`
        : `${title(FINISHES, "liner")} · ${(title(LINER_COLORS, config.linerColor) ?? "").replace("Motion ", "")}`;
    case "lighting":
      return `${config.sceneTime === "night" ? "Notte" : "Giorno"} · ${config.features.includes("ledLighting") ? "LED subacquei" : "senza luci"}`;
    case "deck": {
      const coping =
        COPING_MATERIALS.find((c) => c.id === (config.copingMaterial ?? "travertine"))?.title ?? "";
      return config.poolType === "above-ground"
        ? coping
        : `${coping} · ${PAVING.find((p) => p.id === pavingId(config.paving))?.label ?? ""}`;
    }
    case "technology": {
      const chosen = EQUIPMENT.filter((e) => config.equipment.includes(e.id)).map((e) => e.title);
      return chosen.length ? chosen.join(" · ") : "Nessun optional";
    }
    case "review":
      return `${d.length.toFixed(1)} × ${d.width.toFixed(1)} m · pronta per la proposta`;
    default:
      return "";
  }
}
