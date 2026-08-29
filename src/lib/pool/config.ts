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
  StepDefinition,
} from "./types";

export const DIMENSION_LIMITS = {
  length: { min: 3, max: 25, step: 0.1, unit: "m" },
  width: { min: 2, max: 12, step: 0.1, unit: "m" },
  depth: { min: 0.8, max: 1.5, step: 0.05, unit: "m" },
  cornerRadius: { min: 0, max: 1, step: 0.01, unit: "" },
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
    title: "New Pool",
    description: "A complete build, from excavation and structure to finishing and technology.",
  },
  {
    id: "renovation" as const,
    title: "Pool Renovation",
    description: "Reshape, reline and modernise an existing basin with contemporary systems.",
  },
];

export const POOL_TYPES: ReadonlyArray<{
  id: PoolType;
  title: string;
  description: string;
}> = [
  {
    id: "in-ground",
    title: "In-Ground Pool",
    description: "A pool installed completely below ground level.",
  },
  {
    id: "above-ground",
    title: "Above-Ground Pool",
    description: "A pool installed above the surrounding ground level.",
  },
];

export const POOL_STRUCTURES: ReadonlyArray<{
  id: PoolStructure;
  poolTypes: ReadonlyArray<PoolType>;
  title: string;
}> = [
  { id: "reinforced-concrete", poolTypes: ["in-ground"], title: "Reinforced Concrete" },
  { id: "modular-steel-panels", poolTypes: ["in-ground"], title: "Modular Steel Panels" },
  {
    id: "modular-steel-structure",
    poolTypes: ["above-ground"],
    title: "Modular Steel Structure",
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
    title: "Rectangle",
    description: "Architectural lap geometry with pure straight edges.",
    supportsCornerRadius: false,
  },
  {
    id: "custom",
    title: "Custom Shape",
    description: "Draw the outline with editable control points, or upload a plan.",
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
    title: "PVC Liner",
    description: "Reinforced 150/100 membrane, welded on site. Six architectural finishes.",
    color: "#dfe9ec",
    roughness: 0.32,
    metalness: 0.02,
  },
  {
    id: "mosaic",
    title: "Mosaic",
    description: "Vitreous glass tesserae with iridescent depth and fine grout lines.",
    color: "#8fc4d2",
    roughness: 0.12,
    metalness: 0.06,
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
      absorption: [0.34, 0.055, 0.02],
      scatteringColor: [0.2, 0.68, 0.82],
      scatteringStrength: 0.38,
      causticStrength: 0.028,
      scatteringOpticalPathScale: 1.0,
      absorptionOpticalPathScale: 1.0,
      maxScatteringEnergy: 0.06,
      scatteringContribution: 0.16,
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
  { id: "ledLighting", title: "LED Pool Lights", description: "Underwater lighting." },
  {
    id: "hydromassage",
    title: "Hydromassage Jets",
    description: "Integrated hydromassage jets.",
  },
];

export const EQUIPMENT: ReadonlyArray<{
  id: EquipmentId;
  title: string;
  description: string;
}> = [
  { id: "automaticCover", title: "Automatic Cover", description: "Safety and thermal cover." },
  { id: "heatPump", title: "Heat Pump", description: "Efficient pool water heating." },
  {
    id: "saltElectrolysis",
    title: "Salt Electrolysis",
    description: "Automated salt-water treatment.",
  },
  {
    id: "automaticDosing",
    title: "Automatic Chlorine / pH Dosing",
    description: "Automatic water treatment control.",
  },
];

export const STEPS: ReadonlyArray<StepDefinition> = [
  {
    id: "project",
    index: 0,
    title: "Project Type",
    subtitle: "Tell us the nature of the intervention.",
    short: "Project",
  },
  {
    id: "pool-type",
    index: 1,
    title: "Pool Type",
    subtitle: "Choose the installation type for your new pool.",
    short: "Type",
  },
  {
    id: "structure",
    index: 2,
    title: "Pool Structure",
    subtitle: "Choose the construction system for your pool.",
    short: "Structure",
  },
  {
    id: "shape-dimensions",
    index: 3,
    title: "Shape & Dimensions",
    subtitle: "Choose the silhouette and size the basin in real time.",
    short: "Shape",
  },
  {
    id: "system",
    index: 4,
    title: "Pool System",
    subtitle: "Hydraulic principle and water line management.",
    short: "System",
  },
  {
    id: "finish",
    index: 5,
    title: "Interior Finish",
    subtitle: "The material that defines the colour of the water.",
    short: "Finish",
  },
  {
    id: "features",
    index: 6,
    title: "Pool Features",
    subtitle: "Select the essential features built into the pool.",
    short: "Features",
  },
  {
    id: "equipment",
    index: 7,
    title: "Equipment",
    subtitle: "Select equipment to include in the quotation.",
    short: "Equipment",
  },
  {
    id: "contact",
    index: 8,
    title: "Customer Details",
    subtitle: "Contact and project location information.",
    short: "Customer",
  },
  {
    id: "review",
    index: 9,
    title: "Final Review",
    subtitle: "Review the pool configuration before requesting a quote.",
    short: "Review",
  },
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
  visibleChannelOuterOffset: 0.165,
  visibleWaterFilmWidth: 0.02,
  hiddenWaterChannelClearance: 0.015,
  visibleGrateTopOffset: 0.006,
  visibleWaterAboveLip: 0.001,
  hiddenWaterTopClearance: 0.0005,
  surfaceMovementAmplitude: 0.00025,
  channelDepth: 0.19,
  grateSlatPitch: 0.075,
} as const;
/** Distance from the coping top down to the waterline, in metres.
 * Sized so the skimmer-pool waterline sits ~mid-mouth on the skimmer opening. */
export const FREEBOARD = 0.143;
/** Number of sampled points used for curved outlines. */
export const CURVE_SAMPLES = 256;
/** Water surface served by a single skimmer (industry standard). */
export const SQM_PER_SKIMMER = 25;
