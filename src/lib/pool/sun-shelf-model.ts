/** Published envelope; original procedural illustration, not manufacturer CAD
 * or installation approval. Layout reserves full length, not just contact area. */
export const SUN_SHELF_LOUNGER_MODEL = {
  id: "immersed-resin-chaise",
  reference: "Lyxo Esse · LT302-0001M1",
  source: "https://lyxodesign.com/prod/esse/",
  specification: "https://www.lyxodesign.com/wp-content/uploads/2025/04/Catalogo_Lyxo_2025.pdf",
  installation: "https://lyxodesign.com/prod/esse/",
  length: 1.85,
  width: 0.73,
  height: 0.57,
  // Illustrative profile details measured proportionally from owner photos,
  // not additional certified manufacturer dimensions.
  seatHeight: 0.11,
  kneeHeight: 0.25,
  maxWaterDepth: 0.2,
  supportLength: 1.2,
} as const;

/** Owner-approved 10 cm immersion, with the chaise supported on the platform.
 * The manufacturer's maximum admissible water depth above remains 20 cm. */
export const SUN_SHELF_WATER_DEPTH = 0.1;
export const DECK_CHAISE_MODEL = {
  reference: "Lyxo Esse Frame · LT303-0001M1",
  length: 1.85,
  width: 0.73,
  height: 0.77,
  shellLift: 0.2,
  cushionAllowance: 0.055,
} as const;

/** Presentation spacing in metres, not certified installation clearances. */
export const DECK_CHAISE_LAYOUT = {
  walkway: 1,
  between: 0.9,
  betweenPairs: 1,
  rearMargin: 0.4,
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
