import { createContext, useContext } from "react";
import type { DimensionKey } from "./config";
import type { SkimmerPlan } from "./engineering";
import type {
  AccessoryId,
  ControlPoint,
  CustomMode,
  CustomerInfo,
  FinishMaterial,
  LinerColor,
  Outline,
  PoolConfig,
  PoolMetrics,
  PoolShapeId,
  ProjectType,
  SystemType,
  UploadedFile,
  RenovationConfig,
} from "./types";

export interface ConfiguratorContextValue {
  config: PoolConfig;
  step: number;
  outline: Outline;
  metrics: PoolMetrics;
  skimmers: SkimmerPlan;
  renovation: RenovationConfig;
  isStepComplete: (index: number) => boolean;
  canContinue: boolean;
  setProjectType: (value: ProjectType) => void;
  setCustomerField: (key: keyof CustomerInfo, value: string) => void;
  setShape: (value: PoolShapeId) => void;
  setCustomMode: (value: CustomMode) => void;
  setControlPoint: (index: number, value: ControlPoint) => void;
  resetControlPoints: () => void;
  setDimension: (key: DimensionKey, value: number) => void;
  setSystem: (value: SystemType) => void;
  setFinish: (value: FinishMaterial) => void;
  setLinerColor: (value: LinerColor) => void;
  toggleAccessory: (value: AccessoryId) => void;
  updateRenovation: (value: Partial<RenovationConfig>) => void;
  addUploads: (files: UploadedFile[]) => void;
  removeUpload: (id: string) => void;
  goToStep: (index: number) => void;
  next: () => void;
  previous: () => void;
  reset: () => void;
}

export const ConfiguratorContext = createContext<ConfiguratorContextValue | null>(null);

export function useConfigurator(): ConfiguratorContextValue {
  const context = useContext(ConfiguratorContext);
  if (!context) throw new Error("useConfigurator must be used inside <ConfiguratorProvider>");
  return context;
}
