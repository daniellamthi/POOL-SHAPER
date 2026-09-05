import { useCallback, useMemo, useReducer, type ReactNode } from "react";
import { ConfiguratorContext, type ConfiguratorContextValue } from "./context";
import {
  DEFAULT_CONTROL_POINTS,
  DEFAULT_CUSTOMER,
  DEFAULT_DIMENSIONS,
  DIMENSION_LIMITS,
  STEPS,
  RENOVATION_STEPS,
  type DimensionKey,
} from "./config";
import { buildOutline, computeMetrics, constrainControlPoints } from "./geometry";
import { planSkimmers } from "./engineering";
import { getCustomerValidation } from "./validation";
import { DEFAULT_MOSAIC_FINISH_ID } from "@/configurator/materials/interior-textures";
import type {
  ControlPoint,
  CustomMode,
  CustomerInfo,
  EquipmentId,
  FinishMaterial,
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

type Action =
  | { type: "setProjectType"; value: ProjectType }
  | { type: "setPoolType"; value: PoolType }
  | { type: "setPoolStructure"; value: PoolStructure }
  | { type: "setCustomerField"; key: keyof CustomerInfo; value: string }
  | { type: "setShape"; value: PoolShapeId }
  | { type: "setCustomMode"; value: CustomMode }
  | { type: "setControlPoint"; index: number; value: ControlPoint }
  | { type: "resetControlPoints" }
  | { type: "setDimension"; key: DimensionKey; value: number }
  | { type: "setSystem"; value: SystemType }
  | { type: "setOverflowType"; value: OverflowType }
  | { type: "setSkimmerFinish"; value: SkimmerFinishId }
  | { type: "setSkimmerType"; value: SkimmerTypeId }
  | { type: "setFinish"; value: FinishMaterial }
  | { type: "setLinerColor"; value: LinerColor }
  | { type: "setMosaicFinish"; value: MosaicFinishId }
  | { type: "togglePoolFeature"; value: PoolFeatureId }
  | { type: "setPoolAccess"; value: PoolAccess }
  | { type: "toggleEquipment"; value: EquipmentId }
  | { type: "updateRenovation"; value: Partial<RenovationConfig> }
  | { type: "addUploads"; value: UploadedFile[] }
  | { type: "removeUpload"; id: string }
  | { type: "goToStep"; value: number }
  | { type: "next" }
  | { type: "previous" }
  | { type: "reset" };

interface State {
  config: PoolConfig;
  renovation: RenovationConfig;
  step: number;
}

const initialState: State = {
  step: 0,
  renovation: {
    areas: [],
    currentFinish: "liner",
    filtrationWorks: [],
    replaceCoping: null,
    copingMaterial: "",
    structureIssues: [],
    equipmentUpgrades: [],
  },
  config: {
    projectType: null,
    poolType: null,
    structure: null,
    shape: "rectangle",
    customMode: "draw",
    controlPoints: DEFAULT_CONTROL_POINTS,
    dimensions: DEFAULT_DIMENSIONS,
    system: "skimmer",
    overflowType: "hidden",
    skimmerFinish: "white",
    skimmerType: "standard",
    finish: "liner",
    linerColor: "motionBlueSky602",
    mosaicFinish: DEFAULT_MOSAIC_FINISH_ID,
    features: [],
    poolAccess: null,
    equipment: [],
    customer: DEFAULT_CUSTOMER,
    uploads: [],
  },
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function reducer(state: State, action: Action): State {
  const config = state.config;
  switch (action.type) {
    case "setProjectType":
      return { ...state, config: { ...config, projectType: action.value } };
    case "setPoolType": {
      const structure =
        action.value === "in-ground"
          ? config.structure === "modular-steel-structure"
            ? null
            : config.structure
          : config.structure === "modular-steel-structure"
            ? config.structure
            : null;
      return { ...state, config: { ...config, poolType: action.value, structure } };
    }
    case "setPoolStructure":
      return { ...state, config: { ...config, structure: action.value } };
    case "setCustomerField":
      return {
        ...state,
        config: { ...config, customer: { ...config.customer, [action.key]: action.value } },
      };
    case "setShape":
      return { ...state, config: { ...config, shape: action.value } };
    case "setCustomMode":
      return { ...state, config: { ...config, customMode: action.value } };
    case "setControlPoint": {
      const points = constrainControlPoints(
        config.controlPoints,
        action.index,
        action.value,
        config.dimensions,
      );
      return { ...state, config: { ...config, controlPoints: points } };
    }
    case "resetControlPoints":
      return { ...state, config: { ...config, controlPoints: DEFAULT_CONTROL_POINTS } };
    case "setDimension": {
      const limits = DIMENSION_LIMITS[action.key];
      if (!Number.isFinite(action.value)) return state;
      const value = clamp(action.value, limits.min, limits.max);
      return {
        ...state,
        config: { ...config, dimensions: { ...config.dimensions, [action.key]: value } },
      };
    }
    case "setSystem":
      return { ...state, config: { ...config, system: action.value } };
    case "setOverflowType":
      return { ...state, config: { ...config, overflowType: action.value } };
    case "setSkimmerFinish":
      return { ...state, config: { ...config, skimmerFinish: action.value } };
    case "setSkimmerType":
      return { ...state, config: { ...config, skimmerType: action.value } };
    case "setFinish":
      return { ...state, config: { ...config, finish: action.value } };
    case "setLinerColor":
      return { ...state, config: { ...config, linerColor: action.value } };
    case "setMosaicFinish":
      return { ...state, config: { ...config, mosaicFinish: action.value } };
    case "togglePoolFeature": {
      const features = config.features.includes(action.value)
        ? config.features.filter((id) => id !== action.value)
        : [...config.features, action.value];
      return { ...state, config: { ...config, features } };
    }
    case "setPoolAccess":
      return { ...state, config: { ...config, poolAccess: action.value } };
    case "toggleEquipment": {
      const equipment = config.equipment.includes(action.value)
        ? config.equipment.filter((id) => id !== action.value)
        : [...config.equipment, action.value];
      return { ...state, config: { ...config, equipment } };
    }
    case "updateRenovation":
      return { ...state, renovation: { ...state.renovation, ...action.value } };
    case "addUploads":
      return { ...state, config: { ...config, uploads: [...config.uploads, ...action.value] } };
    case "removeUpload":
      return {
        ...state,
        config: { ...config, uploads: config.uploads.filter((file) => file.id !== action.id) },
      };
    case "goToStep": {
      const count = config.projectType === "renovation" ? RENOVATION_STEPS.length : STEPS.length;
      return { ...state, step: clamp(action.value, 0, count - 1) };
    }
    case "next":
      return {
        ...state,
        step: clamp(
          state.step + 1,
          0,
          config.projectType === "renovation" ? RENOVATION_STEPS.length - 1 : STEPS.length - 1,
        ),
      };
    case "previous": {
      const count = config.projectType === "renovation" ? RENOVATION_STEPS.length : STEPS.length;
      return { ...state, step: clamp(state.step - 1, 0, count - 1) };
    }
    case "reset":
      return initialState;
    default:
      return state;
  }
}

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const { config, renovation, step } = state;

  const outline = useMemo(
    () => buildOutline(config.shape, config.dimensions, config.controlPoints),
    [config.shape, config.dimensions, config.controlPoints],
  );

  const metrics = useMemo(
    () => computeMetrics(outline, config.dimensions.depth),
    [outline, config.dimensions.depth],
  );

  const skimmers = useMemo(
    () => planSkimmers(outline, metrics.waterSurface, config.system === "skimmer"),
    [outline, metrics.waterSurface, config.system],
  );

  const isStepComplete = useCallback(
    (index: number) => {
      const customer = config.customer;
      if (index === 0) return config.projectType !== null;
      if (config.projectType === "renovation") {
        if (index === 1) return renovation.areas.length > 0;
        if (index === 4) {
          const customer = config.customer;
          return (
            ["name", "surname", "email", "phone", "city", "country"].every(
              (key) => customer[key as keyof CustomerInfo].trim().length > 0,
            ) && getCustomerValidation(customer).emailValid
          );
        }
        return true;
      }
      const stepId = STEPS[index]?.id;
      if (stepId === "pool-type") return config.poolType !== null;
      if (stepId === "structure") return config.structure !== null;
      if (stepId === "features") return config.poolAccess !== null;
      if (stepId === "contact") return getCustomerValidation(customer).valid;
      return true;
    },
    [config, renovation],
  );

  const value = useMemo<ConfiguratorContextValue>(
    () => ({
      config,
      step,
      outline,
      metrics,
      skimmers,
      renovation,
      isStepComplete,
      canContinue: isStepComplete(step),
      setProjectType: (v) => dispatch({ type: "setProjectType", value: v }),
      setPoolType: (v) => dispatch({ type: "setPoolType", value: v }),
      setPoolStructure: (v) => dispatch({ type: "setPoolStructure", value: v }),
      setCustomerField: (key, v) => dispatch({ type: "setCustomerField", key, value: v }),
      setShape: (v) => dispatch({ type: "setShape", value: v }),
      setCustomMode: (v) => dispatch({ type: "setCustomMode", value: v }),
      setControlPoint: (index, v) => dispatch({ type: "setControlPoint", index, value: v }),
      resetControlPoints: () => dispatch({ type: "resetControlPoints" }),
      setDimension: (key, v) => dispatch({ type: "setDimension", key, value: v }),
      setSystem: (v) => dispatch({ type: "setSystem", value: v }),
      setOverflowType: (v) => dispatch({ type: "setOverflowType", value: v }),
      setSkimmerFinish: (v) => dispatch({ type: "setSkimmerFinish", value: v }),
      setSkimmerType: (v) => dispatch({ type: "setSkimmerType", value: v }),
      setFinish: (v) => dispatch({ type: "setFinish", value: v }),
      setLinerColor: (v) => dispatch({ type: "setLinerColor", value: v }),
      setMosaicFinish: (v) => dispatch({ type: "setMosaicFinish", value: v }),
      togglePoolFeature: (v) => dispatch({ type: "togglePoolFeature", value: v }),
      setPoolAccess: (v) => dispatch({ type: "setPoolAccess", value: v }),
      toggleEquipment: (v) => dispatch({ type: "toggleEquipment", value: v }),
      updateRenovation: (v) => dispatch({ type: "updateRenovation", value: v }),
      addUploads: (files) => dispatch({ type: "addUploads", value: files }),
      removeUpload: (id) => {
        const upload = config.uploads.find((file) => file.id === id);
        if (upload?.url) URL.revokeObjectURL(upload.url);
        dispatch({ type: "removeUpload", id });
      },
      goToStep: (i) => dispatch({ type: "goToStep", value: i }),
      next: () => dispatch({ type: "next" }),
      previous: () => dispatch({ type: "previous" }),
      reset: () => {
        for (const upload of config.uploads) {
          if (upload.url) URL.revokeObjectURL(upload.url);
        }
        dispatch({ type: "reset" });
      },
    }),
    [config, renovation, step, outline, metrics, skimmers, isStepComplete],
  );

  return <ConfiguratorContext.Provider value={value}>{children}</ConfiguratorContext.Provider>;
}
