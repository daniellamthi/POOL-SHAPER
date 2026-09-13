/** Metric, non-metallic coping finishes shared by skimmer and concealed overflow. */
export const COPING_MATERIALS = [
  { id: "light-gres", title: "Gres porcellanato chiaro effetto pietra", color: "#c9c8bf", roughness: 0.78, normalStrength: 0.14, moduleSize: 0.6 },
  { id: "prun", title: "Pietra di Prun", color: "#c5aa9c", roughness: 0.86, normalStrength: 0.24, moduleSize: 0.5 },
  { id: "travertine", title: "Travertino chiaro", color: "#dbccb0", roughness: 0.9, normalStrength: 0.4, moduleSize: 0.4 },
  { id: "anthracite-gres", title: "Gres porcellanato antracite / grigio scuro effetto pietra", color: "#45494a", roughness: 0.76, normalStrength: 0.12, moduleSize: 0.6 },
] as const;
export type CopingMaterialId = (typeof COPING_MATERIALS)[number]["id"];
