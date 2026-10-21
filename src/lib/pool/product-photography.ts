import { LINER_COLORS } from "./config";
import { MOSAIC_FINISHES } from "@/configurator/materials/interior-textures";

type Bilingual = { it: string; en: string };
export type ProductPhotograph = {
  src: string;
  variants: readonly { src: string; width: number; height: number }[];
  match: "reference" | "exact-sample";
  source: string;
  author: string;
  license: string;
  authorization: string;
  alt: Bilingual;
  note: Bilingual;
  focalPoint: readonly [number, number];
};
type Requirement = {
  optionId: string;
  mediaKey: string;
  photo: ProductPhotograph | null;
  missing: string | null;
  retainedCatalogAsset?: string;
};

const ladder: ProductPhotograph = {
  src: "/product-photos/inox-ladder-960.jpg",
  variants: [480, 960].map((width) => ({
    src: `/product-photos/inox-ladder-${width}.jpg`,
    width,
    height: width / 2,
  })),
  match: "reference",
  source: "https://www.pexels.com/photo/stainless-swimming-pool-ladder-9119739/",
  author: "Pavel Danilyuk / Pexels",
  license: "https://www.pexels.com/license/",
  authorization:
    "Pexels License; website/app use and cropping permitted. Checked 2026-10-15. Not a stock collection or endorsement.",
  alt: {
    it: "Scaletta inox con due corrimano curvi sul bordo di una piscina reale.",
    en: "Stainless steel ladder with two curved handrails at a real pool edge.",
  },
  note: {
    it: "Foto indicativa del tipo di accesso, non del modello o della finitura di fornitura.",
    en: "Reference photo of the access type, not the exact supplied model or finish.",
  },
  focalPoint: [0.23, 0.5],
};
const loungers: ProductPhotograph = {
  src: "/product-photos/outdoor-chaise-960.jpg",
  variants: [480, 960].map((width) => ({
    src: `/product-photos/outdoor-chaise-${width}.jpg`,
    width,
    height: width / 2,
  })),
  match: "reference",
  source: "https://www.pexels.com/photo/lounge-chairs-by-a-swimming-pool-15780455/",
  author: "Alina Skazka / Pexels",
  license: "https://www.pexels.com/license/",
  authorization:
    "Pexels License; website/app use and cropping permitted. Checked 2026-10-15. Not a stock collection or endorsement.",
  alt: {
    it: "Quattro chaise longue su telaio con cuscini chiari, sulla pavimentazione asciutta a bordo piscina.",
    en: "Four frame loungers with pale cushions on dry poolside paving.",
  },
  note: {
    it: "Foto indicativa di arredi esterni, non di lettini immersi. Modello e finitura di fornitura possono differire.",
    en: "Reference photo of outdoor furniture, not immersed loungers. Supplied model and finish may differ.",
  },
  focalPoint: [0.63, 0.55],
};
const prun: ProductPhotograph = {
  src: "/product-photos/prun-365.jpg",
  variants: [
    { src: "/product-photos/prun-256.jpg", width: 256, height: 383 },
    { src: "/product-photos/prun-365.jpg", width: 365, height: 547 },
  ],
  match: "exact-sample",
  source: "public/textures/coping/prun/README.md",
  author: "Owner-supplied photograph",
  license: "Owner authorization for POOL-SHAPER; not a general third-party licence",
  authorization:
    "User supplied this exact Prun sample and requested its use. Existing project README records permission. Physical sample dimensions and supplier certification were not supplied.",
  alt: {
    it: "Campione fotografico fornito di Pietra di Prun chiara, con venature e pori naturali.",
    en: "Owner-supplied photographic sample of pale Prun stone with natural veining and pores.",
  },
  note: {
    it: "Fotografia del campione fornito; le variazioni naturali e il lotto di fornitura sono da confermare.",
    en: "Photograph of the supplied sample; natural variations and the supplied batch remain to be confirmed.",
  },
  focalPoint: [0.5, 0.5],
};
const missing = (optionId: string, mediaKey: string, reason: string): Requirement => ({
  optionId,
  mediaKey,
  photo: null,
  missing: reason,
});
const products: readonly [string, string][] = [
  ["skimmerType=slim", "skimmer-slim"],
  ["skimmerType=highWaterline", "skimmer-high"],
  ["overflowType=visible", "overflow-visible"],
  ["overflowType=hidden", "overflow-hidden"],
  ["infinityEdge.wallType=traditional", "infinity-traditional"],
  ["infinityEdge.wallType=glass", "infinity-glass"],
  ["internalStairType=linear", "access-steps-linear"],
  ["internalStairType=corner", "access-steps-corner"],
  ["poolAccess=stainlessSteelLadder", "access-ladder"],
  ["feature=externalStaircase", "access-external"],
  ["feature=sunShelf", "comfort-sunShelf"],
  ["hydromassage.variant=closed", "comfort-hydro-closed"],
  ["hydromassage.variant=open", "comfort-hydro-open"],
  ["feature=stairLighting", "stair-micro-spots"],
  ["feature=hydromassageBenchLighting", "bench-micro-spots"],
  ["feature=sunShelfLoungers", "equipment-sunShelfLoungers"],
  ["equipment=loungers", "equipment-loungers"],
  ["equipment=solarShower", "equipment-solarShower"],
  ["equipment=pellicano", "equipment-pellicano"],
  ["equipment=automaticCover", "equipment-automaticCover"],
];
const materialReason =
  "A photograph of this actual finish with documented reuse rights is missing. Synthetic/catalogue swatches are not counted as photographs.";
/** Complete option-to-photo mapping. Never replace missing photos with our own
 * configurator captures, another product, or an unlicensed photograph. */
export const productPhotographyRequirements: readonly Requirement[] = [
  ...products.map(([optionId, mediaKey]) => ({
    ...missing(
      optionId,
      mediaKey,
      "Correct model/detail and reusable photo required; no generic or 3D substitute.",
    ),
    photo:
      mediaKey === "access-ladder" ? ladder : mediaKey === "equipment-loungers" ? loungers : null,
    missing: ["access-ladder", "equipment-loungers"].includes(mediaKey)
      ? null
      : "Correct model/detail and reusable photo required; original temporary owner photographs are no longer on disk.",
  })),
  ...LINER_COLORS.map((item) => ({
    ...missing(
      `linerColor=${item.id}`,
      `liner-${item.id}`,
      "Manufacturer and redistribution permission undocumented; see docs/OWNER_INPUT_REQUIRED.md.",
    ),
    retainedCatalogAsset: item.texture,
  })),
  ...MOSAIC_FINISHES.map((item) => ({
    ...missing(
      `mosaicFinish=${item.id}`,
      item.id,
      "Existing catalogue PNG has no documented author/source or redistribution licence.",
    ),
    retainedCatalogAsset: item.preview,
  })),
  missing("structure=visible-stainless-steel", "structure-visible-stainless-steel", materialReason),
  ...["limestone", "prun", "travertine", "anthracite-gres", "ardesia", "deck-marrone", "wpc"].map(
    (id) => ({
      ...missing(`copingMaterial=${id}`, `coping-${id}`, materialReason),
      photo: id === "prun" ? prun : null,
      missing: id === "prun" ? null : materialReason,
    }),
  ),
  ...["gres", "wood", "istria", "limestone", "prun", "travertine", "ardesia", "wpc"].map((id) => ({
    ...missing(`paving=${id}`, `paving-${id}`, materialReason),
    photo: id === "prun" ? prun : null,
    missing: id === "prun" ? null : materialReason,
  })),
  ...["steel-satin", "composite-light", "gres", "wpc"].map((id) =>
    missing(`exteriorPanelFinish=${id}`, `panel-${id}`, materialReason),
  ),
];
export const productPhotographs: Readonly<Record<string, ProductPhotograph>> = Object.fromEntries(
  productPhotographyRequirements
    .filter((entry) => entry.photo)
    .map((entry) => [entry.mediaKey, entry.photo!]),
);
