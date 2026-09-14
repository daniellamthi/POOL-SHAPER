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
    subtitle: "Grey stone with mineral inclusions",
    category: "Natural stone",
    description: "A grey natural-stone finish with pale mineral inclusions, following the selected reference.",
    color: "#91938e",
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
    // Keep the saved selection ID compatible; the reference replaces its finish.
    id: "anthracite-gres",
    title: "Gres Porcellanato Beige",
    subtitle: "Warm matte porcelain",
    category: "Porcelain stoneware",
    description: "Warm beige porcelain stoneware with a fine, uniform grain and a refined matte surface.",
    color: "#d6c3a8",
    roughness: 0.62,
    normalStrength: 0.07,
    moduleSize: 1.6,
  },
] as const;
export type CopingMaterialId = (typeof COPING_MATERIALS)[number]["id"];
