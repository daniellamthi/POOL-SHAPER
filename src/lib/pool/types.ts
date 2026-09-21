export type ProjectType = "new" | "renovation";

export type PoolType = "in-ground" | "above-ground";

export type PoolStructure =
  "reinforced-concrete" | "modular-steel-panels" | "modular-steel-structure";

export type PoolShapeId = "rectangle" | "l-shape" | "custom" | "organic";
/** Historical alias kept so any code still importing it keeps compiling --
 * "organic" is now a real, buildable member of `PoolShapeId` (geometry pass
 * C), so this is simply equal to it. */
export type FuturePoolShapeId = PoolShapeId;

export type CustomMode = "draw" | "upload";

/** Geometry Pass D (Infinity, Rectangle-only first slice): "infinity" is now
 * a real, buildable member of `SystemType`, alongside skimmer and the
 * existing perimeter-overflow family. When `system === "infinity"`,
 * `overflowType` is not read by any renderer -- the actual Infinity edge/
 * side selection lives in `config.infinityEdge` (see
 * `src/lib/pool/infinity-edge.ts`, the single source of truth for it).
 * Mutually exclusive with skimmer/overflow waterline treatment by
 * construction: nothing reads `overflowType` or renders a skimmer wall
 * while `system === "infinity"`. */
export type SystemType = "skimmer" | "overflow" | "infinity";
export type OverflowType = "hidden" | "visible";
/** Historical alias kept so any code still importing it keeps compiling. */
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

/** Floor construction. Selectable (rectangle, in-ground pools only -- see
 * `src/lib/pool/floor-profile.ts`) since geometry pass A. */
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
  /** "slope" is only ever built for a rectangle, in-ground pool -- see
   * `buildFloorProfile` in floor-profile.ts, which normalises anything else
   * back to flat regardless of this field. */
  floorProfile?: FloorProfile;
  /** Only meaningful once `floorProfile` is "slope"; metres, shallow-end
   * depth (the existing `depth` is the deep end). Always clamped by
   * `clampShallowDepth` (floor-profile.ts) before it reaches geometry. */
  shallowDepth?: number;
  /** Which end of the slope axis is shallow. false (default/absent): the
   * outline's minimum-X wall. true: swapped via "Inverti pendenza" without
   * changing the two depth values themselves. */
  slopeReversed?: boolean;
  /** L-shape only (`shape === "l-shape"`): `length`/`width` above are read as
   * the OUTER bounding rectangle for the L, and these three fields describe
   * the corner rectangle removed from it. Absent for every other shape --
   * see `src/lib/pool/l-shape.ts`, the single canonical source for turning
   * these into the actual outline and never duplicated elsewhere. Always
   * normalised through `clampLShapeDimensions` before reaching geometry, so
   * a malformed/legacy/missing value here can never produce a degenerate L. */
  lShapeRecessLength?: number;
  lShapeRecessWidth?: number;
  lShapeOrientation?: import("./l-shape").LShapeOrientation;
  /** Organic shape only (`shape === "organic"`): `length`/`width` above are
   * read as the overall bounding span of the organic silhouette. This is the
   * single 0..1 "character" control -- how pronounced the kidney-style bay
   * is, 0 = plain ellipse. Absent for every other shape -- see
   * `src/lib/pool/organic-shape.ts`, the single canonical source for turning
   * these into the actual outline. Always normalised through
   * `clampOrganicShapeParams` before reaching geometry. */
  organicCurvature?: number;
  /** Organic shape only: which side the bay sits on. */
  organicMirror?: boolean;
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
  /** Only meaningful while `system === "infinity"` (Rectangle only, this
   * pass). Always normalised through `clampInfinityEdgeParams`
   * (infinity-edge.ts) before reaching geometry, the same contract every
   * other shape/system-specific field in this interface follows. Absent on
   * projects saved before Infinity existed; readers substitute
   * `defaultInfinityEdgeParams()`. */
  infinityEdge?: import("./infinity-edge").InfinityEdgeParams;
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
