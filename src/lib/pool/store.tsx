import {
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
  type ReactNode,
} from "react";
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
import { isLedColor, normalisedLedIntensity, LED_OPTICS } from "./led-optics";
import { getCustomerValidation } from "./validation";
import { createProjectId, toProjectConfiguration, type ProjectConfiguration } from "./project";
import { clearProjectDraft, loadProjectDraft, saveProjectDraft } from "./persistence";
import { DEFAULT_MOSAIC_FINISH_ID } from "@/configurator/materials/interior-textures";
import type {
  ControlPoint,
  CustomMode,
  CustomerInfo,
  EquipmentId,
  FinishMaterial,
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

type Action =
  | { type: "setProjectType"; value: ProjectType }
  | { type: "setPoolType"; value: PoolType }
  | { type: "setPoolStructure"; value: PoolStructure }
  | { type: "setCustomerField"; key: keyof CustomerInfo; value: string }
  | { type: "setShape"; value: PoolShapeId }
  | { type: "setCopingMaterial"; value: NonNullable<PoolConfig["copingMaterial"]> }
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
  | { type: "setLedColor"; value: string }
  | { type: "setLedIntensity"; value: number }
  | { type: "setInternalStairType"; value: InternalStairType }
  | { type: "setPoolAccess"; value: PoolAccess }
  | { type: "toggleEquipment"; value: EquipmentId }
  | { type: "updateRenovation"; value: Partial<RenovationConfig> }
  | { type: "addUploads"; value: UploadedFile[] }
  | { type: "removeUpload"; id: string }
  | {
      type: "setUploadStatus";
      id: string;
      status: NonNullable<UploadedFile["uploadStatus"]>;
      storagePath?: string | null;
      uploadError?: string;
    }
  | { type: "goToStep"; value: number }
  | { type: "next" }
  | { type: "previous" }
  | { type: "reset" }
  | { type: "restoreProject"; value: ProjectConfiguration };

interface State {
  config: PoolConfig;
  renovation: RenovationConfig;
  step: number;
  /** Stable identity for this project; regenerated only on `reset`, when a
   * genuinely new project begins. */
  projectId: string;
}

function createInitialState(): State {
  return {
    step: 0,
    projectId: createProjectId(),
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
      shapeSelected: false,
      copingMaterial: "travertine",
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
      ledColor: "#ffffff",
      ledIntensity: LED_OPTICS.defaultIntensity,
      poolAccess: null,
      internalStairType: "linear",
      equipment: [],
      customer: DEFAULT_CUSTOMER,
      uploads: [],
    },
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function reducer(state: State, action: Action): State {
  const config = state.config;
  switch (action.type) {
    case "setLedColor":
      return isLedColor(action.value)
        ? { ...state, config: { ...config, ledColor: action.value.toLowerCase() } }
        : state;
    case "setInternalStairType":
      return { ...state, config: { ...config, internalStairType: action.value } };
    case "setLedIntensity":
      return {
        ...state,
        config: { ...config, ledIntensity: normalisedLedIntensity(action.value) },
      };
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
      return { ...state, config: { ...config, shape: action.value, shapeSelected: true } };
    case "setCopingMaterial":
      return { ...state, config: { ...config, copingMaterial: action.value } };
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
    case "addUploads": {
      const withDefaults: UploadedFile[] = action.value.map((file) => {
        const next: UploadedFile = { ...file };
        next.uploadStatus = file.uploadStatus ?? "pending";
        next.storagePath = file.storagePath ?? null;
        return next;
      });
      return { ...state, config: { ...config, uploads: [...config.uploads, ...withDefaults] } };
    }
    case "removeUpload":
      return {
        ...state,
        config: { ...config, uploads: config.uploads.filter((file) => file.id !== action.id) },
      };
    case "setUploadStatus":
      return {
        ...state,
        config: {
          ...config,
          uploads: config.uploads.map((file) => {
            if (file.id !== action.id) return file;
            const next: UploadedFile = { ...file, uploadStatus: action.status };
            if (action.storagePath !== undefined) next.storagePath = action.storagePath;
            if (action.uploadError !== undefined) next.uploadError = action.uploadError;
            return next;
          }),
        },
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
      return createInitialState();
    case "restoreProject":
      // Keeps `step` at its current value -- which step to land on after a
      // restore is view/navigation UX, decided by the provider effect
      // below, not project data.
      return {
        ...state,
        projectId: action.value.projectId,
        config: action.value.config,
        renovation: action.value.renovation,
      };
    default:
      return state;
  }
}

/** First step (in the appropriate wizard for this project type) that isn't
 * complete yet for a freshly-restored config -- mirrors `isStepComplete`'s
 * per-step rules below, but as a pure function over a specific config
 * instead of the provider's own closed-over state, since it needs to run
 * against the just-loaded draft before that state is committed. */
function firstIncompleteStepIndex(config: PoolConfig, renovation: RenovationConfig): number {
  if (config.projectType === "renovation") {
    if (renovation.areas.length === 0) return 1;
    const customer = config.customer;
    const contactComplete =
      ["name", "surname", "email", "phone", "city", "country"].every(
        (key) => customer[key as keyof CustomerInfo].trim().length > 0,
      ) && getCustomerValidation(customer).emailValid;
    if (!contactComplete) return 4;
    return RENOVATION_STEPS.length - 1;
  }
  for (let index = 0; index < STEPS.length; index++) {
    const stepId = STEPS[index]?.id;
    if (stepId === "pool-type" && config.poolType === null) return index;
    if (stepId === "shape-dimensions" && config.shapeSelected !== true) return index;
    if (stepId === "structure" && config.structure === null) return index;
    if (stepId === "features" && config.poolAccess === null) return index;
    if (stepId === "contact" && !getCustomerValidation(config.customer).valid) return index;
  }
  return STEPS.length - 1;
}

export function ConfiguratorProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, undefined, createInitialState);
  const { config, renovation, step, projectId } = state;

  const projectConfiguration = useMemo(
    () => toProjectConfiguration(projectId, config, renovation),
    [projectId, config, renovation],
  );

  // Autosave/resume (P4). Restore runs once on mount, client-side only --
  // SSR always renders the plain default state, so there is no
  // server/client hydration mismatch to worry about; this effect only ever
  // runs in the browser, after hydration.
  const [justRestoredProject, setJustRestoredProject] = useState(false);
  useEffect(() => {
    const draft = loadProjectDraft();
    if (!draft) return;
    dispatch({ type: "restoreProject", value: draft });
    dispatch({ type: "goToStep", value: firstIncompleteStepIndex(draft.config, draft.renovation) });
    setJustRestoredProject(true);
    // Runs once per mount by design -- a later `reset()` starts a fresh
    // project and clears the draft rather than re-triggering this restore.
  }, []);

  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (saveTimeoutRef.current !== null) clearTimeout(saveTimeoutRef.current);
    // Debounced so a drag/typing burst writes once, not on every change.
    saveTimeoutRef.current = setTimeout(() => saveProjectDraft(projectConfiguration), 800);
    return () => {
      if (saveTimeoutRef.current !== null) clearTimeout(saveTimeoutRef.current);
    };
  }, [projectConfiguration]);

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
      if (stepId === "shape-dimensions") return config.shapeSelected === true;
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
      projectId,
      projectConfiguration,
      isStepComplete,
      canContinue: isStepComplete(step),
      setProjectType: (v) => dispatch({ type: "setProjectType", value: v }),
      setPoolType: (v) => dispatch({ type: "setPoolType", value: v }),
      setPoolStructure: (v) => dispatch({ type: "setPoolStructure", value: v }),
      setCustomerField: (key, v) => dispatch({ type: "setCustomerField", key, value: v }),
      setShape: (v) => dispatch({ type: "setShape", value: v }),
      setCopingMaterial: (v) => dispatch({ type: "setCopingMaterial", value: v }),
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
      setLedColor: (v) => dispatch({ type: "setLedColor", value: v }),
      setLedIntensity: (v) => dispatch({ type: "setLedIntensity", value: v }),
      setInternalStairType: (v) => dispatch({ type: "setInternalStairType", value: v }),
      setPoolAccess: (v) => dispatch({ type: "setPoolAccess", value: v }),
      toggleEquipment: (v) => dispatch({ type: "toggleEquipment", value: v }),
      updateRenovation: (v) => dispatch({ type: "updateRenovation", value: v }),
      addUploads: (files) => dispatch({ type: "addUploads", value: files }),
      removeUpload: (id) => {
        const upload = config.uploads.find((file) => file.id === id);
        if (upload?.url) URL.revokeObjectURL(upload.url);
        dispatch({ type: "removeUpload", id });
      },
      setUploadStatus: (id, status, storagePath, uploadError) =>
        dispatch({
          type: "setUploadStatus",
          id,
          status,
          ...(storagePath !== undefined ? { storagePath } : {}),
          ...(uploadError !== undefined ? { uploadError } : {}),
        }),
      goToStep: (i) => dispatch({ type: "goToStep", value: i }),
      next: () => dispatch({ type: "next" }),
      previous: () => dispatch({ type: "previous" }),
      reset: () => {
        for (const upload of config.uploads) {
          if (upload.url) URL.revokeObjectURL(upload.url);
        }
        // Starting over must not leave the old draft to be restored on the
        // next visit -- clear it immediately rather than waiting for the
        // debounced autosave to overwrite it with the fresh (blank) state.
        clearProjectDraft();
        setJustRestoredProject(false);
        dispatch({ type: "reset" });
      },
      justRestoredProject,
      dismissRestoredProjectNotice: () => setJustRestoredProject(false),
    }),
    [
      config,
      renovation,
      step,
      projectId,
      projectConfiguration,
      outline,
      metrics,
      skimmers,
      isStepComplete,
      justRestoredProject,
    ],
  );

  return <ConfiguratorContext.Provider value={value}>{children}</ConfiguratorContext.Provider>;
}
