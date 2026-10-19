const INCH = 0.0254;

/** Published envelope; original procedural illustration, not manufacturer CAD
 * or installation approval. Layout reserves full length, not just contact area. */
export const SUN_SHELF_LOUNGER_MODEL = {
  id: "immersed-resin-chaise",
  reference: "Ledge Lounger Signature Chaise",
  source: "https://ledgeloungers.com/products/signature-chaise",
  specification: "https://ledgeloungers.com/cdn/shop/files/LL-Spec-Sheet-Signature-Chaise.pdf?v=15147070456672585287",
  installation: "https://ledgeloungers.com/cdn/shop/files/Installation_Chaise.pdf?v=3181761249778378105",
  length: 70 * INCH,
  width: 23 * INCH,
  height: 22 * INCH,
  seatHeight: 2.5 * INCH,
  kneeHeight: 10 * INCH,
  maxWaterDepth: 9 * INCH,
  supportLength: 44 * INCH,
} as const;

/** Owner's preliminary layout criteria, not certified installation clearances.
 * The real stair/landing strip is reserved separately from these margins. */
export const SUN_SHELF_LOUNGER_LAYOUT = {
  edgeInset: 0.25,
  between: 0.24,
  accessBuffer: 0.3,
  minimumCapacity: 2,
  minimumAccessWidth: 0.9,
  backPassage: 0.9,
} as const;

// Include the existing 35 mm shell inset before a shelf is joined to its wall.
export const SUN_SHELF_MIN_RUN = SUN_SHELF_LOUNGER_MODEL.length +
  SUN_SHELF_LOUNGER_LAYOUT.backPassage + SUN_SHELF_LOUNGER_LAYOUT.edgeInset + 0.035;
