/** Presentation choices never change the pool or its compatibility rules. */
import { COPING_MATERIALS, type CopingMaterialId } from "./coping-materials";
import { isReferenceFinish } from "./reference-finishes";
export type PavingId = "gres" | "wood" | "istria" | Exclude<CopingMaterialId, "anthracite-gres" | "deck-marrone">;
export const PAVING_FORMATS = {
  "30x60": { label: "30 × 60 cm", module: [0.6, 0.3] },
  "60x60": { label: "60 × 60 cm", module: [0.6, 0.6] },
  "60x120": { label: "60 × 120 cm", module: [1.2, 0.6] },
  "50x50": { label: "50 × 50 cm", module: [0.5, 0.5] },
  "50x100": { label: "50 × 100 cm", module: [1, 0.5] },
  "wpc-140x2200": { label: "Doghe 140 × 2200 mm", module: [2.2, 0.14] },
  "wood-140x2400": { label: "Doghe 140 × 2400 mm", module: [2.4, 0.14] },
  "40x60": { label: "40 × 60 cm", module: [0.6, 0.4] },
  "90x90": { label: "90 × 90 cm", module: [0.9, 0.9] },
} as const;
export type PavingFormatId = keyof typeof PAVING_FORMATS;
const REFERENCE_STONE_FORMATS = ["60x120", "30x60", "60x60"] as const;
const FORMATS: Record<PavingId, readonly PavingFormatId[]> = {
  gres: ["60x120", "30x60", "60x60"],
  travertine: ["60x120", "30x60", "60x60"],
  limestone: ["60x120", "30x60", "60x60"],
  prun: ["50x100", "50x50"],
  wpc: ["wpc-140x2200"], wood: ["wood-140x2400"],
  istria: ["40x60"], ardesia: ["90x90"],
  "reference-light": REFERENCE_STONE_FORMATS,
  "reference-grigio": REFERENCE_STONE_FORMATS,
  "reference-avorio": REFERENCE_STONE_FORMATS,
  "reference-beige": REFERENCE_STONE_FORMATS,
  "reference-greige": REFERENCE_STONE_FORMATS,
  "reference-ipe": ["wood-140x2400"],
  "reference-travertine-light": REFERENCE_STONE_FORMATS,
  "reference-travertine-veined": REFERENCE_STONE_FORMATS,
};
export const pavingFormats = (material: unknown) => FORMATS[pavingId(material)];
export function pavingFormatId(material: unknown, value?: unknown): PavingFormatId {
  const formats = pavingFormats(material);
  return formats.includes(value as PavingFormatId) ? value as PavingFormatId : formats[0]!;
}
/** Dimensions describe the visualization, not a certified supplier specification. */
export function pavingLayout(material: unknown, format?: unknown) {
  const id = pavingId(material), formatId = pavingFormatId(id, format);
  const boards = id === "wood" || id === "wpc" || id === "reference-ipe";
  return { ...PAVING.find(p => p.id === id)!, formatId,
    formatLabel: PAVING_FORMATS[formatId].label, module: PAVING_FORMATS[formatId].module,
    gap: boards ? 0.005 : 0.003, thickness: boards ? 0.025 : 0.02,
    boards, dimensionalStatus: "visualization-reference" as const };
}
export type PremiumEnvironment = "outdoor-villa" | "indoor-wellness" | "panorama-infinity";
export const PAVING: ReadonlyArray<{ id: PavingId; label: string; module: readonly [number, number]; color: string; maps: string | null; note: string }> = [
  { id: "gres", label: "Gres porcellanato", module: [1.2, 0.6], color: "#c5bfb5", maps: "gres", note: "Effetto minerale · formato selezionabile" },
  { id: "wood", label: "Legno decking", module: [2.4, 0.14], color: "#a88b6b", maps: "deck", note: "Doghe 240 × 14 cm · riferimento del materiale esistente" },
  { id: "istria", label: "Pietra d’Istria", module: [0.6, 0.4], color: "#dad8c9", maps: null, note: "Resa indicativa, non scansione certificata · 60 × 40 cm" },
  ...COPING_MATERIALS.filter(m => m.id !== "anthracite-gres" && m.id !== "deck-marrone").map(m => ({
    id: m.id as PavingId, label: m.title, module: PAVING_FORMATS[FORMATS[m.id as PavingId][0]!].module,
    color: m.id === "prun" ? "#ffffff" : m.color,
    maps: m.id === "prun" ? "prun" : "asset" in m ? m.asset.dir.split("/").at(-1)! : null,
    note: isReferenceFinish(m.id) ? "Finitura fotografica di riferimento · selezione indipendente" : "Finitura del catalogo bordo · selezione indipendente",
  })),
];
export const PREMIUM_ENVIRONMENTS = [
  { id: "outdoor-villa", label: "Outdoor Villa", description: "Architettura contemporanea intorno alla tua piscina." },
  { id: "indoor-wellness", label: "Indoor Wellness", description: "Vetrate, bosco e sauna: spazio dimensionato sulla vasca." },
  { id: "panorama-infinity", label: "Panorama Infinity", description: "Identità costiera Simons Town, senza modificare il sistema piscina." },
] as const;
export const pavingId = (value: unknown): PavingId => PAVING.some(p => p.id === value) ? value as PavingId : "gres";
export const pavingMaterialsForPool = (poolType: unknown) => PAVING.filter(p => poolType === "in-ground" || !isReferenceFinish(p.id));
export const pavingForPool = (value: unknown, poolType: unknown): PavingId => poolType === "above-ground" && isReferenceFinish(value) ? "gres" : pavingId(value);
export const premiumEnvironment = (value: unknown): PremiumEnvironment => PREMIUM_ENVIRONMENTS.some(p => p.id === value) ? value as PremiumEnvironment : "outdoor-villa";
