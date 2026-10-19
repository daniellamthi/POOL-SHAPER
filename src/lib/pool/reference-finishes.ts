/** Owner supplied photographic references. These are colour photographs, not
 * measured albedo/normal/roughness scans or certified supplier specifications.
 * Pixel coordinates are measured from the unchanged original's top-left. */
export type ReferencePoint = readonly [number, number];
export type ReferenceSample =
  | { kind: "rectangle"; pixels: readonly [number, number, number, number] }
  | { kind: "quadrilateral"; pixels: readonly [ReferencePoint, ReferencePoint, ReferencePoint, ReferencePoint] };

type ReferenceFinish = {
  id: string;
  title: string;
  titleEn: string;
  subtitle: string;
  subtitleEn: string;
  category: string;
  description: string;
  color: "#ffffff";
  roughness: number;
  normalStrength: 0;
  moduleSize: number;
  textureSize: readonly [number, number];
  boards: boolean;
  sourceImage: number;
  imageSize: readonly [number, number];
  sample: ReferenceSample;
  /** Different real boards from the same unchanged photograph. */
  additionalSamples?: readonly ReferenceSample[];
  swatchPixels?: readonly [number, number, number, number];
  /** Neutral linear-light correction for lighting baked into a photograph.
   * Visual calibration only, never a measured material reflectance claim. */
  photographicExposure?: number;
  asset: {
    dir: string;
    url: string;
    source: string;
    license: string;
    maps: string;
    normalMap: false;
    roughnessMap: false;
    mirroredRepeat: false;
    aspect: number;
  };
};

const asset = (image: number, aspect: number) => ({
  dir: "/textures/references/20261018",
  url: `/textures/references/20261018/image-${image}.jpeg`,
  source: `Owner-supplied reference photograph ${image}, 2026-10-18`,
  license: "Owner supplied for this project; no external redistribution licence asserted",
  maps: "Photographic colour reference only; no measured PBR data supplied",
  normalMap: false as const,
  roughnessMap: false as const,
  mirroredRepeat: false as const,
  aspect,
});

const stone = { color: "#ffffff", roughness: 0.82, normalStrength: 0,
  moduleSize: 1.2, boards: false, category: "Finitura minerale di riferimento" } as const;

export const REFERENCE_FINISHES = [
  {
    ...stone, id: "reference-light", title: "Finitura 1", titleEn: "Finish 1",
    subtitle: "Campione fotografico chiaro", subtitleEn: "Light photographic sample",
    description: "Campione chiaro fornito dal cliente. Materiale e nome commerciale da confermare.",
    sourceImage: 1, imageSize: [1226, 438],
    sample: { kind: "rectangle", pixels: [8, 8, 1210, 422] },
    textureSize: [1.2, 1.2 * 422 / 1210], asset: asset(1, 1210 / 422),
  },
  {
    ...stone, id: "reference-grigio", title: "Finitura 2", titleEn: "Finish 2",
    subtitle: "Campione minerale grigio", subtitleEn: "Grey mineral sample",
    description: "Finitura grigia dalla fotografia fornita dal cliente; specifiche commerciali da confermare.",
    sourceImage: 2, imageSize: [1057, 1202],
    sample: { kind: "rectangle", pixels: [20, 10, 1020, 1018] },
    textureSize: [1.2, 1.2 * 1018 / 1020], asset: asset(2, 1020 / 1018),
  },
  {
    ...stone, id: "reference-avorio", title: "Finitura 3", titleEn: "Finish 3",
    subtitle: "Campione minerale avorio", subtitleEn: "Ivory mineral sample",
    description: "Finitura avorio dalla fotografia fornita dal cliente; specifiche commerciali da confermare.",
    sourceImage: 3, imageSize: [571, 665],
    sample: { kind: "rectangle", pixels: [38, 8, 523, 531] },
    textureSize: [1.2, 1.2 * 531 / 523], asset: asset(3, 523 / 531),
  },
  {
    ...stone, id: "reference-beige", title: "Finitura 4", titleEn: "Finish 4",
    subtitle: "Campione minerale beige", subtitleEn: "Beige mineral sample",
    description: "Finitura beige dalla fotografia fornita dal cliente; specifiche commerciali da confermare.",
    sourceImage: 4, imageSize: [548, 692],
    sample: { kind: "rectangle", pixels: [9, 8, 529, 531] },
    textureSize: [1.2, 1.2 * 531 / 529], asset: asset(4, 529 / 531),
  },
  {
    ...stone, id: "reference-greige", title: "Finitura 5", titleEn: "Finish 5",
    subtitle: "Campione minerale greige", subtitleEn: "Greige mineral sample",
    description: "Finitura greige dalla fotografia fornita dal cliente; specifiche commerciali da confermare.",
    sourceImage: 5, imageSize: [557, 662],
    sample: { kind: "rectangle", pixels: [14, 8, 533, 535] },
    textureSize: [1.2, 1.2 * 535 / 533], asset: asset(5, 533 / 535),
  },
  {
    ...stone, id: "reference-ipe", title: "Finitura 6", titleEn: "Finish 6",
    subtitle: "Doghe longitudinali · scala di visualizzazione", subtitleEn: "Longitudinal boards · visualisation scale",
    category: "Legno decking", roughness: 0.9, moduleSize: 2.4, boards: true,
    photographicExposure: 0.55,
    description: "Colore e venatura dalla fotografia Ipè. Doghe 2,40 × 0,14 m come riferimento di visualizzazione già usato dal configuratore, non formato commerciale garantito.",
    sourceImage: 6, imageSize: [1143, 566],
    // One uninterrupted central board, inside its photographed seams; no
    // text, furniture, sea or neighbouring boards enters the sample.
    sample: { kind: "quadrilateral", pixels: [[570, 340], [583, 340], [662, 540], [628, 540]] },
    additionalSamples: [
      { kind: "quadrilateral", pixels: [[524, 285], [533, 285], [567, 496], [536, 496]] },
      { kind: "quadrilateral", pixels: [[688, 300], [696, 300], [1006, 540], [973, 540]] },
      { kind: "quadrilateral", pixels: [[720, 300], [728, 300], [1029, 500], [1002, 500]] },
    ],
    swatchPixels: [612, 458, 10, 20],
    textureSize: [2.4, 0.14], asset: asset(6, 2.4 / 0.14),
  },
  {
    ...stone, id: "reference-travertine-light", title: "Finitura 7", titleEn: "Finish 7",
    subtitle: "Travertino chiaro · pori naturali", subtitleEn: "Light travertine · natural pores",
    category: "Pietra naturale", roughness: 0.86,
    description: "Travertino chiaro dalla foto di posa fornita. Campionata una sola lastra interna, escludendo fughe e icona fotografica; formato di posa indicativo.",
    sourceImage: 7, imageSize: [1320, 1085],
    sample: { kind: "quadrilateral", pixels: [[650, 570], [1100, 570], [1150, 800], [580, 800]] },
    textureSize: [1.2, 0.6], asset: asset(7, 2),
  },
  {
    ...stone, id: "reference-travertine-veined", title: "Finitura 8", titleEn: "Finish 8",
    subtitle: "Venatura sedimentaria longitudinale", subtitleEn: "Longitudinal sedimentary veins",
    category: "Pietra naturale", roughness: 0.83,
    description: "Travertino venato dalla fotografia fornita dal cliente. Venatura mantenuta nella direzione originale, senza rotazioni o specchiature casuali.",
    sourceImage: 8, imageSize: [1320, 858],
    sample: { kind: "rectangle", pixels: [12, 12, 1294, 664] },
    textureSize: [1.2, 1.2 * 664 / 1294], asset: asset(8, 1294 / 664),
  },
] as const satisfies readonly ReferenceFinish[];

export type ReferenceFinishId = (typeof REFERENCE_FINISHES)[number]["id"];
export const referenceFinish = (value: unknown) => REFERENCE_FINISHES.find(finish => finish.id === value);
export const isReferenceFinish = (value: unknown): value is ReferenceFinishId => Boolean(referenceFinish(value));

/** Design visualisation dimensions, independent of pool size; the supplied
 * photographs contain no ruler or supplier-format certification. */
export const REFERENCE_FINISH_DIMENSIONAL_STATUS = "visualization-reference-not-supplier-specification" as const;

/** Forward projective map from an unwarped [0,1] sample to source pixels.
 * The projection corrects the photograph's camera angle; it does not alter
 * or resynthesize any source pixel. Rectangle width/height are pixel extents. */
export function referenceSampleMatrix(sample: ReferenceSample, imageSize: readonly [number, number]): readonly number[] {
  const [width, height] = imageSize;
  const points: readonly ReferencePoint[] = sample.kind === "rectangle"
    ? [[sample.pixels[0], sample.pixels[1]], [sample.pixels[0] + sample.pixels[2], sample.pixels[1]],
      [sample.pixels[0] + sample.pixels[2], sample.pixels[1] + sample.pixels[3]], [sample.pixels[0], sample.pixels[1] + sample.pixels[3]]]
    : sample.pixels;
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = points.map(([x, y]) => [x / width, 1 - y / height] as const) as [ReferencePoint, ReferencePoint, ReferencePoint, ReferencePoint];
  const dx1 = x1 - x2, dx2 = x3 - x2, dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2, dy2 = y3 - y2, dy3 = y0 - y1 + y2 - y3;
  const denominator = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(denominator) < 1e-12) throw new Error("Degenerate photographic reference sample");
  const g = (dx3 * dy2 - dx2 * dy3) / denominator;
  const h = (dx1 * dy3 - dx3 * dy1) / denominator;
  // Column-major, directly accepted by THREE.Matrix3.fromArray.
  return [x1 - x0 + g * x1, y1 - y0 + g * y1, g,
    x3 - x0 + h * x3, y3 - y0 + h * y3, h, x0, y0, 1];
}
