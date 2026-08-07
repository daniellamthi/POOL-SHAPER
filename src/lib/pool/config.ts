import type {
  AccessoryId,
  ControlPoint,
  CustomerInfo,
  Dimensions,
  FinishMaterial,
  LinerColor,
  PoolShapeId,
  StepDefinition,
} from "./types";

export const DIMENSION_LIMITS = {
  length: { min: 3, max: 25, step: 0.1, unit: "m" },
  width: { min: 2, max: 12, step: 0.1, unit: "m" },
  depth: { min: 0.8, max: 3.5, step: 0.05, unit: "m" },
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
    description: "Reinforced 150/100 membrane, welded on site. Six architectural colours.",
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

export const LINER_COLORS: ReadonlyArray<{ id: LinerColor; title: string; hex: string }> = [
  { id: "white", title: "White", hex: "#eef2f2" },
  { id: "sand", title: "Sand", hex: "#e3d6bd" },
  { id: "lightGrey", title: "Light Grey", hex: "#c8cccd" },
  { id: "darkGrey", title: "Dark Grey", hex: "#6f7476" },
  { id: "blue", title: "Blue", hex: "#7fa9c9" },
  { id: "green", title: "Green", hex: "#8aa893" },
];

export const ACCESSORIES: ReadonlyArray<{
  id: AccessoryId;
  title: string;
  description: string;
}> = [
  {
    id: "automaticCover",
    title: "Automatic Cover",
    description: "Automatic safety and thermal protection system.",
  },
  {
    id: "heatPump",
    title: "Heat Pump",
    description: "Efficient water heating for a longer swimming season.",
  },
  {
    id: "saltElectrolysis",
    title: "Salt Electrolysis",
    description: "Comfortable, automated salt-water treatment.",
  },
  {
    id: "automaticDosing",
    title: "Automatic Chlorine / pH Dosing",
    description: "Automatic control of essential water treatment.",
  },
  { id: "ledLighting", title: "LED Lighting", description: "Underwater lighting for evening use." },
  {
    id: "perimeterLed",
    title: "Perimeter LED",
    description: "Subtle lighting around the pool perimeter.",
  },
  { id: "waterfall", title: "Waterfall", description: "Architectural water feature." },
  {
    id: "hydromassage",
    title: "Hydromassage",
    description: "Integrated therapeutic water and air jets.",
  },
  {
    id: "counterCurrent",
    title: "Counter-current Swimming",
    description: "A compact system for continuous swimming.",
  },
  {
    id: "poolRobot",
    title: "Pool Robot",
    description: "Automatic cleaning for the pool floor and walls.",
  },
  {
    id: "smartControl",
    title: "Smart Pool Control / Automation",
    description: "Simple remote management of pool functions.",
  },
  {
    id: "solarShower",
    title: "Solar Shower",
    description: "An efficient outdoor shower for the pool area.",
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
    id: "shape",
    index: 1,
    title: "Pool Shape",
    subtitle: "The silhouette regenerates the 3D geometry instantly.",
    short: "Shape",
  },
  {
    id: "dimensions",
    index: 2,
    title: "Pool Dimensions",
    subtitle: "Size the basin — every value resizes the model live.",
    short: "Size",
  },
  {
    id: "system",
    index: 3,
    title: "Pool System",
    subtitle: "Hydraulic principle and water line management.",
    short: "System",
  },
  {
    id: "finish",
    index: 4,
    title: "Interior Finish",
    subtitle: "The material that defines the colour of the water.",
    short: "Finish",
  },
  {
    id: "color",
    index: 5,
    title: "Interior Color",
    subtitle: "Select the tone applied to the chosen finish.",
    short: "Color",
  },
  {
    id: "accessories",
    index: 6,
    title: "Optional Accessories",
    subtitle: "Quote-only equipment; it does not alter the 3D model.",
    short: "Extras",
  },
  {
    id: "contact",
    index: 7,
    title: "Customer Details",
    subtitle: "Contact and project location information.",
    short: "Customer",
  },
  {
    id: "review",
    index: 8,
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
export const COPING_WIDTH = 0.38;
/** Distance from the coping top down to the waterline, in metres. */
export const FREEBOARD = 0.12;
/** Number of sampled points used for curved outlines. */
export const CURVE_SAMPLES = 128;
/** Water surface served by a single skimmer (industry standard). */
export const SQM_PER_SKIMMER = 25;
