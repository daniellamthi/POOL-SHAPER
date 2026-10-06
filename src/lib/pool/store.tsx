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
import { focusForAction, nextFocusRequest, type FocusRequest } from "./contextual-camera";
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
import { configuredAccessPlan } from "./access-plan";
import { configuredComfortPlan, activeFlightKind, normalizeComfortFeatures } from "./comfort-plan";
import { isLedColor, normalisedLedIntensity, LED_OPTICS } from "./led-optics";
import {
  buildFloorProfile,
  clampShallowDepth,
  computeSlopeMetrics,
  suggestShallowDepth,
} from "./floor-profile";
import { getPoolVerticalLayout } from "./vertical-layout";
import { getCustomerValidation } from "./validation";
import { createProjectId, toProjectConfiguration, type ProjectConfiguration } from "./project";
import { clearProjectDraft, loadProjectDraft, saveProjectDraft } from "./persistence";
import { DEFAULT_MOSAIC_FINISH_ID } from "@/configurator/materials/interior-textures";
import type {
  ControlPoint,
  CustomMode,
  CustomerInfo,
  EquipmentId,
  CoverPosition,
  FinishMaterial,
  FloorProfile,
  InternalStairType,
  HydromassageVariant,
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
import { clampLShapeDimensions, type LShapeOrientation } from "./l-shape";
import { clampOrganicShapeParams } from "./organic-shape";
import { pavingId, premiumEnvironment, type PavingId, type PremiumEnvironment } from "./presentation";
import { clampInfinityEdgeParams, compatibleInfinityZones, compatiblePoolSystem, infinityZonesForOutline } from "./infinity-edge";
import {
  allowedFinishesForStructure,
  normaliseFinishForStructure,
  structureSupportsPoolType,
} from "./structure-finish";

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
  | { type: "setFloorProfile"; value: FloorProfile }
  | { type: "toggleSlopeReversed" }
  | { type: "setLShapeOrientation"; value: LShapeOrientation }
  | { type: "setOrganicMirror"; value: boolean }
  | { type: "setSystem"; value: SystemType }
  | { type: "setOverflowType"; value: OverflowType }
  | { type: "setInfinitySide"; value: number }
  | { type: "setSkimmerFinish"; value: SkimmerFinishId }
  | { type: "setSkimmerType"; value: SkimmerTypeId }
  | { type: "setFinish"; value: FinishMaterial }
  | { type: "setLinerColor"; value: LinerColor }
  | { type: "setMosaicFinish"; value: MosaicFinishId }
  | { type: "togglePoolFeature"; value: PoolFeatureId }
  | { type: "setLedColor"; value: string }
  | { type: "setLedIntensity"; value: number }
  | { type: "setSceneTime"; value: "day" | "night" }
  | { type: "setPaving"; value: PavingId }
  | { type: "setPremiumEnvironment"; value: PremiumEnvironment }
  | { type: "setInternalStairType"; value: InternalStairType }
  | { type: "setHydromassageVariant"; value: HydromassageVariant }
  | { type: "setPoolAccess"; value: PoolAccess }
  | { type: "toggleInternalSteps" }
  | { type: "toggleInoxLadder" }
  | { type: "toggleEquipment"; value: EquipmentId }
  | { type: "setCoverPosition"; value: CoverPosition }
  | { type: "setCoverExtension"; value: number }
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
  visualFocus?: FocusRequest | null;
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
      sceneTime: "day",
      poolAccess: null,
      internalStairType: "linear",
      equipment: [],
      customer: DEFAULT_CUSTOMER,
      uploads: [],
    },
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

function withoutInfinityEdge(config: PoolConfig): PoolConfig {
  if (config.infinityEdge === undefined) return config;
  const next = { ...config };
  delete next.infinityEdge;
  return next;
}

function validateInfinity(config: PoolConfig, invalidate = false): PoolConfig {
  if (config.system !== "infinity") return withoutInfinityEdge(config);
  if (!config.infinityEdge) return config;
  const outline = buildOutline(config.shape, config.dimensions, config.controlPoints);
  const valid =
    !invalidate &&
    infinityZonesForOutline(outline, config.shape).some(
      (z) => z.side === config.infinityEdge?.side,
    );
  return valid ? config : { ...config, infinityEdge: clampInfinityEdgeParams(undefined) };
}

function configurationReducer(state: State, action: Action): State {
  const config = state.config;
  switch (action.type) {
    case "setLedColor":
      return isLedColor(action.value)
        ? { ...state, config: { ...config, ledColor: action.value.toLowerCase() } }
        : state;
    case "setInternalStairType":
      return { ...state, config: { ...config, internalStairType: action.value } };
    case "setHydromassageVariant":
      return { ...state, config: { ...config, hydromassageVariant: action.value } };
    case "setLedIntensity":
      return {
        ...state,
        config: { ...config, ledIntensity: normalisedLedIntensity(action.value) },
      };
    case "setSceneTime":
      return { ...state, config: { ...config, sceneTime: action.value } };
    case "setPaving":
      return { ...state, config: { ...config, paving: pavingId(action.value) } };
    case "setPremiumEnvironment":
      return { ...state, config: { ...config, premiumEnvironment: premiumEnvironment(action.value) } };
    case "setProjectType": {
      if (config.projectType === action.value) return state;
      // A renovation describes an existing pool; do not inherit the new-pool
      // system, finish, geometry or accessories from the previous mode.
      const fresh = createInitialState();
      return {
        ...state,
        step: 0,
        config: { ...fresh.config, projectType: action.value, customer: config.customer },
        renovation: fresh.renovation,
      };
    }
    case "setPoolType": {
      const structure = structureSupportsPoolType(config.structure, action.value)
        ? config.structure
        : null;
      const features = action.value === "above-ground"
        ? config.features.filter((id) => id !== "sunShelf" && id !== "hydromassage" && id !== "integratedBench")
        : config.features.filter((id) => id !== "externalStaircase");
      const system = compatiblePoolSystem(
        config.system,
        buildOutline(config.shape, config.dimensions, config.controlPoints),
        config.shape,
        action.value,
      );
      const nextConfig = {
        ...config,
        poolType: action.value,
        structure,
        finish: normaliseFinishForStructure(structure, config.finish),
        features,
        system,
      };
      return { ...state, config: system === "infinity" ? nextConfig : withoutInfinityEdge(nextConfig) };
    }
    case "setPoolStructure": {
      if (!structureSupportsPoolType(action.value, config.poolType)) return state;
      return {
        ...state,
        config: {
          ...config,
          structure: action.value,
          finish: normaliseFinishForStructure(action.value, config.finish),
        },
      };
    }
    case "setCustomerField":
      return {
        ...state,
        config: { ...config, customer: { ...config.customer, [action.key]: action.value } },
      };
    case "setShape": {
      if (action.value === "organic") return state;
      // First activation of L-shape: seed sensible recess dimensions (rather
      // than leaving them undefined, which `clampLShapeDimensions` would
      // otherwise have to default blindly) from whatever length/width the
      // pool already has -- same seeding pattern `setFloorProfile` below
      // uses for `shallowDepth`.
      const dimensions =
        action.value === "l-shape" && config.dimensions.lShapeRecessLength === undefined
          ? (() => {
              const seeded = clampLShapeDimensions({
                totalLength: config.dimensions.length,
                totalWidth: config.dimensions.width,
              });
              return {
                ...config.dimensions,
                length: seeded.totalLength,
                width: seeded.totalWidth,
                lShapeRecessLength: seeded.recessLength,
                lShapeRecessWidth: seeded.recessWidth,
                lShapeOrientation: seeded.orientation,
              };
            })()
          : config.dimensions;
      // Geometry Pass D (Infinity, Rectangle + L-shape): switching to a shape
      // Infinity has no real zones for (Organic) while Infinity is selected
      // falls back to skimmer live, in-session -- the same rule project.ts's
      // normalisation already applies on load/save, so the UI and the 3D
      // view are never left showing a system that has no zones for the new
      // shape until a reload happens to correct it.
      const system = compatiblePoolSystem(
        config.system,
        buildOutline(action.value, dimensions, config.controlPoints),
        action.value,
        config.poolType,
      );
      return {
        ...state,
        config: validateInfinity(
          {
            ...config,
            shape: action.value,
            shapeSelected: true,
            dimensions,
            system,
            features:
              action.value === "rectangle"
                ? config.features
                : config.features.filter((id) => id !== "sunShelf" && id !== "hydromassage" && id !== "integratedBench"),
          },
          action.value !== config.shape,
        ),
      };
    }
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
      const dimensions = { ...config.dimensions, [action.key]: value };
      // A `shallowDepth` request is further clamped below the (possibly just
      // updated) deep `depth` by a real minimum difference; changing `depth`
      // itself must re-clamp an existing `shallowDepth` for the same reason
      // -- neither a stray UI value nor a depth edit can leave the slope
      // inverted, zero-difference or NaN.
      if (action.key === "shallowDepth") {
        dimensions.shallowDepth = clampShallowDepth(
          value,
          dimensions.depth,
          DIMENSION_LIMITS.depth.min,
        );
      } else if (action.key === "depth" && dimensions.shallowDepth !== undefined) {
        dimensions.shallowDepth = clampShallowDepth(
          dimensions.shallowDepth,
          value,
          DIMENSION_LIMITS.depth.min,
        );
      }
      return {
        ...state,
        config: validateInfinity(
          { ...config, dimensions },
          config.shape === "organic" &&
            ["length", "width", "organicCurvature"].includes(action.key) &&
            value !== config.dimensions[action.key],
        ),
      };
    }
    case "setFloorProfile": {
      const dimensions = { ...config.dimensions, floorProfile: action.value };
      // First activation: seed a sensible shallow depth rather than leaving
      // it undefined (which `floor-profile.ts` would otherwise have to guess
      // at every read) or repeating a blind constant regardless of pool size.
      if (action.value === "slope" && dimensions.shallowDepth === undefined) {
        dimensions.shallowDepth = suggestShallowDepth(dimensions.depth, DIMENSION_LIMITS.depth.min);
      }
      return { ...state, config: { ...config, dimensions } };
    }
    case "toggleSlopeReversed":
      return {
        ...state,
        config: {
          ...config,
          dimensions: { ...config.dimensions, slopeReversed: !config.dimensions.slopeReversed },
        },
      };
    case "setLShapeOrientation":
      return {
        ...state,
        config: validateInfinity(
          {
            ...config,
            dimensions: { ...config.dimensions, lShapeOrientation: action.value },
          },
          action.value !== config.dimensions.lShapeOrientation,
        ),
      };
    case "setOrganicMirror":
      return {
        ...state,
        config: validateInfinity(
          {
            ...config,
            dimensions: { ...config.dimensions, organicMirror: action.value },
          },
          action.value !== config.dimensions.organicMirror,
        ),
      };
    case "setSystem": {
      const system = compatiblePoolSystem(
        action.value,
        buildOutline(config.shape, config.dimensions, config.controlPoints),
        config.shape,
        config.poolType,
      );
      const nextConfig = { ...config, system };
      return { ...state, config: system === "infinity" ? nextConfig : withoutInfinityEdge(nextConfig) };
    }
    case "setOverflowType":
      return { ...state, config: { ...config, overflowType: action.value } };
    case "setInfinitySide":
      if (!compatibleInfinityZones(buildOutline(config.shape, config.dimensions, config.controlPoints), config.shape, config.poolType).some((zone) => zone.side === action.value)) return state;
      // Rectangle and L-shape, this pass -- the Acqua step never dispatches
      // this for any other shape (see the mini-plan's own gating), but the
      // reducer itself never trusts that and re-normalises through the one
      // canonical clamp regardless.
      return {
        ...state,
        config: {
          ...config,
          infinityEdge: clampInfinityEdgeParams({
            ...(config.infinityEdge ?? {}),
            enabled: true,
            side: action.value,
          }),
        },
      };
    case "setSkimmerFinish":
      return { ...state, config: { ...config, skimmerFinish: action.value } };
    case "setSkimmerType":
      return { ...state, config: { ...config, skimmerType: action.value } };
    case "setFinish":
      return allowedFinishesForStructure(config.structure).includes(action.value as "liner" | "mosaic")
        ? { ...state, config: { ...config, finish: action.value } }
        : state;
    case "setLinerColor":
      return { ...state, config: { ...config, linerColor: action.value } };
    case "setMosaicFinish":
      return { ...state, config: { ...config, mosaicFinish: action.value } };
    case "togglePoolFeature": {
      if (action.value === "externalStaircase" && config.poolType !== "above-ground") return state;
      const features = config.features.includes(action.value)
        ? normalizeComfortFeatures(config.features.filter((id) => id !== action.value))
        : normalizeComfortFeatures([...config.features, action.value], action.value);
      return { ...state, config: { ...config, features } };
    }
    case "toggleInternalSteps":
    case "toggleInoxLadder": {
      // Canonical encoding: steps -> "internalSteps"; ladder only -> "stainlessSteelLadder";
      // both -> "internalSteps" + feature "inoxLadder". Legacy saves keep loading.
      const steps = config.poolAccess === "internalSteps";
      const ladder = config.poolAccess === "stainlessSteelLadder" || (steps && config.features.includes("inoxLadder"));
      const nextSteps = action.type === "toggleInternalSteps" ? !steps : steps;
      const nextLadder = action.type === "toggleInoxLadder" ? !ladder : ladder;
      const rest = config.features.filter((id) => id !== "inoxLadder");
      return { ...state, config: { ...config,
        poolAccess: nextSteps ? "internalSteps" : nextLadder ? "stainlessSteelLadder" : null,
        features: nextSteps && nextLadder ? [...rest, "inoxLadder"] : rest } };
    }
    case "setPoolAccess":
      return { ...state, config: { ...config, poolAccess: action.value } };
    case "toggleEquipment": {
      const equipment = config.equipment.includes(action.value)
        ? config.equipment.filter((id) => id !== action.value)
        : [...config.equipment, action.value];
      return { ...state, config: { ...config, equipment } };
    }
    case "setCoverPosition":
      return config.equipment.includes("automaticCover")
        ? {
            ...state,
            config: {
              ...config,
              coverPosition: action.value,
              coverExtension: action.value === "closed" ? 1 : 0,
            },
          }
        : state;
    case "setCoverExtension": {
      // The slider is the live position; the two-state `coverPosition` the
      // quote/technical plan read is derived from it, never the other way.
      if (!config.equipment.includes("automaticCover")) return state;
      const coverExtension = Number.isFinite(action.value)
        ? Math.min(1, Math.max(0, action.value))
        : 0;
      return {
        ...state,
        config: {
          ...config,
          coverExtension,
          coverPosition: coverExtension >= 0.5 ? "closed" : "open",
        },
      };
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
      if (action.value.config.shape === "organic") return state;
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
    if (stepId === "system" && config.system === "infinity" && !config.infinityEdge?.enabled)
      return index;
    if (stepId === "access" && !(activeFlightKind(config.features)
      ? configuredComfortPlan(config).elements.some(element => element.kind === activeFlightKind(config.features))
      : config.poolAccess !== null && !configuredAccessPlan(config).reason)) return index;
  }
  return STEPS.length - 1;
}

function reducer(state: State, action: Action): State {
  const next = configurationReducer(state, action);
  return { ...next, visualFocus: nextFocusRequest(state.visualFocus ?? null, focusForAction(action, next.config)) };
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

  const metrics = useMemo(() => {
    // `copingThickness` only ever feeds `copingY`, never floor/water/wall
    // elevations -- passing 0 here keeps the store decoupled from the
    // configurator's material/visual-preset layer for a value metrics never
    // reads.
    const verticalLayout = getPoolVerticalLayout({
      poolType: config.poolType ?? "in-ground",
      system: config.system,
      overflowType: config.overflowType,
      depth: config.dimensions.depth,
      copingThickness: 0,
    });
    const floorProfile = buildFloorProfile({
      outline,
      shape: config.shape,
      poolType: config.poolType ?? "in-ground",
      dimensions: config.dimensions,
      verticalLayout,
      sunShelf: config.features.includes("sunShelf") || config.features.includes("hydromassage"),
      infinityEdge: config.system === "infinity" ? config.infinityEdge : null,
    });
    const baseMetrics = floorProfile.sloped
      ? computeSlopeMetrics(outline, floorProfile, verticalLayout.waterY, verticalLayout.wallTopY)
      : computeMetrics(outline, config.dimensions.depth);
    const comfort = configuredComfortPlan(config);
    return {
      ...baseMetrics,
      waterVolume: Math.max(0, baseMetrics.waterVolume - comfort.displacedVolume),
    };
  }, [
    outline,
    config.shape,
    config.poolType,
    config.system,
    config.overflowType,
    config.dimensions,
    config.features,
    config.poolAccess,
    config.internalStairType,
    config.hydromassageVariant,
    config.infinityEdge,
  ]);

  const skimmers = useMemo(
    () => planSkimmers(outline, metrics.waterSurface, config.system === "skimmer"),
    [outline, metrics.waterSurface, config.system],
  );

  const isStepComplete = useCallback(
    (index: number) => {
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
      if (stepId === "system" && config.system === "infinity")
        return (
          !!config.infinityEdge?.enabled &&
          infinityZonesForOutline(outline, config.shape).some(
            (z) => z.side === config.infinityEdge?.side,
          )
        );
      if (stepId === "access") return activeFlightKind(config.features)
        ? configuredComfortPlan(config).elements.some(element => element.kind === activeFlightKind(config.features))
        : config.poolAccess !== null && !configuredAccessPlan(config).reason;
      return true;
    },
    [config, renovation, outline],
  );

  const value = useMemo<ConfiguratorContextValue>(
    () => ({
      config,
      step,
      visualFocus: state.visualFocus ?? null,
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
      setFloorProfile: (v) => dispatch({ type: "setFloorProfile", value: v }),
      toggleSlopeReversed: () => dispatch({ type: "toggleSlopeReversed" }),
      setLShapeOrientation: (v) => dispatch({ type: "setLShapeOrientation", value: v }),
      setOrganicMirror: (v) => dispatch({ type: "setOrganicMirror", value: v }),
      setSystem: (v) => dispatch({ type: "setSystem", value: v }),
      setOverflowType: (v) => dispatch({ type: "setOverflowType", value: v }),
      setInfinitySide: (v) => dispatch({ type: "setInfinitySide", value: v }),
      setSkimmerFinish: (v) => dispatch({ type: "setSkimmerFinish", value: v }),
      setSkimmerType: (v) => dispatch({ type: "setSkimmerType", value: v }),
      setFinish: (v) => dispatch({ type: "setFinish", value: v }),
      setLinerColor: (v) => dispatch({ type: "setLinerColor", value: v }),
      setMosaicFinish: (v) => dispatch({ type: "setMosaicFinish", value: v }),
      togglePoolFeature: (v) => dispatch({ type: "togglePoolFeature", value: v }),
      setLedColor: (v) => dispatch({ type: "setLedColor", value: v }),
      setLedIntensity: (v) => dispatch({ type: "setLedIntensity", value: v }),
      setSceneTime: (v) => dispatch({ type: "setSceneTime", value: v }),
      setPaving: (v) => dispatch({ type: "setPaving", value: v }),
      setPremiumEnvironment: (v) => dispatch({ type: "setPremiumEnvironment", value: v }),
      setInternalStairType: (v) => dispatch({ type: "setInternalStairType", value: v }),
      setHydromassageVariant: (v) => dispatch({ type: "setHydromassageVariant", value: v }),
      setPoolAccess: (v) => dispatch({ type: "setPoolAccess", value: v }),
      toggleInternalSteps: () => dispatch({ type: "toggleInternalSteps" }),
      toggleInoxLadder: () => dispatch({ type: "toggleInoxLadder" }),
      toggleEquipment: (v) => dispatch({ type: "toggleEquipment", value: v }),
      setCoverPosition: (v) => dispatch({ type: "setCoverPosition", value: v }),
      setCoverExtension: (v) => dispatch({ type: "setCoverExtension", value: v }),
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
      state.visualFocus,
    ],
  );

  return <ConfiguratorContext.Provider value={value}>{children}</ConfiguratorContext.Provider>;
}
