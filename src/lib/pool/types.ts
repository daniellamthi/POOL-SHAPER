export type ProjectType = "new" | "renovation";

export type PoolShapeId = "rectangle" | "custom";

export type CustomMode = "draw" | "upload";

export type SystemType = "skimmer" | "overflow";

export type FinishMaterial = "liner" | "mosaic";
export type LinerColor = "white" | "sand" | "lightGrey" | "darkGrey" | "blue" | "green";

export type AccessoryId =
  | "automaticCover"
  | "heatPump"
  | "saltElectrolysis"
  | "automaticDosing"
  | "ledLighting"
  | "perimeterLed"
  | "waterfall"
  | "hydromassage"
  | "counterCurrent"
  | "poolRobot"
  | "smartControl"
  | "solarShower";

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
  shape: PoolShapeId;
  customMode: CustomMode;
  controlPoints: ReadonlyArray<ControlPoint>;
  dimensions: Dimensions;
  system: SystemType;
  finish: FinishMaterial;
  linerColor: LinerColor;
  accessories: ReadonlyArray<AccessoryId>;
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
