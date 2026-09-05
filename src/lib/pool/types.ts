export type ProjectType = "new" | "renovation";

export type PoolType = "in-ground" | "above-ground";

export type PoolStructure =
  "reinforced-concrete" | "modular-steel-panels" | "modular-steel-structure";

export type PoolShapeId = "rectangle" | "custom";

export type CustomMode = "draw" | "upload";

export type SystemType = "skimmer" | "overflow";
export type OverflowType = "hidden" | "visible";

export type FinishMaterial = "liner" | "mosaic";
export type LinerColor =
  | "motionDeepSea603"
  | "motionBlueSky602"
  | "motionArcticWhite180"
  | "motionSandBeach179"
  | "motionGreyRock798"
  | "motionBlackStone799";
export type MosaicFinishId = `mosaic-${string}`;

/** Skimmer face-frame finish. Kept separate from the interior liner/mosaic
 * finish list -- extensible for more finishes later without touching those. */
export type SkimmerFinishId = "white" | "graphite" | "sand" | "steel";

/** Skimmer housing family -- real geometry differences (throat/frame
 * proportions, recess depth, waterline relationship), not a colour swap.
 * See `SKIMMER_TYPES` (src/lib/pool/config.ts) and `Skimmers.tsx`. */
export type SkimmerTypeId = "standard" | "slim" | "highWaterline" | "flush";

export type PoolFeatureId = "ledLighting" | "hydromassage" | "externalStaircase";

export type PoolAccess = "internalSteps" | "stainlessSteelLadder";

export type EquipmentId = "automaticCover" | "heatPump" | "saltElectrolysis" | "automaticDosing";

export interface CustomerInfo {
  name: string;
  surname: string;
  company: string;
  email: string;
  phone: string;
  city: string;
  country: string;
  notes: string;
}

export type RenovationArea =
  "interiorFinish" | "filtration" | "coping" | "structure" | "equipment" | "complete";

export type FiltrationWork = "pump" | "filter" | "skimmers" | "overflow";
export type StructureIssue = "leakage" | "crack" | "waterproofing" | "generalRepair";
export type EquipmentUpgrade = "salt" | "dosing" | "heatPump" | "automation";

export interface RenovationConfig {
  areas: ReadonlyArray<RenovationArea>;
  currentFinish: FinishMaterial;
  filtrationWorks: ReadonlyArray<FiltrationWork>;
  replaceCoping: boolean | null;
  copingMaterial: string;
  structureIssues: ReadonlyArray<StructureIssue>;
  equipmentUpgrades: ReadonlyArray<EquipmentUpgrade>;
}

export interface Dimensions {
  /** metres */
  length: number;
  /** metres */
  width: number;
  /** metres */
  depth: number;
  /** 0..1 relative corner rounding for the custom profile */
  cornerRadius: number;
}

/** A closed 2D outline in the XZ plane, metres, centred on the origin. */
export type Outline = ReadonlyArray<readonly [number, number]>;

/** Editable control point in normalised [-0.5, 0.5] unit space. */
export type ControlPoint = readonly [number, number];

export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  /** object URL, image previews only */
  url: string | null;
  category: "reference" | "site";
}

export interface PoolConfig {
  projectType: ProjectType | null;
  poolType: PoolType | null;
  structure: PoolStructure | null;
  shape: PoolShapeId;
  customMode: CustomMode;
  controlPoints: ReadonlyArray<ControlPoint>;
  dimensions: Dimensions;
  system: SystemType;
  overflowType: OverflowType;
  skimmerFinish: SkimmerFinishId;
  skimmerType: SkimmerTypeId;
  finish: FinishMaterial;
  linerColor: LinerColor;
  mosaicFinish: MosaicFinishId;
  features: ReadonlyArray<PoolFeatureId>;
  poolAccess: PoolAccess | null;
  equipment: ReadonlyArray<EquipmentId>;
  customer: CustomerInfo;
  uploads: ReadonlyArray<UploadedFile>;
}

export interface PoolMetrics {
  waterVolume: number;
  waterSurface: number;
  floorSurface: number;
  wallSurface: number;
  internalSurface: number;
  perimeter: number;
}

export interface StepDefinition {
  id: string;
  index: number;
  title: string;
  subtitle: string;
  short: string;
}
