/** Metric, non-metallic coping finishes shared by skimmer and concealed overflow.
 * `moduleSize` doubles as the material's physical texture repeat (metres) fed
 * to the triplanar coping shader, and `id` selects which procedural stone
 * bake (see stoneTextures.ts) backs the material -- each finish has its own
 * structural DNA, not just a recolored shared texture.
 *
 * `title` is the exact customer-facing name -- never show `id` in the UI.
 * `subtitle` is the short line under the name in the main selector;
 * `category` and `description` back the material detail view only. */
export const COPING_MATERIALS = [
  {
    id: "limestone",
    title: "Limestone Ivory",
    subtitle: "Soft contemporary limestone",
    category: "Natural stone",
    description: "A soft, homogeneous limestone with a fine, quietly contemporary grain.",
    color: "#e5dfd0",
    roughness: 0.75,
    normalStrength: 0.1,
    moduleSize: 1.3,
  },
  {
    id: "prun",
    title: "Pietra di Prun",
    subtitle: "Natural Lessinia stone",
    category: "Natural stone",
    description: "Authentic Lessinia limestone with a compact grain and delicate natural stratification.",
    color: "#c8beac",
    roughness: 0.8,
    normalStrength: 0.2,
    moduleSize: 1.2,
  },
  {
    id: "travertine",
    title: "Travertino Chiaro",
    subtitle: "Warm Italian stone",
    category: "Natural stone",
    description: "Warm Italian travertine with soft directional veining and restrained natural pores.",
    color: "#e6d8c0",
    roughness: 0.72,
    normalStrength: 0.22,
    moduleSize: 1.5,
  },
  {
    id: "beige-gres",
    title: "Gres Porcellanato Beige",
    subtitle: "Contemporary beige porcelain",
    category: "Porcelain stoneware",
    description: "A warm beige porcelain stoneware with a refined matte surface and consistent, engineered grain.",
    color: "#cdbfa2",
    roughness: 0.58,
    normalStrength: 0.06,
    moduleSize: 1.6,
  },
] as const;
export type CopingMaterialId = (typeof COPING_MATERIALS)[number]["id"];
