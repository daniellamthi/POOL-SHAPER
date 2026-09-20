export type ProjectType = "new" | "renovation";

export type PoolType = "in-ground" | "above-ground";

export type PoolStructure =
  "reinforced-concrete" | "modular-steel-panels" | "modular-steel-structure";

export type PoolShapeId = "rectangle" | "custom";
/** Prepared, not yet buildable: no `PoolShapeId` value below is selectable in
 * production UI. Reserved for geometry passes B (L-shape) and C (organic
 * preset) -- kept as an unused alias so downstream code can start typing
 * against the eventual union without any behaviour changing today. */
export type FuturePoolShapeId = PoolShapeId | "l-shape" | "organic";

export type CustomMode = "draw" | "upload";

export type SystemType = "skimmer" | "overflow";
export type OverflowType = "hidden" | "visible";
/** Prepared, not yet buildable: "infinity" is not a member of `OverflowType`
 * and never reaches `config.overflowType` -- the real single-edge Infinity
 * geometry is geometry pass D. Reserved so the "Linea d'acqua" step's future
 * Infinity choice can be typed ahead of the actual construction work. */
export type FutureOverflowType = OverflowType | "infinity";

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
/** Which internal staircase is built: a straight flight down an end wall, or
 *  a radial flight wrapped around a corner. */
export type InternalStairType = "linear" | "corner";

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

/** Floor construction. "flat" is the only value any renderer or geometry
 * builder currently reads; "slope" is prepared for geometry pass A and is
 * not offered anywhere in production UI yet. */
export type FloorProfile = "flat" | "slope";

export interface Dimensions {
  /** metres */
  length: number;
  /** metres */
  width: number;
  /** metres */
  depth: number;
  /** 0..1 relative corner rounding for the custom profile */
  cornerRadius: number;
  /** Prepared for geometry pass A (sloped floor). Absent/"flat" everywhere
   * today -- every renderer treats the floor as flat regardless of this
   * field until that pass wires it in. */
  floorProfile?: FloorProfile;
  /** Prepared for geometry pass A. Only meaningful once `floorProfile` is
   * "slope"; metres, shallow-end depth (the existing `depth` becomes the
   * deep end). Unused today. */
  shallowDepth?: number;
}

/** A closed 2D outline in the XZ plane, metres, centred on the origin. */
export type Outline = ReadonlyArray<readonly [number, number]>;

/** Editable control point in normalised [-0.5, 0.5] unit space. */
export type ControlPoint = readonly [number, number];

/** P6B: whether a real (server-validated, durably stored) upload attempt
 * has completed for this file. `url` is only ever a transient local
 * preview (`blob:`) -- it never survives a reload and is never a durable
 * reference; `storagePath` is the durable one, set only after a
 * successful upload. Optional so existing literals (tests, older saved
 * drafts) that predate P6B still satisfy the type -- runtime code always
 * populates them (see store.tsx's addUploads). */
export interface UploadedFile {
  id: string;
  name: string;
  size: number;
  type: string;
  /** object URL, image previews only */
  url: string | null;
  category: "reference" | "site";
  uploadStatus?: "pending" | "uploading" | "uploaded" | "failed";
  storagePath?: string | null;
  uploadError?: string;
}

export interface PoolConfig {
  projectType: ProjectType | null;
  poolType: PoolType | null;
  structure: PoolStructure | null;
  shape: PoolShapeId;
  shapeSelected?: boolean;
  copingMaterial?: import("./coping-materials").CopingMaterialId;
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
  ledColor?: string;
  /** Dimmer for the underwater LEDs, 0..1. Absent on projects saved before
   * the control existed; readers substitute LED_OPTICS.defaultIntensity. */
  ledIntensity?: number;
  poolAccess: PoolAccess | null;
  /** Only meaningful while `poolAccess` is "internalSteps". Absent on projects
   *  saved before the corner staircase existed; readers substitute "linear". */
  internalStairType?: InternalStairType;
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
