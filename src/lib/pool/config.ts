import type {
  ControlPoint,
  CustomerInfo,
  Dimensions,
  EquipmentId,
  FinishMaterial,
  LinerColor,
  PoolFeatureId,
  PoolStructure,
  PoolType,
  PoolShapeId,
  SkimmerFinishId,
  SkimmerTypeId,
  StepDefinition,
} from "./types";

export const DIMENSION_LIMITS = {
  length: { min: 3, max: 25, step: 0.1, unit: "m" },
  width: { min: 2, max: 12, step: 0.1, unit: "m" },
  depth: { min: 0.8, max: 1.5, step: 0.05, unit: "m" },
  cornerRadius: { min: 0, max: 1, step: 0.01, unit: "" },
  /** Shallow-end depth for a sloped floor. Same physical range as `depth` --
   * the shallow end is still a real, standing-depth pool floor, never a
   * beach entry -- further clamped below `depth` by `clampShallowDepth`
   * (floor-profile.ts) so the slope itself is always real and finite. */
  shallowDepth: { min: 0.8, max: 1.5, step: 0.05, unit: "m" },
  /** L-shape only. These are the SLIDER's own static range -- the real,
   * size-dependent minimum/maximum (never let a leg thin to a corridor) is
   * enforced by `clampLShapeDimensions` (l-shape.ts) wherever the outline is
   * actually built, the same two-tier pattern `shallowDepth` already uses
   * against `depth` via `clampShallowDepth`. */
  lShapeRecessLength: { min: 1.5, max: 20, step: 0.1, unit: "m" },
  lShapeRecessWidth: { min: 1.5, max: 12, step: 0.1, unit: "m" },
} as const;

export type DimensionKey = keyof typeof DIMENSION_LIMITS;

export const DEFAULT_DIMENSIONS: Dimensions = {
  length: 10,
  width: 4.5,
  depth: 1.5,
  cornerRadius: 0.25,
};

export const DEFAULT_CUSTOMER: CustomerInfo = {
  name: "",
  surname: "",
  company: "",
  email: "",
  phone: "",
  city: "",
  country: "",
  notes: "",
};

/** Default editable outline for the custom shape (unit space, clockwise). */
export const DEFAULT_CONTROL_POINTS: ReadonlyArray<ControlPoint> = [
  [-0.5, -0.36],
  [-0.16, -0.5],
  [0.22, -0.5],
  [0.5, -0.3],
  [0.5, 0.32],
  [0.18, 0.5],
  [-0.2, 0.5],
  [-0.5, 0.34],
];

export const PROJECT_TYPES = [
  {
    id: "new" as const,
    title: "Nuova piscina",
    description:
      "Una costruzione completa, dallo scavo e la struttura fino a finiture e tecnologia.",
  },
  {
    id: "renovation" as const,
    title: "Ristrutturazione piscina",
    description: "Rimodella, riveste e ammoderna una vasca esistente con impianti contemporanei.",
  },
];

export const POOL_TYPES: ReadonlyArray<{
  id: PoolType;
  title: string;
  description: string;
}> = [
  {
    id: "in-ground",
    title: "Piscina interrata",
    description: "Una piscina installata completamente sotto il livello del terreno.",
  },
  {
    id: "above-ground",
    title: "Piscina fuori terra",
    description: "Una piscina installata sopra il livello del terreno circostante.",
  },
];

export const POOL_STRUCTURES: ReadonlyArray<{
  id: PoolStructure;
  poolTypes: ReadonlyArray<PoolType>;
  title: string;
}> = [
  { id: "reinforced-concrete", poolTypes: ["in-ground"], title: "Cemento armato" },
  { id: "modular-steel-panels", poolTypes: ["in-ground"], title: "Pannelli modulari in acciaio" },
  {
    id: "modular-steel-structure",
    poolTypes: ["above-ground"],
    title: "Struttura modulare in acciaio",
  },
];

export const CUSTOMER_FIELDS: ReadonlyArray<{
  key: keyof CustomerInfo;
  label: string;
  type: "text" | "email" | "tel";
  autoComplete: string;
  span?: boolean;
}> = [
  { key: "name", label: "Name", type: "text", autoComplete: "given-name" },
  { key: "company", label: "Company (optional)", type: "text", autoComplete: "organization" },
  { key: "email", label: "Email", type: "email", autoComplete: "email", span: true },
  { key: "phone", label: "Phone", type: "tel", autoComplete: "tel", span: true },
  { key: "city", label: "City", type: "text", autoComplete: "address-level2" },
  { key: "country", label: "Country", type: "text", autoComplete: "country-name" },
];

export interface ShapeDefinition {
  id: PoolShapeId;
  title: string;
  description: string;
  supportsCornerRadius: boolean;
}

export const POOL_SHAPES: ReadonlyArray<ShapeDefinition> = [
  {
    id: "rectangle",
    title: "Rettangolare",
    description: "Geometria architettonica a corsia, con spigoli puramente rettilinei.",
    supportsCornerRadius: false,
  },
  {
    id: "l-shape",
    title: "A L",
    description: "Due bracci rettangolari uniti ad angolo retto, per planimetrie articolate.",
    supportsCornerRadius: false,
  },
  {
    id: "custom",
    title: "Forma personalizzata",
    description:
      "Disegna il perimetro con punti di controllo modificabili, o carica una planimetria.",
    supportsCornerRadius: false,
  },
];

export const getShapeDefinition = (id: PoolShapeId): ShapeDefinition =>
  POOL_SHAPES.find((shape) => shape.id === id) ?? POOL_SHAPES[0]!;

export const FINISHES: ReadonlyArray<{
  id: FinishMaterial;
  title: string;
  description: string;
  color: string;
  roughness: number;
  metalness: number;
}> = [
  {
    id: "liner",
    title: "Liner PVC",
    description: "Membrana rinforzata 150/100, saldata in opera. Sei finiture architettoniche.",
    color: "#dfe9ec",
    roughness: 0.32,
    metalness: 0.02,
  },
  {
    id: "mosaic",
    title: "Mosaico",
    description: "Tessere in vetro con profondità iridescente e fughe sottili.",
    color: "#8fc4d2",
    roughness: 0.12,
    metalness: 0.06,
  },
];

/** Skimmer face-frame finish. A short, self-contained list -- extend it here
 * when more finishes are needed, nothing else has to change. `metalness`
 * defaults to 0 (moulded ABS) except the satin AISI-316-style steel finish. */
export const SKIMMER_FINISHES: ReadonlyArray<{
  id: SkimmerFinishId;
  title: string;
  hex: string;
  roughness: number;
  metalness: number;
}> = [
  { id: "white", title: "Bianco ABS", hex: "#f5f5f1", roughness: 0.24, metalness: 0 },
  { id: "graphite", title: "Antracite ABS", hex: "#3a3d3f", roughness: 0.32, metalness: 0 },
  { id: "sand", title: "Sabbia ABS", hex: "#d8cdb8", roughness: 0.3, metalness: 0 },
  // Satin AISI-316-style stainless steel -- brushed, not mirror-polished, so
  // no fake chrome: roughness is high enough to keep specular highlights soft.
  { id: "steel", title: "Acciaio satinato", hex: "#c7cbca", roughness: 0.4, metalness: 0.9 },
];

/** Skimmer housing family. Each id maps to a real geometry variant in
 * `Skimmers.tsx` (`SKIMMER_GEOMETRY`) -- differences are dimensional
 * (throat/frame proportions, recess depth, waterline offset), never a
 * colour-only reskin. */
export const SKIMMER_TYPES: ReadonlyArray<{
  id: SkimmerTypeId;
  title: string;
  description: string;
}> = [
  {
    id: "standard",
    title: "Standard raffinato",
    description: "Cornice stampata con profilo rialzato ben visibile e proporzioni classiche.",
  },
  {
    id: "slim",
    title: "Slim / Moderno",
    description: "Cornice sottile a basso profilo, bordo minimo, apertura più ampia.",
  },
  {
    id: "highWaterline",
    title: "Livello acqua alto",
    description: "Corpo basso posizionato in alto contro il bordo, per un livello quasi a filo.",
  },
  {
    id: "flush",
    title: "Filo parete architettonico",
    description:
      "Piastra senza cornice, quasi a filo, con una sottile fessura d'ombra nella parete.",
  },
];

export const LINER_COLORS: ReadonlyArray<{
  id: LinerColor;
  title: string;
  hex: string;
  texture: string;
  underwater: {
    absorption: readonly [number, number, number];
    scatteringColor: readonly [number, number, number];
    scatteringStrength: number;
    causticStrength: number;
    /** Multiplies opticalPath before the scattering-depth smoothstep only. Default 1.0 = unchanged behaviour. */
    scatteringOpticalPathScale: number;
    /** Multiplies opticalPath before the absorption/transmission exponent only. Default 1.0 = unchanged behaviour. */
    absorptionOpticalPathScale: number;
    /** Per-liner override for the scattering-energy clamp. Default = WATER_VISUAL_PRESET.maxScatteringEnergy (0.06), unchanged behaviour. */
    maxScatteringEnergy: number;
    /** Per-liner override for the scattering-energy multiplier. Default = WATER_VISUAL_PRESET.scatteringContribution (0.16), unchanged behaviour. */
    scatteringContribution: number;
  };
}> = [
  {
    id: "motionDeepSea603",
    title: "Motion Deep Sea [603]",
    hex: "#073f9d",
    texture: "/textures/pvc-liner/motion-deep-sea-603.png",
    underwater: {
      absorption: [0.7, 0.1, 0.03],
      scatteringColor: [0.02, 0.75, 0.95],
      scatteringStrength: 0.68,
      causticStrength: 0.08,
      scatteringOpticalPathScale: 1.9,
      absorptionOpticalPathScale: 1.3,
      maxScatteringEnergy: 0.09,
      scatteringContribution: 0.32,
    },
  },
  {
    id: "motionBlueSky602",
    title: "Motion Blue Sky [602]",
    hex: "#63b8ea",
    texture: "/textures/pvc-liner/motion-blue-sky-602.png",
    underwater: {
      absorption: [0.3, 0.065, 0.022],
      scatteringColor: [0.2, 0.72, 0.86],
      scatteringStrength: 0.42,
      causticStrength: 0.025,
      scatteringOpticalPathScale: 1.0,
      absorptionOpticalPathScale: 1.0,
      maxScatteringEnergy: 0.06,
      scatteringContribution: 0.16,
    },
  },
  {
    id: "motionArcticWhite180",
    title: "Motion Arctic White [180]",
    hex: "#f4f3ef",
    texture: "/textures/pvc-liner/motion-arctic-white-180.png",
    underwater: {
      // Reference photo: a near-white dry liner reads as a saturated
      // cyan/turquoise once submerged (the most dramatic shift of the
      // range, since there is no base tint to begin with). The previous
      // values left it almost unchanged underwater (pale off-white) --
      // raised absorption + scattering push it to a visible turquoise.
      absorption: [0.85, 0.12, 0.04],
      scatteringColor: [0.05, 0.75, 0.72],
      scatteringStrength: 0.65,
      causticStrength: 0.028,
      scatteringOpticalPathScale: 1.8,
      absorptionOpticalPathScale: 1.6,
      maxScatteringEnergy: 0.09,
      scatteringContribution: 0.28,
    },
  },
  {
    id: "motionSandBeach179",
    title: "Motion Sand Beach [179]",
    hex: "#ddbd74",
    texture: "/textures/pvc-liner/motion-sand-beach-179.png",
    underwater: {
      absorption: [0.45, 0.14, 0.035],
      scatteringColor: [0.06, 0.62, 0.42],
      scatteringStrength: 0.6,
      causticStrength: 0.04,
      scatteringOpticalPathScale: 2.4,
      absorptionOpticalPathScale: 2.0,
      maxScatteringEnergy: 0.06,
      scatteringContribution: 0.16,
    },
  },
  {
    id: "motionGreyRock798",
    title: "Motion Grey Rock [798]",
    hex: "#8a8c96",
    texture: "/textures/pvc-liner/motion-grey-rock-798.png",
    underwater: {
      absorption: [0.35, 0.13, 0.05],
      scatteringColor: [0.14, 0.44, 0.6],
      scatteringStrength: 0.34,
      causticStrength: 0.022,
      scatteringOpticalPathScale: 1.0,
      absorptionOpticalPathScale: 1.0,
      maxScatteringEnergy: 0.06,
      scatteringContribution: 0.16,
    },
  },
  {
    id: "motionBlackStone799",
    title: "Motion Black Stone [799]",
    hex: "#17151a",
    texture: "/textures/pvc-liner/motion-black-stone-799.png",
    underwater: {
      absorption: [0.52, 0.28, 0.13],
      scatteringColor: [0.04, 0.13, 0.26],
      scatteringStrength: 0.14,
      causticStrength: 0.032,
      scatteringOpticalPathScale: 1.0,
      absorptionOpticalPathScale: 1.0,
      maxScatteringEnergy: 0.06,
      scatteringContribution: 0.16,
    },
  },
];

export const POOL_FEATURES: ReadonlyArray<{
  id: PoolFeatureId;
  title: string;
  description: string;
}> = [
  { id: "ledLighting", title: "Illuminazione LED", description: "Illuminazione subacquea." },
  {
    id: "hydromassage",
    title: "Idromassaggio",
    description: "Ugelli idromassaggio integrati.",
  },
];

export const EQUIPMENT: ReadonlyArray<{
  id: EquipmentId;
  title: string;
  description: string;
}> = [
  {
    id: "automaticCover",
    title: "Copertura automatica",
    description: "Copertura di sicurezza e termica.",
  },
  { id: "heatPump", title: "Pompa di calore", description: "Riscaldamento efficiente dell'acqua." },
  {
    id: "saltElectrolysis",
    title: "Elettrolisi al sale",
    description: "Trattamento automatico dell'acqua salata.",
  },
  {
    id: "automaticDosing",
    title: "Dosaggio automatico cloro / pH",
    description: "Controllo automatico del trattamento dell'acqua.",
  },
];

/** Customer-facing subgroups for the Technology step -- purely a display
 * grouping over `EQUIPMENT`, every id must exist there. */
export const EQUIPMENT_GROUPS: ReadonlyArray<{
  id: string;
  title: string;
  equipmentIds: ReadonlyArray<EquipmentId>;
}> = [
  {
    id: "water-treatment",
    title: "Trattamento acqua",
    equipmentIds: ["saltElectrolysis", "automaticDosing"],
  },
  { id: "temperature", title: "Temperatura", equipmentIds: ["heatPump"] },
  { id: "protection", title: "Protezione", equipmentIds: ["automaticCover"] },
];

export const STEPS: ReadonlyArray<StepDefinition> = [
  {
    id: "project",
    index: 0,
    title: "Tipo di progetto",
    subtitle: "Indicaci la natura dell'intervento.",
    short: "Progetto",
  },
  {
    id: "pool-type",
    index: 1,
    title: "Tipo di piscina",
    subtitle: "Scegli la tipologia di installazione della tua nuova piscina.",
    short: "Tipologia",
  },
  {
    id: "structure",
    index: 2,
    title: "Struttura della piscina",
    subtitle: "Scegli il sistema costruttivo della tua piscina.",
    short: "Struttura",
  },
  {
    id: "shape-dimensions",
    index: 3,
    title: "Forma e dimensioni",
    subtitle: "Scegli la sagoma e dimensiona la vasca in tempo reale.",
    short: "Forma",
  },
  {
    id: "system",
    index: 4,
    title: "Sistema idraulico",
    subtitle: "Principio idraulico e gestione della linea d'acqua.",
    short: "Acqua",
  },
  {
    id: "style",
    index: 5,
    title: "Materiali e stile",
    subtitle: "Il materiale che definisce carattere e colore dell'acqua, e il bordo vasca.",
    short: "Stile",
  },
  {
    id: "access",
    index: 6,
    title: "Accesso e comfort",
    subtitle: "Scale, scaletta e comfort in acqua.",
    short: "Comfort",
  },
  {
    id: "lighting",
    index: 7,
    title: "Illuminazione",
    subtitle: "Illuminazione subacquea a LED: colore e intensità.",
    short: "Luce",
  },
  {
    id: "technology",
    index: 8,
    title: "Tecnologia",
    subtitle: "Seleziona la tecnologia da includere nel preventivo.",
    short: "Tecnologia",
  },
  {
    id: "review",
    index: 9,
    title: "Revisione finale",
    subtitle: "Rivedi la configurazione della piscina prima di richiedere un preventivo.",
    short: "Riepilogo",
  },
];

/** The customer-facing "Nuova piscina" rail: seven groups over the ten
 * internal `STEPS`. Purely a display grouping -- `PoolConfigurator` still
 * navigates step-by-step through every id in `stepIds`; `StepIndicator`
 * collapses them into one dot per group so the rail stays uncrowded.
 * Renovation is untouched and never uses this. */
export interface StepGroup {
  id: string;
  label: string;
  stepIds: ReadonlyArray<string>;
}

export const STEP_GROUPS: ReadonlyArray<StepGroup> = [
  {
    id: "vasca",
    label: "Vasca",
    stepIds: ["project", "pool-type", "structure", "shape-dimensions"],
  },
  { id: "acqua", label: "Acqua", stepIds: ["system"] },
  { id: "stile", label: "Stile", stepIds: ["style"] },
  { id: "comfort", label: "Comfort", stepIds: ["access"] },
  { id: "luce", label: "Luce", stepIds: ["lighting"] },
  { id: "tecnologia", label: "Tecnologia", stepIds: ["technology"] },
  { id: "progetto", label: "Progetto", stepIds: ["review"] },
];

export const RENOVATION_STEPS: ReadonlyArray<StepDefinition> = [
  STEPS[0]!,
  {
    id: "renovation-scope",
    index: 1,
    title: "Renovation Scope",
    subtitle: "Select the work your pool needs.",
    short: "Scope",
  },
  {
    id: "renovation-pool",
    index: 2,
    title: "Current Pool",
    subtitle: "Only the essential existing dimensions.",
    short: "Pool",
  },
  {
    id: "renovation-details",
    index: 3,
    title: "Renovation Details",
    subtitle: "Questions tailored to your selected work.",
    short: "Details",
  },
  {
    id: "renovation-customer",
    index: 4,
    title: "Customer Information",
    subtitle: "Contact details for your consultation.",
    short: "Customer",
  },
  {
    id: "renovation-review",
    index: 5,
    title: "Review",
    subtitle: "Review the proposed renovation work.",
    short: "Review",
  },
];

/** Deck / coping ring width in metres. */
export const COPING_WIDTH = 0.2;
export const OVERFLOW_GEOMETRY = {
  waterEdgeOffset: 0.055,
  hiddenChannelOffset: 0.105,
  /**
   * Outer edge of the VISIBLE overflow perimeter. Built, not styled: it is the
   * kerb plus the grille, and the audit enforces that identity rather than
   * letting the three numbers drift apart.
   */
  visibleChannelOuterOffset: 0.355,
  /**
   * The constructed kerb (muretto) between the basin and the grille. 110 mm is
   * a real finished kerb -- a block or cast upstand with its cladding -- not
   * the 62 mm decorative strip this started as, which read as a trim bead
   * rather than as structure.
   */
  visibleKerbWidth: 0.11,
  /**
   * How far the kerb's top stands above the pool wall top. 75 mm leaves ~68 mm
   * of kerb face above the waterline: enough to read as a built containment
   * edge at every camera distance, and in the range a real coping course
   * stands proud of the water.
   */
  visibleKerbRise: 0.075,
  /**
   * Overflow grille width. 245 mm is a stock section (the common residential
   * size between 195 and 295), so the grille is proportioned like a product
   * that exists rather than to whatever was left over from the channel band.
   */
  visibleGrateWidth: 0.245,
  visibleWaterFilmWidth: 0.02,
  hiddenWaterChannelClearance: 0.015,
  visibleGrateTopOffset: 0.006,
  visibleWaterAboveLip: 0.001,
  hiddenWaterTopClearance: 0.0005,
  surfaceMovementAmplitude: 0.00025,
  /** Channel below the grille -- a real perimeter gutter, not a slot. */
  channelDepth: 0.22,
  grateSlatPitch: 0.075,
} as const;
/** Distance from the coping top down to the waterline, in metres.
 * Sized so the skimmer-pool waterline sits ~mid-mouth on the skimmer opening. */
export const FREEBOARD = 0.143;
/** Number of sampled points used for curved outlines. */
export const CURVE_SAMPLES = 256;
/** Water surface served by a single skimmer (industry standard). */
export const SQM_PER_SKIMMER = 25;
