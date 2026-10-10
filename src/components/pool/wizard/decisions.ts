import type { PoolConfig } from "@/lib/pool/types";

/** Ordered decisions shared by tabs and Next/Back. No saved product state. */
export function decisions(step: string | undefined, config: PoolConfig): { id: string; label: string }[] {
  const above = config.poolType === "above-ground";
  switch (step) {
    case "shape-dimensions": return [{ id: "shape", label: "Forma" }, { id: "plan", label: "Lunghezza e larghezza" }, { id: "depth", label: "Profondità" }];
    case "system": return [{ id: "system", label: "Sistema acqua" }, { id: "detail", label: config.system === "infinity" ? "Lato Infinity" : config.system === "overflow" ? "Tipologia di sfioro" : "Modello skimmer" }];
    case "access": return [{ id: "access", label: "Accesso" }, ...(!above ? [{ id: "comfort", label: "Comfort in acqua" }] : [])];
    case "style": return [{ id: "interior", label: "Rivestimento interno" }, ...(above ? [{ id: "exterior", label: "Pannelli esterni" }] : [])];
    case "lighting": return [{ id: "lighting", label: "Illuminazione" }, ...(config.features.includes("ledLighting") ? [{ id: "color", label: "Colore LED" }] : [])];
    case "deck": return [...(!(config.system === "overflow" && config.overflowType === "visible") ? [{ id: "coping", label: "Bordo vasca" }] : []), ...(!above ? [{ id: "paving", label: "Pavimentazione" }] : [])];
    case "technology": return [{ id: "outdoor", label: "Esterni" }, { id: "water", label: "Trattamento acqua" }, { id: "heat", label: "Temperatura" }];
    case "review": return [{ id: "scene", label: "Scena" }, { id: "summary", label: "Riepilogo" }, { id: "request", label: "Richiedi proposta" }];
    default: return [];
  }
}

export interface DecisionProps {
  tab: string;
  setTab: (tab: string) => void;
}
