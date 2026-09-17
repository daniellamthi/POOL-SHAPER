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
    moduleSize: 0.45,
  },
  {
    id: "prun",
    title: "Pietra di Prun",
    subtitle: "Grey stone with mineral inclusions",
    category: "Natural stone",
    description:
      "A grey natural-stone finish with pale mineral inclusions, following the selected reference.",
    color: "#91938e",
    roughness: 0.8,
    normalStrength: 0.2,
    moduleSize: 0.4,
  },
  {
    id: "travertine",
    title: "Travertino",
    subtitle: "Warm Italian stone",
    category: "Natural stone",
    description:
      "Warm Italian travertine with soft directional veining and restrained natural pores.",
    // Scanned asset: `color`/`roughness`/`normalStrength` are deliberately
    // neutral so the real BaseColor and Roughness maps drive the response
    // untinted -- a tint here would destroy the scanned material identity.
    color: "#ffffff",
    roughness: 1,
    normalStrength: 1,
    moduleSize: 0.7,
    asset: {
      dir: "/textures/coping/travertino",
      source: "AmbientCG Travertine009 (https://ambientcg.com/view?id=Travertine009)",
      license: "CC0 1.0",
      maps: "BaseColor, NormalGL, Roughness, AO",
      resolution: 512,
    },
  },
  {
    // Keep the saved selection ID compatible; the reference replaces its finish.
    id: "anthracite-gres",
    title: "Gres Porcellanato",
    subtitle: "Warm matte porcelain",
    category: "Porcelain stoneware",
    description:
      "Large-format porcelain stoneware in a warm greige concrete-effect matte finish, grout-free across the coping run.",
    color: "#ffffff",
    roughness: 1,
    normalStrength: 1,
    moduleSize: 1.2,
    asset: {
      dir: "/textures/coping/gres",
      source: "AmbientCG Concrete027 (https://ambientcg.com/view?id=Concrete027)",
      license: "CC0 1.0",
      maps: "BaseColor, NormalGL, Roughness, AO",
      resolution: 512,
    },
  },
  {
    id: "ardesia",
    title: "Ardesia",
    subtitle: "Natural slate",
    category: "Natural stone",
    description:
      "Natural slate with mineral cleavage layering, quartz veining and a matte, non-reflective surface.",
    color: "#ffffff",
    // This scanned set ships no roughness map (only a specular map, which is
    // not a roughness channel). A calibrated scalar stands in: honed slate is
    // matte but not chalk-dry.
    roughness: 0.74,
    normalStrength: 1,
    moduleSize: 0.9,
    asset: {
      dir: "/textures/coping/ardesia",
      source:
        "ShareTextures 'Dark Olive Slatefloor' (dark-olive-slate), via CC0-Public-Domain-Textures",
      license: "CC0 1.0",
      maps: "BaseColor, Normal (OpenGL), AO — no roughness map in source",
      resolution: 512,
      roughnessMap: false,
      // Native 512x249 source, used as-is. `moduleSize` sets the long edge;
      // the shader scales V by this so the short edge keeps true proportion.
      aspect: 512 / 249,
    },
  },
  {
    id: "deck-marrone",
    title: "Deck Marrone",
    subtitle: "Brown timber decking",
    category: "Wood decking",
    description:
      "Brown exterior timber decking with natural grain and staggered board courses at true board width.",
    color: "#ffffff",
    roughness: 1,
    normalStrength: 1,
    // ~8 board courses per tile, so a 1.1 m repeat lands each board near a
    // real 0.14 m decking width.
    moduleSize: 1.1,
    asset: {
      dir: "/textures/coping/deck",
      source: "AmbientCG Planks012 (https://ambientcg.com/view?id=Planks012)",
      license: "CC0 1.0",
      maps: "BaseColor, NormalGL, Roughness, AO",
      resolution: 512,
    },
  },
  {
    id: "wpc",
    title: "WPC",
    subtitle: "Wood-plastic composite decking",
    category: "Composite decking",
    description:
      "Wood-plastic composite decking: a clean, uniform board grain, more controlled than real wood.",
    color: "#6b5f52",
    roughness: 0.58,
    normalStrength: 0.1,
    moduleSize: 0.16,
  },
] as const;
export type CopingMaterialId = (typeof COPING_MATERIALS)[number]["id"];
