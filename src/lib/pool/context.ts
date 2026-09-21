import { createContext, useContext } from "react";
import type { DimensionKey } from "./config";
import type { SkimmerPlan } from "./engineering";
import type {
  ControlPoint,
  CustomMode,
  CustomerInfo,
  EquipmentId,
  FinishMaterial,
  FloorProfile,
  InternalStairType,
  PoolType,
  LinerColor,
  MosaicFinishId,
  Outline,
  OverflowType,
  PoolConfig,
  PoolAccess,
  PoolFeatureId,
  PoolMetrics,
  PoolShapeId,
  PoolStructure,
  ProjectType,
  SkimmerFinishId,
  SkimmerTypeId,
  SystemType,
  UploadedFile,
  RenovationConfig,
} from "./types";
import type { ProjectConfiguration } from "./project";
import type { LShapeOrientation } from "./l-shape";
import type { OrganicShapeParams } from "./organic-shape";

export interface ConfiguratorContextValue {
  config: PoolConfig;
  step: number;
  outline: Outline;
  metrics: PoolMetrics;
  skimmers: SkimmerPlan;
  renovation: RenovationConfig;
  /** Stable identity for the project being configured. */
  projectId: string;
  /** The single canonical, serializable representation of everything the
   * customer has selected so far -- the source of truth for the summary,
   * autosave, exports and any future CRM/lead handoff. */
  projectConfiguration: ProjectConfiguration;
  isStepComplete: (index: number) => boolean;
  canContinue: boolean;
  setProjectType: (value: ProjectType) => void;
  setPoolType: (value: PoolType) => void;
  setPoolStructure: (value: PoolStructure) => void;
  setCustomerField: (key: keyof CustomerInfo, value: string) => void;
  setShape: (value: PoolShapeId) => void;
  setCopingMaterial: (value: NonNullable<PoolConfig["copingMaterial"]>) => void;
  setCustomMode: (value: CustomMode) => void;
  setControlPoint: (index: number, value: ControlPoint) => void;
  resetControlPoints: () => void;
  setDimension: (key: DimensionKey, value: number) => void;
  setFloorProfile: (value: FloorProfile) => void;
  /** Swaps which end of the slope axis is shallow without changing the two
   * selected depths. */
  toggleSlopeReversed: () => void;
  setLShapeOrientation: (value: LShapeOrientation) => void;
  /** Curvature is a plain dimension (`organicCurvature`, via `setDimension`).
   * Mirror is a boolean flag, mirroring `setLShapeOrientation`'s own pattern. */
  setOrganicMirror: (value: boolean) => void;
  setSystem: (value: SystemType) => void;
  setOverflowType: (value: OverflowType) => void;
  setSkimmerFinish: (value: SkimmerFinishId) => void;
  setSkimmerType: (value: SkimmerTypeId) => void;
  setFinish: (value: FinishMaterial) => void;
  setLinerColor: (value: LinerColor) => void;
  setMosaicFinish: (value: MosaicFinishId) => void;
  togglePoolFeature: (value: PoolFeatureId) => void;
  setLedColor: (value: string) => void;
  setLedIntensity: (value: number) => void;
  setInternalStairType: (value: InternalStairType) => void;
  setPoolAccess: (value: PoolAccess) => void;
  toggleEquipment: (value: EquipmentId) => void;
  updateRenovation: (value: Partial<RenovationConfig>) => void;
  addUploads: (files: UploadedFile[]) => void;
  removeUpload: (id: string) => void;
  /** P6B: records the outcome of a real upload attempt for a previously
   * added file -- never called with a fake "uploaded" result. */
  setUploadStatus: (
    id: string,
    status: NonNullable<UploadedFile["uploadStatus"]>,
    storagePath?: string | null,
    uploadError?: string,
  ) => void;
  goToStep: (index: number) => void;
  next: () => void;
  previous: () => void;
  /** Starts a fresh project: new `projectId`, blank config, and clears any
   * locally saved draft (P4 autosave). */
  reset: () => void;
  /** True for the rest of this session once a saved draft has been
   * restored on load, until dismissed. Drives the "Abbiamo ripristinato il
   * tuo progetto" notice. */
  justRestoredProject: boolean;
  dismissRestoredProjectNotice: () => void;
}

export const ConfiguratorContext = createContext<ConfiguratorContextValue | null>(null);

export function useConfigurator(): ConfiguratorContextValue {
  const context = useContext(ConfiguratorContext);
  if (!context) throw new Error("useConfigurator must be used inside <ConfiguratorProvider>");
  return context;
}
