/** Metric, non-metallic coping finishes shared by skimmer and concealed overflow.
 * `moduleSize` doubles as the material's physical texture repeat (metres) fed
 * to the triplanar coping shader, and `id` selects which procedural stone
 * bake (see stoneTextures.ts) backs the material -- each finish has its own
 * structural DNA, not just a recolored shared texture. */
export const COPING_MATERIALS = [
  { id: "limestone", title: "Limestone Ivory", color: "#e5dfd0", roughness: 0.75, normalStrength: 0.1, moduleSize: 1.3 },
  { id: "prun", title: "Pietra di Prun", color: "#c8beac", roughness: 0.8, normalStrength: 0.2, moduleSize: 1.2 },
  { id: "travertine", title: "Travertino Chiaro", color: "#e6d8c0", roughness: 0.72, normalStrength: 0.22, moduleSize: 1.5 },
  { id: "anthracite-gres", title: "Gres Antracite Premium", color: "#4b4e50", roughness: 0.62, normalStrength: 0.07, moduleSize: 1.6 },
] as const;
export type CopingMaterialId = (typeof COPING_MATERIALS)[number]["id"];
